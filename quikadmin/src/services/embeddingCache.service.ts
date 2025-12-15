/**
 * Embedding Cache Service
 *
 * Redis-based caching for embeddings to reduce API costs and latency.
 * Implements requirements from PRD Vector Search v2.0:
 * - REQ-EMB-005: Implement embedding caching with integrity validation
 * - REQ-PERF-008: Embedding cache with 24-hour TTL
 *
 * Features:
 * - Redis-based caching with configurable TTL
 * - SHA-256 cache key generation
 * - Embedding integrity validation
 * - Common query pre-warming support
 * - Graceful fallback when Redis is unavailable
 *
 * @module services/embeddingCache.service
 */

import { createClient, RedisClientType } from 'redis';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { config } from '../config';
import { EmbeddingCacheInterface } from './embedding.service';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface EmbeddingCacheConfig {
  redisUrl: string;
  ttlSeconds: number;
  keyPrefix: string;
  dimensions: number;
  maxRetries: number;
  retryDelayMs: number;
  enableCompression: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalEntries: number;
  lastReset: Date;
}

export interface CachedEmbedding {
  embedding: number[];
  model: string;
  createdAt: string;
  textHash: string;
}

// ============================================================================
// Constants
// ============================================================================

const EMBEDDING_DIMENSIONS = 768;
const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const DEFAULT_KEY_PREFIX = 'emb:';

const DEFAULT_CONFIG: EmbeddingCacheConfig = {
  redisUrl: config.redis.url,
  ttlSeconds: DEFAULT_TTL_SECONDS,
  keyPrefix: DEFAULT_KEY_PREFIX,
  dimensions: EMBEDDING_DIMENSIONS,
  maxRetries: 3,
  retryDelayMs: 100,
  enableCompression: false,
};

// ============================================================================
// Embedding Cache Service Class
// ============================================================================

export class EmbeddingCacheService implements EmbeddingCacheInterface {
  private client: RedisClientType | null = null;
  private config: EmbeddingCacheConfig;
  private isConnected = false;
  private stats: CacheStats;
  private connectionPromise: Promise<void> | null = null;

  constructor(config: Partial<EmbeddingCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalEntries: 0,
      lastReset: new Date(),
    };
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  /**
   * Connect to Redis
   * Returns a promise that resolves when connected or rejects on error
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.doConnect();

    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async doConnect(): Promise<void> {
    try {
      this.client = createClient({
        url: this.config.redisUrl,
      });

      this.client.on('error', (err) => {
        logger.error('Redis cache client error', { error: err.message });
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Embedding cache connected to Redis');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        logger.warn('Embedding cache disconnected from Redis');
        this.isConnected = false;
      });

      await this.client.connect();
      this.isConnected = true;

      logger.info('EmbeddingCacheService initialized', {
        redisUrl: this.config.redisUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'),
        ttlSeconds: this.config.ttlSeconds,
        keyPrefix: this.config.keyPrefix,
      });
    } catch (error) {
      logger.error('Failed to connect to Redis for embedding cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Embedding cache disconnected from Redis');
    }
  }

  /**
   * Check if connected to Redis
   */
  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  // ==========================================================================
  // Cache Interface Implementation
  // ==========================================================================

  /**
   * Generate a unique cache key for text
   * Uses SHA-256 hash of normalized text with model prefix
   *
   * @param text - Text to generate key for
   * @param model - Model identifier (optional)
   * @returns Cache key string
   */
  generateKey(text: string, model: string = 'text-embedding-004'): string {
    const normalized = text.trim().toLowerCase();
    const hash = crypto
      .createHash('sha256')
      .update(`${model}:${normalized}`)
      .digest('hex');
    return `${this.config.keyPrefix}${hash}`;
  }

  /**
   * Get embedding from cache
   *
   * @param key - Cache key (generated by generateKey)
   * @returns Embedding array or null if not found/invalid
   */
  async get(key: string): Promise<number[] | null> {
    if (!this.isReady()) {
      logger.debug('Cache get skipped - not connected');
      return null;
    }

    try {
      const data = await this.client!.get(key);

      if (!data) {
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      const cached: CachedEmbedding = JSON.parse(data);

      // Validate cached embedding
      if (!this.validateCachedEmbedding(cached)) {
        logger.warn('Invalid cached embedding, removing', { key });
        await this.delete(key);
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();

      logger.debug('Embedding cache hit', { key: key.substring(0, 20) + '...' });
      return cached.embedding;
    } catch (error) {
      logger.error('Failed to get from embedding cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key: key.substring(0, 20) + '...',
      });
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * Store embedding in cache
   *
   * @param key - Cache key
   * @param embedding - Embedding array to store
   * @param ttlSeconds - Optional TTL override (defaults to config)
   */
  async set(key: string, embedding: number[], ttlSeconds?: number): Promise<void> {
    if (!this.isReady()) {
      logger.debug('Cache set skipped - not connected');
      return;
    }

    // Validate embedding before storing
    if (!this.validateEmbedding(embedding)) {
      logger.warn('Invalid embedding, skipping cache', {
        key: key.substring(0, 20) + '...',
        dimensions: embedding.length,
      });
      return;
    }

    const cached: CachedEmbedding = {
      embedding,
      model: 'text-embedding-004',
      createdAt: new Date().toISOString(),
      textHash: key,
    };

    try {
      const ttl = ttlSeconds ?? this.config.ttlSeconds;
      await this.client!.setEx(key, ttl, JSON.stringify(cached));

      logger.debug('Embedding cached', {
        key: key.substring(0, 20) + '...',
        ttl,
      });
    } catch (error) {
      logger.error('Failed to set embedding cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key: key.substring(0, 20) + '...',
      });
    }
  }

  /**
   * Delete embedding from cache
   *
   * @param key - Cache key to delete
   * @returns true if deleted, false if not found
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      const result = await this.client!.del(key);
      return result > 0;
    } catch (error) {
      logger.error('Failed to delete from embedding cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key: key.substring(0, 20) + '...',
      });
      return false;
    }
  }

  /**
   * Check if key exists in cache
   *
   * @param key - Cache key to check
   * @returns true if exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      const result = await this.client!.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Failed to check embedding cache existence', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  // ==========================================================================
  // Batch Operations
  // ==========================================================================

  /**
   * Get multiple embeddings from cache
   *
   * @param keys - Array of cache keys
   * @returns Map of key to embedding (null for misses)
   */
  async getMany(keys: string[]): Promise<Map<string, number[] | null>> {
    const results = new Map<string, number[] | null>();

    if (!this.isReady() || keys.length === 0) {
      keys.forEach((key) => results.set(key, null));
      return results;
    }

    try {
      const values = await this.client!.mGet(keys);

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const data = values[i];

        if (!data) {
          results.set(key, null);
          this.stats.misses++;
          continue;
        }

        try {
          const cached: CachedEmbedding = JSON.parse(data);
          if (this.validateCachedEmbedding(cached)) {
            results.set(key, cached.embedding);
            this.stats.hits++;
          } else {
            results.set(key, null);
            this.stats.misses++;
          }
        } catch {
          results.set(key, null);
          this.stats.misses++;
        }
      }

      this.updateHitRate();
      return results;
    } catch (error) {
      logger.error('Failed to get many from embedding cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
        keyCount: keys.length,
      });
      keys.forEach((key) => results.set(key, null));
      return results;
    }
  }

  /**
   * Store multiple embeddings in cache
   *
   * @param entries - Array of [key, embedding] pairs
   * @param ttlSeconds - Optional TTL override
   */
  async setMany(
    entries: Array<[string, number[]]>,
    ttlSeconds?: number
  ): Promise<void> {
    if (!this.isReady() || entries.length === 0) {
      return;
    }

    const ttl = ttlSeconds ?? this.config.ttlSeconds;

    // Use pipeline for efficiency
    const pipeline = this.client!.multi();

    for (const [key, embedding] of entries) {
      if (this.validateEmbedding(embedding)) {
        const cached: CachedEmbedding = {
          embedding,
          model: 'text-embedding-004',
          createdAt: new Date().toISOString(),
          textHash: key,
        };
        pipeline.setEx(key, ttl, JSON.stringify(cached));
      }
    }

    try {
      await pipeline.exec();
      logger.debug('Batch cached embeddings', { count: entries.length });
    } catch (error) {
      logger.error('Failed to batch set embedding cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
        count: entries.length,
      });
    }
  }

  // ==========================================================================
  // Pre-warming
  // ==========================================================================

  /**
   * Pre-warm cache with common queries
   * Useful for frequently searched terms
   *
   * @param texts - Array of texts to pre-warm
   * @param generateEmbedding - Function to generate embedding for text
   */
  async prewarm(
    texts: string[],
    generateEmbedding: (text: string) => Promise<number[]>
  ): Promise<{ warmed: number; skipped: number; errors: number }> {
    let warmed = 0;
    let skipped = 0;
    let errors = 0;

    logger.info('Starting cache pre-warming', { textCount: texts.length });

    for (const text of texts) {
      const key = this.generateKey(text);

      // Skip if already cached
      if (await this.exists(key)) {
        skipped++;
        continue;
      }

      try {
        const embedding = await generateEmbedding(text);
        await this.set(key, embedding);
        warmed++;
      } catch (error) {
        logger.warn('Failed to pre-warm cache entry', {
          error: error instanceof Error ? error.message : 'Unknown error',
          textLength: text.length,
        });
        errors++;
      }
    }

    logger.info('Cache pre-warming completed', { warmed, skipped, errors });
    return { warmed, skipped, errors };
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  /**
   * Clear all cached embeddings (matching key prefix)
   * Use with caution in production
   */
  async clear(): Promise<number> {
    if (!this.isReady()) {
      return 0;
    }

    try {
      const pattern = `${this.config.keyPrefix}*`;
      let cursor = 0;
      let deletedCount = 0;

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

      this.resetStats();
      logger.info('Embedding cache cleared', { deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Failed to clear embedding cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalEntries: 0,
      lastReset: new Date(),
    };
  }

  /**
   * Get approximate number of cached embeddings
   */
  async getEntryCount(): Promise<number> {
    if (!this.isReady()) {
      return 0;
    }

    try {
      const pattern = `${this.config.keyPrefix}*`;
      let cursor = 0;
      let count = 0;

      do {
        const result = await this.client!.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });
        cursor = result.cursor;
        count += result.keys.length;
      } while (cursor !== 0);

      this.stats.totalEntries = count;
      return count;
    } catch (error) {
      logger.error('Failed to get embedding cache count', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  // ==========================================================================
  // Validation Methods
  // ==========================================================================

  /**
   * Validate embedding dimensions and values
   */
  private validateEmbedding(embedding: number[]): boolean {
    if (!Array.isArray(embedding)) {
      return false;
    }

    if (embedding.length !== this.config.dimensions) {
      return false;
    }

    // Check for NaN or Infinity
    if (embedding.some((n) => !Number.isFinite(n))) {
      return false;
    }

    return true;
  }

  /**
   * Validate cached embedding structure and integrity
   */
  private validateCachedEmbedding(cached: CachedEmbedding): boolean {
    if (!cached || typeof cached !== 'object') {
      return false;
    }

    if (!Array.isArray(cached.embedding)) {
      return false;
    }

    if (!this.validateEmbedding(cached.embedding)) {
      return false;
    }

    // Validate structure
    if (typeof cached.model !== 'string' || cached.model.length === 0) {
      return false;
    }

    if (typeof cached.createdAt !== 'string') {
      return false;
    }

    return true;
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

// ============================================================================
// Singleton Instance & Factory
// ============================================================================

let cacheServiceInstance: EmbeddingCacheService | null = null;

/**
 * Get the singleton embedding cache service instance
 * Automatically initializes connection
 */
export async function getEmbeddingCacheService(): Promise<EmbeddingCacheService> {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new EmbeddingCacheService();
    try {
      await cacheServiceInstance.connect();
    } catch (error) {
      logger.warn('Embedding cache initialization failed, running without cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  return cacheServiceInstance;
}

/**
 * Create a new embedding cache service instance with custom configuration
 */
export function createEmbeddingCacheService(
  config?: Partial<EmbeddingCacheConfig>
): EmbeddingCacheService {
  return new EmbeddingCacheService(config);
}

/**
 * Initialize embedding cache and integrate with embedding service
 */
export async function initializeEmbeddingCache(): Promise<EmbeddingCacheService | null> {
  try {
    const cacheService = await getEmbeddingCacheService();

    if (cacheService.isReady()) {
      logger.info('Embedding cache initialized and ready');
      return cacheService;
    } else {
      logger.warn('Embedding cache not connected, embeddings will not be cached');
      return null;
    }
  } catch (error) {
    logger.warn('Failed to initialize embedding cache', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

export default EmbeddingCacheService;
