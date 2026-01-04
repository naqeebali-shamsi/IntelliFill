/**
 * IntelliFillService Unit Tests
 *
 * Tests for the IntelliFillService class covering:
 * - Orchestration flow (form filling from documents)
 * - Template selection and profile-to-form field mapping
 * - Error handling for missing templates and parse failures
 * - Partial data mapping warnings
 * - Confidence threshold handling and aggregation
 * - Missing fields handling
 * - Batch processing
 * - Document validation
 *
 * @module services/__tests__/IntelliFillService.test
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

// Mock fs/promises
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  stat: jest.fn(),
}));

// Mock pdf-lib
jest.mock('pdf-lib', () => ({
  PDFDocument: {
    load: jest.fn(),
    create: jest.fn(),
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock piiSafeLogger
jest.mock('../../utils/piiSafeLogger', () => ({
  piiSafeLogger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock pdf-parse
jest.mock('pdf-parse', () => jest.fn().mockResolvedValue({ text: '', numpages: 1 }));

// Mock mammoth
jest.mock('mammoth', () => ({
  extractRawText: jest.fn().mockResolvedValue({ value: '', messages: [] }),
}));

// Mock csv-parse
jest.mock('csv-parse/sync', () => ({
  parse: jest.fn().mockReturnValue([]),
}));

// Import after mocks
import { IntelliFillService, ProcessingResult } from '../IntelliFillService';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';

describe('IntelliFillService', () => {
  let service: IntelliFillService;

  // Sample data for tests
  const mockParsedDocument = {
    type: 'pdf' as const,
    content: 'Name: John Doe\nEmail: john@example.com',
    metadata: {
      pageCount: 1,
      title: 'Test Document',
    },
  };

  const mockExtractedData = {
    fields: {
      name: 'John Doe',
      email: 'john@example.com',
    },
    entities: {
      names: ['John Doe'],
      emails: ['john@example.com'],
      phones: ['555-1234'],
      dates: ['01/15/2025'],
      addresses: ['123 Main St'],
      numbers: ['42'],
      currencies: ['$100.00'],
    },
    metadata: {
      extractionMethod: 'Pattern Matching',
      confidence: 85,
      timestamp: new Date(),
    },
  };

  const mockMappingResult = {
    mappings: [
      {
        formField: 'full_name',
        dataSource: 'name',
        value: 'John Doe',
        confidence: 0.95,
        mappingMethod: 'Direct Field Match',
      },
      {
        formField: 'email_address',
        dataSource: 'email',
        value: 'john@example.com',
        confidence: 0.9,
        mappingMethod: 'Entity Pattern Match',
      },
    ],
    unmappedFormFields: ['phone_number'],
    unmappedDataFields: [] as string[],
    overallConfidence: 0.925,
    warnings: [] as string[],
  };

  const mockFillResult = {
    success: true,
    filledFields: ['full_name', 'email_address'],
    failedFields: [] as Array<{ field: string; reason: string }>,
    outputPath: '/output/filled.pdf',
    warnings: [] as string[],
  };

  // Mock dependencies
  let mockDocumentParser: { parse: jest.Mock };
  let mockDataExtractor: { extract: jest.Mock };
  let mockFieldMapper: { mapFields: jest.Mock };
  let mockFormFiller: { fillPDFForm: jest.Mock };
  let mockValidationService: { validateData: jest.Mock };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockDocumentParser = { parse: jest.fn().mockResolvedValue(mockParsedDocument) };
    mockDataExtractor = { extract: jest.fn().mockResolvedValue(mockExtractedData) };
    mockFieldMapper = { mapFields: jest.fn().mockResolvedValue(mockMappingResult) };
    mockFormFiller = { fillPDFForm: jest.fn().mockResolvedValue(mockFillResult) };
    mockValidationService = {
      validateData: jest.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] }),
    };

    // Mock PDFDocument for extractFormFields
    const mockPdfDoc = {
      getForm: jest.fn().mockReturnValue({
        getFields: jest
          .fn()
          .mockReturnValue([
            { getName: () => 'full_name' },
            { getName: () => 'email_address' },
            { getName: () => 'phone_number' },
          ]),
        getField: jest.fn().mockReturnValue({ setText: jest.fn() }),
        getTextField: jest.fn().mockReturnValue({ setText: jest.fn() }),
        flatten: jest.fn(),
      }),
      getPageCount: jest.fn().mockReturnValue(1),
      getPageIndices: jest.fn().mockReturnValue([0]),
      copyPages: jest.fn().mockResolvedValue([{ page: 1 }]),
      addPage: jest.fn(),
      save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    };
    (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);
    (PDFDocument.create as jest.Mock).mockResolvedValue(mockPdfDoc);

    // Mock fs operations
    (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('mock pdf content'));
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

    // Create service instance with mocked dependencies
    service = new IntelliFillService({
      documentParser: mockDocumentParser as any,
      dataExtractor: mockDataExtractor as any,
      fieldMapper: mockFieldMapper as any,
      formFiller: mockFormFiller as any,
      validationService: mockValidationService as any,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Orchestration Flow Tests
  // ==========================================================================

  describe('processSingle - Orchestration Flow', () => {
    it('should orchestrate complete form filling flow successfully', async () => {
      const result = await service.processSingle(
        '/input/document.pdf',
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      expect(result.success).toBe(true);
      expect(result.fillResult.filledFields).toContain('full_name');
      expect(result.fillResult.filledFields).toContain('email_address');
      expect(result.mappingResult.overallConfidence).toBeGreaterThan(0.9);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.errors).toHaveLength(0);

      // Verify orchestration sequence
      expect(mockDocumentParser.parse).toHaveBeenCalledWith('/input/document.pdf');
      expect(mockDataExtractor.extract).toHaveBeenCalledWith(mockParsedDocument);
      expect(mockFieldMapper.mapFields).toHaveBeenCalled();
      expect(mockFormFiller.fillPDFForm).toHaveBeenCalledWith(
        '/forms/template.pdf',
        expect.objectContaining({ mappings: expect.any(Array) }),
        '/output/filled.pdf'
      );
    });

    it('should pass extracted form fields to the field mapper', async () => {
      await service.processSingle(
        '/input/document.pdf',
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      // Verify field mapper received form fields
      expect(mockFieldMapper.mapFields).toHaveBeenCalledWith(
        mockExtractedData,
        expect.arrayContaining(['full_name', 'email_address', 'phone_number'])
      );
    });

    it('should calculate and return processing time', async () => {
      const result = await service.processSingle(
        '/input/document.pdf',
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      expect(typeof result.processingTime).toBe('number');
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Template Selection and Mapping Tests
  // ==========================================================================

  describe('Template Selection and Field Mapping', () => {
    it('should extract all form fields from template PDF', async () => {
      const formFields = await service.extractFormFields('/forms/template.pdf');

      expect(formFields).toContain('full_name');
      expect(formFields).toContain('email_address');
      expect(formFields).toContain('phone_number');
      expect(fs.readFile).toHaveBeenCalledWith('/forms/template.pdf');
    });

    it('should map profile data fields correctly to form fields', async () => {
      const result = await service.processSingle(
        '/input/document.pdf',
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      // Check mappings are passed through correctly
      expect(result.mappingResult.mappings).toHaveLength(2);
      expect(result.mappingResult.mappings[0]).toMatchObject({
        formField: 'full_name',
        value: 'John Doe',
        confidence: expect.any(Number),
      });
    });

    it('should identify unmapped form fields', async () => {
      mockFieldMapper.mapFields.mockResolvedValue({
        ...mockMappingResult,
        unmappedFormFields: ['phone_number', 'address'],
      });

      const result = await service.processSingle(
        '/input/document.pdf',
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      expect(result.mappingResult.unmappedFormFields).toContain('phone_number');
      expect(result.mappingResult.unmappedFormFields).toContain('address');
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle missing template errors gracefully', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await service.processSingle(
        '/input/document.pdf',
        '/forms/missing-template.pdf',
        '/output/filled.pdf'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('ENOENT');
    });

    it('should handle document parsing errors', async () => {
      mockDocumentParser.parse.mockRejectedValue(new Error('Invalid PDF format'));

      const result = await service.processSingle(
        '/input/corrupted.pdf',
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Invalid PDF format');
      expect(result.fillResult.success).toBe(false);
      expect(result.mappingResult.overallConfidence).toBe(0);
    });

    it('should handle data extraction errors', async () => {
      mockDataExtractor.extract.mockRejectedValue(new Error('Extraction failed'));

      const result = await service.processSingle(
        '/input/document.pdf',
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Extraction failed');
    });

    it('should handle form filling errors', async () => {
      mockFormFiller.fillPDFForm.mockRejectedValue(new Error('Form filling failed'));

      const result = await service.processSingle(
        '/input/document.pdf',
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Form filling failed');
    });

    it('should return default empty values on error', async () => {
      mockDocumentParser.parse.mockRejectedValue(new Error('Parse error'));

      const result = await service.processSingle(
        '/input/document.pdf',
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      expect(result.fillResult.filledFields).toEqual([]);
      expect(result.fillResult.failedFields).toEqual([]);
      expect(result.mappingResult.mappings).toEqual([]);
      expect(result.mappingResult.unmappedFormFields).toEqual([]);
    });
  });

  // ==========================================================================
  // Partial Data Mapping and Warnings Tests
  // ==========================================================================

  describe('Partial Data Mapping and Warnings', () => {
    it('should return warnings for partial data mapping', async () => {
      mockFieldMapper.mapFields.mockResolvedValue({
        ...mockMappingResult,
        warnings: ['Field phone could not be matched'],
      });
      mockFormFiller.fillPDFForm.mockResolvedValue({
        ...mockFillResult,
        warnings: ['Field phone could not be matched'],
      });

      const result = await service.processSingle(
        '/input/document.pdf',
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      expect(result.warnings).toContain('Field phone could not be matched');
    });

    it('should include warnings from form filler', async () => {
      mockFormFiller.fillPDFForm.mockResolvedValue({
        ...mockFillResult,
        warnings: ["No data found for form field 'ssn'"],
      });

      const result = await service.processSingle(
        '/input/document.pdf',
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      expect(result.warnings).toContain("No data found for form field 'ssn'");
    });

    it('should handle empty extracted data gracefully', async () => {
      mockDataExtractor.extract.mockResolvedValue({
        fields: {},
        entities: {
          names: [],
          emails: [],
          phones: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'Pattern Matching',
          confidence: 0,
          timestamp: new Date(),
        },
      });

      mockFieldMapper.mapFields.mockResolvedValue({
        mappings: [],
        unmappedFormFields: ['full_name', 'email_address', 'phone_number'],
        unmappedDataFields: [],
        overallConfidence: 0,
        warnings: ['No data extracted from document'],
      });

      const result = await service.processSingle(
        '/input/empty-document.pdf',
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      expect(result.mappingResult.mappings).toHaveLength(0);
      expect(result.mappingResult.unmappedFormFields).toHaveLength(3);
    });
  });

  // ==========================================================================
  // Confidence Threshold and Aggregation Tests
  // ==========================================================================

  describe('Confidence Threshold Handling', () => {
    it('should aggregate overall confidence from mappings', async () => {
      mockFieldMapper.mapFields.mockResolvedValue({
        mappings: [
          {
            formField: 'field1',
            dataSource: 'source1',
            value: 'val1',
            confidence: 0.8,
            mappingMethod: 'match',
          },
          {
            formField: 'field2',
            dataSource: 'source2',
            value: 'val2',
            confidence: 0.9,
            mappingMethod: 'match',
          },
          {
            formField: 'field3',
            dataSource: 'source3',
            value: 'val3',
            confidence: 1.0,
            mappingMethod: 'match',
          },
        ],
        unmappedFormFields: [],
        unmappedDataFields: [],
        overallConfidence: 0.9, // (0.8 + 0.9 + 1.0) / 3 = 0.9
        warnings: [],
      });

      const result = await service.processSingle(
        '/input/document.pdf',
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      expect(result.mappingResult.overallConfidence).toBe(0.9);
    });

    it('should handle low confidence mappings', async () => {
      mockFieldMapper.mapFields.mockResolvedValue({
        mappings: [
          {
            formField: 'field1',
            dataSource: 'source1',
            value: 'val1',
            confidence: 0.3,
            mappingMethod: 'fuzzy',
          },
          {
            formField: 'field2',
            dataSource: 'source2',
            value: 'val2',
            confidence: 0.4,
            mappingMethod: 'fuzzy',
          },
        ],
        unmappedFormFields: ['field3'],
        unmappedDataFields: [],
        overallConfidence: 0.35,
        warnings: ['Low confidence mappings detected'],
      });

      const result = await service.processSingle(
        '/input/document.pdf',
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      expect(result.mappingResult.overallConfidence).toBeLessThan(0.5);
      expect(result.mappingResult.warnings).toContain('Low confidence mappings detected');
    });

    it('should return zero confidence when no mappings exist', async () => {
      mockFieldMapper.mapFields.mockResolvedValue({
        mappings: [],
        unmappedFormFields: ['full_name', 'email_address'],
        unmappedDataFields: [],
        overallConfidence: 0,
        warnings: [],
      });

      const result = await service.processSingle(
        '/input/document.pdf',
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      expect(result.mappingResult.overallConfidence).toBe(0);
    });
  });

  // ==========================================================================
  // Missing Fields Tests
  // ==========================================================================

  describe('Missing Fields Handling', () => {
    it('should return unmapped form fields in mapping result', async () => {
      mockFieldMapper.mapFields.mockResolvedValue({
        mappings: [
          {
            formField: 'full_name',
            dataSource: 'name',
            value: 'John Doe',
            confidence: 0.9,
            mappingMethod: 'match',
          },
        ],
        unmappedFormFields: ['email_address', 'phone_number', 'ssn'],
        unmappedDataFields: [],
        overallConfidence: 0.9,
        warnings: [],
      });

      const result = await service.processSingle(
        '/input/document.pdf',
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      expect(result.mappingResult.unmappedFormFields).toContain('email_address');
      expect(result.mappingResult.unmappedFormFields).toContain('phone_number');
      expect(result.mappingResult.unmappedFormFields).toContain('ssn');
      expect(result.mappingResult.unmappedFormFields).toHaveLength(3);
    });

    it('should handle incomplete profile data', async () => {
      mockDataExtractor.extract.mockResolvedValue({
        fields: {
          name: 'John Doe',
          // Missing: email, phone, address, etc.
        },
        entities: {
          names: ['John Doe'],
          emails: [],
          phones: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: {
          extractionMethod: 'Pattern Matching',
          confidence: 30,
          timestamp: new Date(),
        },
      });

      mockFieldMapper.mapFields.mockResolvedValue({
        mappings: [
          {
            formField: 'full_name',
            dataSource: 'name',
            value: 'John Doe',
            confidence: 0.95,
            mappingMethod: 'match',
          },
        ],
        unmappedFormFields: ['email_address', 'phone_number'],
        unmappedDataFields: [],
        overallConfidence: 0.95,
        warnings: ['Profile data is incomplete'],
      });

      const result = await service.processSingle(
        '/input/document.pdf',
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      // Should still succeed with partial data
      expect(result.success).toBe(true);
      expect(result.mappingResult.mappings).toHaveLength(1);
      expect(result.mappingResult.unmappedFormFields).toContain('email_address');
      expect(result.mappingResult.unmappedFormFields).toContain('phone_number');
    });

    it('should track unmapped data fields from source document', async () => {
      mockFieldMapper.mapFields.mockResolvedValue({
        mappings: [
          {
            formField: 'full_name',
            dataSource: 'name',
            value: 'John Doe',
            confidence: 0.9,
            mappingMethod: 'match',
          },
        ],
        unmappedFormFields: [],
        unmappedDataFields: ['ssn', 'drivers_license', 'passport_number'],
        overallConfidence: 0.9,
        warnings: [],
      });

      const result = await service.processSingle(
        '/input/document.pdf',
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      expect(result.mappingResult.unmappedDataFields).toContain('ssn');
      expect(result.mappingResult.unmappedDataFields).toContain('drivers_license');
    });
  });

  // ==========================================================================
  // Multiple Documents Processing Tests
  // ==========================================================================

  describe('processMultiple - Multiple Documents', () => {
    it('should process multiple documents and merge data', async () => {
      const result = await service.processMultiple(
        ['/input/doc1.pdf', '/input/doc2.pdf'],
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      expect(result.success).toBe(true);
      expect(mockDocumentParser.parse).toHaveBeenCalledTimes(2);
      expect(mockDataExtractor.extract).toHaveBeenCalledTimes(2);
    });

    it('should merge extracted data from multiple documents', async () => {
      // First document has name
      mockDataExtractor.extract.mockResolvedValueOnce({
        fields: { name: 'John Doe' },
        entities: {
          names: ['John Doe'],
          emails: [],
          phones: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: { extractionMethod: 'test', confidence: 90, timestamp: new Date() },
      });

      // Second document has email
      mockDataExtractor.extract.mockResolvedValueOnce({
        fields: { email: 'john@example.com' },
        entities: {
          names: [],
          emails: ['john@example.com'],
          phones: [],
          dates: [],
          addresses: [],
          numbers: [],
          currencies: [],
        },
        metadata: { extractionMethod: 'test', confidence: 85, timestamp: new Date() },
      });

      await service.processMultiple(
        ['/input/doc1.pdf', '/input/doc2.pdf'],
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      // Verify mapFields was called with merged data
      expect(mockFieldMapper.mapFields).toHaveBeenCalled();
    });

    it('should handle errors in multiple document processing', async () => {
      mockDocumentParser.parse.mockRejectedValue(new Error('Parse failed'));

      const result = await service.processMultiple(
        ['/input/doc1.pdf', '/input/doc2.pdf'],
        '/forms/template.pdf',
        '/output/filled.pdf'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Batch Processing Tests
  // ==========================================================================

  describe('batchProcess', () => {
    it('should process multiple jobs in batch', async () => {
      const jobs = [
        { documents: ['/input/doc1.pdf'], form: '/forms/form1.pdf', output: '/output/out1.pdf' },
        { documents: ['/input/doc2.pdf'], form: '/forms/form2.pdf', output: '/output/out2.pdf' },
      ];

      const results = await service.batchProcess(jobs);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should continue processing even if one job fails', async () => {
      mockDocumentParser.parse
        .mockRejectedValueOnce(new Error('First job failed'))
        .mockResolvedValueOnce(mockParsedDocument);

      const jobs = [
        { documents: ['/input/bad.pdf'], form: '/forms/form1.pdf', output: '/output/out1.pdf' },
        { documents: ['/input/good.pdf'], form: '/forms/form2.pdf', output: '/output/out2.pdf' },
      ];

      const results = await service.batchProcess(jobs);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
    });
  });

  // ==========================================================================
  // Document Validation Tests
  // ==========================================================================

  describe('validateDocument', () => {
    it('should validate document successfully', async () => {
      mockValidationService.validateData.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
      });

      const result = await service.validateDocument('/input/document.pdf');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid document', async () => {
      mockValidationService.validateData.mockResolvedValue({
        valid: false,
        errors: ['Missing required field: name'],
        warnings: [],
      });

      const result = await service.validateDocument('/input/invalid.pdf');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: name');
    });

    it('should handle document parsing errors during validation', async () => {
      mockDocumentParser.parse.mockRejectedValue(new Error('Cannot parse document'));

      const result = await service.validateDocument('/input/corrupted.pdf');

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Cannot parse document');
    });

    it('should include warnings from validation', async () => {
      mockValidationService.validateData.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: ['Date format may not be standard'],
      });

      const result = await service.validateDocument('/input/document.pdf');

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Date format may not be standard');
    });
  });

  // ==========================================================================
  // Direct PDF Filling Tests
  // ==========================================================================

  describe('fillPDF', () => {
    it('should fill PDF form with provided data', async () => {
      const mockTextField = { setText: jest.fn() };
      const mockForm = {
        getTextField: jest.fn().mockReturnValue(mockTextField),
      };
      const mockPdfDoc = {
        getForm: jest.fn().mockReturnValue(mockForm),
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      };
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      await service.fillPDF(
        '/forms/template.pdf',
        { full_name: 'John Doe', email: 'john@example.com' },
        '/output/filled.pdf'
      );

      expect(mockForm.getTextField).toHaveBeenCalledWith('full_name');
      expect(mockForm.getTextField).toHaveBeenCalledWith('email');
      expect(mockTextField.setText).toHaveBeenCalledWith('John Doe');
      expect(mockTextField.setText).toHaveBeenCalledWith('john@example.com');
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should handle missing fields in PDF gracefully', async () => {
      const mockForm = {
        getTextField: jest.fn().mockImplementation(() => {
          throw new Error('Field not found');
        }),
      };
      const mockPdfDoc = {
        getForm: jest.fn().mockReturnValue(mockForm),
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      };
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      // Should not throw, but log warning
      await expect(
        service.fillPDF('/forms/template.pdf', { missing_field: 'value' }, '/output/filled.pdf')
      ).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // Document Merging Tests
  // ==========================================================================

  describe('mergeDocuments', () => {
    it('should merge multiple PDF documents', async () => {
      const mockPage = { page: 1 };
      const mockMergedPdf = {
        copyPages: jest.fn().mockResolvedValue([mockPage]),
        addPage: jest.fn(),
        save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
        getPageIndices: jest.fn().mockReturnValue([0]),
      };
      const mockSourcePdf = {
        getPageIndices: jest.fn().mockReturnValue([0]),
      };

      (PDFDocument.create as jest.Mock).mockResolvedValue(mockMergedPdf);
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockSourcePdf);

      const result = await service.mergeDocuments(['/doc1.pdf', '/doc2.pdf']);

      expect(result).toBeInstanceOf(Buffer);
      expect(PDFDocument.load).toHaveBeenCalledTimes(2);
      expect(mockMergedPdf.copyPages).toHaveBeenCalledTimes(2);
      expect(mockMergedPdf.addPage).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Dependency Injection Tests
  // ==========================================================================

  describe('Dependency Injection', () => {
    it('should use injected document parser', async () => {
      const customParser = { parse: jest.fn().mockResolvedValue(mockParsedDocument) };

      const customService = new IntelliFillService({
        documentParser: customParser as any,
        dataExtractor: mockDataExtractor as any,
        fieldMapper: mockFieldMapper as any,
        formFiller: mockFormFiller as any,
        validationService: mockValidationService as any,
      });

      await customService.processSingle('/input/doc.pdf', '/forms/form.pdf', '/output/out.pdf');

      expect(customParser.parse).toHaveBeenCalled();
    });

    it('should use injected form filler', async () => {
      const customFiller = { fillPDFForm: jest.fn().mockResolvedValue(mockFillResult) };

      const customService = new IntelliFillService({
        documentParser: mockDocumentParser as any,
        dataExtractor: mockDataExtractor as any,
        fieldMapper: mockFieldMapper as any,
        formFiller: customFiller as any,
        validationService: mockValidationService as any,
      });

      await customService.processSingle('/input/doc.pdf', '/forms/form.pdf', '/output/out.pdf');

      expect(customFiller.fillPDFForm).toHaveBeenCalled();
    });
  });
});
