/**
 * Lockout Service Unit Tests
 *
 * Tests the server-side login lockout service including:
 * - Lockout status checking
 * - Failed attempt tracking
 * - Lockout triggering after MAX_ATTEMPTS
 * - Lockout clearing on successful login
 * - Graceful degradation when Redis unavailable
 */

// Mock ioredis BEFORE importing the service
jest.mock('ioredis', () => {
  const mRedis = {
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn(),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
  };
  return jest.fn().mockImplementation(() => mRedis);
});

jest.mock('../../src/utils/redisConfig', () => ({
  getRedisConnectionConfig: jest.fn().mockReturnValue({
    host: 'localhost',
    port: 6379,
  }),
}));

jest.mock('../../src/utils/piiSafeLogger', () => ({
  piiSafeLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import Redis from 'ioredis';
import { lockoutService, LockoutStatus } from '../../src/services/lockout.service';

describe('LockoutService', () => {
  let mockRedisInstance: jest.Mocked<Redis>;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Get the mock instance
    mockRedisInstance = (Redis as jest.MockedClass<typeof Redis>).mock.results[0]?.value;
    if (!mockRedisInstance) {
      // Force initialization by calling a method
      const MockRedis = Redis as jest.MockedClass<typeof Redis>;
      mockRedisInstance = new MockRedis() as jest.Mocked<Redis>;
    }
  });

  describe('checkLockout', () => {
    it('should return unlocked status for a new user with no attempts', async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      const status = await lockoutService.checkLockout('newuser@example.com');

      expect(status.isLocked).toBe(false);
      expect(status.attemptsRemaining).toBe(5);
      expect(status.failedAttempts).toBe(0);
      expect(status.lockoutExpiresAt).toBeNull();
    });

    it('should return current attempts for user with some failed attempts', async () => {
      mockRedisInstance.get.mockResolvedValue(JSON.stringify({ attempts: 2, lockedUntil: null }));

      const status = await lockoutService.checkLockout('test@example.com');

      expect(status.isLocked).toBe(false);
      expect(status.attemptsRemaining).toBe(3);
      expect(status.failedAttempts).toBe(2);
    });

    it('should return locked status when lockout is active', async () => {
      const lockedUntil = Date.now() + 10 * 60 * 1000; // 10 minutes from now
      mockRedisInstance.get.mockResolvedValue(JSON.stringify({ attempts: 5, lockedUntil }));

      const status = await lockoutService.checkLockout('locked@example.com');

      expect(status.isLocked).toBe(true);
      expect(status.attemptsRemaining).toBe(0);
      expect(status.failedAttempts).toBe(5);
      expect(status.lockoutExpiresAt).toBeInstanceOf(Date);
      expect(status.lockoutExpiresAt!.getTime()).toBe(lockedUntil);
    });

    it('should return unlocked status when lockout has expired', async () => {
      const lockedUntil = Date.now() - 1000; // Expired 1 second ago
      mockRedisInstance.get.mockResolvedValue(JSON.stringify({ attempts: 5, lockedUntil }));

      const status = await lockoutService.checkLockout('expired@example.com');

      expect(status.isLocked).toBe(false);
      expect(status.lockoutExpiresAt).toBeNull();
      // Attempts still tracked but lockout expired
      expect(status.failedAttempts).toBe(5);
    });

    it('should normalize email addresses (lowercase and trim)', async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      await lockoutService.checkLockout('  TEST@EXAMPLE.COM  ');

      expect(mockRedisInstance.get).toHaveBeenCalledWith('lockout:test@example.com');
    });
  });

  describe('recordFailedAttempt', () => {
    it('should increment attempt count for first failure', async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      const status = await lockoutService.recordFailedAttempt('new@example.com');

      expect(status.failedAttempts).toBe(1);
      expect(status.attemptsRemaining).toBe(4);
      expect(status.isLocked).toBe(false);
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'lockout:new@example.com',
        900, // 15 minutes
        expect.stringContaining('"attempts":1')
      );
    });

    it('should increment existing attempt count', async () => {
      mockRedisInstance.get.mockResolvedValue(JSON.stringify({ attempts: 2, lockedUntil: null }));

      const status = await lockoutService.recordFailedAttempt('existing@example.com');

      expect(status.failedAttempts).toBe(3);
      expect(status.attemptsRemaining).toBe(2);
      expect(status.isLocked).toBe(false);
    });

    it('should trigger lockout after 5 failed attempts', async () => {
      mockRedisInstance.get.mockResolvedValue(JSON.stringify({ attempts: 4, lockedUntil: null }));

      const status = await lockoutService.recordFailedAttempt('almostlocked@example.com');

      expect(status.isLocked).toBe(true);
      expect(status.failedAttempts).toBe(5);
      expect(status.attemptsRemaining).toBe(0);
      expect(status.lockoutExpiresAt).not.toBeNull();
      // Lockout should be ~15 minutes in the future
      const expectedLockoutTime = Date.now() + 15 * 60 * 1000;
      expect(status.lockoutExpiresAt!.getTime()).toBeGreaterThan(expectedLockoutTime - 1000);
      expect(status.lockoutExpiresAt!.getTime()).toBeLessThan(expectedLockoutTime + 1000);
    });

    it('should not increment attempts while account is locked', async () => {
      const lockedUntil = Date.now() + 10 * 60 * 1000;
      mockRedisInstance.get.mockResolvedValue(JSON.stringify({ attempts: 5, lockedUntil }));

      const status = await lockoutService.recordFailedAttempt('locked@example.com');

      expect(status.isLocked).toBe(true);
      expect(status.failedAttempts).toBe(5); // Should stay at 5
      expect(mockRedisInstance.setex).not.toHaveBeenCalled(); // No update
    });

    it('should start new count after lockout expires', async () => {
      const lockedUntil = Date.now() - 1000; // Expired
      mockRedisInstance.get.mockResolvedValue(JSON.stringify({ attempts: 5, lockedUntil }));

      const status = await lockoutService.recordFailedAttempt('expired@example.com');

      expect(status.failedAttempts).toBe(6); // Continues from where it was
      expect(status.isLocked).toBe(true); // Re-locks immediately (6 >= 5)
    });
  });

  describe('clearLockout', () => {
    it('should delete the lockout key for a user', async () => {
      await lockoutService.clearLockout('user@example.com');

      expect(mockRedisInstance.del).toHaveBeenCalledWith('lockout:user@example.com');
    });

    it('should normalize email when clearing lockout', async () => {
      await lockoutService.clearLockout('  USER@EXAMPLE.COM  ');

      expect(mockRedisInstance.del).toHaveBeenCalledWith('lockout:user@example.com');
    });
  });

  describe('getRemainingLockoutSeconds', () => {
    it('should return 0 for unlocked accounts', async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      const seconds = await lockoutService.getRemainingLockoutSeconds('notlocked@example.com');

      expect(seconds).toBe(0);
    });

    it('should return remaining seconds for locked accounts', async () => {
      const lockedUntil = Date.now() + 300 * 1000; // 5 minutes from now
      mockRedisInstance.get.mockResolvedValue(JSON.stringify({ attempts: 5, lockedUntil }));

      const seconds = await lockoutService.getRemainingLockoutSeconds('locked@example.com');

      // Should be approximately 300 seconds (5 minutes)
      expect(seconds).toBeGreaterThan(295);
      expect(seconds).toBeLessThanOrEqual(300);
    });

    it('should return 0 for expired lockouts', async () => {
      const lockedUntil = Date.now() - 1000; // Expired
      mockRedisInstance.get.mockResolvedValue(JSON.stringify({ attempts: 5, lockedUntil }));

      const seconds = await lockoutService.getRemainingLockoutSeconds('expired@example.com');

      expect(seconds).toBe(0);
    });
  });

  describe('graceful degradation (fail-open)', () => {
    it('should allow login check when Redis get fails', async () => {
      mockRedisInstance.get.mockRejectedValue(new Error('Redis connection failed'));

      const status = await lockoutService.checkLockout('user@example.com');

      // Should fail-open - allow login attempt
      expect(status.isLocked).toBe(false);
      expect(status.attemptsRemaining).toBe(5);
    });

    it('should allow login when Redis setex fails during failed attempt', async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      mockRedisInstance.setex.mockRejectedValue(new Error('Redis write failed'));

      const status = await lockoutService.recordFailedAttempt('user@example.com');

      // Should fail-open with partial tracking
      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle malformed JSON in Redis', async () => {
      mockRedisInstance.get.mockResolvedValue('invalid json');

      // Should not throw, should fail-open
      const status = await lockoutService.checkLockout('user@example.com');

      expect(status.isLocked).toBe(false);
    });

    it('should handle empty email gracefully', async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      const status = await lockoutService.checkLockout('');

      expect(status.isLocked).toBe(false);
      expect(mockRedisInstance.get).toHaveBeenCalledWith('lockout:');
    });

    it('should use correct TTL for lockout data (15 minutes)', async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      await lockoutService.recordFailedAttempt('user@example.com');

      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        expect.any(String),
        900, // 15 minutes in seconds
        expect.any(String)
      );
    });
  });
});
