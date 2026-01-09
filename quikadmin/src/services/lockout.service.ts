/**
 * Server-side Login Lockout Service
 *
 * Tracks failed login attempts in Redis and enforces account lockout
 * after MAX_ATTEMPTS failed attempts for LOCKOUT_DURATION.
 *
 * Security features:
 * - Server-side enforcement (not bypassable by client)
 * - Rate limiting per email address
 * - Automatic lockout expiry
 * - Fail-open when Redis is unavailable (logs warning)
 *
 * @module services/lockout.service
 */

import Redis from 'ioredis';
import { getRedisConnectionConfig } from '../utils/redisConfig';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';

export interface LockoutStatus {
  isLocked: boolean;
  attemptsRemaining: number;
  failedAttempts: number;
  lockoutExpiresAt: Date | null;
}

interface LockoutData {
  attempts: number;
  lockedUntil: number | null;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 15 * 60;
const ATTEMPT_WINDOW_SECONDS = 15 * 60;
const KEY_PREFIX = 'lockout:';

function failOpenStatus(failedAttempts = 0): LockoutStatus {
  return {
    isLocked: false,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - failedAttempts),
    failedAttempts,
    lockoutExpiresAt: null,
  };
}

function buildStatus(attempts: number, lockedUntil: number | null): LockoutStatus {
  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;
  return {
    isLocked,
    attemptsRemaining: isLocked ? 0 : Math.max(0, MAX_ATTEMPTS - attempts),
    failedAttempts: attempts,
    lockoutExpiresAt: isLocked ? new Date(lockedUntil) : null,
  };
}

function maskEmail(email: string): string {
  return email.substring(0, 3) + '***';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

class LockoutService {
  private redis: Redis | null = null;
  private initPromise: Promise<void> | null = null;
  private isInitialized = false;

  private async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const config = getRedisConnectionConfig();
        this.redis = new Redis({
          ...config,
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            if (times > 3) {
              logger.warn('Lockout service: Max Redis retries exceeded, operating without Redis');
              return null;
            }
            return Math.min(times * 100, 3000);
          },
          lazyConnect: true,
        });

        await this.redis.ping();
        logger.info('Lockout service: Redis connected successfully');
        this.isInitialized = true;
      } catch (error) {
        logger.warn('Lockout service: Redis unavailable, using fail-open mode', {
          error: getErrorMessage(error),
        });
        this.redis = null;
        this.isInitialized = true;
      }
    })();

    return this.initPromise;
  }

  private getKey(email: string): string {
    return `${KEY_PREFIX}${email.toLowerCase().trim()}`;
  }

  private async withRedis<T>(
    operation: string,
    fallback: T,
    fn: (redis: Redis) => Promise<T>
  ): Promise<T> {
    await this.init();

    if (!this.redis) {
      return fallback;
    }

    try {
      return await fn(this.redis);
    } catch (error) {
      logger.error(`Lockout service: Error ${operation}`, { error: getErrorMessage(error) });
      return fallback;
    }
  }

  async checkLockout(email: string): Promise<LockoutStatus> {
    const key = this.getKey(email);

    return this.withRedis('checking lockout status', failOpenStatus(), async (redis) => {
      const data = await redis.get(key);
      if (!data) {
        return failOpenStatus();
      }

      const { attempts, lockedUntil }: LockoutData = JSON.parse(data);
      return buildStatus(attempts, lockedUntil);
    });
  }

  async recordFailedAttempt(email: string): Promise<LockoutStatus> {
    const key = this.getKey(email);

    return this.withRedis('recording failed attempt', failOpenStatus(1), async (redis) => {
      const data = await redis.get(key);
      let attempts = 1;
      let lockedUntil: number | null = null;

      if (data) {
        const parsed: LockoutData = JSON.parse(data);
        if (parsed.lockedUntil && Date.now() < parsed.lockedUntil) {
          return buildStatus(parsed.attempts, parsed.lockedUntil);
        }
        attempts = parsed.attempts + 1;
      }

      if (attempts >= MAX_ATTEMPTS) {
        lockedUntil = Date.now() + LOCKOUT_DURATION_SECONDS * 1000;
        logger.warn('Lockout service: Account locked due to failed attempts', {
          email: maskEmail(email),
          attempts,
          lockoutDurationMinutes: LOCKOUT_DURATION_SECONDS / 60,
        });
      }

      const lockoutData: LockoutData = { attempts, lockedUntil };
      await redis.setex(key, ATTEMPT_WINDOW_SECONDS, JSON.stringify(lockoutData));

      return buildStatus(attempts, lockedUntil);
    });
  }

  async clearLockout(email: string): Promise<void> {
    const key = this.getKey(email);

    await this.withRedis('clearing lockout', undefined, async (redis) => {
      await redis.del(key);
      logger.debug('Lockout service: Cleared lockout', { email: maskEmail(email) });
    });
  }

  async getRemainingLockoutSeconds(email: string): Promise<number> {
    const status = await this.checkLockout(email);
    if (!status.isLocked || !status.lockoutExpiresAt) {
      return 0;
    }
    return Math.max(0, Math.ceil((status.lockoutExpiresAt.getTime() - Date.now()) / 1000));
  }

  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isInitialized = false;
      this.initPromise = null;
    }
  }
}

export const lockoutService = new LockoutService();
export default lockoutService;
