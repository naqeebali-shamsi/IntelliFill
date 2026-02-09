/**
 * ExtractedData Types and Utilities Tests
 *
 * Tests for ExtractedFieldResult type guards and transformation utilities.
 *
 * @module types/__tests__/extractedData.test
 */

import {
  ExtractedFieldResult,
  ExtractedDataWithConfidence,
  LegacyExtractedData,
  isExtractedFieldResult,
  isExtractedDataWithConfidence,
  convertLegacyToConfidenceFormat,
  flattenExtractedData,
  normalizeExtractedData,
  calculateAverageConfidence,
  getLowConfidenceFields,
} from '../extractedData';

describe('extractedData utilities', () => {
  // ==========================================================================
  // Type Guards
  // ==========================================================================

  describe('isExtractedFieldResult', () => {
    it('should return true for valid ExtractedFieldResult', () => {
      const validResult: ExtractedFieldResult = {
        value: 'test@example.com',
        confidence: 95,
        source: 'pattern',
      };

      expect(isExtractedFieldResult(validResult)).toBe(true);
    });

    it('should return true for all valid source types', () => {
      const sources: Array<'ocr' | 'pattern' | 'llm'> = ['ocr', 'pattern', 'llm'];

      for (const source of sources) {
        const result = {
          value: 'test',
          confidence: 80,
          source,
        };
        expect(isExtractedFieldResult(result)).toBe(true);
      }
    });

    it('should return true for result with optional rawText', () => {
      const result = {
        value: 'John Doe',
        confidence: 90,
        source: 'ocr' as const,
        rawText: 'John   Doe',
      };

      expect(isExtractedFieldResult(result)).toBe(true);
    });

    it('should return true for null value', () => {
      const result = {
        value: null as string | null,
        confidence: 0,
        source: 'pattern' as const,
      };

      expect(isExtractedFieldResult(result)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isExtractedFieldResult(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isExtractedFieldResult(undefined)).toBe(false);
    });

    it('should return false for primitive values', () => {
      expect(isExtractedFieldResult('string')).toBe(false);
      expect(isExtractedFieldResult(123)).toBe(false);
      expect(isExtractedFieldResult(true)).toBe(false);
    });

    it('should return false for object missing required fields', () => {
      expect(isExtractedFieldResult({ value: 'test' } as unknown)).toBe(false);
      expect(isExtractedFieldResult({ value: 'test', confidence: 80 } as unknown)).toBe(false);
      expect(isExtractedFieldResult({ confidence: 80, source: 'ocr' } as unknown)).toBe(false);
    });

    it('should return false for invalid source type', () => {
      const result = {
        value: 'test',
        confidence: 80,
        source: 'invalid',
      };

      expect(isExtractedFieldResult(result)).toBe(false);
    });

    it('should return false for non-numeric confidence', () => {
      const result = {
        value: 'test',
        confidence: 'high',
        source: 'pattern',
      };

      expect(isExtractedFieldResult(result)).toBe(false);
    });
  });

  describe('isExtractedDataWithConfidence', () => {
    it('should return true for data with confidence format', () => {
      const data: ExtractedDataWithConfidence = {
        email: {
          value: 'test@example.com',
          confidence: 95,
          source: 'pattern',
        },
        name: {
          value: 'John Doe',
          confidence: 85,
          source: 'ocr',
        },
      };

      expect(isExtractedDataWithConfidence(data)).toBe(true);
    });

    it('should return false for empty object', () => {
      expect(isExtractedDataWithConfidence({})).toBe(false);
    });

    it('should return false for null', () => {
      expect(isExtractedDataWithConfidence(null)).toBe(false);
    });

    it('should return false for legacy format', () => {
      const legacyData = {
        email: 'test@example.com',
        name: 'John Doe',
      };

      expect(isExtractedDataWithConfidence(legacyData)).toBe(false);
    });

    it('should return true for mixed format (at least one new format field)', () => {
      const mixedData = {
        email: {
          value: 'test@example.com',
          confidence: 95,
          source: 'pattern' as const,
        },
        name: 'John Doe', // Legacy format
      };

      expect(isExtractedDataWithConfidence(mixedData)).toBe(true);
    });
  });

  // ==========================================================================
  // Transformation Functions
  // ==========================================================================

  describe('convertLegacyToConfidenceFormat', () => {
    it('should convert legacy format to confidence format', () => {
      const legacy: LegacyExtractedData = {
        email: 'test@example.com',
        name: 'John Doe',
        age: 30,
        active: true,
      };

      const result = convertLegacyToConfidenceFormat(legacy);

      expect(result.email).toEqual({
        value: 'test@example.com',
        confidence: 0,
        source: 'pattern',
        rawText: 'test@example.com',
      });

      expect(result.name).toEqual({
        value: 'John Doe',
        confidence: 0,
        source: 'pattern',
        rawText: 'John Doe',
      });

      expect(result.age).toEqual({
        value: 30,
        confidence: 0,
        source: 'pattern',
        rawText: undefined,
      });

      expect(result.active).toEqual({
        value: true,
        confidence: 0,
        source: 'pattern',
        rawText: undefined,
      });
    });

    it('should use custom default confidence and source', () => {
      const legacy: LegacyExtractedData = {
        email: 'test@example.com',
      };

      const result = convertLegacyToConfidenceFormat(legacy, 50, 'ocr');

      expect(result.email).toEqual({
        value: 'test@example.com',
        confidence: 50,
        source: 'ocr',
        rawText: 'test@example.com',
      });
    });

    it('should skip null values', () => {
      const legacy: LegacyExtractedData = {
        email: 'test@example.com',
        phone: null,
      };

      const result = convertLegacyToConfidenceFormat(legacy);

      expect(result.email).toBeDefined();
      expect(result.phone).toBeUndefined();
    });

    it('should handle arrays by taking first value', () => {
      const legacy: LegacyExtractedData = {
        emails: ['first@example.com', 'second@example.com'],
      };

      const result = convertLegacyToConfidenceFormat(legacy);

      expect(result.emails.value).toBe('first@example.com');
    });

    it('should handle empty arrays', () => {
      const legacy: LegacyExtractedData = {
        emails: [],
      };

      const result = convertLegacyToConfidenceFormat(legacy);

      expect(result.emails.value).toBeNull();
    });
  });

  describe('flattenExtractedData', () => {
    it('should flatten confidence format to simple values', () => {
      const data: ExtractedDataWithConfidence = {
        email: {
          value: 'test@example.com',
          confidence: 95,
          source: 'pattern',
        },
        name: {
          value: 'John Doe',
          confidence: 85,
          source: 'ocr',
        },
      };

      const result = flattenExtractedData(data);

      expect(result).toEqual({
        email: 'test@example.com',
        name: 'John Doe',
      });
    });

    it('should handle null input', () => {
      expect(flattenExtractedData(null)).toBeNull();
    });

    it('should pass through legacy format', () => {
      const legacy = {
        email: 'test@example.com',
        name: 'John Doe',
      };

      const result = flattenExtractedData(legacy);

      expect(result).toEqual({
        email: 'test@example.com',
        name: 'John Doe',
      });
    });

    it('should handle arrays in legacy format', () => {
      const legacy = {
        emails: ['first@example.com', 'second@example.com'],
      };

      const result = flattenExtractedData(legacy);

      expect(result).toEqual({
        emails: 'first@example.com',
      });
    });
  });

  describe('normalizeExtractedData', () => {
    it('should pass through already-normalized data', () => {
      const data: ExtractedDataWithConfidence = {
        email: {
          value: 'test@example.com',
          confidence: 95,
          source: 'pattern',
        },
      };

      const result = normalizeExtractedData(data);

      expect(result).toBe(data); // Same reference
    });

    it('should convert legacy format', () => {
      const legacy = {
        email: 'test@example.com',
      };

      const result = normalizeExtractedData(legacy);

      expect(isExtractedDataWithConfidence(result)).toBe(true);
      expect(result?.email.value).toBe('test@example.com');
    });

    it('should handle null input', () => {
      expect(normalizeExtractedData(null)).toBeNull();
    });

    it('should use custom defaults for legacy conversion', () => {
      const legacy = {
        email: 'test@example.com',
      };

      const result = normalizeExtractedData(legacy, 75, 'llm');

      expect(result?.email).toEqual({
        value: 'test@example.com',
        confidence: 75,
        source: 'llm',
        rawText: 'test@example.com',
      });
    });
  });

  // ==========================================================================
  // Analytics Functions
  // ==========================================================================

  describe('calculateAverageConfidence', () => {
    it('should calculate average confidence', () => {
      const data: ExtractedDataWithConfidence = {
        email: { value: 'test@example.com', confidence: 90, source: 'pattern' },
        name: { value: 'John', confidence: 80, source: 'ocr' },
        phone: { value: '123-456-7890', confidence: 70, source: 'pattern' },
      };

      const avg = calculateAverageConfidence(data);

      expect(avg).toBe(80); // (90 + 80 + 70) / 3 = 80
    });

    it('should return 0 for null input', () => {
      expect(calculateAverageConfidence(null)).toBe(0);
    });

    it('should return 0 for empty object', () => {
      expect(calculateAverageConfidence({})).toBe(0);
    });

    it('should round to nearest integer', () => {
      const data: ExtractedDataWithConfidence = {
        a: { value: 'x', confidence: 33, source: 'pattern' },
        b: { value: 'y', confidence: 33, source: 'pattern' },
        c: { value: 'z', confidence: 34, source: 'pattern' },
      };

      const avg = calculateAverageConfidence(data);

      expect(avg).toBe(33); // (33 + 33 + 34) / 3 = 33.33... rounds to 33
    });
  });

  describe('getLowConfidenceFields', () => {
    it('should return fields below threshold', () => {
      const data: ExtractedDataWithConfidence = {
        email: { value: 'test@example.com', confidence: 90, source: 'pattern' },
        name: { value: 'John', confidence: 60, source: 'ocr' },
        phone: { value: '123-456-7890', confidence: 50, source: 'pattern' },
      };

      const lowFields = getLowConfidenceFields(data, 70);

      expect(lowFields).toEqual(['name', 'phone']);
    });

    it('should use default threshold of 70', () => {
      const data: ExtractedDataWithConfidence = {
        email: { value: 'test@example.com', confidence: 69, source: 'pattern' },
        name: { value: 'John', confidence: 70, source: 'ocr' },
      };

      const lowFields = getLowConfidenceFields(data);

      expect(lowFields).toEqual(['email']);
    });

    it('should return empty array for null input', () => {
      expect(getLowConfidenceFields(null)).toEqual([]);
    });

    it('should return empty array when all fields meet threshold', () => {
      const data: ExtractedDataWithConfidence = {
        email: { value: 'test@example.com', confidence: 90, source: 'pattern' },
        name: { value: 'John', confidence: 85, source: 'ocr' },
      };

      const lowFields = getLowConfidenceFields(data, 70);

      expect(lowFields).toEqual([]);
    });
  });
});
