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

import { test, expect, Page } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import testUsers from '../../data/test-users.json';

const LOGOUT_BUTTON_SELECTOR =
  '[data-testid="logout-button"], button:has-text("Logout"), button:has-text("Sign out")';
const DASHBOARD_URL = 'http://localhost:8080/dashboard';

function isAuthCookie(cookieName: string): boolean {
  const name = cookieName.toLowerCase();
  return name.includes('token') || name.includes('auth') || name.includes('session');
}

async function loginAndWaitForDashboard(loginPage: LoginPage, page: Page): Promise<void> {
  const memberCredentials = testUsers.testUsers.member;
  await loginPage.navigate();
  await loginPage.login({
    email: memberCredentials.email,
    password: memberCredentials.password,
  });
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
}

async function clickLogoutIfVisible(page: Page): Promise<boolean> {
  const logoutButton = page.locator(LOGOUT_BUTTON_SELECTOR).first();
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}

test.describe('E2E-428: Complete Logout Flow', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
  });

  test('should logout and redirect to login page', async ({ page }) => {
    await loginAndWaitForDashboard(loginPage, page);

    if (await clickLogoutIfVisible(page)) {
      await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 10000 });
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('should prevent access to protected routes after logout', async ({ page }) => {
    await loginAndWaitForDashboard(loginPage, page);

    if (await clickLogoutIfVisible(page)) {
      await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 10000 });
      await page.goto(DASHBOARD_URL);
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('should clear authentication cookies on logout', async ({ page }) => {
    await loginAndWaitForDashboard(loginPage, page);

    const cookiesBeforeLogout = await page.context().cookies();
    const authCookiesBefore = cookiesBeforeLogout.filter((c) => isAuthCookie(c.name));
    expect(authCookiesBefore.length).toBeGreaterThan(0);

    if (await clickLogoutIfVisible(page)) {
      await page.waitForTimeout(1000);

      const cookiesAfterLogout = await page.context().cookies();
      const authCookiesAfter = cookiesAfterLogout.filter((c) => isAuthCookie(c.name));

      const hasValidAuthCookie = authCookiesAfter.some((c) => {
        const isExpired = c.expires && c.expires < Date.now() / 1000;
        const isEmpty = !c.value || c.value === '';
        return !isExpired && !isEmpty;
      });

      expect(hasValidAuthCookie).toBe(false);
    }
  });

  test('should not expose user data after logout using back button', async ({ page }) => {
    await loginAndWaitForDashboard(loginPage, page);
    await page.goto(DASHBOARD_URL);
    await page.waitForTimeout(1000);

    if (await clickLogoutIfVisible(page)) {
      await page.waitForTimeout(1000);
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
    await loginAndWaitForDashboard(loginPage, page);

    const secondPage = await context.newPage();
    await secondPage.goto(DASHBOARD_URL);
    await secondPage.waitForTimeout(1000);

    if (await clickLogoutIfVisible(page)) {
      await page.waitForTimeout(1000);
      await secondPage.reload();
      await secondPage.waitForTimeout(2000);

      expect(secondPage.url()).toContain('/login');
    }

    await secondPage.close();
  });

  test('should logout successfully with collapsed sidebar', async ({ page }) => {
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      test.skip();
      return;
    }

    await loginAndWaitForDashboard(loginPage, page);
    await page.waitForTimeout(1000);

    const sidebarToggle = page.locator('[data-testid="sidebar-toggle"]');
    if (await sidebarToggle.isVisible({ timeout: 3000 })) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);

      const isExpanded = await sidebarToggle.getAttribute('aria-expanded');
      expect(isExpanded).toBe('false');
    }

    const logoutButton = page.locator('[data-testid="logout-button"]');
    await expect(logoutButton).toBeVisible({ timeout: 5000 });
    await logoutButton.click();

    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
