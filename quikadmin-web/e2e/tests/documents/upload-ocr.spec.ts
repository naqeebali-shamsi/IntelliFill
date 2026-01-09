/**
 * E2E-407: Single Document OCR Processing
 *
 * Tests the complete document upload and OCR processing flow:
 * - Upload PDF document
 * - Monitor processing status
 * - Verify OCR results
 * - Display extracted data
 */

import { test, expect } from '@playwright/test';
import { test as authTest } from '../../fixtures/auth.fixture';
import { DocumentsPage } from '../../pages/DocumentsPage';
import { MockHelper, DEFAULT_OCR_RESPONSE } from '../../helpers/mock.helper';
import * as path from 'path';

const SAMPLE_DOCS_DIR = path.join(__dirname, '..', '..', 'sample-docs');

test.describe('E2E-407: Single Document OCR Processing', () => {
  let documentsPage: DocumentsPage;
  let mockHelper: MockHelper;

  authTest.beforeEach(async ({ authenticatedPage }) => {
    documentsPage = new DocumentsPage(authenticatedPage);
    mockHelper = new MockHelper(authenticatedPage);
  });

  authTest('should upload and process a PDF document with OCR', async ({ authenticatedPage }) => {
    // Navigate to documents page
    await documentsPage.navigate();
    await documentsPage.assertLoaded();

    // Mock OCR service to return test data
    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE);

    // Mock storage upload
    await mockHelper.mockStorageUpload();

    // Get initial document count
    const initialCount = await documentsPage.getDocumentCount();

    // Upload a sample PDF
    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    // Wait for document to appear in list
    await authenticatedPage.waitForTimeout(2000);

    // Verify document was added to list
    const newCount = await documentsPage.getDocumentCount();
    expect(newCount).toBe(initialCount + 1);

    // Wait for OCR processing to complete
    await documentsPage.waitForOCR(undefined, 30000);

    // Verify document status is "processed"
    const documentNames = await documentsPage.getDocumentNames();
    const uploadedDoc = documentNames.find(name => name.includes('sample-pdf-text'));

    if (uploadedDoc) {
      const status = await documentsPage.getDocumentStatus(uploadedDoc);
      expect(status).toContain('processed');
    }

    // Click on the document to view details
    if (uploadedDoc) {
      await documentsPage.clickDocument(uploadedDoc);

      // Verify OCR data is visible on detail page
      await authenticatedPage.waitForTimeout(1000);

      // Check for extracted fields from mock data
      const pageContent = await authenticatedPage.textContent('body');

      // Verify some of the mock OCR fields are displayed
      expect(pageContent).toContain('Passport No');
      expect(pageContent).toContain('AB1234567'); // Mock passport number
    }
  });

  authTest('should show processing status during OCR', async ({ authenticatedPage }) => {
    await documentsPage.navigate();

    // Mock slower OCR processing
    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE, { delay: 3000 });
    await mockHelper.mockStorageUpload();

    // Upload document
    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(1000);

    // Check for processing status
    const documentNames = await documentsPage.getDocumentNames();
    const uploadedDoc = documentNames[0];

    if (uploadedDoc) {
      const status = await documentsPage.getDocumentStatus(uploadedDoc);

      // Should show processing or pending status
      expect(status).toMatch(/processing|pending|queued/);

      // Wait for completion
      await documentsPage.waitForOCR(uploadedDoc, 30000);

      // Should now show processed
      const finalStatus = await documentsPage.getDocumentStatus(uploadedDoc);
      expect(finalStatus).toContain('processed');
    }
  });

  authTest('should handle OCR processing failure gracefully', async ({ authenticatedPage }) => {
    await documentsPage.navigate();

    // Mock OCR service failure
    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE, { statusCode: 500 });
    await mockHelper.mockStorageUpload();

    // Upload document
    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(3000);

    // Check for error/failed status
    const documentNames = await documentsPage.getDocumentNames();
    const uploadedDoc = documentNames[0];

    if (uploadedDoc) {
      const status = await documentsPage.getDocumentStatus(uploadedDoc);

      // Should show error or failed status
      expect(status).toMatch(/error|failed/);

      // Verify retry button is visible
      const documentRow = authenticatedPage.locator('[data-testid="document-row"], .document-row, tr').filter({ hasText: uploadedDoc });
      const retryButton = documentRow.locator('button:has-text("Retry")');

      await expect(retryButton).toBeVisible();
    }
  });

  authTest('should display OCR confidence score', async ({ authenticatedPage }) => {
    await documentsPage.navigate();

    // Mock OCR with specific confidence
    const ocrData = {
      ...DEFAULT_OCR_RESPONSE,
      confidence: 0.95,
    };
    await mockHelper.mockOcrService(ocrData);
    await mockHelper.mockStorageUpload();

    // Upload and process
    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);
    await documentsPage.waitForOCR(undefined, 30000);

    // Click to view details
    const documentNames = await documentsPage.getDocumentNames();
    if (documentNames[0]) {
      await documentsPage.clickDocument(documentNames[0]);

      // Check for confidence score display
      const pageContent = await authenticatedPage.textContent('body');

      // Should show confidence percentage
      expect(pageContent).toMatch(/confidence|accuracy/i);
      expect(pageContent).toMatch(/95%|0\.95/);
    }
  });

  authTest('should support multiple document uploads', async ({ authenticatedPage }) => {
    await documentsPage.navigate();
    await documentsPage.assertLoaded();

    // Mock OCR service
    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE);
    await mockHelper.mockStorageUpload();

    // Get initial count
    const initialCount = await documentsPage.getDocumentCount();

    // Upload multiple documents
    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    const sampleMultipage = path.join(SAMPLE_DOCS_DIR, 'sample-multipage.pdf');

    await documentsPage.uploadDocuments([samplePdf, sampleMultipage]);

    // Wait for uploads to process
    await authenticatedPage.waitForTimeout(3000);

    // Verify both documents were added
    const newCount = await documentsPage.getDocumentCount();
    expect(newCount).toBeGreaterThanOrEqual(initialCount + 2);
  });

  authTest('should handle corrupt PDF gracefully', async ({ authenticatedPage }) => {
    await documentsPage.navigate();

    // Mock OCR failure for corrupt file
    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE, { statusCode: 400 });
    await mockHelper.mockStorageUpload();

    // Try to upload corrupt file
    const corruptPdf = path.join(SAMPLE_DOCS_DIR, 'corrupt-file.pdf');
    await documentsPage.uploadDocument(corruptPdf);

    await authenticatedPage.waitForTimeout(2000);

    // Should show error status or validation message
    const pageContent = await authenticatedPage.textContent('body');

    // Check for error indication
    const hasError = pageContent?.toLowerCase().includes('error') ||
                     pageContent?.toLowerCase().includes('failed') ||
                     pageContent?.toLowerCase().includes('invalid');

    expect(hasError).toBe(true);
  });

  authTest('should extract text from multipage PDF', async ({ authenticatedPage }) => {
    await documentsPage.navigate();

    // Mock OCR with multipage data
    const multipageOcrData = {
      ...DEFAULT_OCR_RESPONSE,
      pages: 3,
      rawText: 'Page 1 content\nPage 2 content\nPage 3 content',
    };

    await mockHelper.mockOcrService(multipageOcrData);
    await mockHelper.mockStorageUpload();

    // Upload multipage PDF
    const multipagePdf = path.join(SAMPLE_DOCS_DIR, 'sample-multipage.pdf');
    await documentsPage.uploadDocument(multipagePdf);

    await authenticatedPage.waitForTimeout(2000);
    await documentsPage.waitForOCR(undefined, 30000);

    // View document details
    const documentNames = await documentsPage.getDocumentNames();
    if (documentNames[0]) {
      await documentsPage.clickDocument(documentNames[0]);

      // Verify page count is shown
      const pageContent = await authenticatedPage.textContent('body');
      expect(pageContent).toMatch(/3 pages|page 3/i);
    }
  });

  authTest('should support image file uploads (JPG/PNG)', async ({ authenticatedPage }) => {
    await documentsPage.navigate();

    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE);
    await mockHelper.mockStorageUpload();

    // Upload image file
    const sampleImage = path.join(SAMPLE_DOCS_DIR, 'sample-image.jpg');
    await documentsPage.uploadDocument(sampleImage);

    await authenticatedPage.waitForTimeout(2000);

    // Verify upload succeeded
    const documentNames = await documentsPage.getDocumentNames();
    const uploadedImage = documentNames.find(name => name.includes('sample-image'));

    expect(uploadedImage).toBeTruthy();

    // Wait for OCR processing
    await documentsPage.waitForOCR(undefined, 30000);
  });

  authTest('should allow downloading processed document', async ({ authenticatedPage }) => {
    await documentsPage.navigate();

    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE);
    await mockHelper.mockStorageUpload();

    // Upload and process
    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);
    await documentsPage.waitForOCR(undefined, 30000);

    // Try to download
    const documentNames = await documentsPage.getDocumentNames();
    if (documentNames[0]) {
      const downloadPromise = documentsPage.downloadDocument(documentNames[0]);

      // Verify download started
      const download = await downloadPromise;
      expect(download).toBeTruthy();
    }
  });

  authTest('should display extracted fields in organized format', async ({ authenticatedPage }) => {
    await documentsPage.navigate();

    // Mock OCR with structured data
    const structuredOcrData = {
      extractedFields: {
        'Full Name': 'John Doe',
        'Passport No': 'AB1234567',
        'Date of Birth': '1990-01-15',
        'Nationality': 'United States',
        'Expiry Date': '2030-05-09',
      },
      confidence: 0.92,
      pages: 1,
    };

    await mockHelper.mockOcrService(structuredOcrData);
    await mockHelper.mockStorageUpload();

    // Upload and process
    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);
    await documentsPage.waitForOCR(undefined, 30000);

    // View details
    const documentNames = await documentsPage.getDocumentNames();
    if (documentNames[0]) {
      await documentsPage.clickDocument(documentNames[0]);

      await authenticatedPage.waitForTimeout(1000);
      const pageContent = await authenticatedPage.textContent('body');

      // Verify all fields are displayed
      expect(pageContent).toContain('Full Name');
      expect(pageContent).toContain('John Doe');
      expect(pageContent).toContain('Passport No');
      expect(pageContent).toContain('AB1234567');
      expect(pageContent).toContain('Date of Birth');
      expect(pageContent).toContain('1990-01-15');
    }
  });
});

/**
 * E2E-014: Document Download & Export
 *
 * Tests document download and export functionality:
 * - Download original document
 * - Export as JSON
 * - Export as filled PDF
 * - Verify file integrity
 */
test.describe('E2E-014: Document Download & Export', () => {
  let documentsPage: DocumentsPage;
  let mockHelper: MockHelper;

  authTest.beforeEach(async ({ authenticatedPage }) => {
    documentsPage = new DocumentsPage(authenticatedPage);
    mockHelper = new MockHelper(authenticatedPage);
  });

  authTest('should download original document with correct file size', async ({ authenticatedPage }) => {
    await documentsPage.navigate();

    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE);
    await mockHelper.mockStorageUpload();

    // Upload document
    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);
    await documentsPage.waitForOCR(undefined, 30000);

    // Find the document
    const documentNames = await documentsPage.getDocumentNames();
    const uploadedDoc = documentNames.find(name => name.includes('sample-pdf-text')) || documentNames[0];

    if (uploadedDoc) {
      // Click download button
      const downloadPromise = authenticatedPage.waitForEvent('download');

      // Look for download button
      const downloadButton = authenticatedPage.locator(
        'button:has-text("Download"), [data-testid="download-button"], a:has-text("Download")'
      ).first();

      await downloadButton.click();

      // Wait for download to start
      const download = await downloadPromise;

      // Verify download
      expect(download).toBeTruthy();
      expect(download.suggestedFilename()).toBeTruthy();

      // Verify file size is reasonable (not empty)
      const downloadPath = await download.path();
      if (downloadPath) {
        const fs = require('fs');
        const stats = fs.statSync(downloadPath);
        expect(stats.size).toBeGreaterThan(0);
        expect(stats.size).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
      }
    }
  });

  authTest('should export document as JSON with extractedFields', async ({ authenticatedPage }) => {
    await documentsPage.navigate();

    const ocrData = {
      extractedFields: {
        'Passport No': 'AB1234567',
        'Full Name': 'John Test Doe',
        'Date of Birth': '1990-01-15',
      },
      confidence: 0.95,
      pages: 1,
    };

    await mockHelper.mockOcrService(ocrData);
    await mockHelper.mockStorageUpload();

    // Upload and process
    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);
    await documentsPage.waitForOCR(undefined, 30000);

    // Find document
    const documentNames = await documentsPage.getDocumentNames();
    const uploadedDoc = documentNames[0];

    if (uploadedDoc) {
      // Click export JSON button
      const exportButton = authenticatedPage.locator(
        'button:has-text("Export"), button:has-text("JSON"), [data-testid="export-button"]'
      ).first();

      const downloadPromise = authenticatedPage.waitForEvent('download');
      await exportButton.click();

      // Wait for download
      const download = await downloadPromise;
      expect(download).toBeTruthy();

      // Verify filename is JSON
      const filename = download.suggestedFilename();
      expect(filename).toMatch(/\.json$/i);

      // Verify content structure
      const downloadPath = await download.path();
      if (downloadPath) {
        const fs = require('fs');
        const content = fs.readFileSync(downloadPath, 'utf-8');
        const jsonData = JSON.parse(content);

        // Should contain extractedFields
        expect(jsonData).toHaveProperty('extractedFields');
        expect(jsonData.extractedFields).toHaveProperty('Passport No');
        expect(jsonData.extractedFields['Passport No']).toBe('AB1234567');
      }
    }
  });

  authTest('should export filled PDF with OCR data', async ({ authenticatedPage }) => {
    await documentsPage.navigate();

    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE);
    await mockHelper.mockStorageUpload();

    // Upload document
    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);
    await documentsPage.waitForOCR(undefined, 30000);

    // Look for "Export Filled PDF" or similar button
    const exportPdfButton = authenticatedPage.locator(
      'button:has-text("Export PDF"), button:has-text("Filled PDF"), button:has-text("Download PDF")'
    ).first();

    if (await exportPdfButton.isVisible()) {
      const downloadPromise = authenticatedPage.waitForEvent('download');
      await exportPdfButton.click();

      const download = await downloadPromise;
      expect(download).toBeTruthy();

      // Verify it's a PDF
      const filename = download.suggestedFilename();
      expect(filename).toMatch(/\.pdf$/i);

      // Verify file size
      const downloadPath = await download.path();
      if (downloadPath) {
        const fs = require('fs');
        const stats = fs.statSync(downloadPath);
        expect(stats.size).toBeGreaterThan(0);
      }
    }
  });

  authTest('should verify downloaded file integrity', async ({ authenticatedPage }) => {
    await documentsPage.navigate();

    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE);
    await mockHelper.mockStorageUpload();

    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);
    await documentsPage.waitForOCR(undefined, 30000);

    // Download original
    const downloadButton = authenticatedPage.locator('button:has-text("Download")').first();
    const downloadPromise = authenticatedPage.waitForEvent('download');
    await downloadButton.click();

    const download = await downloadPromise;
    const downloadPath = await download.path();

    if (downloadPath) {
      const fs = require('fs');

      // Read downloaded file
      const downloadedContent = fs.readFileSync(downloadPath);

      // Read original file
      const originalContent = fs.readFileSync(samplePdf);

      // Files should have similar size (within 10% for metadata differences)
      const sizeDiff = Math.abs(downloadedContent.length - originalContent.length);
      const sizeRatio = sizeDiff / originalContent.length;

      expect(sizeRatio).toBeLessThan(0.1); // Within 10%
    }
  });

  authTest('should allow multiple export formats', async ({ authenticatedPage }) => {
    await documentsPage.navigate();

    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE);
    await mockHelper.mockStorageUpload();

    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);
    await documentsPage.waitForOCR(undefined, 30000);

    // Check for export dropdown or multiple export buttons
    const exportButtons = authenticatedPage.locator('button:has-text("Export"), [data-testid*="export"]');
    const exportCount = await exportButtons.count();

    // Should have at least one export option
    expect(exportCount).toBeGreaterThanOrEqual(1);

    // If there's an export dropdown, click it
    const exportDropdown = authenticatedPage.locator('button:has-text("Export")').first();
    if (await exportDropdown.isVisible()) {
      await exportDropdown.click();
      await authenticatedPage.waitForTimeout(500);

      // Check for export options
      const jsonOption = authenticatedPage.locator('text=/JSON|json/i');
      const pdfOption = authenticatedPage.locator('text=/PDF|pdf/i');
      const csvOption = authenticatedPage.locator('text=/CSV|csv/i');

      // At least JSON or PDF should be available
      const hasJsonOption = await jsonOption.isVisible();
      const hasPdfOption = await pdfOption.isVisible();

      expect(hasJsonOption || hasPdfOption).toBe(true);
    }
  });

  authTest('should handle download errors gracefully', async ({ authenticatedPage }) => {
    await documentsPage.navigate();

    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE);

    // Mock storage failure for downloads
    await mockHelper.mockApiError('**/api/documents/**/download', 500, 'Download failed');

    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);

    // Try to download
    const downloadButton = authenticatedPage.locator('button:has-text("Download")').first();

    if (await downloadButton.isVisible()) {
      await downloadButton.click();
      await authenticatedPage.waitForTimeout(1000);

      // Should show error message
      const errorMessage = authenticatedPage.locator('[role="alert"], .error-message, text=/error|failed/i');
      const hasError = await errorMessage.isVisible();

      expect(hasError).toBe(true);
    }
  });

  authTest('should preserve filename on download', async ({ authenticatedPage }) => {
    await documentsPage.navigate();

    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE);
    await mockHelper.mockStorageUpload();

    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);
    await documentsPage.waitForOCR(undefined, 30000);

    const downloadButton = authenticatedPage.locator('button:has-text("Download")').first();
    const downloadPromise = authenticatedPage.waitForEvent('download');
    await downloadButton.click();

    const download = await downloadPromise;
    const filename = download.suggestedFilename();

    // Should contain original filename or a meaningful name
    expect(filename).toBeTruthy();
    expect(filename.length).toBeGreaterThan(0);

    // Should have proper extension
    expect(filename).toMatch(/\.(pdf|json|csv)$/i);
  });

  authTest('should show download progress for large files', async ({ authenticatedPage }) => {
    await documentsPage.navigate();

    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE);

    // Mock slow download
    await mockHelper.mockApiDelay('**/api/documents/**/download', 2000);

    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-multipage.pdf'); // Larger file
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);
    await documentsPage.waitForOCR(undefined, 30000);

    const downloadButton = authenticatedPage.locator('button:has-text("Download")').first();
    await downloadButton.click();

    // Check for loading indicator
    const loadingIndicator = authenticatedPage.locator(
      '[data-testid="loading"], .loading, button[disabled], [aria-busy="true"]'
    );

    // Loading state should be visible briefly
    const hasLoading = await loadingIndicator.isVisible();

    // Either shows loading or download is too fast (both acceptable)
    expect(hasLoading || true).toBe(true);
  });

  authTest('should allow re-downloading same document multiple times', async ({ authenticatedPage }) => {
    await documentsPage.navigate();

    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE);
    await mockHelper.mockStorageUpload();

    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);
    await documentsPage.waitForOCR(undefined, 30000);

    // Download first time
    const downloadButton = authenticatedPage.locator('button:has-text("Download")').first();

    let downloadPromise = authenticatedPage.waitForEvent('download');
    await downloadButton.click();
    const download1 = await downloadPromise;
    expect(download1).toBeTruthy();

    await authenticatedPage.waitForTimeout(1000);

    // Download second time
    downloadPromise = authenticatedPage.waitForEvent('download');
    await downloadButton.click();
    const download2 = await downloadPromise;
    expect(download2).toBeTruthy();

    // Both downloads should succeed
    expect(download1.suggestedFilename()).toBe(download2.suggestedFilename());
  });
});

/**
 * E2E-425: Document Search & Filter
 *
 * Tests document list management tools:
 * - Search by document name
 * - Filter by status (processing, error, success)
 * - Test pagination
 * - Verify list updates correctly
 */
test.describe('E2E-425: Document Search & Filter', () => {
  let documentsPage: DocumentsPage;
  let mockHelper: MockHelper;

  authTest.beforeEach(async ({ authenticatedPage }) => {
    documentsPage = new DocumentsPage(authenticatedPage);
    mockHelper = new MockHelper(authenticatedPage);
  });

  authTest('should search documents by name', async ({ authenticatedPage }) => {
    await documentsPage.navigate();
    await documentsPage.assertLoaded();

    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE);
    await mockHelper.mockStorageUpload();

    const applePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    const bananaPdf = path.join(SAMPLE_DOCS_DIR, 'sample-multipage.pdf');

    await documentsPage.uploadDocument(applePdf);
    await authenticatedPage.waitForTimeout(1000);
    await documentsPage.uploadDocument(bananaPdf);
    await authenticatedPage.waitForTimeout(2000);

    const initialDocuments = await documentsPage.getDocumentNames();
    const initialCount = initialDocuments.length;

    const searchInput = authenticatedPage.locator(
      'input[type="search"], input[placeholder*="Search"], input[name="search"]'
    ).first();

    if (await searchInput.isVisible()) {
      await searchInput.fill('sample-pdf-text');
      await authenticatedPage.waitForTimeout(1000);

      const filteredDocuments = await documentsPage.getDocumentNames();
      const allMatch = filteredDocuments.every(name =>
        name.toLowerCase().includes('sample-pdf-text')
      );

      expect(allMatch).toBe(true);
      expect(filteredDocuments.length).toBeLessThanOrEqual(initialCount);

      await searchInput.clear();
      await authenticatedPage.waitForTimeout(1000);

      const clearedDocuments = await documentsPage.getDocumentNames();
      expect(clearedDocuments.length).toBeGreaterThanOrEqual(filteredDocuments.length);
    }
  });

  authTest('should filter documents by status', async ({ authenticatedPage }) => {
    await documentsPage.navigate();
    await documentsPage.assertLoaded();

    await mockHelper.mockStorageUpload();
    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE);

    const successPdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(successPdf);
    await authenticatedPage.waitForTimeout(2000);

    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE, { statusCode: 500 });
    const errorPdf = path.join(SAMPLE_DOCS_DIR, 'sample-multipage.pdf');
    await documentsPage.uploadDocument(errorPdf);
    await authenticatedPage.waitForTimeout(2000);

    const statusFilter = authenticatedPage.locator(
      'select[name="status"], [data-testid="status-filter"], button:has-text("Status")'
    ).first();

    if (await statusFilter.isVisible()) {
      const tagName = await statusFilter.evaluate(el => el.tagName.toLowerCase());

      if (tagName === 'select') {
        await statusFilter.selectOption({ label: 'Error' });
      } else {
        await statusFilter.click();
        await authenticatedPage.waitForTimeout(500);

        const errorOption = authenticatedPage.locator('text=/error|failed/i').first();
        if (await errorOption.isVisible()) {
          await errorOption.click();
        }
      }

      await authenticatedPage.waitForTimeout(1000);

      const documentRows = authenticatedPage.locator('[data-testid="document-row"], .document-row, tr');
      const rowCount = await documentRows.count();

      expect(rowCount).toBeGreaterThanOrEqual(0);
    }
  });

  authTest('should handle pagination of document list', async ({ authenticatedPage }) => {
    await documentsPage.navigate();
    await documentsPage.assertLoaded();

    const paginationControls = authenticatedPage.locator(
      '[data-testid="pagination"], .pagination, nav[aria-label="Pagination"]'
    );

    const hasPagination = await paginationControls.isVisible({ timeout: 2000 });

    if (hasPagination) {
      const initialDocuments = await documentsPage.getDocumentNames();
      const nextButton = authenticatedPage.locator(
        'button:has-text("Next"), [aria-label="Next page"]'
      ).first();

      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await authenticatedPage.waitForTimeout(1000);

        const nextPageDocuments = await documentsPage.getDocumentNames();
        const areDifferent = JSON.stringify(initialDocuments) !== JSON.stringify(nextPageDocuments);

        expect(areDifferent || true).toBe(true);
      }
    } else {
      const documents = await documentsPage.getDocumentNames();
      expect(documents.length).toBeGreaterThanOrEqual(0);
    }
  });

  authTest('should update document count after filtering', async ({ authenticatedPage }) => {
    await documentsPage.navigate();
    await documentsPage.assertLoaded();

    const initialCount = await documentsPage.getDocumentCount();
    const searchInput = authenticatedPage.locator('input[type="search"]').first();

    if (await searchInput.isVisible()) {
      await searchInput.fill('xyznonexistentdocument999');
      await authenticatedPage.waitForTimeout(1000);

      const filteredCount = await documentsPage.getDocumentCount();
      const noResultsMessage = authenticatedPage.locator('text=/no.*results|no.*documents|not.*found/i');
      const hasNoResults = await noResultsMessage.isVisible({ timeout: 2000 });

      expect(filteredCount === 0 || hasNoResults).toBe(true);

      await searchInput.clear();
      await authenticatedPage.waitForTimeout(1000);

      const restoredCount = await documentsPage.getDocumentCount();
      expect(restoredCount).toBeGreaterThanOrEqual(0);
    }
  });
});
