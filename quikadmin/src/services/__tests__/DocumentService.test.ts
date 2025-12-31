/**
 * Document Service Unit Tests
 *
 * Tests for the DocumentService class covering:
 * - Document reprocessing (single and batch)
 * - Document ownership verification
 * - Reprocessing attempt limits
 * - Status validation
 * - Low confidence document retrieval
 * - Reprocessing history tracking
 * - Queue integration
 * - Error handling
 *
 * @module services/__tests__/DocumentService.test
 */

import { enqueueDocumentForReprocessing } from '../../queues/ocrQueue';
import Bull from 'bull';

// Create mock Prisma instance
const mockPrisma = {
  document: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

// Mock Prisma Client at module level
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// Mock OCR Queue
jest.mock('../../queues/ocrQueue', () => ({
  enqueueDocumentForReprocessing: jest.fn(),
}));

// Mock PII-safe logger
jest.mock('../../utils/piiSafeLogger', () => ({
  piiSafeLogger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import DocumentService after mocks are set up
import { DocumentService } from '../DocumentService';

describe('DocumentService', () => {
  let service: DocumentService;
  let mockEnqueueDocumentForReprocessing: jest.MockedFunction<
    typeof enqueueDocumentForReprocessing
  >;

  beforeEach(() => {
    // Create fresh service instance
    service = new DocumentService();

    // Get mock enqueue function
    mockEnqueueDocumentForReprocessing = enqueueDocumentForReprocessing as jest.MockedFunction<
      typeof enqueueDocumentForReprocessing
    >;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Single Document Reprocessing Tests
  // ==========================================================================

  describe('reprocessDocument', () => {
    const mockJob = { id: 'job-123', data: {} } as Bull.Job;

    it('should successfully reprocess a valid document', async () => {
      const mockDocument = {
        id: 'doc-1',
        storageUrl: 'https://storage.example.com/doc1.pdf',
        reprocessCount: 0,
        status: 'COMPLETED',
      };

      mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
      mockEnqueueDocumentForReprocessing.mockResolvedValue(mockJob);

      const result = await service.reprocessDocument('doc-1', 'user-1');

      expect(result).toBe(mockJob);
      expect(mockPrisma.document.findFirst).toHaveBeenCalledWith({
        where: { id: 'doc-1', userId: 'user-1' },
        select: {
          id: true,
          storageUrl: true,
          reprocessCount: true,
          status: true,
        },
      });
      expect(mockEnqueueDocumentForReprocessing).toHaveBeenCalledWith(
        'doc-1',
        'user-1',
        'https://storage.example.com/doc1.pdf',
        'User-initiated reprocessing'
      );
    });

    it('should throw error if document not found', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(service.reprocessDocument('doc-999', 'user-1')).rejects.toThrow(
        'Document not found or access denied'
      );

      expect(mockEnqueueDocumentForReprocessing).not.toHaveBeenCalled();
    });

    it('should throw error if user does not own document', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(service.reprocessDocument('doc-1', 'wrong-user')).rejects.toThrow(
        'Document not found or access denied'
      );

      expect(mockEnqueueDocumentForReprocessing).not.toHaveBeenCalled();
    });

    it('should reject reprocessing if max attempts reached', async () => {
      const mockDocument = {
        id: 'doc-1',
        storageUrl: 'https://storage.example.com/doc1.pdf',
        reprocessCount: 3,
        status: 'COMPLETED',
      };

      mockPrisma.document.findFirst.mockResolvedValue(mockDocument);

      await expect(service.reprocessDocument('doc-1', 'user-1')).rejects.toThrow(
        'Maximum reprocessing attempts (3) reached for this document'
      );

      expect(mockEnqueueDocumentForReprocessing).not.toHaveBeenCalled();
    });

    it('should reject reprocessing if document is currently processing', async () => {
      const mockDocument = {
        id: 'doc-1',
        storageUrl: 'https://storage.example.com/doc1.pdf',
        reprocessCount: 1,
        status: 'PROCESSING',
      };

      mockPrisma.document.findFirst.mockResolvedValue(mockDocument);

      await expect(service.reprocessDocument('doc-1', 'user-1')).rejects.toThrow(
        'Document is already being processed'
      );

      expect(mockEnqueueDocumentForReprocessing).not.toHaveBeenCalled();
    });

    it('should reject reprocessing if document is reprocessing', async () => {
      const mockDocument = {
        id: 'doc-1',
        storageUrl: 'https://storage.example.com/doc1.pdf',
        reprocessCount: 1,
        status: 'REPROCESSING',
      };

      mockPrisma.document.findFirst.mockResolvedValue(mockDocument);

      await expect(service.reprocessDocument('doc-1', 'user-1')).rejects.toThrow(
        'Document is already being processed'
      );

      expect(mockEnqueueDocumentForReprocessing).not.toHaveBeenCalled();
    });

    it('should allow reprocessing documents with failed status', async () => {
      const mockDocument = {
        id: 'doc-1',
        storageUrl: 'https://storage.example.com/doc1.pdf',
        reprocessCount: 1,
        status: 'FAILED',
      };

      mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
      mockEnqueueDocumentForReprocessing.mockResolvedValue(mockJob);

      const result = await service.reprocessDocument('doc-1', 'user-1');

      expect(result).toBe(mockJob);
      expect(mockEnqueueDocumentForReprocessing).toHaveBeenCalled();
    });

    it('should handle queue enqueue errors', async () => {
      const mockDocument = {
        id: 'doc-1',
        storageUrl: 'https://storage.example.com/doc1.pdf',
        reprocessCount: 0,
        status: 'COMPLETED',
      };

      mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
      mockEnqueueDocumentForReprocessing.mockRejectedValue(new Error('Queue unavailable'));

      await expect(service.reprocessDocument('doc-1', 'user-1')).rejects.toThrow(
        'Queue unavailable'
      );
    });
  });

  // ==========================================================================
  // Batch Reprocessing Tests
  // ==========================================================================

  describe('batchReprocess', () => {
    const mockJob1 = { id: 'job-1', data: {} } as Bull.Job;
    const mockJob2 = { id: 'job-2', data: {} } as Bull.Job;

    it('should successfully batch reprocess multiple documents', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          storageUrl: 'https://storage.example.com/doc1.pdf',
          reprocessCount: 0,
          status: 'COMPLETED',
        },
        {
          id: 'doc-2',
          storageUrl: 'https://storage.example.com/doc2.pdf',
          reprocessCount: 1,
          status: 'COMPLETED',
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);
      mockEnqueueDocumentForReprocessing
        .mockResolvedValueOnce(mockJob1)
        .mockResolvedValueOnce(mockJob2);

      const result = await service.batchReprocess(['doc-1', 'doc-2'], 'user-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(mockJob1);
      expect(result[1]).toBe(mockJob2);
      expect(mockEnqueueDocumentForReprocessing).toHaveBeenCalledTimes(2);
    });

    it('should throw error if some documents not found', async () => {
      // Only 1 document found when 2 were requested
      const mockDocuments = [
        {
          id: 'doc-1',
          storageUrl: 'https://storage.example.com/doc1.pdf',
          reprocessCount: 0,
          status: 'COMPLETED',
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      await expect(service.batchReprocess(['doc-1', 'doc-2'], 'user-1')).rejects.toThrow(
        'Some documents not found or access denied'
      );

      expect(mockEnqueueDocumentForReprocessing).not.toHaveBeenCalled();
    });

    it('should filter out documents that reached max reprocessing attempts', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          storageUrl: 'https://storage.example.com/doc1.pdf',
          reprocessCount: 0,
          status: 'COMPLETED',
        },
        {
          id: 'doc-2',
          storageUrl: 'https://storage.example.com/doc2.pdf',
          reprocessCount: 3, // Max attempts reached
          status: 'COMPLETED',
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);
      mockEnqueueDocumentForReprocessing.mockResolvedValue(mockJob1);

      const result = await service.batchReprocess(['doc-1', 'doc-2'], 'user-1');

      expect(result).toHaveLength(1);
      expect(mockEnqueueDocumentForReprocessing).toHaveBeenCalledTimes(1);
      expect(mockEnqueueDocumentForReprocessing).toHaveBeenCalledWith(
        'doc-1',
        'user-1',
        'https://storage.example.com/doc1.pdf',
        'Batch reprocessing'
      );
    });

    it('should filter out documents that are currently processing', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          storageUrl: 'https://storage.example.com/doc1.pdf',
          reprocessCount: 0,
          status: 'COMPLETED',
        },
        {
          id: 'doc-2',
          storageUrl: 'https://storage.example.com/doc2.pdf',
          reprocessCount: 1,
          status: 'PROCESSING',
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);
      mockEnqueueDocumentForReprocessing.mockResolvedValue(mockJob1);

      const result = await service.batchReprocess(['doc-1', 'doc-2'], 'user-1');

      expect(result).toHaveLength(1);
      expect(mockEnqueueDocumentForReprocessing).toHaveBeenCalledTimes(1);
    });

    it('should throw error if no documents are eligible for reprocessing', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          storageUrl: 'https://storage.example.com/doc1.pdf',
          reprocessCount: 3,
          status: 'COMPLETED',
        },
        {
          id: 'doc-2',
          storageUrl: 'https://storage.example.com/doc2.pdf',
          reprocessCount: 1,
          status: 'PROCESSING',
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      await expect(service.batchReprocess(['doc-1', 'doc-2'], 'user-1')).rejects.toThrow(
        'No documents are eligible for reprocessing'
      );

      expect(mockEnqueueDocumentForReprocessing).not.toHaveBeenCalled();
    });

    it('should handle empty document ID array', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      await expect(service.batchReprocess([], 'user-1')).rejects.toThrow(); // Will throw either error, both are acceptable for empty array
    });

    it('should handle partial queue failures gracefully', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          storageUrl: 'https://storage.example.com/doc1.pdf',
          reprocessCount: 0,
          status: 'COMPLETED',
        },
        {
          id: 'doc-2',
          storageUrl: 'https://storage.example.com/doc2.pdf',
          reprocessCount: 1,
          status: 'COMPLETED',
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);
      mockEnqueueDocumentForReprocessing
        .mockResolvedValueOnce(mockJob1)
        .mockRejectedValueOnce(new Error('Queue error'));

      await expect(service.batchReprocess(['doc-1', 'doc-2'], 'user-1')).rejects.toThrow(
        'Queue error'
      );
    });
  });

  // ==========================================================================
  // Low Confidence Documents Tests
  // ==========================================================================

  describe('getLowConfidenceDocuments', () => {
    it('should retrieve documents below confidence threshold', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          fileName: 'low-quality.pdf',
          confidence: 0.5,
          reprocessCount: 0,
          processedAt: new Date('2025-01-01'),
          createdAt: new Date('2025-01-01'),
        },
        {
          id: 'doc-2',
          fileName: 'poor-scan.pdf',
          confidence: 0.65,
          reprocessCount: 1,
          processedAt: new Date('2025-01-02'),
          createdAt: new Date('2025-01-02'),
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);

      const result = await service.getLowConfidenceDocuments('user-1', 0.7);

      expect(result).toEqual(mockDocuments);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          confidence: { lt: 0.7 },
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
    });

    it('should use default confidence threshold of 0.7', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      await service.getLowConfidenceDocuments('user-1');

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            confidence: { lt: 0.7 },
          }),
        })
      );
    });

    it('should return empty array if no low confidence documents', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      const result = await service.getLowConfidenceDocuments('user-1', 0.7);

      expect(result).toEqual([]);
    });

    it('should only return completed documents', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      await service.getLowConfidenceDocuments('user-1', 0.7);

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'COMPLETED',
          }),
        })
      );
    });

    it('should order documents by confidence ascending', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      await service.getLowConfidenceDocuments('user-1', 0.7);

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { confidence: 'asc' },
        })
      );
    });

    it('should handle database errors', async () => {
      mockPrisma.document.findMany.mockRejectedValue(new Error('Database error'));

      await expect(service.getLowConfidenceDocuments('user-1', 0.7)).rejects.toThrow(
        'Database error'
      );
    });
  });

  // ==========================================================================
  // Reprocessing History Tests
  // ==========================================================================

  describe('getReprocessingHistory', () => {
    it('should retrieve reprocessing history for a document', async () => {
      const mockHistory = {
        reprocessCount: 2,
        lastReprocessedAt: new Date('2025-01-15'),
        reprocessingHistory: [
          { timestamp: '2025-01-10', reason: 'Low confidence' },
          { timestamp: '2025-01-15', reason: 'User request' },
        ],
      };

      mockPrisma.document.findFirst.mockResolvedValue(mockHistory);

      const result = await service.getReprocessingHistory('doc-1', 'user-1');

      expect(result).toEqual(mockHistory);
      expect(mockPrisma.document.findFirst).toHaveBeenCalledWith({
        where: { id: 'doc-1', userId: 'user-1' },
        select: {
          reprocessCount: true,
          lastReprocessedAt: true,
          reprocessingHistory: true,
        },
      });
    });

    it('should throw error if document not found', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(service.getReprocessingHistory('doc-999', 'user-1')).rejects.toThrow(
        'Document not found or access denied'
      );
    });

    it('should throw error if user does not own document', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(service.getReprocessingHistory('doc-1', 'wrong-user')).rejects.toThrow(
        'Document not found or access denied'
      );
    });

    it('should handle documents with no reprocessing history', async () => {
      const mockHistory = {
        reprocessCount: 0,
        lastReprocessedAt: null as Date | null,
        reprocessingHistory: null as unknown,
      };

      mockPrisma.document.findFirst.mockResolvedValue(mockHistory);

      const result = await service.getReprocessingHistory('doc-1', 'user-1');

      expect(result).toEqual(mockHistory);
    });

    it('should handle database errors', async () => {
      mockPrisma.document.findFirst.mockRejectedValue(new Error('Database error'));

      await expect(service.getReprocessingHistory('doc-1', 'user-1')).rejects.toThrow(
        'Database error'
      );
    });
  });

  // ==========================================================================
  // Edge Cases and Error Handling
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle null storageUrl gracefully', async () => {
      const mockDocument = {
        id: 'doc-1',
        storageUrl: null as string | null,
        reprocessCount: 0,
        status: 'COMPLETED',
      };

      mockPrisma.document.findFirst.mockResolvedValue(mockDocument);
      mockEnqueueDocumentForReprocessing.mockResolvedValue({ id: 'job-1' } as Bull.Job);

      // Should still attempt to enqueue even with null storageUrl
      await service.reprocessDocument('doc-1', 'user-1');

      expect(mockEnqueueDocumentForReprocessing).toHaveBeenCalledWith(
        'doc-1',
        'user-1',
        null,
        'User-initiated reprocessing'
      );
    });

    it('should handle reprocessCount exactly at limit', async () => {
      const mockDocument = {
        id: 'doc-1',
        storageUrl: 'https://storage.example.com/doc1.pdf',
        reprocessCount: 3,
        status: 'COMPLETED',
      };

      mockPrisma.document.findFirst.mockResolvedValue(mockDocument);

      await expect(service.reprocessDocument('doc-1', 'user-1')).rejects.toThrow(
        'Maximum reprocessing attempts (3) reached'
      );
    });

    it('should handle reprocessCount above limit', async () => {
      const mockDocument = {
        id: 'doc-1',
        storageUrl: 'https://storage.example.com/doc1.pdf',
        reprocessCount: 5,
        status: 'COMPLETED',
      };

      mockPrisma.document.findFirst.mockResolvedValue(mockDocument);

      await expect(service.reprocessDocument('doc-1', 'user-1')).rejects.toThrow(
        'Maximum reprocessing attempts (3) reached'
      );
    });

    it('should handle confidence threshold of 0', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      await service.getLowConfidenceDocuments('user-1', 0);

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            confidence: { lt: 0 },
          }),
        })
      );
    });

    it('should handle confidence threshold of 1', async () => {
      mockPrisma.document.findMany.mockResolvedValue([]);

      await service.getLowConfidenceDocuments('user-1', 1);

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            confidence: { lt: 1 },
          }),
        })
      );
    });
  });
});
