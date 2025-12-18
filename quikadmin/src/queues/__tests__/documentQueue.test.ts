/**
 * Document Queue Tests
 *
 * Comprehensive unit tests for documentQueue covering:
 * - Queue availability checking
 * - QueueUnavailableError handling
 * - Redis connection failures
 * - Queue health monitoring
 */

import { QueueUnavailableError } from '../../utils/QueueUnavailableError';

// Mock Bull before imports
jest.mock('bull');
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock environment variables
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

describe('documentQueue', () => {
  let Bull: jest.Mocked<any>;
  let mockQueue: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Setup Bull mock
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Bull = require('bull');
    mockQueue = {
      process: jest.fn(),
      on: jest.fn(),
      close: jest.fn(),
      getWaitingCount: jest.fn().mockResolvedValue(0),
      getActiveCount: jest.fn().mockResolvedValue(0),
      getCompletedCount: jest.fn().mockResolvedValue(0),
      getFailedCount: jest.fn().mockResolvedValue(0),
      getJob: jest.fn(),
    };
  });

  // ==========================================================================
  // Queue Availability Tests
  // ==========================================================================

  describe('Queue Availability', () => {
    it('should initialize queue successfully when Redis is available', async () => {
      Bull.mockImplementation(() => mockQueue);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isDocumentQueueAvailable } = require('../documentQueue');

      // Simulate 'ready' event
      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      expect(isDocumentQueueAvailable()).toBe(true);
    });

    it('should mark queue as unavailable when Redis connection fails', () => {
      Bull.mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isDocumentQueueAvailable } = require('../documentQueue');

      expect(isDocumentQueueAvailable()).toBe(false);
    });

    it('should mark queue as unavailable on error event', () => {
      Bull.mockImplementation(() => mockQueue);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isDocumentQueueAvailable } = require('../documentQueue');

      // Simulate 'error' event
      const errorHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'error')?.[1];
      if (errorHandler) errorHandler(new Error('Redis error'));

      expect(isDocumentQueueAvailable()).toBe(false);
    });

    it('should track queue availability state correctly', () => {
      Bull.mockImplementation(() => mockQueue);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isDocumentQueueAvailable } = require('../documentQueue');

      // Initially available (optimistic initialization)
      expect(isDocumentQueueAvailable()).toBe(true);

      // Mark as unavailable on error
      const errorHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'error')?.[1];
      if (errorHandler) errorHandler(new Error('Redis down'));

      expect(isDocumentQueueAvailable()).toBe(false);

      // Mark as available on ready
      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      expect(isDocumentQueueAvailable()).toBe(true);
    });
  });

  // ==========================================================================
  // QueueUnavailableError Tests
  // ==========================================================================

  describe('QueueUnavailableError Handling', () => {
    it('should throw QueueUnavailableError when checking health with unavailable queue', async () => {
      Bull.mockImplementation(() => {
        throw new Error('Redis unavailable');
      });

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getQueueHealth, isDocumentQueueAvailable } = require('../documentQueue');

      expect(isDocumentQueueAvailable()).toBe(false);

      await expect(getQueueHealth()).rejects.toThrow(QueueUnavailableError);
      await expect(getQueueHealth()).rejects.toThrow(
        "Queue 'document-processing' is currently unavailable"
      );
    });

    it('should throw QueueUnavailableError when getting job status with unavailable queue', async () => {
      Bull.mockImplementation(() => {
        throw new Error('Redis unavailable');
      });

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getJobStatus, isDocumentQueueAvailable } = require('../documentQueue');

      expect(isDocumentQueueAvailable()).toBe(false);

      await expect(getJobStatus('job-123')).rejects.toThrow(QueueUnavailableError);
    });

    it('should include queue name in error message', async () => {
      Bull.mockImplementation(() => {
        throw new Error('Redis unavailable');
      });

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getQueueHealth } = require('../documentQueue');

      try {
        await getQueueHealth();
        fail('Should have thrown QueueUnavailableError');
      } catch (error) {
        expect(error).toBeInstanceOf(QueueUnavailableError);
        expect((error as Error).message).toContain('document-processing');
      }
    });
  });

  // ==========================================================================
  // Queue Health Monitoring Tests
  // ==========================================================================

  describe('getQueueHealth', () => {
    it('should return health status when queue is available', async () => {
      Bull.mockImplementation(() => mockQueue);

      mockQueue.getWaitingCount.mockResolvedValue(5);
      mockQueue.getActiveCount.mockResolvedValue(2);
      mockQueue.getCompletedCount.mockResolvedValue(100);
      mockQueue.getFailedCount.mockResolvedValue(3);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getQueueHealth } = require('../documentQueue');

      // Ensure queue is marked as available
      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const health = await getQueueHealth();

      expect(health).toEqual({
        queue: 'document-processing',
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        isHealthy: true,
      });
    });

    it('should mark queue as unhealthy when active jobs exceed threshold', async () => {
      Bull.mockImplementation(() => mockQueue);

      mockQueue.getWaitingCount.mockResolvedValue(5);
      mockQueue.getActiveCount.mockResolvedValue(150); // > 100
      mockQueue.getCompletedCount.mockResolvedValue(100);
      mockQueue.getFailedCount.mockResolvedValue(3);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getQueueHealth } = require('../documentQueue');

      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const health = await getQueueHealth();

      expect(health.isHealthy).toBe(false);
    });

    it('should mark queue as unhealthy when waiting jobs exceed threshold', async () => {
      Bull.mockImplementation(() => mockQueue);

      mockQueue.getWaitingCount.mockResolvedValue(1500); // > 1000
      mockQueue.getActiveCount.mockResolvedValue(2);
      mockQueue.getCompletedCount.mockResolvedValue(100);
      mockQueue.getFailedCount.mockResolvedValue(3);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getQueueHealth } = require('../documentQueue');

      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const health = await getQueueHealth();

      expect(health.isHealthy).toBe(false);
    });
  });

  // ==========================================================================
  // Job Status Tests
  // ==========================================================================

  describe('getJobStatus', () => {
    it('should return null when job not found', async () => {
      Bull.mockImplementation(() => mockQueue);

      mockQueue.getJob.mockResolvedValue(null);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getJobStatus } = require('../documentQueue');

      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const status = await getJobStatus('nonexistent-job');

      expect(status).toBeNull();
    });

    it('should return job status when job exists', async () => {
      Bull.mockImplementation(() => mockQueue);

      const mockJob = {
        id: 'job-123',
        data: { documentId: 'doc-456', userId: 'user-789', filePath: '/test.pdf' },
        getState: jest.fn().mockResolvedValue('active'),
        progress: jest.fn().mockReturnValue(50),
        timestamp: Date.now(),
        processedOn: Date.now() - 1000,
        finishedOn: null,
        returnvalue: null,
        failedReason: null,
      };

      mockQueue.getJob.mockResolvedValue(mockJob);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getJobStatus } = require('../documentQueue');

      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const status = await getJobStatus('job-123');

      expect(status).toBeDefined();
      expect(status.id).toBe('job-123');
      expect(status.type).toBe('document_processing');
      expect(status.status).toBe('active');
      expect(status.progress).toBe(50);
    });

    it('should throw QueueUnavailableError when queue is down', async () => {
      Bull.mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getJobStatus } = require('../documentQueue');

      await expect(getJobStatus('job-123')).rejects.toThrow(QueueUnavailableError);
    });
  });

  // ==========================================================================
  // Batch Queue Tests
  // ==========================================================================

  describe('isBatchQueueAvailable', () => {
    it('should track batch queue availability separately', () => {
      Bull.mockImplementation(() => mockQueue);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isBatchQueueAvailable } = require('../documentQueue');

      // Simulate 'ready' event for batch queue
      const batchReadyHandler = mockQueue.on.mock.calls.find(
        (call: any[]) => call[0] === 'ready'
      )?.[1];
      if (batchReadyHandler) batchReadyHandler();

      expect(isBatchQueueAvailable()).toBe(true);
    });

    it('should mark batch queue as unavailable on initialization failure', () => {
      let callCount = 0;
      Bull.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          // Second call is for batch queue
          throw new Error('Batch queue initialization failed');
        }
        return mockQueue;
      });

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isBatchQueueAvailable } = require('../documentQueue');

      expect(isBatchQueueAvailable()).toBe(false);
    });
  });

  // ==========================================================================
  // Graceful Shutdown Tests
  // ==========================================================================

  describe('Graceful Shutdown', () => {
    it('should close queues on SIGTERM', async () => {
      Bull.mockImplementation(() => mockQueue);

      // Import to register SIGTERM handler
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../documentQueue');

      // Simulate SIGTERM
      process.emit('SIGTERM' as any);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockQueue.close).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Redis Configuration Tests
  // ==========================================================================

  describe('Redis Configuration', () => {
    it('should use environment variables for Redis config', () => {
      process.env.REDIS_HOST = 'custom-host';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_PASSWORD = 'secret';

      Bull.mockImplementation((queueName: string, config: any) => {
        expect(config.redis.host).toBe('custom-host');
        expect(config.redis.port).toBe(6380);
        expect(config.redis.password).toBe('secret');
        return mockQueue;
      });

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../documentQueue');
    });

    it('should use default values when env vars not set', () => {
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;
      delete process.env.REDIS_PASSWORD;

      Bull.mockImplementation((queueName: string, config: any) => {
        expect(config.redis.host).toBe('localhost');
        expect(config.redis.port).toBe(6379);
        expect(config.redis.password).toBeUndefined();
        return mockQueue;
      });

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../documentQueue');
    });
  });
});
