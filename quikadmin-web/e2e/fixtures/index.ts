/**
 * E2E Test Fixtures Index
 *
 * Central export for all test fixtures.
 *
 * Usage in tests:
 *
 * ```typescript
 * import { test, expect } from '../fixtures';
 *
 * // Use authenticated page
 * test('my test', async ({ authenticatedPage }) => {
 *   await authenticatedPage.goto('/dashboard');
 * });
 *
 * // Use role-specific page
 * test('admin test', async ({ adminPage }) => {
 *   await adminPage.goto('/settings');
 * });
 *
 * // Use organization fixture
 * test('org test', async ({ testOrganization }) => {
 *   console.log(testOrganization.organization.id);
 * });
 * ```
 */

// Re-export everything from org.fixture which extends auth.fixture
export {
  test,
  expect,
  globalCleanup,
  getTrackedResourceCount, // deprecated - resources are now worker-scoped
  type OrgFixtureData,
  type DocFixtureData,
  type DocsFixtureData,
  type OrgFixtures,
  type WorkerFixtures,
} from './org.fixture';

// Re-export auth-specific types
export {
  clearAuthStates,
  clearAuthState,
  type UserRole,
  type AuthenticatedContext,
  type AuthFixtures,
} from './auth.fixture';

// Re-export base Playwright test for tests that don't need custom fixtures
export { test as baseTest, expect as baseExpect } from '@playwright/test';
