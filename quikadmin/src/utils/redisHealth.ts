/**
 * Redis Health Checker
 *
 * Provides utilities to check Redis availability at startup and runtime.
 * Redis is REQUIRED for queue operations - application will fail without it.
 */

import { createClient } from 'redis';
import { logger } from './logger';

interface RedisHealthState {
  connected: boolean;
  lastCheck: number;
  lastError: string | null;
}

let healthState: RedisHealthState = {
  connected: false,
  lastCheck: 0,
  lastError: null,
};

/**
 * Get Redis URL from environment
 */
function getRedisUrl(): string {
  return (
    process.env.REDIS_URL ||
    `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`
  );
}

/**
 * Check if Redis is available
 */
export async function checkRedisHealth(): Promise<boolean> {
  const redisUrl = getRedisUrl();
  const client = createClient({ url: redisUrl });

  try {
    await Promise.race([
      client.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis connection timeout (5s)')), 5000)
      ),
    ]);

    await client.ping();
    await client.quit();

    healthState = {
      connected: true,
      lastCheck: Date.now(),
      lastError: null,
    };

    return true;
  } catch (error) {
    healthState = {
      connected: false,
      lastCheck: Date.now(),
      lastError: error instanceof Error ? error.message : 'Unknown error',
    };

    try {
      await client.quit();
    } catch {
      // Ignore cleanup errors
    }

    return false;
  }
}

/**
 * Get current health state
 */
export function getRedisHealthState(): RedisHealthState {
  return { ...healthState };
}

/**
 * Verify Redis is available at startup
 * Logs error but does not throw - let individual services handle failures
 */
export async function verifyRedisAtStartup(): Promise<boolean> {
  const redisUrl = getRedisUrl();
  const maskedUrl = redisUrl.replace(/:[^:@]+@/, ':****@');

  logger.info('Checking Redis connectivity...', { url: maskedUrl });

  const available = await checkRedisHealth();

  if (available) {
    logger.info('✅ Redis connected successfully');
  } else {
    logger.error('❌ Redis connection failed', {
      error: healthState.lastError,
      url: maskedUrl,
      action: 'Queue operations will fail. Please configure REDIS_URL environment variable.',
    });
  }

  return available;
}

export default {
  checkRedisHealth,
  getRedisHealthState,
  verifyRedisAtStartup,
};
