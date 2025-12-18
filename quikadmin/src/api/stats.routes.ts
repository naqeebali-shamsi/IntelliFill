import express, { Router, Request, Response } from 'express';
import { DatabaseService } from '../database/DatabaseService';
import { authenticateSupabase, optionalAuthSupabase } from '../middleware/supabaseAuth';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';

export function createStatsRoutes(db: DatabaseService): Router {
  const router = Router();

  // Get dashboard statistics
  router.get('/statistics', optionalAuthSupabase, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;

      // Get real statistics from database
      const [totalJobs, completedJobs, failedJobs, inProgressJobs, totalClients, totalDocuments] =
        await Promise.all([
          prisma.job.count({ where: userId ? { userId } : undefined }),
          prisma.job.count({ where: { status: 'completed', ...(userId ? { userId } : {}) } }),
          prisma.job.count({ where: { status: 'failed', ...(userId ? { userId } : {}) } }),
          prisma.job.count({ where: { status: 'processing', ...(userId ? { userId } : {}) } }),
          prisma.client.count({ where: userId ? { userId } : undefined }),
          prisma.document.count({ where: userId ? { userId } : undefined }),
        ]);

      // Calculate today's processed count
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const processedToday = await prisma.job.count({
        where: {
          status: 'completed',
          completedAt: { gte: today },
          ...(userId ? { userId } : {}),
        },
      });

      // Calculate average processing time (in seconds)
      const completedJobsWithTime = await prisma.job.findMany({
        where: {
          status: 'completed',
          startedAt: { not: null },
          completedAt: { not: null },
          ...(userId ? { userId } : {}),
        },
        select: {
          startedAt: true,
          completedAt: true,
        },
        take: 100, // Last 100 completed jobs
      });

      let averageProcessingTime = 0;
      if (completedJobsWithTime.length > 0) {
        const totalTime = completedJobsWithTime.reduce((acc, job) => {
          if (job.startedAt && job.completedAt) {
            return acc + (job.completedAt.getTime() - job.startedAt.getTime());
          }
          return acc;
        }, 0);
        averageProcessingTime = totalTime / completedJobsWithTime.length / 1000; // Convert to seconds
      }

      // Calculate success rate
      const successRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 1000) / 10 : 0;

      const stats = {
        totalJobs,
        completedJobs,
        failedJobs,
        inProgress: inProgressJobs,
        processedToday,
        averageProcessingTime: Math.round(averageProcessingTime * 10) / 10,
        averageConfidence: 0, // Will be calculated from processing history when available
        successRate,
        totalClients,
        totalDocuments,
        trends: {
          documents: { value: totalDocuments, change: 0, trend: 'stable' as const },
          processedToday: { value: processedToday, change: 0, trend: 'stable' as const },
          inProgress: { value: inProgressJobs, change: 0, trend: 'stable' as const },
          failed: { value: failedJobs, change: 0, trend: 'stable' as const },
        },
      };

      res.json(stats);
    } catch (error) {
      logger.error('Error fetching statistics:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  // Get processing jobs (real data from database)
  router.get('/jobs', optionalAuthSupabase, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string;

      const whereClause: any = userId ? { userId } : {};
      if (status) {
        whereClause.status = status;
      }

      const [jobs, total] = await Promise.all([
        prisma.job.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          include: {
            processingHistory: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        }),
        prisma.job.count({ where: whereClause }),
      ]);

      const formattedJobs = jobs.map((job) => ({
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.status === 'completed' ? 100 : job.status === 'processing' ? 50 : 0,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt?.toISOString(),
        completedAt: job.completedAt?.toISOString(),
        failedAt: job.failedAt?.toISOString(),
        error: job.error,
        result: job.result,
        metadata: job.metadata,
        documentsCount: job.documentsCount,
      }));

      res.json({
        jobs: formattedJobs,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      });
    } catch (error) {
      logger.error('Error fetching jobs:', error);
      res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  });

  // Get single job status
  router.get('/jobs/:jobId', optionalAuthSupabase, async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const userId = (req as any).user?.id;

      const job = await prisma.job.findFirst({
        where: {
          id: jobId,
          ...(userId ? { userId } : {}),
        },
        include: {
          processingHistory: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      res.json({
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.status === 'completed' ? 100 : job.status === 'processing' ? 50 : 0,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt?.toISOString(),
        completedAt: job.completedAt?.toISOString(),
        failedAt: job.failedAt?.toISOString(),
        error: job.error,
        result: job.result,
        metadata: job.metadata,
        documentsCount: job.documentsCount,
        processingHistory: job.processingHistory,
      });
    } catch (error) {
      logger.error('Error fetching job:', error);
      res.status(500).json({ error: 'Failed to fetch job' });
    }
  });

  // Get job status
  router.get('/jobs/:jobId/status', optionalAuthSupabase, async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const userId = (req as any).user?.id;

      const job = await prisma.job.findFirst({
        where: {
          id: jobId,
          ...(userId ? { userId } : {}),
        },
        select: {
          status: true,
          result: true,
          error: true,
          completedAt: true,
        },
      });

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      res.json({
        status: job.status,
        progress: job.status === 'completed' ? 100 : job.status === 'processing' ? 50 : 0,
        result: job.result,
        error: job.error,
      });
    } catch (error) {
      logger.error('Error fetching job status:', error);
      res.status(500).json({ error: 'Failed to fetch job status' });
    }
  });

  // Get templates (real data from database)
  router.get('/templates', optionalAuthSupabase, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;

      // Get templates from the old Template model
      const templates = await prisma.template.findMany({
        where: {
          isActive: true,
          OR: [{ isPublic: true }, ...(userId ? [{ userId }] : [])],
        },
        orderBy: { usageCount: 'desc' },
        take: 20,
      });

      const formattedTemplates = templates.map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        formType: template.formType,
        usage: template.usageCount,
        isPublic: template.isPublic,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      }));

      res.json(formattedTemplates);
    } catch (error) {
      logger.error('Error fetching templates:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  // Create template (stores in database)
  router.post('/templates', authenticateSupabase, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { name, description, formType, fields, isPublic } = req.body;

      // Validate required fields
      if (!name || !formType) {
        return res.status(400).json({
          error: 'Template name and formType are required',
          details: {
            name: !name ? 'Template name is required' : null,
            formType: !formType ? 'Form type is required' : null,
          },
        });
      }

      const newTemplate = await prisma.template.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          formType: formType.trim(),
          fieldMappings: JSON.stringify(fields || []),
          isPublic: isPublic || false,
          userId,
        },
      });

      logger.info(`New template created: ${name} by user: ${userId}`);

      res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: {
          template: {
            id: newTemplate.id,
            name: newTemplate.name,
            description: newTemplate.description,
            formType: newTemplate.formType,
            isPublic: newTemplate.isPublic,
            createdAt: newTemplate.createdAt.toISOString(),
          },
        },
      });
    } catch (error) {
      logger.error('Error creating template:', error);
      res.status(500).json({
        error: 'Failed to create template. Please try again.',
      });
    }
  });

  // Get queue metrics (real data from Bull queue if available, otherwise from database)
  router.get('/queue/metrics', optionalAuthSupabase, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;

      // Get metrics from database job counts
      const [waiting, active, completed, failed] = await Promise.all([
        prisma.job.count({ where: { status: 'pending', ...(userId ? { userId } : {}) } }),
        prisma.job.count({ where: { status: 'processing', ...(userId ? { userId } : {}) } }),
        prisma.job.count({ where: { status: 'completed', ...(userId ? { userId } : {}) } }),
        prisma.job.count({ where: { status: 'failed', ...(userId ? { userId } : {}) } }),
      ]);

      // Calculate average processing time from recent completed jobs
      const recentJobs = await prisma.job.findMany({
        where: {
          status: 'completed',
          startedAt: { not: null },
          completedAt: { not: null },
          ...(userId ? { userId } : {}),
        },
        select: {
          startedAt: true,
          completedAt: true,
        },
        orderBy: { completedAt: 'desc' },
        take: 50,
      });

      let averageProcessingTime = 0;
      if (recentJobs.length > 0) {
        const totalTime = recentJobs.reduce((acc, job) => {
          if (job.startedAt && job.completedAt) {
            return acc + (job.completedAt.getTime() - job.startedAt.getTime());
          }
          return acc;
        }, 0);
        averageProcessingTime = totalTime / recentJobs.length / 1000; // Convert to seconds
      }

      const metrics = {
        waiting,
        active,
        completed,
        failed,
        delayed: 0, // Not tracked in current schema
        queueLength: waiting + active,
        averageWaitTime: 0, // Would need queue integration for accurate value
        averageProcessingTime: Math.round(averageProcessingTime * 10) / 10,
      };

      res.json(metrics);
    } catch (error) {
      logger.error('Error fetching queue metrics:', error);
      res.status(500).json({ error: 'Failed to fetch queue metrics' });
    }
  });

  // Extract data endpoint - delegates to document processing service
  router.post('/extract', authenticateSupabase, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { documentId } = req.body;

      if (!documentId) {
        return res.status(400).json({ error: 'Document ID is required' });
      }

      // Verify document belongs to user
      const document = await prisma.document.findFirst({
        where: {
          id: documentId,
          userId,
        },
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Return existing extracted data if available
      if (document.extractedData) {
        return res.json({
          data: document.extractedData,
          confidence: document.confidence,
          status: document.status,
        });
      }

      // Return pending status if not yet extracted
      res.json({
        data: null,
        status: 'pending',
        message:
          'Document has not been processed yet. Use /api/documents/:id/extract to trigger extraction.',
      });
    } catch (error) {
      logger.error('Error extracting data:', error);
      res.status(500).json({ error: 'Failed to extract data' });
    }
  });

  // Validate form endpoint - validates PDF form structure
  router.post('/validate/form', authenticateSupabase, async (req: Request, res: Response) => {
    try {
      const { templateId } = req.body;

      if (!templateId) {
        return res.status(400).json({ error: 'Template ID is required' });
      }

      // Get template to validate
      const template = await prisma.template.findUnique({
        where: { id: templateId },
      });

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Parse field mappings
      let fields: string[] = [];
      const fieldTypes: Record<string, string> = {};

      try {
        const mappings = JSON.parse(template.fieldMappings);
        if (Array.isArray(mappings)) {
          fields = mappings.map((m: any) => m.name || m);
          mappings.forEach((m: any) => {
            if (typeof m === 'object' && m.name) {
              fieldTypes[m.name] = m.type || 'text';
            }
          });
        }
      } catch {
        // Field mappings might be in different format
        fields = [];
      }

      res.json({
        data: {
          templateId: template.id,
          templateName: template.name,
          formType: template.formType,
          fields,
          fieldTypes,
          isValid: fields.length > 0,
        },
      });
    } catch (error) {
      logger.error('Error validating form:', error);
      res.status(500).json({ error: 'Failed to validate form' });
    }
  });

  return router;
}
