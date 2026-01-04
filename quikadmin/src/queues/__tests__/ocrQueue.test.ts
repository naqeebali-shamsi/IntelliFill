/**
 * OCR Queue Tests
 *
 * Comprehensive unit tests for ocrQueue covering:
 * - Queue availability checking
 * - QueueUnavailableError handling
 * - OCR job enqueueing
 * - Queue health monitoring
 */

/* eslint-disable @typescript-eslint/no-require-imports */

import { QueueUnavailableError } from '../../utils/QueueUnavailableError';

// Create a shared mock queue object
let mockQueue: any;

// Mock Bull before imports with a proper factory
jest.mock('bull', () => {
  // Return a mock constructor function
  const MockBull = jest.fn().mockImplementation(() => mockQueue);
  return MockBull;
});

// Create a shared mock prisma object for utils/prisma mock
const mockPrismaDocument = {
  update: jest.fn(),
  findUnique: jest.fn(),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    document: mockPrismaDocument,
  })),
}));

// Mock the prisma singleton used by ocrQueue
jest.mock('../../utils/prisma', () => ({
  prisma: {
    document: mockPrismaDocument,
  },
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
  let Bull: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Setup mock queue object
    mockQueue = {
      process: jest.fn(),
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
      add: jest.fn(),
      getWaitingCount: jest.fn().mockResolvedValue(0),
      getActiveCount: jest.fn().mockResolvedValue(0),
      getCompletedCount: jest.fn().mockResolvedValue(0),
      getFailedCount: jest.fn().mockResolvedValue(0),
      getJob: jest.fn(),
    };

    // Get the mocked Bull constructor
    Bull = require('bull');
    // Reset and set default implementation
    Bull.mockClear();
    Bull.mockImplementation(() => mockQueue);
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

    it('should use OCR_CONCURRENCY from environment with default of 1 (Task 265)', () => {
      Bull.mockImplementation(() => mockQueue);

      const { OCR_QUEUE_CONFIG } = require('../ocrQueue');

      // Default is 1 when OCR_CONCURRENCY not set
      expect(OCR_QUEUE_CONFIG.CONCURRENCY).toBe(1);
      expect(typeof OCR_QUEUE_CONFIG.CONCURRENCY).toBe('number');
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
      const errorHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'error')?.[1];
      if (errorHandler) errorHandler(new Error('Redis error'));

      expect(isOCRQueueAvailable()).toBe(false);
    });

    it('should not throw unhandled rejection when error handler runs (Task 265)', () => {
      Bull.mockImplementation(() => mockQueue);

      // Import to register error handler
      require('../ocrQueue');

      // Get the error handler
      const errorHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'error')?.[1];

      // Calling the error handler should not throw (try-catch wraps health check)
      expect(() => {
        if (errorHandler) errorHandler(new Error('Simulated Redis error'));
      }).not.toThrow();
    });

    it('should update availability on ready event', () => {
      Bull.mockImplementation(() => mockQueue);

      const { isOCRQueueAvailable } = require('../ocrQueue');

      // Simulate 'ready' event
      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
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
      // Get QueueUnavailableError from same module context after resetModules
      const { QueueUnavailableError: QUE } = require('../../utils/QueueUnavailableError');

      await expect(
        enqueueDocumentForOCR('doc-123', 'user-456', '/test/doc.pdf', true)
      ).rejects.toThrow(QUE);

      await expect(
        enqueueDocumentForOCR('doc-123', 'user-456', '/test/doc.pdf', true)
      ).rejects.toThrow("Queue 'ocr-processing' is currently unavailable");
    });

    it('should throw QueueUnavailableError when checking health with unavailable queue', async () => {
      Bull.mockImplementation(() => {
        throw new Error('Redis unavailable');
      });

      const { getOCRQueueHealth } = require('../ocrQueue');
      // Get QueueUnavailableError from same module context after resetModules
      const { QueueUnavailableError: QUE } = require('../../utils/QueueUnavailableError');

      await expect(getOCRQueueHealth()).rejects.toThrow(QUE);
    });

    it('should throw QueueUnavailableError when getting job status with unavailable queue', async () => {
      Bull.mockImplementation(() => {
        throw new Error('Redis unavailable');
      });

      const { getOCRJobStatus } = require('../ocrQueue');
      // Get QueueUnavailableError from same module context after resetModules
      const { QueueUnavailableError: QUE } = require('../../utils/QueueUnavailableError');

      await expect(getOCRJobStatus('job-123')).rejects.toThrow(QUE);
    });

    it('should throw QueueUnavailableError when reprocessing with unavailable queue', async () => {
      Bull.mockImplementation(() => {
        throw new Error('Redis unavailable');
      });

      const { enqueueDocumentForReprocessing } = require('../ocrQueue');
      // Get QueueUnavailableError from same module context after resetModules
      const { QueueUnavailableError: QUE } = require('../../utils/QueueUnavailableError');

      await expect(
        enqueueDocumentForReprocessing('doc-123', 'user-456', '/test/doc.pdf', 'Low confidence')
      ).rejects.toThrow(QUE);
    });
  });

  // ==========================================================================
  // Enqueue Document for OCR Tests
  // ==========================================================================

  describe('enqueueDocumentForOCR', () => {
    const validDocId = '550e8400-e29b-41d4-a716-446655440000';
    const validUserId = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
    const validFilePath = 'https://testaccount.r2.cloudflarestorage.com/bucket/doc.pdf';

    it('should enqueue document when forceOCR is true', async () => {
      Bull.mockImplementation(() => mockQueue);

      const mockJob = { id: `ocr-${validDocId}` };
      mockQueue.add.mockResolvedValue(mockJob);
      mockQueue.getJob.mockResolvedValue(null); // No existing job

      const { enqueueDocumentForOCR } = require('../ocrQueue');

      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const job = await enqueueDocumentForOCR(validDocId, validUserId, validFilePath, true);

      expect(job).toBe(mockJob);
      expect(mockQueue.add).toHaveBeenCalledWith(
        {
          documentId: validDocId,
          userId: validUserId,
          filePath: validFilePath,
          options: {},
        },
        {
          jobId: `ocr-${validDocId}`,
        }
      );
    });

    it('should return existing job if duplicate enqueue is attempted (Task 266)', async () => {
      Bull.mockImplementation(() => mockQueue);

      const existingJob = {
        id: `ocr-${validDocId}`,
        getState: jest.fn().mockResolvedValue('waiting'),
      };
      mockQueue.getJob.mockResolvedValue(existingJob);

      const { enqueueDocumentForOCR } = require('../ocrQueue');

      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const job = await enqueueDocumentForOCR(validDocId, validUserId, validFilePath, true);

      // Should return existing job, not create a new one
      expect(job).toBe(existingJob);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should allow new job if previous job is completed (Task 266)', async () => {
      Bull.mockImplementation(() => mockQueue);

      const completedJob = {
        id: `ocr-${validDocId}`,
        getState: jest.fn().mockResolvedValue('completed'),
      };
      const newJob = { id: `ocr-${validDocId}-new` };
      mockQueue.getJob.mockResolvedValue(completedJob);
      mockQueue.add.mockResolvedValue(newJob);

      const { enqueueDocumentForOCR } = require('../ocrQueue');

      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const job = await enqueueDocumentForOCR(validDocId, validUserId, validFilePath, true);

      // Should create a new job since previous is completed
      expect(job).toBe(newJob);
      expect(mockQueue.add).toHaveBeenCalled();
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

      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const job = await enqueueDocumentForOCR(validDocId, validUserId, validFilePath, false);

      expect(job).toBeNull();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should throw error when queue is unavailable', async () => {
      Bull.mockImplementation(() => {
        throw new Error('Redis down');
      });

      const { enqueueDocumentForOCR } = require('../ocrQueue');
      // Get QueueUnavailableError from same module context after resetModules
      const { QueueUnavailableError: QUE } = require('../../utils/QueueUnavailableError');

      await expect(
        enqueueDocumentForOCR(validDocId, validUserId, validFilePath, true)
      ).rejects.toThrow(QUE);
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

      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
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

      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
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

      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const health = await getOCRQueueHealth();

      expect(health.isHealthy).toBe(false);
    });
  });

  // ==========================================================================
  // Job Status Tests
  // ==========================================================================

  describe('getOCRJobStatus', () => {
    const jobOwnerId = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
    const otherUserId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

    it('should return null when job not found', async () => {
      Bull.mockImplementation(() => mockQueue);

      mockQueue.getJob.mockResolvedValue(null);

      const { getOCRJobStatus } = require('../ocrQueue');

      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const status = await getOCRJobStatus('nonexistent-job', jobOwnerId);

      expect(status).toBeNull();
    });

    it('should return job status when job exists and user owns it', async () => {
      Bull.mockImplementation(() => mockQueue);

      const mockJob = {
        id: 'job-123',
        data: {
          documentId: '550e8400-e29b-41d4-a716-446655440000',
          userId: jobOwnerId,
          filePath: 'https://testaccount.r2.cloudflarestorage.com/bucket/test.pdf',
          options: {},
        },
        getState: jest.fn().mockResolvedValue('active'),
        progress: jest.fn().mockReturnValue(75),
        timestamp: Date.now(),
        processedOn: Date.now() - 5000,
        finishedOn: null as number | null,
        returnvalue: null as unknown,
        failedReason: null as string | null,
        attemptsMade: 1,
        opts: { attempts: 3 },
      };

      mockQueue.getJob.mockResolvedValue(mockJob);

      const { getOCRJobStatus } = require('../ocrQueue');

      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const status = await getOCRJobStatus('job-123', jobOwnerId);

      expect(status).toBeDefined();
      expect(status.id).toBe('job-123');
      expect(status.type).toBe('ocr_processing');
      expect(status.status).toBe('active');
      expect(status.progress).toBe(75);
      expect(status.attemptsMade).toBe(1);
      expect(status.attemptsTotal).toBe(3);
    });

    it('should return null when user does not own the job (IDOR protection)', async () => {
      Bull.mockImplementation(() => mockQueue);

      const mockJob = {
        id: 'job-123',
        data: {
          documentId: '550e8400-e29b-41d4-a716-446655440000',
          userId: jobOwnerId, // Owned by jobOwnerId
          filePath: 'https://testaccount.r2.cloudflarestorage.com/bucket/test.pdf',
          options: {},
        },
        getState: jest.fn().mockResolvedValue('active'),
        progress: jest.fn().mockReturnValue(75),
        timestamp: Date.now(),
        processedOn: Date.now() - 5000,
        finishedOn: null as number | null,
        returnvalue: null as unknown,
        failedReason: null as string | null,
        attemptsMade: 1,
        opts: { attempts: 3 },
      };

      mockQueue.getJob.mockResolvedValue(mockJob);

      const { getOCRJobStatus } = require('../ocrQueue');

      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      // otherUserId tries to access jobOwnerId's job - should return null
      const status = await getOCRJobStatus('job-123', otherUserId);

      expect(status).toBeNull();
    });

    it('should not expose sensitive fields like filePath in job data', async () => {
      Bull.mockImplementation(() => mockQueue);

      const mockJob = {
        id: 'job-123',
        data: {
          documentId: '550e8400-e29b-41d4-a716-446655440000',
          userId: jobOwnerId,
          filePath: 'https://testaccount.r2.cloudflarestorage.com/bucket/secret.pdf',
          options: { enhancedPreprocessing: true },
          isReprocessing: true,
          reprocessReason: 'Low confidence',
        },
        getState: jest.fn().mockResolvedValue('completed'),
        progress: jest.fn().mockReturnValue(100),
        timestamp: Date.now(),
        processedOn: Date.now() - 5000,
        finishedOn: Date.now(),
        returnvalue: { success: true },
        failedReason: null as string | null,
        attemptsMade: 1,
        opts: { attempts: 3 },
      };

      mockQueue.getJob.mockResolvedValue(mockJob);

      const { getOCRJobStatus } = require('../ocrQueue');

      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const status = await getOCRJobStatus('job-123', jobOwnerId);

      expect(status).toBeDefined();
      // Verify sensitive fields are NOT exposed
      expect(status.data.filePath).toBeUndefined();
      expect(status.data.userId).toBeUndefined();
      expect(status.data.options).toBeUndefined();
      // Verify safe fields ARE exposed
      expect(status.data.documentId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(status.data.isReprocessing).toBe(true);
      expect(status.data.reprocessReason).toBe('Low confidence');
    });
  });

  // ==========================================================================
  // Reprocessing Tests
  // ==========================================================================

  describe('enqueueDocumentForReprocessing', () => {
    const validDocId = '550e8400-e29b-41d4-a716-446655440000';
    const validUserId = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
    const validFilePath = 'https://testaccount.r2.cloudflarestorage.com/bucket/doc.pdf';

    it('should enqueue document for reprocessing with enhanced settings', async () => {
      Bull.mockImplementation(() => mockQueue);

      // Use the mockPrismaDocument from the top-level mock
      mockPrismaDocument.findUnique.mockResolvedValue({ reprocessCount: 1 });
      mockQueue.getJob.mockResolvedValue(null); // No existing job

      const mockJob = { id: `ocr-reprocess-${validDocId}` };
      mockQueue.add.mockResolvedValue(mockJob);

      const { enqueueDocumentForReprocessing } = require('../ocrQueue');

      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const job = await enqueueDocumentForReprocessing(
        validDocId,
        validUserId,
        validFilePath,
        'Low confidence'
      );

      expect(job).toBe(mockJob);
      expect(mockQueue.add).toHaveBeenCalledWith(
        {
          documentId: validDocId,
          userId: validUserId,
          filePath: validFilePath,
          isReprocessing: true,
          reprocessReason: 'Low confidence',
          options: {
            dpi: 600,
            enhancedPreprocessing: true,
          },
        },
        {
          jobId: `ocr-reprocess-${validDocId}`,
          priority: 1,
          timeout: 600000,
        }
      );
    });

    it('should return existing reprocessing job if duplicate is attempted (Task 266)', async () => {
      Bull.mockImplementation(() => mockQueue);

      mockPrismaDocument.findUnique.mockResolvedValue({ reprocessCount: 1 });

      const existingJob = {
        id: `ocr-reprocess-${validDocId}`,
        getState: jest.fn().mockResolvedValue('active'),
      };
      mockQueue.getJob.mockResolvedValue(existingJob);

      const { enqueueDocumentForReprocessing } = require('../ocrQueue');

      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      const job = await enqueueDocumentForReprocessing(
        validDocId,
        validUserId,
        validFilePath,
        'Low confidence'
      );

      // Should return existing job, not create a new one
      expect(job).toBe(existingJob);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should throw error when max reprocessing attempts reached', async () => {
      Bull.mockImplementation(() => mockQueue);

      // Use the mockPrismaDocument from the top-level mock
      mockPrismaDocument.findUnique.mockResolvedValue({ reprocessCount: 3 });

      const { enqueueDocumentForReprocessing } = require('../ocrQueue');

      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      await expect(
        enqueueDocumentForReprocessing(validDocId, validUserId, validFilePath, 'Low confidence')
      ).rejects.toThrow('Maximum reprocessing attempts (3) reached');
    });

    it('should throw error when document does not exist (Task 267)', async () => {
      Bull.mockImplementation(() => mockQueue);

      // Mock prisma to return null (document not found)
      mockPrismaDocument.findUnique.mockResolvedValue(null);

      const { enqueueDocumentForReprocessing } = require('../ocrQueue');

      const readyHandler = mockQueue.on.mock.calls.find((call: any[]) => call[0] === 'ready')?.[1];
      if (readyHandler) readyHandler();

      await expect(
        enqueueDocumentForReprocessing(validDocId, validUserId, validFilePath, 'Low confidence')
      ).rejects.toThrow(`Document not found: ${validDocId}`);

      // Verify queue.add was never called
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // OCR Service Cleanup Tests (Try-Finally Pattern)
  // ==========================================================================

  describe('OCR Service Cleanup (Try-Finally)', () => {
    let mockOcrService: {
      initialize: jest.Mock;
      processImage: jest.Mock;
      processPDF: jest.Mock;
      extractStructuredData: jest.Mock;
      cleanup: jest.Mock;
    };

    beforeEach(() => {
      // Create mock OCR service instance
      mockOcrService = {
        initialize: jest.fn().mockResolvedValue(undefined),
        processImage: jest.fn(),
        processPDF: jest.fn(),
        extractStructuredData: jest.fn().mockResolvedValue({ fields: {} }),
        cleanup: jest.fn().mockResolvedValue(undefined),
      };

      // Mock OCRService constructor
      jest.doMock('../../services/OCRService', () => ({
        OCRService: jest.fn().mockImplementation(() => mockOcrService),
        OCRProgress: {},
      }));
    });

    it('should call cleanup even when OCR processing throws an error', async () => {
      Bull.mockImplementation(() => mockQueue);

      // Mock processPDF to throw an error
      mockOcrService.processPDF.mockRejectedValue(new Error('OCR processing failed'));

      // Store the processor callback
      let processorCallback: ((job: any) => Promise<any>) | null = null;
      mockQueue.process = jest.fn().mockImplementation((_concurrency, callback) => {
        processorCallback = callback;
      });

      // Import the module to register the processor
      require('../ocrQueue');

      expect(processorCallback).not.toBeNull();

      // Create a mock job
      const mockJob = {
        id: 'job-123',
        data: {
          documentId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
          filePath: 'https://testaccount.r2.cloudflarestorage.com/bucket/doc.pdf',
          options: {},
        },
        progress: jest.fn(),
      };

      // Mock prisma update to avoid database calls
      mockPrismaDocument.update.mockResolvedValue({});

      // Execute the processor - should throw but still cleanup
      await expect(processorCallback!(mockJob)).rejects.toThrow('OCR processing failed');

      // Verify cleanup was called despite the error
      expect(mockOcrService.cleanup).toHaveBeenCalledTimes(1);
    });

    it('should call cleanup on successful processing', async () => {
      Bull.mockImplementation(() => mockQueue);

      // Mock successful processing
      mockOcrService.processPDF.mockResolvedValue({
        text: 'Sample text',
        confidence: 95,
        metadata: { pageCount: 1 },
        pages: [],
      });

      // Store the processor callback
      let processorCallback: ((job: any) => Promise<any>) | null = null;
      mockQueue.process = jest.fn().mockImplementation((_concurrency, callback) => {
        processorCallback = callback;
      });

      // Import the module to register the processor
      require('../ocrQueue');

      expect(processorCallback).not.toBeNull();

      // Create a mock job
      const mockJob = {
        id: 'job-123',
        data: {
          documentId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
          filePath: 'https://testaccount.r2.cloudflarestorage.com/bucket/doc.pdf',
          options: {},
        },
        progress: jest.fn(),
      };

      // Mock prisma update to avoid database calls
      mockPrismaDocument.update.mockResolvedValue({});

      // Execute the processor
      await processorCallback!(mockJob);

      // Verify cleanup was called
      expect(mockOcrService.cleanup).toHaveBeenCalledTimes(1);
    });

    it('should log warning but not throw when cleanup itself fails', async () => {
      Bull.mockImplementation(() => mockQueue);

      // Mock successful processing but cleanup fails
      mockOcrService.processPDF.mockResolvedValue({
        text: 'Sample text',
        confidence: 95,
        metadata: { pageCount: 1 },
        pages: [],
      });
      mockOcrService.cleanup.mockRejectedValue(new Error('Cleanup failed'));

      // Store the processor callback
      let processorCallback: ((job: any) => Promise<any>) | null = null;
      mockQueue.process = jest.fn().mockImplementation((_concurrency, callback) => {
        processorCallback = callback;
      });

      // Import the module to register the processor
      require('../ocrQueue');

      expect(processorCallback).not.toBeNull();

      // Create a mock job
      const mockJob = {
        id: 'job-123',
        data: {
          documentId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
          filePath: 'https://testaccount.r2.cloudflarestorage.com/bucket/doc.pdf',
          options: {},
        },
        progress: jest.fn(),
      };

      // Mock prisma update to avoid database calls
      mockPrismaDocument.update.mockResolvedValue({});

      // Execute the processor - should not throw despite cleanup failure
      const result = await processorCallback!(mockJob);

      // Verify the result is still returned (cleanup failure doesn't affect it)
      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(mockOcrService.cleanup).toHaveBeenCalledTimes(1);
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

    it('should close queue on SIGINT (Ctrl+C) (Task 271)', async () => {
      // Reset module to clear isShuttingDown flag
      jest.resetModules();

      Bull.mockImplementation(() => mockQueue);

      // Import to register SIGINT handler
      require('../ocrQueue');

      // Simulate SIGINT (Ctrl+C)
      process.emit('SIGINT' as any);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockQueue.close).toHaveBeenCalled();
    });

    it('should handle concurrent shutdown signals gracefully (Task 271)', async () => {
      // Reset module to clear isShuttingDown flag
      jest.resetModules();

      Bull.mockImplementation(() => mockQueue);

      // Import to register handlers
      require('../ocrQueue');

      // Simulate multiple signals in quick succession
      process.emit('SIGTERM' as any);
      process.emit('SIGINT' as any); // Second signal should be ignored

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // close() should only be called once (second signal ignored)
      expect(mockQueue.close).toHaveBeenCalledTimes(1);
    });
  });
});
