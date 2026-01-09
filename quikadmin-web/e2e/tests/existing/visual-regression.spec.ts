import { test, expect } from '@playwright/test';

/**
 * Visual Regression E2E Tests
 *
 * Tests visual consistency of key pages and components using screenshot comparison.
 * Baselines are captured per viewport size and stored in e2e/tests/__screenshots__/
 *
 * Usage:
 * - Run tests: bun run test:e2e (will fail if baselines don't exist)
 * - Capture/update baselines: bun run test:e2e:update-snapshots
 * - Review diffs: Check playwright-report/ after test failure
 *
 * Note: Screenshots are viewport-specific, so each test runs 5 times (one per viewport)
 */

test.describe('Visual Regression Tests', () => {
  test.describe('Authentication Pages', () => {
    test('should match login page screenshot', async ({ page }) => {
      await page.goto('/login');

      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle');

      // Take screenshot and compare to baseline
      await expect(page).toHaveScreenshot('login-page.png', {
        fullPage: true,
      });
    });

    test('should match register page screenshot', async ({ page }) => {
      await page.goto('/register');

      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle');

      // Take screenshot and compare to baseline
      await expect(page).toHaveScreenshot('register-page.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Dashboard', () => {
    test('should match dashboard layout', async ({ page }) => {
      // Note: This will fail until authentication is implemented
      // For now, this tests the login redirect behavior visually
      await page.goto('/');

      // Wait for navigation/redirect to complete
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('dashboard-or-redirect.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Component Snapshots', () => {
    test('should capture login form component', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Capture just the form element
      const form = page.locator('form').first();
      await expect(form).toBeVisible();
      await expect(form).toHaveScreenshot('login-form-component.png');
    });

    test('should capture navigation elements', async ({ page, viewport }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Capture navigation/header area
      const header = page.locator('header, nav, [role="banner"]').first();

      // Only test if header exists (might not on login page)
      if ((await header.count()) > 0) {
        await expect(header).toHaveScreenshot('navigation-header.png');
      }
    });

    test('should capture button states', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Find the primary button (likely submit button)
      const submitButton = page.locator('button[type="submit"]').first();

      if ((await submitButton.count()) > 0) {
        // Default state
        await expect(submitButton).toHaveScreenshot('button-default-state.png');

        // Hover state
        await submitButton.hover();
        await expect(submitButton).toHaveScreenshot('button-hover-state.png');

        // Focus state
        await submitButton.focus();
        await expect(submitButton).toHaveScreenshot('button-focus-state.png');
      }
    });
  });

  test.describe('Viewport-Specific Layouts', () => {
    test('should capture responsive layout variations', async ({
      page,
      viewport,
    }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Viewport info is included in screenshot name automatically by Playwright
      // Format: {test-name}-{project-name}.png
      // e.g., "responsive-layout-chromium-mobile-375.png"
      await expect(page).toHaveScreenshot('responsive-layout.png', {
        fullPage: true,
      });

      // Log viewport for debugging
      console.log(`Captured screenshot for viewport: ${viewport?.width}x${viewport?.height}`);
    });

    test('should capture mobile menu if present', async ({ page, viewport }) => {
      if (viewport && viewport.width < 768) {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Look for mobile menu button
        const mobileMenuButton = page.locator(
          '[aria-label*="menu" i], button[aria-expanded]'
        );

        if ((await mobileMenuButton.count()) > 0) {
          await expect(mobileMenuButton.first()).toHaveScreenshot(
            'mobile-menu-button.png'
          );

          // Click to open menu
          await mobileMenuButton.first().click();
          await page.waitForTimeout(300); // Wait for animation

          // Capture open menu state
          const menu = page.locator('[role="menu"], nav[aria-expanded="true"]');
          if ((await menu.count()) > 0) {
            await expect(menu.first()).toHaveScreenshot('mobile-menu-open.png');
          }
        }
      }
    });
  });

  test.describe('Error States', () => {
    test('should capture form validation errors', async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // Submit empty form to trigger validation
      const submitButton = page.locator('button[type="submit"]').first();

      if ((await submitButton.count()) > 0) {
        await submitButton.click();

        // Wait for validation messages to appear
        await page.waitForTimeout(500);

        // Capture form with validation errors
        const form = page.locator('form').first();
        await expect(form).toHaveScreenshot('login-form-validation-errors.png');
      }
    });
  });
});

test.describe('Theme Consistency', () => {
  test('should maintain consistent styling across pages', async ({ page }) => {
    const pages = ['/login', '/register'];

    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');

      // Extract CSS custom properties for theme colors
      const themeColors = await page.evaluate(() => {
        const root = document.documentElement;
        const styles = getComputedStyle(root);

        return {
          background: styles.getPropertyValue('--background'),
          foreground: styles.getPropertyValue('--foreground'),
          primary: styles.getPropertyValue('--primary'),
          'primary-foreground': styles.getPropertyValue('--primary-foreground'),
        };
      });

      // Log theme colors for visual verification
      console.log(`Theme colors on ${pagePath}:`, themeColors);

      // Take screenshot to ensure theme is applied
      await expect(page).toHaveScreenshot(`theme-${pagePath.replace('/', '')}.png`, {
        fullPage: true,
      });
    }
  });
});
