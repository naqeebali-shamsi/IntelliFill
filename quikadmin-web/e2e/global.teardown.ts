/**
 * Global Teardown - Runs after all test projects complete
 *
 * Cleans up test resources: sessions, auth states, and orphaned database resources.
 */
import { test as teardown } from '@playwright/test';
import { clearAuthStates, logoutFromStorageStates } from './fixtures/auth.fixture';
import { globalCleanup } from './fixtures/org.fixture';

teardown('logout active sessions', async ({}) => {
  console.log('[Global Teardown] Logging out active sessions...');
  try {
    await logoutFromStorageStates();
    console.log('[Global Teardown] Sessions logged out');
  } catch (error) {
    console.warn('[Global Teardown] Failed to logout sessions:', error);
    // Don't fail teardown
  }
});

teardown('cleanup auth states', async ({}) => {
  console.log('[Global Teardown] Clearing auth states...');
  try {
    clearAuthStates();
    console.log('[Global Teardown] Auth states cleared');
  } catch (error) {
    console.warn('[Global Teardown] Failed to clear auth states:', error);
  }
});

teardown('cleanup database resources', async ({}) => {
  console.log('[Global Teardown] Cleaning up database resources...');
  try {
    await globalCleanup();
    console.log('[Global Teardown] Database resources cleaned');
  } catch (error) {
    console.warn('[Global Teardown] Failed to cleanup database resources:', error);
    // Don't fail teardown - just log warning
  }
});
