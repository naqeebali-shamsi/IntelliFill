/**
 * Multi-Agent Queue Tests
 *
 * Integration tests for the BullMQ-based multi-agent processing queue.
 * Tests cover:
 * - Queue initialization and availability
 * - Job enqueueing and status tracking
 * - Queue health monitoring
 * - Worker lifecycle
 * - Error handling
 */

import { QueueUnavailableError } from '../../utils/QueueUnavailableError';

// Mock BullMQ before imports
jest.mock('bullmq', () => {
  const mockQueue = {
    add: jest.fn(),
    getJob: jest.fn(),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
    getDelayedCount: jest.fn().mockResolvedValue(0),
    close: jest.fn().mockResolvedValue(undefined),
    waitUntilReady: jest.fn().mockResolvedValue(undefined),
  };

  const mockWorker = {
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const mockQueueEvents = {
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  };

  return {
    Queue: jest.fn().mockImplementation(() => mockQueue),
    Worker: jest.fn().mockImplementation(() => mockWorker),
    QueueEvents: jest.fn().mockImplementation(() => mockQueueEvents),
    __mockQueue: mockQueue,
    __mockWorker: mockWorker,
    __mockQueueEvents: mockQueueEvents,
  };
});

// Mock logger
jest.mock('../../utils/piiSafeLogger', () => ({
  piiSafeLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Prisma
jest.mock('../../utils/prisma', () => ({
  prisma: {
    multiAgentProcessing: {
      create: jest.fn().mockResolvedValue({ id: 'record-123' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    document: {
      update: jest.fn().mockResolvedValue({}),
    },
  },
}));

// Mock RealtimeService
jest.mock('../../services/RealtimeService', () => ({
  realtimeService: {
    sendToUser: jest.fn(),
  },
}));

// Mock processDocument
jest.mock('../../multiagent', () => ({
  processDocument: jest.fn().mockResolvedValue({
    results: {
      success: true,
      finalData: { firstName: 'John', lastName: 'Doe' },
      confidence: { overall: 95 },
    },
    extractedFields: { firstName: 'John', lastName: 'Doe' },
    agentHistory: [
      {
        agent: 'classify',
        model: 'gemini-pro',
        startTime: new Date(),
        endTime: new Date(),
        status: 'completed',
      },
    ],
  }),
}));

// Mock environment variables
process.env.REDIS_URL = 'redis://localhost:6379';

describe('multiagentQueue', () => {
  let bullmq: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Get the mocked bullmq module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    bullmq = require('bullmq');
  });

  // ==========================================================================
  // Queue Initialization Tests
  // ==========================================================================

  describe('initializeMultiagentQueue', () => {
    it('should initialize queue successfully', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initializeMultiagentQueue, isMultiagentQueueAvailable } = require('../multiagentQueue');

      const result = await initializeMultiagentQueue();

      expect(result).toBe(true);
      expect(isMultiagentQueueAvailable()).toBe(true);
      expect(bullmq.Queue).toHaveBeenCalledWith(
        'multiagent-processing',
        expect.objectContaining({
          connection: expect.any(Object),
          defaultJobOptions: expect.objectContaining({
            attempts: 3,
          }),
        })
      );
    });

    it('should return false on initialization failure', async () => {
      bullmq.__mockQueue.waitUntilReady.mockRejectedValueOnce(new Error('Redis unavailable'));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initializeMultiagentQueue, isMultiagentQueueAvailable } = require('../multiagentQueue');

      const result = await initializeMultiagentQueue();

      expect(result).toBe(false);
      expect(isMultiagentQueueAvailable()).toBe(false);
    });
  });

  // ==========================================================================
  // Queue Availability Tests
  // ==========================================================================

  describe('isMultiagentQueueAvailable', () => {
    it('should return true when queue is initialized', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initializeMultiagentQueue, isMultiagentQueueAvailable } = require('../multiagentQueue');

      await initializeMultiagentQueue();

      expect(isMultiagentQueueAvailable()).toBe(true);
    });

    it('should return false when queue is not initialized', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isMultiagentQueueAvailable } = require('../multiagentQueue');

      expect(isMultiagentQueueAvailable()).toBe(false);
    });
  });

  // ==========================================================================
  // Job Enqueueing Tests
  // ==========================================================================

  describe('enqueueMultiagentProcessing', () => {
    it('should enqueue a job successfully', async () => {
      const mockJob = { id: 'job-123', data: {} };
      bullmq.__mockQueue.add.mockResolvedValue(mockJob);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initializeMultiagentQueue, enqueueMultiagentProcessing } = require('../multiagentQueue');

      await initializeMultiagentQueue();

      const jobData = {
        documentId: 'doc-456',
        userId: 'user-789',
        filePath: '/uploads/test.pdf',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      const result = await enqueueMultiagentProcessing(jobData);

      expect(result).toEqual(mockJob);
      expect(bullmq.__mockQueue.add).toHaveBeenCalledWith(
        'process-document',
        jobData,
        expect.objectContaining({
          jobId: expect.stringContaining('multiagent-doc-456'),
        })
      );
    });

    it('should throw QueueUnavailableError when queue is not available', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { enqueueMultiagentProcessing } = require('../multiagentQueue');
      // Get QueueUnavailableError from same module context after resetModules
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { QueueUnavailableError: QUE } = require('../../utils/QueueUnavailableError');

      const jobData = {
        documentId: 'doc-456',
        userId: 'user-789',
        filePath: '/uploads/test.pdf',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      };

      await expect(enqueueMultiagentProcessing(jobData)).rejects.toThrow(QUE);
    });

    it('should create database record when enqueueing', async () => {
      const { prisma } = require('../../utils/prisma');
      const mockJob = { id: 'job-123', data: {} };
      bullmq.__mockQueue.add.mockResolvedValue(mockJob);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initializeMultiagentQueue, enqueueMultiagentProcessing } = require('../multiagentQueue');

      await initializeMultiagentQueue();

      await enqueueMultiagentProcessing({
        documentId: 'doc-456',
        userId: 'user-789',
        filePath: '/uploads/test.pdf',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        priority: 5,
      });

      expect(prisma.multiAgentProcessing.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          documentId: 'doc-456',
          userId: 'user-789',
          status: 'PENDING',
          priority: 5,
        }),
      });
    });
  });

  // ==========================================================================
  // Job Status Tests
  // ==========================================================================

  describe('getMultiagentJobStatus', () => {
    it('should return job status when job exists', async () => {
      const mockJob = {
        id: 'job-123',
        data: { documentId: 'doc-456', userId: 'user-789' },
        getState: jest.fn().mockResolvedValue('active'),
        progress: 50,
        returnvalue: null as unknown,
        failedReason: null as string | null,
        attemptsMade: 1,
        opts: { attempts: 3 },
        timestamp: Date.now(),
        processedOn: Date.now() - 1000,
        finishedOn: null as number | null,
      };

      bullmq.__mockQueue.getJob.mockResolvedValue(mockJob);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initializeMultiagentQueue, getMultiagentJobStatus } = require('../multiagentQueue');

      await initializeMultiagentQueue();

      const status = await getMultiagentJobStatus('job-123');

      expect(status).toMatchObject({
        id: 'job-123',
        type: 'multiagent_processing',
        status: 'active',
        progress: 50,
        attemptsMade: 1,
        attemptsTotal: 3,
      });
    });

    it('should return null when job not found', async () => {
      bullmq.__mockQueue.getJob.mockResolvedValue(null);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initializeMultiagentQueue, getMultiagentJobStatus } = require('../multiagentQueue');

      await initializeMultiagentQueue();

      const status = await getMultiagentJobStatus('nonexistent');

      expect(status).toBeNull();
    });

    it('should throw QueueUnavailableError when queue is not available', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getMultiagentJobStatus } = require('../multiagentQueue');
      // Get QueueUnavailableError from same module context after resetModules
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { QueueUnavailableError: QUE } = require('../../utils/QueueUnavailableError');

      await expect(getMultiagentJobStatus('job-123')).rejects.toThrow(QUE);
    });
  });

  // ==========================================================================
  // Queue Health Tests
  // ==========================================================================

  describe('getMultiagentQueueHealth', () => {
    it('should return health metrics when queue is available', async () => {
      bullmq.__mockQueue.getWaitingCount.mockResolvedValue(5);
      bullmq.__mockQueue.getActiveCount.mockResolvedValue(2);
      bullmq.__mockQueue.getCompletedCount.mockResolvedValue(100);
      bullmq.__mockQueue.getFailedCount.mockResolvedValue(3);
      bullmq.__mockQueue.getDelayedCount.mockResolvedValue(1);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initializeMultiagentQueue, getMultiagentQueueHealth } = require('../multiagentQueue');

      await initializeMultiagentQueue();

      const health = await getMultiagentQueueHealth();

      expect(health).toEqual({
        queue: 'multiagent-processing',
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
        isHealthy: true,
      });
    });

    it('should mark queue as unhealthy when thresholds exceeded', async () => {
      bullmq.__mockQueue.getWaitingCount.mockResolvedValue(200); // > 100 threshold
      bullmq.__mockQueue.getActiveCount.mockResolvedValue(15); // > 10 threshold
      bullmq.__mockQueue.getCompletedCount.mockResolvedValue(100);
      bullmq.__mockQueue.getFailedCount.mockResolvedValue(3);
      bullmq.__mockQueue.getDelayedCount.mockResolvedValue(1);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initializeMultiagentQueue, getMultiagentQueueHealth } = require('../multiagentQueue');

      await initializeMultiagentQueue();

      const health = await getMultiagentQueueHealth();

      expect(health.isHealthy).toBe(false);
    });

    it('should throw QueueUnavailableError when queue is not available', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getMultiagentQueueHealth } = require('../multiagentQueue');
      // Get QueueUnavailableError from same module context after resetModules
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { QueueUnavailableError: QUE } = require('../../utils/QueueUnavailableError');

      await expect(getMultiagentQueueHealth()).rejects.toThrow(QUE);
    });
  });

  // ==========================================================================
  // Worker Lifecycle Tests
  // ==========================================================================

  describe('startMultiagentWorker', () => {
    it('should start worker when queue is available', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initializeMultiagentQueue, startMultiagentWorker } = require('../multiagentQueue');

      await initializeMultiagentQueue();
      await startMultiagentWorker();

      expect(bullmq.Worker).toHaveBeenCalledWith(
        'multiagent-processing',
        expect.any(Function),
        expect.objectContaining({
          concurrency: 2,
        })
      );
    });

    it('should not start worker when queue is not available', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { startMultiagentWorker } = require('../multiagentQueue');

      await startMultiagentWorker();

      // Worker should not be created
      expect(bullmq.Worker).not.toHaveBeenCalled();
    });

    it('should register event handlers on worker', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initializeMultiagentQueue, startMultiagentWorker } = require('../multiagentQueue');

      await initializeMultiagentQueue();
      await startMultiagentWorker();

      expect(bullmq.__mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(bullmq.__mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(bullmq.__mockWorker.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('closeMultiagentWorker', () => {
    it('should close worker when running', async () => {
       
      const { initializeMultiagentQueue, startMultiagentWorker, closeMultiagentWorker } =
        require('../multiagentQueue');

      await initializeMultiagentQueue();
      await startMultiagentWorker();
      await closeMultiagentWorker();

      expect(bullmq.__mockWorker.close).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Queue Shutdown Tests
  // ==========================================================================

  describe('closeMultiagentQueue', () => {
    it('should close all resources on shutdown', async () => {
       
      const {
        initializeMultiagentQueue,
        startMultiagentWorker,
        closeMultiagentQueue,
        isMultiagentQueueAvailable,
      } = require('../multiagentQueue');

      await initializeMultiagentQueue();
      await startMultiagentWorker();
      await closeMultiagentQueue();

      expect(bullmq.__mockWorker.close).toHaveBeenCalled();
      expect(bullmq.__mockQueueEvents.close).toHaveBeenCalled();
      expect(bullmq.__mockQueue.close).toHaveBeenCalled();
      expect(isMultiagentQueueAvailable()).toBe(false);
    });
  });

  // ==========================================================================
  // Queue Events Tests
  // ==========================================================================

  describe('setupQueueEventHandlers', () => {
    it('should register event handlers', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initializeMultiagentQueue, setupQueueEventHandlers } = require('../multiagentQueue');

      await initializeMultiagentQueue();
      setupQueueEventHandlers();

      expect(bullmq.__mockQueueEvents.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(bullmq.__mockQueueEvents.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(bullmq.__mockQueueEvents.on).toHaveBeenCalledWith('progress', expect.any(Function));
      expect(bullmq.__mockQueueEvents.on).toHaveBeenCalledWith('stalled', expect.any(Function));
    });
  });

  // ==========================================================================
  // Redis Configuration Tests
  // ==========================================================================

  describe('Redis Configuration', () => {
    it('should parse REDIS_URL correctly', async () => {
      process.env.REDIS_URL = 'rediss://user:password@redis.example.com:6380';

      jest.resetModules();

      // Re-require bullmq to get fresh mock after resetModules
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const freshBullmq = require('bullmq');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initializeMultiagentQueue } = require('../multiagentQueue');

      await initializeMultiagentQueue();

      expect(freshBullmq.Queue).toHaveBeenCalledWith(
        'multiagent-processing',
        expect.objectContaining({
          connection: expect.objectContaining({
            host: 'redis.example.com',
            port: 6380,
            password: 'password',
            tls: {},
          }),
        })
      );
    });

    it('should use defaults when REDIS_URL not set', async () => {
      delete process.env.REDIS_URL;
      process.env.REDIS_HOST = 'localhost';
      process.env.REDIS_PORT = '6379';

      jest.resetModules();

      // Re-require bullmq to get fresh mock after resetModules
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const freshBullmq = require('bullmq');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initializeMultiagentQueue } = require('../multiagentQueue');

      await initializeMultiagentQueue();

      expect(freshBullmq.Queue).toHaveBeenCalledWith(
        'multiagent-processing',
        expect.objectContaining({
          connection: expect.objectContaining({
            host: 'localhost',
            port: 6379,
          }),
        })
      );
    });
  });
});
