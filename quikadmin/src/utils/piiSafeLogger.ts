import { logger } from './logger';

// Fields that should never be logged (even redacted)
const NEVER_LOG_FIELDS = new Set([
  'password',
  'secret',
  'token',
  'key',
  'apiKey',
  'authorization',
  'creditCard',
  'cvv',
  'ssn',
]);

// Fields that should be redacted
const PII_FIELDS = new Set([
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
  'rawtext',
  'ocrdata',
  'extractedfields',
  'mappedfields',
  'finaldata',
]);

/**
 * Sanitizes an object for logging by redacting PII
 */
export function sanitizeForLogging(obj: any, depth: number = 0): any {
  if (depth > 10) return '[MAX_DEPTH]';
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Check for known PII patterns
    if (isEmailLike(obj)) return '[REDACTED_EMAIL]';
    if (isPhoneLike(obj)) return '[REDACTED_PHONE]';
    if (isEmiratesIdLike(obj)) return '[REDACTED_EMIRATES_ID]';
    return obj;
  }

  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLogging(item, depth + 1));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();

    // Never log certain fields
    if (NEVER_LOG_FIELDS.has(keyLower)) {
      continue;
    }

    // Redact known PII fields
    if (PII_FIELDS.has(keyLower) || isPIIFieldName(keyLower)) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Handle nested objects/arrays
    if (typeof value === 'object' && value !== null) {
      // Don't log encrypted data
      if (keyLower.includes('encrypted') || keyLower.includes('ciphertext')) {
        sanitized[key] = '[ENCRYPTED_DATA]';
        continue;
      }
      sanitized[key] = sanitizeForLogging(value, depth + 1);
    } else {
      sanitized[key] = sanitizeForLogging(value, depth + 1);
    }
  }

  return sanitized;
}

function isEmailLike(str: string): boolean {
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(str);
}

function isPhoneLike(str: string): boolean {
  return /^\+?\d{10,15}$/.test(str.replace(/[-\s]/g, ''));
}

function isEmiratesIdLike(str: string): boolean {
  return /^784-\d{4}-\d{7}-\d{1}$/.test(str);
}

function isPIIFieldName(key: string): boolean {
  const piiPatterns = [
    /name/i,
    /email/i,
    /phone/i,
    /passport/i,
    /emirates/i,
    /address/i,
    /birth/i,
    /salary/i,
    /bank/i,
    /account/i,
  ];
  return piiPatterns.some((pattern) => pattern.test(key));
}

/**
 * Creates a PII-safe logger that automatically sanitizes data
 */
export const piiSafeLogger = {
  info: (message: string, data?: any) => {
    logger.info(message, data ? sanitizeForLogging(data) : undefined);
  },

  warn: (message: string, data?: any) => {
    logger.warn(message, data ? sanitizeForLogging(data) : undefined);
  },

  error: (message: string, data?: any) => {
    logger.error(message, data ? sanitizeForLogging(data) : undefined);
  },

  debug: (message: string, data?: any) => {
    logger.debug(message, data ? sanitizeForLogging(data) : undefined);
  },
};

/**
 * Factory function to create a named PII-safe logger instance
 * Compatible with createLogger from ./logger
 */
export function createPIISafeLogger(name: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const namedLogger = require('./logger').createLogger(name);

  return {
    info: (message: string, data?: any) => {
      namedLogger.info(message, data ? sanitizeForLogging(data) : undefined);
    },

    warn: (message: string, data?: any) => {
      namedLogger.warn(message, data ? sanitizeForLogging(data) : undefined);
    },

    error: (message: string, data?: any) => {
      namedLogger.error(message, data ? sanitizeForLogging(data) : undefined);
    },

    debug: (message: string, data?: any) => {
      namedLogger.debug(message, data ? sanitizeForLogging(data) : undefined);
    },
  };
}
