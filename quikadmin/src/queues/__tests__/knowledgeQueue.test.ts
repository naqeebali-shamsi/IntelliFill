/**
 * Knowledge Queue Unit Tests
 *
 * Tests for the knowledge processing queue covering:
 * - Job submission
 * - Queue health monitoring
 * - Job status tracking
 * - Progress reporting
 *
 * @module queues/__tests__/knowledgeQueue.test
 */

// Mock Bull queue
const mockJob = {
  id: '123',
  data: {
    type: 'processDocument',
    sourceId: 'source-123',
    organizationId: 'org-123',
    userId: 'user-123',
    filePath: '/path/to/file.pdf',
    filename: 'test.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
  },
  progress: jest.fn(),
  getState: jest.fn().mockResolvedValue('waiting'),
  attemptsMade: 0,
  processedOn: null,
  finishedOn: null,
  failedReason: null,
  remove: jest.fn().mockResolvedValue(undefined),
  retry: jest.fn().mockResolvedValue(undefined),
};

const mockQueue = {
  add: jest.fn().mockResolvedValue(mockJob),
  process: jest.fn(),
  getJob: jest.fn().mockResolvedValue(mockJob),
  getWaitingCount: jest.fn().mockResolvedValue(5),
  getActiveCount: jest.fn().mockResolvedValue(2),
  getCompletedCount: jest.fn().mockResolvedValue(100),
  getFailedCount: jest.fn().mockResolvedValue(10),
  getDelayedCount: jest.fn().mockResolvedValue(1),
  isPaused: jest.fn().mockResolvedValue(false),
  getWaiting: jest.fn().mockResolvedValue([mockJob]),
  getActive: jest.fn().mockResolvedValue([]),
  getCompleted: jest.fn().mockResolvedValue([mockJob]),
  getFailed: jest.fn().mockResolvedValue([]),
  pause: jest.fn().mockResolvedValue(undefined),
  resume: jest.fn().mockResolvedValue(undefined),
  clean: jest.fn().mockResolvedValue([]),
  close: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => mockQueue);
});

import {
  addProcessDocumentJob,
  addGenerateEmbeddingsJob,
  addReprocessChunksJob,
  getQueueHealth,
  getJob,
  getJobStatus,
  getOrganizationJobs,
  cancelJob,
  retryJob,
  pauseQueue,
  resumeQueue,
  cleanQueue,
  reportProgress,
  createProgressReporter,
} from '../knowledgeQueue';

describe('Knowledge Queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Job Submission', () => {
    describe('addProcessDocumentJob', () => {
      it('should add a document processing job', async () => {
        const jobData = {
          sourceId: 'source-123',
          organizationId: 'org-123',
          userId: 'user-123',
          filePath: '/path/to/file.pdf',
          filename: 'test.pdf',
          mimeType: 'application/pdf',
          fileSize: 1024,
        };

        const job = await addProcessDocumentJob(jobData);

        expect(mockQueue.add).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'processDocument',
            sourceId: 'source-123',
          }),
          expect.any(Object)
        );
        expect(job).toBeDefined();
      });

      it('should set priority correctly', async () => {
        const jobData = {
          sourceId: 'source-123',
          organizationId: 'org-123',
          userId: 'user-123',
          filePath: '/path/to/file.pdf',
          filename: 'test.pdf',
          mimeType: 'application/pdf',
          fileSize: 1024,
          priority: 'high' as const,
        };

        await addProcessDocumentJob(jobData);

        expect(mockQueue.add).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({ priority: 1 })
        );
      });
    });

    describe('addGenerateEmbeddingsJob', () => {
      it('should add an embedding generation job', async () => {
        const jobData = {
          sourceId: 'source-123',
          organizationId: 'org-123',
          userId: 'user-123',
        };

        const job = await addGenerateEmbeddingsJob(jobData);

        expect(mockQueue.add).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'generateEmbeddings',
            sourceId: 'source-123',
          }),
          expect.any(Object)
        );
        expect(job).toBeDefined();
      });
    });

    describe('addReprocessChunksJob', () => {
      it('should add a chunk reprocessing job', async () => {
        const jobData = {
          sourceId: 'source-123',
          organizationId: 'org-123',
          userId: 'user-123',
          chunkIds: ['chunk-1', 'chunk-2'],
          reason: 'Model update',
        };

        const job = await addReprocessChunksJob(jobData);

        expect(mockQueue.add).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'reprocessChunks',
            chunkIds: ['chunk-1', 'chunk-2'],
            reason: 'Model update',
          }),
          expect.any(Object)
        );
        expect(job).toBeDefined();
      });
    });
  });

  describe('Queue Health', () => {
    it('should return queue health status', async () => {
      const health = await getQueueHealth();

      expect(health).toEqual({
        queue: 'knowledge-processing',
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 10,
        delayed: 1,
        paused: false,
        isHealthy: true,
      });
    });

    it('should report unhealthy when too many active jobs', async () => {
      mockQueue.getActiveCount.mockResolvedValueOnce(100);

      const health = await getQueueHealth();

      expect(health.isHealthy).toBe(false);
    });

    it('should report unhealthy when paused', async () => {
      mockQueue.isPaused.mockResolvedValueOnce(true);

      const health = await getQueueHealth();

      expect(health.isHealthy).toBe(false);
    });
  });

  describe('Job Status', () => {
    it('should get job by ID', async () => {
      const job = await getJob('123');

      expect(mockQueue.getJob).toHaveBeenCalledWith('123');
      expect(job).toBeDefined();
    });

    it('should return null for non-existent job', async () => {
      mockQueue.getJob.mockResolvedValueOnce(null);

      const job = await getJob('non-existent');

      expect(job).toBeNull();
    });

    it('should get job status', async () => {
      const status = await getJobStatus('123');

      expect(status).toEqual({
        id: '123',
        type: 'processDocument',
        status: 'waiting',
        progress: undefined, // mockJob.progress returns undefined
        attemptsMade: 0,
        processedOn: undefined,
        finishedOn: undefined,
        failedReason: null,
      });
    });

    it('should return null status for non-existent job', async () => {
      mockQueue.getJob.mockResolvedValueOnce(null);

      const status = await getJobStatus('non-existent');

      expect(status).toBeNull();
    });
  });

  describe('Organization Jobs', () => {
    it('should get jobs for organization', async () => {
      mockQueue.getWaiting.mockResolvedValueOnce([mockJob]);
      mockQueue.getActive.mockResolvedValueOnce([]);

      const jobs = await getOrganizationJobs('org-123');

      expect(jobs).toHaveLength(1);
      expect(jobs[0].data.organizationId).toBe('org-123');
    });

    it('should filter by status', async () => {
      mockQueue.getWaiting.mockResolvedValueOnce([mockJob]);

      const jobs = await getOrganizationJobs('org-123', 'waiting');

      expect(mockQueue.getWaiting).toHaveBeenCalled();
    });
  });

  describe('Job Management', () => {
    describe('cancelJob', () => {
      it('should cancel waiting job', async () => {
        mockJob.getState.mockResolvedValueOnce('waiting');

        const result = await cancelJob('123');

        expect(mockJob.remove).toHaveBeenCalled();
        expect(result).toBe(true);
      });

      it('should not cancel active job', async () => {
        mockJob.getState.mockResolvedValueOnce('active');

        const result = await cancelJob('123');

        expect(mockJob.remove).not.toHaveBeenCalled();
        expect(result).toBe(false);
      });

      it('should return false for non-existent job', async () => {
        mockQueue.getJob.mockResolvedValueOnce(null);

        const result = await cancelJob('non-existent');

        expect(result).toBe(false);
      });
    });

    describe('retryJob', () => {
      it('should retry failed job', async () => {
        mockJob.getState.mockResolvedValueOnce('failed');

        const result = await retryJob('123');

        expect(mockJob.retry).toHaveBeenCalled();
        expect(result).toBe(true);
      });

      it('should not retry non-failed job', async () => {
        mockJob.getState.mockResolvedValueOnce('completed');

        const result = await retryJob('123');

        expect(mockJob.retry).not.toHaveBeenCalled();
        expect(result).toBe(false);
      });
    });

    describe('pauseQueue', () => {
      it('should pause the queue', async () => {
        await pauseQueue();

        expect(mockQueue.pause).toHaveBeenCalled();
      });
    });

    describe('resumeQueue', () => {
      it('should resume the queue', async () => {
        await resumeQueue();

        expect(mockQueue.resume).toHaveBeenCalled();
      });
    });

    describe('cleanQueue', () => {
      it('should clean old jobs', async () => {
        mockQueue.clean.mockResolvedValueOnce(['job1']).mockResolvedValueOnce(['job2']);

        const result = await cleanQueue();

        expect(mockQueue.clean).toHaveBeenCalledTimes(2);
        expect(result.completed).toBe(1);
        expect(result.failed).toBe(1);
      });
    });
  });

  describe('Progress Reporting', () => {
    it('should report progress on job', async () => {
      const progress = {
        stage: 'extraction' as const,
        percentage: 50,
        currentStep: 'Extracting page 5 of 10',
        details: { pagesProcessed: 5, totalPages: 10 },
      };

      await reportProgress(mockJob as any, progress);

      expect(mockJob.progress).toHaveBeenCalledWith(progress);
    });

    describe('createProgressReporter', () => {
      it('should create progress reporter helper', () => {
        const reporter = createProgressReporter(mockJob as any);

        expect(reporter.extraction).toBeDefined();
        expect(reporter.chunking).toBeDefined();
        expect(reporter.embedding).toBeDefined();
        expect(reporter.storage).toBeDefined();
        expect(reporter.complete).toBeDefined();
        expect(reporter.failed).toBeDefined();
      });

      it('should report extraction progress', async () => {
        const reporter = createProgressReporter(mockJob as any);

        await reporter.extraction(50, 5, 10);

        expect(mockJob.progress).toHaveBeenCalledWith(
          expect.objectContaining({
            stage: 'extraction',
            currentStep: expect.stringContaining('5/10'),
          })
        );
      });

      it('should report completion', async () => {
        const reporter = createProgressReporter(mockJob as any);

        await reporter.complete({
          pagesProcessed: 10,
          chunksCreated: 50,
          embeddingsGenerated: 50,
          chunksStored: 50,
          duplicatesSkipped: 0,
        });

        expect(mockJob.progress).toHaveBeenCalledWith(
          expect.objectContaining({
            stage: 'complete',
            percentage: 100,
          })
        );
      });

      it('should report failure', async () => {
        const reporter = createProgressReporter(mockJob as any);

        await reporter.failed('Processing error');

        expect(mockJob.progress).toHaveBeenCalledWith(
          expect.objectContaining({
            stage: 'failed',
            details: expect.objectContaining({
              errorMessage: 'Processing error',
            }),
          })
        );
      });
    });
  });
});
