/**
 * Token Cache Service
 *
 * Redis-backed token caching with in-memory fallback to reduce Supabase auth calls.
 *
 * Features:
 * - Redis primary cache with 5-minute TTL
 * - In-memory LRU fallback when Redis unavailable
 * - SHA-256 token hashing for security (never store raw tokens)
 * - Cache statistics for monitoring
 * - Graceful degradation
 *
 * Security:
 * - Tokens are hashed before storage (SHA-256)
 * - Only user metadata is cached, not the token itself
 * - Short TTL (5 min) limits exposure window
 *
 * @module services/tokenCache.service
 */

import { createClient, RedisClientType } from 'redis';
import * as crypto from 'crypto';
import { User } from '@supabase/supabase-js';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { config } from '../config';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TokenCacheConfig {
  redisUrl: string;
  ttlSeconds: number;
  keyPrefix: string;
  maxMemoryCacheSize: number; // Max entries for in-memory fallback
  enableMemoryFallback: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  redisHits: number;
  memoryHits: number;
  lastReset: Date;
}

export interface CachedUserData {
  id: string;
  email: string;
  role?: string;
  aud: string;
  cachedAt: string;
  expiresAt: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TTL_SECONDS = 5 * 60; // 5 minutes
const DEFAULT_KEY_PREFIX = 'auth:token:';
const DEFAULT_MAX_MEMORY_CACHE = 1000;

const DEFAULT_CONFIG: TokenCacheConfig = {
  redisUrl: config.redis.url,
  ttlSeconds: parseInt(process.env.TOKEN_CACHE_TTL || String(DEFAULT_TTL_SECONDS), 10),
  keyPrefix: DEFAULT_KEY_PREFIX,
  maxMemoryCacheSize: DEFAULT_MAX_MEMORY_CACHE,
  enableMemoryFallback: true,
};

// ============================================================================
// In-Memory LRU Cache (Fallback)
// ============================================================================

class MemoryLRUCache<T> {
  private cache: Map<string, { value: T; expiresAt: number }> = new Map();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Cleanup expired entries
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }
    return pruned;
  }
}

// ============================================================================
// Token Cache Service Class
// ============================================================================

export class TokenCacheService {
  private client: RedisClientType | null = null;
  private config: TokenCacheConfig;
  private isConnected = false;
  private memoryCache: MemoryLRUCache<CachedUserData>;
  private stats: CacheStats;
  private connectionPromise: Promise<void> | null = null;
  private pruneInterval: NodeJS.Timeout | null = null;

  constructor(cacheConfig: Partial<TokenCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...cacheConfig };
    this.memoryCache = new MemoryLRUCache<CachedUserData>(this.config.maxMemoryCacheSize);
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      redisHits: 0,
      memoryHits: 0,
      lastReset: new Date(),
    };
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  async connect(): Promise<void> {
    if (this.isConnected) return;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = this.doConnect();

    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async doConnect(): Promise<void> {
    try {
      this.client = createClient({ url: this.config.redisUrl });

      this.client.on('error', (err) => {
        logger.error('[TokenCache] Redis client error', { error: err.message });
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('[TokenCache] Connected to Redis');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        logger.warn('[TokenCache] Disconnected from Redis');
        this.isConnected = false;
      });

      await this.client.connect();
      this.isConnected = true;

      // Start memory cache pruning (every minute)
      this.startPruning();

      logger.info('[TokenCache] Initialized', {
        ttlSeconds: this.config.ttlSeconds,
        memoryFallback: this.config.enableMemoryFallback,
        maxMemorySize: this.config.maxMemoryCacheSize,
      });
    } catch (error) {
      logger.warn('[TokenCache] Redis connection failed, using memory fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.isConnected = false;

      // Start pruning even without Redis
      this.startPruning();
    }
  }

  async disconnect(): Promise<void> {
    this.stopPruning();

    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('[TokenCache] Disconnected from Redis');
    }
  }

  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  private startPruning(): void {
    if (this.pruneInterval) return;

    this.pruneInterval = setInterval(() => {
      const pruned = this.memoryCache.prune();
      if (pruned > 0) {
        logger.debug('[TokenCache] Pruned expired memory entries', { count: pruned });
      }
    }, 60000); // Every minute

    if (this.pruneInterval.unref) {
      this.pruneInterval.unref();
    }
  }

  private stopPruning(): void {
    if (this.pruneInterval) {
      clearInterval(this.pruneInterval);
      this.pruneInterval = null;
    }
  }

  // ==========================================================================
  // Key Generation
  // ==========================================================================

  /**
   * Generate cache key from token using SHA-256
   * NEVER stores the actual token - only a hash
   */
  generateKey(token: string): string {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return `${this.config.keyPrefix}${hash}`;
  }

  // ==========================================================================
  // Cache Operations
  // ==========================================================================

  /**
   * Get cached user data for a token
   *
   * @param token - JWT token
   * @returns Cached user data or null if not found/expired
   */
  async get(token: string): Promise<CachedUserData | null> {
    const key = this.generateKey(token);

    // Try Redis first
    if (this.isReady()) {
      try {
        const data = await this.client!.get(key);
        if (data) {
          const cached: CachedUserData = JSON.parse(data);
          this.stats.hits++;
          this.stats.redisHits++;
          this.updateHitRate();
          logger.debug('[TokenCache] Redis hit', { userId: cached.id });
          return cached;
        }
      } catch (error) {
        logger.warn('[TokenCache] Redis get failed', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    // Try memory cache fallback
    if (this.config.enableMemoryFallback) {
      const cached = this.memoryCache.get(key);
      if (cached) {
        this.stats.hits++;
        this.stats.memoryHits++;
        this.updateHitRate();
        logger.debug('[TokenCache] Memory hit', { userId: cached.id });
        return cached;
      }
    }

    this.stats.misses++;
    this.updateHitRate();
    return null;
  }

  /**
   * Cache user data for a token
   *
   * @param token - JWT token
   * @param user - Supabase user object
   */
  async set(token: string, user: User): Promise<void> {
    const key = this.generateKey(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.ttlSeconds * 1000);

    const cached: CachedUserData = {
      id: user.id,
      email: user.email || '',
      role: user.role,
      aud: user.aud,
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    // Store in Redis
    if (this.isReady()) {
      try {
        await this.client!.setEx(key, this.config.ttlSeconds, JSON.stringify(cached));
        logger.debug('[TokenCache] Cached in Redis', { userId: user.id });
      } catch (error) {
        logger.warn('[TokenCache] Redis set failed', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    // Also store in memory cache (for fallback and faster access)
    if (this.config.enableMemoryFallback) {
      this.memoryCache.set(key, cached, this.config.ttlSeconds * 1000);
    }
  }

  /**
   * Invalidate cached token (e.g., on logout)
   *
   * @param token - JWT token to invalidate
   */
  async invalidate(token: string): Promise<void> {
    const key = this.generateKey(token);

    // Remove from Redis
    if (this.isReady()) {
      try {
        await this.client!.del(key);
      } catch (error) {
        logger.warn('[TokenCache] Redis delete failed', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    // Remove from memory cache
    this.memoryCache.delete(key);

    logger.debug('[TokenCache] Token invalidated');
  }

  /**
   * Clear all cached tokens
   * Use with caution - invalidates all sessions
   */
  async clear(): Promise<number> {
    let deletedCount = 0;

    // Clear Redis
    if (this.isReady()) {
      try {
        const pattern = `${this.config.keyPrefix}*`;
        let cursor = 0;

        do {
          const result = await this.client!.scan(cursor, {
            MATCH: pattern,
            COUNT: 100,
          });
          cursor = result.cursor;

          if (result.keys.length > 0) {
            deletedCount += await this.client!.del(result.keys);
          }
        } while (cursor !== 0);
      } catch (error) {
        logger.error('[TokenCache] Redis clear failed', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    // Clear memory cache
    const memorySize = this.memoryCache.size();
    this.memoryCache.clear();
    deletedCount += memorySize;

    this.resetStats();
    logger.info('[TokenCache] Cache cleared', { deletedCount });
    return deletedCount;
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  getStats(): CacheStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      redisHits: 0,
      memoryHits: 0,
      lastReset: new Date(),
    };
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  getMemoryCacheSize(): number {
    return this.memoryCache.size();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let tokenCacheInstance: TokenCacheService | null = null;

/**
 * Get the singleton token cache service instance
 */
export async function getTokenCacheService(): Promise<TokenCacheService> {
  if (!tokenCacheInstance) {
    tokenCacheInstance = new TokenCacheService();
    await tokenCacheInstance.connect();
  }
  return tokenCacheInstance;
}

/**
 * Get token cache metrics for monitoring
 */
export function getTokenCacheMetrics(): {
  stats: CacheStats;
  memoryCacheSize: number;
  redisConnected: boolean;
} | null {
  if (!tokenCacheInstance) return null;

  return {
    stats: tokenCacheInstance.getStats(),
    memoryCacheSize: tokenCacheInstance.getMemoryCacheSize(),
    redisConnected: tokenCacheInstance.isReady(),
  };
}

/**
 * Shutdown token cache (for graceful shutdown)
 */
export async function shutdownTokenCache(): Promise<void> {
  if (tokenCacheInstance) {
    await tokenCacheInstance.disconnect();
    tokenCacheInstance = null;
    logger.info('[TokenCache] Shutdown complete');
  }
}

export default TokenCacheService;
