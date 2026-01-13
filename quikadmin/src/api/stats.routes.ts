import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { IntelliFillService } from '../services/IntelliFillService';
import { authenticateSupabase, optionalAuthSupabase } from '../middleware/supabaseAuth';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';

// Configure multer for form validation file uploads
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `form-validate-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are supported for form validation'));
    }
  },
});

export function createStatsRoutes(): Router {
  const router = Router();

  // Get dashboard statistics
  // NOTE: Uses Document table for stats since OCR processing updates Document records,
  // not the Job table. Job table is legacy and not populated by current OCR workflow.
  router.get('/statistics', optionalAuthSupabase, async (req: Request, res: Response) => {
    try {
      const userId = (req as unknown as { user?: { id: string } }).user?.id;
      const userFilter = userId ? { userId } : {};

      // Get document statistics (OCR processing updates Document table, not Job table)
      const [
        totalDocuments,
        completedDocuments,
        failedDocuments,
        processingDocuments,
        pendingDocuments,
        totalClients,
      ] = await Promise.all([
        prisma.document.count({ where: userFilter }),
        prisma.document.count({ where: { status: 'COMPLETED', ...userFilter } }),
        prisma.document.count({ where: { status: 'FAILED', ...userFilter } }),
        prisma.document.count({ where: { status: 'PROCESSING', ...userFilter } }),
        prisma.document.count({ where: { status: 'PENDING', ...userFilter } }),
        prisma.client.count({ where: userFilter }),
      ]);

      // Calculate today's processed count
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const processedToday = await prisma.document.count({
        where: {
          status: 'COMPLETED',
          processedAt: { gte: today },
          ...userFilter,
        },
      });

      // Calculate average processing time from documents (in seconds)
      const completedDocsWithTime = await prisma.document.findMany({
        where: {
          status: 'COMPLETED',
          processedAt: { not: null },
          ...userFilter,
        },
        select: {
          createdAt: true,
          processedAt: true,
        },
        orderBy: { processedAt: 'desc' },
        take: 100, // Last 100 completed documents
      });

      let averageProcessingTime = 0;
      if (completedDocsWithTime.length > 0) {
        const totalTime = completedDocsWithTime.reduce((acc, doc) => {
          if (doc.processedAt) {
            return acc + (doc.processedAt.getTime() - doc.createdAt.getTime());
          }
          return acc;
        }, 0);
        averageProcessingTime = totalTime / completedDocsWithTime.length / 1000; // Convert to seconds
      }

      // Calculate average confidence from completed documents
      const docsWithConfidence = await prisma.document.findMany({
        where: {
          status: 'COMPLETED',
          confidence: { not: null },
          ...userFilter,
        },
        select: { confidence: true },
        take: 100,
      });

      let averageConfidence = 0;
      if (docsWithConfidence.length > 0) {
        const totalConfidence = docsWithConfidence.reduce(
          (acc, doc) => acc + (doc.confidence || 0),
          0
        );
        averageConfidence = Math.round((totalConfidence / docsWithConfidence.length) * 10) / 10;
      }

      // Calculate success rate
      const totalProcessed = completedDocuments + failedDocuments;
      const successRate =
        totalProcessed > 0 ? Math.round((completedDocuments / totalProcessed) * 1000) / 10 : 0;

      const stats = {
        // Use document counts (named as "jobs" for frontend compatibility)
        totalJobs: totalDocuments,
        completedJobs: completedDocuments,
        failedJobs: failedDocuments,
        inProgress: processingDocuments + pendingDocuments,
        processedToday,
        averageProcessingTime: Math.round(averageProcessingTime * 10) / 10,
        averageConfidence,
        successRate,
        totalClients,
        totalDocuments,
        trends: {
          documents: { value: totalDocuments, change: 0, trend: 'stable' as const },
          processedToday: { value: processedToday, change: 0, trend: 'stable' as const },
          inProgress: {
            value: processingDocuments + pendingDocuments,
            change: 0,
            trend: 'stable' as const,
          },
          failed: { value: failedDocuments, change: 0, trend: 'stable' as const },
        },
      };

      res.json(stats);
    } catch (error) {
      logger.error('Error fetching statistics:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  // Get processing history (documents formatted as jobs for frontend compatibility)
  // NOTE: Uses Document table since OCR processing creates Document records, not Job records.
  router.get('/jobs', optionalAuthSupabase, async (req: Request, res: Response) => {
    try {
      const userId = (req as unknown as { user?: { id: string } }).user?.id;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string;

      // Build where clause for documents
      const whereClause: Record<string, unknown> = userId ? { userId } : {};
      if (status) {
        // Map job status to document status (frontend uses lowercase)
        const statusMap: Record<string, string> = {
          completed: 'COMPLETED',
          failed: 'FAILED',
          processing: 'PROCESSING',
          pending: 'PENDING',
        };
        whereClause.status = statusMap[status.toLowerCase()] || status.toUpperCase();
      }

      const [documents, total] = await Promise.all([
        prisma.document.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            fileName: true,
            fileType: true,
            fileSize: true,
            status: true,
            confidence: true,
            createdAt: true,
            processedAt: true,
            extractedData: true,
          },
        }),
        prisma.document.count({ where: whereClause }),
      ]);

      // Format documents as jobs for frontend compatibility
      const formattedJobs = documents.map((doc) => ({
        id: doc.id,
        type: 'ocr_processing',
        status: doc.status.toLowerCase(), // Frontend expects lowercase
        progress:
          doc.status === 'COMPLETED'
            ? 100
            : doc.status === 'PROCESSING'
              ? 50
              : doc.status === 'FAILED'
                ? 100
                : 0,
        createdAt: doc.createdAt.toISOString(),
        startedAt: doc.createdAt.toISOString(), // Use createdAt as proxy
        completedAt: doc.processedAt?.toISOString(),
        failedAt: doc.status === 'FAILED' ? doc.processedAt?.toISOString() : undefined,
        error: null as string | null, // Documents don't store error message currently
        result: doc.extractedData,
        metadata: {
          fileName: doc.fileName,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
          confidence: doc.confidence,
        },
        documentsCount: 1,
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

  // Get single job/document details
  // NOTE: Queries Document table since OCR creates Document records, not Job records.
  router.get('/jobs/:jobId', optionalAuthSupabase, async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const userId = (req as unknown as { user?: { id: string } }).user?.id;

      // First try to find as a Document
      const document = await prisma.document.findFirst({
        where: {
          id: jobId,
          ...(userId ? { userId } : {}),
        },
      });

      if (document) {
        return res.json({
          id: document.id,
          type: 'ocr_processing',
          status: document.status.toLowerCase(),
          progress:
            document.status === 'COMPLETED'
              ? 100
              : document.status === 'PROCESSING'
                ? 50
                : document.status === 'FAILED'
                  ? 100
                  : 0,
          createdAt: document.createdAt.toISOString(),
          startedAt: document.createdAt.toISOString(),
          completedAt: document.processedAt?.toISOString(),
          failedAt: document.status === 'FAILED' ? document.processedAt?.toISOString() : undefined,
          error: null as string | null,
          result: document.extractedData,
          metadata: {
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            confidence: document.confidence,
          },
          documentsCount: 1,
          processingHistory: [], // Documents don't have separate processing history
        });
      }

      // Fallback to legacy Job table
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

  // NOTE: Job status endpoint moved to jobs.routes.ts which properly checks
  // both Prisma jobs and Bull queues (OCR, document processing, batch)

  // Get templates (real data from database)
  router.get('/templates', optionalAuthSupabase, async (req: Request, res: Response) => {
    try {
      const userId = (req as unknown as { user?: { id: string } }).user?.id;

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
      const userId = (req as unknown as { user?: { id: string } }).user?.id;
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
      const userId = (req as unknown as { user?: { id: string } }).user?.id;

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
      const userId = (req as unknown as { user?: { id: string } }).user?.id;
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
  // Supports both:
  // 1. PDF file upload (multipart/form-data with 'form' field) - extracts fields from PDF
  // 2. Template ID (JSON body with templateId) - returns template fields (legacy)
  router.post(
    '/validate/form',
    authenticateSupabase,
    upload.single('form'),
    async (req: Request, res: Response) => {
      try {
        // Handle PDF file upload (new behavior for frontend)
        if (req.file) {
          const intelliFillService = new IntelliFillService();

          try {
            const fields = await intelliFillService.extractFormFields(req.file.path);

            // Infer field types based on field names
            const fieldTypes: Record<string, string> = {};
            fields.forEach((fieldName: string) => {
              const lowerName = fieldName.toLowerCase();
              if (
                lowerName.includes('date') ||
                lowerName.includes('dob') ||
                lowerName.includes('birth')
              ) {
                fieldTypes[fieldName] = 'date';
              } else if (lowerName.includes('email')) {
                fieldTypes[fieldName] = 'email';
              } else if (
                lowerName.includes('phone') ||
                lowerName.includes('tel') ||
                lowerName.includes('fax')
              ) {
                fieldTypes[fieldName] = 'phone';
              } else if (
                lowerName.includes('check') ||
                lowerName.includes('agree') ||
                lowerName.includes('consent')
              ) {
                fieldTypes[fieldName] = 'checkbox';
              } else if (lowerName.includes('signature') || lowerName.includes('sign')) {
                fieldTypes[fieldName] = 'signature';
              } else if (
                lowerName.includes('amount') ||
                lowerName.includes('price') ||
                lowerName.includes('cost') ||
                lowerName.includes('fee')
              ) {
                fieldTypes[fieldName] = 'number';
              } else if (lowerName.includes('address')) {
                fieldTypes[fieldName] = 'address';
              } else if (lowerName.includes('ssn') || lowerName.includes('social')) {
                fieldTypes[fieldName] = 'ssn';
              } else if (lowerName.includes('zip') || lowerName.includes('postal')) {
                fieldTypes[fieldName] = 'zip';
              } else {
                fieldTypes[fieldName] = 'text';
              }
            });

            // Clean up uploaded file after processing
            await fs.unlink(req.file.path).catch((err) => {
              logger.warn('Failed to clean up uploaded form file:', err);
            });

            return res.json({
              data: {
                fields,
                fieldTypes,
                fieldCount: fields.length,
                isValid: fields.length > 0,
              },
            });
          } catch (extractError) {
            // Clean up file on error
            await fs.unlink(req.file.path).catch(() => {});

            logger.error('Error extracting form fields from PDF:', extractError);
            return res.status(400).json({
              error: 'Failed to extract fields from PDF. Ensure the file is a valid PDF form.',
              details: extractError instanceof Error ? extractError.message : 'Unknown error',
            });
          }
        }

        // Fallback to template-based validation (existing behavior)
        const { templateId } = req.body;

        if (!templateId) {
          return res.status(400).json({
            error: 'Either a form file or templateId is required',
            hint: 'Send a PDF file as multipart/form-data with field name "form", or send JSON with "templateId"',
          });
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
    }
  );

  return router;
}
