/**
 * Comprehensive PII Sanitizer Utility for IntelliFill
 *
 * Provides field-name based and value-based pattern detection to sanitize
 * personally identifiable information (PII) from objects before logging.
 *
 * Features:
 * - Field-name based detection (NEVER_LOG and REDACT categories)
 * - Value-based pattern detection (email, phone, Emirates ID, UUIDs)
 * - Recursive sanitization of nested objects and arrays
 * - Circular reference detection
 * - Configurable max depth protection
 *
 * @module piiSanitizer
 */

/**
 * Fields that should NEVER be logged, even in redacted form.
 * These are completely omitted from sanitized output.
 */
const NEVER_LOG_FIELDS = new Set([
  'password',
  'token',
  'secret',
  'key',
  'apikey',
  'authorization',
  'cookie',
  'embedding',
  'creditcard',
  'cvv',
  'ssn',
  // Common variations
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'bearertoken',
  'apitoken',
  'privatekey',
  'secretkey',
  'encryptionkey',
]);

/**
 * Fields that should be redacted (replaced with [REDACTED] placeholder).
 * The field name is preserved but the value is replaced.
 */
const REDACT_FIELDS = new Set([
  'email',
  'phone',
  'name',
  'firstname',
  'lastname',
  'fullname',
  'passportnumber',
  'emiratesid',
  'address',
  'dateofbirth',
  'dob',
  'salary',
  'bankaccount',
  'iban',
  // Common variations
  'phonenumber',
  'mobilenumber',
  'emailaddress',
  'streetaddress',
  'homeaddress',
  'workaddress',
  'birthdate',
  'accountnumber',
  'routingnumber',
]);

/**
 * Configuration options for sanitization
 */
export interface SanitizeOptions {
  /** Maximum depth for recursive sanitization (default: 10) */
  maxDepth?: number;
  /** Whether to detect and handle circular references (default: true) */
  detectCircular?: boolean;
  /** Custom fields to never log */
  customNeverLog?: string[];
  /** Custom fields to redact */
  customRedact?: string[];
}

/**
 * Regular expressions for value-based PII detection
 */
const PII_PATTERNS = {
  /** Email pattern: user@domain.com */
  email: /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i,

  /** Phone pattern: 10-15 digits with optional + prefix */
  phone: /^\+?\d{10,15}$/,

  /** Emirates ID pattern: 784-XXXX-XXXXXXX-X */
  emiratesId: /^784-\d{4}-\d{7}-\d{1}$/,

  /** UUID pattern: 8-4-4-4-12 format */
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,

  /** Credit card pattern: 13-19 digits, optionally grouped */
  creditCard: /^(?:\d{4}[\s-]?){3}\d{4}$/,

  /** SSN pattern: XXX-XX-XXXX */
  ssn: /^\d{3}-\d{2}-\d{4}$/,

  /** IBAN pattern: 2 letters, 2 digits, up to 30 alphanumeric */
  iban: /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/i,
} as const;

/**
 * Redaction placeholders for different PII types
 */
const REDACTION_PLACEHOLDERS = {
  email: '[EMAIL_REDACTED]',
  phone: '[PHONE_REDACTED]',
  emiratesId: '[EMIRATES_ID_REDACTED]',
  uuid: '[UUID_REDACTED]',
  creditCard: '[CREDIT_CARD_REDACTED]',
  ssn: '[SSN_REDACTED]',
  iban: '[IBAN_REDACTED]',
  generic: '[REDACTED]',
  neverLog: '[REMOVED]',
  encrypted: '[ENCRYPTED_DATA]',
  maxDepth: '[MAX_DEPTH_EXCEEDED]',
  circular: '[CIRCULAR_REFERENCE]',
} as const;

/**
 * Sanitizes a value for logging by removing or redacting PII.
 *
 * This is the main function that should be used for sanitizing data before logging.
 * It handles:
 * - Field-name based detection (removes NEVER_LOG fields, redacts REDACT fields)
 * - Value-based pattern detection (emails, phones, IDs, etc.)
 * - Recursive sanitization of nested objects and arrays
 * - Circular reference detection and handling
 * - Maximum depth protection
 *
 * @param obj - The object to sanitize (can be any type)
 * @param options - Optional configuration for sanitization behavior
 * @returns Sanitized copy of the object safe for logging
 *
 * @example
 * ```typescript
 * const userData = {
 *   id: 'abc123',
 *   email: 'user@example.com',
 *   password: 'secret123',
 *   token: 'bearer-token-xyz',
 *   profile: {
 *     name: 'John Doe',
 *     phone: '+971501234567'
 *   }
 * };
 *
 * const sanitized = sanitizeForLogging(userData);
 * // Result:
 * // {
 * //   id: 'abc123',
 * //   email: '[EMAIL_REDACTED]',
 * //   // password and token are completely removed
 * //   profile: {
 * //     name: '[REDACTED]',
 * //     phone: '[PHONE_REDACTED]'
 * //   }
 * // }
 * ```
 */
export function sanitizeForLogging(
  obj: any,
  options: SanitizeOptions = {}
): any {
  const {
    maxDepth = 10,
    detectCircular = true,
    customNeverLog = [],
    customRedact = [],
  } = options;

  // Build complete field sets including custom fields
  const neverLogSet = new Set([
    ...NEVER_LOG_FIELDS,
    ...customNeverLog.map(f => f.toLowerCase()),
  ]);

  const redactSet = new Set([
    ...REDACT_FIELDS,
    ...customRedact.map(f => f.toLowerCase()),
  ]);

  // Circular reference tracking
  const seen = detectCircular ? new WeakSet() : null;

  /**
   * Internal recursive sanitization function
   */
  function sanitizeRecursive(value: any, depth: number): any {
    // Check max depth
    if (depth > maxDepth) {
      return REDACTION_PLACEHOLDERS.maxDepth;
    }

    // Handle null and undefined
    if (value === null || value === undefined) {
      return value;
    }

    // Handle primitives
    const valueType = typeof value;
    if (valueType === 'boolean' || valueType === 'number') {
      return value;
    }

    // Handle strings with value-based pattern detection
    if (valueType === 'string') {
      return sanitizeString(value);
    }

    // Handle functions (shouldn't be logged)
    if (valueType === 'function') {
      return '[FUNCTION]';
    }

    // Handle Date objects
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Handle RegExp objects
    if (value instanceof RegExp) {
      return value.toString();
    }

    // Handle Error objects
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }

    // Check for circular references
    if (seen) {
      if (seen.has(value)) {
        return REDACTION_PLACEHOLDERS.circular;
      }
      seen.add(value);
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(item => sanitizeRecursive(item, depth + 1));
    }

    // Handle objects
    if (valueType === 'object') {
      return sanitizeObject(value, depth);
    }

    // Fallback: return as-is
    return value;
  }

  /**
   * Sanitize a string value using pattern matching
   */
  function sanitizeString(str: string): string {
    // Empty strings
    if (!str || str.trim().length === 0) {
      return str;
    }

    // Remove whitespace for pattern matching
    const normalized = str.replace(/[\s-]/g, '');

    // Check for Emirates ID FIRST (before phone, as it contains digits)
    if (PII_PATTERNS.emiratesId.test(str)) {
      return REDACTION_PLACEHOLDERS.emiratesId;
    }

    // Check for email
    if (PII_PATTERNS.email.test(str)) {
      return REDACTION_PLACEHOLDERS.email;
    }

    // Check for phone (after removing common separators)
    if (PII_PATTERNS.phone.test(normalized)) {
      return REDACTION_PLACEHOLDERS.phone;
    }

    // Check for credit card (after removing separators)
    if (PII_PATTERNS.creditCard.test(normalized)) {
      return REDACTION_PLACEHOLDERS.creditCard;
    }

    // Check for SSN
    if (PII_PATTERNS.ssn.test(str)) {
      return REDACTION_PLACEHOLDERS.ssn;
    }

    // Check for IBAN
    if (PII_PATTERNS.iban.test(str.replace(/\s/g, ''))) {
      return REDACTION_PLACEHOLDERS.iban;
    }

    // Check for UUID - keep first 8 chars only for debugging
    if (PII_PATTERNS.uuid.test(str)) {
      return `${str.substring(0, 8)}...`;
    }

    return str;
  }

  /**
   * Sanitize an object by checking field names and recursing
   */
  function sanitizeObject(obj: any, depth: number): any {
    const sanitized: any = {};

    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase();

      // NEVER LOG: completely omit these fields (regardless of value)
      if (shouldNeverLog(keyLower, neverLogSet)) {
        continue; // Skip this field entirely
      }

      // REDACT: replace value with placeholder (regardless of value, even null/undefined)
      if (shouldRedact(keyLower, redactSet)) {
        sanitized[key] = value === null ? null : value === undefined ? undefined : REDACTION_PLACEHOLDERS.generic;
        continue;
      }

      // Special handling for encrypted/binary data
      if (isEncryptedOrBinaryField(keyLower)) {
        sanitized[key] = REDACTION_PLACEHOLDERS.encrypted;
        continue;
      }

      // Recursively sanitize the value
      sanitized[key] = sanitizeRecursive(value, depth + 1);
    }

    return sanitized;
  }

  // Start recursive sanitization from depth 0
  return sanitizeRecursive(obj, 0);
}

/**
 * Check if a field name indicates it should never be logged
 */
function shouldNeverLog(fieldName: string, neverLogSet: Set<string>): boolean {
  // Exact match
  if (neverLogSet.has(fieldName)) {
    return true;
  }

  // Pattern matching for variations
  const neverLogPatterns = [
    /password/i,
    /token/i,
    /secret/i,
    /^key$/i,
    /apikey/i,
    /authorization/i,
    /bearer/i,
    /cookie/i,
    /embedding/i,
    /creditcard/i,
    /cvv/i,
    /ssn/i,
  ];

  return neverLogPatterns.some(pattern => pattern.test(fieldName));
}

/**
 * Check if a field name indicates it should be redacted
 */
function shouldRedact(fieldName: string, redactSet: Set<string>): boolean {
  // Exact match
  if (redactSet.has(fieldName)) {
    return true;
  }

  // Pattern matching for variations
  const redactPatterns = [
    /email/i,
    /phone/i,
    /^name$/i,
    /firstname/i,
    /lastname/i,
    /fullname/i,
    /passport/i,
    /emirates/i,
    /address/i,
    /birth/i,
    /dob$/i,
    /salary/i,
    /bank/i,
    /account/i,
    /iban/i,
  ];

  return redactPatterns.some(pattern => pattern.test(fieldName));
}

/**
 * Check if a field contains encrypted or binary data
 */
function isEncryptedOrBinaryField(fieldName: string): boolean {
  const encryptedPatterns = [
    /encrypted/i,
    /ciphertext/i,
    /cipher/i,
    /^hash$/i,
    /hashed/i,
    /binary/i,
    /buffer$/i,
  ];

  return encryptedPatterns.some(pattern => pattern.test(fieldName));
}

/**
 * PIISanitizer class for advanced use cases with configuration
 *
 * Provides a class-based interface for PII sanitization with customizable
 * configuration that persists across multiple sanitization calls.
 *
 * @example
 * ```typescript
 * const sanitizer = new PIISanitizer({
 *   maxDepth: 5,
 *   customNeverLog: ['internalId', 'secretField'],
 *   customRedact: ['customPII']
 * });
 *
 * const sanitized1 = sanitizer.sanitize(data1);
 * const sanitized2 = sanitizer.sanitize(data2);
 * ```
 */
export class PIISanitizer {
  private options: Required<SanitizeOptions>;

  /**
   * Create a new PIISanitizer instance with optional configuration
   *
   * @param options - Configuration options for sanitization behavior
   */
  constructor(options: SanitizeOptions = {}) {
    this.options = {
      maxDepth: options.maxDepth ?? 10,
      detectCircular: options.detectCircular ?? true,
      customNeverLog: options.customNeverLog ?? [],
      customRedact: options.customRedact ?? [],
    };
  }

  /**
   * Sanitize a value using the configured options
   *
   * @param obj - The object to sanitize
   * @returns Sanitized copy safe for logging
   */
  sanitize(obj: any): any {
    return sanitizeForLogging(obj, this.options);
  }

  /**
   * Add custom fields to the never-log list
   *
   * @param fields - Field names to never log
   */
  addNeverLogFields(...fields: string[]): void {
    this.options.customNeverLog.push(...fields);
  }

  /**
   * Add custom fields to the redact list
   *
   * @param fields - Field names to redact
   */
  addRedactFields(...fields: string[]): void {
    this.options.customRedact.push(...fields);
  }

  /**
   * Update the maximum depth configuration
   *
   * @param depth - New maximum depth value
   */
  setMaxDepth(depth: number): void {
    this.options.maxDepth = depth;
  }

  /**
   * Enable or disable circular reference detection
   *
   * @param enabled - Whether to detect circular references
   */
  setCircularDetection(enabled: boolean): void {
    this.options.detectCircular = enabled;
  }

  /**
   * Get the current configuration
   *
   * @returns Current sanitization options
   */
  getConfig(): Readonly<Required<SanitizeOptions>> {
    return { ...this.options };
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.options = {
      maxDepth: 10,
      detectCircular: true,
      customNeverLog: [],
      customRedact: [],
    };
  }
}

/**
 * Default sanitizer instance for convenience
 *
 * @example
 * ```typescript
 * import { defaultSanitizer } from '@/utils/piiSanitizer';
 *
 * const sanitized = defaultSanitizer.sanitize(userData);
 * ```
 */
export const defaultSanitizer = new PIISanitizer();

/**
 * Type guard to check if a value contains potential PII
 *
 * @param value - Value to check
 * @param depth - Current recursion depth (internal use)
 * @returns True if the value might contain PII
 */
export function mayContainPII(value: any, depth: number = 0): boolean {
  if (!value) return false;
  if (depth > 5) return false; // Prevent infinite recursion

  if (typeof value === 'string') {
    return (
      PII_PATTERNS.email.test(value) ||
      PII_PATTERNS.phone.test(value.replace(/[\s-]/g, '')) ||
      PII_PATTERNS.emiratesId.test(value) ||
      PII_PATTERNS.creditCard.test(value.replace(/[\s-]/g, '')) ||
      PII_PATTERNS.ssn.test(value) ||
      PII_PATTERNS.iban.test(value.replace(/\s/g, ''))
    );
  }

  if (typeof value === 'object' && value !== null) {
    // Check if this object has PII field names
    const keys = Object.keys(value).map(k => k.toLowerCase());
    const hasPIIFields = keys.some(
      key =>
        NEVER_LOG_FIELDS.has(key) ||
        REDACT_FIELDS.has(key) ||
        shouldNeverLog(key, NEVER_LOG_FIELDS) ||
        shouldRedact(key, REDACT_FIELDS)
    );

    if (hasPIIFields) return true;

    // Recursively check nested values
    for (const val of Object.values(value)) {
      if (mayContainPII(val, depth + 1)) {
        return true;
      }
    }
  }

  return false;
}
