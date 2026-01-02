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

  // SKIPPED: Session persistence after page reload
  // This test is currently failing because the application does not properly restore
  // the session from localStorage after a page reload. This is a known issue that
  // needs to be fixed in the frontend authentication store.
  // See: backendAuthStore.ts - the rehydrate logic needs to restore the session
  test('should persist session after page reload', async ({ page }) => {
    // Login
    await page.getByLabel(/email/i).fill(TEST_USERS.user.email);
    await page.getByLabel(/password/i).fill(TEST_USERS.user.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for dashboard to fully load
    await page.waitForURL(/.*dashboard/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /good morning|good afternoon|good evening/i, level: 1 })).toBeVisible({ timeout: 5000 });
    
    // Wait for network to be idle before reloading (ensures session is saved)
    await page.waitForLoadState('networkidle');

    // Reload page
    await page.reload();

    // Should still show dashboard content (session persisted)
    await expect(page.getByRole('heading', { name: /good morning|good afternoon|good evening/i, level: 1 })).toBeVisible({ timeout: 10000 });
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
