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
    incr: jest.fn(),
    expire: jest.fn().mockResolvedValue(1),
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
      // Both main key and counter key return null for a new user
      mockRedisInstance.get.mockResolvedValue(null);

      const status = await lockoutService.checkLockout('newuser@example.com');

      expect(status.isLocked).toBe(false);
      expect(status.attemptsRemaining).toBe(5);
      expect(status.failedAttempts).toBe(0);
      expect(status.lockoutExpiresAt).toBeNull();
    });

    it('should return current attempts from main key for user with some failed attempts', async () => {
      mockRedisInstance.get.mockResolvedValue(JSON.stringify({ attempts: 2, lockedUntil: null }));

      const status = await lockoutService.checkLockout('test@example.com');

      expect(status.isLocked).toBe(false);
      expect(status.attemptsRemaining).toBe(3);
      expect(status.failedAttempts).toBe(2);
    });

    it('should return current attempts from counter key when main key does not exist', async () => {
      // Main key returns null, counter key returns the attempt count
      mockRedisInstance.get
        .mockResolvedValueOnce(null) // main key: lockout:test@example.com
        .mockResolvedValueOnce('3'); // counter key: lockout:test@example.com:count

      const status = await lockoutService.checkLockout('test@example.com');

      expect(status.isLocked).toBe(false);
      expect(status.attemptsRemaining).toBe(2);
      expect(status.failedAttempts).toBe(3);
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
    it('should record first failed attempt using atomic INCR', async () => {
      mockRedisInstance.get.mockResolvedValue(null); // No existing lockout
      mockRedisInstance.incr.mockResolvedValue(1); // First increment returns 1

      const status = await lockoutService.recordFailedAttempt('new@example.com');

      expect(status.failedAttempts).toBe(1);
      expect(status.attemptsRemaining).toBe(4);
      expect(status.isLocked).toBe(false);
      // Should use atomic INCR on the counter key
      expect(mockRedisInstance.incr).toHaveBeenCalledWith('lockout:new@example.com:count');
      // Should set expiry on counter key for first attempt
      expect(mockRedisInstance.expire).toHaveBeenCalledWith('lockout:new@example.com:count', 900);
      // Should NOT write main lockout key (only 1 attempt, threshold is 5)
      expect(mockRedisInstance.setex).not.toHaveBeenCalled();
    });

    it('should increment existing attempt count via atomic INCR', async () => {
      // Main key has no lockout data (or old non-locked data)
      mockRedisInstance.get.mockResolvedValue(null);
      mockRedisInstance.incr.mockResolvedValue(3); // Counter already at 2, INCR returns 3

      const status = await lockoutService.recordFailedAttempt('existing@example.com');

      expect(status.failedAttempts).toBe(3);
      expect(status.attemptsRemaining).toBe(2);
      expect(status.isLocked).toBe(false);
      expect(mockRedisInstance.incr).toHaveBeenCalledWith('lockout:existing@example.com:count');
      // Not first attempt, so expire should NOT be called
      expect(mockRedisInstance.expire).not.toHaveBeenCalled();
      // Below threshold, so setex should NOT be called
      expect(mockRedisInstance.setex).not.toHaveBeenCalled();
    });

    it('should trigger lockout after 5 failed attempts', async () => {
      mockRedisInstance.get.mockResolvedValue(null); // No active lockout
      mockRedisInstance.incr.mockResolvedValue(5); // INCR returns 5 (threshold reached)

      const status = await lockoutService.recordFailedAttempt('almostlocked@example.com');

      expect(status.isLocked).toBe(true);
      expect(status.failedAttempts).toBe(5);
      expect(status.attemptsRemaining).toBe(0);
      expect(status.lockoutExpiresAt).not.toBeNull();
      // Lockout should be ~15 minutes in the future
      const expectedLockoutTime = Date.now() + 15 * 60 * 1000;
      expect(status.lockoutExpiresAt!.getTime()).toBeGreaterThan(expectedLockoutTime - 1000);
      expect(status.lockoutExpiresAt!.getTime()).toBeLessThan(expectedLockoutTime + 1000);
      // Should write lockout state to main key
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'lockout:almostlocked@example.com',
        900,
        expect.stringContaining('"attempts":5')
      );
    });

    it('should not increment attempts while account is locked', async () => {
      const lockedUntil = Date.now() + 10 * 60 * 1000;
      mockRedisInstance.get.mockResolvedValue(JSON.stringify({ attempts: 5, lockedUntil }));

      const status = await lockoutService.recordFailedAttempt('locked@example.com');

      expect(status.isLocked).toBe(true);
      expect(status.failedAttempts).toBe(5); // Should stay at 5
      // Should NOT call INCR or write any keys - returns early
      expect(mockRedisInstance.incr).not.toHaveBeenCalled();
      expect(mockRedisInstance.setex).not.toHaveBeenCalled();
    });

    it('should start new count after lockout expires', async () => {
      const lockedUntil = Date.now() - 1000; // Expired
      mockRedisInstance.get.mockResolvedValue(JSON.stringify({ attempts: 5, lockedUntil }));
      mockRedisInstance.incr.mockResolvedValue(6); // Counter continues from previous count

      const status = await lockoutService.recordFailedAttempt('expired@example.com');

      expect(status.failedAttempts).toBe(6); // Continues from where it was
      expect(status.isLocked).toBe(true); // Re-locks immediately (6 >= 5)
      // Should call INCR since lockout expired
      expect(mockRedisInstance.incr).toHaveBeenCalledWith('lockout:expired@example.com:count');
      // Should write new lockout state
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'lockout:expired@example.com',
        900,
        expect.stringContaining('"attempts":6')
      );
    });
  });

  describe('clearLockout', () => {
    it('should delete both the lockout key and counter key for a user', async () => {
      await lockoutService.clearLockout('user@example.com');

      expect(mockRedisInstance.del).toHaveBeenCalledWith('lockout:user@example.com');
      expect(mockRedisInstance.del).toHaveBeenCalledWith('lockout:user@example.com:count');
      expect(mockRedisInstance.del).toHaveBeenCalledTimes(2);
    });

    it('should normalize email when clearing lockout', async () => {
      await lockoutService.clearLockout('  USER@EXAMPLE.COM  ');

      expect(mockRedisInstance.del).toHaveBeenCalledWith('lockout:user@example.com');
      expect(mockRedisInstance.del).toHaveBeenCalledWith('lockout:user@example.com:count');
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

    it('should allow login when Redis incr fails during failed attempt', async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      mockRedisInstance.incr.mockRejectedValue(new Error('Redis write failed'));

      const status = await lockoutService.recordFailedAttempt('user@example.com');

      // Should fail-open with fallback (1 failed attempt assumed)
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

    it('should use correct TTL for counter expiry on first attempt (15 minutes)', async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      mockRedisInstance.incr.mockResolvedValue(1); // First attempt

      await lockoutService.recordFailedAttempt('user@example.com');

      // Counter key should get 15 minute TTL on first attempt
      expect(mockRedisInstance.expire).toHaveBeenCalledWith(
        'lockout:user@example.com:count',
        900 // 15 minutes in seconds
      );
    });

    it('should use correct TTL for lockout key when threshold reached', async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      mockRedisInstance.incr.mockResolvedValue(5); // Threshold reached

      await lockoutService.recordFailedAttempt('user@example.com');

      // Main lockout key should get 15 minute TTL
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'lockout:user@example.com',
        900, // 15 minutes in seconds
        expect.any(String)
      );
    });
  });
});
