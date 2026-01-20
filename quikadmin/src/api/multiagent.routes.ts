import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import Joi from 'joi';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { authenticateSupabase, AuthenticatedRequest } from '../middleware/supabaseAuth';
import { validateFilePath } from '../utils/encryption';
import { prisma } from '../utils/prisma';
import {
  isMultiagentQueueAvailable,
  enqueueMultiagentProcessing,
  getMultiagentJobStatus,
  getMultiagentQueueHealth,
} from '../queues/multiagentQueue';

const router: Router = Router();

// Configure multer storage for multi-agent processing
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `multiagent-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for multi-agent processing
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.doc', '.txt', '.csv', '.jpeg', '.jpg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();

    try {
      validateFilePath(file.originalname);

      if (allowedTypes.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${ext} not supported for multi-agent processing`));
      }
    } catch (error) {
      cb(error as Error);
    }
  },
});

// Validation schemas
const processRequestSchema = Joi.object({
  priority: Joi.number().min(0).max(10).optional().default(0),
  isShadowMode: Joi.boolean().optional().default(false),
  options: Joi.object({
    maxRetries: Joi.number().min(1).max(5).optional(),
    timeoutMs: Joi.number().min(30000).max(600000).optional(),
  }).optional(),
});

/**
 * POST /api/process/multiagent
 *
 * Initiates multi-agent document processing using the LangGraph pipeline.
 * Creates a processing record and enqueues the job.
 */
router.post(
  '/',
  authenticateSupabase,
  upload.single('document'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      // Check if queue is available
      if (!isMultiagentQueueAvailable()) {
        return res.status(503).json({
          success: false,
          error: 'Multi-agent processing queue is not available',
          message: 'The processing service is temporarily unavailable. Please try again later.',
        });
      }

      // Validate file
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Document file is required',
        });
      }

      // Validate request body
      const { error, value: options } = processRequestSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request parameters',
          details: error.details.map((d) => d.message),
        });
      }

      // Create document record
      const document = await prisma.document.create({
        data: {
          userId,
          fileName: req.file.originalname,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          storageUrl: req.file.path,
          status: 'PENDING',
        },
      });

      logger.info('Created document for multi-agent processing', {
        documentId: document.id,
        fileName: req.file.originalname,
        fileSize: req.file.size,
      });

      // Enqueue the job
      const job = await enqueueMultiagentProcessing({
        documentId: document.id,
        userId,
        filePath: req.file.path,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        priority: options.priority,
        isShadowMode: options.isShadowMode,
        options: options.options,
      });

      const jobId = job.id;

      res.status(202).json({
        success: true,
        message: 'Document queued for multi-agent processing',
        data: {
          jobId,
          documentId: document.id,
          status: 'queued',
          priority: options.priority,
          isShadowMode: options.isShadowMode,
          statusUrl: `/api/process/multiagent/${jobId}/status`,
        },
      });
    } catch (error) {
      logger.error('Failed to enqueue multi-agent processing', { error });
      next(error);
    }
  }
);

/**
 * GET /api/process/multiagent/:jobId/status
 *
 * Returns the current status of a multi-agent processing job.
 * Polls the queue and database for the most up-to-date status.
 */
router.get('/:jobId/status', authenticateSupabase, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = req.user!.id;

    // Check if queue is available
    if (!isMultiagentQueueAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Multi-agent processing queue is not available',
      });
    }

    // Get job status from queue
    const queueStatus = await getMultiagentJobStatus(jobId);

    // Also check database record for additional details
    const dbRecord = await prisma.multiAgentProcessing.findFirst({
      where: { jobId },
    });

    // Verify user owns this job
    if (dbRecord && dbRecord.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    if (!queueStatus && !dbRecord) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    // Fetch related document separately if we have a record
    let document = null;
    if (dbRecord?.documentId) {
      document = await prisma.document.findUnique({
        where: { id: dbRecord.documentId },
        select: {
          id: true,
          fileName: true,
          status: true,
          confidence: true,
        },
      });
    }

    // Combine information from both sources
    const response = {
      success: true,
      data: {
        jobId,
        status: queueStatus?.status || dbRecord?.status || 'unknown',
        progress: queueStatus?.progress ?? 0,
        document: document
          ? {
              id: document.id,
              fileName: document.fileName,
              status: document.status,
              confidence: document.confidence,
            }
          : null,
        result: queueStatus?.result || null,
        error: queueStatus?.error || dbRecord?.errorMessage || null,
        attemptsMade: queueStatus?.attemptsMade ?? 0,
        attemptsTotal: queueStatus?.attemptsTotal ?? 3,
        timing: {
          createdAt: queueStatus?.createdAt || dbRecord?.createdAt,
          startedAt: queueStatus?.startedAt || dbRecord?.startedAt,
          completedAt: queueStatus?.completedAt || dbRecord?.completedAt,
        },
        agentHistory: dbRecord?.agentHistory ?? null,
        currentAgent: dbRecord?.currentAgent ?? null,
      },
    };

    // Add cache headers
    res.set({
      'Cache-Control': 'no-cache',
      'X-Job-Status': response.data.status,
    });

    return res.json(response);
  } catch (error) {
    logger.error('Failed to get multi-agent job status', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve job status',
    });
  }
});

/**
 * GET /api/process/multiagent/queue/health
 *
 * Returns the health status of the multi-agent processing queue.
 * Used for monitoring and dashboards.
 */
router.get('/queue/health', authenticateSupabase, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isMultiagentQueueAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Multi-agent processing queue is not available',
        isHealthy: false,
      });
    }

    const health = await getMultiagentQueueHealth();

    return res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    logger.error('Failed to get multi-agent queue health', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve queue health',
    });
  }
});

/**
 * GET /api/process/multiagent/recent
 *
 * Returns recent multi-agent processing jobs for the authenticated user.
 */
router.get('/recent', authenticateSupabase, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const recentJobs = await prisma.multiAgentProcessing.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Fetch associated documents in a single query
    const documentIds = recentJobs.map((job) => job.documentId);
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds } },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        status: true,
        confidence: true,
      },
    });

    // Create a map for quick lookup
    const documentMap = new Map(documents.map((doc) => [doc.id, doc]));

    return res.json({
      success: true,
      data: recentJobs.map((job) => {
        const doc = documentMap.get(job.documentId);
        return {
          jobId: job.jobId,
          documentId: job.documentId,
          status: job.status,
          priority: job.priority,
          document: doc
            ? {
                fileName: doc.fileName,
                fileType: doc.fileType,
                status: doc.status,
                confidence: doc.confidence,
              }
            : null,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          errorMessage: job.errorMessage,
        };
      }),
      count: recentJobs.length,
    });
  } catch (error) {
    logger.error('Failed to get recent multi-agent jobs', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve recent jobs',
    });
  }
});

export function createMultiagentRoutes(): Router {
  return router;
}

export { router as multiagentRouter };
