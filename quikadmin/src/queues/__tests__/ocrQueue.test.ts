/**
 * OCR Queue Tests
 *
 * Comprehensive unit tests for ocrQueue covering:
 * - Queue availability checking
 * - QueueUnavailableError handling
 * - OCR job enqueueing
 * - Queue health monitoring
 */

import { QueueUnavailableError } from '../../utils/QueueUnavailableError';

// Mock dependencies before imports
jest.mock('bull');
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    document: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  })),
}));
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

describe('ocrQueue', () => {
  let Bull: jest.Mocked<any>;
  let mockQueue: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Setup Bull mock
    Bull = require('bull');
    mockQueue = {
      process: jest.fn(),
      on: jest.fn(),
      close: jest.fn(),
      add: jest.fn(),
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
    it('should initialize queue successfully when Redis is available', () => {
      Bull.mockImplementation(() => mockQueue);

      const { isOCRQueueAvailable } = require('../ocrQueue');

      expect(isOCRQueueAvailable()).toBe(true);
    });

    it('should mark queue as unavailable when Redis connection fails', () => {
      Bull.mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      const { isOCRQueueAvailable } = require('../ocrQueue');

      expect(isOCRQueueAvailable()).toBe(false);
    });

    it('should update availability on error event', () => {
      Bull.mockImplementation(() => mockQueue);

      const { isOCRQueueAvailable } = require('../ocrQueue');

      // Simulate 'error' event
      const errorHandler = mockQueue.on.mock.calls.find(
        (call: any[]) => call[0] === 'error'
      )?.[1];
      if (errorHandler) errorHandler(new Error('Redis error'));

      expect(isOCRQueueAvailable()).toBe(false);
    });

    it('should update availability on ready event', () => {
      Bull.mockImplementation(() => mockQueue);

      const { isOCRQueueAvailable } = require('../ocrQueue');

      // Simulate 'ready' event
      const readyHandler = mockQueue.on.mock.calls.find(
        (call: any[]) => call[0] === 'ready'
      )?.[1];
      if (readyHandler) readyHandler();

      expect(isOCRQueueAvailable()).toBe(true);
    });
  });

  // ==========================================================================
  // QueueUnavailableError Tests
  // ==========================================================================

  describe('QueueUnavailableError Handling', () => {
    it('should throw QueueUnavailableError when enqueueing with unavailable queue', async () => {
      Bull.mockImplementation(() => {
        throw new Error('Redis unavailable');
      });

      const { enqueueDocumentForOCR } = require('../ocrQueue');

      await expect(
        enqueueDocumentForOCR('doc-123', 'user-456', '/test/doc.pdf', true)
      ).rejects.toThrow(QueueUnavailableError);

      await expect(
        enqueueDocumentForOCR('doc-123', 'user-456', '/test/doc.pdf', true)
      ).rejects.toThrow("Queue 'ocr-processing' is currently unavailable");
    });

    it('should throw QueueUnavailableError when checking health with unavailable queue', async () => {
      Bull.mockImplementation(() => {
        throw new Error('Redis unavailable');
      });

      const { getOCRQueueHealth } = require('../ocrQueue');

      await expect(getOCRQueueHealth()).rejects.toThrow(QueueUnavailableError);
    });

    it('should throw QueueUnavailableError when getting job status with unavailable queue', async () => {
      Bull.mockImplementation(() => {
        throw new Error('Redis unavailable');
      });

      const { getOCRJobStatus } = require('../ocrQueue');

      await expect(getOCRJobStatus('job-123')).rejects.toThrow(QueueUnavailableError);
    });

    it('should throw QueueUnavailableError when reprocessing with unavailable queue', async () => {
      Bull.mockImplementation(() => {
        throw new Error('Redis unavailable');
      });

      const { enqueueDocumentForReprocessing } = require('../ocrQueue');

      await expect(
        enqueueDocumentForReprocessing('doc-123', 'user-456', '/test/doc.pdf', 'Low confidence')
      ).rejects.toThrow(QueueUnavailableError);
    });
  });

  // ==========================================================================
  // Enqueue Document for OCR Tests
  // ==========================================================================

  describe('enqueueDocumentForOCR', () => {
    it('should enqueue document when forceOCR is true', async () => {
      Bull.mockImplementation(() => mockQueue);

      const mockJob = { id: 'job-123' };
      mockQueue.add.mockResolvedValue(mockJob);

      const { enqueueDocumentForOCR } = require('../ocrQueue');

      const readyHandler = mockQueue.on.mock.calls.find(
        (call: any[]) => call[0] === 'ready'
      )?.[1];
      if (readyHandler) readyHandler();

      const job = await enqueueDocumentForOCR('doc-123', 'user-456', '/test/doc.pdf', true);

      expect(job).toBe(mockJob);
      expect(mockQueue.add).toHaveBeenCalledWith({
        documentId: 'doc-123',
        userId: 'user-456',
        filePath: '/test/doc.pdf',
        options: {},
      });
    });

    it('should skip OCR for non-scanned PDFs when forceOCR is false', async () => {
      Bull.mockImplementation(() => mockQueue);

      // Mock DocumentDetectionService
      jest.doMock('../../services/DocumentDetectionService', () => ({
        DocumentDetectionService: jest.fn().mockImplementation(() => ({
          isScannedPDF: jest.fn().mockResolvedValue(false),
        })),
      }));

      const { enqueueDocumentForOCR } = require('../ocrQueue');

      const readyHandler = mockQueue.on.mock.calls.find(
        (call: any[]) => call[0] === 'ready'
      )?.[1];
      if (readyHandler) readyHandler();

      const job = await enqueueDocumentForOCR('doc-123', 'user-456', '/test/doc.pdf', false);

      expect(job).toBeNull();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should throw error when queue is unavailable', async () => {
      Bull.mockImplementation(() => {
        throw new Error('Redis down');
      });

      const { enqueueDocumentForOCR } = require('../ocrQueue');

      await expect(
        enqueueDocumentForOCR('doc-123', 'user-456', '/test/doc.pdf', true)
      ).rejects.toThrow(QueueUnavailableError);
    });
  });

  // ==========================================================================
  // Queue Health Monitoring Tests
  // ==========================================================================

  describe('getOCRQueueHealth', () => {
    it('should return health status when queue is available', async () => {
      Bull.mockImplementation(() => mockQueue);

      mockQueue.getWaitingCount.mockResolvedValue(10);
      mockQueue.getActiveCount.mockResolvedValue(3);
      mockQueue.getCompletedCount.mockResolvedValue(50);
      mockQueue.getFailedCount.mockResolvedValue(2);

      const { getOCRQueueHealth } = require('../ocrQueue');

      const readyHandler = mockQueue.on.mock.calls.find(
        (call: any[]) => call[0] === 'ready'
      )?.[1];
      if (readyHandler) readyHandler();

      const health = await getOCRQueueHealth();

      expect(health).toEqual({
        queue: 'ocr-processing',
        waiting: 10,
        active: 3,
        completed: 50,
        failed: 2,
        isHealthy: true,
      });
    });

    it('should mark queue as unhealthy when active jobs exceed threshold', async () => {
      Bull.mockImplementation(() => mockQueue);

      mockQueue.getWaitingCount.mockResolvedValue(10);
      mockQueue.getActiveCount.mockResolvedValue(60); // > 50
      mockQueue.getCompletedCount.mockResolvedValue(100);
      mockQueue.getFailedCount.mockResolvedValue(5);

      const { getOCRQueueHealth } = require('../ocrQueue');

      const readyHandler = mockQueue.on.mock.calls.find(
        (call: any[]) => call[0] === 'ready'
      )?.[1];
      if (readyHandler) readyHandler();

      const health = await getOCRQueueHealth();

      expect(health.isHealthy).toBe(false);
    });

    it('should mark queue as unhealthy when waiting jobs exceed threshold', async () => {
      Bull.mockImplementation(() => mockQueue);

      mockQueue.getWaitingCount.mockResolvedValue(600); // > 500
      mockQueue.getActiveCount.mockResolvedValue(5);
      mockQueue.getCompletedCount.mockResolvedValue(100);
      mockQueue.getFailedCount.mockResolvedValue(5);

      const { getOCRQueueHealth } = require('../ocrQueue');

      const readyHandler = mockQueue.on.mock.calls.find(
        (call: any[]) => call[0] === 'ready'
      )?.[1];
      if (readyHandler) readyHandler();

      const health = await getOCRQueueHealth();

      expect(health.isHealthy).toBe(false);
    });
  });

  // ==========================================================================
  // Job Status Tests
  // ==========================================================================

  describe('getOCRJobStatus', () => {
    it('should return null when job not found', async () => {
      Bull.mockImplementation(() => mockQueue);

      mockQueue.getJob.mockResolvedValue(null);

      const { getOCRJobStatus } = require('../ocrQueue');

      const readyHandler = mockQueue.on.mock.calls.find(
        (call: any[]) => call[0] === 'ready'
      )?.[1];
      if (readyHandler) readyHandler();

      const status = await getOCRJobStatus('nonexistent-job');

      expect(status).toBeNull();
    });

    it('should return job status when job exists', async () => {
      Bull.mockImplementation(() => mockQueue);

      const mockJob = {
        id: 'job-123',
        data: {
          documentId: 'doc-456',
          userId: 'user-789',
          filePath: '/test.pdf',
          options: {},
        },
        getState: jest.fn().mockResolvedValue('active'),
        progress: jest.fn().mockReturnValue(75),
        timestamp: Date.now(),
        processedOn: Date.now() - 5000,
        finishedOn: null,
        returnvalue: null,
        failedReason: null,
        attemptsMade: 1,
        opts: { attempts: 3 },
      };

      mockQueue.getJob.mockResolvedValue(mockJob);

      const { getOCRJobStatus } = require('../ocrQueue');

      const readyHandler = mockQueue.on.mock.calls.find(
        (call: any[]) => call[0] === 'ready'
      )?.[1];
      if (readyHandler) readyHandler();

      const status = await getOCRJobStatus('job-123');

      expect(status).toBeDefined();
      expect(status.id).toBe('job-123');
      expect(status.type).toBe('ocr_processing');
      expect(status.status).toBe('active');
      expect(status.progress).toBe(75);
      expect(status.attemptsMade).toBe(1);
      expect(status.attemptsTotal).toBe(3);
    });
  });

  // ==========================================================================
  // Reprocessing Tests
  // ==========================================================================

  describe('enqueueDocumentForReprocessing', () => {
    it('should enqueue document for reprocessing with enhanced settings', async () => {
      Bull.mockImplementation(() => mockQueue);

      const { PrismaClient } = require('@prisma/client');
      const mockPrisma = new PrismaClient();
      mockPrisma.document.findUnique.mockResolvedValue({ reprocessCount: 1 });

      const mockJob = { id: 'job-123' };
      mockQueue.add.mockResolvedValue(mockJob);

      const { enqueueDocumentForReprocessing } = require('../ocrQueue');

      const readyHandler = mockQueue.on.mock.calls.find(
        (call: any[]) => call[0] === 'ready'
      )?.[1];
      if (readyHandler) readyHandler();

      const job = await enqueueDocumentForReprocessing(
        'doc-123',
        'user-456',
        '/test/doc.pdf',
        'Low confidence'
      );

      expect(job).toBe(mockJob);
      expect(mockQueue.add).toHaveBeenCalledWith(
        {
          documentId: 'doc-123',
          userId: 'user-456',
          filePath: '/test/doc.pdf',
          isReprocessing: true,
          reprocessReason: 'Low confidence',
          options: {
            dpi: 600,
            enhancedPreprocessing: true,
          },
        },
        {
          priority: 1,
          timeout: 600000,
        }
      );
    });

    it('should throw error when max reprocessing attempts reached', async () => {
      Bull.mockImplementation(() => mockQueue);

      const { PrismaClient } = require('@prisma/client');
      const mockPrisma = new PrismaClient();
      mockPrisma.document.findUnique.mockResolvedValue({ reprocessCount: 3 });

      const { enqueueDocumentForReprocessing } = require('../ocrQueue');

      const readyHandler = mockQueue.on.mock.calls.find(
        (call: any[]) => call[0] === 'ready'
      )?.[1];
      if (readyHandler) readyHandler();

      await expect(
        enqueueDocumentForReprocessing('doc-123', 'user-456', '/test/doc.pdf', 'Low confidence')
      ).rejects.toThrow('Maximum reprocessing attempts (3) reached');
    });
  });

  // ==========================================================================
  // Graceful Shutdown Tests
  // ==========================================================================

  describe('Graceful Shutdown', () => {
    it('should close queue on SIGTERM', async () => {
      Bull.mockImplementation(() => mockQueue);

      // Import to register SIGTERM handler
      require('../ocrQueue');

      // Simulate SIGTERM
      process.emit('SIGTERM' as any);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockQueue.close).toHaveBeenCalled();
    });
  });
});
