/**
 * E2E-404: Complete Registration & Onboarding Flow
 *
 * Tests the full user registration journey including:
 * - Registration with unique email
 * - Email confirmation (mocked)
 * - Profile setup
 * - Dashboard access
 */

import { test, expect } from '@playwright/test';
import { RegisterPage } from '../../pages/RegisterPage';
import { SettingsPage } from '../../pages/SettingsPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { MockHelper } from '../../helpers/mock.helper';

test.describe('E2E-404: Complete Registration & Onboarding Flow', () => {
  let registerPage: RegisterPage;
  let settingsPage: SettingsPage;
  let dashboardPage: DashboardPage;
  let mockHelper: MockHelper;

  test.beforeEach(async ({ page }) => {
    registerPage = new RegisterPage(page);
    settingsPage = new SettingsPage(page);
    dashboardPage = new DashboardPage(page);
    mockHelper = new MockHelper(page);
  });

  test('should complete full registration and onboarding flow', async ({ page }) => {
    // Generate unique email for this test run
    const timestamp = Date.now();
    const uniqueEmail = `test-reg-${timestamp}@intellifill.local`;

    // Step 1: Navigate to registration page
    await registerPage.navigate();
    await registerPage.assertFormVisible();

    // Step 2: Fill registration form with unique email
    const registrationData = {
      name: 'Test New User',
      email: uniqueEmail,
      password: 'TestNewUser123!',
      organizationName: `Test Org ${timestamp}`,
      acceptTerms: true,
    };

    await registerPage.fillRegistrationForm(registrationData);

    // Step 3: Mock Supabase email confirmation
    // This intercepts the email verification endpoint
    await mockHelper.mockEmailConfirmation();

    // Step 4: Submit registration
    await registerPage.clickRegister();

    // Step 5: Wait for successful registration
    // Should redirect to verification page or directly to dashboard/onboarding
    await page.waitForURL((url) => !url.pathname.includes('/register'), { timeout: 10000 });

    // Step 6: Check if redirected to profile/onboarding page
    // If there's an onboarding flow, complete it
    const currentUrl = page.url();
    if (currentUrl.includes('/onboarding') || currentUrl.includes('/profile')) {
      // If on profile setup page, fill it out
      if (await page.locator('input[name="name"]').isVisible()) {
        await page.locator('input[name="name"]').fill('Test New User');
      }

      // Look for "Complete" or "Finish" button
      const completeButton = page.locator('button:has-text("Complete"), button:has-text("Finish"), button:has-text("Continue")').first();
      if (await completeButton.isVisible()) {
        await completeButton.click();
      }
    }

    // Step 7: Verify dashboard is accessible
    await page.waitForURL((url) =>
      url.pathname === '/' ||
      url.pathname.includes('/dashboard') ||
      url.pathname.includes('/documents'),
      { timeout: 10000 }
    );

    // Step 8: Verify user is authenticated
    // Check for authenticated UI elements
    const isAuthenticated = await page.locator('[data-testid="user-menu"], .user-menu, button:has-text("Settings")').isVisible();
    expect(isAuthenticated).toBe(true);

    // Step 9: Verify user data is present
    // Navigate to settings to check profile
    await settingsPage.navigate();
    await settingsPage.goToProfileTab();

    const profileName = await settingsPage.getProfileName();
    expect(profileName).toContain('Test New User');

    // Step 10: Verify no errors occurred during the flow
    // Check that no error messages are visible
    const errorMessage = page.locator('[role="alert"], .error-message');
    if (await errorMessage.isVisible()) {
      const errorText = await errorMessage.textContent();
      console.log('Unexpected error:', errorText);
    }
    await expect(errorMessage).not.toBeVisible();
  });

  test('should handle registration with existing email', async ({ page }) => {
    // Use an email that's already registered (from test-users.json)
    const existingEmail = 'test-member@intellifill.local';

    await registerPage.navigate();
    await registerPage.fillRegistrationForm({
      name: 'Duplicate User',
      email: existingEmail,
      password: 'TestPassword123!',
    });

    await registerPage.clickRegister();

    // Should show error about email already exists
    await registerPage.assertEmailExistsError();

    // Should remain on registration page
    await expect(page).toHaveURL(/\/register/);
  });

  test('should validate required fields', async ({ page }) => {
    await registerPage.navigate();

    // Try to submit empty form
    await registerPage.clickRegister();

    // Should show validation errors
    const errors = await registerPage.getFieldErrors();
    expect(errors.length).toBeGreaterThan(0);

    // Should remain on registration page
    await expect(page).toHaveURL(/\/register/);
  });

  test('should validate password requirements', async ({ page }) => {
    await registerPage.navigate();

    const timestamp = Date.now();
    await registerPage.fillRegistrationForm({
      name: 'Test User',
      email: `test-${timestamp}@intellifill.local`,
      password: 'weak', // Too weak
    });

    await registerPage.clickRegister();

    // Should show password requirements error
    await registerPage.assertPasswordRequirementsError();

    // Should remain on registration page
    await expect(page).toHaveURL(/\/register/);
  });

  test('should require terms acceptance', async ({ page }) => {
    await registerPage.navigate();

    const timestamp = Date.now();
    await registerPage.fillRegistrationForm({
      name: 'Test User',
      email: `test-${timestamp}@intellifill.local`,
      password: 'TestPassword123!',
      acceptTerms: false, // Don't accept terms
    });

    await registerPage.clickRegister();

    // Should show terms required error or prevent submission
    const hasError = await registerPage.hasError();
    if (hasError) {
      await registerPage.assertTermsRequired();
    }

    // Should remain on registration page
    await expect(page).toHaveURL(/\/register/);
  });

  test('should navigate to login page from registration', async ({ page }) => {
    await registerPage.navigate();
    await registerPage.goToLogin();

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });
});
