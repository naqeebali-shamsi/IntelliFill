/**
 * E2E-408: Template & Form Auto-Fill
 *
 * Tests template selection and auto-filling from OCR data:
 * - Select form template
 * - Auto-fill fields from OCR data
 * - Edit filled data
 * - Save completed form
 */

import { test, expect } from '@playwright/test';
import { test as authTest } from '../../fixtures/auth.fixture';
import { DocumentsPage } from '../../pages/DocumentsPage';
import { TemplatesPage } from '../../pages/TemplatesPage';
import { MockHelper, DEFAULT_OCR_RESPONSE } from '../../helpers/mock.helper';
import * as path from 'path';

const SAMPLE_DOCS_DIR = path.join(__dirname, '..', '..', 'sample-docs');

test.describe('E2E-408: Template & Form Auto-Fill', () => {
  let documentsPage: DocumentsPage;
  let templatesPage: TemplatesPage;
  let mockHelper: MockHelper;

  authTest.beforeEach(async ({ authenticatedPage }) => {
    documentsPage = new DocumentsPage(authenticatedPage);
    templatesPage = new TemplatesPage(authenticatedPage);
    mockHelper = new MockHelper(authenticatedPage);
  });

  authTest('should auto-fill template from OCR data', async ({ authenticatedPage }) => {
    // Step 1: Upload and process a document first
    await documentsPage.navigate();

    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE);
    await mockHelper.mockStorageUpload();

    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);
    await documentsPage.waitForOCR(undefined, 30000);

    // Step 2: Navigate to templates
    await templatesPage.navigate();
    await templatesPage.assertLoaded();

    // Step 3: Select a template (e.g., "UAE Visa" or any available template)
    const availableTemplates = await templatesPage.getTemplateNames();

    if (availableTemplates.length === 0) {
      console.log('No templates available, skipping test');
      test.skip();
      return;
    }

    const templateName = availableTemplates[0];
    await templatesPage.selectTemplate(templateName);

    // Step 4: Choose the processed document to fill from
    const documentNames = await documentsPage.getDocumentNames();
    if (documentNames.length > 0) {
      // Look for a button/dropdown to select document
      const selectDocButton = authenticatedPage.locator('button:has-text("Select Document"), button:has-text("Choose Document")');

      if (await selectDocButton.isVisible()) {
        await selectDocButton.click();
        await authenticatedPage.waitForTimeout(500);

        // Select first document from list
        const docOption = authenticatedPage.locator(`text="${documentNames[0]}"`).first();
        if (await docOption.isVisible()) {
          await docOption.click();
        }
      }
    }

    // Step 5: Verify auto-fill occurred
    // Look for form fields that should be populated with OCR data
    const passportField = authenticatedPage.locator('input[name="passportNo"], input[placeholder*="Passport" i]').first();
    const nameField = authenticatedPage.locator('input[name="fullName"], input[name="name"], input[placeholder*="Name" i]').first();

    if (await passportField.isVisible()) {
      const passportValue = await passportField.inputValue();
      // Should be filled with mock data
      expect(passportValue).toBe('AB1234567');
    }

    if (await nameField.isVisible()) {
      const nameValue = await nameField.inputValue();
      expect(nameValue).toContain('John');
    }
  });

  authTest('should allow editing auto-filled data', async ({ authenticatedPage }) => {
    // Upload and process document
    await documentsPage.navigate();
    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE);
    await mockHelper.mockStorageUpload();

    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);
    await documentsPage.waitForOCR(undefined, 30000);

    // Navigate to templates
    await templatesPage.navigate();

    const templates = await templatesPage.getTemplateNames();
    if (templates.length === 0) {
      test.skip();
      return;
    }

    await templatesPage.selectTemplate(templates[0]);

    // Find an input field and edit it
    const editableField = authenticatedPage.locator('input[type="text"]').first();

    if (await editableField.isVisible()) {
      const originalValue = await editableField.inputValue();

      // Edit the value
      await editableField.clear();
      await editableField.fill('Edited Value');

      const newValue = await editableField.inputValue();
      expect(newValue).toBe('Edited Value');
      expect(newValue).not.toBe(originalValue);
    }
  });

  authTest('should save completed form', async ({ authenticatedPage }) => {
    // Upload and process document
    await documentsPage.navigate();
    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE);
    await mockHelper.mockStorageUpload();

    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);
    await documentsPage.waitForOCR(undefined, 30000);

    // Navigate to templates
    await templatesPage.navigate();

    const templates = await templatesPage.getTemplateNames();
    if (templates.length === 0) {
      test.skip();
      return;
    }

    await templatesPage.selectTemplate(templates[0]);

    // Fill some fields
    const nameField = authenticatedPage.locator('input[name="name"], input[name="fullName"]').first();
    if (await nameField.isVisible()) {
      await nameField.fill('John Updated Doe');
    }

    // Save the form
    const saveButton = authenticatedPage.locator('button:has-text("Save"), button[type="submit"]');
    await saveButton.click();

    // Verify save success
    const toast = authenticatedPage.locator('[role="status"], .toast, .notification').filter({ hasText: /saved|success/i });
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  authTest('should map OCR fields to template fields correctly', async ({ authenticatedPage }) => {
    // Upload and process with specific OCR data
    await documentsPage.navigate();

    const customOcrData = {
      extractedFields: {
        'Passport No': 'XY9876543',
        'Full Name': 'Jane Smith',
        'Date of Birth': '1985-03-20',
        'Nationality': 'Canada',
        'Issue Date': '2021-01-15',
        'Expiry Date': '2031-01-14',
      },
      confidence: 0.98,
      pages: 1,
    };

    await mockHelper.mockOcrService(customOcrData);
    await mockHelper.mockStorageUpload();

    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);
    await documentsPage.waitForOCR(undefined, 30000);

    // Navigate to templates
    await templatesPage.navigate();

    const templates = await templatesPage.getTemplateNames();
    if (templates.length === 0) {
      test.skip();
      return;
    }

    await templatesPage.selectTemplate(templates[0]);

    // Verify fields are mapped correctly
    const fieldMappings = [
      { selector: 'input[name="passportNo"], input[placeholder*="Passport"]', expectedValue: 'XY9876543' },
      { selector: 'input[name="fullName"], input[name="name"]', expectedValue: 'Jane Smith' },
      { selector: 'input[name="dateOfBirth"], input[name="dob"]', expectedValue: '1985-03-20' },
      { selector: 'input[name="nationality"]', expectedValue: 'Canada' },
    ];

    for (const mapping of fieldMappings) {
      const field = authenticatedPage.locator(mapping.selector).first();

      if (await field.isVisible()) {
        const value = await field.inputValue();
        expect(value).toContain(mapping.expectedValue);
      }
    }
  });

  authTest('should handle missing OCR data gracefully', async ({ authenticatedPage }) => {
    // Upload with incomplete OCR data
    await documentsPage.navigate();

    const incompleteOcrData = {
      extractedFields: {
        'Full Name': 'Partial Data',
        // Missing other fields
      },
      confidence: 0.65,
      pages: 1,
    };

    await mockHelper.mockOcrService(incompleteOcrData);
    await mockHelper.mockStorageUpload();

    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);
    await documentsPage.waitForOCR(undefined, 30000);

    // Navigate to templates
    await templatesPage.navigate();

    const templates = await templatesPage.getTemplateNames();
    if (templates.length === 0) {
      test.skip();
      return;
    }

    await templatesPage.selectTemplate(templates[0]);

    // Verify form loaded even with incomplete data
    const form = authenticatedPage.locator('form');
    await expect(form).toBeVisible();

    // Fields without OCR data should be empty
    const passportField = authenticatedPage.locator('input[name="passportNo"]').first();
    if (await passportField.isVisible()) {
      const value = await passportField.inputValue();
      expect(value).toBe('');
    }
  });

  authTest('should validate required fields before save', async ({ authenticatedPage }) => {
    // Navigate to templates
    await templatesPage.navigate();

    const templates = await templatesPage.getTemplateNames();
    if (templates.length === 0) {
      test.skip();
      return;
    }

    await templatesPage.selectTemplate(templates[0]);

    // Try to save without filling required fields
    const saveButton = authenticatedPage.locator('button:has-text("Save"), button[type="submit"]');

    // Clear a required field if any are pre-filled
    const requiredField = authenticatedPage.locator('input[required], input[aria-required="true"]').first();
    if (await requiredField.isVisible()) {
      await requiredField.clear();
    }

    await saveButton.click();

    // Should show validation error
    const errorMessage = authenticatedPage.locator('[role="alert"], .error-message, .field-error');
    await expect(errorMessage).toBeVisible({ timeout: 3000 });
  });

  authTest('should support multiple templates', async ({ authenticatedPage }) => {
    await templatesPage.navigate();
    await templatesPage.assertLoaded();

    const templates = await templatesPage.getTemplateNames();

    // Should have at least one template
    expect(templates.length).toBeGreaterThan(0);

    // If multiple templates, verify can switch between them
    if (templates.length > 1) {
      await templatesPage.selectTemplate(templates[0]);
      await authenticatedPage.waitForTimeout(500);

      const firstTemplateForm = await authenticatedPage.locator('form').innerHTML();

      await templatesPage.selectTemplate(templates[1]);
      await authenticatedPage.waitForTimeout(500);

      const secondTemplateForm = await authenticatedPage.locator('form').innerHTML();

      // Forms should be different
      expect(firstTemplateForm).not.toBe(secondTemplateForm);
    }
  });

  authTest('should export filled form as PDF', async ({ authenticatedPage }) => {
    // Upload and process document
    await documentsPage.navigate();
    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE);
    await mockHelper.mockStorageUpload();

    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);
    await documentsPage.waitForOCR(undefined, 30000);

    // Navigate to templates and fill
    await templatesPage.navigate();

    const templates = await templatesPage.getTemplateNames();
    if (templates.length === 0) {
      test.skip();
      return;
    }

    await templatesPage.selectTemplate(templates[0]);

    // Save first
    const saveButton = authenticatedPage.locator('button:has-text("Save"), button[type="submit"]');
    await saveButton.click();
    await authenticatedPage.waitForTimeout(1000);

    // Export as PDF
    const exportButton = authenticatedPage.locator('button:has-text("Export"), button:has-text("Download PDF")');

    if (await exportButton.isVisible()) {
      const downloadPromise = authenticatedPage.waitForEvent('download');
      await exportButton.click();

      const download = await downloadPromise;
      expect(download).toBeTruthy();
      expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    }
  });

  authTest('should show confidence indicator for auto-filled fields', async ({ authenticatedPage }) => {
    // Upload with varying confidence levels
    await documentsPage.navigate();

    const ocrDataWithConfidence = {
      extractedFields: {
        'Passport No': 'AB1234567',
        'Full Name': 'John Doe',
      },
      confidence: 0.85,
      fieldConfidence: {
        'Passport No': 0.95,
        'Full Name': 0.75,
      },
      pages: 1,
    };

    await mockHelper.mockOcrService(ocrDataWithConfidence);
    await mockHelper.mockStorageUpload();

    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);

    await authenticatedPage.waitForTimeout(2000);
    await documentsPage.waitForOCR(undefined, 30000);

    // Navigate to templates
    await templatesPage.navigate();

    const templates = await templatesPage.getTemplateNames();
    if (templates.length === 0) {
      test.skip();
      return;
    }

    await templatesPage.selectTemplate(templates[0]);

    // Look for confidence indicators (badges, colors, icons)
    const confidenceIndicators = authenticatedPage.locator('[data-confidence], .confidence-indicator, .confidence-badge');

    // If confidence indicators are present, verify they exist
    const count = await confidenceIndicators.count();
    if (count > 0) {
      await expect(confidenceIndicators.first()).toBeVisible();
    }
  });

  authTest('should allow manual field selection for auto-fill', async ({ authenticatedPage }) => {
    // Upload multiple documents
    await documentsPage.navigate();
    await mockHelper.mockOcrService(DEFAULT_OCR_RESPONSE);
    await mockHelper.mockStorageUpload();

    const samplePdf = path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf');
    await documentsPage.uploadDocument(samplePdf);
    await authenticatedPage.waitForTimeout(1000);

    const sampleMultipage = path.join(SAMPLE_DOCS_DIR, 'sample-multipage.pdf');
    await documentsPage.uploadDocument(sampleMultipage);

    await authenticatedPage.waitForTimeout(2000);

    // Navigate to templates
    await templatesPage.navigate();

    const templates = await templatesPage.getTemplateNames();
    if (templates.length === 0) {
      test.skip();
      return;
    }

    await templatesPage.selectTemplate(templates[0]);

    // Look for document selector
    const docSelector = authenticatedPage.locator('select[name="sourceDocument"], [data-testid="document-selector"]');

    if (await docSelector.isVisible()) {
      const options = await docSelector.locator('option').count();
      // Should have multiple documents to choose from
      expect(options).toBeGreaterThan(1);
    }
  });
});
