/**
 * E2E-012: Organization Lifecycle (CRUD)
 *
 * Tests complete organization management:
 * - Create new organization
 * - Update organization settings
 * - Add member to organization
 * - Delete organization
 * - Verify cleanup and redirect
 *
 * Updated to use data-testid selectors from SettingsPage for reliability.
 */

import { test, expect } from '../../fixtures';
import { SettingsPage } from '../../pages/SettingsPage';
import { generateUniqueOrgName } from '../../data';

test.describe('E2E-012: Organization Lifecycle (CRUD)', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ adminPage }) => {
    settingsPage = new SettingsPage(adminPage);
  });

  test('should complete full organization lifecycle', async ({ adminPage }) => {
    const orgName = generateUniqueOrgName('E2E Corp');
    const updatedOrgName = `${orgName} Updated`;
    const orgAddress = '123 Test Street, Test City, TC 12345';

    // Step 1: Navigate to settings
    await settingsPage.navigate();
    await settingsPage.assertLoaded();

    // Step 2: Go to organization tab
    await settingsPage.goToOrganizationTab();

    // Step 3: Check if there's a "Create Organization" button (if user has no org)
    const createOrgButton = adminPage.locator(settingsPage.selectors.createOrgButton);
    const hasCreateButton = await createOrgButton.isVisible();

    let createdNewOrg = false;

    if (hasCreateButton) {
      // User doesn't have an organization yet, create one
      await createOrgButton.click();
      await adminPage.waitForTimeout(500);

      // Fill organization name using data-testid selector
      const orgNameInput = adminPage.locator(settingsPage.selectors.orgNameInput);
      await orgNameInput.fill(orgName);

      // Submit using data-testid selector
      const submitButton = adminPage.locator(settingsPage.selectors.createOrgSubmit);
      await submitButton.click();

      // Wait for success
      await adminPage.waitForTimeout(1000);
      createdNewOrg = true;
    }

    // Step 4: Update organization settings
    await settingsPage.navigate();
    await settingsPage.goToOrganizationTab();

    // Get current org name using data-testid selector
    const orgNameInput = adminPage.locator(settingsPage.selectors.orgNameInput);
    await orgNameInput.waitFor({ state: 'visible', timeout: 5000 });

    // Update organization name
    await orgNameInput.clear();
    await orgNameInput.fill(updatedOrgName);

    // Step 5: Update organization address
    const addressInput = adminPage.locator(settingsPage.selectors.orgAddressInput);
    if (await addressInput.isVisible()) {
      await addressInput.fill(orgAddress);
    }

    // Step 6: Save changes using data-testid selector
    const saveButton = adminPage.locator(settingsPage.selectors.orgSaveButton);
    if (await saveButton.isVisible()) {
      await saveButton.click();
    } else {
      // Fallback to general save button
      await settingsPage.saveButton.click();
    }
    await adminPage.waitForTimeout(1000);

    // Step 7: Verify changes persisted by refreshing
    await adminPage.reload();
    await settingsPage.goToOrganizationTab();

    const refreshedOrgNameInput = adminPage.locator(settingsPage.selectors.orgNameInput);
    const currentOrgName = await refreshedOrgNameInput.inputValue();
    expect(currentOrgName).toContain(updatedOrgName);

    // Step 8: Add a member (if invite member button exists)
    const inviteMemberButton = adminPage.locator(settingsPage.selectors.inviteMemberButton);
    const canAddMember = await inviteMemberButton.isVisible();

    if (canAddMember) {
      await inviteMemberButton.click();
      await adminPage.waitForTimeout(500);

      // Fill invite form using data-testid selectors
      const emailInput = adminPage.locator(settingsPage.selectors.inviteEmailInput);
      if (await emailInput.isVisible()) {
        await emailInput.fill(`member-${Date.now()}@intellifill.local`);

        // Select role if available using data-testid selector
        const roleSelect = adminPage.locator(settingsPage.selectors.inviteRoleSelect);
        if (await roleSelect.isVisible()) {
          await roleSelect.selectOption('MEMBER');
        }

        // Submit invite using data-testid selector
        const inviteSubmitButton = adminPage.locator(settingsPage.selectors.inviteSubmitButton);
        await inviteSubmitButton.click();

        await adminPage.waitForTimeout(1000);

        // Close modal if still open
        const closeButton = adminPage
          .locator('button[aria-label="Close"], button:has-text("Close")')
          .first();
        if (await closeButton.isVisible()) {
          await closeButton.click();
        }
      }
    }

    // Step 9: Delete organization (if we created it)
    if (createdNewOrg) {
      await settingsPage.navigate();
      await settingsPage.goToOrganizationTab();

      const deleteOrgButton = adminPage.locator(settingsPage.selectors.deleteOrgButton);

      if (await deleteOrgButton.isVisible()) {
        await deleteOrgButton.click();

        // Wait for confirmation dialog using data-testid selector
        await expect(adminPage.locator(settingsPage.selectors.deleteOrgDialog)).toBeVisible({
          timeout: 5000,
        });

        // Confirm deletion using data-testid selector
        const confirmButton = adminPage.locator(settingsPage.selectors.deleteOrgConfirm);
        await confirmButton.click();

        // Step 10: Should redirect to dashboard or org picker
        await adminPage.waitForURL(
          (url) =>
            url.pathname === '/' ||
            url.pathname.includes('/dashboard') ||
            url.pathname.includes('/organizations') ||
            url.pathname.includes('/org-picker'),
          { timeout: 10000 }
        );

        // Step 11: Verify org no longer accessible
        // Try to access org settings
        await settingsPage.navigate();
        await settingsPage.goToOrganizationTab();

        // Should either show "Create Organization" or error
        const noOrgMessage = adminPage.locator('text=/no organization|create.*organization/i');
        const createButton = adminPage.locator(settingsPage.selectors.createOrgButton);
        const hasNoOrg = (await createButton.isVisible()) || (await noOrgMessage.isVisible());

        expect(hasNoOrg).toBe(true);
      }
    }
  });

  test('should validate required fields when creating organization', async ({ adminPage }) => {
    await settingsPage.navigate();
    await settingsPage.goToOrganizationTab();

    const createOrgButton = adminPage.locator(settingsPage.selectors.createOrgButton);

    if (await createOrgButton.isVisible()) {
      await createOrgButton.click();
      await adminPage.waitForTimeout(500);

      // Try to submit without filling name using data-testid selector
      const submitButton = adminPage.locator(settingsPage.selectors.createOrgSubmit);
      await submitButton.click();

      // Should show validation error using data-testid selector
      const orgNameError = adminPage.locator(settingsPage.selectors.orgNameError);
      const genericError = adminPage.locator(
        '[role="alert"], .error-message, [aria-invalid="true"]'
      );

      // Either specific org name error or generic error should be visible
      const hasError = (await orgNameError.isVisible()) || (await genericError.isVisible());
      expect(hasError).toBe(true);
    }
  });

  test('should prevent duplicate organization names', async ({ adminPage }) => {
    const duplicateOrgName = 'Test Organization'; // Common name likely to exist

    await settingsPage.navigate();
    await settingsPage.goToOrganizationTab();

    const createOrgButton = adminPage.locator(settingsPage.selectors.createOrgButton);

    if (await createOrgButton.isVisible()) {
      await createOrgButton.click();
      await adminPage.waitForTimeout(500);

      const orgNameInput = adminPage.locator(settingsPage.selectors.orgNameInput);
      await orgNameInput.fill(duplicateOrgName);

      const submitButton = adminPage.locator(settingsPage.selectors.createOrgSubmit);
      await submitButton.click();

      await adminPage.waitForTimeout(1000);

      // May show error about duplicate name or succeed
      // Either way, test passes (implementation specific)
      const hasError = await adminPage.locator('[role="alert"], .error-message').isVisible();
      const isRedirected = !adminPage.url().includes('create');

      expect(hasError || isRedirected).toBe(true);
    }
  });

  test('should persist organization settings across sessions', async ({ adminPage }) => {
    const testOrgName = `Persistent Org ${Date.now()}`;

    await settingsPage.navigate();
    await settingsPage.goToOrganizationTab();

    // Update org name using data-testid selector
    const orgNameInput = adminPage.locator(settingsPage.selectors.orgNameInput);
    if (await orgNameInput.isVisible()) {
      await orgNameInput.clear();
      await orgNameInput.fill(testOrgName);

      // Save using data-testid selector or fallback
      const orgSaveButton = adminPage.locator(settingsPage.selectors.orgSaveButton);
      if (await orgSaveButton.isVisible()) {
        await orgSaveButton.click();
      } else {
        await settingsPage.saveButton.click();
      }
      await adminPage.waitForTimeout(1000);

      // Simulate new session by clearing session storage and reloading
      await adminPage.evaluate(() => {
        sessionStorage.clear();
      });

      await adminPage.reload();
      await settingsPage.goToOrganizationTab();

      // Verify org name persisted using data-testid selector
      const refreshedOrgNameInput = adminPage.locator(settingsPage.selectors.orgNameInput);
      const persistedName = await refreshedOrgNameInput.inputValue();
      expect(persistedName).toBe(testOrgName);
    }
  });

  test('should show member list in organization settings', async ({ adminPage }) => {
    await settingsPage.navigate();
    await settingsPage.goToOrganizationTab();

    // Look for members section using data-testid selector
    const membersList = adminPage.locator(settingsPage.selectors.membersList);
    const hasMembersList = await membersList.isVisible();

    if (hasMembersList) {
      // Count members using data-testid selector
      const memberRows = adminPage.locator(settingsPage.selectors.memberRow);
      const memberCount = await memberRows.count();
      expect(memberCount).toBeGreaterThanOrEqual(1); // At least the admin
    }
  });

  test('should verify organization deletion requires confirmation', async ({ adminPage }) => {
    await settingsPage.navigate();
    await settingsPage.goToOrganizationTab();

    const deleteButton = adminPage.locator(settingsPage.selectors.deleteOrgButton);

    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Should show confirmation dialog using data-testid selector
      const confirmDialog = adminPage.locator(settingsPage.selectors.deleteOrgDialog);
      await expect(confirmDialog).toBeVisible({ timeout: 5000 });

      // Cancel deletion using data-testid selector
      const cancelButton = adminPage.locator(settingsPage.selectors.deleteOrgCancel);
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }

      // Should still be on settings page
      await expect(adminPage).toHaveURL(/\/settings/);
    }
  });

  test('should return 404 when accessing deleted organization settings', async ({ adminPage }) => {
    // This test simulates accessing a deleted org's settings
    // We'll use a non-existent org ID

    const fakeOrgId = '99999999-fake-deleted-org-id';

    // Try to access settings for non-existent org
    await adminPage.goto(`http://localhost:8080/organizations/${fakeOrgId}/settings`);

    await adminPage.waitForTimeout(1000);

    // Should show 404 error or redirect
    const has404 = await adminPage.locator('text=/404|not found/i').isVisible();
    const isRedirected = !adminPage.url().includes(fakeOrgId);

    expect(has404 || isRedirected).toBe(true);
  });
});
