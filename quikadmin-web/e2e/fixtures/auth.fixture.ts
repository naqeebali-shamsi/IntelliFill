/**
 * Auth Fixture for Session Management
 *
 * Provides pre-authenticated browser contexts for different roles:
 * - authenticatedUser: Generic authenticated user
 * - viewerUser: User with VIEWER role
 * - memberUser: User with MEMBER role
 * - adminUser: User with ADMIN role
 * - ownerUser: User with OWNER role
 *
 * Uses Playwright's test.extend to create custom fixtures.
 */

import { test as base, Page, BrowserContext, Browser } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import { ApiHelper, AuthTokens, TestUser } from '../helpers/api.helper';
import { LoginPage } from '../pages/LoginPage';
import { testUsers } from '../data';

/**
 * Decode JWT payload without verification (for expiry check only)
 * We only need to check expiration, not validate signature
 */
function decodeJwtPayload(token: string): { exp?: number; iat?: number; [key: string]: unknown } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    // Base64url decode the payload
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(payload);
  } catch (error) {
    console.warn('[JWT Decode] Failed to decode JWT:', error);
    return {};
  }
}

/**
 * Extract token expiry from storage state
 * Handles IntelliFill backend auth format and Supabase JWT format
 * Returns expiry timestamp in milliseconds, or null if not found
 */
function extractTokenExpiry(storageState: any): number | null {
  // Check localStorage origins
  for (const origin of storageState.origins || []) {
    for (const item of origin.localStorage || []) {
      // IntelliFill backend auth format
      if (item.name === 'intellifill-backend-auth') {
        try {
          const parsed = JSON.parse(item.value);
          // tokenExpiresAt is stored in milliseconds
          if (parsed.state?.tokenExpiresAt) {
            return parsed.state.tokenExpiresAt;
          }
        } catch {
          // Ignore parse errors
        }
      }

      // Supabase auth format (for future compatibility)
      if (item.name.includes('supabase.auth.token') || item.name.includes('sb-')) {
        try {
          const parsed = JSON.parse(item.value);
          const accessToken = parsed.access_token || parsed.accessToken;
          if (accessToken) {
            const payload = decodeJwtPayload(accessToken);
            if (payload.exp) {
              return payload.exp * 1000; // Convert to milliseconds
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  return null;
}

// Storage state directory
const STORAGE_STATE_DIR = path.join(__dirname, '../.auth');

// Ensure storage state directory exists
if (!fs.existsSync(STORAGE_STATE_DIR)) {
  fs.mkdirSync(STORAGE_STATE_DIR, { recursive: true });
}

/**
 * Storage state paths for different user types
 */
const STORAGE_PATHS = {
  viewer: path.join(STORAGE_STATE_DIR, 'viewer.json'),
  member: path.join(STORAGE_STATE_DIR, 'member.json'),
  admin: path.join(STORAGE_STATE_DIR, 'admin.json'),
  owner: path.join(STORAGE_STATE_DIR, 'owner.json'),
  authenticated: path.join(STORAGE_STATE_DIR, 'authenticated.json'),
};

/**
 * User role types
 */
export type UserRole = 'viewer' | 'member' | 'admin' | 'owner';

/**
 * Authenticated user context
 */
export interface AuthenticatedContext {
  page: Page;
  context: BrowserContext;
  user: TestUser;
  tokens: AuthTokens;
}

/**
 * Authenticate a user and save storage state
 */
async function authenticateUser(
  page: Page,
  email: string,
  password: string,
  storagePath: string
): Promise<AuthTokens> {
  try {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();

    // Perform login
    await loginPage.login({ email, password });

    // Wait for successful navigation (not on login page anymore)
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Save storage state
    await page.context().storageState({ path: storagePath });

    // Get tokens from cookies/storage
    const cookies = await page.context().cookies();
    const accessToken = cookies.find(c => c.name.includes('access') || c.name.includes('token'))?.value;

    // Also check localStorage
    const localStorageTokens = await page.evaluate(() => {
      return {
        accessToken: localStorage.getItem('accessToken') || localStorage.getItem('access_token'),
        refreshToken: localStorage.getItem('refreshToken') || localStorage.getItem('refresh_token'),
      };
    });

    return {
      accessToken: accessToken || localStorageTokens.accessToken || '',
      refreshToken: localStorageTokens.refreshToken || '',
    };
  } catch (error) {
    // THROW instead of return null - provides clear error message
    throw new Error(
      `[Auth Fixture] Authentication failed for ${email}\n` +
      `Reason: ${error instanceof Error ? error.message : String(error)}\n` +
      `Storage Path: ${storagePath}\n` +
      `Troubleshooting:\n` +
      `  1. Ensure test users are seeded: bun run test:e2e:auto (seeds users first)\n` +
      `  2. Check backend is running: curl http://localhost:3002/health\n` +
      `  3. Verify credentials in quikadmin-web/e2e/data/test-users.json\n` +
      `  4. Try clearing auth states: rm -rf quikadmin-web/e2e/.auth/`
    );
  }
}

/**
 * Check if storage state exists and is valid
 * Validates both file age AND token expiration
 */
function isStorageStateValid(storagePath: string, maxAgeMs: number = 30 * 60 * 1000): boolean {
  if (!fs.existsSync(storagePath)) {
    return false;
  }

  try {
    // Check file age first (quick check)
    const stats = fs.statSync(storagePath);
    const fileAge = Date.now() - stats.mtimeMs;

    if (fileAge >= maxAgeMs) {
      console.log(`[Storage State] File too old (${Math.round(fileAge / 1000)}s): ${storagePath}`);
      return false;
    }

    // Check token expiry
    const storageState = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
    const tokenExpiresAt = extractTokenExpiry(storageState);

    if (tokenExpiresAt) {
      const bufferMs = 2 * 60 * 1000; // 2 minute buffer before expiry
      const nowMs = Date.now();

      if (nowMs + bufferMs >= tokenExpiresAt) {
        const expiresIn = Math.round((tokenExpiresAt - nowMs) / 1000);
        console.log(
          `[Storage State] Token ${expiresIn > 0 ? `expires in ${expiresIn}s` : `expired ${Math.abs(expiresIn)}s ago`}: ${storagePath}`
        );
        return false;
      }

      // Log time remaining for debugging
      const remainingMinutes = Math.round((tokenExpiresAt - nowMs) / 60000);
      console.log(`[Storage State] Token valid, expires in ${remainingMinutes} minutes: ${storagePath}`);
    }

    return true;
  } catch (error) {
    console.warn(`[Storage State] Error validating ${storagePath}:`, error);
    return false;
  }
}

/**
 * File-based mutex for storage state creation
 * Prevents TOCTOU race conditions when multiple workers try to authenticate
 */
async function withStorageStateLock<T>(
  storagePath: string,
  operation: () => Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  const lockPath = `${storagePath}.lock`;
  const startTime = Date.now();
  let lockAcquired = false;

  // Try to acquire lock
  while (Date.now() - startTime < timeoutMs) {
    try {
      // Attempt atomic file creation - fails if file exists
      await fsPromises.writeFile(lockPath, `${process.pid}-${Date.now()}`, { flag: 'wx' });
      lockAcquired = true;
      break;
    } catch (error: unknown) {
      const fsError = error as NodeJS.ErrnoException;
      if (fsError.code === 'EEXIST') {
        // Lock exists - check if stale (older than 60 seconds)
        try {
          const lockStats = await fsPromises.stat(lockPath);
          if (Date.now() - lockStats.mtimeMs > 60000) {
            // Stale lock - remove and retry
            console.log(`[Auth Mutex] Removing stale lock: ${lockPath}`);
            await fsPromises.unlink(lockPath);
            continue;
          }
        } catch {
          // Ignore stat errors - lock may have been released
        }

        // Wait with jitter before retrying
        const jitter = Math.random() * 100;
        await new Promise(resolve => setTimeout(resolve, 100 + jitter));
      } else {
        throw error;
      }
    }
  }

  if (!lockAcquired) {
    throw new Error(`[Auth Mutex] Timeout acquiring lock for ${storagePath} after ${timeoutMs}ms`);
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

/**
 * Safely get or create storage state with mutex protection
 */
async function getOrCreateStorageState(
  browser: Browser,
  storagePath: string,
  email: string,
  password: string
): Promise<void> {
  // First check without lock - fast path
  if (isStorageStateValid(storagePath)) {
    return;
  }

  // Use lock for creation to prevent race conditions
  await withStorageStateLock(storagePath, async () => {
    // Double-check after acquiring lock
    // Another worker may have created it while we waited
    if (isStorageStateValid(storagePath)) {
      console.log(`[Auth Mutex] Storage state was created by another worker: ${storagePath}`);
      return;
    }

    // Create new storage state
    console.log(`[Auth Mutex] Creating storage state: ${storagePath}`);
    const tempContext = await browser.newContext();
    const page = await tempContext.newPage();

    try {
      await authenticateUser(page, email, password, storagePath);
    } finally {
      await page.close();
      await tempContext.close();
    }
  });
}

/**
 * Extended test fixtures with authentication
 */
export type AuthFixtures = {
  // Generic authenticated user
  authenticatedPage: Page;
  authenticatedContext: AuthenticatedContext;

  // Role-specific users
  viewerPage: Page;
  viewerContext: AuthenticatedContext;

  memberPage: Page;
  memberContext: AuthenticatedContext;

  adminPage: Page;
  adminContext: AuthenticatedContext;

  ownerPage: Page;
  ownerContext: AuthenticatedContext;

  // API helper with auth
  authenticatedApi: ApiHelper;

  // Login helper function
  loginAs: (email: string, password: string) => Promise<void>;
};

/**
 * Extended test with auth fixtures
 */
export const test = base.extend<AuthFixtures>({
  // Generic authenticated user page
  authenticatedPage: async ({ browser }, use) => {
    const storagePath = STORAGE_PATHS.authenticated;
    const userData = testUsers.testUsers.member;

    // Use mutex-protected storage state creation
    await getOrCreateStorageState(browser, storagePath, userData.email, userData.password);

    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    await use(page);
    await context.close();
  },

  // Authenticated context with full details
  authenticatedContext: async ({ browser }, use) => {
    const storagePath = STORAGE_PATHS.authenticated;
    const userData = testUsers.testUsers.member;

    // Use mutex-protected storage state creation
    await getOrCreateStorageState(browser, storagePath, userData.email, userData.password);

    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    // Get tokens from storage state file
    let tokens: AuthTokens = { accessToken: '', refreshToken: '' };
    try {
      const storageState = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
      // Extract tokens from localStorage in storage state
      for (const origin of storageState.origins || []) {
        for (const item of origin.localStorage || []) {
          if (item.name === 'accessToken' || item.name === 'access_token') {
            tokens.accessToken = item.value;
          }
          if (item.name === 'refreshToken' || item.name === 'refresh_token') {
            tokens.refreshToken = item.value;
          }
        }
      }
    } catch (error) {
      console.warn('[Auth Fixture] Could not extract tokens from storage state:', error);
    }

    await use({
      page,
      context,
      user: {
        id: 'authenticated-user',
        email: userData.email,
        name: userData.name,
        role: userData.role,
      },
      tokens,
    });

    await context.close();
  },

  // Viewer role page
  viewerPage: async ({ browser }, use) => {
    const storagePath = STORAGE_PATHS.viewer;
    const userData = testUsers.testUsers.viewer;

    // Use mutex-protected storage state creation
    await getOrCreateStorageState(browser, storagePath, userData.email, userData.password);

    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    await use(page);
    await context.close();
  },

  // Viewer context with full details
  viewerContext: async ({ browser }, use) => {
    const storagePath = STORAGE_PATHS.viewer;
    const userData = testUsers.testUsers.viewer;

    // Use mutex-protected storage state creation
    await getOrCreateStorageState(browser, storagePath, userData.email, userData.password);

    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    // Get tokens from storage state file
    let tokens: AuthTokens = { accessToken: '', refreshToken: '' };
    try {
      const storageState = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
      for (const origin of storageState.origins || []) {
        for (const item of origin.localStorage || []) {
          if (item.name === 'accessToken' || item.name === 'access_token') {
            tokens.accessToken = item.value;
          }
          if (item.name === 'refreshToken' || item.name === 'refresh_token') {
            tokens.refreshToken = item.value;
          }
        }
      }
    } catch (error) {
      console.warn('[Auth Fixture] Could not extract tokens from storage state:', error);
    }

    await use({
      page,
      context,
      user: {
        id: 'viewer-user',
        email: userData.email,
        name: userData.name,
        role: userData.role,
      },
      tokens,
    });

    await context.close();
  },

  // Member role page
  memberPage: async ({ browser }, use) => {
    const storagePath = STORAGE_PATHS.member;
    const userData = testUsers.testUsers.member;

    // Use mutex-protected storage state creation
    await getOrCreateStorageState(browser, storagePath, userData.email, userData.password);

    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    await use(page);
    await context.close();
  },

  // Member context with full details
  memberContext: async ({ browser }, use) => {
    const storagePath = STORAGE_PATHS.member;
    const userData = testUsers.testUsers.member;

    // Use mutex-protected storage state creation
    await getOrCreateStorageState(browser, storagePath, userData.email, userData.password);

    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    // Get tokens from storage state file
    let tokens: AuthTokens = { accessToken: '', refreshToken: '' };
    try {
      const storageState = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
      for (const origin of storageState.origins || []) {
        for (const item of origin.localStorage || []) {
          if (item.name === 'accessToken' || item.name === 'access_token') {
            tokens.accessToken = item.value;
          }
          if (item.name === 'refreshToken' || item.name === 'refresh_token') {
            tokens.refreshToken = item.value;
          }
        }
      }
    } catch (error) {
      console.warn('[Auth Fixture] Could not extract tokens from storage state:', error);
    }

    await use({
      page,
      context,
      user: {
        id: 'member-user',
        email: userData.email,
        name: userData.name,
        role: userData.role,
      },
      tokens,
    });

    await context.close();
  },

  // Admin role page
  adminPage: async ({ browser }, use) => {
    const storagePath = STORAGE_PATHS.admin;
    const userData = testUsers.testUsers.admin;

    // Use mutex-protected storage state creation
    await getOrCreateStorageState(browser, storagePath, userData.email, userData.password);

    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    await use(page);
    await context.close();
  },

  // Admin context with full details
  adminContext: async ({ browser }, use) => {
    const storagePath = STORAGE_PATHS.admin;
    const userData = testUsers.testUsers.admin;

    // Use mutex-protected storage state creation
    await getOrCreateStorageState(browser, storagePath, userData.email, userData.password);

    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    // Get tokens from storage state file
    let tokens: AuthTokens = { accessToken: '', refreshToken: '' };
    try {
      const storageState = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
      for (const origin of storageState.origins || []) {
        for (const item of origin.localStorage || []) {
          if (item.name === 'accessToken' || item.name === 'access_token') {
            tokens.accessToken = item.value;
          }
          if (item.name === 'refreshToken' || item.name === 'refresh_token') {
            tokens.refreshToken = item.value;
          }
        }
      }
    } catch (error) {
      console.warn('[Auth Fixture] Could not extract tokens from storage state:', error);
    }

    await use({
      page,
      context,
      user: {
        id: 'admin-user',
        email: userData.email,
        name: userData.name,
        role: userData.role,
      },
      tokens,
    });

    await context.close();
  },

  // Owner role page
  ownerPage: async ({ browser }, use) => {
    const storagePath = STORAGE_PATHS.owner;
    const userData = testUsers.testUsers.owner;

    // Use mutex-protected storage state creation
    await getOrCreateStorageState(browser, storagePath, userData.email, userData.password);

    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    await use(page);
    await context.close();
  },

  // Owner context with full details
  ownerContext: async ({ browser }, use) => {
    const storagePath = STORAGE_PATHS.owner;
    const userData = testUsers.testUsers.owner;

    // Use mutex-protected storage state creation
    await getOrCreateStorageState(browser, storagePath, userData.email, userData.password);

    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    // Get tokens from storage state file
    let tokens: AuthTokens = { accessToken: '', refreshToken: '' };
    try {
      const storageState = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
      for (const origin of storageState.origins || []) {
        for (const item of origin.localStorage || []) {
          if (item.name === 'accessToken' || item.name === 'access_token') {
            tokens.accessToken = item.value;
          }
          if (item.name === 'refreshToken' || item.name === 'refresh_token') {
            tokens.refreshToken = item.value;
          }
        }
      }
    } catch (error) {
      console.warn('[Auth Fixture] Could not extract tokens from storage state:', error);
    }

    await use({
      page,
      context,
      user: {
        id: 'owner-user',
        email: userData.email,
        name: userData.name,
        role: userData.role,
      },
      tokens,
    });

    await context.close();
  },

  // Authenticated API helper
  authenticatedApi: async ({ authenticatedContext }, use) => {
    const api = new ApiHelper();
    await api.init();
    api.setAuth(authenticatedContext.tokens);
    await use(api);
    await api.dispose();
  },

  // Login helper function
  loginAs: async ({ page }, use) => {
    const loginAs = async (email: string, password: string) => {
      const loginPage = new LoginPage(page);
      await loginPage.navigate();
      await loginPage.loginAndWaitForSuccess({ email, password });
    };

    await use(loginAs);
  },
});

export { expect } from '@playwright/test';

/**
 * Clear all stored auth states and lock files
 */
export function clearAuthStates(): void {
  for (const storagePath of Object.values(STORAGE_PATHS)) {
    // Remove storage state file
    if (fs.existsSync(storagePath)) {
      fs.unlinkSync(storagePath);
    }
    // Remove any leftover lock files
    const lockPath = `${storagePath}.lock`;
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  }
}

/**
 * Clear a specific auth state and its lock file
 */
export function clearAuthState(role: UserRole | 'authenticated'): void {
  const storagePath = STORAGE_PATHS[role];
  // Remove storage state file
  if (fs.existsSync(storagePath)) {
    fs.unlinkSync(storagePath);
  }
  // Remove any leftover lock file
  const lockPath = `${storagePath}.lock`;
  if (fs.existsSync(lockPath)) {
    fs.unlinkSync(lockPath);
  }
}

/**
 * Logout and invalidate a user session
 */
export async function logoutUser(tokens: AuthTokens): Promise<void> {
  if (!tokens.accessToken) {
    console.log('[Auth Logout] No access token to logout');
    return;
  }

  const apiURL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002/api';

  try {
    const response = await fetch(`${apiURL}/auth/v2/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      console.log('[Auth Logout] Session invalidated successfully');
    } else {
      console.warn(`[Auth Logout] Logout returned ${response.status}`);
    }
  } catch (error) {
    console.warn('[Auth Logout] Failed to logout:', error);
    // Don't throw - logout failures shouldn't break tests
  }
}

/**
 * Extract refresh token from storage state cookies
 */
function extractRefreshToken(storageState: any): string | null {
  for (const cookie of storageState.cookies || []) {
    if (cookie.name === 'refreshToken') {
      return cookie.value;
    }
  }
  return null;
}

/**
 * Logout all users from cached storage states
 * Reads tokens from storage state files and calls logout
 */
export async function logoutFromStorageStates(): Promise<void> {
  for (const [role, storagePath] of Object.entries(STORAGE_PATHS)) {
    if (!fs.existsSync(storagePath)) {
      continue;
    }

    try {
      const storageState = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
      const refreshToken = extractRefreshToken(storageState);

      if (refreshToken) {
        console.log(`[Auth Logout] Logging out ${role} user...`);
        await logoutUser({ accessToken: '', refreshToken });
      }
    } catch (error) {
      console.warn(`[Auth Logout] Failed to logout ${role}:`, error);
    }
  }
}
