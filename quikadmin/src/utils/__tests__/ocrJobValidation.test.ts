import {
  isValidUUID,
  isAllowedUrl,
  containsPathTraversal,
  validateFilePath,
  validateOcrJobData,
  validateOcrJobDataOrThrow,
  OCRValidationError,
  OCR_VALIDATION_CONFIG,
} from '../ocrJobValidation';

describe('OCR Job Validation Utility', () => {
  describe('isValidUUID', () => {
    it('should return true for valid UUID v4', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('6ba7b810-9dad-41d1-80b4-00c04fd430c8')).toBe(true);
      expect(isValidUUID('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
    });

    it('should return false for invalid UUIDs', () => {
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('12345')).toBe(false);
      expect(isValidUUID('550e8400-e29b-11d4-a716-446655440000')).toBe(false); // v1, not v4
      expect(isValidUUID('550e8400-e29b-51d4-a716-446655440000')).toBe(false); // v5, not v4
    });

    it('should return false for null/undefined', () => {
      expect(isValidUUID(null as unknown as string)).toBe(false);
      expect(isValidUUID(undefined as unknown as string)).toBe(false);
    });
  });

  describe('isAllowedUrl', () => {
    it('should return true for valid R2 storage URLs', () => {
      expect(isAllowedUrl('https://abc123.r2.cloudflarestorage.com/bucket/file.pdf')).toBe(true);
      expect(isAllowedUrl('https://myaccount.r2.cloudflarestorage.com/docs/doc.pdf')).toBe(true);
      expect(isAllowedUrl('https://test-account.r2.dev/bucket/file.pdf')).toBe(true);
    });

    it('should return false for non-R2 URLs', () => {
      expect(isAllowedUrl('https://example.com/file.pdf')).toBe(false);
      expect(isAllowedUrl('https://malicious.com/abc123.r2.cloudflarestorage.com/file.pdf')).toBe(
        false
      );
      expect(isAllowedUrl('http://abc123.r2.cloudflarestorage.com/file.pdf')).toBe(false); // HTTP not allowed
      expect(isAllowedUrl('https://s3.amazonaws.com/bucket/file.pdf')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(isAllowedUrl('not-a-url')).toBe(false);
      expect(isAllowedUrl('/local/path/file.pdf')).toBe(false);
      expect(isAllowedUrl('')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isAllowedUrl(null as unknown as string)).toBe(false);
      expect(isAllowedUrl(undefined as unknown as string)).toBe(false);
    });
  });

  describe('containsPathTraversal', () => {
    it('should detect path traversal patterns', () => {
      expect(containsPathTraversal('../etc/passwd')).toBe(true);
      expect(containsPathTraversal('file/../../secret')).toBe(true);
      expect(containsPathTraversal('..%2F..%2Fetc')).toBe(true);
      expect(containsPathTraversal('..%5C..%5Cwindows')).toBe(true);
      expect(containsPathTraversal('file%00.pdf')).toBe(true);
    });

    it('should return false for safe paths', () => {
      expect(containsPathTraversal('https://r2.storage.com/file.pdf')).toBe(false);
      expect(containsPathTraversal('/normal/path/file.pdf')).toBe(false);
      expect(containsPathTraversal('document-123.pdf')).toBe(false);
    });
  });

  describe('validateFilePath', () => {
    it('should pass for valid R2 URLs', () => {
      const result = validateFilePath('https://abc123.r2.cloudflarestorage.com/bucket/file.pdf');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for non-R2 URLs', () => {
      const result = validateFilePath('https://example.com/file.pdf');
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_URL');
    });

    it('should fail for path traversal attempts', () => {
      const result = validateFilePath(
        'https://abc123.r2.cloudflarestorage.com/../../../etc/passwd'
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('PATH_TRAVERSAL');
    });

    it('should fail for empty/missing path', () => {
      const result = validateFilePath('');
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('REQUIRED');
    });

    it('should fail for paths exceeding max length', () => {
      const longPath =
        'https://abc123.r2.cloudflarestorage.com/' +
        'a'.repeat(OCR_VALIDATION_CONFIG.MAX_PATH_LENGTH);
      const result = validateFilePath(longPath);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('PATH_TOO_LONG');
    });
  });

  describe('validateOcrJobData', () => {
    const validData = {
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
      filePath: 'https://abc123.r2.cloudflarestorage.com/bucket/file.pdf',
    };

    it('should pass for valid data', () => {
      const result = validateOcrJobData(validData);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for invalid documentId', () => {
      const result = validateOcrJobData({
        ...validData,
        documentId: 'invalid-uuid',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'documentId')).toBe(true);
    });

    it('should fail for invalid userId', () => {
      const result = validateOcrJobData({
        ...validData,
        userId: 'not-a-uuid',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'userId')).toBe(true);
    });

    it('should fail for invalid filePath', () => {
      const result = validateOcrJobData({
        ...validData,
        filePath: 'https://malicious.com/file.pdf',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'filePath')).toBe(true);
    });

    it('should collect multiple errors', () => {
      const result = validateOcrJobData({
        documentId: 'invalid',
        userId: 'invalid',
        filePath: 'invalid',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('validateOcrJobDataOrThrow', () => {
    it('should not throw for valid data', () => {
      expect(() =>
        validateOcrJobDataOrThrow({
          documentId: '550e8400-e29b-41d4-a716-446655440000',
          userId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
          filePath: 'https://abc123.r2.cloudflarestorage.com/bucket/file.pdf',
        })
      ).not.toThrow();
    });

    it('should throw OCRValidationError for invalid data', () => {
      expect(() =>
        validateOcrJobDataOrThrow({
          documentId: 'invalid',
          filePath: 'https://abc123.r2.cloudflarestorage.com/bucket/file.pdf',
        })
      ).toThrow(OCRValidationError);
    });

    it('should include error code in thrown error', () => {
      try {
        validateOcrJobDataOrThrow({
          documentId: 'invalid',
          filePath: 'https://abc123.r2.cloudflarestorage.com/bucket/file.pdf',
        });
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OCRValidationError);
        expect((error as OCRValidationError).code).toBe('INVALID_UUID');
        expect((error as OCRValidationError).field).toBe('documentId');
      }
    });

    it('should throw for SSRF attempts', () => {
      expect(() =>
        validateOcrJobDataOrThrow({
          documentId: '550e8400-e29b-41d4-a716-446655440000',
          filePath: 'https://internal-server.corp.net/secret/file.pdf',
        })
      ).toThrow(OCRValidationError);
    });

    it('should throw for path traversal attempts', () => {
      expect(() =>
        validateOcrJobDataOrThrow({
          documentId: '550e8400-e29b-41d4-a716-446655440000',
          filePath: 'https://abc123.r2.cloudflarestorage.com/../../etc/passwd',
        })
      ).toThrow(OCRValidationError);
    });
  });

  describe('OCRValidationError', () => {
    it('should be instanceof Error', () => {
      const error = new OCRValidationError('test message', 'TEST_CODE', 'testField');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct properties', () => {
      const error = new OCRValidationError('test message', 'TEST_CODE', 'testField');
      expect(error.message).toBe('test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.field).toBe('testField');
      expect(error.name).toBe('OCRValidationError');
    });
  });
});
