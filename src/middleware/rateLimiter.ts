import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

// Redis client for rate limit store
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

// Initialize Redis connection
(async () => {
  try {
    await redisClient.connect();
    logger.info('Rate limiter Redis connected');
  } catch (err) {
    logger.error('Failed to connect Redis for rate limiting:', err);
  }
})();

// Redis store for rate limiting
class RedisStore {
  private client: typeof redisClient;
  private prefix: string;

  constructor(client: typeof redisClient, prefix = 'rl:') {
    this.client = client;
    this.prefix = prefix;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date | undefined }> {
    const fullKey = this.prefix + key;
    const now = Date.now();
    const window = 15 * 60 * 1000; // 15 minutes
    const resetTime = new Date(now + window);

    const multi = this.client.multi();
    multi.incr(fullKey);
    multi.expire(fullKey, Math.ceil(window / 1000));
    
    const results = await multi.exec();
    const totalHits = results?.[0] as number || 1;

    return { totalHits, resetTime };
  }

  async decrement(key: string): Promise<void> {
    const fullKey = this.prefix + key;
    await this.client.decr(fullKey);
  }

  async resetKey(key: string): Promise<void> {
    const fullKey = this.prefix + key;
    await this.client.del(fullKey);
  }
}

const store = new RedisStore(redisClient);

// Standard API rate limiter
export const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // Higher limit for dev
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  store: {
    increment: async (key: string) => store.increment(key),
    decrement: async (key: string) => store.decrement(key),
    resetKey: async (key: string) => store.resetKey(key)
  } as any,
  keyGenerator: (req: Request) => {
    return req.ip || 'unknown';
  }
});

// Strict auth rate limiter for login attempts
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 100 : 5, // Higher limit for dev
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  store: {
    increment: async (key: string) => store.increment('auth:' + key),
    decrement: async (key: string) => store.decrement('auth:' + key),
    resetKey: async (key: string) => store.resetKey('auth:' + key)
  } as any,
  keyGenerator: (req: Request) => {
    // Use email + IP for more granular limiting
    const email = req.body?.email || 'unknown';
    const ip = req.ip || 'unknown';
    return `${email}:${ip}`;
  }
});

// Document upload rate limiter
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'development' ? 500 : 10, // Higher limit for dev
  message: 'Upload limit reached, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  store: {
    increment: async (key: string) => store.increment('upload:' + key),
    decrement: async (key: string) => store.decrement('upload:' + key),
    resetKey: async (key: string) => store.resetKey('upload:' + key)
  } as any,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise IP
    const userId = (req as any).user?.id;
    return userId || req.ip || 'unknown';
  }
});

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  await redisClient.quit();
});