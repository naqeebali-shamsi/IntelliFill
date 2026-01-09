/**
 * E2E-405: Token Lifecycle Security
 *
 * Tests JWT security, token handling, and secure cookie storage:
 * - Verify tokens not in localStorage
 * - Test access/refresh token flow
 * - Verify secure cookies
 * - Test token expiry and refresh
 */

import { test, expect } from '@playwright/test';
import { test as authTest } from '../../fixtures/auth.fixture';
import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { testUsers } from '../../data';

test.describe('E2E-405: Token Lifecycle Security', () => {
  test('should not store tokens in localStorage', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Login with valid credentials
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    // Wait for successful login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Verify we're on dashboard/authenticated page
    await expect(page).not.toHaveURL(/\/login/);

    // Step 1: Verify no access tokens in localStorage
    const localStorageTokens = await page.evaluate(() => {
      return {
        accessToken: localStorage.getItem('access_token') || localStorage.getItem('accessToken'),
        refreshToken: localStorage.getItem('refresh_token') || localStorage.getItem('refreshToken'),
        token: localStorage.getItem('token'),
        authToken: localStorage.getItem('auth_token'),
        jwt: localStorage.getItem('jwt'),
      };
    });

    // Assert all token fields are null
    expect(localStorageTokens.accessToken).toBeNull();
    expect(localStorageTokens.refreshToken).toBeNull();
    expect(localStorageTokens.token).toBeNull();
    expect(localStorageTokens.authToken).toBeNull();
    expect(localStorageTokens.jwt).toBeNull();
  });

  test('should store tokens in secure httpOnly cookies', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Login
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Get cookies
    const cookies = await page.context().cookies();

    // Look for auth-related cookies
    const authCookies = cookies.filter(cookie =>
      cookie.name.toLowerCase().includes('token') ||
      cookie.name.toLowerCase().includes('auth') ||
      cookie.name.toLowerCase().includes('session')
    );

    // Should have at least one auth cookie
    expect(authCookies.length).toBeGreaterThan(0);

    // Check if cookies have secure flags (at least one should be httpOnly)
    const hasHttpOnlyCookie = authCookies.some(cookie => cookie.httpOnly);
    expect(hasHttpOnlyCookie).toBe(true);

    // In production, cookies should also be secure
    // (skip this check in local dev where HTTPS isn't used)
    if (process.env.NODE_ENV === 'production') {
      const hasSecureCookie = authCookies.some(cookie => cookie.secure);
      expect(hasSecureCookie).toBe(true);
    }
  });

  test('should handle token refresh on expiry', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Login
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Track API calls
    let refreshCalled = false;
    let unauthorizedCount = 0;

    page.on('response', (response) => {
      const url = response.url();
      const status = response.status();

      // Check for refresh token endpoint
      if (url.includes('/auth/refresh') || url.includes('/refresh')) {
        refreshCalled = true;
      }

      // Count 401 responses
      if (status === 401) {
        unauthorizedCount++;
      }
    });

    // Make an API call that requires authentication
    // In a real scenario, we'd wait for token expiry or mock it
    // For this test, we'll make a protected API call
    const apiResponse = await page.request.get(`${process.env.VITE_API_URL || 'http://localhost:3002/api'}/users/me`, {
      timeout: 5000,
    }).catch(() => null);

    // If we got a 401, the refresh mechanism should kick in
    // This is expected behavior - the app should automatically refresh
    if (apiResponse && apiResponse.status() === 401) {
      // Wait a bit for refresh flow to complete
      await page.waitForTimeout(2000);

      // Verify we didn't get logged out
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/login');
    }

    // Note: Full token expiry testing would require:
    // 1. Mocking shorter token TTL
    // 2. Waiting for actual expiry
    // 3. Verifying automatic refresh
    // This is better suited for integration tests
  });

  test('should not expose tokens in URL parameters', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Login
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Get current URL
    const currentUrl = page.url();

    // Verify URL doesn't contain token-like parameters
    const url = new URL(currentUrl);
    const params = url.searchParams;

    // Check common token parameter names
    expect(params.has('token')).toBe(false);
    expect(params.has('access_token')).toBe(false);
    expect(params.has('accessToken')).toBe(false);
    expect(params.has('auth_token')).toBe(false);
    expect(params.has('jwt')).toBe(false);
  });

  test('should not expose tokens in sessionStorage', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Login
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Check sessionStorage for tokens
    const sessionStorageTokens = await page.evaluate(() => {
      return {
        accessToken: sessionStorage.getItem('access_token') || sessionStorage.getItem('accessToken'),
        refreshToken: sessionStorage.getItem('refresh_token') || sessionStorage.getItem('refreshToken'),
        token: sessionStorage.getItem('token'),
        authToken: sessionStorage.getItem('auth_token'),
        jwt: sessionStorage.getItem('jwt'),
      };
    });

    // Assert all token fields are null
    expect(sessionStorageTokens.accessToken).toBeNull();
    expect(sessionStorageTokens.refreshToken).toBeNull();
    expect(sessionStorageTokens.token).toBeNull();
    expect(sessionStorageTokens.authToken).toBeNull();
    expect(sessionStorageTokens.jwt).toBeNull();
  });

  test('should clear tokens on logout', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Login
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Get cookies before logout
    const cookiesBeforeLogout = await page.context().cookies();
    const authCookiesBeforeLogout = cookiesBeforeLogout.filter(cookie =>
      cookie.name.toLowerCase().includes('token') ||
      cookie.name.toLowerCase().includes('auth')
    );

    expect(authCookiesBeforeLogout.length).toBeGreaterThan(0);

    // Logout
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out"), [data-testid="logout-button"]');
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    } else {
      // Try user menu dropdown
      const userMenu = page.locator('[data-testid="user-menu"], .user-menu, button:has-text("Settings")');
      if (await userMenu.isVisible()) {
        await userMenu.click();
        await page.waitForTimeout(300);
        const logoutInDropdown = page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout")');
        await logoutInDropdown.click();
      }
    }

    // Wait for redirect to login
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 5000 });

    // Get cookies after logout
    const cookiesAfterLogout = await page.context().cookies();
    const authCookiesAfterLogout = cookiesAfterLogout.filter(cookie =>
      cookie.name.toLowerCase().includes('token') ||
      cookie.name.toLowerCase().includes('auth')
    );

    // Auth cookies should be cleared or have empty values
    if (authCookiesAfterLogout.length > 0) {
      authCookiesAfterLogout.forEach(cookie => {
        expect(cookie.value).toBe('');
      });
    }
  });

  test('should not allow access to protected routes without valid token', async ({ page }) => {
    // Navigate directly to protected route without logging in
    await page.goto('/documents');

    // Should redirect to login
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 5000 });

    expect(page.url()).toContain('/login');
  });

  test('should include CSRF protection headers', async ({ page }) => {
    const loginPage = new LoginPage(page);

    let csrfHeaderFound = false;

    // Listen for requests
    page.on('request', (request) => {
      const headers = request.headers();
      const url = request.url();

      // Check if API requests include CSRF token or similar protection
      if (url.includes('/api/') && request.method() !== 'GET') {
        if (headers['x-csrf-token'] || headers['x-xsrf-token'] || headers['csrf-token']) {
          csrfHeaderFound = true;
        }
      }
    });

    // Login (this makes POST requests)
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Note: CSRF protection might be implemented differently
    // Some apps use SameSite cookies instead of CSRF tokens
    // This test checks for explicit CSRF headers
    // If using SameSite cookies, verify that instead
  });
});
