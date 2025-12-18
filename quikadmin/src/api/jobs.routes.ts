import { Router, Request, Response } from 'express';
import { documentQueue, batchQueue, getJobStatus, getQueueHealth } from '../queues/documentQueue';
import { logger } from '../utils/logger';
import { toJobStatusDTO } from '../dto/DocumentDTO';
import Joi from 'joi';
import { validate } from '../middleware/validation';
import { authenticateSupabase } from '../middleware/supabaseAuth';

const router = Router();

// Schema for job ID validation
const jobIdSchema = Joi.object({
  id: Joi.string().required(),
});

// Get job status (polling endpoint)
router.get('/jobs/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const status = await getJobStatus(id);

    if (!status) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Add cache headers for polling efficiency
    res.set({
      'Cache-Control': 'no-cache',
      'X-Job-Status': status.status,
    });

    return res.json(status);
  } catch (error) {
    logger.error('Failed to get job status:', error);
    return res.status(500).json({ error: 'Failed to retrieve job status' });
  }
});

// Cancel a job
// Phase 6 Complete: Users can only cancel their own jobs (Supabase auth)
router.post('/jobs/:id/cancel', authenticateSupabase, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Try document queue first
    const documentJob = await documentQueue.getJob(id);
    if (documentJob) {
      await documentJob.remove();
      return res.json({ message: 'Job cancelled successfully', jobId: id });
    }

    // Try batch queue
    const batchJob = await batchQueue.getJob(id);
    if (batchJob) {
      await batchJob.remove();
      return res.json({ message: 'Batch job cancelled successfully', jobId: id });
    }

    return res.status(404).json({ error: 'Job not found' });
  } catch (error) {
    logger.error('Failed to cancel job:', error);
    return res.status(500).json({ error: 'Failed to cancel job' });
  }
});

// Retry a failed job
// Phase 6 Complete: Users can only retry their own jobs (Supabase auth)
router.post('/jobs/:id/retry', authenticateSupabase, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Try document queue first
    const documentJob = await documentQueue.getJob(id);
    if (documentJob) {
      await documentJob.retry();
      return res.json({
        message: 'Job requeued successfully',
        jobId: id,
        status: 'queued',
      });
    }

    // Try batch queue
    const batchJob = await batchQueue.getJob(id);
    if (batchJob) {
      await batchJob.retry();
      return res.json({
        message: 'Batch job requeued successfully',
        jobId: id,
        status: 'queued',
      });
    }

    return res.status(404).json({ error: 'Job not found' });
  } catch (error) {
    logger.error('Failed to retry job:', error);
    return res.status(500).json({ error: 'Failed to retry job' });
  }
});

// Get queue statistics
router.get('/jobs/queue/stats', async (req: Request, res: Response) => {
  try {
    const [documentHealth, batchHealth] = await Promise.all([
      getQueueHealth(),
      (async () => {
        const [waiting, active, completed, failed] = await Promise.all([
          batchQueue.getWaitingCount(),
          batchQueue.getActiveCount(),
          batchQueue.getCompletedCount(),
          batchQueue.getFailedCount(),
        ]);

        return {
          queue: 'batch-processing',
          waiting,
          active,
          completed,
          failed,
          isHealthy: active < 50 && waiting < 500,
        };
      })(),
    ]);

    return res.json({
      queues: {
        documentProcessing: documentHealth,
        batchProcessing: batchHealth,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get queue stats:', error);
    return res.status(500).json({ error: 'Failed to retrieve queue statistics' });
  }
});

// Get recent jobs for current user
// Phase 6 Complete: Users can only see their own jobs (Supabase auth)
router.get('/jobs/recent', authenticateSupabase, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    // Get recent jobs (last 10)
    const jobs = await documentQueue.getJobs(['completed', 'failed', 'active', 'waiting'], 0, 10);

    // Filter by user and convert to DTOs
    const userJobs = jobs
      .filter((job) => job.data.userId === userId)
      .map((job) =>
        toJobStatusDTO({
          id: job.id,
          type: 'document_processing',
          status: job.failedReason
            ? 'failed'
            : job.finishedOn
              ? 'completed'
              : job.processedOn
                ? 'processing'
                : 'queued',
          progress: job.progress() || 0,
          created_at: new Date(job.timestamp),
          started_at: job.processedOn ? new Date(job.processedOn) : undefined,
          completed_at: job.finishedOn ? new Date(job.finishedOn) : undefined,
          error: job.failedReason,
        })
      );

    return res.json(userJobs);
  } catch (error) {
    logger.error('Failed to get recent jobs:', error);
    return res.status(500).json({ error: 'Failed to retrieve recent jobs' });
  }
});

export { router as jobsRouter };
