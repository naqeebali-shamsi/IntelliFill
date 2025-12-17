import express, { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import multer from 'multer';
import { authenticateSupabase } from '../middleware/supabaseAuth';
import {
  decryptFile,
  decryptExtractedData,
  encryptExtractedData,
} from '../middleware/encryptionMiddleware';
import { FieldMapper } from '../mappers/FieldMapper';
import { FormFiller } from '../fillers/FormFiller';
import { logger } from '../utils/logger';
import { getOCRJobStatus, getOCRQueueHealth, enqueueDocumentForOCR } from '../queues/ocrQueue';
import { getJobStatus } from '../queues/documentQueue';

const prisma = new PrismaClient();

// Allowed document types for upload
const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif'];
const ALLOWED_MIMETYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff'];

// Multer config for document upload (PDFs and images)
const documentUpload = multer({
  dest: 'uploads/documents/',
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext) || ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
  },
});

// Multer config for form upload (PDF only)
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF forms are supported'));
    }
  },
});

export function createDocumentRoutes(): Router {
  const router = Router();

  /**
   * GET /api/documents - List user's documents
   * Phase 6 Complete: Uses Supabase-only authentication
   */
  router.get('/', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { type, search, limit = 50 } = req.query;

      const documents = await prisma.document.findMany({
        where: {
          userId,
          ...(type && { fileType: type as string }),
          ...(search && {
            fileName: {
              contains: search as string,
              mode: 'insensitive',
            },
          }),
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        select: {
          id: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          status: true,
          confidence: true,
          createdAt: true,
          processedAt: true,
        },
      });

      res.json({ success: true, documents });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/documents - Upload document(s) for OCR processing
   * Accepts PDFs and images, queues them for OCR extraction
   */
  router.post(
    '/',
    authenticateSupabase,
    documentUpload.array('documents', 10),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id;
        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
          return res.status(400).json({ error: 'At least one document file is required' });
        }

        const results = [];

        for (const file of files) {
          // Create document record
          const document = await prisma.document.create({
            data: {
              userId,
              fileName: file.originalname,
              fileType: file.mimetype,
              fileSize: file.size,
              storageUrl: file.path,
              status: 'PENDING',
            },
          });

          // Queue for OCR processing
          const job = await enqueueDocumentForOCR(document.id, userId, file.path);

          if (job) {
            results.push({
              documentId: document.id,
              fileName: file.originalname,
              jobId: job.id,
              status: 'queued',
              statusUrl: `/api/documents/${document.id}/status`,
            });

            logger.info('Document queued for OCR', {
              documentId: document.id,
              jobId: job.id,
              fileName: file.originalname,
            });
          } else {
            // OCR not needed (e.g., native PDF with text) - mark as completed
            await prisma.document.update({
              where: { id: document.id },
              data: { status: 'COMPLETED' },
            });

            results.push({
              documentId: document.id,
              fileName: file.originalname,
              jobId: '',
              status: 'completed',
              statusUrl: `/api/documents/${document.id}/status`,
            });

            logger.info('Document processed without OCR (native text)', {
              documentId: document.id,
              fileName: file.originalname,
            });
          }
        }

        res.status(201).json({
          success: true,
          message: `${results.length} document(s) queued for processing`,
          documents: results,
        });
      } catch (error) {
        logger.error('Document upload error:', error);
        next(error);
      }
    }
  );

  /**
   * GET /api/documents/:id - Get single document details
   * Phase 6 Complete: Uses Supabase-only authentication
   */
  router.get(
    '/:id',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id;
        const { id } = req.params;

        const document = await prisma.document.findFirst({
          where: { id, userId },
        });

        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }

        // Decrypt extractedData if it exists
        let extractedData = null;
        if (document.extractedData) {
          extractedData = decryptExtractedData(document.extractedData as string);
        }

        res.json({
          success: true,
          document: {
            ...document,
            extractedData,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/documents/:id/data - Get extracted data only (for form filling)
   * Phase 6 Complete: Uses Supabase-only authentication
   */
  router.get(
    '/:id/data',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id;
        const { id } = req.params;

        const document = await prisma.document.findFirst({
          where: { id, userId },
          select: { extractedData: true, fileName: true, status: true },
        });

        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }

        if (document.status !== 'COMPLETED') {
          return res.status(400).json({ error: 'Document processing not completed' });
        }

        const extractedData = document.extractedData
          ? decryptExtractedData(document.extractedData as string)
          : null;

        res.json({
          success: true,
          fileName: document.fileName,
          data: extractedData,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/documents/:id/fill - Fill a new form using stored document data
   * Phase 6 Complete: Uses Supabase-only authentication
   */
  router.post(
    '/:id/fill',
    authenticateSupabase,
    upload.single('form'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id;
        const { id } = req.params;

        // Get document with extracted data
        const document = await prisma.document.findFirst({
          where: { id, userId },
          select: { extractedData: true, fileName: true, status: true },
        });

        if (!document) {
          return res.status(404).json({ error: 'Source document not found' });
        }

        if (document.status !== 'COMPLETED' || !document.extractedData) {
          return res.status(400).json({ error: 'Document has no extracted data' });
        }

        if (!req.file) {
          return res.status(400).json({ error: 'Form file is required' });
        }

        // Decrypt extracted data
        const extractedData = decryptExtractedData(document.extractedData as string);

        // Initialize services
        const fieldMapper = new FieldMapper();
        const formFiller = new FormFiller();

        // Process form
        const formPath = req.file.path;
        const outputPath = path.join('outputs', `filled-${Date.now()}-${req.file.originalname}`);

        // Get form fields and map data
        const formFieldsInfo = await formFiller.validateFormFields(formPath);
        const mappingResult = await fieldMapper.mapFields(extractedData, formFieldsInfo.fields);

        // Fill form
        const fillResult = await formFiller.fillPDFForm(formPath, mappingResult, outputPath);

        // Get file size
        const stats = await fs.stat(outputPath);

        // Save filled document
        const filledDoc = await prisma.document.create({
          data: {
            userId,
            fileName: `filled-${req.file.originalname}`,
            fileType: 'application/pdf',
            fileSize: stats.size,
            storageUrl: outputPath,
            status: 'COMPLETED',
            confidence: mappingResult.overallConfidence,
          },
        });

        // Cleanup temp form file
        await fs.unlink(formPath).catch(() => {});

        res.json({
          success: true,
          documentId: filledDoc.id,
          confidence: mappingResult.overallConfidence,
          filledFields: fillResult.filledFields.length,
          downloadUrl: `/api/documents/${filledDoc.id}/download`,
          warnings: fillResult.warnings,
        });
      } catch (error) {
        logger.error('Fill form error:', error);
        next(error);
      }
    }
  );

  /**
   * GET /api/documents/:id/download - Download filled PDF
   * Phase 6 Complete: Uses Supabase-only authentication
   */
  router.get(
    '/:id/download',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id;
        const { id } = req.params;

        const document = await prisma.document.findFirst({
          where: { id, userId },
        });

        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }

        // Read encrypted file
        const filePath = path.join(process.cwd(), document.storageUrl);
        const encryptedBuffer = await fs.readFile(filePath);

        // Decrypt file
        const decryptedBuffer = decryptFile(encryptedBuffer);

        // Set headers for download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
        res.setHeader('Content-Length', decryptedBuffer.length);

        res.send(decryptedBuffer);
      } catch (error) {
        logger.error('Download error:', error);
        next(error);
      }
    }
  );

  /**
   * GET /api/documents/:id/status - Get document processing status
   * Returns status of document processing job including OCR progress
   */
  router.get(
    '/:id/status',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id;
        const { id } = req.params;

        // Get document from database
        const document = await prisma.document.findFirst({
          where: { id, userId },
          select: {
            id: true,
            fileName: true,
            status: true,
            confidence: true,
            processedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }

        // Try to find associated job status
        let jobStatus = null;
        let queueHealth = null;

        try {
          // Check document queue for job status
          const docJobStatus = await getJobStatus(id);
          if (docJobStatus) {
            jobStatus = docJobStatus;
          } else {
            // Check OCR queue specifically
            const ocrJobStatus = await getOCRJobStatus(id);
            if (ocrJobStatus) {
              jobStatus = ocrJobStatus;
            }
          }

          // Get queue health for monitoring
          queueHealth = await getOCRQueueHealth();
        } catch (queueError) {
          logger.warn('Failed to fetch queue status:', queueError);
          // Continue without job status if queue is unavailable
        }

        res.json({
          success: true,
          document: {
            id: document.id,
            fileName: document.fileName,
            status: document.status,
            confidence: document.confidence,
            processedAt: document.processedAt,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
          },
          job: jobStatus,
          queue: queueHealth,
        });
      } catch (error) {
        logger.error('Status check error:', error);
        next(error);
      }
    }
  );

  /**
   * DELETE /api/documents/:id - Delete document and file
   * Phase 6 Complete: Uses Supabase-only authentication
   */
  router.delete(
    '/:id',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id;
        const { id } = req.params;

        const document = await prisma.document.findFirst({
          where: { id, userId },
        });

        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }

        // Delete file from disk
        try {
          const filePath = path.join(process.cwd(), document.storageUrl);
          await fs.unlink(filePath);
        } catch (error) {
          logger.warn('Failed to delete file:', error);
        }

        // Delete from database
        await prisma.document.delete({ where: { id } });

        res.json({ success: true, message: 'Document deleted' });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/documents/:id/reprocess - Reprocess single document with higher quality OCR
   */
  router.post(
    '/:id/reprocess',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id;
        const { id } = req.params;

        const { DocumentService } = await import('../services/DocumentService');
        const documentService = new DocumentService();

        const job = await documentService.reprocessDocument(id, userId);

        res.json({
          success: true,
          message: 'Document queued for reprocessing',
          jobId: job.id,
          documentId: id,
          statusUrl: `/api/documents/${id}/status`,
        });
      } catch (error) {
        logger.error('Reprocess document error:', error);
        next(error);
      }
    }
  );

  /**
   * POST /api/documents/reprocess/batch - Batch reprocess multiple documents
   */
  router.post(
    '/reprocess/batch',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id;
        const { documentIds } = req.body;

        if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
          return res.status(400).json({ error: 'documentIds array is required' });
        }

        const { DocumentService } = await import('../services/DocumentService');
        const documentService = new DocumentService();

        const jobs = await documentService.batchReprocess(documentIds, userId);

        res.json({
          success: true,
          message: `${jobs.length} documents queued for reprocessing`,
          jobs: jobs.map((job) => ({
            jobId: job.id,
            documentId: job.data.documentId,
          })),
          totalQueued: jobs.length,
        });
      } catch (error) {
        logger.error('Batch reprocess error:', error);
        next(error);
      }
    }
  );

  /**
   * GET /api/documents/low-confidence - Get documents with confidence below threshold
   */
  router.get(
    '/low-confidence',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id;
        const { threshold = 0.7 } = req.query;

        const { DocumentService } = await import('../services/DocumentService');
        const documentService = new DocumentService();

        const documents = await documentService.getLowConfidenceDocuments(
          userId,
          parseFloat(threshold as string)
        );

        res.json({
          success: true,
          documents,
          count: documents.length,
        });
      } catch (error) {
        logger.error('Get low confidence documents error:', error);
        next(error);
      }
    }
  );

  /**
   * GET /api/documents/:id/reprocessing-history - Get reprocessing history for a document
   */
  router.get(
    '/:id/reprocessing-history',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id;
        const { id } = req.params;

        const { DocumentService } = await import('../services/DocumentService');
        const documentService = new DocumentService();

        const history = await documentService.getReprocessingHistory(id, userId);

        res.json({
          success: true,
          ...history,
        });
      } catch (error) {
        logger.error('Get reprocessing history error:', error);
        next(error);
      }
    }
  );

  return router;
}
