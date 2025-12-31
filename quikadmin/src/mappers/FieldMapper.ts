import { ExtractedData } from '../extractors/DataExtractor';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';

export interface FieldMapping {
  formField: string;
  dataSource: string;
  value: unknown;
  confidence: number;
  mappingMethod: string;
}

export interface MappingResult {
  mappings: FieldMapping[];
  unmappedFormFields: string[];
  unmappedDataFields: string[];
  overallConfidence: number;
  warnings: string[];
}

export class FieldMapper {
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.5;

  async mapFields(extractedData: ExtractedData, formFields: string[]): Promise<MappingResult> {
    const mappings: FieldMapping[] = [];
    const mappedFormFields = new Set<string>();
    const mappedDataFields = new Set<string>();
    const warnings: string[] = [];

    // Create normalized versions of form fields
    const normalizedFormFields = formFields.map((field) => ({
      original: field,
      normalized: this.normalizeFieldName(field),
    }));

    // Detect normalized duplicates
    const normalizationMap = new Map<string, string[]>();
    for (const field of normalizedFormFields) {
      const norm = field.normalized;
      if (!normalizationMap.has(norm)) {
        normalizationMap.set(norm, []);
      }
      normalizationMap.get(norm)!.push(field.original);
    }

    // Track duplicates for warning and identify which normalized keys are duplicated
    const duplicateNormalizedKeys = new Set<string>();
    for (const [norm, originals] of normalizationMap.entries()) {
      if (originals.length > 1) {
        duplicateNormalizedKeys.add(norm);
        warnings.push(
          `Multiple form fields normalize to '${norm}': ${originals.join(', ')} - all will receive same value`
        );
        logger.warn(`Duplicate normalized field detected: ${norm} (${originals.join(', ')})`);
      }
    }

    // Map extracted fields to form fields
    for (const formField of normalizedFormFields) {
      const bestMatch = this.findBestMatch(formField.normalized, extractedData, mappedDataFields);

      if (bestMatch && bestMatch.confidence >= this.MIN_CONFIDENCE_THRESHOLD) {
        mappings.push({
          formField: formField.original,
          dataSource: bestMatch.source,
          value: bestMatch.value,
          confidence: bestMatch.confidence,
          mappingMethod: bestMatch.method,
        });

        mappedFormFields.add(formField.original);
        // Only mark data field as mapped if this form field is NOT a duplicate
        // This allows duplicate form fields to all map to the same data field
        if (!duplicateNormalizedKeys.has(formField.normalized)) {
          mappedDataFields.add(bestMatch.source);
        }
      }
    }

    // Identify unmapped fields
    const unmappedFormFields = formFields.filter((f) => !mappedFormFields.has(f));
    const allDataFields = [
      ...Object.keys(extractedData.fields),
      ...Object.keys(extractedData.entities),
    ];
    const unmappedDataFields = allDataFields.filter((f) => !mappedDataFields.has(f));

    // Calculate overall confidence
    const overallConfidence =
      mappings.length > 0
        ? mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length
        : 0;

    return {
      mappings,
      unmappedFormFields,
      unmappedDataFields,
      overallConfidence,
      warnings,
    };
  }

  private findBestMatch(
    normalizedFormField: string,
    extractedData: ExtractedData,
    mappedDataFields: Set<string>
  ): { source: string; value: unknown; confidence: number; method: string } | null {
    let bestMatch: { source: string; value: unknown; confidence: number; method: string } | null =
      null;
    let bestConfidence = 0;

    // Check direct field matches
    for (const [fieldName, fieldValue] of Object.entries(extractedData.fields)) {
      if (mappedDataFields.has(fieldName)) continue;

      const confidence = this.calculateSimilarity(
        normalizedFormField,
        this.normalizeFieldName(fieldName)
      );

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = {
          source: fieldName,
          value: fieldValue,
          confidence,
          method: 'Direct Field Match',
        };
      }
    }

    // Check entity matches based on field type
    const entityMapping = this.mapToEntity(normalizedFormField, extractedData.entities);
    if (entityMapping && entityMapping.confidence > bestConfidence) {
      bestMatch = entityMapping;
    }

    // Apply type-based validation boost
    if (bestMatch) {
      bestMatch.confidence = this.applyTypeValidation(
        normalizedFormField,
        bestMatch.value,
        bestMatch.confidence
      );
    }

    return bestMatch;
  }

  private mapToEntity(
    formField: string,
    entities: ExtractedData['entities']
  ): { source: string; value: unknown; confidence: number; method: string } | null {
    const fieldLower = formField.toLowerCase();

    // Map based on common field patterns
    if (fieldLower.includes('email') || fieldLower.includes('e_mail')) {
      if (entities.emails.length > 0) {
        return {
          source: 'entities.emails',
          value: entities.emails[0],
          confidence: 0.9,
          method: 'Entity Pattern Match',
        };
      }
    }

    if (
      fieldLower.includes('phone') ||
      fieldLower.includes('tel') ||
      fieldLower.includes('mobile')
    ) {
      if (entities.phones.length > 0) {
        return {
          source: 'entities.phones',
          value: entities.phones[0],
          confidence: 0.9,
          method: 'Entity Pattern Match',
        };
      }
    }

    if (fieldLower.includes('name') && !fieldLower.includes('company')) {
      if (entities.names.length > 0) {
        return {
          source: 'entities.names',
          value: entities.names[0],
          confidence: 0.85,
          method: 'Entity Pattern Match',
        };
      }
    }

    if (fieldLower.includes('date') || fieldLower.includes('dob')) {
      if (entities.dates.length > 0) {
        return {
          source: 'entities.dates',
          value: entities.dates[0],
          confidence: 0.8,
          method: 'Entity Pattern Match',
        };
      }
    }

    if (fieldLower.includes('address') || fieldLower.includes('street')) {
      if (entities.addresses.length > 0) {
        return {
          source: 'entities.addresses',
          value: entities.addresses[0],
          confidence: 0.75,
          method: 'Entity Pattern Match',
        };
      }
    }

    if (
      fieldLower.includes('amount') ||
      fieldLower.includes('price') ||
      fieldLower.includes('cost')
    ) {
      if (entities.currencies.length > 0) {
        return {
          source: 'entities.currencies',
          value: entities.currencies[0],
          confidence: 0.7,
          method: 'Entity Pattern Match',
        };
      }
    }

    return null;
  }

  private normalizeFieldName(field: string): string {
    return field
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Levenshtein distance-based similarity
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;

    const distance = this.levenshteinDistance(str1, str2);
    return 1 - distance / maxLen;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private applyTypeValidation(field: string, value: unknown, confidence: number): number {
    const fieldLower = field.toLowerCase();
    const valueStr = String(value);

    // Boost confidence if value matches expected type
    if (fieldLower.includes('email') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valueStr)) {
      return Math.min(confidence * 1.2, 1);
    }

    if (
      (fieldLower.includes('phone') || fieldLower.includes('tel')) &&
      /^\+?\d[\d\s\-()]+$/.test(valueStr)
    ) {
      return Math.min(confidence * 1.2, 1);
    }

    if (fieldLower.includes('date') && /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(valueStr)) {
      return Math.min(confidence * 1.15, 1);
    }

    if (
      (fieldLower.includes('zip') || fieldLower.includes('postal')) &&
      /^\d{5}(-\d{4})?$/.test(valueStr)
    ) {
      return Math.min(confidence * 1.2, 1);
    }

    return confidence;
  }
}
