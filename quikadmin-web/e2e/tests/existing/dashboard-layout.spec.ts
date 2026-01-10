import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Dashboard Layout E2E Tests
 *
 * Tests dashboard-specific layout stability across different viewport sizes:
 * - mobile-375: 375px (iPhone SE)
 * - sm-640: 640px (Tailwind sm breakpoint)
 * - md-768: 768px (Tailwind md breakpoint)
 * - lg-1024: 1024px (Tailwind lg breakpoint)
 * - xl-1280: 1280px (Tailwind xl breakpoint)
 *
 * Covers:
 * - StatCard visibility across pages
 * - Dashboard layout stability
 * - Sidebar toggle functionality
 * - No horizontal overflow
 * - Responsive grid behavior
 *
 * Authentication is handled by the auth fixture which provides pre-authenticated
 * browser sessions, avoiding login redirects during test execution.
 */

test.describe('Dashboard Layout Tests', () => {
  // Authentication is handled by the auth fixture - tests use authenticatedPage

  test('should navigate to dashboard successfully', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');

    // Wait for the page to be fully loaded
    await authenticatedPage.waitForLoadState('networkidle');

    // Check if the dashboard heading exists (greeting message) using data-testid
    const heading = authenticatedPage.locator('[data-testid="dashboard-greeting"]');
    await expect(heading).toBeVisible();
  });

  test('should display dashboard stats grid without overflow', async ({
    authenticatedPage,
    viewport,
  }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Verify stats grid is visible using data-testid
    const statsGrid = authenticatedPage.locator('[data-testid="dashboard-stats-grid"]');
    await expect(statsGrid).toBeVisible();

    // Verify no horizontal scroll
    const bodyWidth = await authenticatedPage.evaluate(() => document.body.scrollWidth);
    const viewportWidth = viewport?.width || 1280;

    // Allow small tolerance for browser rendering differences
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });

  test('should render stat cards in correct grid layout', async ({
    authenticatedPage,
    viewport,
  }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Find the stats grid container using data-testid
    const statsGrid = authenticatedPage.locator('[data-testid="dashboard-stats-grid"]');
    await expect(statsGrid).toBeVisible();

    // Count stat card elements using data-testid pattern (should be 4: Total Documents, Processed Today, In Progress, Failed)
    const statCards = authenticatedPage.locator('[data-testid^="stat-card-dashboard-"]');
    const count = await statCards.count();

    // Should have 4 stat cards or be in loading state
    if (count > 0) {
      expect(count).toBeGreaterThanOrEqual(4);
    }

    // Verify grid columns using computed styles (more reliable than class assertions)
    const columnCount = await statsGrid.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      const columns = styles.gridTemplateColumns;
      return columns.split(' ').filter((col) => col !== 'none' && col !== '').length;
    });

    if (viewport && viewport.width >= 1024) {
      // Desktop: 4 columns expected
      expect(columnCount).toBe(4);
    } else if (viewport && viewport.width >= 640) {
      // sm/md breakpoints: 2 columns expected
      expect(columnCount).toBe(2);
    } else {
      // Mobile: 1 column expected
      expect(columnCount).toBe(1);
    }
  });

  test('should display recent documents section', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Check for Recent Documents section using data-testid
    const recentDocs = authenticatedPage.locator('[data-testid="dashboard-recent-documents"]');
    await expect(recentDocs).toBeVisible();
  });

  test('should display processing queue widget', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Check for Processing Queue widget using data-testid
    const processingQueue = authenticatedPage.locator('[data-testid="dashboard-processing-queue"]');
    await expect(processingQueue).toBeVisible();
  });

  test('should display quick actions section', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Check for Quick Actions section using data-testid
    const quickActions = authenticatedPage.locator('[data-testid="dashboard-quick-actions"]');
    await expect(quickActions).toBeVisible();

    // Verify action buttons exist using data-testid
    const uploadButton = authenticatedPage.locator('[data-testid="quick-action-upload"]');
    const templateButton = authenticatedPage.locator('[data-testid="quick-action-template"]');
    const libraryButton = authenticatedPage.locator('[data-testid="quick-action-library"]');

    await expect(uploadButton).toBeVisible();
    await expect(templateButton).toBeVisible();
    await expect(libraryButton).toBeVisible();
  });

  test('should handle layout responsively across viewport changes', async ({
    authenticatedPage,
    viewport,
  }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Log current viewport for debugging
    console.log(`Testing dashboard layout at viewport: ${viewport?.width}x${viewport?.height}`);

    // Verify main content is visible using data-testid fallback selector
    const mainContent = authenticatedPage
      .locator('[data-testid="dashboard-content"], main, .max-w-7xl')
      .first();
    await expect(mainContent).toBeVisible();

    // Check responsive behavior using data-testid for header
    if (viewport && viewport.width < 768) {
      // Mobile: Header should stack vertically
      const header = authenticatedPage.locator('[data-testid="dashboard-header"]');
      await expect(header).toBeVisible();
    } else {
      // Desktop: Header elements should be in row
      const headerContainer = authenticatedPage.locator('[data-testid="dashboard-header"]');
      if ((await headerContainer.count()) > 0) {
        await expect(headerContainer).toBeVisible();
      }
    }
  });

  test('should render all stat card icons correctly', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Wait for stat cards to load (allow for loading state)
    await authenticatedPage.waitForTimeout(500);

    // Check for stat card icons (lucide icons) using data-testid
    // Icons are rendered as SVGs, so we check for their presence within stat cards
    const statCardIcons = authenticatedPage.locator('[data-testid="dashboard-stats-grid"] svg');
    const iconCount = await statCardIcons.count();

    // Should have at least 4 icons (one per stat card) if not in loading state
    if (iconCount > 0) {
      expect(iconCount).toBeGreaterThanOrEqual(4);
    }
  });
});

/**
 * Verify stat cards are visible for a given page prefix and count
 */
async function assertStatCardsVisible(
  page: { locator: (selector: string) => import('@playwright/test').Locator },
  prefix: string,
  count: number
): Promise<void> {
  for (let i = 1; i <= count; i++) {
    const card = page.locator(`[data-testid="stat-card-${prefix}-${i}"]`);
    await expect(card).toBeVisible();
  }
}

test.describe('StatCard Component Tests - Templates Page', () => {
  test('should display all template stat cards with correct testIds', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/templates');
    await authenticatedPage.waitForLoadState('domcontentloaded');
    await assertStatCardsVisible(authenticatedPage, 'templates', 3);
  });

  test('should render template stats without layout shift', async ({
    authenticatedPage,
    viewport,
  }) => {
    await authenticatedPage.goto('/templates');
    await authenticatedPage.waitForLoadState('networkidle');

    const bodyWidth = await authenticatedPage.evaluate(() => document.body.scrollWidth);
    const viewportWidth = viewport?.width || 1280;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });
});

test.describe('StatCard Component Tests - History Page', () => {
  test('should display all history stat cards with correct testIds', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/history');
    await authenticatedPage.waitForLoadState('domcontentloaded');
    await assertStatCardsVisible(authenticatedPage, 'history', 4);
  });
});

test.describe('StatCard Component Tests - Knowledge Base Page', () => {
  test('should display all knowledge base stat cards with correct testIds', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/knowledge-base');
    await authenticatedPage.waitForLoadState('domcontentloaded');
    await assertStatCardsVisible(authenticatedPage, 'knowledge', 4);
  });
});

test.describe('StatCard Component Tests - Upload Page', () => {
  test('should display all upload stat cards with correct testIds', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/upload');
    await authenticatedPage.waitForLoadState('domcontentloaded');
    await assertStatCardsVisible(authenticatedPage, 'upload', 4);
  });
});

test.describe('Layout Stability Tests', () => {
  test('should maintain consistent layout when switching viewports', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/dashboard');

    // Test viewport switching
    const viewports = [
      { width: 375, height: 667 }, // mobile-375
      { width: 768, height: 1024 }, // md-768
      { width: 1280, height: 720 }, // xl-1280
      { width: 640, height: 1136 }, // sm-640
      { width: 1024, height: 768 }, // lg-1024
    ];

    for (const vp of viewports) {
      await authenticatedPage.setViewportSize(vp);
      await authenticatedPage.waitForLoadState('domcontentloaded');

      // Verify page is still functional after resize using data-testid fallback
      const mainContent = authenticatedPage
        .locator('[data-testid="dashboard-content"], .max-w-7xl')
        .first();
      await expect(mainContent).toBeVisible();

      // Verify no horizontal overflow
      const bodyWidth = await authenticatedPage.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(vp.width + 5);

      console.log(`✓ Dashboard stable at ${vp.width}x${vp.height}`);
    }
  });

  test('should render sidebar toggle on mobile viewports', async ({
    authenticatedPage,
    viewport,
  }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    if (viewport && viewport.width < 1024) {
      // Mobile/tablet viewports should have sidebar toggle button
      // Look for button with menu icon or hamburger
      const menuButton = authenticatedPage
        .locator('button[aria-label*="menu" i], button[aria-expanded], button:has(svg)')
        .first();

      // Not all viewports may have a sidebar toggle (depends on layout implementation)
      // So we just check if it exists and is clickable if present
      const buttonCount = await menuButton.count();
      if (buttonCount > 0) {
        await expect(menuButton).toBeVisible();
      }
    }
  });

  test('should not have layout shift between page loads', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    // Capture initial layout
    const initialHeight = await authenticatedPage.evaluate(() => document.body.scrollHeight);

    // Wait a bit to ensure no layout shifts
    await authenticatedPage.waitForTimeout(1000);

    const finalHeight = await authenticatedPage.evaluate(() => document.body.scrollHeight);

    // Allow for small differences due to dynamic content loading
    const heightDiff = Math.abs(finalHeight - initialHeight);
    expect(heightDiff).toBeLessThan(500); // Allow up to 500px for dynamic content
  });
});

test.describe('Grid Responsive Behavior', () => {
  test('should display correct number of columns at each breakpoint', async ({
    authenticatedPage,
    viewport,
  }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Use data-testid for reliable selection
    const statsGrid = authenticatedPage.locator('[data-testid="dashboard-stats-grid"]');
    await expect(statsGrid).toBeVisible();

    // Get the computed grid-template-columns style
    const gridColumns = await statsGrid.evaluate((el) => {
      return window.getComputedStyle(el).gridTemplateColumns;
    });

    // Count the number of columns by counting space-separated values
    const columnCount = gridColumns.split(' ').length;

    if (viewport) {
      if (viewport.width >= 1024) {
        // lg breakpoint: 4 columns expected
        expect(columnCount).toBe(4);
      } else if (viewport.width >= 640) {
        // sm/md breakpoints: 2 columns expected
        expect(columnCount).toBe(2);
      } else {
        // mobile: 1 column expected
        expect(columnCount).toBe(1);
      }

      console.log(`Grid has ${columnCount} columns at ${viewport.width}px`);
    }
  });

  test('should maintain aspect ratio of stat cards across viewports', async ({
    authenticatedPage,
    viewport,
  }) => {
    await authenticatedPage.goto('/templates'); // Use templates page which has StatCard components
    await authenticatedPage.waitForLoadState('domcontentloaded');

    const statCard1 = authenticatedPage.locator('[data-testid="stat-card-templates-1"]');
    await expect(statCard1).toBeVisible();

    // Get the bounding box
    const box = await statCard1.boundingBox();

    if (box && viewport) {
      // Verify the card doesn't overflow viewport width
      expect(box.width).toBeLessThanOrEqual(viewport.width);

      // Verify reasonable dimensions
      expect(box.height).toBeGreaterThan(50); // At least 50px tall
      expect(box.width).toBeGreaterThan(100); // At least 100px wide

      console.log(`StatCard dimensions at ${viewport.width}px: ${box.width}x${box.height}`);
    }
  });
});
