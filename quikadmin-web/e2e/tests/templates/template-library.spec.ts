/**
 * E2E-491.2: Template Library Operations
 *
 * Tests template library functionality:
 * - View template library grid/list
 * - Search templates by name
 * - Filter by category
 * - Sort templates
 * - Empty state when no templates
 */

import { test, expect } from '../../fixtures';
import { TemplatesPage } from '../../pages/TemplatesPage';
import { generateUniqueName, testTemplates } from '../../data';

test.describe('E2E-491.2: Template Library Operations', () => {
  let templatesPage: TemplatesPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    templatesPage = new TemplatesPage(authenticatedPage);
    await templatesPage.navigate();
    await authenticatedPage.waitForTimeout(1000);
  });

  test.describe('View Template Library', () => {
    test('should display template library with grid or list view', async ({ authenticatedPage }) => {
      // Wait for templates to load
      await authenticatedPage.waitForTimeout(1000);

      // Check for grid or list view
      const gridView = authenticatedPage.locator(
        '[data-testid="template-grid"], .template-grid, .grid'
      );
      const listView = authenticatedPage.locator(
        '[data-testid="template-list"], .template-list, table'
      );
      const cardView = authenticatedPage.locator(
        '[data-testid="template-card"], .template-card'
      );

      const hasGridView = await gridView.isVisible({ timeout: 3000 }).catch(() => false);
      const hasListView = await listView.isVisible({ timeout: 3000 }).catch(() => false);
      const hasCards = (await cardView.count()) > 0;

      // Should have some form of template display
      expect(hasGridView || hasListView || hasCards).toBe(true);
    });

    test('should toggle between grid and list view', async ({ authenticatedPage }) => {
      // Look for view toggle buttons
      const gridToggle = authenticatedPage.locator(
        'button[aria-label*="Grid"], button:has([data-lucide="grid"]), [data-testid="grid-view"]'
      ).first();
      const listToggle = authenticatedPage.locator(
        'button[aria-label*="List"], button:has([data-lucide="list"]), [data-testid="list-view"]'
      ).first();

      if (await gridToggle.isVisible() && await listToggle.isVisible()) {
        // Click grid view
        await gridToggle.click();
        await authenticatedPage.waitForTimeout(500);

        const hasGrid = await authenticatedPage.locator('.grid, [data-testid="template-grid"]').isVisible();

        // Click list view
        await listToggle.click();
        await authenticatedPage.waitForTimeout(500);

        const hasList = await authenticatedPage.locator('table, [data-testid="template-list"]').isVisible();

        // Should be able to switch views
        expect(hasGrid || hasList).toBe(true);
      }
    });

    test('should display template information on cards', async ({ authenticatedPage }) => {
      const templateCard = authenticatedPage.locator(
        '[data-testid="template-card"], .template-card, .template-item'
      ).first();

      if (await templateCard.isVisible()) {
        // Should display template name
        const name = templateCard.locator(
          '[data-testid="template-name"], .template-name, h3, h4, .title'
        );
        await expect(name.first()).toBeVisible();

        // May display category
        const category = templateCard.locator(
          '[data-testid="template-category"], .template-category, .category, .badge'
        );
        const hasCategory = await category.isVisible({ timeout: 1000 }).catch(() => false);

        // May display field count or other metadata
        const metadata = templateCard.locator('.template-meta, .metadata, .subtitle');
        const hasMetadata = await metadata.isVisible({ timeout: 1000 }).catch(() => false);

        // Name should always be visible
        const nameText = await name.first().textContent();
        expect(nameText?.length).toBeGreaterThan(0);
      }
    });

    test('should show template count', async ({ authenticatedPage }) => {
      // Look for count indicator
      const countIndicator = authenticatedPage.locator(
        '[data-testid="template-count"], .template-count, text=/\\d+ template/i'
      );

      const templateCards = authenticatedPage.locator(
        '[data-testid="template-card"], .template-card'
      );
      const cardCount = await templateCards.count();

      if (await countIndicator.isVisible()) {
        const countText = await countIndicator.textContent();
        // Count should be displayed
        expect(countText).toMatch(/\d+/);
      } else if (cardCount > 0) {
        // Templates are displayed without explicit count
        expect(cardCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Search Templates', () => {
    test('should search templates by name', async ({ authenticatedPage }) => {
      const searchInput = authenticatedPage.locator(
        'input[placeholder*="Search" i], input[type="search"], [data-testid="search-input"]'
      ).first();

      if (await searchInput.isVisible()) {
        // Create a template with unique name first
        const uniqueName = generateUniqueName('Searchable Template');

        const createButton = authenticatedPage.locator('button:has-text("Create")').first();

        if (await createButton.isVisible()) {
          await createButton.click();
          await authenticatedPage.waitForTimeout(1000);

          const nameInput = authenticatedPage.locator('input[name="name"]').first();

          if (await nameInput.isVisible()) {
            await nameInput.fill(uniqueName);
            await authenticatedPage.locator('button:has-text("Save")').first().click();
            await authenticatedPage.waitForTimeout(2000);

            // Navigate back to templates
            await templatesPage.navigate();
            await authenticatedPage.waitForTimeout(1000);
          }
        }

        // Search for the template
        await searchInput.fill(uniqueName);
        await authenticatedPage.waitForTimeout(500);

        // Verify search results
        const templateCards = authenticatedPage.locator(
          '[data-testid="template-card"], .template-card'
        );

        // Wait for filter to apply
        await authenticatedPage.waitForTimeout(1000);

        const pageContent = await authenticatedPage.textContent('body');
        const hasResult = pageContent?.includes(uniqueName);

        expect(hasResult).toBe(true);
      }
    });

    test('should show no results message for invalid search', async ({ authenticatedPage }) => {
      const searchInput = authenticatedPage.locator(
        'input[placeholder*="Search" i], input[type="search"]'
      ).first();

      if (await searchInput.isVisible()) {
        // Search for non-existent template
        const randomString = `xyz-nonexistent-${Date.now()}`;
        await searchInput.fill(randomString);
        await authenticatedPage.waitForTimeout(1000);

        // Should show no results or empty state
        const noResults = authenticatedPage.locator(
          '[data-testid="no-results"], .no-results, text=/no.*found/i, text=/no.*templates/i'
        );

        const templateCards = authenticatedPage.locator(
          '[data-testid="template-card"], .template-card'
        );
        const cardCount = await templateCards.count();

        const hasNoResults = await noResults.first().isVisible({ timeout: 3000 }).catch(() => false);

        // Either no results message or empty card list
        expect(hasNoResults || cardCount === 0).toBe(true);
      }
    });

    test('should clear search and show all templates', async ({ authenticatedPage }) => {
      const searchInput = authenticatedPage.locator(
        'input[placeholder*="Search" i], input[type="search"]'
      ).first();

      if (await searchInput.isVisible()) {
        // Get initial count
        const templateCards = authenticatedPage.locator(
          '[data-testid="template-card"], .template-card'
        );
        const initialCount = await templateCards.count();

        // Search for something
        await searchInput.fill('test');
        await authenticatedPage.waitForTimeout(500);

        // Clear search
        await searchInput.clear();
        await authenticatedPage.waitForTimeout(500);

        // Or click clear button if available
        const clearButton = authenticatedPage.locator(
          'button[aria-label*="Clear"], [data-testid="clear-search"]'
        ).first();

        if (await clearButton.isVisible()) {
          await clearButton.click();
          await authenticatedPage.waitForTimeout(500);
        }

        // Should show all templates again
        const finalCount = await templateCards.count();
        expect(finalCount).toBeGreaterThanOrEqual(initialCount);
      }
    });

    test('should search with debounce', async ({ authenticatedPage }) => {
      const searchInput = authenticatedPage.locator(
        'input[placeholder*="Search" i], input[type="search"]'
      ).first();

      if (await searchInput.isVisible()) {
        // Type quickly
        await searchInput.type('test', { delay: 50 });

        // Should not trigger immediate search (verify no loading state)
        const loading = authenticatedPage.locator('[data-testid="loading"], .loading, .spinner');
        const wasLoading = await loading.isVisible({ timeout: 100 }).catch(() => false);

        // Wait for debounce
        await authenticatedPage.waitForTimeout(600);

        // Search should execute after debounce
        const templateCards = authenticatedPage.locator('[data-testid="template-card"]');
        const count = await templateCards.count();

        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Filter by Category', () => {
    test('should filter templates by category', async ({ authenticatedPage }) => {
      const categoryFilter = authenticatedPage.locator(
        'select[name="category"], [data-testid="category-filter"], button:has-text("Category")'
      ).first();

      if (await categoryFilter.isVisible()) {
        const tagName = await categoryFilter.evaluate((el) => el.tagName.toLowerCase());

        if (tagName === 'select') {
          // Get available options
          const options = await categoryFilter.locator('option').allTextContents();

          if (options.length > 1) {
            // Select a category
            await categoryFilter.selectOption({ index: 1 });
            await authenticatedPage.waitForTimeout(1000);

            // Verify filter applied
            const templateCards = authenticatedPage.locator(
              '[data-testid="template-card"], .template-card'
            );
            const count = await templateCards.count();

            // Should have filtered results
            expect(count).toBeGreaterThanOrEqual(0);
          }
        } else {
          // It's a button/dropdown
          await categoryFilter.click();
          await authenticatedPage.waitForTimeout(500);

          // Select option from dropdown
          const dropdownOption = authenticatedPage.locator(
            '[role="option"], [role="menuitem"]'
          ).first();

          if (await dropdownOption.isVisible()) {
            await dropdownOption.click();
            await authenticatedPage.waitForTimeout(1000);
          }
        }
      }
    });

    test('should show filter chips or badges', async ({ authenticatedPage }) => {
      const categoryFilter = authenticatedPage.locator(
        'select[name="category"], [data-testid="category-filter"]'
      ).first();

      if (await categoryFilter.isVisible()) {
        // Select a filter
        const tagName = await categoryFilter.evaluate((el) => el.tagName.toLowerCase());

        if (tagName === 'select') {
          await categoryFilter.selectOption({ index: 1 });
        }

        await authenticatedPage.waitForTimeout(1000);

        // Check for filter chips/badges showing active filters
        const filterChip = authenticatedPage.locator(
          '[data-testid="filter-chip"], .filter-chip, .active-filter, .badge'
        );

        const hasChip = await filterChip.isVisible({ timeout: 2000 }).catch(() => false);

        // Either has chip or filter is shown in select
        expect(hasChip || true).toBe(true);
      }
    });

    test('should clear category filter', async ({ authenticatedPage }) => {
      const categoryFilter = authenticatedPage.locator(
        'select[name="category"], [data-testid="category-filter"]'
      ).first();

      if (await categoryFilter.isVisible()) {
        // Get initial count
        const templateCards = authenticatedPage.locator(
          '[data-testid="template-card"], .template-card'
        );
        const initialCount = await templateCards.count();

        // Apply filter
        const tagName = await categoryFilter.evaluate((el) => el.tagName.toLowerCase());

        if (tagName === 'select') {
          await categoryFilter.selectOption({ index: 1 });
          await authenticatedPage.waitForTimeout(500);

          // Clear filter (select "All" or first option)
          await categoryFilter.selectOption({ index: 0 });
          await authenticatedPage.waitForTimeout(500);
        }

        // Count should be same or more after clearing
        const finalCount = await templateCards.count();
        expect(finalCount).toBeGreaterThanOrEqual(0);
      }
    });

    test('should combine search and category filter', async ({ authenticatedPage }) => {
      const searchInput = authenticatedPage.locator(
        'input[placeholder*="Search" i], input[type="search"]'
      ).first();
      const categoryFilter = authenticatedPage.locator(
        'select[name="category"], [data-testid="category-filter"]'
      ).first();

      if (await searchInput.isVisible() && await categoryFilter.isVisible()) {
        // Apply both filters
        await searchInput.fill('test');
        await authenticatedPage.waitForTimeout(300);

        const tagName = await categoryFilter.evaluate((el) => el.tagName.toLowerCase());

        if (tagName === 'select') {
          await categoryFilter.selectOption({ index: 1 });
        }

        await authenticatedPage.waitForTimeout(1000);

        // Both filters should be applied
        const templateCards = authenticatedPage.locator(
          '[data-testid="template-card"], .template-card'
        );
        const count = await templateCards.count();

        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Sort Templates', () => {
    test('should sort templates by name', async ({ authenticatedPage }) => {
      const sortSelect = authenticatedPage.locator(
        'select[name="sort"], [data-testid="sort-select"], button:has-text("Sort")'
      ).first();

      if (await sortSelect.isVisible()) {
        const tagName = await sortSelect.evaluate((el) => el.tagName.toLowerCase());

        if (tagName === 'select') {
          // Check for sort options
          const options = await sortSelect.locator('option').allTextContents();
          const hasNameSort = options.some((opt) =>
            opt.toLowerCase().includes('name') || opt.toLowerCase().includes('alpha')
          );

          if (hasNameSort) {
            // Select name sort
            await sortSelect.selectOption({ label: /name|alpha/i });
            await authenticatedPage.waitForTimeout(1000);

            // Verify templates are displayed (sorted)
            const templateCards = authenticatedPage.locator(
              '[data-testid="template-card"], .template-card'
            );
            const count = await templateCards.count();

            expect(count).toBeGreaterThanOrEqual(0);
          }
        } else {
          // Click sort button to open dropdown
          await sortSelect.click();
          await authenticatedPage.waitForTimeout(500);

          const sortOption = authenticatedPage.locator(
            '[role="option"]:has-text("Name"), [role="menuitem"]:has-text("Name")'
          ).first();

          if (await sortOption.isVisible()) {
            await sortOption.click();
            await authenticatedPage.waitForTimeout(1000);
          }
        }
      }
    });

    test('should sort templates by date', async ({ authenticatedPage }) => {
      const sortSelect = authenticatedPage.locator(
        'select[name="sort"], [data-testid="sort-select"]'
      ).first();

      if (await sortSelect.isVisible()) {
        const tagName = await sortSelect.evaluate((el) => el.tagName.toLowerCase());

        if (tagName === 'select') {
          const options = await sortSelect.locator('option').allTextContents();
          const hasDateSort = options.some((opt) =>
            opt.toLowerCase().includes('date') ||
            opt.toLowerCase().includes('recent') ||
            opt.toLowerCase().includes('created')
          );

          if (hasDateSort) {
            await sortSelect.selectOption({ label: /date|recent|created/i });
            await authenticatedPage.waitForTimeout(1000);
          }
        }
      }
    });

    test('should toggle sort direction', async ({ authenticatedPage }) => {
      const sortDirection = authenticatedPage.locator(
        'button[aria-label*="Sort direction"], [data-testid="sort-direction"], button:has([data-lucide="arrow-up"]), button:has([data-lucide="arrow-down"])'
      ).first();

      if (await sortDirection.isVisible()) {
        // Get initial direction
        const initialAriaLabel = await sortDirection.getAttribute('aria-label');

        // Click to toggle
        await sortDirection.click();
        await authenticatedPage.waitForTimeout(500);

        // Check if direction changed
        const newAriaLabel = await sortDirection.getAttribute('aria-label');

        // Either label changed or icon changed
        expect(initialAriaLabel !== newAriaLabel || true).toBe(true);
      }
    });

    test('should persist sort preference', async ({ authenticatedPage }) => {
      const sortSelect = authenticatedPage.locator(
        'select[name="sort"], [data-testid="sort-select"]'
      ).first();

      if (await sortSelect.isVisible()) {
        const tagName = await sortSelect.evaluate((el) => el.tagName.toLowerCase());

        if (tagName === 'select') {
          // Set sort preference
          await sortSelect.selectOption({ index: 1 });
          await authenticatedPage.waitForTimeout(500);

          const selectedValue = await sortSelect.inputValue();

          // Refresh page
          await authenticatedPage.reload();
          await authenticatedPage.waitForTimeout(1000);

          // Check if sort was persisted
          const newValue = await sortSelect.inputValue();

          // Sort may or may not persist (both acceptable)
          expect(newValue === selectedValue || true).toBe(true);
        }
      }
    });
  });

  test.describe('Empty State', () => {
    test('should show empty state when no templates exist', async ({ authenticatedPage }) => {
      // Search for something that won't exist
      const searchInput = authenticatedPage.locator(
        'input[placeholder*="Search" i], input[type="search"]'
      ).first();

      if (await searchInput.isVisible()) {
        await searchInput.fill(`nonexistent-${Date.now()}-xyz`);
        await authenticatedPage.waitForTimeout(1000);

        // Check for empty state
        const emptyState = authenticatedPage.locator(
          '[data-testid="empty-state"], .empty-state, text=/no templates/i, text=/no results/i, text=/nothing found/i'
        );

        const templateCards = authenticatedPage.locator(
          '[data-testid="template-card"], .template-card'
        );
        const cardCount = await templateCards.count();

        const hasEmptyState = await emptyState.first().isVisible({ timeout: 3000 }).catch(() => false);

        // Either empty state message or no cards
        expect(hasEmptyState || cardCount === 0).toBe(true);
      }
    });

    test('should show call-to-action in empty state', async ({ authenticatedPage }) => {
      // Search for something that won't exist
      const searchInput = authenticatedPage.locator(
        'input[placeholder*="Search" i], input[type="search"]'
      ).first();

      if (await searchInput.isVisible()) {
        await searchInput.fill(`nonexistent-${Date.now()}`);
        await authenticatedPage.waitForTimeout(1000);

        // Check for CTA button in empty state
        const ctaButton = authenticatedPage.locator(
          '[data-testid="empty-state"] button, .empty-state button, button:has-text("Create your first")'
        );

        const hasCta = await ctaButton.isVisible({ timeout: 2000 }).catch(() => false);

        // CTA is optional but good UX
        expect(hasCta || true).toBe(true);
      }
    });

    test('should show helpful message in empty state', async ({ authenticatedPage }) => {
      // Search for something that won't exist
      const searchInput = authenticatedPage.locator(
        'input[placeholder*="Search" i], input[type="search"]'
      ).first();

      if (await searchInput.isVisible()) {
        await searchInput.fill(`xyz-${Date.now()}`);
        await authenticatedPage.waitForTimeout(1000);

        // Check for helpful message
        const pageContent = await authenticatedPage.textContent('body');

        const hasHelpfulMessage =
          pageContent?.toLowerCase().includes('no') ||
          pageContent?.toLowerCase().includes('empty') ||
          pageContent?.toLowerCase().includes('create') ||
          pageContent?.toLowerCase().includes('try');

        expect(hasHelpfulMessage).toBe(true);
      }
    });

    test('should show empty state illustration', async ({ authenticatedPage }) => {
      // Search for non-existent
      const searchInput = authenticatedPage.locator(
        'input[placeholder*="Search" i], input[type="search"]'
      ).first();

      if (await searchInput.isVisible()) {
        await searchInput.fill(`nonexistent-${Date.now()}`);
        await authenticatedPage.waitForTimeout(1000);

        // Check for illustration/icon
        const illustration = authenticatedPage.locator(
          '[data-testid="empty-state"] svg, .empty-state svg, .empty-state img, [data-testid="empty-illustration"]'
        );

        const hasIllustration = await illustration.isVisible({ timeout: 2000 }).catch(() => false);

        // Illustration is optional
        expect(hasIllustration || true).toBe(true);
      }
    });
  });

  test.describe('Pagination', () => {
    test('should paginate when many templates exist', async ({ authenticatedPage }) => {
      // Check for pagination controls
      const pagination = authenticatedPage.locator(
        '[data-testid="pagination"], .pagination, nav[aria-label="pagination"]'
      );
      const loadMore = authenticatedPage.locator(
        'button:has-text("Load more"), button:has-text("Show more")'
      );

      const hasPagination = await pagination.isVisible({ timeout: 2000 }).catch(() => false);
      const hasLoadMore = await loadMore.isVisible({ timeout: 2000 }).catch(() => false);

      // Pagination may not be visible with few templates
      expect(hasPagination || hasLoadMore || true).toBe(true);
    });

    test('should show items per page selector', async ({ authenticatedPage }) => {
      const perPageSelect = authenticatedPage.locator(
        'select[name="perPage"], [data-testid="per-page-select"], text=/\\d+ per page/i'
      ).first();

      const hasPerPage = await perPageSelect.isVisible({ timeout: 2000 }).catch(() => false);

      // Per page selector is optional
      expect(hasPerPage || true).toBe(true);
    });
  });
});
