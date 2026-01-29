import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { enqueueDocumentForReprocessing, ReprocessingOptions } from '../queues/ocrQueue';
import Bull from 'bull';
import { prisma } from '../utils/prisma';
import {
  ExtractedDataWithConfidence,
  LegacyExtractedData,
  normalizeExtractedData,
  flattenExtractedData,
  isExtractedDataWithConfidence,
} from '../types/extractedData';
import { decryptExtractedData } from '../middleware/encryptionMiddleware';

function decodeExtractedData(raw: unknown): ExtractedDataWithConfidence | LegacyExtractedData | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    return decryptExtractedData(raw) as ExtractedDataWithConfidence | LegacyExtractedData | null;
  }
  if (typeof raw === 'object') {
    return raw as ExtractedDataWithConfidence | LegacyExtractedData;
  }
  return null;
}

export class DocumentService {
  /**
   * Reprocess a single document with configurable quality settings
   *
   * @param documentId - Document ID
   * @param userId - User ID for authorization
   * @param options - Optional quality settings (quality preset, language, DPI, etc.)
   */
  async reprocessDocument(
    documentId: string,
    userId: string,
    options?: ReprocessingOptions
  ): Promise<Bull.Job> {
    try {
      // Get document and verify ownership
      const document = await prisma.document.findFirst({
        where: {
          id: documentId,
          userId,
        },
        select: {
          id: true,
          storageUrl: true,
          reprocessCount: true,
          status: true,
        },
      });

      if (!document) {
        throw new Error('Document not found or access denied');
      }

      // Check max reprocessing attempts
      if (document.reprocessCount >= 3) {
        throw new Error('Maximum reprocessing attempts (3) reached for this document');
      }

      // Check if document is in a valid state for reprocessing
      if (document.status === 'PROCESSING' || document.status === 'REPROCESSING') {
        throw new Error('Document is already being processed');
      }

      logger.info('Initiating document reprocessing', {
        documentId,
        userId,
        attempt: document.reprocessCount + 1,
        quality: options?.quality || 'standard',
        language: options?.language || 'eng',
      });

      // Enqueue for reprocessing with options
      const job = await enqueueDocumentForReprocessing(
        documentId,
        userId,
        document.storageUrl,
        'User-initiated reprocessing',
        options
      );

      return job;
    } catch (error) {
      logger.error('Failed to reprocess document', { documentId, userId, error });
      throw error;
    }
  }

  /**
   * Batch reprocess multiple documents
   */
  async batchReprocess(documentIds: string[], userId: string): Promise<Bull.Job[]> {
    try {
      logger.info('Initiating batch reprocessing', {
        userId,
        documentCount: documentIds.length,
      });

      // Verify all documents belong to user and are eligible for reprocessing
      const documents = await prisma.document.findMany({
        where: {
          id: { in: documentIds },
          userId,
        },
        select: {
          id: true,
          storageUrl: true,
          reprocessCount: true,
          status: true,
        },
      });

      if (documents.length !== documentIds.length) {
        throw new Error('Some documents not found or access denied');
      }

      // Filter documents that can be reprocessed
      const eligibleDocs = documents.filter((doc) => {
        if (doc.reprocessCount >= 3) {
          logger.warn('Document reached max reprocessing attempts', { documentId: doc.id });
          return false;
        }
        if (doc.status === 'PROCESSING' || doc.status === 'REPROCESSING') {
          logger.warn('Document already being processed', { documentId: doc.id });
          return false;
        }
        return true;
      });

      if (eligibleDocs.length === 0) {
        throw new Error('No documents are eligible for reprocessing');
      }

      // Enqueue all eligible documents
      const jobs = await Promise.all(
        eligibleDocs.map((doc) =>
          enqueueDocumentForReprocessing(doc.id, userId, doc.storageUrl, 'Batch reprocessing')
        )
      );

      logger.info('Batch reprocessing queued', {
        userId,
        totalDocuments: documentIds.length,
        eligibleDocuments: eligibleDocs.length,
        skippedDocuments: documents.length - eligibleDocs.length,
      });

      return jobs;
    } catch (error) {
      logger.error('Failed to batch reprocess documents', { userId, documentIds, error });
      throw error;
    }
  }

  /**
   * Get documents with low confidence (< threshold)
   */
  async getLowConfidenceDocuments(
    userId: string,
    confidenceThreshold: number = 0.7
  ): Promise<any[]> {
    try {
      const documents = await prisma.document.findMany({
        where: {
          userId,
          confidence: {
            lt: confidenceThreshold,
          },
          status: 'COMPLETED',
        },
        select: {
          id: true,
          fileName: true,
          confidence: true,
          reprocessCount: true,
          processedAt: true,
          createdAt: true,
        },
        orderBy: {
          confidence: 'asc',
        },
      });

      return documents;
    } catch (error) {
      logger.error('Failed to get low confidence documents', { userId, error });
      throw error;
    }
  }

  /**
   * Get reprocessing history for a document
   */
  async getReprocessingHistory(documentId: string, userId: string): Promise<any> {
    try {
      const document = await prisma.document.findFirst({
        where: {
          id: documentId,
          userId,
        },
        select: {
          reprocessCount: true,
          lastReprocessedAt: true,
          reprocessingHistory: true,
        },
      });

      if (!document) {
        throw new Error('Document not found or access denied');
      }

      return document;
    } catch (error) {
      logger.error('Failed to get reprocessing history', { documentId, userId, error });
      throw error;
    }
  }

  /**
   * Get document with extracted data, optionally including confidence scores
   *
   * @param documentId - Document ID
   * @param userId - User ID for authorization
   * @param includeConfidence - Whether to include confidence scores (default: true)
   * @returns Document with extracted data in the requested format
   */
  async getDocumentWithExtractedData(
    documentId: string,
    userId: string,
    includeConfidence: boolean = true
  ): Promise<{
    document: any;
    extractedData: ExtractedDataWithConfidence | Record<string, any> | null;
  }> {
    try {
      const document = await prisma.document.findFirst({
        where: {
          id: documentId,
          userId,
        },
      });

      if (!document) {
        throw new Error('Document not found or access denied');
      }

      let extractedData = decodeExtractedData(document.extractedData);

      if (extractedData) {
        if (includeConfidence) {
          // Normalize to new format with confidence
          // If data is in legacy format, add default confidence (0) and source ('pattern')
          extractedData = normalizeExtractedData(extractedData, 0, 'pattern');
        } else {
          // Flatten to simple key-value pairs for backward compatibility
          extractedData = flattenExtractedData(extractedData);
        }
      }

      return {
        document,
        extractedData,
      };
    } catch (error) {
      logger.error('Failed to get document with extracted data', { documentId, userId, error });
      throw error;
    }
  }

  /**
   * Check if document has extracted data in the new confidence format
   *
   * @param documentId - Document ID
   * @param userId - User ID for authorization
   * @returns True if data is in the new format with confidence scores
   */
  async hasConfidenceFormat(documentId: string, userId: string): Promise<boolean> {
    try {
      const document = await prisma.document.findFirst({
        where: {
          id: documentId,
          userId,
        },
        select: {
          extractedData: true,
        },
      });

      if (!document || !document.extractedData) {
        return false;
      }

      const decoded = decodeExtractedData(document.extractedData);
      return isExtractedDataWithConfidence(decoded);
    } catch (error) {
      logger.error('Failed to check confidence format', { documentId, userId, error });
      throw error;
    }
  }
}
