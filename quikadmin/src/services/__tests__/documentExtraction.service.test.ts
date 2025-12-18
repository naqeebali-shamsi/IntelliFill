/**
 * Document Extraction Service Tests
 *
 * Unit tests for DocumentExtractionService covering:
 * - Text extraction from various formats (REQ-EXT-001)
 * - OCR functionality (REQ-EXT-002)
 * - Metadata preservation (REQ-EXT-003)
 * - Security integration
 */

/* eslint-disable @typescript-eslint/no-require-imports */

import {
  DocumentExtractionService,
  ExtractionResult,
  ExtractionOptions,
} from '../documentExtraction.service';

// Mock dependencies
jest.mock('pdf-parse', () => {
  return jest.fn().mockImplementation((buffer, options) => {
    const content = buffer.toString();
    if (content.includes('%PDF')) {
      return Promise.resolve({
        text: 'Extracted PDF text content.\nSecond paragraph.\nThis is additional content to ensure we meet the minimum text length threshold for PDF extraction without triggering OCR fallback.',
        numpages: 2,
        info: {
          Title: 'Test PDF',
          Author: 'Test Author',
          CreationDate: 'D:20240101120000',
        },
      });
    }
    throw new Error('Invalid PDF');
  });
});

jest.mock('mammoth', () => ({
  extractRawText: jest.fn().mockResolvedValue({
    value: 'Extracted DOCX text content. This is a test document.',
    messages: [],
  }),
}));

jest.mock('tesseract.js', () => ({
  createWorker: jest.fn().mockResolvedValue({
    recognize: jest.fn().mockResolvedValue({
      data: {
        text: 'OCR extracted text from image',
        confidence: 92.5,
      },
    }),
    terminate: jest.fn().mockResolvedValue(undefined),
  }),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock memory manager
jest.mock('../memoryManager.service', () => ({
  memoryManager: {
    checkMemory: jest.fn().mockReturnValue({ allowed: true, level: 'OK' }),
  },
}));

// Mock file validation
jest.mock('../fileValidation.service', () => ({
  fileValidationService: {
    validateFile: jest.fn().mockResolvedValue({
      isValid: true,
      sanitizedFilename: 'test.pdf',
      detectedMimeType: 'application/pdf',
      securityFlags: [],
      errors: [],
    }),
  },
  FILE_LIMITS: {
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    MAX_PAGES: 50,
    MAX_EXTRACTION_TIME: 30000,
    MIN_FILE_SIZE: 10,
  },
}));

describe('DocumentExtractionService', () => {
  let service: DocumentExtractionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DocumentExtractionService();
  });

  afterEach(async () => {
    await service.cleanup();
  });

  // ==========================================================================
  // PDF Extraction Tests
  // ==========================================================================

  describe('PDF extraction', () => {
    it('should extract text from valid PDF', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\nValid PDF content\n%%EOF');

      const result = await service.extract(pdfBuffer, 'test.pdf', 'application/pdf');

      expect(result.text).toContain('Extracted PDF text content');
      expect(result.metadata.mimeType).toBe('application/pdf');
      expect(result.metadata.filename).toBe('test.pdf');
    });

    it('should extract metadata from PDF', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\nPDF with metadata\n%%EOF');

      const result = await service.extract(pdfBuffer, 'document.pdf');

      expect(result.metadata.title).toBe('Test PDF');
      expect(result.metadata.author).toBe('Test Author');
      expect(result.metadata.pageCount).toBe(2);
    });

    it('should handle multi-page PDFs', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\nMulti-page PDF\n%%EOF');

      const result = await service.extract(pdfBuffer, 'multipage.pdf');

      expect(result.pages.length).toBeGreaterThanOrEqual(1);
      expect(result.pages[0].pageNumber).toBe(1);
    });

    it('should report extraction time', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\nPDF content\n%%EOF');

      const result = await service.extract(pdfBuffer, 'timed.pdf');

      expect(result.metadata.extractionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // DOCX Extraction Tests
  // ==========================================================================

  describe('DOCX extraction', () => {
    it('should extract text from DOCX', async () => {
      // DOCX magic bytes (PK..)
      const docxBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Array(100).fill(0)]);

      // Update mock for this test
      const { fileValidationService } = require('../fileValidation.service');
      fileValidationService.validateFile.mockResolvedValueOnce({
        isValid: true,
        sanitizedFilename: 'document.docx',
        detectedMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        securityFlags: [],
        errors: [],
      });

      const result = await service.extract(
        docxBuffer,
        'document.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

      expect(result.text).toContain('Extracted DOCX text');
      expect(result.metadata.ocrUsed).toBe(false);
    });

    it('should estimate page count for DOCX', async () => {
      const docxBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Array(100).fill(0)]);

      const { fileValidationService } = require('../fileValidation.service');
      fileValidationService.validateFile.mockResolvedValueOnce({
        isValid: true,
        sanitizedFilename: 'document.docx',
        detectedMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        securityFlags: [],
        errors: [],
      });

      const result = await service.extract(docxBuffer, 'document.docx');

      expect(result.metadata.pageCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // Plain Text Extraction Tests
  // ==========================================================================

  describe('Plain text extraction', () => {
    it('should extract plain text content', async () => {
      const textContent = 'This is plain text content.\nWith multiple lines.\nAnd more text.';
      const textBuffer = Buffer.from(textContent);

      const { fileValidationService } = require('../fileValidation.service');
      fileValidationService.validateFile.mockResolvedValueOnce({
        isValid: true,
        sanitizedFilename: 'document.txt',
        detectedMimeType: 'text/plain',
        securityFlags: [],
        errors: [],
      });

      const result = await service.extract(textBuffer, 'document.txt', 'text/plain');

      expect(result.text).toBe(textContent);
      expect(result.confidence).toBe(100);
      expect(result.metadata.ocrUsed).toBe(false);
    });

    it('should count words correctly', async () => {
      const textContent = 'One two three four five six seven eight nine ten';
      const textBuffer = Buffer.from(textContent);

      const { fileValidationService } = require('../fileValidation.service');
      fileValidationService.validateFile.mockResolvedValueOnce({
        isValid: true,
        sanitizedFilename: 'words.txt',
        detectedMimeType: 'text/plain',
        securityFlags: [],
        errors: [],
      });

      const result = await service.extract(textBuffer, 'words.txt', 'text/plain');

      expect(result.metadata.totalWordCount).toBe(10);
    });
  });

  // ==========================================================================
  // Image OCR Tests
  // ==========================================================================

  describe('Image OCR extraction', () => {
    it('should extract text from JPEG using OCR', async () => {
      // JPEG magic bytes
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(100).fill(0)]);

      const { fileValidationService } = require('../fileValidation.service');
      fileValidationService.validateFile.mockResolvedValueOnce({
        isValid: true,
        sanitizedFilename: 'image.jpg',
        detectedMimeType: 'image/jpeg',
        securityFlags: [],
        errors: [],
      });

      const result = await service.extract(jpegBuffer, 'image.jpg', 'image/jpeg');

      expect(result.text).toContain('OCR extracted text');
      expect(result.metadata.ocrUsed).toBe(true);
      expect(result.pages[0].ocrUsed).toBe(true);
      expect(result.pages[0].confidence).toBeDefined();
    });

    it('should extract text from PNG using OCR', async () => {
      // PNG magic bytes
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, ...Array(100).fill(0)]);

      const { fileValidationService } = require('../fileValidation.service');
      fileValidationService.validateFile.mockResolvedValueOnce({
        isValid: true,
        sanitizedFilename: 'image.png',
        detectedMimeType: 'image/png',
        securityFlags: [],
        errors: [],
      });

      const result = await service.extract(pngBuffer, 'image.png', 'image/png');

      expect(result.metadata.ocrUsed).toBe(true);
    });

    it('should fail gracefully when OCR is disabled for images', async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(100).fill(0)]);

      const { fileValidationService } = require('../fileValidation.service');
      fileValidationService.validateFile.mockResolvedValueOnce({
        isValid: true,
        sanitizedFilename: 'image.jpg',
        detectedMimeType: 'image/jpeg',
        securityFlags: [],
        errors: [],
      });

      await expect(
        service.extract(jpegBuffer, 'image.jpg', 'image/jpeg', { ocrEnabled: false })
      ).rejects.toThrow('OCR is disabled');
    });
  });

  // ==========================================================================
  // Security Integration Tests
  // ==========================================================================

  describe('Security validation', () => {
    it('should reject files that fail validation', async () => {
      const { fileValidationService } = require('../fileValidation.service');
      fileValidationService.validateFile.mockResolvedValueOnce({
        isValid: false,
        sanitizedFilename: 'malicious.pdf',
        detectedMimeType: null,
        securityFlags: ['PATH_TRAVERSAL_ATTEMPT'],
        errors: ['Path traversal detected'],
      });

      const buffer = Buffer.from('malicious content');

      await expect(service.extract(buffer, '../../../etc/passwd.pdf')).rejects.toThrow(
        'File validation failed'
      );
    });

    it('should include security warnings in result', async () => {
      const { fileValidationService } = require('../fileValidation.service');
      fileValidationService.validateFile.mockResolvedValueOnce({
        isValid: true,
        sanitizedFilename: 'sanitized.pdf',
        detectedMimeType: 'application/pdf',
        securityFlags: ['FILENAME_SANITIZED', 'PDF_ENCRYPTED'],
        errors: [],
      });

      const pdfBuffer = Buffer.from('%PDF-1.4\nContent\n%%EOF');

      const result = await service.extract(pdfBuffer, 'original<name>.pdf');

      expect(result.warnings).toContain('Security flag: FILENAME_SANITIZED');
      expect(result.warnings).toContain('Security flag: PDF_ENCRYPTED');
    });
  });

  // ==========================================================================
  // Memory Management Tests
  // ==========================================================================

  describe('Memory management', () => {
    it('should reject when memory is critical', async () => {
      const { memoryManager } = require('../memoryManager.service');
      memoryManager.checkMemory.mockReturnValueOnce({
        allowed: false,
        level: 'CRITICAL',
      });

      const pdfBuffer = Buffer.from('%PDF-1.4\nContent\n%%EOF');

      await expect(service.extract(pdfBuffer, 'test.pdf')).rejects.toThrow(
        'System under high load'
      );
    });

    it('should proceed when memory is OK', async () => {
      const { memoryManager } = require('../memoryManager.service');
      memoryManager.checkMemory.mockReturnValueOnce({
        allowed: true,
        level: 'OK',
      });

      const pdfBuffer = Buffer.from('%PDF-1.4\nContent\n%%EOF');

      await expect(service.extract(pdfBuffer, 'test.pdf')).resolves.toBeDefined();
    });
  });

  // ==========================================================================
  // Unsupported Format Tests
  // ==========================================================================

  describe('Unsupported formats', () => {
    it('should reject unsupported MIME types', async () => {
      const { fileValidationService } = require('../fileValidation.service');
      fileValidationService.validateFile.mockResolvedValueOnce({
        isValid: true,
        sanitizedFilename: 'program.exe',
        detectedMimeType: 'application/x-msdownload',
        securityFlags: [],
        errors: [],
      });

      const buffer = Buffer.from([0x4d, 0x5a, ...Array(100).fill(0)]); // MZ header

      await expect(
        service.extract(buffer, 'program.exe', 'application/x-msdownload')
      ).rejects.toThrow('Unsupported document type');
    });
  });

  // ==========================================================================
  // Utility Method Tests
  // ==========================================================================

  describe('isSupported', () => {
    it('should return true for supported types', () => {
      expect(service.isSupported('application/pdf')).toBe(true);
      expect(
        service.isSupported(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
      ).toBe(true);
      expect(service.isSupported('text/plain')).toBe(true);
      expect(service.isSupported('image/jpeg')).toBe(true);
      expect(service.isSupported('image/png')).toBe(true);
      expect(service.isSupported('image/tiff')).toBe(true);
    });

    it('should return false for unsupported types', () => {
      expect(service.isSupported('application/x-msdownload')).toBe(false);
      expect(service.isSupported('video/mp4')).toBe(false);
      expect(service.isSupported('audio/mpeg')).toBe(false);
    });
  });

  describe('getSupportedTypes', () => {
    it('should return array of supported MIME types', () => {
      const types = service.getSupportedTypes();

      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
      expect(types).toContain('application/pdf');
      expect(types).toContain('text/plain');
    });
  });

  // ==========================================================================
  // Cleanup Tests
  // ==========================================================================

  describe('cleanup', () => {
    it('should terminate Tesseract worker on cleanup', async () => {
      // First, trigger OCR to initialize worker
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(100).fill(0)]);

      const { fileValidationService } = require('../fileValidation.service');
      fileValidationService.validateFile.mockResolvedValueOnce({
        isValid: true,
        sanitizedFilename: 'image.jpg',
        detectedMimeType: 'image/jpeg',
        securityFlags: [],
        errors: [],
      });

      await service.extract(jpegBuffer, 'image.jpg', 'image/jpeg');

      // Now cleanup
      await expect(service.cleanup()).resolves.not.toThrow();
    });

    it('should handle cleanup when no worker initialized', async () => {
      const freshService = new DocumentExtractionService();
      await expect(freshService.cleanup()).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // Options Tests
  // ==========================================================================

  describe('extraction options', () => {
    it('should respect maxPages option', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\nContent\n%%EOF');

      const result = await service.extract(pdfBuffer, 'large.pdf', undefined, {
        maxPages: 10,
      });

      expect(result).toBeDefined();
    });

    it('should respect language option for OCR', async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(100).fill(0)]);

      const { fileValidationService } = require('../fileValidation.service');
      fileValidationService.validateFile.mockResolvedValueOnce({
        isValid: true,
        sanitizedFilename: 'german.jpg',
        detectedMimeType: 'image/jpeg',
        securityFlags: [],
        errors: [],
      });

      const result = await service.extract(jpegBuffer, 'german.jpg', 'image/jpeg', {
        language: 'deu',
      });

      expect(result.metadata.language).toBe('deu');
    });
  });
});
