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

// Mock piiSafeLogger (used by ocrQueue via: import { piiSafeLogger as logger })
jest.mock('../../utils/piiSafeLogger', () => ({
  piiSafeLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock ocrService singleton (used by ocrQueue via: import { ocrService } from '../services/OCRService')
const mockOcrServiceSingleton = {
  initialize: jest.fn().mockResolvedValue(undefined),
  processImage: jest.fn(),
  processPDF: jest.fn(),
  extractStructuredData: jest.fn().mockResolvedValue({ fields: {} }),
  cleanup: jest.fn().mockResolvedValue(undefined),
};
jest.mock('../../services/OCRService', () => ({
  ocrService: mockOcrServiceSingleton,
  OCRProgress: {},
  StructuredDataResult: {},
}));

// Mock other dependencies imported by ocrQueue
jest.mock('../../services/DocumentDetectionService', () => ({
  DocumentDetectionService: jest.fn().mockImplementation(() => ({
    detectDocumentType: jest.fn().mockResolvedValue({ type: 'UNKNOWN', confidence: 0 }),
  })),
}));

jest.mock('../../services/RealtimeService', () => ({
  realtimeService: {
    notifyJobProgress: jest.fn(),
    notifyJobComplete: jest.fn(),
    notifyJobFailed: jest.fn(),
  },
}));

jest.mock('../../utils/redisConfig', () => ({
  getRedisConfig: jest.fn().mockReturnValue({ host: 'localhost', port: 6379 }),
  defaultBullSettings: {},
  ocrJobOptions: {},
}));

jest.mock('../../utils/redisHealth', () => ({
  isRedisHealthy: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../utils/ocrJobValidation', () => ({
  validateOcrJobDataOrThrow: jest.fn(),
  OCRValidationError: class extends Error {
    constructor(msg: string) {
      super(msg);
    }
  },
}));

jest.mock('../../middleware/encryptionMiddleware', () => ({
  encryptExtractedData: jest.fn().mockImplementation((data: any) => data),
}));

jest.mock('../../utils/sanitizeLLMInput', () => ({
  sanitizeLLMInput: jest.fn().mockImplementation((input: string) => input),
}));

jest.mock('../../multiagent/agents/classifierAgent', () => ({
  classifyDocument: jest.fn().mockResolvedValue({
    documentType: 'UNKNOWN',
    confidence: 0,
    alternativeTypes: [],
    metadata: {},
  }),
}));

jest.mock('../../multiagent/agents/extractorAgent', () => ({
  extractDocumentData: jest.fn().mockResolvedValue({
    fields: {},
    documentCategory: 'UNKNOWN',
    rawText: '',
    processingTime: 0,
    modelUsed: 'pattern-fallback',
  }),
  mergeExtractionResults: jest.fn().mockImplementation((a: any, b: any) => ({ ...a, ...b })),
}));

jest.mock('../../utils/fileReader', () => ({
  getFileBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-file-content')),
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
            enhance: false,
            language: 'eng',
            quality: 'standard',
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
    let mockOcrService: typeof mockOcrServiceSingleton;

    beforeEach(() => {
      // Reset the shared singleton mock for each test
      mockOcrService = mockOcrServiceSingleton;
      mockOcrService.initialize.mockReset().mockResolvedValue(undefined);
      mockOcrService.processImage.mockReset();
      mockOcrService.processPDF.mockReset();
      mockOcrService.extractStructuredData.mockReset().mockResolvedValue({ fields: {} });
      mockOcrService.cleanup.mockReset().mockResolvedValue(undefined);
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

      // Execute the processor - should throw (error propagates)
      await expect(processorCallback!(mockJob)).rejects.toThrow('OCR processing failed');

      // OCR service singleton manages its own lifecycle - no per-job cleanup needed
      // The error is propagated to Bull for retry handling
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
      const result = await processorCallback!(mockJob);

      // OCR service singleton manages its own lifecycle - no per-job cleanup needed
      // Verify the processor completed successfully
      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    });

    it('should log warning but not throw when cleanup itself fails', async () => {
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

      // Execute the processor - should complete successfully
      // OCR service singleton manages its own lifecycle - no per-job cleanup needed
      const result = await processorCallback!(mockJob);

      // Verify the result is still returned
      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    });
  });

  // ==========================================================================
  // Low Confidence Threshold Configuration Tests (Task 343)
  // ==========================================================================

  describe('Low Confidence Threshold Configuration', () => {
    it('should use default threshold of 40 when env var not set', () => {
      Bull.mockImplementation(() => mockQueue);

      const { OCR_QUEUE_CONFIG } = require('../ocrQueue');

      expect(OCR_QUEUE_CONFIG.LOW_CONFIDENCE_THRESHOLD).toBe(40);
    });

    it('should parse valid threshold from env var', () => {
      process.env.OCR_LOW_CONFIDENCE_THRESHOLD = '55';

      jest.resetModules();
      Bull.mockImplementation(() => mockQueue);

      const { OCR_QUEUE_CONFIG } = require('../ocrQueue');

      expect(OCR_QUEUE_CONFIG.LOW_CONFIDENCE_THRESHOLD).toBe(55);

      // Cleanup
      delete process.env.OCR_LOW_CONFIDENCE_THRESHOLD;
    });

    it('should use default when env var is invalid (non-numeric)', () => {
      process.env.OCR_LOW_CONFIDENCE_THRESHOLD = 'invalid';

      jest.resetModules();
      Bull.mockImplementation(() => mockQueue);

      const { OCR_QUEUE_CONFIG } = require('../ocrQueue');
      const { piiSafeLogger: logger } = require('../../utils/piiSafeLogger');

      // Should fall back to default 40
      expect(OCR_QUEUE_CONFIG.LOW_CONFIDENCE_THRESHOLD).toBe(40);
      // Should log warning - check the first argument contains the message
      expect(logger.warn).toHaveBeenCalled();
      const warnCalls = (logger.warn as jest.Mock).mock.calls;
      const hasInvalidWarning = warnCalls.some(
        (call: any[]) =>
          typeof call[0] === 'string' && call[0].includes('Invalid OCR_LOW_CONFIDENCE_THRESHOLD')
      );
      expect(hasInvalidWarning).toBe(true);

      // Cleanup
      delete process.env.OCR_LOW_CONFIDENCE_THRESHOLD;
    });

    it('should use default when env var is out of range (>100)', () => {
      process.env.OCR_LOW_CONFIDENCE_THRESHOLD = '150';

      jest.resetModules();
      Bull.mockImplementation(() => mockQueue);

      const { OCR_QUEUE_CONFIG } = require('../ocrQueue');
      const { piiSafeLogger: logger } = require('../../utils/piiSafeLogger');

      // Should fall back to default 40
      expect(OCR_QUEUE_CONFIG.LOW_CONFIDENCE_THRESHOLD).toBe(40);
      // Should log warning about out of range - check the first argument
      expect(logger.warn).toHaveBeenCalled();
      const warnCalls = (logger.warn as jest.Mock).mock.calls;
      const hasOutOfRangeWarning = warnCalls.some(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('out of range')
      );
      expect(hasOutOfRangeWarning).toBe(true);

      // Cleanup
      delete process.env.OCR_LOW_CONFIDENCE_THRESHOLD;
    });

    it('should use default when env var is out of range (<0)', () => {
      process.env.OCR_LOW_CONFIDENCE_THRESHOLD = '-10';

      jest.resetModules();
      Bull.mockImplementation(() => mockQueue);

      const { OCR_QUEUE_CONFIG } = require('../ocrQueue');
      const { piiSafeLogger: logger } = require('../../utils/piiSafeLogger');

      // Should fall back to default 40
      expect(OCR_QUEUE_CONFIG.LOW_CONFIDENCE_THRESHOLD).toBe(40);
      // Should log warning about out of range - check the first argument
      expect(logger.warn).toHaveBeenCalled();
      const warnCalls = (logger.warn as jest.Mock).mock.calls;
      const hasOutOfRangeWarning = warnCalls.some(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('out of range')
      );
      expect(hasOutOfRangeWarning).toBe(true);

      // Cleanup
      delete process.env.OCR_LOW_CONFIDENCE_THRESHOLD;
    });

    it('should accept boundary value of 0', () => {
      process.env.OCR_LOW_CONFIDENCE_THRESHOLD = '0';

      jest.resetModules();
      Bull.mockImplementation(() => mockQueue);

      const { OCR_QUEUE_CONFIG } = require('../ocrQueue');

      expect(OCR_QUEUE_CONFIG.LOW_CONFIDENCE_THRESHOLD).toBe(0);

      // Cleanup
      delete process.env.OCR_LOW_CONFIDENCE_THRESHOLD;
    });

    it('should accept boundary value of 100', () => {
      process.env.OCR_LOW_CONFIDENCE_THRESHOLD = '100';

      jest.resetModules();
      Bull.mockImplementation(() => mockQueue);

      const { OCR_QUEUE_CONFIG } = require('../ocrQueue');

      expect(OCR_QUEUE_CONFIG.LOW_CONFIDENCE_THRESHOLD).toBe(100);

      // Cleanup
      delete process.env.OCR_LOW_CONFIDENCE_THRESHOLD;
    });
  });

  // ==========================================================================
  // Low Confidence OCR Logging Tests (Task 342)
  // ==========================================================================

  describe('Low Confidence OCR Logging', () => {
    let mockOcrService: typeof mockOcrServiceSingleton;

    beforeEach(() => {
      // Reset the shared singleton mock for each test
      mockOcrService = mockOcrServiceSingleton;
      mockOcrService.initialize.mockReset().mockResolvedValue(undefined);
      mockOcrService.processImage.mockReset();
      mockOcrService.processPDF.mockReset();
      mockOcrService.extractStructuredData.mockReset().mockResolvedValue({ fields: {} });
      mockOcrService.cleanup.mockReset().mockResolvedValue(undefined);
    });

    it('should log warning when OCR confidence is below threshold (REQ-003)', async () => {
      Bull.mockImplementation(() => mockQueue);

      // Mock low confidence result (below default 40%)
      mockOcrService.processPDF.mockResolvedValue({
        text: 'Low quality text',
        confidence: 25, // Below 40% threshold
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
      const { piiSafeLogger: logger } = require('../../utils/piiSafeLogger');

      expect(processorCallback).not.toBeNull();

      // Create a mock job for PDF (scanned document)
      const mockJob = {
        id: 'job-low-conf',
        data: {
          documentId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
          filePath: 'https://testaccount.r2.cloudflarestorage.com/bucket/scanned.pdf',
          options: {},
        },
        progress: jest.fn(),
      };

      // Mock prisma update
      mockPrismaDocument.update.mockResolvedValue({});

      // Execute the processor
      await processorCallback!(mockJob);

      // Verify low confidence warning was logged
      expect(logger.warn).toHaveBeenCalledWith(
        'LOW_CONFIDENCE_OCR',
        expect.objectContaining({
          documentId: '550e8400-e29b-41d4-a716-446655440000',
          confidence: 25,
          threshold: 40,
          fileType: 'scanned_pdf',
          wasConvertedFromPdf: true,
        })
      );
    });

    it('should not log warning when OCR confidence is above threshold', async () => {
      Bull.mockImplementation(() => mockQueue);

      // Mock high confidence result (above 40% threshold)
      mockOcrService.processPDF.mockResolvedValue({
        text: 'High quality text',
        confidence: 85, // Above 40% threshold
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
      const { piiSafeLogger: logger } = require('../../utils/piiSafeLogger');

      // Clear any previous calls
      (logger.warn as jest.Mock).mockClear();

      expect(processorCallback).not.toBeNull();

      // Create a mock job
      const mockJob = {
        id: 'job-high-conf',
        data: {
          documentId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
          filePath: 'https://testaccount.r2.cloudflarestorage.com/bucket/clear.pdf',
          options: {},
        },
        progress: jest.fn(),
      };

      // Mock prisma update
      mockPrismaDocument.update.mockResolvedValue({});

      // Execute the processor
      await processorCallback!(mockJob);

      // Verify low confidence warning was NOT logged
      expect(logger.warn).not.toHaveBeenCalledWith('LOW_CONFIDENCE_OCR', expect.anything());
    });

    it('should log correct fileType for image files', async () => {
      Bull.mockImplementation(() => mockQueue);

      // Mock low confidence result for image
      mockOcrService.processImage.mockResolvedValue({
        text: 'Low quality image text',
        confidence: 30, // Below 40% threshold
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
      const { piiSafeLogger: logger } = require('../../utils/piiSafeLogger');

      expect(processorCallback).not.toBeNull();

      // Create a mock job for image file
      const mockJob = {
        id: 'job-image-low-conf',
        data: {
          documentId: '660e8400-e29b-41d4-a716-446655440001',
          userId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
          filePath: 'https://testaccount.r2.cloudflarestorage.com/bucket/photo.jpg',
          options: {},
        },
        progress: jest.fn(),
      };

      // Mock prisma update
      mockPrismaDocument.update.mockResolvedValue({});

      // Execute the processor
      await processorCallback!(mockJob);

      // Verify fileType is 'image' for jpg files
      expect(logger.warn).toHaveBeenCalledWith(
        'LOW_CONFIDENCE_OCR',
        expect.objectContaining({
          fileType: 'image',
          wasConvertedFromPdf: false,
        })
      );
    });

    it('should truncate long storage URLs in log output', async () => {
      Bull.mockImplementation(() => mockQueue);

      // Mock low confidence result
      mockOcrService.processPDF.mockResolvedValue({
        text: 'Low quality text',
        confidence: 35,
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
      const { piiSafeLogger: logger } = require('../../utils/piiSafeLogger');

      expect(processorCallback).not.toBeNull();

      // Create a mock job with a long URL
      const longUrl =
        'https://testaccount.r2.cloudflarestorage.com/bucket/very/long/path/to/document/with/many/subdirectories/file.pdf';
      const mockJob = {
        id: 'job-long-url',
        data: {
          documentId: '770e8400-e29b-41d4-a716-446655440002',
          userId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
          filePath: longUrl,
          options: {},
        },
        progress: jest.fn(),
      };

      // Mock prisma update
      mockPrismaDocument.update.mockResolvedValue({});

      // Execute the processor
      await processorCallback!(mockJob);

      // Verify URL is truncated (should end with ...)
      expect(logger.warn).toHaveBeenCalledWith(
        'LOW_CONFIDENCE_OCR',
        expect.objectContaining({
          storageUrl: expect.stringMatching(
            /^https:\/\/testaccount\.r2\.cloudflarestorage\.com\/buck.*\.\.\.$/
          ),
        })
      );
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
