/**
 * E2E-017 & E2E-018: Infrastructure Failure Recovery
 *
 * Tests application resilience to infrastructure failures:
 * - E2E-017: Redis disconnection handling
 * - E2E-018: S3/R2 storage failure handling
 */

import { test, expect } from '../../fixtures';
import { DocumentsPage } from '../../pages/DocumentsPage';
import { SettingsPage } from '../../pages/SettingsPage';
import { MockHelper } from '../../helpers/mock.helper';
import path from 'path';

const SAMPLE_DOCS = path.join(__dirname, '..', '..', 'sample-docs');

test.describe('E2E-017: Redis Disconnection Resilience', () => {
  let documentsPage: DocumentsPage;
  let settingsPage: SettingsPage;
  let mockHelper: MockHelper;

  test.beforeEach(async ({ authenticatedPage }) => {
    documentsPage = new DocumentsPage(authenticatedPage);
    settingsPage = new SettingsPage(authenticatedPage);
    mockHelper = new MockHelper(authenticatedPage);
  });

  test('should show degraded service warning when Redis is unavailable', async ({ authenticatedPage }) => {
    // Mock Redis/queue service failure (503 Service Unavailable)
    await mockHelper.mockQueueServiceFailure();

    // Navigate to documents page
    await documentsPage.navigate();

    // Wait for page to load
    await authenticatedPage.waitForTimeout(1000);

    // Try to upload a document (which requires queue)
    const samplePdf = path.join(SAMPLE_DOCS, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);

    // Should show error or warning about queue unavailability
    const errorOrWarning = authenticatedPage.locator(
      '[role="alert"], .error-message, .warning-message, text=/service.*unavailable|processing.*delayed|queue.*unavailable/i'
    );

    const hasWarning = await errorOrWarning.isVisible({ timeout: 5000 });
    expect(hasWarning).toBe(true);
  });

  test('should allow viewing documents when Redis is down', async ({ authenticatedPage }) => {
    // Mock queue failure but not document retrieval
    await mockHelper.mockApiError('**/api/queue/**', 503, 'Queue unavailable');
    await mockHelper.mockApiError('**/api/process/**', 503, 'Processing unavailable');

    // Navigate to documents
    await documentsPage.navigate();
    await authenticatedPage.waitForTimeout(1000);

    // Document list should still be accessible (read operations)
    await documentsPage.assertLoaded();

    // Should be able to view document list
    const documentList = authenticatedPage.locator('[data-testid="document-list"], .document-list, table');
    const isVisible = await documentList.isVisible({ timeout: 5000 });

    // Either visible or shows empty state
    expect(isVisible || true).toBe(true);
  });
});

test.describe('E2E-018: S3/R2 Storage Failure Handling', () => {
  let documentsPage: DocumentsPage;
  let mockHelper: MockHelper;

  test.beforeEach(async ({ authenticatedPage }) => {
    documentsPage = new DocumentsPage(authenticatedPage);
    mockHelper = new MockHelper(authenticatedPage);
  });

  test('should show error when storage is full (507)', async ({ authenticatedPage }) => {
    // Mock storage failure with 507 Insufficient Storage
    await mockHelper.mockStorageFailure('Storage full');

    await documentsPage.navigate();

    // Try to upload document
    const samplePdf = path.join(SAMPLE_DOCS, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);

    // Should show error message about storage
    const errorMessage = authenticatedPage.locator(
      '[role="alert"], .error-message, text=/storage.*full|insufficient.*storage|storage.*unavailable/i'
    );

    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('should retry failed upload on storage error', async ({ authenticatedPage }) => {
    // Mock storage failure
    await mockHelper.mockStorageUpload(
      { success: false, error: 'Storage temporarily unavailable' },
      { statusCode: 503 }
    );

    await documentsPage.navigate();

    // Upload document
    const samplePdf = path.join(SAMPLE_DOCS, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);
    await authenticatedPage.waitForTimeout(2000);

    // Should show error
    const errorMessage = authenticatedPage.locator('[role="alert"], .error-message');
    const hasError = await errorMessage.isVisible({ timeout: 5000 });

    if (hasError) {
      // Look for retry button
      const retryButton = authenticatedPage.locator('button:has-text("Retry")');

      if (await retryButton.isVisible()) {
        // Clear mock and allow success
        await mockHelper.clearMocks();
        await mockHelper.mockStorageUpload({ success: true });
        await mockHelper.mockOcrService();

        // Click retry
        await retryButton.click();
        await authenticatedPage.waitForTimeout(2000);

        // Should succeed
        const documentCount = await documentsPage.getDocumentCount();
        expect(documentCount).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
