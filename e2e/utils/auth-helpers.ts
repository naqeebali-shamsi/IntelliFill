import { Page } from '@playwright/test';

/**
 * Authentication Helper Utilities
 *
 * Reusable functions for authentication flows in E2E tests.
 */

export interface TestUser {
  email: string;
  password: string;
}

// Default timeouts - can be overridden via environment
// Production cloud services (Render/Vercel) can have cold starts up to 50+ seconds
const LOGIN_PAGE_TIMEOUT = parseInt(process.env.LOGIN_PAGE_TIMEOUT || '20000', 10);
const NAVIGATION_TIMEOUT = parseInt(process.env.NAVIGATION_TIMEOUT || '60000', 10);
const DASHBOARD_TIMEOUT = parseInt(process.env.DASHBOARD_TIMEOUT || '30000', 10);
const LOGIN_RETRY_COUNT = parseInt(process.env.LOGIN_RETRY_COUNT || '3', 10);
const LOGIN_RETRY_DELAY = parseInt(process.env.LOGIN_RETRY_DELAY || '5000', 10);

/**
 * Wait for a specified duration
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Login as a user with retry support for flaky production environments
 * Handles Render cold starts (503 errors) by retrying login attempts
 *
 * @param page Playwright page object
 * @param user User credentials
 */
export async function loginAsUser(page: Page, user: TestUser): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= LOGIN_RETRY_COUNT; attempt++) {
    try {
      // Navigate to login page - use domcontentloaded instead of networkidle
      // to avoid timeout issues with slow APIs or continuous polling
      await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });

      // Wait for login page to fully load (check for Sign in button)
      await page.getByRole('button', { name: /sign in/i }).waitFor({ state: 'visible', timeout: LOGIN_PAGE_TIMEOUT });

      // Fill in credentials using same selectors as working auth tests
      await page.getByLabel(/email/i).fill(user.email);
      await page.getByLabel(/password/i).fill(user.password);

      // Submit form
      await page.getByRole('button', { name: /sign in/i }).click();

      // Wait for EITHER dashboard navigation OR login error
      // This avoids waiting the full timeout when credentials are wrong
      const result = await Promise.race([
        page.waitForURL(/.*dashboard/, { timeout: NAVIGATION_TIMEOUT }).then(() => 'dashboard'),
        // Look for error toast or alert messages - be specific to avoid false positives
        page.locator('[data-sonner-toast], [role="alert"], .toast, .error-message')
          .filter({ hasText: /invalid|incorrect|wrong password|does not exist|failed/i })
          .first()
          .waitFor({ state: 'visible', timeout: 15000 })
          .then(() => 'error')
          .catch(() => null), // Ignore if error message doesn't appear
      ]);

      if (result === 'error') {
        throw new Error('Invalid login credentials - user may not exist');
      }

      // Verify we navigated to dashboard
      await page.waitForURL(/.*dashboard/, { timeout: NAVIGATION_TIMEOUT });

      // Verify dashboard loaded - use multiple indicators for mobile compatibility
      // On mobile viewports, the greeting heading may be off-screen initially
      const dashboardIndicators = [
        page.getByRole('heading', { name: /good morning|good afternoon|good evening/i, level: 1 }),
        page.getByRole('link', { name: /dashboard/i }), // Sidebar link
        page.getByText('IntelliFill').first(), // Brand name
      ];

      let foundIndicator = false;
      for (const indicator of dashboardIndicators) {
        try {
          // Try with shorter timeout per indicator
          await indicator.waitFor({ state: 'visible', timeout: Math.floor(DASHBOARD_TIMEOUT / 3) });
          foundIndicator = true;
          break;
        } catch {
          // Try next indicator
        }
      }

      if (!foundIndicator) {
        // Last resort: check we're still on dashboard URL (not redirected to login)
        const currentUrl = page.url();
        if (!currentUrl.includes('dashboard')) {
          throw new Error('Login failed - not on dashboard');
        }
      }

      // Success - exit the retry loop
      return;
    } catch (error) {
      lastError = error as Error;
      const errorMsg = lastError.message || '';

      // If invalid credentials, don't retry - it will always fail
      if (errorMsg.includes('Invalid login credentials')) {
        throw lastError;
      }

      // Check if there's a 503 error displayed on the page (Render cold start)
      const has503Error = await page.getByText(/503|service unavailable/i).isVisible().catch(() => false);
      const hasRequestFailed = await page.getByText(/request failed/i).isVisible().catch(() => false);

      if ((has503Error || hasRequestFailed) && attempt < LOGIN_RETRY_COUNT) {
        // Wait before retrying to allow Render to wake up
        await delay(LOGIN_RETRY_DELAY);
        continue;
      }

      // For other errors or if we've exhausted retries, check if login actually succeeded
      // (URL may have changed but element wasn't found in time)
      const currentUrl = page.url();
      if (currentUrl.includes('dashboard')) {
        // Login succeeded, just dashboard element was slow
        return;
      }

      // If this is not the last attempt, continue to retry
      if (attempt < LOGIN_RETRY_COUNT) {
        await delay(LOGIN_RETRY_DELAY);
        continue;
      }
    }
  }

  // All retries failed
  throw lastError || new Error('Login failed after all retries');
}

/**
 * Logout current user
 *
 * @param page Playwright page object
 */
export async function logout(page: Page): Promise<void> {
  // Find and click the logout button in the user section of the sidebar
  // The user email is displayed near a logout button
  const userEmail = await page.locator('[class*="sidebar"]').getByText(/@/).textContent();
  if (userEmail) {
    const userSection = page.locator('text=' + userEmail).locator('..');
    await userSection.getByRole('button').click();
  }

  // Wait for redirect to login
  await page.waitForURL(/.*login/, { timeout: 10000 });
}

/**
 * Check if user is authenticated
 *
 * @param page Playwright page object
 * @returns True if authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // Try to access protected route
  await page.goto('/dashboard');

  // If redirected to login, not authenticated
  const url = page.url();
  return !url.includes('login');
}

/**
 * Ensure the page is on the app's origin to allow localStorage access
 * This prevents SecurityError when accessing localStorage from about:blank or cross-origin
 *
 * @param page Playwright page object
 */
async function ensureAppOrigin(page: Page): Promise<void> {
  const currentUrl = page.url();

  // Check if we're already on the app's origin
  // about:blank and empty URLs need navigation
  if (currentUrl === 'about:blank' || currentUrl === '' || currentUrl === 'about:srcdoc') {
    // Navigate to the app's root URL (uses baseURL from playwright config)
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  }
}

/**
 * Get authentication token from storage
 *
 * @param page Playwright page object
 * @returns Token string or null
 */
export async function getAuthToken(page: Page): Promise<string | null> {
  // Ensure we're on the app's origin before accessing localStorage
  await ensureAppOrigin(page);

  // Check localStorage for token
  // Backend auth store uses 'intellifill-backend-auth' key with nested structure
  const token = await page.evaluate(() => {
    const authData = localStorage.getItem('intellifill-backend-auth');
    if (!authData) return null;

    try {
      const parsed = JSON.parse(authData);
      return parsed.state?.tokens?.accessToken || null;
    } catch (e) {
      return null;
    }
  });

  return token;
}

/**
 * Set authentication token in storage
 *
 * @param page Playwright page object
 * @param token Authentication token
 */
export async function setAuthToken(page: Page, token: string): Promise<void> {
  // Ensure we're on the app's origin before accessing localStorage
  await ensureAppOrigin(page);

  // Backend auth store uses 'intellifill-backend-auth' key with nested structure
  await page.evaluate((token) => {
    const authData = {
      state: {
        tokens: {
          accessToken: token,
          refreshToken: '',
        },
        user: null,
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
        error: null,
        loginAttempts: 0,
        isLocked: false,
        lockExpiry: null,
        lastActivity: Date.now(),
        rememberMe: false,
        company: null,
      },
      version: 1,
    };
    localStorage.setItem('intellifill-backend-auth', JSON.stringify(authData));
  }, token);
}

/**
 * Clear authentication state
 *
 * @param page Playwright page object
 */
export async function clearAuth(page: Page): Promise<void> {
  // Ensure we're on the app's origin before accessing localStorage
  // This prevents SecurityError when clearing storage from about:blank or cross-origin
  await ensureAppOrigin(page);

  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Clear cookies
  await page.context().clearCookies();
}

/**
 * Navigate to a page using client-side routing (click sidebar link)
 * This avoids full page reload which causes auth re-initialization race conditions
 *
 * @param page Playwright page object
 * @param route Route name (upload, documents, dashboard, etc.)
 */
export async function navigateTo(page: Page, route: string): Promise<void> {
  // Map route names to link text patterns
  const routePatterns: Record<string, RegExp> = {
    upload: /upload/i,
    documents: /document/i,
    dashboard: /dashboard/i,
    history: /history/i,
    profiles: /profile/i,
    templates: /template/i,
    settings: /setting/i,
    'fill-form': /intelligent fill|fill form/i,
  };

  const pattern = routePatterns[route.toLowerCase()];
  if (!pattern) {
    // Fallback to page.goto for unknown routes
    await page.goto(`/${route}`);
    return;
  }

  // Click sidebar link for client-side navigation
  const link = page.getByRole('link', { name: pattern }).first();
  await link.click();
  await page.waitForURL(new RegExp(`.*${route}`));
}
