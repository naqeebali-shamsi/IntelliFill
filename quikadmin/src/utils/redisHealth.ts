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

/**
 * Continuous health monitoring
 */
let redisHealthy = true;
let healthCheckInterval: NodeJS.Timeout | null = null;
let monitorClient: ReturnType<typeof createClient> | null = null;

/**
 * Check if Redis is available using a persistent client
 */
export async function checkRedisHealth(): Promise<boolean> {
  if (!monitorClient) {
    const redisUrl = getRedisUrl();
    monitorClient = createClient({ url: redisUrl });
    monitorClient.on('error', (err) => {
      logger.error('Redis monitor client error:', err);
      redisHealthy = false;
    });
    try {
      await monitorClient.connect();
    } catch (error) {
      logger.error('Failed to connect Redis monitor client:', error);
      return false;
    }
  }

  try {
    await monitorClient.ping();
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
    return false;
  }
}

/**
 * Start continuous Redis health monitoring
 * Checks health periodically and logs status changes only
 */
export function startRedisHealthMonitoring(intervalMs: number = 120000): void {
  if (healthCheckInterval) {
    logger.warn('Redis health monitoring already running');
    return;
  }

  logger.info('Starting Redis health monitoring (Optimized)', {
    intervalMs,
    intervalSeconds: intervalMs / 1000,
  });

  healthCheckInterval = setInterval(async () => {
    const wasHealthy = redisHealthy;
    const isHealthy = await checkRedisHealth();
    redisHealthy = isHealthy;

    // Only log when status changes to avoid spam
    if (wasHealthy && !redisHealthy) {
      logger.error('Redis connection lost - queues may be unavailable', {
        lastError: healthState.lastError,
      });
    } else if (!wasHealthy && redisHealthy) {
      logger.info('Redis connection restored', {
        downtime: Date.now() - healthState.lastCheck,
      });
    }
  }, intervalMs);

  // Prevent the interval from keeping the process alive
  if (healthCheckInterval.unref) {
    healthCheckInterval.unref();
  }
}

/**
 * Stop continuous Redis health monitoring
 */
export function stopRedisHealthMonitoring(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    logger.info('Redis health monitoring stopped');
  }
}

/**
 * Check if Redis is currently healthy (based on last check)
 */
export function isRedisHealthy(): boolean {
  return redisHealthy;
}

export default {
  checkRedisHealth,
  getRedisHealthState,
  verifyRedisAtStartup,
  startRedisHealthMonitoring,
  stopRedisHealthMonitoring,
  isRedisHealthy,
};
