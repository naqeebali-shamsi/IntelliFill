# Contributing to E2E Tests

Thank you for contributing to IntelliFill's E2E test suite! This guide will help you write effective, maintainable tests.

## Getting Started

1. **Set up the environment**:
   ```bash
   cd e2e
   npm install
   npx playwright install
   ```

2. **Run existing tests**:
   ```bash
   npm test
   ```

3. **Explore with Playwright UI**:
   ```bash
   npm run test:ui
   ```

## Writing Tests

### Test File Structure

Create test files in `e2e/tests/` with `.spec.ts` extension:

```typescript
import { test, expect } from '@playwright/test';
import { loginAsUser } from '../utils/auth-helpers';
import { TEST_USERS } from '../playwright.config';

test.describe('Feature Name', () => {
  // Setup before all tests in this file
  test.beforeAll(async () => {
    // One-time setup
  });

  // Setup before each test
  test.beforeEach(async ({ page }) => {
    // Login or navigate to starting point
    await loginAsUser(page, TEST_USERS.user);
  });

  // Cleanup after each test
  test.afterEach(async ({ page }) => {
    // Optional cleanup
  });

  test('should do something specific', async ({ page }) => {
    // Arrange: Set up test preconditions
    await page.goto('/feature');

    // Act: Perform the action being tested
    await page.getByRole('button', { name: /submit/i }).click();

    // Assert: Verify expected outcomes
    await expect(page.getByText(/success/i)).toBeVisible();
  });
});
```

### Naming Conventions

**Test Files**:
- Use kebab-case: `feature-name.spec.ts`
- Be descriptive: `user-profile-edit.spec.ts`
- Group related tests: `auth.spec.ts` for all auth tests

**Test Descriptions**:
- Use "should" statements: `should display error for invalid email`
- Be specific: `should upload PDF file and show progress` (not just "should upload file")
- Include context: `should prevent form submission when required fields are empty`

**Test Groups**:
- Use `test.describe()` to group related tests
- Nest describes for sub-features

### Selectors

**Priority Order** (use in this order):

1. **Role-based** (most stable):
   ```typescript
   page.getByRole('button', { name: /login/i })
   page.getByRole('textbox', { name: /email/i })
   page.getByRole('heading', { name: /dashboard/i })
   ```

2. **Label-based** (for form inputs):
   ```typescript
   page.getByLabel(/email/i)
   page.getByLabel(/password/i)
   ```

3. **Text-based** (for visible text):
   ```typescript
   page.getByText(/welcome/i)
   page.getByText(/upload successful/i)
   ```

4. **Test IDs** (as last resort):
   ```typescript
   page.getByTestId('file-upload-zone')
   ```

**Avoid**:
- CSS selectors: `.class-name`, `#id`
- XPath selectors
- Brittle selectors that depend on DOM structure

### Assertions

**Use built-in assertions**:
```typescript
// Visibility
await expect(page.getByText(/welcome/i)).toBeVisible();
await expect(page.getByText(/loading/i)).not.toBeVisible();

// Content
await expect(page).toHaveTitle(/IntelliFill/i);
await expect(page).toHaveURL(/.*dashboard/);
await expect(page.getByRole('heading')).toHaveText('Dashboard');

// State
await expect(page.getByRole('button')).toBeDisabled();
await expect(page.getByRole('checkbox')).toBeChecked();

// Count
await expect(page.getByRole('listitem')).toHaveCount(5);
```

**Use soft assertions for multiple checks**:
```typescript
await expect.soft(page.getByText('Error 1')).toBeVisible();
await expect.soft(page.getByText('Error 2')).toBeVisible();
// Test continues even if assertions fail
```

### Waits and Timeouts

**Prefer explicit waits**:
```typescript
// Good: Wait for specific condition
await page.waitForURL(/.*dashboard/);
await page.waitForSelector('[data-loading="false"]');

// Bad: Fixed timeout
await page.waitForTimeout(5000); // Avoid unless absolutely necessary
```

**Use timeouts appropriately**:
```typescript
// Increase timeout for slow operations
await expect(page.getByText(/uploaded/i)).toBeVisible({ timeout: 30000 });

// Set timeout per test
test('slow operation', async ({ page }) => {
  test.setTimeout(60000);
  // Test code
});
```

### Handling Async Operations

```typescript
// Wait for API response
await page.waitForResponse(/\/api\/documents/);

// Wait for navigation
await Promise.all([
  page.waitForNavigation(),
  page.click('a[href="/documents"]')
]);

// Wait for element state
await page.getByRole('button').waitFor({ state: 'visible' });
```

### Test Data

**Use fixtures for test files**:
```typescript
import path from 'path';

const testFile = path.join(__dirname, '../fixtures/sample-document.pdf');
await page.setInputFiles('input[type="file"]', testFile);
```

**Generate unique data**:
```typescript
import { generateUniqueEmail } from '../utils/test-helpers';

const email = generateUniqueEmail(); // test-xyz123@intellifill.local
```

**Use test users from config**:
```typescript
import { TEST_USERS } from '../playwright.config';

await loginAsUser(page, TEST_USERS.user);
await loginAsUser(page, TEST_USERS.admin);
```

## Helper Functions

### When to Create Helpers

Create helpers for:
- Actions repeated in 3+ tests
- Complex multi-step workflows
- Authentication flows
- API interactions
- Test data generation

### Helper Location

- **Auth helpers**: `utils/auth-helpers.ts`
- **General helpers**: `utils/test-helpers.ts`
- **Feature-specific**: `utils/feature-name-helpers.ts`

### Helper Example

```typescript
// utils/document-helpers.ts
import { Page } from '@playwright/test';

export async function uploadDocument(
  page: Page,
  filePath: string
): Promise<void> {
  await page.goto('/upload');
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);

  const uploadButton = page.getByRole('button', { name: /upload/i });
  if (await uploadButton.isVisible()) {
    await uploadButton.click();
  }

  // Wait for success
  await page.waitForResponse(/\/api\/documents/);
}
```

## Test Organization

### Small, Focused Tests

```typescript
// Good: One test per behavior
test('should display error for invalid email', async ({ page }) => {
  await page.getByLabel(/email/i).fill('invalid-email');
  await page.getByRole('button', { name: /submit/i }).click();
  await expect(page.getByText(/invalid.*email/i)).toBeVisible();
});

test('should display error for empty password', async ({ page }) => {
  await page.getByLabel(/email/i).fill('test@example.com');
  await page.getByRole('button', { name: /submit/i }).click();
  await expect(page.getByText(/password.*required/i)).toBeVisible();
});

// Bad: Testing multiple behaviors in one test
test('should validate form', async ({ page }) => {
  // Tests email AND password AND submission...
  // If one fails, can't tell which behavior broke
});
```

### Test Independence

```typescript
// Good: Each test is independent
test('should create document', async ({ page }) => {
  const doc = await createDocument(page, 'Test Doc');
  await expect(page.getByText('Test Doc')).toBeVisible();
});

test('should edit document', async ({ page }) => {
  const doc = await createDocument(page, 'Original');
  await editDocument(page, doc.id, 'Modified');
  await expect(page.getByText('Modified')).toBeVisible();
});

// Bad: Tests depend on each other
let documentId;
test('should create document', async ({ page }) => {
  documentId = await createDocument(page, 'Test Doc');
});

test('should edit document', async ({ page }) => {
  await editDocument(page, documentId, 'Modified'); // Fails if first test fails
});
```

## Debugging Tests

### Interactive Debugging

```bash
# Run with headed browser
npm run test:headed

# Run with Playwright Inspector
npm run test:debug

# Run specific test
npm test -- tests/auth.spec.ts

# Run with UI mode
npm run test:ui
```

### Console Logging

```typescript
test('debugging test', async ({ page }) => {
  // Log page URL
  console.log('Current URL:', page.url());

  // Log element count
  const items = page.getByRole('listitem');
  console.log('Item count:', await items.count());

  // Log element text
  const heading = page.getByRole('heading');
  console.log('Heading text:', await heading.textContent());
});
```

### Screenshots

```typescript
test('debugging test', async ({ page }) => {
  // Take screenshot at specific point
  await page.screenshot({ path: 'debug-screenshot.png' });

  // Take full page screenshot
  await page.screenshot({
    path: 'debug-full.png',
    fullPage: true
  });
});
```

### Traces

Traces are automatically collected on failure. To collect always:

```typescript
test.use({ trace: 'on' });

test('with trace', async ({ page }) => {
  // Trace collected regardless of pass/fail
});
```

View traces:
```bash
npx playwright show-trace e2e/test-results/.../trace.zip
```

## Best Practices

### DO

- Write descriptive test names
- Use semantic selectors (role, label, text)
- Wait for explicit conditions, not fixed timeouts
- Keep tests small and focused
- Make tests independent
- Use helpers for repeated code
- Test user flows, not implementation details
- Handle both success and error cases
- Clean up test data in afterEach
- Use soft assertions for multiple checks

### DON'T

- Use CSS/XPath selectors
- Use `page.waitForTimeout()` unless necessary
- Share state between tests
- Test multiple behaviors in one test
- Rely on test execution order
- Hard-code URLs (use `baseURL` from config)
- Ignore TypeScript errors
- Leave commented-out code
- Skip cleanup
- Test internal implementation

## Performance

### Fast Tests

```typescript
// Reuse authentication state
test.use({
  storageState: 'auth/user.json' // Pre-authenticated state
});

// Parallel execution
test.describe.configure({ mode: 'parallel' });

// Skip unnecessary waits
test('fast test', async ({ page }) => {
  // Navigate without waiting for full load
  await page.goto('/', { waitUntil: 'domcontentloaded' });
});
```

### Slow Tests

Mark slow tests:
```typescript
test('slow integration test', async ({ page }) => {
  test.slow(); // Triples timeout
  // Long-running test
});
```

Skip in CI:
```typescript
test('optional slow test', async ({ page }) => {
  test.skip(!!process.env.CI, 'Skip slow tests in CI');
  // Test code
});
```

## Review Checklist

Before submitting PR with test changes:

- [ ] Tests pass locally
- [ ] Tests pass in Docker (`npm run docker:test`)
- [ ] Test names are descriptive
- [ ] Used semantic selectors (role, label, text)
- [ ] No hard-coded timeouts
- [ ] Tests are independent
- [ ] Helpers extracted for repeated code
- [ ] TypeScript errors resolved
- [ ] No commented-out code
- [ ] Test fixtures added if needed
- [ ] README updated if new patterns introduced

## Getting Help

- **Playwright Docs**: https://playwright.dev/
- **Selector Guide**: https://playwright.dev/docs/selectors
- **Best Practices**: https://playwright.dev/docs/best-practices
- **Project README**: `e2e/README.md`

## Questions?

Open an issue or ask in the project's communication channel.
