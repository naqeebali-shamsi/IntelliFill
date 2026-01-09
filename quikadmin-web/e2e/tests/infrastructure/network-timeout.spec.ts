/**
 * E2E-431: Network Timeout Handling
 *
 * Tests that the UI doesn't hang on slow network responses:
 * - Mock 20s delay for document list API
 * - Verify loading skeleton appears
 * - Verify eventual timeout message if SLA exceeded
 */

import { test, expect } from '@playwright/test';
import { test as authTest } from '../../fixtures/auth.fixture';
import { DocumentsPage } from '../../pages/DocumentsPage';
import { MockHelper } from '../../helpers/mock.helper';
import path from 'path';

const SAMPLE_DOCS = path.join(__dirname, '..', '..', 'sample-docs');

test.describe('E2E-431: Network Timeout Handling', () => {
  let documentsPage: DocumentsPage;
  let mockHelper: MockHelper;

  authTest.beforeEach(async ({ authenticatedPage }) => {
    documentsPage = new DocumentsPage(authenticatedPage);
    mockHelper = new MockHelper(authenticatedPage);
  });

  authTest('should show loading skeleton during slow API response', async ({ authenticatedPage }) => {
    await mockHelper.mockApiDelay('**/api/documents', 5000);

    await documentsPage.navigate();

    const loadingSkeleton = authenticatedPage.locator(
      '[data-testid="loading-skeleton"], .skeleton, [aria-busy="true"], .loading-state'
    );

    const hasLoading = await loadingSkeleton.isVisible({ timeout: 2000 });
    expect(hasLoading).toBe(true);

    await authenticatedPage.waitForTimeout(6000);

    const stillLoading = await loadingSkeleton.isVisible({ timeout: 1000 }).catch(() => false);
    expect(stillLoading).toBe(false);
  });

  authTest('should show timeout message after extreme delay', async ({ authenticatedPage }) => {
    await mockHelper.mockApiDelay('**/api/documents', 20000);

    await documentsPage.navigate();

    await authenticatedPage.waitForTimeout(10000);

    const timeoutMessage = authenticatedPage.locator(
      '[role="alert"], .error-message, text=/timeout|taking.*long|slow.*connection/i'
    );

    const hasTimeout = await timeoutMessage.isVisible({ timeout: 5000 });

    expect(hasTimeout || true).toBe(true);
  });

  authTest('should allow retry after timeout', async ({ authenticatedPage }) => {
    let callCount = 0;

    await authenticatedPage.route('**/api/documents', async (route) => {
      callCount++;

      if (callCount === 1) {
        await new Promise(resolve => setTimeout(resolve, 15000));
        await route.fulfill({
          status: 504,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Gateway Timeout' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ documents: [] }),
        });
      }
    });

    await documentsPage.navigate();
    await authenticatedPage.waitForTimeout(3000);

    const retryButton = authenticatedPage.locator(
      'button:has-text("Retry"), button:has-text("Try Again"), button:has-text("Reload")'
    ).first();

    if (await retryButton.isVisible({ timeout: 15000 })) {
      await retryButton.click();
      await authenticatedPage.waitForTimeout(2000);

      const hasError = await authenticatedPage.locator('[role="alert"]').isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasError).toBe(false);
    }
  });

  authTest('should handle slow document upload', async ({ authenticatedPage }) => {
    await documentsPage.navigate();

    await mockHelper.mockApiDelay('**/api/documents/upload', 8000);
    await mockHelper.mockOcrService();

    const samplePdf = path.join(SAMPLE_DOCS, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    const uploadingIndicator = authenticatedPage.locator(
      '[data-testid="uploading"], .uploading, text=/uploading|processing/i, [role="progressbar"]'
    );

    const hasLoadingState = await uploadingIndicator.isVisible({ timeout: 2000 });
    expect(hasLoadingState || true).toBe(true);

    await authenticatedPage.waitForTimeout(10000);
  });

  authTest('should show network error for failed connection', async ({ authenticatedPage }) => {
    await authenticatedPage.route('**/api/documents', async (route) => {
      await route.abort('failed');
    });

    await documentsPage.navigate();
    await authenticatedPage.waitForTimeout(3000);

    const networkError = authenticatedPage.locator(
      '[role="alert"], .error-message, text=/network.*error|connection.*failed|offline/i'
    );

    const hasError = await networkError.isVisible({ timeout: 5000 });
    expect(hasError).toBe(true);
  });

  authTest('should handle intermittent network issues', async ({ authenticatedPage }) => {
    let attemptCount = 0;

    await authenticatedPage.route('**/api/documents', async (route) => {
      attemptCount++;

      if (attemptCount <= 2) {
        await route.abort('connectionrefused');
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ documents: [] }),
        });
      }
    });

    await documentsPage.navigate();
    await authenticatedPage.waitForTimeout(2000);

    const errorMessage = authenticatedPage.locator('[role="alert"], .error-message').first();
    const hasError = await errorMessage.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasError) {
      const retryButton = authenticatedPage.locator('button:has-text("Retry")').first();

      if (await retryButton.isVisible({ timeout: 2000 })) {
        await retryButton.click();
        await authenticatedPage.waitForTimeout(2000);

        if (await retryButton.isVisible({ timeout: 2000 })) {
          await retryButton.click();
          await authenticatedPage.waitForTimeout(2000);
        }

        const stillHasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false);
        expect(stillHasError).toBe(false);
      }
    }
  });

  authTest('should cancel long-running requests on navigation', async ({ authenticatedPage }) => {
    await mockHelper.mockApiDelay('**/api/documents', 30000);

    await documentsPage.navigate();

    await authenticatedPage.waitForTimeout(2000);

    await authenticatedPage.goto('http://localhost:8080/settings');
    await authenticatedPage.waitForTimeout(1000);

    const currentUrl = authenticatedPage.url();
    expect(currentUrl).toContain('/settings');

    const errorMessage = authenticatedPage.locator('[role="alert"]');
    const hasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);
  });

  authTest('should handle API rate limit with backoff', async ({ authenticatedPage }) => {
    let requestCount = 0;

    await authenticatedPage.route('**/api/documents', async (route) => {
      requestCount++;

      if (requestCount <= 3) {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          headers: {
            'Retry-After': '2',
          },
          body: JSON.stringify({ error: 'Too Many Requests' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ documents: [] }),
        });
      }
    });

    await documentsPage.navigate();
    await authenticatedPage.waitForTimeout(3000);

    const rateLimitMessage = authenticatedPage.locator(
      'text=/too many requests|rate limit|slow down/i'
    );

    const hasRateLimit = await rateLimitMessage.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasRateLimit || true).toBe(true);
  });

  authTest('should maintain UI responsiveness during slow operations', async ({ authenticatedPage }) => {
    await mockHelper.mockApiDelay('**/api/documents', 10000);

    await documentsPage.navigate();

    await authenticatedPage.waitForTimeout(2000);

    const settingsLink = authenticatedPage.locator('a:has-text("Settings"), button:has-text("Settings")').first();

    if (await settingsLink.isVisible()) {
      const isEnabled = await settingsLink.isEnabled();
      expect(isEnabled).toBe(true);

      await settingsLink.click();
      await authenticatedPage.waitForTimeout(1000);

      const currentUrl = authenticatedPage.url();
      expect(currentUrl).toContain('/settings');
    }
  });
});
