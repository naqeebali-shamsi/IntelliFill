/**
 * Embedding Service
 *
 * Service for generating text embeddings using Google Generative AI.
 * Implements requirements from PRD Vector Search v2.0:
 * - REQ-EMB-001: Generate 768-dimensional embeddings using Google text-embedding-004
 * - REQ-EMB-002: Support batch processing with parallel batches (3 concurrent)
 * - REQ-EMB-003: Implement rate limiting to respect API quotas
 * - REQ-EMB-004: Handle API failures with exponential backoff retry (3 attempts)
 * - REQ-EMB-005: Implement embedding caching integration hook
 * - REQ-EMB-006: Validate all embedding inputs to prevent injection
 * - REQ-EMB-007: Support API key rotation without downtime
 * - REQ-EMB-008: Enforce per-organization daily quota limits
 *
 * @module services/embedding.service
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface EmbeddingConfig {
  provider: 'google' | 'openai' | 'local';
  model: string;
  dimensions: number;
  batchSize: number;
  maxConcurrentBatches: number;
  rateLimitDelayMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  dailyQuotaLimit: number;
}

export interface EmbeddingResult {
  embedding: number[];
  tokenCount?: number;
  model: string;
  cached: boolean;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  tokenCounts?: number[];
  model: string;
  successCount: number;
  failureCount: number;
  fromCache: number;
}

export interface SimilarityResult {
  index: number;
  score: number;
  embedding: number[];
}

export interface QuotaUsage {
  organizationId: string;
  date: string;
  embeddingCount: number;
  tokenCount: number;
  lastUpdated: Date;
}

export interface EmbeddingCacheInterface {
  get(key: string): Promise<number[] | null>;
  set(key: string, embedding: number[], ttlSeconds?: number): Promise<void>;
  generateKey(text: string): string;
}

// ============================================================================
// Constants
// ============================================================================

const EMBEDDING_DIMENSIONS = 768;

const DEFAULT_CONFIG: EmbeddingConfig = {
  provider: 'google',
  model: 'text-embedding-004',
  dimensions: EMBEDDING_DIMENSIONS,
  batchSize: 100,
  maxConcurrentBatches: 3,
  rateLimitDelayMs: 500,
  maxRetries: 3,
  retryBaseDelayMs: 1000,
  dailyQuotaLimit: 10000,
};

// Text limits for embedding
const MAX_TEXT_LENGTH = 8000; // Characters, well under token limit
const MIN_TEXT_LENGTH = 1;

// ============================================================================
// Quota Tracking (Redis-backed with in-memory fallback)
// ============================================================================

import { createClient } from 'redis';

let quotaRedisClient: ReturnType<typeof createClient> | null = null;
let quotaRedisConnected = false;

// In-memory fallback for when Redis is unavailable
const quotaFallback = new Map<string, QuotaUsage>();

async function getQuotaRedisClient(): Promise<ReturnType<typeof createClient> | null> {
  if (quotaRedisConnected && quotaRedisClient) return quotaRedisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  try {
    if (!quotaRedisClient) {
      quotaRedisClient = createClient({ url: redisUrl });
      quotaRedisClient.on('error', (err) => {
        logger.warn('Quota Redis client error', { error: err.message });
        quotaRedisConnected = false;
      });
      quotaRedisClient.on('connect', () => {
        quotaRedisConnected = true;
      });
      quotaRedisClient.on('disconnect', () => {
        quotaRedisConnected = false;
      });
      await quotaRedisClient.connect();
    }
    return quotaRedisClient;
  } catch {
    logger.warn('Failed to connect to Redis for quota tracking, using in-memory fallback');
    return null;
  }
}

function getQuotaRedisKey(organizationId: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `embedding:quota:${organizationId}:${today}`;
}

async function checkAndUpdateQuota(
  organizationId: string,
  count: number,
  dailyLimit: number
): Promise<boolean> {
  const redis = await getQuotaRedisClient();

  if (redis) {
    try {
      const redisKey = getQuotaRedisKey(organizationId);
      const currentStr = await redis.get(redisKey);
      const current = currentStr ? parseInt(currentStr, 10) : 0;

      if (current + count > dailyLimit) {
        logger.warn('Daily quota exceeded', {
          organizationId,
          currentUsage: current,
          requested: count,
          limit: dailyLimit,
        });
        return false;
      }

      const newTotal = await redis.incrBy(redisKey, count);
      // Set TTL to 25 hours to cover the full day + buffer
      await redis.expire(redisKey, 90000);

      // Double-check after increment (race condition guard)
      if (newTotal > dailyLimit) {
        await redis.decrBy(redisKey, count);
        logger.warn('Daily quota exceeded after increment (race)', {
          organizationId,
          newTotal,
          limit: dailyLimit,
        });
        return false;
      }

      return true;
    } catch (err) {
      logger.warn('Redis quota check failed, falling back to in-memory', { error: err });
    }
  }

  // In-memory fallback
  const today = new Date().toISOString().split('T')[0];
  const key = `${organizationId}:${today}`;
  let usage = quotaFallback.get(key);

  if (!usage || usage.date !== today) {
    usage = {
      organizationId,
      date: today,
      embeddingCount: 0,
      tokenCount: 0,
      lastUpdated: new Date(),
    };
  }

  if (usage.embeddingCount + count > dailyLimit) {
    logger.warn('Daily quota exceeded (in-memory fallback)', {
      organizationId,
      currentUsage: usage.embeddingCount,
      requested: count,
      limit: dailyLimit,
    });
    return false;
  }

  usage.embeddingCount += count;
  usage.lastUpdated = new Date();
  quotaFallback.set(key, usage);
  return true;
}

async function getQuotaUsage(organizationId: string): Promise<QuotaUsage | null> {
  const redis = await getQuotaRedisClient();
  const today = new Date().toISOString().split('T')[0];

  if (redis) {
    try {
      const redisKey = getQuotaRedisKey(organizationId);
      const countStr = await redis.get(redisKey);
      if (!countStr) return null;

      return {
        organizationId,
        date: today,
        embeddingCount: parseInt(countStr, 10),
        tokenCount: 0,
        lastUpdated: new Date(),
      };
    } catch (err) {
      logger.warn('Redis quota read failed, falling back to in-memory', { error: err });
    }
  }

  // In-memory fallback
  const key = `${organizationId}:${today}`;
  return quotaFallback.get(key) || null;
}

// ============================================================================
// API Key Management
// ============================================================================

interface ApiKeyManager {
  getPrimaryKey(): string | null;
  getSecondaryKey(): string | null;
  getNextKey(): string;
  markKeyFailed(key: string): void;
  resetKeyStatus(): void;
}

function createApiKeyManager(): ApiKeyManager {
  const failedKeys = new Set<string>();
  let lastUsedIndex = 0;

  const keys = [
    process.env.GOOGLE_GENERATIVE_AI_KEY,
    process.env.GOOGLE_API_KEY_PRIMARY,
    process.env.GOOGLE_API_KEY_SECONDARY,
  ].filter((k): k is string => !!k && k.length > 0);

  return {
    getPrimaryKey(): string | null {
      return keys[0] || null;
    },

    getSecondaryKey(): string | null {
      return keys[1] || null;
    },

    getNextKey(): string {
      if (keys.length === 0) {
        throw new Error(
          'No Google API keys configured. Set GOOGLE_GENERATIVE_AI_KEY or GOOGLE_API_KEY_PRIMARY environment variable.'
        );
      }

      // Find next available key that hasn't failed
      for (let i = 0; i < keys.length; i++) {
        const index = (lastUsedIndex + i) % keys.length;
        const key = keys[index];
        if (!failedKeys.has(key)) {
          lastUsedIndex = (index + 1) % keys.length;
          return key;
        }
      }

      // If all keys failed, reset and try again
      failedKeys.clear();
      lastUsedIndex = 0;
      return keys[0];
    },

    markKeyFailed(key: string): void {
      failedKeys.add(key);
      logger.warn('API key marked as failed', {
        keyPrefix: key.substring(0, 10) + '...',
        failedKeysCount: failedKeys.size,
        totalKeys: keys.length,
      });
    },

    resetKeyStatus(): void {
      failedKeys.clear();
      lastUsedIndex = 0;
    },
  };
}

// ============================================================================
// Embedding Service Class
// ============================================================================

export class EmbeddingService {
  private config: EmbeddingConfig;
  private keyManager: ApiKeyManager;
  private cache: EmbeddingCacheInterface | null = null;
  private lastRequestTime = 0;

  constructor(config: Partial<EmbeddingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.keyManager = createApiKeyManager();
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /**
   * Set the embedding cache implementation
   * Allows integration with Redis or other caching solutions
   */
  setCache(cache: EmbeddingCacheInterface): void {
    this.cache = cache;
    logger.info('Embedding cache configured');
  }

  /**
   * Get current configuration
   */
  getConfig(): EmbeddingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<EmbeddingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ==========================================================================
  // Single Embedding Generation
  // ==========================================================================

  /**
   * Generate embedding for a single text
   *
   * @param text - Text to embed (1-8000 characters)
   * @param organizationId - Organization ID for quota tracking (optional)
   * @returns Embedding result with 768-dimensional vector
   */
  async generateEmbedding(text: string, organizationId?: string): Promise<EmbeddingResult> {
    // Validate input
    this.validateText(text);

    // Check quota if organization provided
    if (organizationId) {
      if (!(await checkAndUpdateQuota(organizationId, 1, this.config.dailyQuotaLimit))) {
        throw new Error(`Daily embedding quota exceeded for organization ${organizationId}`);
      }
    }

    // Check cache first
    if (this.cache) {
      const cacheKey = this.cache.generateKey(text);
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        logger.debug('Embedding cache hit', { textLength: text.length });
        return {
          embedding: cached,
          model: this.config.model,
          cached: true,
        };
      }
    }

    // Apply rate limiting
    await this.applyRateLimit();

    // Generate embedding with retry
    const embedding = await this.generateWithRetry(text);

    // Validate output
    this.validateEmbedding(embedding);

    // Cache result
    if (this.cache) {
      const cacheKey = this.cache.generateKey(text);
      await this.cache.set(cacheKey, embedding);
    }

    return {
      embedding,
      model: this.config.model,
      cached: false,
    };
  }

  // ==========================================================================
  // Batch Embedding Generation
  // ==========================================================================

  /**
   * Generate embeddings for multiple texts in batches
   * Processes up to 3 batches concurrently for better throughput
   *
   * @param texts - Array of texts to embed
   * @param organizationId - Organization ID for quota tracking (optional)
   * @returns Batch embedding result
   */
  async generateBatch(texts: string[], organizationId?: string): Promise<BatchEmbeddingResult> {
    if (texts.length === 0) {
      return {
        embeddings: [],
        model: this.config.model,
        successCount: 0,
        failureCount: 0,
        fromCache: 0,
      };
    }

    // Check quota if organization provided
    if (organizationId) {
      if (!(await checkAndUpdateQuota(organizationId, texts.length, this.config.dailyQuotaLimit))) {
        throw new Error(`Daily embedding quota exceeded for organization ${organizationId}`);
      }
    }

    // Validate all texts
    texts.forEach((text, index) => {
      try {
        this.validateText(text);
      } catch (error) {
        throw new Error(`Invalid text at index ${index}: ${(error as Error).message}`);
      }
    });

    const results: (number[] | null)[] = new Array(texts.length).fill(null);
    const textsToProcess: Array<{ text: string; index: number }> = [];
    let fromCache = 0;

    // Check cache for all texts first
    if (this.cache) {
      await Promise.all(
        texts.map(async (text, index) => {
          const cacheKey = this.cache!.generateKey(text);
          const cached = await this.cache!.get(cacheKey);
          if (cached) {
            results[index] = cached;
            fromCache++;
          } else {
            textsToProcess.push({ text, index });
          }
        })
      );
    } else {
      texts.forEach((text, index) => {
        textsToProcess.push({ text, index });
      });
    }

    logger.info('Starting batch embedding generation', {
      totalTexts: texts.length,
      fromCache,
      toProcess: textsToProcess.length,
    });

    // Process remaining texts in batches with concurrency
    const batches = this.createBatches(textsToProcess, this.config.batchSize);
    let successCount = fromCache;
    let failureCount = 0;

    // Process batches with controlled concurrency
    for (let i = 0; i < batches.length; i += this.config.maxConcurrentBatches) {
      const concurrentBatches = batches.slice(i, i + this.config.maxConcurrentBatches);

      const batchResults = await Promise.allSettled(
        concurrentBatches.map(async (batch) => {
          await this.applyRateLimit();

          const batchTexts = batch.map((item) => item.text);
          const embeddings = await this.generateBatchWithRetry(batchTexts);

          return { batch, embeddings };
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          const { batch, embeddings } = result.value;

          for (let j = 0; j < batch.length; j++) {
            const { text, index } = batch[j];
            const embedding = embeddings[j];

            if (embedding && embedding.length === EMBEDDING_DIMENSIONS) {
              results[index] = embedding;
              successCount++;

              // Cache successful embeddings
              if (this.cache) {
                const cacheKey = this.cache.generateKey(text);
                await this.cache.set(cacheKey, embedding);
              }
            } else {
              failureCount++;
              logger.warn('Invalid embedding in batch', { index, textLength: text.length });
            }
          }
        } else {
          const failedBatch = concurrentBatches[batchResults.indexOf(result)];
          failureCount += failedBatch.length;
          logger.error('Batch embedding failed', {
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
            batchSize: failedBatch.length,
          });
        }
      }
    }

    // Filter out nulls and return
    const embeddings = results.filter((e): e is number[] => e !== null);

    logger.info('Batch embedding generation completed', {
      totalTexts: texts.length,
      successCount,
      failureCount,
      fromCache,
    });

    return {
      embeddings,
      model: this.config.model,
      successCount,
      failureCount,
      fromCache,
    };
  }

  // ==========================================================================
  // Similarity Functions
  // ==========================================================================

  /**
   * Calculate cosine similarity between two embeddings
   *
   * @param a - First embedding vector
   * @param b - Second embedding vector
   * @returns Similarity score (0-1)
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Find top K most similar embeddings from candidates
   *
   * @param query - Query embedding vector
   * @param candidates - Array of candidate embedding vectors
   * @param k - Number of top results to return
   * @returns Array of similarity results sorted by score (descending)
   */
  findTopK(query: number[], candidates: number[][], k: number): SimilarityResult[] {
    this.validateEmbedding(query);

    const results: SimilarityResult[] = candidates.map((embedding, index) => ({
      index,
      score: this.cosineSimilarity(query, embedding),
      embedding,
    }));

    // Sort by score descending and take top K
    return results.sort((a, b) => b.score - a.score).slice(0, k);
  }

  // ==========================================================================
  // Quota Management
  // ==========================================================================

  /**
   * Get quota usage for an organization
   */
  async getQuotaUsage(organizationId: string): Promise<QuotaUsage | null> {
    return getQuotaUsage(organizationId);
  }

  /**
   * Get remaining quota for an organization
   */
  async getRemainingQuota(organizationId: string): Promise<number> {
    const usage = await getQuotaUsage(organizationId);
    if (!usage) {
      return this.config.dailyQuotaLimit;
    }
    return Math.max(0, this.config.dailyQuotaLimit - usage.embeddingCount);
  }

  // ==========================================================================
  // Validation Methods
  // ==========================================================================

  /**
   * Validate text input for embedding generation
   */
  validateText(text: string): void {
    if (typeof text !== 'string') {
      throw new Error('Text must be a string');
    }

    if (text.length < MIN_TEXT_LENGTH) {
      throw new Error(`Text too short: minimum ${MIN_TEXT_LENGTH} character(s) required`);
    }

    if (text.length > MAX_TEXT_LENGTH) {
      throw new Error(`Text too long: maximum ${MAX_TEXT_LENGTH} characters allowed`);
    }

    // Check for null bytes or control characters that could cause issues
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) {
      throw new Error('Text contains invalid control characters');
    }
  }

  /**
   * Validate embedding array
   */
  validateEmbedding(embedding: number[]): void {
    if (!Array.isArray(embedding)) {
      throw new Error('Embedding must be an array');
    }

    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Invalid embedding dimensions: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`
      );
    }

    if (embedding.some((n) => !Number.isFinite(n))) {
      throw new Error('Embedding contains invalid numeric values (NaN or Infinity)');
    }

    // Check for reasonable value ranges
    const maxAbs = Math.max(...embedding.map(Math.abs));
    if (maxAbs > 100) {
      logger.warn('Embedding values may not be properly normalized', { maxAbsValue: maxAbs });
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Generate embedding with retry logic and API key rotation
   */
  private async generateWithRetry(text: string): Promise<number[]> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      const apiKey = this.keyManager.getNextKey();

      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: this.config.model });

        const result = await model.embedContent(text);

        return result.embedding.values;
      } catch (error) {
        lastError = error as Error;
        this.keyManager.markKeyFailed(apiKey);

        logger.warn('Embedding generation attempt failed', {
          attempt,
          maxRetries: this.config.maxRetries,
          error: lastError.message,
        });

        // Exponential backoff before retry
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryBaseDelayMs * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `Failed to generate embedding after ${this.config.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Generate batch embeddings with retry logic
   */
  private async generateBatchWithRetry(texts: string[]): Promise<number[][]> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      const apiKey = this.keyManager.getNextKey();

      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: this.config.model });

        // Use Google's true batch embedding API instead of sequential calls
        const requests = texts.map((text) => ({
          content: { role: 'user' as const, parts: [{ text }] },
        }));
        const result = await model.batchEmbedContents({ requests });
        return result.embeddings.map((e) => e.values);
      } catch (error) {
        lastError = error as Error;
        this.keyManager.markKeyFailed(apiKey);

        logger.warn('Batch embedding generation attempt failed', {
          attempt,
          maxRetries: this.config.maxRetries,
          batchSize: texts.length,
          error: lastError.message,
        });

        // Exponential backoff before retry
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryBaseDelayMs * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `Failed to generate batch embeddings after ${this.config.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Apply rate limiting between API calls
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.config.rateLimitDelayMs) {
      await this.sleep(this.config.rateLimitDelayMs - elapsed);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton Instance & Factory
// ============================================================================

let embeddingServiceInstance: EmbeddingService | null = null;

/**
 * Get the singleton embedding service instance
 */
export function getEmbeddingService(): EmbeddingService {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService();
  }
  return embeddingServiceInstance;
}

/**
 * Create a new embedding service instance with custom configuration
 */
export function createEmbeddingService(config?: Partial<EmbeddingConfig>): EmbeddingService {
  return new EmbeddingService(config);
}

/**
 * Generate a cache key for text (utility function)
 */
export function generateEmbeddingCacheKey(
  text: string,
  model: string = 'text-embedding-004'
): string {
  const normalized = text.trim().toLowerCase();
  const hash = crypto.createHash('sha256').update(`${model}:${normalized}`).digest('hex');
  return `emb:${hash}`;
}

export default EmbeddingService;
