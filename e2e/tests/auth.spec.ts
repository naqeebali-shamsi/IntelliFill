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

    // Should show dashboard content (more robust than URL check)
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({ timeout: 15000 });

    // Verify user is logged in (check for sign out button)
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible({ timeout: 5000 });
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

    // Wait for dashboard content
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({ timeout: 15000 });

    // Click sign out button
    const logoutButton = page.getByRole('button', { name: /sign out/i });
    await logoutButton.click();

    // Should show login page content (CardTitle is div, not heading)
    await expect(page.getByText('Welcome back')).toBeVisible({ timeout: 10000 });

    // Verify user is logged out (try to access protected route)
    await page.goto('/dashboard');
    // Should redirect to login - verify by checking login page content
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

  test('should persist session after page reload', async ({ page }) => {
    // Login
    await page.getByLabel(/email/i).fill(TEST_USERS.user.email);
    await page.getByLabel(/password/i).fill(TEST_USERS.user.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for dashboard content
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({ timeout: 15000 });

    // Reload page
    await page.reload();

    // Should still show dashboard content (session persisted)
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
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

    // Should show dashboard content
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible({ timeout: 15000 });

    // Verify admin user is logged in
    await expect(page.getByText(TEST_USERS.admin.email)).toBeVisible({ timeout: 5000 });
  });
});
