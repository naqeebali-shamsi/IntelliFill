/**
 * QueueCoordinator - Facade for queue operations
 *
 * This service provides a unified interface over the queue modules (ocrQueue, documentQueue),
 * abstracting away the direct queue function imports and providing consistent patterns
 * for queue operations including IDOR protection.
 *
 * @module services/QueueCoordinator
 */

import Bull from 'bull';
import {
  enqueueDocumentForOCR as ocrEnqueue,
  getOCRJobStatus as ocrGetJobStatus,
  getOCRQueueHealth as ocrGetQueueHealth,
  isOCRQueueAvailable,
  type OCRProcessingJob,
  type OCRJobStatus,
  type QueueHealthStatus,
} from '../queues/ocrQueue';
import {
  getJobStatus as documentGetJobStatus,
  isDocumentQueueAvailable,
} from '../queues/documentQueue';
import { JobStatusDTO } from '../dto/DocumentDTO';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';

/**
 * Unified queue health information
 */
export interface UnifiedQueueHealth {
  ocr: QueueHealthStatus | null;
  document: {
    queue: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    isHealthy: boolean;
  } | null;
  overallHealthy: boolean;
}

/**
 * QueueCoordinator provides a facade over queue operations,
 * centralizing queue access and providing consistent patterns.
 */
export class QueueCoordinator {
  /**
   * Enqueue a document for OCR processing.
   *
   * Automatically detects if PDF is scanned and needs OCR.
   * Uses deterministic job IDs for deduplication.
   *
   * @param documentId - The document ID to process
   * @param userId - The user ID who owns the document
   * @param storageUrl - The storage URL/path to the document file
   * @param forceOCR - If true, force OCR even for text-based PDFs
   * @returns The Bull job if queued, null if OCR not needed
   * @throws QueueUnavailableError if queue is not available
   */
  async enqueueDocumentForOCR(
    documentId: string,
    userId: string,
    storageUrl: string,
    forceOCR: boolean = false
  ): Promise<Bull.Job<OCRProcessingJob> | null> {
    logger.debug('QueueCoordinator: Enqueueing document for OCR', {
      documentId,
      userId: userId.substring(0, 8) + '...',
      forceOCR,
    });

    return ocrEnqueue(documentId, userId, storageUrl, forceOCR);
  }

  /**
   * Get OCR job status with IDOR protection.
   *
   * This method verifies that the requesting user owns the job before
   * returning its status. Returns null if job not found or not owned
   * by the requesting user (prevents enumeration attacks).
   *
   * @param documentId - The document ID (used as job identifier)
   * @param userId - The ID of the user making the request (for ownership check)
   * @returns Job status if found and owned by requester, null otherwise
   * @throws QueueUnavailableError if queue is not available
   */
  async getOCRJobStatus(documentId: string, userId: string): Promise<OCRJobStatus | null> {
    logger.debug('QueueCoordinator: Getting OCR job status', {
      documentId,
      userId: userId.substring(0, 8) + '...',
    });

    return ocrGetJobStatus(documentId, userId);
  }

  /**
   * Get document processing job status.
   *
   * Retrieves status for jobs in the document processing queue.
   * Also checks batch queue if job not found in document queue.
   *
   * @param jobId - The job ID to query
   * @returns Job status DTO if found, null otherwise
   * @throws QueueUnavailableError if queue is not available
   */
  async getDocumentJobStatus(jobId: string): Promise<JobStatusDTO | null> {
    logger.debug('QueueCoordinator: Getting document job status', { jobId });

    return documentGetJobStatus(jobId);
  }

  /**
   * Get OCR queue health status.
   *
   * Returns metrics about the OCR processing queue including
   * waiting, active, completed, and failed job counts.
   *
   * @returns Queue health status
   * @throws QueueUnavailableError if queue is not available
   */
  async getOCRQueueHealth(): Promise<QueueHealthStatus> {
    logger.debug('QueueCoordinator: Getting OCR queue health');

    return ocrGetQueueHealth();
  }

  /**
   * Check if the OCR queue is available for processing.
   *
   * @returns true if OCR queue is available, false otherwise
   */
  isOCRQueueAvailable(): boolean {
    return isOCRQueueAvailable();
  }

  /**
   * Check if the document queue is available for processing.
   *
   * @returns true if document queue is available, false otherwise
   */
  isDocumentQueueAvailable(): boolean {
    return isDocumentQueueAvailable();
  }

  /**
   * Check if any queue is available for processing.
   *
   * This is a unified availability check that returns true if at least
   * one queue is available. Useful for feature flags and health checks.
   *
   * @returns true if at least one queue is available
   */
  async isQueueAvailable(): Promise<boolean> {
    return isOCRQueueAvailable() || isDocumentQueueAvailable();
  }

  /**
   * Get unified health status for all queues.
   *
   * @returns Unified health status including all queues and overall health
   */
  async getUnifiedQueueHealth(): Promise<UnifiedQueueHealth> {
    let ocrHealth: QueueHealthStatus | null = null;
    let documentHealth: UnifiedQueueHealth['document'] = null;

    // Get OCR queue health if available
    if (isOCRQueueAvailable()) {
      try {
        ocrHealth = await ocrGetQueueHealth();
      } catch (error) {
        logger.warn('Failed to get OCR queue health', { error });
      }
    }

    // Document queue health would be added here when getQueueHealth is exported
    // For now, just check availability
    if (isDocumentQueueAvailable()) {
      documentHealth = {
        queue: 'document-processing',
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        isHealthy: true,
      };
    }

    const overallHealthy =
      (ocrHealth?.isHealthy ?? true) && (documentHealth?.isHealthy ?? true);

    return {
      ocr: ocrHealth,
      document: documentHealth,
      overallHealthy,
    };
  }
}

/**
 * Singleton instance of QueueCoordinator for application-wide use.
 */
export const queueCoordinator = new QueueCoordinator();
