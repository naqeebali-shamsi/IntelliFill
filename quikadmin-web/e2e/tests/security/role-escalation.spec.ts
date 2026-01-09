/**
 * E2E-409: Role Escalation Prevention
 *
 * Tests that users cannot elevate their privileges or access admin features:
 * - MEMBER cannot access admin pages
 * - MEMBER cannot perform admin actions
 * - MEMBER cannot modify their own role
 * - Verify UI hides admin-only features
 */

import { test, expect } from '@playwright/test';
import { test as authTest } from '../../fixtures/auth.fixture';
import { SettingsPage } from '../../pages/SettingsPage';
import { testUsers } from '../../data';
import { LoginPage } from '../../pages/LoginPage';

test.describe('E2E-409: Role Escalation Prevention', () => {
  test('MEMBER should not access admin-only pages', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3002/api';

    // Login as MEMBER
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Try to access admin-only routes
    const adminRoutes = [
      '/admin',
      '/admin/users',
      '/admin/organizations',
      '/settings/billing',
      '/settings/organization/billing',
      '/admin/settings',
    ];

    for (const route of adminRoutes) {
      await page.goto(route);
      await page.waitForTimeout(1000);

      // Should either redirect or show 403/404
      const currentUrl = page.url();
      const pageContent = await page.textContent('body');

      const isAccessDenied = currentUrl.includes('/login') ||
                             currentUrl.includes('/error') ||
                             currentUrl.includes('/403') ||
                             currentUrl.includes('/404') ||
                             pageContent?.toLowerCase().includes('forbidden') ||
                             pageContent?.toLowerCase().includes('not found') ||
                             pageContent?.toLowerCase().includes('access denied') ||
                             pageContent?.toLowerCase().includes('unauthorized');

      expect(isAccessDenied).toBe(true);
    }
  });

  test('MEMBER should not see admin-only UI elements', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const settingsPage = new SettingsPage(page);

    // Login as MEMBER
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Navigate to settings
    await settingsPage.navigate();
    await settingsPage.goToOrganizationTab();

    // Verify MEMBER cannot see "Add Member" button
    await settingsPage.assertAddMemberNotVisible();

    // Verify billing tab is not visible
    await settingsPage.assertBillingTabNotVisible();

    // Check for other admin-only elements
    const adminButtons = page.locator('button:has-text("Delete Organization"), button:has-text("Manage Roles"), button:has-text("Billing")');
    await expect(adminButtons).not.toBeVisible();
  });

  test('MEMBER cannot modify their own role via API', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3002/api';

    // Login as MEMBER
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Get current user ID
    const userResponse = await page.request.get(`${apiUrl}/users/me`);
    expect(userResponse.ok()).toBe(true);

    const userData = await userResponse.json();
    const userId = userData.id || userData.user?.id;

    // Attempt to escalate role to ADMIN
    const escalationAttempts = [
      // Direct role update
      {
        method: 'PATCH',
        endpoint: `/users/${userId}`,
        payload: { role: 'ADMIN' },
      },
      // Update via profile
      {
        method: 'PATCH',
        endpoint: `/users/me`,
        payload: { role: 'ADMIN' },
      },
      {
        method: 'PUT',
        endpoint: `/users/me/profile`,
        payload: { role: 'ADMIN' },
      },
      // Try to update via organization membership
      {
        method: 'PATCH',
        endpoint: `/users/${userId}/role`,
        payload: { role: 'ADMIN' },
      },
    ];

    for (const attempt of escalationAttempts) {
      let response;

      if (attempt.method === 'PATCH') {
        response = await page.request.patch(`${apiUrl}${attempt.endpoint}`, {
          data: attempt.payload,
        });
      } else if (attempt.method === 'PUT') {
        response = await page.request.put(`${apiUrl}${attempt.endpoint}`, {
          data: attempt.payload,
        });
      } else {
        response = await page.request.post(`${apiUrl}${attempt.endpoint}`, {
          data: attempt.payload,
        });
      }

      // Should get 403 Forbidden
      expect([403, 404, 400]).toContain(response.status());

      // Verify role wasn't changed
      const verifyResponse = await page.request.get(`${apiUrl}/users/me`);
      if (verifyResponse.ok()) {
        const currentData = await verifyResponse.json();
        const currentRole = currentData.role || currentData.user?.role;
        expect(currentRole).toBe('MEMBER');
      }
    }
  });

  test('MEMBER cannot change other users roles', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3002/api';

    // Login as MEMBER
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Try to modify another user's role
    // Use a fake user ID
    const fakeUserId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    const response = await page.request.patch(`${apiUrl}/users/${fakeUserId}/role`, {
      data: { role: 'VIEWER' },
    });

    // Should be forbidden
    expect([403, 404]).toContain(response.status());
  });

  test('MEMBER cannot invite users to organization', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const settingsPage = new SettingsPage(page);
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3002/api';

    // Login as MEMBER
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Try to invite user via API
    const inviteResponse = await page.request.post(`${apiUrl}/invitations`, {
      data: {
        email: 'new-user@example.com',
        role: 'MEMBER',
      },
    });

    // Should be forbidden (only ADMIN/OWNER can invite)
    expect([403, 400]).toContain(inviteResponse.status());

    // Verify UI doesn't show invite button
    await settingsPage.navigate();
    await settingsPage.goToOrganizationTab();

    const inviteButton = page.locator('button:has-text("Invite"), button:has-text("Add Member")');
    await expect(inviteButton).not.toBeVisible();
  });

  test('MEMBER cannot delete users from organization', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3002/api';

    // Login as MEMBER
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Try to delete a user
    const fakeUserId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    const deleteResponse = await page.request.delete(`${apiUrl}/users/${fakeUserId}`);

    // Should be forbidden
    expect([403, 404]).toContain(deleteResponse.status());
  });

  test('VIEWER has even more restricted access than MEMBER', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3002/api';

    // Login as VIEWER
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.viewer.email,
      password: testUsers.testUsers.viewer.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // VIEWER should not be able to upload documents
    await page.goto('/documents');
    await page.waitForTimeout(1000);

    const uploadButton = page.locator('button:has-text("Upload"), input[type="file"]');

    // Upload functionality should be disabled or hidden
    const canUpload = await uploadButton.isVisible() && await uploadButton.isEnabled();
    if (canUpload) {
      // If visible, try to upload and verify it's rejected
      const uploadResponse = await page.request.post(`${apiUrl}/documents`, {
        data: { name: 'Test' },
      });

      expect([403, 400]).toContain(uploadResponse.status());
    }
  });

  test('should not leak role information in client-side code', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Login as MEMBER
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Check localStorage/sessionStorage for role info
    const storageData = await page.evaluate(() => {
      return {
        localStorage: { ...localStorage },
        sessionStorage: { ...sessionStorage },
      };
    });

    // Role should not be stored in plain text in storage
    const storageString = JSON.stringify(storageData).toLowerCase();

    // If role is stored, it should be in a JWT (encoded) not plain text
    // This is a basic check - role might legitimately be in an encoded token
    const hasPlaintextRole = storageString.includes('"role":"admin"') ||
                             storageString.includes('"role":"owner"');

    expect(hasPlaintextRole).toBe(false);
  });

  test('ADMIN can access admin pages', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const settingsPage = new SettingsPage(page);

    // Login as ADMIN (positive test to verify ADMIN does have access)
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.admin.email,
      password: testUsers.testUsers.admin.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Navigate to settings
    await settingsPage.navigate();
    await settingsPage.goToOrganizationTab();

    // ADMIN should see "Add Member" button
    await settingsPage.assertAddMemberVisible();

    // Verify admin can access organization members
    const currentUrl = page.url();
    expect(currentUrl).toContain('/settings');
  });

  test('should enforce role checks on every request', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3002/api';

    // Login as MEMBER
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Try to access admin endpoint multiple times (to check it's not cached/bypassed)
    for (let i = 0; i < 3; i++) {
      const response = await page.request.get(`${apiUrl}/admin/users`);
      expect([403, 404]).toContain(response.status());
    }
  });

  test('should prevent horizontal privilege escalation', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3002/api';

    // Login as MEMBER
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Get current user
    const userResponse = await page.request.get(`${apiUrl}/users/me`);
    const userData = await userResponse.json();
    const currentUserId = userData.id || userData.user?.id;

    // Try to modify another MEMBER's profile
    // Generate fake user ID
    const otherUserId = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

    const updateResponse = await page.request.patch(`${apiUrl}/users/${otherUserId}/profile`, {
      data: { name: 'Hacked Name' },
    });

    // Should be forbidden
    expect([403, 404]).toContain(updateResponse.status());
  });
});
