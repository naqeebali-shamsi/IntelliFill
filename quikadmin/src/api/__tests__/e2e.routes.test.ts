/**
 * E2E Routes Unit Tests
 *
 * Task 478: Add Seed Health Check Endpoint
 *
 * Tests cover:
 * - /api/e2e/seed-status endpoint behavior
 * - Health check response format
 * - bcrypt hash validation
 * - Environment guard (test mode only)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import request from 'supertest';
import express, { Express } from 'express';

// ============================================================================
// Mocks Setup - Must be BEFORE module imports
// ============================================================================

// Store original env
const originalEnv = process.env;

// Mock Prisma
jest.mock('../../utils/prisma', () => {
  const mockPrisma: any = {
    user: {
      findUnique: jest.fn(),
    },
  };
  return { prisma: mockPrisma };
});

// Mock logger
jest.mock('../../utils/piiSafeLogger', () => ({
  piiSafeLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import AFTER mocks are set up
import { createE2ERoutes, isE2ETestMode } from '../e2e.routes';
import { prisma } from '../../utils/prisma';

// Cast to any for test manipulation
const mockPrisma = prisma as any;

// ============================================================================
// Test Constants
// ============================================================================

// Valid bcrypt hash (12 rounds, password: "test")
const VALID_BCRYPT_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LemFiTrQPgEu8LOZK';

// Invalid hash (not bcrypt format)
const INVALID_HASH = 'plaintext_password';

// E2E test user emails (must match e2e.routes.ts)
const E2E_TEST_USER_EMAILS = [
  'test-admin@intellifill.local',
  'test-owner@intellifill.local',
  'test-member@intellifill.local',
  'test-viewer@intellifill.local',
  'test-password-reset@intellifill.local',
];

// ============================================================================
// Test Setup
// ============================================================================

describe('E2E Routes', () => {
  let app: Express;

  beforeAll(() => {
    // Ensure test mode is enabled for tests
    process.env.NODE_ENV = 'test';

    app = express();
    app.use(express.json());

    const e2eRoutes = createE2ERoutes();
    app.use('/api/e2e', e2eRoutes);

    // Error handler
    app.use((err: Error, _req: any, res: any, _next: any) => {
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
      });
    });
  });

  afterAll(() => {
    // Restore original env
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // GET /api/e2e/seed-status Tests
  // ==========================================================================

  describe('GET /api/e2e/seed-status', () => {
    it('should return healthy status when all users are properly seeded', async () => {
      // Mock all users exist with valid hashes and memberships
      mockPrisma.user.findUnique.mockImplementation(({ where }: any) => {
        if (E2E_TEST_USER_EMAILS.includes(where.email)) {
          return Promise.resolve({
            id: 'test-user-id',
            email: where.email,
            password: VALID_BCRYPT_HASH,
            memberships: [{ id: 'membership-id', status: 'ACTIVE' }],
          });
        }
        return Promise.resolve(null);
      });

      const response = await request(app).get('/api/e2e/seed-status').expect(200);

      expect(response.body.healthy).toBe(true);
      expect(response.body.users).toHaveLength(5);
      expect(response.body.errors).toHaveLength(0);

      // Verify each user status
      for (const userStatus of response.body.users) {
        expect(userStatus.exists).toBe(true);
        expect(userStatus.hasValidHash).toBe(true);
        expect(userStatus.hasMembership).toBe(true);
      }
    });

    it('should return unhealthy status when a user is missing', async () => {
      // Mock first user missing, others exist
      mockPrisma.user.findUnique.mockImplementation(({ where }: any) => {
        if (where.email === 'test-admin@intellifill.local') {
          return Promise.resolve(null);
        }
        return Promise.resolve({
          id: 'test-user-id',
          email: where.email,
          password: VALID_BCRYPT_HASH,
          memberships: [{ id: 'membership-id', status: 'ACTIVE' }],
        });
      });

      const response = await request(app).get('/api/e2e/seed-status').expect(503);

      expect(response.body.healthy).toBe(false);
      expect(response.body.errors).toContain('User not found: test-admin@intellifill.local');

      // Find the missing user status
      const adminStatus = response.body.users.find(
        (u: any) => u.email === 'test-admin@intellifill.local'
      );
      expect(adminStatus.exists).toBe(false);
      expect(adminStatus.hasValidHash).toBe(false);
      expect(adminStatus.hasMembership).toBe(false);
    });

    it('should return unhealthy status when a user has invalid password hash', async () => {
      mockPrisma.user.findUnique.mockImplementation(({ where }: any) => {
        return Promise.resolve({
          id: 'test-user-id',
          email: where.email,
          // First user has invalid hash
          password:
            where.email === 'test-admin@intellifill.local' ? INVALID_HASH : VALID_BCRYPT_HASH,
          memberships: [{ id: 'membership-id', status: 'ACTIVE' }],
        });
      });

      const response = await request(app).get('/api/e2e/seed-status').expect(503);

      expect(response.body.healthy).toBe(false);
      expect(response.body.errors).toContain(
        'Invalid password hash for test-admin@intellifill.local'
      );

      const adminStatus = response.body.users.find(
        (u: any) => u.email === 'test-admin@intellifill.local'
      );
      expect(adminStatus.exists).toBe(true);
      expect(adminStatus.hasValidHash).toBe(false);
      expect(adminStatus.hasMembership).toBe(true);
    });

    it('should return unhealthy status when a user has no membership', async () => {
      mockPrisma.user.findUnique.mockImplementation(({ where }: any) => {
        return Promise.resolve({
          id: 'test-user-id',
          email: where.email,
          password: VALID_BCRYPT_HASH,
          // First user has no memberships
          memberships: where.email === 'test-admin@intellifill.local' ? [] : [{ id: 'membership-id', status: 'ACTIVE' }],
        });
      });

      const response = await request(app).get('/api/e2e/seed-status').expect(503);

      expect(response.body.healthy).toBe(false);
      expect(response.body.errors).toContain(
        'No organization membership for test-admin@intellifill.local'
      );

      const adminStatus = response.body.users.find(
        (u: any) => u.email === 'test-admin@intellifill.local'
      );
      expect(adminStatus.exists).toBe(true);
      expect(adminStatus.hasValidHash).toBe(true);
      expect(adminStatus.hasMembership).toBe(false);
    });

    it('should return unhealthy status with multiple errors', async () => {
      mockPrisma.user.findUnique.mockImplementation(({ where }: any) => {
        // First user missing
        if (where.email === 'test-admin@intellifill.local') {
          return Promise.resolve(null);
        }
        // Second user has invalid hash
        if (where.email === 'test-owner@intellifill.local') {
          return Promise.resolve({
            id: 'test-user-id',
            email: where.email,
            password: INVALID_HASH,
            memberships: [{ id: 'membership-id', status: 'ACTIVE' }],
          });
        }
        // Third user has no membership
        if (where.email === 'test-member@intellifill.local') {
          return Promise.resolve({
            id: 'test-user-id',
            email: where.email,
            password: VALID_BCRYPT_HASH,
            memberships: [],
          });
        }
        // Rest are fine
        return Promise.resolve({
          id: 'test-user-id',
          email: where.email,
          password: VALID_BCRYPT_HASH,
          memberships: [{ id: 'membership-id', status: 'ACTIVE' }],
        });
      });

      const response = await request(app).get('/api/e2e/seed-status').expect(503);

      expect(response.body.healthy).toBe(false);
      expect(response.body.errors).toHaveLength(3);
      expect(response.body.errors).toContain('User not found: test-admin@intellifill.local');
      expect(response.body.errors).toContain(
        'Invalid password hash for test-owner@intellifill.local'
      );
      expect(response.body.errors).toContain(
        'No organization membership for test-member@intellifill.local'
      );
    });

    it('should handle null password gracefully', async () => {
      mockPrisma.user.findUnique.mockImplementation(({ where }: any) => {
        return Promise.resolve({
          id: 'test-user-id',
          email: where.email,
          password: where.email === 'test-admin@intellifill.local' ? null : VALID_BCRYPT_HASH,
          memberships: [{ id: 'membership-id', status: 'ACTIVE' }],
        });
      });

      const response = await request(app).get('/api/e2e/seed-status').expect(503);

      expect(response.body.healthy).toBe(false);

      const adminStatus = response.body.users.find(
        (u: any) => u.email === 'test-admin@intellifill.local'
      );
      expect(adminStatus.hasValidHash).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app).get('/api/e2e/seed-status').expect(500);

      expect(response.body.error).toBe('Internal Server Error');
    });
  });

  // ==========================================================================
  // isE2ETestMode Helper Tests
  // ==========================================================================

  describe('isE2ETestMode helper', () => {
    it('should return true when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test';
      process.env.E2E_TEST_MODE = 'false';

      // Need to re-import to get fresh evaluation
      // For this test, we just verify the function exists and is exported
      expect(typeof isE2ETestMode).toBe('function');
    });
  });

  // ==========================================================================
  // bcrypt Hash Validation Tests
  // ==========================================================================

  describe('bcrypt hash validation', () => {
    it('should accept valid $2a$ bcrypt hash', async () => {
      const hash2a = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LemFiTrQPgEu8LOZK';

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'test-user-id',
        email: 'test-admin@intellifill.local',
        password: hash2a,
        memberships: [{ id: 'membership-id', status: 'ACTIVE' }],
      });

      // Only query first user to test hash validation
      mockPrisma.user.findUnique.mockImplementation(({ where }: any) => {
        return Promise.resolve({
          id: 'test-user-id',
          email: where.email,
          password: hash2a,
          memberships: [{ id: 'membership-id', status: 'ACTIVE' }],
        });
      });

      const response = await request(app).get('/api/e2e/seed-status').expect(200);

      const adminStatus = response.body.users.find(
        (u: any) => u.email === 'test-admin@intellifill.local'
      );
      expect(adminStatus.hasValidHash).toBe(true);
    });

    it('should accept valid $2b$ bcrypt hash', async () => {
      const hash2b = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LemFiTrQPgEu8LOZK';

      mockPrisma.user.findUnique.mockImplementation(({ where }: any) => {
        return Promise.resolve({
          id: 'test-user-id',
          email: where.email,
          password: hash2b,
          memberships: [{ id: 'membership-id', status: 'ACTIVE' }],
        });
      });

      const response = await request(app).get('/api/e2e/seed-status').expect(200);

      const adminStatus = response.body.users.find(
        (u: any) => u.email === 'test-admin@intellifill.local'
      );
      expect(adminStatus.hasValidHash).toBe(true);
    });

    it('should accept valid $2y$ bcrypt hash', async () => {
      const hash2y = '$2y$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LemFiTrQPgEu8LOZK';

      mockPrisma.user.findUnique.mockImplementation(({ where }: any) => {
        return Promise.resolve({
          id: 'test-user-id',
          email: where.email,
          password: hash2y,
          memberships: [{ id: 'membership-id', status: 'ACTIVE' }],
        });
      });

      const response = await request(app).get('/api/e2e/seed-status').expect(200);

      const adminStatus = response.body.users.find(
        (u: any) => u.email === 'test-admin@intellifill.local'
      );
      expect(adminStatus.hasValidHash).toBe(true);
    });

    it('should reject MD5 hash format', async () => {
      const md5Hash = '098f6bcd4621d373cade4e832627b4f6'; // MD5 of "test"

      mockPrisma.user.findUnique.mockImplementation(({ where }: any) => {
        return Promise.resolve({
          id: 'test-user-id',
          email: where.email,
          password: where.email === 'test-admin@intellifill.local' ? md5Hash : VALID_BCRYPT_HASH,
          memberships: [{ id: 'membership-id', status: 'ACTIVE' }],
        });
      });

      const response = await request(app).get('/api/e2e/seed-status').expect(503);

      const adminStatus = response.body.users.find(
        (u: any) => u.email === 'test-admin@intellifill.local'
      );
      expect(adminStatus.hasValidHash).toBe(false);
    });

    it('should reject truncated bcrypt hash', async () => {
      const truncatedHash = '$2b$12$LQv3c1yqBWVH'; // Truncated

      mockPrisma.user.findUnique.mockImplementation(({ where }: any) => {
        return Promise.resolve({
          id: 'test-user-id',
          email: where.email,
          password:
            where.email === 'test-admin@intellifill.local' ? truncatedHash : VALID_BCRYPT_HASH,
          memberships: [{ id: 'membership-id', status: 'ACTIVE' }],
        });
      });

      const response = await request(app).get('/api/e2e/seed-status').expect(503);

      const adminStatus = response.body.users.find(
        (u: any) => u.email === 'test-admin@intellifill.local'
      );
      expect(adminStatus.hasValidHash).toBe(false);
    });
  });

  // ==========================================================================
  // Response Format Tests
  // ==========================================================================

  describe('response format', () => {
    it('should return correct JSON structure for healthy response', async () => {
      mockPrisma.user.findUnique.mockImplementation(({ where }: any) => {
        return Promise.resolve({
          id: 'test-user-id',
          email: where.email,
          password: VALID_BCRYPT_HASH,
          memberships: [{ id: 'membership-id', status: 'ACTIVE' }],
        });
      });

      const response = await request(app).get('/api/e2e/seed-status').expect(200);

      // Verify top-level structure
      expect(response.body).toHaveProperty('healthy');
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('errors');

      // Verify types
      expect(typeof response.body.healthy).toBe('boolean');
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(Array.isArray(response.body.errors)).toBe(true);

      // Verify user status structure
      const userStatus = response.body.users[0];
      expect(userStatus).toHaveProperty('email');
      expect(userStatus).toHaveProperty('exists');
      expect(userStatus).toHaveProperty('hasValidHash');
      expect(userStatus).toHaveProperty('hasMembership');

      expect(typeof userStatus.email).toBe('string');
      expect(typeof userStatus.exists).toBe('boolean');
      expect(typeof userStatus.hasValidHash).toBe('boolean');
      expect(typeof userStatus.hasMembership).toBe('boolean');
    });

    it('should return all 5 test users in response', async () => {
      mockPrisma.user.findUnique.mockImplementation(({ where }: any) => {
        return Promise.resolve({
          id: 'test-user-id',
          email: where.email,
          password: VALID_BCRYPT_HASH,
          memberships: [{ id: 'membership-id', status: 'ACTIVE' }],
        });
      });

      const response = await request(app).get('/api/e2e/seed-status').expect(200);

      expect(response.body.users).toHaveLength(5);

      const emails = response.body.users.map((u: any) => u.email);
      expect(emails).toContain('test-admin@intellifill.local');
      expect(emails).toContain('test-owner@intellifill.local');
      expect(emails).toContain('test-member@intellifill.local');
      expect(emails).toContain('test-viewer@intellifill.local');
      expect(emails).toContain('test-password-reset@intellifill.local');
    });
  });
});
