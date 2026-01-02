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

/**
 * Login as a user
 *
 * @param page Playwright page object
 * @param user User credentials
 */
export async function loginAsUser(page: Page, user: TestUser): Promise<void> {
  // Navigate to login page
  await page.goto('/login');

  // Fill in credentials
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);

  // Submit form
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for dashboard - using URL check and greeting heading
  await page.waitForURL(/.*dashboard/, { timeout: 15000 });

  // Verify dashboard content is visible (greeting heading shows user is logged in)
  await page.getByRole('heading', { name: /good morning|good afternoon|good evening/i, level: 1 }).waitFor({ state: 'visible', timeout: 5000 });

  // Verify user email is displayed in sidebar (confirms authentication worked)
  await page.getByText(user.email).waitFor({ state: 'visible', timeout: 5000 });
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
 * Get authentication token from storage
 *
 * @param page Playwright page object
 * @returns Token string or null
 */
export async function getAuthToken(page: Page): Promise<string | null> {
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
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Clear cookies
  await page.context().clearCookies();
}
