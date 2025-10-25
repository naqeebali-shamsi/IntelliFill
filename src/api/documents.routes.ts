import express, { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { dualAuthenticate } from '../middleware/dualAuth';
import { decryptFile, decryptExtractedData, encryptExtractedData } from '../middleware/encryptionMiddleware';
import { FieldMapper } from '../mappers/FieldMapper';
import { FormFiller } from '../fillers/FormFiller';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Multer config for form upload
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
  }
});

export function createDocumentRoutes(): Router {
  const router = Router();

  /**
   * GET /api/documents - List user's documents
   * Phase 4 SDK Migration: Uses dualAuthenticate to support both Supabase and legacy JWT tokens
   */
  router.get('/', dualAuthenticate, async (req: Request, res: Response, next: NextFunction) => {
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
              mode: 'insensitive'
            }
          })
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
          processedAt: true
        }
      });

      res.json({ success: true, documents });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/documents/:id - Get single document details
   * Phase 4 SDK Migration: Uses dualAuthenticate to support both Supabase and legacy JWT tokens
   */
  router.get('/:id', dualAuthenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      const document = await prisma.document.findFirst({
        where: { id, userId }
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
          extractedData
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/documents/:id/data - Get extracted data only (for form filling)
   * Phase 4 SDK Migration: Uses dualAuthenticate to support both Supabase and legacy JWT tokens
   */
  router.get('/:id/data', dualAuthenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      const document = await prisma.document.findFirst({
        where: { id, userId },
        select: { extractedData: true, fileName: true, status: true }
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
        data: extractedData
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/documents/:id/fill - Fill a new form using stored document data
   * Phase 4 SDK Migration: Uses dualAuthenticate to support both Supabase and legacy JWT tokens
   */
  router.post('/:id/fill',
    dualAuthenticate,
    upload.single('form'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id;
        const { id } = req.params;

        // Get document with extracted data
        const document = await prisma.document.findFirst({
          where: { id, userId },
          select: { extractedData: true, fileName: true, status: true }
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
            confidence: mappingResult.overallConfidence
          }
        });

        // Cleanup temp form file
        await fs.unlink(formPath).catch(() => {});

        res.json({
          success: true,
          documentId: filledDoc.id,
          confidence: mappingResult.overallConfidence,
          filledFields: fillResult.filledFields.length,
          downloadUrl: `/api/documents/${filledDoc.id}/download`,
          warnings: fillResult.warnings
        });
      } catch (error) {
        logger.error('Fill form error:', error);
        next(error);
      }
    });

  /**
   * GET /api/documents/:id/download - Download filled PDF
   * Phase 4 SDK Migration: Uses dualAuthenticate to support both Supabase and legacy JWT tokens
   */
  router.get('/:id/download', dualAuthenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      const document = await prisma.document.findFirst({
        where: { id, userId }
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
  });

  /**
   * DELETE /api/documents/:id - Delete document and file
   * Phase 4 SDK Migration: Uses dualAuthenticate to support both Supabase and legacy JWT tokens
   */
  router.delete('/:id', dualAuthenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      const document = await prisma.document.findFirst({
        where: { id, userId }
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
  });

  return router;
}
