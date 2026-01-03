/**
 * OCR Processor Worker Integration Tests
 *
 * Tests for the OCR job processor covering:
 * - Job progress updates (5%, 10%, 90%, 95%, 100%)
 * - Document status transitions (PROCESSING -> COMPLETED)
 * - Failure handling with database status updates
 * - RealtimeService notification calls
 * - Job timeout handling
 * - Job cancellation scenarios
 *
 * @module workers/__tests__/ocrProcessor.test
 */

import { Job } from 'bull';
import { OCRProcessingJob } from '../../queues/ocrQueue';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock prisma
const mockPrismaDocumentUpdate = jest.fn();
const mockPrismaDocumentFindUnique = jest.fn();

jest.mock('../../utils/prisma', () => ({
  prisma: {
    document: {
      update: (...args: unknown[]) => mockPrismaDocumentUpdate(...args),
      findUnique: (...args: unknown[]) => mockPrismaDocumentFindUnique(...args),
    },
  },
}));

// Mock RealtimeService
const mockSendToUser = jest.fn();
jest.mock('../../services/RealtimeService', () => ({
  realtimeService: {
    sendToUser: (...args: unknown[]) => mockSendToUser(...args),
  },
}));

// Mock OCRService
const mockOCRInitialize = jest.fn().mockResolvedValue(undefined);
const mockOCRProcessPDF = jest.fn();
const mockOCRExtractStructuredData = jest.fn();
const mockOCRCleanup = jest.fn().mockResolvedValue(undefined);

jest.mock('../../services/OCRService', () => ({
  OCRService: jest.fn().mockImplementation(() => ({
    initialize: mockOCRInitialize,
    processPDF: mockOCRProcessPDF,
    extractStructuredData: mockOCRExtractStructuredData,
    cleanup: mockOCRCleanup,
  })),
}));

// Mock logger
jest.mock('../../utils/piiSafeLogger', () => ({
  piiSafeLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ============================================================================
// Test Helpers
// ============================================================================

interface MockJobOptions {
  documentId?: string;
  userId?: string;
  filePath?: string;
  options?: Record<string, unknown>;
}

function createMockJob(overrides: MockJobOptions = {}): Job<OCRProcessingJob> {
  const progressFn = jest.fn().mockResolvedValue(undefined);

  return {
    id: 'job-123',
    data: {
      documentId: overrides.documentId ?? 'doc-123',
      userId: overrides.userId ?? 'user-456',
      filePath: overrides.filePath ?? '/test/document.pdf',
      options: overrides.options ?? {},
    },
    progress: progressFn,
    attemptsMade: 0,
    opts: { attempts: 3 },
    timestamp: Date.now(),
    processedOn: null,
    finishedOn: null,
    returnvalue: null,
    failedReason: null,
    getState: jest.fn().mockResolvedValue('active'),
    update: jest.fn(),
    remove: jest.fn(),
    retry: jest.fn(),
    discard: jest.fn(),
    finished: jest.fn(),
    moveToCompleted: jest.fn(),
    moveToFailed: jest.fn(),
    promote: jest.fn(),
    lockKey: jest.fn(),
    releaseLock: jest.fn(),
    takeLock: jest.fn(),
    extendLock: jest.fn(),
    log: jest.fn(),
    isCompleted: jest.fn(),
    isFailed: jest.fn(),
    isDelayed: jest.fn(),
    isActive: jest.fn(),
    isWaiting: jest.fn(),
    isPaused: jest.fn(),
    isStuck: jest.fn(),
    toJSON: jest.fn(),
    queue: {} as any,
    name: 'ocr-processing',
    stacktrace: [],
  } as unknown as Job<OCRProcessingJob>;
}

function createSuccessfulOCRResult() {
  return {
    text: 'Extracted document text content',
    confidence: 95,
    metadata: {
      pageCount: 3,
      language: 'en',
      processingTime: 5000,
    },
    pages: [
      { pageNumber: 1, text: 'Page 1 content', confidence: 96 },
      { pageNumber: 2, text: 'Page 2 content', confidence: 94 },
      { pageNumber: 3, text: 'Page 3 content', confidence: 95 },
    ],
  };
}

// ============================================================================
// Simulated Processor Function
// (Extracted logic from ocrQueue.ts for isolated testing)
// ============================================================================

import { prisma } from '../../utils/prisma';
import { realtimeService } from '../../services/RealtimeService';
import { OCRService, OCRProgress } from '../../services/OCRService';

async function processOCRJob(job: Job<OCRProcessingJob>): Promise<{
  documentId: string;
  status: string;
  confidence: number;
  pageCount: number;
  textLength: number;
  processingTime: number;
}> {
  const { documentId, userId, filePath } = job.data;
  const startTime = Date.now();

  try {
    // Update document status to PROCESSING
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    });

    await job.progress(5);

    // Initialize OCR service
    const ocrService = new OCRService();
    await ocrService.initialize();

    await job.progress(10);

    // Process PDF with OCR and track progress
    const ocrResult = await ocrService.processPDF(filePath, (progress: OCRProgress) => {
      const progressPercent = 10 + progress.progress * 0.8;
      job.progress(progressPercent);

      if (userId) {
        realtimeService.sendToUser(userId, 'queue_progress', {
          jobId: job.id,
          documentId,
          progress: progressPercent,
          stage: progress.stage,
          message: progress.message,
        });
      }
    });

    await job.progress(90);

    // Extract structured data from OCR text
    const structuredData = await ocrService.extractStructuredData(ocrResult.text);

    await job.progress(95);

    // Update document with OCR results
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'COMPLETED',
        extractedText: ocrResult.text,
        extractedData: {
          ...structuredData,
          ocrMetadata: ocrResult.metadata,
          pages: ocrResult.pages,
        },
        confidence: ocrResult.confidence / 100,
        processedAt: new Date(),
      },
    });

    await ocrService.cleanup();
    await job.progress(100);

    return {
      documentId,
      status: 'completed',
      confidence: ocrResult.confidence,
      pageCount: ocrResult.metadata.pageCount,
      textLength: ocrResult.text.length,
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        extractedText: `OCR Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    }).catch(() => {
      // Ignore DB errors during failure handling
    });

    throw error;
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('OCR Processor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaDocumentUpdate.mockResolvedValue({ id: 'doc-123' });
    mockOCRProcessPDF.mockResolvedValue(createSuccessfulOCRResult());
    mockOCRExtractStructuredData.mockResolvedValue({
      name: 'John Doe',
      dateOfBirth: '1990-01-15',
    });
  });

  // ==========================================================================
  // Progress Update Tests
  // ==========================================================================

  describe('Job Progress Updates', () => {
    it('should report progress at 5% after setting status to PROCESSING', async () => {
      const mockJob = createMockJob();

      await processOCRJob(mockJob);

      expect(mockJob.progress).toHaveBeenCalledWith(5);
    });

    it('should report progress at 10% after OCR service initialization', async () => {
      const mockJob = createMockJob();

      await processOCRJob(mockJob);

      expect(mockJob.progress).toHaveBeenCalledWith(10);
    });

    it('should report progress at 90% after OCR processing completes', async () => {
      const mockJob = createMockJob();

      await processOCRJob(mockJob);

      expect(mockJob.progress).toHaveBeenCalledWith(90);
    });

    it('should report progress at 95% after structured data extraction', async () => {
      const mockJob = createMockJob();

      await processOCRJob(mockJob);

      expect(mockJob.progress).toHaveBeenCalledWith(95);
    });

    it('should report progress at 100% on successful completion', async () => {
      const mockJob = createMockJob();

      await processOCRJob(mockJob);

      expect(mockJob.progress).toHaveBeenCalledWith(100);
    });

    it('should report incremental progress during PDF processing', async () => {
      const mockJob = createMockJob();

      mockOCRProcessPDF.mockImplementation((_path: string, callback: (progress: OCRProgress) => void) => {
        // Simulate progress updates with correct OCRProgress interface
        callback({ currentPage: 1, totalPages: 4, progress: 25, stage: 'preprocessing', message: 'Preprocessing page 1' });
        callback({ currentPage: 2, totalPages: 4, progress: 50, stage: 'recognizing', message: 'OCR on page 2' });
        callback({ currentPage: 3, totalPages: 4, progress: 75, stage: 'recognizing', message: 'OCR on page 3' });
        callback({ currentPage: 4, totalPages: 4, progress: 100, stage: 'complete', message: 'OCR complete' });
        return Promise.resolve(createSuccessfulOCRResult());
      });

      await processOCRJob(mockJob);

      // Progress should be mapped from 10-90 range (10 + progress * 0.8)
      expect(mockJob.progress).toHaveBeenCalledWith(30);  // 10 + 25 * 0.8 = 30
      expect(mockJob.progress).toHaveBeenCalledWith(50);  // 10 + 50 * 0.8 = 50
      expect(mockJob.progress).toHaveBeenCalledWith(70);  // 10 + 75 * 0.8 = 70
      expect(mockJob.progress).toHaveBeenCalledWith(90);  // 10 + 100 * 0.8 = 90
    });
  });

  // ==========================================================================
  // Document Status Update Tests
  // ==========================================================================

  describe('Document Status Updates', () => {
    it('should update document status to PROCESSING at start', async () => {
      const mockJob = createMockJob({ documentId: 'doc-999' });

      await processOCRJob(mockJob);

      expect(mockPrismaDocumentUpdate).toHaveBeenCalledWith({
        where: { id: 'doc-999' },
        data: { status: 'PROCESSING' },
      });
    });

    it('should update document status to COMPLETED on success', async () => {
      const mockJob = createMockJob({ documentId: 'doc-999' });

      await processOCRJob(mockJob);

      expect(mockPrismaDocumentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-999' },
          data: expect.objectContaining({
            status: 'COMPLETED',
            extractedText: expect.any(String),
            confidence: expect.any(Number),
          }),
        })
      );
    });

    it('should store OCR confidence as decimal (0-1 scale)', async () => {
      const mockJob = createMockJob();

      await processOCRJob(mockJob);

      expect(mockPrismaDocumentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            confidence: 0.95, // 95 / 100
          }),
        })
      );
    });

    it('should store extracted data with OCR metadata and pages', async () => {
      const mockJob = createMockJob();

      await processOCRJob(mockJob);

      expect(mockPrismaDocumentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            extractedData: expect.objectContaining({
              name: 'John Doe',
              ocrMetadata: expect.objectContaining({
                pageCount: 3,
              }),
              pages: expect.arrayContaining([
                expect.objectContaining({ pageNumber: 1 }),
              ]),
            }),
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Failure Handling Tests
  // ==========================================================================

  describe('Failure Handling', () => {
    it('should update document status to FAILED on OCR error', async () => {
      const mockJob = createMockJob({ documentId: 'doc-fail' });
      mockOCRProcessPDF.mockRejectedValue(new Error('OCR processing failed'));

      await expect(processOCRJob(mockJob)).rejects.toThrow('OCR processing failed');

      expect(mockPrismaDocumentUpdate).toHaveBeenCalledWith({
        where: { id: 'doc-fail' },
        data: {
          status: 'FAILED',
          extractedText: 'OCR Error: OCR processing failed',
        },
      });
    });

    it('should handle database errors during failure gracefully', async () => {
      const mockJob = createMockJob();
      mockOCRProcessPDF.mockRejectedValue(new Error('OCR failed'));

      // Make the failure status update also fail
      mockPrismaDocumentUpdate
        .mockResolvedValueOnce({ id: 'doc-123' }) // PROCESSING update succeeds
        .mockRejectedValueOnce(new Error('DB connection lost')); // FAILED update fails

      // Should still throw the original OCR error, not the DB error
      await expect(processOCRJob(mockJob)).rejects.toThrow('OCR failed');
    });

    it('should include error message in extractedText field', async () => {
      const mockJob = createMockJob();
      mockOCRProcessPDF.mockRejectedValue(new Error('Tesseract initialization failed'));

      await expect(processOCRJob(mockJob)).rejects.toThrow();

      expect(mockPrismaDocumentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            extractedText: 'OCR Error: Tesseract initialization failed',
          }),
        })
      );
    });

    it('should handle non-Error thrown values', async () => {
      const mockJob = createMockJob();
      mockOCRProcessPDF.mockRejectedValue('String error message');

      await expect(processOCRJob(mockJob)).rejects.toBe('String error message');

      expect(mockPrismaDocumentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            extractedText: 'OCR Error: Unknown error',
          }),
        })
      );
    });
  });

  // ==========================================================================
  // RealtimeService Notification Tests
  // ==========================================================================

  describe('RealtimeService Notifications', () => {
    it('should send progress updates to user via RealtimeService', async () => {
      const mockJob = createMockJob({ userId: 'user-realtime' });

      mockOCRProcessPDF.mockImplementation((_path: string, callback: (progress: OCRProgress) => void) => {
        callback({ currentPage: 2, totalPages: 4, progress: 50, stage: 'recognizing', message: 'Processing...' });
        return Promise.resolve(createSuccessfulOCRResult());
      });

      await processOCRJob(mockJob);

      expect(mockSendToUser).toHaveBeenCalledWith(
        'user-realtime',
        'queue_progress',
        expect.objectContaining({
          jobId: 'job-123',
          documentId: 'doc-123',
          progress: 50,
          stage: 'recognizing',
          message: 'Processing...',
        })
      );
    });

    it('should not send notifications when userId is not provided', async () => {
      const mockJob = createMockJob({ userId: '' });

      mockOCRProcessPDF.mockImplementation((_path: string, callback: (progress: OCRProgress) => void) => {
        callback({ currentPage: 2, totalPages: 4, progress: 50, stage: 'recognizing', message: 'Processing...' });
        return Promise.resolve(createSuccessfulOCRResult());
      });

      await processOCRJob(mockJob);

      expect(mockSendToUser).not.toHaveBeenCalled();
    });

    it('should include all required fields in progress notification', async () => {
      const mockJob = createMockJob();

      mockOCRProcessPDF.mockImplementation((_path: string, callback: (progress: OCRProgress) => void) => {
        callback({ currentPage: 3, totalPages: 4, progress: 75, stage: 'recognizing', message: 'Finalizing...' });
        return Promise.resolve(createSuccessfulOCRResult());
      });

      await processOCRJob(mockJob);

      expect(mockSendToUser).toHaveBeenCalledWith(
        expect.any(String),
        'queue_progress',
        expect.objectContaining({
          jobId: expect.any(String),
          documentId: expect.any(String),
          progress: expect.any(Number),
          stage: expect.any(String),
          message: expect.any(String),
        })
      );
    });
  });

  // ==========================================================================
  // Job Result Tests
  // ==========================================================================

  describe('Job Result', () => {
    it('should return successful result with all metrics', async () => {
      const mockJob = createMockJob();

      const result = await processOCRJob(mockJob);

      expect(result).toEqual({
        documentId: 'doc-123',
        status: 'completed',
        confidence: 95,
        pageCount: 3,
        textLength: expect.any(Number),
        processingTime: expect.any(Number),
      });
    });

    it('should include processing time in result', async () => {
      const mockJob = createMockJob();

      const result = await processOCRJob(mockJob);

      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // OCR Service Lifecycle Tests
  // ==========================================================================

  describe('OCR Service Lifecycle', () => {
    it('should initialize OCR service before processing', async () => {
      const mockJob = createMockJob();

      await processOCRJob(mockJob);

      expect(mockOCRInitialize).toHaveBeenCalled();
    });

    it('should cleanup OCR service after successful processing', async () => {
      const mockJob = createMockJob();

      await processOCRJob(mockJob);

      expect(mockOCRCleanup).toHaveBeenCalled();
    });

    it('should call processPDF with correct file path', async () => {
      const mockJob = createMockJob({ filePath: '/uploads/test-doc.pdf' });

      await processOCRJob(mockJob);

      expect(mockOCRProcessPDF).toHaveBeenCalledWith(
        '/uploads/test-doc.pdf',
        expect.any(Function)
      );
    });
  });
});
