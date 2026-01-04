/**
 * Shared error types for API and authentication errors
 * Task 289: Type-safe error handling to replace :any type escapes
 */

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
}

export interface AuthError extends ApiError {
  code:
    | 'INVALID_CREDENTIALS'
    | 'ACCOUNT_DEACTIVATED'
    | 'EMAIL_EXISTS'
    | 'RATE_LIMIT'
    | 'AUTH_ERROR'
    | 'FORBIDDEN';
}

export interface ValidationError extends ApiError {
  field?: string;
  constraints?: Record<string, string>;
}

// Type guard functions
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as ApiError).message === 'string'
  );
}

export function isAuthError(error: unknown): error is AuthError {
  return isApiError(error) && 'code' in error;
}

// Helper to extract error message from unknown
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}
