/**
 * Form field definitions and utilities
 *
 * Defines required fields for common form types and provides
 * utilities for detecting missing fields and suggesting forms.
 *
 * @module lib/form-fields
 */

// ============================================================================
// Required Fields by Form Type
// ============================================================================

/**
 * Required fields for each form type.
 * Field names should match the profile data keys.
 */
export const FORM_REQUIRED_FIELDS: Record<string, string[]> = {
  'visa-application': [
    'fullName',
    'passportNumber',
    'dateOfBirth',
    'nationality',
    'passportExpiry',
  ],
  'emirates-id': ['fullName', 'emiratesIdNumber', 'dateOfBirth', 'nationality'],
  'bank-account': ['fullName', 'emiratesIdNumber', 'address', 'phone'],
  'drivers-license': ['fullName', 'dateOfBirth', 'nationality', 'emiratesIdNumber', 'address'],
  'residence-permit': [
    'fullName',
    'passportNumber',
    'dateOfBirth',
    'nationality',
    'passportExpiry',
    'address',
  ],
  'insurance-application': ['fullName', 'dateOfBirth', 'emiratesIdNumber', 'phone', 'address'],
};

// ============================================================================
// Document Type to Fields Mapping
// ============================================================================

/**
 * Maps which document types typically contain which fields.
 * Used for suggesting which documents to upload for missing fields.
 */
export const DOCUMENT_FIELD_SOURCES: Record<string, string[]> = {
  Passport: [
    'fullName',
    'passportNumber',
    'passportExpiry',
    'dateOfBirth',
    'nationality',
    'placeOfBirth',
    'gender',
  ],
  'Emirates ID': ['fullName', 'emiratesIdNumber', 'emiratesIdExpiry', 'dateOfBirth', 'nationality'],
  "Driver's License": ['fullName', 'licenseNumber', 'licenseExpiry', 'dateOfBirth', 'address'],
  'Bank Statement': ['address', 'accountNumber', 'bankName'],
  'Utility Bill': ['address', 'fullName'],
};

// ============================================================================
// Document to Form Mapping
// ============================================================================

/**
 * Maps which document types help complete which forms.
 * Used for suggesting forms based on uploaded documents.
 *
 * Key: document type (matches DOCUMENT_FIELD_SOURCES keys)
 * Value: array of form IDs this document helps complete
 */
export const DOCUMENT_TO_FORM_MAPPING: Record<string, string[]> = {
  Passport: ['visa-application', 'residence-permit'],
  'Emirates ID': ['emirates-id', 'bank-account', 'drivers-license', 'insurance-application'],
  "Driver's License": ['drivers-license'],
  'Bank Statement': ['bank-account'],
  'Utility Bill': ['bank-account', 'residence-permit', 'insurance-application'],
};

// ============================================================================
// Form Suggestion Types
// ============================================================================

/**
 * A form suggestion based on uploaded documents.
 */
export interface FormSuggestion {
  /** Form type ID */
  formId: string;
  /** Confidence score (0-1) based on document coverage */
  confidence: number;
  /** Document types that matched this form */
  matchedDocuments: string[];
  /** Document types still needed for complete coverage */
  missingDocuments: string[];
  /** Number of required fields that can be filled */
  matchedFieldCount: number;
  /** Total required fields for this form */
  totalFieldCount: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get list of missing fields for a given form type.
 *
 * @param profileData - The current profile data
 * @param formType - The form type to check against
 * @returns Array of missing field names
 *
 * @example
 * ```ts
 * const missing = getMissingFields(
 *   { fullName: 'John Doe', dateOfBirth: '1990-01-01' },
 *   'visa-application'
 * );
 * // Returns: ['passportNumber', 'nationality', 'passportExpiry']
 * ```
 */
export function getMissingFields(profileData: Record<string, unknown>, formType: string): string[] {
  const required = FORM_REQUIRED_FIELDS[formType] || [];
  return required.filter((field) => {
    const value = profileData[field];
    return value === undefined || value === null || value === '';
  });
}

/**
 * Convert camelCase field name to human-readable label.
 *
 * @param fieldName - The camelCase field name
 * @returns Human-readable label
 *
 * @example
 * ```ts
 * getFieldLabel('passportNumber') // Returns: 'Passport Number'
 * getFieldLabel('dateOfBirth') // Returns: 'Date Of Birth'
 * ```
 */
export function getFieldLabel(fieldName: string): string {
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/**
 * Get suggested documents to upload for missing fields.
 *
 * @param missingFields - Array of missing field names
 * @returns Array of document type names that could provide the missing fields
 *
 * @example
 * ```ts
 * getSuggestedDocuments(['passportNumber', 'address'])
 * // Returns: ['Passport', "Driver's License", 'Utility Bill']
 * ```
 */
export function getSuggestedDocuments(missingFields: string[]): string[] {
  const suggestions = new Set<string>();

  for (const field of missingFields) {
    for (const [docType, fields] of Object.entries(DOCUMENT_FIELD_SOURCES)) {
      if (fields.includes(field)) {
        suggestions.add(docType);
      }
    }
  }

  return Array.from(suggestions);
}

/**
 * Get form type label for display.
 *
 * @param formType - The form type key
 * @returns Human-readable form type label
 */
export function getFormTypeLabel(formType: string): string {
  const labels: Record<string, string> = {
    'visa-application': 'Visa Application',
    'emirates-id': 'Emirates ID Application',
    'bank-account': 'Bank Account Opening',
    'drivers-license': "Driver's License Application",
    'residence-permit': 'Residence Permit',
    'insurance-application': 'Insurance Application',
  };
  return labels[formType] || formType;
}

/**
 * Get available form types.
 *
 * @returns Array of available form type keys
 */
export function getAvailableFormTypes(): string[] {
  return Object.keys(FORM_REQUIRED_FIELDS);
}

/**
 * Check if profile has all required fields for a form type.
 *
 * @param profileData - The current profile data
 * @param formType - The form type to check
 * @returns True if all required fields are present
 */
export function hasAllRequiredFields(
  profileData: Record<string, unknown>,
  formType: string
): boolean {
  return getMissingFields(profileData, formType).length === 0;
}

// ============================================================================
// Form Suggestion Functions
// ============================================================================

/**
 * Get documents needed to complete a form.
 *
 * @param formType - The form type to check
 * @returns Array of document type names that can help complete this form
 */
export function getDocumentsForForm(formType: string): string[] {
  const documents = new Set<string>();

  for (const [docType, forms] of Object.entries(DOCUMENT_TO_FORM_MAPPING)) {
    if (forms.includes(formType)) {
      documents.add(docType);
    }
  }

  return Array.from(documents);
}

/**
 * Suggest forms based on uploaded document types.
 * Scores forms by how many required fields can be filled with available documents.
 *
 * @param documentTypes - Array of uploaded document type names
 * @returns Sorted array of form suggestions (highest confidence first)
 *
 * @example
 * ```ts
 * const suggestions = suggestForms(['Passport', 'Emirates ID']);
 * // Returns ranked suggestions like:
 * // [
 * //   { formId: 'visa-application', confidence: 1.0, matchedDocuments: ['Passport'], ... },
 * //   { formId: 'emirates-id', confidence: 0.75, matchedDocuments: ['Emirates ID'], ... },
 * //   ...
 * // ]
 * ```
 */
export function suggestForms(documentTypes: string[]): FormSuggestion[] {
  const suggestions: FormSuggestion[] = [];
  const uploadedDocSet = new Set(documentTypes);

  // Check each form type
  for (const formId of Object.keys(FORM_REQUIRED_FIELDS)) {
    const requiredFields = FORM_REQUIRED_FIELDS[formId];
    const totalFieldCount = requiredFields.length;

    // Find which documents help with this form
    const documentsForThisForm = getDocumentsForForm(formId);
    const matchedDocuments: string[] = [];
    const missingDocuments: string[] = [];

    for (const doc of documentsForThisForm) {
      if (uploadedDocSet.has(doc)) {
        matchedDocuments.push(doc);
      } else {
        missingDocuments.push(doc);
      }
    }

    // Calculate how many fields can be filled by matched documents
    const fieldsCoverable = new Set<string>();
    for (const doc of matchedDocuments) {
      const docFields = DOCUMENT_FIELD_SOURCES[doc] || [];
      for (const field of docFields) {
        if (requiredFields.includes(field)) {
          fieldsCoverable.add(field);
        }
      }
    }
    const matchedFieldCount = fieldsCoverable.size;

    // Calculate confidence as ratio of coverable fields to total required
    const confidence = totalFieldCount > 0 ? matchedFieldCount / totalFieldCount : 0;

    // Only include forms with at least some document coverage
    if (matchedDocuments.length > 0) {
      suggestions.push({
        formId,
        confidence,
        matchedDocuments,
        missingDocuments,
        matchedFieldCount,
        totalFieldCount,
      });
    }
  }

  // Sort by confidence descending, then by form ID for stable order
  suggestions.sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return a.formId.localeCompare(b.formId);
  });

  return suggestions;
}
