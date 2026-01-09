Expert Panel Analysis Complete

  I've gathered comprehensive findings from 6 specialized agents. Here's the synthesized adversarial discussion:

  ---
  E2E TEST ARCHITECTURE REVIEW - EXPERT PANEL FINDINGS

  PANEL COMPOSITION
  ┌─────────────────────────┬───────────────────────────┬───────────────────────────┐
  │         Expert          │        Focus Area         │   Critical Issues Found   │
  ├─────────────────────────┼───────────────────────────┼───────────────────────────┤
  │ Principal QA Engineer   │ Playwright architecture   │ 17 architectural flaws    │
  ├─────────────────────────┼───────────────────────────┼───────────────────────────┤
  │ Test Data Specialist    │ Test isolation/pollution  │ 10 data management issues │
  ├─────────────────────────┼───────────────────────────┼───────────────────────────┤
  │ DevX Researcher         │ Best practices comparison │ 5 pattern gaps            │
  ├─────────────────────────┼───────────────────────────┼───────────────────────────┤
  │ Windows Platform Expert │ Cross-platform compat     │ 8 Windows-specific bugs   │
  ├─────────────────────────┼───────────────────────────┼───────────────────────────┤
  │ Security QA Engineer    │ Auth fixture reliability  │ 12 auth/session issues    │
  ├─────────────────────────┼───────────────────────────┼───────────────────────────┤
  │ Test Flow Architect     │ Execution pipeline        │ 10 failure points         │
  └─────────────────────────┴───────────────────────────┴───────────────────────────┘
  ---
  CRITICAL FINDINGS (Unanimous Agreement)

  1. GLOBAL MUTABLE STATE WITH PARALLEL EXECUTION

  Severity: CRITICAL | All 6 experts flagged

  // org.fixture.ts (Lines 75-76)
  const createdOrganizations: string[] = [];  // ← SHARED across workers
  const createdDocuments: string[] = [];       // ← RACE CONDITION

  Problem: With fullyParallel: true (playwright.config.ts:41), multiple workers simultaneously mutate these arrays without synchronization.

  Impact:
  - Cleanup loses references to resources
  - Orphaned data accumulates in database
  - Tests fail randomly based on execution order

  ---
  2. GLOBAL CLEANUP NEVER EXECUTED

  Severity: CRITICAL | 5/6 experts flagged

  // playwright.config.ts (Lines 57-58)
  globalSetup: undefined,      // ← NOT IMPLEMENTED
  globalTeardown: undefined,   // ← CLEANUP NEVER RUNS

  // org.fixture.ts exports globalCleanup() but it's NEVER CALLED
  export async function globalCleanup(): Promise<void> { ... }

  Impact: Database grows unbounded. Test pollution accumulates across runs.

  ---
  3. SHARED USERS + PASSWORD MUTATION = CASCADING FAILURES

  Severity: CRITICAL | 4/6 experts flagged

  // login.spec.ts (Lines 26-27)
  const testEmail = 'test-password-reset@intellifill.local';
  const newPassword = 'NewSecurePassword123!';
  // ↑ CHANGES PASSWORD IN SUPABASE - ALL SUBSEQUENT TESTS FAIL

  Flow:
  1. Password reset test changes test-password-reset@ password
  2. Seed script only runs at start of suite
  3. All subsequent auth fixtures fail with "Invalid credentials"

  ---
  4. SILENT AUTH FIXTURE FAILURES

  Severity: HIGH | 4/6 experts flagged

  // auth.fixture.ts (Lines 93-96)
  } catch (error) {
    console.error(`Failed to authenticate user ${email}:`, error);
    return null;  // ← RETURNS NULL, DOESN'T THROW
  }

  // Later:
  tokens = null || { accessToken: '', refreshToken: '' };
  // ↑ Empty tokens passed to API helper - 401 errors downstream

  Impact: Tests fail with cryptic 401 errors instead of clear auth failure messages.

  ---
  5. RACE CONDITION IN STORAGE STATE CREATION

  Severity: HIGH | 3/6 experts flagged

  // auth.fixture.ts (Lines 147-168)
  if (isStorageStateValid(storagePath)) {
    context = await browser.newContext({ storageState: storagePath });
  } else {
    // 5 parallel workers ALL hit this branch simultaneously
    // ALL try to write to same file
    await authenticateUser(..., storagePath);  // ← RACE
  }

  Classic TOCTOU: Check validity → File deleted by another worker → Load fails.

  ---
  6. WINDOWS PATH ISSUES

  Severity: HIGH | Windows Expert flagged

  // run-e2e-automated.js (Line 144)
  const playwrightCli = path.resolve(__dirname, '../node_modules/.bin/playwright');
  // ↑ Windows needs .cmd extension for bin symlinks

  Current error: Cannot find module 'N:\IntelliFill\node_modules\node_modules\.pnpm\...'

  ---
  ADVERSARIAL DISCUSSION SUMMARY

  QA Engineer vs. DevX Expert

  QA: "The fixture cleanup runs AFTER use() returns, but tests can run in parallel. The global arrays are corrupted."

  DevX: "Per-test cleanup via fixtures is industry standard. But you're right - the shared array pattern violates Playwright's worker isolation model."

  Resolution: Each worker should track its own resources, or use file-based locks.

  ---
  Security Engineer vs. Test Data Specialist

  Security: "Storage state validity check only looks at file age, not JWT expiration. A 20-minute-old file with a 15-minute token is considered valid."

  Data Specialist: "Worse - the password reset tests change real passwords in Supabase. The seed script updates passwords at run start, but not between tests."

  Resolution:
  1. Validate JWT exp claim before reusing storage state
  2. Use unique per-test users for destructive operations

  ---
  Windows Expert vs. Test Flow Architect

  Windows: "The npx command resolution fails in monorepos on Windows. Double node_modules in path."

  Flow Architect: "The automation script already fixed this for ts-node (Line 91) but not for Playwright (Line 144)."

  Resolution: Use direct binary paths with platform detection:
  const isWindows = process.platform === 'win32';
  const playwrightCli = path.resolve(__dirname,
    `../node_modules/.bin/playwright${isWindows ? '.cmd' : ''}`);

  ---
  PRIORITY FIX MATRIX
  ┌──────────┬─────────────────────────────────────┬────────────────────────────────────┬─────────┐
  │ Priority │                Issue                │                Fix                 │ Effort  │
  ├──────────┼─────────────────────────────────────┼────────────────────────────────────┼─────────┤
  │ P0       │ Global cleanup never runs           │ Implement global-teardown.ts       │ 2 hours │
  ├──────────┼─────────────────────────────────────┼────────────────────────────────────┼─────────┤
  │ P0       │ Password reset pollutes shared user │ Restore password in afterEach hook │ 1 hour  │
  ├──────────┼─────────────────────────────────────┼────────────────────────────────────┼─────────┤
  │ P0       │ Silent auth failures                │ Throw instead of return null       │ 30 min  │
  ├──────────┼─────────────────────────────────────┼────────────────────────────────────┼─────────┤
  │ P1       │ Race condition on global arrays     │ Per-worker resource tracking       │ 4 hours │
  ├──────────┼─────────────────────────────────────┼────────────────────────────────────┼─────────┤
  │ P1       │ Windows path issues                 │ Platform-aware binary resolution   │ 1 hour  │
  ├──────────┼─────────────────────────────────────┼────────────────────────────────────┼─────────┤
  │ P1       │ Storage state TOCTOU                │ File-based mutex for auth          │ 2 hours │
  ├──────────┼─────────────────────────────────────┼────────────────────────────────────┼─────────┤
  │ P2       │ Token expiry not validated          │ Decode JWT and check exp           │ 2 hours │
  ├──────────┼─────────────────────────────────────┼────────────────────────────────────┼─────────┤
  │ P2       │ No logout on cleanup                │ Call logout endpoint               │ 1 hour  │
  ├──────────┼─────────────────────────────────────┼────────────────────────────────────┼─────────┤
  │ P2       │ Viewport explosion (5 projects)     │ Reduce to 2 projects for CI        │ 30 min  │
  └──────────┴─────────────────────────────────────┴────────────────────────────────────┴─────────┘
  ---
  RECOMMENDED ARCHITECTURE CHANGES

  1. Implement Global Teardown

  // e2e/global-teardown.ts
  import { globalCleanup } from './fixtures/org.fixture';

  export default async function globalTeardown() {
    await globalCleanup();
  }

  // playwright.config.ts
  globalTeardown: './e2e/global-teardown.ts',

  2. Per-Worker Resource Tracking

  // Instead of global arrays:
  const workerResources = new Map<number, { orgs: string[], docs: string[] }>();

  function getWorkerResources() {
    const workerId = parseInt(process.env.PLAYWRIGHT_WORKER_INDEX || '0');
    if (!workerResources.has(workerId)) {
      workerResources.set(workerId, { orgs: [], docs: [] });
    }
    return workerResources.get(workerId)!;
  }

  3. Password Reset Test Isolation

  // login.spec.ts - Add afterEach hook
  test.afterEach(async () => {
    // Restore password via Supabase Admin API
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: 'TestPasswordReset123!' }
    );
  });

  4. Throw on Auth Failure

  // auth.fixture.ts (Line 93)
  } catch (error) {
    // THROW instead of silent return
    throw new Error(`Auth fixture failed for ${email}: ${error.message}`);
  }

  5. Windows-Compatible Binary Resolution

  // run-e2e-automated.js
  const isWindows = process.platform === 'win32';
  const binExt = isWindows ? '.cmd' : '';
  const playwrightCli = path.resolve(__dirname, `../node_modules/.bin/playwright${binExt}`);

  ---
  TEST ISOLATION SCORECARD
  ┌──────────────────┬────────────────────────────┬───────────────────────┬──────────┐
  │    Dimension     │          Current           │        Target         │   Gap    │
  ├──────────────────┼────────────────────────────┼───────────────────────┼──────────┤
  │ User Isolation   │ Shared (5 users)           │ Per-test unique       │ CRITICAL │
  ├──────────────────┼────────────────────────────┼───────────────────────┼──────────┤
  │ DB Cleanup       │ Never (global undefined)   │ After each run        │ CRITICAL │
  ├──────────────────┼────────────────────────────┼───────────────────────┼──────────┤
  │ Auth State       │ 30-min cache, no JWT check │ JWT expiry validation │ HIGH     │
  ├──────────────────┼────────────────────────────┼───────────────────────┼──────────┤
  │ Worker Isolation │ Shared global arrays       │ Per-worker tracking   │ HIGH     │
  ├──────────────────┼────────────────────────────┼───────────────────────┼──────────┤
  │ Platform Support │ Unix-only paths            │ Cross-platform        │ HIGH     │
  ├──────────────────┼────────────────────────────┼───────────────────────┼──────────┤
  │ Error Visibility │ Silent null returns        │ Throw with context    │ MEDIUM   │
  └──────────────────┴────────────────────────────┴───────────────────────┴──────────┘
  ---
  NEXT STEPS

  1. Immediate (Today): Fix silent auth failures + implement global teardown
  2. This Week: Fix Windows paths + password reset isolation
  3. Next Week: Per-worker resource tracking + JWT validation
  4. Ongoing: Monitor for new race conditions as test count grows

  The panel unanimously agrees: The core issue is mixing Playwright's parallel worker model with shared mutable state. Fixing this requires moving from global arrays to per-worker isolation.