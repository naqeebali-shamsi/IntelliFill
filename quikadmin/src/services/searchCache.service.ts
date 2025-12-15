/**
 * Search Cache Service
 *
 * Implements caching for knowledge search results with organization isolation.
 * Implements requirements from PRD Vector Search v2.0:
 * - Task #133: Search Caching with 5-minute TTL
 * - Automatic invalidation on document upload/delete
 * - Organization-scoped cache keys
 *
 * Supports both Redis (production) and in-memory (development) backends.
 *
 * @module services/searchCache.service
 */

import * as crypto from 'crypto';
import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CacheConfig {
  ttlSeconds: number;
  maxEntries: number;
  prefix: string;
  enableMemoryFallback: boolean;
}

export interface CachedSearchResult {
  results: any[];
  query: string;
  totalResults: number;
  searchParams: Record<string, any>;
  cachedAt: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TTL_SECONDS = 300; // 5 minutes
const DEFAULT_MAX_ENTRIES = 1000;
const CACHE_PREFIX = 'knowledge:search:';

// ============================================================================
// In-Memory Cache Implementation (Fallback)
// ============================================================================

interface MemoryCacheEntry {
  value: CachedSearchResult;
  expiresAt: number;
}

class MemoryCache {
  private cache: Map<string, MemoryCacheEntry> = new Map();
  private maxEntries: number;

  constructor(maxEntries: number = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  async get(key: string): Promise<CachedSearchResult | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: CachedSearchResult, ttlSeconds: number): Promise<void> {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async deleteByPattern(pattern: string): Promise<number> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let deleted = 0;
    const keysToDelete: string[] = [];

    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });

    for (const key of keysToDelete) {
      this.cache.delete(key);
      deleted++;
    }

    return deleted;
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  getStats(): { size: number; maxEntries: number } {
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
    };
  }
}

// ============================================================================
// Search Cache Service Class
// ============================================================================

export class SearchCacheService {
  private config: CacheConfig;
  private redisClient: RedisClientType | null = null;
  private memoryCache: MemoryCache;
  private redisConnected: boolean = false;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      ttlSeconds: config.ttlSeconds ?? DEFAULT_TTL_SECONDS,
      maxEntries: config.maxEntries ?? DEFAULT_MAX_ENTRIES,
      prefix: config.prefix ?? CACHE_PREFIX,
      enableMemoryFallback: config.enableMemoryFallback ?? true,
    };

    this.memoryCache = new MemoryCache(this.config.maxEntries);
    this.initRedis();
  }

  // ==========================================================================
  // Redis Initialization
  // ==========================================================================

  private async initRedis(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      this.redisClient = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 5) {
              logger.warn('Redis search cache: max reconnection attempts reached, using memory fallback');
              return false;
            }
            return Math.min(retries * 100, 3000);
          },
        },
      }) as RedisClientType;

      this.redisClient.on('error', (err) => {
        logger.warn('Search cache Redis error (using memory fallback):', err.message);
        this.redisConnected = false;
      });

      this.redisClient.on('ready', () => {
        logger.info('Search cache Redis connected');
        this.redisConnected = true;
      });

      await this.redisClient.connect();
    } catch (error) {
      logger.warn('Failed to connect Redis for search cache - using memory fallback');
      this.redisConnected = false;
    }
  }

  // ==========================================================================
  // Cache Key Generation
  // ==========================================================================

  /**
   * Generate a unique cache key for a search query
   *
   * @param organizationId - Organization UUID (for isolation)
   * @param searchType - Type of search (semantic, hybrid)
   * @param query - Search query text
   * @param params - Additional search parameters
   * @returns Cache key string
   */
  generateKey(
    organizationId: string,
    searchType: string,
    query: string,
    params: Record<string, any> = {}
  ): string {
    // Normalize query for consistent caching
    const normalizedQuery = query.toLowerCase().trim();

    // Create deterministic param string
    const paramString = Object.keys(params)
      .sort()
      .map((k) => `${k}:${JSON.stringify(params[k])}`)
      .join('|');

    // Generate hash for the key
    const hash = crypto
      .createHash('sha256')
      .update(`${organizationId}:${searchType}:${normalizedQuery}:${paramString}`)
      .digest('hex')
      .substring(0, 16);

    return `${this.config.prefix}${organizationId}:${searchType}:${hash}`;
  }

  // ==========================================================================
  // Cache Operations
  // ==========================================================================

  /**
   * Get cached search result
   *
   * @param key - Cache key
   * @returns Cached result or null if not found/expired
   */
  async get(key: string): Promise<CachedSearchResult | null> {
    try {
      // Try Redis first
      if (this.redisConnected && this.redisClient) {
        const cached = await this.redisClient.get(key);
        if (cached) {
          return JSON.parse(cached) as CachedSearchResult;
        }
      }

      // Fall back to memory cache
      if (this.config.enableMemoryFallback) {
        return await this.memoryCache.get(key);
      }

      return null;
    } catch (error) {
      logger.error('Search cache get error:', error);
      return null;
    }
  }

  /**
   * Set cached search result
   *
   * @param key - Cache key
   * @param result - Search result to cache
   * @param ttlSeconds - Optional TTL override
   */
  async set(
    key: string,
    result: Omit<CachedSearchResult, 'cachedAt'>,
    ttlSeconds?: number
  ): Promise<void> {
    try {
      const ttl = ttlSeconds ?? this.config.ttlSeconds;
      const cacheEntry: CachedSearchResult = {
        ...result,
        cachedAt: Date.now(),
      };

      // Try Redis first
      if (this.redisConnected && this.redisClient) {
        await this.redisClient.setEx(key, ttl, JSON.stringify(cacheEntry));
      }

      // Also set in memory cache for faster access
      if (this.config.enableMemoryFallback) {
        await this.memoryCache.set(key, cacheEntry, ttl);
      }
    } catch (error) {
      logger.error('Search cache set error:', error);
    }
  }

  /**
   * Delete a specific cache entry
   *
   * @param key - Cache key to delete
   */
  async delete(key: string): Promise<void> {
    try {
      if (this.redisConnected && this.redisClient) {
        await this.redisClient.del(key);
      }

      if (this.config.enableMemoryFallback) {
        await this.memoryCache.delete(key);
      }
    } catch (error) {
      logger.error('Search cache delete error:', error);
    }
  }

  // ==========================================================================
  // Cache Invalidation
  // ==========================================================================

  /**
   * Invalidate all search cache entries for an organization
   * Call this when documents are uploaded or deleted
   *
   * @param organizationId - Organization UUID
   * @returns Number of invalidated entries
   */
  async invalidateOrganization(organizationId: string): Promise<number> {
    try {
      let invalidated = 0;
      const pattern = `${this.config.prefix}${organizationId}:*`;

      // Invalidate in Redis
      if (this.redisConnected && this.redisClient) {
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          invalidated += await this.redisClient.del(keys);
        }
      }

      // Invalidate in memory cache
      if (this.config.enableMemoryFallback) {
        invalidated += await this.memoryCache.deleteByPattern(pattern);
      }

      logger.info('Search cache invalidated', {
        organizationId,
        invalidatedEntries: invalidated,
      });

      return invalidated;
    } catch (error) {
      logger.error('Search cache invalidation error:', error);
      return 0;
    }
  }

  /**
   * Invalidate cache for a specific document source
   * More granular invalidation for source-scoped searches
   *
   * @param organizationId - Organization UUID
   * @param sourceId - Document source UUID
   */
  async invalidateSource(organizationId: string, sourceId: string): Promise<number> {
    // For now, invalidate all org cache since source filtering is part of the key
    // Could be optimized with more granular key structure if needed
    return this.invalidateOrganization(organizationId);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    redisConnected: boolean;
    memoryStats: { size: number; maxEntries: number };
    ttlSeconds: number;
  }> {
    return {
      redisConnected: this.redisConnected,
      memoryStats: this.memoryCache.getStats(),
      ttlSeconds: this.config.ttlSeconds,
    };
  }

  /**
   * Clear all cache entries (use with caution)
   */
  async flush(): Promise<void> {
    try {
      if (this.redisConnected && this.redisClient) {
        const keys = await this.redisClient.keys(`${this.config.prefix}*`);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
      }

      // Clear memory cache by reinitializing
      this.memoryCache = new MemoryCache(this.config.maxEntries);

      logger.info('Search cache flushed');
    } catch (error) {
      logger.error('Search cache flush error:', error);
    }
  }

  /**
   * Graceful shutdown
   */
  async disconnect(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
        this.redisConnected = false;
        logger.info('Search cache Redis disconnected');
      } catch (error) {
        logger.error('Search cache disconnect error:', error);
      }
    }
  }
}

// ============================================================================
// Singleton Instance & Factory
// ============================================================================

let searchCacheInstance: SearchCacheService | null = null;

/**
 * Get the singleton search cache service instance
 */
export function getSearchCacheService(): SearchCacheService {
  if (!searchCacheInstance) {
    searchCacheInstance = new SearchCacheService();
  }
  return searchCacheInstance;
}

/**
 * Create a new search cache service instance with custom configuration
 */
export function createSearchCacheService(config?: Partial<CacheConfig>): SearchCacheService {
  return new SearchCacheService(config);
}

export default SearchCacheService;
