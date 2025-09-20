import express, { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { IntelliFillService } from '../services/IntelliFillService';
import { logger } from '../utils/logger';
import { ValidationRule } from '../validators/ValidationService';
import { createAuthRoutes } from './auth.routes';
import { createStatsRoutes } from './stats.routes';
import { neonAuthRouter } from './neon-auth.routes';
import { DatabaseService } from '../database/DatabaseService';
import { authenticate, optionalAuth } from '../middleware/auth';

const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.doc', '.txt', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not supported`));
    }
  }
});

export function setupRoutes(app: express.Application, intelliFillService: IntelliFillService, db?: DatabaseService): void {
  const router = Router();

  // Setup authentication routes
  if (db) {
    const authRoutes = createAuthRoutes({ db });
    app.use('/api/auth', authRoutes);
    
    // Setup Neon auth routes
    app.use('/api/neon-auth', neonAuthRouter);
    
    // Setup stats and dashboard routes
    const statsRoutes = createStatsRoutes(db);
    app.use('/api', statsRoutes);
  }

  // Health check
  router.get('/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Ready check - verifies all services are operational
  router.get('/ready', async (req: Request, res: Response) => {
    try {
      const checks = {
        database: false,
        redis: false,
        filesystem: false
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
        const fs = require('fs').promises;
        await fs.access('uploads/', fs.constants.W_OK);
        checks.filesystem = true;
      } catch (error) {
        logger.error('Filesystem health check failed:', error);
      }

      // TODO: Add Redis check when implemented
      checks.redis = true; // Placeholder for now

      const allHealthy = Object.values(checks).every(check => check === true);
      
      if (allHealthy) {
        res.json({ 
          status: 'ready',
          checks,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(503).json({ 
          status: 'not ready',
          checks,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      res.status(503).json({ 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Process single document and form (protected route)
  router.post('/process/single',
    authenticate,
    upload.fields([
      { name: 'document', maxCount: 1 },
      { name: 'form', maxCount: 1 }
    ]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        
        if (!files.document || !files.form) {
          return res.status(400).json({ error: 'Both document and form files are required' });
        }

        const documentPath = files.document[0].path;
        const formPath = files.form[0].path;
        const outputPath = `outputs/filled_${Date.now()}.pdf`;

        const result = await intelliFillService.processSingle(
          documentPath,
          formPath,
          outputPath
        );

        if (result.success) {
          res.json({
            success: true,
            message: 'PDF form filled successfully',
            data: {
              outputPath: result.fillResult.outputPath,
              filledFields: result.fillResult.filledFields,
              confidence: result.mappingResult.overallConfidence,
              processingTime: result.processingTime,
              warnings: result.fillResult.warnings
            }
          });
        } else {
          res.status(400).json({
            success: false,
            message: 'Failed to fill PDF form',
            errors: result.errors,
            warnings: result.fillResult.warnings
          });
        }
      } catch (error) {
        next(error);
      }
    }
  );

  // Process multiple documents and single form
  router.post('/process/multiple',
    authenticate,
    upload.fields([
      { name: 'documents', maxCount: 10 },
      { name: 'form', maxCount: 1 }
    ]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        
        if (!files.documents || !files.form) {
          return res.status(400).json({ error: 'Documents and form file are required' });
        }

        const documentPaths = files.documents.map(f => f.path);
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
              documentCount: documentPaths.length
            }
          });
        } else {
          res.status(400).json({
            success: false,
            message: 'Failed to fill PDF forms',
            errors: result.errors,
            warnings: result.fillResult.warnings
          });
        }
      } catch (error) {
        next(error);
      }
    }
  );

  // Batch process with different forms for each document
  router.post('/process/batch',
    authenticate,
    upload.fields([
      { name: 'documents', maxCount: 20 },
      { name: 'forms', maxCount: 20 }
    ]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        
        if (!files.documents || !files.forms) {
          return res.status(400).json({ error: 'Documents and forms are required' });
        }

        if (files.documents.length !== files.forms.length) {
          return res.status(400).json({ 
            error: 'Number of documents must match number of forms' 
          });
        }

        const jobs = files.documents.map((doc, i) => ({
          documents: [doc.path],
          form: files.forms[i].path,
          output: `outputs/batch_${Date.now()}_${i}.pdf`
        }));

        const results = await intelliFillService.batchProcess(jobs);

        res.json({
          success: true,
          message: 'Batch processing completed',
          data: {
            totalJobs: jobs.length,
            successfulJobs: results.filter(r => r.success).length,
            failedJobs: results.filter(r => !r.success).length,
            results: results
          }
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Get form fields
  router.post('/form/fields',
    optionalAuth,
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
            fieldCount: fields.length
          }
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Validate document data
  router.post('/validate',
    authenticate,
    upload.single('document'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'Document file is required' });
        }

        const validationResult = await intelliFillService.validateDocument(
          req.file.path
        );

        res.json({
          success: validationResult.valid,
          data: validationResult
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Mount all routes under /api
  app.use('/api', router);
}