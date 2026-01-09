/**
 * Backfill Organization Memberships Script
 *
 * Purpose: Generate OrganizationMembership records for existing users
 *          who have an organizationId but no membership record.
 *
 * This handles the data migration for users created before the
 * OrganizationMembership model was introduced.
 *
 * Usage: npm run db:backfill-memberships
 *
 * Safety:
 * - Idempotent: Safe to run multiple times (skipDuplicates)
 * - Non-destructive: Only creates missing records, never deletes
 * - Uses MEMBER role as default (backward compatible)
 * - Preserves original user createdAt as joinedAt
 */

import { PrismaClient, OrgMemberRole, MembershipStatus } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

interface UserNeedingMembership {
  id: string;
  organizationId: string;
  createdAt: Date;
}

async function backfillMemberships(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Organization Membership Backfill Script');
  console.log('='.repeat(60));
  console.log('');

  const startTime = Date.now();

  try {
    // Step 1: Find users with organizationId but no membership record
    console.log('[1/4] Finding users needing membership backfill...');

    const users = await prisma.user.findMany({
      where: {
        organizationId: { not: null },
        memberships: { none: {} },
      },
      select: {
        id: true,
        organizationId: true,
        createdAt: true,
        email: true,
      },
    });

    console.log(`      Found ${users.length} users without membership records`);

    if (users.length === 0) {
      console.log('');
      console.log('[DONE] No users need membership backfill. All users are up to date.');
      return;
    }

    // Step 2: Display summary of what will be created
    console.log('');
    console.log('[2/4] Users to be processed:');

    // Group by organization for better visibility
    const byOrg = new Map<string, typeof users>();
    for (const user of users) {
      const orgId = user.organizationId!;
      if (!byOrg.has(orgId)) {
        byOrg.set(orgId, []);
      }
      byOrg.get(orgId)!.push(user);
    }

    for (const [orgId, orgUsers] of byOrg) {
      console.log(`      Organization ${orgId.substring(0, 8)}...:`);
      for (const user of orgUsers) {
        console.log(`        - ${user.email} (created: ${user.createdAt.toISOString().split('T')[0]})`);
      }
    }

    // Step 3: Prepare membership data
    console.log('');
    console.log('[3/4] Creating membership records...');

    const memberships = users.map((user) => ({
      userId: user.id,
      organizationId: user.organizationId!,
      role: OrgMemberRole.MEMBER,
      status: MembershipStatus.ACTIVE,
      joinedAt: user.createdAt, // Preserve original user creation date
    }));

    // Step 4: Batch create memberships with skipDuplicates for idempotency
    const result = await prisma.organizationMembership.createMany({
      data: memberships,
      skipDuplicates: true, // Makes script safe to re-run
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('');
    console.log('='.repeat(60));
    console.log('[SUCCESS] Backfill completed');
    console.log('='.repeat(60));
    console.log(`  Created: ${result.count} membership records`);
    console.log(`  Skipped: ${users.length - result.count} (already existed)`);
    console.log(`  Time:    ${elapsed}s`);
    console.log('');

    // Step 5: Verify results
    console.log('[4/4] Verification...');
    const remainingUsers = await prisma.user.count({
      where: {
        organizationId: { not: null },
        memberships: { none: {} },
      },
    });

    if (remainingUsers === 0) {
      console.log('      All users with organizations now have membership records.');
    } else {
      console.warn(`      WARNING: ${remainingUsers} users still without membership records.`);
      console.warn('      This may indicate a race condition or data issue.');
    }
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('[ERROR] Backfill failed');
    console.error('='.repeat(60));

    if (error instanceof Error) {
      console.error(`  Message: ${error.message}`);
      if (error.stack) {
        console.error('');
        console.error('Stack trace:');
        console.error(error.stack);
      }
    } else {
      console.error('  Unknown error:', error);
    }

    process.exit(1);
  }
}

// Main execution
backfillMemberships()
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('');
    console.log('Database connection closed.');
  });
