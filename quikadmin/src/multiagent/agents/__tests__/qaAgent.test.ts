/**
 * QA Agent Tests
 *
 * Unit tests for the quality assurance agent with validation rules.
 */

import {
  validateExtraction,
  getRequiredFields,
  hasAllRequiredFields,
  getLowConfidenceFields,
  calculateAverageConfidence,
  parseDate,
  validateDateField,
  validateExpiryDate,
  validateAmountField,
  CONFIDENCE_THRESHOLDS,
  QAResult,
} from '../qaAgent';
import { ExtractedFieldResult } from '../../../types/extractedData';
import { DocumentCategory } from '../../types/state';

// Mock the piiSafeLogger
jest.mock('../../../utils/piiSafeLogger', () => ({
  piiSafeLogger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('QAAgent', () => {
  // ========================================
  // DATE PARSING TESTS
  // ========================================
  describe('parseDate', () => {
    it('should parse ISO format (YYYY-MM-DD)', () => {
      const date = parseDate('2024-01-15');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(2024);
      expect(date?.getMonth()).toBe(0); // January is 0
      expect(date?.getDate()).toBe(15);
    });

    it('should parse DD/MM/YYYY format', () => {
      const date = parseDate('15/01/2024');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(2024);
      expect(date?.getMonth()).toBe(0);
      expect(date?.getDate()).toBe(15);
    });

    it('should parse DD-MM-YYYY format', () => {
      const date = parseDate('15-01-2024');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(2024);
    });

    it('should parse DD.MM.YYYY format', () => {
      const date = parseDate('15.01.2024');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(2024);
    });

    it('should return null for invalid dates', () => {
      expect(parseDate('invalid')).toBeNull();
      expect(parseDate('')).toBeNull();
      expect(parseDate('not-a-date')).toBeNull();
    });

    it('should handle single digit day/month', () => {
      const date = parseDate('5/1/2024');
      expect(date).toBeInstanceOf(Date);
    });
  });

  // ========================================
  // DATE VALIDATION TESTS
  // ========================================
  describe('validateDateField', () => {
    it('should pass for valid dates', () => {
      const result = validateDateField('2024-01-15');
      expect(result.valid).toBe(true);
    });

    it('should fail for empty dates', () => {
      const result = validateDateField('');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('empty');
    });

    it('should fail for invalid format', () => {
      const result = validateDateField('not-a-date');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Invalid date format');
    });

    it('should fail for dates too far in the past', () => {
      const result = validateDateField('1800-01-01');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('out of reasonable range');
    });

    it('should fail for dates too far in the future', () => {
      const result = validateDateField('2100-01-01');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('out of reasonable range');
    });
  });

  // ========================================
  // EXPIRY DATE VALIDATION TESTS
  // ========================================
  describe('validateExpiryDate', () => {
    it('should pass for future expiry dates', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 5);
      const dateStr = futureDate.toISOString().split('T')[0];

      const result = validateExpiryDate(dateStr, {});
      expect(result.valid).toBe(true);
    });

    it('should fail for expired dates', () => {
      const result = validateExpiryDate('2020-01-01', {});
      expect(result.valid).toBe(false);
      expect(result.message).toContain('expired');
    });

    it('should fail when expiry is before issue date', () => {
      // Use a date that's in the future but before the issue date
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 2);
      const expiryStr = futureDate.toISOString().split('T')[0];

      const laterIssueDate = new Date();
      laterIssueDate.setFullYear(laterIssueDate.getFullYear() + 3);
      const issueStr = laterIssueDate.toISOString().split('T')[0];

      const fields: Record<string, ExtractedFieldResult> = {
        date_of_issue: { value: issueStr, confidence: 90, source: 'llm' },
      };

      const result = validateExpiryDate(expiryStr, fields, 'date_of_issue');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('after issue date');
    });

    it('should pass when expiry is after issue date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 5);
      const expiryStr = futureDate.toISOString().split('T')[0];

      const fields: Record<string, ExtractedFieldResult> = {
        date_of_issue: { value: '2024-01-01', confidence: 90, source: 'llm' },
      };

      const result = validateExpiryDate(expiryStr, fields, 'date_of_issue');
      expect(result.valid).toBe(true);
    });
  });

  // ========================================
  // AMOUNT VALIDATION TESTS
  // ========================================
  describe('validateAmountField', () => {
    it('should pass for valid amounts', () => {
      expect(validateAmountField('1000.00').valid).toBe(true);
      expect(validateAmountField('1,000.00').valid).toBe(true);
      expect(validateAmountField('$1000').valid).toBe(true);
      expect(validateAmountField('AED 5,000.50').valid).toBe(true);
    });

    it('should fail for empty amounts', () => {
      const result = validateAmountField('');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('empty');
    });

    it('should fail for non-numeric amounts', () => {
      const result = validateAmountField('abc');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('parse');
    });

    it('should handle negative amounts', () => {
      // The current implementation strips non-numeric chars including minus
      // So -100.00 becomes 100.00 and parses as positive
      // This tests the current behavior
      const result = validateAmountField('-100.00');
      // After stripping non-numeric, 100.00 is valid
      expect(result.valid).toBe(true);
    });
  });

  // ========================================
  // GET REQUIRED FIELDS TESTS
  // ========================================
  describe('getRequiredFields', () => {
    it('should return required fields for passport', () => {
      const required = getRequiredFields('PASSPORT');
      expect(required).toContain('passport_number');
      expect(required).toContain('full_name');
      expect(required).toContain('nationality');
      expect(required).toContain('date_of_birth');
      expect(required).toContain('date_of_expiry');
    });

    it('should return required fields for Emirates ID', () => {
      const required = getRequiredFields('EMIRATES_ID');
      expect(required).toContain('emirates_id');
      expect(required).toContain('full_name');
      expect(required).toContain('nationality');
      expect(required).toContain('date_of_birth');
      expect(required).toContain('date_of_expiry');
    });

    it('should return required fields for visa', () => {
      const required = getRequiredFields('VISA');
      expect(required).toContain('visa_number');
      expect(required).toContain('visa_type');
      expect(required).toContain('full_name');
      expect(required).toContain('date_of_expiry');
    });

    it('should return empty for unknown category', () => {
      const required = getRequiredFields('UNKNOWN');
      expect(required).toHaveLength(0);
    });
  });

  // ========================================
  // HAS ALL REQUIRED FIELDS TESTS
  // ========================================
  describe('hasAllRequiredFields', () => {
    it('should return true when all required fields are present', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 5);
      const expiryStr = futureDate.toISOString().split('T')[0];

      const fields: Record<string, ExtractedFieldResult> = {
        passport_number: { value: 'A12345678', confidence: 90, source: 'llm' },
        full_name: { value: 'John Smith', confidence: 90, source: 'llm' },
        nationality: { value: 'USA', confidence: 90, source: 'llm' },
        date_of_birth: { value: '1990-01-01', confidence: 90, source: 'llm' },
        date_of_expiry: { value: expiryStr, confidence: 90, source: 'llm' },
      };

      expect(hasAllRequiredFields(fields, 'PASSPORT')).toBe(true);
    });

    it('should return false when required fields are missing', () => {
      const fields: Record<string, ExtractedFieldResult> = {
        passport_number: { value: 'A12345678', confidence: 90, source: 'llm' },
        // Missing other required fields
      };

      expect(hasAllRequiredFields(fields, 'PASSPORT')).toBe(false);
    });

    it('should return false when required fields have null values', () => {
      const fields: Record<string, ExtractedFieldResult> = {
        passport_number: { value: null, confidence: 0, source: 'llm' },
        full_name: { value: 'John Smith', confidence: 90, source: 'llm' },
        nationality: { value: 'USA', confidence: 90, source: 'llm' },
        date_of_birth: { value: '1990-01-01', confidence: 90, source: 'llm' },
        date_of_expiry: { value: '2030-01-01', confidence: 90, source: 'llm' },
      };

      expect(hasAllRequiredFields(fields, 'PASSPORT')).toBe(false);
    });
  });

  // ========================================
  // LOW CONFIDENCE FIELDS TESTS
  // ========================================
  describe('getLowConfidenceFields', () => {
    it('should identify fields below threshold', () => {
      const fields: Record<string, ExtractedFieldResult> = {
        field1: { value: 'value1', confidence: 90, source: 'llm' },
        field2: { value: 'value2', confidence: 60, source: 'llm' },
        field3: { value: 'value3', confidence: 40, source: 'llm' },
      };

      const lowConfidence = getLowConfidenceFields(fields, 70);
      expect(lowConfidence).toContain('field2');
      expect(lowConfidence).toContain('field3');
      expect(lowConfidence).not.toContain('field1');
    });

    it('should return empty array when all fields are high confidence', () => {
      const fields: Record<string, ExtractedFieldResult> = {
        field1: { value: 'value1', confidence: 90, source: 'llm' },
        field2: { value: 'value2', confidence: 85, source: 'llm' },
      };

      const lowConfidence = getLowConfidenceFields(fields, 70);
      expect(lowConfidence).toHaveLength(0);
    });

    it('should use default threshold of 70', () => {
      const fields: Record<string, ExtractedFieldResult> = {
        field1: { value: 'value1', confidence: 69, source: 'llm' },
        field2: { value: 'value2', confidence: 71, source: 'llm' },
      };

      const lowConfidence = getLowConfidenceFields(fields);
      expect(lowConfidence).toContain('field1');
      expect(lowConfidence).not.toContain('field2');
    });
  });

  // ========================================
  // CALCULATE AVERAGE CONFIDENCE TESTS
  // ========================================
  describe('calculateAverageConfidence', () => {
    it('should calculate average confidence correctly', () => {
      const fields: Record<string, ExtractedFieldResult> = {
        field1: { value: 'value1', confidence: 80, source: 'llm' },
        field2: { value: 'value2', confidence: 90, source: 'llm' },
        field3: { value: 'value3', confidence: 100, source: 'llm' },
      };

      expect(calculateAverageConfidence(fields)).toBe(90);
    });

    it('should return 0 for empty fields', () => {
      expect(calculateAverageConfidence({})).toBe(0);
    });

    it('should round to nearest integer', () => {
      const fields: Record<string, ExtractedFieldResult> = {
        field1: { value: 'value1', confidence: 70, source: 'llm' },
        field2: { value: 'value2', confidence: 75, source: 'llm' },
      };

      expect(calculateAverageConfidence(fields)).toBe(73);
    });
  });

  // ========================================
  // VALIDATE EXTRACTION TESTS
  // ========================================
  describe('validateExtraction', () => {
    it('should pass validation for complete, valid passport', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 5);
      const expiryStr = futureDate.toISOString().split('T')[0];

      const fields: Record<string, ExtractedFieldResult> = {
        passport_number: { value: 'A12345678', confidence: 95, source: 'llm' },
        full_name: { value: 'John Smith', confidence: 92, source: 'llm' },
        nationality: { value: 'USA', confidence: 90, source: 'llm' },
        date_of_birth: { value: '1990-01-15', confidence: 88, source: 'llm' },
        date_of_expiry: { value: expiryStr, confidence: 91, source: 'llm' },
      };

      const result = await validateExtraction(fields, 'PASSPORT');

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });

    it('should fail validation for missing required fields', async () => {
      const fields: Record<string, ExtractedFieldResult> = {
        full_name: { value: 'John Smith', confidence: 90, source: 'llm' },
        // Missing passport_number, nationality, date_of_birth, date_of_expiry
      };

      const result = await validateExtraction(fields, 'PASSPORT');

      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.issueType === 'missing_required')).toBe(true);
    });

    it('should report invalid format issues', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 5);
      const expiryStr = futureDate.toISOString().split('T')[0];

      const fields: Record<string, ExtractedFieldResult> = {
        passport_number: { value: 'INVALID!!!', confidence: 90, source: 'llm' },
        full_name: { value: 'John Smith', confidence: 90, source: 'llm' },
        nationality: { value: 'USA', confidence: 90, source: 'llm' },
        date_of_birth: { value: '1990-01-15', confidence: 90, source: 'llm' },
        date_of_expiry: { value: expiryStr, confidence: 90, source: 'llm' },
      };

      const result = await validateExtraction(fields, 'PASSPORT');

      expect(result.issues.some((i) => i.issueType === 'invalid_format')).toBe(true);
    });

    it('should report low confidence issues', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 5);
      const expiryStr = futureDate.toISOString().split('T')[0];

      const fields: Record<string, ExtractedFieldResult> = {
        passport_number: { value: 'A12345678', confidence: 40, source: 'llm' }, // Low confidence
        full_name: { value: 'John Smith', confidence: 90, source: 'llm' },
        nationality: { value: 'USA', confidence: 90, source: 'llm' },
        date_of_birth: { value: '1990-01-15', confidence: 90, source: 'llm' },
        date_of_expiry: { value: expiryStr, confidence: 90, source: 'llm' },
      };

      const result = await validateExtraction(fields, 'PASSPORT');

      expect(result.issues.some((i) => i.issueType === 'low_confidence')).toBe(true);
    });

    it('should flag expired documents', async () => {
      const fields: Record<string, ExtractedFieldResult> = {
        passport_number: { value: 'A12345678', confidence: 95, source: 'llm' },
        full_name: { value: 'John Smith', confidence: 90, source: 'llm' },
        nationality: { value: 'USA', confidence: 90, source: 'llm' },
        date_of_birth: { value: '1990-01-15', confidence: 90, source: 'llm' },
        date_of_expiry: { value: '2020-01-01', confidence: 90, source: 'llm' }, // Expired
      };

      const result = await validateExtraction(fields, 'PASSPORT');

      expect(result.issues.some((i) => i.message?.includes('expired'))).toBe(true);
    });

    it('should flag suspicious placeholder values', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 5);
      const expiryStr = futureDate.toISOString().split('T')[0];

      const fields: Record<string, ExtractedFieldResult> = {
        passport_number: { value: 'A12345678', confidence: 95, source: 'llm' },
        full_name: { value: 'N/A', confidence: 90, source: 'llm' }, // Placeholder
        nationality: { value: 'USA', confidence: 90, source: 'llm' },
        date_of_birth: { value: '1990-01-15', confidence: 90, source: 'llm' },
        date_of_expiry: { value: expiryStr, confidence: 90, source: 'llm' },
      };

      const result = await validateExtraction(fields, 'PASSPORT');

      expect(result.issues.some((i) => i.issueType === 'suspicious_value')).toBe(true);
    });

    it('should require human review for multiple issues', async () => {
      const fields: Record<string, ExtractedFieldResult> = {
        passport_number: { value: 'A12345678', confidence: 50, source: 'llm' },
        full_name: { value: 'J', confidence: 45, source: 'llm' }, // Too short
        nationality: { value: 'test', confidence: 40, source: 'llm' },
        // Missing required fields
      };

      const result = await validateExtraction(fields, 'PASSPORT');

      expect(result.requiresHumanReview).toBe(true);
    });

    it('should provide summary statistics', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 5);
      const expiryStr = futureDate.toISOString().split('T')[0];

      const fields: Record<string, ExtractedFieldResult> = {
        passport_number: { value: 'A12345678', confidence: 90, source: 'llm' },
        full_name: { value: 'John Smith', confidence: 85, source: 'llm' },
        nationality: { value: 'USA', confidence: 80, source: 'llm' },
        date_of_birth: { value: '1990-01-15', confidence: 75, source: 'llm' },
        date_of_expiry: { value: expiryStr, confidence: 70, source: 'llm' },
      };

      const result = await validateExtraction(fields, 'PASSPORT');

      expect(result.summary).toBeDefined();
      expect(result.summary.totalFields).toBe(5);
      expect(result.summary.averageConfidence).toBe(82);
    });

    it('should handle empty fields gracefully', async () => {
      const result = await validateExtraction({}, 'PASSPORT');

      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.issueType === 'missing_required')).toBe(true);
    });

    it('should validate Emirates ID format', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 5);
      const expiryStr = futureDate.toISOString().split('T')[0];

      const validFields: Record<string, ExtractedFieldResult> = {
        emirates_id: { value: '784-1990-1234567-1', confidence: 95, source: 'llm' },
        full_name: { value: 'Ahmed Mohammed', confidence: 90, source: 'llm' },
        nationality: { value: 'UAE', confidence: 90, source: 'llm' },
        date_of_birth: { value: '1990-01-01', confidence: 90, source: 'llm' },
        date_of_expiry: { value: expiryStr, confidence: 90, source: 'llm' },
      };

      const result = await validateExtraction(validFields, 'EMIRATES_ID');
      expect(
        result.issues.filter((i) => i.field === 'emirates_id' && i.issueType === 'invalid_format')
      ).toHaveLength(0);

      // Invalid format
      const invalidFields: Record<string, ExtractedFieldResult> = {
        emirates_id: { value: '123-456-789', confidence: 95, source: 'llm' }, // Wrong format
        full_name: { value: 'Ahmed Mohammed', confidence: 90, source: 'llm' },
        nationality: { value: 'UAE', confidence: 90, source: 'llm' },
        date_of_birth: { value: '1990-01-01', confidence: 90, source: 'llm' },
        date_of_expiry: { value: expiryStr, confidence: 90, source: 'llm' },
      };

      const invalidResult = await validateExtraction(invalidFields, 'EMIRATES_ID');
      expect(
        invalidResult.issues.some(
          (i) => i.field === 'emirates_id' && i.issueType === 'invalid_format'
        )
      ).toBe(true);
    });

    it('should validate invoice fields', async () => {
      const fields: Record<string, ExtractedFieldResult> = {
        invoice_number: { value: 'INV-001', confidence: 95, source: 'llm' },
        vendor_name: { value: 'ABC Company', confidence: 90, source: 'llm' },
        invoice_date: { value: '2024-01-15', confidence: 90, source: 'llm' },
        // Use a numeric format that matches the regex pattern
        total_amount: { value: '1000.00', confidence: 90, source: 'llm' },
      };

      const result = await validateExtraction(fields, 'INVOICE');

      // Invoice validation should not have format errors for these valid fields
      expect(
        result.issues.filter((i) => i.field === 'total_amount' && i.issueType === 'invalid_format')
      ).toHaveLength(0);
      expect(result.issues.filter((i) => i.issueType === 'missing_required')).toHaveLength(0);
    });
  });

  // ========================================
  // SCORE CALCULATION TESTS
  // ========================================
  describe('Score Calculation', () => {
    it('should give high score for complete, valid extraction', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 5);
      const expiryStr = futureDate.toISOString().split('T')[0];

      const fields: Record<string, ExtractedFieldResult> = {
        passport_number: { value: 'A12345678', confidence: 95, source: 'llm' },
        full_name: { value: 'John Smith', confidence: 95, source: 'llm' },
        nationality: { value: 'USA', confidence: 95, source: 'llm' },
        date_of_birth: { value: '1990-01-15', confidence: 95, source: 'llm' },
        date_of_expiry: { value: expiryStr, confidence: 95, source: 'llm' },
      };

      const result = await validateExtraction(fields, 'PASSPORT');

      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it('should reduce score for errors', async () => {
      const fields: Record<string, ExtractedFieldResult> = {
        // Missing required fields will cause errors
        full_name: { value: 'John Smith', confidence: 90, source: 'llm' },
      };

      const result = await validateExtraction(fields, 'PASSPORT');

      expect(result.score).toBeLessThan(60);
    });

    it('should keep score in 0-100 range', async () => {
      // Test with many errors
      const result1 = await validateExtraction({}, 'PASSPORT');
      expect(result1.score).toBeGreaterThanOrEqual(0);
      expect(result1.score).toBeLessThanOrEqual(100);

      // Test with high confidence
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 5);
      const expiryStr = futureDate.toISOString().split('T')[0];

      const fields: Record<string, ExtractedFieldResult> = {
        passport_number: { value: 'A12345678', confidence: 100, source: 'llm' },
        full_name: { value: 'John Smith', confidence: 100, source: 'llm' },
        nationality: { value: 'USA', confidence: 100, source: 'llm' },
        date_of_birth: { value: '1990-01-15', confidence: 100, source: 'llm' },
        date_of_expiry: { value: expiryStr, confidence: 100, source: 'llm' },
      };

      const result2 = await validateExtraction(fields, 'PASSPORT');
      expect(result2.score).toBeGreaterThanOrEqual(0);
      expect(result2.score).toBeLessThanOrEqual(100);
    });
  });

  // ========================================
  // CONFIDENCE THRESHOLDS TESTS
  // ========================================
  describe('Confidence Thresholds', () => {
    it('should have correct threshold values', () => {
      expect(CONFIDENCE_THRESHOLDS.LOW).toBe(50);
      expect(CONFIDENCE_THRESHOLDS.WARNING).toBe(70);
      expect(CONFIDENCE_THRESHOLDS.ACCEPTABLE).toBe(80);
      expect(CONFIDENCE_THRESHOLDS.HIGH).toBe(90);
    });
  });
});
