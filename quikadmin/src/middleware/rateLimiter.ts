import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';
import { Request } from 'express';
import { logger } from '../utils/logger';

// ============================================================================
// Environment Helpers
// ============================================================================

function isDev(): boolean {
  return process.env.NODE_ENV === 'development';
}

function isDevOrTest(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
}

// ============================================================================
// Rate Limit Key Generation (Task #171)
// ============================================================================

export type RateLimitScope = 'ip' | 'user' | 'organization' | 'user-ip' | 'org-ip' | 'email-ip';

export interface RateLimitKeyOptions {
  scope: RateLimitScope;
  fallbackScope?: RateLimitScope;
  prefix?: string;
}

function sanitizeKeyComponent(value: string | undefined | null, maxLength = 64): string {
  if (!value) return 'unknown';
  const sanitized = value
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]/g, '')
    .slice(0, maxLength);
  return sanitized || 'unknown';
}

function extractIP(req: Request): string {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return sanitizeKeyComponent(ip, 45);
}

function extractUserId(req: Request): string | null {
  const userId = (req as any).user?.id;
  return userId ? sanitizeKeyComponent(userId) : null;
}

function extractOrganizationId(req: Request): string | null {
  const orgId = (req as any).organizationId || (req as any).user?.organizationId;
  return orgId ? sanitizeKeyComponent(orgId) : null;
}

function extractEmail(req: Request): string | null {
  const email = req.body?.email;
  return email ? sanitizeKeyComponent(email, 100) : null;
}

function generateKeyForScope(req: Request, scope: RateLimitScope): string | null {
  const ip = extractIP(req);

  switch (scope) {
    case 'ip':
      return ip;
    case 'user':
      return extractUserId(req);
    case 'organization':
      return extractOrganizationId(req);
    case 'user-ip': {
      const userId = extractUserId(req);
      return userId ? `${userId}:${ip}` : null;
    }
    case 'org-ip': {
      const orgId = extractOrganizationId(req);
      return orgId ? `${orgId}:${ip}` : null;
    }
    case 'email-ip': {
      const email = extractEmail(req);
      return email ? `${email}:${ip}` : null;
    }
    default:
      return null;
  }
}

export function generateRateLimitKey(req: Request, options: RateLimitKeyOptions): string {
  const { scope, fallbackScope = 'ip', prefix } = options;

  let key = generateKeyForScope(req, scope);
  if (!key && fallbackScope) {
    key = generateKeyForScope(req, fallbackScope);
  }
  if (!key) {
    key = extractIP(req);
  }

  return prefix ? `${prefix}:${key}` : key;
}

export function createKeyGenerator(options: RateLimitKeyOptions): (req: Request) => string {
  return (req: Request) => generateRateLimitKey(req, options);
}

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

// ============================================================================
// Limiter Factory
// ============================================================================

interface LimiterConfig {
  windowMs: number;
  max: number;
  devMultiplier?: number;
  prefix: string;
  keyOptions: RateLimitKeyOptions;
  message: string | object;
  skipSuccessfulRequests?: boolean;
  useDevOrTest?: boolean;
}

function createPrefixedStore(prefix: string) {
  const storePrefix = prefix ? `${prefix}:` : '';
  return {
    increment: async (key: string) => store.increment(storePrefix + key),
    decrement: async (key: string) => store.decrement(storePrefix + key),
    resetKey: async (key: string) => store.resetKey(storePrefix + key),
  } as any;
}

function createLimiter(config: LimiterConfig): ReturnType<typeof rateLimit> {
  const {
    windowMs,
    max,
    devMultiplier = 10,
    prefix,
    keyOptions,
    message,
    skipSuccessfulRequests,
    useDevOrTest = false,
  } = config;

  const isRelaxed = useDevOrTest ? isDevOrTest() : isDev();
  const effectiveMax = isRelaxed ? max * devMultiplier : max;

  return rateLimit({
    windowMs,
    max: effectiveMax,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    store: createPrefixedStore(prefix),
    keyGenerator: createKeyGenerator(keyOptions),
  });
}

// ============================================================================
// Standard Limiters
// ============================================================================

// 500 requests per 15 minutes (10000 in dev/test)
export const standardLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  devMultiplier: 20,
  prefix: '',
  keyOptions: { scope: 'ip' },
  message: 'Too many requests from this IP, please try again later',
  useDevOrTest: true,
});

// 20 failed auth attempts per 15 minutes (1000 in dev/test)
export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  devMultiplier: 50,
  prefix: 'auth',
  keyOptions: { scope: 'email-ip', fallbackScope: 'ip' },
  message: 'Too many authentication attempts, please try again later',
  skipSuccessfulRequests: true,
  useDevOrTest: true,
});

// 50 uploads per hour (500 in dev)
export const uploadLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 50,
  devMultiplier: 10,
  prefix: 'upload',
  keyOptions: { scope: 'user', fallbackScope: 'ip' },
  message: 'Upload limit reached, please try again later',
});

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  if (redisClient && redisConnected) {
    await redisClient.quit();
  }
});

// ============================================================================
// Knowledge Base Rate Limiters (Task #134)
// ============================================================================

const ORG_KEY_OPTIONS: RateLimitKeyOptions = { scope: 'organization', fallbackScope: 'user-ip' };

// 60 searches per minute (200 in dev)
export const knowledgeSearchLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  devMultiplier: 3.33,
  prefix: 'knowledge:search',
  keyOptions: ORG_KEY_OPTIONS,
  message: {
    error: 'Search rate limit exceeded',
    message: 'Too many search requests. Please wait before trying again.',
    retryAfter: 60,
  },
});

// 120 suggestions per minute (300 in dev)
export const knowledgeSuggestLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 120,
  devMultiplier: 2.5,
  prefix: 'knowledge:suggest',
  keyOptions: ORG_KEY_OPTIONS,
  message: {
    error: 'Suggestion rate limit exceeded',
    message: 'Too many suggestion requests. Please wait before trying again.',
    retryAfter: 60,
  },
});

// 30 knowledge uploads per minute (100 in dev)
export const knowledgeUploadLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  devMultiplier: 3.33,
  prefix: 'knowledge:upload',
  keyOptions: ORG_KEY_OPTIONS,
  message: {
    error: 'Upload rate limit exceeded',
    message: 'Too many document uploads. Please wait before uploading more.',
    retryAfter: 60,
  },
});

// ============================================================================
// SSE and CSP Rate Limiters
// ============================================================================

// 10 SSE connection attempts per minute (100 in dev)
export const sseConnectionLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 10,
  devMultiplier: 10,
  prefix: 'sse',
  keyOptions: { scope: 'user', fallbackScope: 'ip' },
  message: {
    error: 'Too many connection attempts',
    message: 'Rate limit exceeded for realtime connections. Please wait before reconnecting.',
    retryAfter: 60,
  },
});

// 100 CSP reports per minute (500 in dev)
export const cspReportLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 100,
  devMultiplier: 5,
  prefix: 'csp',
  keyOptions: { scope: 'ip' },
  message: { error: 'Too many CSP reports', message: 'CSP report rate limit exceeded.' },
});

// ============================================================================
// Sensitive Endpoint Rate Limiters (Task #284)
// ============================================================================

// 5 password reset requests per hour (100 in dev)
export const passwordResetLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  devMultiplier: 20,
  prefix: 'pwd-reset',
  keyOptions: { scope: 'email-ip', fallbackScope: 'ip' },
  message: {
    error: 'Too many password reset requests',
    message: 'Please wait before requesting another password reset.',
    retryAfter: 3600,
  },
});

// 50 downloads per hour (500 in dev)
export const downloadLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 50,
  devMultiplier: 10,
  prefix: 'download',
  keyOptions: { scope: 'user', fallbackScope: 'ip' },
  message: {
    error: 'Download limit exceeded',
    message: 'Too many file downloads. Please wait before downloading more.',
    retryAfter: 3600,
  },
});

// ============================================================================
// Adaptive Rate Limiting (Task #284)
// ============================================================================

const suspiciousIpLimits = new Map<string, { reducedUntil: Date; factor: number }>();

export function isSuspiciousIp(ip: string): { suspicious: boolean; factor: number } {
  const entry = suspiciousIpLimits.get(ip);
  if (!entry) {
    return { suspicious: false, factor: 1 };
  }
  if (entry.reducedUntil < new Date()) {
    suspiciousIpLimits.delete(ip);
    return { suspicious: false, factor: 1 };
  }
  return { suspicious: true, factor: entry.factor };
}

export function markIpAsSuspicious(ip: string, durationMinutes = 60, reductionFactor = 0.25): void {
  suspiciousIpLimits.set(ip, {
    reducedUntil: new Date(Date.now() + durationMinutes * 60 * 1000),
    factor: Math.max(0.1, Math.min(1, reductionFactor)),
  });
  logger.warn('[RateLimit] IP marked as suspicious with reduced limits', {
    ip: ip.substring(0, 10) + '...',
    durationMinutes,
    reductionFactor,
  });
}

export function clearSuspiciousIp(ip: string): void {
  suspiciousIpLimits.delete(ip);
}

export function createAdaptiveLimiter(
  baseMax: number,
  windowMs: number,
  prefix: string,
  options: Partial<Parameters<typeof rateLimit>[0]> = {}
): ReturnType<typeof rateLimit> {
  return rateLimit({
    windowMs,
    max: (req: Request) => {
      const ip = req.ip || 'unknown';
      const { suspicious, factor } = isSuspiciousIp(ip);
      if (suspicious) {
        const reducedMax = Math.max(1, Math.floor(baseMax * factor));
        logger.debug('[RateLimit] Applying reduced limit for suspicious IP', {
          prefix,
          baseMax,
          reducedMax,
        });
        return reducedMax;
      }
      return isDev() ? baseMax * 10 : baseMax;
    },
    message: {
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: createPrefixedStore(prefix),
    ...options,
  });
}

// Adaptive auth limiter - reduces to 5 attempts for suspicious IPs
export const adaptiveAuthLimiter = createAdaptiveLimiter(20, 15 * 60 * 1000, 'adaptive-auth', {
  keyGenerator: createKeyGenerator({ scope: 'email-ip', fallbackScope: 'ip' }),
  skipSuccessfulRequests: true,
});
