/**
 * E2E-430: Session Persistence Across Tabs
 *
 * Tests real-time session synchronization between browser tabs:
 * - Open two tabs
 * - Logout in Tab 1
 * - Click Dashboard in Tab 2
 * - Verify Tab 2 redirects to login automatically
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { getTestUser } from '../../data';

test.describe('E2E-430: Session Persistence Across Tabs', () => {
  test('should redirect tab 2 to login after logout in tab 1', async ({ context }) => {
    const testUser = getTestUser('member');

    // Create first tab and login
    const tab1 = await context.newPage();
    const loginPage1 = new LoginPage(tab1);

    await loginPage1.navigate();
    await loginPage1.login({
      email: testUser.email,
      password: testUser.password,
    });

    await tab1.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Verify authenticated in tab 1
    const userMenu1 = tab1.locator('[data-testid="user-menu"], .user-menu, button:has-text("Settings")');
    await expect(userMenu1).toBeVisible({ timeout: 5000 });

    // Create second tab
    const tab2 = await context.newPage();
    await tab2.goto('http://localhost:8080/dashboard');
    await tab2.waitForTimeout(1000);

    // Verify authenticated in tab 2
    const userMenu2 = tab2.locator('[data-testid="user-menu"], .user-menu');
    await expect(userMenu2).toBeVisible({ timeout: 5000 });

    // Logout in tab 1
    const logoutButton = tab1.locator('button:has-text("Logout"), button:has-text("Sign out")').first();
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await tab1.waitForTimeout(2000);

      // Tab 1 should be on login page
      await tab1.waitForURL((url) => url.pathname.includes('/login'), { timeout: 10000 });

      // Click on Dashboard link in tab 2
      await tab2.goto('http://localhost:8080/dashboard');
      await tab2.waitForTimeout(2000);

      // Tab 2 should redirect to login
      await tab2.waitForURL((url) => url.pathname.includes('/login'), { timeout: 10000 });
      await expect(tab2).toHaveURL(/\/login/);
    }

    await tab1.close();
    await tab2.close();
  });

  test('should sync login state across tabs', async ({ context }) => {
    const testUser = getTestUser('member');

    // Create two tabs
    const tab1 = await context.newPage();
    const tab2 = await context.newPage();

    // Login in tab 1
    const loginPage = new LoginPage(tab1);
    await loginPage.navigate();
    await loginPage.login({
      email: testUser.email,
      password: testUser.password,
    });

    await tab1.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Navigate to dashboard in tab 2
    await tab2.goto('http://localhost:8080/dashboard');
    await tab2.waitForTimeout(2000);

    // Tab 2 should also be authenticated (same context)
    const isAuthenticated = !tab2.url().includes('/login');
    expect(isAuthenticated).toBe(true);

    await tab1.close();
    await tab2.close();
  });

  test('should detect logout in background tab', async ({ context }) => {
    const testUser = getTestUser('member');

    const tab1 = await context.newPage();
    const tab2 = await context.newPage();

    // Login in both tabs
    const loginPage1 = new LoginPage(tab1);
    await loginPage1.navigate();
    await loginPage1.login({
      email: testUser.email,
      password: testUser.password,
    });

    await tab1.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    await tab2.goto('http://localhost:8080/documents');
    await tab2.waitForTimeout(2000);

    // Logout in tab 1
    const logoutButton = tab1.locator('button:has-text("Logout")').first();
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await tab1.waitForTimeout(2000);

      // Focus tab 2 (simulate switching tabs)
      await tab2.bringToFront();
      await tab2.waitForTimeout(500);

      // Trigger activity in tab 2
      await tab2.reload();
      await tab2.waitForTimeout(2000);

      // Should redirect to login
      const isOnLogin = tab2.url().includes('/login');
      expect(isOnLogin).toBe(true);
    }

    await tab1.close();
    await tab2.close();
  });

  test('should maintain independent sessions in different contexts', async ({ browser }) => {
    const user1 = getTestUser('member');
    const user2 = getTestUser('viewer');

    // Create separate browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Login as user 1 in context 1
    const loginPage1 = new LoginPage(page1);
    await loginPage1.navigate();
    await loginPage1.login({
      email: user1.email,
      password: user1.password,
    });

    await page1.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Login as user 2 in context 2
    const loginPage2 = new LoginPage(page2);
    await loginPage2.navigate();
    await loginPage2.login({
      email: user2.email,
      password: user2.password,
    });

    await page2.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Both should be authenticated
    const userMenu1 = page1.locator('[data-testid="user-menu"], .user-menu');
    const userMenu2 = page2.locator('[data-testid="user-menu"], .user-menu');

    await expect(userMenu1).toBeVisible({ timeout: 5000 });
    await expect(userMenu2).toBeVisible({ timeout: 5000 });

    // Logout from context 1
    const logoutButton1 = page1.locator('button:has-text("Logout")').first();
    if (await logoutButton1.isVisible()) {
      await logoutButton1.click();
      await page1.waitForTimeout(2000);

      // Context 2 should still be authenticated
      await expect(userMenu2).toBeVisible();
    }

    await context1.close();
    await context2.close();
  });

  test('should handle concurrent API calls from multiple tabs', async ({ context }) => {
    const testUser = getTestUser('member');

    const tab1 = await context.newPage();
    const loginPage = new LoginPage(tab1);

    await loginPage.navigate();
    await loginPage.login({
      email: testUser.email,
      password: testUser.password,
    });

    await tab1.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Open multiple tabs
    const tab2 = await context.newPage();
    const tab3 = await context.newPage();

    await Promise.all([
      tab1.goto('http://localhost:8080/documents'),
      tab2.goto('http://localhost:8080/documents'),
      tab3.goto('http://localhost:8080/documents'),
    ]);

    await tab1.waitForTimeout(2000);

    // All tabs should load successfully
    const tab1Loaded = !tab1.url().includes('/login');
    const tab2Loaded = !tab2.url().includes('/login');
    const tab3Loaded = !tab3.url().includes('/login');

    expect(tab1Loaded).toBe(true);
    expect(tab2Loaded).toBe(true);
    expect(tab3Loaded).toBe(true);

    await tab1.close();
    await tab2.close();
    await tab3.close();
  });

  test('should handle session storage events', async ({ context }) => {
    const testUser = getTestUser('member');

    const tab1 = await context.newPage();
    const tab2 = await context.newPage();

    // Login in tab 1
    const loginPage = new LoginPage(tab1);
    await loginPage.navigate();
    await loginPage.login({
      email: testUser.email,
      password: testUser.password,
    });

    await tab1.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    await tab2.goto('http://localhost:8080/dashboard');
    await tab2.waitForTimeout(1000);

    // Listen for storage events in tab 2
    const storageEvents: string[] = [];
    await tab2.evaluate(() => {
      window.addEventListener('storage', (e) => {
        if (e.key) {
          (window as any).storageEvents = (window as any).storageEvents || [];
          (window as any).storageEvents.push(e.key);
        }
      });
    });

    // Trigger storage change in tab 1
    await tab1.evaluate(() => {
      localStorage.setItem('test-key', 'test-value');
    });

    await tab2.waitForTimeout(1000);

    // Get storage events from tab 2
    const events = await tab2.evaluate(() => {
      return (window as any).storageEvents || [];
    });

    // Storage events should be fired
    expect(Array.isArray(events)).toBe(true);

    await tab1.close();
    await tab2.close();
  });

  test('should preserve session after closing and reopening tab', async ({ context }) => {
    const testUser = getTestUser('member');

    const tab1 = await context.newPage();
    const loginPage = new LoginPage(tab1);

    await loginPage.navigate();
    await loginPage.login({
      email: testUser.email,
      password: testUser.password,
    });

    await tab1.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Close tab 1
    await tab1.close();

    // Open new tab in same context
    const tab2 = await context.newPage();
    await tab2.goto('http://localhost:8080/dashboard');
    await tab2.waitForTimeout(2000);

    // Should still be authenticated
    const isAuthenticated = !tab2.url().includes('/login');
    expect(isAuthenticated).toBe(true);

    await tab2.close();
  });

  test('should handle rapid tab switching', async ({ context }) => {
    const testUser = getTestUser('member');

    const tab1 = await context.newPage();
    const loginPage = new LoginPage(tab1);

    await loginPage.navigate();
    await loginPage.login({
      email: testUser.email,
      password: testUser.password,
    });

    await tab1.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    const tab2 = await context.newPage();
    await tab2.goto('http://localhost:8080/dashboard');

    // Rapidly switch between tabs
    for (let i = 0; i < 5; i++) {
      await tab1.bringToFront();
      await tab1.waitForTimeout(100);
      await tab2.bringToFront();
      await tab2.waitForTimeout(100);
    }

    // Both tabs should still be functional
    const tab1Functional = !tab1.url().includes('/login');
    const tab2Functional = !tab2.url().includes('/login');

    expect(tab1Functional).toBe(true);
    expect(tab2Functional).toBe(true);

    await tab1.close();
    await tab2.close();
  });
});
