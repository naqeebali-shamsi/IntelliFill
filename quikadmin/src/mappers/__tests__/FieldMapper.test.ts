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

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
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
          currencies: [],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
        },
      };

      const formFields = [
        'First Name',
        'first-name',
        'first_name',
      ];

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
          currencies: [],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
        },
      };

      const formFields = [
        'First Name',
        'first-name',
        'Last Name',
        'last-name',
      ];

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
          currencies: [],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
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
          currencies: [],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
        },
      };

      const formFields = [
        'E-mail',
        'e.mail',
        'e_mail',
        'e mail',
      ];

      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('E-mail');
      expect(result.warnings[0]).toContain('e.mail');
      expect(result.warnings[0]).toContain('e_mail');
      expect(result.warnings[0]).toContain('e mail');
    });

    it('should log warnings for duplicate normalized fields', async () => {
      const { logger } = require('../../utils/logger');

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
          currencies: [],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
        },
      };

      const formFields = ['Phone Number', 'phone-number', 'phone_number'];

      await mapper.mapFields(extractedData, formFields);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Duplicate normalized field detected')
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
          currencies: [],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
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
          currencies: [],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
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
          currencies: [],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
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
          currencies: [],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
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
          currencies: [],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
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
          currencies: [],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
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
          currencies: ['$100.00'],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
        },
      };

      const formFields = [
        'email',
        'phone',
        'name',
        'date',
        'address',
        'amount',
      ];

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
          currencies: [],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
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
          currencies: [],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
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
          currencies: [],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
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
          currencies: [],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
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
          currencies: [],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
        },
      };

      const formFields = [
        'First Name',
        'first-name',
        'Last Name',
        'last-name',
      ];

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
          currencies: [],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
        },
      };

      const formFields = ['email', 'phone'];
      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.warnings).toHaveLength(0);
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
          currencies: [],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
        },
      };

      const formFields = [
        'First Name',
        'first-name',
        'lastName',
        'email',
        'phone_number',
      ];

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
          currencies: [],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
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
          currencies: [],
        },
        metadata: {
          confidence: 0.9,
          processingTime: 100,
        },
      };

      const formFields = ['firstName', 'lastName', 'email'];
      const result = await mapper.mapFields(extractedData, formFields);

      expect(result.mappings).toHaveLength(0);
      expect(result.unmappedFormFields).toEqual(formFields);
    });
  });
});
