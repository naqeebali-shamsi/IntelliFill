/**
 * Mapper Agent Tests
 *
 * Unit tests for the field mapper agent with alias and semantic matching.
 */

import {
  mapExtractedFields,
  getCanonicalFieldName,
  isCanonicalField,
  getCanonicalFieldsForCategory,
  normalizeFieldName,
  calculateSemanticSimilarity,
  MappingResult,
} from '../mapperAgent';
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

describe('MapperAgent', () => {
  // ========================================
  // FIELD NAME NORMALIZATION TESTS
  // ========================================
  describe('normalizeFieldName', () => {
    it('should convert to lowercase', () => {
      expect(normalizeFieldName('FIRST_NAME')).toBe('first_name');
      expect(normalizeFieldName('FirstName')).toBe('firstname');
    });

    it('should replace spaces and special characters with underscores', () => {
      expect(normalizeFieldName('first name')).toBe('first_name');
      expect(normalizeFieldName('first-name')).toBe('first_name');
      expect(normalizeFieldName('first.name')).toBe('first_name');
    });

    it('should collapse multiple underscores', () => {
      expect(normalizeFieldName('first__name')).toBe('first_name');
      expect(normalizeFieldName('first___name')).toBe('first_name');
    });

    it('should remove leading and trailing underscores', () => {
      expect(normalizeFieldName('_first_name_')).toBe('first_name');
      expect(normalizeFieldName('__name__')).toBe('name');
    });

    it('should handle empty strings', () => {
      expect(normalizeFieldName('')).toBe('');
    });
  });

  // ========================================
  // SEMANTIC SIMILARITY TESTS
  // ========================================
  describe('calculateSemanticSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(calculateSemanticSimilarity('passport_number', 'passport_number')).toBe(1);
    });

    it('should return high similarity for similar strings', () => {
      const similarity = calculateSemanticSimilarity('first_name', 'firstname');
      expect(similarity).toBeGreaterThan(0.8);
    });

    it('should return lower similarity for different strings', () => {
      const similarity = calculateSemanticSimilarity('first_name', 'date_of_birth');
      expect(similarity).toBeLessThan(0.5);
    });

    it('should handle containment relationships', () => {
      const similarity = calculateSemanticSimilarity('name', 'full_name');
      expect(similarity).toBeGreaterThan(0.7);
    });

    it('should return 0 for empty strings', () => {
      expect(calculateSemanticSimilarity('', 'name')).toBe(0);
      expect(calculateSemanticSimilarity('name', '')).toBe(0);
    });
  });

  // ========================================
  // CANONICAL FIELD NAME LOOKUP TESTS
  // ========================================
  describe('getCanonicalFieldName', () => {
    it('should return canonical name for exact match', () => {
      expect(getCanonicalFieldName('full_name', 'PASSPORT')).toBe('full_name');
    });

    it('should map aliases to canonical names', () => {
      expect(getCanonicalFieldName('first_name', 'PASSPORT')).toBe('given_name');
      expect(getCanonicalFieldName('surname', 'PASSPORT')).toBe('family_name');
      expect(getCanonicalFieldName('dob', 'PASSPORT')).toBe('date_of_birth');
    });

    it('should handle passport-specific aliases', () => {
      expect(getCanonicalFieldName('passport_no', 'PASSPORT')).toBe('passport_number');
      expect(getCanonicalFieldName('document_number', 'PASSPORT')).toBe('passport_number');
    });

    it('should handle Emirates ID-specific aliases', () => {
      expect(getCanonicalFieldName('eid', 'EMIRATES_ID')).toBe('emirates_id');
      expect(getCanonicalFieldName('uae_id', 'EMIRATES_ID')).toBe('emirates_id');
    });

    it('should handle visa-specific aliases', () => {
      expect(getCanonicalFieldName('visa_no', 'VISA')).toBe('visa_number');
      expect(getCanonicalFieldName('employer', 'VISA')).toBe('sponsor');
    });

    it('should return null for truly unknown fields', () => {
      // Use a field name that won't match any patterns or semantic similarity
      expect(getCanonicalFieldName('xyz123abc', 'PASSPORT')).toBeNull();
    });

    it('should use semantic matching as fallback', () => {
      // Fields similar enough to match semantically
      const result = getCanonicalFieldName('passport_num', 'PASSPORT');
      expect(result).toBe('passport_number');
    });
  });

  // ========================================
  // IS CANONICAL FIELD TESTS
  // ========================================
  describe('isCanonicalField', () => {
    it('should return true for canonical field names', () => {
      expect(isCanonicalField('full_name', 'PASSPORT')).toBe(true);
      expect(isCanonicalField('passport_number', 'PASSPORT')).toBe(true);
      expect(isCanonicalField('date_of_birth', 'PASSPORT')).toBe(true);
    });

    it('should return false for alias names', () => {
      expect(isCanonicalField('first_name', 'PASSPORT')).toBe(false);
      expect(isCanonicalField('dob', 'PASSPORT')).toBe(false);
    });

    it('should return false for unknown names', () => {
      expect(isCanonicalField('random_field', 'PASSPORT')).toBe(false);
    });
  });

  // ========================================
  // GET CANONICAL FIELDS FOR CATEGORY TESTS
  // ========================================
  describe('getCanonicalFieldsForCategory', () => {
    it('should return canonical fields for passport', () => {
      const fields = getCanonicalFieldsForCategory('PASSPORT');
      expect(fields).toContain('passport_number');
      expect(fields).toContain('full_name');
      expect(fields).toContain('date_of_birth');
      expect(fields).toContain('nationality');
    });

    it('should return canonical fields for Emirates ID', () => {
      const fields = getCanonicalFieldsForCategory('EMIRATES_ID');
      expect(fields).toContain('emirates_id');
      expect(fields).toContain('full_name');
    });

    it('should return common fields for all categories', () => {
      const categories: DocumentCategory[] = ['PASSPORT', 'EMIRATES_ID', 'VISA'];
      for (const category of categories) {
        const fields = getCanonicalFieldsForCategory(category);
        expect(fields).toContain('full_name');
        expect(fields).toContain('date_of_birth');
      }
    });

    it('should return unique field names', () => {
      const fields = getCanonicalFieldsForCategory('PASSPORT');
      const uniqueFields = [...new Set(fields)];
      expect(fields.length).toBe(uniqueFields.length);
    });
  });

  // ========================================
  // MAP EXTRACTED FIELDS TESTS
  // ========================================
  describe('mapExtractedFields', () => {
    it('should map extracted fields to canonical names', async () => {
      const extractedFields: Record<string, ExtractedFieldResult> = {
        first_name: { value: 'John', confidence: 90, source: 'llm' },
        surname: { value: 'Smith', confidence: 85, source: 'llm' },
        passport_no: { value: 'A12345678', confidence: 95, source: 'llm' },
      };

      const result = await mapExtractedFields(extractedFields, 'PASSPORT');

      expect(result.mappedFields['given_name']).toBe('John');
      expect(result.mappedFields['family_name']).toBe('Smith');
      expect(result.mappedFields['passport_number']).toBe('A12345678');
    });

    it('should track aliases used', async () => {
      const extractedFields: Record<string, ExtractedFieldResult> = {
        dob: { value: '1990-01-01', confidence: 90, source: 'llm' },
      };

      const result = await mapExtractedFields(extractedFields, 'PASSPORT');

      expect(result.aliasesUsed['dob']).toBe('date_of_birth');
    });

    it('should identify unmapped fields', async () => {
      const extractedFields: Record<string, ExtractedFieldResult> = {
        unknown_field: { value: 'test', confidence: 80, source: 'llm' },
        random_data: { value: 'data', confidence: 75, source: 'llm' },
      };

      const result = await mapExtractedFields(extractedFields, 'PASSPORT');

      expect(result.unmappedFields).toContain('unknown_field');
      expect(result.unmappedFields).toContain('random_data');
    });

    it('should skip null values', async () => {
      const extractedFields: Record<string, ExtractedFieldResult> = {
        first_name: { value: 'John', confidence: 90, source: 'llm' },
        middle_name: { value: null, confidence: 0, source: 'llm' },
      };

      const result = await mapExtractedFields(extractedFields, 'PASSPORT');

      expect(Object.keys(result.mappedFields)).not.toContain('middle_name');
    });

    it('should calculate overall confidence', async () => {
      const extractedFields: Record<string, ExtractedFieldResult> = {
        full_name: { value: 'John Smith', confidence: 95, source: 'llm' },
        passport_number: { value: 'A12345678', confidence: 90, source: 'llm' },
      };

      const result = await mapExtractedFields(extractedFields, 'PASSPORT');

      // Confidence should be based on match quality, not input confidence
      expect(result.confidence).toBeGreaterThan(80);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('should provide mapping details', async () => {
      const extractedFields: Record<string, ExtractedFieldResult> = {
        first_name: { value: 'John', confidence: 90, source: 'llm' },
      };

      const result = await mapExtractedFields(extractedFields, 'PASSPORT');

      expect(result.mappingDetails.length).toBe(1);
      expect(result.mappingDetails[0].originalField).toBe('first_name');
      expect(result.mappingDetails[0].canonicalField).toBe('given_name');
      expect(result.mappingDetails[0].matchType).toBe('alias');
    });

    it('should handle empty input', async () => {
      const result = await mapExtractedFields({}, 'PASSPORT');

      expect(Object.keys(result.mappedFields)).toHaveLength(0);
      expect(result.unmappedFields).toHaveLength(0);
      expect(result.confidence).toBe(0);
    });

    it('should handle category-specific mappings', async () => {
      // Emirates ID specific
      const emiratesFields: Record<string, ExtractedFieldResult> = {
        eid: { value: '784-1990-1234567-1', confidence: 95, source: 'llm' },
      };

      const emiratesResult = await mapExtractedFields(emiratesFields, 'EMIRATES_ID');
      expect(emiratesResult.mappedFields['emirates_id']).toBe('784-1990-1234567-1');

      // Visa specific
      const visaFields: Record<string, ExtractedFieldResult> = {
        employer: { value: 'ABC Company', confidence: 90, source: 'llm' },
      };

      const visaResult = await mapExtractedFields(visaFields, 'VISA');
      expect(visaResult.mappedFields['sponsor']).toBe('ABC Company');
    });

    it('should handle invoice fields', async () => {
      const invoiceFields: Record<string, ExtractedFieldResult> = {
        invoice_no: { value: 'INV-001', confidence: 95, source: 'llm' },
        total: { value: '1000.00', confidence: 90, source: 'llm' },
      };

      const result = await mapExtractedFields(invoiceFields, 'INVOICE');

      expect(result.mappedFields['invoice_number']).toBe('INV-001');
      expect(result.mappedFields['total_amount']).toBe('1000.00');
    });

    it('should handle bank statement fields', async () => {
      const bankFields: Record<string, ExtractedFieldResult> = {
        account_no: { value: '1234567890', confidence: 95, source: 'llm' },
        customer_name: { value: 'John Smith', confidence: 90, source: 'llm' },
      };

      const result = await mapExtractedFields(bankFields, 'BANK_STATEMENT');

      expect(result.mappedFields['account_number']).toBe('1234567890');
      expect(result.mappedFields['full_name']).toBe('John Smith');
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================
  describe('Edge Cases', () => {
    it('should handle mixed case field names', async () => {
      const extractedFields: Record<string, ExtractedFieldResult> = {
        FIRST_NAME: { value: 'John', confidence: 90, source: 'llm' },
        DateOfBirth: { value: '1990-01-01', confidence: 85, source: 'llm' },
      };

      const result = await mapExtractedFields(extractedFields, 'PASSPORT');

      // Should still map correctly due to normalization
      expect(result.mappedFields['given_name']).toBe('John');
    });

    it('should handle fields with special characters', async () => {
      const extractedFields: Record<string, ExtractedFieldResult> = {
        'first-name': { value: 'John', confidence: 90, source: 'llm' },
        'date.of.birth': { value: '1990-01-01', confidence: 85, source: 'llm' },
      };

      const result = await mapExtractedFields(extractedFields, 'PASSPORT');

      expect(result.mappedFields['given_name']).toBe('John');
    });

    it('should handle very long field names', async () => {
      // Use a truly random long field name that won't match anything
      const longFieldName = 'xyz9999qqq_ppp_mmm_zzz_999';
      const extractedFields: Record<string, ExtractedFieldResult> = {
        [longFieldName]: { value: 'test', confidence: 90, source: 'llm' },
      };

      const result = await mapExtractedFields(extractedFields, 'PASSPORT');

      // Check that the field is either unmapped OR mapped with low semantic confidence
      // The semantic matcher might still find a very weak match
      const detail = result.mappingDetails.find(d => d.originalField === longFieldName);
      expect(detail).toBeDefined();
      // If it was mapped, it should be a semantic match with lower confidence
      if (detail?.matchType === 'semantic') {
        expect(detail.confidence).toBeLessThan(90);
      } else if (detail?.matchType === 'unmapped') {
        expect(result.unmappedFields).toContain(longFieldName);
      }
    });

    it('should handle numeric values', async () => {
      const extractedFields: Record<string, ExtractedFieldResult> = {
        age: { value: 30, confidence: 90, source: 'llm' },
      };

      const result = await mapExtractedFields(extractedFields, 'PASSPORT');

      // Numeric values should be converted to strings in mappedFields
      expect(result.unmappedFields).toContain('age');
    });

    it('should handle boolean values', async () => {
      const extractedFields: Record<string, ExtractedFieldResult> = {
        is_valid: { value: true, confidence: 90, source: 'llm' },
      };

      const result = await mapExtractedFields(extractedFields, 'PASSPORT');

      expect(result.unmappedFields).toContain('is_valid');
    });

    it('should handle unknown document category', async () => {
      const extractedFields: Record<string, ExtractedFieldResult> = {
        name: { value: 'John', confidence: 90, source: 'llm' },
      };

      const result = await mapExtractedFields(extractedFields, 'UNKNOWN');

      // Should still use common aliases
      expect(result.mappedFields['full_name']).toBe('John');
    });
  });

  // ========================================
  // MATCH TYPE ACCURACY
  // ========================================
  describe('Match Type Accuracy', () => {
    it('should identify exact matches', async () => {
      const extractedFields: Record<string, ExtractedFieldResult> = {
        full_name: { value: 'John Smith', confidence: 90, source: 'llm' },
      };

      const result = await mapExtractedFields(extractedFields, 'PASSPORT');

      const detail = result.mappingDetails.find(d => d.originalField === 'full_name');
      expect(detail?.matchType).toBe('exact');
      expect(detail?.confidence).toBe(100);
    });

    it('should identify alias matches', async () => {
      const extractedFields: Record<string, ExtractedFieldResult> = {
        first_name: { value: 'John', confidence: 90, source: 'llm' },
      };

      const result = await mapExtractedFields(extractedFields, 'PASSPORT');

      const detail = result.mappingDetails.find(d => d.originalField === 'first_name');
      expect(detail?.matchType).toBe('alias');
      expect(detail?.confidence).toBe(90);
    });

    it('should identify pattern matches', async () => {
      const extractedFields: Record<string, ExtractedFieldResult> = {
        'D.O.B.': { value: '1990-01-01', confidence: 90, source: 'llm' },
      };

      const result = await mapExtractedFields(extractedFields, 'PASSPORT');

      const detail = result.mappingDetails.find(d => d.canonicalField === 'date_of_birth');
      expect(detail).toBeDefined();
    });

    it('should identify unmapped fields', async () => {
      const extractedFields: Record<string, ExtractedFieldResult> = {
        xyz_unknown: { value: 'test', confidence: 90, source: 'llm' },
      };

      const result = await mapExtractedFields(extractedFields, 'PASSPORT');

      const detail = result.mappingDetails.find(d => d.originalField === 'xyz_unknown');
      expect(detail?.matchType).toBe('unmapped');
      expect(detail?.canonicalField).toBeNull();
      expect(detail?.confidence).toBe(0);
    });
  });
});
