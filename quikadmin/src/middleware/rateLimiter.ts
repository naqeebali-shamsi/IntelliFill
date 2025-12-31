import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

// Redis client for rate limit store (optional)
let redisClient: ReturnType<typeof createClient> | null = null;
let redisConnected = false;

export function getRedisHealth(): { connected: boolean; client: any } {
  return {
    connected: redisConnected,
    client: redisClient,
  };
}

(async () => {
  try {
    let redisConfig: any;

    // Check if Redis Sentinel is enabled
    if (process.env.REDIS_SENTINEL_ENABLED === 'true') {
      const sentinelHosts =
        process.env.REDIS_SENTINEL_HOSTS?.split(',').map((host) => {
          const [hostName, port] = host.trim().split(':');
          return { host: hostName, port: parseInt(port || '26379') };
        }) || [];

      redisConfig = {
        name: process.env.REDIS_SENTINEL_MASTER_NAME || 'mymaster',
        sentinels: sentinelHosts,
        password: process.env.REDIS_PASSWORD,
      };

      logger.info('Redis Sentinel mode enabled with master:', redisConfig.name);
    } else {
      // Standard Redis connection
      redisConfig = {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries: number) => {
            if (retries > 10) {
              logger.error('Redis max reconnection attempts reached');
              return new Error('Redis reconnection failed');
            }
            const delay = Math.min(retries * 100, 3000);
            logger.warn(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
            return delay;
          },
        },
      };

      if (process.env.REDIS_PASSWORD) {
        redisConfig.password = process.env.REDIS_PASSWORD;
      }
    }

    redisClient = createClient(redisConfig);

    redisClient.on('error', (err) => {
      logger.warn('Redis Client Error (rate limiting will use memory):', err.message);
      redisConnected = false;
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });

    redisClient.on('ready', () => {
      logger.info('Redis connected and ready');
      redisConnected = true;
    });

    await redisClient.connect();
  } catch (err) {
    logger.warn('Failed to connect Redis for rate limiting - using memory store instead');
    redisConnected = false;
    redisClient = null;
  }
})();

// In-memory fallback store for when Redis is unavailable
// This provides basic rate limiting (single-server only) rather than bypassing it entirely
interface MemoryEntry {
  count: number;
  resetTime: number;
}
const memoryStore = new Map<string, MemoryEntry>();

// Cleanup stale memory entries periodically (every 5 minutes)
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.resetTime < now) {
        memoryStore.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

// Redis store for rate limiting with proper memory fallback
class RedisStore {
  private client: ReturnType<typeof createClient> | null;
  private prefix: string;
  private windowMs: number;

  constructor(
    client: ReturnType<typeof createClient> | null,
    prefix = 'rl:',
    windowMs = 15 * 60 * 1000
  ) {
    this.client = client;
    this.prefix = prefix;
    this.windowMs = windowMs;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date | undefined }> {
    const fullKey = this.prefix + key;
    const now = Date.now();
    const resetTime = new Date(now + this.windowMs);

    if (!this.client || !redisConnected) {
      // Memory-based fallback that actually tracks requests
      const existing = memoryStore.get(fullKey);

      if (existing && existing.resetTime > now) {
        // Entry exists and hasn't expired
        existing.count++;
        return { totalHits: existing.count, resetTime: new Date(existing.resetTime) };
      } else {
        // Create new entry
        memoryStore.set(fullKey, { count: 1, resetTime: now + this.windowMs });
        return { totalHits: 1, resetTime };
      }
    }

    // Redis-based counting
    try {
      const multi = this.client.multi();
      multi.incr(fullKey);
      multi.expire(fullKey, Math.ceil(this.windowMs / 1000));

      const results = await multi.exec();
      const totalHits = (results?.[0] as number) || 1;

      return { totalHits, resetTime };
    } catch (error) {
      // If Redis fails mid-operation, use memory fallback
      logger.warn('Redis increment failed, using memory fallback:', error);
      const existing = memoryStore.get(fullKey);
      if (existing && existing.resetTime > now) {
        existing.count++;
        return { totalHits: existing.count, resetTime: new Date(existing.resetTime) };
      }
      memoryStore.set(fullKey, { count: 1, resetTime: now + this.windowMs });
      return { totalHits: 1, resetTime };
    }
  }

  async decrement(key: string): Promise<void> {
    const fullKey = this.prefix + key;

    if (!this.client || !redisConnected) {
      // Memory fallback
      const existing = memoryStore.get(fullKey);
      if (existing && existing.count > 0) {
        existing.count--;
      }
      return;
    }

    try {
      await this.client.decr(fullKey);
    } catch (error) {
      logger.warn('Redis decrement failed:', error);
    }
  }

  async resetKey(key: string): Promise<void> {
    const fullKey = this.prefix + key;

    if (!this.client || !redisConnected) {
      memoryStore.delete(fullKey);
      return;
    }

    try {
      await this.client.del(fullKey);
    } catch (error) {
      logger.warn('Redis resetKey failed:', error);
    }
  }
}

const store = new RedisStore(redisClient);

// Standard API rate limiter
// Production: 500 requests per 15 minutes (reasonable for SaaS)
// Based on best practices: https://blog.appsignal.com/2024/04/03/how-to-implement-rate-limiting-in-express-for-nodejs.html
export const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' ? 10000 : 500, // 500 req/15min production
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  store: {
    increment: async (key: string) => store.increment(key),
    decrement: async (key: string) => store.decrement(key),
    resetKey: async (key: string) => store.resetKey(key),
  } as any,
  keyGenerator: (req: Request) => {
    return req.ip || 'unknown';
  },
});

// Strict auth rate limiter for login attempts
// Production: 20 failed attempts per 15 minutes (generous for legitimate users)
// Only counts failed attempts due to skipSuccessfulRequests
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' ? 1000 : 20, // 20 failed attempts/15min
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  store: {
    increment: async (key: string) => store.increment('auth:' + key),
    decrement: async (key: string) => store.decrement('auth:' + key),
    resetKey: async (key: string) => store.resetKey('auth:' + key),
  } as any,
  keyGenerator: (req: Request) => {
    // Use email + IP for more granular limiting
    const email = req.body?.email || 'unknown';
    const ip = req.ip || 'unknown';
    return `${email}:${ip}`;
  },
});

// Document upload rate limiter
// Production: 50 uploads per hour (reasonable for document processing app)
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'development' ? 500 : 50, // 50 uploads/hour production
  message: 'Upload limit reached, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  store: {
    increment: async (key: string) => store.increment('upload:' + key),
    decrement: async (key: string) => store.decrement('upload:' + key),
    resetKey: async (key: string) => store.resetKey('upload:' + key),
  } as any,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise IP
    const userId = (req as any).user?.id;
    return userId || req.ip || 'unknown';
  },
});

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  if (redisClient && redisConnected) {
    await redisClient.quit();
  }
});

// ============================================================================
// Knowledge Base Rate Limiters (Task #134)
// Organization-scoped rate limiting for vector search endpoints
// ============================================================================

/**
 * Knowledge search rate limiter
 * 60 requests per minute per organization (reasonable for search-heavy usage)
 */
export const knowledgeSearchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'development' ? 200 : 60,
  message: {
    error: 'Search rate limit exceeded',
    message: 'Too many search requests. Please wait before trying again.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: {
    increment: async (key: string) => store.increment('knowledge:search:' + key),
    decrement: async (key: string) => store.decrement('knowledge:search:' + key),
    resetKey: async (key: string) => store.resetKey('knowledge:search:' + key),
  } as any,
  keyGenerator: (req: Request) => {
    // Use organization ID for rate limiting (extracted by middleware)
    const organizationId = (req as any).organizationId;
    const userId = (req as any).user?.id;
    // Fall back to user ID + IP if org not available
    return organizationId || `${userId || 'anon'}:${req.ip || 'unknown'}`;
  },
});

/**
 * Knowledge suggest rate limiter
 * 120 requests per minute per organization (higher for autocomplete/typing)
 */
export const knowledgeSuggestLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'development' ? 300 : 120,
  message: {
    error: 'Suggestion rate limit exceeded',
    message: 'Too many suggestion requests. Please wait before trying again.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: {
    increment: async (key: string) => store.increment('knowledge:suggest:' + key),
    decrement: async (key: string) => store.decrement('knowledge:suggest:' + key),
    resetKey: async (key: string) => store.resetKey('knowledge:suggest:' + key),
  } as any,
  keyGenerator: (req: Request) => {
    const organizationId = (req as any).organizationId;
    const userId = (req as any).user?.id;
    return organizationId || `${userId || 'anon'}:${req.ip || 'unknown'}`;
  },
});

/**
 * Knowledge upload rate limiter
 * 30 uploads per minute per organization
 */
export const knowledgeUploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'development' ? 100 : 30,
  message: {
    error: 'Upload rate limit exceeded',
    message: 'Too many document uploads. Please wait before uploading more.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: {
    increment: async (key: string) => store.increment('knowledge:upload:' + key),
    decrement: async (key: string) => store.decrement('knowledge:upload:' + key),
    resetKey: async (key: string) => store.resetKey('knowledge:upload:' + key),
  } as any,
  keyGenerator: (req: Request) => {
    const organizationId = (req as any).organizationId;
    const userId = (req as any).user?.id;
    return organizationId || `${userId || 'anon'}:${req.ip || 'unknown'}`;
  },
});

// ============================================================================
// SSE (Server-Sent Events) Rate Limiter
// Limits connection attempts to prevent abuse of long-lived connections
// ============================================================================

/**
 * SSE connection rate limiter
 * Production: 10 connection attempts per minute per user/IP
 * This prevents rapid reconnection attempts that could overwhelm the server
 * while still allowing legitimate reconnections after network issues
 */
export const sseConnectionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'development' ? 100 : 10, // 10 connection attempts/minute in production
  message: {
    error: 'Too many connection attempts',
    message: 'Rate limit exceeded for realtime connections. Please wait before reconnecting.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: {
    increment: async (key: string) => store.increment('sse:' + key),
    decrement: async (key: string) => store.decrement('sse:' + key),
    resetKey: async (key: string) => store.resetKey('sse:' + key),
  } as any,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise fall back to IP
    const userId = (req as any).user?.id;
    return userId || req.ip || 'unknown';
  },
});
