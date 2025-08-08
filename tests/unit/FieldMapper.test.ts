import { describe, it, expect, beforeEach } from 'vitest';
import { FieldMapper } from '../../src/mappers/FieldMapper';
import { ExtractedData } from '../../src/extractors/DataExtractor';

describe('FieldMapper', () => {
  let fieldMapper: FieldMapper;
  let mockExtractedData: ExtractedData;

  beforeEach(() => {
    fieldMapper = new FieldMapper();
    mockExtractedData = {
      fields: {
        full_name: 'John Doe',
        email_address: 'john.doe@example.com',
        phone_number: '+1-555-123-4567',
        date_of_birth: '01/15/1990',
        street_address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        social_security_number: '123-45-6789'
      },
      entities: {
        names: ['John Doe', 'Jane Smith'],
        emails: ['john.doe@example.com', 'jane@example.com'],
        phones: ['+1-555-123-4567', '555-987-6543'],
        dates: ['01/15/1990', '12/31/2023'],
        addresses: ['123 Main St', '456 Oak Avenue'],
        numbers: ['10001', '123', '456'],
        currencies: ['$1,500.00', '$250.50']
      },
      metadata: {
        extractionMethod: 'Pattern Matching',
        confidence: 85,
        timestamp: new Date()
      }
    };
  });

  describe('mapFields', () => {
    it('should map exact field matches with high confidence', async () => {
      const formFields = ['full_name', 'email_address', 'phone_number'];
      const result = await fieldMapper.mapFields(mockExtractedData, formFields);

      expect(result.mappings).toHaveLength(3);
      expect(result.mappings[0].formField).toBe('full_name');
      expect(result.mappings[0].value).toBe('John Doe');
      expect(result.mappings[0].confidence).toBeGreaterThan(0.9);
    });

    it('should map similar field names', async () => {
      const formFields = ['name', 'email', 'phone'];
      const result = await fieldMapper.mapFields(mockExtractedData, formFields);

      expect(result.mappings.length).toBeGreaterThan(0);
      const nameMapping = result.mappings.find(m => m.formField === 'name');
      expect(nameMapping).toBeDefined();
      expect(nameMapping?.dataSource).toContain('name');
    });

    it('should use entity matching for common field types', async () => {
      const formFields = ['applicant_email', 'contact_phone', 'birth_date'];
      const result = await fieldMapper.mapFields(mockExtractedData, formFields);

      const emailMapping = result.mappings.find(m => m.formField === 'applicant_email');
      expect(emailMapping).toBeDefined();
      expect(emailMapping?.value).toBe('john.doe@example.com');
      expect(emailMapping?.mappingMethod).toBe('Entity Pattern Match');
    });

    it('should identify unmapped fields', async () => {
      const formFields = ['unknown_field_1', 'unknown_field_2', 'full_name'];
      const result = await fieldMapper.mapFields(mockExtractedData, formFields);

      expect(result.unmappedFormFields).toContain('unknown_field_1');
      expect(result.unmappedFormFields).toContain('unknown_field_2');
      expect(result.unmappedFormFields).not.toContain('full_name');
    });

    it('should calculate overall confidence correctly', async () => {
      const formFields = ['full_name', 'email_address'];
      const result = await fieldMapper.mapFields(mockExtractedData, formFields);

      expect(result.overallConfidence).toBeGreaterThan(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
    });

    it('should handle empty extracted data gracefully', async () => {
      const emptyData: ExtractedData = {
        fields: {},
        entities: {
          names: [],
          emails: [],
          phones: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: []
        },
        metadata: {
          extractionMethod: 'None',
          confidence: 0,
          timestamp: new Date()
        }
      };

      const formFields = ['name', 'email'];
      const result = await fieldMapper.mapFields(emptyData, formFields);

      expect(result.mappings).toHaveLength(0);
      expect(result.unmappedFormFields).toEqual(formFields);
      expect(result.overallConfidence).toBe(0);
    });

    it('should apply type validation boost for matching data types', async () => {
      const formFields = ['user_email', 'phone_number', 'zip_code'];
      const result = await fieldMapper.mapFields(mockExtractedData, formFields);

      const emailMapping = result.mappings.find(m => m.formField === 'user_email');
      const phoneMapping = result.mappings.find(m => m.formField === 'phone_number');
      const zipMapping = result.mappings.find(m => m.formField === 'zip_code');

      // Type validation should boost confidence for correctly formatted values
      expect(emailMapping?.confidence).toBeGreaterThan(0.5);
      expect(phoneMapping?.confidence).toBeGreaterThan(0.5);
      expect(zipMapping?.confidence).toBeGreaterThan(0.5);
    });

    it('should respect minimum confidence threshold', async () => {
      const formFields = ['very_different_field_name_that_wont_match'];
      const result = await fieldMapper.mapFields(mockExtractedData, formFields);

      // Low confidence matches should be filtered out
      result.mappings.forEach(mapping => {
        expect(mapping.confidence).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('should handle special characters in field names', async () => {
      const specialData: ExtractedData = {
        ...mockExtractedData,
        fields: {
          'user-name': 'John Doe',
          'e_mail_address': 'john@example.com',
          'phone.number': '555-1234'
        }
      };

      const formFields = ['user_name', 'email_address', 'phone_number'];
      const result = await fieldMapper.mapFields(specialData, formFields);

      expect(result.mappings.length).toBeGreaterThan(0);
    });

    it('should prioritize direct field matches over entity matches', async () => {
      const dataWithConflict: ExtractedData = {
        ...mockExtractedData,
        fields: {
          email: 'direct@example.com'
        },
        entities: {
          ...mockExtractedData.entities,
          emails: ['entity@example.com']
        }
      };

      const formFields = ['email'];
      const result = await fieldMapper.mapFields(dataWithConflict, formFields);

      const emailMapping = result.mappings.find(m => m.formField === 'email');
      expect(emailMapping?.value).toBe('direct@example.com');
      expect(emailMapping?.mappingMethod).toBe('Direct Field Match');
    });
  });

  describe('performance', () => {
    it('should handle large datasets efficiently', async () => {
      // Create a large dataset
      const largeData: ExtractedData = {
        fields: {},
        entities: mockExtractedData.entities,
        metadata: mockExtractedData.metadata
      };

      // Add 1000 fields
      for (let i = 0; i < 1000; i++) {
        largeData.fields[`field_${i}`] = `value_${i}`;
      }

      const formFields = Array.from({ length: 100 }, (_, i) => `field_${i * 10}`);

      const startTime = Date.now();
      const result = await fieldMapper.mapFields(largeData, formFields);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.mappings.length).toBeGreaterThan(0);
    });
  });
});