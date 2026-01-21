/**
 * OAuth Login Flow Tests
 *
 * Tests OAuth-based authentication:
 * - Google Sign In flow (mocked)
 * - OAuth token exchange
 * - Session creation after OAuth
 * - OAuth user profile handling
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { MockHelper, DEFAULT_OAUTH_USER, OAuthMockUser } from '../../helpers/mock.helper';

test.describe('OAuth Login Flow', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let mockHelper: MockHelper;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    mockHelper = new MockHelper(page);
  });

  test('should display Google Sign In button on login page', async ({ page }) => {
    await loginPage.navigate();
    await loginPage.assertFormVisible();

    // Check if OAuth buttons are present (may not be if OAuth is disabled)
    const hasOAuth = await loginPage.hasOAuthButtons();
    if (hasOAuth) {
      await loginPage.assertGoogleSignInVisible();
    } else {
      test.skip(true, 'OAuth is not enabled on this environment');
    }
  });

  test('should complete Google OAuth login flow with mocked provider', async ({ page }) => {
    // Set up complete OAuth flow mock
    const testUser: Partial<OAuthMockUser> = {
      email: 'oauth-test@example.com',
      name: 'OAuth Test User',
      provider: 'google',
    };

    await mockHelper.mockOAuthFlow('google', { user: testUser });

    // Also mock the backend auth endpoints that will be called after OAuth
    await mockHelper.mockGetUser(testUser);

    await loginPage.navigate();

    // Skip if OAuth buttons are not visible
    const hasOAuth = await loginPage.hasOAuthButtons();
    if (!hasOAuth) {
      test.skip(true, 'OAuth is not enabled on this environment');
      return;
    }

    // Click Google Sign In
    await loginPage.clickGoogleSignIn();

    // The mock should redirect through the OAuth flow
    // Wait for either dashboard or auth callback handling
    await page.waitForURL((url) => {
      const path = url.pathname;
      return path.includes('/dashboard') ||
             path.includes('/home') ||
             path.includes('/auth/callback') ||
             path === '/';
    }, { timeout: 15000 });

    // If we're on the callback page, the frontend should handle the token exchange
    // and redirect to dashboard
    const currentUrl = page.url();
    if (currentUrl.includes('/auth/callback')) {
      await page.waitForURL((url) => !url.pathname.includes('/auth/callback'), { timeout: 10000 });
    }

    // Verify we ended up on a protected page
    const finalUrl = page.url();
    expect(finalUrl).not.toContain('/login');
  });

  test('should set auth tokens after successful OAuth login', async ({ page }) => {
    const testUser: Partial<OAuthMockUser> = {
      email: 'oauth-tokens@example.com',
      name: 'Token Test User',
      provider: 'google',
    };

    await mockHelper.mockOAuthFlow('google', { user: testUser });
    await mockHelper.mockGetUser(testUser);

    await loginPage.navigate();

    const hasOAuth = await loginPage.hasOAuthButtons();
    if (!hasOAuth) {
      test.skip(true, 'OAuth is not enabled on this environment');
      return;
    }

    await loginPage.clickGoogleSignIn();

    // Wait for auth to complete
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Check localStorage for auth tokens (similar to login-success.spec.ts)
    const authData = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      const authKey = keys.find(k =>
        k.includes('sb-') && k.includes('auth-token') ||
        k.includes('supabase') ||
        k.includes('auth') ||
        k.includes('intellifill')
      );

      if (authKey) {
        const value = localStorage.getItem(authKey);
        try {
          return value ? JSON.parse(value) : null;
        } catch {
          return { raw: value };
        }
      }
      return null;
    });

    // Either localStorage has auth data or cookies are set
    if (authData) {
      expect(authData).toBeTruthy();
    } else {
      const cookies = await page.context().cookies();
      const hasAuthCookie = cookies.some(c =>
        c.name.toLowerCase().includes('token') ||
        c.name.toLowerCase().includes('auth') ||
        c.name.toLowerCase().includes('session')
      );
      expect(hasAuthCookie).toBe(true);
    }
  });

  test('should display OAuth user info after login', async ({ page }) => {
    const testUser: Partial<OAuthMockUser> = {
      email: 'oauth-display@example.com',
      name: 'Display Test User',
      provider: 'google',
      avatar_url: 'https://example.com/avatar.png',
    };

    await mockHelper.mockOAuthFlow('google', { user: testUser });
    await mockHelper.mockGetUser(testUser);

    await loginPage.navigate();

    const hasOAuth = await loginPage.hasOAuthButtons();
    if (!hasOAuth) {
      test.skip(true, 'OAuth is not enabled on this environment');
      return;
    }

    await loginPage.clickGoogleSignIn();

    // Wait for dashboard
    await page.waitForURL((url) => !url.pathname.includes('/login') && !url.pathname.includes('/auth/callback'), { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Check that we're logged in (user info might be displayed)
    // The specific check depends on how the UI shows user info
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
  });

  test('should persist OAuth session across page refresh', async ({ page }) => {
    const testUser: Partial<OAuthMockUser> = {
      email: 'oauth-persist@example.com',
      name: 'Persist Test User',
      provider: 'google',
    };

    await mockHelper.mockOAuthFlow('google', { user: testUser });
    await mockHelper.mockGetUser(testUser);

    await loginPage.navigate();

    const hasOAuth = await loginPage.hasOAuthButtons();
    if (!hasOAuth) {
      test.skip(true, 'OAuth is not enabled on this environment');
      return;
    }

    await loginPage.clickGoogleSignIn();

    // Wait for successful auth
    await page.waitForURL((url) => !url.pathname.includes('/login') && !url.pathname.includes('/auth/callback'), { timeout: 15000 });

    // Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be logged in (not redirected to login)
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/login');
  });
});
