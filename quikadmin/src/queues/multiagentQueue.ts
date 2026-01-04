/**
 * BullMQ Multi-Agent Processing Queue
 *
 * Handles high-complexity document processing jobs using the LangGraph
 * multi-agent pipeline. Runs alongside (not replacing) the legacy Bull queue.
 *
 * Features:
 * - BullMQ v5 for improved performance and reliability
 * - Separate queue from legacy OCR processing
 * - Concurrency limits based on VRAM availability
 * - Advanced retry strategies with exponential backoff
 * - Progress tracking and realtime updates
 *
 * Queue Names:
 * - multiagent-processing: Main processing queue
 * - multiagent-results: Completed job results (for comparison)
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { realtimeService } from '../services/RealtimeService';
import { prisma } from '../utils/prisma';
import { QueueUnavailableError } from '../utils/QueueUnavailableError';
import { processDocument } from '../multiagent';
import { getRedisConnectionConfig } from '../utils/redisConfig';

/**
 * Job data interface for multi-agent processing
 */
export interface MultiAgentProcessingJob {
  documentId: string;
  userId: string;
  filePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  priority?: number;
  isShadowMode?: boolean;
  abTestVariant?: 'CONTROL' | 'TREATMENT';
  options?: {
    maxRetries?: number;
    timeoutMs?: number;
    models?: {
      classifier?: string;
      extractor?: string;
      mapper?: string;
      qa?: string;
    };
  };
}

/**
 * Job result interface
 */
export interface MultiAgentProcessingResult {
  documentId: string;
  success: boolean;
  extractedData?: Record<string, unknown>;
  confidence?: number;
  processingTimeMs: number;
  agentMetrics?: Array<{
    agent: string;
    model: string;
    processingTimeMs: number;
    success: boolean;
  }>;
  error?: string;
}

// Redis configuration from shared utility (BullMQ requires object format)
const redisConfig = getRedisConnectionConfig();

/**
 * Queue availability flag
 */
let multiagentQueueAvailable = false;

/**
 * Multi-agent processing queue
 */
let multiagentQueue: Queue<MultiAgentProcessingJob, MultiAgentProcessingResult> | null = null;

/**
 * Multi-agent processing worker
 */
let multiagentWorker: Worker<MultiAgentProcessingJob, MultiAgentProcessingResult> | null = null;

/**
 * Queue events for monitoring
 */
let queueEvents: QueueEvents | null = null;

/**
 * Initialize the multi-agent queue
 */
export async function initializeMultiagentQueue(): Promise<boolean> {
  try {
    // Create queue with BullMQ
    multiagentQueue = new Queue<MultiAgentProcessingJob, MultiAgentProcessingResult>(
      'multiagent-processing',
      {
        connection: redisConfig,
        defaultJobOptions: {
          removeOnComplete: {
            age: 3600 * 24, // Keep for 24 hours
            count: 1000, // Keep last 1000
          },
          removeOnFail: {
            age: 3600 * 24 * 7, // Keep failed for 7 days
            count: 500,
          },
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000, // Start with 5s, then 25s, 125s
          },
        },
      }
    );

    // Create queue events for monitoring
    queueEvents = new QueueEvents('multiagent-processing', {
      connection: redisConfig,
    });

    // Wait for queue to be ready
    await multiagentQueue.waitUntilReady();

    multiagentQueueAvailable = true;
    logger.info('Multi-agent queue initialized successfully');

    return true;
  } catch (error) {
    logger.error('Failed to initialize multi-agent queue', { error });
    multiagentQueueAvailable = false;
    return false;
  }
}

/**
 * Check if multi-agent queue is available
 */
export function isMultiagentQueueAvailable(): boolean {
  return multiagentQueueAvailable && multiagentQueue !== null;
}

/**
 * Get the multi-agent queue instance
 */
export function getMultiagentQueue(): Queue<MultiAgentProcessingJob, MultiAgentProcessingResult> {
  if (!isMultiagentQueueAvailable()) {
    throw new QueueUnavailableError('multiagent-processing');
  }
  return multiagentQueue!;
}

/**
 * Add a document to the multi-agent processing queue
 */
export async function enqueueMultiagentProcessing(
  job: MultiAgentProcessingJob
): Promise<Job<MultiAgentProcessingJob, MultiAgentProcessingResult>> {
  if (!isMultiagentQueueAvailable()) {
    throw new QueueUnavailableError('multiagent-processing');
  }

  const jobId = `multiagent-${job.documentId}-${Date.now()}`;

  logger.info('Enqueueing document for multi-agent processing', {
    documentId: job.documentId,
    jobId,
    isShadowMode: job.isShadowMode,
    abTestVariant: job.abTestVariant,
  });

  // Create processing record in database
  try {
    await prisma.multiAgentProcessing.create({
      data: {
        documentId: job.documentId,
        userId: job.userId,
        jobId,
        status: 'PENDING',
        priority: job.priority || 0,
        metadata: {
          fileName: job.fileName,
          fileType: job.fileType,
          fileSize: job.fileSize,
          isShadowMode: job.isShadowMode,
          abTestVariant: job.abTestVariant,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to create multi-agent processing record', {
      documentId: job.documentId,
      error,
    });
  }

  // Add to queue
  const queuedJob = await multiagentQueue!.add('process-document', job, {
    jobId,
    priority: job.priority || 0,
    attempts: job.options?.maxRetries || 3,
  });

  return queuedJob;
}

/**
 * Get multi-agent queue health status
 */
export async function getMultiagentQueueHealth(): Promise<{
  queue: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  isHealthy: boolean;
}> {
  if (!isMultiagentQueueAvailable()) {
    throw new QueueUnavailableError('multiagent-processing');
  }

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    multiagentQueue!.getWaitingCount(),
    multiagentQueue!.getActiveCount(),
    multiagentQueue!.getCompletedCount(),
    multiagentQueue!.getFailedCount(),
    multiagentQueue!.getDelayedCount(),
  ]);

  return {
    queue: 'multiagent-processing',
    waiting,
    active,
    completed,
    failed,
    delayed,
    isHealthy: active < 10 && waiting < 100, // Conservative limits
  };
}

/**
 * Get multi-agent job status by ID
 */
export async function getMultiagentJobStatus(jobId: string): Promise<{
  id: string;
  type: string;
  status: string;
  progress: number;
  data: MultiAgentProcessingJob | null;
  result: MultiAgentProcessingResult | null;
  error: string | null;
  attemptsMade: number;
  attemptsTotal: number;
  createdAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
} | null> {
  if (!isMultiagentQueueAvailable()) {
    throw new QueueUnavailableError('multiagent-processing');
  }

  const job = await multiagentQueue!.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();

  return {
    id: job.id || '',
    type: 'multiagent_processing',
    status: state,
    progress: job.progress as number,
    data: job.data,
    result: job.returnvalue,
    error: job.failedReason || null,
    attemptsMade: job.attemptsMade,
    attemptsTotal: job.opts.attempts || 3,
    createdAt: job.timestamp ? new Date(job.timestamp) : null,
    startedAt: job.processedOn ? new Date(job.processedOn) : null,
    completedAt: job.finishedOn ? new Date(job.finishedOn) : null,
  };
}

/**
 * Setup queue event handlers
 */
export function setupQueueEventHandlers(): void {
  if (!queueEvents) {
    logger.warn('Queue events not initialized');
    return;
  }

  queueEvents.on('completed', async ({ jobId, returnvalue }) => {
    logger.info('Multi-agent job completed', { jobId });

    try {
      // Parse the returnvalue (BullMQ stringifies the result)
      const result: MultiAgentProcessingResult | null = returnvalue
        ? typeof returnvalue === 'string'
          ? JSON.parse(returnvalue)
          : returnvalue
        : null;

      // Update database record
      await prisma.multiAgentProcessing.updateMany({
        where: { jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          extractedData: (result?.extractedData ?? null) as any,
          confidence: result?.confidence,
        },
      });

      // Get job data for realtime notification
      const job = await multiagentQueue?.getJob(jobId);
      if (job) {
        realtimeService.sendToUser(job.data.userId, 'multiagent_completed', {
          jobId,
          documentId: job.data.documentId,
          result: returnvalue,
        });
      }
    } catch (error) {
      logger.error('Failed to handle job completion', { jobId, error });
    }
  });

  queueEvents.on('failed', async ({ jobId, failedReason }) => {
    logger.error('Multi-agent job failed', { jobId, failedReason });

    try {
      // Update database record
      await prisma.multiAgentProcessing.updateMany({
        where: { jobId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          errorMessage: failedReason,
        },
      });

      // Get job data for realtime notification
      const job = await multiagentQueue?.getJob(jobId);
      if (job) {
        realtimeService.sendToUser(job.data.userId, 'multiagent_failed', {
          jobId,
          documentId: job.data.documentId,
          error: failedReason,
        });
      }
    } catch (error) {
      logger.error('Failed to handle job failure', { jobId, error });
    }
  });

  queueEvents.on('progress', async ({ jobId, data }) => {
    try {
      const job = await multiagentQueue?.getJob(jobId);
      if (job) {
        realtimeService.sendToUser(job.data.userId, 'multiagent_progress', {
          jobId,
          documentId: job.data.documentId,
          progress: data,
        });
      }
    } catch (error) {
      logger.error('Failed to handle job progress', { jobId, error });
    }
  });

  queueEvents.on('stalled', async ({ jobId }) => {
    logger.warn('Multi-agent job stalled', { jobId });

    try {
      await prisma.multiAgentProcessing.updateMany({
        where: { jobId },
        data: {
          status: 'PENDING',
          currentAgent: null,
        },
      });
    } catch (error) {
      logger.error('Failed to handle job stall', { jobId, error });
    }
  });

  logger.info('Queue event handlers set up');
}

/**
 * Start the multi-agent worker to process jobs
 * Should be called after initializeMultiagentQueue()
 */
export async function startMultiagentWorker(): Promise<void> {
  if (!isMultiagentQueueAvailable()) {
    logger.warn('Cannot start multi-agent worker - queue not available');
    return;
  }

  if (multiagentWorker) {
    logger.warn('Multi-agent worker already running');
    return;
  }

  multiagentWorker = new Worker<MultiAgentProcessingJob, MultiAgentProcessingResult>(
    'multiagent-processing',
    async (job: Job<MultiAgentProcessingJob, MultiAgentProcessingResult>) => {
      const { documentId, userId, filePath, fileName, fileType, fileSize } = job.data;
      const jobId = job.id || `job-${Date.now()}`;
      const startTime = Date.now();

      logger.info('Processing multi-agent job', { jobId, documentId, fileName });

      // Update document status to PROCESSING
      try {
        await prisma.document.update({
          where: { id: documentId },
          data: { status: 'PROCESSING' },
        });
      } catch (error) {
        logger.warn('Failed to update document status to PROCESSING', { documentId, error });
      }

      // Update processing record status - CLASSIFYING is the first active step
      try {
        await prisma.multiAgentProcessing.updateMany({
          where: { jobId },
          data: {
            status: 'CLASSIFYING',
            startedAt: new Date(),
          },
        });
      } catch (error) {
        logger.warn('Failed to update processing record status', { jobId, error });
      }

      try {
        // Execute LangGraph workflow
        const result = await processDocument(
          documentId,
          userId,
          jobId,
          filePath,
          fileName,
          fileType,
          fileSize
        );

        const processingTimeMs = Date.now() - startTime;

        // Update document with results
        const success = result.results?.success ?? false;
        const extractedData = result.results?.finalData ?? result.extractedFields ?? {};
        const confidence = result.results?.confidence?.overall ?? 0;

        try {
          await prisma.document.update({
            where: { id: documentId },
            data: {
              status: success ? 'COMPLETED' : 'FAILED',
              extractedData: extractedData as any,
              confidence,
              processedAt: new Date(),
            },
          });
        } catch (error) {
          logger.error('Failed to update document with results', { documentId, error });
        }

        logger.info('Multi-agent job completed', {
          jobId,
          documentId,
          success,
          confidence,
          processingTimeMs,
        });

        return {
          documentId,
          success,
          extractedData: extractedData as Record<string, unknown>,
          confidence,
          processingTimeMs,
          agentMetrics: result.agentHistory?.map((exec) => ({
            agent: exec.agent,
            model: exec.model || '',
            processingTimeMs:
              exec.endTime && exec.startTime
                ? new Date(exec.endTime).getTime() - new Date(exec.startTime).getTime()
                : 0,
            success: exec.status === 'completed',
          })),
        };
      } catch (error) {
        const processingTimeMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        logger.error('Multi-agent job failed', {
          jobId,
          documentId,
          error: errorMessage,
          processingTimeMs,
        });

        // Update document with error
        try {
          await prisma.document.update({
            where: { id: documentId },
            data: {
              status: 'FAILED',
              extractedData: { error: errorMessage },
            },
          });
        } catch (updateError) {
          logger.error('Failed to update document with error', { documentId, updateError });
        }

        throw error;
      }
    },
    {
      connection: redisConfig,
      concurrency: 2, // Limit based on VRAM availability
    }
  );

  // Add event handlers
  multiagentWorker.on('completed', (job, result) => {
    logger.info('Multi-agent worker: job completed', {
      jobId: job.id,
      documentId: result.documentId,
      success: result.success,
    });
  });

  multiagentWorker.on('failed', (job, error) => {
    logger.error('Multi-agent worker: job failed', {
      jobId: job?.id,
      error: error.message,
    });
  });

  multiagentWorker.on('error', (error) => {
    logger.error('Multi-agent worker error', { error: error.message });
  });

  logger.info('Multi-agent worker started', { concurrency: 2 });
}

/**
 * Stop the multi-agent worker
 */
export async function closeMultiagentWorker(): Promise<void> {
  if (multiagentWorker) {
    logger.info('Closing multi-agent worker...');
    await multiagentWorker.close();
    multiagentWorker = null;
    logger.info('Multi-agent worker closed');
  }
}

/**
 * Cleanup on shutdown
 */
export async function closeMultiagentQueue(): Promise<void> {
  logger.info('Shutting down multi-agent queue...');

  // Close worker first
  await closeMultiagentWorker();

  if (queueEvents) {
    await queueEvents.close();
    queueEvents = null;
  }

  if (multiagentQueue) {
    await multiagentQueue.close();
    multiagentQueue = null;
  }

  multiagentQueueAvailable = false;
  logger.info('Multi-agent queue closed');
}

// Handle process termination
process.on('SIGTERM', async () => {
  await closeMultiagentQueue();
});

process.on('SIGINT', async () => {
  await closeMultiagentQueue();
});

// Export queue instance getter
export { multiagentQueue };
