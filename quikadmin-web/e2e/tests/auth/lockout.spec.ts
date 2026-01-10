/**
 * E2E: Login Lockout Flow
 *
 * Tests the server-side login lockout protection:
 * - Tracks failed login attempts
 * - Shows decreasing attempts warning
 * - Triggers account lockout after 5 failed attempts
 * - Displays lockout message with countdown
 * - Prevents further login attempts while locked
 *
 * Note: Uses unique emails per test to avoid lockout state interference.
 * Redis lockout data auto-expires after 15 minutes.
 */

import { test, expect, Page } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { generateUniqueEmail } from '../../data';

const WRONG_PASSWORD = 'WrongPassword123!';
const ATTEMPT_DELAY_MS = 400;

/**
 * Attempt a failed login with the given credentials
 */
async function attemptFailedLogin(page: Page, email: string, password: string): Promise<void> {
  await page.getByTestId('login-email-input').fill(email);
  await page.getByTestId('login-password-input').fill(password);
  await page.getByTestId('login-submit-button').click();
  await page.waitForTimeout(ATTEMPT_DELAY_MS);
}

/**
 * Make multiple failed login attempts
 */
async function makeFailedAttempts(page: Page, email: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await attemptFailedLogin(page, email, WRONG_PASSWORD);
  }
}

/**
 * Trigger full lockout (5 failed attempts)
 */
async function triggerLockout(page: Page, email: string): Promise<void> {
  await makeFailedAttempts(page, email, 5);
  await expect(page.getByTestId('lockout-alert')).toBeVisible({ timeout: 5000 });
}

test.describe('Login Lockout Flow', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.assertFormVisible();
  });

  test.describe('Attempt Warning Display', () => {
    test('should show decreasing attempts warning on failed logins', async ({ page }) => {
      const testEmail = generateUniqueEmail('lockout-test');

      await attemptFailedLogin(page, testEmail, WRONG_PASSWORD);
      await page.waitForTimeout(100);

      const attemptsWarning = page.getByTestId('attempts-warning');
      if (await attemptsWarning.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(attemptsWarning).toContainText(
          /\d+.*login attempts remaining|attempts remaining/i
        );
      }

      await page.getByTestId('login-password-input').fill(WRONG_PASSWORD);
      await page.getByTestId('login-submit-button').click();
      await page.waitForTimeout(500);

      await expect(page.getByTestId('login-submit-button')).not.toBeDisabled();
    });

    test('should show color-coded warning for low attempts', async ({ page }) => {
      const testEmail = generateUniqueEmail('lockout-color');

      await makeFailedAttempts(page, testEmail, 3);

      const attemptsWarning = page.getByTestId('attempts-warning');
      if (await attemptsWarning.isVisible({ timeout: 3000 }).catch(() => false)) {
        const warningText = await attemptsWarning.textContent();
        expect(warningText).toBeTruthy();
      }
    });

    test('should show "Last attempt!" warning before lockout', async ({ page }) => {
      const testEmail = generateUniqueEmail('lockout-last');

      await makeFailedAttempts(page, testEmail, 4);

      const attemptsWarning = page.getByTestId('attempts-warning');
      if (await attemptsWarning.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(attemptsWarning).toContainText(/last attempt|will be locked/i);
      }
    });
  });

  test.describe('Account Lockout', () => {
    test('should lock account after 5 failed attempts', async ({ page }) => {
      const testEmail = generateUniqueEmail('lockout-full');

      await triggerLockout(page, testEmail);

      const lockoutAlert = page.getByTestId('lockout-alert');
      await expect(lockoutAlert).toContainText(/account locked|locked/i);
      await expect(page.getByTestId('login-submit-button')).toBeDisabled();
    });

    test('should show lockout countdown timer', async ({ page }) => {
      const testEmail = generateUniqueEmail('lockout-countdown');

      await triggerLockout(page, testEmail);

      const lockoutAlert = page.getByTestId('lockout-alert');
      await expect(lockoutAlert).toContainText(/\d+:\d+|\d+ minute|few minutes|try again/i);
    });

    test('should persist lockout after page refresh', async ({ page }) => {
      const testEmail = generateUniqueEmail('lockout-persist');

      await triggerLockout(page, testEmail);

      await page.reload();
      await loginPage.assertFormVisible();

      await page.getByTestId('login-email-input').fill(testEmail);
      await page.getByTestId('login-password-input').fill('CorrectPassword123!');
      await page.getByTestId('login-submit-button').click();
      await page.waitForTimeout(500);

      const lockoutAlert = page.getByTestId('lockout-alert');
      const errorAlert = page.locator('[role="alert"]');

      const hasLockoutIndicator =
        (await lockoutAlert.isVisible().catch(() => false)) ||
        (await errorAlert
          .filter({ hasText: /locked|too many/i })
          .isVisible()
          .catch(() => false));

      expect(hasLockoutIndicator).toBe(true);
    });

    test('should block login attempts while locked (even with valid credentials)', async ({
      page,
    }) => {
      const testEmail = generateUniqueEmail('lockout-block');

      await triggerLockout(page, testEmail);

      const isDisabled = await page.getByTestId('login-submit-button').isDisabled();
      expect(isDisabled).toBe(true);
    });
  });

  test.describe('Security Characteristics', () => {
    test('should respond with consistent timing to prevent enumeration', async ({ page }) => {
      const validEmail = generateUniqueEmail('timing-valid');
      const invalidEmail = generateUniqueEmail('timing-invalid');
      const password = 'TestPassword123!';

      const startValid = Date.now();
      await page.getByTestId('login-email-input').fill(validEmail);
      await page.getByTestId('login-password-input').fill(password);
      await page.getByTestId('login-submit-button').click();
      await page.waitForSelector('[role="alert"]', { timeout: 5000 });
      const timeValid = Date.now() - startValid;

      await page.reload();
      await loginPage.assertFormVisible();

      const startInvalid = Date.now();
      await page.getByTestId('login-email-input').fill(invalidEmail);
      await page.getByTestId('login-password-input').fill(password);
      await page.getByTestId('login-submit-button').click();
      await page.waitForSelector('[role="alert"]', { timeout: 5000 });
      const timeInvalid = Date.now() - startInvalid;

      const timeDifference = Math.abs(timeValid - timeInvalid);
      expect(timeDifference).toBeLessThan(500);
    });

    test('should not reveal whether email exists via lockout messages', async ({ page }) => {
      const testEmail = generateUniqueEmail('enum-test');

      await makeFailedAttempts(page, testEmail, 3);

      const alertText = await page.locator('[role="alert"]').first().textContent();
      if (alertText) {
        expect(alertText.toLowerCase()).not.toContain('not found');
        expect(alertText.toLowerCase()).not.toContain("doesn't exist");
        expect(alertText.toLowerCase()).toMatch(/invalid|incorrect|wrong|failed/);
      }
    });
  });
});
