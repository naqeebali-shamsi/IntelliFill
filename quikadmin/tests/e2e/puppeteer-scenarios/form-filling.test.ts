/**
 * Form Filling Test Scenarios
 * Tests intelligent form filling, field mapping, and validation
 */

import { PuppeteerTestHelpers as Helper } from './test-helpers';
import { TEST_CONFIG } from './test-config';

describe('Form Filling Test Suite', () => {
  
  beforeAll(async () => {
    await Helper.connectToBrowser();
    await Helper.login(TEST_CONFIG.users.standard.email, TEST_CONFIG.users.standard.password);
  });

  beforeEach(async () => {
    // Navigate to form filling page
    await Helper.navigateToPage(`${TEST_CONFIG.urls.base}/process`);
  });

  describe('Intelligent Field Mapping', () => {
    test('Should automatically map document data to form fields', async () => {
      // Upload source document
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      
      // Upload target form
      await Helper.uploadFile(TEST_CONFIG.testData.sampleForm);
      
      // Click process button
      await Helper.clickElement('[data-testid="process-documents"]');
      
      // Wait for mapping to complete
      await Helper.waitForElement('[data-testid="mapping-complete"]', TEST_CONFIG.waits.upload);
      
      // Check mapping results
      const mappedFields = await Helper.getElementCount('[data-testid="mapped-field"]');
      expect(mappedFields).toBeGreaterThan(0);
      
      // Verify confidence scores
      const confidenceScore = await Helper.getElementText('[data-testid="confidence-score"]');
      expect(parseFloat(confidenceScore)).toBeGreaterThan(0.8);
      
      await Helper.takeScreenshot('field-mapping-complete');
    });

    test('Should show field mapping preview', async () => {
      // Setup documents
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.uploadFile(TEST_CONFIG.testData.sampleForm);
      await Helper.clickElement('[data-testid="process-documents"]');
      
      // Wait for preview
      await Helper.waitForElement('[data-testid="mapping-preview"]');
      
      // Check preview details
      const sourceFields = await Helper.getElementCount('[data-testid="source-field"]');
      const targetFields = await Helper.getElementCount('[data-testid="target-field"]');
      
      expect(sourceFields).toBeGreaterThan(0);
      expect(targetFields).toBeGreaterThan(0);
      
      // Check mapping lines
      const mappingLines = await Helper.getElementCount('[data-testid="mapping-line"]');
      expect(mappingLines).toBeGreaterThan(0);
      
      await Helper.takeScreenshot('mapping-preview');
    });

    test('Should allow manual field mapping adjustments', async () => {
      // Setup and process
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.uploadFile(TEST_CONFIG.testData.sampleForm);
      await Helper.clickElement('[data-testid="process-documents"]');
      await Helper.waitForElement('[data-testid="mapping-complete"]');
      
      // Click edit mapping
      await Helper.clickElement('[data-testid="edit-mapping"]');
      
      // Change a field mapping
      await Helper.selectOption('[data-testid="field-map-0"]', 'different_field');
      
      // Save changes
      await Helper.clickElement('[data-testid="save-mapping"]');
      
      // Verify changes saved
      await Helper.waitForText('Mapping updated');
      
      await Helper.takeScreenshot('manual-mapping-adjusted');
    });

    test('Should detect and handle ambiguous mappings', async () => {
      // Process documents
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.uploadFile(TEST_CONFIG.testData.sampleForm);
      await Helper.clickElement('[data-testid="process-documents"]');
      
      // Check for ambiguous fields
      const ambiguousFields = await Helper.getElementCount('[data-testid="ambiguous-field"]');
      
      if (ambiguousFields > 0) {
        // Resolve ambiguity
        await Helper.clickElement('[data-testid="resolve-ambiguous-0"]');
        await Helper.selectOption('[data-testid="ambiguous-options"]', 'option1');
        await Helper.clickElement('[data-testid="confirm-resolution"]');
        
        await Helper.waitForText('Ambiguity resolved');
      }
      
      await Helper.takeScreenshot('ambiguous-fields-resolved');
    });
  });

  describe('Form Field Population', () => {
    test('Should fill text fields correctly', async () => {
      // Process and fill form
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.uploadFile(TEST_CONFIG.testData.sampleForm);
      await Helper.clickElement('[data-testid="process-documents"]');
      await Helper.waitForElement('[data-testid="form-filled"]');
      
      // Check text fields
      const nameField = await Helper.getElementText('input[name="fullName"]');
      const emailField = await Helper.getElementText('input[name="email"]');
      const addressField = await Helper.getElementText('input[name="address"]');
      
      expect(nameField).toBeTruthy();
      expect(emailField).toContain('@');
      expect(addressField).toBeTruthy();
      
      await Helper.takeScreenshot('text-fields-filled');
    });

    test('Should fill date fields with correct format', async () => {
      // Process documents
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.uploadFile(TEST_CONFIG.testData.sampleForm);
      await Helper.clickElement('[data-testid="process-documents"]');
      await Helper.waitForElement('[data-testid="form-filled"]');
      
      // Check date fields
      const dateField = await Helper.getElementText('input[type="date"]');
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      
      expect(dateField).toMatch(datePattern);
      
      await Helper.takeScreenshot('date-fields-filled');
    });

    test('Should handle checkboxes and radio buttons', async () => {
      // Process documents
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.uploadFile(TEST_CONFIG.testData.sampleForm);
      await Helper.clickElement('[data-testid="process-documents"]');
      await Helper.waitForElement('[data-testid="form-filled"]');
      
      // Check checkbox states
      const checkbox1 = await Helper.executeScript(
        `document.querySelector('input[type="checkbox"][name="agree"]').checked`
      );
      
      // Check radio button selection
      const selectedRadio = await Helper.executeScript(
        `document.querySelector('input[type="radio"]:checked').value`
      );
      
      expect(checkbox1).toBeDefined();
      expect(selectedRadio).toBeTruthy();
      
      await Helper.takeScreenshot('checkboxes-radios-filled');
    });

    test('Should populate dropdown/select fields', async () => {
      // Process documents
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.uploadFile(TEST_CONFIG.testData.sampleForm);
      await Helper.clickElement('[data-testid="process-documents"]');
      await Helper.waitForElement('[data-testid="form-filled"]');
      
      // Check select field values
      const countrySelect = await Helper.executeScript(
        `document.querySelector('select[name="country"]').value`
      );
      const stateSelect = await Helper.executeScript(
        `document.querySelector('select[name="state"]').value`
      );
      
      expect(countrySelect).toBeTruthy();
      expect(stateSelect).toBeTruthy();
      
      await Helper.takeScreenshot('dropdowns-filled');
    });

    test('Should handle multi-line text areas', async () => {
      // Process documents
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.uploadFile(TEST_CONFIG.testData.sampleForm);
      await Helper.clickElement('[data-testid="process-documents"]');
      await Helper.waitForElement('[data-testid="form-filled"]');
      
      // Check textarea content
      const description = await Helper.getElementText('textarea[name="description"]');
      const comments = await Helper.getElementText('textarea[name="comments"]');
      
      expect(description.length).toBeGreaterThan(0);
      expect(comments.length).toBeGreaterThan(0);
      
      await Helper.takeScreenshot('textareas-filled');
    });
  });

  describe('Field Validation', () => {
    test('Should validate required fields', async () => {
      // Process with missing required data
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.uploadFile(TEST_CONFIG.testData.sampleForm);
      await Helper.clickElement('[data-testid="process-documents"]');
      
      // Try to submit form
      await Helper.clickElement(TEST_CONFIG.selectors.form.submitButton);
      
      // Check for validation errors
      const validationErrors = await Helper.getElementCount(TEST_CONFIG.selectors.form.validationError);
      expect(validationErrors).toBeGreaterThan(0);
      
      // Check specific error message
      const errorText = await Helper.getElementText(TEST_CONFIG.selectors.form.validationError);
      expect(errorText).toContain('required');
      
      await Helper.takeScreenshot('required-field-validation');
    });

    test('Should validate email format', async () => {
      // Fill form with invalid email
      await Helper.fillField('input[name="email"]', 'invalid-email');
      await Helper.clickElement(TEST_CONFIG.selectors.form.submitButton);
      
      // Check for email validation error
      await Helper.waitForElement('[data-testid="email-error"]');
      const errorText = await Helper.getElementText('[data-testid="email-error"]');
      
      expect(errorText).toContain('valid email');
      
      await Helper.takeScreenshot('email-validation-error');
    });

    test('Should validate phone number format', async () => {
      // Fill with invalid phone
      await Helper.fillField('input[name="phone"]', '123');
      await Helper.clickElement(TEST_CONFIG.selectors.form.submitButton);
      
      // Check for phone validation error
      await Helper.waitForElement('[data-testid="phone-error"]');
      const errorText = await Helper.getElementText('[data-testid="phone-error"]');
      
      expect(errorText).toContain('valid phone');
      
      await Helper.takeScreenshot('phone-validation-error');
    });

    test('Should validate numeric fields', async () => {
      // Fill numeric field with text
      await Helper.fillField('input[name="amount"]', 'abc');
      await Helper.clickElement(TEST_CONFIG.selectors.form.submitButton);
      
      // Check for validation error
      await Helper.waitForElement('[data-testid="amount-error"]');
      const errorText = await Helper.getElementText('[data-testid="amount-error"]');
      
      expect(errorText).toContain('must be a number');
      
      await Helper.takeScreenshot('numeric-validation-error');
    });
  });

  describe('Form Review and Editing', () => {
    test('Should allow reviewing filled form before submission', async () => {
      // Process documents
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.uploadFile(TEST_CONFIG.testData.sampleForm);
      await Helper.clickElement('[data-testid="process-documents"]');
      await Helper.waitForElement('[data-testid="form-filled"]');
      
      // Click review button
      await Helper.clickElement('[data-testid="review-form"]');
      
      // Check review modal
      await Helper.waitForElement('[data-testid="review-modal"]');
      
      // Verify all fields are shown
      const reviewFields = await Helper.getElementCount('[data-testid="review-field"]');
      expect(reviewFields).toBeGreaterThan(0);
      
      await Helper.takeScreenshot('form-review');
    });

    test('Should allow editing individual fields', async () => {
      // Process and fill form
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.uploadFile(TEST_CONFIG.testData.sampleForm);
      await Helper.clickElement('[data-testid="process-documents"]');
      await Helper.waitForElement('[data-testid="form-filled"]');
      
      // Edit a field
      const originalValue = await Helper.getElementText('input[name="fullName"]');
      await Helper.fillField('input[name="fullName"]', 'Updated Name');
      
      // Verify change
      const newValue = await Helper.getElementText('input[name="fullName"]');
      expect(newValue).not.toBe(originalValue);
      expect(newValue).toBe('Updated Name');
      
      await Helper.takeScreenshot('field-edited');
    });

    test('Should highlight confidence levels for fields', async () => {
      // Process documents
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.uploadFile(TEST_CONFIG.testData.sampleForm);
      await Helper.clickElement('[data-testid="process-documents"]');
      await Helper.waitForElement('[data-testid="form-filled"]');
      
      // Check for confidence indicators
      const highConfidence = await Helper.getElementCount('[data-testid="high-confidence"]');
      const mediumConfidence = await Helper.getElementCount('[data-testid="medium-confidence"]');
      const lowConfidence = await Helper.getElementCount('[data-testid="low-confidence"]');
      
      expect(highConfidence + mediumConfidence + lowConfidence).toBeGreaterThan(0);
      
      await Helper.takeScreenshot('confidence-indicators');
    });
  });

  describe('Form Submission', () => {
    test('Should successfully submit filled form', async () => {
      // Process and fill form
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.uploadFile(TEST_CONFIG.testData.sampleForm);
      await Helper.clickElement('[data-testid="process-documents"]');
      await Helper.waitForElement('[data-testid="form-filled"]');
      
      // Submit form
      await Helper.clickElement(TEST_CONFIG.selectors.form.submitButton);
      
      // Wait for success
      await Helper.waitForElement('[data-testid="submit-success"]');
      const successText = await Helper.getElementText('[data-testid="submit-success"]');
      
      expect(successText).toContain('successfully submitted');
      
      await Helper.takeScreenshot('form-submitted');
    });

    test('Should generate filled PDF after submission', async () => {
      // Process and submit
      await Helper.uploadFile(TEST_CONFIG.testData.samplePDF);
      await Helper.uploadFile(TEST_CONFIG.testData.sampleForm);
      await Helper.clickElement('[data-testid="process-documents"]');
      await Helper.waitForElement('[data-testid="form-filled"]');
      await Helper.clickElement(TEST_CONFIG.selectors.form.submitButton);
      
      // Wait for PDF generation
      await Helper.waitForElement('[data-testid="pdf-generated"]');
      
      // Check download button
      const downloadButton = await Helper.elementExists('[data-testid="download-pdf"]');
      expect(downloadButton).toBe(true);
      
      await Helper.takeScreenshot('pdf-generated');
    });

    test('Should save form as draft', async () => {
      // Partially fill form
      await Helper.fillField('input[name="fullName"]', 'Draft User');
      await Helper.fillField('input[name="email"]', 'draft@example.com');
      
      // Save as draft
      await Helper.clickElement('[data-testid="save-draft"]');
      
      // Check for save confirmation
      await Helper.waitForText('Draft saved');
      
      // Navigate away and back
      await Helper.navigateToPage(`${TEST_CONFIG.urls.base}/dashboard`);
      await Helper.navigateToPage(`${TEST_CONFIG.urls.base}/process`);
      
      // Load draft
      await Helper.clickElement('[data-testid="load-draft"]');
      
      // Verify fields are restored
      const nameValue = await Helper.getElementText('input[name="fullName"]');
      expect(nameValue).toBe('Draft User');
      
      await Helper.takeScreenshot('draft-loaded');
    });
  });
});