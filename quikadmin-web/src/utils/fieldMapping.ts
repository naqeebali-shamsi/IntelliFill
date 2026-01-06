/**
 * Field Mapping Utilities
 *
 * Simple fuzzy matching and validation for form field mapping.
 * Uses basic string similarity without external libraries.
 */

import type { FormField, DocumentData, FieldMapping } from '@/types/formFilling';

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching field names
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Calculate distances
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Normalize field name for comparison
 * - Lowercase
 * - Remove special characters
 * - Remove common prefixes/suffixes
 */
function normalizeFieldName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove special chars
    .replace(/^(form|field|input|data)/, '') // Remove common prefixes
    .replace(/(field|input|data)$/, ''); // Remove common suffixes
}

/**
 * Calculate confidence score for a field mapping
 * Returns 0-100 based on string similarity
 */
export function calculateConfidence(formFieldName: string, documentFieldName: string): number {
  const norm1 = normalizeFieldName(formFieldName);
  const norm2 = normalizeFieldName(documentFieldName);

  // Exact match after normalization
  if (norm1 === norm2) {
    return 100;
  }

  // Contains check (one is substring of other)
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return 85;
  }

  // Levenshtein distance similarity
  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 0;

  const distance = levenshteinDistance(norm1, norm2);
  const similarity = ((maxLen - distance) / maxLen) * 100;

  // Apply threshold: only consider meaningful similarities
  return similarity >= 50 ? Math.round(similarity) : 0;
}

/**
 * Generate automatic field mappings using fuzzy matching
 * Returns mappings sorted by confidence (highest first)
 */
export function generateAutoMappings(
  formFields: FormField[],
  documentData: DocumentData
): FieldMapping[] {
  const documentFieldNames = Object.keys(documentData);
  const mappings: FieldMapping[] = [];

  for (const formField of formFields) {
    let bestMatch: { field: string; confidence: number } | null = null;

    // Find best matching document field
    for (const docField of documentFieldNames) {
      const confidence = calculateConfidence(formField.name, docField);

      // Only consider matches above 60% confidence
      if (confidence >= 60) {
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { field: docField, confidence };
        }
      }
    }

    // Add mapping (or null if no good match found)
    mappings.push({
      formField: formField.name,
      documentField: bestMatch?.field || null,
      confidence: bestMatch?.confidence || 0,
      manualOverride: false,
    });
  }

  return mappings;
}

/**
 * Validate field mappings
 * Checks if required fields are mapped
 */
export function validateMappings(
  formFields: FormField[],
  mappings: FieldMapping[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check if all required fields are mapped
  for (const field of formFields) {
    if (field.required) {
      const mapping = mappings.find((m) => m.formField === field.name);
      if (!mapping || !mapping.documentField) {
        errors.push(`Required field "${field.name}" is not mapped`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get confidence color for UI display
 * Returns semantic token class based on confidence score
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 90) return 'text-[var(--feedback-success-text)]';
  if (confidence >= 70) return 'text-[var(--feedback-warning-text)]';
  return 'text-[var(--feedback-error-text)]';
}

/**
 * Get confidence badge variant
 * Returns badge variant based on confidence score
 */
export function getConfidenceBadgeVariant(
  confidence: number
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (confidence >= 90) return 'default';
  if (confidence >= 70) return 'secondary';
  if (confidence > 0) return 'outline';
  return 'destructive';
}
