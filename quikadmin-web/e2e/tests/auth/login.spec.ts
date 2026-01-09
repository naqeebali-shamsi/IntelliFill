/**
 * E2E-011: Password Reset Flow
 *
 * Tests the complete password reset journey:
 * - Request password reset
 * - Mock email link with token
 * - Set new password
 * - Login with new credentials
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { MockHelper } from '../../helpers/mock.helper';
import {
  restoreUserPassword,
  isSupabaseAdminConfigured,
} from '../../helpers/supabase.helper';
import { generateUniqueEmail, testUsers } from '../../data';

test.describe('E2E-011: Password Reset Flow', () => {
  let loginPage: LoginPage;
  let mockHelper: MockHelper;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    mockHelper = new MockHelper(page);
  });

  // Restore password after tests that may have changed it
  const passwordResetUser = testUsers.testUsers.passwordReset;

  test.afterEach(async () => {
    // Only attempt restoration if the supabase admin is configured
    if (isSupabaseAdminConfigured()) {
      try {
        await restoreUserPassword(
          passwordResetUser.email,
          passwordResetUser.password
        );
      } catch (error) {
        console.warn('[Password Reset Tests] Failed to restore password:', error);
        // Don't fail the test - just log warning
      }
    }
  });

  test('should complete full password reset flow', async ({ page }) => {
    // Use dedicated password reset user to avoid breaking other tests
    const testEmail = 'test-password-reset@intellifill.local';
    const newPassword = 'NewSecurePassword123!';

    // Step 1: Navigate to login page
    await loginPage.navigate();
    await loginPage.assertFormVisible();

    // Step 2: Click forgot password link
    await loginPage.goToForgotPassword();

    // Step 3: Should be on forgot password page
    await expect(page).toHaveURL(/\/(forgot-password|reset-password|password-reset)/);

    // Step 4: Fill in email for password reset
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill(testEmail);

    // Step 5: Mock password reset email callback
    await mockHelper.mockSupabaseAuthEmail();

    // Step 6: Submit password reset request
    const submitButton = page.locator('button[type="submit"], button:has-text("Send"), button:has-text("Reset")').first();
    await submitButton.click();

    // Step 7: Wait for success message
    await page.waitForTimeout(1000);
    const successMessage = page.locator('[role="status"], .success-message')
      .or(page.getByText(/email.*sent|check.*email/i))
      .first();

    // If success message is shown, continue
    if (await successMessage.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Step 8: Simulate clicking reset link from email
      // In real scenario, this would be from email. Here we navigate directly with token
      const resetToken = 'mock-reset-token-' + Date.now();
      await page.goto(`http://localhost:8080/reset-password?token=${resetToken}`);

      // Step 9: Should be on reset password form page
      await page.waitForTimeout(500);

      // Step 10: Fill new password
      const newPasswordInput = page.locator('input[name="password"], input[type="password"]').first();
      const confirmPasswordInput = page.locator('input[name="confirmPassword"], input[name="passwordConfirmation"]').first();

      await newPasswordInput.fill(newPassword);

      // Only fill confirm password if field exists
      if (await confirmPasswordInput.isVisible()) {
        await confirmPasswordInput.fill(newPassword);
      }

      // Step 11: Submit new password
      const resetSubmitButton = page.locator('button[type="submit"], button:has-text("Reset"), button:has-text("Change")').first();
      await resetSubmitButton.click();

      // Step 12: Wait for success or redirect to login
      await page.waitForTimeout(1000);

      // Check if redirected to login or if success message shown
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        // Already on login page
        await loginPage.assertFormVisible();
      } else {
        // Look for success message and link to login
        const loginLink = page.locator('a:has-text("Login"), a:has-text("Sign in")').first();
        if (await loginLink.isVisible()) {
          await loginLink.click();
        } else {
          // Navigate to login manually
          await loginPage.navigate();
        }
      }

      // Step 13: Verify we can login with new password
      await loginPage.fillEmail(testEmail);
      await loginPage.fillPassword(newPassword);
      await loginPage.clickLogin();

      // Step 14: Should be redirected to dashboard (login success)
      await page.waitForURL((url) =>
        !url.pathname.includes('/login') &&
        !url.pathname.includes('/reset'),
        { timeout: 10000 }
      );

      // Step 15: Verify authenticated state
      const userMenu = page.locator('[data-testid="user-menu"], .user-menu, button:has-text("Settings")');
      await expect(userMenu).toBeVisible({ timeout: 5000 });
    }
  });

  test('should handle invalid email for password reset', async ({ page }) => {
    const invalidEmail = 'nonexistent-user-99999@intellifill.local';

    await loginPage.navigate();
    await loginPage.goToForgotPassword();

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill(invalidEmail);

    const submitButton = page.locator('button[type="submit"], button:has-text("Send"), button:has-text("Reset")').first();
    await submitButton.click();

    await page.waitForTimeout(1000);

    // Should either show error or generic message for security
    // (many apps show generic message to prevent email enumeration)
    const hasError = await page.locator('[role="alert"], .error-message').isVisible();
    const hasSuccess = await page.locator('[role="status"], .success-message').isVisible();

    // One of these should be true
    expect(hasError || hasSuccess).toBe(true);
  });

  test('should validate password strength on reset', async ({ page }) => {
    // Use dedicated password reset user to avoid breaking other tests
    const testEmail = 'test-password-reset@intellifill.local';
    const weakPassword = 'weak';

    await loginPage.navigate();
    await loginPage.goToForgotPassword();

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill(testEmail);

    await mockHelper.mockSupabaseAuthEmail();

    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();

    await page.waitForTimeout(1000);

    // Navigate to reset page with token
    const resetToken = 'mock-reset-token-' + Date.now();
    await page.goto(`http://localhost:8080/reset-password?token=${resetToken}`);

    // Fill weak password
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    await passwordInput.fill(weakPassword);

    const resetButton = page.locator('button[type="submit"]').first();
    await resetButton.click();

    // Should show validation error
    const error = page.locator('[role="alert"], .error-message')
      .or(page.getByText(/password.*strong|password.*requirements/i));
    await expect(error.first()).toBeVisible({ timeout: 5000 });
  });

  test('should handle expired reset token', async ({ page }) => {
    // Navigate directly to reset page with obviously expired/invalid token
    await page.goto('http://localhost:8080/reset-password?token=expired-token');

    await page.waitForTimeout(500);

    // Fill password anyway
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('NewPassword123!');

      const confirmInput = page.locator('input[name="confirmPassword"]').first();
      if (await confirmInput.isVisible()) {
        await confirmInput.fill('NewPassword123!');
      }

      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();

      await page.waitForTimeout(1000);

      // Should show error about invalid/expired token
      const error = page.locator('[role="alert"], .error-message')
        .or(page.getByText(/invalid|expired|token/i));
      const errorVisible = await error.first().isVisible();

      // Error should be visible or we get redirected
      const onResetPage = page.url().includes('reset');
      expect(errorVisible || !onResetPage).toBe(true);
    }
  });

  test('should require matching password confirmation', async ({ page }) => {
    // Use dedicated password reset user to avoid breaking other tests
    const testEmail = 'test-password-reset@intellifill.local';

    await loginPage.navigate();
    await loginPage.goToForgotPassword();

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill(testEmail);

    await mockHelper.mockSupabaseAuthEmail();

    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();

    await page.waitForTimeout(1000);

    const resetToken = 'mock-reset-token-' + Date.now();
    await page.goto(`http://localhost:8080/reset-password?token=${resetToken}`);

    // Fill mismatching passwords
    const passwordInput = page.locator('input[name="password"]').first();
    const confirmInput = page.locator('input[name="confirmPassword"], input[name="passwordConfirmation"]').first();

    await passwordInput.fill('NewPassword123!');

    if (await confirmInput.isVisible()) {
      await confirmInput.fill('DifferentPassword123!');

      const resetButton = page.locator('button[type="submit"]').first();
      await resetButton.click();

      // Should show error about passwords not matching
      const error = page.locator('[role="alert"], .error-message')
        .or(page.getByText(/match|same/i));
      await expect(error.first()).toBeVisible({ timeout: 5000 });
    }
  });
});
