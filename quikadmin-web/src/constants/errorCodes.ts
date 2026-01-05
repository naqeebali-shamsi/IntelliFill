/**
 * Standardized Error Codes
 * Task 303: Shared constants for error codes used by both backend and frontend
 *
 * Usage:
 * - Frontend: import { ErrorCode, HttpStatus } from '../constants/errorCodes';
 * - Backend: See quikadmin/src/constants/errorCodes.ts
 */

/**
 * Standardized error codes for API responses
 * These codes are used for programmatic error handling on the client
 */
export const ErrorCode = {
  // Authentication errors
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  REFRESH_REQUIRED: 'REFRESH_REQUIRED',

  // Authorization errors
  FORBIDDEN: 'FORBIDDEN',
  CORS_REJECTED: 'CORS_REJECTED',
  CSRF_INVALID: 'CSRF_INVALID',

  // Rate limiting
  RATE_LIMIT: 'RATE_LIMIT',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // File upload errors
  FILE_SIZE_EXCEEDED: 'FILE_SIZE_EXCEEDED',
  FILE_COUNT_EXCEEDED: 'FILE_COUNT_EXCEEDED',
  INVALID_FILE_FIELD: 'INVALID_FILE_FIELD',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  MIME_TYPE_MISMATCH: 'MIME_TYPE_MISMATCH',
  FILE_VALIDATION_FAILED: 'FILE_VALIDATION_FAILED',
  DOUBLE_EXTENSION: 'DOUBLE_EXTENSION',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_EXISTS: 'RESOURCE_EXISTS',
  INVALID_REFERENCE: 'INVALID_REFERENCE',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',

  // Generic
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * HTTP status codes with semantic names
 */
export const HttpStatus = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Client errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server errors
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatusType = (typeof HttpStatus)[keyof typeof HttpStatus];

/**
 * Map error codes to their default HTTP status codes
 */
export const ErrorCodeToStatus: Record<ErrorCodeType, HttpStatusType> = {
  // Auth errors -> 401
  [ErrorCode.AUTH_EXPIRED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.AUTH_INVALID]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.AUTH_REQUIRED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.INVALID_CREDENTIALS]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.TOKEN_EXPIRED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.TOKEN_INVALID]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.REFRESH_REQUIRED]: HttpStatus.UNAUTHORIZED,

  // Account status -> 403
  [ErrorCode.ACCOUNT_LOCKED]: HttpStatus.FORBIDDEN,
  [ErrorCode.ACCOUNT_DEACTIVATED]: HttpStatus.FORBIDDEN,
  [ErrorCode.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [ErrorCode.CORS_REJECTED]: HttpStatus.FORBIDDEN,
  [ErrorCode.CSRF_INVALID]: HttpStatus.FORBIDDEN,

  // Rate limit -> 429
  [ErrorCode.RATE_LIMIT]: HttpStatus.TOO_MANY_REQUESTS,
  [ErrorCode.TOO_MANY_REQUESTS]: HttpStatus.TOO_MANY_REQUESTS,

  // Validation -> 400
  [ErrorCode.VALIDATION_ERROR]: HttpStatus.BAD_REQUEST,
  [ErrorCode.INVALID_INPUT]: HttpStatus.BAD_REQUEST,
  [ErrorCode.MISSING_FIELD]: HttpStatus.BAD_REQUEST,
  [ErrorCode.INVALID_FORMAT]: HttpStatus.BAD_REQUEST,
  [ErrorCode.INVALID_FILE_FIELD]: HttpStatus.BAD_REQUEST,

  // File errors
  [ErrorCode.FILE_SIZE_EXCEEDED]: HttpStatus.PAYLOAD_TOO_LARGE,
  [ErrorCode.FILE_COUNT_EXCEEDED]: HttpStatus.BAD_REQUEST,
  [ErrorCode.UNSUPPORTED_MEDIA_TYPE]: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  [ErrorCode.MIME_TYPE_MISMATCH]: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  [ErrorCode.FILE_VALIDATION_FAILED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.DOUBLE_EXTENSION]: HttpStatus.BAD_REQUEST,

  // Resource -> 404/409
  [ErrorCode.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.RESOURCE_EXISTS]: HttpStatus.CONFLICT,
  [ErrorCode.INVALID_REFERENCE]: HttpStatus.BAD_REQUEST,

  // Duplicate for EMAIL_EXISTS
  [ErrorCode.EMAIL_EXISTS]: HttpStatus.CONFLICT,

  // Server errors -> 500
  [ErrorCode.INTERNAL_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.SERVICE_UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [ErrorCode.DATABASE_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.UNKNOWN_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
};

/**
 * User-friendly error messages (for production environments)
 */
export const ErrorMessages: Record<ErrorCodeType, string> = {
  [ErrorCode.AUTH_EXPIRED]: 'Your session has expired. Please log in again.',
  [ErrorCode.AUTH_INVALID]: 'Authentication failed. Please try again.',
  [ErrorCode.AUTH_REQUIRED]: 'Please log in to continue.',
  [ErrorCode.INVALID_CREDENTIALS]: 'Invalid email or password.',
  [ErrorCode.ACCOUNT_LOCKED]: 'Your account has been locked. Please contact support.',
  [ErrorCode.ACCOUNT_DEACTIVATED]: 'Your account has been deactivated.',
  [ErrorCode.EMAIL_EXISTS]: 'An account with this email already exists.',
  [ErrorCode.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
  [ErrorCode.TOKEN_INVALID]: 'Invalid authentication token.',
  [ErrorCode.REFRESH_REQUIRED]: 'Please refresh your session.',

  [ErrorCode.FORBIDDEN]: 'You do not have permission to perform this action.',
  [ErrorCode.CORS_REJECTED]: 'Request origin not allowed.',
  [ErrorCode.CSRF_INVALID]: 'Invalid security token. Please refresh and try again.',

  [ErrorCode.RATE_LIMIT]: 'Too many requests. Please wait and try again.',
  [ErrorCode.TOO_MANY_REQUESTS]: 'Too many requests. Please wait and try again.',

  [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again.',
  [ErrorCode.INVALID_INPUT]: 'Invalid input provided.',
  [ErrorCode.MISSING_FIELD]: 'Required field is missing.',
  [ErrorCode.INVALID_FORMAT]: 'Invalid format.',

  [ErrorCode.FILE_SIZE_EXCEEDED]: 'File is too large.',
  [ErrorCode.FILE_COUNT_EXCEEDED]: 'Too many files uploaded.',
  [ErrorCode.INVALID_FILE_FIELD]: 'Invalid file field.',
  [ErrorCode.UNSUPPORTED_MEDIA_TYPE]: 'File type not supported.',
  [ErrorCode.MIME_TYPE_MISMATCH]: 'File type does not match its extension.',
  [ErrorCode.FILE_VALIDATION_FAILED]: 'File validation failed.',
  [ErrorCode.DOUBLE_EXTENSION]: 'File has suspicious double extension.',

  [ErrorCode.NOT_FOUND]: 'Resource not found.',
  [ErrorCode.RESOURCE_EXISTS]: 'Resource already exists.',
  [ErrorCode.INVALID_REFERENCE]: 'Invalid reference.',

  [ErrorCode.INTERNAL_ERROR]: 'An unexpected error occurred. Please try again.',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable.',
  [ErrorCode.DATABASE_ERROR]: 'A database error occurred.',
  [ErrorCode.UNKNOWN_ERROR]: 'An unknown error occurred.',
};

/**
 * Check if an error code indicates an authentication issue
 */
export const isAuthError = (code: string): boolean => {
  const authCodes: string[] = [
    ErrorCode.AUTH_EXPIRED,
    ErrorCode.AUTH_INVALID,
    ErrorCode.AUTH_REQUIRED,
    ErrorCode.TOKEN_EXPIRED,
    ErrorCode.TOKEN_INVALID,
    ErrorCode.REFRESH_REQUIRED,
  ];
  return authCodes.includes(code);
};

/**
 * Check if an error code indicates a rate limit issue
 */
export const isRateLimitError = (code: string): boolean => {
  return code === ErrorCode.RATE_LIMIT || code === ErrorCode.TOO_MANY_REQUESTS;
};
