/**
 * Error Messages Utility Tests
 *
 * Comprehensive unit tests for frontend error message utilities covering:
 * - getUserErrorMessage - extracting user-friendly messages
 * - isRetryableError - determining if errors can be retried
 * - getErrorSuggestion - extracting helpful suggestions
 */

import {
  getUserErrorMessage,
  isRetryableError,
  getErrorSuggestion,
} from '../errorMessages';

describe('Error Messages Utilities', () => {
  // ==========================================================================
  // getUserErrorMessage Tests
  // ==========================================================================

  describe('getUserErrorMessage', () => {
    describe('API Error Response Format', () => {
      it('should extract userMessage from response.data', () => {
        const error = {
          response: {
            data: {
              userMessage: 'The document is too large to process.',
            },
          },
        };

        const message = getUserErrorMessage(error);

        expect(message).toBe('The document is too large to process.');
      });

      it('should extract userMessage from top-level object', () => {
        const error = {
          userMessage: 'Background processing is temporarily unavailable.',
        };

        const message = getUserErrorMessage(error);

        expect(message).toBe('Background processing is temporarily unavailable.');
      });

      it('should extract standard message from response.data', () => {
        const error = {
          response: {
            data: {
              message: 'Invalid credentials',
            },
          },
        };

        const message = getUserErrorMessage(error);

        expect(message).toBe('Invalid credentials');
      });

      it('should prefer userMessage over message', () => {
        const error = {
          response: {
            data: {
              userMessage: 'User-friendly message',
              message: 'Technical message',
            },
          },
        };

        const message = getUserErrorMessage(error);

        expect(message).toBe('User-friendly message');
      });
    });

    describe('Network Errors', () => {
      it('should translate Network Error to user-friendly message', () => {
        const error = {
          message: 'Network Error',
        };

        const message = getUserErrorMessage(error);

        expect(message).toBe('Connection failed. Please check your internet connection.');
      });

      it('should handle network errors in different formats', () => {
        const error = new Error('Network Error: Failed to connect');

        const message = getUserErrorMessage(error);

        expect(message).toBe('Connection failed. Please check your internet connection.');
      });
    });

    describe('Timeout Errors', () => {
      it('should translate timeout errors', () => {
        const error = {
          message: 'Request timeout',
        };

        const message = getUserErrorMessage(error);

        expect(message).toBe('Request timed out. Please try again.');
      });

      it('should handle timeout in various formats', () => {
        const error = new Error('Connection timed out after 30s');

        const message = getUserErrorMessage(error);

        expect(message).toBe('Request timed out. Please try again.');
      });
    });

    describe('HTTP Status Code Errors', () => {
      it('should translate 401 Unauthorized errors', () => {
        const error = {
          message: '401 Unauthorized',
        };

        const message = getUserErrorMessage(error);

        expect(message).toBe('Session expired. Please log in again.');
      });

      it('should translate 403 Forbidden errors', () => {
        const error = {
          message: '403 Forbidden',
        };

        const message = getUserErrorMessage(error);

        expect(message).toBe("You don't have permission to perform this action.");
      });

      it('should translate 404 Not Found errors', () => {
        const error = {
          message: 'Error 404',
        };

        const message = getUserErrorMessage(error);

        expect(message).toBe('The requested resource was not found.');
      });

      it('should translate 500 Internal Server errors', () => {
        const error = {
          message: '500 Internal Server Error',
        };

        const message = getUserErrorMessage(error);

        expect(message).toBe('Something went wrong on our end. Please try again.');
      });

      it('should handle Unauthorized without status code', () => {
        const error = {
          message: 'Unauthorized access',
        };

        const message = getUserErrorMessage(error);

        expect(message).toBe('Session expired. Please log in again.');
      });

      it('should handle Forbidden without status code', () => {
        const error = {
          message: 'Forbidden resource',
        };

        const message = getUserErrorMessage(error);

        expect(message).toBe("You don't have permission to perform this action.");
      });

      it('should handle Internal error message', () => {
        const error = {
          message: 'Internal error occurred',
        };

        const message = getUserErrorMessage(error);

        expect(message).toBe('Something went wrong on our end. Please try again.');
      });
    });

    describe('Generic Errors', () => {
      it('should return error message if no pattern matches', () => {
        const error = {
          message: 'Custom error message',
        };

        const message = getUserErrorMessage(error);

        expect(message).toBe('Custom error message');
      });

      it('should return default message for unknown errors', () => {
        const error = {};

        const message = getUserErrorMessage(error);

        expect(message).toBe('An unexpected error occurred. Please try again.');
      });

      it('should handle string errors', () => {
        const error = 'Something went wrong';

        const message = getUserErrorMessage(error);

        expect(message).toBe('An unexpected error occurred. Please try again.');
      });

      it('should handle null/undefined errors', () => {
        expect(getUserErrorMessage(null)).toBe('An unexpected error occurred. Please try again.');
        expect(getUserErrorMessage(undefined)).toBe('An unexpected error occurred. Please try again.');
      });

      it('should handle number errors', () => {
        const message = getUserErrorMessage(404);

        expect(message).toBe('An unexpected error occurred. Please try again.');
      });
    });

    describe('Error Inheritance', () => {
      it('should handle Error instances', () => {
        const error = new Error('Test error message');

        const message = getUserErrorMessage(error);

        expect(message).toBe('Test error message');
      });

      it('should handle custom Error classes', () => {
        class CustomError extends Error {
          constructor(message: string) {
            super(message);
            this.name = 'CustomError';
          }
        }

        const error = new CustomError('Custom error occurred');

        const message = getUserErrorMessage(error);

        expect(message).toBe('Custom error occurred');
      });
    });
  });

  // ==========================================================================
  // isRetryableError Tests
  // ==========================================================================

  describe('isRetryableError', () => {
    describe('Explicit Retryable Flag', () => {
      it('should return true when retryable flag is true in response.data', () => {
        const error = {
          response: {
            data: {
              retryable: true,
            },
          },
        };

        expect(isRetryableError(error)).toBe(true);
      });

      it('should return false when retryable flag is false in response.data', () => {
        const error = {
          response: {
            data: {
              retryable: false,
            },
          },
        };

        expect(isRetryableError(error)).toBe(false);
      });

      it('should return true when retryable flag is true at top level', () => {
        const error = {
          retryable: true,
        };

        expect(isRetryableError(error)).toBe(true);
      });

      it('should return false when retryable flag is false at top level', () => {
        const error = {
          retryable: false,
        };

        expect(isRetryableError(error)).toBe(false);
      });

      it('should prefer response.data.retryable over top-level', () => {
        const error = {
          retryable: true,
          response: {
            data: {
              retryable: false,
            },
          },
        };

        expect(isRetryableError(error)).toBe(false);
      });
    });

    describe('Implicit Retryable Detection', () => {
      it('should return true for Network errors', () => {
        const error = {
          message: 'Network Error',
        };

        expect(isRetryableError(error)).toBe(true);
      });

      it('should return true for timeout errors', () => {
        const error = {
          message: 'Request timeout',
        };

        expect(isRetryableError(error)).toBe(true);
      });

      it('should return true for connection timeout', () => {
        const error = new Error('Connection timed out');

        expect(isRetryableError(error)).toBe(true);
      });

      it('should return false for non-retryable errors', () => {
        const error = {
          message: '404 Not Found',
        };

        expect(isRetryableError(error)).toBe(false);
      });

      it('should return false for validation errors', () => {
        const error = {
          message: 'Invalid input',
        };

        expect(isRetryableError(error)).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('should return false for null', () => {
        expect(isRetryableError(null)).toBe(false);
      });

      it('should return false for undefined', () => {
        expect(isRetryableError(undefined)).toBe(false);
      });

      it('should return false for string errors', () => {
        expect(isRetryableError('Error message')).toBe(false);
      });

      it('should return false for number errors', () => {
        expect(isRetryableError(500)).toBe(false);
      });

      it('should return false for empty object', () => {
        expect(isRetryableError({})).toBe(false);
      });
    });
  });

  // ==========================================================================
  // getErrorSuggestion Tests
  // ==========================================================================

  describe('getErrorSuggestion', () => {
    describe('API Response Suggestions', () => {
      it('should extract suggestion from response.data', () => {
        const error = {
          response: {
            data: {
              suggestion: 'Please try uploading a smaller file.',
            },
          },
        };

        const suggestion = getErrorSuggestion(error);

        expect(suggestion).toBe('Please try uploading a smaller file.');
      });

      it('should extract suggestion from top-level object', () => {
        const error = {
          suggestion: 'Please check your internet connection and try again.',
        };

        const suggestion = getErrorSuggestion(error);

        expect(suggestion).toBe('Please check your internet connection and try again.');
      });

      it('should prefer response.data.suggestion over top-level', () => {
        const error = {
          suggestion: 'Top-level suggestion',
          response: {
            data: {
              suggestion: 'Response data suggestion',
            },
          },
        };

        const suggestion = getErrorSuggestion(error);

        expect(suggestion).toBe('Response data suggestion');
      });

      it('should return null when no suggestion available', () => {
        const error = {
          message: 'Error occurred',
        };

        const suggestion = getErrorSuggestion(error);

        expect(suggestion).toBeNull();
      });
    });

    describe('Edge Cases', () => {
      it('should return null for null error', () => {
        expect(getErrorSuggestion(null)).toBeNull();
      });

      it('should return null for undefined error', () => {
        expect(getErrorSuggestion(undefined)).toBeNull();
      });

      it('should return null for string error', () => {
        expect(getErrorSuggestion('Error message')).toBeNull();
      });

      it('should return null for number error', () => {
        expect(getErrorSuggestion(404)).toBeNull();
      });

      it('should return null for empty object', () => {
        expect(getErrorSuggestion({})).toBeNull();
      });

      it('should return null for Error instance without suggestion', () => {
        const error = new Error('Test error');

        expect(getErrorSuggestion(error)).toBeNull();
      });
    });

    describe('Empty/Whitespace Suggestions', () => {
      it('should return empty string suggestion if provided', () => {
        const error = {
          response: {
            data: {
              suggestion: '',
            },
          },
        };

        const suggestion = getErrorSuggestion(error);

        expect(suggestion).toBe('');
      });

      it('should return whitespace suggestion if provided', () => {
        const error = {
          suggestion: '   ',
        };

        const suggestion = getErrorSuggestion(error);

        expect(suggestion).toBe('   ');
      });
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration Tests', () => {
    it('should handle complete OCR error response', () => {
      const error = {
        response: {
          data: {
            userMessage: 'The document is too large to process.',
            retryable: false,
            suggestion: 'Try uploading a smaller file or split the document into multiple parts.',
            category: 'file_error',
          },
        },
      };

      expect(getUserErrorMessage(error)).toBe('The document is too large to process.');
      expect(isRetryableError(error)).toBe(false);
      expect(getErrorSuggestion(error)).toBe('Try uploading a smaller file or split the document into multiple parts.');
    });

    it('should handle timeout error with retry suggestion', () => {
      const error = {
        response: {
          data: {
            userMessage: 'The document is taking too long to process.',
            retryable: true,
            suggestion: 'Please try again in a few moments. The system may be under heavy load.',
          },
        },
      };

      expect(getUserErrorMessage(error)).toBe('The document is taking too long to process.');
      expect(isRetryableError(error)).toBe(true);
      expect(getErrorSuggestion(error)).toBe('Please try again in a few moments. The system may be under heavy load.');
    });

    it('should handle network error with implicit retry', () => {
      const error = {
        message: 'Network Error',
      };

      expect(getUserErrorMessage(error)).toBe('Connection failed. Please check your internet connection.');
      expect(isRetryableError(error)).toBe(true);
      expect(getErrorSuggestion(error)).toBeNull();
    });

    it('should work with axios error format', () => {
      const error = {
        name: 'AxiosError',
        message: 'Request failed with status code 500',
        response: {
          status: 500,
          data: {
            userMessage: 'Something went wrong on our end.',
            retryable: true,
            suggestion: 'Please try again later.',
          },
        },
      };

      expect(getUserErrorMessage(error)).toBe('Something went wrong on our end.');
      expect(isRetryableError(error)).toBe(true);
      expect(getErrorSuggestion(error)).toBe('Please try again later.');
    });

    it('should work with fetch error format', () => {
      const error = {
        name: 'TypeError',
        message: 'Failed to fetch',
      };

      expect(getUserErrorMessage(error)).toBe('Failed to fetch');
      expect(isRetryableError(error)).toBe(false);
      expect(getErrorSuggestion(error)).toBeNull();
    });
  });
});
