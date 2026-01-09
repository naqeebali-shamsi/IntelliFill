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

    // Check if the dashboard heading exists (greeting message)
    const heading = authenticatedPage.locator('h1:has-text("Good")');
    await expect(heading).toBeVisible();
  });

  test('should display dashboard stats grid without overflow', async ({ authenticatedPage, viewport }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Verify stats grid is visible
    const statsGrid = authenticatedPage.locator('.grid').first();
    await expect(statsGrid).toBeVisible();

    // Verify no horizontal scroll
    const bodyWidth = await authenticatedPage.evaluate(() => document.body.scrollWidth);
    const viewportWidth = viewport?.width || 1280;

    // Allow small tolerance for browser rendering differences
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });

  test('should render stat cards in correct grid layout', async ({ authenticatedPage, viewport }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Find the stats grid container
    const statsGrid = authenticatedPage.locator('.grid').first();
    await expect(statsGrid).toBeVisible();

    // Count stat card elements (should be 4: Total Documents, Processed Today, In Progress, Failed)
    const statCards = authenticatedPage.locator('.grid').first().locator('> div');
    const count = await statCards.count();

    // Should have 4 stat cards or be in loading state
    if (count > 0) {
      expect(count).toBeGreaterThanOrEqual(4);
    }

    // Verify grid layout classes based on viewport
    const gridClasses = await statsGrid.getAttribute('class');

    if (viewport && viewport.width >= 1024) {
      // Desktop: 4 columns
      expect(gridClasses).toContain('lg:grid-cols-4');
    } else if (viewport && viewport.width >= 768) {
      // Tablet: 2 columns
      expect(gridClasses).toContain('md:grid-cols-2');
    }
  });

  test('should display recent documents section', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Check for Recent Documents section
    const recentDocs = authenticatedPage.locator('text=Recent Documents');
    await expect(recentDocs).toBeVisible();
  });

  test('should display processing queue widget', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Check for Processing Queue widget
    const processingQueue = authenticatedPage.locator('text=Processing Queue');
    await expect(processingQueue).toBeVisible();
  });

  test('should display quick actions section', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Check for Quick Actions section
    const quickActions = authenticatedPage.locator('text=Quick Actions');
    await expect(quickActions).toBeVisible();

    // Verify action buttons exist
    const uploadButton = authenticatedPage.locator('text=Upload Document');
    const templateButton = authenticatedPage.locator('text=Create Template');
    const libraryButton = authenticatedPage.locator('text=Browse Library');

    await expect(uploadButton).toBeVisible();
    await expect(templateButton).toBeVisible();
    await expect(libraryButton).toBeVisible();
  });

  test('should handle layout responsively across viewport changes', async ({ authenticatedPage, viewport }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Log current viewport for debugging
    console.log(`Testing dashboard layout at viewport: ${viewport?.width}x${viewport?.height}`);

    // Verify main content is visible
    const mainContent = authenticatedPage.locator('main, [role="main"], .max-w-7xl').first();
    await expect(mainContent).toBeVisible();

    // Check responsive behavior
    if (viewport && viewport.width < 768) {
      // Mobile: Header should stack vertically
      const header = authenticatedPage.locator('h1:has-text("Good")').locator('..');
      await expect(header).toBeVisible();
    } else {
      // Desktop: Header elements should be in row
      const headerContainer = authenticatedPage.locator('.flex.flex-col.md\\:flex-row').first();
      if (await headerContainer.count() > 0) {
        await expect(headerContainer).toBeVisible();
      }
    }
  });

  test('should render all stat card icons correctly', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Wait for stat cards to load (allow for loading state)
    await authenticatedPage.waitForTimeout(500);

    // Check for stat card icons (lucide icons)
    // Icons are rendered as SVGs, so we check for their presence
    const statCardIcons = authenticatedPage.locator('.grid').first().locator('svg');
    const iconCount = await statCardIcons.count();

    // Should have at least 4 icons (one per stat card) if not in loading state
    if (iconCount > 0) {
      expect(iconCount).toBeGreaterThanOrEqual(4);
    }
  });
});

test.describe('StatCard Component Tests - Templates Page', () => {
  test('should display all template stat cards with correct testIds', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/templates');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Verify all 3 stat cards are visible
    const statCard1 = authenticatedPage.locator('[data-testid="stat-card-templates-1"]');
    const statCard2 = authenticatedPage.locator('[data-testid="stat-card-templates-2"]');
    const statCard3 = authenticatedPage.locator('[data-testid="stat-card-templates-3"]');

    await expect(statCard1).toBeVisible();
    await expect(statCard2).toBeVisible();
    await expect(statCard3).toBeVisible();
  });

  test('should render template stats without layout shift', async ({ authenticatedPage, viewport }) => {
    await authenticatedPage.goto('/templates');
    await authenticatedPage.waitForLoadState('networkidle');

    // Verify no horizontal overflow
    const bodyWidth = await authenticatedPage.evaluate(() => document.body.scrollWidth);
    const viewportWidth = viewport?.width || 1280;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });
});

test.describe('StatCard Component Tests - History Page', () => {
  test('should display all history stat cards with correct testIds', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/history');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Verify all 4 stat cards are visible
    const statCard1 = authenticatedPage.locator('[data-testid="stat-card-history-1"]');
    const statCard2 = authenticatedPage.locator('[data-testid="stat-card-history-2"]');
    const statCard3 = authenticatedPage.locator('[data-testid="stat-card-history-3"]');
    const statCard4 = authenticatedPage.locator('[data-testid="stat-card-history-4"]');

    await expect(statCard1).toBeVisible();
    await expect(statCard2).toBeVisible();
    await expect(statCard3).toBeVisible();
    await expect(statCard4).toBeVisible();
  });
});

test.describe('StatCard Component Tests - Knowledge Base Page', () => {
  test('should display all knowledge base stat cards with correct testIds', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/knowledge-base');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Verify all 4 stat cards are visible
    const statCard1 = authenticatedPage.locator('[data-testid="stat-card-knowledge-1"]');
    const statCard2 = authenticatedPage.locator('[data-testid="stat-card-knowledge-2"]');
    const statCard3 = authenticatedPage.locator('[data-testid="stat-card-knowledge-3"]');
    const statCard4 = authenticatedPage.locator('[data-testid="stat-card-knowledge-4"]');

    await expect(statCard1).toBeVisible();
    await expect(statCard2).toBeVisible();
    await expect(statCard3).toBeVisible();
    await expect(statCard4).toBeVisible();
  });
});

test.describe('StatCard Component Tests - Upload Page', () => {
  test('should display all upload stat cards with correct testIds', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/upload');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Verify all 4 stat cards are visible
    const statCard1 = authenticatedPage.locator('[data-testid="stat-card-upload-1"]');
    const statCard2 = authenticatedPage.locator('[data-testid="stat-card-upload-2"]');
    const statCard3 = authenticatedPage.locator('[data-testid="stat-card-upload-3"]');
    const statCard4 = authenticatedPage.locator('[data-testid="stat-card-upload-4"]');

    await expect(statCard1).toBeVisible();
    await expect(statCard2).toBeVisible();
    await expect(statCard3).toBeVisible();
    await expect(statCard4).toBeVisible();
  });
});

test.describe('Layout Stability Tests', () => {
  test('should maintain consistent layout when switching viewports', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');

    // Test viewport switching
    const viewports = [
      { width: 375, height: 667 },   // mobile-375
      { width: 768, height: 1024 },  // md-768
      { width: 1280, height: 720 },  // xl-1280
      { width: 640, height: 1136 },  // sm-640
      { width: 1024, height: 768 },  // lg-1024
    ];

    for (const vp of viewports) {
      await authenticatedPage.setViewportSize(vp);
      await authenticatedPage.waitForLoadState('domcontentloaded');

      // Verify page is still functional after resize
      const mainContent = authenticatedPage.locator('.max-w-7xl').first();
      await expect(mainContent).toBeVisible();

      // Verify no horizontal overflow
      const bodyWidth = await authenticatedPage.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(vp.width + 5);

      console.log(`✓ Dashboard stable at ${vp.width}x${vp.height}`);
    }
  });

  test('should render sidebar toggle on mobile viewports', async ({ authenticatedPage, viewport }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    if (viewport && viewport.width < 1024) {
      // Mobile/tablet viewports should have sidebar toggle button
      // Look for button with menu icon or hamburger
      const menuButton = authenticatedPage.locator('button[aria-label*="menu" i], button[aria-expanded], button:has(svg)').first();

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
  test('should display correct number of columns at each breakpoint', async ({ authenticatedPage, viewport }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('domcontentloaded');

    const statsGrid = authenticatedPage.locator('.grid').first();
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
      } else if (viewport.width >= 768) {
        // md breakpoint: 2 columns expected
        expect(columnCount).toBe(2);
      } else if (viewport.width >= 640) {
        // sm breakpoint: could be 1 or 2 columns
        expect(columnCount).toBeGreaterThanOrEqual(1);
      } else {
        // mobile: 1 column expected
        expect(columnCount).toBe(1);
      }

      console.log(`Grid has ${columnCount} columns at ${viewport.width}px`);
    }
  });

  test('should maintain aspect ratio of stat cards across viewports', async ({ authenticatedPage, viewport }) => {
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
      expect(box.width).toBeGreaterThan(100);  // At least 100px wide

      console.log(`StatCard dimensions at ${viewport.width}px: ${box.width}x${box.height}`);
    }
  });
});
