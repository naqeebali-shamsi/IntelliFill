/**
 * FieldMapper Tests
 *
 * Comprehensive unit tests covering:
 * - Duplicate field detection and warning generation
 * - Field normalization
 * - Field mapping logic
 * - Confidence scoring
 */

import { FieldMapper, MappingResult, FieldMapping } from '../FieldMapper';
import { ExtractedData } from '../../extractors/DataExtractor';

// Mock piiSafeLogger (used by FieldMapper)
jest.mock('../../utils/piiSafeLogger', () => ({
  piiSafeLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('FieldMapper', () => {
  let mapper: FieldMapper;

  beforeEach(() => {
    mapper = new FieldMapper();
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Duplicate Field Detection Tests
  // ==========================================================================

  describe('Duplicate Field Detection', () => {
    it('should detect when multiple fields normalize to same key', async () => {
      const extractedData: ExtractedData = {
        fields: {
          firstName: 'John',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['First Name', 'first-name', 'first_name'];

      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("normalize to 'first_name'");
      expect(result.warnings[0]).toContain('First Name');
      expect(result.warnings[0]).toContain('first-name');
      expect(result.warnings[0]).toContain('first_name');
      expect(result.warnings[0]).toContain('all will receive same value');
    });

    it('should warn about all duplicates when multiple sets exist', async () => {
      const extractedData: ExtractedData = {
        fields: {
          firstName: 'John',
          lastName: 'Doe',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['First Name', 'first-name', 'Last Name', 'last-name'];

      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.warnings.length).toBeGreaterThanOrEqual(2);
      expect(result.warnings.some((w) => w.includes('first_name'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('last_name'))).toBe(true);
    });

    it('should not warn when fields normalize to different keys', async () => {
      const extractedData: ExtractedData = {
        fields: {
          firstName: 'John',
          lastName: 'Doe',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['firstName', 'lastName', 'email'];

      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.warnings).toHaveLength(0);
    });

    it('should handle three or more fields normalizing to same key', async () => {
      const extractedData: ExtractedData = {
        fields: {
          email: 'test@example.com',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['E-mail', 'e.mail', 'e_mail', 'e mail'];

      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('E-mail');
      expect(result.warnings[0]).toContain('e.mail');
      expect(result.warnings[0]).toContain('e_mail');
      expect(result.warnings[0]).toContain('e mail');
    });

    it('should log warnings for duplicate normalized fields', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { piiSafeLogger } = require('../../utils/piiSafeLogger');

      const extractedData: ExtractedData = {
        fields: {
          phone: '555-1234',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['Phone Number', 'phone-number', 'phone_number'];

      await mapper.mapFields(extractedData, formFields);

      expect(piiSafeLogger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/Duplicate normalized field detected/)
      );
    });

    it('should still map all duplicate fields to same value', async () => {
      const extractedData: ExtractedData = {
        fields: {
          email: 'test@example.com',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['E-mail', 'e.mail', 'email'];

      const result = await mapper.mapFields(extractedData, formFields);

      // All three fields should get mapped to the email value
      const emailMappings = result.mappings.filter((m) =>
        ['E-mail', 'e.mail', 'email'].includes(m.formField)
      );

      expect(emailMappings.length).toBe(3);
      emailMappings.forEach((mapping) => {
        expect(mapping.value).toBe('test@example.com');
      });
    });
  });

  // ==========================================================================
  // Field Normalization Tests
  // ==========================================================================

  describe('Field Normalization', () => {
    it('should normalize field names to lowercase with underscores', async () => {
      const extractedData: ExtractedData = {
        fields: {
          first_name: 'John',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['First Name'];
      const result = await mapper.mapFields(extractedData, formFields);

      // Should match because both normalize to 'first_name'
      expect(result.mappings.length).toBeGreaterThan(0);
    });

    it('should handle special characters in field names', async () => {
      const extractedData: ExtractedData = {
        fields: {
          email_address: 'test@example.com',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['E-mail@Address!'];
      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.mappings.length).toBeGreaterThan(0);
      expect(result.mappings[0].formField).toBe('E-mail@Address!');
    });

    it('should remove consecutive underscores', async () => {
      const extractedData: ExtractedData = {
        fields: {
          user_name: 'johndoe',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['User___Name'];
      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.mappings.length).toBeGreaterThan(0);
    });

    it('should trim leading and trailing underscores', async () => {
      const extractedData: ExtractedData = {
        fields: {
          name: 'Test',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['___name___'];
      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.mappings.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Field Mapping Tests
  // ==========================================================================

  describe('Field Mapping', () => {
    it('should map direct field matches with high confidence', async () => {
      const extractedData: ExtractedData = {
        fields: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['firstName', 'lastName', 'email'];
      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.mappings).toHaveLength(3);
      expect(result.mappings[0].value).toBe('John');
      expect(result.mappings[1].value).toBe('Doe');
      expect(result.mappings[2].value).toBe('john@example.com');
    });

    it('should map entity fields correctly', async () => {
      const extractedData: ExtractedData = {
        fields: {},
        entities: {
          emails: ['test@example.com'],
          phones: ['+1-555-1234'],
          names: ['John Doe'],
          dates: ['2024-01-01'],
          addresses: ['123 Main St'],
          numbers: [],
          currencies: ['$100.00'],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['email', 'phone', 'name', 'date', 'address', 'amount'];

      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.mappings.length).toBeGreaterThan(0);

      const emailMapping = result.mappings.find((m) => m.formField === 'email');
      expect(emailMapping?.value).toBe('test@example.com');
      expect(emailMapping?.mappingMethod).toBe('Entity Pattern Match');
    });

    it('should skip fields below confidence threshold', async () => {
      const extractedData: ExtractedData = {
        fields: {
          veryDifferentField: 'value',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['completelyUnrelated'];
      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.mappings.length).toBe(0);
      expect(result.unmappedFormFields).toContain('completelyUnrelated');
    });

    it('should calculate overall confidence correctly', async () => {
      const extractedData: ExtractedData = {
        fields: {
          firstName: 'John',
          lastName: 'Doe',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['firstName', 'lastName'];
      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.overallConfidence).toBeGreaterThan(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
    });

    it('should return 0 confidence when no mappings found', async () => {
      const extractedData: ExtractedData = {
        fields: {},
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['nonExistentField'];
      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.overallConfidence).toBe(0);
    });
  });

  // ==========================================================================
  // Warning Array Tests
  // ==========================================================================

  describe('Warnings Array', () => {
    it('should initialize warnings as empty array', async () => {
      const extractedData: ExtractedData = {
        fields: {
          email: 'test@example.com',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['email'];
      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should accumulate multiple warnings', async () => {
      const extractedData: ExtractedData = {
        fields: {
          firstName: 'John',
          lastName: 'Doe',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['First Name', 'first-name', 'Last Name', 'last-name'];

      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.warnings.length).toBeGreaterThan(1);
    });

    it('should not add warnings for unique normalized fields', async () => {
      const extractedData: ExtractedData = {
        fields: {
          email: 'test@example.com',
          phone: '555-1234',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['email', 'phone'];
      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.warnings).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Edge Case Tests: Fuzzy Matching (Levenshtein Distance)
  // ==========================================================================

  describe('Fuzzy Matching Edge Cases', () => {
    it('should match "Passport No." to "Passport Number" using fuzzy matching', async () => {
      const extractedData: ExtractedData = {
        fields: {
          passport_number: 'AB1234567',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['Passport No.'];
      const result = await mapper.mapFields(extractedData, formFields);

      // Should match due to Levenshtein similarity
      const passportMapping = result.mappings.find((m) => m.formField === 'Passport No.');
      expect(passportMapping).toBeDefined();
      expect(passportMapping?.value).toBe('AB1234567');
    });

    it('should match "DOB" to "date_of_birth" using entity pattern matching', async () => {
      const extractedData: ExtractedData = {
        fields: {
          date_of_birth: '15/06/1990',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: ['15/06/1990'],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['DOB'];
      const result = await mapper.mapFields(extractedData, formFields);

      // Should match via entity pattern (dob -> date)
      const dobMapping = result.mappings.find((m) => m.formField === 'DOB');
      expect(dobMapping).toBeDefined();
    });

    it('should match "Date of Birth" to date entities', async () => {
      const extractedData: ExtractedData = {
        fields: {},
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: ['1990-06-15'],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['Date of Birth'];
      const result = await mapper.mapFields(extractedData, formFields);

      const dateMapping = result.mappings.find((m) => m.formField === 'Date of Birth');
      expect(dateMapping).toBeDefined();
      expect(dateMapping?.value).toBe('1990-06-15');
      expect(dateMapping?.mappingMethod).toBe('Entity Pattern Match');
    });

    it('should match "Emirates ID" or "EID" to emirates_id field', async () => {
      const extractedData: ExtractedData = {
        fields: {
          emirates_id: '784-1990-1234567-1',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['Emirates ID', 'EID'];
      const result = await mapper.mapFields(extractedData, formFields);

      // At least one should match
      const hasMatch = result.mappings.some((m) =>
        ['Emirates ID', 'EID'].includes(m.formField) && m.value === '784-1990-1234567-1'
      );
      expect(hasMatch).toBe(true);
    });

    it('should handle abbreviations in field names', async () => {
      const extractedData: ExtractedData = {
        fields: {
          telephone_number: '+1-555-1234',
          social_security_number: '123-45-6789',
        },
        entities: {
          emails: [],
          phones: ['+1-555-1234'],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['Tel No.', 'SSN'];
      const result = await mapper.mapFields(extractedData, formFields);

      // Tel No. should match via phone entity
      const telMapping = result.mappings.find((m) => m.formField === 'Tel No.');
      expect(telMapping).toBeDefined();
    });
  });

  // ==========================================================================
  // Edge Case Tests: Extremely Long Field Names
  // ==========================================================================

  describe('Extremely Long Field Names', () => {
    it('should handle field names longer than 255 characters', async () => {
      const longFieldName = 'a'.repeat(300);
      const extractedData: ExtractedData = {
        fields: {
          [longFieldName]: 'value',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = [longFieldName];
      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.mappings.length).toBe(1);
      expect(result.mappings[0].value).toBe('value');
    });

    it('should normalize very long field names correctly', async () => {
      const longFieldName = 'This Is A Very Long Field Name That Exceeds Normal Limits '.repeat(5);
      const normalizedLong = longFieldName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

      const extractedData: ExtractedData = {
        fields: {
          [normalizedLong]: 'test-value',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = [longFieldName];
      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.mappings.length).toBe(1);
    });
  });

  // ==========================================================================
  // Edge Case Tests: Special Character Field Names
  // ==========================================================================

  describe('Field Names with Only Special Characters', () => {
    it('should handle field names with only special characters', async () => {
      const extractedData: ExtractedData = {
        fields: {
          data: 'value',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      // Field name with only special chars normalizes to empty string
      const formFields = ['!@#$%^&*()'];
      const result = await mapper.mapFields(extractedData, formFields);

      // Should not crash, field should be in unmapped
      expect(result.unmappedFormFields).toContain('!@#$%^&*()');
    });

    it('should handle emoji-only field names', async () => {
      const extractedData: ExtractedData = {
        fields: {},
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['📧', '📞', '🏠'];
      const result = await mapper.mapFields(extractedData, formFields);

      // Should not crash
      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.unmappedFormFields)).toBe(true);
    });

    it('should handle mixed special characters and letters', async () => {
      const extractedData: ExtractedData = {
        fields: {
          user_email: 'test@example.com',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['***User---Email!!!'];
      const result = await mapper.mapFields(extractedData, formFields);

      // Should normalize to user_email and match
      const mapping = result.mappings.find((m) => m.formField === '***User---Email!!!');
      expect(mapping).toBeDefined();
      expect(mapping?.value).toBe('test@example.com');
    });
  });

  // ==========================================================================
  // Edge Case Tests: Entity Array Edge Cases
  // ==========================================================================

  describe('Entity Array Edge Cases', () => {
    it('should handle undefined entities array gracefully', async () => {
      const extractedData: ExtractedData = {
        fields: {
          email: 'test@example.com',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      // Simulate undefined entities by setting them to empty
      (extractedData.entities as any).customField = undefined;

      const formFields = ['email', 'customField'];
      const result = await mapper.mapFields(extractedData, formFields);

      // Should not crash
      expect(result.mappings.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty entity arrays', async () => {
      const extractedData: ExtractedData = {
        fields: {},
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['email', 'phone', 'name', 'date', 'address'];
      const result = await mapper.mapFields(extractedData, formFields);

      // All should be unmapped since entities are empty
      expect(result.unmappedFormFields.length).toBe(5);
    });

    it('should select first entity when multiple exist', async () => {
      const extractedData: ExtractedData = {
        fields: {},
        entities: {
          emails: ['first@example.com', 'second@example.com', 'third@example.com'],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['email'];
      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.mappings[0].value).toBe('first@example.com');
    });
  });

  // ==========================================================================
  // Edge Case Tests: Type Validation
  // ==========================================================================

  describe('Type Validation Edge Cases', () => {
    it('should handle non-string values in fields', async () => {
      const extractedData: ExtractedData = {
        fields: {
          count: 42,
          active: true,
          data: null,
          nested: { key: 'value' },
          items: [1, 2, 3],
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['count', 'active', 'data', 'nested', 'items'];
      const result = await mapper.mapFields(extractedData, formFields);

      // Should map all fields without crashing
      expect(result.mappings.length).toBeGreaterThanOrEqual(3);

      const countMapping = result.mappings.find((m) => m.formField === 'count');
      expect(countMapping?.value).toBe(42);

      const activeMapping = result.mappings.find((m) => m.formField === 'active');
      expect(activeMapping?.value).toBe(true);
    });

    it('should handle Date objects in fields', async () => {
      const dateValue = new Date('2024-01-15');
      const extractedData: ExtractedData = {
        fields: {
          created_at: dateValue,
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['created_at'];
      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.mappings.length).toBe(1);
      expect(result.mappings[0].value).toEqual(dateValue);
    });

    it('should handle undefined field values', async () => {
      const extractedData: ExtractedData = {
        fields: {
          defined: 'value',
          undefined_field: undefined,
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['defined', 'undefined_field'];
      const result = await mapper.mapFields(extractedData, formFields);

      // Should handle undefined gracefully
      expect(result.mappings.some((m) => m.formField === 'defined')).toBe(true);
    });

    it('should validate email format and boost confidence', async () => {
      const extractedData: ExtractedData = {
        fields: {
          email: 'valid@example.com',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['email'];
      const result = await mapper.mapFields(extractedData, formFields);

      // Email matching should have boosted confidence
      const emailMapping = result.mappings.find((m) => m.formField === 'email');
      expect(emailMapping).toBeDefined();
      expect(emailMapping!.confidence).toBeGreaterThan(0.9);
    });

    it('should validate phone format and boost confidence', async () => {
      const extractedData: ExtractedData = {
        fields: {
          phone: '+1-555-123-4567',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['phone'];
      const result = await mapper.mapFields(extractedData, formFields);

      const phoneMapping = result.mappings.find((m) => m.formField === 'phone');
      expect(phoneMapping).toBeDefined();
      expect(phoneMapping!.confidence).toBeGreaterThan(0.9);
    });
  });

  // ==========================================================================
  // Edge Case Tests: Unicode Field Names
  // ==========================================================================

  describe('Unicode Field Names', () => {
    it('should handle Arabic field names', async () => {
      const extractedData: ExtractedData = {
        fields: {
          name: 'محمد',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['الاسم', 'name'];
      const result = await mapper.mapFields(extractedData, formFields);

      // Should match 'name' field
      expect(result.mappings.some((m) => m.value === 'محمد')).toBe(true);
    });

    it('should handle Japanese field names', async () => {
      const extractedData: ExtractedData = {
        fields: {
          '名前': '山田太郎',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['名前'];
      const result = await mapper.mapFields(extractedData, formFields);

      // Should match directly
      expect(result.mappings.length).toBe(1);
      expect(result.mappings[0].value).toBe('山田太郎');
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration Tests', () => {
    it('should handle complex mapping scenario with duplicates', async () => {
      const extractedData: ExtractedData = {
        fields: {
          first_name: 'John',
          last_name: 'Doe',
        },
        entities: {
          emails: ['john@example.com'],
          phones: ['+1-555-1234'],
          names: ['John Doe'],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['First Name', 'first-name', 'lastName', 'email', 'phone_number'];

      const result = await mapper.mapFields(extractedData, formFields);

      // Should have warnings for first name duplicates
      expect(result.warnings.length).toBeGreaterThan(0);

      // Should have mappings
      expect(result.mappings.length).toBeGreaterThan(0);

      // Should identify unmapped fields
      expect(result.unmappedFormFields).toBeDefined();
      expect(result.unmappedDataFields).toBeDefined();
    });

    it('should handle empty form fields array', async () => {
      const extractedData: ExtractedData = {
        fields: {
          firstName: 'John',
        },
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields: string[] = [];
      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.mappings).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.unmappedFormFields).toHaveLength(0);
    });

    it('should handle empty extracted data', async () => {
      const extractedData: ExtractedData = {
        fields: {},
        entities: {
          emails: [],
          phones: [],
          names: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'test',
          confidence: 0.9,
          timestamp: new Date(),
        },
      };

      const formFields = ['firstName', 'lastName', 'email'];
      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.mappings).toHaveLength(0);
      expect(result.unmappedFormFields).toEqual(formFields);
    });
  });
});
