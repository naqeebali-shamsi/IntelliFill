/**
 * Form Filling Types
 *
 * Type definitions for the field mapping and form filling functionality.
 * Used by SimpleFillForm page and related components.
 */

export interface FormField {
  name: string;
  type: string; // text, email, number, date, checkbox, etc.
  required?: boolean;
  value?: any;
}

/**
 * Extraction source type
 * Indicates how a field value was extracted from the document
 */
export type ExtractionSource = 'ocr' | 'pattern' | 'llm';

/**
 * New per-field confidence format
 * Provides detailed extraction metadata for each field
 */
export interface ExtractedFieldResult {
  /** The extracted value */
  value: string | number | boolean | null;
  /** Confidence score from 0-100 */
  confidence: number;
  /** How the value was extracted */
  source: ExtractionSource;
  /** Original raw text before normalization (if available) */
  rawText?: string;
}

/**
 * Document data with fields that can be either:
 * - Simple values (string, number, etc.) for backward compatibility
 * - ExtractedFieldResult objects with confidence metadata
 */
export interface DocumentData {
  fields?: Record<string, ExtractedFieldResult | string | number | boolean | null>;
  [key: string]: any;
}

/**
 * Type guard to check if a value is an ExtractedFieldResult
 */
export function isExtractedFieldResult(value: unknown): value is ExtractedFieldResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    'confidence' in value &&
    'source' in value &&
    typeof (value as ExtractedFieldResult).confidence === 'number' &&
    ['ocr', 'pattern', 'llm'].includes((value as ExtractedFieldResult).source)
  );
}

export interface FieldMapping {
  formField: string;
  documentField: string | null; // null = unmapped
  confidence?: number; // 0-100
  manualOverride?: boolean;
}

export interface MappingTemplate {
  id: string;
  name: string;
  description?: string;
  formType?: string;
  usageCount?: number;
  author?: {
    firstName: string;
    lastName: string;
  };
  mappings: Record<string, string>; // formField → documentField
  fieldMappings?: any[];
  createdAt: string;
  updatedAt?: string;
}

export interface FillFormRequest {
  documentId: string;
  formFile: File;
  mappings?: Record<string, string>; // Override auto-mappings
}

export interface FillFormResult {
  documentId: string;
  downloadUrl: string;
  confidence: number;
  filledFields: number;
  totalFields: number;
}
