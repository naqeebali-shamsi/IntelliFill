import Bull from 'bull';
import * as path from 'path';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { OCRService, OCRProgress } from '../services/OCRService';
import { DocumentDetectionService } from '../services/DocumentDetectionService';
import { QueueUnavailableError } from '../utils/QueueUnavailableError';
import { realtimeService } from '../services/RealtimeService';
import { prisma } from '../utils/prisma';
import { getRedisConfig, defaultBullSettings, ocrJobOptions } from '../utils/redisConfig';
import { isRedisHealthy } from '../utils/redisHealth';

// Supported image extensions for OCR
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.tiff', '.tif', '.bmp', '.gif'];

/**
 * OCR Queue Configuration Constants
 *
 * Centralized configuration to eliminate magic numbers and improve maintainability.
 * All queue-related thresholds and limits are defined here.
 */
export const OCR_QUEUE_CONFIG = {
  /** Maximum concurrent OCR jobs (OCR is memory-intensive) */
  CONCURRENCY: parseInt(process.env.OCR_CONCURRENCY || '1', 10),

  /** Maximum job retry attempts before marking as permanently failed */
  MAX_ATTEMPTS: 3,

  /** Initial backoff delay in ms for exponential retry (3s, 9s, 27s) */
  BACKOFF_DELAY_MS: 3000,

  /** Job timeout in ms (10 minutes for standard OCR) */
  TIMEOUT_MS: 600000,

  /** Maximum reprocessing attempts per document */
  MAX_REPROCESS_ATTEMPTS: 3,

  /** Reprocessing job priority (lower = higher priority) */
  REPROCESSING_PRIORITY: 1,

  /** Enhanced DPI for reprocessing jobs */
  REPROCESSING_DPI: 600,

  /** Reprocessing timeout in ms (10 minutes) */
  REPROCESSING_TIMEOUT_MS: 600000,

  /** Health check thresholds */
  HEALTH: {
    /** Max active jobs before queue is considered unhealthy */
    MAX_ACTIVE_JOBS: 50,
    /** Max waiting jobs before queue is considered unhealthy */
    MAX_WAITING_JOBS: 500,
  },
} as const;

/**
 * Queue health status interface
 *
 * Represents the current state of the OCR processing queue
 * for monitoring and health check endpoints.
 */
export interface QueueHealthStatus {
  /** Queue identifier */
  queue: string;
  /** Number of jobs waiting to be processed */
  waiting: number;
  /** Number of jobs currently being processed */
  active: number;
  /** Number of successfully completed jobs */
  completed: number;
  /** Number of failed jobs */
  failed: number;
  /** Whether the queue is operating within healthy limits */
  isHealthy: boolean;
}

/**
 * OCR job status interface
 *
 * Represents the current state of an individual OCR processing job
 * for status queries and progress tracking.
 */
export interface OCRJobStatus {
  /** Unique job identifier */
  id: Bull.JobId;
  /** Job type identifier */
  type: 'ocr_processing';
  /** Current job state (waiting, active, completed, failed, delayed, paused) */
  status: Bull.JobStatus;
  /** Processing progress percentage (0-100) */
  progress: number;
  /** Original job data */
  data: OCRProcessingJob;
  /** Job result (if completed) */
  result: unknown | null;
  /** Error message (if failed) */
  error: string | null;
  /** Number of retry attempts made */
  attemptsMade: number;
  /** Total retry attempts allowed */
  attemptsTotal: number | undefined;
  /** When the job was created */
  createdAt: Date;
  /** When processing started */
  startedAt: Date | undefined;
  /** When processing completed */
  completedAt: Date | undefined;
}

/**
 * Global error handlers to prevent OCR worker crashes from taking down the server
 * These are safety nets - errors should be caught in the job processor
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection in OCR queue context:', { reason, promise });
  // Don't exit - let the queue handle job failure
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception in OCR queue context:', error);
  // For OCR-related errors, don't crash the process
  if (
    error.message?.includes('tesseract') ||
    error.message?.includes('OCR') ||
    error.message?.includes('image') ||
    error.message?.includes('sharp')
  ) {
    logger.warn('OCR-related uncaught exception - process will continue');
    return;
  }
  // For other critical errors, log but let pm2/docker restart
  logger.error('Critical uncaught exception - process may become unstable');
});

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

// Redis configuration from shared utility
const redisConfig = getRedisConfig();

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
    defaultJobOptions: ocrJobOptions,
    settings: defaultBullSettings,
  });

  ocrQueue.on('error', (error) => {
    logger.error('OCR queue error:', error);
    ocrQueueAvailable = false;

    // Check Redis health to provide more context (using static import)
    try {
      if (!isRedisHealthy()) {
        logger.error('Queue error likely due to Redis connection loss');
      }
    } catch (healthCheckError) {
      logger.warn('Failed to check Redis health:', healthCheckError);
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
 * Process OCR jobs with configurable concurrency
 */
if (ocrQueue) {
  ocrQueue.process(OCR_QUEUE_CONFIG.CONCURRENCY, async (job) => {
    const { documentId, userId, filePath, options } = job.data;
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

      // Determine file type from extension (handle both paths and URLs with query strings)
      let fileExt: string;
      try {
        // For URLs, parse and get pathname to avoid query string issues
        const url = new URL(filePath);
        fileExt = path.extname(url.pathname).toLowerCase();
      } catch {
        // Not a valid URL, treat as file path
        fileExt = path.extname(filePath).toLowerCase();
      }
      const isImage = IMAGE_EXTENSIONS.includes(fileExt);

      logger.info(`Processing ${isImage ? 'image' : 'PDF'} file`, { documentId, fileExt });

      // Process with appropriate method based on file type
      let ocrResult;
      if (isImage) {
        // Images don't support progress callbacks
        ocrResult = await ocrService.processImage(filePath);
      } else {
        // PDFs support progress callbacks
        ocrResult = await ocrService.processPDF(filePath, (progress: OCRProgress) => {
          // Map OCR progress (0-100) to job progress (10-90)
          const progressPercent = 10 + progress.progress * 0.8;
          job.progress(progressPercent);

          // Send progress to specific user only (security: prevents data leakage to other users)
          if (userId) {
            realtimeService.sendToUser(userId, 'queue_progress', {
              jobId: job.id,
              documentId,
              progress: progressPercent,
              stage: progress.stage,
              message: progress.message,
            });
          } else {
            logger.warn('No userId for realtime OCR progress event', { jobId: job.id, documentId });
          }

          logger.debug(`OCR Progress for ${documentId}: ${progress.stage} - ${progress.message}`);
        });
      }

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
        .catch((dbError: Error) => {
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
      confidence: result.confidence,
      pageCount: result.pageCount,
    });

    // Send completion event to specific user only (security: prevents data leakage to other users)
    const userId = job.data.userId;
    if (userId) {
      realtimeService.sendToUser(userId, 'queue_completed', {
        jobId: job.id,
        documentId: result.documentId,
        result,
      });
    } else {
      logger.warn('No userId for realtime OCR completed event', { jobId: job.id });
    }
  });

  ocrQueue.on('failed', (job, err) => {
    logger.error(`OCR job ${job.id} failed:`, err);

    // Send failure event to specific user only (security: prevents data leakage to other users)
    const userId = job.data.userId;
    if (userId) {
      realtimeService.sendToUser(userId, 'queue_failed', {
        jobId: job.id,
        error: err.message,
      });
    } else {
      logger.warn('No userId for realtime OCR failed event', { jobId: job.id });
    }

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
export async function getOCRQueueHealth(): Promise<QueueHealthStatus> {
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
    isHealthy:
      active < OCR_QUEUE_CONFIG.HEALTH.MAX_ACTIVE_JOBS &&
      waiting < OCR_QUEUE_CONFIG.HEALTH.MAX_WAITING_JOBS,
  };
}

/**
 * Get OCR job status by ID
 */
export async function getOCRJobStatus(jobId: string): Promise<OCRJobStatus | null> {
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
    progress: job.progress() as number,
    data: job.data,
    result: job.returnvalue ?? null,
    error: job.failedReason ?? null,
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

    if (document && document.reprocessCount >= OCR_QUEUE_CONFIG.MAX_REPROCESS_ATTEMPTS) {
      throw new Error(
        `Maximum reprocessing attempts (${OCR_QUEUE_CONFIG.MAX_REPROCESS_ATTEMPTS}) reached for this document`
      );
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
          dpi: OCR_QUEUE_CONFIG.REPROCESSING_DPI,
          enhancedPreprocessing: true,
        },
      },
      {
        priority: OCR_QUEUE_CONFIG.REPROCESSING_PRIORITY,
        timeout: OCR_QUEUE_CONFIG.REPROCESSING_TIMEOUT_MS,
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
