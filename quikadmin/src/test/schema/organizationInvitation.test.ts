/**
 * OrganizationInvitation Schema Tests (Task 379)
 *
 * TDD approach: These tests are written BEFORE implementation.
 * Tests verify the OrganizationInvitation model schema definition and behavior.
 */

import { PrismaClient } from '@prisma/client';

// Use test database or mock Prisma
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});

describe('OrganizationInvitation Schema', () => {
  let testOrganizationId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Create test organization and user for tests
    const organization = await prisma.organization.create({
      data: {
        name: 'Test Organization',
        slug: 'test-org-invitation',
        status: 'ACTIVE',
      },
    });
    testOrganizationId = organization.id;

    const user = await prisma.user.create({
      data: {
        email: 'test-inviter@example.com',
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'Inviter',
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.organizationInvitation.deleteMany({
      where: { organizationId: testOrganizationId },
    });
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
    await prisma.organization.deleteMany({
      where: { id: testOrganizationId },
    });
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up invitations after each test
    await prisma.organizationInvitation.deleteMany({
      where: { organizationId: testOrganizationId },
    });
  });

  // ==========================================================================
  // Test 1: InvitationStatus enum values
  // ==========================================================================
  describe('InvitationStatus Enum', () => {
    it('should accept PENDING status', async () => {
      const invitation = await prisma.organizationInvitation.create({
        data: {
          organizationId: testOrganizationId,
          email: 'pending@example.com',
          invitedBy: testUserId,
          role: 'MEMBER',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        },
      });

      expect(invitation.status).toBe('PENDING');
    });

    it('should accept ACCEPTED status', async () => {
      const invitation = await prisma.organizationInvitation.create({
        data: {
          organizationId: testOrganizationId,
          email: 'accepted@example.com',
          invitedBy: testUserId,
          role: 'MEMBER',
          status: 'ACCEPTED',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          acceptedAt: new Date(),
        },
      });

      expect(invitation.status).toBe('ACCEPTED');
    });

    it('should accept EXPIRED status', async () => {
      const invitation = await prisma.organizationInvitation.create({
        data: {
          organizationId: testOrganizationId,
          email: 'expired@example.com',
          invitedBy: testUserId,
          role: 'MEMBER',
          status: 'EXPIRED',
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
        },
      });

      expect(invitation.status).toBe('EXPIRED');
    });

    it('should accept CANCELLED status', async () => {
      const invitation = await prisma.organizationInvitation.create({
        data: {
          organizationId: testOrganizationId,
          email: 'cancelled@example.com',
          invitedBy: testUserId,
          role: 'MEMBER',
          status: 'CANCELLED',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      expect(invitation.status).toBe('CANCELLED');
    });

    it('should reject invalid status value', async () => {
      await expect(
        prisma.organizationInvitation.create({
          data: {
            organizationId: testOrganizationId,
            email: 'invalid@example.com',
            invitedBy: testUserId,
            role: 'MEMBER',
            status: 'INVALID_STATUS' as any,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Test 2: OrganizationInvitation model creation with required fields
  // ==========================================================================
  describe('Model Creation', () => {
    it('should create invitation with all required fields', async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const invitation = await prisma.organizationInvitation.create({
        data: {
          organizationId: testOrganizationId,
          email: 'newuser@example.com',
          invitedBy: testUserId,
          role: 'MEMBER',
          expiresAt,
        },
      });

      expect(invitation).toBeDefined();
      expect(invitation.id).toBeDefined();
      expect(invitation.organizationId).toBe(testOrganizationId);
      expect(invitation.email).toBe('newuser@example.com');
      expect(invitation.invitedBy).toBe(testUserId);
      expect(invitation.role).toBe('MEMBER');
      expect(invitation.expiresAt).toEqual(expiresAt);
      expect(invitation.createdAt).toBeDefined();
    });

    it('should fail without organizationId', async () => {
      await expect(
        prisma.organizationInvitation.create({
          data: {
            email: 'test@example.com',
            invitedBy: testUserId,
            role: 'MEMBER',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          } as any,
        })
      ).rejects.toThrow();
    });

    it('should fail without email', async () => {
      await expect(
        prisma.organizationInvitation.create({
          data: {
            organizationId: testOrganizationId,
            invitedBy: testUserId,
            role: 'MEMBER',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          } as any,
        })
      ).rejects.toThrow();
    });

    it('should fail without invitedBy', async () => {
      await expect(
        prisma.organizationInvitation.create({
          data: {
            organizationId: testOrganizationId,
            email: 'test@example.com',
            role: 'MEMBER',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          } as any,
        })
      ).rejects.toThrow();
    });

    it('should fail without expiresAt', async () => {
      await expect(
        prisma.organizationInvitation.create({
          data: {
            organizationId: testOrganizationId,
            email: 'test@example.com',
            invitedBy: testUserId,
            role: 'MEMBER',
          } as any,
        })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Test 3: Unique constraint on [organizationId, email]
  // ==========================================================================
  describe('Unique Constraints', () => {
    it('should enforce unique constraint on organizationId + email', async () => {
      // Create first invitation
      await prisma.organizationInvitation.create({
        data: {
          organizationId: testOrganizationId,
          email: 'duplicate@example.com',
          invitedBy: testUserId,
          role: 'MEMBER',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Attempt to create duplicate invitation (same org + email)
      await expect(
        prisma.organizationInvitation.create({
          data: {
            organizationId: testOrganizationId,
            email: 'duplicate@example.com',
            invitedBy: testUserId,
            role: 'ADMIN',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        })
      ).rejects.toThrow(/unique constraint/i);
    });

    it('should allow same email in different organizations', async () => {
      // Create second organization
      const org2 = await prisma.organization.create({
        data: {
          name: 'Second Organization',
          slug: 'second-org-invitation',
          status: 'ACTIVE',
        },
      });

      // Create invitation in first org
      const invitation1 = await prisma.organizationInvitation.create({
        data: {
          organizationId: testOrganizationId,
          email: 'shared@example.com',
          invitedBy: testUserId,
          role: 'MEMBER',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Create invitation in second org (same email, different org - should succeed)
      const invitation2 = await prisma.organizationInvitation.create({
        data: {
          organizationId: org2.id,
          email: 'shared@example.com',
          invitedBy: testUserId,
          role: 'MEMBER',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      expect(invitation1.email).toBe(invitation2.email);
      expect(invitation1.organizationId).not.toBe(invitation2.organizationId);

      // Cleanup
      await prisma.organizationInvitation.deleteMany({
        where: { organizationId: org2.id },
      });
      await prisma.organization.delete({ where: { id: org2.id } });
    });

    // Note: token field was removed from OrganizationInvitation model
  });

  // ==========================================================================
  // Test 4: Cascade delete when Organization is deleted
  // ==========================================================================
  describe('Cascade Delete Behavior', () => {
    it('should cascade delete invitations when organization is deleted', async () => {
      // Create test organization
      const org = await prisma.organization.create({
        data: {
          name: 'Temp Organization',
          slug: 'temp-org-cascade',
          status: 'ACTIVE',
        },
      });

      // Create invitations for this organization
      const invitation1 = await prisma.organizationInvitation.create({
        data: {
          organizationId: org.id,
          email: 'cascade1@example.com',
          invitedBy: testUserId,
          role: 'MEMBER',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const invitation2 = await prisma.organizationInvitation.create({
        data: {
          organizationId: org.id,
          email: 'cascade2@example.com',
          invitedBy: testUserId,
          role: 'MEMBER',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Verify invitations exist
      const invitationsBefore = await prisma.organizationInvitation.findMany({
        where: { organizationId: org.id },
      });
      expect(invitationsBefore).toHaveLength(2);

      // Delete organization
      await prisma.organization.delete({ where: { id: org.id } });

      // Verify invitations are cascade deleted
      const invitationsAfter = await prisma.organizationInvitation.findMany({
        where: { id: { in: [invitation1.id, invitation2.id] } },
      });
      expect(invitationsAfter).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Test 5: Status defaults to PENDING
  // ==========================================================================
  describe('Default Values', () => {
    it('should default status to PENDING', async () => {
      const invitation = await prisma.organizationInvitation.create({
        data: {
          organizationId: testOrganizationId,
          email: 'default-status@example.com',
          invitedBy: testUserId,
          role: 'MEMBER',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          // No status specified
        },
      });

      expect(invitation.status).toBe('PENDING');
    });
  });

  // ==========================================================================
  // Test 6: Role defaults to MEMBER (OrgMemberRole)
  // ==========================================================================
  describe('Role Default and Validation', () => {
    it('should default role to MEMBER', async () => {
      const invitation = await prisma.organizationInvitation.create({
        data: {
          organizationId: testOrganizationId,
          email: 'default-role@example.com',
          invitedBy: testUserId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          // No role specified
        },
      });

      expect(invitation.role).toBe('MEMBER');
    });

    it('should accept OWNER role', async () => {
      const invitation = await prisma.organizationInvitation.create({
        data: {
          organizationId: testOrganizationId,
          email: 'owner@example.com',
          invitedBy: testUserId,
          role: 'OWNER',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      expect(invitation.role).toBe('OWNER');
    });

    it('should accept ADMIN role', async () => {
      const invitation = await prisma.organizationInvitation.create({
        data: {
          organizationId: testOrganizationId,
          email: 'admin@example.com',
          invitedBy: testUserId,
          role: 'ADMIN',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      expect(invitation.role).toBe('ADMIN');
    });

    it('should accept VIEWER role', async () => {
      const invitation = await prisma.organizationInvitation.create({
        data: {
          organizationId: testOrganizationId,
          email: 'viewer@example.com',
          invitedBy: testUserId,
          role: 'VIEWER',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      expect(invitation.role).toBe('VIEWER');
    });

    it('should reject invalid role', async () => {
      await expect(
        prisma.organizationInvitation.create({
          data: {
            organizationId: testOrganizationId,
            email: 'invalid-role@example.com',
            invitedBy: testUserId,
            role: 'SUPERUSER' as any,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Test 7: expiresAt field is properly set
  // ==========================================================================
  describe('Expiration Field', () => {
    it('should store and retrieve expiresAt correctly', async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const invitation = await prisma.organizationInvitation.create({
        data: {
          organizationId: testOrganizationId,
          email: 'expires@example.com',
          invitedBy: testUserId,
          role: 'MEMBER',
          expiresAt,
        },
      });

      expect(invitation.expiresAt.getTime()).toBeCloseTo(expiresAt.getTime(), -2);
    });

    it('should allow querying expired invitations', async () => {
      const now = new Date();

      // Create expired invitation
      await prisma.organizationInvitation.create({
        data: {
          organizationId: testOrganizationId,
          email: 'already-expired@example.com',
          invitedBy: testUserId,
          role: 'MEMBER',
          expiresAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
        },
      });

      // Create valid invitation
      await prisma.organizationInvitation.create({
        data: {
          organizationId: testOrganizationId,
          email: 'not-expired@example.com',
          invitedBy: testUserId,
          role: 'MEMBER',
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        },
      });

      // Query expired invitations
      const expiredInvitations = await prisma.organizationInvitation.findMany({
        where: {
          expiresAt: { lt: now },
        },
      });

      expect(expiredInvitations.length).toBeGreaterThanOrEqual(1);
      expect(expiredInvitations[0].email).toBe('already-expired@example.com');
    });
  });

  // ==========================================================================
  // Test 8: Invitation lookup by email index
  // ==========================================================================
  describe('Email Index', () => {
    it('should efficiently query invitations by email', async () => {
      const email = 'indexed@example.com';

      // Create multiple invitations for same email in different orgs
      const org1 = await prisma.organization.create({
        data: { name: 'Org 1', slug: 'org-1-email-idx', status: 'ACTIVE' },
      });
      const org2 = await prisma.organization.create({
        data: { name: 'Org 2', slug: 'org-2-email-idx', status: 'ACTIVE' },
      });

      await prisma.organizationInvitation.create({
        data: {
          organizationId: org1.id,
          email,
          invitedBy: testUserId,
          role: 'MEMBER',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await prisma.organizationInvitation.create({
        data: {
          organizationId: org2.id,
          email,
          invitedBy: testUserId,
          role: 'ADMIN',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Query by email (should use index)
      const invitations = await prisma.organizationInvitation.findMany({
        where: { email },
      });

      expect(invitations).toHaveLength(2);
      expect(invitations.every((inv) => inv.email === email)).toBe(true);

      // Cleanup
      await prisma.organizationInvitation.deleteMany({
        where: { organizationId: { in: [org1.id, org2.id] } },
      });
      await prisma.organization.deleteMany({
        where: { id: { in: [org1.id, org2.id] } },
      });
    });
  });

  // ==========================================================================
  // Test 9: ID generation and uniqueness
  // Note: token field was removed from OrganizationInvitation model
  // ==========================================================================
  describe('ID Generation', () => {
    it('should auto-generate unique id', async () => {
      const invitation = await prisma.organizationInvitation.create({
        data: {
          organizationId: testOrganizationId,
          email: 'id-gen@example.com',
          invitedBy: testUserId,
          role: 'MEMBER',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      expect(invitation.id).toBeDefined();
      expect(invitation.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      ); // UUID format
    });

    it('should allow finding invitation by id', async () => {
      const invitation = await prisma.organizationInvitation.create({
        data: {
          organizationId: testOrganizationId,
          email: 'id-lookup@example.com',
          invitedBy: testUserId,
          role: 'MEMBER',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const found = await prisma.organizationInvitation.findUnique({
        where: { id: invitation.id },
      });

      expect(found).toBeDefined();
      expect(found?.id).toBe(invitation.id);
      expect(found?.email).toBe('id-lookup@example.com');
    });
  });

  // ==========================================================================
  // Test 10: Relations
  // ==========================================================================
  describe('Relations', () => {
    it('should load organization relation', async () => {
      const invitation = await prisma.organizationInvitation.create({
        data: {
          organizationId: testOrganizationId,
          email: 'relation-test@example.com',
          invitedBy: testUserId,
          role: 'MEMBER',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        include: {
          organization: true,
        },
      });

      expect(invitation.organization).toBeDefined();
      expect(invitation.organization.id).toBe(testOrganizationId);
      expect(invitation.organization.name).toBe('Test Organization');
    });
  });

  // ==========================================================================
  // Test 11: Optional acceptedAt field
  // ==========================================================================
  describe('Optional Fields', () => {
    it('should allow acceptedAt to be null', async () => {
      const invitation = await prisma.organizationInvitation.create({
        data: {
          organizationId: testOrganizationId,
          email: 'no-accepted@example.com',
          invitedBy: testUserId,
          role: 'MEMBER',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      expect(invitation.acceptedAt).toBeNull();
    });

    it('should store acceptedAt when invitation is accepted', async () => {
      const acceptedAt = new Date();
      const invitation = await prisma.organizationInvitation.create({
        data: {
          organizationId: testOrganizationId,
          email: 'accepted-time@example.com',
          invitedBy: testUserId,
          role: 'MEMBER',
          status: 'ACCEPTED',
          acceptedAt,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      expect(invitation.acceptedAt).toBeDefined();
      expect(invitation.acceptedAt?.getTime()).toBeCloseTo(acceptedAt.getTime(), -2);
    });
  });
});
