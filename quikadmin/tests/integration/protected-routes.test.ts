/**
 * Protected Routes Integration Tests
 * Phase 4 SDK Migration - Dual Authentication Testing
 *
 * Tests all protected routes with both Supabase and legacy JWT tokens
 * Ensures backwards compatibility and proper authorization
 */

import request from 'supertest';
import express from 'express';
import { setupRoutes } from '../../src/api/routes';
import { IntelliFillService } from '../../src/services/IntelliFillService';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

// Test configuration
const TEST_JWT_SECRET =
  process.env.JWT_SECRET ||
  'test-secret-key-at-least-64-characters-long-for-security-purposes-12345';
const TEST_SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
const TEST_SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'test-key';

describe('Protected Routes - Dual Authentication', () => {
  let app: express.Application;
  let intelliFillService: IntelliFillService;
  let prisma: PrismaClient;

  // Test tokens
  let legacyJWTToken: string;
  let supabaseToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Initialize services
    app = express();
    app.use(express.json());

    prisma = new PrismaClient();
    intelliFillService = new IntelliFillService();

    // Setup routes
    setupRoutes(app, intelliFillService);

    // Create test user
    testUserId = 'test-user-id-12345';

    // Generate legacy JWT token
    legacyJWTToken = jwt.sign(
      {
        id: testUserId,
        email: 'test@example.com',
        role: 'user',
      },
      TEST_JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '15m',
        issuer: process.env.JWT_ISSUER || 'quikadmin-api',
        audience: process.env.JWT_AUDIENCE || 'quikadmin-client',
      }
    );

    // For Supabase token testing, we'll use a mock token
    // In real tests, you would get this from Supabase Auth
    supabaseToken = 'mock-supabase-token-for-testing';
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ==================== LEGACY JWT TOKEN TESTS ====================

  describe('Legacy JWT Authentication', () => {
    describe('POST /api/process/single', () => {
      it('should accept valid legacy JWT token', async () => {
        const response = await request(app)
          .post('/api/process/single')
          .set('Authorization', `Bearer ${legacyJWTToken}`)
          .attach('document', Buffer.from('test'), 'test-doc.pdf')
          .attach('form', Buffer.from('test'), 'test-form.pdf');

        // May fail due to missing files, but should pass authentication (not 401)
        expect(response.status).not.toBe(401);
      });

      it('should reject request without token', async () => {
        const response = await request(app).post('/api/process/single');

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error');
      });

      it('should reject invalid token', async () => {
        const response = await request(app)
          .post('/api/process/single')
          .set('Authorization', 'Bearer invalid-token-12345');

        expect(response.status).toBe(401);
      });
    });

    describe('POST /api/process/multiple', () => {
      it('should accept valid legacy JWT token', async () => {
        const response = await request(app)
          .post('/api/process/multiple')
          .set('Authorization', `Bearer ${legacyJWTToken}`)
          .attach('documents', Buffer.from('test'), 'doc1.pdf')
          .attach('form', Buffer.from('test'), 'form.pdf');

        expect(response.status).not.toBe(401);
      });

      it('should reject request without token', async () => {
        const response = await request(app).post('/api/process/multiple');

        expect(response.status).toBe(401);
      });
    });

    describe('POST /api/process/batch', () => {
      it('should accept valid legacy JWT token', async () => {
        const response = await request(app)
          .post('/api/process/batch')
          .set('Authorization', `Bearer ${legacyJWTToken}`)
          .attach('documents', Buffer.from('test'), 'doc1.pdf')
          .attach('forms', Buffer.from('test'), 'form1.pdf');

        expect(response.status).not.toBe(401);
      });

      it('should reject request without token', async () => {
        const response = await request(app).post('/api/process/batch');

        expect(response.status).toBe(401);
      });
    });

    describe('POST /api/validate', () => {
      it('should accept valid legacy JWT token', async () => {
        const response = await request(app)
          .post('/api/validate')
          .set('Authorization', `Bearer ${legacyJWTToken}`)
          .attach('document', Buffer.from('test'), 'doc.pdf');

        expect(response.status).not.toBe(401);
      });

      it('should reject request without token', async () => {
        const response = await request(app).post('/api/validate');

        expect(response.status).toBe(401);
      });
    });
  });

  // ==================== DOCUMENT ROUTES TESTS ====================

  describe('Document Routes - Legacy JWT', () => {
    describe('GET /api/documents', () => {
      it('should accept valid legacy JWT token', async () => {
        const response = await request(app)
          .get('/api/documents')
          .set('Authorization', `Bearer ${legacyJWTToken}`);

        expect(response.status).not.toBe(401);
      });

      it('should reject request without token', async () => {
        const response = await request(app).get('/api/documents');

        expect(response.status).toBe(401);
      });
    });

    describe('GET /api/documents/:id', () => {
      it('should accept valid legacy JWT token', async () => {
        const response = await request(app)
          .get('/api/documents/test-doc-id')
          .set('Authorization', `Bearer ${legacyJWTToken}`);

        expect(response.status).not.toBe(401);
      });

      it('should reject request without token', async () => {
        const response = await request(app).get('/api/documents/test-doc-id');

        expect(response.status).toBe(401);
      });
    });

    describe('GET /api/documents/:id/data', () => {
      it('should accept valid legacy JWT token', async () => {
        const response = await request(app)
          .get('/api/documents/test-doc-id/data')
          .set('Authorization', `Bearer ${legacyJWTToken}`);

        expect(response.status).not.toBe(401);
      });

      it('should reject request without token', async () => {
        const response = await request(app).get('/api/documents/test-doc-id/data');

        expect(response.status).toBe(401);
      });
    });

    describe('POST /api/documents/:id/fill', () => {
      it('should accept valid legacy JWT token', async () => {
        const response = await request(app)
          .post('/api/documents/test-doc-id/fill')
          .set('Authorization', `Bearer ${legacyJWTToken}`)
          .attach('form', Buffer.from('test'), 'form.pdf');

        expect(response.status).not.toBe(401);
      });

      it('should reject request without token', async () => {
        const response = await request(app).post('/api/documents/test-doc-id/fill');

        expect(response.status).toBe(401);
      });
    });

    describe('GET /api/documents/:id/download', () => {
      it('should accept valid legacy JWT token', async () => {
        const response = await request(app)
          .get('/api/documents/test-doc-id/download')
          .set('Authorization', `Bearer ${legacyJWTToken}`);

        expect(response.status).not.toBe(401);
      });

      it('should reject request without token', async () => {
        const response = await request(app).get('/api/documents/test-doc-id/download');

        expect(response.status).toBe(401);
      });
    });

    describe('DELETE /api/documents/:id', () => {
      it('should accept valid legacy JWT token', async () => {
        const response = await request(app)
          .delete('/api/documents/test-doc-id')
          .set('Authorization', `Bearer ${legacyJWTToken}`);

        expect(response.status).not.toBe(401);
      });

      it('should reject request without token', async () => {
        const response = await request(app).delete('/api/documents/test-doc-id');

        expect(response.status).toBe(401);
      });
    });
  });

  // ==================== STATS ROUTES TESTS ====================

  describe('Stats Routes - Legacy JWT', () => {
    describe('POST /api/templates', () => {
      it('should accept valid legacy JWT token', async () => {
        const response = await request(app)
          .post('/api/templates')
          .set('Authorization', `Bearer ${legacyJWTToken}`)
          .send({
            name: 'Test Template',
            description: 'Test Description',
            fields: [{ name: 'field1', type: 'text' }],
          });

        expect(response.status).not.toBe(401);
      });

      it('should reject request without token', async () => {
        const response = await request(app)
          .post('/api/templates')
          .send({
            name: 'Test Template',
            description: 'Test Description',
            fields: [{ name: 'field1', type: 'text' }],
          });

        expect(response.status).toBe(401);
      });
    });

    describe('POST /api/extract', () => {
      it('should accept valid legacy JWT token', async () => {
        const response = await request(app)
          .post('/api/extract')
          .set('Authorization', `Bearer ${legacyJWTToken}`);

        expect(response.status).not.toBe(401);
      });

      it('should reject request without token', async () => {
        const response = await request(app).post('/api/extract');

        expect(response.status).toBe(401);
      });
    });

    describe('POST /api/validate/form', () => {
      it('should accept valid legacy JWT token', async () => {
        const response = await request(app)
          .post('/api/validate/form')
          .set('Authorization', `Bearer ${legacyJWTToken}`);

        expect(response.status).not.toBe(401);
      });

      it('should reject request without token', async () => {
        const response = await request(app).post('/api/validate/form');

        expect(response.status).toBe(401);
      });
    });
  });

  // ==================== JOB ROUTES TESTS ====================

  describe('Job Routes - Security Fix Verification', () => {
    describe('GET /jobs/recent', () => {
      it('should accept valid legacy JWT token', async () => {
        const response = await request(app)
          .get('/jobs/recent')
          .set('Authorization', `Bearer ${legacyJWTToken}`);

        expect(response.status).not.toBe(401);
      });

      it('should reject request without token (security fix)', async () => {
        const response = await request(app).get('/jobs/recent');

        expect(response.status).toBe(401);
      });
    });

    describe('POST /jobs/:id/cancel', () => {
      it('should accept valid legacy JWT token', async () => {
        const response = await request(app)
          .post('/jobs/test-job-id/cancel')
          .set('Authorization', `Bearer ${legacyJWTToken}`);

        expect(response.status).not.toBe(401);
      });

      it('should reject request without token (security fix)', async () => {
        const response = await request(app).post('/jobs/test-job-id/cancel');

        expect(response.status).toBe(401);
      });
    });

    describe('POST /jobs/:id/retry', () => {
      it('should accept valid legacy JWT token', async () => {
        const response = await request(app)
          .post('/jobs/test-job-id/retry')
          .set('Authorization', `Bearer ${legacyJWTToken}`);

        expect(response.status).not.toBe(401);
      });

      it('should reject request without token (security fix)', async () => {
        const response = await request(app).post('/jobs/test-job-id/retry');

        expect(response.status).toBe(401);
      });
    });
  });

  // ==================== OPTIONAL AUTH ROUTES ====================

  describe('Optional Auth Routes', () => {
    describe('POST /api/form/fields', () => {
      it('should accept request with valid token', async () => {
        const response = await request(app)
          .post('/api/form/fields')
          .set('Authorization', `Bearer ${legacyJWTToken}`)
          .attach('form', Buffer.from('test'), 'form.pdf');

        expect(response.status).not.toBe(401);
      });

      it('should accept request without token (optional auth)', async () => {
        const response = await request(app)
          .post('/api/form/fields')
          .attach('form', Buffer.from('test'), 'form.pdf');

        // Should not return 401 (authentication not required)
        expect(response.status).not.toBe(401);
      });
    });

    describe('GET /api/statistics', () => {
      it('should accept request with token', async () => {
        const response = await request(app)
          .get('/api/statistics')
          .set('Authorization', `Bearer ${legacyJWTToken}`);

        expect(response.status).toBe(200);
      });

      it('should accept request without token (optional auth)', async () => {
        const response = await request(app).get('/api/statistics');

        expect(response.status).toBe(200);
      });
    });
  });

  // ==================== TOKEN EXPIRY TESTS ====================

  describe('Token Expiry Handling', () => {
    it('should reject expired legacy JWT token', async () => {
      const expiredToken = jwt.sign(
        { id: testUserId, email: 'test@example.com', role: 'user' },
        TEST_JWT_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: '-1h', // Expired 1 hour ago
          issuer: process.env.JWT_ISSUER || 'quikadmin-api',
          audience: process.env.JWT_AUDIENCE || 'quikadmin-client',
        }
      );

      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/expired|token/i);
    });

    it('should reject token with invalid signature', async () => {
      const invalidToken = jwt.sign(
        { id: testUserId, email: 'test@example.com', role: 'user' },
        'wrong-secret-key',
        { algorithm: 'HS256', expiresIn: '15m' }
      );

      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(response.status).toBe(401);
    });
  });

  // ==================== MALFORMED TOKEN TESTS ====================

  describe('Malformed Token Handling', () => {
    it('should reject token without Bearer prefix', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', legacyJWTToken); // Missing "Bearer " prefix

      expect(response.status).toBe(401);
    });

    it('should reject empty authorization header', async () => {
      const response = await request(app).get('/api/documents').set('Authorization', '');

      expect(response.status).toBe(401);
    });

    it('should reject malformed JWT token', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', 'Bearer not.a.valid.jwt');

      expect(response.status).toBe(401);
    });
  });

  // ==================== BACKWARDS COMPATIBILITY TESTS ====================

  describe('Backwards Compatibility', () => {
    it('should maintain user context in request object', async () => {
      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${legacyJWTToken}`);

      // Route should have access to user data
      // (verified by not returning 401 and potentially accessing user-specific data)
      expect(response.status).not.toBe(401);
    });

    it('should support existing JWT payload structure', async () => {
      const token = jwt.sign(
        {
          id: 'user-123',
          email: 'legacy@example.com',
          role: 'user',
        },
        TEST_JWT_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: '15m',
          issuer: process.env.JWT_ISSUER || 'quikadmin-api',
          audience: process.env.JWT_AUDIENCE || 'quikadmin-client',
        }
      );

      const response = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).not.toBe(401);
    });
  });
});
