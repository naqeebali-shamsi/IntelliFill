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

export interface DocumentData {
  [key: string]: any;
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
