/**
 * OCR Error Messages Tests
 *
 * Comprehensive unit tests covering:
 * - Error translation with pattern matching
 * - Confidence level message generation
 * - OCRError class functionality
 */

import {
  translateOCRError,
  getConfidenceMessage,
  OCRError,
} from '../ocrErrorMessages';

describe('OCR Error Messages', () => {
  // ==========================================================================
  // translateOCRError Tests
  // ==========================================================================

  describe('translateOCRError', () => {
    it('should translate memory allocation errors', () => {
      const error = new Error('Memory allocation failed');
      const result = translateOCRError(error);

      expect(result.userMessage).toBe('The document is too large to process.');
      expect(result.retryable).toBe(false);
      expect(result.suggestion).toContain('smaller file');
      expect(result.category).toBe('file_error');
      expect(result.originalError).toBe('Memory allocation failed');
    });

    it('should translate out of memory errors', () => {
      const error = new Error('Out of memory during OCR processing');
      const result = translateOCRError(error);

      expect(result.userMessage).toBe('The document is too large to process.');
      expect(result.retryable).toBe(false);
      expect(result.category).toBe('file_error');
    });

    it('should translate PDF corruption errors', () => {
      const error = new Error('PDF is corrupt and cannot be processed');
      const result = translateOCRError(error);

      expect(result.userMessage).toBe('The PDF file appears to be corrupted or unsupported.');
      expect(result.retryable).toBe(false);
      expect(result.suggestion).toContain('Adobe Reader');
      expect(result.category).toBe('file_error');
    });

    it('should translate invalid PDF errors', () => {
      const error = new Error('Invalid PDF structure detected');
      const result = translateOCRError(error);

      expect(result.userMessage).toBe('The PDF file appears to be corrupted or unsupported.');
      expect(result.retryable).toBe(false);
      expect(result.category).toBe('file_error');
    });

    it('should translate timeout errors', () => {
      const error = new Error('OCR processing timed out');
      const result = translateOCRError(error);

      expect(result.userMessage).toBe('The document is taking too long to process.');
      expect(result.retryable).toBe(true);
      expect(result.suggestion).toContain('try again');
      expect(result.category).toBe('system_error');
    });

    it('should translate Tesseract worker errors', () => {
      const error = new Error('Tesseract worker initialization failed');
      const result = translateOCRError(error);

      expect(result.userMessage).toBe('Text recognition engine encountered an error.');
      expect(result.retryable).toBe(true);
      expect(result.category).toBe('processing_error');
    });

    it('should translate image conversion errors', () => {
      const error = new Error('Failed to convert PDF page to image');
      const result = translateOCRError(error);

      expect(result.userMessage).toContain("couldn't read");
      expect(result.retryable).toBe(false);
      expect(result.category).toBe('file_error');
    });

    it('should translate image conversion errors with page context', () => {
      const error = new Error('Image conversion failed on page 5');
      const result = translateOCRError(error, { pageNumber: 5 });

      expect(result.userMessage).toContain('page 5');
      expect(result.retryable).toBe(false);
    });

    it('should translate unsupported file type errors', () => {
      const error = new Error('Unsupported file type detected');
      const result = translateOCRError(error);

      expect(result.userMessage).toBe('This file type is not supported.');
      expect(result.retryable).toBe(false);
      expect(result.suggestion).toContain('PDF, PNG, JPG');
      expect(result.category).toBe('validation_error');
    });

    it('should translate Redis/queue errors', () => {
      const error = new Error('Redis connection failed - queue unavailable');
      const result = translateOCRError(error);

      expect(result.userMessage).toBe('Background processing is temporarily unavailable.');
      expect(result.retryable).toBe(true);
      expect(result.suggestion).toContain('synchronous processing');
      expect(result.category).toBe('system_error');
    });

    it('should translate network errors', () => {
      const error = new Error('Network connection lost');
      const result = translateOCRError(error);

      expect(result.userMessage).toBe('A connection error occurred.');
      expect(result.retryable).toBe(true);
      expect(result.suggestion).toContain('internet connection');
      expect(result.category).toBe('system_error');
    });

    it('should handle non-Error objects', () => {
      const error = 'String error message';
      const result = translateOCRError(error);

      expect(result.userMessage).toBe('An unexpected error occurred while processing your document.');
      expect(result.retryable).toBe(true);
      expect(result.originalError).toBe('String error message');
    });

    it('should handle unknown error types with default message', () => {
      const error = new Error('Some unknown technical error');
      const result = translateOCRError(error);

      expect(result.userMessage).toBe('An unexpected error occurred while processing your document.');
      expect(result.retryable).toBe(true);
      expect(result.suggestion).toContain('try again');
      expect(result.category).toBe('system_error');
      expect(result.originalError).toBe('Some unknown technical error');
    });

    it('should include filename context when provided', () => {
      const error = new Error('Processing failed');
      const result = translateOCRError(error, { fileName: 'document.pdf' });

      expect(result.originalError).toBe('Processing failed');
    });

    it('should handle errors without message property', () => {
      const error = { toString: () => 'Custom error object' };
      const result = translateOCRError(error);

      expect(result.originalError).toBe('Custom error object');
    });
  });

  // ==========================================================================
  // getConfidenceMessage Tests
  // ==========================================================================

  describe('getConfidenceMessage', () => {
    it('should return high confidence message for >= 85%', () => {
      const result = getConfidenceMessage(85);

      expect(result.level).toBe('high');
      expect(result.message).toBe('Text extracted with high confidence.');
      expect(result.needsReview).toBe(false);
    });

    it('should return high confidence message for 100%', () => {
      const result = getConfidenceMessage(100);

      expect(result.level).toBe('high');
      expect(result.needsReview).toBe(false);
    });

    it('should return medium confidence message for 70-84%', () => {
      const result = getConfidenceMessage(75);

      expect(result.level).toBe('medium');
      expect(result.message).toContain('75% confidence');
      expect(result.message).toContain('Please review');
      expect(result.needsReview).toBe(true);
    });

    it('should return medium confidence at lower boundary', () => {
      const result = getConfidenceMessage(70);

      expect(result.level).toBe('medium');
      expect(result.message).toContain('70% confidence');
      expect(result.needsReview).toBe(true);
    });

    it('should return medium confidence at upper boundary', () => {
      const result = getConfidenceMessage(84);

      expect(result.level).toBe('medium');
      expect(result.message).toContain('84% confidence');
      expect(result.needsReview).toBe(true);
    });

    it('should return low confidence message for 50-69%', () => {
      const result = getConfidenceMessage(60);

      expect(result.level).toBe('low');
      expect(result.message).toContain('Low confidence');
      expect(result.message).toContain('60%');
      expect(result.message).toContain('carefully review');
      expect(result.needsReview).toBe(true);
    });

    it('should return low confidence at lower boundary', () => {
      const result = getConfidenceMessage(50);

      expect(result.level).toBe('low');
      expect(result.message).toContain('50%');
      expect(result.needsReview).toBe(true);
    });

    it('should return low confidence at upper boundary', () => {
      const result = getConfidenceMessage(69);

      expect(result.level).toBe('low');
      expect(result.message).toContain('69%');
      expect(result.needsReview).toBe(true);
    });

    it('should return very low confidence message for < 50%', () => {
      const result = getConfidenceMessage(30);

      expect(result.level).toBe('very_low');
      expect(result.message).toContain('Very low confidence');
      expect(result.message).toContain('30%');
      expect(result.message).toContain('poor quality');
      expect(result.needsReview).toBe(true);
    });

    it('should return very low confidence for 0%', () => {
      const result = getConfidenceMessage(0);

      expect(result.level).toBe('very_low');
      expect(result.message).toContain('0%');
      expect(result.needsReview).toBe(true);
    });

    it('should handle decimal confidence values', () => {
      const result = getConfidenceMessage(87.5);

      expect(result.level).toBe('high');
      expect(result.needsReview).toBe(false);
    });

    it('should round confidence in message', () => {
      const result = getConfidenceMessage(72.7);

      expect(result.message).toContain('73% confidence');
    });
  });

  // ==========================================================================
  // OCRError Class Tests
  // ==========================================================================

  describe('OCRError', () => {
    it('should create OCRError with all properties', () => {
      const error = new OCRError(
        'OCR_FAILED',
        'Failed to process document',
        'Technical error: Tesseract worker crashed',
        true,
        'Please try again later'
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('OCRError');
      expect(error.code).toBe('OCR_FAILED');
      expect(error.userMessage).toBe('Failed to process document');
      expect(error.message).toBe('Technical error: Tesseract worker crashed');
      expect(error.retryable).toBe(true);
      expect(error.suggestion).toBe('Please try again later');
    });

    it('should create OCRError with default retryable false', () => {
      const error = new OCRError(
        'OCR_CORRUPT_PDF',
        'PDF is corrupted',
        'Invalid PDF structure'
      );

      expect(error.retryable).toBe(false);
      expect(error.suggestion).toBe('');
    });

    it('should create OCRError without suggestion', () => {
      const error = new OCRError(
        'OCR_TIMEOUT',
        'Processing timed out',
        'OCR timeout after 10 minutes',
        true
      );

      expect(error.retryable).toBe(true);
      expect(error.suggestion).toBe('');
    });

    it('should have correct prototype chain', () => {
      const error = new OCRError('TEST', 'Test error', 'Technical error');

      expect(error instanceof OCRError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it('should preserve stack trace', () => {
      const error = new OCRError('TEST', 'Test error', 'Technical error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('OCRError');
    });

    it('should be throwable and catchable', () => {
      const throwError = () => {
        throw new OCRError('TEST', 'User message', 'Technical message');
      };

      expect(throwError).toThrow(OCRError);
      expect(throwError).toThrow('Technical message');

      try {
        throwError();
      } catch (error) {
        expect(error).toBeInstanceOf(OCRError);
        if (error instanceof OCRError) {
          expect(error.code).toBe('TEST');
          expect(error.userMessage).toBe('User message');
        }
      }
    });
  });

  // ==========================================================================
  // Edge Cases and Integration Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle null error', () => {
      const result = translateOCRError(null);

      expect(result.userMessage).toBe('An unexpected error occurred while processing your document.');
      expect(result.originalError).toBe('null');
    });

    it('should handle undefined error', () => {
      const result = translateOCRError(undefined);

      expect(result.userMessage).toBe('An unexpected error occurred while processing your document.');
      expect(result.originalError).toBe('undefined');
    });

    it('should handle empty string error', () => {
      const result = translateOCRError('');

      expect(result.userMessage).toBe('An unexpected error occurred while processing your document.');
      expect(result.originalError).toBe('');
    });

    it('should handle errors with very long messages', () => {
      const longMessage = 'A'.repeat(1000);
      const error = new Error(longMessage);
      const result = translateOCRError(error);

      expect(result.originalError).toBe(longMessage);
    });

    it('should be case-insensitive in pattern matching', () => {
      const error1 = new Error('PDF CORRUPT');
      const error2 = new Error('pdf corrupt');
      const error3 = new Error('Pdf Corrupt');

      const result1 = translateOCRError(error1);
      const result2 = translateOCRError(error2);
      const result3 = translateOCRError(error3);

      expect(result1.userMessage).toBe(result2.userMessage);
      expect(result2.userMessage).toBe(result3.userMessage);
    });

    it('should match partial patterns correctly', () => {
      const error = new Error('The PDF file contains an invalid structure');
      const result = translateOCRError(error);

      expect(result.category).toBe('file_error');
      expect(result.userMessage).toContain('corrupted');
    });

    it('should prioritize first matching pattern', () => {
      // Test that if an error matches multiple patterns, the first one wins
      const error = new Error('Memory allocation failed due to timeout');
      const result = translateOCRError(error);

      // Should match 'memory' pattern before 'timeout'
      expect(result.userMessage).toBe('The document is too large to process.');
    });
  });
});
