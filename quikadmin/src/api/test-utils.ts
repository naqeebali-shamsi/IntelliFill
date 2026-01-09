/**
 * Test Utilities for API Integration Tests
 *
 * Provides helper functions for:
 * - Creating test users, organizations, and memberships
 * - Generating auth tokens
 * - Test data cleanup
 *
 * Task 391: Integration Testing and Edge Case Handling
 */

import { PrismaClient, OrgMemberRole, MembershipStatus, InvitationStatus } from '@prisma/client';
import crypto from 'crypto';

// Use separate Prisma client for tests
const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
});

// Test data prefix for cleanup
const TEST_PREFIX = 'test-task391';

// ============================================================================
// Types
// ============================================================================

export interface TestUser {
  id: string;
  email: string;
  password: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
  organizationId: string | null;
}

export interface TestOrganization {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface TestMembership {
  id: string;
  userId: string;
  organizationId: string;
  role: OrgMemberRole;
  status: MembershipStatus;
}

export interface TestInvitation {
  id: string;
  email: string;
  organizationId: string;
  role: OrgMemberRole;
  status: InvitationStatus;
  expiresAt: Date;
}

export interface OrgWithOwner {
  org: TestOrganization;
  owner: TestUser;
  ownerMembership: TestMembership;
}

export interface OrgWithAdmins extends OrgWithOwner {
  admins: TestUser[];
  adminMemberships: TestMembership[];
}

export interface OrgWithMembers extends OrgWithOwner {
  members: TestUser[];
  memberMemberships: TestMembership[];
}

// ============================================================================
// User Utilities
// ============================================================================

/**
 * Creates a test user
 */
export async function createTestUser(
  emailSuffix?: string,
  options: {
    firstName?: string;
    lastName?: string;
    organizationId?: string;
  } = {}
): Promise<TestUser> {
  const uniqueId = crypto.randomBytes(4).toString('hex');
  const email = emailSuffix
    ? `${TEST_PREFIX}-${emailSuffix}-${uniqueId}@test.example.com`
    : `${TEST_PREFIX}-user-${uniqueId}@test.example.com`;

  const user = await prisma.user.create({
    data: {
      email,
      password: 'hashed_password_for_test',
      role: 'USER',
      isActive: true,
      firstName: options.firstName || null,
      lastName: options.lastName || null,
      organizationId: options.organizationId || null,
    },
  });

  return user as unknown as TestUser;
}

/**
 * Gets a mock auth token object for tests
 * In real tests, this would integrate with the auth system
 */
export function getMockAuthUser(user: TestUser): {
  id: string;
  email: string;
} {
  return {
    id: user.id,
    email: user.email,
  };
}

// ============================================================================
// Organization Utilities
// ============================================================================

/**
 * Creates a test organization
 */
export async function createTestOrg(nameSuffix?: string): Promise<TestOrganization> {
  const uniqueId = crypto.randomBytes(4).toString('hex');
  const name = nameSuffix
    ? `${TEST_PREFIX} ${nameSuffix} ${uniqueId}`
    : `${TEST_PREFIX} Org ${uniqueId}`;

  const org = await prisma.organization.create({
    data: {
      name,
      slug: `${TEST_PREFIX}-${uniqueId}`,
      status: 'ACTIVE',
    },
  });

  return org as unknown as TestOrganization;
}

/**
 * Creates a test organization with owner
 */
export async function createTestOrgWithOwner(
  orgNameSuffix?: string
): Promise<OrgWithOwner> {
  const org = await createTestOrg(orgNameSuffix || 'WithOwner');
  const owner = await createTestUser('owner', { organizationId: org.id });

  const ownerMembership = await prisma.organizationMembership.create({
    data: {
      userId: owner.id,
      organizationId: org.id,
      role: 'OWNER',
      status: 'ACTIVE',
      joinedAt: new Date(),
    },
  });

  return {
    org,
    owner,
    ownerMembership: ownerMembership as unknown as TestMembership,
  };
}

/**
 * Creates a test organization with specified number of admins
 * First admin is the owner
 */
export async function createTestOrgWithAdmins(
  adminCount: number = 2
): Promise<OrgWithAdmins> {
  const { org, owner, ownerMembership } = await createTestOrgWithOwner('WithAdmins');

  const admins: TestUser[] = [];
  const adminMemberships: TestMembership[] = [];

  // Create additional admins (owner counts as first)
  for (let i = 1; i < adminCount; i++) {
    const admin = await createTestUser(`admin${i}`, { organizationId: org.id });
    admins.push(admin);

    const membership = await prisma.organizationMembership.create({
      data: {
        userId: admin.id,
        organizationId: org.id,
        role: 'ADMIN',
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });
    adminMemberships.push(membership as unknown as TestMembership);
  }

  return {
    org,
    owner,
    ownerMembership,
    admins,
    adminMemberships,
  };
}

/**
 * Creates a test organization with owner and members
 */
export async function createTestOrgWithMembers(
  memberCount: number = 1
): Promise<OrgWithMembers> {
  const { org, owner, ownerMembership } = await createTestOrgWithOwner('WithMembers');

  const members: TestUser[] = [];
  const memberMemberships: TestMembership[] = [];

  for (let i = 0; i < memberCount; i++) {
    const member = await createTestUser(`member${i}`, { organizationId: org.id });
    members.push(member);

    const membership = await prisma.organizationMembership.create({
      data: {
        userId: member.id,
        organizationId: org.id,
        role: 'MEMBER',
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });
    memberMemberships.push(membership as unknown as TestMembership);
  }

  return {
    org,
    owner,
    ownerMembership,
    members,
    memberMemberships,
  };
}

// ============================================================================
// Membership Utilities
// ============================================================================

/**
 * Creates a membership for a user in an organization
 */
export async function createMembership(
  userId: string,
  organizationId: string,
  role: OrgMemberRole = 'MEMBER',
  status: MembershipStatus = 'ACTIVE'
): Promise<TestMembership> {
  const membership = await prisma.organizationMembership.create({
    data: {
      userId,
      organizationId,
      role,
      status,
      joinedAt: status === 'ACTIVE' ? new Date() : null,
    },
  });

  return membership as unknown as TestMembership;
}

/**
 * Updates a membership's role
 */
export async function updateMembershipRole(
  membershipId: string,
  newRole: OrgMemberRole
): Promise<TestMembership> {
  const membership = await prisma.organizationMembership.update({
    where: { id: membershipId },
    data: { role: newRole },
  });

  return membership as unknown as TestMembership;
}

// ============================================================================
// Invitation Utilities
// ============================================================================

/**
 * Creates a test invitation
 */
export async function createTestInvitation(
  organizationId: string,
  invitedBy: string,
  options: {
    email?: string;
    role?: OrgMemberRole;
    status?: InvitationStatus;
    expiresInDays?: number;
  } = {}
): Promise<TestInvitation> {
  const uniqueId = crypto.randomBytes(4).toString('hex');
  const email = options.email || `${TEST_PREFIX}-invite-${uniqueId}@test.example.com`;
  const expiresAt = new Date(
    Date.now() + (options.expiresInDays || 7) * 24 * 60 * 60 * 1000
  );

  const invitation = await prisma.organizationInvitation.create({
    data: {
      email,
      organizationId,
      role: options.role || 'MEMBER',
      status: options.status || 'PENDING',
      invitedBy,
      expiresAt,
    },
  });

  return invitation as unknown as TestInvitation;
}

/**
 * Creates an expired invitation
 */
export async function createExpiredInvitation(
  organizationId: string,
  invitedBy: string,
  email?: string
): Promise<TestInvitation> {
  const uniqueId = crypto.randomBytes(4).toString('hex');
  const inviteEmail = email || `${TEST_PREFIX}-expired-${uniqueId}@test.example.com`;

  const invitation = await prisma.organizationInvitation.create({
    data: {
      email: inviteEmail,
      organizationId,
      role: 'MEMBER',
      status: 'PENDING',
      invitedBy,
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
    },
  });

  return invitation as unknown as TestInvitation;
}

// ============================================================================
// Cleanup Utilities
// ============================================================================

/**
 * Cleans up all test data created with TEST_PREFIX
 */
export async function cleanupTestData(): Promise<void> {
  // Delete in order to respect foreign key constraints
  // 1. Delete invitations
  await prisma.organizationInvitation.deleteMany({
    where: {
      email: { contains: TEST_PREFIX },
    },
  });

  // 2. Delete memberships
  await prisma.organizationMembership.deleteMany({
    where: {
      OR: [
        { user: { email: { contains: TEST_PREFIX } } },
        { organization: { name: { contains: TEST_PREFIX } } },
      ],
    },
  });

  // 3. Delete users (this should cascade to their memberships if any remain)
  await prisma.user.deleteMany({
    where: { email: { contains: TEST_PREFIX } },
  });

  // 4. Delete organizations
  await prisma.organization.deleteMany({
    where: { name: { contains: TEST_PREFIX } },
  });
}

/**
 * Disconnects Prisma client (call in afterAll)
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Gets the count of admins (ADMIN or OWNER) in an organization
 */
export async function getAdminCount(organizationId: string): Promise<number> {
  return prisma.organizationMembership.count({
    where: {
      organizationId,
      role: { in: ['ADMIN', 'OWNER'] },
      status: 'ACTIVE',
    },
  });
}

/**
 * Gets the count of owners in an organization
 */
export async function getOwnerCount(organizationId: string): Promise<number> {
  return prisma.organizationMembership.count({
    where: {
      organizationId,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });
}

/**
 * Gets a membership by user and org
 */
export async function getMembership(
  userId: string,
  organizationId: string
): Promise<TestMembership | null> {
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId, organizationId },
  });
  return membership as unknown as TestMembership | null;
}

/**
 * Gets an invitation by ID
 */
export async function getInvitation(invitationId: string): Promise<TestInvitation | null> {
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { id: invitationId },
  });
  return invitation as unknown as TestInvitation | null;
}

// Export prisma instance for direct queries in tests
export { prisma };
