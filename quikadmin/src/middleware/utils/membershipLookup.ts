/**
 * Membership Lookup Utilities
 *
 * Shared database queries for organization membership checks.
 */

import { prisma } from '../../utils/prisma';

type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

interface MembershipResult {
  role: string;
  organizationId: string;
}

/**
 * Find an active membership for a user in an organization
 *
 * @param userId - The user ID to check
 * @param organizationId - The organization ID to check membership in
 * @param roleFilter - Optional array of roles to filter by (e.g., ['OWNER', 'ADMIN'])
 * @returns The membership record if found, null otherwise
 */
export async function findActiveMembership(
  userId: string,
  organizationId: string,
  roleFilter?: MembershipRole[]
): Promise<MembershipResult | null> {
  const whereClause: {
    userId: string;
    organizationId: string;
    status: 'ACTIVE';
    role?: MembershipRole | { in: MembershipRole[] };
  } = {
    userId,
    organizationId,
    status: 'ACTIVE',
  };

  if (roleFilter) {
    if (roleFilter.length === 1) {
      whereClause.role = roleFilter[0];
    } else {
      whereClause.role = { in: roleFilter };
    }
  }

  const membership = await prisma.organizationMembership.findFirst({
    where: whereClause,
    select: {
      role: true,
      organizationId: true,
    },
  });

  return membership;
}
