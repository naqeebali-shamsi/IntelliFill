/**
 * OCR Service Unit Tests
 *
 * Tests for the OCRService class covering:
 * - Worker initialization and lifecycle
 * - PDF processing with progress tracking
 * - Image processing
 * - Image preprocessing
 * - PDF page conversion
 * - Structured data extraction
 * - Text enhancement
 * - Language support
 * - Error handling and recovery
 * - Memory cleanup
 *
 * @module services/__tests__/OCRService.test
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { OCRService } from '../OCRService';
import Tesseract from 'tesseract.js';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';
import sharp from 'sharp';
import { fromPath } from 'pdf2pic';

// Mock Tesseract.js
jest.mock('tesseract.js', () => ({
  createWorker: jest.fn(),
  PSM: {
    AUTO_OSD: 1,
  },
}));

// Mock pdf-lib
jest.mock('pdf-lib', () => ({
  PDFDocument: {
    load: jest.fn(),
  },
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  mkdtemp: jest.fn(),
  rm: jest.fn(),
}));

// Create mock buffer for sharp output (needs to be defined before mock)
// This is referenced in the sharp mock setup
const mockProcessedImageBuffer = Buffer.alloc(150);
mockProcessedImageBuffer.write('\x89PNG\r\n\x1a\n', 0, 'binary');

// Mock sharp
jest.mock('sharp', () => {
  const mockSharp = jest.fn(() => ({
    greyscale: jest.fn().mockReturnThis(),
    normalize: jest.fn().mockReturnThis(),
    sharpen: jest.fn().mockReturnThis(),
    threshold: jest.fn().mockReturnThis(),
    resize: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(mockProcessedImageBuffer),
  }));
  return mockSharp;
});

// Mock pdf2pic
jest.mock('pdf2pic', () => ({
  fromPath: jest.fn(),
}));

// Create a realistic mock image buffer (at least 100 bytes to pass validation)
// This simulates a minimal valid PNG header + padding
const createMockImageBuffer = (size: number = 150): Buffer => {
  const buffer = Buffer.alloc(size);
  // PNG signature
  buffer.write('\x89PNG\r\n\x1a\n', 0, 'binary');
  return buffer;
};

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('OCRService', () => {
  let service: OCRService;
  let mockWorker: any;
  let mockCreateWorker: jest.MockedFunction<typeof Tesseract.createWorker>;

  beforeEach(() => {
    // Reset service instance
    service = new OCRService();

    // Create mock worker
    mockWorker = {
      setParameters: jest.fn().mockResolvedValue(undefined),
      recognize: jest.fn(),
      terminate: jest.fn().mockResolvedValue(undefined),
    };

    // Setup createWorker mock
    mockCreateWorker = Tesseract.createWorker as jest.MockedFunction<typeof Tesseract.createWorker>;
    mockCreateWorker.mockResolvedValue(mockWorker);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe('initialize', () => {
    it('should successfully initialize worker', async () => {
      await service.initialize();

      expect(mockCreateWorker).toHaveBeenCalledWith(
        'eng+spa+fra+deu',
        1,
        expect.objectContaining({
          logger: expect.any(Function),
        })
      );
      expect(mockWorker.setParameters).toHaveBeenCalledWith({
        tessedit_char_whitelist:
          '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,;:!?@#$%&*()-_+=[]{}|\\/<>"\' ',
        preserve_interword_spaces: '1',
        tessedit_pageseg_mode: Tesseract.PSM.AUTO_OSD,
      });
    });

    it('should not reinitialize if already initialized', async () => {
      await service.initialize();
      mockCreateWorker.mockClear();

      await service.initialize();

      expect(mockCreateWorker).not.toHaveBeenCalled();
    });

    it('should throw error if worker creation fails', async () => {
      mockCreateWorker.mockRejectedValue(new Error('Worker creation failed'));

      await expect(service.initialize()).rejects.toThrow('OCR initialization failed');
    });

    it('should throw error if setParameters fails', async () => {
      mockWorker.setParameters.mockRejectedValue(new Error('Parameter setup failed'));

      await expect(service.initialize()).rejects.toThrow('OCR initialization failed');
    });

    it('should support multiple languages', async () => {
      await service.initialize();

      expect(mockCreateWorker).toHaveBeenCalledWith('eng+spa+fra+deu', 1, expect.any(Object));
    });
  });

  // ==========================================================================
  // PDF Processing Tests
  // ==========================================================================

  describe('processPDF', () => {
    const mockPdfPath = '/path/to/document.pdf';
    const mockTempDir = '/tmp/ocr-test123';

    beforeEach(() => {
      // Mock fs operations
      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('pdf-content'));
      (fs.mkdtemp as jest.Mock).mockResolvedValue(mockTempDir);
      (fs.rm as jest.Mock).mockResolvedValue(undefined);

      // Mock PDFDocument
      const mockPdfDoc = {
        getPageCount: jest.fn().mockReturnValue(2),
      };
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      // Mock pdf2pic with a realistic buffer size (>=100 bytes to pass validation)
      const mockConvert = jest.fn().mockResolvedValue({
        buffer: createMockImageBuffer(150),
      });
      (fromPath as jest.Mock).mockReturnValue(mockConvert);

      // Mock worker recognize
      mockWorker.recognize.mockResolvedValue({
        data: {
          text: 'Sample text from page',
          confidence: 85.5,
        },
      });
    });

    it('should successfully process a multi-page PDF', async () => {
      const result = await service.processPDF(mockPdfPath);

      expect(result).toMatchObject({
        text: expect.stringContaining('Sample text from page'),
        confidence: 85.5,
        pages: expect.arrayContaining([
          expect.objectContaining({
            pageNumber: 1,
            text: 'Sample text from page',
            confidence: 85.5,
          }),
          expect.objectContaining({
            pageNumber: 2,
            text: 'Sample text from page',
            confidence: 85.5,
          }),
        ]),
        metadata: expect.objectContaining({
          language: 'eng',
          pageCount: 2,
          processingTime: expect.any(Number),
        }),
      });

      expect(mockWorker.recognize).toHaveBeenCalledTimes(2);
    });

    it('should call progress callback during processing', async () => {
      const progressCallback = jest.fn();

      await service.processPDF(mockPdfPath, progressCallback);

      // Should be called for each page: converting, preprocessing, recognizing, complete
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'converting',
          currentPage: 1,
          totalPages: 2,
        })
      );
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'preprocessing',
          currentPage: 1,
          totalPages: 2,
        })
      );
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'recognizing',
          currentPage: 1,
          totalPages: 2,
        })
      );
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'complete',
          progress: 100,
        })
      );
    });

    it('should handle single-page PDFs', async () => {
      const mockPdfDoc = {
        getPageCount: jest.fn().mockReturnValue(1),
      };
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      const result = await service.processPDF(mockPdfPath);

      expect(result.pages).toHaveLength(1);
      expect(result.metadata.pageCount).toBe(1);
    });

    it('should clean up temporary directory after processing', async () => {
      await service.processPDF(mockPdfPath);

      expect(fs.rm).toHaveBeenCalledWith(mockTempDir, {
        recursive: true,
        force: true,
      });
    });

    it('should clean up temporary directory even if processing fails', async () => {
      mockWorker.recognize.mockRejectedValue(new Error('OCR failed'));

      await expect(service.processPDF(mockPdfPath)).rejects.toThrow();

      expect(fs.rm).toHaveBeenCalledWith(mockTempDir, {
        recursive: true,
        force: true,
      });
    });

    it('should handle PDF loading errors', async () => {
      (PDFDocument.load as jest.Mock).mockRejectedValue(new Error('Invalid PDF'));

      await expect(service.processPDF(mockPdfPath)).rejects.toThrow(
        'Failed to process PDF with OCR'
      );
    });

    it('should handle file read errors', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      await expect(service.processPDF(mockPdfPath)).rejects.toThrow(
        'Failed to process PDF with OCR'
      );
    });

    it('should handle page conversion errors', async () => {
      const mockConvert = jest.fn().mockResolvedValue({ buffer: null });
      (fromPath as jest.Mock).mockReturnValue(mockConvert);

      await expect(service.processPDF(mockPdfPath)).rejects.toThrow();
    });

    it('should calculate average confidence across pages', async () => {
      mockWorker.recognize
        .mockResolvedValueOnce({ data: { text: 'Page 1', confidence: 80 } })
        .mockResolvedValueOnce({ data: { text: 'Page 2', confidence: 90 } });

      const result = await service.processPDF(mockPdfPath);

      expect(result.confidence).toBe(85); // Average of 80 and 90
    });

    it('should concatenate text from all pages', async () => {
      mockWorker.recognize
        .mockResolvedValueOnce({ data: { text: 'First page text', confidence: 85 } })
        .mockResolvedValueOnce({ data: { text: 'Second page text', confidence: 90 } });

      const result = await service.processPDF(mockPdfPath);

      expect(result.text).toContain('First page text');
      expect(result.text).toContain('Second page text');
    });

    it('should track processing time', async () => {
      const result = await service.processPDF(mockPdfPath);

      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Image Processing Tests
  // ==========================================================================

  describe('processImage', () => {
    const mockImagePath = '/path/to/image.png';

    beforeEach(() => {
      // Use realistic buffer size (>=50 bytes to pass validation)
      (fs.readFile as jest.Mock).mockResolvedValue(createMockImageBuffer(150));
      mockWorker.recognize.mockResolvedValue({
        data: {
          text: 'Text extracted from image',
          confidence: 92.3,
        },
      });
    });

    it('should successfully process an image', async () => {
      const result = await service.processImage(mockImagePath);

      expect(result).toMatchObject({
        text: 'Text extracted from image',
        confidence: 92.3,
        pages: [
          {
            pageNumber: 1,
            text: 'Text extracted from image',
            confidence: 92.3,
          },
        ],
        metadata: {
          language: 'eng',
          pageCount: 1,
          processingTime: expect.any(Number),
        },
      });
    });

    it('should preprocess image before OCR', async () => {
      await service.processImage(mockImagePath);

      expect(sharp).toHaveBeenCalled();
      expect(mockWorker.recognize).toHaveBeenCalledWith(mockProcessedImageBuffer);
    });

    it('should handle image read errors', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('Image not found'));

      await expect(service.processImage(mockImagePath)).rejects.toThrow(
        'Failed to process image with OCR'
      );
    });

    it('should handle OCR errors', async () => {
      mockWorker.recognize.mockRejectedValue(new Error('OCR recognition failed'));

      await expect(service.processImage(mockImagePath)).rejects.toThrow(
        'Failed to process image with OCR'
      );
    });

    it('should track processing time', async () => {
      const result = await service.processImage(mockImagePath);

      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Image Preprocessing Tests
  // ==========================================================================

  describe('preprocessImage (private method)', () => {
    it('should apply preprocessing pipeline', async () => {
      const mockImageBuffer = createMockImageBuffer(150);
      (fs.readFile as jest.Mock).mockResolvedValue(mockImageBuffer);

      // Setup worker recognize to return valid result
      mockWorker.recognize.mockResolvedValue({
        data: {
          text: 'Preprocessed text',
          confidence: 90,
        },
      });

      // Capture the mock sharp instance that will be created
      let capturedSharpInstance: any;
      (sharp as unknown as jest.Mock).mockImplementation(() => {
        capturedSharpInstance = {
          greyscale: jest.fn().mockReturnThis(),
          normalize: jest.fn().mockReturnThis(),
          sharpen: jest.fn().mockReturnThis(),
          threshold: jest.fn().mockReturnThis(),
          resize: jest.fn().mockReturnThis(),
          toBuffer: jest.fn().mockResolvedValue(createMockImageBuffer(150)),
        };
        return capturedSharpInstance;
      });

      // Call through processImage which uses preprocessing
      await service.processImage('/test.png');

      expect(sharp).toHaveBeenCalled();
      // Verify the preprocessing chain
      expect(capturedSharpInstance.greyscale).toHaveBeenCalled();
      expect(capturedSharpInstance.normalize).toHaveBeenCalled();
      expect(capturedSharpInstance.sharpen).toHaveBeenCalled();
      expect(capturedSharpInstance.threshold).toHaveBeenCalledWith(128);
      expect(capturedSharpInstance.resize).toHaveBeenCalledWith({ width: 2400 });
    });

    it('should return original image if preprocessing fails', async () => {
      const mockSharpInstance = {
        greyscale: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        threshold: jest.fn().mockReturnThis(),
        resize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockRejectedValue(new Error('Sharp processing failed')),
      };
      (sharp as unknown as jest.Mock).mockReturnValue(mockSharpInstance);

      const mockImageBuffer = createMockImageBuffer(150);
      (fs.readFile as jest.Mock).mockResolvedValue(mockImageBuffer);

      mockWorker.recognize.mockResolvedValue({
        data: { text: 'Text', confidence: 80 },
      });

      // Should not throw error, should use original image
      await service.processImage('/test.png');

      expect(mockWorker.recognize).toHaveBeenCalledWith(mockImageBuffer);
    });
  });

  // ==========================================================================
  // Structured Data Extraction Tests
  // ==========================================================================

  describe('extractStructuredData', () => {
    it('should extract email addresses', async () => {
      const text = 'Contact us at support@example.com or sales@company.org';

      const result = await service.extractStructuredData(text);

      expect(result.email).toEqual(['support@example.com', 'sales@company.org']);
    });

    it('should extract phone numbers', async () => {
      const text = 'Call 555-1234 or (123) 456-7890';

      const result = await service.extractStructuredData(text);

      expect(result.phone).toBeDefined();
      expect(result.phone.length).toBeGreaterThan(0);
    });

    it('should extract dates', async () => {
      const text = 'Meeting on 12/15/2025 and 2025-01-20';

      const result = await service.extractStructuredData(text);

      expect(result.date).toEqual(['12/15/2025', '2025-01-20']);
    });

    it('should extract SSN', async () => {
      const text = 'SSN: 123-45-6789';

      const result = await service.extractStructuredData(text);

      expect(result.ssn).toEqual(['123-45-6789']);
    });

    it('should extract zip codes', async () => {
      const text = 'Address: 12345 or 67890-1234';

      const result = await service.extractStructuredData(text);

      expect(result.zipCode).toEqual(['12345', '67890-1234']);
    });

    it('should extract currency amounts', async () => {
      const text = 'Total: $1,234.56 or €999.99';

      const result = await service.extractStructuredData(text);

      expect(result.currency).toEqual(['$1,234.56', '€999.99']);
    });

    it('should extract percentages', async () => {
      const text = 'Interest rate: 3.5% or 10.25%';

      const result = await service.extractStructuredData(text);

      expect(result.percentage).toEqual(['3.5%', '10.25%']);
    });

    it('should extract key-value pairs', async () => {
      const text = `
        Name: John Doe
        Email: john@example.com
        Phone: 555-1234
      `;

      const result = await service.extractStructuredData(text);

      expect(result.fields).toBeDefined();
      expect(result.fields.name).toBe('John Doe');
      expect(result.fields.email).toBe('john@example.com');
      expect(result.fields.phone).toBe('555-1234');
    });

    it('should deduplicate extracted values', async () => {
      const text = 'Contact support@example.com or support@example.com';

      const result = await service.extractStructuredData(text);

      expect(result.email).toEqual(['support@example.com']); // Only once
    });

    it('should handle empty text', async () => {
      const result = await service.extractStructuredData('');

      expect(result.fields).toEqual({});
    });
  });

  // ==========================================================================
  // Text Enhancement Tests
  // ==========================================================================

  describe('enhanceWithOCR', () => {
    it('should use OCR text when original is minimal (< 50 chars)', async () => {
      const originalText = 'A';
      const ocrText = 'This is the full extracted text from OCR that is over 50 characters long';

      const result = await service.enhanceWithOCR(originalText, ocrText);

      expect(result).toBe(ocrText);
    });

    it('should use original text when OCR is minimal (< 50 chars)', async () => {
      const originalText =
        'This is the original extracted text that is substantial and exceeds fifty characters';
      const ocrText = 'X';

      const result = await service.enhanceWithOCR(originalText, ocrText);

      expect(result).toBe(originalText);
    });

    it('should merge both texts when both are substantial (>= 50 chars)', async () => {
      const originalText =
        'Line 1 with enough text to meet minimum\nLine 2 with enough text\nLine 3';
      const ocrText = 'Line 3\nLine 4 with enough text to meet minimum\nLine 5 with enough text';

      const result = await service.enhanceWithOCR(originalText, ocrText);

      // Should contain unique lines from both
      expect(result).toContain('Line 1 with enough text to meet minimum');
      expect(result).toContain('Line 2 with enough text');
      expect(result).toContain('Line 3');
      expect(result).toContain('Line 4 with enough text to meet minimum');
      expect(result).toContain('Line 5 with enough text');
    });

    it('should deduplicate lines when merging', async () => {
      const originalText = 'Duplicate line that is long enough to meet minimum\nUnique line 1';
      const ocrText = 'Duplicate line that is long enough to meet minimum\nUnique line 2';

      const result = await service.enhanceWithOCR(originalText, ocrText);

      const lines = result.split('\n');
      const duplicateCount = lines.filter(
        (l) => l === 'Duplicate line that is long enough to meet minimum'
      ).length;
      expect(duplicateCount).toBe(1); // Only appears once
    });

    it('should handle empty original text', async () => {
      // OCR text meets 50 char minimum, empty original should use OCR
      const result = await service.enhanceWithOCR(
        '',
        'OCR extracted text that meets the fifty character minimum requirement'
      );

      expect(result).toBe('OCR extracted text that meets the fifty character minimum requirement');
    });

    it('should handle empty OCR text', async () => {
      // Original text meets 50 char minimum, empty OCR should use original
      const result = await service.enhanceWithOCR(
        'Original text that is long enough to meet the minimum requirement',
        ''
      );

      expect(result).toBe('Original text that is long enough to meet the minimum requirement');
    });

    it('should handle both texts empty', async () => {
      const result = await service.enhanceWithOCR('', '');

      expect(result).toBe('');
    });
  });

  // ==========================================================================
  // Cleanup Tests
  // ==========================================================================

  describe('cleanup', () => {
    it('should terminate worker and reset state', async () => {
      await service.initialize();

      await service.cleanup();

      expect(mockWorker.terminate).toHaveBeenCalled();
    });

    it('should handle cleanup when not initialized', async () => {
      await service.cleanup();

      expect(mockWorker.terminate).not.toHaveBeenCalled();
    });

    it('should allow reinitialization after cleanup', async () => {
      await service.initialize();
      await service.cleanup();

      mockCreateWorker.mockClear();
      await service.initialize();

      expect(mockCreateWorker).toHaveBeenCalled();
    });

    it('should handle worker termination errors gracefully', async () => {
      await service.initialize();
      mockWorker.terminate.mockRejectedValue(new Error('Termination failed'));

      await expect(service.cleanup()).rejects.toThrow('Termination failed');
    });
  });

  // ==========================================================================
  // Edge Cases and Error Handling
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle PDF with zero pages', async () => {
      const mockPdfDoc = {
        getPageCount: jest.fn().mockReturnValue(0),
      };
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);
      // Use realistic buffer size for PDF content
      (fs.readFile as jest.Mock).mockResolvedValue(createMockImageBuffer(150));
      (fs.mkdtemp as jest.Mock).mockResolvedValue('/tmp/test');
      (fs.rm as jest.Mock).mockResolvedValue(undefined);

      const result = await service.processPDF('/empty.pdf');

      expect(result.pages).toHaveLength(0);
      expect(result.metadata.pageCount).toBe(0);
    });

    it('should handle very low confidence results', async () => {
      mockWorker.recognize.mockResolvedValue({
        data: {
          text: 'Barely readable',
          confidence: 5.2,
        },
      });

      const result = await service.processImage('/poor-quality.png');

      expect(result.confidence).toBe(5.2);
    });

    it('should handle perfect confidence results', async () => {
      mockWorker.recognize.mockResolvedValue({
        data: {
          text: 'Perfect scan',
          confidence: 100,
        },
      });

      const result = await service.processImage('/perfect.png');

      expect(result.confidence).toBe(100);
    });

    it('should handle empty text extraction', async () => {
      mockWorker.recognize.mockResolvedValue({
        data: {
          text: '',
          confidence: 0,
        },
      });

      const result = await service.processImage('/blank.png');

      expect(result.text).toBe('');
      expect(result.confidence).toBe(0);
    });

    it('should handle special characters in text', async () => {
      const specialText = 'Text with émojis 😀 and spëcial çhars';
      mockWorker.recognize.mockResolvedValue({
        data: {
          text: specialText,
          confidence: 85,
        },
      });

      const result = await service.processImage('/special.png');

      expect(result.text).toBe(specialText);
    });

    it('should not crash on undefined progress callback', async () => {
      const mockPdfDoc = { getPageCount: jest.fn().mockReturnValue(1) };
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);
      // Use realistic buffer size for PDF content
      (fs.readFile as jest.Mock).mockResolvedValue(createMockImageBuffer(150));
      (fs.mkdtemp as jest.Mock).mockResolvedValue('/tmp/test');
      (fs.rm as jest.Mock).mockResolvedValue(undefined);

      // Use realistic buffer size (>=100 bytes to pass validation)
      const mockConvert = jest.fn().mockResolvedValue({
        buffer: createMockImageBuffer(150),
      });
      (fromPath as jest.Mock).mockReturnValue(mockConvert);

      mockWorker.recognize.mockResolvedValue({
        data: { text: 'Text', confidence: 80 },
      });

      // Should not throw when progress callback is undefined
      await expect(service.processPDF('/test.pdf', undefined)).resolves.toBeDefined();
    });
  });
});
