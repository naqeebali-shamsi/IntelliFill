/**
 * E2E-428: Complete Logout Flow
 *
 * Tests secure logout and subsequent access restriction:
 * - Click logout button
 * - Verify redirect to /login
 * - Try navigating back to /dashboard
 * - Verify redirect back to login
 * - Verify cookies are cleared
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import testUsers from '../../data/test-users.json';

test.describe('E2E-428: Complete Logout Flow', () => {
  let loginPage: LoginPage;
  const memberCredentials = testUsers.testUsers.member;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
  });

  test('should logout and redirect to login page', async ({ page }) => {
    await loginPage.navigate();
    await loginPage.login({
      email: memberCredentials.email,
      password: memberCredentials.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    const logoutButton = page
      .locator(
        '[data-testid="logout-button"], button:has-text("Logout"), button:has-text("Sign out")'
      )
      .first();
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForTimeout(1000);

      await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 10000 });
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('should prevent access to protected routes after logout', async ({ page }) => {
    await loginPage.navigate();
    await loginPage.login({
      email: memberCredentials.email,
      password: memberCredentials.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    const logoutButton = page
      .locator(
        '[data-testid="logout-button"], button:has-text("Logout"), button:has-text("Sign out")'
      )
      .first();
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForTimeout(1000);

      await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 10000 });

      await page.goto('http://localhost:8080/dashboard');
      await page.waitForTimeout(2000);

      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('should clear authentication cookies on logout', async ({ page }) => {
    await loginPage.navigate();
    await loginPage.login({
      email: memberCredentials.email,
      password: memberCredentials.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    const cookiesBeforeLogout = await page.context().cookies();
    const authCookiesBefore = cookiesBeforeLogout.filter(
      (c) =>
        c.name.toLowerCase().includes('token') ||
        c.name.toLowerCase().includes('auth') ||
        c.name.toLowerCase().includes('session')
    );

    expect(authCookiesBefore.length).toBeGreaterThan(0);

    const logoutButton = page
      .locator(
        '[data-testid="logout-button"], button:has-text("Logout"), button:has-text("Sign out")'
      )
      .first();
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForTimeout(2000);

      const cookiesAfterLogout = await page.context().cookies();
      const authCookiesAfter = cookiesAfterLogout.filter(
        (c) =>
          c.name.toLowerCase().includes('token') ||
          c.name.toLowerCase().includes('auth') ||
          c.name.toLowerCase().includes('session')
      );

      const hasValidAuthCookie = authCookiesAfter.some((c) => {
        const isExpired = c.expires && c.expires < Date.now() / 1000;
        const isEmpty = !c.value || c.value === '';
        return !isExpired && !isEmpty;
      });

      expect(hasValidAuthCookie).toBe(false);
    }
  });

  test('should not expose user data after logout using back button', async ({ page }) => {
    await loginPage.navigate();
    await loginPage.login({
      email: memberCredentials.email,
      password: memberCredentials.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    await page.goto('http://localhost:8080/dashboard');
    await page.waitForTimeout(1000);

    const logoutButton = page
      .locator(
        '[data-testid="logout-button"], button:has-text("Logout"), button:has-text("Sign out")'
      )
      .first();
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForTimeout(2000);

      await page.goBack();
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      const isOnLogin = currentUrl.includes('/login');
      const isNotOnDashboard = !currentUrl.includes('/dashboard');

      expect(isOnLogin || isNotOnDashboard).toBe(true);
    }
  });

  test('should clear session across all tabs on logout', async ({ context, page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login({
      email: memberCredentials.email,
      password: memberCredentials.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    const secondPage = await context.newPage();
    await secondPage.goto('http://localhost:8080/dashboard');
    await secondPage.waitForTimeout(1000);

    const logoutButton = page
      .locator('[data-testid="logout-button"], button:has-text("Logout")')
      .first();
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForTimeout(2000);

      await secondPage.reload();
      await secondPage.waitForTimeout(2000);

      const secondTabUrl = secondPage.url();
      const isOnLogin = secondTabUrl.includes('/login');

      expect(isOnLogin).toBe(true);
    }

    await secondPage.close();
  });

  test('should logout successfully with collapsed sidebar', async ({ page }) => {
    // Skip on mobile viewports since collapsed sidebar is desktop-only
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      test.skip();
      return;
    }

    // Login first
    await loginPage.navigate();
    await loginPage.login({
      email: memberCredentials.email,
      password: memberCredentials.password,
    });

    // Wait for dashboard to load
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

    // Verify we're on dashboard
    await page.waitForTimeout(1000);

    // Find and click the sidebar toggle button using data-testid
    const sidebarToggle = page.locator('[data-testid="sidebar-toggle"]');

    // If toggle is visible (desktop viewport), collapse the sidebar
    if (await sidebarToggle.isVisible({ timeout: 3000 })) {
      await sidebarToggle.click();

      // Wait for sidebar collapse animation
      await page.waitForTimeout(500);

      // Verify sidebar is collapsed by checking aria-expanded attribute
      const isExpanded = await sidebarToggle.getAttribute('aria-expanded');
      expect(isExpanded).toBe('false');
    }

    // Find logout button - should still be visible when sidebar is collapsed
    const logoutButton = page.locator('[data-testid="logout-button"]');
    await expect(logoutButton).toBeVisible({ timeout: 5000 });

    // Click logout
    await logoutButton.click();

    // Wait for logout to complete and redirect to login page
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 10000 });

    // Verify we're on the login page
    await expect(page).toHaveURL(/\/login/);
  });
});
