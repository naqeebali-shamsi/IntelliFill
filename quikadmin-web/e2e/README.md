# E2E Testing with Playwright

This directory contains end-to-end tests for the IntelliFill frontend using Playwright.

## Configuration

Playwright is configured for **responsive testing** across 5 viewport sizes that align with Tailwind CSS breakpoints:

| Viewport Name | Width | Height | Description |
|---------------|-------|--------|-------------|
| mobile-375    | 375px | 667px  | iPhone SE |
| sm-640        | 640px | 1136px | Tailwind sm breakpoint |
| md-768        | 768px | 1024px | Tailwind md breakpoint (iPad) |
| lg-1024       | 1024px| 768px  | Tailwind lg breakpoint |
| xl-1280       | 1280px| 720px  | Tailwind xl breakpoint |

Each test runs across all 5 viewport configurations automatically.

## Setup

Install Playwright browsers (first time only):

```bash
bun run playwright:install
```

This will install only the Chromium browser to save disk space.

## Running Tests

```bash
# Run all E2E tests (headless)
bun run test:e2e

# Run with UI (interactive mode)
bun run test:e2e:ui

# Run in headed mode (see browser)
bun run test:e2e:headed

# Debug mode (step through tests)
bun run test:e2e:debug
```

## Test Structure

```
e2e/
├── tests/
│   ├── layout-responsive.spec.ts    # Responsive layout tests
│   ├── visual-regression.spec.ts    # Visual regression tests
│   └── __screenshots__/             # Baseline screenshots (auto-generated)
└── README.md                        # This file
```

## Writing Tests

Tests are written using Playwright's test API:

```typescript
import { test, expect } from '@playwright/test';

test('should work on all viewports', async ({ page, viewport }) => {
  await page.goto('/');

  // Test logic here
  // viewport contains { width, height } for current test

  await expect(page.locator('main')).toBeVisible();
});
```

### Viewport-Specific Logic

You can write viewport-specific test logic:

```typescript
test('should adapt to viewport', async ({ page, viewport }) => {
  await page.goto('/');

  if (viewport && viewport.width < 768) {
    // Mobile-specific tests
    await expect(page.locator('[aria-label="menu"]')).toBeVisible();
  } else {
    // Desktop-specific tests
    await expect(page.locator('nav')).toBeVisible();
  }
});
```

## Reports

Test reports are generated in:
- `playwright-report/` - HTML report (auto-opens on failure)
- `test-results/` - Test artifacts (screenshots, videos, traces)

View the HTML report:

```bash
bunx playwright show-report
```

## CI Integration

The configuration automatically adjusts for CI environments:
- Runs in headless mode
- Retries failed tests 2 times
- Runs tests sequentially (workers=1)
- Does not reuse existing dev server

## Visual Regression Testing

Visual regression tests capture screenshots of pages and components, comparing them against baseline images to detect unintended visual changes.

### Capturing Baselines

First time setup requires capturing baseline screenshots:

```bash
# Capture all baseline screenshots
bun run test:e2e:update-snapshots

# Capture baselines for specific test file
bunx playwright test visual-regression.spec.ts --update-snapshots
```

Baseline screenshots are stored in `e2e/tests/__screenshots__/` and should be committed to version control.

### Running Visual Tests

```bash
# Run visual regression tests (will fail if baselines don't exist)
bun run test:e2e

# Run only visual regression tests
bunx playwright test visual-regression.spec.ts

# Run with UI to review differences
bun run test:e2e:ui
```

### Reviewing Differences

When visual tests fail:

1. Check the HTML report: `bunx playwright show-report`
2. Review the diff images in `test-results/`
3. Determine if changes are intentional or bugs
4. If intentional, update baselines: `bun run test:e2e:update-snapshots`

### Screenshot Configuration

Visual regression settings in `playwright.config.ts`:

- **maxDiffPixelRatio**: 0.05 (5% of pixels can differ)
- **threshold**: 0.2 (20% per-pixel color difference tolerance)
- **animations**: disabled (prevents flaky tests)
- **scale**: CSS-based (consistent across displays)

### Viewport-Specific Screenshots

Each screenshot is captured for all 5 viewport sizes automatically:
- `login-page-chromium-mobile-375.png`
- `login-page-chromium-sm-640.png`
- `login-page-chromium-md-768.png`
- `login-page-chromium-lg-1024.png`
- `login-page-chromium-xl-1280.png`

### Writing Visual Tests

```typescript
import { test, expect } from '@playwright/test';

test('should match page screenshot', async ({ page }) => {
  await page.goto('/my-page');
  await page.waitForLoadState('networkidle');

  // Full page screenshot
  await expect(page).toHaveScreenshot('my-page.png', {
    fullPage: true,
  });
});

test('should match component screenshot', async ({ page }) => {
  await page.goto('/my-page');
  const component = page.locator('.my-component');

  // Component-only screenshot
  await expect(component).toHaveScreenshot('my-component.png');
});
```

### Best Practices for Visual Tests

1. **Wait for stability**: Use `waitForLoadState('networkidle')` before screenshots
2. **Disable animations**: Animations cause flaky tests (already configured)
3. **Avoid dynamic content**: Hide timestamps, random data, or mock them
4. **Test in isolation**: Each test should set up its own state
5. **Name descriptively**: Use clear, descriptive screenshot names
6. **Update intentionally**: Only update baselines when changes are deliberate

## Best Practices

1. **Test isolation**: Each test should be independent
2. **Wait strategies**: Use `page.waitForLoadState()` for stability
3. **Selectors**: Prefer accessible selectors (roles, labels) over CSS
4. **Assertions**: Use Playwright's built-in assertions for auto-retry
5. **Viewports**: Test responsive behavior, not just that elements exist

## Troubleshooting

**Dev server not starting:**
- Ensure port 8080 is available
- Check that `bun run dev` works standalone

**Tests timing out:**
- Increase timeout in `playwright.config.ts`
- Check network conditions
- Verify the application loads correctly

**Browser not found:**
- Run `bun run playwright:install`
- Check Playwright version matches config

**Visual regression tests failing:**
- First run? Capture baselines: `bun run test:e2e:update-snapshots`
- Font rendering differences? May need to update threshold in config
- Flaky failures? Check for animations or dynamic content
- CI failures? Ensure baselines are committed to git

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Writing Tests](https://playwright.dev/docs/writing-tests)
