/**
 * Organization API Routes Unit Tests
 *
 * Task 391: Integration Testing and Edge Case Handling
 *
 * Tests cover:
 * - Organization creation and validation
 * - Membership checks and role-based access
 * - Admin/Owner middleware enforcement
 *
 * Note: These tests verify the route setup and basic behavior with mocked Prisma.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import request from 'supertest';
import express, { Express } from 'express';

// ============================================================================
// Mocks Setup - Must be BEFORE module imports
// ============================================================================

let mockUser: { id: string; email: string } | null = null;

// Mock Prisma - all mock definitions inline to avoid hoisting issues
jest.mock('../../utils/prisma', () => {
  const createMockPrisma = () => {
    const mock: any = {
      organization: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      organizationMembership: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      organizationInvitation: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((callback: any) => callback(mock)),
    };
    return mock;
  };
  return { prisma: createMockPrisma() };
});

// Mock Supabase Auth Middleware
jest.mock('../../middleware/supabaseAuth', () => ({
  authenticateSupabase: jest.fn((req: any, _res: any, next: any) => {
    if (mockUser && mockUser.id) {
      req.user = mockUser;
    }
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

// Import AFTER mocks are set up
import { createOrganizationRoutes } from '../organization.routes';
import { prisma } from '../../utils/prisma';

// Cast to any for test manipulation
const mockPrisma = prisma as any;

// Test constants - use valid UUIDv4 for param validation (v4 requires: 13th char='4', 17th char='8'/'9'/'a'/'b')
const TEST_ORG_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const TEST_USER_ID = 'c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f';
const TEST_ADMIN_ID = 'd4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f7a';
const TEST_OWNER_ID = 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b';

// ============================================================================
// Test Setup
// ============================================================================

describe('Organization API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const organizationRoutes = createOrganizationRoutes();
    app.use('/api/organizations', organizationRoutes);

    // Error handler
    app.use((err: Error, _req: any, res: any, _next: any) => {
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
  });

  // ==========================================================================
  // POST /api/organizations - Create Organization
  // ==========================================================================

  describe('POST /api/organizations - Create Organization', () => {
    it('should create organization for authenticated user without existing membership', async () => {
      mockUser = { id: TEST_USER_ID, email: 'test@test.com' };

      // User has no existing membership
      mockPrisma.organizationMembership.findFirst.mockResolvedValue(null);

      // Mock successful transaction
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const mockOrg = {
          id: TEST_ORG_ID,
          name: 'Test Org',
          slug: 'test-org-abc123',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockPrisma.organization.create.mockResolvedValue(mockOrg);
        mockPrisma.organizationMembership.create.mockResolvedValue({
          id: '00000000-0000-0000-0000-000000000100',
          userId: TEST_USER_ID,
          organizationId: TEST_ORG_ID,
          role: 'OWNER',
          status: 'ACTIVE',
          joinedAt: new Date(),
        });
        mockPrisma.user.update.mockResolvedValue({});
        return callback(mockPrisma);
      });

      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'Test Org' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Org');
      expect(response.body.data.status).toBe('ACTIVE');
    });

    it('should require authentication', async () => {
      // No user set
      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'Test Org' })
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    it('should reject user who already belongs to organization', async () => {
      mockUser = { id: TEST_USER_ID, email: 'test@test.com' };

      // User already has a membership
      mockPrisma.organizationMembership.findFirst.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000099',
        role: 'MEMBER',
        organization: {
          id: '00000000-0000-0000-0000-000000000002',
          name: 'Existing Org',
        },
      });

      const response = await request(app)
        .post('/api/organizations')
        .send({ name: 'Test Org' })
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('already belongs');
    });

    it('should reject empty organization name', async () => {
      mockUser = { id: TEST_USER_ID, email: 'test@test.com' };

      const response = await request(app)
        .post('/api/organizations')
        .send({ name: '' })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });

  // ==========================================================================
  // GET /api/organizations/me - Get Current User Organization
  // ==========================================================================

  describe('GET /api/organizations/me - Get My Organization', () => {
    it('should return user organization if member', async () => {
      mockUser = { id: TEST_USER_ID, email: 'test@test.com' };

      mockPrisma.organizationMembership.findFirst.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000100',
        role: 'MEMBER',
        status: 'ACTIVE',
        joinedAt: new Date(),
        organization: {
          id: TEST_ORG_ID,
          name: 'Test Org',
          slug: 'test-org',
          status: 'ACTIVE',
          website: null,
          logoUrl: null,
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: {
            users: 5,
            memberships: 5,
            documentSources: 10,
          },
        },
      });

      const response = await request(app).get('/api/organizations/me').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(TEST_ORG_ID);
      expect(response.body.data.name).toBe('Test Org');
      expect(response.body.data.role).toBe('MEMBER');
    });

    it('should return 404 if user has no organization', async () => {
      mockUser = { id: TEST_USER_ID, email: 'test@test.com' };

      mockPrisma.organizationMembership.findFirst.mockResolvedValue(null);

      const response = await request(app).get('/api/organizations/me').expect(404);

      expect(response.body.error).toBe('Not Found');
    });
  });

  // ==========================================================================
  // Admin Middleware Tests
  // ==========================================================================

  describe('Admin Middleware - PATCH /api/organizations/:id', () => {
    it('should allow admin to update organization', async () => {
      mockUser = { id: TEST_ADMIN_ID, email: 'admin@test.com' };

      // Admin membership check
      mockPrisma.organizationMembership.findFirst.mockResolvedValue({
        role: 'ADMIN',
        status: 'ACTIVE',
      });

      mockPrisma.organization.update.mockResolvedValue({
        id: TEST_ORG_ID,
        name: 'Updated Name',
        slug: 'test-org',
        status: 'ACTIVE',
        website: null,
        logoUrl: null,
        settings: {},
        updatedAt: new Date(),
      });

      const response = await request(app)
        .patch(`/api/organizations/${TEST_ORG_ID}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
    });

    it('should allow owner to update organization', async () => {
      mockUser = { id: TEST_OWNER_ID, email: 'owner@test.com' };

      mockPrisma.organizationMembership.findFirst.mockResolvedValue({
        role: 'OWNER',
        status: 'ACTIVE',
      });

      mockPrisma.organization.update.mockResolvedValue({
        id: TEST_ORG_ID,
        name: 'Owner Updated',
        slug: 'test-org',
        status: 'ACTIVE',
        website: null,
        logoUrl: null,
        settings: {},
        updatedAt: new Date(),
      });

      const response = await request(app)
        .patch(`/api/organizations/${TEST_ORG_ID}`)
        .send({ name: 'Owner Updated' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject update from regular member', async () => {
      mockUser = { id: TEST_USER_ID, email: 'member@test.com' };

      mockPrisma.organizationMembership.findFirst.mockResolvedValue({
        role: 'MEMBER',
        status: 'ACTIVE',
      });

      const response = await request(app)
        .patch(`/api/organizations/${TEST_ORG_ID}`)
        .send({ name: 'Hacked Name' })
        .expect(403);

      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should reject update from viewer', async () => {
      mockUser = { id: TEST_USER_ID, email: 'viewer@test.com' };

      mockPrisma.organizationMembership.findFirst.mockResolvedValue({
        role: 'VIEWER',
        status: 'ACTIVE',
      });

      const response = await request(app)
        .patch(`/api/organizations/${TEST_ORG_ID}`)
        .send({ name: 'Hacked Name' })
        .expect(403);

      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should reject update from non-member', async () => {
      mockUser = { id: TEST_USER_ID, email: 'stranger@test.com' };

      mockPrisma.organizationMembership.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .patch(`/api/organizations/${TEST_ORG_ID}`)
        .send({ name: 'Hacked Name' })
        .expect(403);

      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  // ==========================================================================
  // Owner Middleware Tests
  // ==========================================================================

  describe('Owner Middleware - DELETE /api/organizations/:id', () => {
    it('should allow owner to delete organization', async () => {
      mockUser = { id: TEST_OWNER_ID, email: 'owner@test.com' };

      mockPrisma.organizationMembership.findFirst.mockResolvedValue({
        role: 'OWNER',
        status: 'ACTIVE',
      });

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        mockPrisma.organizationInvitation.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.organizationMembership.deleteMany.mockResolvedValue({ count: 1 });
        mockPrisma.organization.delete.mockResolvedValue({ id: TEST_ORG_ID });
        return callback(mockPrisma);
      });

      const response = await request(app).delete(`/api/organizations/${TEST_ORG_ID}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });

    it('should reject deletion by admin', async () => {
      mockUser = { id: TEST_ADMIN_ID, email: 'admin@test.com' };

      mockPrisma.organizationMembership.findFirst.mockResolvedValue({
        role: 'ADMIN',
        status: 'ACTIVE',
      });

      const response = await request(app).delete(`/api/organizations/${TEST_ORG_ID}`).expect(403);

      expect(response.body.code).toBe('OWNER_ONLY');
    });

    it('should reject deletion by member', async () => {
      mockUser = { id: TEST_USER_ID, email: 'member@test.com' };

      mockPrisma.organizationMembership.findFirst.mockResolvedValue({
        role: 'MEMBER',
        status: 'ACTIVE',
      });

      const response = await request(app).delete(`/api/organizations/${TEST_ORG_ID}`).expect(403);

      expect(response.body.code).toBe('OWNER_ONLY');
    });

    it('should reject deletion by non-member', async () => {
      mockUser = { id: TEST_USER_ID, email: 'stranger@test.com' };

      mockPrisma.organizationMembership.findFirst.mockResolvedValue(null);

      const response = await request(app).delete(`/api/organizations/${TEST_ORG_ID}`).expect(403);

      expect(response.body.code).toBe('OWNER_ONLY');
    });
  });

  // ==========================================================================
  // Validation Edge Cases
  // ==========================================================================

  describe('Validation Edge Cases', () => {
    it('should reject organization name that is too long', async () => {
      mockUser = { id: TEST_USER_ID, email: 'test@test.com' };

      const longName = 'A'.repeat(300);
      const response = await request(app)
        .post('/api/organizations')
        .send({ name: longName })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should accept organization name with special characters', async () => {
      mockUser = { id: TEST_USER_ID, email: 'test@test.com' };

      mockPrisma.organizationMembership.findFirst.mockResolvedValue(null);

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        mockPrisma.organization.create.mockResolvedValue({
          id: TEST_ORG_ID,
          name: "O'Reilly & Associates, Inc.",
          slug: 'oreilly-associates-inc-abc123',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        mockPrisma.organizationMembership.create.mockResolvedValue({});
        mockPrisma.user.update.mockResolvedValue({});
        return callback(mockPrisma);
      });

      const response = await request(app)
        .post('/api/organizations')
        .send({ name: "O'Reilly & Associates, Inc." })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });
});
