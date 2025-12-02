/**
 * Client Document API Routes
 *
 * Manages documents belonging to specific clients
 * Documents are uploaded, categorized, and extracted for client profiles
 *
 * Task 7: API: Document Endpoints (Client-Scoped)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateSupabase } from '../middleware/supabaseAuth';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { DocumentCategory, ClientDocumentStatus, ExtractionStatus } from '@prisma/client';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { OCRService } from '../services/OCRService';
import { enqueueDocumentForOCR, getOCRJobStatus } from '../queues/ocrQueue';

// Configure multer for document uploads
const storage = multer.diskStorage({
  destination: 'uploads/client-documents/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `doc-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not supported. Allowed: ${allowedTypes.join(', ')}`));
    }
  }
});

// Validation schemas
const uploadDocumentSchema = z.object({
  category: z.enum([
    'PASSPORT', 'EMIRATES_ID', 'TRADE_LICENSE', 'VISA',
    'LABOR_CARD', 'ESTABLISHMENT_CARD', 'MOA', 'BANK_STATEMENT', 'OTHER'
  ]).optional()
});

const updateDocumentSchema = z.object({
  category: z.enum([
    'PASSPORT', 'EMIRATES_ID', 'TRADE_LICENSE', 'VISA',
    'LABOR_CARD', 'ESTABLISHMENT_CARD', 'MOA', 'BANK_STATEMENT', 'OTHER'
  ]).optional().nullable()
});

const listDocumentsSchema = z.object({
  category: z.enum([
    'PASSPORT', 'EMIRATES_ID', 'TRADE_LICENSE', 'VISA',
    'LABOR_CARD', 'ESTABLISHMENT_CARD', 'MOA', 'BANK_STATEMENT', 'OTHER'
  ]).optional(),
  status: z.enum(['UPLOADED', 'PROCESSING', 'EXTRACTED', 'FAILED']).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0)
});

export function createClientDocumentRoutes(): Router {
  const router = Router({ mergeParams: true }); // Enable access to :clientId from parent

  // Ensure uploads directory exists
  fs.mkdir('uploads/client-documents', { recursive: true }).catch(() => {});

  /**
   * POST /api/clients/:clientId/documents - Upload a document for a client
   */
  router.post('/', authenticateSupabase, upload.single('document'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { clientId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Document file is required' });
      }

      // Verify client belongs to user
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId }
      });

      if (!client) {
        // Clean up uploaded file
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(404).json({ error: 'Client not found' });
      }

      // Validate category from body
      const validation = uploadDocumentSchema.safeParse(req.body);
      if (!validation.success) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors
        });
      }

      const { category } = validation.data;

      // Create document record
      const document = await prisma.clientDocument.create({
        data: {
          clientId,
          userId,
          fileName: req.file.originalname,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          storageUrl: req.file.path,
          category: category as DocumentCategory || null,
          status: 'UPLOADED'
        }
      });

      logger.info(`Document uploaded for client ${clientId}: ${document.id}`);

      res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        data: {
          document: {
            id: document.id,
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            category: document.category,
            status: document.status,
            createdAt: document.createdAt.toISOString()
          }
        }
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      logger.error('Error uploading document:', error);
      next(error);
    }
  });

  /**
   * GET /api/clients/:clientId/documents - List all documents for a client
   */
  router.get('/', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { clientId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Verify client belongs to user
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId }
      });

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // Validate query params
      const validation = listDocumentsSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: validation.error.flatten().fieldErrors
        });
      }

      const { category, status, limit, offset } = validation.data;

      // Build where clause
      const whereClause: any = { clientId };
      if (category) whereClause.category = category;
      if (status) whereClause.status = status;

      const [documents, total] = await Promise.all([
        prisma.clientDocument.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          include: {
            extractedData: {
              select: {
                id: true,
                status: true,
                extractedAt: true
              }
            }
          }
        }),
        prisma.clientDocument.count({ where: whereClause })
      ]);

      const formattedDocuments = documents.map(doc => ({
        id: doc.id,
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        category: doc.category,
        status: doc.status,
        hasExtractedData: !!doc.extractedData,
        extractionStatus: doc.extractedData?.status || null,
        extractedAt: doc.extractedData?.extractedAt?.toISOString() || null,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString()
      }));

      res.json({
        success: true,
        data: {
          clientId,
          clientName: client.name,
          documents: formattedDocuments,
          pagination: {
            total,
            limit,
            offset,
            hasMore: (offset + limit) < total
          }
        }
      });
    } catch (error) {
      logger.error('Error listing client documents:', error);
      next(error);
    }
  });

  /**
   * GET /api/clients/:clientId/documents/:documentId - Get a single document
   */
  router.get('/:documentId', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { clientId, documentId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Verify client belongs to user
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId }
      });

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const document = await prisma.clientDocument.findFirst({
        where: { id: documentId, clientId },
        include: {
          extractedData: true
        }
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      res.json({
        success: true,
        data: {
          document: {
            id: document.id,
            clientId: document.clientId,
            fileName: document.fileName,
            fileType: document.fileType,
            fileSize: document.fileSize,
            storageUrl: document.storageUrl,
            category: document.category,
            status: document.status,
            extractedData: document.extractedData ? {
              id: document.extractedData.id,
              rawText: document.extractedData.rawText,
              fields: document.extractedData.fields,
              status: document.extractedData.status,
              extractedAt: document.extractedData.extractedAt?.toISOString(),
              reviewedAt: document.extractedData.reviewedAt?.toISOString()
            } : null,
            createdAt: document.createdAt.toISOString(),
            updatedAt: document.updatedAt.toISOString()
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching document:', error);
      next(error);
    }
  });

  /**
   * PUT /api/clients/:clientId/documents/:documentId - Update document metadata
   */
  router.put('/:documentId', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { clientId, documentId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Verify client belongs to user
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId }
      });

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // Validate request body
      const validation = updateDocumentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors
        });
      }

      // Check document exists
      const existing = await prisma.clientDocument.findFirst({
        where: { id: documentId, clientId }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const { category } = validation.data;

      const document = await prisma.clientDocument.update({
        where: { id: documentId },
        data: { category: category as DocumentCategory || null }
      });

      logger.info(`Document updated: ${documentId} for client ${clientId}`);

      res.json({
        success: true,
        message: 'Document updated successfully',
        data: {
          document: {
            id: document.id,
            fileName: document.fileName,
            category: document.category,
            updatedAt: document.updatedAt.toISOString()
          }
        }
      });
    } catch (error) {
      logger.error('Error updating document:', error);
      next(error);
    }
  });

  /**
   * DELETE /api/clients/:clientId/documents/:documentId - Delete a document
   */
  router.delete('/:documentId', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { clientId, documentId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Verify client belongs to user
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId }
      });

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // Check document exists
      const document = await prisma.clientDocument.findFirst({
        where: { id: documentId, clientId }
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Delete file from storage
      if (document.storageUrl) {
        await fs.unlink(document.storageUrl).catch((err) => {
          logger.warn(`Failed to delete document file: ${document.storageUrl}`, err);
        });
      }

      // Delete document record (cascade handles extracted data)
      await prisma.clientDocument.delete({
        where: { id: documentId }
      });

      logger.info(`Document deleted: ${documentId} for client ${clientId}`);

      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting document:', error);
      next(error);
    }
  });

  /**
   * POST /api/clients/:clientId/documents/:documentId/extract - Trigger OCR extraction
   * Task 8: OCR Extraction Endpoint
   *
   * This endpoint performs OCR on the document and extracts structured data.
   * Options:
   * - sync=true: Process synchronously and return results (for small documents)
   * - sync=false: Queue for background processing (default, for large documents)
   * - mergeToProfile=true: Automatically merge extracted fields to client profile (default)
   */
  router.post('/:documentId/extract', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { clientId, documentId } = req.params;
      const { sync = false, mergeToProfile = true, forceReprocess = false } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Verify client belongs to user
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId },
        include: { profile: true }
      });

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // Check document exists
      const document = await prisma.clientDocument.findFirst({
        where: { id: documentId, clientId },
        include: { extractedData: true }
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Check if already extracted and not forcing reprocess
      if (document.extractedData && document.extractedData.status === 'COMPLETED' && !forceReprocess) {
        return res.status(200).json({
          success: true,
          message: 'Document already extracted',
          data: {
            documentId,
            extractedDataId: document.extractedData.id,
            status: document.extractedData.status,
            fields: document.extractedData.fields,
            extractedAt: document.extractedData.extractedAt?.toISOString()
          }
        });
      }

      // Check if file exists
      try {
        await fs.access(document.storageUrl);
      } catch {
        return res.status(404).json({ error: 'Document file not found on disk' });
      }

      // Update document status to processing
      await prisma.clientDocument.update({
        where: { id: documentId },
        data: { status: 'PROCESSING' }
      });

      // Create or update extracted data record
      let extractedData = document.extractedData;
      if (!extractedData) {
        extractedData = await prisma.extractedData.create({
          data: {
            documentId,
            clientId,
            rawText: null,
            fields: {},
            status: 'PENDING'
          }
        });
      } else {
        extractedData = await prisma.extractedData.update({
          where: { id: extractedData.id },
          data: { status: 'PENDING' }
        });
      }

      // Synchronous extraction for small documents or when explicitly requested
      if (sync) {
        try {
          const ocrService = new OCRService();
          await ocrService.initialize();

          const fileExt = path.extname(document.storageUrl).toLowerCase();
          let ocrResult;

          if (fileExt === '.pdf') {
            ocrResult = await ocrService.processPDF(document.storageUrl);
          } else {
            ocrResult = await ocrService.processImage(document.storageUrl);
          }

          // Extract structured fields based on document category
          const structuredData = await ocrService.extractStructuredData(ocrResult.text);
          const categoryFields = extractFieldsByCategory(structuredData, document.category);

          // Update extracted data
          extractedData = await prisma.extractedData.update({
            where: { id: extractedData.id },
            data: {
              rawText: ocrResult.text,
              fields: categoryFields,
              status: 'COMPLETED',
              extractedAt: new Date()
            }
          });

          // Update document status
          await prisma.clientDocument.update({
            where: { id: documentId },
            data: { status: 'EXTRACTED' }
          });

          // Merge to client profile if requested
          let profileUpdated = false;
          if (mergeToProfile && Object.keys(categoryFields).length > 0) {
            profileUpdated = await mergeToClientProfile(clientId, categoryFields, documentId);
          }

          await ocrService.cleanup();

          logger.info(`Document extracted synchronously: ${documentId}`, {
            confidence: ocrResult.confidence,
            fieldsExtracted: Object.keys(categoryFields).length,
            profileUpdated
          });

          res.json({
            success: true,
            message: 'Document extracted successfully',
            data: {
              documentId,
              extractedDataId: extractedData.id,
              status: 'COMPLETED',
              confidence: ocrResult.confidence,
              fields: categoryFields,
              rawTextLength: ocrResult.text.length,
              pageCount: ocrResult.metadata.pageCount,
              processingTime: ocrResult.metadata.processingTime,
              profileUpdated,
              extractedAt: extractedData.extractedAt?.toISOString()
            }
          });
        } catch (ocrError) {
          // Update status to failed
          await prisma.clientDocument.update({
            where: { id: documentId },
            data: { status: 'FAILED' }
          });
          await prisma.extractedData.update({
            where: { id: extractedData.id },
            data: { status: 'FAILED' }
          });

          logger.error('Synchronous OCR extraction failed:', ocrError);
          return res.status(500).json({
            success: false,
            error: 'OCR extraction failed',
            message: ocrError instanceof Error ? ocrError.message : 'Unknown error'
          });
        }
      } else {
        // Queue for background processing
        try {
          const job = await enqueueDocumentForOCR(documentId, userId, document.storageUrl, forceReprocess);

          if (job) {
            logger.info(`Document queued for OCR: ${documentId}, job: ${job.id}`);
            res.json({
              success: true,
              message: 'Extraction queued. The document will be processed in the background.',
              data: {
                documentId,
                extractedDataId: extractedData.id,
                jobId: job.id?.toString(),
                status: 'PENDING',
                note: 'Use GET /api/clients/:clientId/documents/:documentId/extraction-status to check progress'
              }
            });
          } else {
            // Document doesn't need OCR (text-based PDF)
            await prisma.clientDocument.update({
              where: { id: documentId },
              data: { status: 'UPLOADED' }
            });

            res.json({
              success: true,
              message: 'Document is text-based and does not require OCR extraction',
              data: {
                documentId,
                status: 'TEXT_BASED',
                note: 'This document contains extractable text and does not need OCR processing'
              }
            });
          }
        } catch (queueError) {
          // Fallback to synchronous if queue fails - update status back
          logger.warn('Queue failed:', queueError);

          await prisma.clientDocument.update({
            where: { id: documentId },
            data: { status: 'UPLOADED' }
          });

          return res.status(503).json({
            success: false,
            error: 'Background processing unavailable',
            message: 'Queue is not available. Try with sync=true parameter for synchronous processing.',
            suggestion: 'POST with body: { "sync": true }'
          });
        }
      }
    } catch (error) {
      logger.error('Error triggering extraction:', error);
      next(error);
    }
  });

  /**
   * GET /api/clients/:clientId/documents/:documentId/extraction-status - Get extraction job status
   */
  router.get('/:documentId/extraction-status', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { clientId, documentId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Verify client belongs to user
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId }
      });

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const document = await prisma.clientDocument.findFirst({
        where: { id: documentId, clientId },
        include: { extractedData: true }
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      res.json({
        success: true,
        data: {
          documentId,
          documentStatus: document.status,
          extraction: document.extractedData ? {
            id: document.extractedData.id,
            status: document.extractedData.status,
            fieldsCount: document.extractedData.fields ? Object.keys(document.extractedData.fields as object).length : 0,
            extractedAt: document.extractedData.extractedAt?.toISOString(),
            reviewedAt: document.extractedData.reviewedAt?.toISOString()
          } : null
        }
      });
    } catch (error) {
      logger.error('Error getting extraction status:', error);
      next(error);
    }
  });

  /**
   * PUT /api/clients/:clientId/documents/:documentId/extracted-data - Update extracted data fields
   * Allows manual correction of extracted data
   */
  router.put('/:documentId/extracted-data', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { clientId, documentId } = req.params;
      const { fields, mergeToProfile = false } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!fields || typeof fields !== 'object') {
        return res.status(400).json({ error: 'Fields object is required' });
      }

      // Verify client belongs to user
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId }
      });

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const document = await prisma.clientDocument.findFirst({
        where: { id: documentId, clientId },
        include: { extractedData: true }
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      if (!document.extractedData) {
        return res.status(404).json({ error: 'No extracted data found for this document' });
      }

      // Merge new fields with existing
      const currentFields = (document.extractedData.fields || {}) as Record<string, any>;
      const updatedFields = { ...currentFields, ...fields };

      const extractedData = await prisma.extractedData.update({
        where: { id: document.extractedData.id },
        data: {
          fields: updatedFields,
          status: 'REVIEWED',
          reviewedAt: new Date()
        }
      });

      // Merge to client profile if requested
      let profileUpdated = false;
      if (mergeToProfile) {
        profileUpdated = await mergeToClientProfile(clientId, fields, documentId);
      }

      logger.info(`Extracted data updated for document: ${documentId}`);

      res.json({
        success: true,
        message: 'Extracted data updated successfully',
        data: {
          documentId,
          extractedDataId: extractedData.id,
          fields: updatedFields,
          status: extractedData.status,
          profileUpdated,
          reviewedAt: extractedData.reviewedAt?.toISOString()
        }
      });
    } catch (error) {
      logger.error('Error updating extracted data:', error);
      next(error);
    }
  });

  /**
   * POST /api/clients/:clientId/documents/:documentId/merge-to-profile - Merge extracted data to profile
   */
  router.post('/:documentId/merge-to-profile', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { clientId, documentId } = req.params;
      const { fieldNames } = req.body; // Optional: specific fields to merge

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Verify client belongs to user
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId }
      });

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const document = await prisma.clientDocument.findFirst({
        where: { id: documentId, clientId },
        include: { extractedData: true }
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      if (!document.extractedData) {
        return res.status(404).json({ error: 'No extracted data found for this document' });
      }

      const extractedFields = (document.extractedData.fields || {}) as Record<string, any>;

      // Filter to specific fields if requested
      let fieldsToMerge = extractedFields;
      if (fieldNames && Array.isArray(fieldNames)) {
        fieldsToMerge = {};
        for (const fieldName of fieldNames) {
          if (extractedFields[fieldName] !== undefined) {
            fieldsToMerge[fieldName] = extractedFields[fieldName];
          }
        }
      }

      if (Object.keys(fieldsToMerge).length === 0) {
        return res.status(400).json({ error: 'No fields to merge' });
      }

      const profileUpdated = await mergeToClientProfile(clientId, fieldsToMerge, documentId);

      logger.info(`Merged ${Object.keys(fieldsToMerge).length} fields to profile for client: ${clientId}`);

      res.json({
        success: true,
        message: `Merged ${Object.keys(fieldsToMerge).length} fields to client profile`,
        data: {
          mergedFields: Object.keys(fieldsToMerge),
          profileUpdated
        }
      });
    } catch (error) {
      logger.error('Error merging to profile:', error);
      next(error);
    }
  });

  /**
   * GET /api/clients/:clientId/documents/:documentId/preview - Get document preview URL
   */
  router.get('/:documentId/preview', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { clientId, documentId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Verify client belongs to user
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId }
      });

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const document = await prisma.clientDocument.findFirst({
        where: { id: documentId, clientId }
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Check file exists
      try {
        await fs.access(document.storageUrl);
      } catch {
        return res.status(404).json({ error: 'Document file not found' });
      }

      // Return download URL (in production, this would be a signed URL or served through a CDN)
      res.json({
        success: true,
        data: {
          documentId,
          fileName: document.fileName,
          fileType: document.fileType,
          fileSize: document.fileSize,
          previewUrl: `/api/clients/${clientId}/documents/${documentId}/download`,
          canPreview: ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(document.fileType)
        }
      });
    } catch (error) {
      logger.error('Error getting document preview:', error);
      next(error);
    }
  });

  /**
   * GET /api/clients/:clientId/documents/:documentId/download - Download document file
   */
  router.get('/:documentId/download', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { clientId, documentId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Verify client belongs to user
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId }
      });

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const document = await prisma.clientDocument.findFirst({
        where: { id: documentId, clientId }
      });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Check file exists
      try {
        await fs.access(document.storageUrl);
      } catch {
        return res.status(404).json({ error: 'Document file not found' });
      }

      // Send file
      res.download(document.storageUrl, document.fileName);
    } catch (error) {
      logger.error('Error downloading document:', error);
      next(error);
    }
  });

  return router;
}

/**
 * Extract fields from OCR structured data based on document category
 * Maps generic OCR patterns to specific profile fields
 */
function extractFieldsByCategory(structuredData: Record<string, any>, category: DocumentCategory | null): Record<string, any> {
  const fields: Record<string, any> = {};

  // Map common patterns from structuredData
  if (structuredData.fields) {
    Object.assign(fields, structuredData.fields);
  }

  // Extract based on document category
  switch (category) {
    case 'PASSPORT':
      // Passport-specific field mappings
      if (structuredData.fields) {
        const f = structuredData.fields;
        if (f.passport_no || f.passport_number) {
          fields.passportNumber = f.passport_no || f.passport_number;
        }
        if (f.surname || f.family_name) {
          fields.surname = f.surname || f.family_name;
        }
        if (f.given_names || f.first_name) {
          fields.givenNames = f.given_names || f.first_name;
        }
        if (f.full_name || f.name) {
          fields.fullName = f.full_name || f.name;
        }
        if (f.nationality) {
          fields.nationality = f.nationality;
        }
        if (f.date_of_birth || f.dob || f.birth_date) {
          fields.dateOfBirth = f.date_of_birth || f.dob || f.birth_date;
        }
        if (f.sex || f.gender) {
          fields.gender = f.sex || f.gender;
        }
        if (f.place_of_birth || f.birthplace) {
          fields.placeOfBirth = f.place_of_birth || f.birthplace;
        }
        if (f.date_of_issue || f.issue_date) {
          fields.passportIssueDate = f.date_of_issue || f.issue_date;
        }
        if (f.date_of_expiry || f.expiry_date || f.expiration_date) {
          fields.passportExpiryDate = f.date_of_expiry || f.expiry_date || f.expiration_date;
        }
        if (f.place_of_issue || f.issuing_authority) {
          fields.passportIssuePlace = f.place_of_issue || f.issuing_authority;
        }
      }
      // Extract dates from patterns
      if (structuredData.date && structuredData.date.length > 0) {
        if (!fields.dateOfBirth && structuredData.date[0]) {
          fields.dateOfBirth = structuredData.date[0];
        }
        if (!fields.passportIssueDate && structuredData.date[1]) {
          fields.passportIssueDate = structuredData.date[1];
        }
        if (!fields.passportExpiryDate && structuredData.date[2]) {
          fields.passportExpiryDate = structuredData.date[2];
        }
      }
      break;

    case 'EMIRATES_ID':
      // Emirates ID specific mappings
      if (structuredData.fields) {
        const f = structuredData.fields;
        if (f.id_number || f.emirates_id || f.eid) {
          fields.emiratesId = f.id_number || f.emirates_id || f.eid;
        }
        if (f.name || f.full_name) {
          fields.fullName = f.name || f.full_name;
        }
        if (f.name_arabic) {
          fields.fullNameArabic = f.name_arabic;
        }
        if (f.nationality) {
          fields.nationality = f.nationality;
        }
        if (f.date_of_birth || f.dob) {
          fields.dateOfBirth = f.date_of_birth || f.dob;
        }
        if (f.expiry_date || f.card_expiry) {
          fields.emiratesIdExpiry = f.expiry_date || f.card_expiry;
        }
      }
      break;

    case 'TRADE_LICENSE':
      // Trade license specific mappings
      if (structuredData.fields) {
        const f = structuredData.fields;
        if (f.license_number || f.trade_license_no || f.licence_no) {
          fields.tradeLicenseNumber = f.license_number || f.trade_license_no || f.licence_no;
        }
        if (f.company_name || f.establishment_name || f.business_name) {
          fields.companyNameEn = f.company_name || f.establishment_name || f.business_name;
        }
        if (f.company_name_arabic) {
          fields.companyNameAr = f.company_name_arabic;
        }
        if (f.legal_type || f.legal_form) {
          fields.legalType = f.legal_type || f.legal_form;
        }
        if (f.activities || f.business_activities) {
          fields.activities = f.activities || f.business_activities;
        }
        if (f.issue_date) {
          fields.tradeLicenseIssueDate = f.issue_date;
        }
        if (f.expiry_date || f.expiration_date) {
          fields.tradeLicenseExpiry = f.expiry_date || f.expiration_date;
        }
        if (f.free_zone) {
          fields.freeZone = f.free_zone;
        }
      }
      break;

    case 'VISA':
      // Visa specific mappings
      if (structuredData.fields) {
        const f = structuredData.fields;
        if (f.visa_number || f.visa_no) {
          fields.visaNumber = f.visa_number || f.visa_no;
        }
        if (f.visa_type || f.residence_type) {
          fields.visaType = f.visa_type || f.residence_type;
        }
        if (f.entry_permit || f.permit_number) {
          fields.entryPermitNumber = f.entry_permit || f.permit_number;
        }
        if (f.sponsor_name || f.sponsor) {
          fields.sponsorName = f.sponsor_name || f.sponsor;
        }
        if (f.sponsor_id) {
          fields.sponsorId = f.sponsor_id;
        }
        if (f.issue_date) {
          fields.visaIssueDate = f.issue_date;
        }
        if (f.expiry_date) {
          fields.visaExpiryDate = f.expiry_date;
        }
      }
      break;

    case 'LABOR_CARD':
      // Labor card specific mappings
      if (structuredData.fields) {
        const f = structuredData.fields;
        if (f.card_number || f.labor_card_no) {
          fields.laborCardNumber = f.card_number || f.labor_card_no;
        }
        if (f.occupation || f.job_title || f.designation) {
          fields.occupation = f.occupation || f.job_title || f.designation;
        }
        if (f.employer || f.company_name) {
          fields.employer = f.employer || f.company_name;
        }
        if (f.salary || f.basic_salary) {
          fields.salary = f.salary || f.basic_salary;
        }
        if (f.expiry_date) {
          fields.laborCardExpiry = f.expiry_date;
        }
      }
      break;

    default:
      // Generic extraction for OTHER or null category
      // Include all extracted patterns
      if (structuredData.email) {
        fields.email = structuredData.email[0];
      }
      if (structuredData.phone) {
        fields.phone = structuredData.phone[0];
      }
      // Copy all fields from structured data
      if (structuredData.fields) {
        Object.assign(fields, structuredData.fields);
      }
      break;
  }

  // Always extract common patterns if found
  if (structuredData.email && structuredData.email.length > 0 && !fields.email) {
    fields.email = structuredData.email[0];
  }
  if (structuredData.phone && structuredData.phone.length > 0 && !fields.phone) {
    fields.phone = structuredData.phone[0];
  }

  return fields;
}

/**
 * Merge extracted fields into client profile
 * Only updates fields that are not manually edited (unless forced)
 */
async function mergeToClientProfile(
  clientId: string,
  fields: Record<string, any>,
  documentId: string
): Promise<boolean> {
  try {
    // Get or create profile
    let profile = await prisma.clientProfile.findUnique({
      where: { clientId }
    });

    if (!profile) {
      profile = await prisma.clientProfile.create({
        data: {
          clientId,
          data: {},
          fieldSources: {}
        }
      });
    }

    const currentData = (profile.data || {}) as Record<string, any>;
    const currentFieldSources = (profile.fieldSources || {}) as Record<string, any>;

    const newData = { ...currentData };
    const newFieldSources = { ...currentFieldSources };

    let fieldsUpdated = 0;

    for (const [fieldName, value] of Object.entries(fields)) {
      // Skip if field was manually edited (don't overwrite user corrections)
      if (currentFieldSources[fieldName]?.manuallyEdited) {
        logger.debug(`Skipping manually edited field: ${fieldName}`);
        continue;
      }

      // Skip if value is empty or null
      if (value === null || value === undefined || value === '') {
        continue;
      }

      // Update the field
      newData[fieldName] = value;
      newFieldSources[fieldName] = {
        documentId,
        extractedAt: new Date().toISOString(),
        manuallyEdited: false
      };
      fieldsUpdated++;
    }

    if (fieldsUpdated > 0) {
      await prisma.clientProfile.update({
        where: { id: profile.id },
        data: {
          data: newData,
          fieldSources: newFieldSources
        }
      });

      logger.info(`Updated ${fieldsUpdated} fields in profile for client: ${clientId}`);
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Error merging to client profile:', error);
    return false;
  }
}
