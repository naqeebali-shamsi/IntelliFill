/**
 * Multi-Agent Routes Integration Tests
 *
 * Tests for the multi-agent processing API endpoints:
 * - POST /api/process/multiagent - Initiate processing
 * - GET /api/process/multiagent/:jobId/status - Get job status
 * - GET /api/process/multiagent/queue/health - Queue health check
 * - GET /api/process/multiagent/recent - Recent jobs
 */

import express, { Express } from 'express';
import request from 'supertest';
import path from 'path';
import fs from 'fs';

// Mock modules before imports
jest.mock('../../middleware/supabaseAuth', () => ({
  authenticateSupabase: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-123' };
    next();
  },
}));

jest.mock('../../utils/piiSafeLogger', () => ({
  piiSafeLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../utils/prisma', () => ({
  prisma: {
    document: {
      create: jest.fn().mockResolvedValue({ id: 'doc-123' }),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    multiAgentProcessing: {
      create: jest.fn().mockResolvedValue({ id: 'record-123' }),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));

jest.mock('../../queues/multiagentQueue', () => ({
  isMultiagentQueueAvailable: jest.fn().mockReturnValue(true),
  enqueueMultiagentProcessing: jest.fn().mockResolvedValue({ id: 'job-123' }),
  getMultiagentJobStatus: jest.fn(),
  getMultiagentQueueHealth: jest.fn(),
}));

jest.mock('../../utils/encryption', () => ({
  validateFilePath: jest.fn(),
}));

// Import after mocks
import { createMultiagentRoutes } from '../multiagent.routes';
import * as queueModule from '../../queues/multiagentQueue';
import { prisma } from '../../utils/prisma';

describe('Multiagent Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/process/multiagent', createMultiagentRoutes());

    // Ensure uploads directory exists for tests
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  });

  // ==========================================================================
  // POST /api/process/multiagent Tests
  // ==========================================================================

  describe('POST /api/process/multiagent', () => {
    it('should return 503 when queue is unavailable', async () => {
      (queueModule.isMultiagentQueueAvailable as jest.Mock).mockReturnValue(false);

      const response = await request(app)
        .post('/api/process/multiagent')
        .attach('document', Buffer.from('test content'), 'test.pdf');

      expect(response.status).toBe(503);
      expect(response.body.error).toContain('not available');
    });

    it('should return 400 when no document provided', async () => {
      // Ensure queue is available for this test
      (queueModule.isMultiagentQueueAvailable as jest.Mock).mockReturnValue(true);

      const response = await request(app).post('/api/process/multiagent');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Document file is required');
    });

    it('should return 202 and job ID on successful enqueue', async () => {
      (queueModule.isMultiagentQueueAvailable as jest.Mock).mockReturnValue(true);
      (queueModule.enqueueMultiagentProcessing as jest.Mock).mockResolvedValue({ id: 'job-456' });

      const response = await request(app)
        .post('/api/process/multiagent')
        .attach('document', Buffer.from('test PDF content'), 'test.pdf');

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBe('job-456');
      expect(response.body.data.status).toBe('queued');
    });

    it('should validate priority parameter', async () => {
      const response = await request(app)
        .post('/api/process/multiagent')
        .field('priority', '100') // Invalid: > 10
        .attach('document', Buffer.from('test content'), 'test.pdf');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid request parameters');
    });
  });

  // ==========================================================================
  // GET /api/process/multiagent/:jobId/status Tests
  // ==========================================================================

  describe('GET /api/process/multiagent/:jobId/status', () => {
    it('should return 503 when queue is unavailable', async () => {
      (queueModule.isMultiagentQueueAvailable as jest.Mock).mockReturnValue(false);

      const response = await request(app).get('/api/process/multiagent/job-123/status');

      expect(response.status).toBe(503);
    });

    it('should return 404 when job not found', async () => {
      (queueModule.isMultiagentQueueAvailable as jest.Mock).mockReturnValue(true);
      (queueModule.getMultiagentJobStatus as jest.Mock).mockResolvedValue(null);
      (prisma.multiAgentProcessing.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/process/multiagent/nonexistent/status');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Job not found');
    });

    it('should return 403 when accessing another user\'s job', async () => {
      (queueModule.isMultiagentQueueAvailable as jest.Mock).mockReturnValue(true);
      (queueModule.getMultiagentJobStatus as jest.Mock).mockResolvedValue(null);
      (prisma.multiAgentProcessing.findFirst as jest.Mock).mockResolvedValue({
        jobId: 'job-123',
        userId: 'different-user', // Not test-user-123
        documentId: 'doc-456',
      });

      const response = await request(app).get('/api/process/multiagent/job-123/status');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });

    it('should return job status with combined data', async () => {
      (queueModule.isMultiagentQueueAvailable as jest.Mock).mockReturnValue(true);
      (queueModule.getMultiagentJobStatus as jest.Mock).mockResolvedValue({
        id: 'job-123',
        status: 'active',
        progress: 50,
        result: null,
        error: null,
        attemptsMade: 1,
        attemptsTotal: 3,
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: null,
      });
      (prisma.multiAgentProcessing.findFirst as jest.Mock).mockResolvedValue({
        jobId: 'job-123',
        userId: 'test-user-123',
        documentId: 'doc-456',
        status: 'CLASSIFYING',
        currentAgent: 'classify',
        agentHistory: [],
        createdAt: new Date(),
      });
      (prisma.document.findUnique as jest.Mock).mockResolvedValue({
        id: 'doc-456',
        fileName: 'test.pdf',
        status: 'PROCESSING',
        confidence: null,
      });

      const response = await request(app).get('/api/process/multiagent/job-123/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBe('job-123');
      expect(response.body.data.status).toBe('active');
      expect(response.body.data.progress).toBe(50);
      expect(response.body.data.document).toBeDefined();
    });
  });

  // ==========================================================================
  // GET /api/process/multiagent/queue/health Tests
  // ==========================================================================

  describe('GET /api/process/multiagent/queue/health', () => {
    it('should return 503 when queue is unavailable', async () => {
      (queueModule.isMultiagentQueueAvailable as jest.Mock).mockReturnValue(false);

      const response = await request(app).get('/api/process/multiagent/queue/health');

      expect(response.status).toBe(503);
    });

    it('should return queue health metrics', async () => {
      (queueModule.isMultiagentQueueAvailable as jest.Mock).mockReturnValue(true);
      (queueModule.getMultiagentQueueHealth as jest.Mock).mockResolvedValue({
        queue: 'multiagent-processing',
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
        isHealthy: true,
      });

      const response = await request(app).get('/api/process/multiagent/queue/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.queue).toBe('multiagent-processing');
      expect(response.body.data.isHealthy).toBe(true);
    });
  });

  // ==========================================================================
  // GET /api/process/multiagent/recent Tests
  // ==========================================================================

  describe('GET /api/process/multiagent/recent', () => {
    it('should return recent jobs for the user', async () => {
      const mockJobs = [
        {
          jobId: 'job-1',
          documentId: 'doc-1',
          status: 'COMPLETED',
          priority: 0,
          createdAt: new Date(),
          startedAt: new Date(),
          completedAt: new Date(),
          errorMessage: null as string | null,
        },
        {
          jobId: 'job-2',
          documentId: 'doc-2',
          status: 'PENDING',
          priority: 5,
          createdAt: new Date(),
          startedAt: null as Date | null,
          completedAt: null as Date | null,
          errorMessage: null as string | null,
        },
      ];

      (prisma.multiAgentProcessing.findMany as jest.Mock).mockResolvedValue(mockJobs);
      (prisma.document.findMany as jest.Mock).mockResolvedValue([
        { id: 'doc-1', fileName: 'test1.pdf', fileType: 'application/pdf', status: 'COMPLETED', confidence: 95 },
        { id: 'doc-2', fileName: 'test2.pdf', fileType: 'application/pdf', status: 'PENDING', confidence: null },
      ]);

      const response = await request(app).get('/api/process/multiagent/recent');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });

    it('should respect limit parameter', async () => {
      (prisma.multiAgentProcessing.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.document.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app).get('/api/process/multiagent/recent?limit=5');

      expect(response.status).toBe(200);
      expect(prisma.multiAgentProcessing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        })
      );
    });

    it('should cap limit at 50', async () => {
      (prisma.multiAgentProcessing.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.document.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app).get('/api/process/multiagent/recent?limit=100');

      expect(response.status).toBe(200);
      expect(prisma.multiAgentProcessing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50, // Capped at 50
        })
      );
    });
  });
});
