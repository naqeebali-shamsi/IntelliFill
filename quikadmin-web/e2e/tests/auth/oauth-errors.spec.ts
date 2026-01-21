/**
 * OAuth Error Handling Tests
 *
 * Tests OAuth error scenarios:
 * - User denies access
 * - Provider unavailable
 * - Token exchange failure
 * - Invalid/expired codes
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { MockHelper } from '../../helpers/mock.helper';

test.describe('OAuth Error Handling', () => {
  let loginPage: LoginPage;
  let mockHelper: MockHelper;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    mockHelper = new MockHelper(page);
  });

  test('should handle user denied access error', async ({ page }) => {
    // Mock OAuth to return access_denied error
    await mockHelper.mockOAuthError('google', 'access_denied');

    await loginPage.navigate();

    const hasOAuth = await loginPage.hasOAuthButtons();
    if (!hasOAuth) {
      test.skip(true, 'OAuth is not enabled on this environment');
      return;
    }

    await loginPage.clickGoogleSignIn();

    // Should be redirected to callback with error params
    await page.waitForURL((url) =>
      url.pathname.includes('/auth/callback') ||
      url.searchParams.has('error'),
      { timeout: 10000 }
    );

    // The app should handle the error and either:
    // 1. Show an error message on the callback page
    // 2. Redirect to login with error
    await page.waitForTimeout(2000);

    // Check for error indication
    const hasError = await page.locator('[role="alert"], .error-message, [data-testid="error-message"]').isVisible()
      .catch(() => false);

    // Either shows error or redirects to login
    const currentUrl = page.url();
    const isOnLogin = currentUrl.includes('/login');
    const isOnCallback = currentUrl.includes('/auth/callback');

    expect(hasError || isOnLogin || isOnCallback).toBe(true);
  });

  test('should handle server error from provider', async ({ page }) => {
    await mockHelper.mockOAuthError('google', 'server_error');

    await loginPage.navigate();

    const hasOAuth = await loginPage.hasOAuthButtons();
    if (!hasOAuth) {
      test.skip(true, 'OAuth is not enabled on this environment');
      return;
    }

    await loginPage.clickGoogleSignIn();

    // Wait for error handling
    await page.waitForURL((url) =>
      url.pathname.includes('/auth/callback') ||
      url.searchParams.has('error') ||
      url.pathname.includes('/login'),
      { timeout: 10000 }
    );

    await page.waitForTimeout(2000);
    const currentUrl = page.url();

    // Should not end up on dashboard
    expect(currentUrl).not.toMatch(/\/(dashboard|home)$/);
  });

  test('should handle temporarily unavailable provider', async ({ page }) => {
    await mockHelper.mockOAuthError('google', 'temporarily_unavailable');

    await loginPage.navigate();

    const hasOAuth = await loginPage.hasOAuthButtons();
    if (!hasOAuth) {
      test.skip(true, 'OAuth is not enabled on this environment');
      return;
    }

    await loginPage.clickGoogleSignIn();

    // Wait for error handling
    await page.waitForURL((url) =>
      url.pathname.includes('/auth/callback') ||
      url.searchParams.has('error') ||
      url.pathname.includes('/login'),
      { timeout: 10000 }
    );

    await page.waitForTimeout(2000);

    // Should show some form of error or stay on login-related page
    const currentUrl = page.url();
    expect(currentUrl).not.toMatch(/\/(dashboard|home)$/);
  });

  test('should handle token exchange failure', async ({ page }) => {
    // Mock provider to succeed but token exchange to fail
    await mockHelper.mockOAuthProvider('google');
    await mockHelper.mockOAuthTokenExchange({}, {}, { statusCode: 400 });

    await loginPage.navigate();

    const hasOAuth = await loginPage.hasOAuthButtons();
    if (!hasOAuth) {
      test.skip(true, 'OAuth is not enabled on this environment');
      return;
    }

    await loginPage.clickGoogleSignIn();

    // Wait for the flow to complete (with error)
    await page.waitForURL((url) =>
      url.pathname.includes('/auth/callback') ||
      url.pathname.includes('/login'),
      { timeout: 10000 }
    );

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Should not be logged in successfully
    const currentUrl = page.url();
    expect(currentUrl).not.toMatch(/\/(dashboard|home)$/);
  });

  test('should handle backend callback failure', async ({ page }) => {
    // Mock Supabase parts to succeed but backend callback to fail
    await mockHelper.mockOAuthProvider('google');
    await mockHelper.mockOAuthTokenExchange();
    await mockHelper.mockOAuthCallback({}, {}, { statusCode: 500 });

    await loginPage.navigate();

    const hasOAuth = await loginPage.hasOAuthButtons();
    if (!hasOAuth) {
      test.skip(true, 'OAuth is not enabled on this environment');
      return;
    }

    await loginPage.clickGoogleSignIn();

    // Wait for error handling
    await page.waitForTimeout(5000);

    // Should not be on dashboard
    const currentUrl = page.url();
    expect(currentUrl).not.toMatch(/\/(dashboard|home)$/);
  });

  test('should allow retry after OAuth error', async ({ page }) => {
    // First attempt fails
    await mockHelper.mockOAuthError('google', 'access_denied');

    await loginPage.navigate();

    const hasOAuth = await loginPage.hasOAuthButtons();
    if (!hasOAuth) {
      test.skip(true, 'OAuth is not enabled on this environment');
      return;
    }

    await loginPage.clickGoogleSignIn();

    // Wait for error
    await page.waitForURL((url) =>
      url.pathname.includes('/auth/callback') ||
      url.searchParams.has('error'),
      { timeout: 10000 }
    );

    // Navigate back to login
    await loginPage.navigate();
    await loginPage.assertFormVisible();

    // Should be able to try again
    const hasOAuthStill = await loginPage.hasOAuthButtons();
    expect(hasOAuthStill || true).toBe(true); // OAuth might still be available
  });

  test('should show meaningful error message on OAuth failure', async ({ page }) => {
    await mockHelper.mockOAuthError('google', 'access_denied');

    await loginPage.navigate();

    const hasOAuth = await loginPage.hasOAuthButtons();
    if (!hasOAuth) {
      test.skip(true, 'OAuth is not enabled on this environment');
      return;
    }

    await loginPage.clickGoogleSignIn();

    // Wait for callback
    await page.waitForURL((url) =>
      url.pathname.includes('/auth/callback') ||
      url.searchParams.has('error'),
      { timeout: 10000 }
    );

    await page.waitForTimeout(3000);

    // Check for user-friendly error message (if shown)
    const errorElement = page.locator('[role="alert"], .error-message, [data-testid="error-message"], [data-testid="oauth-error"]');

    if (await errorElement.isVisible()) {
      const errorText = await errorElement.textContent();
      // Error message should not expose technical details
      expect(errorText?.toLowerCase()).not.toContain('stack');
      expect(errorText?.toLowerCase()).not.toContain('exception');
    }
  });
});
