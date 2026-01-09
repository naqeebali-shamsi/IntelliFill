/**
 * E2E-406: Cross-Organization Isolation (IDOR Prevention)
 *
 * Tests that users cannot access resources from other organizations:
 * - Prevent access to documents from other orgs
 * - Prevent access to members from other orgs
 * - Verify proper 403/404 responses
 * - Test URL manipulation attacks
 */

import { test, expect } from '@playwright/test';
import { test as authTest } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../helpers/api.helper';
import { testUsers } from '../../data';
import { LoginPage } from '../../pages/LoginPage';

test.describe('E2E-406: Cross-Organization Isolation (IDOR Prevention)', () => {
  test('should prevent access to documents from another organization', async ({ page }) => {
    // This test requires two organizations
    // We'll use two different user accounts that belong to different orgs

    const loginPage = new LoginPage(page);

    // Login as User A (member of Org A)
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Get current user's organization ID via API
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3002/api';
    const userResponse = await page.request.get(`${apiUrl}/users/me`);

    if (!userResponse.ok()) {
      console.log('Could not get user info, skipping org-specific tests');
      test.skip();
      return;
    }

    const userData = await userResponse.json();
    const userOrgId = userData.organizationId || userData.organization?.id;

    // Upload a document as User A
    await page.goto('/documents');
    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.isVisible()) {
      const sampleDoc = 'N:/IntelliFill/quikadmin-web/e2e/sample-docs/sample-pdf-text.pdf';
      await fileInput.setInputFiles(sampleDoc);
      await page.waitForTimeout(2000);
    }

    // Get document ID from User A
    const documentsResponse = await page.request.get(`${apiUrl}/documents`);
    let userADocumentId: string | null = null;

    if (documentsResponse.ok()) {
      const docs = await documentsResponse.json();
      if (docs.documents && docs.documents.length > 0) {
        userADocumentId = docs.documents[0].id;
      }
    }

    // Logout
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out")');
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    } else {
      const userMenu = page.locator('[data-testid="user-menu"], .user-menu');
      if (await userMenu.isVisible()) {
        await userMenu.click();
        await page.waitForTimeout(300);
        await page.locator('button:has-text("Logout")').click();
      }
    }

    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 5000 });

    // Login as User B (different org - we'll use admin from test data)
    await loginPage.login({
      email: testUsers.testUsers.admin.email,
      password: testUsers.testUsers.admin.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Try to access User A's document via direct URL manipulation
    if (userADocumentId) {
      const response = await page.request.get(`${apiUrl}/documents/${userADocumentId}`);

      // Should get 403 Forbidden or 404 Not Found
      expect([403, 404]).toContain(response.status());

      // Try to access via UI
      await page.goto(`/documents/${userADocumentId}`);

      // Should show error page or redirect
      await page.waitForTimeout(1000);
      const pageContent = await page.textContent('body');

      // Should see forbidden/not found message
      const hasAccessDenied = pageContent?.toLowerCase().includes('forbidden') ||
                              pageContent?.toLowerCase().includes('not found') ||
                              pageContent?.toLowerCase().includes('access denied') ||
                              pageContent?.toLowerCase().includes('unauthorized');

      expect(hasAccessDenied).toBe(true);
    }
  });

  test('should prevent access to organization members from another org', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3002/api';

    // Login as member
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Get current user's org ID
    const userResponse = await page.request.get(`${apiUrl}/users/me`);
    if (!userResponse.ok()) {
      test.skip();
      return;
    }

    const userData = await userResponse.json();
    const userOrgId = userData.organizationId || userData.organization?.id;

    // Try to access members endpoint with a different org ID
    // Generate a fake UUID that's different from current org
    const fakeOrgId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    const membersResponse = await page.request.get(`${apiUrl}/organizations/${fakeOrgId}/members`);

    // Should get 403 or 404
    expect([403, 404]).toContain(membersResponse.status());
  });

  test('should prevent API access to other org resources via parameter manipulation', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3002/api';

    // Login
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // List of common IDOR attack patterns
    const idorAttempts = [
      // Incrementing IDs
      { endpoint: '/documents/1', description: 'Sequential ID 1' },
      { endpoint: '/documents/2', description: 'Sequential ID 2' },
      { endpoint: '/documents/999999', description: 'Large sequential ID' },

      // Common UUID patterns
      { endpoint: '/documents/00000000-0000-0000-0000-000000000001', description: 'Sequential UUID' },
    ];

    for (const attempt of idorAttempts) {
      const response = await page.request.get(`${apiUrl}${attempt.endpoint}`);

      // All these should either return 404 (resource doesn't exist)
      // or 403 (forbidden - exists but not accessible)
      // They should NOT return 200 with data from another org
      if (response.ok()) {
        const data = await response.json();

        // If we got data back, verify it belongs to our org
        const userResponse = await page.request.get(`${apiUrl}/users/me`);
        if (userResponse.ok()) {
          const userData = await userResponse.json();
          const userOrgId = userData.organizationId || userData.organization?.id;

          if (data.organizationId) {
            expect(data.organizationId).toBe(userOrgId);
          }
        }
      } else {
        // Non-200 response is expected and good
        expect([403, 404]).toContain(response.status());
      }
    }
  });

  test('should prevent modifying resources from another organization', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3002/api';

    // Login
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Try to UPDATE a document that doesn't belong to us
    const fakeDocId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const updateResponse = await page.request.patch(`${apiUrl}/documents/${fakeDocId}`, {
      data: { name: 'Hacked Document' },
    });

    // Should get 403 or 404
    expect([403, 404]).toContain(updateResponse.status());

    // Try to DELETE a document that doesn't belong to us
    const deleteResponse = await page.request.delete(`${apiUrl}/documents/${fakeDocId}`);

    // Should get 403 or 404
    expect([403, 404]).toContain(deleteResponse.status());
  });

  test('should prevent accessing organization settings from another org', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Login as member (non-admin)
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Try to access org settings with a fake org ID in URL
    const fakeOrgId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    await page.goto(`/organizations/${fakeOrgId}/settings`);
    await page.waitForTimeout(1000);

    // Should show error or redirect
    const currentUrl = page.url();
    const pageContent = await page.textContent('body');

    const hasAccessDenied = currentUrl.includes('/login') ||
                            currentUrl.includes('/error') ||
                            pageContent?.toLowerCase().includes('forbidden') ||
                            pageContent?.toLowerCase().includes('not found') ||
                            pageContent?.toLowerCase().includes('access denied');

    expect(hasAccessDenied).toBe(true);
  });

  test('should enforce organization context in API requests', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3002/api';

    // Login
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Get user's actual org
    const userResponse = await page.request.get(`${apiUrl}/users/me`);
    if (!userResponse.ok()) {
      test.skip();
      return;
    }

    const userData = await userResponse.json();
    const userOrgId = userData.organizationId || userData.organization?.id;

    // Try to create a document with a different organizationId in the payload
    const fakeOrgId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    const createResponse = await page.request.post(`${apiUrl}/documents`, {
      data: {
        name: 'Test Document',
        organizationId: fakeOrgId, // Try to inject different org ID
      },
    });

    // If creation succeeded, verify the org ID was overridden to user's actual org
    if (createResponse.ok()) {
      const createdDoc = await createResponse.json();
      const docOrgId = createdDoc.organizationId || createdDoc.organization?.id;

      // Should use user's actual org, not the injected one
      expect(docOrgId).toBe(userOrgId);
      expect(docOrgId).not.toBe(fakeOrgId);

      // Clean up
      if (createdDoc.id) {
        await page.request.delete(`${apiUrl}/documents/${createdDoc.id}`);
      }
    }
  });

  test('should not leak organization data in error messages', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3002/api';

    // Login
    await loginPage.navigate();
    await loginPage.login({
      email: testUsers.testUsers.member.email,
      password: testUsers.testUsers.member.password,
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    // Try to access non-existent resource
    const response = await page.request.get(`${apiUrl}/documents/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`);

    if (!response.ok()) {
      const errorText = await response.text();

      // Error message should NOT contain sensitive info like:
      // - Organization IDs
      // - Organization names from other orgs
      // - User IDs from other orgs
      // - Specific database details

      expect(errorText.toLowerCase()).not.toContain('organization');
      expect(errorText.toLowerCase()).not.toContain('belongs to');
      expect(errorText.toLowerCase()).not.toContain('owned by');

      // Should be generic message
      expect(errorText.toLowerCase()).toMatch(/not found|forbidden|unauthorized|access denied/);
    }
  });
});
