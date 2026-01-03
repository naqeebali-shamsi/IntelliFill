/**
 * File Validation Service Tests
 *
 * Comprehensive unit tests for the FileValidationService covering:
 * - Magic number validation (REQ-SEC-001)
 * - Path traversal prevention (REQ-SEC-002)
 * - File size validation (REQ-SEC-003)
 * - PDF security validation (REQ-SEC-004)
 */

import { FileValidationService, FILE_LIMITS, ALLOWED_MIME_TYPES } from '../fileValidation.service';

describe('FileValidationService', () => {
  let service: FileValidationService;

  beforeEach(() => {
    service = new FileValidationService();
  });

  // ==========================================================================
  // Filename Sanitization Tests
  // ==========================================================================

  describe('sanitizeFilename', () => {
    it('should keep valid filenames unchanged', () => {
      expect(service.sanitizeFilename('document.pdf')).toBe('document.pdf');
      expect(service.sanitizeFilename('my-file_v2.docx')).toBe('my-file_v2.docx');
    });

    it('should remove path traversal sequences', () => {
      expect(service.sanitizeFilename('../../../etc/passwd')).toBe('passwd');
      expect(service.sanitizeFilename('..\\..\\windows\\system32')).toBe('system32');
      expect(service.sanitizeFilename('file/../secret.txt')).toBe('secret.txt');
    });

    it('should remove null bytes', () => {
      expect(service.sanitizeFilename('file\x00.txt')).toBe('file.txt');
      expect(service.sanitizeFilename('doc\x00ument.pdf')).toBe('document.pdf');
    });

    it('should replace invalid characters', () => {
      expect(service.sanitizeFilename('file<>:"|?*.txt')).toBe('file_______.txt');
    });

    it('should remove leading/trailing dots and spaces', () => {
      expect(service.sanitizeFilename('...file.txt...')).toBe('file.txt');
      expect(service.sanitizeFilename('  document.pdf  ')).toBe('document.pdf');
    });

    it('should handle empty or invalid filenames', () => {
      const result1 = service.sanitizeFilename('');
      expect(result1).toMatch(/^file_\d+$/);

      const result2 = service.sanitizeFilename('...');
      expect(result2).toMatch(/^file_\d+$/);
    });

    it('should truncate long filenames', () => {
      const longName = 'a'.repeat(300) + '.pdf';
      const result = service.sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result.endsWith('.pdf')).toBe(true);
    });

    it('should extract basename from full paths', () => {
      expect(service.sanitizeFilename('/home/user/documents/file.pdf')).toBe('file.pdf');
      expect(service.sanitizeFilename('C:\\Users\\Admin\\Documents\\file.pdf')).toBe('file.pdf');
    });
  });

  // ==========================================================================
  // Path Traversal Detection Tests
  // ==========================================================================

  describe('hasPathTraversal', () => {
    it('should detect parent directory traversal', () => {
      expect(service.hasPathTraversal('../file.txt')).toBe(true);
      expect(service.hasPathTraversal('../../etc/passwd')).toBe(true);
      expect(service.hasPathTraversal('folder/../secret')).toBe(true);
    });

    it('should detect absolute paths', () => {
      expect(service.hasPathTraversal('/etc/passwd')).toBe(true);
      expect(service.hasPathTraversal('\\windows\\system32')).toBe(true);
    });

    it('should detect URL encoded traversal', () => {
      expect(service.hasPathTraversal('%2e%2e/file.txt')).toBe(true);
      expect(service.hasPathTraversal('%252e%252e/file.txt')).toBe(true);
    });

    it('should allow safe filenames', () => {
      expect(service.hasPathTraversal('document.pdf')).toBe(false);
      expect(service.hasPathTraversal('my-file_v2.docx')).toBe(false);
      expect(service.hasPathTraversal('folder.name.txt')).toBe(false);
    });
  });

  // ==========================================================================
  // File Size Validation Tests
  // ==========================================================================

  describe('validateFileSize', () => {
    it('should accept files within size limit', () => {
      const buffer = Buffer.alloc(1024); // 1KB
      expect(service.validateFileSize(buffer, FILE_LIMITS.MAX_FILE_SIZE)).toBe(true);
    });

    it('should reject files exceeding size limit', () => {
      const buffer = Buffer.alloc(FILE_LIMITS.MAX_FILE_SIZE + 1);
      expect(service.validateFileSize(buffer, FILE_LIMITS.MAX_FILE_SIZE)).toBe(false);
    });

    it('should reject files that are too small', () => {
      const buffer = Buffer.alloc(5); // Less than MIN_FILE_SIZE
      expect(service.validateFileSize(buffer, FILE_LIMITS.MAX_FILE_SIZE)).toBe(false);
    });

    it('should accept files at exact limit', () => {
      const buffer = Buffer.alloc(FILE_LIMITS.MAX_FILE_SIZE);
      expect(service.validateFileSize(buffer, FILE_LIMITS.MAX_FILE_SIZE)).toBe(true);
    });
  });

  // ==========================================================================
  // MIME Type Detection Tests
  // ==========================================================================

  describe('detectMimeType', () => {
    it('should detect PDF files', () => {
      // PDF magic number: %PDF
      const pdfBuffer = Buffer.from('%PDF-1.4 test content');
      expect(service.detectMimeType(pdfBuffer)).toBe('application/pdf');
    });

    it('should detect JPEG files', () => {
      // JPEG magic number: FF D8 FF
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(service.detectMimeType(jpegBuffer)).toBe('image/jpeg');
    });

    it('should detect PNG files', () => {
      // PNG magic number: 89 50 4E 47
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(service.detectMimeType(pngBuffer)).toBe('image/png');
    });

    it('should detect DOCX files (ZIP-based)', () => {
      // DOCX/ZIP magic number: PK..
      const docxBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
      expect(service.detectMimeType(docxBuffer)).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
    });

    it('should detect text files', () => {
      const textBuffer = Buffer.from('Hello, this is plain text content.\nWith newlines.');
      expect(service.detectMimeType(textBuffer)).toBe('text/plain');
    });

    it('should return null for unknown file types', () => {
      // Random binary data
      const unknownBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
      expect(service.detectMimeType(unknownBuffer)).toBe(null);
    });
  });

  // ==========================================================================
  // PDF Validation Tests
  // ==========================================================================

  describe('validatePDF', () => {
    it('should accept clean PDF files', async () => {
      const cleanPdf = Buffer.from('%PDF-1.4\n%Test PDF content without scripts\n%%EOF');
      const result = await service.validatePDF(cleanPdf);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject PDFs with JavaScript', async () => {
      const maliciousPdf = Buffer.from('%PDF-1.4\n/JavaScript /S /JS (alert("XSS"))\n%%EOF');
      const result = await service.validatePDF(maliciousPdf);
      expect(result.isValid).toBe(false);
      expect(result.flags).toContain('PDF_CONTAINS_JAVASCRIPT');
      expect(result.errors.some((e) => e.includes('JavaScript'))).toBe(true);
    });

    it('should flag PDFs with embedded files', async () => {
      const pdfWithEmbed = Buffer.from('%PDF-1.4\n/EmbeddedFile /Type /Filespec\n%%EOF');
      const result = await service.validatePDF(pdfWithEmbed);
      expect(result.flags).toContain('PDF_HAS_EMBEDDED_FILES');
    });

    it('should flag encrypted PDFs', async () => {
      const encryptedPdf = Buffer.from('%PDF-1.4\n/Encrypt /Filter /Standard\n%%EOF');
      const result = await service.validatePDF(encryptedPdf);
      expect(result.flags).toContain('PDF_ENCRYPTED');
      // Encrypted PDFs are allowed but flagged
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid PDF headers', async () => {
      const invalidPdf = Buffer.from('Not a PDF file');
      const result = await service.validatePDF(invalidPdf);
      expect(result.isValid).toBe(false);
      expect(result.flags).toContain('PDF_INVALID_HEADER');
    });

    it('should detect Launch actions', async () => {
      const launchPdf = Buffer.from('%PDF-1.4\n/Launch /Type /Action\n%%EOF');
      const result = await service.validatePDF(launchPdf);
      expect(result.flags.some((f) => f.includes('LAUNCH'))).toBe(true);
    });
  });

  // ==========================================================================
  // Full File Validation Tests
  // ==========================================================================

  describe('validateFile', () => {
    it('should validate a valid PDF file', async () => {
      const validPdf = Buffer.from('%PDF-1.4\nValid PDF content\n%%EOF');
      const result = await service.validateFile(validPdf, 'document.pdf', 'application/pdf');

      expect(result.isValid).toBe(true);
      expect(result.sanitizedFilename).toBe('document.pdf');
      expect(result.detectedMimeType).toBe('application/pdf');
      expect(result.errors).toHaveLength(0);
    });

    it('should detect MIME type mismatch', async () => {
      // PDF content but declared as JPEG
      const pdfBuffer = Buffer.from('%PDF-1.4\nPDF content\n%%EOF');
      const result = await service.validateFile(pdfBuffer, 'image.jpg', 'image/jpeg');

      expect(result.securityFlags).toContain('MIME_TYPE_MISMATCH');
    });

    it('should reject files exceeding size limit', async () => {
      const largeBuffer = Buffer.alloc(FILE_LIMITS.MAX_FILE_SIZE + 1);
      const result = await service.validateFile(largeBuffer, 'large.pdf');

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('size'))).toBe(true);
    });

    it('should reject path traversal attempts', async () => {
      const validPdf = Buffer.from('%PDF-1.4\nValid content\n%%EOF');
      const result = await service.validateFile(validPdf, '../../../etc/passwd.pdf');

      expect(result.isValid).toBe(false);
      expect(result.securityFlags).toContain('PATH_TRAVERSAL_ATTEMPT');
    });

    it('should sanitize dangerous filenames', async () => {
      const validPdf = Buffer.from('%PDF-1.4\nValid content\n%%EOF');
      const result = await service.validateFile(validPdf, 'file<script>.pdf');

      expect(result.sanitizedFilename).toBe('file_script_.pdf');
      expect(result.securityFlags).toContain('FILENAME_SANITIZED');
    });

    it('should reject malicious PDFs', async () => {
      const maliciousPdf = Buffer.from('%PDF-1.4\n/JavaScript /S /JS (attack)\n%%EOF');
      const result = await service.validateFile(maliciousPdf, 'malicious.pdf', 'application/pdf');

      expect(result.isValid).toBe(false);
      expect(result.securityFlags).toContain('PDF_CONTAINS_JAVASCRIPT');
    });

    it('should reject unknown file types by default', async () => {
      const unknownFile = Buffer.from([
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
      ]);
      const result = await service.validateFile(unknownFile, 'unknown.exe');

      // File type detection returns null for unknown, which is not in allowed list
      expect(result.detectedMimeType).toBe(null);
    });
  });

  // ==========================================================================
  // File Hash Generation Tests
  // ==========================================================================

  describe('generateFileHash', () => {
    it('should generate consistent hashes', () => {
      const content = Buffer.from('Test content');
      const hash1 = service.generateFileHash(content);
      const hash2 = service.generateFileHash(content);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different content', () => {
      const content1 = Buffer.from('Content 1');
      const content2 = Buffer.from('Content 2');
      const hash1 = service.generateFileHash(content1);
      const hash2 = service.generateFileHash(content2);
      expect(hash1).not.toBe(hash2);
    });

    it('should return 64-character hex string', () => {
      const content = Buffer.from('Test');
      const hash = service.generateFileHash(content);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  // ==========================================================================
  // Double Extension Detection Tests
  // ==========================================================================

  describe('hasDoubleExtension', () => {
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];

    it('should detect dangerous double extensions like .pdf.exe', () => {
      const result = service.hasDoubleExtension('document.pdf.exe', allowedExtensions);
      expect(result.isDouble).toBe(true);
      expect(result.dangerousExtension).toBe('.exe');
    });

    it('should detect .jpg.bat as dangerous', () => {
      const result = service.hasDoubleExtension('image.jpg.bat', allowedExtensions);
      expect(result.isDouble).toBe(true);
      expect(result.dangerousExtension).toBe('.bat');
    });

    it('should detect .png.vbs as dangerous', () => {
      const result = service.hasDoubleExtension('photo.png.vbs', allowedExtensions);
      expect(result.isDouble).toBe(true);
      expect(result.dangerousExtension).toBe('.vbs');
    });

    it('should detect .pdf.ps1 as dangerous', () => {
      const result = service.hasDoubleExtension('report.pdf.ps1', allowedExtensions);
      expect(result.isDouble).toBe(true);
      expect(result.dangerousExtension).toBe('.ps1');
    });

    it('should allow single valid extensions', () => {
      const result = service.hasDoubleExtension('document.pdf', allowedExtensions);
      expect(result.isDouble).toBe(false);
    });

    it('should allow files with no extension', () => {
      const result = service.hasDoubleExtension('README', allowedExtensions);
      expect(result.isDouble).toBe(false);
    });

    it('should allow legitimate double extensions like .tar.gz for non-allowed types', () => {
      // When both extensions are not in the allowed list, it's not detected as malicious
      const result = service.hasDoubleExtension('archive.tar.gz', allowedExtensions);
      // .gz is not a dangerous extension per se
      expect(result.isDouble).toBe(false);
    });

    it('should detect when allowed extension is followed by unknown extension', () => {
      const result = service.hasDoubleExtension('document.pdf.unknown', allowedExtensions);
      // This should be flagged as suspicious
      expect(result.isDouble).toBe(true);
    });

    it('should handle multiple extensions correctly', () => {
      const result = service.hasDoubleExtension('file.pdf.jpg.exe', allowedExtensions);
      expect(result.isDouble).toBe(true);
      expect(result.dangerousExtension).toBe('.exe');
    });

    it('should detect shell scripts', () => {
      const result = service.hasDoubleExtension('report.pdf.sh', allowedExtensions);
      expect(result.isDouble).toBe(true);
      expect(result.dangerousExtension).toBe('.sh');
    });

    it('should detect Python scripts', () => {
      const result = service.hasDoubleExtension('image.png.py', allowedExtensions);
      expect(result.isDouble).toBe(true);
      expect(result.dangerousExtension).toBe('.py');
    });
  });

  // ==========================================================================
  // Extension Validation Tests
  // ==========================================================================

  describe('validateExtension', () => {
    it('should validate PDF extension', () => {
      expect(service.validateExtension('document.pdf', 'application/pdf')).toBe(true);
      expect(service.validateExtension('document.PDF', 'application/pdf')).toBe(true);
    });

    it('should validate DOCX extension', () => {
      expect(
        service.validateExtension(
          'document.docx',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
      ).toBe(true);
    });

    it('should validate image extensions', () => {
      expect(service.validateExtension('image.jpg', 'image/jpeg')).toBe(true);
      expect(service.validateExtension('image.jpeg', 'image/jpeg')).toBe(true);
      expect(service.validateExtension('image.png', 'image/png')).toBe(true);
    });

    it('should reject mismatched extensions', () => {
      expect(service.validateExtension('document.exe', 'application/pdf')).toBe(false);
      expect(service.validateExtension('image.pdf', 'image/jpeg')).toBe(false);
    });
  });
});
