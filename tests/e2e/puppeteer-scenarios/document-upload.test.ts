/**
 * Document Upload Test Scenarios
 * Tests file upload, processing, and validation
 */

import { PuppeteerTestHelpers as Helper } from './test-helpers';
import { TEST_CONFIG } from './test-config';

describe('Document Upload Test Suite', () => {
  
  beforeAll(async () => {
    await Helper.connectToBrowser();
    // Login once for all upload tests
    await Helper.login(TEST_CONFIG.users.standard.email, TEST_CONFIG.users.standard.password);
  });

  beforeEach(async () => {
    // Navigate to upload page before each test
    await Helper.navigateToPage(`${TEST_CONFIG.urls.base}/upload`);
    await Helper.waitForElement(TEST_CONFIG.selectors.upload.dropzone);
  });

  describe('Single File Upload', () => {
    test('Should successfully upload a PDF document', async () => {
      // Upload PDF file
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      
      // Click upload button
      await Helper.clickElement(TEST_CONFIG.selectors.upload.uploadButton);
      
      // Wait for upload to complete
      await Helper.waitForElement(TEST_CONFIG.selectors.upload.progressBar);
      await Helper.waitForElement(TEST_CONFIG.selectors.upload.successMessage, TEST_CONFIG.waits.upload);
      
      // Verify success message
      const successText = await Helper.getElementText(TEST_CONFIG.selectors.upload.successMessage);
      expect(successText).toContain('uploaded successfully');
      
      await Helper.takeScreenshot('pdf-upload-success');
    });

    test('Should show file preview after selection', async () => {
      // Select file
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      
      // Check for file preview
      await Helper.waitForElement('[data-testid="file-preview"]');
      
      // Verify file details are shown
      const fileName = await Helper.getElementText('[data-testid="file-name"]');
      const fileSize = await Helper.getElementText('[data-testid="file-size"]');
      
      expect(fileName).toContain('sample-invoice.pdf');
      expect(fileSize).toBeTruthy();
      
      await Helper.takeScreenshot('file-preview');
    });

    test('Should reject invalid file types', async () => {
      // Try to upload invalid file
      await Helper.uploadFile(TEST_CONFIG.testData.invalidFile);
      
      // Check for error message
      await Helper.waitForElement(TEST_CONFIG.selectors.upload.errorMessage);
      const errorText = await Helper.getElementText(TEST_CONFIG.selectors.upload.errorMessage);
      
      expect(errorText).toContain('File type not supported');
      
      await Helper.takeScreenshot('invalid-file-error');
    });

    test('Should handle large file uploads', async () => {
      // Upload large file
      await Helper.uploadFile(TEST_CONFIG.testData.largeFile);
      await Helper.clickElement(TEST_CONFIG.selectors.upload.uploadButton);
      
      // Monitor progress
      await Helper.waitForElement(TEST_CONFIG.selectors.upload.progressBar);
      
      // Wait longer for large file
      await Helper.waitForElement(
        TEST_CONFIG.selectors.upload.successMessage, 
        TEST_CONFIG.waits.upload * 2
      );
      
      const successText = await Helper.getElementText(TEST_CONFIG.selectors.upload.successMessage);
      expect(successText).toContain('uploaded successfully');
      
      await Helper.takeScreenshot('large-file-upload');
    });

    test('Should allow canceling upload', async () => {
      // Start upload
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.clickElement(TEST_CONFIG.selectors.upload.uploadButton);
      
      // Wait for progress to start
      await Helper.waitForElement(TEST_CONFIG.selectors.upload.progressBar);
      
      // Cancel upload
      await Helper.clickElement('[data-testid="cancel-upload"]');
      
      // Verify cancellation
      await Helper.waitForText('Upload cancelled');
      
      // Upload button should be enabled again
      const uploadButtonEnabled = await Helper.executeScript(
        `document.querySelector('${TEST_CONFIG.selectors.upload.uploadButton}').disabled === false`
      );
      expect(uploadButtonEnabled).toBe(true);
      
      await Helper.takeScreenshot('upload-cancelled');
    });
  });

  describe('Multiple File Upload', () => {
    test('Should upload multiple files simultaneously', async () => {
      // Upload multiple files
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.uploadFile(TEST_CONFIG.testData.sampleForm);
      
      // Check file count
      const fileCount = await Helper.getElementCount('[data-testid="file-item"]');
      expect(fileCount).toBe(2);
      
      // Upload all files
      await Helper.clickElement(TEST_CONFIG.selectors.upload.uploadButton);
      
      // Wait for all uploads to complete
      await Helper.waitForElement('[data-testid="all-uploads-complete"]', TEST_CONFIG.waits.upload * 2);
      
      await Helper.takeScreenshot('multiple-files-uploaded');
    });

    test('Should show individual progress for each file', async () => {
      // Upload multiple files
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.uploadFile(TEST_CONFIG.testData.sampleForm);
      await Helper.clickElement(TEST_CONFIG.selectors.upload.uploadButton);
      
      // Check for individual progress bars
      const progressBars = await Helper.getElementCount('[data-testid="file-progress"]');
      expect(progressBars).toBe(2);
      
      await Helper.takeScreenshot('multiple-progress-bars');
    });

    test('Should allow removing individual files before upload', async () => {
      // Add multiple files
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.uploadFile(TEST_CONFIG.testData.sampleForm);
      
      // Remove first file
      await Helper.clickElement('[data-testid="remove-file-0"]');
      
      // Check remaining files
      const fileCount = await Helper.getElementCount('[data-testid="file-item"]');
      expect(fileCount).toBe(1);
      
      await Helper.takeScreenshot('file-removed');
    });
  });

  describe('Drag and Drop Upload', () => {
    test('Should support drag and drop upload', async () => {
      // Simulate drag and drop
      await Helper.executeScript(`
        const dropzone = document.querySelector('${TEST_CONFIG.selectors.upload.dropzone}');
        const dragEnterEvent = new DragEvent('dragenter', { bubbles: true });
        const dragOverEvent = new DragEvent('dragover', { bubbles: true });
        dropzone.dispatchEvent(dragEnterEvent);
        dropzone.dispatchEvent(dragOverEvent);
      `);
      
      // Check for visual feedback
      const dropzoneHighlighted = await Helper.executeScript(`
        document.querySelector('${TEST_CONFIG.selectors.upload.dropzone}')
          .classList.contains('dropzone-active')
      `);
      expect(dropzoneHighlighted).toBe(true);
      
      await Helper.takeScreenshot('dropzone-active');
    });

    test('Should show drop zone on drag over', async () => {
      // Trigger drag over
      await Helper.executeScript(`
        const event = new DragEvent('dragover', { bubbles: true });
        document.body.dispatchEvent(event);
      `);
      
      // Check for overlay
      await Helper.waitForElement('[data-testid="drop-overlay"]');
      
      const overlayText = await Helper.getElementText('[data-testid="drop-overlay"]');
      expect(overlayText).toContain('Drop files here');
      
      await Helper.takeScreenshot('drop-overlay');
    });
  });

  describe('Upload Validation', () => {
    test('Should validate file size limits', async () => {
      // Create a mock large file scenario
      await Helper.executeScript(`
        const input = document.querySelector('${TEST_CONFIG.selectors.upload.fileInput}');
        Object.defineProperty(input.files[0], 'size', { value: 50 * 1024 * 1024 }); // 50MB
      `);
      
      // Try to upload
      await Helper.clickElement(TEST_CONFIG.selectors.upload.uploadButton);
      
      // Check for size error
      await Helper.waitForText('File size exceeds limit');
      
      await Helper.takeScreenshot('file-size-error');
    });

    test('Should check for duplicate files', async () => {
      // Upload same file twice
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      
      // Check for duplicate warning
      await Helper.waitForText('Duplicate file detected');
      
      await Helper.takeScreenshot('duplicate-file-warning');
    });

    test('Should validate required form fields', async () => {
      // Upload file
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      
      // Try to submit without selecting form type
      await Helper.clickElement(TEST_CONFIG.selectors.upload.uploadButton);
      
      // Check for validation error
      await Helper.waitForText('Please select a form type');
      
      await Helper.takeScreenshot('form-type-required');
    });
  });

  describe('Upload Status and History', () => {
    test('Should show upload in history after completion', async () => {
      // Upload file
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.clickElement(TEST_CONFIG.selectors.upload.uploadButton);
      await Helper.waitForElement(TEST_CONFIG.selectors.upload.successMessage);
      
      // Navigate to history
      await Helper.clickElement(TEST_CONFIG.selectors.nav.history);
      await Helper.waitForElement(TEST_CONFIG.selectors.document.documentList);
      
      // Check for uploaded file in history
      const documents = await Helper.getElementCount(TEST_CONFIG.selectors.document.documentRow);
      expect(documents).toBeGreaterThan(0);
      
      // Verify file details
      const firstDocName = await Helper.getElementText(
        `${TEST_CONFIG.selectors.document.documentRow}:first-child [data-testid="doc-name"]`
      );
      expect(firstDocName).toContain('sample-invoice');
      
      await Helper.takeScreenshot('upload-in-history');
    });

    test('Should show processing status', async () => {
      // Upload file
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.clickElement(TEST_CONFIG.selectors.upload.uploadButton);
      
      // Check for processing status
      await Helper.waitForElement('[data-testid="status-processing"]');
      
      // Wait for completion
      await Helper.waitForElement('[data-testid="status-completed"]', TEST_CONFIG.waits.upload);
      
      const statusText = await Helper.getElementText('[data-testid="status-completed"]');
      expect(statusText).toContain('Completed');
      
      await Helper.takeScreenshot('processing-complete');
    });

    test('Should allow retry on failed upload', async () => {
      // Simulate upload failure
      await Helper.executeScript(`
        window.simulateUploadError = true;
      `);
      
      // Try upload
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.clickElement(TEST_CONFIG.selectors.upload.uploadButton);
      
      // Wait for error
      await Helper.waitForElement('[data-testid="upload-failed"]');
      
      // Click retry button
      await Helper.clickElement('[data-testid="retry-upload"]');
      
      // Clear error simulation
      await Helper.executeScript(`
        window.simulateUploadError = false;
      `);
      
      // Wait for success
      await Helper.waitForElement(TEST_CONFIG.selectors.upload.successMessage);
      
      await Helper.takeScreenshot('upload-retry-success');
    });
  });

  describe('Upload Metadata', () => {
    test('Should allow adding metadata to uploads', async () => {
      // Upload file
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      
      // Add metadata
      await Helper.fillField('input[name="documentTitle"]', 'Q1 2024 Invoice');
      await Helper.selectOption('select[name="documentType"]', 'invoice');
      await Helper.fillField('textarea[name="description"]', 'Quarterly invoice for services');
      
      // Add tags
      await Helper.fillField('input[name="tags"]', 'invoice, q1-2024, billing');
      
      // Upload with metadata
      await Helper.clickElement(TEST_CONFIG.selectors.upload.uploadButton);
      await Helper.waitForElement(TEST_CONFIG.selectors.upload.successMessage);
      
      await Helper.takeScreenshot('upload-with-metadata');
    });

    test('Should extract metadata from document', async () => {
      // Upload PDF
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      
      // Click extract metadata button
      await Helper.clickElement('[data-testid="extract-metadata"]');
      
      // Wait for extraction
      await Helper.waitForElement('[data-testid="metadata-extracted"]');
      
      // Check extracted fields
      const extractedTitle = await Helper.getElementText('input[name="documentTitle"]');
      expect(extractedTitle).toBeTruthy();
      
      await Helper.takeScreenshot('metadata-extracted');
    });
  });
});