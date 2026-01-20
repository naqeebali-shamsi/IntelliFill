import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { DocumentDetectionService } from './DocumentDetectionService';
import { ocrService, OCRService } from './OCRService';
import { enqueueDocumentForOCR } from '../queues/ocrQueue';
import { prisma } from '../utils/prisma';
import { encryptExtractedData } from '../middleware/encryptionMiddleware';
import Bull from 'bull';
import { OCRProcessingJob } from '../queues/ocrQueue';
import * as path from 'path';

/**
 * Supported image extensions that always require OCR processing
 */
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.tiff', '.tif', '.bmp', '.gif'];

/**
 * Result when document is queued for OCR processing
 */
export interface QueuedProcessingResult {
  type: 'queued';
  jobId: string;
  documentId: string;
}

/**
 * Result when document processing is completed immediately (native PDF)
 */
export interface CompletedProcessingResult {
  type: 'completed';
  documentId: string;
  data: Record<string, unknown>;
  confidence: number;
  textLength: number;
  fieldsExtracted: number;
}

/**
 * Result when document processing fails
 */
export interface FailedProcessingResult {
  type: 'failed';
  documentId: string;
  error: string;
}

/**
 * Union type for all possible processing results
 */
export type DocumentProcessingResult =
  | QueuedProcessingResult
  | CompletedProcessingResult
  | FailedProcessingResult;

/**
 * DocumentProcessingService handles the OCR decision logic for uploaded documents.
 *
 * This service determines whether a document needs OCR processing (scanned PDF or image)
 * or can have text extracted directly (native PDF with text layer).
 *
 * This consolidates the duplicate logic that was previously in:
 * - documents.routes.ts (POST handler inline logic)
 * - ocrQueue.ts (enqueueDocumentForOCR function)
 */
export class DocumentProcessingService {
  private detectionService: DocumentDetectionService;
  private ocrService: OCRService;

  constructor() {
    this.detectionService = new DocumentDetectionService();
    this.ocrService = ocrService;
  }

  /**
   * Determine the file extension from a path or URL
   * Handles both local file paths and URLs with query strings
   */
  private getFileExtension(filePath: string): string {
    try {
      // For URLs, parse and get pathname to avoid query string issues
      const url = new URL(filePath);
      return path.extname(url.pathname).toLowerCase();
    } catch {
      // Not a valid URL, treat as file path
      return path.extname(filePath).toLowerCase();
    }
  }

  /**
   * Check if the file is an image based on its extension
   */
  private isImageFile(filePath: string): boolean {
    const ext = this.getFileExtension(filePath);
    return IMAGE_EXTENSIONS.includes(ext);
  }

  /**
   * Process a document upload by determining the appropriate processing path.
   *
   * Decision logic:
   * 1. If file is an image -> Queue for OCR
   * 2. If file is a PDF:
   *    a. Check if it's a scanned PDF (no text layer) -> Queue for OCR
   *    b. If native PDF with text -> Extract text directly and return completed
   *
   * @param documentId - The ID of the document record in the database
   * @param userId - The user ID who owns the document
   * @param storageUrl - The storage URL/path to the document file
   * @param forceOCR - Force OCR processing even for native PDFs (default: false)
   * @returns Processing result indicating queued, completed, or failed
   */
  async processDocumentUpload(
    documentId: string,
    userId: string,
    storageUrl: string,
    forceOCR: boolean = false
  ): Promise<DocumentProcessingResult> {
    const isImage = this.isImageFile(storageUrl);

    // Images always need OCR
    if (isImage) {
      logger.info('Document is an image, queueing for OCR', {
        documentId,
        fileType: this.getFileExtension(storageUrl),
      });

      return this.queueForOCR(documentId, userId, storageUrl, forceOCR);
    }

    // For PDFs, check if it needs OCR (scanned) or can be extracted directly (native)
    if (!forceOCR) {
      try {
        const isScanned = await this.detectionService.isScannedPDF(storageUrl);

        if (!isScanned) {
          // Native PDF with text layer - extract directly
          logger.info('Document is a native PDF with text, extracting directly', { documentId });
          return this.extractNativePDF(documentId, storageUrl);
        }
      } catch (detectionError) {
        // If detection fails, log and fall through to OCR queue
        logger.warn('PDF type detection failed, defaulting to OCR', {
          documentId,
          error: detectionError instanceof Error ? detectionError.message : 'Unknown error',
        });
      }
    }

    // Scanned PDF or forceOCR - queue for OCR processing
    logger.info('Document is a scanned PDF or OCR forced, queueing for OCR', {
      documentId,
      forceOCR,
    });

    return this.queueForOCR(documentId, userId, storageUrl, forceOCR);
  }

  /**
   * Queue a document for OCR processing
   */
  private async queueForOCR(
    documentId: string,
    userId: string,
    storageUrl: string,
    forceOCR: boolean
  ): Promise<QueuedProcessingResult | FailedProcessingResult> {
    try {
      const job = await enqueueDocumentForOCR(documentId, userId, storageUrl, forceOCR);

      if (job) {
        return {
          type: 'queued',
          jobId: String(job.id),
          documentId,
        };
      }

      // If enqueueDocumentForOCR returns null, it means the PDF doesn't need OCR
      // This shouldn't happen since we checked above, but handle it gracefully
      logger.warn('enqueueDocumentForOCR returned null unexpectedly, attempting direct extraction', {
        documentId,
      });
      return this.extractNativePDF(documentId, storageUrl);
    } catch (error) {
      logger.error('Failed to queue document for OCR', {
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Update document status to FAILED
      await this.updateDocumentStatus(documentId, 'FAILED');

      return {
        type: 'failed',
        documentId,
        error: error instanceof Error ? error.message : 'Failed to queue for OCR processing',
      };
    }
  }

  /**
   * Extract text directly from a native PDF with text layer
   * This is the fast path for PDFs that don't need OCR
   */
  private async extractNativePDF(
    documentId: string,
    storageUrl: string
  ): Promise<CompletedProcessingResult | FailedProcessingResult> {
    try {
      // Extract text from native PDF
      const extractedText = await this.detectionService.extractTextFromPDF(storageUrl);

      // Extract structured data from text (95% confidence for native PDF text)
      const structuredData = await this.ocrService.extractStructuredData(extractedText, 95);

      // Build extracted fields object
      const extractedFields: Record<string, unknown> = {
        ...structuredData.fields,
      };

      // Add list fields (email, phone, etc.) to the extracted fields
      const listFieldKeys = [
        'email',
        'phone',
        'date',
        'ssn',
        'zipCode',
        'currency',
        'percentage',
        'passport',
        'emiratesId',
      ] as const;

      for (const key of listFieldKeys) {
        const entries = structuredData[key];
        if (entries && entries.length > 0) {
          extractedFields[key] = entries;
        }
      }

      // Encrypt and store extracted data
      const encryptedData = encryptExtractedData(extractedFields);

      // Update document in database
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'COMPLETED',
          extractedText: extractedText,
          extractedData: encryptedData,
          confidence: 0.95, // High confidence for native text
          processedAt: new Date(),
        },
      });

      const fieldsExtracted = Object.keys(extractedFields).length;

      logger.info('Document processed without OCR (native text)', {
        documentId,
        textLength: extractedText.length,
        fieldsExtracted,
      });

      return {
        type: 'completed',
        documentId,
        data: extractedFields,
        confidence: 0.95,
        textLength: extractedText.length,
        fieldsExtracted,
      };
    } catch (error) {
      logger.error('Text extraction failed for native PDF', {
        documentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Update document status to FAILED
      await this.updateDocumentStatus(documentId, 'FAILED');

      return {
        type: 'failed',
        documentId,
        error: error instanceof Error ? error.message : 'Text extraction failed',
      };
    }
  }

  /**
   * Update document status in database
   */
  private async updateDocumentStatus(documentId: string, status: string): Promise<void> {
    try {
      await prisma.document.update({
        where: { id: documentId },
        data: { status },
      });
    } catch (dbError) {
      logger.error('Failed to update document status', {
        documentId,
        status,
        error: dbError instanceof Error ? dbError.message : 'Unknown error',
      });
    }
  }

  /**
   * Cleanup resources when done with the service
   * Call this if you're creating the service for one-time use
   */
  async cleanup(): Promise<void> {
    if (this.ocrService) {
      await this.ocrService.cleanup();
    }
  }
}

/**
 * Factory function to create a DocumentProcessingService instance
 * Useful for dependency injection in tests
 */
export function createDocumentProcessingService(): DocumentProcessingService {
  return new DocumentProcessingService();
}
