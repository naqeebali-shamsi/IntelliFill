import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../playwright.config';

/**
 * Authentication Flow Tests
 *
 * Tests login, logout, registration, and protected routes.
 */
test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Start at the login page
    await page.goto('/login');
  });

  test('should display login page', async ({ page }) => {
    // Verify login page loads
    await expect(page).toHaveURL(/.*login/);
    // CardTitle renders as div, not heading - use text selector
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    // Fill in login form
    await page.getByLabel(/email/i).fill(TEST_USERS.user.email);
    await page.getByLabel(/password/i).fill(TEST_USERS.user.password);

    // Submit form
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should navigate to dashboard
    await page.waitForURL(/.*dashboard/, { timeout: 15000 });

    // Verify dashboard content is visible (greeting heading shows user is logged in)
    await expect(page.getByRole('heading', { name: /good morning|good afternoon|good evening/i, level: 1 })).toBeVisible({ timeout: 5000 });

    // Verify user email is displayed in sidebar
    await expect(page.getByText(TEST_USERS.user.email)).toBeVisible({ timeout: 5000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill in login form with wrong password
    await page.getByLabel(/email/i).fill(TEST_USERS.user.email);
    await page.getByLabel(/password/i).fill('WrongPassword123!');

    // Submit form
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for error message in the form alert (not the toast)
    // The error appears in both places, so we specifically check the form alert
    await expect(
      page.locator('form').getByText(/invalid email or password/i)
    ).toBeVisible({ timeout: 30000 });

    // Should stay on login page
    await expect(page).toHaveURL(/.*login/);
  });

  test('should validate required fields', async ({ page }) => {
    // Try to submit empty form
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show validation errors (HTML5 validation or form validation)
    await expect(
      page.getByText(/email.*required|please.*enter.*email/i).or(
        page.locator('input[type="email"]:invalid')
      )
    ).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.getByLabel(/email/i).fill(TEST_USERS.user.email);
    await page.getByLabel(/password/i).fill(TEST_USERS.user.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for dashboard
    await page.waitForURL(/.*dashboard/, { timeout: 15000 });
    await expect(page.getByText(TEST_USERS.user.email)).toBeVisible({ timeout: 5000 });

    // Find the logout button - it's a sibling button in the user profile section
    // The user email is in a sidebar section, and the logout button is next to it
    // Go up 2 levels from the email paragraph to reach the container that has the button
    const userEmailElement = page.getByText(TEST_USERS.user.email);
    const userSection = userEmailElement.locator('..').locator('..');
    const logoutButton = userSection.getByRole('button');
    await logoutButton.click();

    // Should redirect to login page
    await page.waitForURL(/.*login/, { timeout: 10000 });

    // Verify login page content
    await expect(page.getByText('Welcome back')).toBeVisible({ timeout: 5000 });
  });

  test('should protect dashboard route when not logged in', async ({ page }) => {
    // Try to access dashboard without login
    await page.goto('/dashboard');

    // Should redirect to login - verify by checking login page content (CardTitle is div, not heading)
    await expect(page.getByText('Welcome back')).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to registration page', async ({ page }) => {
    // Click on register link (text is "Sign up" in Login.tsx)
    await page.getByRole('link', { name: /sign up/i }).click();

    // Should navigate to register page - verify by checking content (CardTitle is div, not heading)
    await expect(page.getByText('Create an account')).toBeVisible({ timeout: 5000 });
  });

  /**
   * Session Persistence Test
   *
   * Tests that the session persists after page reload using:
   * 1. Zustand persist middleware (stores tokens in localStorage)
   * 2. onRehydrateStorage callback (validates tokens on reload)
   * 3. Backend /api/auth/v2/me validation
   *
   * PRE-REQUISITES:
   * - E2E test users must be seeded: npx ts-node scripts/seed-e2e-users.ts
   * - Users: test@intellifill.local / Test123!@#
   *         admin@intellifill.local / Admin123!@#
   *
   * Session persistence logic (backendAuthStore.ts):
   * - Login stores tokens via persist middleware
   * - On reload, onRehydrateStorage calls store.initialize()
   * - initialize() calls authService.getMe() to validate token
   * - If valid, user remains authenticated
   */
  test('should persist session after page reload', async ({ page }) => {
    // Login
    await page.getByLabel(/email/i).fill(TEST_USERS.user.email);
    await page.getByLabel(/password/i).fill(TEST_USERS.user.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for dashboard (may timeout if test users not seeded)
    // The waitForURL will timeout with clear error message if login fails
    await page.waitForURL(/.*dashboard/, { timeout: 30000 });
    await expect(page.getByRole('heading', { name: /good morning|good afternoon|good evening/i, level: 1 })).toBeVisible({ timeout: 10000 });

    // Wait for network to be idle before reloading (ensures session is saved)
    await page.waitForLoadState('networkidle');

    // Wait for Zustand persist to save auth state to localStorage
    await page.waitForFunction(() => {
      const auth = localStorage.getItem('intellifill-backend-auth');
      if (!auth) return false;
      try {
        const parsed = JSON.parse(auth);
        return parsed.state?.sessionIndicator === true || parsed.state?.isAuthenticated === true;
      } catch {
        return false;
      }
    }, { timeout: 10000 });

    // Reload page - this tests session persistence
    await page.reload();

    // Wait for auth initialization to complete after reload
    // The app needs to: 1) rehydrate from localStorage, 2) detect missing in-memory token,
    // 3) call silent refresh using httpOnly cookie, 4) restore session
    await page.waitForLoadState('networkidle');

    // Wait for either successful auth initialization OR redirect to login
    // This gives the silent refresh time to complete
    await page.waitForFunction(() => {
      // Check if still loading
      const loadingSpinner = document.querySelector('[class*="animate-spin"]');
      if (loadingSpinner) return false; // Still loading

      // Check if auth is restored
      const auth = localStorage.getItem('intellifill-backend-auth');
      if (!auth) return true; // No auth = initialization complete (failed)
      try {
        const parsed = JSON.parse(auth);
        // Wait for loadingStage to be 'ready' or isInitialized to be true
        return parsed.state?.loadingStage === 'ready' || parsed.state?.isInitialized === true;
      } catch {
        return true;
      }
    }, { timeout: 20000 });

    // After reload, the session should be restored from localStorage
    // The onRehydrateStorage callback validates the token with the backend
    // Should still show dashboard content (session persisted via Zustand persist + backend validation)
    await expect(page.getByRole('heading', { name: /good morning|good afternoon|good evening/i, level: 1 })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(TEST_USERS.user.email)).toBeVisible({ timeout: 5000 });
  });
});

/**
 * Admin User Authentication Tests
 */
test.describe('Admin Authentication', () => {
  test('should login as admin', async ({ page }) => {
    await page.goto('/login');

    // Fill in admin credentials
    await page.getByLabel(/email/i).fill(TEST_USERS.admin.email);
    await page.getByLabel(/password/i).fill(TEST_USERS.admin.password);

    // Submit form
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should navigate to dashboard
    await page.waitForURL(/.*dashboard/, { timeout: 15000 });

    // Verify dashboard content and admin user email
    await expect(page.getByRole('heading', { name: /good morning|good afternoon|good evening/i, level: 1 })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(TEST_USERS.admin.email)).toBeVisible({ timeout: 5000 });
  });
});
