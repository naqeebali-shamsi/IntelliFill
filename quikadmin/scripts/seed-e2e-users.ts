/**
 * Seed E2E Test Users
 *
 * Creates or updates test users for E2E testing via Supabase Auth.
 * Run with: npx tsx scripts/seed-e2e-users.ts
 *
 * IMPORTANT: These users MUST match ../quikadmin-web/e2e/data/test-users.json
 *
 * RETRY CONFIGURATION:
 * This script includes retry logic for transient failures. Configure via environment:
 *   - SEED_MAX_RETRIES: Maximum retry attempts (default: 3)
 *   - SEED_RETRY_DELAY_MS: Base delay for exponential backoff (default: 1000ms)
 *
 * Retryable errors: network timeouts, connection refused, rate limits, 5xx errors
 * Non-retryable errors: invalid credentials, schema errors, unique constraints
 */

// Load environment variables FIRST before any other imports
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Now import modules that need env vars
import { supabaseAdmin } from '../src/utils/supabase';
import { prisma } from '../src/utils/prisma';
import bcrypt from 'bcrypt';
import type { OrgMemberRole, MembershipStatus, OrganizationStatus } from '@prisma/client';

// bcrypt salt rounds - must match auth routes (12 rounds)
const BCRYPT_SALT_ROUNDS = 12;

// Retry configuration from environment
const SEED_MAX_RETRIES = parseInt(process.env.SEED_MAX_RETRIES || '3', 10);
const SEED_RETRY_DELAY_MS = parseInt(process.env.SEED_RETRY_DELAY_MS || '1000', 10);

/**
 * Error codes that are considered retryable (transient failures)
 */
const RETRYABLE_ERROR_PATTERNS = [
  // Network/connection errors
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'socket hang up',
  'connection timeout',
  'network error',
  'fetch failed',
  // Rate limiting
  'rate limit',
  'too many requests',
  '429',
  // Database transient errors
  'connection pool',
  'deadlock',
  'lock wait timeout',
  'server closed the connection',
  'prepared statement',
  // Supabase specific transient errors
  'service unavailable',
  '503',
  '502',
  '504',
  'gateway timeout',
];

/**
 * Error codes that should NOT be retried (permanent failures)
 */
const NON_RETRYABLE_ERROR_PATTERNS = [
  // Auth/permission errors
  'invalid credentials',
  'unauthorized',
  'forbidden',
  'invalid api key',
  'invalid_grant',
  // Schema/validation errors
  'schema',
  'validation',
  'invalid input',
  'unique constraint',
  'foreign key',
  'not null constraint',
  // User already exists (expected case, not really an error)
  'user already registered',
  'already exists',
];

/**
 * Determine if an error is retryable based on its message/code
 */
function isRetryableError(error: Error | any): boolean {
  const errorMessage = (error?.message || '').toLowerCase();
  const errorCode = (error?.code || '').toLowerCase();
  const statusCode = error?.status || error?.statusCode || 0;

  // First check for non-retryable patterns (these take precedence)
  for (const pattern of NON_RETRYABLE_ERROR_PATTERNS) {
    if (errorMessage.includes(pattern.toLowerCase()) || errorCode.includes(pattern.toLowerCase())) {
      return false;
    }
  }

  // Check for retryable patterns
  for (const pattern of RETRYABLE_ERROR_PATTERNS) {
    if (errorMessage.includes(pattern.toLowerCase()) || errorCode.includes(pattern.toLowerCase())) {
      return true;
    }
  }

  // Check for retryable HTTP status codes
  if (statusCode === 429 || statusCode === 502 || statusCode === 503 || statusCode === 504) {
    return true;
  }

  // Default: don't retry unknown errors
  return false;
}

/**
 * Get a human-readable reason for the error
 */
function getErrorReason(error: Error | any): string {
  const message = error?.message || 'unknown error';
  const code = error?.code;
  const status = error?.status || error?.statusCode;

  if (status === 429 || message.toLowerCase().includes('rate limit')) {
    return 'rate limit exceeded';
  }
  if (code === 'ECONNREFUSED' || message.includes('ECONNREFUSED')) {
    return 'connection refused';
  }
  if (code === 'ETIMEDOUT' || message.includes('timeout')) {
    return 'connection timeout';
  }
  if (code === 'ECONNRESET') {
    return 'connection reset';
  }
  if (message.includes('socket hang up')) {
    return 'socket hang up';
  }
  if (status === 502 || status === 503 || status === 504) {
    return `server error (${status})`;
  }

  // Truncate long messages
  return message.length > 50 ? message.substring(0, 47) + '...' : message;
}

/**
 * Retry wrapper function with exponential backoff
 *
 * @param operation - Async function to execute
 * @param operationName - Name for logging purposes
 * @param maxRetries - Maximum number of retry attempts (default: from env or 3)
 * @param baseDelay - Base delay in ms for exponential backoff (default: from env or 1000)
 * @returns Result of the operation
 * @throws Last error if all retries exhausted
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = SEED_MAX_RETRIES,
  baseDelay: number = SEED_RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // If this is the first attempt (attempt 0), check if it's retryable
      if (attempt === 0 && !isRetryableError(error)) {
        // Not retryable, throw immediately
        throw error;
      }

      // If we've exhausted retries, throw
      if (attempt >= maxRetries) {
        console.log(`  ❌ All ${maxRetries} retries exhausted for ${operationName}`);
        throw error;
      }

      // Calculate delay with exponential backoff + jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
      const reason = getErrorReason(error);

      console.log(`  ⚠️ Retry ${attempt + 1}/${maxRetries} for ${operationName} (reason: ${reason})`);
      console.log(`     Waiting ${Math.round(delay)}ms before retry...`);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should not reach here, but TypeScript needs this
  throw lastError;
}

// E2E Test Organization
const E2E_TEST_ORG = {
  name: 'E2E Test Organization',
  slug: 'e2e-test-org',
  status: 'ACTIVE' as OrganizationStatus,
};

// User role to org membership role mapping
const USER_ORG_ROLES: Record<string, OrgMemberRole> = {
  'test-admin@intellifill.local': 'ADMIN',
  'test-owner@intellifill.local': 'OWNER',
  'test-member@intellifill.local': 'MEMBER',
  'test-viewer@intellifill.local': 'VIEWER',
  'test-password-reset@intellifill.local': 'MEMBER',
};

/**
 * E2E Test Users - MUST match quikadmin-web/e2e/data/test-users.json exactly
 */
const E2E_TEST_USERS = [
  {
    email: 'test-admin@intellifill.local',
    password: 'TestAdmin123!',
    firstName: 'Test Admin',
    lastName: 'User',
    role: 'ADMIN' as const,
  },
  {
    email: 'test-owner@intellifill.local',
    password: 'TestOwner123!',
    firstName: 'Test Owner',
    lastName: 'User',
    role: 'ADMIN' as const, // OWNER maps to ADMIN for now
  },
  {
    email: 'test-member@intellifill.local',
    password: 'TestMember123!',
    firstName: 'Test Member',
    lastName: 'User',
    role: 'USER' as const,
  },
  {
    email: 'test-viewer@intellifill.local',
    password: 'TestViewer123!',
    firstName: 'Test Viewer',
    lastName: 'User',
    role: 'VIEWER' as const,
  },
  {
    email: 'test-password-reset@intellifill.local',
    password: 'TestPasswordReset123!',
    firstName: 'Test Password Reset',
    lastName: 'User',
    role: 'USER' as const,
  },
];

/**
 * Create or update the test organization
 */
async function createTestOrganization(): Promise<string> {
  console.log('🏢 Creating/updating E2E test organization...');

  const org = await withRetry(
    () =>
      prisma.organization.upsert({
        where: { slug: E2E_TEST_ORG.slug },
        update: {
          name: E2E_TEST_ORG.name,
          status: E2E_TEST_ORG.status,
        },
        create: {
          name: E2E_TEST_ORG.name,
          slug: E2E_TEST_ORG.slug,
          status: E2E_TEST_ORG.status,
        },
      }),
    `organization ${E2E_TEST_ORG.slug}`
  );

  console.log(`  ✅ Organization ready (ID: ${org.id}, slug: ${org.slug})\n`);
  return org.id;
}

/**
 * Create organization membership for a user
 */
async function createMembership(userId: string, orgId: string, email: string): Promise<void> {
  const role = USER_ORG_ROLES[email] || 'MEMBER';

  await withRetry(
    () =>
      prisma.organizationMembership.upsert({
        where: {
          userId_organizationId: {
            userId,
            organizationId: orgId,
          },
        },
        update: {
          role,
          status: 'ACTIVE',
        },
        create: {
          userId,
          organizationId: orgId,
          role,
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      }),
    `membership for ${email}`
  );

  console.log(`    ✅ Membership created (role: ${role})`);
}

/**
 * Verify that seeded data is correct, including bcrypt.compare validation
 */
async function verifySeedData(): Promise<void> {
  console.log('\n🔍 Verifying seed data...');
  const errors: string[] = [];
  const verificationStart = Date.now();

  // Fetch all users in parallel for better performance
  const userPromises = E2E_TEST_USERS.map((userData) =>
    prisma.user.findUnique({
      where: { email: userData.email },
      include: { memberships: true },
    }).then((user) => ({ userData, user }))
  );

  const userResults = await Promise.all(userPromises);

  // Prepare bcrypt verification promises (batch for performance)
  const bcryptVerifications: Promise<{ email: string; isValid: boolean; error?: string }>[] = [];

  for (const { userData, user } of userResults) {
    if (!user) {
      errors.push(`User not found: ${userData.email}`);
      continue;
    }

    // Verify password hash format is valid bcrypt (starts with $2a$ or $2b$)
    if (!user.password || !user.password.startsWith('$2')) {
      errors.push(`Invalid password hash format for ${userData.email}: "${user.password?.substring(0, 10) || 'empty'}..."`);
      continue;
    }

    // Verify membership exists
    if (user.memberships.length === 0) {
      errors.push(`No organization membership for ${userData.email}`);
    }

    // Queue bcrypt.compare verification
    bcryptVerifications.push(
      bcrypt
        .compare(userData.password, user.password)
        .then((isValid) => ({
          email: userData.email,
          isValid,
          error: isValid ? undefined : `bcrypt.compare FAILED: plaintext password does not match stored hash`,
        }))
        .catch((err) => ({
          email: userData.email,
          isValid: false,
          error: `bcrypt.compare threw error: ${err.message}`,
        }))
    );
  }

  // Run all bcrypt verifications in parallel (batched for performance)
  console.log(`  ⏳ Running bcrypt.compare for ${bcryptVerifications.length} users...`);
  const bcryptResults = await Promise.all(bcryptVerifications);

  // Check bcrypt results
  let bcryptPassCount = 0;
  for (const result of bcryptResults) {
    if (!result.isValid) {
      errors.push(`${result.email}: ${result.error}`);
    } else {
      bcryptPassCount++;
    }
  }

  const verificationDuration = Date.now() - verificationStart;

  if (errors.length > 0) {
    console.error('\n❌ Seed verification FAILED:');
    errors.forEach((e) => console.error(`  - ${e}`));
    throw new Error(`Seed verification failed with ${errors.length} error(s)`);
  }

  console.log(`  ✅ All ${bcryptPassCount} passwords verified with bcrypt.compare`);
  console.log('  ✅ All users have valid password hash format');
  console.log('  ✅ All users have organization memberships');
  console.log(`  ✅ Seed verification PASSED (${verificationDuration}ms)\n`);
}

async function seedE2EUsers() {
  console.log('🧪 Seeding E2E test users via Supabase Auth + Prisma...\n');

  // 1. Create test organization first
  const orgId = await createTestOrganization();

  const createdUsers: Array<{ email: string; password: string; role: string; orgRole: string; status: string }> = [];

  for (const userData of E2E_TEST_USERS) {
    try {
      console.log(`Creating user: ${userData.email}...`);

      // 1. Hash password with bcrypt for TEST MODE authentication
      console.log('  ⏳ Hashing password with bcrypt...');
      const hashedPassword = await bcrypt.hash(userData.password, BCRYPT_SALT_ROUNDS);

      // 2. Check if user exists in Supabase (with retry for transient failures)
      const listResult = await withRetry(
        () => supabaseAdmin.auth.admin.listUsers(),
        `listUsers for ${userData.email}`
      );
      const existingUser = listResult.data?.users?.find((u: { email?: string }) => u.email === userData.email);

      let supabaseUserId: string;

      if (existingUser) {
        console.log(`  ⚠️  Already exists in Supabase (ID: ${existingUser.id})`);
        supabaseUserId = existingUser.id;

        // Update password to ensure it matches (with retry)
        await withRetry(
          () =>
            supabaseAdmin.auth.admin.updateUserById(supabaseUserId, {
              password: userData.password,
              email_confirm: true,
            }),
          `updateUser ${userData.email}`
        );
        console.log(`  ✅ Password updated in Supabase`);
      } else {
        // 3. Create user in Supabase Auth (with retry for transient failures)
        const { data: authData, error: authError } = await withRetry(
          () =>
            supabaseAdmin.auth.admin.createUser({
              email: userData.email,
              password: userData.password,
              email_confirm: true,
              user_metadata: {
                full_name: `${userData.firstName} ${userData.lastName}`,
                first_name: userData.firstName,
                last_name: userData.lastName,
              },
            }),
          `createUser ${userData.email}`
        );

        if (authError || !authData.user) {
          console.error(`  ❌ Supabase error: ${authError?.message}`);
          createdUsers.push({
            email: userData.email,
            password: userData.password,
            role: userData.role,
            orgRole: USER_ORG_ROLES[userData.email] || 'MEMBER',
            status: 'FAILED',
          });
          continue;
        }

        supabaseUserId = authData.user.id;
        console.log(`  ✅ Created in Supabase (ID: ${supabaseUserId})`);
      }

      // 4. Upsert in Prisma with HASHED PASSWORD (with retry for transient failures)
      const prismaUser = await withRetry(
        () =>
          prisma.user.upsert({
            where: { email: userData.email },
            update: {
              supabaseUserId,
              password: hashedPassword, // Store bcrypt hash for TEST MODE
              role: userData.role,
              emailVerified: true,
              isActive: true,
              organizationId: orgId,
            },
            create: {
              email: userData.email,
              password: hashedPassword, // Store bcrypt hash for TEST MODE
              firstName: userData.firstName,
              lastName: userData.lastName,
              role: userData.role,
              emailVerified: true,
              isActive: true,
              supabaseUserId,
              organizationId: orgId,
            },
          }),
        `upsert user ${userData.email}`
      );

      console.log(`  ✅ Synced to Prisma (ID: ${prismaUser.id})`);
      console.log(`  ✅ Password hash: ${hashedPassword.substring(0, 20)}...`);

      // 5. Create organization membership
      await createMembership(prismaUser.id, orgId, userData.email);

      console.log('');
      createdUsers.push({
        email: userData.email,
        password: userData.password,
        role: userData.role,
        orgRole: USER_ORG_ROLES[userData.email] || 'MEMBER',
        status: 'OK',
      });
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}\n`);
      createdUsers.push({
        email: userData.email,
        password: userData.password,
        role: userData.role,
        orgRole: USER_ORG_ROLES[userData.email] || 'MEMBER',
        status: 'ERROR',
      });
    }
  }

  console.log('\n📋 E2E Test Credentials:\n');
  console.log('┌─────────────────────────────────┬──────────────────────┬────────┬────────┬────────┐');
  console.log('│ Email                           │ Password             │ Role   │ OrgRole│ Status │');
  console.log('├─────────────────────────────────┼──────────────────────┼────────┼────────┼────────┤');
  createdUsers.forEach((user) => {
    console.log(
      `│ ${user.email.padEnd(31)} │ ${user.password.padEnd(20)} │ ${user.role.padEnd(6)} │ ${user.orgRole.padEnd(6)} │ ${user.status.padEnd(6)} │`
    );
  });
  console.log('└─────────────────────────────────┴──────────────────────┴────────┴────────┴────────┘');

  // Run verification to ensure data is correct
  await verifySeedData();

  console.log('💡 Run E2E tests with:');
  console.log('   cd quikadmin-web && bun run test:e2e:auto\n');

  await prisma.$disconnect();
}

seedE2EUsers().catch((error) => {
  console.error('❌ Error seeding E2E users:', error);
  prisma.$disconnect();
  process.exit(1);
});
