import Bull from 'bull';
import { logger } from '../utils/logger';
import { DocumentParser } from '../parsers/DocumentParser';
import { DataExtractor } from '../extractors/DataExtractor';
import { FieldMapper } from '../mappers/FieldMapper';
import { FormFiller } from '../fillers/FormFiller';
import { toJobStatusDTO } from '../dto/DocumentDTO';

// Job data interfaces
export interface DocumentProcessingJob {
  documentId: string;
  userId: string;
  filePath: string;
  options?: {
    extractTables?: boolean;
    ocrEnabled?: boolean;
    language?: string;
    confidenceThreshold?: number;
  };
}

export interface BatchProcessingJob {
  documentIds: string[];
  userId: string;
  targetFormId?: string;
  options?: {
    parallel?: boolean;
    stopOnError?: boolean;
  };
}

// Create queue with Redis connection
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD
};

// Document processing queue
export const documentQueue = new Bull<DocumentProcessingJob>('document-processing', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

// Batch processing queue
export const batchQueue = new Bull<BatchProcessingJob>('batch-processing', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 2
  }
});

// Process document jobs
documentQueue.process(async (job) => {
  const { documentId, filePath, options } = job.data;
  
  try {
    // Update progress
    await job.progress(10);
    logger.info(`Processing document ${documentId}`);

    // Initialize services (in production, these would be singleton instances)
    const parser = new DocumentParser();
    const extractor = new DataExtractor();
    const mapper = new FieldMapper();

    // Parse document
    await job.progress(30);
    const parsedContent = await parser.parse(filePath);

    // Extract data
    await job.progress(50);
    const extractedData = await extractor.extract(parsedContent);

    // Map fields
    await job.progress(70);
    const mappedFields = await mapper.mapFields(
      extractedData,
      [] // Default to empty array - target form fields would come from options
    );

    // Complete
    await job.progress(100);

    const result = {
      documentId,
      status: 'completed',
      extractedData,
      mappedFields,
      processingTime: Date.now() - job.timestamp
    };

    logger.info(`Document ${documentId} processed successfully`);
    return result;

  } catch (error) {
    logger.error(`Failed to process document ${documentId}:`, error);
    throw error;
  }
});

// Process batch jobs
batchQueue.process(async (job) => {
  const { documentIds, options } = job.data;
  const results = [];

  try {
    const total = documentIds.length;
    
    for (let i = 0; i < total; i++) {
      const progress = Math.round((i / total) * 100);
      await job.progress(progress);

      // Add individual document to processing queue
      const childJob = await documentQueue.add({
        documentId: documentIds[i],
        userId: job.data.userId,
        filePath: `pending`, // Would be fetched from database
        options: {}
      });

      // Wait for completion if not parallel
      if (!options?.parallel) {
        const result = await childJob.finished();
        results.push(result);

        // Stop on error if configured
        if (options?.stopOnError && result.status === 'failed') {
          break;
        }
      } else {
        results.push({ documentId: documentIds[i], jobId: childJob.id });
      }
    }

    await job.progress(100);
    return { 
      batchId: job.id,
      documentsProcessed: results.length,
      results 
    };

  } catch (error) {
    logger.error(`Batch processing failed:`, error);
    throw error;
  }
});

// Job event handlers
documentQueue.on('completed', (job, result) => {
  logger.info(`Job ${job.id} completed`, { documentId: result.documentId });
});

documentQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed:`, err);
});

// Queue health monitoring
export async function getQueueHealth() {
  const [waiting, active, completed, failed] = await Promise.all([
    documentQueue.getWaitingCount(),
    documentQueue.getActiveCount(),
    documentQueue.getCompletedCount(),
    documentQueue.getFailedCount()
  ]);

  return {
    queue: 'document-processing',
    waiting,
    active,
    completed,
    failed,
    isHealthy: active < 100 && waiting < 1000
  };
}

// Get job status
export async function getJobStatus(jobId: string) {
  const job = await documentQueue.getJob(jobId);
  
  if (!job) {
    const batchJob = await batchQueue.getJob(jobId);
    if (batchJob) {
      return toJobStatusDTO({
        id: batchJob.id,
        type: 'batch_processing',
        status: await batchJob.getState(),
        progress: batchJob.progress(),
        created_at: new Date(batchJob.timestamp),
        started_at: batchJob.processedOn ? new Date(batchJob.processedOn) : undefined,
        completed_at: batchJob.finishedOn ? new Date(batchJob.finishedOn) : undefined,
        result: batchJob.returnvalue,
        error: batchJob.failedReason
      });
    }
    return null;
  }

  return toJobStatusDTO({
    id: job.id,
    type: 'document_processing',
    status: await job.getState(),
    progress: job.progress(),
    created_at: new Date(job.timestamp),
    started_at: job.processedOn ? new Date(job.processedOn) : undefined,
    completed_at: job.finishedOn ? new Date(job.finishedOn) : undefined,
    result: job.returnvalue,
    error: job.failedReason
  });
}

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  await documentQueue.close();
  await batchQueue.close();
});