# PRD: E2E Infrastructure Critical Fix - Password Hashing and Organization Context

**Version:** 1.0.0
**Status:** P0 CRITICAL
**Author:** AI PRD Specialist
**Created:** 2026-01-09
**Priority:** CRITICAL - All E2E tests blocked

---

## Executive Summary

### Problem Statement

All E2E authentication tests are failing due to a critical bug in the seed script: test user passwords are stored as empty strings in the Prisma database, but TEST MODE authentication validates passwords via bcrypt comparison. This causes 100% authentication failure rate for all seeded test users.

### Solution Overview

Fix the seed script to properly hash passwords with bcrypt before storing in Prisma, create a test organization with proper memberships, and add verification steps to ensure data integrity before tests run.

### Business Impact

- **Current State:** 100% E2E auth test failure rate
- **Target State:** Reliable E2E authentication enabling full test suite execution
- **Blocked Work:** All tests requiring authentication (security, documents, profiles, organization)
- **Timeline:** P0 - Must be fixed before any other E2E work proceeds

### Resource Requirements

- Backend developer: 2-4 hours implementation
- QA validation: 1-2 hours verification
- No infrastructure changes required

### Risk Assessment

- **Low Risk:** Change is localized to seed script
- **No Production Impact:** Seed script only runs in E2E/test environments
- **Rollback:** Simple - revert seed script changes if issues arise

---

## Root Cause Analysis

### The Authentication Flow in TEST MODE

When `E2E_TEST_MODE=true` or `NODE_ENV=test`, the backend bypasses Supabase and authenticates directly against Prisma/bcrypt:

```typescript
// From supabase-auth.routes.ts lines 428-462
if (isTestMode) {
  logger.info('[TEST MODE] Authenticating via Prisma/bcrypt', { email });

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, password: true, ... },
  });

  if (!user) {
    logger.warn('[TEST MODE] User not found', { email });
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // CRITICAL: This compares input password against stored hash
  const passwordValid = await bcrypt.compare(password, user.password);
  if (!passwordValid) {
    logger.warn('[TEST MODE] Invalid password', { email });
    return res.status(401).json({ error: 'Invalid email or password' });
  }
}
```

### The Bug: Empty Password Storage

The current seed script stores empty strings for passwords:

```typescript
// From seed-e2e-users.ts lines 109-127
const prismaUser = await prisma.user.upsert({
  where: { email: userData.email },
  update: { supabaseUserId, role: userData.role, ... },
  create: {
    email: userData.email,
    password: '', // <-- BUG: Empty string cannot match bcrypt comparison
    firstName: userData.firstName,
    ...
  },
});
```

### Why This Causes Failures

1. Seed script creates user with `password: ''`
2. E2E test attempts login with `password: 'TestAdmin123!'`
3. Backend runs `bcrypt.compare('TestAdmin123!', '')`
4. bcrypt returns `false` (empty string is not a valid bcrypt hash)
5. Auth returns 401 "Invalid email or password"
6. E2E test fails with `[TEST MODE] Invalid password`

### Missing Infrastructure Components

Beyond password hashing, the seed script also lacks:

1. **Test Organization:** Users need an organization context for multi-tenant features
2. **Organization Memberships:** Role-based access (OWNER/ADMIN/MEMBER/VIEWER) requires memberships
3. **Seed Verification:** No validation that users exist and are valid before tests run

---

## Product Overview

### Product Vision

Enable reliable, repeatable E2E testing by ensuring test data is properly seeded with all required relationships and valid authentication credentials.

### Target Users

- E2E test infrastructure (Playwright)
- CI/CD pipelines
- Developers running local E2E tests
- QA engineers validating features

### Value Proposition

- Tests will pass reliably without flaky authentication failures
- Developers can trust E2E test results
- CI/CD can gate deployments on E2E test success
- Security tests can properly validate role-based access

### Success Criteria

| Metric | Current | Target |
|--------|---------|--------|
| Auth test pass rate | 0% | 100% |
| Login fixture success | 0% | 100% |
| Role-based test coverage | Blocked | Full coverage |
| Seed script reliability | Broken | 100% |

### Assumptions

1. TEST MODE remains the intended auth mechanism for E2E tests
2. bcrypt version compatibility is maintained (currently bcrypt@5.1.1)
3. Test database is isolated from production
4. Supabase sync is optional for TEST MODE (users exist in Prisma only)

---

## Functional Requirements

### FR-001: Password Hashing in Seed Script

**Priority:** P0 CRITICAL

**Description:** Hash all test user passwords with bcrypt before storing in Prisma.

**User Story:**
As the E2E test infrastructure, I need test users to have properly hashed passwords so that TEST MODE authentication succeeds.

**Acceptance Criteria:**
- Given a test user definition with plaintext password
- When the seed script creates/updates the user in Prisma
- Then the password field contains a valid bcrypt hash (prefix `$2b$` or `$2a$`)
- And bcrypt.compare(plaintext, hash) returns true

**Technical Requirements:**
```typescript
import bcrypt from 'bcrypt';

const BCRYPT_SALT_ROUNDS = 12; // Match auth routes

async function seedE2EUsers() {
  for (const userData of E2E_TEST_USERS) {
    // Hash password BEFORE database operations
    const hashedPassword = await bcrypt.hash(userData.password, BCRYPT_SALT_ROUNDS);

    const prismaUser = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        password: hashedPassword, // Use hash
        // ... other fields
      },
      create: {
        email: userData.email,
        password: hashedPassword, // Use hash
        // ... other fields
      },
    });
  }
}
```

### FR-002: Test Organization Creation

**Priority:** P0 CRITICAL

**Description:** Create a dedicated test organization for E2E test users.

**User Story:**
As the E2E test infrastructure, I need a test organization so that multi-tenant features can be tested and users have proper organization context.

**Acceptance Criteria:**
- Given the E2E test environment is being seeded
- When the seed script runs
- Then an organization with slug `e2e-test-org` exists
- And the organization has status ACTIVE
- And the organization ID is assigned to all test users

**Technical Requirements:**
```typescript
const E2E_TEST_ORG = {
  name: 'E2E Test Organization',
  slug: 'e2e-test-org',
  status: 'ACTIVE' as const,
  settings: { isTestOrg: true },
};

async function createTestOrganization(): Promise<string> {
  const org = await prisma.organization.upsert({
    where: { slug: E2E_TEST_ORG.slug },
    update: { name: E2E_TEST_ORG.name, status: E2E_TEST_ORG.status },
    create: E2E_TEST_ORG,
  });
  return org.id;
}
```

### FR-003: Organization Membership Creation

**Priority:** P0 CRITICAL

**Description:** Create organization memberships with appropriate roles for each test user.

**User Story:**
As the E2E test infrastructure, I need test users to have proper organization memberships with distinct roles so that role-based access control tests can validate OWNER/ADMIN/MEMBER/VIEWER permissions.

**Acceptance Criteria:**
- Given test users exist in the database
- When the seed script assigns memberships
- Then each user has exactly one active membership to the test organization
- And test-owner@intellifill.local has role OWNER
- And test-admin@intellifill.local has role ADMIN
- And test-member@intellifill.local has role MEMBER
- And test-viewer@intellifill.local has role VIEWER
- And membership status is ACTIVE with joinedAt set

**Technical Requirements:**
```typescript
const USER_ORG_ROLES: Record<string, OrgMemberRole> = {
  'test-admin@intellifill.local': 'ADMIN',
  'test-owner@intellifill.local': 'OWNER',
  'test-member@intellifill.local': 'MEMBER',
  'test-viewer@intellifill.local': 'VIEWER',
  'test-password-reset@intellifill.local': 'MEMBER',
};

async function createMembership(userId: string, orgId: string, email: string) {
  const role = USER_ORG_ROLES[email] || 'MEMBER';

  await prisma.organizationMembership.upsert({
    where: { userId_organizationId: { userId, organizationId: orgId } },
    update: { role, status: 'ACTIVE' },
    create: {
      userId,
      organizationId: orgId,
      role,
      status: 'ACTIVE',
      joinedAt: new Date(),
    },
  });
}
```

### FR-004: Seed Verification Step

**Priority:** P1 HIGH

**Description:** Add verification that validates all seeded data before tests run.

**User Story:**
As the E2E test infrastructure, I need to verify that seeded data is correct so that test failures are due to code issues, not data setup issues.

**Acceptance Criteria:**
- Given the seed script has completed
- When verification runs
- Then all expected test users exist
- And all users have valid bcrypt password hashes
- And all users have organization memberships
- And verification fails fast with clear error message if data is invalid

**Technical Requirements:**
```typescript
async function verifySeedData(): Promise<void> {
  const errors: string[] = [];

  for (const userData of E2E_TEST_USERS) {
    const user = await prisma.user.findUnique({
      where: { email: userData.email },
      include: { memberships: true },
    });

    if (!user) {
      errors.push(`User not found: ${userData.email}`);
      continue;
    }

    // Verify password hash is valid bcrypt
    if (!user.password.startsWith('$2')) {
      errors.push(`Invalid password hash for ${userData.email}`);
    }

    // Verify membership exists
    if (user.memberships.length === 0) {
      errors.push(`No membership for ${userData.email}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Seed verification failed:\n${errors.join('\n')}`);
  }

  console.log('Seed verification passed');
}
```

### FR-005: Update test-users.json Sync

**Priority:** P1 HIGH

**Description:** Ensure test-users.json in frontend matches seed script users exactly.

**User Story:**
As the E2E test infrastructure, I need test user definitions to be synchronized between seed script and E2E fixtures so that credentials always match.

**Acceptance Criteria:**
- Given test-users.json defines test credentials
- When the seed script runs
- Then all users in test-users.json are created in the database
- And email/password combinations match exactly (case-insensitive email)
- And roles map correctly (OWNER in JSON maps to OWNER membership)

**Current test-users.json Analysis:**
```json
{
  "testUsers": {
    "admin": { "email": "test-admin@intellifill.local", "password": "TestAdmin123!", "role": "ADMIN" },
    "owner": { "email": "test-owner@intellifill.local", "password": "TestOwner123!", "role": "OWNER" },
    "member": { "email": "test-member@intellifill.local", "password": "TestMember123!", "role": "MEMBER" },
    "viewer": { "email": "test-viewer@intellifill.local", "password": "TestViewer123!", "role": "VIEWER" },
    "newUser": { "email": "test-new-user@intellifill.local", "password": "TestNewUser123!", "role": "MEMBER" },
    "passwordReset": { "email": "test-password-reset@intellifill.local", "password": "TestPasswordReset123!", "role": "MEMBER" }
  }
}
```

**Note:** `newUser` is for registration tests and should NOT be seeded (it tests creating new accounts).

---

## Non-Functional Requirements

### NFR-001: Performance

- Seed script should complete within 30 seconds
- Password hashing with 12 rounds takes ~100ms per user
- 5 users = ~500ms hashing time (acceptable)

### NFR-002: Idempotency

- Seed script must be safely re-runnable
- Use upsert operations for all creates
- Running twice should produce identical results

### NFR-003: Security

- Password hashes use bcrypt with 12 salt rounds (matches production)
- No plaintext passwords logged
- Test database isolation from production

### NFR-004: Reliability

- Clear error messages on failure
- Verification step catches data issues early
- Atomic operations where possible

### NFR-005: Maintainability

- Single source of truth for test user definitions
- Clear mapping between test roles and database roles
- Easy to add new test users

---

## Technical Considerations

### Architecture Overview

```
E2E Test Flow:
1. run-e2e-automated.js starts
2. Calls seed-e2e-users.ts
   a. Create/update test organization
   b. Hash passwords with bcrypt
   c. Create/update test users with hashed passwords
   d. Create organization memberships
   e. Verify seeded data
3. Playwright global.setup.ts runs
   a. Health check
   b. (Optional) Verify users via API
4. Auth fixtures authenticate via UI
   a. Login page -> POST /api/auth/v2/login
   b. Backend uses bcrypt.compare() -> SUCCESS
5. Tests run with authenticated sessions
```

### Technology Stack

- **Database:** PostgreSQL (Neon) via Prisma
- **Password Hashing:** bcrypt@5.1.1
- **ORM:** Prisma@6.14
- **Testing:** Playwright

### Data Model Changes

No schema changes required. Existing models support all requirements:

- `User.password` - Store bcrypt hash (currently empty string)
- `User.organizationId` - Link to test organization
- `OrganizationMembership` - Role-based membership

### Integration Requirements

**Prisma Client:**
```typescript
import { prisma } from '../src/utils/prisma';
import { OrgMemberRole, MembershipStatus, OrganizationStatus } from '@prisma/client';
```

**bcrypt:**
```typescript
import bcrypt from 'bcrypt';
const SALT_ROUNDS = 12; // Same as auth routes
```

### Infrastructure Needs

None - uses existing database and dependencies.

---

## Implementation Plan

### Phase 1: Critical Fix (Day 1)

**Objective:** Make authentication work

1. Add bcrypt import and password hashing
2. Update upsert to use hashed password
3. Test locally with single user
4. Verify bcrypt.compare works

**Deliverable:** Login tests pass

### Phase 2: Organization Context (Day 1-2)

**Objective:** Enable multi-tenant tests

1. Create test organization
2. Update users with organizationId
3. Create organization memberships
4. Update seed script output table

**Deliverable:** Organization tests can run

### Phase 3: Verification (Day 2)

**Objective:** Prevent future seed issues

1. Add verification function
2. Call after seeding
3. Update global.setup.ts to surface errors
4. Document troubleshooting

**Deliverable:** Clear failure messages

### Phase 4: Documentation (Day 2-3)

**Objective:** Enable self-service debugging

1. Update E2E README
2. Add troubleshooting guide
3. Document seed script usage
4. Update CLAUDE.md files

**Deliverable:** Developer documentation

---

## Testing Verification Steps

### Manual Verification

1. **Run seed script:**
   ```bash
   cd quikadmin
   npx tsx scripts/seed-e2e-users.ts
   ```

2. **Verify in database:**
   ```sql
   SELECT email,
          LEFT(password, 10) as password_prefix,
          "organizationId"
   FROM users
   WHERE email LIKE 'test-%@intellifill.local';
   ```
   - Password should start with `$2b$12$` or `$2a$12$`
   - organizationId should be non-null

3. **Verify memberships:**
   ```sql
   SELECT u.email, om.role, om.status
   FROM organization_memberships om
   JOIN users u ON om."userId" = u.id
   WHERE u.email LIKE 'test-%@intellifill.local';
   ```

4. **Test login manually:**
   ```bash
   curl -X POST http://localhost:3002/api/auth/v2/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test-admin@intellifill.local","password":"TestAdmin123!"}'
   ```
   - Should return 200 with tokens

### Automated Verification

1. **Run E2E auth tests:**
   ```bash
   cd quikadmin-web
   bun run test:e2e -- --grep "login"
   ```

2. **Run full E2E suite:**
   ```bash
   bun run test:e2e:auto
   ```

### Success Criteria Checklist

- [ ] Seed script runs without errors
- [ ] All test users have bcrypt password hashes
- [ ] Test organization exists with correct slug
- [ ] All users have organization memberships
- [ ] bcrypt.compare validates passwords correctly
- [ ] Login E2E tests pass
- [ ] Session E2E tests pass
- [ ] Role-based E2E tests can run

---

## Appendix

### A. Current Seed Script State

File: `quikadmin/scripts/seed-e2e-users.ts`

**Issues:**
- Line 119: `password: ''` - Empty string stored
- No organization creation
- No membership creation
- No verification step

### B. Test User Role Mapping

| test-users.json Role | User.role (Prisma) | OrgMembership.role |
|---------------------|-------------------|-------------------|
| ADMIN | ADMIN | ADMIN |
| OWNER | ADMIN* | OWNER |
| MEMBER | USER | MEMBER |
| VIEWER | VIEWER | VIEWER |

*Note: User.role enum doesn't have OWNER, so ADMIN is used for User.role, but OrgMemberRole.OWNER is used for membership.

### C. Related Files

| File | Purpose |
|------|---------|
| `quikadmin/scripts/seed-e2e-users.ts` | Seed script (fix target) |
| `quikadmin-web/e2e/data/test-users.json` | Test credentials |
| `quikadmin-web/e2e/fixtures/auth.fixture.ts` | Auth fixtures |
| `quikadmin/src/api/supabase-auth.routes.ts` | TEST MODE auth (lines 428-545) |
| `quikadmin/prisma/schema.prisma` | Data model |

### D. Error Messages Reference

| Error | Cause | Fix |
|-------|-------|-----|
| `[TEST MODE] User not found` | User not in Prisma | Run seed script |
| `[TEST MODE] Invalid password` | Password empty or not hashed | Fix seed script hashing |
| `Auth failed for test-*@...` | Fixture login failure | Check seed + TEST MODE |
| `Timeout acquiring lock` | Auth mutex contention | Clear `.auth/*.lock` files |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-09 | AI PRD Specialist | Initial PRD creation |

---

**END OF PRD**
