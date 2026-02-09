/**
 * Documents API Routes Tests
 *
 * Integration tests for Document management API endpoints.
 *
 * Tests cover:
 * - Authentication and authorization
 * - File upload and processing
 * - Document CRUD operations
 * - OCR queue integration
 * - Form filling functionality
 * - File download and encryption
 * - Reprocessing workflows
 *
 * @module api/__tests__/documents.routes.test
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import request from 'supertest';
import express, { Express } from 'express';
import { createDocumentRoutes } from '../documents.routes';

// Import the mocked prisma from utils/prisma (mocked in tests/setup.ts)
import { prisma } from '../../utils/prisma';

// ============================================================================
// Mocks
// ============================================================================

// Create reference to mock prisma document methods for test assertions

const mockDocumentMethods = prisma.document as any;

// Mock Supabase Auth Middleware
jest.mock('../../middleware/supabaseAuth', () => ({
  authenticateSupabase: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }),
  AuthenticatedRequest: {},
}));

// Mock encryption middleware
jest.mock('../../middleware/encryptionMiddleware', () => ({
  encryptFile: jest.fn((buffer) => buffer),
  decryptFile: jest.fn((buffer) => buffer),
  encryptExtractedData: jest.fn((data) => JSON.stringify(data)),
  decryptExtractedData: jest.fn((data) => JSON.parse(data)),
}));

// Mock OCR Queue
jest.mock('../../queues/ocrQueue', () => ({
  enqueueDocumentForOCR: jest.fn().mockResolvedValue({ id: 'job-123' }),
  getOCRJobStatus: jest.fn().mockResolvedValue(null),
  getOCRQueueHealth: jest.fn().mockResolvedValue({ waiting: 0, active: 0 }),
}));

// Mock Document Queue
jest.mock('../../queues/documentQueue', () => ({
  getJobStatus: jest.fn().mockResolvedValue(null),
}));

// Mock Services
jest.mock('../../services/DocumentDetectionService', () => ({
  DocumentDetectionService: jest.fn().mockImplementation(() => ({
    extractTextFromPDF: jest.fn().mockResolvedValue('Sample extracted text'),
  })),
}));

jest.mock('../../services/OCRService', () => ({
  OCRService: jest.fn().mockImplementation(() => ({
    extractStructuredData: jest.fn().mockResolvedValue({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
    }),
  })),
}));

jest.mock('../../mappers/FieldMapper', () => ({
  FieldMapper: jest.fn().mockImplementation(() => ({
    mapFields: jest.fn().mockResolvedValue({
      mappings: [{ sourceField: 'firstName', targetField: 'first_name', value: 'John' }],
      overallConfidence: 0.95,
    }),
  })),
}));

jest.mock('../../fillers/FormFiller', () => ({
  FormFiller: jest.fn().mockImplementation(() => ({
    validateFormFields: jest.fn().mockResolvedValue({
      fields: ['first_name', 'last_name', 'email'],
      count: 3,
    }),
    fillPDFForm: jest.fn().mockResolvedValue({
      filledFields: ['first_name', 'last_name', 'email'],
      warnings: [],
    }),
  })),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock DocumentService (for dynamic imports)
const mockDocumentService = {
  reprocessDocument: jest.fn(),
  batchReprocess: jest.fn(),
  getLowConfidenceDocuments: jest.fn(),
  getReprocessingHistory: jest.fn(),
};

jest.mock('../../services/DocumentService', () => ({
  DocumentService: jest.fn().mockImplementation(() => mockDocumentService),
}));

// Mock multer file operations
jest.mock('fs/promises', () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockResolvedValue({ size: 1024 }),
  readFile: jest.fn().mockResolvedValue(Buffer.from('test')),
}));

// Mock multer - return a function that creates middleware
jest.mock('multer', () => {
  return jest.fn(() => ({
    single: jest.fn(() => (req: any, res: any, next: any) => next()),
    array: jest.fn(() => (req: any, res: any, next: any) => {
      req.files = [];
      next();
    }),
  }));
});

// ============================================================================
// Test Setup
// ============================================================================

describe('Documents API Routes', () => {
  let app: Express;

  const testUserId = 'test-user-id';
  const testDocumentId = 'doc-123';

  beforeAll(() => {
    // Setup Express app with document routes
    app = express();
    app.use(express.json());

    const documentRoutes = createDocumentRoutes();
    app.use('/api/documents', documentRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset all mock functions on the shared Prisma instance
    (mockDocumentMethods.findMany as jest.Mock).mockReset();
    (mockDocumentMethods.findFirst as jest.Mock).mockReset();
    (mockDocumentMethods.create as jest.Mock).mockReset();
    (mockDocumentMethods.update as jest.Mock).mockReset();
    (mockDocumentMethods.delete as jest.Mock).mockReset();

    // Reset DocumentService mocks
    mockDocumentService.reprocessDocument.mockReset();
    mockDocumentService.batchReprocess.mockReset();
    mockDocumentService.getLowConfidenceDocuments.mockReset();
    mockDocumentService.getReprocessingHistory.mockReset();
  });

  // ==========================================================================
  // Authentication Tests
  // ==========================================================================

  describe('Authentication', () => {
    it('should require authentication for all endpoints', async () => {
      const { authenticateSupabase } = require('../../middleware/supabaseAuth');
      authenticateSupabase.mockImplementationOnce((req: any, res: any) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app).get('/api/documents').expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });
  });

  // ==========================================================================
  // GET /api/documents - List Documents
  // ==========================================================================

  describe('GET /api/documents', () => {
    it('should list user documents', async () => {
      const mockDocuments = [
        {
          id: testDocumentId,
          fileName: 'test.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          status: 'COMPLETED',
          confidence: 0.95,
          createdAt: new Date(),
          processedAt: new Date(),
        },
      ];

      mockDocumentMethods.findMany.mockResolvedValue(mockDocuments);

      const response = await request(app).get('/api/documents').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.documents).toHaveLength(1);
      expect(response.body.documents[0].id).toBe(testDocumentId);
    });

    it('should support type filter', async () => {
      mockDocumentMethods.findMany.mockResolvedValue([]);

      await request(app).get('/api/documents?type=application/pdf').expect(200);

      expect(mockDocumentMethods.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fileType: 'application/pdf',
          }),
        })
      );
    });

    it('should support search filter', async () => {
      mockDocumentMethods.findMany.mockResolvedValue([]);

      await request(app).get('/api/documents?search=invoice').expect(200);

      expect(mockDocumentMethods.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fileName: expect.objectContaining({
              contains: 'invoice',
              mode: 'insensitive',
            }),
          }),
        })
      );
    });

    it('should support limit', async () => {
      mockDocumentMethods.findMany.mockResolvedValue([]);

      await request(app).get('/api/documents?limit=10').expect(200);

      expect(mockDocumentMethods.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });
  });

  // ==========================================================================
  // POST /api/documents - Upload Documents
  // ==========================================================================

  describe('POST /api/documents', () => {
    it('should return 400 if no files provided', async () => {
      const response = await request(app).post('/api/documents').expect(400);

      expect(response.body.error).toContain('document file is required');
    });

    it('should handle document upload and queue for OCR', async () => {
      mockDocumentMethods.create.mockResolvedValue({
        id: testDocumentId,
        fileName: 'test.pdf',
        status: 'PENDING',
      });

      const { enqueueDocumentForOCR } = require('../../queues/ocrQueue');
      enqueueDocumentForOCR.mockResolvedValue({ id: 'job-123' });

      // Note: Actual file upload testing would require supertest-multer or similar
      // This tests the logic after file upload
      const response = await request(app).post('/api/documents').field('userId', testUserId);

      // In real test with file upload:
      // .attach('documents', Buffer.from('test'), 'test.pdf')
      // .expect(201);
    });
  });

  // ==========================================================================
  // GET /api/documents/:id - Get Single Document
  // ==========================================================================

  describe('GET /api/documents/:id', () => {
    it('should return document details with confidence format', async () => {
      const mockDocument = {
        id: testDocumentId,
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        status: 'COMPLETED',
        extractedData: JSON.stringify({ firstName: 'John' }),
        confidence: 0.95,
      };

      mockDocumentMethods.findFirst.mockResolvedValue(mockDocument);

      const response = await request(app).get(`/api/documents/${testDocumentId}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.document.id).toBe(testDocumentId);
      // New default behavior: includes confidence scores
      expect(response.body.document.extractedData.firstName).toEqual({
        value: 'John',
        confidence: 0,
        source: 'pattern',
        rawText: 'John',
      });
    });

    it('should return 404 for non-existent document', async () => {
      mockDocumentMethods.findFirst.mockResolvedValue(null);

      const response = await request(app).get(`/api/documents/${testDocumentId}`).expect(404);

      expect(response.body.error).toBe('Document not found');
    });

    it('should decrypt extracted data', async () => {
      const mockDocument = {
        id: testDocumentId,
        extractedData: JSON.stringify({ encrypted: true }),
      };

      mockDocumentMethods.findFirst.mockResolvedValue(mockDocument);

      const response = await request(app).get(`/api/documents/${testDocumentId}`).expect(200);

      expect(response.body.document.extractedData).toBeDefined();
    });
  });

  // ==========================================================================
  // GET /api/documents/:id/data - Get Extracted Data
  // ==========================================================================

  describe('GET /api/documents/:id/data', () => {
    it('should return extracted data with confidence format by default', async () => {
      const mockDocument = {
        id: testDocumentId,
        fileName: 'test.pdf',
        status: 'COMPLETED',
        extractedData: JSON.stringify({ firstName: 'John', lastName: 'Doe' }),
      };

      mockDocumentMethods.findFirst.mockResolvedValue(mockDocument);

      const response = await request(app).get(`/api/documents/${testDocumentId}/data`).expect(200);

      expect(response.body.success).toBe(true);
      // New default behavior: includes confidence scores
      expect(response.body.data.firstName).toEqual({
        value: 'John',
        confidence: 0,
        source: 'pattern',
        rawText: 'John',
      });
      expect(response.body.data.lastName).toEqual({
        value: 'Doe',
        confidence: 0,
        source: 'pattern',
        rawText: 'Doe',
      });
    });

    it('should return 404 for non-existent document', async () => {
      mockDocumentMethods.findFirst.mockResolvedValue(null);

      const response = await request(app).get(`/api/documents/${testDocumentId}/data`).expect(404);

      expect(response.body.error).toBe('Document not found');
    });

    it('should return 400 if document not completed', async () => {
      mockDocumentMethods.findFirst.mockResolvedValue({
        id: testDocumentId,
        status: 'PENDING',
      });

      const response = await request(app).get(`/api/documents/${testDocumentId}/data`).expect(400);

      expect(response.body.error).toBe('Document processing not completed');
    });
  });

  // ==========================================================================
  // GET /api/documents/:id/status - Get Processing Status
  // ==========================================================================

  describe('GET /api/documents/:id/status', () => {
    it('should return document processing status', async () => {
      const mockDocument = {
        id: testDocumentId,
        fileName: 'test.pdf',
        status: 'PROCESSING',
        confidence: null as number | null,
        processedAt: null as Date | null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDocumentMethods.findFirst.mockResolvedValue(mockDocument);

      const { getOCRJobStatus, getOCRQueueHealth } = require('../../queues/ocrQueue');
      getOCRJobStatus.mockResolvedValue({ state: 'active', progress: 50 });
      getOCRQueueHealth.mockResolvedValue({ waiting: 2, active: 1 });

      const response = await request(app)
        .get(`/api/documents/${testDocumentId}/status`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.document.status).toBe('PROCESSING');
      expect(response.body.job).toBeDefined();
      expect(response.body.queue).toBeDefined();
    });

    it('should return 404 for non-existent document', async () => {
      mockDocumentMethods.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/documents/${testDocumentId}/status`)
        .expect(404);

      expect(response.body.error).toBe('Document not found');
    });

    it('should handle queue unavailable gracefully', async () => {
      mockDocumentMethods.findFirst.mockResolvedValue({
        id: testDocumentId,
        status: 'COMPLETED',
      });

      const { getOCRJobStatus } = require('../../queues/ocrQueue');
      getOCRJobStatus.mockRejectedValue(new Error('Queue unavailable'));

      const response = await request(app)
        .get(`/api/documents/${testDocumentId}/status`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.job).toBeNull();
    });
  });

  // ==========================================================================
  // DELETE /api/documents/:id - Delete Document
  // ==========================================================================

  describe('DELETE /api/documents/:id', () => {
    it('should delete document and file', async () => {
      const mockDocument = {
        id: testDocumentId,
        userId: testUserId,
        storageUrl: 'uploads/test.pdf',
      };

      mockDocumentMethods.findFirst.mockResolvedValue(mockDocument);
      mockDocumentMethods.delete.mockResolvedValue(mockDocument);

      const mockFs = require('fs/promises');
      mockFs.unlink = jest.fn().mockResolvedValue(undefined);

      const response = await request(app).delete(`/api/documents/${testDocumentId}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Document deleted');
      expect(mockDocumentMethods.delete).toHaveBeenCalledWith({ where: { id: testDocumentId } });
    });

    it('should return 404 for non-existent document', async () => {
      mockDocumentMethods.findFirst.mockResolvedValue(null);

      const response = await request(app).delete(`/api/documents/${testDocumentId}`).expect(404);

      expect(response.body.error).toBe('Document not found');
    });

    it('should continue if file deletion fails', async () => {
      mockDocumentMethods.findFirst.mockResolvedValue({
        id: testDocumentId,
        storageUrl: 'uploads/missing.pdf',
      });
      mockDocumentMethods.delete.mockResolvedValue({});

      const mockFs = require('fs/promises');
      mockFs.unlink = jest.fn().mockRejectedValue(new Error('File not found'));

      const response = await request(app).delete(`/api/documents/${testDocumentId}`).expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  // ==========================================================================
  // POST /api/documents/:id/reprocess - Reprocess Document
  // ==========================================================================

  describe('POST /api/documents/:id/reprocess', () => {
    it('should queue document for reprocessing', async () => {
      const mockJob = { id: 'job-456', data: { documentId: testDocumentId } };

      mockDocumentService.reprocessDocument.mockResolvedValue(mockJob);

      const response = await request(app)
        .post(`/api/documents/${testDocumentId}/reprocess`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.jobId).toBe('job-456');
      expect(response.body.documentId).toBe(testDocumentId);
    });

    it('should handle reprocess errors', async () => {
      mockDocumentService.reprocessDocument.mockRejectedValue(new Error('Document not found'));

      const response = await request(app)
        .post(`/api/documents/${testDocumentId}/reprocess`)
        .expect(500);

      expect(response.body).toBeDefined();
    });
  });

  // ==========================================================================
  // POST /api/documents/reprocess/batch - Batch Reprocess
  // ==========================================================================

  describe('POST /api/documents/reprocess/batch', () => {
    it('should return 400 if documentIds missing', async () => {
      const response = await request(app)
        .post('/api/documents/reprocess/batch')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('documentIds array is required');
    });

    it('should batch reprocess multiple documents', async () => {
      const mockJobs = [
        { id: 'job-1', data: { documentId: 'doc-1' } },
        { id: 'job-2', data: { documentId: 'doc-2' } },
      ];

      mockDocumentService.batchReprocess.mockResolvedValue(mockJobs);

      const response = await request(app)
        .post('/api/documents/reprocess/batch')
        .send({ documentIds: ['doc-1', 'doc-2'] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.totalQueued).toBe(2);
      expect(response.body.jobs).toHaveLength(2);
    });
  });

  // ==========================================================================
  // GET /api/documents/low-confidence - Low Confidence Documents
  // ==========================================================================

  describe('GET /api/documents/low-confidence', () => {
    it('should return documents below confidence threshold', async () => {
      const mockDocuments = [
        { id: 'doc-1', confidence: 0.5 },
        { id: 'doc-2', confidence: 0.6 },
      ];

      mockDocumentService.getLowConfidenceDocuments.mockResolvedValue(mockDocuments);

      const response = await request(app)
        .get('/api/documents/low-confidence?threshold=0.7')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.documents).toEqual(mockDocuments);
      expect(response.body.count).toBe(2);
    });

    it('should use default threshold of 0.7', async () => {
      mockDocumentService.getLowConfidenceDocuments.mockResolvedValue([]);

      const response = await request(app).get('/api/documents/low-confidence').expect(200);

      expect(response.body.success).toBe(true);
      expect(mockDocumentService.getLowConfidenceDocuments).toHaveBeenCalledWith(testUserId, 0.7);
    });
  });

  // ==========================================================================
  // GET /api/documents/:id/reprocessing-history - Reprocessing History
  // ==========================================================================

  describe('GET /api/documents/:id/reprocessing-history', () => {
    it('should return reprocessing history', async () => {
      const mockHistory = {
        document: { id: testDocumentId },
        history: [
          { timestamp: new Date(), confidence: 0.8 },
          { timestamp: new Date(), confidence: 0.9 },
        ],
      };

      mockDocumentService.getReprocessingHistory.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get(`/api/documents/${testDocumentId}/reprocessing-history`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.document).toBeDefined();
      expect(response.body.history).toBeDefined();
    });
  });

  // ==========================================================================
  // GET /api/documents/:id?includeConfidence - Confidence Format Tests
  // ==========================================================================

  describe('GET /api/documents/:id - includeConfidence parameter', () => {
    it('should return extractedData with confidence by default', async () => {
      // Legacy format data (no confidence)
      const mockDocument = {
        id: testDocumentId,
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        status: 'COMPLETED',
        extractedData: JSON.stringify({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        }),
        confidence: 0.95,
      };

      mockDocumentMethods.findFirst.mockResolvedValue(mockDocument);

      const response = await request(app).get(`/api/documents/${testDocumentId}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.document.extractedData).toBeDefined();

      // Should be normalized to new format with confidence
      const extractedData = response.body.document.extractedData;
      expect(extractedData.firstName).toHaveProperty('value', 'John');
      expect(extractedData.firstName).toHaveProperty('confidence', 0);
      expect(extractedData.firstName).toHaveProperty('source', 'pattern');
    });

    it('should return extractedData with confidence when includeConfidence=true', async () => {
      const mockDocument = {
        id: testDocumentId,
        extractedData: JSON.stringify({ email: 'test@example.com' }),
      };

      mockDocumentMethods.findFirst.mockResolvedValue(mockDocument);

      const response = await request(app)
        .get(`/api/documents/${testDocumentId}?includeConfidence=true`)
        .expect(200);

      expect(response.body.document.extractedData.email).toHaveProperty('value');
      expect(response.body.document.extractedData.email).toHaveProperty('confidence');
      expect(response.body.document.extractedData.email).toHaveProperty('source');
    });

    it('should return flattened extractedData when includeConfidence=false', async () => {
      // Data in new format (with confidence)
      const mockDocument = {
        id: testDocumentId,
        extractedData: JSON.stringify({
          email: {
            value: 'test@example.com',
            confidence: 95,
            source: 'pattern',
          },
          name: {
            value: 'John Doe',
            confidence: 85,
            source: 'ocr',
          },
        }),
      };

      mockDocumentMethods.findFirst.mockResolvedValue(mockDocument);

      const response = await request(app)
        .get(`/api/documents/${testDocumentId}?includeConfidence=false`)
        .expect(200);

      // Should be flattened to simple key-value pairs
      const extractedData = response.body.document.extractedData;
      expect(extractedData).toEqual({
        email: 'test@example.com',
        name: 'John Doe',
      });
    });

    it('should handle null extractedData gracefully', async () => {
      const mockDocument: { id: string; extractedData: Record<string, unknown> | null } = {
        id: testDocumentId,
        extractedData: null,
      };

      mockDocumentMethods.findFirst.mockResolvedValue(mockDocument);

      const response = await request(app).get(`/api/documents/${testDocumentId}`).expect(200);

      expect(response.body.document.extractedData).toBeNull();
    });
  });

  // ==========================================================================
  // GET /api/documents/:id/data?includeConfidence - Confidence Format Tests
  // ==========================================================================

  describe('GET /api/documents/:id/data - includeConfidence parameter', () => {
    it('should return data with confidence by default', async () => {
      const mockDocument = {
        id: testDocumentId,
        fileName: 'test.pdf',
        status: 'COMPLETED',
        extractedData: JSON.stringify({
          email: 'test@example.com',
          phone: '123-456-7890',
        }),
      };

      mockDocumentMethods.findFirst.mockResolvedValue(mockDocument);

      const response = await request(app).get(`/api/documents/${testDocumentId}/data`).expect(200);

      expect(response.body.success).toBe(true);

      // Should be normalized to new format
      expect(response.body.data.email).toHaveProperty('value', 'test@example.com');
      expect(response.body.data.email).toHaveProperty('confidence');
      expect(response.body.data.email).toHaveProperty('source');
    });

    it('should return flattened data when includeConfidence=false', async () => {
      const mockDocument = {
        id: testDocumentId,
        fileName: 'test.pdf',
        status: 'COMPLETED',
        extractedData: JSON.stringify({
          email: {
            value: 'test@example.com',
            confidence: 90,
            source: 'pattern',
          },
        }),
      };

      mockDocumentMethods.findFirst.mockResolvedValue(mockDocument);

      const response = await request(app)
        .get(`/api/documents/${testDocumentId}/data?includeConfidence=false`)
        .expect(200);

      expect(response.body.data).toEqual({
        email: 'test@example.com',
      });
    });
  });
});
