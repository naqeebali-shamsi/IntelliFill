/**
 * Client Profile API Routes Tests
 *
 * Integration tests for Client Profile API endpoints.
 *
 * Tests cover:
 * - Authentication and authorization
 * - Profile retrieval with categorization
 * - Profile updates with manual edit flags
 * - Single field patching
 * - Field deletion
 * - Profile export (JSON and CSV)
 * - Field definitions retrieval
 * - Cross-user access prevention (security)
 *
 * @module api/__tests__/client-profile.routes.test
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import request from 'supertest';
import express, { Express } from 'express';
import { createClientProfileRoutes } from '../client-profile.routes';

// ============================================================================
// Mocks
// ============================================================================

// Mock Prisma Client
const mockClientProfileMethods = {
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockClientMethods = {
  findFirst: jest.fn(),
  findUnique: jest.fn(),
};

jest.mock('../../utils/prisma', () => ({
  prisma: {
    client: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    clientProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// Get the mocked prisma instance
const { prisma } = require('../../utils/prisma');

// Mock Supabase Auth Middleware
jest.mock('../../middleware/supabaseAuth', () => ({
  authenticateSupabase: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }),
  AuthenticatedRequest: {},
}));

// Mock logger
jest.mock('../../utils/piiSafeLogger', () => ({
  piiSafeLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock encryption with pass-through functions
jest.mock('../../utils/encryption', () => ({
  encryptJSON: (data: unknown) => data,
  decryptJSON: (data: unknown) => data,
}));

// ============================================================================
// Test Setup
// ============================================================================

describe('Client Profile API Routes', () => {
  let app: Express;

  const testUserId = 'test-user-id';
  const testClientId = 'client-123';
  const testProfileId = 'profile-456';
  const otherUserId = 'other-user-id';

  const mockClient = {
    id: testClientId,
    userId: testUserId,
    name: 'Test Client',
    type: 'INDIVIDUAL',
    status: 'ACTIVE',
    profile: null as any,
  };

  const mockProfile = {
    id: testProfileId,
    clientId: testClientId,
    data: {
      fullName: 'John Doe',
      passportNumber: 'AB123456',
      email: 'john.doe@example.com',
      emiratesId: '784-1234-5678901-1',
      customField: 'custom value',
    },
    fieldSources: {
      fullName: { documentId: 'doc-1', extractedAt: '2025-01-01T00:00:00.000Z' },
      passportNumber: { documentId: 'doc-2', extractedAt: '2025-01-01T00:00:00.000Z' },
      email: { manuallyEdited: true, editedAt: '2025-01-02T00:00:00.000Z' },
    },
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
  };

  beforeAll(() => {
    // Setup Express app with client profile routes
    // Note: These routes are normally mounted at /api/clients/:clientId/profile
    // via clients.routes.ts, but for testing we mount them directly
    app = express();
    app.use(express.json());

    // Create router that captures clientId param like the parent clients router would
    const parentRouter = express.Router();
    const profileRoutes = createClientProfileRoutes();
    parentRouter.use('/:clientId/profile', profileRoutes);
    app.use('/api/clients', parentRouter);

    // Add error handler middleware
    app.use((err: Error, req: any, res: any, next: any) => {
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset all mock functions
    prisma.client.findFirst.mockReset();
    prisma.client.findUnique.mockReset();
    prisma.clientProfile.findUnique.mockReset();
    prisma.clientProfile.create.mockReset();
    prisma.clientProfile.update.mockReset();
    prisma.clientProfile.delete.mockReset();
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

      const response = await request(app).get(`/api/clients/${testClientId}/profile`).expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 401 if user ID is missing from request', async () => {
      const { authenticateSupabase } = require('../../middleware/supabaseAuth');
      authenticateSupabase.mockImplementationOnce((req: any, res: any, next: any) => {
        req.user = { email: 'test@example.com' }; // Missing ID
        next();
      });

      const response = await request(app).get(`/api/clients/${testClientId}/profile`).expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    it('should reject cross-user access to client profile', async () => {
      // Client belongs to a different user
      prisma.client.findFirst.mockResolvedValue(null); // User's query returns nothing

      const response = await request(app).get(`/api/clients/${testClientId}/profile`).expect(404);

      expect(response.body.error).toBe('Client not found');
      expect(prisma.client.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: testClientId, userId: testUserId },
        })
      );
    });
  });

  // ==========================================================================
  // GET /api/clients/:clientId/profile - Get Client Profile
  // ==========================================================================

  describe('GET /api/clients/:clientId/profile', () => {
    it('should return existing profile with categorized structure', async () => {
      const clientWithProfile = { ...mockClient, profile: mockProfile };
      prisma.client.findFirst.mockResolvedValue(clientWithProfile);

      const response = await request(app).get(`/api/clients/${testClientId}/profile`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.clientId).toBe(testClientId);
      expect(response.body.data.clientName).toBe('Test Client');
      expect(response.body.data.profile.data).toBeDefined();
      expect(response.body.data.profile.categorizedData).toBeDefined();
      expect(response.body.data.profile.fieldSources).toBeDefined();
      expect(response.body.data.fieldDefinitions).toBeDefined();
    });

    it('should auto-create profile if none exists (empty profile state)', async () => {
      const clientWithoutProfile = { ...mockClient, profile: null as null };
      prisma.client.findFirst.mockResolvedValue(clientWithoutProfile);

      const newProfile = {
        id: 'new-profile-id',
        clientId: testClientId,
        data: {},
        fieldSources: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.clientProfile.create.mockResolvedValue(newProfile);

      const response = await request(app).get(`/api/clients/${testClientId}/profile`).expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.clientProfile.create).toHaveBeenCalledWith({
        data: {
          clientId: testClientId,
          data: {},
          fieldSources: {},
        },
      });
    });

    it('should return 404 for non-existent client', async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/clients/non-existent-client/profile')
        .expect(404);

      expect(response.body.error).toBe('Client not found');
    });

    it('should categorize fields correctly by type', async () => {
      const fullProfile = {
        ...mockProfile,
        data: {
          fullName: 'John Doe',
          passportNumber: 'AB123456',
          passportExpiryDate: '2030-01-01',
          emiratesId: '784-1234-5678901-1',
          visaNumber: 'V12345',
          companyNameEn: 'Test Corp',
          email: 'john@example.com',
          occupation: 'Engineer',
          customField: 'custom value',
        },
      };
      prisma.client.findFirst.mockResolvedValue({ ...mockClient, profile: fullProfile });

      const response = await request(app).get(`/api/clients/${testClientId}/profile`).expect(200);

      const categorizedData = response.body.data.profile.categorizedData;

      // Check that fields are in correct categories
      expect(categorizedData.personal.fullName).toBeDefined();
      expect(categorizedData.passport.passportNumber).toBeDefined();
      expect(categorizedData.passport.passportExpiryDate).toBeDefined();
      expect(categorizedData.emiratesId.emiratesId).toBeDefined();
      expect(categorizedData.visa.visaNumber).toBeDefined();
      expect(categorizedData.company.companyNameEn).toBeDefined();
      expect(categorizedData.contact.email).toBeDefined();
      expect(categorizedData.employment.occupation).toBeDefined();
      expect(categorizedData.custom.customField).toBeDefined();
    });

    it('should include source information for each field', async () => {
      const clientWithProfile = { ...mockClient, profile: mockProfile };
      prisma.client.findFirst.mockResolvedValue(clientWithProfile);

      const response = await request(app).get(`/api/clients/${testClientId}/profile`).expect(200);

      const personalCategory = response.body.data.profile.categorizedData.personal;
      expect(personalCategory.fullName.source).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      prisma.client.findFirst.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app).get(`/api/clients/${testClientId}/profile`).expect(500);

      expect(response.body).toBeDefined();
    });
  });

  // ==========================================================================
  // PUT /api/clients/:clientId/profile - Update Client Profile
  // ==========================================================================

  describe('PUT /api/clients/:clientId/profile', () => {
    it('should update profile with simple data object', async () => {
      const clientWithProfile = { ...mockClient, profile: mockProfile };
      prisma.client.findFirst.mockResolvedValue(clientWithProfile);

      const updatedProfile = {
        ...mockProfile,
        data: { ...mockProfile.data, fullName: 'Jane Doe', phone: '+971501234567' },
        updatedAt: new Date(),
      };
      prisma.clientProfile.update.mockResolvedValue(updatedProfile);

      const response = await request(app)
        .put(`/api/clients/${testClientId}/profile`)
        .send({ data: { fullName: 'Jane Doe', phone: '+971501234567' } })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
      expect(prisma.clientProfile.update).toHaveBeenCalled();
    });

    it('should automatically mark updated fields as manually edited', async () => {
      const clientWithProfile = { ...mockClient, profile: mockProfile };
      prisma.client.findFirst.mockResolvedValue(clientWithProfile);
      prisma.clientProfile.update.mockResolvedValue({ ...mockProfile, updatedAt: new Date() });

      await request(app)
        .put(`/api/clients/${testClientId}/profile`)
        .send({ data: { fullName: 'Jane Doe' } })
        .expect(200);

      const updateCall = prisma.clientProfile.update.mock.calls[0][0];
      expect(updateCall.data.fieldSources.fullName.manuallyEdited).toBe(true);
      expect(updateCall.data.fieldSources.fullName.editedAt).toBeDefined();
    });

    it('should create profile if none exists when updating', async () => {
      const clientWithoutProfile = { ...mockClient, profile: null as null };
      prisma.client.findFirst.mockResolvedValue(clientWithoutProfile);

      const newProfile = {
        id: 'new-profile-id',
        clientId: testClientId,
        data: {},
        fieldSources: {},
      };
      prisma.clientProfile.create.mockResolvedValue(newProfile);
      prisma.clientProfile.update.mockResolvedValue({
        ...newProfile,
        data: { fullName: 'Jane Doe' },
        updatedAt: new Date(),
      });

      const response = await request(app)
        .put(`/api/clients/${testClientId}/profile`)
        .send({ data: { fullName: 'Jane Doe' } })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.clientProfile.create).toHaveBeenCalled();
    });

    it('should update profile with detailed fields object', async () => {
      const clientWithProfile = { ...mockClient, profile: mockProfile };
      prisma.client.findFirst.mockResolvedValue(clientWithProfile);
      prisma.clientProfile.update.mockResolvedValue({ ...mockProfile, updatedAt: new Date() });

      const response = await request(app)
        .put(`/api/clients/${testClientId}/profile`)
        .send({
          fields: {
            fullName: { value: 'Jane Doe', manuallyEdited: true },
            passportNumber: { value: 'CD789012', manuallyEdited: false },
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 400 for invalid request body', async () => {
      prisma.client.findFirst.mockResolvedValue({ ...mockClient, profile: mockProfile });

      const response = await request(app)
        .put(`/api/clients/${testClientId}/profile`)
        .send({ invalidKey: 'some value', data: 'not an object' })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 404 for non-existent client', async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .put(`/api/clients/${testClientId}/profile`)
        .send({ data: { fullName: 'Jane Doe' } })
        .expect(404);

      expect(response.body.error).toBe('Client not found');
    });

    it('should handle update errors gracefully', async () => {
      prisma.client.findFirst.mockResolvedValue({ ...mockClient, profile: mockProfile });
      prisma.clientProfile.update.mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .put(`/api/clients/${testClientId}/profile`)
        .send({ data: { fullName: 'Jane Doe' } })
        .expect(500);

      expect(response.body).toBeDefined();
    });
  });

  // ==========================================================================
  // PATCH /api/clients/:clientId/profile/fields/:fieldName - Update Single Field
  // ==========================================================================

  describe('PATCH /api/clients/:clientId/profile/fields/:fieldName', () => {
    it('should update a single field successfully', async () => {
      const clientWithProfile = { ...mockClient, profile: mockProfile };
      prisma.client.findFirst.mockResolvedValue(clientWithProfile);
      prisma.clientProfile.update.mockResolvedValue({ ...mockProfile, updatedAt: new Date() });

      const response = await request(app)
        .patch(`/api/clients/${testClientId}/profile/fields/fullName`)
        .send({ value: 'Jane Doe' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('fullName');
      expect(response.body.data.fieldName).toBe('fullName');
      expect(response.body.data.value).toBe('Jane Doe');
      expect(response.body.data.manuallyEdited).toBe(true);
    });

    it('should create profile if none exists when patching field', async () => {
      const clientWithoutProfile = { ...mockClient, profile: null as null };
      prisma.client.findFirst.mockResolvedValue(clientWithoutProfile);

      const newProfile = {
        id: 'new-profile-id',
        clientId: testClientId,
        data: {},
        fieldSources: {},
      };
      prisma.clientProfile.create.mockResolvedValue(newProfile);
      prisma.clientProfile.update.mockResolvedValue({
        ...newProfile,
        data: { newField: 'new value' },
        updatedAt: new Date(),
      });

      const response = await request(app)
        .patch(`/api/clients/${testClientId}/profile/fields/newField`)
        .send({ value: 'new value' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.clientProfile.create).toHaveBeenCalled();
    });

    it('should return 400 if value is not provided', async () => {
      prisma.client.findFirst.mockResolvedValue({ ...mockClient, profile: mockProfile });

      const response = await request(app)
        .patch(`/api/clients/${testClientId}/profile/fields/fullName`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Value is required');
    });

    it('should return 404 for non-existent client', async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .patch(`/api/clients/${testClientId}/profile/fields/fullName`)
        .send({ value: 'Jane Doe' })
        .expect(404);

      expect(response.body.error).toBe('Client not found');
    });

    it('should handle different value types (string, number, boolean)', async () => {
      const clientWithProfile = { ...mockClient, profile: mockProfile };
      prisma.client.findFirst.mockResolvedValue(clientWithProfile);
      prisma.clientProfile.update.mockResolvedValue({ ...mockProfile, updatedAt: new Date() });

      // String value
      await request(app)
        .patch(`/api/clients/${testClientId}/profile/fields/fullName`)
        .send({ value: 'Jane Doe' })
        .expect(200);

      // Number value
      await request(app)
        .patch(`/api/clients/${testClientId}/profile/fields/salary`)
        .send({ value: 50000 })
        .expect(200);

      // Boolean value
      await request(app)
        .patch(`/api/clients/${testClientId}/profile/fields/isActive`)
        .send({ value: true })
        .expect(200);

      expect(prisma.clientProfile.update).toHaveBeenCalledTimes(3);
    });
  });

  // ==========================================================================
  // DELETE /api/clients/:clientId/profile/fields/:fieldName - Remove Field
  // ==========================================================================

  describe('DELETE /api/clients/:clientId/profile/fields/:fieldName', () => {
    it('should remove a field from profile successfully', async () => {
      const clientWithProfile = { ...mockClient, profile: mockProfile };
      prisma.client.findFirst.mockResolvedValue(clientWithProfile);
      prisma.clientProfile.update.mockResolvedValue({ ...mockProfile, updatedAt: new Date() });

      const response = await request(app)
        .delete(`/api/clients/${testClientId}/profile/fields/fullName`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('fullName');

      // Verify the field was removed from both data and fieldSources
      const updateCall = prisma.clientProfile.update.mock.calls[0][0];
      expect(updateCall.data.data).not.toHaveProperty('fullName');
      expect(updateCall.data.fieldSources).not.toHaveProperty('fullName');
    });

    it('should return 404 if profile does not exist', async () => {
      const clientWithoutProfile = { ...mockClient, profile: null as null };
      prisma.client.findFirst.mockResolvedValue(clientWithoutProfile);

      const response = await request(app)
        .delete(`/api/clients/${testClientId}/profile/fields/fullName`)
        .expect(404);

      expect(response.body.error).toBe('Profile not found');
    });

    it('should return 404 for non-existent client', async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/clients/${testClientId}/profile/fields/fullName`)
        .expect(404);

      expect(response.body.error).toBe('Client not found');
    });

    it('should handle deletion of non-existent field gracefully', async () => {
      const clientWithProfile = { ...mockClient, profile: mockProfile };
      prisma.client.findFirst.mockResolvedValue(clientWithProfile);
      prisma.clientProfile.update.mockResolvedValue({ ...mockProfile, updatedAt: new Date() });

      // Deleting a field that does not exist should still succeed
      const response = await request(app)
        .delete(`/api/clients/${testClientId}/profile/fields/nonExistentField`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  // ==========================================================================
  // GET /api/clients/:clientId/profile/export - Export Profile
  // ==========================================================================

  describe('GET /api/clients/:clientId/profile/export', () => {
    it('should export profile in JSON format by default', async () => {
      const clientWithProfile = { ...mockClient, profile: mockProfile };
      prisma.client.findFirst.mockResolvedValue(clientWithProfile);

      const response = await request(app)
        .get(`/api/clients/${testClientId}/profile/export`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.client).toBeDefined();
      expect(response.body.data.client.id).toBe(testClientId);
      expect(response.body.data.client.name).toBe('Test Client');
      expect(response.body.data.profile).toBeDefined();
      expect(response.body.data.exportedAt).toBeDefined();
    });

    it('should export profile in JSON format with explicit format parameter', async () => {
      const clientWithProfile = { ...mockClient, profile: mockProfile };
      prisma.client.findFirst.mockResolvedValue(clientWithProfile);

      const response = await request(app)
        .get(`/api/clients/${testClientId}/profile/export?format=json`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.profile).toBeDefined();
    });

    it('should export profile in CSV format', async () => {
      const clientWithProfile = { ...mockClient, profile: mockProfile };
      prisma.client.findFirst.mockResolvedValue(clientWithProfile);

      const response = await request(app)
        .get(`/api/clients/${testClientId}/profile/export?format=csv`)
        .expect(200);

      expect(response.header['content-type']).toContain('text/csv');
      expect(response.header['content-disposition']).toContain('attachment');
      expect(response.header['content-disposition']).toContain('.csv');

      // Verify CSV content structure
      const csvContent = response.text;
      expect(csvContent).toContain('"Field","Value"');
      expect(csvContent).toContain('Full Name');
    });

    it('should return 404 for non-existent client', async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/clients/${testClientId}/profile/export`)
        .expect(404);

      expect(response.body.error).toBe('Client not found');
    });

    it('should handle export of empty profile', async () => {
      const clientWithEmptyProfile = {
        ...mockClient,
        profile: {
          id: 'profile-id',
          clientId: testClientId,
          data: {},
          fieldSources: {},
        },
      };
      prisma.client.findFirst.mockResolvedValue(clientWithEmptyProfile);

      const response = await request(app)
        .get(`/api/clients/${testClientId}/profile/export`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.profile).toEqual({});
    });

    it('should handle export of profile with special characters in CSV', async () => {
      const profileWithSpecialChars = {
        ...mockProfile,
        data: {
          fullName: 'John "Johnny" Doe',
          notes: 'Line1\nLine2',
        },
      };
      const clientWithProfile = { ...mockClient, profile: profileWithSpecialChars };
      prisma.client.findFirst.mockResolvedValue(clientWithProfile);

      const response = await request(app)
        .get(`/api/clients/${testClientId}/profile/export?format=csv`)
        .expect(200);

      // CSV should handle quotes properly
      expect(response.text).toContain('""'); // Escaped quotes
    });
  });

  // ==========================================================================
  // GET /api/clients/:clientId/profile/fields - Get Field Definitions
  // ==========================================================================

  describe('GET /api/clients/:clientId/profile/fields', () => {
    it('should return all field definitions', async () => {
      const response = await request(app)
        .get(`/api/clients/${testClientId}/profile/fields`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fields).toBeDefined();
      expect(response.body.data.categories).toBeDefined();
    });

    it('should include all standard UAE PRO agency fields', async () => {
      const response = await request(app)
        .get(`/api/clients/${testClientId}/profile/fields`)
        .expect(200);

      const fields = response.body.data.fields;

      // Check personal information fields
      expect(fields.fullName).toBeDefined();
      expect(fields.fullName.category).toBe('personal');

      // Check passport fields
      expect(fields.passportNumber).toBeDefined();
      expect(fields.passportNumber.category).toBe('passport');

      // Check Emirates ID fields
      expect(fields.emiratesId).toBeDefined();
      expect(fields.emiratesId.category).toBe('emiratesId');

      // Check visa fields
      expect(fields.visaNumber).toBeDefined();
      expect(fields.visaNumber.category).toBe('visa');

      // Check company fields
      expect(fields.companyNameEn).toBeDefined();
      expect(fields.companyNameEn.category).toBe('company');

      // Check contact fields
      expect(fields.email).toBeDefined();
      expect(fields.email.category).toBe('contact');

      // Check employment fields
      expect(fields.occupation).toBeDefined();
      expect(fields.occupation.category).toBe('employment');
    });

    it('should include all category definitions', async () => {
      const response = await request(app)
        .get(`/api/clients/${testClientId}/profile/fields`)
        .expect(200);

      const categories = response.body.data.categories;

      expect(categories.personal).toBe('Personal Information');
      expect(categories.passport).toBe('Passport Details');
      expect(categories.emiratesId).toBe('Emirates ID');
      expect(categories.visa).toBe('Visa Details');
      expect(categories.company).toBe('Company Details');
      expect(categories.contact).toBe('Contact Information');
      expect(categories.employment).toBe('Employment Details');
      expect(categories.custom).toBe('Custom Fields');
    });
  });

  // ==========================================================================
  // Security Tests
  // ==========================================================================

  describe('Security', () => {
    it('should prevent access to another user profile via GET', async () => {
      // Mock auth for different user
      const { authenticateSupabase } = require('../../middleware/supabaseAuth');
      authenticateSupabase.mockImplementationOnce((req: any, res: any, next: any) => {
        req.user = { id: otherUserId, email: 'other@example.com' };
        next();
      });

      // Client query should return null because userId does not match
      prisma.client.findFirst.mockResolvedValue(null);

      const response = await request(app).get(`/api/clients/${testClientId}/profile`).expect(404);

      expect(response.body.error).toBe('Client not found');
    });

    it('should prevent access to another user profile via PUT', async () => {
      const { authenticateSupabase } = require('../../middleware/supabaseAuth');
      authenticateSupabase.mockImplementationOnce((req: any, res: any, next: any) => {
        req.user = { id: otherUserId, email: 'other@example.com' };
        next();
      });

      prisma.client.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .put(`/api/clients/${testClientId}/profile`)
        .send({ data: { fullName: 'Hacker' } })
        .expect(404);

      expect(response.body.error).toBe('Client not found');
    });

    it('should prevent access to another user profile via PATCH', async () => {
      const { authenticateSupabase } = require('../../middleware/supabaseAuth');
      authenticateSupabase.mockImplementationOnce((req: any, res: any, next: any) => {
        req.user = { id: otherUserId, email: 'other@example.com' };
        next();
      });

      prisma.client.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .patch(`/api/clients/${testClientId}/profile/fields/fullName`)
        .send({ value: 'Hacker' })
        .expect(404);

      expect(response.body.error).toBe('Client not found');
    });

    it('should prevent access to another user profile via DELETE', async () => {
      const { authenticateSupabase } = require('../../middleware/supabaseAuth');
      authenticateSupabase.mockImplementationOnce((req: any, res: any, next: any) => {
        req.user = { id: otherUserId, email: 'other@example.com' };
        next();
      });

      prisma.client.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/clients/${testClientId}/profile/fields/fullName`)
        .expect(404);

      expect(response.body.error).toBe('Client not found');
    });

    it('should prevent access to another user profile export', async () => {
      const { authenticateSupabase } = require('../../middleware/supabaseAuth');
      authenticateSupabase.mockImplementationOnce((req: any, res: any, next: any) => {
        req.user = { id: otherUserId, email: 'other@example.com' };
        next();
      });

      prisma.client.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/clients/${testClientId}/profile/export`)
        .expect(404);

      expect(response.body.error).toBe('Client not found');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle profile with null data gracefully', async () => {
      const profileWithNullData = {
        ...mockProfile,
        data: null as null,
        fieldSources: null as null,
      };
      prisma.client.findFirst.mockResolvedValue({
        ...mockClient,
        profile: profileWithNullData,
      });

      const response = await request(app).get(`/api/clients/${testClientId}/profile`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.profile.data).toEqual({});
    });

    it('should handle update with empty data object', async () => {
      prisma.client.findFirst.mockResolvedValue({ ...mockClient, profile: mockProfile });
      prisma.clientProfile.update.mockResolvedValue({ ...mockProfile, updatedAt: new Date() });

      const response = await request(app)
        .put(`/api/clients/${testClientId}/profile`)
        .send({ data: {} })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle special characters in field names', async () => {
      const clientWithProfile = { ...mockClient, profile: mockProfile };
      prisma.client.findFirst.mockResolvedValue(clientWithProfile);
      prisma.clientProfile.update.mockResolvedValue({ ...mockProfile, updatedAt: new Date() });

      const response = await request(app)
        .patch(`/api/clients/${testClientId}/profile/fields/customField_withUnderscore`)
        .send({ value: 'test' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle very long field values', async () => {
      const clientWithProfile = { ...mockClient, profile: mockProfile };
      prisma.client.findFirst.mockResolvedValue(clientWithProfile);
      prisma.clientProfile.update.mockResolvedValue({ ...mockProfile, updatedAt: new Date() });

      const longValue = 'a'.repeat(10000);
      const response = await request(app)
        .patch(`/api/clients/${testClientId}/profile/fields/notes`)
        .send({ value: longValue })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle null value in PATCH request', async () => {
      const clientWithProfile = { ...mockClient, profile: mockProfile };
      prisma.client.findFirst.mockResolvedValue(clientWithProfile);
      prisma.clientProfile.update.mockResolvedValue({ ...mockProfile, updatedAt: new Date() });

      const response = await request(app)
        .patch(`/api/clients/${testClientId}/profile/fields/optionalField`)
        .send({ value: null })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should preserve existing fields when updating specific fields', async () => {
      const existingProfile = {
        ...mockProfile,
        data: {
          fullName: 'John Doe',
          email: 'john@example.com',
          phone: '+971501234567',
        },
        fieldSources: {
          fullName: { documentId: 'doc-1' },
          email: { documentId: 'doc-2' },
          phone: { manuallyEdited: true },
        },
      };
      prisma.client.findFirst.mockResolvedValue({
        ...mockClient,
        profile: existingProfile,
      });
      prisma.clientProfile.update.mockResolvedValue({
        ...existingProfile,
        updatedAt: new Date(),
      });

      await request(app)
        .put(`/api/clients/${testClientId}/profile`)
        .send({ data: { fullName: 'Jane Doe' } })
        .expect(200);

      const updateCall = prisma.clientProfile.update.mock.calls[0][0];
      // Should preserve email and phone
      expect(updateCall.data.data.email).toBe('john@example.com');
      expect(updateCall.data.data.phone).toBe('+971501234567');
      // Should update fullName
      expect(updateCall.data.data.fullName).toBe('Jane Doe');
    });
  });
});
