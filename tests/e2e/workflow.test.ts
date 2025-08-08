import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

describe('E2E Workflow Tests', () => {
  let browser: Browser;
  let page: Page;
  let serverProcess: ChildProcess;
  const baseUrl = 'http://localhost:3001';

  beforeAll(async () => {
    // Start the server
    serverProcess = spawn('npm', ['start'], {
      cwd: path.join(__dirname, '../..'),
      env: { ...process.env, PORT: '3000' }
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
  }, 30000);

  afterAll(async () => {
    await browser.close();
    serverProcess.kill();
  });

  describe('Complete PDF Processing Workflow', () => {
    it('should complete full document processing workflow', async () => {
      // Navigate to upload page
      await page.goto(`${baseUrl}/upload`);
      
      // Upload documents
      const documentInput = await page.$('input[type="file"][name="documents"]');
      const testDocPath = path.join(__dirname, '../fixtures/test-document.pdf');
      await documentInput?.uploadFile(testDocPath);
      
      // Upload form
      const formInput = await page.$('input[type="file"][name="form"]');
      const testFormPath = path.join(__dirname, '../fixtures/test-form.pdf');
      await formInput?.uploadFile(testFormPath);
      
      // Click process button
      await page.waitForSelector('button[type="submit"]');
      await page.click('button[type="submit"]');
      
      // Wait for processing to complete
      await page.waitForSelector('.success-message', { timeout: 30000 });
      
      // Verify success
      const successMessage = await page.$eval('.success-message', el => el.textContent);
      expect(successMessage).toContain('Processing completed');
      
      // Navigate to history
      await page.goto(`${baseUrl}/history`);
      
      // Verify job appears in history
      await page.waitForSelector('.job-item');
      const jobItems = await page.$$('.job-item');
      expect(jobItems.length).toBeGreaterThan(0);
    });

    it('should handle OCR processing for scanned documents', async () => {
      await page.goto(`${baseUrl}/upload`);
      
      // Upload scanned document
      const documentInput = await page.$('input[type="file"][name="documents"]');
      const scannedDocPath = path.join(__dirname, '../fixtures/scanned-document.pdf');
      await documentInput?.uploadFile(scannedDocPath);
      
      // Enable OCR option
      await page.click('input[name="enableOCR"]');
      
      // Upload form and process
      const formInput = await page.$('input[type="file"][name="form"]');
      const testFormPath = path.join(__dirname, '../fixtures/test-form.pdf');
      await formInput?.uploadFile(testFormPath);
      
      await page.click('button[type="submit"]');
      
      // Wait for OCR processing (takes longer)
      await page.waitForSelector('.success-message', { timeout: 60000 });
      
      // Verify OCR was applied
      const processingDetails = await page.$eval('.processing-details', el => el.textContent);
      expect(processingDetails).toContain('OCR');
    });

    it('should use ML model for improved field mapping', async () => {
      await page.goto(`${baseUrl}/upload`);
      
      // Upload documents with ML enhancement enabled
      const documentInput = await page.$('input[type="file"][name="documents"]');
      const testDocPath = path.join(__dirname, '../fixtures/complex-document.pdf');
      await documentInput?.uploadFile(testDocPath);
      
      // Enable ML enhancement
      await page.click('input[name="enableML"]');
      
      // Upload form
      const formInput = await page.$('input[type="file"][name="form"]');
      const complexFormPath = path.join(__dirname, '../fixtures/complex-form.pdf');
      await formInput?.uploadFile(complexFormPath);
      
      // Process
      await page.click('button[type="submit"]');
      await page.waitForSelector('.success-message', { timeout: 30000 });
      
      // Check confidence score
      const confidenceElement = await page.$('.confidence-score');
      const confidence = await confidenceElement?.evaluate(el => parseFloat(el.textContent || '0'));
      expect(confidence).toBeGreaterThan(0.9); // ML should improve confidence
    });
  });

  describe('Template Management', () => {
    it('should create and use a template', async () => {
      // Navigate to templates
      await page.goto(`${baseUrl}/templates`);
      
      // Create new template
      await page.click('button.create-template');
      
      // Fill template form
      await page.type('input[name="templateName"]', 'Tax Form Template');
      await page.type('textarea[name="description"]', 'Template for tax forms');
      
      // Upload template form
      const formInput = await page.$('input[name="templateForm"]');
      const templateFormPath = path.join(__dirname, '../fixtures/template-form.pdf');
      await formInput?.uploadFile(templateFormPath);
      
      // Save template
      await page.click('button.save-template');
      await page.waitForSelector('.template-saved-message');
      
      // Use template for processing
      await page.goto(`${baseUrl}/upload`);
      await page.click('button.use-template');
      await page.waitForSelector('.template-selector');
      await page.click('.template-item[data-name="Tax Form Template"]');
      
      // Verify template is loaded
      const templateName = await page.$eval('.selected-template', el => el.textContent);
      expect(templateName).toContain('Tax Form Template');
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple forms in batch', async () => {
      await page.goto(`${baseUrl}/upload`);
      
      // Switch to batch mode
      await page.click('button.batch-mode');
      
      // Upload multiple document sets
      const documentInput = await page.$('input[type="file"][name="documents"]');
      const docs = [
        path.join(__dirname, '../fixtures/batch-doc-1.pdf'),
        path.join(__dirname, '../fixtures/batch-doc-2.pdf'),
        path.join(__dirname, '../fixtures/batch-doc-3.pdf')
      ];
      
      for (const doc of docs) {
        await documentInput?.uploadFile(doc);
      }
      
      // Upload forms
      const formInput = await page.$('input[type="file"][name="forms"]');
      const forms = [
        path.join(__dirname, '../fixtures/batch-form-1.pdf'),
        path.join(__dirname, '../fixtures/batch-form-2.pdf'),
        path.join(__dirname, '../fixtures/batch-form-3.pdf')
      ];
      
      for (const form of forms) {
        await formInput?.uploadFile(form);
      }
      
      // Start batch processing
      await page.click('button.start-batch');
      
      // Monitor progress
      await page.waitForSelector('.batch-progress', { visible: true });
      
      // Wait for completion
      await page.waitForSelector('.batch-complete', { timeout: 60000 });
      
      // Verify all jobs completed
      const completedJobs = await page.$$('.job-complete');
      expect(completedJobs.length).toBe(3);
    });
  });

  describe('Real-time Updates', () => {
    it('should show real-time processing updates', async () => {
      await page.goto(`${baseUrl}/dashboard`);
      
      // Start a processing job in another tab
      const newPage = await browser.newPage();
      await newPage.goto(`${baseUrl}/upload`);
      
      // Upload and start processing
      const documentInput = await newPage.$('input[type="file"][name="documents"]');
      await documentInput?.uploadFile(path.join(__dirname, '../fixtures/test-document.pdf'));
      
      const formInput = await newPage.$('input[type="file"][name="form"]');
      await formInput?.uploadFile(path.join(__dirname, '../fixtures/test-form.pdf'));
      
      await newPage.click('button[type="submit"]');
      
      // Switch back to dashboard
      await page.bringToFront();
      
      // Wait for real-time update
      await page.waitForSelector('.active-job-indicator', { timeout: 5000 });
      
      // Verify job appears in active jobs
      const activeJobs = await page.$$('.active-job');
      expect(activeJobs.length).toBeGreaterThan(0);
      
      // Wait for completion notification
      await page.waitForSelector('.completion-notification', { timeout: 30000 });
      
      await newPage.close();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid file uploads gracefully', async () => {
      await page.goto(`${baseUrl}/upload`);
      
      // Try to upload invalid file
      const documentInput = await page.$('input[type="file"][name="documents"]');
      const invalidFilePath = path.join(__dirname, '../fixtures/invalid-file.exe');
      
      // Create a mock invalid file
      await documentInput?.uploadFile(invalidFilePath).catch(() => {});
      
      // Check for error message
      await page.waitForSelector('.error-message');
      const errorMessage = await page.$eval('.error-message', el => el.textContent);
      expect(errorMessage).toContain('Invalid file type');
    });

    it('should handle network failures gracefully', async () => {
      await page.goto(`${baseUrl}/upload`);
      
      // Simulate network failure
      await page.setOfflineMode(true);
      
      // Try to upload
      const documentInput = await page.$('input[type="file"][name="documents"]');
      await documentInput?.uploadFile(path.join(__dirname, '../fixtures/test-document.pdf'));
      
      await page.click('button[type="submit"]');
      
      // Check for network error
      await page.waitForSelector('.network-error');
      const errorMessage = await page.$eval('.network-error', el => el.textContent);
      expect(errorMessage).toContain('Network error');
      
      // Restore network
      await page.setOfflineMode(false);
    });
  });
});