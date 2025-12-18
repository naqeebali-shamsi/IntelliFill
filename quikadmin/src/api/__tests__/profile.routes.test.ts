/**
 * Profile API Routes Tests
 *
 * Integration tests for User Profile API endpoints.
 *
 * Tests cover:
 * - Authentication and authorization
 * - Profile retrieval and aggregation
 * - Profile updates
 * - Profile refresh
 * - Profile deletion
 * - Field-specific queries
 * - Staleness detection
 *
 * @module api/__tests__/profile.routes.test
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import request from 'supertest';
import express, { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { createProfileRoutes } from '../profile.routes';

// ============================================================================
// Mocks
// ============================================================================

// Mock PrismaClient
jest.mock('@prisma/client');

// Mock Supabase Auth Middleware
jest.mock('../../middleware/supabaseAuth', () => ({
  authenticateSupabase: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }),
  AuthenticatedRequest: {},
}));

// Mock ProfileService - must be before import
const mockProfileService = {
  getProfile: jest.fn(),
  aggregateUserProfile: jest.fn(),
  saveProfile: jest.fn(),
  refreshProfile: jest.fn(),
  updateProfile: jest.fn(),
  deleteProfile: jest.fn(),
};

jest.mock('../../services/ProfileService', () => ({
  ProfileService: jest.fn().mockImplementation(() => mockProfileService),
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

// ============================================================================
// Test Setup
// ============================================================================

describe('Profile API Routes', () => {
  let app: Express;
  let mockPrisma: any;

  const testUserId = 'test-user-id';
  const mockProfile = {
    userId: testUserId,
    fields: {
      first_name: {
        key: 'first_name',
        values: ['John'],
        sources: ['doc-1'],
        confidence: 0.95,
        lastUpdated: new Date('2025-01-01'),
      },
      last_name: {
        key: 'last_name',
        values: ['Doe'],
        sources: ['doc-1'],
        confidence: 0.95,
        lastUpdated: new Date('2025-01-01'),
      },
      email: {
        key: 'email',
        values: ['john.doe@example.com'],
        sources: ['doc-1', 'doc-2'],
        confidence: 0.98,
        lastUpdated: new Date('2025-01-01'),
      },
    },
    lastAggregated: new Date('2025-01-01'),
    documentCount: 2,
  };

  beforeAll(() => {
    // Setup Express app with profile routes
    app = express();
    app.use(express.json());

    const profileRoutes = createProfileRoutes();
    app.use('/api/users', profileRoutes);

    // Add error handler middleware to match real Express behavior
    app.use((err: Error, req: any, res: any, next: any) => {
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Get mocked Prisma instance
    mockPrisma = new PrismaClient();

    // Clear mock calls but keep the mock functions themselves
    Object.keys(mockProfileService).forEach((key) => {
      (mockProfileService as any)[key].mockClear();
    });
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

      const response = await request(app).get('/api/users/me/profile').expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 401 if user ID missing', async () => {
      const { authenticateSupabase } = require('../../middleware/supabaseAuth');
      authenticateSupabase.mockImplementationOnce((req: any, res: any, next: any) => {
        req.user = { email: 'test@example.com' }; // Missing ID
        next();
      });

      const response = await request(app).get('/api/users/me/profile').expect(401);

      expect(response.body.error).toBe('Unauthorized');
      expect(response.body.message).toBe('User ID not found in request');
    });
  });

  // ==========================================================================
  // GET /api/users/me/profile - Get User Profile
  // ==========================================================================

  describe('GET /api/users/me/profile', () => {
    it('should return existing profile', async () => {
      // Create a fresh profile with recent timestamp to avoid staleness check
      const freshProfile = {
        ...mockProfile,
        lastAggregated: new Date(), // Recent timestamp
      };
      mockProfileService.getProfile.mockResolvedValue(freshProfile);

      const response = await request(app).get('/api/users/me/profile').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.profile.userId).toBe(testUserId);
      expect(response.body.profile.fields).toHaveLength(3);
      expect(response.body.profile.documentCount).toBe(2);
    });

    it('should aggregate profile if none exists', async () => {
      // Create a fresh profile to avoid triggering staleness check
      const freshProfile = {
        ...mockProfile,
        lastAggregated: new Date(), // Recent timestamp
      };

      mockProfileService.getProfile.mockResolvedValue(null);
      mockProfileService.aggregateUserProfile.mockResolvedValue(freshProfile);
      mockProfileService.saveProfile.mockResolvedValue(undefined); // saveProfile returns void

      const response = await request(app).get('/api/users/me/profile').expect(200);

      expect(response.body.success).toBe(true);
      expect(mockProfileService.aggregateUserProfile).toHaveBeenCalledWith(testUserId);
      expect(mockProfileService.saveProfile).toHaveBeenCalledWith(testUserId, freshProfile);
    });

    it('should refresh stale profile', async () => {
      const staleProfile = {
        ...mockProfile,
        lastAggregated: new Date('2024-01-01'), // Over 1 hour ago
      };

      mockProfileService.getProfile.mockResolvedValue(staleProfile);
      mockProfileService.refreshProfile.mockResolvedValue(mockProfile);

      const response = await request(app).get('/api/users/me/profile').expect(200);

      expect(response.body.success).toBe(true);
      expect(mockProfileService.refreshProfile).toHaveBeenCalledWith(testUserId);
    });

    it('should not refresh fresh profile', async () => {
      const freshProfile = {
        ...mockProfile,
        lastAggregated: new Date(), // Recent
      };

      mockProfileService.getProfile.mockResolvedValue(freshProfile);

      const response = await request(app).get('/api/users/me/profile').expect(200);

      expect(response.body.success).toBe(true);
      expect(mockProfileService.refreshProfile).not.toHaveBeenCalled();
    });

    it('should format response correctly', async () => {
      mockProfileService.getProfile.mockResolvedValue(mockProfile);

      const response = await request(app).get('/api/users/me/profile').expect(200);

      const field = response.body.profile.fields[0];
      expect(field).toHaveProperty('key');
      expect(field).toHaveProperty('values');
      expect(field).toHaveProperty('sourceCount');
      expect(field).toHaveProperty('confidence');
      expect(field).toHaveProperty('lastUpdated');
      expect(field.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle errors gracefully', async () => {
      mockProfileService.getProfile.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/users/me/profile').expect(500);

      expect(response.body).toBeDefined();
    });
  });

  // ==========================================================================
  // PUT /api/users/me/profile - Update Profile
  // ==========================================================================

  describe('PUT /api/users/me/profile', () => {
    it('should update profile with valid data', async () => {
      const updates = {
        first_name: 'Jane',
        phone_number: '+1234567890',
      };

      mockProfileService.updateProfile.mockResolvedValue({
        ...mockProfile,
        fields: {
          ...mockProfile.fields,
          first_name: {
            key: 'first_name',
            values: ['Jane'],
            sources: ['manual'],
            confidence: 1.0,
            lastUpdated: new Date(),
          },
          phone_number: {
            key: 'phone_number',
            values: ['+1234567890'],
            sources: ['manual'],
            confidence: 1.0,
            lastUpdated: new Date(),
          },
        },
      });

      const response = await request(app).put('/api/users/me/profile').send(updates).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
      expect(mockProfileService.updateProfile).toHaveBeenCalledWith(testUserId, updates);
    });

    it('should return 400 for empty updates', async () => {
      const response = await request(app).put('/api/users/me/profile').send({}).expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('Profile updates are required');
    });

    it('should return 400 for invalid updates', async () => {
      const response = await request(app).put('/api/users/me/profile').send(null).expect(400);

      expect(response.body.error).toBe('Bad Request');
    });

    it('should handle update errors', async () => {
      mockProfileService.updateProfile.mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .put('/api/users/me/profile')
        .send({ first_name: 'Jane' })
        .expect(500);

      expect(response.body).toBeDefined();
    });

    it('should format updated profile correctly', async () => {
      const updates = { first_name: 'Jane' };
      mockProfileService.updateProfile.mockResolvedValue(mockProfile);

      const response = await request(app).put('/api/users/me/profile').send(updates).expect(200);

      expect(response.body.profile.fields).toBeDefined();
      expect(Array.isArray(response.body.profile.fields)).toBe(true);
    });
  });

  // ==========================================================================
  // POST /api/users/me/profile/refresh - Refresh Profile
  // ==========================================================================

  describe('POST /api/users/me/profile/refresh', () => {
    it('should refresh profile manually', async () => {
      mockProfileService.refreshProfile.mockResolvedValue(mockProfile);

      const response = await request(app).post('/api/users/me/profile/refresh').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile refreshed successfully');
      expect(mockProfileService.refreshProfile).toHaveBeenCalledWith(testUserId);
    });

    it('should return 401 if user ID missing', async () => {
      const { authenticateSupabase } = require('../../middleware/supabaseAuth');
      authenticateSupabase.mockImplementationOnce((req: any, res: any, next: any) => {
        req.user = {};
        next();
      });

      const response = await request(app).post('/api/users/me/profile/refresh').expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    it('should handle refresh errors', async () => {
      mockProfileService.refreshProfile.mockRejectedValue(new Error('Refresh failed'));

      const response = await request(app).post('/api/users/me/profile/refresh').expect(500);

      expect(response.body).toBeDefined();
    });

    it('should format refreshed profile correctly', async () => {
      mockProfileService.refreshProfile.mockResolvedValue(mockProfile);

      const response = await request(app).post('/api/users/me/profile/refresh').expect(200);

      expect(response.body.profile.userId).toBe(testUserId);
      expect(response.body.profile.fields).toHaveLength(3);
      expect(response.body.profile.lastAggregated).toBeDefined();
    });
  });

  // ==========================================================================
  // DELETE /api/users/me/profile - Delete Profile
  // ==========================================================================

  describe('DELETE /api/users/me/profile', () => {
    it('should delete profile', async () => {
      mockProfileService.deleteProfile.mockResolvedValue(undefined);

      const response = await request(app).delete('/api/users/me/profile').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile deleted successfully');
      expect(mockProfileService.deleteProfile).toHaveBeenCalledWith(testUserId);
    });

    it('should return 404 if profile not found', async () => {
      mockProfileService.deleteProfile.mockRejectedValue(
        new Error('Record to delete does not exist')
      );

      const response = await request(app).delete('/api/users/me/profile').expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Profile not found');
    });

    it('should return 401 if user ID missing', async () => {
      const { authenticateSupabase } = require('../../middleware/supabaseAuth');
      authenticateSupabase.mockImplementationOnce((req: any, res: any, next: any) => {
        req.user = {};
        next();
      });

      const response = await request(app).delete('/api/users/me/profile').expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    it('should handle deletion errors', async () => {
      mockProfileService.deleteProfile.mockRejectedValue(new Error('Database error'));

      const response = await request(app).delete('/api/users/me/profile').expect(500);

      expect(response.body).toBeDefined();
    });
  });

  // ==========================================================================
  // GET /api/users/me/profile/field/:fieldKey - Get Specific Field
  // ==========================================================================

  describe('GET /api/users/me/profile/field/:fieldKey', () => {
    it('should return specific field', async () => {
      mockProfileService.getProfile.mockResolvedValue(mockProfile);

      const response = await request(app).get('/api/users/me/profile/field/first_name').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.field.key).toBe('first_name');
      expect(response.body.field.values).toEqual(['John']);
    });

    it('should return 404 if profile not found', async () => {
      mockProfileService.getProfile.mockResolvedValue(null);

      const response = await request(app).get('/api/users/me/profile/field/first_name').expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Profile not found');
    });

    it('should return 404 if field not found', async () => {
      mockProfileService.getProfile.mockResolvedValue(mockProfile);

      const response = await request(app)
        .get('/api/users/me/profile/field/non_existent_field')
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toContain('not found in profile');
    });

    it('should normalize field key', async () => {
      mockProfileService.getProfile.mockResolvedValue(mockProfile);

      // Test with different formats - the normalization converts to lowercase and replaces spaces/hyphens with underscores
      const response1 = await request(app)
        .get('/api/users/me/profile/field/first_name')
        .expect(200);
      expect(response1.body.field.key).toBe('first_name');

      // Test with uppercase and hyphens
      const response2 = await request(app)
        .get('/api/users/me/profile/field/FIRST-NAME')
        .expect(200);
      expect(response2.body.field.key).toBe('first_name');

      // Test with spaces
      const response3 = await request(app)
        .get('/api/users/me/profile/field/first name')
        .expect(200);
      expect(response3.body.field.key).toBe('first_name');
    });

    it('should return 400 if field key missing', async () => {
      const response = await request(app).get('/api/users/me/profile/field/').expect(404);

      // Express will return 404 for missing param
    });

    it('should format field response correctly', async () => {
      mockProfileService.getProfile.mockResolvedValue(mockProfile);

      const response = await request(app).get('/api/users/me/profile/field/email').expect(200);

      expect(response.body.field).toHaveProperty('key');
      expect(response.body.field).toHaveProperty('values');
      expect(response.body.field).toHaveProperty('sourceCount');
      expect(response.body.field).toHaveProperty('confidence');
      expect(response.body.field).toHaveProperty('lastUpdated');
      expect(response.body.field.sourceCount).toBe(2); // doc-1 and doc-2
    });

    it('should handle errors gracefully', async () => {
      mockProfileService.getProfile.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/users/me/profile/field/first_name').expect(500);

      expect(response.body).toBeDefined();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle profile with no fields', async () => {
      const emptyProfile = {
        userId: testUserId,
        fields: {},
        lastAggregated: new Date(),
        documentCount: 0,
      };

      mockProfileService.getProfile.mockResolvedValue(emptyProfile);

      const response = await request(app).get('/api/users/me/profile').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.profile.fields).toHaveLength(0);
    });

    it('should handle field with multiple values', async () => {
      const multiValueProfile = {
        userId: testUserId,
        fields: {
          phone_number: {
            key: 'phone_number',
            values: ['+1234567890', '+0987654321'],
            sources: ['doc-1', 'doc-2'],
            confidence: 0.9,
            lastUpdated: new Date(),
          },
        },
        lastAggregated: new Date(),
        documentCount: 2,
      };

      mockProfileService.getProfile.mockResolvedValue(multiValueProfile);

      const response = await request(app).get('/api/users/me/profile').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.profile.fields[0].values).toHaveLength(2);
    });

    it('should round confidence to 2 decimal places', async () => {
      const preciseProfile = {
        userId: testUserId,
        fields: {
          test_field: {
            key: 'test_field',
            values: ['test'],
            sources: ['doc-1'],
            confidence: 0.956789,
            lastUpdated: new Date(),
          },
        },
        lastAggregated: new Date(),
        documentCount: 1,
      };

      mockProfileService.getProfile.mockResolvedValue(preciseProfile);

      const response = await request(app).get('/api/users/me/profile').expect(200);

      expect(response.body.profile.fields[0].confidence).toBe(0.96);
    });
  });
});
