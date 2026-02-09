/**
 * FormFiller Unit Tests
 *
 * Comprehensive tests covering:
 * - fillPDFForm() with valid PDF forms
 * - Checkbox field handling (yes/no, true/false, 1/0 values)
 * - Radio button group selection
 * - Text field filling and truncation for long values
 * - Boolean parsing variations
 * - Unicode text handling
 * - FLATTEN_FORMS environment variable behavior
 * - Error handling for corrupted/invalid PDFs
 * - PDF with no fillable fields
 * - Dropdown field handling
 * - Low confidence mapping warnings
 * - Unmapped field handling
 * - Multiple form filling
 * - Field validation
 */

import { FormFiller, FillResult } from '../FormFiller';
import { MappingResult, FieldMapping } from '../../mappers/FieldMapper';
import * as fs from 'fs/promises';
import {
  PDFDocument,
  PDFForm,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFOptionList,
} from 'pdf-lib';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('../../utils/piiSafeLogger', () => ({
  piiSafeLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));
jest.mock('../../utils/fileReader', () => ({
  getFileBuffer: jest.fn(),
  isUrl: jest.fn(() => false),
}));

// Mock pdf-lib with classes that support instanceof
// The classes must be defined inside the factory function because jest.mock is hoisted
jest.mock('pdf-lib', () => {
  // Create mock classes inside the factory so they're available when mock is initialized
  class MockPDFTextField {
    private name: string;
    setText = jest.fn();

    constructor(name = 'textField') {
      this.name = name;
    }
    getName() {
      return this.name;
    }
  }

  class MockPDFCheckBox {
    private name: string;
    check = jest.fn();
    uncheck = jest.fn();

    constructor(name = 'checkBox') {
      this.name = name;
    }
    getName() {
      return this.name;
    }
  }

  class MockPDFDropdown {
    private name: string;
    private options: string[];
    select = jest.fn();

    constructor(name = 'dropdown', options = ['Option1', 'Option2', 'Option3']) {
      this.name = name;
      this.options = options;
    }
    getName() {
      return this.name;
    }
    getOptions() {
      return this.options;
    }
  }

  class MockPDFRadioGroup {
    private name: string;
    private options: string[];
    select = jest.fn();

    constructor(name = 'radioGroup', options = ['Yes', 'No', 'Maybe']) {
      this.name = name;
      this.options = options;
    }
    getName() {
      return this.name;
    }
    getOptions() {
      return this.options;
    }
  }

  class MockPDFOptionList {
    private name: string;
    private options: string[];
    select = jest.fn();

    constructor(name = 'optionList', options = ['Item1', 'Item2', 'Item3']) {
      this.name = name;
      this.options = options;
    }
    getName() {
      return this.name;
    }
    getOptions() {
      return this.options;
    }
  }

  return {
    PDFDocument: {
      load: jest.fn(),
    },
    PDFTextField: MockPDFTextField,
    PDFCheckBox: MockPDFCheckBox,
    PDFDropdown: MockPDFDropdown,
    PDFRadioGroup: MockPDFRadioGroup,
    PDFOptionList: MockPDFOptionList,
  };
});

// Import getFileBuffer mock
import { getFileBuffer } from '../../utils/fileReader';
const mockGetFileBuffer = getFileBuffer as jest.Mock;

describe('FormFiller', () => {
  let filler: FormFiller;
  const mockFs = fs as jest.Mocked<typeof fs>;

  // Mock PDF form fields - types from pdf-lib
  let mockTextField: PDFTextField;
  let mockCheckBox: PDFCheckBox;
  let mockDropdown: PDFDropdown;
  let mockRadioGroup: PDFRadioGroup;
  let mockForm: { getFields: jest.Mock; getField: jest.Mock; flatten: jest.Mock };
  let mockPdfDoc: { getForm: jest.Mock; save: jest.Mock };

  beforeEach(() => {
    filler = new FormFiller();
    jest.clearAllMocks();

    // Create new instances of the mock classes for instanceof compatibility
    mockTextField = new (PDFTextField as any)('textField');
    mockCheckBox = new (PDFCheckBox as any)('checkBox');
    mockDropdown = new (PDFDropdown as any)('dropdown', ['Option1', 'Option2', 'Option3']);
    mockRadioGroup = new (PDFRadioGroup as any)('radioGroup', ['Yes', 'No', 'Maybe']);

    mockForm = {
      getFields: jest.fn().mockReturnValue([]),
      getField: jest.fn(),
      flatten: jest.fn(),
    };

    mockPdfDoc = {
      getForm: jest.fn().mockReturnValue(mockForm),
      save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    };
  });

  // Helper function to create test mapping
  const createMapping = (
    formField: string,
    value: unknown,
    confidence: number = 0.9
  ): FieldMapping => ({
    formField,
    dataSource: formField,
    value,
    confidence,
    mappingMethod: 'Direct Match',
  });

  const createMappingResult = (mappings: FieldMapping[]): MappingResult => ({
    mappings,
    unmappedFormFields: [],
    unmappedDataFields: [],
    overallConfidence: 0.9,
    warnings: [],
  });

  // ==========================================================================
  // Text Field Tests
  // ==========================================================================

  describe('Text Field Filling', () => {
    beforeEach(() => {
      mockForm.getFields.mockReturnValue([mockTextField]);
      mockForm.getField.mockReturnValue(mockTextField);
      mockGetFileBuffer.mockResolvedValue(Buffer.from('pdf data'));
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should fill text field with string value', async () => {
      const mappings = createMappingResult([createMapping('textField', 'John Doe')]);

      const result = await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockTextField.setText).toHaveBeenCalledWith('John Doe');
      expect(result.success).toBe(true);
      expect(result.filledFields).toContain('textField');
      expect(result.failedFields).toHaveLength(0);
    });

    it('should convert non-string values to strings', async () => {
      const mappings = createMappingResult([createMapping('textField', 12345)]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockTextField.setText).toHaveBeenCalledWith('12345');
    });

    it('should handle unicode text correctly', async () => {
      const unicodeText = '日本語テキスト 中文文本 العربية';
      const mappings = createMappingResult([createMapping('textField', unicodeText)]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockTextField.setText).toHaveBeenCalledWith(unicodeText);
    });

    it('should handle emoji and special characters', async () => {
      const specialText = 'Test 😊 ™ © ® € £ ¥';
      const mappings = createMappingResult([createMapping('textField', specialText)]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockTextField.setText).toHaveBeenCalledWith(specialText);
    });

    it('should handle very long text values', async () => {
      const longText = 'A'.repeat(10000);
      const mappings = createMappingResult([createMapping('textField', longText)]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockTextField.setText).toHaveBeenCalledWith(longText);
    });

    it('should skip empty string values', async () => {
      const mappings = createMappingResult([createMapping('textField', '')]);

      const result = await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockTextField.setText).not.toHaveBeenCalled();
      expect(result.warnings).toContainEqual(
        expect.stringContaining('skipped: no value available')
      );
    });

    it('should skip null and undefined values', async () => {
      const mappings1 = createMappingResult([createMapping('textField', null)]);
      const result1 = await filler.fillPDFForm('/test/form.pdf', mappings1, '/test/output1.pdf');
      expect(mockTextField.setText).not.toHaveBeenCalled();
      expect(result1.warnings).toContainEqual(
        expect.stringContaining('skipped: no value available')
      );

      jest.clearAllMocks();
      mockForm.getFields.mockReturnValue([mockTextField]);
      mockForm.getField.mockReturnValue(mockTextField);
      mockGetFileBuffer.mockResolvedValue(Buffer.from('pdf data'));
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);
      mockFs.writeFile.mockResolvedValue(undefined);

      const mappings2 = createMappingResult([createMapping('textField', undefined)]);
      const result2 = await filler.fillPDFForm('/test/form.pdf', mappings2, '/test/output2.pdf');
      expect(mockTextField.setText).not.toHaveBeenCalled();
      expect(result2.warnings).toContainEqual(
        expect.stringContaining('skipped: no value available')
      );
    });
  });

  // ==========================================================================
  // Checkbox Field Tests
  // ==========================================================================

  describe('Checkbox Field Handling', () => {
    beforeEach(() => {
      mockForm.getFields.mockReturnValue([mockCheckBox]);
      mockForm.getField.mockReturnValue(mockCheckBox);
      mockGetFileBuffer.mockResolvedValue(Buffer.from('pdf data'));
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should check checkbox when value is boolean true', async () => {
      const mappings = createMappingResult([createMapping('checkBox', true)]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockCheckBox.check).toHaveBeenCalled();
      expect(mockCheckBox.uncheck).not.toHaveBeenCalled();
    });

    it('should uncheck checkbox when value is boolean false', async () => {
      const mappings = createMappingResult([createMapping('checkBox', false)]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockCheckBox.uncheck).toHaveBeenCalled();
      expect(mockCheckBox.check).not.toHaveBeenCalled();
    });

    it('should check checkbox for string "true"', async () => {
      const mappings = createMappingResult([createMapping('checkBox', 'true')]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockCheckBox.check).toHaveBeenCalled();
    });

    it('should check checkbox for string "yes"', async () => {
      const mappings = createMappingResult([createMapping('checkBox', 'yes')]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockCheckBox.check).toHaveBeenCalled();
    });

    it('should check checkbox for string "1"', async () => {
      const mappings = createMappingResult([createMapping('checkBox', '1')]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockCheckBox.check).toHaveBeenCalled();
    });

    it('should check checkbox for string "checked"', async () => {
      const mappings = createMappingResult([createMapping('checkBox', 'checked')]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockCheckBox.check).toHaveBeenCalled();
    });

    it('should handle case-insensitive boolean strings', async () => {
      const testCases = ['TRUE', 'True', 'YES', 'Yes', 'YeS', 'CHECKED', 'Checked'];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        const mappings = createMappingResult([createMapping('checkBox', testCase)]);
        await filler.fillPDFForm('/test/form.pdf', mappings, `/test/output-${testCase}.pdf`);
        expect(mockCheckBox.check).toHaveBeenCalled();
      }
    });

    it('should uncheck checkbox for number 0', async () => {
      const mappings = createMappingResult([createMapping('checkBox', 0)]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockCheckBox.uncheck).toHaveBeenCalled();
    });

    it('should check checkbox for non-zero numbers', async () => {
      const mappings = createMappingResult([createMapping('checkBox', 1)]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockCheckBox.check).toHaveBeenCalled();
    });

    it('should skip empty string for checkbox', async () => {
      const mappings = createMappingResult([createMapping('checkBox', '')]);

      const result = await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      // Source skips null/undefined/empty values
      expect(mockCheckBox.uncheck).not.toHaveBeenCalled();
      expect(mockCheckBox.check).not.toHaveBeenCalled();
      expect(result.warnings).toContainEqual(
        expect.stringContaining('skipped: no value available')
      );
    });

    it('should uncheck checkbox for string "false"', async () => {
      const mappings = createMappingResult([createMapping('checkBox', 'false')]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockCheckBox.uncheck).toHaveBeenCalled();
    });

    it('should uncheck checkbox for string "no"', async () => {
      const mappings = createMappingResult([createMapping('checkBox', 'no')]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockCheckBox.uncheck).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Dropdown Field Tests
  // ==========================================================================

  describe('Dropdown Field Handling', () => {
    beforeEach(() => {
      mockForm.getFields.mockReturnValue([mockDropdown]);
      mockForm.getField.mockReturnValue(mockDropdown);
      mockGetFileBuffer.mockResolvedValue(Buffer.from('pdf data'));
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should select valid dropdown option', async () => {
      const mappings = createMappingResult([createMapping('dropdown', 'Option1')]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockDropdown.select).toHaveBeenCalledWith('Option1');
    });

    it('should warn when dropdown value not in options', async () => {
      const mappings = createMappingResult([createMapping('dropdown', 'InvalidOption')]);

      const result = await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockDropdown.select).not.toHaveBeenCalled();
      expect(result.warnings).toContainEqual(
        expect.stringContaining("Value 'InvalidOption' not found in dropdown options")
      );
    });

    it('should convert non-string values to strings for dropdown', async () => {
      // Create a new dropdown with numeric string options
      const numericDropdown = new (PDFDropdown as any)('dropdown', ['1', '2', '3']);
      mockForm.getFields.mockReturnValue([numericDropdown]);
      mockForm.getField.mockReturnValue(numericDropdown);
      const mappings = createMappingResult([createMapping('dropdown', 2)]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(numericDropdown.select).toHaveBeenCalledWith('2');
    });
  });

  // ==========================================================================
  // Radio Group Tests
  // ==========================================================================

  describe('Radio Group Handling', () => {
    beforeEach(() => {
      mockForm.getFields.mockReturnValue([mockRadioGroup]);
      mockForm.getField.mockReturnValue(mockRadioGroup);
      mockGetFileBuffer.mockResolvedValue(Buffer.from('pdf data'));
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should select valid radio option', async () => {
      const mappings = createMappingResult([createMapping('radioGroup', 'Yes')]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockRadioGroup.select).toHaveBeenCalledWith('Yes');
    });

    it('should warn when radio value not in options', async () => {
      const mappings = createMappingResult([createMapping('radioGroup', 'InvalidOption')]);

      const result = await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockRadioGroup.select).not.toHaveBeenCalled();
      expect(result.warnings).toContainEqual(
        expect.stringContaining("Value 'InvalidOption' not found in radio options")
      );
    });

    it('should convert non-string values to strings for radio', async () => {
      // Create a new radio group with numeric string options
      const numericRadio = new (PDFRadioGroup as any)('radioGroup', ['1', '2', '3']);
      mockForm.getFields.mockReturnValue([numericRadio]);
      mockForm.getField.mockReturnValue(numericRadio);
      const mappings = createMappingResult([createMapping('radioGroup', 1)]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(numericRadio.select).toHaveBeenCalledWith('1');
    });
  });

  // ==========================================================================
  // FLATTEN_FORMS Environment Variable Tests
  // ==========================================================================

  describe('Form Flattening', () => {
    const originalEnv = process.env.FLATTEN_FORMS;

    afterEach(() => {
      process.env.FLATTEN_FORMS = originalEnv;
    });

    beforeEach(() => {
      mockForm.getFields.mockReturnValue([mockTextField]);
      mockForm.getField.mockReturnValue(mockTextField);
      mockGetFileBuffer.mockResolvedValue(Buffer.from('pdf data'));
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should flatten form when FLATTEN_FORMS=true', async () => {
      process.env.FLATTEN_FORMS = 'true';
      const mappings = createMappingResult([createMapping('textField', 'Test')]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockForm.flatten).toHaveBeenCalled();
    });

    it('should not flatten form when FLATTEN_FORMS=false', async () => {
      process.env.FLATTEN_FORMS = 'false';
      const mappings = createMappingResult([createMapping('textField', 'Test')]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockForm.flatten).not.toHaveBeenCalled();
    });

    it('should not flatten form when FLATTEN_FORMS is undefined', async () => {
      delete process.env.FLATTEN_FORMS;
      const mappings = createMappingResult([createMapping('textField', 'Test')]);

      await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(mockForm.flatten).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    beforeEach(() => {
      mockGetFileBuffer.mockResolvedValue(Buffer.from('pdf data'));
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should throw error when PDF file cannot be read', async () => {
      mockGetFileBuffer.mockRejectedValue(new Error('File not found'));
      const mappings = createMappingResult([]);

      await expect(
        filler.fillPDFForm('/test/missing.pdf', mappings, '/test/output.pdf')
      ).rejects.toThrow('Failed to fill PDF form');
    });

    it('should throw error when PDF is corrupted', async () => {
      (PDFDocument.load as jest.Mock).mockRejectedValue(new Error('Invalid PDF'));
      const mappings = createMappingResult([]);

      await expect(
        filler.fillPDFForm('/test/corrupted.pdf', mappings, '/test/output.pdf')
      ).rejects.toThrow('Failed to fill PDF form');
    });

    it('should handle field filling errors gracefully', async () => {
      mockForm.getFields.mockReturnValue([mockTextField]);
      mockForm.getField.mockReturnValue(mockTextField);
      (mockTextField.setText as jest.Mock).mockImplementation(() => {
        throw new Error('Field is read-only');
      });
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      const mappings = createMappingResult([createMapping('textField', 'Test')]);
      const result = await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(result.success).toBe(false);
      expect(result.failedFields).toHaveLength(1);
      expect(result.failedFields[0].field).toBe('textField');
      expect(result.failedFields[0].reason).toBe('Field is read-only');
    });

    it('should throw error when output file cannot be written', async () => {
      mockForm.getFields.mockReturnValue([mockTextField]);
      mockForm.getField.mockReturnValue(mockTextField);
      mockGetFileBuffer.mockResolvedValue(Buffer.from('pdf data'));
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);
      mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      const mappings = createMappingResult([createMapping('textField', 'Test')]);

      await expect(
        filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf')
      ).rejects.toThrow('Failed to fill PDF form');
    });
  });

  // ==========================================================================
  // PDF with No Fillable Fields Tests
  // ==========================================================================

  describe('PDF with No Fillable Fields', () => {
    beforeEach(() => {
      mockForm.getFields.mockReturnValue([]);
      mockGetFileBuffer.mockResolvedValue(Buffer.from('pdf data'));
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should handle PDF with no form fields', async () => {
      const mappings = createMappingResult([createMapping('anyField', 'value')]);

      const result = await filler.fillPDFForm('/test/empty-form.pdf', mappings, '/test/output.pdf');

      expect(result.success).toBe(false);
      expect(result.filledFields).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Low Confidence Mapping Tests
  // ==========================================================================

  describe('Low Confidence Mapping Warnings', () => {
    beforeEach(() => {
      mockForm.getFields.mockReturnValue([mockTextField]);
      mockForm.getField.mockReturnValue(mockTextField);
      mockGetFileBuffer.mockResolvedValue(Buffer.from('pdf data'));
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should warn about low confidence mappings', async () => {
      const mappings = createMappingResult([createMapping('textField', 'Test', 0.5)]);

      const result = await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(result.warnings).toContainEqual(
        expect.stringContaining('Low confidence (50.0%) for field')
      );
    });

    it('should not warn about high confidence mappings', async () => {
      const mappings = createMappingResult([createMapping('textField', 'Test', 0.9)]);

      const result = await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      const lowConfidenceWarnings = result.warnings.filter((w) => w.includes('Low confidence'));
      expect(lowConfidenceWarnings).toHaveLength(0);
    });

    it('should include warnings from mapping result', async () => {
      const mappings: MappingResult = {
        mappings: [createMapping('textField', 'Test')],
        unmappedFormFields: [],
        unmappedDataFields: [],
        overallConfidence: 0.9,
        warnings: ['Pre-existing warning from mapper'],
      };

      const result = await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(result.warnings).toContain('Pre-existing warning from mapper');
    });
  });

  // ==========================================================================
  // Unmapped Fields Tests
  // ==========================================================================

  describe('Unmapped Fields Handling', () => {
    beforeEach(() => {
      mockForm.getFields.mockReturnValue([mockTextField]);
      mockForm.getField.mockReturnValue(mockTextField);
      mockGetFileBuffer.mockResolvedValue(Buffer.from('pdf data'));
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should warn about unmapped form fields', async () => {
      const mappings: MappingResult = {
        mappings: [],
        unmappedFormFields: ['unmappedField1', 'unmappedField2'],
        unmappedDataFields: [],
        overallConfidence: 0.5,
        warnings: [],
      };

      const result = await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(result.warnings).toContainEqual(
        expect.stringContaining("No data found for form field 'unmappedField1'")
      );
      expect(result.warnings).toContainEqual(
        expect.stringContaining("No data found for form field 'unmappedField2'")
      );
    });

    it('should warn when field not found in form', async () => {
      mockForm.getField.mockReturnValue(null as unknown as PDFTextField);
      const mappings = createMappingResult([createMapping('nonExistentField', 'Test')]);

      const result = await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(result.warnings).toContainEqual(
        expect.stringContaining("Field 'nonExistentField' not found in form")
      );
    });
  });

  // ==========================================================================
  // Multiple Fields Integration Tests
  // ==========================================================================

  describe('Multiple Fields Integration', () => {
    beforeEach(() => {
      mockForm.getFields.mockReturnValue([
        mockTextField,
        mockCheckBox,
        mockDropdown,
        mockRadioGroup,
      ]);
      mockForm.getField.mockImplementation((name: string) => {
        if (name === 'textField') return mockTextField;
        if (name === 'checkBox') return mockCheckBox;
        if (name === 'dropdown') return mockDropdown;
        if (name === 'radioGroup') return mockRadioGroup;
        return null as unknown as PDFTextField;
      });
      // getName is already set via constructor in mock classes
      mockGetFileBuffer.mockResolvedValue(Buffer.from('pdf data'));
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should fill multiple different field types', async () => {
      const mappings = createMappingResult([
        createMapping('textField', 'John Doe'),
        createMapping('checkBox', true),
        createMapping('dropdown', 'Option2'),
        createMapping('radioGroup', 'Yes'),
      ]);

      const result = await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(result.success).toBe(true);
      expect(result.filledFields).toHaveLength(4);
      expect(mockTextField.setText).toHaveBeenCalledWith('John Doe');
      expect(mockCheckBox.check).toHaveBeenCalled();
      expect(mockDropdown.select).toHaveBeenCalledWith('Option2');
      expect(mockRadioGroup.select).toHaveBeenCalledWith('Yes');
    });

    it('should handle partial success with some field errors', async () => {
      (mockTextField.setText as jest.Mock).mockImplementation(() => {
        throw new Error('Text field error');
      });

      const mappings = createMappingResult([
        createMapping('textField', 'John Doe'),
        createMapping('checkBox', true),
      ]);

      const result = await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(result.success).toBe(false);
      expect(result.filledFields).toContain('checkBox');
      expect(result.failedFields).toHaveLength(1);
      expect(result.failedFields[0].field).toBe('textField');
    });
  });

  // ==========================================================================
  // fillMultipleForms Tests
  // ==========================================================================

  describe('fillMultipleForms', () => {
    beforeEach(() => {
      mockForm.getFields.mockReturnValue([mockTextField]);
      mockForm.getField.mockReturnValue(mockTextField);
      mockGetFileBuffer.mockResolvedValue(Buffer.from('pdf data'));
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should fill multiple forms successfully', async () => {
      const mappings = createMappingResult([createMapping('textField', 'Test')]);
      const pdfPaths = ['/test/form1.pdf', '/test/form2.pdf', '/test/form3.pdf'];

      const results = await filler.fillMultipleForms(pdfPaths, mappings, '/test/output');

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalledTimes(3);
    });

    it('should handle individual form failures in batch', async () => {
      mockGetFileBuffer
        .mockResolvedValueOnce(Buffer.from('pdf data'))
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce(Buffer.from('pdf data'));

      const mappings = createMappingResult([createMapping('textField', 'Test')]);
      const pdfPaths = ['/test/form1.pdf', '/test/form2.pdf', '/test/form3.pdf'];

      const results = await filler.fillMultipleForms(pdfPaths, mappings, '/test/output');

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].failedFields[0].field).toBe('ALL');
      expect(results[2].success).toBe(true);
    });
  });

  // ==========================================================================
  // validateFormFields Tests
  // ==========================================================================

  describe('validateFormFields', () => {
    it('should return all field names and types', async () => {
      // Create mock fields with custom names
      const nameField = new (PDFTextField as any)('name');
      const agreeField = new (PDFCheckBox as any)('agree');
      const countryField = new (PDFDropdown as any)('country');
      const genderField = new (PDFRadioGroup as any)('gender');

      mockForm.getFields.mockReturnValue([nameField, agreeField, countryField, genderField]);
      mockGetFileBuffer.mockResolvedValue(Buffer.from('pdf data'));
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      const result = await filler.validateFormFields('/test/form.pdf');

      expect(result.fields).toEqual(['name', 'agree', 'country', 'gender']);
      expect(result.fieldTypes).toEqual({
        name: 'text',
        agree: 'checkbox',
        country: 'dropdown',
        gender: 'radio',
      });
    });

    it('should handle unknown field types', async () => {
      const unknownField = {
        getName: jest.fn().mockReturnValue('unknownField'),
      };
      mockForm.getFields.mockReturnValue([unknownField as any]);
      mockGetFileBuffer.mockResolvedValue(Buffer.from('pdf data'));
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      const result = await filler.validateFormFields('/test/form.pdf');

      expect(result.fieldTypes.unknownField).toBe('unknown');
    });

    it('should throw error when validation fails', async () => {
      mockGetFileBuffer.mockRejectedValue(new Error('File not found'));

      await expect(filler.validateFormFields('/test/missing.pdf')).rejects.toThrow(
        'Failed to validate form fields'
      );
    });

    it('should handle PDF with no fields', async () => {
      mockForm.getFields.mockReturnValue([]);
      mockGetFileBuffer.mockResolvedValue(Buffer.from('pdf data'));
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      const result = await filler.validateFormFields('/test/empty-form.pdf');

      expect(result.fields).toEqual([]);
      expect(result.fieldTypes).toEqual({});
    });
  });

  // ==========================================================================
  // Output and Success Tests
  // ==========================================================================

  describe('Fill Result Output', () => {
    beforeEach(() => {
      mockForm.getFields.mockReturnValue([mockTextField]);
      mockForm.getField.mockReturnValue(mockTextField);
      mockGetFileBuffer.mockResolvedValue(Buffer.from('pdf data'));
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should return correct output path', async () => {
      const mappings = createMappingResult([createMapping('textField', 'Test')]);
      const outputPath = '/test/output/filled-form.pdf';

      const result = await filler.fillPDFForm('/test/form.pdf', mappings, outputPath);

      expect(result.outputPath).toBe(outputPath);
      expect(mockFs.writeFile).toHaveBeenCalledWith(outputPath, expect.any(Uint8Array));
    });

    it('should return success=true when no failures', async () => {
      const mappings = createMappingResult([createMapping('textField', 'Test')]);

      const result = await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(result.success).toBe(true);
      expect(result.failedFields).toHaveLength(0);
    });

    it('should return success=false when failures exist', async () => {
      (mockTextField.setText as jest.Mock).mockImplementation(() => {
        throw new Error('Error');
      });
      const mappings = createMappingResult([createMapping('textField', 'Test')]);

      const result = await filler.fillPDFForm('/test/form.pdf', mappings, '/test/output.pdf');

      expect(result.success).toBe(false);
      expect(result.failedFields.length).toBeGreaterThan(0);
    });
  });
});
