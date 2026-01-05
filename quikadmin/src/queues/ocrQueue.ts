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
import { validateOcrJobDataOrThrow, OCRValidationError } from '../utils/ocrJobValidation';

// Supported image extensions for OCR
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.tiff', '.tif', '.bmp', '.gif'];

/**
 * Parse and validate confidence threshold from environment
 * @param envValue - Raw environment variable value
 * @param defaultValue - Default if missing or invalid
 * @returns Validated threshold (0-100)
 */
function parseConfidenceThreshold(envValue: string | undefined, defaultValue: number): number {
  if (!envValue) return defaultValue;

  const parsed = parseFloat(envValue);

  if (isNaN(parsed)) {
    logger.warn(
      `Invalid OCR_LOW_CONFIDENCE_THRESHOLD value "${envValue}" - must be a number. Using default: ${defaultValue}`
    );
    return defaultValue;
  }

  if (parsed < 0 || parsed > 100) {
    logger.warn(
      `OCR_LOW_CONFIDENCE_THRESHOLD ${parsed} out of range (0-100). Using default: ${defaultValue}`
    );
    return defaultValue;
  }

  return parsed;
}

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

  /**
   * Low confidence threshold for logging (REQ-003, REQ-004)
   * Documents below this confidence % will be logged for monitoring
   * Default: 40% (configurable via OCR_LOW_CONFIDENCE_THRESHOLD env var)
   * Valid range: 0-100 (validated at startup with fallback to default)
   */
  LOW_CONFIDENCE_THRESHOLD: parseConfidenceThreshold(process.env.OCR_LOW_CONFIDENCE_THRESHOLD, 40),

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
 * Safe job data - sensitive fields removed for API responses
 *
 * filePath is intentionally omitted to prevent information disclosure
 */
export interface SafeOCRJobData {
  /** Document identifier */
  documentId: string;
  /** Whether this is a reprocessing job */
  isReprocessing?: boolean;
  /** Reason for reprocessing (if applicable) */
  reprocessReason?: string;
}

/**
 * OCR job status interface
 *
 * Represents the current state of an individual OCR processing job
 * for status queries and progress tracking.
 *
 * Note: Sensitive fields like filePath are removed from data property
 * to prevent information disclosure.
 */
export interface OCRJobStatus {
  /** Unique job identifier */
  id: Bull.JobId;
  /** Job type identifier */
  type: 'ocr_processing';
  /** Current job state (waiting, active, completed, failed, delayed, paused, stuck) */
  status: Bull.JobStatus | 'stuck';
  /** Processing progress percentage (0-100) */
  progress: number;
  /** Sanitized job data (sensitive fields removed) */
  data: SafeOCRJobData;
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
 *
 * Uses try-finally pattern to ensure OCR service resources (Tesseract workers,
 * temporary files) are always cleaned up, regardless of success or failure.
 */
if (ocrQueue) {
  ocrQueue.process(OCR_QUEUE_CONFIG.CONCURRENCY, async (job) => {
    const { documentId, userId, filePath } = job.data;
    const startTime = Date.now();

    // OCR service instance - declared outside try block for finally access
    let ocrService: OCRService | null = null;

    try {
      // Defensive validation at processor level (secondary defense layer)
      try {
        validateOcrJobDataOrThrow({ documentId, userId, filePath });
      } catch (validationError) {
        if (validationError instanceof OCRValidationError) {
          logger.error('OCR job validation failed in processor', {
            jobId: job.id,
            documentId,
            error: validationError.message,
            code: validationError.code,
          });
          throw new Error(`Validation failed: ${validationError.message}`);
        }
        throw validationError;
      }

      logger.info(`Starting OCR processing for document ${documentId}`);

      // Update document status to PROCESSING
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'PROCESSING' },
      });

      await job.progress(5);

      // Initialize OCR service
      ocrService = new OCRService();
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

      // REQ-003: Low-confidence OCR logging for monitoring
      // Logs documents with confidence below threshold for orientation issue detection
      if (ocrResult.confidence < OCR_QUEUE_CONFIG.LOW_CONFIDENCE_THRESHOLD) {
        logger.warn('LOW_CONFIDENCE_OCR', {
          documentId,
          confidence: ocrResult.confidence,
          threshold: OCR_QUEUE_CONFIG.LOW_CONFIDENCE_THRESHOLD,
          fileType: isImage ? 'image' : 'scanned_pdf',
          storageUrl: filePath.length > 50 ? filePath.slice(0, 50) + '...' : filePath,
          wasConvertedFromPdf: !isImage,
          pageCount: ocrResult.metadata?.pageCount || 1,
          timestamp: new Date().toISOString(),
        });
      }

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
    } finally {
      // ALWAYS cleanup OCR service resources (Tesseract workers, temp files)
      // This prevents memory leaks regardless of success or failure
      if (ocrService) {
        try {
          await ocrService.cleanup();
          logger.debug(`OCR service cleanup completed for document ${documentId}`);
        } catch (cleanupError) {
          // Log cleanup failures as warnings - don't mask the original error
          logger.warn(`OCR service cleanup failed for document ${documentId}`, {
            error: cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup error',
          });
        }
      }
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
 * Generate a deterministic job ID for deduplication
 *
 * @param documentId - The document ID
 * @param isReprocessing - Whether this is a reprocessing request
 * @returns A unique job ID in format: ocr-{documentId} or ocr-reprocess-{documentId}
 */
function generateJobId(documentId: string, isReprocessing: boolean = false): string {
  return isReprocessing ? `ocr-reprocess-${documentId}` : `ocr-${documentId}`;
}

/**
 * Helper function to enqueue a document for OCR processing
 * Automatically detects if PDF is scanned and needs OCR
 *
 * Uses deterministic job IDs for deduplication - if a job for the same
 * document is already in the queue, returns the existing job instead
 * of creating a duplicate.
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

  // Validate input data before enqueueing (primary defense layer)
  validateOcrJobDataOrThrow({ documentId, userId, filePath });

  try {
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

    // Check if PDF needs OCR (only for PDFs, images always need OCR)
    if (!forceOCR && !isImage) {
      const detectionService = new DocumentDetectionService();
      const isScanned = await detectionService.isScannedPDF(filePath);

      if (!isScanned) {
        logger.info(`Document ${documentId} is text-based, skipping OCR`);
        return null; // No OCR needed
      }
    }

    // Images always need OCR
    if (isImage) {
      logger.info(`Document ${documentId} is an image, OCR required`, { fileExt });
    }

    // Generate deterministic job ID for deduplication
    const jobId = generateJobId(documentId);

    // Check if job already exists (deduplication)
    const existingJob = await ocrQueue!.getJob(jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      // Only deduplicate if job is still pending or active
      if (state === 'waiting' || state === 'active' || state === 'delayed') {
        logger.info(
          `Duplicate OCR job detected for document ${documentId}, returning existing job`,
          {
            jobId,
            state,
            documentId,
          }
        );
        return existingJob;
      }
      // Job completed or failed - allow new job to be created
      logger.debug(`Previous job ${jobId} is in state ${state}, allowing new job`);
    }

    logger.info(`Enqueueing document ${documentId} for OCR processing`);

    const job = await ocrQueue!.add(
      {
        documentId,
        userId,
        filePath,
        options: {},
      },
      {
        jobId, // Deterministic job ID for deduplication
      }
    );

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
 * Get OCR job status by ID with ownership verification
 *
 * This function implements IDOR protection by verifying that the requesting
 * user owns the job before returning its status. Sensitive fields like
 * filePath are stripped from the response.
 *
 * @param jobId - The job ID to query
 * @param requestingUserId - The ID of the user making the request (for ownership check)
 * @returns Job status if found and owned by the requester, null otherwise
 */
export async function getOCRJobStatus(
  jobId: string,
  requestingUserId: string
): Promise<OCRJobStatus | null> {
  if (!isOCRQueueAvailable()) {
    throw new QueueUnavailableError('ocr-processing');
  }

  const job = await ocrQueue!.getJob(jobId);

  if (!job) {
    return null;
  }

  // IDOR Protection: Verify the requesting user owns this job
  // Returns null to prevent enumeration attacks (don't reveal if job exists)
  if (job.data.userId !== requestingUserId) {
    logger.warn("IDOR attempt blocked: User tried to access another user's job", {
      jobId,
      requestingUserId,
      jobOwnerId: job.data.userId?.substring(0, 8) + '...',
    });
    return null;
  }

  const state = await job.getState();

  // Sanitize job data: Remove sensitive fields (filePath, userId, options)
  const safeData: SafeOCRJobData = {
    documentId: job.data.documentId,
    isReprocessing: job.data.isReprocessing,
    reprocessReason: job.data.reprocessReason,
  };

  return {
    id: job.id,
    type: 'ocr_processing',
    status: state,
    progress: job.progress() as number,
    data: safeData,
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
 * Graceful shutdown handler for OCR queue
 *
 * Handles both SIGTERM (Docker/Kubernetes) and SIGINT (Ctrl+C development).
 * Uses a timeout to prevent hung processes from blocking shutdown.
 */
const SHUTDOWN_TIMEOUT_MS = 10000; // 10 seconds
let isShuttingDown = false;

async function handleGracefulShutdown(signal: string): Promise<void> {
  // Prevent multiple concurrent shutdown attempts
  if (isShuttingDown) {
    logger.debug(`Shutdown already in progress, ignoring ${signal}`);
    return;
  }
  isShuttingDown = true;

  logger.info(`Initiating graceful OCR queue shutdown (${signal} received)...`);

  if (!ocrQueue) {
    logger.info('OCR queue not initialized, nothing to clean up');
    return;
  }

  try {
    // Race queue.close() against timeout
    const closePromise = ocrQueue.close();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Queue close timeout')), SHUTDOWN_TIMEOUT_MS)
    );

    await Promise.race([closePromise, timeoutPromise]);
    logger.info('OCR queue closed successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Queue close timeout') {
      logger.warn(
        `OCR queue failed to close within ${SHUTDOWN_TIMEOUT_MS / 1000}s timeout. Forcing exit.`
      );
    } else {
      logger.error('Error during OCR queue shutdown:', error);
    }
  }
}

// Handle both termination signals
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

/**
 * Enqueue document for reprocessing with enhanced settings
 *
 * Uses deterministic job IDs for deduplication - if a reprocessing job
 * for the same document is already in the queue, returns the existing job.
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

  // Validate input data before enqueueing (primary defense layer)
  validateOcrJobDataOrThrow({ documentId, userId, filePath });

  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { reprocessCount: true },
    });

    // Verify document exists before proceeding with reprocessing
    if (!document) {
      throw new Error(
        `Document not found: ${documentId}. Cannot reprocess a non-existent document.`
      );
    }

    if (document.reprocessCount >= OCR_QUEUE_CONFIG.MAX_REPROCESS_ATTEMPTS) {
      throw new Error(
        `Maximum reprocessing attempts (${OCR_QUEUE_CONFIG.MAX_REPROCESS_ATTEMPTS}) reached for this document`
      );
    }

    // Generate deterministic job ID for deduplication (reprocessing uses different prefix)
    const jobId = generateJobId(documentId, true);

    // Check if reprocessing job already exists (deduplication)
    const existingJob = await ocrQueue!.getJob(jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      // Only deduplicate if job is still pending or active
      if (state === 'waiting' || state === 'active' || state === 'delayed') {
        logger.info(
          `Duplicate reprocessing job detected for document ${documentId}, returning existing job`,
          {
            jobId,
            state,
            documentId,
          }
        );
        return existingJob;
      }
      // Job completed or failed - allow new job to be created
      logger.debug(`Previous reprocessing job ${jobId} is in state ${state}, allowing new job`);
    }

    logger.info('Enqueueing document for reprocessing', {
      documentId,
      attempt: document.reprocessCount + 1,
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
        jobId, // Deterministic job ID for deduplication
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

// Re-export validation utilities for consumers
export { OCRValidationError } from '../utils/ocrJobValidation';
