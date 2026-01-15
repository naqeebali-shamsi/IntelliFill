/**
 * Smart Profile Service
 *
 * API service functions for the Smart Profile wizard flow.
 * Handles document type detection and batch extraction.
 */

import api from './api';

// Types matching backend response structures

export interface DetectionResult {
  fileId: string;
  fileName: string;
  detectedType: 'PASSPORT' | 'EMIRATES_ID' | 'DRIVERS_LICENSE' | 'BANK_STATEMENT' | 'OTHER';
  confidence: number;
  alternativeTypes?: Array<{ type: string; confidence: number }>;
  error?: string;
}

export interface DetectTypesResponse {
  success: boolean;
  results: DetectionResult[];
  totalFiles: number;
  detectedCount: number;
  errorCount: number;
}

export interface FieldSource {
  documentId: string;
  documentName: string;
  confidence: number;
  extractedAt: string;
}

export interface LowConfidenceField {
  fieldName: string;
  value: unknown;
  confidence: number;
  documentId: string;
  documentName: string;
}

/** Detected person from entity resolution */
export interface DetectedPerson {
  id: string;
  name: string | null;
  confidence: number;
  documentIds: string[];
}

/** Suggested merge from entity resolution */
export interface SuggestedMerge {
  groupIds: [string, string];
  confidence: number;
  reason: string;
}

/** Field conflict when multiple documents have different values */
export interface FieldConflict {
  fieldName: string;
  values: Array<{
    value: unknown;
    source: {
      documentId: string;
      documentName: string;
      confidence: number;
    };
  }>;
  selectedIndex: number;
  customValue?: string;
}

export interface ExtractBatchResponse {
  success: boolean;
  profileData: Record<string, unknown>;
  fieldSources: Record<string, FieldSource>;
  lowConfidenceFields: LowConfidenceField[];
  /** Field conflicts when multiple documents have different values (optional) */
  conflicts?: FieldConflict[];
  /** Detected people from entity resolution (optional, may not be present in older API responses) */
  detectedPeople?: DetectedPerson[];
  /** Suggested merges from entity resolution (optional) */
  suggestedMerges?: SuggestedMerge[];
  processingTime: number;
  documentsProcessed: number;
  totalFieldsExtracted: number;
}

/**
 * Detect document types for uploaded files.
 *
 * @param files - Array of File objects to detect types for
 * @returns Detection results with confidence scores
 */
export async function detectTypes(files: File[]): Promise<DetectTypesResponse> {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await api.post<DetectTypesResponse>('/smart-profile/detect-types', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

/**
 * Extract data from multiple documents in a batch.
 *
 * @param files - Array of File objects to extract data from
 * @param documentTypes - Array of document types (same order as files)
 * @returns Merged profile data with field sources and low confidence fields
 */
export async function extractBatch(
  files: File[],
  documentTypes: string[]
): Promise<ExtractBatchResponse> {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append('files', file);
  });

  documentTypes.forEach((type) => {
    formData.append('documentTypes', type);
  });

  const response = await api.post<ExtractBatchResponse>('/smart-profile/extract-batch', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

export const smartProfileService = {
  detectTypes,
  extractBatch,
};

export default smartProfileService;
