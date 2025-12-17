/**
 * Utility functions for extracting user-friendly error messages from API responses
 * @module utils/errorMessages
 */

interface ApiError {
  userMessage?: string;
  message?: string;
  error?: string;
  retryable?: boolean;
  suggestion?: string;
}

/**
 * Extract user-friendly error message from API error response
 */
export function getUserErrorMessage(error: unknown): string {
  // Handle axios/fetch error responses
  if (error && typeof error === 'object') {
    const err = error as any;

    // Check for response data with userMessage (our new format)
    if (err.response?.data?.userMessage) {
      return err.response.data.userMessage;
    }

    // Check for userMessage directly
    if (err.userMessage) {
      return err.userMessage;
    }

    // Check for standard message
    if (err.response?.data?.message) {
      return err.response.data.message;
    }

    if (err.message) {
      // Filter out technical messages
      const msg = err.message;
      if (msg.includes('Network Error')) {
        return 'Connection failed. Please check your internet connection.';
      }
      if (msg.includes('timeout')) {
        return 'Request timed out. Please try again.';
      }
      if (msg.includes('401') || msg.includes('Unauthorized')) {
        return 'Session expired. Please log in again.';
      }
      if (msg.includes('403') || msg.includes('Forbidden')) {
        return 'You don\'t have permission to perform this action.';
      }
      if (msg.includes('404')) {
        return 'The requested resource was not found.';
      }
      if (msg.includes('500') || msg.includes('Internal')) {
        return 'Something went wrong on our end. Please try again.';
      }
      return msg;
    }
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const err = error as any;
    if (err.response?.data?.retryable !== undefined) {
      return err.response.data.retryable;
    }
    if (err.retryable !== undefined) {
      return err.retryable;
    }
    // Network errors are typically retryable
    if (err.message?.includes('Network') || err.message?.includes('timeout')) {
      return true;
    }
  }
  return false;
}

/**
 * Get suggestion from error if available
 */
export function getErrorSuggestion(error: unknown): string | null {
  if (error && typeof error === 'object') {
    const err = error as any;
    return err.response?.data?.suggestion || err.suggestion || null;
  }
  return null;
}
