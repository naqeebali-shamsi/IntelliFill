import { test, expect } from '@playwright/test';

/**
 * Smoke Tests
 *
 * Basic health checks to verify the application is running and accessible.
 * These tests should run first and fail fast if infrastructure is broken.
 */
test.describe('Smoke Tests', () => {
  test('frontend should be accessible', async ({ page }) => {
    // Visit the homepage
    const response = await page.goto('/');

    // Should return 200 OK
    expect(response?.status()).toBe(200);

    // Should render page
    await expect(page.locator('body')).toBeVisible();
  });

  test('should load login page', async ({ page }) => {
    await page.goto('/login');

    // Should have login form
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('API health endpoint should respond', async ({ request }) => {
    const apiUrl = process.env.API_URL || 'http://backend-test:3002/api';

    // Call health endpoint
    const response = await request.get(`${apiUrl.replace('/api', '')}/health`);

    // Should return 200 OK
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    // Should return JSON
    const body = await response.json();
    expect(body).toHaveProperty('status');
  });

  test('should redirect to login when accessing protected routes', async ({ page }) => {
    // Try to access dashboard without authentication
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/.*login/, { timeout: 5000 });
  });

  test('should have correct page title', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/IntelliFill|QuikAdmin/i);
  });

  test('navigation links should be present', async ({ page }) => {
    await page.goto('/login');

    // Check for register link on login page
    const registerLink = page.getByRole('link', { name: /sign up/i });
    await expect(registerLink).toBeVisible();

    // Verify the link points to register page
    await expect(registerLink).toHaveAttribute('href', '/register');
  });
});
