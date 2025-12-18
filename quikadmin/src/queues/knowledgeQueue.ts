/**
 * Knowledge Processing Queue
 *
 * Bull queue for processing documents into the knowledge base.
 * Implements requirements from PRD Vector Search v2.0:
 * - REQ-EXT-005: Process documents asynchronously via Bull queue
 * - PERF-001: Memory-safe document processing with checkpointing
 *
 * Job Types:
 * - processDocument: Full document processing (extract -> chunk -> embed -> store)
 * - generateEmbeddings: Generate embeddings for existing chunks
 * - reprocessChunks: Reprocess specific chunks (e.g., after model update)
 *
 * Features:
 * - Progress reporting with percentage updates
 * - Checkpointing for recovery after failures
 * - Retry with exponential backoff
 * - Configurable timeout (10 minutes default)
 * - Concurrent processing limit (2 per worker)
 *
 * @module queues/knowledgeQueue
 */

import Bull, { Job, Queue, JobOptions } from 'bull';
import { logger } from '../utils/logger';
import { config } from '../config';
import { QueueUnavailableError } from '../utils/QueueUnavailableError';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type KnowledgeJobType = 'processDocument' | 'generateEmbeddings' | 'reprocessChunks';

export interface BaseKnowledgeJob {
  type: KnowledgeJobType;
  organizationId: string;
  userId: string;
  priority?: 'high' | 'normal' | 'low';
  metadata?: Record<string, unknown>;
}

export interface ProcessDocumentJob extends BaseKnowledgeJob {
  type: 'processDocument';
  sourceId: string;
  documentId?: string;
  filePath: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  options?: {
    chunkingStrategy?: 'semantic' | 'fixed' | 'hybrid';
    targetChunkSize?: number;
    ocrEnabled?: boolean;
    language?: string;
    skipEmbeddings?: boolean;
  };
}

export interface GenerateEmbeddingsJob extends BaseKnowledgeJob {
  type: 'generateEmbeddings';
  sourceId: string;
  chunkIds?: string[];
  batchSize?: number;
  force?: boolean;
}

export interface ReprocessChunksJob extends BaseKnowledgeJob {
  type: 'reprocessChunks';
  sourceId: string;
  chunkIds: string[];
  reason: string;
  newConfig?: {
    chunkingStrategy?: 'semantic' | 'fixed' | 'hybrid';
    targetChunkSize?: number;
  };
}

export type KnowledgeJob = ProcessDocumentJob | GenerateEmbeddingsJob | ReprocessChunksJob;

export interface JobProgress {
  stage: 'extraction' | 'chunking' | 'embedding' | 'storage' | 'complete' | 'failed';
  percentage: number;
  currentStep: string;
  details?: {
    pagesProcessed?: number;
    totalPages?: number;
    chunksProcessed?: number;
    totalChunks?: number;
    embeddingsGenerated?: number;
    chunksStored?: number;
    errorMessage?: string;
  };
}

export interface ProcessingCheckpoint {
  sourceId: string;
  stage: JobProgress['stage'];
  lastCompletedChunkIndex: number;
  totalChunks: number;
  extractedText?: string;
  chunksJson?: string;
  startedAt: Date;
  lastUpdatedAt: Date;
}

export interface KnowledgeJobResult {
  success: boolean;
  sourceId: string;
  organizationId: string;
  processingTimeMs: number;
  stats: {
    pagesProcessed: number;
    chunksCreated: number;
    embeddingsGenerated: number;
    chunksStored: number;
    duplicatesSkipped: number;
  };
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const QUEUE_NAME = 'knowledge-processing';
const DEFAULT_JOB_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF_DELAY = 5000;
const MAX_CONCURRENT_JOBS = 2;

const PRIORITY_MAP: Record<string, number> = {
  high: 1,
  normal: 5,
  low: 10,
};

// ============================================================================
// Redis Configuration
// ============================================================================

const redisConfig = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: 3,
};

// ============================================================================
// Queue Instance
// ============================================================================

let knowledgeQueueAvailable = false;

let knowledgeQueue: Queue<KnowledgeJob> | null = null;
try {
  knowledgeQueue = new Bull<KnowledgeJob>(QUEUE_NAME, {
    redis: redisConfig,
    defaultJobOptions: {
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 50, // Keep last 50 failed jobs
      attempts: DEFAULT_ATTEMPTS,
      timeout: DEFAULT_JOB_TIMEOUT,
      backoff: {
        type: 'exponential',
        delay: DEFAULT_BACKOFF_DELAY,
      },
    },
    settings: {
      stalledInterval: 60000, // Check for stalled jobs every minute
      maxStalledCount: 2, // Jobs can be stalled twice before failing
      lockDuration: 300000, // Lock jobs for 5 minutes
      lockRenewTime: 150000, // Renew lock every 2.5 minutes
    },
    limiter: {
      max: MAX_CONCURRENT_JOBS,
      duration: 1000,
    },
  });

  knowledgeQueue.on('error', (error) => {
    logger.error('Knowledge queue error', { error: error.message });
    knowledgeQueueAvailable = false;
  });

  knowledgeQueue.on('ready', () => {
    logger.info('Knowledge queue ready');
    knowledgeQueueAvailable = true;
  });

  knowledgeQueueAvailable = true;
} catch (error) {
  logger.warn('Knowledge queue initialization failed - Redis may be unavailable:', error);
  knowledgeQueueAvailable = false;
}

/**
 * Check if knowledge queue is available
 */
export function isKnowledgeQueueAvailable(): boolean {
  return knowledgeQueueAvailable && knowledgeQueue !== null;
}

// ============================================================================
// Queue Event Handlers
// ============================================================================

if (knowledgeQueue) {
  knowledgeQueue.on('waiting', (jobId) => {
    logger.debug('Knowledge job waiting', { jobId });
  });

  knowledgeQueue.on('active', (job) => {
    logger.info('Knowledge job started', {
      jobId: job.id,
      type: job.data.type,
      sourceId: 'sourceId' in job.data ? job.data.sourceId : undefined,
      organizationId: job.data.organizationId,
    });
  });

  knowledgeQueue.on('completed', (job, result: KnowledgeJobResult) => {
    logger.info('Knowledge job completed', {
      jobId: job.id,
      type: job.data.type,
      sourceId: 'sourceId' in job.data ? job.data.sourceId : undefined,
      processingTimeMs: result.processingTimeMs,
      stats: result.stats,
    });
  });

  knowledgeQueue.on('failed', (job, error) => {
    logger.error('Knowledge job failed', {
      jobId: job.id,
      type: job.data.type,
      sourceId: 'sourceId' in job.data ? job.data.sourceId : undefined,
      organizationId: job.data.organizationId,
      error: error.message,
      attemptsMade: job.attemptsMade,
    });
  });

  knowledgeQueue.on('stalled', (job) => {
    logger.warn('Knowledge job stalled', {
      jobId: job.id,
      type: job.data.type,
      sourceId: 'sourceId' in job.data ? job.data.sourceId : undefined,
    });
  });

  knowledgeQueue.on('progress', (job, progress: JobProgress) => {
    logger.debug('Knowledge job progress', {
      jobId: job.id,
      stage: progress.stage,
      percentage: progress.percentage,
      currentStep: progress.currentStep,
    });
  });
}

// ============================================================================
// Job Submission Functions
// ============================================================================

/**
 * Add a document processing job to the queue
 *
 * @param data - Job data
 * @param options - Optional job options
 * @returns The created job
 */
export async function addProcessDocumentJob(
  data: Omit<ProcessDocumentJob, 'type'>,
  options?: Partial<JobOptions>
): Promise<Job<ProcessDocumentJob>> {
  if (!isKnowledgeQueueAvailable()) {
    throw new QueueUnavailableError('knowledge-processing');
  }

  const jobData: ProcessDocumentJob = {
    ...data,
    type: 'processDocument',
  };

  const jobOptions: JobOptions = {
    priority: PRIORITY_MAP[data.priority || 'normal'],
    ...options,
  };

  const job = await knowledgeQueue!.add(jobData, jobOptions);

  logger.info('Document processing job queued', {
    jobId: job.id,
    sourceId: data.sourceId,
    filename: data.filename,
    organizationId: data.organizationId,
    priority: data.priority || 'normal',
  });

  return job as Job<ProcessDocumentJob>;
}

/**
 * Add an embedding generation job to the queue
 *
 * @param data - Job data
 * @param options - Optional job options
 * @returns The created job
 */
export async function addGenerateEmbeddingsJob(
  data: Omit<GenerateEmbeddingsJob, 'type'>,
  options?: Partial<JobOptions>
): Promise<Job<GenerateEmbeddingsJob>> {
  if (!isKnowledgeQueueAvailable()) {
    throw new QueueUnavailableError('knowledge-processing');
  }

  const jobData: GenerateEmbeddingsJob = {
    ...data,
    type: 'generateEmbeddings',
  };

  const jobOptions: JobOptions = {
    priority: PRIORITY_MAP[data.priority || 'normal'],
    ...options,
  };

  const job = await knowledgeQueue!.add(jobData, jobOptions);

  logger.info('Embedding generation job queued', {
    jobId: job.id,
    sourceId: data.sourceId,
    chunkCount: data.chunkIds?.length || 'all',
    organizationId: data.organizationId,
  });

  return job as Job<GenerateEmbeddingsJob>;
}

/**
 * Add a chunk reprocessing job to the queue
 *
 * @param data - Job data
 * @param options - Optional job options
 * @returns The created job
 */
export async function addReprocessChunksJob(
  data: Omit<ReprocessChunksJob, 'type'>,
  options?: Partial<JobOptions>
): Promise<Job<ReprocessChunksJob>> {
  if (!isKnowledgeQueueAvailable()) {
    throw new QueueUnavailableError('knowledge-processing');
  }

  const jobData: ReprocessChunksJob = {
    ...data,
    type: 'reprocessChunks',
  };

  const jobOptions: JobOptions = {
    priority: PRIORITY_MAP[data.priority || 'low'],
    ...options,
  };

  const job = await knowledgeQueue!.add(jobData, jobOptions);

  logger.info('Chunk reprocessing job queued', {
    jobId: job.id,
    sourceId: data.sourceId,
    chunkIds: data.chunkIds,
    reason: data.reason,
    organizationId: data.organizationId,
  });

  return job as Job<ReprocessChunksJob>;
}

// ============================================================================
// Progress Reporting
// ============================================================================

/**
 * Report job progress
 * Updates the job's progress field and emits progress event
 *
 * @param job - The Bull job
 * @param progress - Progress information
 */
export async function reportProgress(job: Job<KnowledgeJob>, progress: JobProgress): Promise<void> {
  await job.progress(progress);

  logger.debug('Job progress updated', {
    jobId: job.id,
    stage: progress.stage,
    percentage: progress.percentage,
    currentStep: progress.currentStep,
    details: progress.details,
  });
}

/**
 * Create a progress reporter helper for a job
 */
export function createProgressReporter(job: Job<KnowledgeJob>) {
  return {
    extraction(percentage: number, pagesProcessed: number, totalPages: number) {
      return reportProgress(job, {
        stage: 'extraction',
        percentage: Math.min(25, percentage * 0.25),
        currentStep: `Extracting text from page ${pagesProcessed}/${totalPages}`,
        details: { pagesProcessed, totalPages },
      });
    },

    chunking(percentage: number, chunksCreated: number) {
      return reportProgress(job, {
        stage: 'chunking',
        percentage: 25 + Math.min(25, percentage * 0.25),
        currentStep: `Creating chunks: ${chunksCreated} created`,
        details: { chunksProcessed: chunksCreated },
      });
    },

    embedding(percentage: number, embeddingsGenerated: number, totalChunks: number) {
      return reportProgress(job, {
        stage: 'embedding',
        percentage: 50 + Math.min(25, percentage * 0.25),
        currentStep: `Generating embeddings: ${embeddingsGenerated}/${totalChunks}`,
        details: { embeddingsGenerated, totalChunks },
      });
    },

    storage(percentage: number, chunksStored: number, totalChunks: number) {
      return reportProgress(job, {
        stage: 'storage',
        percentage: 75 + Math.min(25, percentage * 0.25),
        currentStep: `Storing chunks: ${chunksStored}/${totalChunks}`,
        details: { chunksStored, totalChunks },
      });
    },

    complete(stats: KnowledgeJobResult['stats']) {
      return reportProgress(job, {
        stage: 'complete',
        percentage: 100,
        currentStep: 'Processing complete',
        details: {
          chunksProcessed: stats.chunksCreated,
          embeddingsGenerated: stats.embeddingsGenerated,
          chunksStored: stats.chunksStored,
        },
      });
    },

    failed(errorMessage: string) {
      return reportProgress(job, {
        stage: 'failed',
        percentage: job.progress()?.percentage || 0,
        currentStep: 'Processing failed',
        details: { errorMessage },
      });
    },
  };
}

// ============================================================================
// Queue Status & Management
// ============================================================================

/**
 * Get knowledge queue health status
 */
export async function getQueueHealth(): Promise<{
  queue: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  isHealthy: boolean;
}> {
  if (!isKnowledgeQueueAvailable()) {
    throw new QueueUnavailableError('knowledge-processing');
  }

  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    knowledgeQueue!.getWaitingCount(),
    knowledgeQueue!.getActiveCount(),
    knowledgeQueue!.getCompletedCount(),
    knowledgeQueue!.getFailedCount(),
    knowledgeQueue!.getDelayedCount(),
    knowledgeQueue!.isPaused(),
  ]);

  const isHealthy = active < MAX_CONCURRENT_JOBS * 2 && waiting < 100 && !paused;

  return {
    queue: QUEUE_NAME,
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
    isHealthy,
  };
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string): Promise<Job<KnowledgeJob> | null> {
  if (!isKnowledgeQueueAvailable()) {
    throw new QueueUnavailableError('knowledge-processing');
  }
  return knowledgeQueue!.getJob(jobId);
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string): Promise<{
  id: string;
  type: KnowledgeJobType;
  status: string;
  progress: JobProgress | null;
  attemptsMade: number;
  processedOn?: Date;
  finishedOn?: Date;
  failedReason?: string;
} | null> {
  if (!isKnowledgeQueueAvailable()) {
    throw new QueueUnavailableError('knowledge-processing');
  }

  const job = await knowledgeQueue!.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();

  return {
    id: String(job.id),
    type: job.data.type,
    status: state,
    progress: job.progress() as JobProgress | null,
    attemptsMade: job.attemptsMade,
    processedOn: job.processedOn ? new Date(job.processedOn) : undefined,
    finishedOn: job.finishedOn ? new Date(job.finishedOn) : undefined,
    failedReason: job.failedReason,
  };
}

/**
 * Get pending jobs for an organization
 */
export async function getOrganizationJobs(
  organizationId: string,
  status?: 'waiting' | 'active' | 'completed' | 'failed'
): Promise<Job<KnowledgeJob>[]> {
  if (!isKnowledgeQueueAvailable()) {
    throw new QueueUnavailableError('knowledge-processing');
  }

  let jobs: Job<KnowledgeJob>[];

  switch (status) {
    case 'waiting':
      jobs = await knowledgeQueue!.getWaiting();
      break;
    case 'active':
      jobs = await knowledgeQueue!.getActive();
      break;
    case 'completed':
      jobs = await knowledgeQueue!.getCompleted(0, 50);
      break;
    case 'failed':
      jobs = await knowledgeQueue!.getFailed(0, 50);
      break;
    default: {
      const [waiting, active] = await Promise.all([
        knowledgeQueue!.getWaiting(),
        knowledgeQueue!.getActive(),
      ]);
      jobs = [...waiting, ...active];
    }
  }

  return jobs.filter((job) => job.data.organizationId === organizationId);
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  if (!isKnowledgeQueueAvailable()) {
    throw new QueueUnavailableError('knowledge-processing');
  }

  const job = await knowledgeQueue!.getJob(jobId);

  if (!job) {
    return false;
  }

  const state = await job.getState();

  if (state === 'active') {
    // Can't cancel active jobs, but we can mark them for cancellation
    logger.warn('Cannot cancel active job', { jobId });
    return false;
  }

  await job.remove();
  logger.info('Job cancelled', { jobId });
  return true;
}

/**
 * Retry a failed job
 */
export async function retryJob(jobId: string): Promise<boolean> {
  if (!isKnowledgeQueueAvailable()) {
    throw new QueueUnavailableError('knowledge-processing');
  }

  const job = await knowledgeQueue!.getJob(jobId);

  if (!job) {
    return false;
  }

  const state = await job.getState();

  if (state !== 'failed') {
    return false;
  }

  await job.retry();
  logger.info('Job retried', { jobId });
  return true;
}

/**
 * Pause the queue
 */
export async function pauseQueue(): Promise<void> {
  if (!isKnowledgeQueueAvailable()) {
    throw new QueueUnavailableError('knowledge-processing');
  }

  await knowledgeQueue!.pause();
  logger.info('Knowledge queue paused');
}

/**
 * Resume the queue
 */
export async function resumeQueue(): Promise<void> {
  if (!isKnowledgeQueueAvailable()) {
    throw new QueueUnavailableError('knowledge-processing');
  }

  await knowledgeQueue!.resume();
  logger.info('Knowledge queue resumed');
}

/**
 * Clean up old jobs
 */
export async function cleanQueue(
  gracePeriodMs: number = 24 * 60 * 60 * 1000 // 24 hours
): Promise<{ completed: number; failed: number }> {
  if (!isKnowledgeQueueAvailable()) {
    throw new QueueUnavailableError('knowledge-processing');
  }

  const [completed, failed] = await Promise.all([
    knowledgeQueue!.clean(gracePeriodMs, 'completed'),
    knowledgeQueue!.clean(gracePeriodMs, 'failed'),
  ]);

  logger.info('Knowledge queue cleaned', {
    completedRemoved: completed.length,
    failedRemoved: failed.length,
  });

  return {
    completed: completed.length,
    failed: failed.length,
  };
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

let isShuttingDown = false;

/**
 * Gracefully close the queue
 */
export async function closeQueue(): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info('Closing knowledge queue...');

  if (knowledgeQueue) {
    try {
      await knowledgeQueue.close();
      logger.info('Knowledge queue closed');
    } catch (error) {
      logger.error('Error closing knowledge queue', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Register shutdown handler
process.on('SIGTERM', closeQueue);
process.on('SIGINT', closeQueue);

// Export queue instance (may be null if Redis unavailable)
export { knowledgeQueue };
export default knowledgeQueue;
