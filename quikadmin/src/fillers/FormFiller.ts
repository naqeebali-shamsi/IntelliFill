import {
  PDFDocument,
  PDFForm,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFOptionList,
} from 'pdf-lib';
import * as fs from 'fs/promises';
import { MappingResult } from '../mappers/FieldMapper';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { getFileBuffer } from '../utils/fileReader';

export interface FillResult {
  success: boolean;
  filledFields: string[];
  failedFields: { field: string; reason: string }[];
  outputPath?: string;
  warnings: string[];
}

/**
 * Simplified fill result for direct data filling (without MappingResult)
 */
export interface SimpleFillResult {
  success: boolean;
  filledFields: string[];
  unmappedFields: string[];
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
      // Load the PDF using shared fileReader utility (supports both local paths and R2 URLs)
      const pdfBytes = await getFileBuffer(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const form = pdfDoc.getForm();

      // Get all form fields
      const fields = form.getFields();
      const fieldNames = fields.map((field) => field.getName());

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
            const bestMatch = this.findBestOptionMatch(valueStr, options);

            if (bestMatch) {
              field.select(bestMatch);
              filledFields.push(mapping.formField);
              if (bestMatch.toLowerCase() !== valueStr.toLowerCase()) {
                logger.debug(
                  `Smart matched '${valueStr}' to dropdown option '${bestMatch}' for field '${mapping.formField}'`
                );
              }
            } else {
              warnings.push(
                `Value '${valueStr}' not found in dropdown options [${options.join(', ')}] for field '${mapping.formField}'`
              );
            }
          } else if (field instanceof PDFRadioGroup) {
            const options = field.getOptions();
            const valueStr = String(mapping.value);
            const bestMatch = this.findBestOptionMatch(valueStr, options);

            if (bestMatch) {
              field.select(bestMatch);
              filledFields.push(mapping.formField);
              if (bestMatch.toLowerCase() !== valueStr.toLowerCase()) {
                logger.debug(
                  `Smart matched '${valueStr}' to radio option '${bestMatch}' for field '${mapping.formField}'`
                );
              }
            } else {
              warnings.push(
                `Value '${valueStr}' not found in radio options [${options.join(', ')}] for field '${mapping.formField}'`
              );
            }
          } else if (field instanceof PDFOptionList) {
            // Multi-select list - can select multiple options
            const options = field.getOptions();
            const valueStr = String(mapping.value);

            // Handle comma-separated values for multi-select
            const valuesToSelect = valueStr.includes(',')
              ? valueStr.split(',').map(v => v.trim())
              : [valueStr];

            const selectedOptions: string[] = [];
            for (const val of valuesToSelect) {
              const bestMatch = this.findBestOptionMatch(val, options);
              if (bestMatch && !selectedOptions.includes(bestMatch)) {
                selectedOptions.push(bestMatch);
              }
            }

            if (selectedOptions.length > 0) {
              field.select(selectedOptions);
              filledFields.push(mapping.formField);
              logger.debug(
                `Selected options [${selectedOptions.join(', ')}] for option list field '${mapping.formField}'`
              );
            } else {
              warnings.push(
                `Value '${valueStr}' not found in option list [${options.join(', ')}] for field '${mapping.formField}'`
              );
            }
          } else {
            warnings.push(`Unknown field type for '${mapping.formField}'`);
          }

          // Log low confidence mappings
          if (mapping.confidence < 0.7) {
            warnings.push(
              `Low confidence (${(mapping.confidence * 100).toFixed(1)}%) for field '${mapping.formField}'`
            );
          }
        } catch (error) {
          failedFields.push({
            field: mapping.formField,
            reason: error instanceof Error ? error.message : 'Unknown error',
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
        warnings,
      };
    } catch (error) {
      logger.error('Form filling error:', error);
      throw new Error(`Failed to fill PDF form: ${error}`);
    }
  }

  /**
   * Parse a value as boolean for checkbox fields
   * Supports various affirmative values including marital status
   */
  parseBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      // Direct boolean values
      if (['true', 'yes', 'y', '1', 'checked', 'x', 'on'].includes(lower)) {
        return true;
      }
      // Marital status - "married" means checkbox should be checked
      if (['married', 'wed', 'spouse'].includes(lower)) {
        return true;
      }
      // Explicit false values
      if (['false', 'no', 'n', '0', 'unchecked', 'off', 'single', 'unmarried', 'divorced', 'widowed'].includes(lower)) {
        return false;
      }
    }
    return Boolean(value);
  }

  /**
   * Common abbreviations and variations for smart matching
   */
  private static readonly VALUE_MAPPINGS: Record<string, string[]> = {
    // Gender variations
    male: ['m', 'male', 'man', 'mr'],
    female: ['f', 'female', 'woman', 'mrs', 'ms'],
    // Yes/No variations
    yes: ['y', 'yes', 'true', '1', 'on', 'checked'],
    no: ['n', 'no', 'false', '0', 'off', 'unchecked'],
    // Country abbreviations (common ones)
    'united arab emirates': ['uae', 'u.a.e.', 'united arab emirates'],
    'united states': ['usa', 'us', 'u.s.', 'u.s.a.', 'united states', 'united states of america'],
    'united kingdom': ['uk', 'u.k.', 'united kingdom', 'great britain', 'gb'],
    // Marital status
    single: ['s', 'single', 'unmarried'],
    married: ['m', 'married'],
    divorced: ['d', 'divorced'],
    widowed: ['w', 'widowed'],
  };

  /**
   * Smart match a value against available options
   * Returns the best matching option or null if no match found
   */
  findBestOptionMatch(value: string, options: string[]): string | null {
    if (!value || options.length === 0) return null;

    const valueLower = value.toLowerCase().trim();
    const optionsLower = options.map((o) => o.toLowerCase().trim());

    // 1. Exact match
    const exactIndex = optionsLower.indexOf(valueLower);
    if (exactIndex !== -1) return options[exactIndex];

    // 2. Check if value matches any known variation
    for (const [canonical, variations] of Object.entries(FormFiller.VALUE_MAPPINGS)) {
      if (variations.includes(valueLower) || canonical === valueLower) {
        // Found a known value - look for any variation in options
        for (const variation of variations) {
          const varIndex = optionsLower.indexOf(variation);
          if (varIndex !== -1) return options[varIndex];
        }
        // Also check if canonical form is in options
        const canonIndex = optionsLower.indexOf(canonical);
        if (canonIndex !== -1) return options[canonIndex];
      }
    }

    // 3. Check if any option is a variation of the value
    for (const [canonical, variations] of Object.entries(FormFiller.VALUE_MAPPINGS)) {
      for (let i = 0; i < optionsLower.length; i++) {
        if (variations.includes(optionsLower[i]) || optionsLower[i] === canonical) {
          // This option is a known variation - check if value matches
          if (variations.includes(valueLower) || valueLower === canonical) {
            return options[i];
          }
        }
      }
    }

    // 4. Partial match - value contains option or option contains value
    for (let i = 0; i < optionsLower.length; i++) {
      if (valueLower.includes(optionsLower[i]) || optionsLower[i].includes(valueLower)) {
        return options[i];
      }
    }

    // 5. First letter match for single-letter options (M for Male, F for Female)
    if (valueLower.length > 1) {
      const firstLetter = valueLower[0];
      const singleLetterIndex = optionsLower.findIndex((o) => o === firstLetter);
      if (singleLetterIndex !== -1) return options[singleLetterIndex];
    }

    // 6. Levenshtein-like similarity for close matches (typos)
    const bestSimilar = this.findMostSimilarOption(valueLower, options, optionsLower);
    if (bestSimilar) return bestSimilar;

    return null;
  }

  /**
   * Find the most similar option using basic string similarity
   */
  private findMostSimilarOption(
    value: string,
    options: string[],
    optionsLower: string[]
  ): string | null {
    let bestMatch: string | null = null;
    let bestScore = 0;
    const threshold = 0.6; // Minimum similarity threshold

    for (let i = 0; i < optionsLower.length; i++) {
      const score = this.stringSimilarity(value, optionsLower[i]);
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestMatch = options[i];
      }
    }

    return bestMatch;
  }

  /**
   * Simple string similarity (Dice coefficient)
   */
  private stringSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;

    const getBigrams = (s: string): Set<string> => {
      const bigrams = new Set<string>();
      for (let i = 0; i < s.length - 1; i++) {
        bigrams.add(s.substring(i, i + 2));
      }
      return bigrams;
    };

    const bigramsA = getBigrams(a);
    const bigramsB = getBigrams(b);
    let intersection = 0;

    for (const bigram of bigramsA) {
      if (bigramsB.has(bigram)) intersection++;
    }

    return (2 * intersection) / (bigramsA.size + bigramsB.size);
  }

  /**
   * Fill a PDF form using field mappings and profile data directly
   *
   * This is a convenience method that accepts a simpler data format than fillPDFForm.
   * Use when you have field mappings (formField -> profileField) and profile data
   * (profileField -> value) separately.
   *
   * @param pdfPath - Path to the PDF template file
   * @param fieldMappings - Map of form field names to profile field names
   * @param profileData - Map of profile field names to values
   * @param outputPath - Where to save the filled PDF
   * @returns Fill result with filled/unmapped fields and warnings
   */
  async fillPDFFormWithData(
    pdfPath: string,
    fieldMappings: Record<string, string>,
    profileData: Record<string, unknown>,
    outputPath: string
  ): Promise<SimpleFillResult> {
    const filledFields: string[] = [];
    const unmappedFields: string[] = [];
    const warnings: string[] = [];

    try {
      // Load the PDF using shared fileReader utility (supports both local paths and R2 URLs)
      const pdfBytes = await getFileBuffer(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      logger.info(`Filling form with ${fields.length} fields`);

      // Fill each mapped field
      for (const field of fields) {
        const formFieldName = field.getName();
        const profileFieldName = fieldMappings[formFieldName];

        if (!profileFieldName) {
          unmappedFields.push(formFieldName);
          continue;
        }

        const value = profileData[profileFieldName];

        if (value === undefined || value === null || value === '') {
          warnings.push(
            `No data for profile field '${profileFieldName}' (form field: ${formFieldName})`
          );
          continue;
        }

        try {
          // Fill based on field type
          if (field instanceof PDFTextField) {
            field.setText(String(value));
            filledFields.push(formFieldName);
          } else if (field instanceof PDFCheckBox) {
            if (this.parseBoolean(value)) {
              field.check();
            } else {
              field.uncheck();
            }
            filledFields.push(formFieldName);
          } else if (field instanceof PDFDropdown) {
            const options = field.getOptions();
            const valueStr = String(value);
            const bestMatch = this.findBestOptionMatch(valueStr, options);

            if (bestMatch) {
              field.select(bestMatch);
              filledFields.push(formFieldName);
              if (bestMatch.toLowerCase() !== valueStr.toLowerCase()) {
                logger.debug(
                  `Smart matched '${valueStr}' to dropdown option '${bestMatch}' for field '${formFieldName}'`
                );
              }
            } else {
              warnings.push(
                `Value '${valueStr}' not in dropdown options [${options.join(', ')}] for '${formFieldName}'`
              );
            }
          } else if (field instanceof PDFRadioGroup) {
            const options = field.getOptions();
            const valueStr = String(value);
            const bestMatch = this.findBestOptionMatch(valueStr, options);

            if (bestMatch) {
              field.select(bestMatch);
              filledFields.push(formFieldName);
              if (bestMatch.toLowerCase() !== valueStr.toLowerCase()) {
                logger.debug(
                  `Smart matched '${valueStr}' to radio option '${bestMatch}' for field '${formFieldName}'`
                );
              }
            } else {
              warnings.push(
                `Value '${valueStr}' not in radio options [${options.join(', ')}] for '${formFieldName}'`
              );
            }
          } else if (field instanceof PDFOptionList) {
            // Multi-select list - can select multiple options
            const options = field.getOptions();
            const valueStr = String(value);

            // Handle comma-separated values for multi-select
            const valuesToSelect = valueStr.includes(',')
              ? valueStr.split(',').map(v => v.trim())
              : [valueStr];

            const selectedOptions: string[] = [];
            for (const val of valuesToSelect) {
              const bestMatch = this.findBestOptionMatch(val, options);
              if (bestMatch && !selectedOptions.includes(bestMatch)) {
                selectedOptions.push(bestMatch);
              }
            }

            if (selectedOptions.length > 0) {
              field.select(selectedOptions);
              filledFields.push(formFieldName);
              logger.debug(
                `Selected options [${selectedOptions.join(', ')}] for option list field '${formFieldName}'`
              );
            } else {
              warnings.push(
                `Value '${valueStr}' not in option list [${options.join(', ')}] for '${formFieldName}'`
              );
            }
          } else {
            warnings.push(`Unknown field type for '${formFieldName}'`);
          }
        } catch (fieldError) {
          warnings.push(
            `Failed to fill field '${formFieldName}': ${fieldError instanceof Error ? fieldError.message : 'Unknown error'}`
          );
        }
      }

      // Flatten form if requested (makes fields non-editable)
      if (process.env.FLATTEN_FORMS === 'true') {
        form.flatten();
      }

      // Save the filled PDF
      await fs.mkdir(outputPath.substring(0, outputPath.lastIndexOf('/')), { recursive: true });
      const filledPdfBytes = await pdfDoc.save();
      await fs.writeFile(outputPath, filledPdfBytes);

      return {
        success: true,
        filledFields,
        unmappedFields,
        warnings,
      };
    } catch (error) {
      logger.error('Error filling PDF form:', error);
      throw new Error(
        `Failed to fill PDF form: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
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
          failedFields: [
            {
              field: 'ALL',
              reason: error instanceof Error ? error.message : 'Unknown error',
            },
          ],
          warnings: [`Failed to process PDF: ${pdfPath}`],
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
      // Use shared fileReader utility (supports both local paths and R2 URLs)
      const pdfBytes = await getFileBuffer(pdfPath);
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
        } else if (field instanceof PDFOptionList) {
          fieldInfo[name] = 'optionlist';
        } else {
          fieldInfo[name] = 'unknown';
        }
      }

      return {
        fields: fieldNames,
        fieldTypes: fieldInfo,
      };
    } catch (error) {
      logger.error('Form validation error:', error);
      throw new Error(`Failed to validate form fields: ${error}`);
    }
  }
}

// Export singleton instance for convenience
export const formFiller = new FormFiller();
