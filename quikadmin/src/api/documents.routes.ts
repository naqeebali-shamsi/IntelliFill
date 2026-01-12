import { Router, Request, Response, NextFunction } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
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
import { DocumentDetectionService } from '../services/DocumentDetectionService';
import { OCRService } from '../services/OCRService';
import { prisma } from '../utils/prisma';
import { fileValidationService } from '../services/fileValidation.service';
import { uploadFile as uploadToStorage, fetchFromStorage } from '../services/storageHelper';
import { normalizeExtractedData, flattenExtractedData } from '../types/extractedData';
import archiver from 'archiver';
import { SharePermission } from '@prisma/client';

// Allowed document types for upload
const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif'];
const ALLOWED_MIMETYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff'];

/**
 * Create a custom error class for file validation failures
 * This allows the error handler to identify and return appropriate HTTP status codes
 */
class FileValidationError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'FileValidationError';
    this.code = code;
  }
}

// Multer config for document upload (PDFs and images)
const documentUpload = multer({
  dest: 'uploads/documents/',
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    // Check for double extensions (e.g., file.pdf.exe)
    const doubleExtCheck = fileValidationService.hasDoubleExtension(
      file.originalname,
      ALLOWED_EXTENSIONS
    );
    if (doubleExtCheck.isDouble) {
      logger.warn('Double extension attack detected', {
        filename: file.originalname,
        extensions: doubleExtCheck.extensions,
        dangerousExtension: doubleExtCheck.dangerousExtension,
      });
      return cb(
        new FileValidationError(
          `Suspicious double extension detected: ${file.originalname}. File rejected for security reasons.`,
          'DOUBLE_EXTENSION'
        )
      );
    }

    // Check for MIME type spoofing (extension doesn't match MIME type)
    const expectedMimeTypes: Record<string, string[]> = {
      '.pdf': ['application/pdf'],
      '.png': ['image/png'],
      '.jpg': ['image/jpeg'],
      '.jpeg': ['image/jpeg'],
      '.tiff': ['image/tiff'],
      '.tif': ['image/tiff'],
    };
    const expectedMimes = expectedMimeTypes[ext];
    if (expectedMimes && !expectedMimes.includes(file.mimetype)) {
      logger.warn('MIME type spoofing detected', {
        filename: file.originalname,
        extension: ext,
        declaredMimeType: file.mimetype,
        expectedMimeTypes: expectedMimes,
      });
      return cb(
        new FileValidationError(
          `MIME type mismatch: file extension ${ext} does not match declared type ${file.mimetype}`,
          'MIME_TYPE_MISMATCH'
        )
      );
    }

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
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    // Check for double extensions
    const doubleExtCheck = fileValidationService.hasDoubleExtension(file.originalname, ['.pdf']);
    if (doubleExtCheck.isDouble) {
      return cb(
        new FileValidationError(
          `Suspicious double extension detected: ${file.originalname}. File rejected for security reasons.`,
          'DOUBLE_EXTENSION'
        )
      );
    }

    // Check MIME type for PDF
    if (ext === '.pdf' && file.mimetype !== 'application/pdf') {
      return cb(
        new FileValidationError(
          `MIME type mismatch: expected application/pdf but got ${file.mimetype}`,
          'MIME_TYPE_MISMATCH'
        )
      );
    }

    if (ext === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF forms are supported'));
    }
  },
});

export function createDocumentRoutes(): Router {
  const router = Router();

  /** GET /api/documents - List user's documents */
  router.get('/', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as unknown as { user: { id: string } }).user.id;
      const { type, search, limit = 50 } = req.query;

      const types = type ? (Array.isArray(type) ? type : [type]).map((t) => String(t)) : undefined;

      const documents = await prisma.document.findMany({
        where: {
          userId,
          ...(types && types.length > 0 && { fileType: { in: types } }),
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
          tags: true,
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
        const userId = (req as unknown as { user: { id: string } }).user.id;
        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
          return res.status(400).json({ error: 'At least one document file is required' });
        }

        const results = [];

        for (const file of files) {
          // Upload file to storage (R2 if configured, otherwise local)
          const storageResult = await uploadToStorage(
            file.path,
            userId,
            file.originalname,
            file.mimetype
          );

          logger.info('File uploaded to storage', {
            storageType: storageResult.storageType,
            url: storageResult.storageType === 'r2' ? storageResult.key : 'local',
          });

          // Create document record with storage URL
          const document = await prisma.document.create({
            data: {
              userId,
              fileName: file.originalname,
              fileType: file.mimetype,
              fileSize: file.size,
              storageUrl: storageResult.url,
              status: 'PENDING',
            },
          });

          // Queue for OCR processing with the correct storage URL
          const job = await enqueueDocumentForOCR(document.id, userId, storageResult.url);

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
            // OCR not needed (e.g., native PDF with text) - extract text directly
            const detectionService = new DocumentDetectionService();
            const ocrService = new OCRService();

            try {
              // Extract text from native PDF using storage URL (R2 or local)
              // Note: Use storageResult.url, not file.path, as the temp file
              // may have been deleted after upload to R2
              const extractedText = await detectionService.extractTextFromPDF(storageResult.url);

              // Extract structured data from text (95% confidence for native PDF text)
              const structuredData = await ocrService.extractStructuredData(extractedText, 95);

              // Encrypt and store extracted data
              const encryptedData = encryptExtractedData(structuredData);

              await prisma.document.update({
                where: { id: document.id },
                data: {
                  status: 'COMPLETED',
                  extractedText: extractedText,
                  extractedData: encryptedData,
                  confidence: 0.95, // High confidence for native text
                  processedAt: new Date(),
                },
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
                textLength: extractedText.length,
                fieldsExtracted: Object.keys(structuredData).length,
              });
            } catch (extractError) {
              logger.error('Text extraction failed for native PDF', {
                documentId: document.id,
                error: extractError,
              });

              // Fallback: mark as failed
              await prisma.document.update({
                where: { id: document.id },
                data: { status: 'FAILED' },
              });

              results.push({
                documentId: document.id,
                fileName: file.originalname,
                jobId: '',
                status: 'failed',
                statusUrl: `/api/documents/${document.id}/status`,
              });
            }
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

  // ============================================================================
  // STATIC ROUTES - Must be defined BEFORE parameterized /:id routes
  // ============================================================================

  /**
   * POST /api/documents/reprocess/batch - Batch reprocess multiple documents
   */
  router.post(
    '/reprocess/batch',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as unknown as { user: { id: string } }).user.id;
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
        const userId = (req as unknown as { user: { id: string } }).user.id;
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
   * POST /api/documents/download-batch - Download multiple documents as a ZIP file
   */
  router.post(
    '/download-batch',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as unknown as { user: { id: string } }).user.id;
        const { documentIds } = req.body;

        if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
          return res.status(400).json({ error: 'documentIds array is required' });
        }

        // Limit batch size to prevent abuse
        const MAX_BATCH_SIZE = 50;
        if (documentIds.length > MAX_BATCH_SIZE) {
          return res.status(400).json({
            error: `Maximum ${MAX_BATCH_SIZE} documents allowed per batch`,
          });
        }

        // Get documents owned by the user
        const documents = await prisma.document.findMany({
          where: {
            id: { in: documentIds },
            userId,
          },
          select: {
            id: true,
            fileName: true,
            storageUrl: true,
          },
        });

        if (documents.length === 0) {
          return res.status(404).json({ error: 'No authorized documents found' });
        }

        // Set response headers for ZIP download
        const timestamp = Date.now();
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="documents-${timestamp}.zip"`);

        // Create ZIP archive with medium compression
        const archive = archiver('zip', { zlib: { level: 5 } });

        // Handle archive errors
        archive.on('error', (err: Error) => {
          logger.error('Archive error:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to create archive' });
          }
        });

        // Pipe archive to response
        archive.pipe(res);

        // Track files that couldn't be added
        const failures: string[] = [];

        // Add each document to the archive
        for (const doc of documents) {
          try {
            const fileBuffer = await fetchFromStorage(doc.storageUrl);
            archive.append(fileBuffer, { name: doc.fileName });
            logger.debug('Added to ZIP archive', { documentId: doc.id, fileName: doc.fileName });
          } catch (fetchError) {
            logger.error('Failed to fetch document for ZIP', {
              documentId: doc.id,
              error: fetchError,
            });
            failures.push(doc.fileName);
          }
        }

        // Log summary
        const successCount = documents.length - failures.length;
        logger.info('ZIP archive created', {
          userId,
          totalDocuments: documents.length,
          successCount,
          failedCount: failures.length,
        });

        // Finalize the archive
        await archive.finalize();
      } catch (error) {
        logger.error('Batch download error:', error);
        if (!res.headersSent) {
          next(error);
        }
      }
    }
  );

  // ============================================================================
  // PARAMETERIZED ROUTES - /:id and sub-routes
  // ============================================================================

  /**
   * GET /api/documents/:id - Get single document details
   * Phase 6 Complete: Uses Supabase-only authentication
   *
   * Query params:
   * - includeConfidence: boolean (default: true) - Include confidence scores in extractedData
   *   When true (default), extractedData uses new format with per-field confidence:
   *   { fieldName: { value, confidence, source, rawText? } }
   *   When false, extractedData returns flattened format for backward compatibility:
   *   { fieldName: value }
   */
  router.get(
    '/:id',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as unknown as { user: { id: string } }).user.id;
        const { id } = req.params;
        const includeConfidence = req.query.includeConfidence !== 'false';

        const document = await prisma.document.findFirst({
          where: { id, userId },
        });

        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }

        // Decrypt extractedData if it exists
        let extractedData = null;
        if (document.extractedData) {
          const decrypted = decryptExtractedData(document.extractedData as string);

          if (includeConfidence) {
            // Normalize to new format with confidence scores
            // Legacy data gets default confidence: 0, source: 'pattern'
            extractedData = normalizeExtractedData(decrypted, 0, 'pattern');
          } else {
            // Flatten to simple key-value pairs for backward compatibility
            extractedData = flattenExtractedData(decrypted);
          }
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
   *
   * Query params:
   * - includeConfidence: boolean (default: true) - Include confidence scores
   */
  router.get(
    '/:id/data',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as unknown as { user: { id: string } }).user.id;
        const { id } = req.params;
        const includeConfidence = req.query.includeConfidence !== 'false';

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

        let extractedData = null;
        if (document.extractedData) {
          const decrypted = decryptExtractedData(document.extractedData as string);

          if (includeConfidence) {
            extractedData = normalizeExtractedData(decrypted, 0, 'pattern');
          } else {
            extractedData = flattenExtractedData(decrypted);
          }
        }

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
        const userId = (req as unknown as { user: { id: string } }).user.id;
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
        const userId = (req as unknown as { user: { id: string } }).user.id;
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
        const userId = (req as unknown as { user: { id: string } }).user.id;
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
            // Check OCR queue specifically (with IDOR protection)
            const ocrJobStatus = await getOCRJobStatus(id, userId);
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
   * PATCH /api/documents/:id - Update document metadata (tags, etc.)
   */
  router.patch(
    '/:id',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as unknown as { user: { id: string } }).user.id;
        const { id } = req.params;
        const { tags } = req.body;

        // Verify document belongs to user
        const document = await prisma.document.findFirst({
          where: { id, userId },
          select: { id: true },
        });

        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }

        // Build update data
        const updateData: { tags?: string[] } = {};
        if (tags !== undefined) {
          if (!Array.isArray(tags) || !tags.every((t) => typeof t === 'string')) {
            return res.status(400).json({ error: 'Tags must be an array of strings' });
          }
          updateData.tags = tags;
        }

        // Update document
        const updated = await prisma.document.update({
          where: { id },
          data: updateData,
          select: {
            id: true,
            fileName: true,
            fileType: true,
            fileSize: true,
            status: true,
            confidence: true,
            createdAt: true,
            processedAt: true,
            tags: true,
          },
        });

        res.json({ success: true, document: updated });
      } catch (error) {
        logger.error('Update document error:', error);
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
        const userId = (req as unknown as { user: { id: string } }).user.id;
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
   * Quality presets for OCR reprocessing
   * Each preset defines DPI, preprocessing, and enhancement settings
   */
  const QUALITY_PRESETS = {
    draft: {
      dpi: 150,
      preprocessing: false,
      enhance: false,
      estimatedSeconds: 30,
    },
    standard: {
      dpi: 300,
      preprocessing: true,
      enhance: false,
      estimatedSeconds: 60,
    },
    high: {
      dpi: 600,
      preprocessing: true,
      enhance: true,
      estimatedSeconds: 180,
    },
  } as const;

  type QualityPreset = keyof typeof QUALITY_PRESETS;

  /**
   * Supported OCR languages
   * Maps language codes to Tesseract language names
   */
  const SUPPORTED_LANGUAGES = [
    'eng',
    'ara',
    'fra',
    'deu',
    'spa',
    'ita',
    'por',
    'rus',
    'chi_sim',
    'jpn',
  ] as const;
  type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

  /**
   * POST /api/documents/:id/reprocess - Reprocess single document with quality options
   *
   * Body parameters:
   * - quality: 'draft' | 'standard' | 'high' (default: 'standard')
   * - language: 'eng' | 'ara' | 'fra' | etc. (default: 'eng')
   */
  router.post(
    '/:id/reprocess',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as unknown as { user: { id: string } }).user.id;
        const { id } = req.params;
        const { quality = 'standard', language = 'eng' } = req.body;

        // Validate quality preset
        if (!(quality in QUALITY_PRESETS)) {
          return res.status(400).json({
            error: `Invalid quality preset. Must be one of: ${Object.keys(QUALITY_PRESETS).join(', ')}`,
          });
        }

        // Validate language
        if (!SUPPORTED_LANGUAGES.includes(language)) {
          return res.status(400).json({
            error: `Unsupported language. Must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`,
          });
        }

        const qualitySettings = QUALITY_PRESETS[quality as QualityPreset];

        const { DocumentService } = await import('../services/DocumentService');
        const documentService = new DocumentService();

        const job = await documentService.reprocessDocument(id, userId, {
          quality: quality as QualityPreset,
          language: language as SupportedLanguage,
          dpi: qualitySettings.dpi,
          preprocessing: qualitySettings.preprocessing,
          enhance: qualitySettings.enhance,
        });

        res.json({
          success: true,
          message: 'Document queued for reprocessing',
          jobId: job.id,
          documentId: id,
          statusUrl: `/api/documents/${id}/status`,
          quality,
          language,
          estimatedTime: qualitySettings.estimatedSeconds,
        });
      } catch (error) {
        logger.error('Reprocess document error:', error);
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
        const userId = (req as unknown as { user: { id: string } }).user.id;
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

  // ============================================================================
  // DOCUMENT SHARING ROUTES
  // ============================================================================

  /** POST /api/documents/:id/share - Create a share for a document */
  router.post(
    '/:id/share',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as unknown as { user: { id: string } }).user.id;
        const { id: documentId } = req.params;
        const { email, permission = 'VIEW', expiresIn, generateLink = true } = req.body;

        if (!email || typeof email !== 'string') {
          return res.status(400).json({ error: 'Email is required' });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return res.status(400).json({ error: 'Invalid email format' });
        }

        const validPermissions: SharePermission[] = ['VIEW', 'COMMENT', 'EDIT'];
        if (!validPermissions.includes(permission as SharePermission)) {
          return res.status(400).json({
            error: `Invalid permission. Must be one of: ${validPermissions.join(', ')}`,
          });
        }

        const document = await prisma.document.findFirst({
          where: { id: documentId, userId },
          select: { id: true },
        });

        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }

        const recipientUser = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          select: { id: true },
        });

        const expiresAt =
          expiresIn && typeof expiresIn === 'number' && expiresIn > 0
            ? new Date(Date.now() + expiresIn * 60 * 60 * 1000)
            : null;

        const accessToken = generateLink ? crypto.randomBytes(32).toString('hex') : null;

        const existingShare = await prisma.documentShare.findFirst({
          where: { documentId, sharedWithEmail: email.toLowerCase() },
        });

        if (existingShare) {
          return res.status(409).json({
            error: 'Document already shared with this email',
            shareId: existingShare.id,
          });
        }

        const share = await prisma.documentShare.create({
          data: {
            documentId,
            sharedByUserId: userId,
            sharedWithEmail: email.toLowerCase(),
            sharedWithUserId: recipientUser?.id || null,
            permission: permission as SharePermission,
            accessToken,
            expiresAt,
          },
          select: {
            id: true,
            sharedWithEmail: true,
            permission: true,
            accessToken: true,
            expiresAt: true,
            createdAt: true,
          },
        });

        logger.info('Document share created', {
          documentId,
          shareId: share.id,
          sharedBy: userId,
          sharedWithEmail: email,
          permission,
          hasExpiration: !!expiresAt,
        });

        // Build share URL
        const shareUrl = accessToken ? `/shared/${accessToken}` : null;

        res.status(201).json({
          success: true,
          share: {
            id: share.id,
            email: share.sharedWithEmail,
            permission: share.permission,
            expiresAt: share.expiresAt,
            createdAt: share.createdAt,
            shareUrl,
          },
        });
      } catch (error) {
        logger.error('Create share error:', error);
        next(error);
      }
    }
  );

  /**
   * GET /api/documents/:id/shares - List all shares for a document
   * Only document owner can view shares
   */
  router.get(
    '/:id/shares',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as unknown as { user: { id: string } }).user.id;
        const { id: documentId } = req.params;

        // Verify document exists and user is the owner
        const document = await prisma.document.findFirst({
          where: { id: documentId, userId },
          select: { id: true },
        });

        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }

        const shares = await prisma.documentShare.findMany({
          where: { documentId },
          select: {
            id: true,
            sharedWithEmail: true,
            sharedWithUserId: true,
            permission: true,
            accessToken: true,
            expiresAt: true,
            accessCount: true,
            lastAccessedAt: true,
            createdAt: true,
            sharedWith: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        // Transform response to include share URLs
        const transformedShares = shares.map((share) => ({
          id: share.id,
          email: share.sharedWithEmail,
          recipientName: share.sharedWith
            ? `${share.sharedWith.firstName || ''} ${share.sharedWith.lastName || ''}`.trim() ||
              null
            : null,
          permission: share.permission,
          shareUrl: share.accessToken ? `/shared/${share.accessToken}` : null,
          expiresAt: share.expiresAt,
          accessCount: share.accessCount,
          lastAccessedAt: share.lastAccessedAt,
          createdAt: share.createdAt,
        }));

        res.json({
          success: true,
          shares: transformedShares,
          count: shares.length,
        });
      } catch (error) {
        logger.error('List shares error:', error);
        next(error);
      }
    }
  );

  /**
   * DELETE /api/documents/:id/shares/:shareId - Revoke a share
   * Only document owner can revoke shares
   */
  router.delete(
    '/:id/shares/:shareId',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as unknown as { user: { id: string } }).user.id;
        const { id: documentId, shareId } = req.params;

        // Verify document exists and user is the owner
        const document = await prisma.document.findFirst({
          where: { id: documentId, userId },
          select: { id: true },
        });

        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }

        // Verify share exists and belongs to this document
        const share = await prisma.documentShare.findFirst({
          where: { id: shareId, documentId },
        });

        if (!share) {
          return res.status(404).json({ error: 'Share not found' });
        }

        // Delete the share
        await prisma.documentShare.delete({
          where: { id: shareId },
        });

        logger.info('Document share revoked', {
          documentId,
          shareId,
          revokedBy: userId,
        });

        res.json({
          success: true,
          message: 'Share revoked successfully',
        });
      } catch (error) {
        logger.error('Revoke share error:', error);
        next(error);
      }
    }
  );

  return router;
}
