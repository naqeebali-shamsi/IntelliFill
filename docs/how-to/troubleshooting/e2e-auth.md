---
title: E2E Authentication Troubleshooting
description: Troubleshoot and fix E2E test authentication failures
category: how-to
tags: [troubleshooting, e2e, testing, authentication, playwright]
lastUpdated: 2026-01-09
---

# E2E Authentication Troubleshooting

This guide helps you diagnose and fix authentication issues in E2E tests using Playwright.

---

## Prerequisites

Before running E2E tests, ensure these services are running:

### Required Services

| Service | URL | Start Command |
|---------|-----|---------------|
| Backend | http://localhost:3002 | `cd quikadmin && npm run dev` |
| Frontend | http://localhost:8080 | `cd quikadmin-web && bun run dev` |
| Database | PostgreSQL (Neon) | Cloud-hosted (automatic) |
| Redis | localhost:6379 | `docker run -d -p 6379:6379 redis:alpine` |

### Health Check

```bash
# Verify backend is running
curl http://localhost:3002/health

# Verify frontend is accessible
curl http://localhost:8080

# Check database connection
cd quikadmin && npx prisma studio
```

---

## Test Credentials

E2E tests use pre-seeded test users. These credentials are defined in `quikadmin-web/e2e/data/test-users.json`:

| User Type | Email | Password | Role |
|-----------|-------|----------|------|
| Admin | `test-admin@intellifill.local` | `TestAdmin123!` | ADMIN |
| Owner | `test-owner@intellifill.local` | `TestOwner123!` | OWNER |
| Member | `test-member@intellifill.local` | `TestMember123!` | MEMBER |
| Viewer | `test-viewer@intellifill.local` | `TestViewer123!` | VIEWER |
| New User | `test-new-user@intellifill.local` | `TestNewUser123!` | MEMBER |
| Password Reset | `test-password-reset@intellifill.local` | `TestPasswordReset123!` | MEMBER |

### Invalid Credentials (for negative tests)

| Scenario | Email | Password |
|----------|-------|----------|
| Wrong Password | `test-member@intellifill.local` | `WrongPassword123!` |
| Nonexistent User | `nonexistent-user@intellifill.local` | `AnyPassword123!` |
| Malformed Email | `not-an-email` | `TestPassword123!` |
| Weak Password | `test@intellifill.local` | `123` |

---

## Common Issues

### Issue 1: "Login failed" or "Invalid credentials"

**Symptoms**:
```
Error: Login failed for test-admin@intellifill.local
Invalid email or password
401 Unauthorized
```

**Causes**:
1. Test users not seeded in database
2. Password hashes are invalid or missing
3. TEST_MODE not enabled in backend

**Solutions**:

1. **Reseed E2E test users**:
   ```bash
   cd quikadmin && npx tsx scripts/seed-e2e-users.ts
   ```

   This script:
   - Creates users in Supabase Auth (if not exists)
   - Syncs users to Prisma database
   - Generates proper bcrypt password hashes
   - Creates organization memberships

2. **Verify seed succeeded**:
   ```bash
   # Check script output for:
   # ✅ Created in Supabase (ID: xxx)
   # ✅ Synced to Prisma (ID: xxx)
   # ✅ Password hash: $2b$12$xxx...
   # ✅ Seed verification PASSED
   ```

3. **Enable TEST_MODE** (for bcrypt authentication):
   ```env
   # quikadmin/.env
   TEST_MODE=true
   ```

---

### Issue 2: "User not found"

**Symptoms**:
```
User not found: test-admin@intellifill.local
No user with that email exists
```

**Causes**:
1. User exists in Supabase but not in Prisma (or vice versa)
2. Database was reset without reseeding
3. Different database being used than expected

**Solutions**:

1. **Check Prisma database**:
   ```bash
   cd quikadmin && npx prisma studio
   ```
   Navigate to the User table and search for `test-admin@intellifill.local`.

2. **Check Supabase users**:
   - Go to Supabase Dashboard > Authentication > Users
   - Search for `test-admin@intellifill.local`

3. **Verify database URL**:
   ```bash
   # quikadmin/.env
   # Ensure DATABASE_URL points to correct database
   echo $DATABASE_URL | head -c 50
   ```

4. **Resync by reseeding**:
   ```bash
   cd quikadmin && npx tsx scripts/seed-e2e-users.ts
   ```

---

### Issue 3: "Password mismatch"

**Symptoms**:
```
Password comparison failed
bcrypt.compare returned false
```

**Causes**:
1. Password stored as plaintext instead of bcrypt hash
2. Wrong salt rounds used during hashing
3. TEST_MODE not detecting bcrypt correctly

**Solutions**:

1. **Verify password hash format**:
   ```sql
   -- In Prisma Studio or psql
   SELECT email, LEFT(password, 20) as pwd_prefix
   FROM "User"
   WHERE email LIKE 'test-%';
   ```

   Valid bcrypt hashes start with `$2a$` or `$2b$`.

2. **Check salt rounds match** (should be 12):
   ```typescript
   // In seed script and auth routes
   const BCRYPT_SALT_ROUNDS = 12;
   ```

3. **Regenerate hashes by reseeding**:
   ```bash
   cd quikadmin && npx tsx scripts/seed-e2e-users.ts
   ```

---

### Issue 4: Storage State Expired

**Symptoms**:
```
JWT token expired
Authentication state invalid
Test passes locally but fails in CI
```

**Causes**:
1. Cached storage state files are stale
2. JWT expiration time too short
3. Storage state validation not working

**Solutions**:

1. **Clear cached auth states**:
   ```bash
   rm -rf quikadmin-web/e2e/.auth/
   ```

2. **Run tests fresh**:
   ```bash
   cd quikadmin-web && bun run test:e2e:auto
   ```

3. **Check storage state age** (default: 45 minutes validity):
   ```typescript
   // e2e/fixtures/auth.fixture.ts
   const MAX_STORAGE_STATE_AGE_MS = 45 * 60 * 1000;
   ```

---

### Issue 5: Parallel Test Conflicts

**Symptoms**:
```
Test A passes alone but fails when running with Test B
Race condition during login
Multiple workers creating same user
```

**Causes**:
1. Tests sharing state without proper isolation
2. Password changed by one test affecting another
3. Missing worker resource tracking

**Solutions**:

1. **Use per-worker resources**:
   ```typescript
   // Tests should use workerResources fixture
   test('my test', async ({ workerResources }) => {
     // Resources tracked per worker
   });
   ```

2. **Restore password after modification tests**:
   ```typescript
   // Use afterEach hooks in password change tests
   test.afterEach(async () => {
     await restoreUserPassword(email, originalPassword);
   });
   ```

3. **Run sequentially if needed**:
   ```bash
   bun run test:e2e -- --workers=1
   ```

---

### Issue 6: Database Connection Errors

**Symptoms**:
```
Connection terminated unexpectedly
Connection pool exhausted
Neon database timeout
```

**Solutions**:

1. **Wait for Neon cold start**:
   ```bash
   # Neon databases may take a few seconds on first connection
   sleep 5 && cd quikadmin && npm run dev
   ```

2. **Check connection pool settings**:
   ```typescript
   // prisma/schema.prisma should have connection pooling
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
     directUrl = env("DIRECT_URL")  // For migrations
   }
   ```

---

## Debug Commands

### Reseed Test Users

```bash
cd quikadmin && npx tsx scripts/seed-e2e-users.ts
```

### Check Database State

```bash
# Open Prisma Studio
cd quikadmin && npx prisma studio

# Or via SQL
psql $DATABASE_URL -c "SELECT email, LEFT(password, 10) as pwd_prefix, role FROM \"User\" WHERE email LIKE 'test-%';"
```

### Verify User Exists

```sql
-- Check user and password hash
SELECT
  email,
  LEFT(password, 20) as pwd_prefix,
  role,
  "emailVerified",
  "isActive"
FROM "User"
WHERE email = 'test-admin@intellifill.local';

-- Check organization membership
SELECT
  u.email,
  m.role as org_role,
  m.status,
  o.name as org_name
FROM "User" u
JOIN "OrganizationMembership" m ON u.id = m."userId"
JOIN "Organization" o ON m."organizationId" = o.id
WHERE u.email LIKE 'test-%';
```

### Test Login Manually

```bash
# Test backend login endpoint
curl -X POST http://localhost:3002/api/auth/v2/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test-admin@intellifill.local","password":"TestAdmin123!"}'
```

### Clear Auth Cache

```bash
rm -rf quikadmin-web/e2e/.auth/
```

### Run E2E Tests

```bash
# Full automated suite (seeds + runs)
cd quikadmin-web && bun run test:e2e:auto

# Interactive mode
cd quikadmin-web && bun run test:e2e:ui

# Debug mode with headed browser
cd quikadmin-web && bun run test:e2e:debug

# Single test file
cd quikadmin-web && bun run test:e2e -- tests/auth/login.spec.ts
```

---

## Quick Fixes Checklist

Use this checklist when E2E auth tests fail:

- [ ] Backend running on port 3002?
- [ ] Frontend running on port 8080?
- [ ] Test users seeded? (`npx tsx scripts/seed-e2e-users.ts`)
- [ ] `TEST_MODE=true` in backend `.env`?
- [ ] Database accessible? (`npx prisma studio`)
- [ ] Auth cache cleared? (`rm -rf e2e/.auth/`)
- [ ] Correct database URL in `.env`?
- [ ] Password hashes valid (start with `$2a$` or `$2b$`)?
- [ ] Organization membership exists for test users?

---

## E2E Architecture Overview

Understanding the test architecture helps with debugging:

### Project Dependencies

```
setup → chromium-* → cleanup
         ↓
    browser tests
```

1. **Setup project** (`global.setup.ts`): API health check, user verification
2. **Browser projects**: Run actual tests (depend on setup)
3. **Cleanup project** (`global.teardown.ts`): Logout, clear auth, database cleanup

### Storage State Flow

1. Check if valid state exists (file age + JWT expiration)
2. Acquire mutex lock (atomic file creation)
3. Double-check after lock (another worker may have created)
4. Login and save state OR reuse existing valid state

### File Structure

```
e2e/
├── global.setup.ts       # Health check, user verification
├── global.teardown.ts    # Cleanup after all tests
├── fixtures/
│   ├── auth.fixture.ts   # Auth with mutex + JWT validation
│   └── org.fixture.ts    # Per-worker resource tracking
├── helpers/
│   ├── supabase.helper.ts # Password restoration
│   └── api.helper.ts     # API utilities
├── tests/
│   └── auth/
│       └── login.spec.ts # Auth tests
├── data/
│   └── test-users.json   # Test credentials
└── .auth/                # Cached storage states (gitignored)
```

---

## Related Documentation

- [General Auth Issues](./auth-issues.md)
- [E2E Testing Architecture](../../../quikadmin-web/CLAUDE.md#e2e-testing-architecture)
- [Local Development Setup](../development/local-setup.md)
- [Test Users JSON](../../../quikadmin-web/e2e/data/test-users.json)
- [Seed Script](../../../quikadmin/scripts/seed-e2e-users.ts)
