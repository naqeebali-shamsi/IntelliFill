import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../playwright.config';
import { loginAsUser, clearAuth } from '../utils/auth-helpers';

// Extended timeouts for mobile tests - production can have cold starts
const NAVIGATION_TIMEOUT = parseInt(process.env.NAVIGATION_TIMEOUT || '60000', 10);
const DASHBOARD_TIMEOUT = parseInt(process.env.DASHBOARD_TIMEOUT || '30000', 10);

/**
 * Mobile Responsiveness Tests
 *
 * Tests core functionality on mobile viewports.
 * Run with: npx playwright test --project="Mobile Chrome"
 */
test.describe('Mobile Responsiveness', () => {
  test.describe('Mobile Login', () => {
    test('should display login form correctly on mobile', async ({ page }) => {
      await page.goto('/login');

      // Verify login page loads
      await expect(page).toHaveURL(/.*login/);
      await expect(page.getByText('Welcome back')).toBeVisible();

      // Form elements should be visible and full-width
      const emailInput = page.getByLabel(/email/i);
      const passwordInput = page.getByLabel(/password/i);
      const loginButton = page.getByRole('button', { name: /sign in/i });

      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(loginButton).toBeVisible();
    });

    test('should login successfully on mobile', async ({ page }) => {
      // Use the robust loginAsUser helper with retry logic
      await loginAsUser(page, TEST_USERS.user);

      // Verify we're on dashboard (URL check is more reliable on mobile)
      await expect(page).toHaveURL(/.*dashboard/, { timeout: NAVIGATION_TIMEOUT });

      // On mobile, also verify something visible - either greeting or main content
      // The greeting may be scrolled, so check if visible or if we can find dashboard content
      const greetingVisible = await page.getByRole('heading', { name: /good morning|good afternoon|good evening/i, level: 1 })
        .isVisible()
        .catch(() => false);

      const dashboardContentVisible = await page.getByText(/recent documents|processing queue|total documents/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(greetingVisible || dashboardContentVisible).toBeTruthy();
    });

    test('should show validation errors on mobile', async ({ page }) => {
      await page.goto('/login');

      // Submit empty form
      await page.getByRole('button', { name: /sign in/i }).click();

      // Should show validation (HTML5 or form validation)
      await expect(
        page
          .getByText(/email.*required|please.*enter.*email/i)
          .or(page.locator('input[type="email"]:invalid'))
      ).toBeVisible();
    });
  });

  test.describe('Mobile Navigation', () => {
    test.beforeEach(async ({ page }) => {
      // Use robust login helper with retry logic for production cold starts
      await loginAsUser(page, TEST_USERS.user);
    });

    test('should have mobile-friendly navigation', async ({ page }) => {
      // Look for mobile menu button or hamburger
      const mobileMenuButton = page.getByRole('button', { name: /menu|toggle/i }).first();

      // Either a mobile menu button exists OR navigation is visible
      const hasNavigation = await page.getByRole('navigation').isVisible().catch(() => false);
      const hasMobileMenu = await mobileMenuButton.isVisible().catch(() => false);

      expect(hasNavigation || hasMobileMenu).toBeTruthy();
    });

    test('should navigate to upload page on mobile', async ({ page }) => {
      // Navigate to upload - may be via menu or direct link
      const uploadLink = page.getByRole('link', { name: /upload/i }).first();
      if (await uploadLink.isVisible()) {
        await uploadLink.click();
      } else {
        await page.goto('/upload');
      }

      await expect(
        page.getByRole('heading', { name: /upload/i, level: 1 })
      ).toBeVisible();
    });

    test('should navigate to documents page on mobile', async ({ page }) => {
      // Navigate to documents
      const docsLink = page.getByRole('link', { name: /document/i }).first();
      if (await docsLink.isVisible()) {
        await docsLink.click();
      } else {
        await page.goto('/documents');
      }

      await expect(
        page.getByRole('heading', { name: /document/i, level: 1 })
      ).toBeVisible();
    });
  });

  test.describe('Mobile Upload', () => {
    test.beforeEach(async ({ page }) => {
      // Use robust login helper with retry logic for production cold starts
      await loginAsUser(page, TEST_USERS.user);
    });

    test('should display upload zone on mobile', async ({ page }) => {
      await page.goto('/upload');

      // Upload interface should be visible
      await expect(
        page.getByRole('heading', { name: 'Upload Documents', level: 1 })
      ).toBeVisible();

      // File drop zone should exist (use exact name to avoid matching file input)
      const uploadZone = page.getByRole('button', { name: 'File upload drop zone' });
      await expect(uploadZone).toBeVisible();
    });

    test('should show touch-friendly upload button', async ({ page }) => {
      await page.goto('/upload');

      // The upload button should be large enough for touch (44px minimum)
      // Use exact name to avoid matching the hidden file input
      const uploadButton = page.getByRole('button', { name: 'File upload drop zone' });
      await expect(uploadButton).toBeVisible();

      const box = await uploadButton.boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        // Minimum touch target size (44px is Apple's recommendation)
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    });
  });

  test.describe('Mobile Layout', () => {
    test('should not have horizontal scroll on login', async ({ page }) => {
      await page.goto('/login');

      // Check for horizontal overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      expect(hasHorizontalScroll).toBeFalsy();
    });

    test('should not have horizontal scroll on dashboard', async ({ page }) => {
      // Use robust login helper with retry logic for production cold starts
      await loginAsUser(page, TEST_USERS.user);

      // Verify we're on dashboard
      await expect(page).toHaveURL(/.*dashboard/, { timeout: NAVIGATION_TIMEOUT });

      // Check for horizontal overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      expect(hasHorizontalScroll).toBeFalsy();
    });
  });
});
