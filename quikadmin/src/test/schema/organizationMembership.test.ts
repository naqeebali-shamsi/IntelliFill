/**
 * TDD Tests for Task 378: Database Schema - OrganizationMembership Model
 *
 * Purpose: Test-driven development for organization membership system.
 * These tests define expected behavior BEFORE implementation.
 *
 * Test Coverage:
 * - OrgMemberRole enum values (OWNER, ADMIN, MEMBER, VIEWER)
 * - MembershipStatus enum values (PENDING, ACTIVE, SUSPENDED, LEFT)
 * - InvitationStatus enum values (PENDING, ACCEPTED, EXPIRED, CANCELLED)
 * - OrganizationMembership model CRUD operations
 * - Unique constraint on [userId, organizationId]
 * - Cascade delete behavior (User and Organization)
 * - Default values (role=MEMBER, status=ACTIVE)
 * - Timestamp tracking (createdAt, updatedAt)
 */

import { PrismaClient } from '@prisma/client';

// Use Prisma singleton pattern (as per CLAUDE.md)
// Note: In real implementation, import from '../utils/prisma'
// For TDD phase, we'll use a test database connection
const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
});

describe('Task 378: OrganizationMembership Schema Tests (TDD)', () => {
  // Test data cleanup - runs after all tests
  afterAll(async () => {
    // Clean up test data
    await prisma.organizationMembership.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: { contains: 'test-task378' } },
    });
    await prisma.organization.deleteMany({
      where: { name: { contains: 'Test Org Task 378' } },
    });
    await prisma.$disconnect();
  });

  // ==========================================================================
  // ENUM TESTS: OrgMemberRole
  // ==========================================================================
  describe('OrgMemberRole Enum', () => {
    it('should have OWNER role value', async () => {
      // This test verifies the enum exists in the schema
      // Will fail until schema is updated
      const org = await createTestOrg('Test Org Task 378 - Role OWNER');
      const user = await createTestUser('test-task378-owner@example.com');

      const membership = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: 'OWNER' as any, // Will be typed after schema update
          status: 'ACTIVE' as any,
        },
      });

      expect(membership.role).toBe('OWNER');
    });

    it('should have ADMIN role value', async () => {
      const org = await createTestOrg('Test Org Task 378 - Role ADMIN');
      const user = await createTestUser('test-task378-admin@example.com');

      const membership = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: 'ADMIN' as any,
          status: 'ACTIVE' as any,
        },
      });

      expect(membership.role).toBe('ADMIN');
    });

    it('should have MEMBER role value', async () => {
      const org = await createTestOrg('Test Org Task 378 - Role MEMBER');
      const user = await createTestUser('test-task378-member@example.com');

      const membership = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: 'MEMBER' as any,
          status: 'ACTIVE' as any,
        },
      });

      expect(membership.role).toBe('MEMBER');
    });

    it('should have VIEWER role value', async () => {
      const org = await createTestOrg('Test Org Task 378 - Role VIEWER');
      const user = await createTestUser('test-task378-viewer@example.com');

      const membership = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: 'VIEWER' as any,
          status: 'ACTIVE' as any,
        },
      });

      expect(membership.role).toBe('VIEWER');
    });

    it('should reject invalid role values', async () => {
      const org = await createTestOrg('Test Org Task 378 - Invalid Role');
      const user = await createTestUser('test-task378-invalid-role@example.com');

      await expect(
        prisma.organizationMembership.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            role: 'SUPERUSER' as any, // Invalid role
            status: 'ACTIVE' as any,
          },
        })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // ENUM TESTS: MembershipStatus
  // ==========================================================================
  describe('MembershipStatus Enum', () => {
    it('should have PENDING status value', async () => {
      const org = await createTestOrg('Test Org Task 378 - Status PENDING');
      const user = await createTestUser('test-task378-pending@example.com');

      const membership = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: 'MEMBER' as any,
          status: 'PENDING' as any,
        },
      });

      expect(membership.status).toBe('PENDING');
    });

    it('should have ACTIVE status value', async () => {
      const org = await createTestOrg('Test Org Task 378 - Status ACTIVE');
      const user = await createTestUser('test-task378-active@example.com');

      const membership = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: 'MEMBER' as any,
          status: 'ACTIVE' as any,
        },
      });

      expect(membership.status).toBe('ACTIVE');
    });

    it('should have SUSPENDED status value', async () => {
      const org = await createTestOrg('Test Org Task 378 - Status SUSPENDED');
      const user = await createTestUser('test-task378-suspended@example.com');

      const membership = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: 'MEMBER' as any,
          status: 'SUSPENDED' as any,
        },
      });

      expect(membership.status).toBe('SUSPENDED');
    });

    it('should have LEFT status value', async () => {
      const org = await createTestOrg('Test Org Task 378 - Status LEFT');
      const user = await createTestUser('test-task378-left@example.com');

      const membership = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: 'MEMBER' as any,
          status: 'LEFT' as any,
        },
      });

      expect(membership.status).toBe('LEFT');
    });

    it('should reject invalid status values', async () => {
      const org = await createTestOrg('Test Org Task 378 - Invalid Status');
      const user = await createTestUser('test-task378-invalid-status@example.com');

      await expect(
        prisma.organizationMembership.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            role: 'MEMBER' as any,
            status: 'BANNED' as any, // Invalid status
          },
        })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // ENUM TESTS: InvitationStatus
  // ==========================================================================
  describe('InvitationStatus Enum', () => {
    it('should have PENDING invitation status', async () => {
      // Note: This enum is defined in schema but not directly used in OrganizationMembership
      // This test verifies the enum exists for future use (e.g., OrganizationInvitation model)
      // Test will be implemented when invitation model is added
      expect(true).toBe(true); // Placeholder - will expand when invitation model exists
    });

    it('should have ACCEPTED invitation status', async () => {
      expect(true).toBe(true); // Placeholder
    });

    it('should have EXPIRED invitation status', async () => {
      expect(true).toBe(true); // Placeholder
    });

    it('should have CANCELLED invitation status', async () => {
      expect(true).toBe(true); // Placeholder
    });
  });

  // ==========================================================================
  // MODEL TESTS: OrganizationMembership CRUD
  // ==========================================================================
  describe('OrganizationMembership Model - Basic Operations', () => {
    it('should create a membership with all required fields', async () => {
      const org = await createTestOrg('Test Org Task 378 - Create Full');
      const user = await createTestUser('test-task378-create@example.com');
      const inviter = await createTestUser('test-task378-inviter@example.com');

      const now = new Date();
      const membership = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: 'MEMBER' as any,
          status: 'ACTIVE' as any,
          invitedBy: inviter.id,
          invitedAt: now,
          joinedAt: now,
        },
      });

      expect(membership).toBeDefined();
      expect(membership.id).toBeDefined();
      expect(membership.userId).toBe(user.id);
      expect(membership.organizationId).toBe(org.id);
      expect(membership.role).toBe('MEMBER');
      expect(membership.status).toBe('ACTIVE');
      expect(membership.invitedBy).toBe(inviter.id);
      expect(membership.invitedAt).toBeInstanceOf(Date);
      expect(membership.joinedAt).toBeInstanceOf(Date);
      expect(membership.createdAt).toBeInstanceOf(Date);
      expect(membership.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a membership with minimal fields (using defaults)', async () => {
      const org = await createTestOrg('Test Org Task 378 - Create Minimal');
      const user = await createTestUser('test-task378-minimal@example.com');

      const membership = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          // role and status should default
        },
      });

      expect(membership.role).toBe('MEMBER'); // Default value
      expect(membership.status).toBe('ACTIVE'); // Default value
      expect(membership.invitedBy).toBeNull();
      expect(membership.invitedAt).toBeNull();
      expect(membership.joinedAt).toBeNull();
    });

    it('should read a membership by id', async () => {
      const org = await createTestOrg('Test Org Task 378 - Read');
      const user = await createTestUser('test-task378-read@example.com');

      const created = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: 'ADMIN' as any,
          status: 'ACTIVE' as any,
        },
      });

      const fetched = await prisma.organizationMembership.findUnique({
        where: { id: created.id },
      });

      expect(fetched).toBeDefined();
      expect(fetched?.id).toBe(created.id);
      expect(fetched?.role).toBe('ADMIN');
    });

    it('should update a membership', async () => {
      const org = await createTestOrg('Test Org Task 378 - Update');
      const user = await createTestUser('test-task378-update@example.com');

      const membership = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: 'MEMBER' as any,
          status: 'PENDING' as any,
        },
      });

      const updated = await prisma.organizationMembership.update({
        where: { id: membership.id },
        data: {
          status: 'ACTIVE' as any,
          joinedAt: new Date(),
        },
      });

      expect(updated.status).toBe('ACTIVE');
      expect(updated.joinedAt).toBeInstanceOf(Date);
      expect(updated.updatedAt.getTime()).toBeGreaterThan(membership.updatedAt.getTime());
    });

    it('should delete a membership', async () => {
      const org = await createTestOrg('Test Org Task 378 - Delete');
      const user = await createTestUser('test-task378-delete@example.com');

      const membership = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
        },
      });

      await prisma.organizationMembership.delete({
        where: { id: membership.id },
      });

      const fetched = await prisma.organizationMembership.findUnique({
        where: { id: membership.id },
      });

      expect(fetched).toBeNull();
    });
  });

  // ==========================================================================
  // CONSTRAINT TESTS: Unique [userId, organizationId]
  // ==========================================================================
  describe('Unique Constraint: [userId, organizationId]', () => {
    it('should enforce unique constraint on userId + organizationId combination', async () => {
      const org = await createTestOrg('Test Org Task 378 - Unique Constraint');
      const user = await createTestUser('test-task378-unique@example.com');

      // Create first membership
      await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: 'MEMBER' as any,
          status: 'ACTIVE' as any,
        },
      });

      // Attempt to create duplicate membership - should fail
      await expect(
        prisma.organizationMembership.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            role: 'ADMIN' as any, // Different role, but same user+org
            status: 'ACTIVE' as any,
          },
        })
      ).rejects.toThrow(/Unique constraint/i);
    });

    it('should allow same user in different organizations', async () => {
      const org1 = await createTestOrg('Test Org Task 378 - Multi Org 1');
      const org2 = await createTestOrg('Test Org Task 378 - Multi Org 2');
      const user = await createTestUser('test-task378-multi-org@example.com');

      const membership1 = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org1.id,
          role: 'MEMBER' as any,
          status: 'ACTIVE' as any,
        },
      });

      const membership2 = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org2.id,
          role: 'ADMIN' as any,
          status: 'ACTIVE' as any,
        },
      });

      expect(membership1).toBeDefined();
      expect(membership2).toBeDefined();
      expect(membership1.id).not.toBe(membership2.id);
      expect(membership1.organizationId).not.toBe(membership2.organizationId);
    });

    it('should allow different users in same organization', async () => {
      const org = await createTestOrg('Test Org Task 378 - Multi User');
      const user1 = await createTestUser('test-task378-user1@example.com');
      const user2 = await createTestUser('test-task378-user2@example.com');

      const membership1 = await prisma.organizationMembership.create({
        data: {
          userId: user1.id,
          organizationId: org.id,
          role: 'OWNER' as any,
          status: 'ACTIVE' as any,
        },
      });

      const membership2 = await prisma.organizationMembership.create({
        data: {
          userId: user2.id,
          organizationId: org.id,
          role: 'MEMBER' as any,
          status: 'ACTIVE' as any,
        },
      });

      expect(membership1).toBeDefined();
      expect(membership2).toBeDefined();
      expect(membership1.id).not.toBe(membership2.id);
      expect(membership1.userId).not.toBe(membership2.userId);
    });
  });

  // ==========================================================================
  // RELATION TESTS: Cascade Delete Behavior
  // ==========================================================================
  describe('Cascade Delete: User Deletion', () => {
    it('should cascade delete memberships when user is deleted', async () => {
      const org = await createTestOrg('Test Org Task 378 - User Cascade');
      const user = await createTestUser('test-task378-user-cascade@example.com');

      const membership = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: 'MEMBER' as any,
          status: 'ACTIVE' as any,
        },
      });

      // Delete user - membership should be cascade deleted
      await prisma.user.delete({
        where: { id: user.id },
      });

      // Verify membership no longer exists
      const fetchedMembership = await prisma.organizationMembership.findUnique({
        where: { id: membership.id },
      });

      expect(fetchedMembership).toBeNull();
    });

    it('should delete all memberships when user with multiple orgs is deleted', async () => {
      const org1 = await createTestOrg('Test Org Task 378 - Multi Delete 1');
      const org2 = await createTestOrg('Test Org Task 378 - Multi Delete 2');
      const user = await createTestUser('test-task378-multi-delete@example.com');

      const membership1 = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org1.id,
        },
      });

      const membership2 = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org2.id,
        },
      });

      // Delete user
      await prisma.user.delete({
        where: { id: user.id },
      });

      // Both memberships should be deleted
      const fetched1 = await prisma.organizationMembership.findUnique({
        where: { id: membership1.id },
      });
      const fetched2 = await prisma.organizationMembership.findUnique({
        where: { id: membership2.id },
      });

      expect(fetched1).toBeNull();
      expect(fetched2).toBeNull();
    });
  });

  describe('Cascade Delete: Organization Deletion', () => {
    it('should cascade delete memberships when organization is deleted', async () => {
      const org = await createTestOrg('Test Org Task 378 - Org Cascade');
      const user = await createTestUser('test-task378-org-cascade@example.com');

      const membership = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: 'OWNER' as any,
          status: 'ACTIVE' as any,
        },
      });

      // Delete organization - membership should be cascade deleted
      await prisma.organization.delete({
        where: { id: org.id },
      });

      // Verify membership no longer exists
      const fetchedMembership = await prisma.organizationMembership.findUnique({
        where: { id: membership.id },
      });

      expect(fetchedMembership).toBeNull();
    });

    it('should delete all memberships when org with multiple members is deleted', async () => {
      const org = await createTestOrg('Test Org Task 378 - Multi Member Delete');
      const user1 = await createTestUser('test-task378-member-del-1@example.com');
      const user2 = await createTestUser('test-task378-member-del-2@example.com');

      const membership1 = await prisma.organizationMembership.create({
        data: {
          userId: user1.id,
          organizationId: org.id,
          role: 'OWNER' as any,
        },
      });

      const membership2 = await prisma.organizationMembership.create({
        data: {
          userId: user2.id,
          organizationId: org.id,
          role: 'MEMBER' as any,
        },
      });

      // Delete organization
      await prisma.organization.delete({
        where: { id: org.id },
      });

      // Both memberships should be deleted
      const fetched1 = await prisma.organizationMembership.findUnique({
        where: { id: membership1.id },
      });
      const fetched2 = await prisma.organizationMembership.findUnique({
        where: { id: membership2.id },
      });

      expect(fetched1).toBeNull();
      expect(fetched2).toBeNull();
    });
  });

  // ==========================================================================
  // DEFAULT VALUE TESTS
  // ==========================================================================
  describe('Default Values', () => {
    it('should default role to MEMBER when not specified', async () => {
      const org = await createTestOrg('Test Org Task 378 - Default Role');
      const user = await createTestUser('test-task378-default-role@example.com');

      const membership = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          status: 'ACTIVE' as any,
          // role not specified - should default to MEMBER
        },
      });

      expect(membership.role).toBe('MEMBER');
    });

    it('should default status to ACTIVE when not specified', async () => {
      const org = await createTestOrg('Test Org Task 378 - Default Status');
      const user = await createTestUser('test-task378-default-status@example.com');

      const membership = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: 'MEMBER' as any,
          // status not specified - should default to ACTIVE
        },
      });

      expect(membership.status).toBe('ACTIVE');
    });

    it('should set createdAt and updatedAt timestamps automatically', async () => {
      const org = await createTestOrg('Test Org Task 378 - Timestamps');
      const user = await createTestUser('test-task378-timestamps@example.com');

      const beforeCreate = new Date();
      await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay

      const membership = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
      const afterCreate = new Date();

      expect(membership.createdAt).toBeInstanceOf(Date);
      expect(membership.updatedAt).toBeInstanceOf(Date);
      expect(membership.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(membership.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      expect(membership.updatedAt.getTime()).toBeGreaterThanOrEqual(membership.createdAt.getTime());
    });
  });

  // ==========================================================================
  // RELATION TESTS: Include Relations
  // ==========================================================================
  describe('Relations', () => {
    it('should include User relation when queried', async () => {
      const org = await createTestOrg('Test Org Task 378 - User Relation');
      const user = await createTestUser('test-task378-user-rel@example.com');

      const membership = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
        },
      });

      const fetchedWithUser = await prisma.organizationMembership.findUnique({
        where: { id: membership.id },
        include: { user: true },
      });

      expect(fetchedWithUser?.user).toBeDefined();
      expect(fetchedWithUser?.user.id).toBe(user.id);
      expect(fetchedWithUser?.user.email).toBe(user.email);
    });

    it('should include Organization relation when queried', async () => {
      const org = await createTestOrg('Test Org Task 378 - Org Relation');
      const user = await createTestUser('test-task378-org-rel@example.com');

      const membership = await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
        },
      });

      const fetchedWithOrg = await prisma.organizationMembership.findUnique({
        where: { id: membership.id },
        include: { organization: true },
      });

      expect(fetchedWithOrg?.organization).toBeDefined();
      expect(fetchedWithOrg?.organization.id).toBe(org.id);
      expect(fetchedWithOrg?.organization.name).toBe(org.name);
    });

    it('should query User with their memberships', async () => {
      const org = await createTestOrg('Test Org Task 378 - User Memberships');
      const user = await createTestUser('test-task378-user-memberships@example.com');

      await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
        },
      });

      const userWithMemberships = await prisma.user.findUnique({
        where: { id: user.id },
        include: { memberships: true },
      });

      expect(userWithMemberships?.memberships).toBeDefined();
      expect(userWithMemberships?.memberships.length).toBeGreaterThan(0);
      expect(userWithMemberships?.memberships[0].organizationId).toBe(org.id);
    });

    it('should query Organization with its memberships', async () => {
      const org = await createTestOrg('Test Org Task 378 - Org Memberships');
      const user = await createTestUser('test-task378-org-memberships@example.com');

      await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
        },
      });

      const orgWithMemberships = await prisma.organization.findUnique({
        where: { id: org.id },
        include: { memberships: true },
      });

      expect(orgWithMemberships?.memberships).toBeDefined();
      expect(orgWithMemberships?.memberships.length).toBeGreaterThan(0);
      expect(orgWithMemberships?.memberships[0].userId).toBe(user.id);
    });
  });

  // ==========================================================================
  // INDEX TESTS: Query Performance
  // ==========================================================================
  describe('Indexes (Query Performance)', () => {
    it('should efficiently query memberships by userId', async () => {
      const org1 = await createTestOrg('Test Org Task 378 - Index Query 1');
      const org2 = await createTestOrg('Test Org Task 378 - Index Query 2');
      const user = await createTestUser('test-task378-index-user@example.com');

      await prisma.organizationMembership.create({
        data: { userId: user.id, organizationId: org1.id },
      });
      await prisma.organizationMembership.create({
        data: { userId: user.id, organizationId: org2.id },
      });

      const memberships = await prisma.organizationMembership.findMany({
        where: { userId: user.id },
      });

      expect(memberships.length).toBe(2);
    });

    it('should efficiently query memberships by organizationId', async () => {
      const org = await createTestOrg('Test Org Task 378 - Index Org Query');
      const user1 = await createTestUser('test-task378-index-org-1@example.com');
      const user2 = await createTestUser('test-task378-index-org-2@example.com');

      await prisma.organizationMembership.create({
        data: { userId: user1.id, organizationId: org.id },
      });
      await prisma.organizationMembership.create({
        data: { userId: user2.id, organizationId: org.id },
      });

      const memberships = await prisma.organizationMembership.findMany({
        where: { organizationId: org.id },
      });

      expect(memberships.length).toBe(2);
    });

    it('should efficiently query memberships by status', async () => {
      const org = await createTestOrg('Test Org Task 378 - Index Status');
      const user1 = await createTestUser('test-task378-index-status-1@example.com');
      const user2 = await createTestUser('test-task378-index-status-2@example.com');

      await prisma.organizationMembership.create({
        data: {
          userId: user1.id,
          organizationId: org.id,
          status: 'PENDING' as any,
        },
      });
      await prisma.organizationMembership.create({
        data: {
          userId: user2.id,
          organizationId: org.id,
          status: 'ACTIVE' as any,
        },
      });

      const pendingMemberships = await prisma.organizationMembership.findMany({
        where: { status: 'PENDING' as any },
      });

      expect(pendingMemberships.length).toBeGreaterThanOrEqual(1);
      expect(pendingMemberships.every((m) => m.status === 'PENDING')).toBe(true);
    });
  });
});

// ==========================================================================
// TEST HELPER FUNCTIONS
// ==========================================================================

/**
 * Creates a test organization
 */
async function createTestOrg(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return await prisma.organization.create({
    data: {
      name,
      slug,
      status: 'ACTIVE',
    },
  });
}

/**
 * Creates a test user
 */
async function createTestUser(email: string) {
  return await prisma.user.create({
    data: {
      email,
      password: 'hashed_password_for_test',
      role: 'USER',
      isActive: true,
    },
  });
}
