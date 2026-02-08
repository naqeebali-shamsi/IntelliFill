/**
 * QA (Quality Assurance) Agent
 *
 * Validates extracted document data against category-specific rules.
 * Identifies issues and determines if human review is required.
 *
 * Features:
 * - Required field validation per category
 * - Format validation (dates, IDs, numbers)
 * - Cross-field validation (e.g., expiry > issue date)
 * - Confidence threshold checks
 * - Human review flagging
 *
 * @module multiagent/agents/qaAgent
 */

import { DocumentCategory } from '../types/state';
import { ExtractedFieldResult } from '../../types/extractedData';
import { piiSafeLogger as logger } from '../../utils/piiSafeLogger';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Result from the QA validation process
 */
export interface QAResult {
  /** Whether all critical validations passed */
  passed: boolean;
  /** Overall quality score (0-100) */
  score: number;
  /** List of identified issues */
  issues: QAIssue[];
  /** Whether human review is recommended */
  requiresHumanReview: boolean;
  /** Summary of validation results */
  summary: QASummary;
}

/**
 * Individual quality issue
 */
export interface QAIssue {
  /** Field that has the issue */
  field: string;
  /** Issue severity */
  severity: 'error' | 'warning' | 'info';
  /** Human-readable issue description */
  message: string;
  /** Suggested fix if available */
  suggestedFix?: string;
  /** Issue type/category */
  issueType: QAIssueType;
}

/**
 * Types of QA issues
 */
export type QAIssueType =
  | 'missing_required'
  | 'invalid_format'
  | 'low_confidence'
  | 'cross_field_mismatch'
  | 'suspicious_value'
  | 'date_validation'
  | 'length_validation'
  | 'pattern_mismatch';

/**
 * Summary of QA results
 */
export interface QASummary {
  /** Total fields validated */
  totalFields: number;
  /** Fields that passed all checks */
  passedFields: number;
  /** Fields with warnings */
  warningFields: number;
  /** Fields with errors */
  errorFields: number;
  /** Average confidence of all fields */
  averageConfidence: number;
}

/**
 * Validation rule definition
 */
interface ValidationRule {
  field: string;
  required: boolean;
  format?: RegExp;
  formatDescription?: string;
  minLength?: number;
  maxLength?: number;
  validator?: (value: string, allFields: Record<string, ExtractedFieldResult>) => ValidationResult;
}

/**
 * Result of a single validation check
 */
interface ValidationResult {
  valid: boolean;
  message?: string;
  suggestedFix?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Confidence thresholds
 */
const CONFIDENCE_THRESHOLDS = {
  /** Minimum acceptable confidence */
  LOW: 50,
  /** Confidence level that triggers a warning */
  WARNING: 70,
  /** Confidence level considered acceptable */
  ACCEPTABLE: 80,
  /** High confidence level */
  HIGH: 90,
} as const;

/**
 * Weights for calculating overall score
 */
const SCORE_WEIGHTS = {
  REQUIRED_FIELD_PRESENT: 20,
  FORMAT_VALID: 15,
  HIGH_CONFIDENCE: 10,
  NO_CROSS_FIELD_ISSUES: 10,
  BASE_SCORE: 45,
} as const;

/**
 * Common date formats for parsing
 */
const DATE_FORMATS = [
  /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
  /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
  /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
  /^\d{2}\.\d{2}\.\d{4}$/, // DD.MM.YYYY
  /^\d{1,2}\s+\w{3}\s+\d{4}$/i, // D MMM YYYY
];

// ============================================================================
// MRZ Checksum Validation (ICAO 9303)
// ============================================================================

/**
 * ICAO 9303 character-to-value mapping for MRZ check digit calculation.
 * 0-9 => 0-9, A-Z => 10-35, < => 0
 */
function mrzCharValue(ch: string): number {
  if (ch === '<') return 0;
  const code = ch.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48; // '0'-'9'
  if (code >= 65 && code <= 90) return code - 55; // 'A'-'Z'
  return 0; // invalid chars treated as filler
}

/**
 * Compute ICAO 9303 check digit over a string using weights 7, 3, 1.
 * Returns a single digit 0-9.
 */
function mrzCheckDigit(input: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    sum += mrzCharValue(input[i]) * weights[i % 3];
  }
  return sum % 10;
}

/**
 * Validate MRZ line 2 check digits for TD3 (passport) format.
 * TD3 line 2 layout (44 chars):
 *   [0-8]   passport number (9 chars)
 *   [9]     check digit for passport number
 *   [10-12] nationality (3 chars)
 *   [13-18] date of birth YYMMDD (6 chars)
 *   [19]    check digit for DOB
 *   [20]    sex
 *   [21-26] date of expiry YYMMDD (6 chars)
 *   [27]    check digit for expiry
 *   [28-42] optional data + check digit
 *   [43]    overall check digit
 */
function validateMrzLine2(line2: string): ValidationResult {
  const cleaned = line2.replace(/\s/g, '').toUpperCase();
  if (cleaned.length !== 44) {
    return { valid: false, message: `MRZ line 2 should be 44 characters, got ${cleaned.length}` };
  }

  const errors: string[] = [];

  // Passport number check digit (positions 0-8 checked by position 9)
  const passportNum = cleaned.substring(0, 9);
  const passportCheck = parseInt(cleaned[9], 10);
  if (mrzCheckDigit(passportNum) !== passportCheck) {
    errors.push('passport number check digit invalid');
  }

  // Date of birth check digit (positions 13-18 checked by position 19)
  const dob = cleaned.substring(13, 19);
  const dobCheck = parseInt(cleaned[19], 10);
  if (mrzCheckDigit(dob) !== dobCheck) {
    errors.push('date of birth check digit invalid');
  }

  // Date of expiry check digit (positions 21-26 checked by position 27)
  const expiry = cleaned.substring(21, 27);
  const expiryCheck = parseInt(cleaned[27], 10);
  if (mrzCheckDigit(expiry) !== expiryCheck) {
    errors.push('date of expiry check digit invalid');
  }

  // Overall check digit (position 43) over positions 0-9, 13-19, 21-42
  const compositeInput =
    cleaned.substring(0, 10) + cleaned.substring(13, 20) + cleaned.substring(21, 43);
  const overallCheck = parseInt(cleaned[43], 10);
  if (mrzCheckDigit(compositeInput) !== overallCheck) {
    errors.push('overall check digit invalid');
  }

  if (errors.length > 0) {
    return {
      valid: false,
      message: `MRZ checksum failures: ${errors.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Cross-validate extracted passport fields against MRZ-encoded data.
 * Compares passport_number from MRZ line 2 against the separately extracted value.
 */
function crossValidateMrzFields(
  _value: string,
  allFields: Record<string, ExtractedFieldResult>
): ValidationResult {
  const mrzLine2 = allFields.mrz_line2?.value;
  if (!mrzLine2 || typeof mrzLine2 !== 'string') {
    return { valid: true }; // No MRZ to cross-validate
  }

  const cleaned = String(mrzLine2).replace(/\s/g, '').toUpperCase();
  if (cleaned.length !== 44) {
    return { valid: true }; // Malformed MRZ, skip cross-validation
  }

  const mismatches: string[] = [];

  // Cross-validate passport number
  const mrzPassport = cleaned.substring(0, 9).replace(/<+$/, '');
  const extractedPassport = allFields.passport_number?.value;
  if (extractedPassport && typeof extractedPassport === 'string') {
    const normalizedExtracted = extractedPassport.replace(/[\s-]/g, '').toUpperCase();
    if (mrzPassport !== normalizedExtracted) {
      mismatches.push(`passport_number: extracted '${extractedPassport}' vs MRZ '${mrzPassport}'`);
    }
  }

  if (mismatches.length > 0) {
    return {
      valid: false,
      message: `MRZ cross-validation mismatches: ${mismatches.join('; ')}`,
      suggestedFix: 'Review the passport image - MRZ data and visually extracted data differ',
    };
  }

  return { valid: true };
}

// ============================================================================
// Category-Specific Validation Rules
// ============================================================================

/**
 * Passport validation rules
 */
const PASSPORT_RULES: ValidationRule[] = [
  {
    field: 'passport_number',
    required: true,
    format: /^[A-Z]{0,2}[0-9]{6,9}$/i,
    formatDescription: 'Passport number should be 6-9 alphanumeric characters',
    minLength: 6,
    maxLength: 12,
  },
  {
    field: 'full_name',
    required: true,
    minLength: 2,
    maxLength: 100,
  },
  {
    field: 'nationality',
    required: true,
    minLength: 2,
  },
  {
    field: 'date_of_birth',
    required: true,
    validator: validateDateField,
  },
  {
    field: 'date_of_expiry',
    required: true,
    validator: (value, allFields) => validateExpiryDate(value, allFields, 'date_of_issue'),
  },
  {
    field: 'gender',
    required: false,
    format: /^[MF]$/i,
    formatDescription: 'Gender should be M or F',
  },
  {
    field: 'mrz_line2',
    required: false,
    validator: (value) => validateMrzLine2(value),
  },
  {
    field: 'passport_number',
    required: true,
    validator: (value, allFields) => crossValidateMrzFields(value, allFields),
  },
];

/**
 * Emirates ID validation rules
 */
const EMIRATES_ID_RULES: ValidationRule[] = [
  {
    field: 'emirates_id',
    required: true,
    format: /^784-\d{4}-\d{7}-\d$/,
    formatDescription: 'Emirates ID should be in format 784-YYYY-XXXXXXX-X',
    minLength: 18,
    maxLength: 18,
  },
  {
    field: 'full_name',
    required: true,
    minLength: 2,
  },
  {
    field: 'nationality',
    required: true,
  },
  {
    field: 'date_of_birth',
    required: true,
    validator: validateDateField,
  },
  {
    field: 'date_of_expiry',
    required: true,
    validator: (value, allFields) => validateExpiryDate(value, allFields),
  },
];

/**
 * Visa validation rules
 */
const VISA_RULES: ValidationRule[] = [
  {
    field: 'visa_number',
    required: true,
    minLength: 5,
  },
  {
    field: 'visa_type',
    required: true,
  },
  {
    field: 'full_name',
    required: true,
    minLength: 2,
  },
  {
    field: 'date_of_expiry',
    required: true,
    validator: (value, allFields) => validateExpiryDate(value, allFields, 'date_of_issue'),
  },
];

/**
 * Trade License validation rules
 */
const TRADE_LICENSE_RULES: ValidationRule[] = [
  {
    field: 'license_number',
    required: true,
    minLength: 3,
  },
  {
    field: 'company_name',
    required: true,
    minLength: 2,
  },
  {
    field: 'date_of_expiry',
    required: true,
    validator: (value, allFields) => validateExpiryDate(value, allFields, 'date_of_issue'),
  },
];

/**
 * Bank Statement validation rules
 */
const BANK_STATEMENT_RULES: ValidationRule[] = [
  {
    field: 'account_number',
    required: true,
    format: /^\d{8,20}$/,
    formatDescription: 'Account number should be 8-20 digits',
  },
  {
    field: 'bank_name',
    required: true,
  },
  {
    field: 'account_holder',
    required: true,
    minLength: 2,
  },
  {
    field: 'iban',
    required: false,
    format: /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/i,
    formatDescription:
      'IBAN should start with 2 letters, 2 digits, and 10-30 alphanumeric characters',
  },
];

/**
 * Invoice validation rules
 */
const INVOICE_RULES: ValidationRule[] = [
  {
    field: 'invoice_number',
    required: true,
  },
  {
    field: 'vendor_name',
    required: true,
  },
  {
    field: 'invoice_date',
    required: true,
    validator: validateDateField,
  },
  {
    field: 'total_amount',
    required: true,
    format: /^[\d,]+\.?\d{0,2}$/,
    formatDescription: 'Total amount should be a valid number',
    validator: validateAmountField,
  },
];

/**
 * Contract validation rules
 */
const CONTRACT_RULES: ValidationRule[] = [
  {
    field: 'party1_name',
    required: true,
    minLength: 2,
  },
  {
    field: 'party2_name',
    required: true,
    minLength: 2,
  },
  {
    field: 'start_date',
    required: false,
    validator: validateDateField,
  },
  {
    field: 'end_date',
    required: false,
    validator: (value, allFields) => validateExpiryDate(value, allFields, 'start_date'),
  },
];

/**
 * Labor Card validation rules
 */
const LABOR_CARD_RULES: ValidationRule[] = [
  {
    field: 'card_number',
    required: true,
  },
  {
    field: 'full_name',
    required: true,
    minLength: 2,
  },
  {
    field: 'occupation',
    required: true,
  },
  {
    field: 'employer',
    required: true,
  },
  {
    field: 'date_of_expiry',
    required: true,
    validator: (value, allFields) => validateExpiryDate(value, allFields, 'date_of_issue'),
  },
];

/**
 * Get validation rules for a document category
 */
function getRulesForCategory(category: DocumentCategory): ValidationRule[] {
  const categoryRules: Partial<Record<DocumentCategory, ValidationRule[]>> = {
    PASSPORT: PASSPORT_RULES,
    EMIRATES_ID: EMIRATES_ID_RULES,
    VISA: VISA_RULES,
    TRADE_LICENSE: TRADE_LICENSE_RULES,
    BANK_STATEMENT: BANK_STATEMENT_RULES,
    INVOICE: INVOICE_RULES,
    CONTRACT: CONTRACT_RULES,
    LABOR_CARD: LABOR_CARD_RULES,
  };

  return categoryRules[category] || [];
}

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Parse a date string in various formats
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const trimmed = dateStr.trim();

  // Try standard Date parsing
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  // Try DD/MM/YYYY format
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }

  // Try YYYY-MM-DD format
  const yyyymmdd = trimmed.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }

  return null;
}

/**
 * Validate a date field
 */
function validateDateField(value: string): ValidationResult {
  if (!value) {
    return { valid: false, message: 'Date is empty' };
  }

  const parsed = parseDate(value);
  if (!parsed) {
    return {
      valid: false,
      message: 'Invalid date format',
      suggestedFix: 'Date should be in format DD/MM/YYYY or YYYY-MM-DD',
    };
  }

  // Check if date is reasonable (not in distant past or future)
  const now = new Date();
  const minDate = new Date('1900-01-01');
  const maxDate = new Date(now.getFullYear() + 50, 11, 31);

  if (parsed < minDate || parsed > maxDate) {
    return {
      valid: false,
      message: 'Date appears to be out of reasonable range',
    };
  }

  return { valid: true };
}

/**
 * Validate that an expiry date is after an issue date
 */
function validateExpiryDate(
  expiryValue: string,
  allFields: Record<string, ExtractedFieldResult>,
  issueDateField: string = 'date_of_issue'
): ValidationResult {
  // First validate the date format
  const dateValidation = validateDateField(expiryValue);
  if (!dateValidation.valid) {
    return dateValidation;
  }

  const expiryDate = parseDate(expiryValue);
  if (!expiryDate) {
    return { valid: false, message: 'Could not parse expiry date' };
  }

  // Check if document is expired
  const now = new Date();
  if (expiryDate < now) {
    return {
      valid: false,
      message: 'Document has expired',
      suggestedFix: 'This document appears to be expired. Verify the expiry date.',
    };
  }

  // Check if expiry is after issue date
  const issueDateResult = allFields[issueDateField];
  if (issueDateResult?.value) {
    const issueDate = parseDate(String(issueDateResult.value));
    if (issueDate && expiryDate <= issueDate) {
      return {
        valid: false,
        message: 'Expiry date must be after issue date',
        suggestedFix: 'Check that the issue and expiry dates are correctly identified',
      };
    }
  }

  return { valid: true };
}

/**
 * Validate an amount/currency field
 */
function validateAmountField(value: string): ValidationResult {
  if (!value) {
    return { valid: false, message: 'Amount is empty' };
  }

  // Remove currency symbols and formatting
  const cleaned = value.replace(/[^0-9.,]/g, '').replace(/,/g, '');
  const amount = parseFloat(cleaned);

  if (isNaN(amount)) {
    return {
      valid: false,
      message: 'Could not parse amount as a number',
    };
  }

  if (amount < 0) {
    return {
      valid: false,
      message: 'Amount should not be negative',
    };
  }

  return { valid: true };
}

// ============================================================================
// Main QA Validation Function
// ============================================================================

/**
 * Validate extracted document data
 *
 * @param fields - Extracted fields with confidence scores
 * @param category - Document category for category-specific validation
 * @returns QAResult with validation results and issues
 *
 * @example
 * ```typescript
 * const result = await validateExtraction(
 *   {
 *     passport_number: { value: 'A12345678', confidence: 95, source: 'llm' },
 *     date_of_expiry: { value: '2030-12-31', confidence: 90, source: 'llm' }
 *   },
 *   'PASSPORT'
 * );
 * console.log(result.passed); // true
 * console.log(result.score); // 92
 * ```
 */
export async function validateExtraction(
  fields: Record<string, ExtractedFieldResult>,
  category: DocumentCategory
): Promise<QAResult> {
  const startTime = Date.now();

  logger.info('Starting QA validation', {
    category,
    fieldCount: Object.keys(fields).length,
  });

  const rules = getRulesForCategory(category);
  const issues: QAIssue[] = [];
  let passedFields = 0;
  let warningFields = 0;
  let errorFields = 0;
  let totalConfidence = 0;
  let fieldCount = 0;

  // Validate each rule
  for (const rule of rules) {
    const fieldResult = fields[rule.field];
    const value = fieldResult?.value;
    const hasValue = value !== null && value !== undefined && String(value).trim() !== '';

    // Check required fields
    if (rule.required && !hasValue) {
      issues.push({
        field: rule.field,
        severity: 'error',
        message: `Required field '${rule.field}' is missing`,
        issueType: 'missing_required',
      });
      errorFields++;
      continue;
    }

    if (!hasValue) {
      continue; // Skip optional empty fields
    }

    fieldCount++;
    const stringValue = String(value);

    // Track confidence
    if (fieldResult) {
      totalConfidence += fieldResult.confidence;

      // Check confidence threshold
      if (fieldResult.confidence < CONFIDENCE_THRESHOLDS.LOW) {
        issues.push({
          field: rule.field,
          severity: 'error',
          message: `Field '${rule.field}' has very low confidence (${fieldResult.confidence}%)`,
          issueType: 'low_confidence',
          suggestedFix: 'Consider manual review of this field',
        });
        errorFields++;
      } else if (fieldResult.confidence < CONFIDENCE_THRESHOLDS.WARNING) {
        issues.push({
          field: rule.field,
          severity: 'warning',
          message: `Field '${rule.field}' has low confidence (${fieldResult.confidence}%)`,
          issueType: 'low_confidence',
        });
        warningFields++;
      }
    }

    // Check format
    if (rule.format && !rule.format.test(stringValue)) {
      issues.push({
        field: rule.field,
        severity: 'error',
        message: `Field '${rule.field}' has invalid format`,
        issueType: 'invalid_format',
        suggestedFix: rule.formatDescription,
      });
      errorFields++;
    }

    // Check length constraints
    if (rule.minLength && stringValue.length < rule.minLength) {
      issues.push({
        field: rule.field,
        severity: 'warning',
        message: `Field '${rule.field}' is too short (minimum ${rule.minLength} characters)`,
        issueType: 'length_validation',
      });
      warningFields++;
    }

    if (rule.maxLength && stringValue.length > rule.maxLength) {
      issues.push({
        field: rule.field,
        severity: 'warning',
        message: `Field '${rule.field}' is too long (maximum ${rule.maxLength} characters)`,
        issueType: 'length_validation',
      });
      warningFields++;
    }

    // Run custom validator
    if (rule.validator) {
      const validationResult = rule.validator(stringValue, fields);
      if (!validationResult.valid) {
        issues.push({
          field: rule.field,
          severity: 'error',
          message: validationResult.message || `Field '${rule.field}' failed validation`,
          issueType: 'date_validation',
          suggestedFix: validationResult.suggestedFix,
        });
        errorFields++;
      }
    }

    // If no issues for this field, count as passed
    const fieldHasIssues = issues.some(
      (i) => i.field === rule.field && (i.severity === 'error' || i.severity === 'warning')
    );
    if (!fieldHasIssues) {
      passedFields++;
    }
  }

  // Check for suspicious values in any field
  for (const [fieldName, fieldResult] of Object.entries(fields)) {
    if (!fieldResult.value) continue;

    const stringValue = String(fieldResult.value);

    // Check for placeholder values
    if (/^(n\/a|not\s*available|unknown|xxx+|test|sample)$/i.test(stringValue)) {
      issues.push({
        field: fieldName,
        severity: 'warning',
        message: `Field '${fieldName}' appears to contain a placeholder value`,
        issueType: 'suspicious_value',
        suggestedFix: 'Verify this value is correct',
      });
      warningFields++;
    }
  }

  // Calculate overall score
  const averageConfidence = fieldCount > 0 ? totalConfidence / fieldCount : 0;
  const requiredFieldsPresent = rules
    .filter((r) => r.required)
    .every((r) => fields[r.field]?.value !== null && fields[r.field]?.value !== undefined);

  let score: number = SCORE_WEIGHTS.BASE_SCORE;

  if (requiredFieldsPresent) {
    score += SCORE_WEIGHTS.REQUIRED_FIELD_PRESENT;
  }

  if (errorFields === 0) {
    score += SCORE_WEIGHTS.FORMAT_VALID;
  }

  if (averageConfidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    score += SCORE_WEIGHTS.HIGH_CONFIDENCE;
  } else if (averageConfidence >= CONFIDENCE_THRESHOLDS.ACCEPTABLE) {
    score += SCORE_WEIGHTS.HIGH_CONFIDENCE * 0.5;
  }

  if (issues.filter((i) => i.issueType === 'cross_field_mismatch').length === 0) {
    score += SCORE_WEIGHTS.NO_CROSS_FIELD_ISSUES;
  }

  // Reduce score based on issues
  score -= errorFields * 10;
  score -= warningFields * 3;
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Determine if passed
  const hasErrors = issues.some((i) => i.severity === 'error');
  const passed = !hasErrors && score >= 60;

  // Determine if human review is needed
  const requiresHumanReview =
    hasErrors ||
    averageConfidence < CONFIDENCE_THRESHOLDS.WARNING ||
    issues.length >= 3 ||
    !requiredFieldsPresent;

  const summary: QASummary = {
    totalFields: Object.keys(fields).length,
    passedFields,
    warningFields,
    errorFields,
    averageConfidence: Math.round(averageConfidence),
  };

  const processingTimeMs = Date.now() - startTime;

  logger.info('QA validation completed', {
    category,
    passed,
    score,
    errorCount: errorFields,
    warningCount: warningFields,
    requiresHumanReview,
    processingTimeMs,
  });

  return {
    passed,
    score,
    issues,
    requiresHumanReview,
    summary,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get required fields for a document category
 */
export function getRequiredFields(category: DocumentCategory): string[] {
  const rules = getRulesForCategory(category);
  return rules.filter((r) => r.required).map((r) => r.field);
}

/**
 * Check if all required fields are present
 */
export function hasAllRequiredFields(
  fields: Record<string, ExtractedFieldResult>,
  category: DocumentCategory
): boolean {
  const required = getRequiredFields(category);
  return required.every((fieldName) => {
    const field = fields[fieldName];
    return field?.value !== null && field?.value !== undefined;
  });
}

/**
 * Get fields with low confidence
 */
export function getLowConfidenceFields(
  fields: Record<string, ExtractedFieldResult>,
  threshold: number = CONFIDENCE_THRESHOLDS.WARNING
): string[] {
  return Object.entries(fields)
    .filter(([, field]) => field.confidence < threshold)
    .map(([name]) => name);
}

/**
 * Calculate average confidence across fields
 */
export function calculateAverageConfidence(fields: Record<string, ExtractedFieldResult>): number {
  const values = Object.values(fields);
  if (values.length === 0) return 0;

  const total = values.reduce((sum, field) => sum + field.confidence, 0);
  return Math.round(total / values.length);
}

// ============================================================================
// Exports
// ============================================================================

export {
  CONFIDENCE_THRESHOLDS,
  PASSPORT_RULES,
  EMIRATES_ID_RULES,
  VISA_RULES,
  TRADE_LICENSE_RULES,
  BANK_STATEMENT_RULES,
  INVOICE_RULES,
  CONTRACT_RULES,
  LABOR_CARD_RULES,
  getRulesForCategory,
  parseDate,
  validateDateField,
  validateExpiryDate,
  validateAmountField,
};

export default validateExtraction;
