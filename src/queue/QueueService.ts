import Bull from 'bull';
import { Job } from 'bull';
import { IntelliFillService } from '../services/IntelliFillService';
import { logger } from '../utils/logger';
import { DatabaseService } from '../database/DatabaseService';

export interface ProcessingJob {
  id: string;
  type: 'single' | 'multiple' | 'batch';
  documents: string[];
  form: string;
  output: string;
  userId?: string;
  priority?: number;
  metadata?: Record<string, any>;
}

export class QueueService {
  private processingQueue: Bull.Queue<ProcessingJob>;
  private ocrQueue: Bull.Queue<{ filePath: string; jobId: string }>;
  private mlTrainingQueue: Bull.Queue<{ data: any[]; modelId: string }>;
  private intelliFillService: IntelliFillService;
  private databaseService: DatabaseService;

  constructor(
    intelliFillService: IntelliFillService,
    databaseService: DatabaseService,
    redisUrl: string = 'redis://localhost:6379'
  ) {
    this.intelliFillService = intelliFillService;
    this.databaseService = databaseService;

    // Initialize queues
    this.processingQueue = new Bull('pdf-processing', redisUrl, {
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 500,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    this.ocrQueue = new Bull('ocr-processing', redisUrl, {
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 100,
        attempts: 2
      }
    });

    this.mlTrainingQueue = new Bull('ml-training', redisUrl, {
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 50,
        attempts: 1
      }
    });

    this.setupProcessors();
    this.setupEventHandlers();
  }

  private setupProcessors(): void {
    // Main processing queue processor
    this.processingQueue.process(5, async (job: Job<ProcessingJob>) => {
      const { type, documents, form, output, userId } = job.data;
      
      logger.info(`Processing job ${job.id} of type ${type}`);
      
      // Update job progress
      await job.progress(10);
      
      try {
        // Store job start in database
        await this.databaseService.createJob({
          id: job.id as string,
          type,
          status: 'processing',
          userId,
          documentsCount: documents.length,
          startedAt: new Date()
        });

        let result;
        
        switch (type) {
          case 'single':
            await job.progress(30);
            result = await this.intelliFillService.processSingle(documents[0], form, output);
            break;
            
          case 'multiple':
            await job.progress(30);
            result = await this.intelliFillService.processMultiple(documents, form, output);
            break;
            
          case 'batch':
            await job.progress(30);
            const jobs = documents.map((doc, i) => ({
              documents: [doc],
              form,
              output: `${output}_${i}.pdf`
            }));
            result = await this.intelliFillService.batchProcess(jobs);
            break;
            
          default:
            throw new Error(`Unknown job type: ${type}`);
        }

        await job.progress(90);

        // Store results in database
        await this.databaseService.updateJob(job.id as string, {
          status: 'completed',
          result,
          completedAt: new Date()
        });

        await job.progress(100);
        
        return result;
      } catch (error) {
        // Store error in database
        await this.databaseService.updateJob(job.id as string, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          failedAt: new Date()
        });
        
        throw error;
      }
    });

    // OCR queue processor
    this.ocrQueue.process(2, async (job: Job) => {
      const { filePath, jobId } = job.data;
      
      logger.info(`Processing OCR for file ${filePath}`);
      
      // OCR processing would happen here
      // This is a placeholder for the actual OCR implementation
      
      return { success: true, text: 'OCR processed text' };
    });

    // ML training queue processor
    this.mlTrainingQueue.process(1, async (job: Job) => {
      const { data, modelId } = job.data;
      
      logger.info(`Training ML model ${modelId}`);
      
      // ML training would happen here
      // This is a placeholder for the actual training implementation
      
      return { success: true, modelId, accuracy: 0.95 };
    });
  }

  private setupEventHandlers(): void {
    // Processing queue events
    this.processingQueue.on('completed', (job, result) => {
      logger.info(`Job ${job.id} completed successfully`);
    });

    this.processingQueue.on('failed', (job, err) => {
      logger.error(`Job ${job.id} failed:`, err);
    });

    this.processingQueue.on('stalled', (job) => {
      logger.warn(`Job ${job.id} stalled and will be retried`);
    });

    // Global error handler
    this.processingQueue.on('error', (error) => {
      logger.error('Queue error:', error);
    });
  }

  async addJob(jobData: ProcessingJob, options?: Bull.JobOptions): Promise<Bull.Job<ProcessingJob>> {
    const job = await this.processingQueue.add(jobData, {
      priority: jobData.priority || 0,
      delay: 0,
      ...options
    });

    logger.info(`Added job ${job.id} to processing queue`);
    return job;
  }

  async addOCRJob(filePath: string, jobId: string): Promise<Bull.Job> {
    const job = await this.ocrQueue.add({ filePath, jobId });
    logger.info(`Added OCR job for file ${filePath}`);
    return job;
  }

  async addMLTrainingJob(data: any[], modelId: string): Promise<Bull.Job> {
    const job = await this.mlTrainingQueue.add({ data, modelId });
    logger.info(`Added ML training job for model ${modelId}`);
    return job;
  }

  async getJob(jobId: string): Promise<Bull.Job<ProcessingJob> | null> {
    return this.processingQueue.getJob(jobId);
  }

  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    result?: any;
    error?: string;
  }> {
    const job = await this.getJob(jobId);
    
    if (!job) {
      return { status: 'not_found', progress: 0 };
    }

    const state = await job.getState();
    const progress = job.progress();

    return {
      status: state,
      progress: typeof progress === 'number' ? progress : 0,
      result: job.returnvalue,
      error: job.failedReason
    };
  }

  async getQueueMetrics(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.processingQueue.getWaitingCount(),
      this.processingQueue.getActiveCount(),
      this.processingQueue.getCompletedCount(),
      this.processingQueue.getFailedCount(),
      this.processingQueue.getDelayedCount()
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  async cleanQueue(grace: number = 5000): Promise<void> {
    await this.processingQueue.clean(grace, 'completed');
    await this.processingQueue.clean(grace, 'failed');
    logger.info('Queue cleaned');
  }

  async pauseQueue(): Promise<void> {
    await this.processingQueue.pause();
    logger.info('Queue paused');
  }

  async resumeQueue(): Promise<void> {
    await this.processingQueue.resume();
    logger.info('Queue resumed');
  }

  async close(): Promise<void> {
    await this.processingQueue.close();
    await this.ocrQueue.close();
    await this.mlTrainingQueue.close();
    logger.info('All queues closed');
  }
}