/**
 * Shared Redis Configuration Utility
 *
 * Centralized Redis connection configuration for all Bull/BullMQ queues.
 * Eliminates duplication across ocrQueue.ts, documentQueue.ts, multiagentQueue.ts.
 *
 * Supports:
 * - REDIS_URL environment variable (including rediss:// for TLS)
 * - Fallback to REDIS_HOST/REDIS_PORT/REDIS_PASSWORD
 * - Upstash-optimized settings to stay within free tier limits
 *
 * @module utils/redisConfig
 */

import { piiSafeLogger as logger } from './piiSafeLogger';

/**
 * Redis connection configuration for ioredis/Bull
 */
export interface RedisConnectionConfig {
  host: string;
  port: number;
  password?: string;
  tls?: Record<string, unknown>;
}

/**
 * Type for Redis configuration - either a URL string or connection object
 */
export type RedisConfig = string | RedisConnectionConfig;

/**
 * Get Redis configuration from environment variables.
 *
 * Supports:
 * - REDIS_URL: Full Redis URL (redis:// or rediss:// for TLS)
 * - REDIS_HOST, REDIS_PORT, REDIS_PASSWORD: Individual connection params
 *
 * @returns Redis configuration suitable for Bull queue constructor
 */
export function getRedisConfig(): RedisConfig {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    // For TLS connections (rediss://), ioredis needs explicit tls option
    if (redisUrl.startsWith('rediss://')) {
      try {
        const url = new URL(redisUrl);
        return {
          host: url.hostname,
          port: parseInt(url.port) || 6379,
          password: url.password || undefined,
          tls: {},
        };
      } catch (error) {
        logger.warn('Failed to parse REDIS_URL, using as connection string', { error });
        return redisUrl;
      }
    }
    // For non-TLS, return URL string directly
    return redisUrl;
  }

  // Fallback to individual environment variables
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  };
}

/**
 * Get Redis configuration as object (for BullMQ which requires object format)
 *
 * @returns Redis connection config object (never a string)
 */
export function getRedisConnectionConfig(): RedisConnectionConfig {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      const url = new URL(redisUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
        tls: redisUrl.startsWith('rediss://') ? {} : undefined,
      };
    } catch (error) {
      logger.warn('Failed to parse REDIS_URL, using defaults', { error });
    }
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  };
}

/**
 * Default Bull queue settings optimized for Upstash free tier.
 *
 * These settings reduce Redis polling frequency to stay within
 * the 500K requests/month limit of Upstash's free tier.
 *
 * Settings explained:
 * - stalledInterval: How often to check for stalled jobs (5 min vs default 30s)
 * - lockDuration: How long a job is locked during processing (5 min)
 * - lockRenewTime: How often to renew the lock (half of lockDuration)
 * - guardInterval: Interval for checking delayed jobs (5 min)
 * - retryProcessDelay: Delay before retrying failed processor (1 min)
 * - drainDelay: Delay when queue is empty (1 min)
 */
export const defaultBullSettings = {
  stalledInterval: 300000, // 5 minutes (default: 30s)
  maxStalledCount: 2, // Mark job failed after 2 stalls
  lockDuration: 300000, // 5 minutes (default: 30s)
  lockRenewTime: 150000, // 2.5 minutes (half of lockDuration)
  guardInterval: 300000, // 5 minutes (default: 5s)
  retryProcessDelay: 60000, // 1 minute (default: 5s)
  drainDelay: 60000, // 1 minute (default: 5s)
} as const;

/**
 * Default job options for standard document processing queues
 */
export const defaultJobOptions = {
  removeOnComplete: 100, // Keep last 100 completed jobs
  removeOnFail: 50, // Keep last 50 failed jobs
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 3000, // Start with 3s delay
  },
} as const;

/**
 * Default job options for OCR processing (longer timeout)
 */
export const ocrJobOptions = {
  ...defaultJobOptions,
  timeout: 600000, // 10 minute timeout for OCR jobs
} as const;

/**
 * Default job options for batch processing
 */
export const batchJobOptions = {
  removeOnComplete: 50,
  removeOnFail: 25,
  attempts: 2,
} as const;

export default {
  getRedisConfig,
  getRedisConnectionConfig,
  defaultBullSettings,
  defaultJobOptions,
  ocrJobOptions,
  batchJobOptions,
};
