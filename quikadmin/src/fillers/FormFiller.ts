import { PDFDocument, PDFForm, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from 'pdf-lib';
import * as fs from 'fs/promises';
import { MappingResult } from '../mappers/FieldMapper';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';

export interface FillResult {
  success: boolean;
  filledFields: string[];
  failedFields: { field: string; reason: string }[];
  outputPath?: string;
  warnings: string[];
}

export class FormFiller {
  async fillPDFForm(
    pdfPath: string,
    mappings: MappingResult,
    outputPath: string
  ): Promise<FillResult> {
    const filledFields: string[] = [];
    const failedFields: { field: string; reason: string }[] = [];
    const warnings: string[] = [...mappings.warnings];

    try {
      // Load the PDF
      const pdfBytes = await fs.readFile(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const form = pdfDoc.getForm();

      // Get all form fields
      const fields = form.getFields();
      const fieldNames = fields.map(field => field.getName());

      logger.info(`Found ${fields.length} form fields in PDF`);

      // Fill each mapped field
      for (const mapping of mappings.mappings) {
        try {
          const field = form.getField(mapping.formField);
          
          if (!field) {
            warnings.push(`Field '${mapping.formField}' not found in form`);
            continue;
          }

          // Fill based on field type
          if (field instanceof PDFTextField) {
            field.setText(String(mapping.value));
            filledFields.push(mapping.formField);
          } else if (field instanceof PDFCheckBox) {
            if (this.parseBoolean(mapping.value)) {
              field.check();
            } else {
              field.uncheck();
            }
            filledFields.push(mapping.formField);
          } else if (field instanceof PDFDropdown) {
            const options = field.getOptions();
            const valueStr = String(mapping.value);
            
            if (options.includes(valueStr)) {
              field.select(valueStr);
              filledFields.push(mapping.formField);
            } else {
              warnings.push(`Value '${valueStr}' not found in dropdown options for field '${mapping.formField}'`);
            }
          } else if (field instanceof PDFRadioGroup) {
            const options = field.getOptions();
            const valueStr = String(mapping.value);
            
            if (options.includes(valueStr)) {
              field.select(valueStr);
              filledFields.push(mapping.formField);
            } else {
              warnings.push(`Value '${valueStr}' not found in radio options for field '${mapping.formField}'`);
            }
          } else {
            warnings.push(`Unknown field type for '${mapping.formField}'`);
          }

          // Log low confidence mappings
          if (mapping.confidence < 0.7) {
            warnings.push(`Low confidence (${(mapping.confidence * 100).toFixed(1)}%) for field '${mapping.formField}'`);
          }
        } catch (error) {
          failedFields.push({
            field: mapping.formField,
            reason: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Report unmapped form fields
      for (const unmappedField of mappings.unmappedFormFields) {
        warnings.push(`No data found for form field '${unmappedField}'`);
      }

      // Flatten form if requested (makes fields non-editable)
      if (process.env.FLATTEN_FORMS === 'true') {
        form.flatten();
      }

      // Save the filled PDF
      const filledPdfBytes = await pdfDoc.save();
      await fs.writeFile(outputPath, filledPdfBytes);

      return {
        success: failedFields.length === 0,
        filledFields,
        failedFields,
        outputPath,
        warnings
      };
    } catch (error) {
      logger.error('Form filling error:', error);
      throw new Error(`Failed to fill PDF form: ${error}`);
    }
  }

  private parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'checked';
    }
    return Boolean(value);
  }

  async fillMultipleForms(
    pdfPaths: string[],
    mappings: MappingResult,
    outputDir: string
  ): Promise<FillResult[]> {
    const results: FillResult[] = [];

    for (let i = 0; i < pdfPaths.length; i++) {
      const pdfPath = pdfPaths[i];
      const outputPath = `${outputDir}/filled_form_${i + 1}.pdf`;
      
      try {
        const result = await this.fillPDFForm(pdfPath, mappings, outputPath);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          filledFields: [],
          failedFields: [{
            field: 'ALL',
            reason: error instanceof Error ? error.message : 'Unknown error'
          }],
          warnings: [`Failed to process PDF: ${pdfPath}`]
        });
      }
    }

    return results;
  }

  async validateFormFields(pdfPath: string): Promise<{
    fields: string[];
    fieldTypes: Record<string, string>;
  }> {
    try {
      const pdfBytes = await fs.readFile(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      const fieldInfo: Record<string, string> = {};
      const fieldNames: string[] = [];

      for (const field of fields) {
        const name = field.getName();
        fieldNames.push(name);
        
        if (field instanceof PDFTextField) {
          fieldInfo[name] = 'text';
        } else if (field instanceof PDFCheckBox) {
          fieldInfo[name] = 'checkbox';
        } else if (field instanceof PDFDropdown) {
          fieldInfo[name] = 'dropdown';
        } else if (field instanceof PDFRadioGroup) {
          fieldInfo[name] = 'radio';
        } else {
          fieldInfo[name] = 'unknown';
        }
      }

      return {
        fields: fieldNames,
        fieldTypes: fieldInfo
      };
    } catch (error) {
      logger.error('Form validation error:', error);
      throw new Error(`Failed to validate form fields: ${error}`);
    }
  }
}