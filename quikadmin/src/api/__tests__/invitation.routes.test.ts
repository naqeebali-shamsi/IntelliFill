/**
 * Invitation API Routes Unit Tests
 *
 * Task 391: Integration Testing and Edge Case Handling
 *
 * Tests cover:
 * - Public invitation validation endpoint
 * - Authenticated invitation acceptance
 * - Email matching requirements
 * - Expiration handling
 * - Duplicate membership prevention
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
      },
      organizationMembership: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      organizationInvitation: {
        findUnique: jest.fn(),
        update: jest.fn(),
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
import { createInvitationRoutes } from '../invitation.routes';
import { prisma } from '../../utils/prisma';

// Cast to any for test manipulation
const mockPrisma = prisma as any;

// Test constants - use valid UUIDv4 for param validation (v4 requires: 13th char='4', 17th char='8'/'9'/'a'/'b')
const TEST_INVITE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const TEST_ORG_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const TEST_USER_ID = 'c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f';
const TEST_ADMIN_ID = 'd4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f7a';
const TEST_OWNER_ID = 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b';

// ============================================================================
// Test Setup
// ============================================================================

describe('Invitation API Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const invitationRoutes = createInvitationRoutes();
    app.use('/api/invites', invitationRoutes);

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
  // GET /api/invites/:token - Validate Invitation (Public)
  // ==========================================================================

  describe('GET /api/invites/:token - Validate Invitation', () => {
    it('should return valid invitation details', async () => {
      const mockInvitation = {
        id: TEST_INVITE_ID,
        email: 'invitee@test.com',
        role: 'MEMBER',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        createdAt: new Date(),
        organization: {
          id: TEST_ORG_ID,
          name: 'Test Org',
          slug: 'test-org',
        },
      };

      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(mockInvitation);

      const response = await request(app).get(`/api/invites/${TEST_INVITE_ID}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(TEST_INVITE_ID);
      expect(response.body.data.email).toBe('invitee@test.com');
      expect(response.body.data.role).toBe('MEMBER');
      expect(response.body.data.organization.name).toBe('Test Org');
    });

    it('should not require authentication for validation', async () => {
      // No mockUser set
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: TEST_INVITE_ID,
        email: 'invitee@test.com',
        role: 'MEMBER',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 1000000),
        createdAt: new Date(),
        organization: { id: TEST_ORG_ID, name: 'Test Org', slug: 'test-org' },
      });

      const response = await request(app).get(`/api/invites/${TEST_INVITE_ID}`).expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent invitation', async () => {
      const nonExistentId = 'f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c'; // Valid UUIDv4 that doesn't exist
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(null);

      const response = await request(app).get(`/api/invites/${nonExistentId}`).expect(404);

      expect(response.body.code).toBe('INVITATION_NOT_FOUND');
    });

    it('should return 410 for expired invitation', async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: TEST_INVITE_ID,
        email: 'invitee@test.com',
        role: 'MEMBER',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        createdAt: new Date(),
        organization: { id: TEST_ORG_ID, name: 'Test Org', slug: 'test-org' },
      });

      mockPrisma.organizationInvitation.update.mockResolvedValue({});

      const response = await request(app).get(`/api/invites/${TEST_INVITE_ID}`).expect(410);

      expect(response.body.code).toBe('INVITATION_EXPIRED');
      // Verify status was updated to EXPIRED
      expect(mockPrisma.organizationInvitation.update).toHaveBeenCalledWith({
        where: { id: TEST_INVITE_ID },
        data: { status: 'EXPIRED' },
      });
    });

    it('should return 410 for cancelled invitation', async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: TEST_INVITE_ID,
        status: 'CANCELLED',
        expiresAt: new Date(Date.now() + 1000000),
        organization: { id: TEST_ORG_ID, name: 'Test Org', slug: 'test-org' },
      });

      const response = await request(app).get(`/api/invites/${TEST_INVITE_ID}`).expect(410);

      expect(response.body.code).toBe('INVITATION_INVALID_STATUS');
      expect(response.body.status).toBe('CANCELLED');
    });

    it('should return 410 for already accepted invitation', async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: TEST_INVITE_ID,
        status: 'ACCEPTED',
        expiresAt: new Date(Date.now() + 1000000),
        organization: { id: TEST_ORG_ID, name: 'Test Org', slug: 'test-org' },
      });

      const response = await request(app).get(`/api/invites/${TEST_INVITE_ID}`).expect(410);

      expect(response.body.code).toBe('INVITATION_INVALID_STATUS');
      expect(response.body.status).toBe('ACCEPTED');
    });
  });

  // ==========================================================================
  // POST /api/invites/:token/accept - Accept Invitation
  // ==========================================================================

  describe('POST /api/invites/:token/accept - Accept Invitation', () => {
    it('should accept valid invitation and create membership', async () => {
      mockUser = { id: TEST_USER_ID, email: 'invitee@test.com' };

      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: TEST_INVITE_ID,
        email: 'invitee@test.com',
        role: 'MEMBER',
        status: 'PENDING',
        organizationId: TEST_ORG_ID,
        invitedBy: TEST_ADMIN_ID,
        expiresAt: new Date(Date.now() + 1000000),
        createdAt: new Date(),
        organization: { id: TEST_ORG_ID, name: 'Test Org', slug: 'test-org' },
      });

      mockPrisma.organizationMembership.findFirst.mockResolvedValue(null); // Not already member

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        mockPrisma.organizationInvitation.update.mockResolvedValue({});
        mockPrisma.organizationMembership.create.mockResolvedValue({
          role: 'MEMBER',
          status: 'ACTIVE',
          joinedAt: new Date(),
        });
        mockPrisma.user.findUnique.mockResolvedValue({ organizationId: null });
        mockPrisma.user.update.mockResolvedValue({});
        return callback(mockPrisma);
      });

      const response = await request(app).post(`/api/invites/${TEST_INVITE_ID}/accept`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Invitation accepted successfully');
      expect(response.body.data.organization.name).toBe('Test Org');
      expect(response.body.data.membership.role).toBe('MEMBER');
    });

    it('should require authentication', async () => {
      // mockUser not set
      const { authenticateSupabase } = require('../../middleware/supabaseAuth');
      authenticateSupabase.mockImplementationOnce((req: any, _res: any, next: any) => {
        // Don't set user
        next();
      });

      const response = await request(app).post(`/api/invites/${TEST_INVITE_ID}/accept`).expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    it('should reject if email does not match invitation', async () => {
      mockUser = { id: TEST_USER_ID, email: 'different@test.com' };

      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: TEST_INVITE_ID,
        email: 'invitee@test.com', // Different email
        role: 'MEMBER',
        status: 'PENDING',
        organizationId: TEST_ORG_ID,
        expiresAt: new Date(Date.now() + 1000000),
        organization: { id: TEST_ORG_ID, name: 'Test Org', slug: 'test-org' },
      });

      const response = await request(app).post(`/api/invites/${TEST_INVITE_ID}/accept`).expect(403);

      expect(response.body.code).toBe('EMAIL_MISMATCH');
      expect(response.body.invitedEmail).toBe('invitee@test.com');
    });

    it('should handle case-insensitive email matching', async () => {
      mockUser = { id: TEST_USER_ID, email: 'INVITEE@TEST.COM' }; // Uppercase

      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: TEST_INVITE_ID,
        email: 'invitee@test.com', // Lowercase
        role: 'MEMBER',
        status: 'PENDING',
        organizationId: TEST_ORG_ID,
        invitedBy: TEST_ADMIN_ID,
        expiresAt: new Date(Date.now() + 1000000),
        createdAt: new Date(),
        organization: { id: TEST_ORG_ID, name: 'Test Org', slug: 'test-org' },
      });

      mockPrisma.organizationMembership.findFirst.mockResolvedValue(null);

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        mockPrisma.organizationMembership.create.mockResolvedValue({
          role: 'MEMBER',
          status: 'ACTIVE',
          joinedAt: new Date(),
        });
        mockPrisma.user.findUnique.mockResolvedValue({ organizationId: null });
        return callback(mockPrisma);
      });

      const response = await request(app).post(`/api/invites/${TEST_INVITE_ID}/accept`).expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent invitation', async () => {
      const nonExistentId = 'f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c'; // Valid UUIDv4 that doesn't exist
      mockUser = { id: TEST_USER_ID, email: 'test@test.com' };
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(null);

      const response = await request(app).post(`/api/invites/${nonExistentId}/accept`).expect(404);

      expect(response.body.code).toBe('INVITATION_NOT_FOUND');
    });

    it('should return 410 for expired invitation', async () => {
      mockUser = { id: TEST_USER_ID, email: 'invitee@test.com' };

      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: TEST_INVITE_ID,
        email: 'invitee@test.com',
        role: 'MEMBER',
        status: 'PENDING',
        organizationId: TEST_ORG_ID,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired
        organization: { id: TEST_ORG_ID, name: 'Test Org', slug: 'test-org' },
      });

      mockPrisma.organizationInvitation.update.mockResolvedValue({});

      const response = await request(app).post(`/api/invites/${TEST_INVITE_ID}/accept`).expect(410);

      expect(response.body.code).toBe('INVITATION_EXPIRED');
    });

    it('should return 410 for already accepted invitation', async () => {
      mockUser = { id: TEST_USER_ID, email: 'invitee@test.com' };

      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: TEST_INVITE_ID,
        email: 'invitee@test.com',
        status: 'ACCEPTED',
        expiresAt: new Date(Date.now() + 1000000),
        organization: { id: TEST_ORG_ID, name: 'Test Org', slug: 'test-org' },
      });

      const response = await request(app).post(`/api/invites/${TEST_INVITE_ID}/accept`).expect(410);

      expect(response.body.code).toBe('INVITATION_INVALID_STATUS');
    });

    it('should return 409 if user is already a member', async () => {
      mockUser = { id: TEST_USER_ID, email: 'invitee@test.com' };

      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: TEST_INVITE_ID,
        email: 'invitee@test.com',
        role: 'MEMBER',
        status: 'PENDING',
        organizationId: TEST_ORG_ID,
        expiresAt: new Date(Date.now() + 1000000),
        organization: { id: TEST_ORG_ID, name: 'Test Org', slug: 'test-org' },
      });

      mockPrisma.organizationMembership.findFirst.mockResolvedValue({
        role: 'MEMBER',
        status: 'ACTIVE',
      });

      const response = await request(app).post(`/api/invites/${TEST_INVITE_ID}/accept`).expect(409);

      expect(response.body.code).toBe('USER_ALREADY_MEMBER');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should accept invitation with ADMIN role', async () => {
      mockUser = { id: TEST_USER_ID, email: 'admin-invitee@test.com' };

      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: TEST_INVITE_ID,
        email: 'admin-invitee@test.com',
        role: 'ADMIN',
        status: 'PENDING',
        organizationId: TEST_ORG_ID,
        invitedBy: TEST_OWNER_ID,
        expiresAt: new Date(Date.now() + 1000000),
        createdAt: new Date(),
        organization: { id: TEST_ORG_ID, name: 'Test Org', slug: 'test-org' },
      });

      mockPrisma.organizationMembership.findFirst.mockResolvedValue(null);

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        mockPrisma.organizationMembership.create.mockResolvedValue({
          role: 'ADMIN',
          status: 'ACTIVE',
          joinedAt: new Date(),
        });
        mockPrisma.user.findUnique.mockResolvedValue({ organizationId: null });
        return callback(mockPrisma);
      });

      const response = await request(app).post(`/api/invites/${TEST_INVITE_ID}/accept`).expect(200);

      expect(response.body.data.membership.role).toBe('ADMIN');
    });

    it('should not update user organizationId if already set', async () => {
      const existingOrgId = 'a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d'; // Valid UUIDv4 - existing org
      mockUser = { id: TEST_USER_ID, email: 'invitee@test.com' };

      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: TEST_INVITE_ID,
        email: 'invitee@test.com',
        role: 'MEMBER',
        status: 'PENDING',
        organizationId: TEST_ORG_ID,
        invitedBy: TEST_ADMIN_ID,
        expiresAt: new Date(Date.now() + 1000000),
        createdAt: new Date(),
        organization: { id: TEST_ORG_ID, name: 'Test Org', slug: 'test-org' },
      });

      mockPrisma.organizationMembership.findFirst.mockResolvedValue(null);

      let userUpdateCalled = false;
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        mockPrisma.organizationMembership.create.mockResolvedValue({
          role: 'MEMBER',
          status: 'ACTIVE',
          joinedAt: new Date(),
        });
        // User already has an organizationId
        mockPrisma.user.findUnique.mockResolvedValue({ organizationId: existingOrgId });
        mockPrisma.user.update.mockImplementation(() => {
          userUpdateCalled = true;
          return Promise.resolve({});
        });
        return callback(mockPrisma);
      });

      await request(app).post(`/api/invites/${TEST_INVITE_ID}/accept`).expect(200);

      // user.update should NOT have been called since organizationId is already set
      expect(userUpdateCalled).toBe(false);
    });

    it('should handle invitation with special characters in email', async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue({
        id: TEST_INVITE_ID,
        email: 'test+special@example.com',
        role: 'MEMBER',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 1000000),
        createdAt: new Date(),
        organization: { id: TEST_ORG_ID, name: 'Test Org', slug: 'test-org' },
      });

      const response = await request(app).get(`/api/invites/${TEST_INVITE_ID}`).expect(200);

      expect(response.body.data.email).toBe('test+special@example.com');
    });
  });
});
