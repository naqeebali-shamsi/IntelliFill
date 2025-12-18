import Bull from 'bull';
import { PrismaClient } from '@prisma/client';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { OCRService, OCRProgress } from '../services/OCRService';
import { DocumentDetectionService } from '../services/DocumentDetectionService';
import { QueueUnavailableError } from '../utils/QueueUnavailableError';

const prisma = new PrismaClient();

/**
 * Job data interface for OCR processing
 */
export interface OCRProcessingJob {
  documentId: string;
  userId: string;
  filePath: string;
  isReprocessing?: boolean;
  reprocessReason?: string;
  options?: {
    language?: string;
    dpi?: number;
    enhancedPreprocessing?: boolean;
  };
}

/**
 * Redis configuration for queue
 */
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

/**
 * Queue availability flag
 */
let ocrQueueAvailable = false;

/**
 * OCR processing queue with retry logic and exponential backoff
 */
let ocrQueue: Bull.Queue<OCRProcessingJob> | null = null;
try {
  ocrQueue = new Bull<OCRProcessingJob>('ocr-processing', {
    redis: redisConfig,
    defaultJobOptions: {
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 50, // Keep last 50 failed jobs
      attempts: 3, // Retry up to 3 times for OCR failures
      backoff: {
        type: 'exponential',
        delay: 3000, // Start with 3s delay, exponentially increase (3s, 9s, 27s)
      },
      timeout: 600000, // 10 minute timeout for OCR jobs
    },
  });

  ocrQueue.on('error', async (error) => {
    logger.error('OCR queue error:', error);
    ocrQueueAvailable = false;

    // Check Redis health to provide more context
    const { isRedisHealthy } = await import('../utils/redisHealth');
    if (!isRedisHealthy()) {
      logger.error('Queue error likely due to Redis connection loss');
    }
  });

  ocrQueue.on('ready', () => {
    logger.info('OCR queue ready');
    ocrQueueAvailable = true;
  });

  ocrQueueAvailable = true;
} catch (error) {
  logger.warn('OCR queue initialization failed - Redis may be unavailable:', error);
  ocrQueueAvailable = false;
}

/**
 * Check if OCR queue is available
 */
export function isOCRQueueAvailable(): boolean {
  return ocrQueueAvailable && ocrQueue !== null;
}

/**
 * Process OCR jobs
 */
if (ocrQueue) {
  ocrQueue.process(async (job) => {
    const { documentId, filePath, options } = job.data;
    const startTime = Date.now();

    try {
      logger.info(`Starting OCR processing for document ${documentId}`);

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
        // Map OCR progress (0-100) to job progress (10-90)
        const progressPercent = 10 + progress.progress * 0.8;
        job.progress(progressPercent);

        logger.debug(`OCR Progress for ${documentId}: ${progress.stage} - ${progress.message}`);
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
          confidence: ocrResult.confidence / 100, // Convert to 0-1 scale
          processedAt: new Date(),
        },
      });

      // Cleanup OCR service resources
      await ocrService.cleanup();

      await job.progress(100);

      const processingTime = Date.now() - startTime;
      logger.info(
        `OCR processing completed for document ${documentId} in ${processingTime}ms with confidence ${ocrResult.confidence}%`
      );

      return {
        documentId,
        status: 'completed',
        confidence: ocrResult.confidence,
        pageCount: ocrResult.metadata.pageCount,
        textLength: ocrResult.text.length,
        processingTime,
      };
    } catch (error) {
      logger.error(`OCR processing failed for document ${documentId}:`, error);

      // Update document status to FAILED
      await prisma.document
        .update({
          where: { id: documentId },
          data: {
            status: 'FAILED',
            extractedText: `OCR Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        })
        .catch((dbError) => {
          logger.error('Failed to update document status:', dbError);
        });

      throw error;
    }
  });
}

/**
 * Event handlers for logging and monitoring
 */
if (ocrQueue) {
  ocrQueue.on('completed', (job, result) => {
    logger.info(`OCR job ${job.id} completed`, {
      documentId: result.documentId,
      confidence: result.confidence,
      pageCount: result.pageCount,
    });
  });

  ocrQueue.on('failed', (job, err) => {
    logger.error(`OCR job ${job.id} failed:`, err);
    logger.info(
      `OCR job ${job.id} will retry. Attempt ${job.attemptsMade} of ${job.opts.attempts}`
    );
  });

  ocrQueue.on('stalled', (job) => {
    logger.warn(`OCR job ${job.id} has stalled`);
  });
}

/**
 * Helper function to enqueue a document for OCR processing
 * Automatically detects if PDF is scanned and needs OCR
 */
export async function enqueueDocumentForOCR(
  documentId: string,
  userId: string,
  filePath: string,
  forceOCR: boolean = false
): Promise<Bull.Job<OCRProcessingJob> | null> {
  if (!isOCRQueueAvailable()) {
    throw new QueueUnavailableError('ocr-processing');
  }

  try {
    // Check if PDF needs OCR
    if (!forceOCR) {
      const detectionService = new DocumentDetectionService();
      const isScanned = await detectionService.isScannedPDF(filePath);

      if (!isScanned) {
        logger.info(`Document ${documentId} is text-based, skipping OCR`);
        return null; // No OCR needed
      }
    }

    logger.info(`Enqueueing document ${documentId} for OCR processing`);

    const job = await ocrQueue!.add({
      documentId,
      userId,
      filePath,
      options: {},
    });

    return job;
  } catch (error) {
    logger.error(`Failed to enqueue document ${documentId} for OCR:`, error);
    throw error;
  }
}

/**
 * Get OCR queue health status
 */
export async function getOCRQueueHealth() {
  if (!isOCRQueueAvailable()) {
    throw new QueueUnavailableError('ocr-processing');
  }

  const [waiting, active, completed, failed] = await Promise.all([
    ocrQueue!.getWaitingCount(),
    ocrQueue!.getActiveCount(),
    ocrQueue!.getCompletedCount(),
    ocrQueue!.getFailedCount(),
  ]);

  return {
    queue: 'ocr-processing',
    waiting,
    active,
    completed,
    failed,
    isHealthy: active < 50 && waiting < 500,
  };
}

/**
 * Get OCR job status by ID
 */
export async function getOCRJobStatus(jobId: string) {
  if (!isOCRQueueAvailable()) {
    throw new QueueUnavailableError('ocr-processing');
  }

  const job = await ocrQueue!.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();

  return {
    id: job.id,
    type: 'ocr_processing',
    status: state,
    progress: job.progress(),
    data: job.data,
    result: job.returnvalue,
    error: job.failedReason,
    attemptsMade: job.attemptsMade,
    attemptsTotal: job.opts.attempts,
    createdAt: new Date(job.timestamp),
    startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
    completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
  };
}

/**
 * Cleanup on shutdown
 */
process.on('SIGTERM', async () => {
  if (ocrQueue) {
    logger.info('Shutting down OCR queue...');
    await ocrQueue.close();
    logger.info('OCR queue closed');
  }
});

/**
 * Enqueue document for reprocessing with enhanced settings
 */
export async function enqueueDocumentForReprocessing(
  documentId: string,
  userId: string,
  filePath: string,
  reason?: string
): Promise<Bull.Job<OCRProcessingJob>> {
  if (!isOCRQueueAvailable()) {
    throw new QueueUnavailableError('ocr-processing');
  }

  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { reprocessCount: true },
    });

    if (document && document.reprocessCount >= 3) {
      throw new Error('Maximum reprocessing attempts (3) reached for this document');
    }

    logger.info('Enqueueing document for reprocessing', {
      documentId,
      attempt: (document?.reprocessCount || 0) + 1,
    });

    const job = await ocrQueue!.add(
      {
        documentId,
        userId,
        filePath,
        isReprocessing: true,
        reprocessReason: reason,
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

    return job;
  } catch (error) {
    logger.error('Failed to enqueue document for reprocessing', { documentId, error });
    throw error;
  }
}

// Export queue instance (may be null if Redis unavailable)
export { ocrQueue };
