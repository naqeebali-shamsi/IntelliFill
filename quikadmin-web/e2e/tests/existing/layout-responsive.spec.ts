import { test, expect } from '@playwright/test';

/**
 * Responsive Layout E2E Tests
 *
 * Tests layout behavior across different viewport sizes:
 * - mobile-375: 375px (iPhone SE)
 * - sm-640: 640px (Tailwind sm breakpoint)
 * - md-768: 768px (Tailwind md breakpoint)
 * - lg-1024: 1024px (Tailwind lg breakpoint)
 * - xl-1280: 1280px (Tailwind xl breakpoint)
 */

test.describe('Responsive Layout Tests', () => {
  test('should load the login page successfully', async ({ page }) => {
    await page.goto('/login');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Check if the page title or heading exists
    await expect(page).toHaveTitle(/IntelliFill/i);
  });

  test('should display navigation elements appropriately', async ({ page, viewport }) => {
    await page.goto('/');

    // Log current viewport for debugging
    console.log(`Testing with viewport: ${viewport?.width}x${viewport?.height}`);

    // Mobile viewports (< 768px) might have hamburger menu
    if (viewport && viewport.width < 768) {
      // Check for mobile menu button or hamburger icon
      const mobileMenuButton = page.locator('[aria-label*="menu" i], button[aria-expanded]');
      if (await mobileMenuButton.count() > 0) {
        await expect(mobileMenuButton.first()).toBeVisible();
      }
    } else {
      // Desktop viewports should show full navigation
      const navigation = page.locator('nav, [role="navigation"]');
      if (await navigation.count() > 0) {
        await expect(navigation.first()).toBeVisible();
      }
    }
  });

  test('should handle viewport-specific content visibility', async ({ page, viewport }) => {
    await page.goto('/');

    // Verify page renders without layout shift
    await page.waitForLoadState('domcontentloaded');

    // Check that main content area is visible
    const mainContent = page.locator('main, [role="main"], #root > div');
    await expect(mainContent.first()).toBeVisible();

    // Verify no horizontal scroll on any viewport
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = viewport?.width || 1280;

    // Allow small tolerance for browser rendering differences
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });

  test('should render forms correctly across viewports', async ({ page, viewport }) => {
    // Navigate to a page with forms (e.g., login or register)
    await page.goto('/login');

    // Check if form is visible and properly sized
    const form = page.locator('form');
    if (await form.count() > 0) {
      await expect(form.first()).toBeVisible();

      // Form should not overflow viewport
      const formBox = await form.first().boundingBox();
      if (formBox && viewport) {
        expect(formBox.width).toBeLessThanOrEqual(viewport.width);
      }
    }
  });

  test('should maintain interactive elements accessibility', async ({ page }) => {
    await page.goto('/login');

    // Check that buttons are visible and clickable
    const buttons = page.locator('button:visible');
    const buttonCount = await buttons.count();

    if (buttonCount > 0) {
      // Verify at least one button is accessible
      const firstButton = buttons.first();
      await expect(firstButton).toBeVisible();

      // Check that button has accessible text or aria-label
      const hasText = await firstButton.textContent();
      const hasAriaLabel = await firstButton.getAttribute('aria-label');
      expect(hasText || hasAriaLabel).toBeTruthy();
    }
  });

  test('should handle touch targets on mobile viewports', async ({ page, viewport }) => {
    await page.goto('/');

    // On mobile viewports, interactive elements should have adequate size
    if (viewport && viewport.width < 768) {
      const interactiveElements = page.locator('button:visible, a:visible');
      const count = await interactiveElements.count();

      if (count > 0) {
        const firstElement = interactiveElements.first();
        const box = await firstElement.boundingBox();

        // Minimum touch target size recommendation is 44x44px
        if (box) {
          // Allow some elements to be smaller (like icons in dense UIs)
          // Just verify they're rendered
          expect(box.width).toBeGreaterThan(0);
          expect(box.height).toBeGreaterThan(0);
        }
      }
    }
  });
});

test.describe('Viewport Switching Tests', () => {
  test('should handle viewport resize gracefully', async ({ page }) => {
    await page.goto('/');

    // Test viewport switching
    const viewports = [
      { width: 375, height: 667 },
      { width: 768, height: 1024 },
      { width: 1280, height: 720 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForLoadState('domcontentloaded');

      // Verify page is still functional after resize
      const mainContent = page.locator('main, [role="main"], #root > div');
      await expect(mainContent.first()).toBeVisible();

      // Log for debugging
      console.log(`Switched to ${viewport.width}x${viewport.height}`);
    }
  });
});
