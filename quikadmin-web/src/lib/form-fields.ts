/**
 * Form field definitions and utilities
 *
 * Defines required fields for common form types and provides
 * utilities for detecting missing fields.
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
