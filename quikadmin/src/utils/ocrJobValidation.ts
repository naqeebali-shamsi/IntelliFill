/**
 * OCR Job Input Validation Utility
 *
 * Provides security-focused validation for OCR job data to prevent:
 * - SSRF (Server-Side Request Forgery) attacks via malicious URLs
 * - Path traversal attacks via local file paths
 * - Invalid document IDs causing downstream errors
 *
 * @module utils/ocrJobValidation
 */

import { piiSafeLogger as logger } from './piiSafeLogger';
import { isR2Configured } from '../services/storageHelper';

/**
 * Validation configuration constants
 */
export const OCR_VALIDATION_CONFIG = {
  /**
   * UUID v4 regex pattern for documentId validation
   * Matches format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  UUID_PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,

  /**
   * Allowed URL patterns for remote file access (R2 Storage)
   * Format: https://{accountId}.r2.cloudflarestorage.com/{bucket}/{key}
   */
  ALLOWED_URL_PATTERNS: [
    /^https:\/\/[a-z0-9]+\.r2\.cloudflarestorage\.com\//i,
    /^https:\/\/[a-z0-9-]+\.r2\.dev\//i,
  ],

  /**
   * Dangerous path patterns that indicate path traversal attempts
   */
  DANGEROUS_PATH_PATTERNS: [
    /\.\./, // Parent directory traversal
    /\.\.%2[fF]/, // URL-encoded traversal
    /\.\.%5[cC]/, // URL-encoded backslash traversal
    /%00/, // Null byte injection
    /\0/, // Null byte
  ],

  /**
   * Maximum allowed file path length
   */
  MAX_PATH_LENGTH: 2048,
} as const;

/**
 * Custom error class for validation failures
 */
export class OCRValidationError extends Error {
  public readonly code: string;
  public readonly field: string;

  constructor(message: string, code: string, field: string) {
    super(message);
    this.name = 'OCRValidationError';
    this.code = code;
    this.field = field;
  }
}

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    code: string;
    message: string;
  }>;
}

/**
 * OCR job data interface for validation
 */
export interface OCRJobValidationInput {
  documentId: string;
  filePath: string;
  userId?: string;
}

/**
 * Validates a UUID string
 *
 * @param id - The ID to validate
 * @returns true if valid UUID v4 format
 */
export function isValidUUID(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  return OCR_VALIDATION_CONFIG.UUID_PATTERN.test(id);
}

/**
 * Checks if a URL matches allowed patterns (R2 storage)
 *
 * @param url - The URL to validate
 * @returns true if URL matches an allowed pattern
 */
export function isAllowedUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    // Ensure it's a valid URL
    new URL(url);

    // Check against allowed patterns
    return OCR_VALIDATION_CONFIG.ALLOWED_URL_PATTERNS.some((pattern) => pattern.test(url));
  } catch {
    // Not a valid URL
    return false;
  }
}

/**
 * Checks if a path contains dangerous traversal patterns
 *
 * @param filePath - The path to check
 * @returns true if path contains dangerous patterns
 */
export function containsPathTraversal(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  return OCR_VALIDATION_CONFIG.DANGEROUS_PATH_PATTERNS.some((pattern) => pattern.test(filePath));
}

/**
 * Validates a file path for OCR processing
 *
 * Valid paths must:
 * - Be a valid URL matching allowed patterns (R2 storage)
 * - Not contain path traversal sequences
 * - Not exceed maximum length
 *
 * @param filePath - The file path to validate
 * @returns ValidationResult with errors if invalid
 */
export function validateFilePath(filePath: string): ValidationResult {
  const errors: ValidationResult['errors'] = [];

  // Check for null/undefined/empty
  if (!filePath || typeof filePath !== 'string') {
    errors.push({
      field: 'filePath',
      code: 'REQUIRED',
      message: 'filePath is required and must be a string',
    });
    return { valid: false, errors };
  }

  // Check length
  if (filePath.length > OCR_VALIDATION_CONFIG.MAX_PATH_LENGTH) {
    errors.push({
      field: 'filePath',
      code: 'PATH_TOO_LONG',
      message: `filePath exceeds maximum length of ${OCR_VALIDATION_CONFIG.MAX_PATH_LENGTH} characters`,
    });
    return { valid: false, errors };
  }

  // Check for path traversal attempts
  if (containsPathTraversal(filePath)) {
    errors.push({
      field: 'filePath',
      code: 'PATH_TRAVERSAL',
      message: 'filePath contains illegal path traversal sequences',
    });
    return { valid: false, errors };
  }

  // Validate URL format and allowed domains
  // When R2 is configured (production), require R2 URLs for security
  // When R2 is not configured (development), allow local paths
  if (isR2Configured()) {
    // Production mode: require R2 URLs
    if (!isAllowedUrl(filePath)) {
      errors.push({
        field: 'filePath',
        code: 'INVALID_URL',
        message: 'filePath must be a valid URL from an allowed storage domain (R2)',
      });
      return { valid: false, errors };
    }
  } else {
    // Development mode: allow local paths but validate they're safe
    // Check that it starts with expected upload directory prefix
    const isLocalUpload =
      filePath.startsWith('uploads/') ||
      filePath.startsWith('./uploads/') ||
      filePath.startsWith('/uploads/');
    const isR2Url = isAllowedUrl(filePath);

    if (!isLocalUpload && !isR2Url) {
      errors.push({
        field: 'filePath',
        code: 'INVALID_PATH',
        message: 'filePath must be from uploads directory or a valid R2 URL',
      });
      return { valid: false, errors };
    }
  }

  return { valid: true, errors: [] };
}

/**
 * Validates complete OCR job data
 *
 * @param data - The job data to validate
 * @returns ValidationResult with all validation errors
 */
export function validateOcrJobData(data: OCRJobValidationInput): ValidationResult {
  const errors: ValidationResult['errors'] = [];

  // Validate documentId
  if (!data.documentId) {
    errors.push({
      field: 'documentId',
      code: 'REQUIRED',
      message: 'documentId is required',
    });
  } else if (!isValidUUID(data.documentId)) {
    errors.push({
      field: 'documentId',
      code: 'INVALID_UUID',
      message: 'documentId must be a valid UUID v4 format',
    });
  }

  // Validate filePath
  const filePathResult = validateFilePath(data.filePath);
  if (!filePathResult.valid) {
    errors.push(...filePathResult.errors);
  }

  // Validate userId if provided
  if (data.userId !== undefined && data.userId !== null) {
    if (typeof data.userId !== 'string' || data.userId.trim() === '') {
      errors.push({
        field: 'userId',
        code: 'INVALID_USER_ID',
        message: 'userId must be a non-empty string if provided',
      });
    } else if (!isValidUUID(data.userId)) {
      errors.push({
        field: 'userId',
        code: 'INVALID_UUID',
        message: 'userId must be a valid UUID v4 format',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates OCR job data and throws if invalid
 *
 * Use this in functions that should fail-fast on invalid input.
 *
 * @param data - The job data to validate
 * @throws OCRValidationError if validation fails
 */
export function validateOcrJobDataOrThrow(data: OCRJobValidationInput): void {
  const result = validateOcrJobData(data);

  if (!result.valid) {
    const firstError = result.errors[0];
    logger.warn('OCR job validation failed', {
      documentId: data.documentId?.substring(0, 8) + '...',
      errors: result.errors,
    });

    throw new OCRValidationError(firstError.message, firstError.code, firstError.field);
  }
}

export default {
  isValidUUID,
  isAllowedUrl,
  containsPathTraversal,
  validateFilePath,
  validateOcrJobData,
  validateOcrJobDataOrThrow,
  OCRValidationError,
  OCR_VALIDATION_CONFIG,
};
