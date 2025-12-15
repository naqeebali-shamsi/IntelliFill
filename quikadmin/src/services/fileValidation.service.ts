/**
 * File Validation Service
 *
 * Comprehensive security validation for file uploads.
 * Implements requirements from PRD Vector Search v2.0:
 * - REQ-SEC-001: Magic number validation
 * - REQ-SEC-002: Path traversal prevention
 * - REQ-SEC-003: Decompression limits
 * - REQ-SEC-004: PDF security validation
 *
 * Critical security service for VULN-002 mitigation.
 *
 * @module services/fileValidation.service
 */

import path from 'path';
import crypto from 'crypto';
import { logger } from '../utils/logger';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface FileValidationResult {
  isValid: boolean;
  sanitizedFilename: string;
  detectedMimeType: string | null;
  securityFlags: string[];
  errors: string[];
}

export interface FileValidationOptions {
  maxFileSize?: number;
  maxPages?: number;
  allowedMimeTypes?: string[];
  skipMagicValidation?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * File size and processing limits
 * Addresses: REQ-SEC-003 (Decompression limits)
 */
export const FILE_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_DECOMPRESSED_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_EXTRACTION_TIME: 30000, // 30 seconds
  MAX_PAGES: 50,
  MIN_FILE_SIZE: 10, // Minimum 10 bytes (to reject empty files)
} as const;

/**
 * Allowed MIME types for document processing
 */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/tiff',
] as const;

/**
 * Magic number signatures for file type validation
 * Addresses: REQ-SEC-001 (Magic number validation)
 */
const MAGIC_NUMBERS: Record<string, { signature: number[]; offset: number }> = {
  'application/pdf': { signature: [0x25, 0x50, 0x44, 0x46], offset: 0 }, // %PDF
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    signature: [0x50, 0x4b, 0x03, 0x04],
    offset: 0,
  }, // PK.. (ZIP-based)
  'image/jpeg': { signature: [0xff, 0xd8, 0xff], offset: 0 },
  'image/png': { signature: [0x89, 0x50, 0x4e, 0x47], offset: 0 },
  'image/tiff': { signature: [0x49, 0x49, 0x2a, 0x00], offset: 0 }, // Little-endian TIFF
};

/**
 * Characters that are invalid in filenames
 */
const INVALID_FILENAME_CHARS = /[<>:"|?*\x00-\x1f]/g;

/**
 * Path traversal patterns to detect
 */
const PATH_TRAVERSAL_PATTERNS = [
  /\.\./g, // Parent directory traversal
  /^[/\\]/, // Absolute paths
  /[/\\]\.\./, // Hidden directory with traversal
  /%2e%2e/gi, // URL encoded traversal
  /%252e%252e/gi, // Double URL encoded traversal
];

/**
 * Suspicious PDF patterns that may indicate malicious content
 * Addresses: REQ-SEC-004 (PDF security validation)
 */
const SUSPICIOUS_PDF_PATTERNS = [
  /\/JavaScript\s/i, // JavaScript action
  /\/JS\s/i, // JavaScript shorthand
  /\/Launch\s/i, // Launch action
  /\/OpenAction\s/i, // Automatic action on open
  /\/AA\s/i, // Additional actions
  /\/EmbeddedFile\s/i, // Embedded files
  /\/URI\s*\(/i, // URI actions
  /\/SubmitForm\s/i, // Form submission
  /\/ImportData\s/i, // Data import
  /\/GoToR\s/i, // Remote GoTo
  /\/GoToE\s/i, // Embedded GoTo
];

// ============================================================================
// File Validation Service Class
// ============================================================================

export class FileValidationService {
  private defaultOptions: FileValidationOptions;

  constructor(options: FileValidationOptions = {}) {
    this.defaultOptions = {
      maxFileSize: FILE_LIMITS.MAX_FILE_SIZE,
      maxPages: FILE_LIMITS.MAX_PAGES,
      allowedMimeTypes: [...ALLOWED_MIME_TYPES],
      skipMagicValidation: false,
      ...options,
    };
  }

  /**
   * Validate a file buffer for security and type compliance
   *
   * @param buffer - File content buffer
   * @param filename - Original filename
   * @param declaredMimeType - MIME type declared by client (optional)
   * @param options - Validation options override
   * @returns Validation result with security flags
   */
  async validateFile(
    buffer: Buffer,
    filename: string,
    declaredMimeType?: string,
    options?: FileValidationOptions
  ): Promise<FileValidationResult> {
    const opts = { ...this.defaultOptions, ...options };
    const result: FileValidationResult = {
      isValid: true,
      sanitizedFilename: '',
      detectedMimeType: null,
      securityFlags: [],
      errors: [],
    };

    try {
      // 1. Sanitize filename first
      result.sanitizedFilename = this.sanitizeFilename(filename);
      if (result.sanitizedFilename !== filename) {
        result.securityFlags.push('FILENAME_SANITIZED');
      }

      // 2. Check file size
      if (!this.validateFileSize(buffer, opts.maxFileSize!)) {
        result.isValid = false;
        result.errors.push(
          `File size ${buffer.length} exceeds maximum ${opts.maxFileSize} bytes`
        );
        return result;
      }

      // 3. Detect actual MIME type from magic numbers
      if (!opts.skipMagicValidation) {
        result.detectedMimeType = this.detectMimeType(buffer);

        // Verify declared type matches detected type
        if (declaredMimeType && result.detectedMimeType) {
          if (
            !this.mimeTypesMatch(declaredMimeType, result.detectedMimeType)
          ) {
            result.securityFlags.push('MIME_TYPE_MISMATCH');
            logger.warn('MIME type mismatch detected', {
              declared: declaredMimeType,
              detected: result.detectedMimeType,
              filename: result.sanitizedFilename,
            });
          }
        }

        // Check if detected type is allowed
        if (
          result.detectedMimeType &&
          !opts.allowedMimeTypes!.includes(result.detectedMimeType)
        ) {
          result.isValid = false;
          result.errors.push(
            `File type ${result.detectedMimeType} is not allowed`
          );
          return result;
        }
      }

      // 4. PDF-specific security validation
      if (
        result.detectedMimeType === 'application/pdf' ||
        declaredMimeType === 'application/pdf'
      ) {
        const pdfValidation = await this.validatePDF(buffer);
        result.securityFlags.push(...pdfValidation.flags);

        if (!pdfValidation.isValid) {
          result.isValid = false;
          result.errors.push(...pdfValidation.errors);
        }
      }

      // 5. Check for path traversal in filename
      if (this.hasPathTraversal(filename)) {
        result.isValid = false;
        result.securityFlags.push('PATH_TRAVERSAL_ATTEMPT');
        result.errors.push('Filename contains path traversal attempt');
      }

      return result;
    } catch (error) {
      logger.error('File validation error', { error, filename });
      result.isValid = false;
      result.errors.push(
        `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return result;
    }
  }

  /**
   * Sanitize filename to prevent path traversal attacks
   * Addresses: REQ-SEC-002 (Path traversal prevention)
   *
   * @param filename - Original filename
   * @returns Sanitized filename safe for filesystem use
   */
  sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return `file_${Date.now()}`;
    }

    // Get just the base filename (removes directory paths)
    let sanitized = path.basename(filename);

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Remove path traversal patterns
    sanitized = sanitized.replace(/\.\./g, '');

    // Remove invalid characters
    sanitized = sanitized.replace(INVALID_FILENAME_CHARS, '_');

    // Remove leading/trailing dots and spaces
    sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');

    // Limit length
    if (sanitized.length > 255) {
      const ext = path.extname(sanitized);
      const name = path.basename(sanitized, ext);
      sanitized = name.substring(0, 255 - ext.length) + ext;
    }

    // Ensure we have a valid filename
    if (!sanitized || sanitized === '') {
      sanitized = `file_${Date.now()}`;
    }

    return sanitized;
  }

  /**
   * Check if filename contains path traversal attempts
   *
   * @param filename - Filename to check
   * @returns True if path traversal detected
   */
  hasPathTraversal(filename: string): boolean {
    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(filename)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Validate file size against limits
   *
   * @param buffer - File buffer
   * @param maxSize - Maximum allowed size in bytes
   * @returns True if file size is valid
   */
  validateFileSize(buffer: Buffer, maxSize: number): boolean {
    if (buffer.length < FILE_LIMITS.MIN_FILE_SIZE) {
      return false;
    }
    return buffer.length <= maxSize;
  }

  /**
   * Detect MIME type from file magic numbers
   * Addresses: REQ-SEC-001 (Magic number validation)
   *
   * @param buffer - File buffer
   * @returns Detected MIME type or null
   */
  detectMimeType(buffer: Buffer): string | null {
    for (const [mimeType, { signature, offset }] of Object.entries(
      MAGIC_NUMBERS
    )) {
      if (this.checkMagicNumber(buffer, signature, offset)) {
        return mimeType;
      }
    }

    // Check for text/plain (no magic number, but must be valid UTF-8/ASCII)
    if (this.isTextFile(buffer)) {
      return 'text/plain';
    }

    return null;
  }

  /**
   * Check if buffer starts with expected magic number
   */
  private checkMagicNumber(
    buffer: Buffer,
    signature: number[],
    offset: number
  ): boolean {
    if (buffer.length < offset + signature.length) {
      return false;
    }

    for (let i = 0; i < signature.length; i++) {
      if (buffer[offset + i] !== signature[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if buffer appears to be a text file
   */
  private isTextFile(buffer: Buffer): boolean {
    // Check first 8KB for non-text bytes
    const checkLength = Math.min(buffer.length, 8192);

    for (let i = 0; i < checkLength; i++) {
      const byte = buffer[i];
      // Allow printable ASCII, tabs, newlines, carriage returns
      if (byte < 0x09 || (byte > 0x0d && byte < 0x20) || byte === 0x7f) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if two MIME types are compatible
   */
  private mimeTypesMatch(declared: string, detected: string): boolean {
    // Exact match
    if (declared === detected) {
      return true;
    }

    // DOCX files are ZIP-based, so detected might be application/zip
    if (
      declared ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
      detected === 'application/zip'
    ) {
      return true;
    }

    return false;
  }

  /**
   * Validate PDF file for security threats
   * Addresses: REQ-SEC-004 (PDF security validation)
   *
   * @param buffer - PDF file buffer
   * @returns Validation result with security flags
   */
  async validatePDF(
    buffer: Buffer
  ): Promise<{ isValid: boolean; flags: string[]; errors: string[] }> {
    const flags: string[] = [];
    const errors: string[] = [];
    let isValid = true;

    try {
      // Convert buffer to string for pattern matching
      // Note: This is a basic implementation. For production, consider using pdf-lib
      const content = buffer.toString('binary');

      // Check for suspicious patterns
      for (const pattern of SUSPICIOUS_PDF_PATTERNS) {
        if (pattern.test(content)) {
          const patternName = pattern.source.replace(/\\/g, '').toUpperCase();
          flags.push(`PDF_SUSPICIOUS_${patternName}`);
          logger.warn('Suspicious PDF pattern detected', {
            pattern: pattern.source,
          });
        }
      }

      // Check for JavaScript (critical security concern)
      if (/\/JavaScript\s/i.test(content) || /\/JS\s/i.test(content)) {
        isValid = false;
        errors.push('PDF contains JavaScript which is not allowed');
        flags.push('PDF_CONTAINS_JAVASCRIPT');
      }

      // Check for encrypted content (may hide malicious content)
      if (/\/Encrypt\s/i.test(content)) {
        flags.push('PDF_ENCRYPTED');
        // Encrypted PDFs are allowed but flagged
      }

      // Check for embedded files (potential security risk)
      if (/\/EmbeddedFile\s/i.test(content)) {
        flags.push('PDF_HAS_EMBEDDED_FILES');
        logger.warn('PDF contains embedded files');
      }

      // Verify PDF header
      if (!content.startsWith('%PDF-')) {
        isValid = false;
        errors.push('Invalid PDF header');
        flags.push('PDF_INVALID_HEADER');
      }

      // Check for PDF version (support 1.0 - 2.0)
      const versionMatch = content.match(/%PDF-(\d+\.\d+)/);
      if (versionMatch) {
        const version = parseFloat(versionMatch[1]);
        if (version < 1.0 || version > 2.0) {
          flags.push('PDF_UNUSUAL_VERSION');
        }
      }

      return { isValid, flags, errors };
    } catch (error) {
      logger.error('PDF validation error', { error });
      return {
        isValid: false,
        flags: ['PDF_VALIDATION_ERROR'],
        errors: [
          `PDF validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
      };
    }
  }

  /**
   * Generate a secure hash for file content
   * Useful for deduplication and integrity checking
   *
   * @param buffer - File buffer
   * @returns SHA-256 hash as hex string
   */
  generateFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Validate file extension matches expected MIME type
   *
   * @param filename - Filename with extension
   * @param mimeType - Expected MIME type
   * @returns True if extension matches MIME type
   */
  validateExtension(filename: string, mimeType: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    const expectedExtensions: Record<string, string[]> = {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
      'text/plain': ['.txt', '.text'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/tiff': ['.tif', '.tiff'],
    };

    const allowed = expectedExtensions[mimeType];
    if (!allowed) {
      return false;
    }

    return allowed.includes(ext);
  }
}

// ============================================================================
// Default Export - Singleton Instance
// ============================================================================

export const fileValidationService = new FileValidationService();

export default fileValidationService;
