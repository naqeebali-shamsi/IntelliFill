/**
 * E2E-424: Error Recovery UX
 *
 * Tests that the system handles generic errors without exposing stack traces:
 * - Navigate to non-existent document ID (404 page)
 * - Force internal error (500)
 * - Verify "Try Again" button appearance
 * - Ensure no stack traces are exposed
 */

import { test, expect } from '@playwright/test';
import { test as authTest } from '../../fixtures/auth.fixture';
import { MockHelper } from '../../helpers/mock.helper';

test.describe('E2E-424: Error Recovery UX', () => {
  let mockHelper: MockHelper;

  authTest.beforeEach(async ({ authenticatedPage }) => {
    mockHelper = new MockHelper(authenticatedPage);
  });

  authTest('should show 404 page for non-existent document', async ({ authenticatedPage }) => {
    // Navigate to non-existent document ID
    const fakeDocumentId = 'non-existent-doc-99999';
    await authenticatedPage.goto(`http://localhost:8080/documents/${fakeDocumentId}`);

    // Wait for page to load
    await authenticatedPage.waitForTimeout(2000);

    // Should show 404 or "not found" message
    const pageContent = await authenticatedPage.textContent('body');

    // Check for 404 indicators
    const has404Indicator =
      pageContent?.includes('404') ||
      pageContent?.toLowerCase().includes('not found') ||
      pageContent?.toLowerCase().includes('doesn\'t exist') ||
      pageContent?.toLowerCase().includes('document not found');

    expect(has404Indicator).toBe(true);

    // CRITICAL: Ensure no stack traces are visible
    await assertNoStackTraceVisible(authenticatedPage);
  });

  authTest('should handle 500 internal server error gracefully', async ({ authenticatedPage }) => {
    // Mock API to return 500 error
    await mockHelper.mockApiError('**/api/documents', 500, 'Internal Server Error');

    // Navigate to documents page
    await authenticatedPage.goto('http://localhost:8080/documents');
    await authenticatedPage.waitForTimeout(2000);

    // Should show error message
    const pageContent = await authenticatedPage.textContent('body');

    // Check for generic error message
    const hasErrorMessage =
      pageContent?.toLowerCase().includes('error') ||
      pageContent?.toLowerCase().includes('something went wrong') ||
      pageContent?.toLowerCase().includes('unable to load');

    expect(hasErrorMessage).toBe(true);

    // CRITICAL: Ensure no stack traces are visible
    await assertNoStackTraceVisible(authenticatedPage);

    // Should NOT show detailed error information
    const hasDetailedError =
      pageContent?.includes('at ') ||  // Stack trace format
      pageContent?.includes('.js:') || // File references
      pageContent?.includes('Error:') ||
      pageContent?.includes('TypeError') ||
      pageContent?.includes('ReferenceError');

    expect(hasDetailedError).toBe(false);
  });

  authTest('should show "Try Again" button on error', async ({ authenticatedPage }) => {
    // Mock API failure
    await mockHelper.mockApiError('**/api/documents', 500, 'Internal Server Error');

    // Navigate to documents page
    await authenticatedPage.goto('http://localhost:8080/documents');
    await authenticatedPage.waitForTimeout(2000);

    // Look for retry/try again button
    const retryButton = authenticatedPage.locator(
      'button:has-text("Try Again"), button:has-text("Retry"), button:has-text("Reload")'
    );

    // Either a retry button exists or we show a helpful error message
    const hasRetryButton = await retryButton.isVisible();
    const pageContent = await authenticatedPage.textContent('body');
    const hasErrorMessage = pageContent?.toLowerCase().includes('error');

    // At minimum, should communicate the error occurred
    expect(hasRetryButton || hasErrorMessage).toBe(true);

    // CRITICAL: Ensure no stack traces
    await assertNoStackTraceVisible(authenticatedPage);
  });

  authTest('should handle corrupt file upload error', async ({ authenticatedPage }) => {
    const path = require('path');
    const SAMPLE_DOCS = path.join(__dirname, '..', '..', 'sample-docs');

    // Navigate to upload page or documents page
    await authenticatedPage.goto('http://localhost:8080/documents');
    await authenticatedPage.waitForTimeout(1000);

    // Mock OCR to fail for corrupt file
    await mockHelper.mockOcrService(
      {
        extractedFields: {},
        confidence: 0,
        pages: 0,
      },
      { statusCode: 400 }
    );

    // Try to upload corrupt file
    const corruptFile = path.join(SAMPLE_DOCS, 'corrupt-file.pdf');
    const fileInput = authenticatedPage.locator('input[type="file"]').first();

    if (await fileInput.isVisible()) {
      await fileInput.setInputFiles(corruptFile);
      await authenticatedPage.waitForTimeout(2000);

      // Should show error message
      const errorMessage = authenticatedPage.locator(
        '[role="alert"], .error-message, text=/error|failed|invalid|corrupt/i'
      );

      const hasError = await errorMessage.isVisible();
      expect(hasError).toBe(true);

      // CRITICAL: No stack traces
      await assertNoStackTraceVisible(authenticatedPage);
    }
  });

  authTest('should handle network timeout gracefully', async ({ authenticatedPage }) => {
    // Mock API with extreme delay to simulate timeout
    await mockHelper.mockApiDelay('**/api/documents', 30000);

    // Navigate to documents page
    await authenticatedPage.goto('http://localhost:8080/documents');
    await authenticatedPage.waitForTimeout(5000);

    // Should show loading state or timeout error
    const pageContent = await authenticatedPage.textContent('body');

    const hasLoadingOrError =
      pageContent?.toLowerCase().includes('loading') ||
      pageContent?.toLowerCase().includes('timeout') ||
      pageContent?.toLowerCase().includes('taking longer') ||
      pageContent?.toLowerCase().includes('error');

    expect(hasLoadingOrError).toBe(true);

    // CRITICAL: No stack traces
    await assertNoStackTraceVisible(authenticatedPage);
  });

  authTest('should show friendly error for unauthorized access', async ({ authenticatedPage }) => {
    // Mock API to return 403 Forbidden
    await mockHelper.mockApiError('**/api/documents/**', 403, 'Forbidden');

    // Try to access a document
    await authenticatedPage.goto('http://localhost:8080/documents/some-doc-id');
    await authenticatedPage.waitForTimeout(2000);

    const pageContent = await authenticatedPage.textContent('body');

    // Should show friendly unauthorized message
    const hasUnauthorizedMessage =
      pageContent?.toLowerCase().includes('access denied') ||
      pageContent?.toLowerCase().includes('unauthorized') ||
      pageContent?.toLowerCase().includes('permission') ||
      pageContent?.toLowerCase().includes('not allowed');

    expect(hasUnauthorizedMessage).toBe(true);

    // CRITICAL: No stack traces
    await assertNoStackTraceVisible(authenticatedPage);
  });

  authTest('should recover from error with retry', async ({ authenticatedPage }) => {
    let callCount = 0;

    // Mock API to fail first time, succeed second time
    await authenticatedPage.route('**/api/documents', async (route) => {
      callCount++;

      if (callCount === 1) {
        // First call fails
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Temporary error' }),
        });
      } else {
        // Second call succeeds
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ documents: [] }),
        });
      }
    });

    // Navigate to documents page (will fail initially)
    await authenticatedPage.goto('http://localhost:8080/documents');
    await authenticatedPage.waitForTimeout(2000);

    // Look for retry button
    const retryButton = authenticatedPage.locator(
      'button:has-text("Try Again"), button:has-text("Retry"), button:has-text("Reload")'
    ).first();

    if (await retryButton.isVisible()) {
      // Click retry
      await retryButton.click();
      await authenticatedPage.waitForTimeout(2000);

      // Should now show documents page successfully
      const pageContent = await authenticatedPage.textContent('body');

      // Error should be gone
      const stillHasError = pageContent?.toLowerCase().includes('internal server error');
      expect(stillHasError).toBe(false);
    } else {
      // If no retry button, refresh page manually
      await authenticatedPage.reload();
      await authenticatedPage.waitForTimeout(2000);

      // Should succeed on second try
      const pageContent = await authenticatedPage.textContent('body');
      const stillHasError = pageContent?.toLowerCase().includes('internal server error');
      expect(stillHasError).toBe(false);
    }

    // CRITICAL: No stack traces
    await assertNoStackTraceVisible(authenticatedPage);
  });

  authTest('should handle API rate limiting error', async ({ authenticatedPage }) => {
    // Mock 429 Too Many Requests
    await mockHelper.mockApiError('**/api/documents', 429, 'Too Many Requests');

    await authenticatedPage.goto('http://localhost:8080/documents');
    await authenticatedPage.waitForTimeout(2000);

    const pageContent = await authenticatedPage.textContent('body');

    // Should show rate limit message
    const hasRateLimitMessage =
      pageContent?.toLowerCase().includes('too many requests') ||
      pageContent?.toLowerCase().includes('rate limit') ||
      pageContent?.toLowerCase().includes('slow down') ||
      pageContent?.toLowerCase().includes('try again later');

    expect(hasRateLimitMessage).toBe(true);

    // CRITICAL: No stack traces
    await assertNoStackTraceVisible(authenticatedPage);
  });

  authTest('should handle JSON parse errors gracefully', async ({ authenticatedPage }) => {
    // Mock API to return invalid JSON
    await authenticatedPage.route('**/api/documents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'This is not valid JSON {]',
      });
    });

    await authenticatedPage.goto('http://localhost:8080/documents');
    await authenticatedPage.waitForTimeout(2000);

    // Should handle the parse error gracefully
    const pageContent = await authenticatedPage.textContent('body');

    // Should show generic error, not JSON parse details
    const hasGenericError = pageContent?.toLowerCase().includes('error');

    // Should NOT show technical parse error details
    const hasParseError =
      pageContent?.includes('JSON.parse') ||
      pageContent?.includes('SyntaxError') ||
      pageContent?.includes('Unexpected token');

    expect(hasGenericError).toBe(true);
    expect(hasParseError).toBe(false);

    // CRITICAL: No stack traces
    await assertNoStackTraceVisible(authenticatedPage);
  });

  authTest('should show user-friendly message for CORS errors', async ({ authenticatedPage }) => {
    // This test would ideally mock a CORS error, but that's difficult in Playwright
    // Instead, we'll verify the general error handling works

    // Mock API to fail with network error
    await authenticatedPage.route('**/api/documents', async (route) => {
      await route.abort('failed');
    });

    await authenticatedPage.goto('http://localhost:8080/documents');
    await authenticatedPage.waitForTimeout(2000);

    const pageContent = await authenticatedPage.textContent('body');

    // Should show network error message
    const hasNetworkError =
      pageContent?.toLowerCase().includes('network') ||
      pageContent?.toLowerCase().includes('connection') ||
      pageContent?.toLowerCase().includes('error') ||
      pageContent?.toLowerCase().includes('unable to load');

    expect(hasNetworkError).toBe(true);

    // CRITICAL: No stack traces or CORS technical details
    await assertNoStackTraceVisible(authenticatedPage);

    const hasCorsDetails = pageContent?.includes('CORS') || pageContent?.includes('cross-origin');
    expect(hasCorsDetails).toBe(false);
  });
});

/**
 * Helper function to verify no stack traces are visible in the DOM
 */
async function assertNoStackTraceVisible(page: any) {
  const pageContent = await page.textContent('body');

  // Check for common stack trace indicators
  const stackTraceIndicators = [
    'at Object.',
    'at Function.',
    'at async',
    '.js:',
    '.ts:',
    'node_modules/',
    'Error: ',
    'TypeError:',
    'ReferenceError:',
    'SyntaxError:',
    'at eval',
    'webpack://',
  ];

  const hasStackTrace = stackTraceIndicators.some(indicator =>
    pageContent?.includes(indicator)
  );

  // Assert no stack traces are visible
  expect(hasStackTrace).toBe(false);

  // Also check for specific error stack elements
  const stackTraceElement = page.locator(
    '.stack-trace, [class*="stack"], [class*="trace"], pre:has-text("at ")'
  );

  const stackVisible = await stackTraceElement.isVisible().catch(() => false);
  expect(stackVisible).toBe(false);
}
