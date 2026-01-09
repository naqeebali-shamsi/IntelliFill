/**
 * ExtractedData Types and Utilities
 *
 * Defines the structure for extracted field results with confidence scores
 * and provides utilities for transforming between legacy and new formats.
 *
 * @module types/extractedData
 */

/**
 * Result of extracting a single field from a document
 * Includes confidence score and source information for transparency
 */
export interface ExtractedFieldResult {
  /** Extracted value - can be string, number, boolean, or null if extraction failed */
  value: string | number | boolean | null;
  /** Confidence score from 0-100 indicating extraction reliability */
  confidence: number;
  /** Source of extraction: ocr (raw text match), pattern (regex), or llm (AI-assisted) */
  source: 'ocr' | 'pattern' | 'llm';
  /** Optional raw text that was matched before normalization */
  rawText?: string;
}

/**
 * New format for extracted data with per-field confidence scores
 * Used in Document.extractedData field
 */
export interface ExtractedDataWithConfidence {
  [fieldName: string]: ExtractedFieldResult;
}

/**
 * Legacy format for extracted data (simple key-value pairs)
 * Maintained for backward compatibility
 */
export interface LegacyExtractedData {
  [fieldName: string]: string | number | boolean | null | string[];
}

/**
 * Flattened format for backward compatibility
 * Returns just the values without confidence information
 */
export interface FlattenedExtractedData {
  [fieldName: string]: string | number | boolean | null;
}

/**
 * Type guard to check if data is in the new ExtractedFieldResult format
 */
export function isExtractedFieldResult(value: unknown): value is ExtractedFieldResult {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    'value' in obj &&
    'confidence' in obj &&
    'source' in obj &&
    typeof obj.confidence === 'number' &&
    ['ocr', 'pattern', 'llm'].includes(obj.source as string)
  );
}

/**
 * Type guard to check if extracted data is in the new format (with confidence)
 */
export function isExtractedDataWithConfidence(
  data: unknown
): data is ExtractedDataWithConfidence {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const obj = data as Record<string, unknown>;
  const keys = Object.keys(obj);

  // Empty object could be either format
  if (keys.length === 0) {
    return false;
  }

  // Check if at least one field matches the new format
  return keys.some((key) => isExtractedFieldResult(obj[key]));
}

/**
 * Convert legacy extracted data to the new format with confidence scores
 *
 * @param legacyData - Legacy extracted data (simple key-value pairs)
 * @param defaultConfidence - Default confidence score (0-100), defaults to 0
 * @param defaultSource - Default source, defaults to 'pattern'
 * @returns Extracted data in the new format with confidence scores
 */
export function convertLegacyToConfidenceFormat(
  legacyData: LegacyExtractedData,
  defaultConfidence: number = 0,
  defaultSource: 'ocr' | 'pattern' | 'llm' = 'pattern'
): ExtractedDataWithConfidence {
  const result: ExtractedDataWithConfidence = {};

  for (const [key, value] of Object.entries(legacyData)) {
    // Skip null/undefined values
    if (value === null || value === undefined) {
      continue;
    }

    // Handle arrays by taking the first value
    const normalizedValue = Array.isArray(value) ? value[0] ?? null : value;

    result[key] = {
      value: normalizedValue,
      confidence: defaultConfidence,
      source: defaultSource,
      rawText: typeof normalizedValue === 'string' ? normalizedValue : undefined,
    };
  }

  return result;
}

/**
 * Flatten extracted data with confidence to simple key-value pairs
 * Used for backward compatibility when includeConfidence=false
 *
 * @param data - Extracted data with confidence scores
 * @returns Flattened data with just values
 */
export function flattenExtractedData(
  data: ExtractedDataWithConfidence | LegacyExtractedData | null
): FlattenedExtractedData | null {
  if (!data) {
    return null;
  }

  // If already in legacy format, return as-is (handle arrays)
  if (!isExtractedDataWithConfidence(data)) {
    const result: FlattenedExtractedData = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = Array.isArray(value) ? value[0] ?? null : value;
    }
    return result;
  }

  // Convert new format to flattened
  const result: FlattenedExtractedData = {};
  for (const [key, fieldResult] of Object.entries(data)) {
    if (isExtractedFieldResult(fieldResult)) {
      result[key] = fieldResult.value;
    } else {
      // Handle mixed format gracefully
      result[key] = fieldResult as string | number | boolean | null;
    }
  }

  return result;
}

/**
 * Normalize extracted data to the new format
 * Handles both legacy and new format inputs
 *
 * @param data - Extracted data in any format
 * @param defaultConfidence - Default confidence for legacy data
 * @param defaultSource - Default source for legacy data
 * @returns Extracted data in the new format with confidence scores
 */
export function normalizeExtractedData(
  data: ExtractedDataWithConfidence | LegacyExtractedData | null,
  defaultConfidence: number = 0,
  defaultSource: 'ocr' | 'pattern' | 'llm' = 'pattern'
): ExtractedDataWithConfidence | null {
  if (!data) {
    return null;
  }

  // Already in new format
  if (isExtractedDataWithConfidence(data)) {
    return data;
  }

  // Convert from legacy format
  return convertLegacyToConfidenceFormat(
    data as LegacyExtractedData,
    defaultConfidence,
    defaultSource
  );
}

/**
 * Calculate average confidence across all fields
 *
 * @param data - Extracted data with confidence scores
 * @returns Average confidence score (0-100), or 0 if no fields
 */
export function calculateAverageConfidence(
  data: ExtractedDataWithConfidence | null
): number {
  if (!data) {
    return 0;
  }

  const fields = Object.values(data).filter(isExtractedFieldResult);
  if (fields.length === 0) {
    return 0;
  }

  const total = fields.reduce((sum, field) => sum + field.confidence, 0);
  return Math.round(total / fields.length);
}

/**
 * Get fields with confidence below a threshold
 *
 * @param data - Extracted data with confidence scores
 * @param threshold - Confidence threshold (0-100)
 * @returns Array of field names with low confidence
 */
export function getLowConfidenceFields(
  data: ExtractedDataWithConfidence | null,
  threshold: number = 70
): string[] {
  if (!data) {
    return [];
  }

  return Object.entries(data)
    .filter(([, field]) => isExtractedFieldResult(field) && field.confidence < threshold)
    .map(([key]) => key);
}
