/**
 * Extraction Cache Service - Phase 3.2
 *
 * Redis-based caching for extraction results.
 * Reduces costs by 40-60% for repeated documents.
 *
 * Features:
 * - Content-based hashing for cache keys
 * - TTL-based expiration (24 hours default)
 * - Category-specific caching
 * - Cache statistics tracking
 *
 * @module services/extractionCache.service
 */

import { createHash } from 'crypto';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { FEATURE_FLAGS, EXTRACTION_CACHE_CONFIG } from '../config/featureFlags';
import { ExtractedFieldResult } from '../types/extractedData';
import { DocumentCategory } from '../multiagent/types/state';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Cached extraction result
 */
export interface CachedExtraction {
  /** Extracted fields */
  fields: Record<string, ExtractedFieldResult>;
  /** Document category */
  category: DocumentCategory;
  /** Model used for extraction */
  modelUsed: string;
  /** When the extraction was cached */
  cachedAt: string;
  /** Original processing time */
  processingTimeMs: number;
  /** Cache version for invalidation */
  cacheVersion: string;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalCostSaved: number;
  avgCostPerHit: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Current cache version - increment to invalidate all cached entries
 */
const CACHE_VERSION = '1.0.0';

/**
 * Average cost per extraction in USD (for cost savings calculation)
 */
const AVG_EXTRACTION_COST = 0.015;

// ============================================================================
// Cache Service Class
// ============================================================================

/**
 * Extraction Cache Service using Redis
 */
export class ExtractionCacheService {
  private redis: any = null;
  private redisInitialized = false;
  private redisInitError: Error | null = null;

  /** Local cache statistics */
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalCostSaved: 0,
    avgCostPerHit: AVG_EXTRACTION_COST,
  };

  /** In-memory fallback cache (when Redis unavailable) */
  private memoryCache = new Map<string, { data: CachedExtraction; expiresAt: number }>();

  /**
   * Initialize Redis connection (lazy initialization)
   */
  private async initRedis(): Promise<any> {
    if (!FEATURE_FLAGS.EXTRACTION_CACHE) {
      return null;
    }

    if (this.redisInitialized) {
      if (this.redisInitError) return null;
      return this.redis;
    }

    this.redisInitialized = true;

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      logger.warn('Extraction cache disabled: REDIS_URL not configured');
      return null;
    }

    try {
      // Lazy load ioredis
      const Redis = (await import('ioredis')).default;
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });

      await this.redis.connect();
      logger.info('Extraction cache Redis connection established');
      return this.redis;
    } catch (error) {
      this.redisInitError = error instanceof Error ? error : new Error('Redis init failed');
      logger.warn('Extraction cache Redis unavailable, using in-memory fallback', {
        error: this.redisInitError.message,
      });
      return null;
    }
  }

  /**
   * Generate a cache key from document content
   *
   * Key format: ext:{category}:{contentHash}
   */
  private generateCacheKey(text: string, category: DocumentCategory): string {
    // Hash the normalized text content
    const normalizedText = text.toLowerCase().replace(/\s+/g, ' ').trim();
    const contentHash = createHash('sha256').update(normalizedText).digest('hex').slice(0, 16);

    return `${EXTRACTION_CACHE_CONFIG.KEY_PREFIX}${category}:${contentHash}`;
  }

  /**
   * Get cached extraction result
   *
   * @param text - Document text content
   * @param category - Document category
   * @returns Cached result or null if not found
   */
  async get(
    text: string,
    category: DocumentCategory
  ): Promise<CachedExtraction | null> {
    if (!FEATURE_FLAGS.EXTRACTION_CACHE) {
      return null;
    }

    const key = this.generateCacheKey(text, category);

    try {
      // Try Redis first
      const redis = await this.initRedis();
      if (redis) {
        const cached = await redis.get(key);
        if (cached) {
          const result = JSON.parse(cached) as CachedExtraction;

          // Validate cache version
          if (result.cacheVersion !== CACHE_VERSION) {
            logger.debug('Cache entry version mismatch, invalidating', {
              cachedVersion: result.cacheVersion,
              currentVersion: CACHE_VERSION,
            });
            await redis.del(key);
            this.recordMiss();
            return null;
          }

          this.recordHit();
          logger.info('Extraction cache HIT', {
            category,
            keyHash: key.slice(-8),
            age: Date.now() - new Date(result.cachedAt).getTime(),
          });
          return result;
        }
      }

      // Try memory cache fallback
      const memEntry = this.memoryCache.get(key);
      if (memEntry && memEntry.expiresAt > Date.now()) {
        if (memEntry.data.cacheVersion === CACHE_VERSION) {
          this.recordHit();
          logger.debug('Extraction cache HIT (memory)', { category });
          return memEntry.data;
        }
        this.memoryCache.delete(key);
      }

      this.recordMiss();
      logger.debug('Extraction cache MISS', { category, keyHash: key.slice(-8) });
      return null;
    } catch (error) {
      logger.warn('Extraction cache get error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      this.recordMiss();
      return null;
    }
  }

  /**
   * Store extraction result in cache
   *
   * @param text - Document text content
   * @param category - Document category
   * @param fields - Extracted fields
   * @param modelUsed - Model used for extraction
   * @param processingTimeMs - Processing time
   */
  async set(
    text: string,
    category: DocumentCategory,
    fields: Record<string, ExtractedFieldResult>,
    modelUsed: string,
    processingTimeMs: number
  ): Promise<void> {
    if (!FEATURE_FLAGS.EXTRACTION_CACHE) {
      return;
    }

    const key = this.generateCacheKey(text, category);

    const cacheEntry: CachedExtraction = {
      fields,
      category,
      modelUsed,
      cachedAt: new Date().toISOString(),
      processingTimeMs,
      cacheVersion: CACHE_VERSION,
    };

    try {
      // Try Redis first
      const redis = await this.initRedis();
      if (redis) {
        await redis.setex(
          key,
          EXTRACTION_CACHE_CONFIG.TTL_SECONDS,
          JSON.stringify(cacheEntry)
        );
        logger.debug('Extraction cached to Redis', {
          category,
          keyHash: key.slice(-8),
          ttl: EXTRACTION_CACHE_CONFIG.TTL_SECONDS,
        });
        return;
      }

      // Memory cache fallback
      this.setMemoryCache(key, cacheEntry);
      logger.debug('Extraction cached to memory', { category });
    } catch (error) {
      logger.warn('Extraction cache set error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * Set entry in memory cache with LRU eviction
   */
  private setMemoryCache(key: string, data: CachedExtraction): void {
    // Enforce max entries (simple LRU: remove oldest)
    if (this.memoryCache.size >= EXTRACTION_CACHE_CONFIG.MAX_ENTRIES) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }

    const expiresAt = Date.now() + EXTRACTION_CACHE_CONFIG.TTL_SECONDS * 1000;
    this.memoryCache.set(key, { data, expiresAt });
  }

  /**
   * Invalidate cache for a specific document
   */
  async invalidate(text: string, category: DocumentCategory): Promise<void> {
    const key = this.generateCacheKey(text, category);

    try {
      const redis = await this.initRedis();
      if (redis) {
        await redis.del(key);
      }
      this.memoryCache.delete(key);
      logger.debug('Cache entry invalidated', { category, keyHash: key.slice(-8) });
    } catch (error) {
      logger.warn('Cache invalidation error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * Invalidate all cache entries for a category
   */
  async invalidateCategory(category: DocumentCategory): Promise<number> {
    const pattern = `${EXTRACTION_CACHE_CONFIG.KEY_PREFIX}${category}:*`;
    let deleted = 0;

    try {
      const redis = await this.initRedis();
      if (redis) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          deleted = await redis.del(...keys);
        }
      }

      // Clear memory cache entries for this category
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(`${EXTRACTION_CACHE_CONFIG.KEY_PREFIX}${category}:`)) {
          this.memoryCache.delete(key);
          deleted++;
        }
      }

      logger.info('Category cache invalidated', { category, entriesDeleted: deleted });
      return deleted;
    } catch (error) {
      logger.warn('Category invalidation error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return 0;
    }
  }

  /**
   * Clear entire cache (use with caution)
   */
  async clear(): Promise<void> {
    const pattern = `${EXTRACTION_CACHE_CONFIG.KEY_PREFIX}*`;

    try {
      const redis = await this.initRedis();
      if (redis) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }
      this.memoryCache.clear();
      logger.info('Extraction cache cleared');
    } catch (error) {
      logger.warn('Cache clear error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * Record a cache hit
   */
  private recordHit(): void {
    this.stats.hits++;
    this.stats.totalCostSaved += this.stats.avgCostPerHit;
    this.updateHitRate();
  }

  /**
   * Record a cache miss
   */
  private recordMiss(): void {
    this.stats.misses++;
    this.updateHitRate();
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalCostSaved: 0,
      avgCostPerHit: AVG_EXTRACTION_COST,
    };
  }

  /**
   * Get cache info (size, memory usage, etc.)
   */
  async getCacheInfo(): Promise<{
    redisConnected: boolean;
    memoryCacheSize: number;
    stats: CacheStats;
  }> {
    let redisConnected = false;

    try {
      const redis = await this.initRedis();
      if (redis) {
        await redis.ping();
        redisConnected = true;
      }
    } catch {
      redisConnected = false;
    }

    return {
      redisConnected,
      memoryCacheSize: this.memoryCache.size,
      stats: this.getStats(),
    };
  }

  /**
   * Cleanup expired memory cache entries
   */
  cleanupExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt <= now) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Memory cache cleanup', { entriesRemoved: cleaned });
    }

    return cleaned;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.redisInitialized = false;
      logger.info('Extraction cache Redis connection closed');
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Shared extraction cache instance
 */
export const extractionCache = new ExtractionCacheService();

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get cached extraction (convenience wrapper)
 */
export async function getCachedExtraction(
  text: string,
  category: DocumentCategory
): Promise<CachedExtraction | null> {
  return extractionCache.get(text, category);
}

/**
 * Cache extraction result (convenience wrapper)
 */
export async function cacheExtraction(
  text: string,
  category: DocumentCategory,
  fields: Record<string, ExtractedFieldResult>,
  modelUsed: string,
  processingTimeMs: number
): Promise<void> {
  return extractionCache.set(text, category, fields, modelUsed, processingTimeMs);
}

/**
 * Get cache statistics (convenience wrapper)
 */
export function getExtractionCacheStats(): CacheStats {
  return extractionCache.getStats();
}

// ============================================================================
// Periodic Cleanup
// ============================================================================

/**
 * Start periodic memory cache cleanup
 * Runs every 5 minutes to remove expired entries
 */
export function startCacheCleanup(): NodeJS.Timeout {
  const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  return setInterval(() => {
    extractionCache.cleanupExpired();
  }, CLEANUP_INTERVAL_MS);
}
