import { logger } from './logger';

export interface TranslatedError {
  userMessage: string;
  retryable: boolean;
  suggestion: string;
  category: 'file_error' | 'processing_error' | 'system_error' | 'validation_error';
  originalError?: string;
}

export class OCRError extends Error {
  public readonly code: string;
  public readonly userMessage: string;
  public readonly retryable: boolean;
  public readonly suggestion: string;

  constructor(
    code: string,
    userMessage: string,
    technicalMessage: string,
    retryable: boolean = false,
    suggestion: string = ''
  ) {
    super(technicalMessage);
    this.name = 'OCRError';
    this.code = code;
    this.userMessage = userMessage;
    this.retryable = retryable;
    this.suggestion = suggestion;
  }
}

export function translateOCRError(
  error: unknown,
  context?: { fileName?: string; pageNumber?: number }
): TranslatedError {
  const errorStr = error instanceof Error ? error.message : String(error);

  // Pattern matching for common OCR errors
  const errorPatterns: Array<{
    pattern: RegExp;
    result: Omit<TranslatedError, 'originalError'>;
  }> = [
    {
      pattern: /memory.*allocation|out of memory/i,
      result: {
        userMessage: 'The document is too large to process.',
        retryable: false,
        suggestion: 'Try uploading a smaller file or split the document into multiple parts.',
        category: 'file_error'
      }
    },
    {
      pattern: /pdf.*corrupt|invalid pdf|pdf.*error/i,
      result: {
        userMessage: 'The PDF file appears to be corrupted or unsupported.',
        retryable: false,
        suggestion: 'Try opening the file in Adobe Reader and re-saving it.',
        category: 'file_error'
      }
    },
    {
      pattern: /timeout|timed out/i,
      result: {
        userMessage: 'The document is taking too long to process.',
        retryable: true,
        suggestion: 'Please try again in a few moments. The system may be under heavy load.',
        category: 'system_error'
      }
    },
    {
      pattern: /tesseract.*worker|worker.*error/i,
      result: {
        userMessage: 'Text recognition engine encountered an error.',
        retryable: true,
        suggestion: 'Please try again. If the problem persists, the document may be unsupported.',
        category: 'processing_error'
      }
    },
    {
      pattern: /convert.*image|image.*conversion/i,
      result: {
        userMessage: context?.pageNumber
          ? `We couldn't read page ${context.pageNumber} of your document.`
          : 'We couldn\'t read one or more pages of your document.',
        retryable: false,
        suggestion: 'Please check the document quality or try a different file.',
        category: 'file_error'
      }
    },
    {
      pattern: /unsupported.*file|file.*type/i,
      result: {
        userMessage: 'This file type is not supported.',
        retryable: false,
        suggestion: 'Please upload a PDF, PNG, JPG, or TIFF file.',
        category: 'validation_error'
      }
    },
    {
      pattern: /redis|queue.*unavailable/i,
      result: {
        userMessage: 'Background processing is temporarily unavailable.',
        retryable: true,
        suggestion: 'Your document will be processed when the system is ready, or try synchronous processing.',
        category: 'system_error'
      }
    },
    {
      pattern: /network|connection/i,
      result: {
        userMessage: 'A connection error occurred.',
        retryable: true,
        suggestion: 'Please check your internet connection and try again.',
        category: 'system_error'
      }
    }
  ];

  // Find matching pattern
  for (const { pattern, result } of errorPatterns) {
    if (pattern.test(errorStr)) {
      logger.debug(`OCR error translated: ${errorStr} -> ${result.userMessage}`);
      return { ...result, originalError: errorStr };
    }
  }

  // Default fallback for unknown errors
  logger.warn(`Unknown OCR error (no pattern match): ${errorStr}`);
  return {
    userMessage: 'An unexpected error occurred while processing your document.',
    retryable: true,
    suggestion: 'Please try again. If the problem persists, contact support.',
    category: 'system_error',
    originalError: errorStr
  };
}

// Confidence level messages
export function getConfidenceMessage(confidence: number): {
  level: 'high' | 'medium' | 'low' | 'very_low';
  message: string;
  needsReview: boolean;
} {
  if (confidence >= 85) {
    return {
      level: 'high',
      message: 'Text extracted with high confidence.',
      needsReview: false
    };
  }
  if (confidence >= 70) {
    return {
      level: 'medium',
      message: `Text extracted with ${confidence.toFixed(0)}% confidence. Please review for accuracy.`,
      needsReview: true
    };
  }
  if (confidence >= 50) {
    return {
      level: 'low',
      message: `Low confidence extraction (${confidence.toFixed(0)}%). Please carefully review and correct any errors.`,
      needsReview: true
    };
  }
  return {
    level: 'very_low',
    message: `Very low confidence extraction (${confidence.toFixed(0)}%). The document may be poor quality or in an unsupported language.`,
    needsReview: true
  };
}
