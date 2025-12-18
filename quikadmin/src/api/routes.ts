import express, { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { IntelliFillService } from '../services/IntelliFillService';
import { logger } from '../utils/logger';
import { ValidationRule } from '../validators/ValidationService';
import { createSupabaseAuthRoutes } from './supabase-auth.routes';
import { createStatsRoutes } from './stats.routes';
import { createDocumentRoutes } from './documents.routes';
import { createUserRoutes } from './users.routes';
import { createTemplateRoutes } from './template.routes';
import { createClientRoutes } from './clients.routes';
import { createClientDocumentRoutes } from './client-documents.routes';
import { createFormTemplateRoutes } from './form-template.routes';
import { createFilledFormRoutes } from './filled-forms.routes';
import { createKnowledgeRoutes } from './knowledge.routes';
import { DatabaseService } from '../database/DatabaseService';
import { authenticateSupabase, optionalAuthSupabase } from '../middleware/supabaseAuth';
import { encryptUploadedFiles, encryptExtractedData } from '../middleware/encryptionMiddleware';
import { validateFilePath } from '../utils/encryption';

const prisma = new PrismaClient();

// Configure multer storage to preserve file extensions
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    // Generate unique filename but preserve extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      '.pdf',
      '.docx',
      '.doc',
      '.txt',
      '.csv',
      '.jpeg',
      '.jpg',
      '.png',
      '.gif',
      '.webp',
    ];
    const ext = path.extname(file.originalname).toLowerCase();

    try {
      // Validate filename for path traversal
      validateFilePath(file.originalname);

      if (allowedTypes.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${ext} not supported`));
      }
    } catch (error) {
      cb(error as Error);
    }
  },
});

export function setupRoutes(
  app: express.Application,
  intelliFillService: IntelliFillService,
  db?: DatabaseService
): void {
  const router = Router();

  // Setup authentication routes
  if (db) {
    // Supabase auth routes (Phase 6 - Production Ready)
    // Mounted at /api/auth/v2
    // All authentication uses Supabase Auth SDK
    const supabaseAuthRoutes = createSupabaseAuthRoutes();
    app.use('/api/auth/v2', supabaseAuthRoutes);

    // Setup stats and dashboard routes
    const statsRoutes = createStatsRoutes(db);
    app.use('/api', statsRoutes);
  }

  // Setup document management routes
  const documentRoutes = createDocumentRoutes();
  app.use('/api/documents', documentRoutes);

  // Setup user routes (Phase 4B - User data aggregation)
  const userRoutes = createUserRoutes();
  app.use('/api/users', userRoutes);

  // Setup template routes (Task 7 - Template Save/Load System)
  const templateRoutes = createTemplateRoutes();
  app.use('/api/templates', templateRoutes);

  // Setup client routes (Task 6 - Client CRUD)
  const clientRoutes = createClientRoutes();
  app.use('/api/clients', clientRoutes);

  // Setup client document routes (Task 7 - Client-Scoped Document Endpoints)
  // Mounted as nested route under clients for client-scoped document management
  const clientDocumentRoutes = createClientDocumentRoutes();
  app.use('/api/clients/:clientId/documents', clientDocumentRoutes);

  // Setup form template routes (Task 10 - Form Templates with field mappings)
  const formTemplateRoutes = createFormTemplateRoutes();
  app.use('/api/form-templates', formTemplateRoutes);

  // Setup filled forms routes (Task 11 - Form Generation)
  const filledFormRoutes = createFilledFormRoutes();
  app.use('/api/filled-forms', filledFormRoutes);
  // Setup knowledge base routes (Vector Search - Phase 3)  // Mounted at /api/knowledge for vector search and document source management  const knowledgeRoutes = createKnowledgeRoutes();  app.use('/api/knowledge', knowledgeRoutes);

  // Health check
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // Ready check - verifies all services are operational
  router.get('/ready', async (req: Request, res: Response) => {
    try {
      const checks = {
        database: false,
        redis: false,
        filesystem: false,
      };

      // Check database if available
      if (db) {
        try {
          await db.query('SELECT 1');
          checks.database = true;
        } catch (error) {
          logger.error('Database health check failed:', error);
        }
      }

      // Check filesystem
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs').promises;
        await fs.access('uploads/', fs.constants.W_OK);
        checks.filesystem = true;
      } catch (error) {
        logger.error('Filesystem health check failed:', error);
      }

      // Check Redis
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { connected, client } = require('../middleware/rateLimiter').getRedisHealth();
        if (connected && client) {
          await client.ping();
          checks.redis = true;
        }
      } catch (error) {
        logger.error('Redis health check failed:', error);
      }

      const allHealthy = Object.values(checks).every((check) => check === true);

      if (allHealthy) {
        res.json({
          status: 'ready',
          checks,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(503).json({
          status: 'not ready',
          checks,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      res.status(503).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Process single document and form (protected route)
  // Phase 6 Complete: Uses Supabase-only authentication
  // Note: Files are NOT encrypted during processing to allow PDF parsing
  // Only the extracted data stored in the database is encrypted
  router.post(
    '/process/single',
    authenticateSupabase,
    upload.fields([
      { name: 'document', maxCount: 1 },
      { name: 'form', maxCount: 1 },
    ]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        if (!files.document || !files.form) {
          return res.status(400).json({ error: 'Both document and form files are required' });
        }

        const documentFile = files.document[0];
        const formFile = files.form[0];

        // Step 1: Create document record BEFORE processing
        const document = await prisma.document.create({
          data: {
            userId,
            fileName: documentFile.originalname,
            fileType: documentFile.mimetype,
            fileSize: documentFile.size,
            storageUrl: documentFile.path,
            status: 'PROCESSING',
          },
        });

        try {
          const documentPath = documentFile.path;
          const formPath = formFile.path;
          const outputPath = `outputs/filled_${document.id}_${Date.now()}.pdf`;

          // Step 2: Process the document
          const result = await intelliFillService.processSingle(documentPath, formPath, outputPath);

          if (result.success) {
            // Step 3: Update document with extracted data (encrypted)
            const encryptedData = encryptExtractedData(result.mappingResult);

            await prisma.document.update({
              where: { id: document.id },
              data: {
                extractedData: encryptedData,
                status: 'COMPLETED',
                confidence: result.mappingResult.overallConfidence,
                processedAt: new Date(),
              },
            });

            res.json({
              success: true,
              message: 'PDF form filled successfully',
              data: {
                documentId: document.id,
                outputPath: result.fillResult.outputPath,
                filledFields: result.fillResult.filledFields,
                confidence: result.mappingResult.overallConfidence,
                processingTime: result.processingTime,
                warnings: result.fillResult.warnings,
              },
            });
          } else {
            // Update status to FAILED
            await prisma.document.update({
              where: { id: document.id },
              data: { status: 'FAILED' },
            });

            res.status(400).json({
              success: false,
              message: 'Failed to fill PDF form',
              errors: result.errors,
              warnings: result.fillResult.warnings,
            });
          }
        } catch (processingError) {
          // Update status to FAILED on error
          await prisma.document.update({
            where: { id: document.id },
            data: { status: 'FAILED' },
          });
          throw processingError;
        }
      } catch (error) {
        next(error);
      }
    }
  );

  // Process multiple documents and single form
  // Phase 6 Complete: Uses Supabase-only authentication
  router.post(
    '/process/multiple',
    authenticateSupabase,
    upload.fields([
      { name: 'documents', maxCount: 10 },
      { name: 'form', maxCount: 1 },
    ]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        if (!files.documents || !files.form) {
          return res.status(400).json({ error: 'Documents and form file are required' });
        }

        const documentPaths = files.documents.map((f) => f.path);
        const formPath = files.form[0].path;
        const outputPath = `outputs/filled_${Date.now()}.pdf`;

        const result = await intelliFillService.processMultiple(
          documentPaths,
          formPath,
          outputPath
        );

        if (result.success) {
          res.json({
            success: true,
            message: 'PDF forms filled successfully',
            data: {
              outputPath: result.fillResult.outputPath,
              filledFields: result.fillResult.filledFields,
              confidence: result.mappingResult.overallConfidence,
              processingTime: result.processingTime,
              warnings: result.fillResult.warnings,
              documentCount: documentPaths.length,
            },
          });
        } else {
          res.status(400).json({
            success: false,
            message: 'Failed to fill PDF forms',
            errors: result.errors,
            warnings: result.fillResult.warnings,
          });
        }
      } catch (error) {
        next(error);
      }
    }
  );

  // Batch process with different forms for each document
  // Phase 6 Complete: Uses Supabase-only authentication
  router.post(
    '/process/batch',
    authenticateSupabase,
    upload.fields([
      { name: 'documents', maxCount: 20 },
      { name: 'forms', maxCount: 20 },
    ]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        if (!files.documents || !files.forms) {
          return res.status(400).json({ error: 'Documents and forms are required' });
        }

        if (files.documents.length !== files.forms.length) {
          return res.status(400).json({
            error: 'Number of documents must match number of forms',
          });
        }

        const jobs = files.documents.map((doc, i) => ({
          documents: [doc.path],
          form: files.forms[i].path,
          output: `outputs/batch_${Date.now()}_${i}.pdf`,
        }));

        const results = await intelliFillService.batchProcess(jobs);

        res.json({
          success: true,
          message: 'Batch processing completed',
          data: {
            totalJobs: jobs.length,
            successfulJobs: results.filter((r) => r.success).length,
            failedJobs: results.filter((r) => !r.success).length,
            results: results,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Get form fields
  // Phase 6 Complete: Uses Supabase-only optional authentication
  router.post(
    '/form/fields',
    optionalAuthSupabase,
    upload.single('form'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'Form file is required' });
        }

        const fields = await intelliFillService.extractFormFields(req.file.path);

        res.json({
          success: true,
          data: {
            fields: fields,
            fieldCount: fields.length,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Validate document data
  // Phase 6 Complete: Uses Supabase-only authentication
  router.post(
    '/validate',
    authenticateSupabase,
    upload.single('document'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'Document file is required' });
        }

        const validationResult = await intelliFillService.validateDocument(req.file.path);

        res.json({
          success: validationResult.valid,
          data: validationResult,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Mount all routes under /api
  app.use('/api', router);
}
