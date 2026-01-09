# PRD: E2E Test Architecture Fixes
Generated: 2026-01-09
Version: 1.0

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [User Stories](#4-user-stories)
5. [Technical Architecture](#5-technical-architecture)
6. [Implementation Tasks](#6-implementation-tasks)
7. [Test Strategy](#7-test-strategy)
8. [Dependencies & Integration Points](#8-dependencies--integration-points)
9. [Risks & Mitigations](#9-risks--mitigations)
10. [Rollout Plan](#10-rollout-plan)
11. [Appendices](#11-appendices)

---

## 1. Executive Summary

### Background
The IntelliFill E2E test suite, built on Playwright, suffers from critical architectural flaws identified by a 6-member expert panel. These issues cause test flakiness, resource leaks, cross-platform failures, and cascading authentication errors.

### Problem Impact
- **Test Reliability**: Approximately 30% of test runs fail due to race conditions and state pollution
- **Resource Leaks**: Database accumulates orphaned test data (organizations, documents) indefinitely
- **Platform Compatibility**: Tests fail entirely on Windows due to binary path resolution issues
- **Developer Experience**: Silent auth failures produce cryptic 401 errors instead of actionable error messages

### Solution Overview
This PRD outlines fixes for 8 architectural issues across 3 priority levels (P0, P1, P2), requiring approximately 21 hours of implementation effort. The fixes introduce:
- Project dependency-based setup/teardown pattern
- Per-worker resource isolation
- Platform-aware binary resolution
- JWT-based token validation
- Fail-fast authentication patterns

---

## 2. Problem Statement

### Expert Panel Findings Summary

| Priority | Issue | Severity | Root Cause |
|----------|-------|----------|------------|
| P0 | Global cleanup never executed | CRITICAL | `globalTeardown: undefined` in config |
| P0 | Password reset pollutes shared user | CRITICAL | Test changes Supabase password, never restores |
| P0 | Silent auth fixture failures | CRITICAL | Returns `null` instead of throwing |
| P1 | Race condition on global arrays | HIGH | Shared mutable state across parallel workers |
| P1 | Windows path issues | HIGH | Missing `.cmd` extension for Windows binaries |
| P1 | Storage state TOCTOU | HIGH | Multiple workers race to create auth files |
| P2 | Token expiry not validated | MEDIUM | File age check ignores JWT `exp` claim |
| P2 | Viewport explosion | MEDIUM | 5 viewport projects create excessive test matrix |

### Affected Files

| File | Issues |
|------|--------|
| `quikadmin-web/playwright.config.ts` | P0 (cleanup), P2 (viewports) |
| `quikadmin-web/e2e/fixtures/auth.fixture.ts` | P0 (silent failures), P1 (TOCTOU), P2 (token expiry) |
| `quikadmin-web/e2e/fixtures/org.fixture.ts` | P0 (cleanup), P1 (race conditions) |
| `quikadmin-web/e2e/tests/auth/login.spec.ts` | P0 (password pollution) |
| `quikadmin-web/scripts/run-e2e-automated.js` | P1 (Windows paths) |
| `quikadmin/scripts/seed-e2e-users.ts` | Related (password management) |

---

## 3. Goals & Success Metrics

### Primary Goals

1. **Eliminate Test Pollution**: Tests must run in complete isolation with zero shared mutable state between workers
2. **Ensure Cleanup Reliability**: 100% of test-created resources must be cleaned up after each test run
3. **Cross-Platform Support**: Tests must pass on Windows, macOS, and Linux
4. **Fail-Fast Authentication**: Auth failures must produce immediate, actionable errors

### Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Test flakiness rate | ~30% | <5% | Track retries in CI over 20 runs |
| Orphaned resources after run | Unbounded | 0 | Query `test-e2e-*` prefixed data after runs |
| Windows test pass rate | 0% | 100% | CI matrix includes Windows runner |
| Auth failure debugging time | 15+ minutes | <2 minutes | Error message contains user email and failure reason |
| Test run duration (5 viewports) | ~8 minutes | ~4 minutes | CI timing metrics |

### Definition of Done

- [ ] All P0 issues resolved and verified
- [ ] All P1 issues resolved and verified
- [ ] All P2 issues resolved and verified
- [ ] Tests pass on Windows, macOS, and Linux
- [ ] No orphaned test data after 10 consecutive runs
- [ ] Documentation updated (testing guide, CLAUDE.md)
- [ ] CI configuration updated

---

## 4. User Stories

### US-001: QA Engineer - Reliable Test Runs
**As a** QA Engineer
**I want** E2E tests to run reliably without flaky failures
**So that** I can trust test results and identify real regressions

**Acceptance Criteria:**
- [ ] Tests pass consistently across 10 consecutive runs
- [ ] No test failures due to race conditions
- [ ] Clear error messages when tests fail

### US-002: Developer - Cross-Platform Development
**As a** Developer on Windows
**I want** to run E2E tests locally
**So that** I can verify my changes before pushing

**Acceptance Criteria:**
- [ ] `bun run test:e2e:auto` succeeds on Windows
- [ ] `bun run test:e2e:auto` succeeds on macOS
- [ ] Path resolution works correctly on all platforms

### US-003: CI/CD Pipeline - Clean State
**As a** CI/CD Pipeline
**I want** test runs to clean up after themselves
**So that** subsequent runs don't inherit stale data

**Acceptance Criteria:**
- [ ] Global teardown executes after every test run
- [ ] All organizations created during tests are deleted
- [ ] All documents created during tests are deleted
- [ ] Storage state files are cleaned up

### US-004: Developer - Quick Auth Debugging
**As a** Developer debugging test failures
**I want** clear authentication error messages
**So that** I can quickly identify and fix issues

**Acceptance Criteria:**
- [ ] Auth failures throw errors instead of returning null
- [ ] Error messages include user email and failure reason
- [ ] Token expiry issues are clearly identified

### US-005: DevOps - Efficient CI Resources
**As a** DevOps Engineer
**I want** reasonable test parallelization
**So that** CI resources are used efficiently

**Acceptance Criteria:**
- [ ] Viewport projects reduced to 2-3 for CI
- [ ] Full viewport matrix available via configuration
- [ ] Test duration reduced by ~50%

---

## 5. Technical Architecture

### 5.1 Project Dependencies Pattern

Replace `globalSetup`/`globalTeardown` with Playwright's project dependencies pattern for better reliability and feature support.

```typescript
// playwright.config.ts - New structure
export default defineConfig({
  projects: [
    // Setup project - runs first
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
      teardown: 'cleanup',
    },
    // Cleanup project - runs after all tests
    {
      name: 'cleanup',
      testMatch: /global\.teardown\.ts/,
    },
    // Browser projects depend on setup
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
      dependencies: ['setup'],
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
    },
  ],
});
```

### 5.2 Per-Worker Resource Isolation

Replace global arrays with worker-scoped resource tracking using `workerInfo.workerIndex`.

```typescript
// org.fixture.ts - Worker-isolated resource tracking
import { test as base } from '@playwright/test';

// Type for worker-scoped resources
interface WorkerResources {
  organizations: string[];
  documents: string[];
}

// Worker-scoped fixture for resource tracking
export const test = base.extend<{}, { workerResources: WorkerResources }>({
  workerResources: [async ({}, use, workerInfo) => {
    const resources: WorkerResources = {
      organizations: [],
      documents: [],
    };

    console.log(`[Worker ${workerInfo.workerIndex}] Starting with clean resource tracking`);

    await use(resources);

    // Cleanup worker-specific resources
    console.log(`[Worker ${workerInfo.workerIndex}] Cleaning up ${resources.organizations.length} orgs, ${resources.documents.length} docs`);
    await cleanupWorkerResources(resources);
  }, { scope: 'worker' }],
});
```

### 5.3 Fail-Fast Authentication

Replace silent `null` returns with thrown errors that include context.

```typescript
// auth.fixture.ts - Fail-fast pattern
async function authenticateUser(
  page: Page,
  email: string,
  password: string,
  storagePath: string
): Promise<AuthTokens> {  // Note: No longer returns null
  try {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login({ email, password });
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    await page.context().storageState({ path: storagePath });

    // Extract tokens...
    return tokens;
  } catch (error) {
    // THROW instead of return null
    throw new Error(
      `Auth fixture failed for ${email}: ${error instanceof Error ? error.message : String(error)}\n` +
      `Storage path: ${storagePath}\n` +
      `Hint: Ensure test users are seeded (npm run seed:e2e)`
    );
  }
}
```

### 5.4 JWT Expiry Validation

Decode and validate JWT `exp` claim instead of relying solely on file age.

```typescript
// auth.fixture.ts - JWT validation
function isStorageStateValid(storagePath: string, maxAgeMs: number = 30 * 60 * 1000): boolean {
  if (!fs.existsSync(storagePath)) {
    return false;
  }

  // Check file age
  const stats = fs.statSync(storagePath);
  const fileAge = Date.now() - stats.mtimeMs;
  if (fileAge >= maxAgeMs) {
    return false;
  }

  // Check JWT expiry
  try {
    const storageState = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
    const accessToken = extractAccessToken(storageState);

    if (accessToken) {
      const payload = decodeJwtPayload(accessToken);
      const expMs = payload.exp * 1000;
      const bufferMs = 60 * 1000; // 1 minute buffer

      if (Date.now() + bufferMs >= expMs) {
        console.log(`Storage state JWT expired or expiring soon: ${storagePath}`);
        return false;
      }
    }
  } catch (error) {
    console.warn(`Could not validate JWT in storage state: ${error}`);
    return false;
  }

  return true;
}

function decodeJwtPayload(token: string): { exp: number; [key: string]: unknown } {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
  return JSON.parse(payload);
}
```

### 5.5 Storage State Mutex

Implement file-based mutex to prevent TOCTOU race conditions.

```typescript
// auth.fixture.ts - Mutex pattern
import { promises as fs } from 'fs';

async function acquireStorageStateLock(storagePath: string, timeoutMs: number = 30000): Promise<() => Promise<void>> {
  const lockPath = `${storagePath}.lock`;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Attempt atomic file creation
      await fs.writeFile(lockPath, String(process.pid), { flag: 'wx' });

      // Lock acquired - return release function
      return async () => {
        try {
          await fs.unlink(lockPath);
        } catch {
          // Ignore unlock errors
        }
      };
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
      // Lock exists, wait and retry
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  throw new Error(`Timeout acquiring lock for ${storagePath}`);
}
```

### 5.6 Windows Path Resolution

Platform-aware binary resolution with `.cmd` extension.

```typescript
// run-e2e-automated.js - Windows support
const isWindows = process.platform === 'win32';
const binExtension = isWindows ? '.cmd' : '';

function resolveBinary(name: string): string {
  return path.resolve(__dirname, `../node_modules/.bin/${name}${binExtension}`);
}

// Usage
const playwrightCli = resolveBinary('playwright');
```

### 5.7 Password Reset Test Isolation

Use dedicated test user and restore password after test.

```typescript
// login.spec.ts - Password reset isolation
import { supabaseAdmin } from '../helpers/supabase.helper';
import { testUsers } from '../data';

test.describe('E2E-011: Password Reset Flow', () => {
  const passwordResetUser = testUsers.testUsers.passwordReset;
  const originalPassword = passwordResetUser.password;

  test.afterEach(async () => {
    // Restore original password after each test
    try {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      const user = users?.users?.find(u => u.email === passwordResetUser.email);

      if (user) {
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
          password: originalPassword,
        });
        console.log(`Restored password for ${passwordResetUser.email}`);
      }
    } catch (error) {
      console.error(`Failed to restore password: ${error}`);
    }
  });

  // ... tests
});
```

### 5.8 Architecture Diagram

```
                    +-----------------+
                    |  playwright.    |
                    |  config.ts      |
                    +--------+--------+
                             |
              +--------------+--------------+
              |              |              |
       +------v------+ +-----v------+ +-----v------+
       |   setup     | |  chromium  | |  chromium  |
       | (global.    | |  desktop   | |  mobile    |
       |  setup.ts)  | +-----+------+ +-----+------+
       +------+------+       |              |
              |              |              |
              |    +---------+---------+    |
              |    |  Worker Isolation |    |
              |    |  (workerResources)|    |
              |    +---------+---------+    |
              |              |              |
              |    +---------v---------+    |
              |    |   auth.fixture    |    |
              |    | - JWT validation  |    |
              |    | - Mutex locks     |    |
              |    | - Fail-fast       |    |
              |    +-------------------+    |
              |                             |
       +------v------+                      |
       |   cleanup   |<---------------------+
       | (global.    |
       |  teardown)  |
       +-------------+
```

---

## 6. Implementation Tasks

### Phase 1: P0 - Critical Issues (3.5 hours)

#### TASK-001: Implement Global Teardown via Project Dependencies
**Type**: Configuration
**Effort**: 2 hours
**Dependencies**: None
**Assigned**: QA/DevOps

**Description**:
Replace `undefined` globalTeardown with Playwright's project dependencies pattern. Create setup and cleanup projects that run before/after all tests.

**Files to Create**:
- `quikadmin-web/e2e/global.setup.ts`
- `quikadmin-web/e2e/global.teardown.ts`

**Files to Modify**:
- `quikadmin-web/playwright.config.ts`

**Implementation Details**:

```typescript
// e2e/global.setup.ts
import { test as setup, expect } from '@playwright/test';
import { ApiHelper } from './helpers/api.helper';

setup('verify API health', async ({}) => {
  const api = new ApiHelper();
  await api.init();

  try {
    const health = await api.checkHealth();
    expect(health.status).toBe('ok');
    console.log('[Global Setup] API health check passed');
  } finally {
    await api.dispose();
  }
});

setup('seed test users', async ({}) => {
  // Seed script is called by run-e2e-automated.js,
  // but we verify users exist here
  console.log('[Global Setup] Verifying test users exist');
  // ... verification logic
});
```

```typescript
// e2e/global.teardown.ts
import { test as teardown } from '@playwright/test';
import { globalCleanup } from './fixtures/org.fixture';
import { clearAuthStates } from './fixtures/auth.fixture';

teardown('cleanup test resources', async ({}) => {
  console.log('[Global Teardown] Starting cleanup...');

  // Clear auth states
  clearAuthStates();
  console.log('[Global Teardown] Auth states cleared');

  // Cleanup organizations and documents
  await globalCleanup();
  console.log('[Global Teardown] Database resources cleaned');
});
```

**Acceptance Criteria**:
- [ ] Setup project runs before all test projects
- [ ] Cleanup project runs after all test projects complete
- [ ] `globalCleanup()` function is called and completes successfully
- [ ] Auth states are cleared after test run

---

#### TASK-002: Fix Silent Auth Fixture Failures
**Type**: Bug Fix
**Effort**: 30 minutes
**Dependencies**: None
**Assigned**: Frontend

**Description**:
Modify `authenticateUser()` to throw errors instead of returning `null`. Include contextual information in error messages.

**Files to Modify**:
- `quikadmin-web/e2e/fixtures/auth.fixture.ts`

**Implementation Details**:

```typescript
// Current (problematic):
async function authenticateUser(...): Promise<AuthTokens | null> {
  try {
    // ... auth logic
  } catch (error) {
    console.error(`Failed to authenticate user ${email}:`, error);
    return null;  // PROBLEM: Silent failure
  }
}

// Fixed:
async function authenticateUser(...): Promise<AuthTokens> {
  try {
    // ... auth logic
    return tokens;
  } catch (error) {
    throw new Error(
      `[Auth Fixture] Authentication failed for ${email}\n` +
      `Reason: ${error instanceof Error ? error.message : String(error)}\n` +
      `Storage Path: ${storagePath}\n` +
      `Troubleshooting:\n` +
      `  1. Ensure test users are seeded: npm run seed:e2e\n` +
      `  2. Check backend is running: curl http://localhost:3002/health\n` +
      `  3. Verify credentials in quikadmin-web/e2e/data/test-users.json`
    );
  }
}
```

**Acceptance Criteria**:
- [ ] `authenticateUser()` throws on failure instead of returning null
- [ ] Error messages include user email
- [ ] Error messages include troubleshooting hints
- [ ] All fixture usages handle thrown errors (no null checks needed)

---

#### TASK-003: Isolate Password Reset Tests
**Type**: Bug Fix
**Effort**: 1 hour
**Dependencies**: None
**Assigned**: QA

**Description**:
Add `afterEach` hook to password reset tests to restore original password via Supabase Admin API.

**Files to Create**:
- `quikadmin-web/e2e/helpers/supabase.helper.ts`

**Files to Modify**:
- `quikadmin-web/e2e/tests/auth/login.spec.ts`

**Implementation Details**:

```typescript
// e2e/helpers/supabase.helper.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('[Supabase Helper] Missing Supabase credentials - password restoration will fail');
}

export const supabaseAdmin = createClient(supabaseUrl || '', supabaseServiceKey || '', {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function restoreUserPassword(email: string, password: string): Promise<void> {
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const user = users?.users?.find(u => u.email === email);

  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password });

  if (error) {
    throw new Error(`Failed to restore password for ${email}: ${error.message}`);
  }
}
```

```typescript
// login.spec.ts - Add afterEach
import { restoreUserPassword } from '../../helpers/supabase.helper';
import { testUsers } from '../../data';

const passwordResetUser = testUsers.testUsers.passwordReset;

test.afterEach(async () => {
  await restoreUserPassword(passwordResetUser.email, passwordResetUser.password);
});
```

**Acceptance Criteria**:
- [ ] Password is restored after each password reset test
- [ ] Subsequent test runs don't fail due to changed passwords
- [ ] Supabase helper is properly initialized with service role key

---

### Phase 2: P1 - High Priority Issues (7 hours)

#### TASK-004: Implement Per-Worker Resource Tracking
**Type**: Refactor
**Effort**: 4 hours
**Dependencies**: TASK-001
**Assigned**: QA

**Description**:
Replace global `createdOrganizations[]` and `createdDocuments[]` arrays with worker-scoped fixtures using `workerInfo.workerIndex`.

**Files to Modify**:
- `quikadmin-web/e2e/fixtures/org.fixture.ts`

**Implementation Details**:

```typescript
// org.fixture.ts - Complete refactor

import { test as authTest, AuthFixtures } from './auth.fixture';
import { ApiHelper, TestOrganization, TestDocument, generateTestId, TEST_PREFIX } from '../helpers/api.helper';

// Worker-scoped resource tracking
interface WorkerResources {
  organizations: string[];
  documents: string[];
  workerId: number;
}

// Worker-scoped fixture
export const test = authTest.extend<OrgFixtures, { workerResources: WorkerResources }>({
  // Worker-scoped resource tracking
  workerResources: [async ({}, use, workerInfo) => {
    const resources: WorkerResources = {
      organizations: [],
      documents: [],
      workerId: workerInfo.workerIndex,
    };

    console.log(`[Worker ${workerInfo.workerIndex}] Initialized resource tracking`);

    await use(resources);

    // Worker cleanup
    console.log(`[Worker ${workerInfo.workerIndex}] Cleaning up: ${resources.organizations.length} orgs, ${resources.documents.length} docs`);

    const api = new ApiHelper();
    await api.init();

    for (const docId of resources.documents) {
      try {
        await api.deleteDocument(docId);
      } catch (error) {
        console.warn(`[Worker ${workerInfo.workerIndex}] Failed to delete doc ${docId}:`, error);
      }
    }

    for (const orgId of resources.organizations) {
      try {
        await api.deleteOrganization(orgId);
      } catch (error) {
        console.warn(`[Worker ${workerInfo.workerIndex}] Failed to delete org ${orgId}:`, error);
      }
    }

    await api.dispose();
  }, { scope: 'worker' }],

  // Test organization fixture uses worker resources
  testOrganization: async ({ authenticatedApi, workerResources }, use) => {
    const testId = generateTestId();
    const orgName = `Test Org W${workerResources.workerId}-${testId.slice(-8)}`;

    let organization: TestOrganization;

    try {
      organization = await authenticatedApi.createOrganization(orgName);
      workerResources.organizations.push(organization.id);
    } catch (error) {
      console.warn('Could not create test organization:', error);
      organization = {
        id: `mock-org-${testId}`,
        name: orgName,
        slug: `${TEST_PREFIX}-${testId.slice(-8)}`,
      };
    }

    const cleanup = async () => {
      if (!organization.id.startsWith('mock-')) {
        try {
          await authenticatedApi.deleteOrganization(organization.id);
          const idx = workerResources.organizations.indexOf(organization.id);
          if (idx > -1) workerResources.organizations.splice(idx, 1);
        } catch (error) {
          console.warn(`Failed to cleanup organization ${organization.id}:`, error);
        }
      }
    };

    await use({ organization, cleanup });
    await cleanup();
  },

  // ... similar updates for other fixtures
});
```

**Acceptance Criteria**:
- [ ] No global arrays for resource tracking
- [ ] Each worker has isolated resource lists
- [ ] Worker cleanup logs include worker index
- [ ] Parallel test runs don't interfere with each other

---

#### TASK-005: Fix Windows Binary Path Resolution
**Type**: Bug Fix
**Effort**: 1 hour
**Dependencies**: None
**Assigned**: DevOps

**Description**:
Add platform detection and `.cmd` extension handling for Windows binary resolution in `run-e2e-automated.js`.

**Files to Modify**:
- `quikadmin-web/scripts/run-e2e-automated.js`

**Implementation Details**:

```javascript
// run-e2e-automated.js

const path = require('path');

// Platform detection
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

/**
 * Resolve a binary path with platform-specific extension
 * @param {string} binName - Binary name without extension
 * @returns {string} Full path to binary
 */
function resolveBinary(binName) {
  const extension = isWindows ? '.cmd' : '';
  const binPath = path.resolve(__dirname, `../node_modules/.bin/${binName}${extension}`);

  // Log for debugging
  log(`Resolved ${binName} to: ${binPath}`, COLORS.cyan);

  return binPath;
}

// Updated runPlaywrightTests function
async function runPlaywrightTests(extraArgs = []) {
  logStep(4, 'Running Playwright E2E tests...');

  log(`Platform: ${process.platform} (Windows: ${isWindows})`, COLORS.cyan);
  log('Playwright will automatically start frontend & backend servers.', COLORS.cyan);
  log('This may take a minute on first run...\n', COLORS.cyan);

  return new Promise((resolve, reject) => {
    const playwrightCli = resolveBinary('playwright');
    const args = ['test', ...extraArgs];

    // Use shell: true on Windows for proper .cmd execution
    const testProcess = spawn(playwrightCli, args, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      shell: isWindows,  // Only use shell on Windows
      env: { ...process.env, FORCE_COLOR: '1' },
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        log('\nAll E2E tests passed!', COLORS.green);
        resolve();
      } else {
        log(`\nE2E tests failed with code ${code}`, COLORS.red);
        reject(new Error(`Tests exited with code ${code}`));
      }
    });

    testProcess.on('error', (err) => {
      log(`\nTest error: ${err.message}`, COLORS.red);
      if (isWindows && err.message.includes('ENOENT')) {
        log('Windows hint: Ensure Node.js and npm are in your PATH', COLORS.yellow);
      }
      reject(err);
    });
  });
}
```

**Acceptance Criteria**:
- [ ] Tests run successfully on Windows
- [ ] Tests run successfully on macOS
- [ ] Tests run successfully on Linux
- [ ] Platform detection is logged for debugging

---

#### TASK-006: Fix Storage State TOCTOU Race Condition
**Type**: Bug Fix
**Effort**: 2 hours
**Dependencies**: TASK-002
**Assigned**: QA

**Description**:
Implement file-based mutex to prevent multiple workers from simultaneously creating storage state files.

**Files to Modify**:
- `quikadmin-web/e2e/fixtures/auth.fixture.ts`

**Implementation Details**:

```typescript
// auth.fixture.ts - Add mutex utilities

import { promises as fsPromises } from 'fs';
import * as fs from 'fs';

/**
 * File-based mutex for storage state creation
 */
async function withStorageStateLock<T>(
  storagePath: string,
  operation: () => Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  const lockPath = `${storagePath}.lock`;
  const startTime = Date.now();
  let lockAcquired = false;

  // Acquire lock
  while (Date.now() - startTime < timeoutMs) {
    try {
      // Atomic file creation
      await fsPromises.writeFile(lockPath, `${process.pid}-${Date.now()}`, { flag: 'wx' });
      lockAcquired = true;
      break;
    } catch (error: any) {
      if (error.code === 'EEXIST') {
        // Lock exists - check if stale (>60s old)
        try {
          const lockStats = await fsPromises.stat(lockPath);
          if (Date.now() - lockStats.mtimeMs > 60000) {
            // Stale lock - remove and retry
            await fsPromises.unlink(lockPath);
            continue;
          }
        } catch {
          // Ignore stat errors
        }

        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
      } else {
        throw error;
      }
    }
  }

  if (!lockAcquired) {
    throw new Error(`Timeout acquiring lock for ${storagePath}`);
  }

  try {
    return await operation();
  } finally {
    // Release lock
    try {
      await fsPromises.unlink(lockPath);
    } catch {
      // Ignore unlock errors
    }
  }
}

// Updated fixture usage
authenticatedPage: async ({ browser }, use) => {
  const storagePath = STORAGE_PATHS.authenticated;
  const userData = testUsers.testUsers.member;

  let context: BrowserContext;

  // Check without lock first
  if (isStorageStateValid(storagePath)) {
    context = await browser.newContext({ storageState: storagePath });
  } else {
    // Use lock for creation
    await withStorageStateLock(storagePath, async () => {
      // Double-check after acquiring lock (another worker may have created it)
      if (isStorageStateValid(storagePath)) {
        return;
      }

      const tempContext = await browser.newContext();
      const page = await tempContext.newPage();
      await authenticateUser(page, userData.email, userData.password, storagePath);
      await page.close();
      await tempContext.close();
    });

    context = await browser.newContext({ storageState: storagePath });
  }

  const page = await context.newPage();
  await use(page);
  await context.close();
},
```

**Acceptance Criteria**:
- [ ] Only one worker creates storage state at a time
- [ ] Stale locks (>60s) are automatically cleaned
- [ ] Workers wait appropriately for lock acquisition
- [ ] No TOCTOU-related failures in parallel runs

---

### Phase 3: P2 - Medium Priority Issues (4 hours)

#### TASK-007: Add JWT Expiry Validation
**Type**: Enhancement
**Effort**: 2 hours
**Dependencies**: TASK-006
**Assigned**: Frontend

**Description**:
Enhance `isStorageStateValid()` to decode JWT and check `exp` claim, not just file age.

**Files to Modify**:
- `quikadmin-web/e2e/fixtures/auth.fixture.ts`

**Implementation Details**:

```typescript
// auth.fixture.ts - JWT validation

/**
 * Decode JWT payload without verification (for expiry check only)
 */
function decodeJwtPayload(token: string): { exp?: number; iat?: number; [key: string]: unknown } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    // Base64url decode
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(payload);
  } catch (error) {
    console.warn('Failed to decode JWT:', error);
    return {};
  }
}

/**
 * Extract access token from storage state
 */
function extractAccessToken(storageState: any): string | null {
  // Check localStorage
  for (const origin of storageState.origins || []) {
    for (const item of origin.localStorage || []) {
      if (item.name === 'accessToken' || item.name === 'access_token' ||
          item.name === 'supabase.auth.token') {
        try {
          const parsed = JSON.parse(item.value);
          return parsed.access_token || parsed.accessToken || item.value;
        } catch {
          return item.value;
        }
      }
    }
  }

  // Check cookies
  for (const cookie of storageState.cookies || []) {
    if (cookie.name.includes('access') || cookie.name.includes('token')) {
      return cookie.value;
    }
  }

  return null;
}

/**
 * Enhanced storage state validation with JWT expiry check
 */
function isStorageStateValid(storagePath: string, maxAgeMs: number = 30 * 60 * 1000): boolean {
  if (!fs.existsSync(storagePath)) {
    return false;
  }

  try {
    // Check file age
    const stats = fs.statSync(storagePath);
    const fileAge = Date.now() - stats.mtimeMs;

    if (fileAge >= maxAgeMs) {
      console.log(`Storage state file too old (${Math.round(fileAge / 1000)}s): ${storagePath}`);
      return false;
    }

    // Check JWT expiry
    const storageState = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
    const accessToken = extractAccessToken(storageState);

    if (accessToken) {
      const payload = decodeJwtPayload(accessToken);

      if (payload.exp) {
        const expMs = payload.exp * 1000;
        const bufferMs = 2 * 60 * 1000; // 2 minute buffer
        const nowMs = Date.now();

        if (nowMs + bufferMs >= expMs) {
          const expiresIn = Math.round((expMs - nowMs) / 1000);
          console.log(`Storage state JWT expires in ${expiresIn}s (buffer: ${bufferMs / 1000}s): ${storagePath}`);
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.warn(`Error validating storage state ${storagePath}:`, error);
    return false;
  }
}
```

**Acceptance Criteria**:
- [ ] JWT `exp` claim is decoded and checked
- [ ] Storage state is invalidated before JWT expires (with buffer)
- [ ] Invalid/malformed JWTs don't crash validation
- [ ] Validation reasons are logged

---

#### TASK-008: Reduce Viewport Projects for CI
**Type**: Enhancement
**Effort**: 1 hour
**Dependencies**: TASK-001
**Assigned**: DevOps

**Description**:
Reduce viewport projects from 5 to 2-3 for CI efficiency, with option to run full matrix locally.

**Files to Modify**:
- `quikadmin-web/playwright.config.ts`

**Implementation Details**:

```typescript
// playwright.config.ts

// Environment-specific configuration
const isCI = !!process.env.CI;
const runFullViewportMatrix = !!process.env.FULL_VIEWPORT_MATRIX;

// All viewport sizes for comprehensive testing
const allViewportSizes = [
  { width: 375, height: 667, name: 'mobile-375' },    // iPhone SE
  { width: 640, height: 1136, name: 'sm-640' },       // Tailwind sm breakpoint
  { width: 768, height: 1024, name: 'md-768' },       // Tailwind md breakpoint (iPad)
  { width: 1024, height: 768, name: 'lg-1024' },      // Tailwind lg breakpoint
  { width: 1280, height: 720, name: 'xl-1280' },      // Tailwind xl breakpoint
];

// Reduced viewport sizes for CI (mobile + desktop)
const ciViewportSizes = [
  { width: 375, height: 667, name: 'mobile' },        // Mobile
  { width: 1280, height: 720, name: 'desktop' },      // Desktop
];

// Select viewports based on environment
const viewportSizes = (isCI && !runFullViewportMatrix) ? ciViewportSizes : allViewportSizes;

console.log(`[Playwright Config] Using ${viewportSizes.length} viewport(s): ${viewportSizes.map(v => v.name).join(', ')}`);

export default defineConfig({
  // ... existing config

  projects: [
    // Setup project
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
      teardown: 'cleanup',
    },
    // Cleanup project
    {
      name: 'cleanup',
      testMatch: /global\.teardown\.ts/,
    },
    // Viewport projects
    ...viewportSizes.map((viewport) => ({
      name: `chromium-${viewport.name}`,
      use: {
        ...devices['Desktop Chrome'],
        viewport: {
          width: viewport.width,
          height: viewport.height,
        },
      },
      dependencies: ['setup'],
    })),
  ],
});

// Export for tests to access
export const testConfig = {
  baseURL,
  apiURL,
  isCI,
  viewportCount: viewportSizes.length,
  // ...
};
```

**Acceptance Criteria**:
- [ ] CI runs with 2 viewport projects by default
- [ ] Local dev can run full 5 viewports
- [ ] `FULL_VIEWPORT_MATRIX=true` enables all viewports in CI
- [ ] Test duration reduced by ~60% in CI

---

#### TASK-009: Add Logout on Cleanup
**Type**: Enhancement
**Effort**: 1 hour
**Dependencies**: TASK-001
**Assigned**: QA

**Description**:
Add logout API calls during cleanup to properly invalidate sessions.

**Files to Modify**:
- `quikadmin-web/e2e/fixtures/auth.fixture.ts`
- `quikadmin-web/e2e/global.teardown.ts`

**Implementation Details**:

```typescript
// auth.fixture.ts - Add logout utility

/**
 * Logout and invalidate session
 */
export async function logoutUser(tokens: AuthTokens): Promise<void> {
  if (!tokens.accessToken) {
    return;
  }

  try {
    const response = await fetch(`${testConfig.apiURL}/auth/v2/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`Logout failed: ${response.status}`);
    }
  } catch (error) {
    console.warn('Logout error:', error);
  }
}

// global.teardown.ts - Add logout
import { clearAuthStates, logoutFromStorageStates } from './fixtures/auth.fixture';

teardown('cleanup sessions', async ({}) => {
  // Logout active sessions from storage states
  await logoutFromStorageStates();

  // Clear auth state files
  clearAuthStates();

  console.log('[Global Teardown] Sessions invalidated and auth states cleared');
});
```

**Acceptance Criteria**:
- [ ] Logout API called during teardown
- [ ] Sessions properly invalidated
- [ ] Auth state files deleted after logout

---

## 7. Test Strategy

### 7.1 Verification Tests for Fixes

| Task | Verification Method |
|------|---------------------|
| TASK-001 | Run `npx playwright test --project=cleanup` to verify teardown executes |
| TASK-002 | Run tests with invalid credentials, verify error includes email and hints |
| TASK-003 | Run password reset tests twice, verify second run succeeds |
| TASK-004 | Run `npx playwright test --workers=4`, verify no race conditions in logs |
| TASK-005 | Run `bun run test:e2e:auto` on Windows |
| TASK-006 | Run `npx playwright test --workers=4`, verify single storage state creation |
| TASK-007 | Create storage state with expired JWT, verify regeneration |
| TASK-008 | Run in CI, verify only 2 viewports execute |
| TASK-009 | Run tests, verify no active sessions after cleanup |

### 7.2 Regression Test Plan

```bash
# Full regression suite
npm run test:e2e:auto

# Parallel stress test (4 workers)
npx playwright test --workers=4 --repeat-each=3

# Platform-specific tests
# Windows
bun run test:e2e:auto
# macOS/Linux
npm run test:e2e:auto

# Viewport matrix test
FULL_VIEWPORT_MATRIX=true npm run test:e2e:auto
```

### 7.3 Cleanup Verification

```sql
-- Run after test suite to verify cleanup
SELECT COUNT(*) as orphaned_count
FROM organizations
WHERE name LIKE 'test-e2e-%'
  AND created_at > NOW() - INTERVAL '1 hour';

-- Should return 0
```

---

## 8. Dependencies & Integration Points

### 8.1 Internal Dependencies

| Dependency | Description | Owner |
|------------|-------------|-------|
| Supabase Auth | Password restoration requires service role key | Backend |
| PostgreSQL (Neon) | Cleanup queries test data | Backend |
| Redis | Bull queues may process test documents | Backend |
| API Health Endpoint | Setup project verifies API is ready | Backend |

### 8.2 External Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| Playwright | ^1.40.0 | Test framework |
| @supabase/supabase-js | ^2.x | Admin API access |
| Node.js | ^18.x | Runtime |

### 8.3 Environment Variables Required

```bash
# For password restoration (TASK-003)
SUPABASE_SERVICE_ROLE_KEY=ey...

# For API health check (TASK-001)
VITE_API_URL=http://localhost:3002/api
# or
PLAYWRIGHT_API_URL=http://localhost:3002/api
```

---

## 9. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Service role key exposure | Medium | Critical | Add to `.env` only, never commit; document in setup guide |
| Mutex deadlock | Low | High | Implement 60s stale lock detection and cleanup |
| JWT library dependency | Low | Low | Use manual base64 decoding, no external lib |
| Windows CI runner availability | Low | Medium | Use self-hosted runner or skip Windows tests with flag |
| Project dependencies break existing tests | Medium | Medium | Run full test suite after each task; phase rollout |
| Parallel cleanup race conditions | Medium | Medium | Use atomic file operations; test with high worker count |

### 9.1 Rollback Plan

If issues arise after deployment:

1. **Immediate**: Revert `playwright.config.ts` to remove project dependencies
2. **Short-term**: Set `globalTeardown: undefined` to disable cleanup
3. **Fallback**: Run with `--workers=1` to disable parallelism

---

## 10. Rollout Plan

### Phase 1: P0 Fixes (Day 1-2)

1. **Day 1 Morning**
   - TASK-002: Fix silent auth failures (30 min)
   - Verify: Run tests, confirm error messages are clear

2. **Day 1 Afternoon**
   - TASK-003: Isolate password reset tests (1 hour)
   - Verify: Run password reset tests twice consecutively

3. **Day 2**
   - TASK-001: Implement global teardown (2 hours)
   - Verify: Run full suite, query database for orphaned data

### Phase 2: P1 Fixes (Day 3-5)

4. **Day 3**
   - TASK-005: Fix Windows paths (1 hour)
   - Verify: Run on Windows machine or CI

5. **Day 4**
   - TASK-006: Fix storage state TOCTOU (2 hours)
   - Verify: Run with `--workers=4 --repeat-each=3`

6. **Day 5**
   - TASK-004: Implement per-worker tracking (4 hours)
   - Verify: Run parallel tests, check worker-specific logs

### Phase 3: P2 Fixes (Day 6-7)

7. **Day 6**
   - TASK-007: Add JWT expiry validation (2 hours)
   - Verify: Create expired storage state, confirm regeneration

8. **Day 7**
   - TASK-008: Reduce viewport projects (1 hour)
   - TASK-009: Add logout on cleanup (1 hour)
   - Final verification: Full regression suite

### Post-Implementation

- [ ] Update `quikadmin-web/CLAUDE.md` with new test patterns
- [ ] Update CI configuration if needed
- [ ] Monitor test flakiness over 20 runs
- [ ] Document known issues and workarounds

---

## 11. Appendices

### 11.1 File Locations Summary

| File | Path |
|------|------|
| Playwright Config | `N:\IntelliFill\quikadmin-web\playwright.config.ts` |
| Auth Fixture | `N:\IntelliFill\quikadmin-web\e2e\fixtures\auth.fixture.ts` |
| Org Fixture | `N:\IntelliFill\quikadmin-web\e2e\fixtures\org.fixture.ts` |
| Login Tests | `N:\IntelliFill\quikadmin-web\e2e\tests\auth\login.spec.ts` |
| Run Script | `N:\IntelliFill\quikadmin-web\scripts\run-e2e-automated.js` |
| Seed Script | `N:\IntelliFill\quikadmin\scripts\seed-e2e-users.ts` |
| Test Data | `N:\IntelliFill\quikadmin-web\e2e\data\` |
| API Helper | `N:\IntelliFill\quikadmin-web\e2e\helpers\api.helper.ts` |

### 11.2 Expert Panel Reference

Full expert panel findings documented in: `N:\IntelliFill\EXPERT_PANEL_TESTS_REVIEW.md`

### 11.3 Playwright Best Practices

From Context7 Playwright documentation:

1. **Project Dependencies**: Use `dependencies` and `teardown` properties instead of `globalSetup`/`globalTeardown` for full feature support
2. **Worker Isolation**: Use `{ scope: 'worker' }` fixtures with `workerInfo.workerIndex` for data isolation
3. **Auto Fixtures**: Use `auto: true` for fixtures that should run for every test automatically

### 11.4 Glossary

| Term | Definition |
|------|------------|
| TOCTOU | Time-of-check to time-of-use race condition |
| Worker | Playwright's parallel test executor process |
| Storage State | Serialized browser context (cookies, localStorage) |
| Fixture | Reusable test setup/teardown component |
| RLS | Row-Level Security (Supabase/PostgreSQL) |

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-09 | PRD Agent | Initial version based on expert panel findings |

---

**End of PRD**
