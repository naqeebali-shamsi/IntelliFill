/**
 * Filled Forms API Routes Tests
 *
 * Task 488: Unit tests for Filled Forms management API endpoints.
 *
 * Tests cover:
 * - Authentication and authorization
 * - Form generation from templates and client profiles
 * - Filled forms CRUD operations
 * - Form preview functionality
 * - Form regeneration
 * - PDF download
 * - Pagination and filtering
 *
 * @module api/__tests__/filled-forms.routes.test
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import request from 'supertest';
import express, { Express } from 'express';

// ============================================================================
// Mocks - Must be defined before imports that use them
// ============================================================================

// Mock utils/prisma BEFORE importing the routes
jest.mock('../../utils/prisma', () => {
  const mockFilledFormMethods = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  const mockFormTemplateMethods = {
    findFirst: jest.fn(),
  };

  const mockClientMethods = {
    findFirst: jest.fn(),
  };

  return {
    prisma: {
      filledForm: mockFilledFormMethods,
      formTemplate: mockFormTemplateMethods,
      client: mockClientMethods,
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    },
    ensureDbConnection: jest.fn().mockResolvedValue(true),
    startKeepalive: jest.fn(),
    stopKeepalive: jest.fn(),
  };
});

// Mock Supabase Auth Middleware
jest.mock('../../middleware/supabaseAuth', () => ({
  authenticateSupabase: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }),
  AuthenticatedRequest: {},
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

// Mock fs/promises
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4')),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

// Mock pdf-lib
jest.mock('pdf-lib', () => {
  const mockTextField = {
    getName: jest.fn().mockReturnValue('firstName'),
    setText: jest.fn(),
  };

  const mockForm = {
    getFields: jest.fn().mockReturnValue([mockTextField]),
    getTextField: jest.fn().mockReturnValue(mockTextField),
  };

  const mockPdfDoc = {
    getForm: jest.fn().mockReturnValue(mockForm),
    save: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4')),
  };

  return {
    PDFDocument: {
      load: jest.fn().mockResolvedValue(mockPdfDoc),
    },
    PDFTextField: class {},
    PDFCheckBox: class {},
    PDFDropdown: class {},
    PDFRadioGroup: class {},
  };
});

// Now import modules after mocks are set up
import { createFilledFormRoutes } from '../filled-forms.routes';
import { prisma } from '../../utils/prisma';

// ============================================================================
// Test Setup
// ============================================================================

describe('Filled Forms API Routes', () => {
  let app: Express;

  // Get references to mocked methods
  const mockFilledFormMethods = prisma.filledForm as any;
  const mockFormTemplateMethods = prisma.formTemplate as any;
  const mockClientMethods = prisma.client as any;

  const testUserId = 'test-user-id';
  const testFilledFormId = '550e8400-e29b-41d4-a716-446655440001';
  const testTemplateId = '550e8400-e29b-41d4-a716-446655440002';
  const testClientId = '550e8400-e29b-41d4-a716-446655440003';

  const mockTemplate = {
    id: testTemplateId,
    userId: testUserId,
    name: 'Test Template',
    fileUrl: 'uploads/templates/test.pdf',
    fieldMappings: { firstName: 'first_name', lastName: 'last_name' },
    detectedFields: ['firstName', 'lastName', 'email'],
    isActive: true,
  };

  const mockClient = {
    id: testClientId,
    userId: testUserId,
    name: 'Test Client',
    type: 'INDIVIDUAL',
    profile: {
      data: { first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
    },
  };

  const mockFilledForm = {
    id: testFilledFormId,
    clientId: testClientId,
    templateId: testTemplateId,
    userId: testUserId,
    fileUrl: 'outputs/filled-forms/test-filled.pdf',
    dataSnapshot: { first_name: 'John', last_name: 'Doe' },
    createdAt: new Date('2024-01-15T10:00:00Z'),
    client: { id: testClientId, name: 'Test Client', type: 'INDIVIDUAL' },
    template: { id: testTemplateId, name: 'Test Template', category: 'VISA', fieldMappings: {} },
  };

  beforeAll(() => {
    // Setup Express app with filled form routes
    app = express();
    app.use(express.json());

    // Add error handler
    const filledFormRoutes = createFilledFormRoutes();
    app.use('/api/filled-forms', filledFormRoutes);

    // Error handler middleware
    app.use((err: any, req: any, res: any, next: any) => {
      res.status(500).json({ error: err.message });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
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

      const response = await request(app).get('/api/filled-forms').expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });
  });

  // ==========================================================================
  // GET /api/filled-forms - List Filled Forms
  // ==========================================================================

  describe('GET /api/filled-forms', () => {
    it('should list user filled forms with pagination', async () => {
      const mockForms = [mockFilledForm];

      mockFilledFormMethods.findMany.mockResolvedValue(mockForms);
      mockFilledFormMethods.count.mockResolvedValue(1);

      const response = await request(app).get('/api/filled-forms').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filledForms).toHaveLength(1);
      expect(response.body.data.filledForms[0].id).toBe(testFilledFormId);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.total).toBe(1);
    });

    it('should filter by clientId', async () => {
      mockFilledFormMethods.findMany.mockResolvedValue([]);
      mockFilledFormMethods.count.mockResolvedValue(0);

      await request(app).get(`/api/filled-forms?clientId=${testClientId}`).expect(200);

      expect(mockFilledFormMethods.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientId: testClientId,
          }),
        })
      );
    });

    it('should filter by templateId', async () => {
      mockFilledFormMethods.findMany.mockResolvedValue([]);
      mockFilledFormMethods.count.mockResolvedValue(0);

      await request(app).get(`/api/filled-forms?templateId=${testTemplateId}`).expect(200);

      expect(mockFilledFormMethods.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            templateId: testTemplateId,
          }),
        })
      );
    });

    it('should support pagination with limit and offset', async () => {
      mockFilledFormMethods.findMany.mockResolvedValue([]);
      mockFilledFormMethods.count.mockResolvedValue(50);

      const response = await request(app)
        .get('/api/filled-forms?limit=10&offset=20')
        .expect(200);

      expect(mockFilledFormMethods.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
      expect(response.body.data.pagination.hasMore).toBe(true);
    });

    it('should return 400 for invalid query parameters', async () => {
      const response = await request(app)
        .get('/api/filled-forms?clientId=not-a-uuid')
        .expect(400);

      expect(response.body.error).toBe('Invalid query parameters');
    });
  });

  // ==========================================================================
  // GET /api/filled-forms/:id - Get Single Filled Form
  // ==========================================================================

  describe('GET /api/filled-forms/:id', () => {
    it('should return filled form details', async () => {
      mockFilledFormMethods.findFirst.mockResolvedValue(mockFilledForm);

      const response = await request(app)
        .get(`/api/filled-forms/${testFilledFormId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filledForm.id).toBe(testFilledFormId);
      expect(response.body.data.filledForm.clientName).toBe('Test Client');
      expect(response.body.data.filledForm.templateName).toBe('Test Template');
      expect(response.body.data.filledForm.dataSnapshot).toBeDefined();
    });

    it('should return 404 for non-existent filled form', async () => {
      mockFilledFormMethods.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/filled-forms/${testFilledFormId}`)
        .expect(404);

      expect(response.body.error).toBe('Filled form not found');
    });
  });

  // ==========================================================================
  // POST /api/filled-forms/generate - Generate Filled Form
  // ==========================================================================

  describe('POST /api/filled-forms/generate', () => {
    it('should generate a filled form from template and client', async () => {
      mockFormTemplateMethods.findFirst.mockResolvedValue(mockTemplate);
      mockClientMethods.findFirst.mockResolvedValue(mockClient);
      mockFilledFormMethods.create.mockResolvedValue({
        id: testFilledFormId,
        clientId: testClientId,
        templateId: testTemplateId,
        userId: testUserId,
        fileUrl: 'outputs/filled-forms/test-client_test-template_123456.pdf',
        dataSnapshot: mockClient.profile.data,
        createdAt: new Date(),
      });

      const response = await request(app)
        .post('/api/filled-forms/generate')
        .send({ templateId: testTemplateId, clientId: testClientId })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Form generated successfully');
      expect(response.body.data.filledForm.id).toBe(testFilledFormId);
      expect(response.body.data.filledForm.downloadUrl).toContain(testFilledFormId);
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/filled-forms/generate')
        .send({ templateId: 'not-a-uuid' })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 404 if template not found', async () => {
      mockFormTemplateMethods.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/filled-forms/generate')
        .send({ templateId: testTemplateId, clientId: testClientId })
        .expect(404);

      expect(response.body.error).toBe('Form template not found or not accessible');
    });

    it('should return 404 if client not found', async () => {
      mockFormTemplateMethods.findFirst.mockResolvedValue(mockTemplate);
      mockClientMethods.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/filled-forms/generate')
        .send({ templateId: testTemplateId, clientId: testClientId })
        .expect(404);

      expect(response.body.error).toBe('Client not found');
    });

    it('should return 400 if template has no field mappings', async () => {
      mockFormTemplateMethods.findFirst.mockResolvedValue({
        ...mockTemplate,
        fieldMappings: {},
      });
      mockClientMethods.findFirst.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/filled-forms/generate')
        .send({ templateId: testTemplateId, clientId: testClientId })
        .expect(400);

      expect(response.body.error).toBe('No field mappings configured');
    });

    it('should support override data', async () => {
      mockFormTemplateMethods.findFirst.mockResolvedValue(mockTemplate);
      mockClientMethods.findFirst.mockResolvedValue(mockClient);
      mockFilledFormMethods.create.mockResolvedValue({
        ...mockFilledForm,
        dataSnapshot: { first_name: 'Jane', last_name: 'Doe' },
      });

      const response = await request(app)
        .post('/api/filled-forms/generate')
        .send({
          templateId: testTemplateId,
          clientId: testClientId,
          overrideData: { first_name: 'Jane' },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  // ==========================================================================
  // POST /api/filled-forms/preview - Preview Form Filling
  // ==========================================================================

  describe('POST /api/filled-forms/preview', () => {
    it('should preview form filling without saving', async () => {
      mockFormTemplateMethods.findFirst.mockResolvedValue(mockTemplate);
      mockClientMethods.findFirst.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/filled-forms/preview')
        .send({ templateId: testTemplateId, clientId: testClientId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.template).toBeDefined();
      expect(response.body.data.client).toBeDefined();
      expect(response.body.data.preview).toBeDefined();
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.summary.completionPercentage).toBeDefined();
    });

    it('should return 404 if template not found', async () => {
      mockFormTemplateMethods.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/filled-forms/preview')
        .send({ templateId: testTemplateId, clientId: testClientId })
        .expect(404);

      expect(response.body.error).toBe('Form template not found');
    });

    it('should return 404 if client not found', async () => {
      mockFormTemplateMethods.findFirst.mockResolvedValueOnce(mockTemplate);
      mockClientMethods.findFirst.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/filled-forms/preview')
        .send({ templateId: testTemplateId, clientId: testClientId })
        .expect(404);

      expect(response.body.error).toBe('Client not found');
    });

    it('should show unmapped fields in preview', async () => {
      mockFormTemplateMethods.findFirst.mockResolvedValueOnce({
        ...mockTemplate,
        fieldMappings: { firstName: 'first_name' }, // Only firstName mapped
      });
      mockClientMethods.findFirst.mockResolvedValueOnce(mockClient);

      const response = await request(app)
        .post('/api/filled-forms/preview')
        .send({ templateId: testTemplateId, clientId: testClientId })
        .expect(200);

      expect(response.body.data.summary.unmappedCount).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // DELETE /api/filled-forms/:id - Delete Filled Form
  // ==========================================================================

  describe('DELETE /api/filled-forms/:id', () => {
    it('should delete filled form and file', async () => {
      mockFilledFormMethods.findFirst.mockResolvedValue(mockFilledForm);
      mockFilledFormMethods.delete.mockResolvedValue(mockFilledForm);

      const response = await request(app)
        .delete(`/api/filled-forms/${testFilledFormId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Filled form deleted successfully');
      expect(mockFilledFormMethods.delete).toHaveBeenCalledWith({
        where: { id: testFilledFormId },
      });
    });

    it('should return 404 for non-existent filled form', async () => {
      mockFilledFormMethods.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/filled-forms/${testFilledFormId}`)
        .expect(404);

      expect(response.body.error).toBe('Filled form not found');
    });

    it('should continue deletion even if file removal fails', async () => {
      mockFilledFormMethods.findFirst.mockResolvedValue(mockFilledForm);
      mockFilledFormMethods.delete.mockResolvedValue(mockFilledForm);

      const mockFs = require('fs/promises');
      mockFs.unlink.mockRejectedValueOnce(new Error('File not found'));

      const response = await request(app)
        .delete(`/api/filled-forms/${testFilledFormId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  // ==========================================================================
  // GET /api/filled-forms/:id/download - Download Filled Form
  // ==========================================================================

  describe('GET /api/filled-forms/:id/download', () => {
    it('should return 404 for non-existent filled form', async () => {
      mockFilledFormMethods.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/filled-forms/${testFilledFormId}/download`)
        .expect(404);

      expect(response.body.error).toBe('Filled form not found');
    });

    it('should return 404 if PDF file not found on disk', async () => {
      mockFilledFormMethods.findFirst.mockResolvedValue(mockFilledForm);

      const mockFs = require('fs/promises');
      mockFs.access.mockRejectedValueOnce(new Error('File not found'));

      const response = await request(app)
        .get(`/api/filled-forms/${testFilledFormId}/download`)
        .expect(404);

      expect(response.body.error).toBe('PDF file not found on disk');
    });
  });

  // ==========================================================================
  // POST /api/filled-forms/:id/regenerate - Regenerate Filled Form
  // ==========================================================================

  describe('POST /api/filled-forms/:id/regenerate', () => {
    it('should regenerate filled form with current profile data', async () => {
      const existingForm = {
        ...mockFilledForm,
        template: mockTemplate,
        client: mockClient,
      };

      mockFilledFormMethods.findFirst.mockResolvedValue(existingForm);
      mockFilledFormMethods.update.mockResolvedValue({
        ...mockFilledForm,
        fileUrl: 'outputs/filled-forms/regenerated.pdf',
      });

      const response = await request(app)
        .post(`/api/filled-forms/${testFilledFormId}/regenerate`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Form regenerated successfully');
      expect(response.body.data.filledForm.downloadUrl).toBeDefined();
    });

    it('should return 404 for non-existent filled form', async () => {
      mockFilledFormMethods.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/filled-forms/${testFilledFormId}/regenerate`)
        .expect(404);

      expect(response.body.error).toBe('Filled form not found');
    });

    it('should return 404 if template file no longer available', async () => {
      mockFilledFormMethods.findFirst.mockResolvedValue({
        ...mockFilledForm,
        template: mockTemplate,
        client: mockClient,
      });

      const mockFs = require('fs/promises');
      mockFs.access.mockRejectedValueOnce(new Error('File not found'));

      const response = await request(app)
        .post(`/api/filled-forms/${testFilledFormId}/regenerate`)
        .expect(404);

      expect(response.body.error).toBe('Template file no longer available');
    });

    it('should delete old file after regeneration', async () => {
      const existingForm = {
        ...mockFilledForm,
        template: mockTemplate,
        client: mockClient,
      };

      mockFilledFormMethods.findFirst.mockResolvedValue(existingForm);
      mockFilledFormMethods.update.mockResolvedValue(mockFilledForm);

      const mockFs = require('fs/promises');

      await request(app)
        .post(`/api/filled-forms/${testFilledFormId}/regenerate`)
        .expect(200);

      expect(mockFs.unlink).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Edge Cases and Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockFilledFormMethods.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/filled-forms').expect(500);

      expect(response.body).toBeDefined();
    });

    it('should handle PDF generation errors', async () => {
      mockFormTemplateMethods.findFirst.mockResolvedValueOnce(mockTemplate);
      mockClientMethods.findFirst.mockResolvedValueOnce(mockClient);

      const { PDFDocument } = require('pdf-lib');
      PDFDocument.load.mockRejectedValueOnce(new Error('Invalid PDF'));

      const response = await request(app)
        .post('/api/filled-forms/generate')
        .send({ templateId: testTemplateId, clientId: testClientId })
        .expect(500);

      expect(response.body).toBeDefined();
    });
  });
});
