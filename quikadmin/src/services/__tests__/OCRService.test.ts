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

import { OCRService, OCR_SERVICE_CONFIG } from '../OCRService';
import Tesseract from 'tesseract.js';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';
import sharp from 'sharp';
import { fromPath } from 'pdf2pic';

// Mock Tesseract.js
jest.mock('tesseract.js', () => ({
  createWorker: jest.fn(),
  PSM: {
    AUTO: 3,
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
        'eng+ara',
        1,
        expect.objectContaining({
          logger: expect.any(Function),
        })
      );
      expect(mockWorker.setParameters).toHaveBeenCalledWith({
        preserve_interword_spaces: '1',
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
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

      expect(mockCreateWorker).toHaveBeenCalledWith('eng+ara', 1, expect.any(Object));
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
  // EXIF Auto-Orientation Tests (Task 340, Task 341)
  // ==========================================================================

  describe('EXIF Auto-Orientation', () => {
    it('should call sharp.rotate() for EXIF auto-orientation (REQ-001)', async () => {
      const mockImageBuffer = createMockImageBuffer(150);
      (fs.readFile as jest.Mock).mockResolvedValue(mockImageBuffer);

      // Setup worker recognize
      mockWorker.recognize.mockResolvedValue({
        data: { text: 'Oriented text', confidence: 90 },
      });

      // Track rotate() calls
      let rotateCalled = false;
      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        rotate: jest.fn().mockImplementation(() => {
          rotateCalled = true;
          return {
            greyscale: jest.fn().mockReturnThis(),
            normalize: jest.fn().mockReturnThis(),
            sharpen: jest.fn().mockReturnThis(),
            threshold: jest.fn().mockReturnThis(),
            resize: jest.fn().mockReturnThis(),
            toBuffer: jest.fn().mockResolvedValue(createMockImageBuffer(150)),
          };
        }),
        greyscale: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        threshold: jest.fn().mockReturnThis(),
        resize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(createMockImageBuffer(150)),
      }));

      await service.processImage('/test-exif.jpg');

      expect(rotateCalled).toBe(true);
    });

    it('should gracefully handle invalid EXIF data (NFR-005)', async () => {
      const mockImageBuffer = createMockImageBuffer(150);
      (fs.readFile as jest.Mock).mockResolvedValue(mockImageBuffer);

      // Setup worker recognize
      mockWorker.recognize.mockResolvedValue({
        data: { text: 'Text from image without EXIF', confidence: 85 },
      });

      // Mock sharp to throw on rotate() (simulating invalid EXIF)
      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        rotate: jest.fn().mockImplementation(() => {
          throw new Error('Invalid EXIF orientation tag');
        }),
        greyscale: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        threshold: jest.fn().mockReturnThis(),
        resize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(createMockImageBuffer(150)),
      }));

      // Should not throw - graceful degradation per NFR-005
      const result = await service.processImage('/no-exif.png');

      expect(result.text).toBe('Text from image without EXIF');
    });

    it('should handle empty buffer input gracefully', async () => {
      const emptyBuffer = Buffer.alloc(0);
      (fs.readFile as jest.Mock).mockResolvedValue(emptyBuffer);

      // Setup sharp mock with proper chain
      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        rotate: jest.fn().mockReturnThis(),
        greyscale: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        threshold: jest.fn().mockReturnThis(),
        resize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(emptyBuffer),
      }));

      // Should throw due to empty buffer validation
      await expect(service.processImage('/empty.jpg')).rejects.toThrow();
    });

    it('should preserve original buffer if auto-orientation fails (NFR-005)', async () => {
      const mockImageBuffer = createMockImageBuffer(150);
      (fs.readFile as jest.Mock).mockResolvedValue(mockImageBuffer);

      // Setup worker recognize
      mockWorker.recognize.mockResolvedValue({
        data: { text: 'Original text', confidence: 80 },
      });

      // Mock sharp: rotate fails but subsequent processing works
      (sharp as unknown as jest.Mock).mockImplementation((buffer: Buffer) => ({
        rotate: jest.fn().mockImplementation(() => {
          // First call with rotate fails
          throw new Error('EXIF rotation failed');
        }),
        greyscale: jest.fn().mockImplementation(function (this: any) {
          // Verify we're using original buffer after failure
          expect(buffer).toBe(mockImageBuffer);
          return this;
        }),
        normalize: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        threshold: jest.fn().mockReturnThis(),
        resize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockImageBuffer),
      }));

      const result = await service.processImage('/corrupted-exif.jpg');

      // Should still complete (using original buffer as fallback)
      expect(result).toBeDefined();
    });

    it('should apply auto-orientation before other preprocessing steps', async () => {
      const mockImageBuffer = createMockImageBuffer(150);
      (fs.readFile as jest.Mock).mockResolvedValue(mockImageBuffer);

      // Setup worker recognize
      mockWorker.recognize.mockResolvedValue({
        data: { text: 'Processed text', confidence: 92 },
      });

      // Track the order of operations
      const operationOrder: string[] = [];

      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        rotate: jest.fn().mockImplementation(() => {
          operationOrder.push('rotate');
          return {
            toBuffer: jest.fn().mockResolvedValue(createMockImageBuffer(150)),
          };
        }),
        greyscale: jest.fn().mockImplementation(function (this: any) {
          operationOrder.push('greyscale');
          return this;
        }),
        normalize: jest.fn().mockImplementation(function (this: any) {
          operationOrder.push('normalize');
          return this;
        }),
        sharpen: jest.fn().mockImplementation(function (this: any) {
          operationOrder.push('sharpen');
          return this;
        }),
        threshold: jest.fn().mockImplementation(function (this: any) {
          operationOrder.push('threshold');
          return this;
        }),
        resize: jest.fn().mockImplementation(function (this: any) {
          operationOrder.push('resize');
          return this;
        }),
        toBuffer: jest.fn().mockResolvedValue(createMockImageBuffer(150)),
      }));

      await service.processImage('/test-order.jpg');

      // Verify rotate is called first (EXIF auto-orientation happens before other preprocessing)
      expect(operationOrder[0]).toBe('rotate');
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
      expect(capturedSharpInstance.threshold).toHaveBeenCalled();
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
  // Structured Data Extraction Tests (Updated for Per-Field Confidence)
  // ==========================================================================

  describe('extractStructuredData', () => {
    it('should extract email addresses with confidence', async () => {
      const text = 'Contact us at support@example.com or sales@company.org';

      const result = await service.extractStructuredData(text);

      expect(result.email).toBeDefined();
      expect(result.email).toHaveLength(2);
      expect(result.email![0].value).toBe('support@example.com');
      expect(result.email![0].confidence).toBeGreaterThan(0);
      expect(result.email![0].source).toBe('pattern');
      expect(result.email![1].value).toBe('sales@company.org');
    });

    it('should extract phone numbers with confidence', async () => {
      const text = 'Call 555-1234 or (123) 456-7890';

      const result = await service.extractStructuredData(text);

      expect(result.phone).toBeDefined();
      expect(result.phone!.length).toBeGreaterThan(0);
      expect(result.phone![0].confidence).toBeGreaterThan(0);
      expect(result.phone![0].source).toBe('pattern');
    });

    it('should extract dates with confidence', async () => {
      const text = 'Meeting on 12/15/2025 and 2025-01-20';

      const result = await service.extractStructuredData(text);

      expect(result.date).toBeDefined();
      expect(result.date).toHaveLength(2);
      expect(result.date![0].value).toBe('12/15/2025');
      expect(result.date![1].value).toBe('2025-01-20');
      // ISO format should have higher confidence
      expect(result.date![1].confidence).toBeGreaterThanOrEqual(result.date![0].confidence);
    });

    it('should extract SSN with confidence', async () => {
      const text = 'SSN: 123-45-6789';

      const result = await service.extractStructuredData(text);

      expect(result.ssn).toBeDefined();
      expect(result.ssn![0].value).toBe('123-45-6789');
      // Base 92 + line-start boost (key-value pattern) = 97, clamped to valid range
      expect(result.ssn![0].confidence).toBeGreaterThanOrEqual(85);
    });

    it('should extract zip codes with confidence', async () => {
      const text = 'Address: 12345 or 67890-1234';

      const result = await service.extractStructuredData(text);

      expect(result.zipCode).toBeDefined();
      expect(result.zipCode).toHaveLength(2);
      expect(result.zipCode![0].value).toBe('12345');
      expect(result.zipCode![1].value).toBe('67890-1234');
    });

    it('should extract currency amounts with confidence', async () => {
      const text = 'Total: $1,234.56 or €999.99';

      const result = await service.extractStructuredData(text);

      expect(result.currency).toBeDefined();
      expect(result.currency).toHaveLength(2);
      expect(result.currency![0].value).toBe('$1,234.56');
      expect(result.currency![1].value).toBe('€999.99');
    });

    it('should extract percentages with confidence', async () => {
      const text = 'Interest rate: 3.5% or 10.25%';

      const result = await service.extractStructuredData(text);

      expect(result.percentage).toBeDefined();
      expect(result.percentage).toHaveLength(2);
      expect(result.percentage![0].value).toBe('3.5%');
      expect(result.percentage![1].value).toBe('10.25%');
    });

    it('should extract key-value pairs with confidence', async () => {
      const text = `
        Name: John Doe
        Email: john@example.com
        Phone: 555-1234
      `;

      const result = await service.extractStructuredData(text);

      expect(result.fields).toBeDefined();
      expect(result.fields.name).toBeDefined();
      expect(result.fields.name.value).toBe('John Doe');
      expect(result.fields.name.confidence).toBeGreaterThan(0);
      expect(result.fields.name.source).toBe('pattern');
      expect(result.fields.email.value).toBe('john@example.com');
      expect(result.fields.phone.value).toBe('555-1234');
    });

    it('should deduplicate extracted values', async () => {
      const text = 'Contact support@example.com or support@example.com';

      const result = await service.extractStructuredData(text);

      expect(result.email).toBeDefined();
      expect(result.email).toHaveLength(1); // Only once
      expect(result.email![0].value).toBe('support@example.com');
    });

    it('should handle empty text', async () => {
      const result = await service.extractStructuredData('');

      expect(result.fields).toEqual({});
      expect(result.email).toBeUndefined();
      expect(result.phone).toBeUndefined();
    });

    it('should extract passport numbers with confidence', async () => {
      const text = 'Passport: AB1234567';

      const result = await service.extractStructuredData(text);

      expect(result.passport).toBeDefined();
      expect(result.passport![0].value).toBe('AB1234567');
      expect(result.passport![0].confidence).toBeGreaterThanOrEqual(90);
    });

    it('should extract Emirates ID with confidence', async () => {
      const text = 'Emirates ID: 784-1990-1234567-1';

      const result = await service.extractStructuredData(text);

      expect(result.emiratesId).toBeDefined();
      expect(result.emiratesId![0].value).toBe('784-1990-1234567-1');
      // Base 95 + pattern-specific boost (complete format +3) = 98
      expect(result.emiratesId![0].confidence).toBeGreaterThanOrEqual(90);
    });

    it('should apply OCR confidence multiplier', async () => {
      const text = 'support@example.com';

      // High OCR confidence
      const highConfResult = await service.extractStructuredData(text, 100);
      // Low OCR confidence
      const lowConfResult = await service.extractStructuredData(text, 50);

      expect(highConfResult.email![0].confidence).toBeGreaterThan(
        lowConfResult.email![0].confidence
      );
    });
  });

  // ==========================================================================
  // Per-Field Confidence Calculation Tests (Task 482)
  // ==========================================================================

  describe('calculateFieldConfidence', () => {
    describe('Base Confidence Factors', () => {
      it('should return base confidence of 95 for email patterns', () => {
        const confidence = service.calculateFieldConfidence(
          'email',
          'test@example.com',
          0,
          'test@example.com',
          100
        );
        // Base 95 + line-start boost (+5) + common domain (.com +3) = ~103 -> clamped to 100
        expect(confidence).toBeGreaterThanOrEqual(95);
        expect(confidence).toBeLessThanOrEqual(100);
      });

      it('should return base confidence of 80 for phone patterns', () => {
        const confidence = service.calculateFieldConfidence(
          'phone',
          '555-123-4567',
          0,
          'Call 555-123-4567',
          100
        );
        expect(confidence).toBeGreaterThanOrEqual(70);
        expect(confidence).toBeLessThanOrEqual(90);
      });

      it('should return base confidence of 85 for date patterns', () => {
        const confidence = service.calculateFieldConfidence(
          'date',
          '12/25/2025',
          0,
          'Date: 12/25/2025',
          100
        );
        expect(confidence).toBeGreaterThanOrEqual(80);
        expect(confidence).toBeLessThanOrEqual(95);
      });

      it('should return base confidence of 90-95 for passport patterns', () => {
        const confidence = service.calculateFieldConfidence(
          'passport',
          'AB1234567',
          0,
          'Passport: AB1234567',
          100
        );
        expect(confidence).toBeGreaterThanOrEqual(90);
        expect(confidence).toBeLessThanOrEqual(100);
      });

      it('should return base confidence of 95 for Emirates ID patterns', () => {
        const confidence = service.calculateFieldConfidence(
          'emiratesId',
          '784-1990-1234567-1',
          0,
          'ID: 784-1990-1234567-1',
          100
        );
        // Base 95 + complete format boost (+3) = 98
        expect(confidence).toBeGreaterThanOrEqual(90);
        expect(confidence).toBeLessThanOrEqual(100);
      });

      it('should return base confidence of 70-80 for key-value pairs', () => {
        const confidence = service.calculateFieldConfidence(
          'keyValue',
          'John Doe',
          0,
          'Name: John Doe',
          100
        );
        expect(confidence).toBeGreaterThanOrEqual(70);
        expect(confidence).toBeLessThanOrEqual(85);
      });
    });

    describe('Line-Start Boost (+5)', () => {
      it('should boost confidence for line-start matches', () => {
        const lineStartText = 'support@example.com is the email';
        const midLineText = 'Contact support@example.com for help';

        const lineStartConf = service.calculateFieldConfidence(
          'email',
          'support@example.com',
          0,
          lineStartText,
          100
        );
        const midLineConf = service.calculateFieldConfidence(
          'email',
          'support@example.com',
          8,
          midLineText,
          100
        );

        // Line-start should be higher (up to +5)
        expect(lineStartConf).toBeGreaterThanOrEqual(midLineConf);
      });

      it('should boost confidence for matches at newline start', () => {
        const text = 'Header line\nsupport@example.com';

        const confidence = service.calculateFieldConfidence(
          'email',
          'support@example.com',
          12,
          text,
          100
        );
        // Should get line-start boost since it's after a newline
        expect(confidence).toBeGreaterThanOrEqual(95);
      });
    });

    describe('OCR Artifact Penalty (-5)', () => {
      it('should penalize matches with ambiguous l1 pattern (OCR artifact)', () => {
        const cleanEmail = 'test@example.com';
        const artifactEmail = 'testl1@example.com'; // l followed by 1 is ambiguous

        const cleanConf = service.calculateFieldConfidence('email', cleanEmail, 0, cleanEmail, 100);
        const artifactConf = service.calculateFieldConfidence(
          'email',
          artifactEmail,
          0,
          artifactEmail,
          100
        );

        // Artifact-containing match should be penalized
        expect(artifactConf).toBeLessThan(cleanConf);
      });

      it('should penalize matches with ambiguous lI pattern (OCR artifact)', () => {
        const artifactEmail = 'testlI@example.com'; // lowercase l followed by uppercase I
        const confidence = service.calculateFieldConfidence(
          'email',
          artifactEmail,
          0,
          artifactEmail,
          100
        );
        // Should be penalized for OCR artifact
        expect(confidence).toBeLessThanOrEqual(98);
      });

      it('should penalize matches containing |l (pipe/l confusion)', () => {
        const confidence = service.calculateFieldConfidence(
          'phone',
          '555|l23-4567',
          0,
          '555|l23-4567',
          100
        );
        // Should be penalized for OCR artifact pattern
        expect(confidence).toBeLessThanOrEqual(80);
      });

      it('should penalize matches with O0 pattern (common OCR confusion)', () => {
        const text = 'testO0@example.com'; // O followed by 0 is ambiguous
        const confidence = service.calculateFieldConfidence('email', text, 0, text, 100);
        // Should be penalized for OCR artifact
        expect(confidence).toBeLessThan(100);
      });

      it('should NOT penalize normal text without ambiguous patterns', () => {
        const text = '123-45-6789'; // Normal SSN with 1 and 0, but not ambiguous combos
        const confidence = service.calculateFieldConfidence('ssn', text, 0, text, 100);
        // Should have high confidence since there are no ambiguous patterns
        expect(confidence).toBeGreaterThanOrEqual(90);
      });
    });

    describe('OCR Confidence Multiplier', () => {
      it('should apply full confidence when OCR confidence is 100%', () => {
        const confidence = service.calculateFieldConfidence(
          'email',
          'test@example.com',
          0,
          'test@example.com',
          100
        );
        expect(confidence).toBeGreaterThanOrEqual(95);
      });

      it('should reduce confidence when OCR confidence is 50%', () => {
        const fullConf = service.calculateFieldConfidence(
          'email',
          'test@example.com',
          0,
          'test@example.com',
          100
        );
        const halfConf = service.calculateFieldConfidence(
          'email',
          'test@example.com',
          0,
          'test@example.com',
          50
        );

        // At 50% OCR confidence, field confidence should be roughly halved
        expect(halfConf).toBeLessThan(fullConf);
        expect(halfConf).toBeLessThanOrEqual(fullConf * 0.6); // Allow some tolerance
      });

      it('should drastically reduce confidence when OCR confidence is 10%', () => {
        const confidence = service.calculateFieldConfidence(
          'email',
          'test@example.com',
          0,
          'test@example.com',
          10
        );
        // Should be very low
        expect(confidence).toBeLessThanOrEqual(15);
      });

      it('should handle 0% OCR confidence', () => {
        const confidence = service.calculateFieldConfidence(
          'email',
          'test@example.com',
          0,
          'test@example.com',
          0
        );
        // With 0% OCR confidence, the multiplier is 0, but then pattern-specific adjustments still apply
        // Base 95 * 0 = 0, then +3 for .com, +5 for line-start = 8, clamped to 0-100 range
        // Note: The multiplier is applied BEFORE pattern adjustments
        expect(confidence).toBeLessThanOrEqual(10);
      });
    });

    describe('Pattern-Specific Adjustments', () => {
      describe('Email Adjustments', () => {
        it('should boost confidence for common domains (.com, .org, .net)', () => {
          // Use 80% OCR confidence to avoid clamping to 100, making comparison meaningful
          const comConf = service.calculateFieldConfidence(
            'email',
            'test@example.com',
            5,
            'Call test@example.com',
            80
          );
          const orgConf = service.calculateFieldConfidence(
            'email',
            'test@example.org',
            5,
            'Call test@example.org',
            80
          );
          const netConf = service.calculateFieldConfidence(
            'email',
            'test@example.net',
            5,
            'Call test@example.net',
            80
          );
          const xyzConf = service.calculateFieldConfidence(
            'email',
            'test@example.xyz',
            5,
            'Call test@example.xyz',
            80
          );

          // Common domains should have higher confidence (+3 boost)
          expect(comConf).toBeGreaterThan(xyzConf);
          expect(orgConf).toBeGreaterThan(xyzConf);
          expect(netConf).toBeGreaterThan(xyzConf);
        });

        it('should penalize very short local parts', () => {
          const shortConf = service.calculateFieldConfidence(
            'email',
            'ab@example.com',
            0,
            'ab@example.com',
            100
          );
          const longConf = service.calculateFieldConfidence(
            'email',
            'john.doe@example.com',
            0,
            'john.doe@example.com',
            100
          );

          expect(shortConf).toBeLessThan(longConf);
        });
      });

      describe('Phone Adjustments', () => {
        it('should boost confidence for international format', () => {
          const intlConf = service.calculateFieldConfidence(
            'phone',
            '+1-555-123-4567',
            0,
            '+1-555-123-4567',
            100
          );
          const localConf = service.calculateFieldConfidence(
            'phone',
            '555-123-4567',
            0,
            '555-123-4567',
            100
          );

          expect(intlConf).toBeGreaterThan(localConf);
        });

        it('should penalize very short phone numbers', () => {
          const shortConf = service.calculateFieldConfidence('phone', '555-12', 0, '555-12', 100);
          const normalConf = service.calculateFieldConfidence(
            'phone',
            '555-123-4567',
            0,
            '555-123-4567',
            100
          );

          expect(shortConf).toBeLessThan(normalConf);
        });
      });

      describe('Date Adjustments', () => {
        it('should boost confidence for ISO format dates', () => {
          const isoConf = service.calculateFieldConfidence(
            'date',
            '2025-12-25',
            0,
            '2025-12-25',
            100
          );
          const usConf = service.calculateFieldConfidence(
            'date',
            '12/25/2025',
            0,
            '12/25/2025',
            100
          );

          expect(isoConf).toBeGreaterThanOrEqual(usConf);
        });
      });

      describe('Passport Adjustments', () => {
        it('should boost confidence for standard passport format', () => {
          const standardConf = service.calculateFieldConfidence(
            'passport',
            'AB1234567',
            0,
            'AB1234567',
            100
          );
          expect(standardConf).toBeGreaterThanOrEqual(90);
        });
      });

      describe('Emirates ID Adjustments', () => {
        it('should boost confidence for complete Emirates ID format', () => {
          const completeConf = service.calculateFieldConfidence(
            'emiratesId',
            '784-1990-1234567-1',
            0,
            '784-1990-1234567-1',
            100
          );
          expect(completeConf).toBeGreaterThanOrEqual(95);
        });
      });
    });

    describe('Confidence Clamping', () => {
      it('should clamp confidence to maximum 100', () => {
        // Email with all boosts: base 95 + line-start 5 + common domain 3 = 103 -> clamped to 100
        const text = 'support@example.com';
        const confidence = service.calculateFieldConfidence('email', text, 0, text, 100);
        expect(confidence).toBeLessThanOrEqual(100);
      });

      it('should clamp confidence to minimum 0', () => {
        const confidence = service.calculateFieldConfidence(
          'email',
          'test@example.com',
          0,
          'test@example.com',
          0
        );
        expect(confidence).toBeGreaterThanOrEqual(0);
      });

      it('should handle unknown pattern types with default confidence', () => {
        const confidence = service.calculateFieldConfidence(
          'unknownType',
          'some value',
          0,
          'some value',
          100
        );
        // Default base confidence of 70
        expect(confidence).toBeGreaterThanOrEqual(65);
        expect(confidence).toBeLessThanOrEqual(80);
      });
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
  // Stage 2: Legacy Tesseract Worker Tests (Task 346)
  // ==========================================================================

  describe('Legacy Tesseract Worker (Stage 2 OSD)', () => {
    describe('isOSDEnabled', () => {
      it('should return false when ENABLE_TESSERACT_OSD is not set', () => {
        // Default config should be false
        const result = service.isOSDEnabled();
        expect(result).toBe(false);
      });
    });

    describe('isLegacyWorkerReady', () => {
      it('should return false when legacy worker is not initialized', () => {
        expect(service.isLegacyWorkerReady()).toBe(false);
      });
    });

    describe('initializeLegacyWorker', () => {
      it('should throw error when OSD feature is disabled', async () => {
        // Default config has OSD disabled
        await expect(service.initializeLegacyWorker()).rejects.toThrow(
          'Tesseract OSD is not enabled'
        );
      });

      it('should not reinitialize if already initialized', async () => {
        // This test needs OSD enabled - we'll test the early return path
        // by manually setting the internal state
        const serviceAny = service as any;
        serviceAny.legacyInitialized = true;
        serviceAny.legacyWorker = mockWorker;

        // Clear the mock to track calls
        mockCreateWorker.mockClear();

        // Even with legacyInitialized=true, the feature flag check happens first
        // So this will throw because OSD is disabled
        await expect(service.initializeLegacyWorker()).rejects.toThrow(
          'Tesseract OSD is not enabled'
        );

        // Worker shouldn't be created since it short-circuited at feature flag check
        expect(mockCreateWorker).not.toHaveBeenCalled();
      });
    });

    describe('getLegacyWorkerMemoryDelta', () => {
      it('should return null when legacy worker is not initialized', () => {
        expect(service.getLegacyWorkerMemoryDelta()).toBeNull();
      });

      it('should return null when memoryBeforeLegacyInit is null', () => {
        const serviceAny = service as any;
        serviceAny.legacyInitialized = true;
        serviceAny.memoryBeforeLegacyInit = null;

        expect(service.getLegacyWorkerMemoryDelta()).toBeNull();
      });
    });

    describe('cleanup with legacy worker', () => {
      it('should terminate both workers when both are initialized', async () => {
        // Initialize main worker
        await service.initialize();

        // Manually set legacy worker state
        const legacyMockWorker = {
          terminate: jest.fn().mockResolvedValue(undefined),
        };
        const serviceAny = service as any;
        serviceAny.legacyWorker = legacyMockWorker;
        serviceAny.legacyInitialized = true;
        serviceAny.memoryBeforeLegacyInit = 100;

        await service.cleanup();

        // Both workers should be terminated
        expect(mockWorker.terminate).toHaveBeenCalled();
        expect(legacyMockWorker.terminate).toHaveBeenCalled();

        // State should be reset
        expect(serviceAny.legacyWorker).toBeNull();
        expect(serviceAny.legacyInitialized).toBe(false);
        expect(serviceAny.memoryBeforeLegacyInit).toBeNull();
      });

      it('should only terminate legacy worker when main worker is not initialized', async () => {
        // Only set legacy worker state (main worker not initialized)
        const legacyMockWorker = {
          terminate: jest.fn().mockResolvedValue(undefined),
        };
        const serviceAny = service as any;
        serviceAny.legacyWorker = legacyMockWorker;
        serviceAny.legacyInitialized = true;

        await service.cleanup();

        // Legacy worker should be terminated
        expect(legacyMockWorker.terminate).toHaveBeenCalled();

        // Main worker terminate should not have been called (not initialized)
        expect(mockWorker.terminate).not.toHaveBeenCalled();
      });

      it('should handle legacy worker termination errors', async () => {
        const legacyMockWorker = {
          terminate: jest.fn().mockRejectedValue(new Error('Legacy termination failed')),
        };
        const serviceAny = service as any;
        serviceAny.legacyWorker = legacyMockWorker;
        serviceAny.legacyInitialized = true;

        await expect(service.cleanup()).rejects.toThrow('Legacy termination failed');
      });
    });
  });

  // ==========================================================================
  // Stage 2: Legacy Worker with Feature Flag Enabled
  // ==========================================================================

  describe('Legacy Tesseract Worker (OSD Enabled)', () => {
    afterEach(() => {
      // Reset OSD flag after each test
      OCR_SERVICE_CONFIG.ENABLE_OSD = false;
    });

    it('should create legacy worker with legacyCore and legacyLang options when OSD is enabled', async () => {
      // Enable OSD
      OCR_SERVICE_CONFIG.ENABLE_OSD = true;

      // Clear previous calls
      mockCreateWorker.mockClear();

      await service.initializeLegacyWorker();

      // Verify createWorker was called with legacy options and 'osd' language for OSD detection
      expect(mockCreateWorker).toHaveBeenCalledWith(
        'osd',
        1,
        expect.objectContaining({
          legacyCore: true,
          legacyLang: true,
          logger: expect.any(Function),
        })
      );

      expect(service.isLegacyWorkerReady()).toBe(true);

      // Cleanup
      await service.cleanup();
    });

    it('should track memory before and after legacy worker initialization', async () => {
      // Enable OSD
      OCR_SERVICE_CONFIG.ENABLE_OSD = true;

      await service.initializeLegacyWorker();

      // Memory delta should be tracked (might be 0 or positive in test environment)
      const memoryDelta = service.getLegacyWorkerMemoryDelta();
      expect(memoryDelta).not.toBeNull();
      expect(typeof memoryDelta).toBe('number');

      // Cleanup
      await service.cleanup();
    });

    it('should handle legacy worker creation failure gracefully', async () => {
      // Enable OSD
      OCR_SERVICE_CONFIG.ENABLE_OSD = true;

      // Make createWorker fail
      mockCreateWorker.mockRejectedValueOnce(new Error('Failed to load legacy model'));

      await expect(service.initializeLegacyWorker()).rejects.toThrow(
        'Legacy Tesseract initialization failed'
      );

      expect(service.isLegacyWorkerReady()).toBe(false);
    });

    it('should not reinitialize legacy worker if already initialized', async () => {
      // Enable OSD
      OCR_SERVICE_CONFIG.ENABLE_OSD = true;

      // Clear previous calls
      mockCreateWorker.mockClear();

      // First initialization
      await service.initializeLegacyWorker();
      const callCount = mockCreateWorker.mock.calls.length;
      expect(callCount).toBe(1);

      // Second initialization should be no-op
      await service.initializeLegacyWorker();

      // createWorker should not have been called again
      expect(mockCreateWorker.mock.calls.length).toBe(callCount);

      // Cleanup
      await service.cleanup();
    });
  });

  // ==========================================================================
  // Stage 2: OSD Orientation Detection Tests (Task 347)
  // ==========================================================================

  describe('OSD Orientation Detection (detectOrientation)', () => {
    afterEach(() => {
      OCR_SERVICE_CONFIG.ENABLE_OSD = false;
    });

    describe('Input Validation', () => {
      it('should return default orientation for empty buffer', async () => {
        OCR_SERVICE_CONFIG.ENABLE_OSD = true;

        const result = await service.detectOrientation(Buffer.alloc(0));

        expect(result).toEqual({ orientation: 0, script: 'unknown', confidence: 0 });
      });

      it('should return default orientation for buffer too small', async () => {
        OCR_SERVICE_CONFIG.ENABLE_OSD = true;

        const smallBuffer = Buffer.alloc(30);
        const result = await service.detectOrientation(smallBuffer);

        expect(result).toEqual({ orientation: 0, script: 'unknown', confidence: 0 });
      });

      it('should throw error when OSD is not enabled', async () => {
        OCR_SERVICE_CONFIG.ENABLE_OSD = false;

        await expect(service.detectOrientation(createMockImageBuffer(150))).rejects.toThrow(
          'Tesseract OSD is not enabled'
        );
      });
    });

    describe('Detection with OSD Enabled', () => {
      beforeEach(() => {
        OCR_SERVICE_CONFIG.ENABLE_OSD = true;
      });

      it('should call legacy worker detect method', async () => {
        // Setup legacy worker mock
        const detectMock = jest.fn().mockResolvedValue({
          data: {
            orientation_degrees: 90,
            script: 'Latin',
            orientation_confidence: 95,
          },
        });

        mockWorker.detect = detectMock;
        mockCreateWorker.mockClear();

        const buffer = createMockImageBuffer(150);
        const result = await service.detectOrientation(buffer);

        expect(result).toEqual({ orientation: 90, script: 'Latin', confidence: 95 });
        expect(detectMock).toHaveBeenCalledWith(buffer);

        await service.cleanup();
      });

      it('should return correct orientation for 180° rotated image', async () => {
        const detectMock = jest.fn().mockResolvedValue({
          data: {
            orientation_degrees: 180,
            script: 'Latin',
            orientation_confidence: 88,
          },
        });

        mockWorker.detect = detectMock;

        const result = await service.detectOrientation(createMockImageBuffer(150));

        expect(result.orientation).toBe(180);

        await service.cleanup();
      });

      it('should return correct orientation for 270° rotated image', async () => {
        const detectMock = jest.fn().mockResolvedValue({
          data: {
            orientation_degrees: 270,
            script: 'Latin',
            orientation_confidence: 92,
          },
        });

        mockWorker.detect = detectMock;

        const result = await service.detectOrientation(createMockImageBuffer(150));

        expect(result.orientation).toBe(270);

        await service.cleanup();
      });

      it('should gracefully handle detection failure (NFR-005)', async () => {
        const detectMock = jest.fn().mockRejectedValue(new Error('Detection failed'));
        mockWorker.detect = detectMock;

        const result = await service.detectOrientation(createMockImageBuffer(150));

        expect(result).toEqual({ orientation: 0, script: 'unknown', confidence: 0 });

        await service.cleanup();
      });

      it('should handle null orientation_degrees gracefully', async () => {
        const detectMock = jest.fn().mockResolvedValue({
          data: {
            orientation_degrees: null,
            script: null,
            orientation_confidence: null,
          },
        });

        mockWorker.detect = detectMock;

        const result = await service.detectOrientation(createMockImageBuffer(150));

        expect(result).toEqual({ orientation: 0, script: 'unknown', confidence: 0 });

        await service.cleanup();
      });

      it('should lazy-initialize legacy worker on first call', async () => {
        mockCreateWorker.mockClear();

        const detectMock = jest.fn().mockResolvedValue({
          data: {
            orientation_degrees: 0,
            script: 'Latin',
            orientation_confidence: 100,
          },
        });
        mockWorker.detect = detectMock;

        // First call should initialize legacy worker
        await service.detectOrientation(createMockImageBuffer(150));

        // Verify 'osd' language is used for OSD traineddata (required for orientation detection)
        expect(mockCreateWorker).toHaveBeenCalledWith(
          'osd',
          1,
          expect.objectContaining({
            legacyCore: true,
            legacyLang: true,
          })
        );

        await service.cleanup();
      });
    });
  });

  // ==========================================================================
  // Stage 2: Image Rotation Tests (Task 347)
  // ==========================================================================

  describe('Image Rotation (rotateBuffer)', () => {
    it('should return original buffer for empty input', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const result = await service.rotateBuffer(emptyBuffer, 90);
      expect(result).toBe(emptyBuffer);
    });

    it('should return original buffer for 0 degrees', async () => {
      const buffer = createMockImageBuffer(150);
      const result = await service.rotateBuffer(buffer, 0);
      expect(result).toBe(buffer);
    });

    it('should return original buffer for invalid degrees', async () => {
      const buffer = createMockImageBuffer(150);
      const result = await service.rotateBuffer(buffer, 45);
      expect(result).toBe(buffer);
    });

    it('should call sharp.rotate for 90 degrees', async () => {
      const buffer = createMockImageBuffer(150);

      let rotateCalledWithDegrees: number | undefined;
      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        rotate: jest.fn().mockImplementation((degrees: number) => {
          rotateCalledWithDegrees = degrees;
          return {
            toBuffer: jest.fn().mockResolvedValue(createMockImageBuffer(150)),
          };
        }),
      }));

      await service.rotateBuffer(buffer, 90);

      expect(rotateCalledWithDegrees).toBe(90);
    });

    it('should call sharp.rotate for 180 degrees', async () => {
      const buffer = createMockImageBuffer(150);

      let rotateCalledWithDegrees: number | undefined;
      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        rotate: jest.fn().mockImplementation((degrees: number) => {
          rotateCalledWithDegrees = degrees;
          return {
            toBuffer: jest.fn().mockResolvedValue(createMockImageBuffer(150)),
          };
        }),
      }));

      await service.rotateBuffer(buffer, 180);

      expect(rotateCalledWithDegrees).toBe(180);
    });

    it('should call sharp.rotate for 270 degrees', async () => {
      const buffer = createMockImageBuffer(150);

      let rotateCalledWithDegrees: number | undefined;
      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        rotate: jest.fn().mockImplementation((degrees: number) => {
          rotateCalledWithDegrees = degrees;
          return {
            toBuffer: jest.fn().mockResolvedValue(createMockImageBuffer(150)),
          };
        }),
      }));

      await service.rotateBuffer(buffer, 270);

      expect(rotateCalledWithDegrees).toBe(270);
    });

    it('should gracefully handle rotation failure', async () => {
      const buffer = createMockImageBuffer(150);

      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        rotate: jest.fn().mockImplementation(() => {
          return {
            toBuffer: jest.fn().mockRejectedValue(new Error('Rotation failed')),
          };
        }),
      }));

      // Should return original buffer on failure
      const result = await service.rotateBuffer(buffer, 90);

      expect(result).toBe(buffer);
    });
  });

  // ==========================================================================
  // Stage 2: EXIF Detection and Conditional OSD Trigger Tests (Task 348)
  // ==========================================================================

  describe('EXIF Orientation Detection (checkHasExifOrientation)', () => {
    it('should return false for empty buffer', async () => {
      const result = await service.checkHasExifOrientation(Buffer.alloc(0));
      expect(result).toBe(false);
    });

    it('should return false for null buffer', async () => {
      const result = await service.checkHasExifOrientation(null as any);
      expect(result).toBe(false);
    });

    it('should return true when EXIF orientation metadata exists', async () => {
      const buffer = createMockImageBuffer(150);

      // Mock sharp to return orientation metadata
      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        metadata: jest.fn().mockResolvedValue({
          width: 100,
          height: 100,
          orientation: 6, // 90° CW rotation needed
        }),
      }));

      const result = await service.checkHasExifOrientation(buffer);
      expect(result).toBe(true);
    });

    it('should return true for orientation value 1 (no rotation but EXIF exists)', async () => {
      const buffer = createMockImageBuffer(150);

      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        metadata: jest.fn().mockResolvedValue({
          orientation: 1, // No rotation needed, but EXIF orientation tag exists
        }),
      }));

      const result = await service.checkHasExifOrientation(buffer);
      expect(result).toBe(true);
    });

    it('should return false when no orientation metadata exists', async () => {
      const buffer = createMockImageBuffer(150);

      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        metadata: jest.fn().mockResolvedValue({
          width: 100,
          height: 100,
          // No orientation field
        }),
      }));

      const result = await service.checkHasExifOrientation(buffer);
      expect(result).toBe(false);
    });

    it('should return false for orientation value 0 (invalid)', async () => {
      const buffer = createMockImageBuffer(150);

      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        metadata: jest.fn().mockResolvedValue({
          orientation: 0, // Invalid orientation
        }),
      }));

      const result = await service.checkHasExifOrientation(buffer);
      expect(result).toBe(false);
    });

    it('should return false for orientation value > 8 (invalid)', async () => {
      const buffer = createMockImageBuffer(150);

      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        metadata: jest.fn().mockResolvedValue({
          orientation: 9, // Invalid orientation (only 1-8 valid)
        }),
      }));

      const result = await service.checkHasExifOrientation(buffer);
      expect(result).toBe(false);
    });

    it('should gracefully handle metadata read failure', async () => {
      const buffer = createMockImageBuffer(150);

      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        metadata: jest.fn().mockRejectedValue(new Error('Cannot read metadata')),
      }));

      const result = await service.checkHasExifOrientation(buffer);
      expect(result).toBe(false);
    });
  });

  describe('autoOrientBuffer with PreprocessingResult', () => {
    it('should return hadExifOrientation=false for empty buffer', async () => {
      const result = await service.autoOrientBuffer(Buffer.alloc(0));
      expect(result.hadExifOrientation).toBe(false);
      expect(result.buffer.length).toBe(0);
    });

    it('should return hadExifOrientation=true when EXIF orientation exists', async () => {
      const buffer = createMockImageBuffer(150);
      const rotatedBuffer = createMockImageBuffer(160);

      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        metadata: jest.fn().mockResolvedValue({ orientation: 6 }),
        rotate: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(rotatedBuffer),
      }));

      const result = await service.autoOrientBuffer(buffer);
      expect(result.hadExifOrientation).toBe(true);
      expect(result.buffer).toBe(rotatedBuffer);
    });

    it('should return hadExifOrientation=false when no EXIF orientation', async () => {
      const buffer = createMockImageBuffer(150);
      const processedBuffer = createMockImageBuffer(150);

      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        metadata: jest.fn().mockResolvedValue({ width: 100, height: 100 }),
        rotate: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(processedBuffer),
      }));

      const result = await service.autoOrientBuffer(buffer);
      expect(result.hadExifOrientation).toBe(false);
    });

    it('should gracefully handle EXIF check failure but still process', async () => {
      const buffer = createMockImageBuffer(150);
      const processedBuffer = createMockImageBuffer(150);

      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        metadata: jest.fn().mockRejectedValue(new Error('Metadata error')),
        rotate: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(processedBuffer),
      }));

      const result = await service.autoOrientBuffer(buffer);
      expect(result.hadExifOrientation).toBe(false);
    });
  });

  describe('Conditional OSD Trigger Logic (Task 348)', () => {
    beforeEach(() => {
      // Reset OSD enabled state before each test
      OCR_SERVICE_CONFIG.ENABLE_OSD = false;
    });

    afterEach(() => {
      // Ensure OSD is disabled after tests
      OCR_SERVICE_CONFIG.ENABLE_OSD = false;
    });

    it('should NOT run OSD when feature is disabled (default)', async () => {
      const buffer = createMockImageBuffer(150);
      let detectCalled = false;

      // Create fresh service instance
      const testService = new OCRService();

      // Mock legacy worker detect
      const mockLegacyWorker = {
        detect: jest.fn().mockImplementation(() => {
          detectCalled = true;
          return { data: { orientation_degrees: 90, orientation_confidence: 95, script: 'Latin' } };
        }),
        terminate: jest.fn().mockResolvedValue(undefined),
      };

      // Access private legacyWorker
      (testService as any).legacyWorker = mockLegacyWorker;
      (testService as any).legacyInitialized = true;

      // Setup sharp mock
      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        metadata: jest.fn().mockResolvedValue({ width: 100, height: 100 }), // No EXIF
        rotate: jest.fn().mockReturnThis(),
        greyscale: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        threshold: jest.fn().mockReturnThis(),
        resize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(buffer),
      }));

      // Process with OSD disabled (default)
      await (testService as any).preprocessImage(buffer, true);

      // OSD should NOT be called when feature is disabled
      expect(detectCalled).toBe(false);
    });

    it('should NOT run OSD when image has EXIF orientation (even if OSD enabled)', async () => {
      OCR_SERVICE_CONFIG.ENABLE_OSD = true;
      const buffer = createMockImageBuffer(150);
      let detectCalled = false;

      const testService = new OCRService();

      // Mock legacy worker
      const mockLegacyWorker = {
        detect: jest.fn().mockImplementation(() => {
          detectCalled = true;
          return { data: { orientation_degrees: 90, orientation_confidence: 95, script: 'Latin' } };
        }),
        terminate: jest.fn().mockResolvedValue(undefined),
      };

      (testService as any).legacyWorker = mockLegacyWorker;
      (testService as any).legacyInitialized = true;

      // Setup sharp mock with EXIF orientation present
      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        metadata: jest.fn().mockResolvedValue({ orientation: 6 }), // EXIF present
        rotate: jest.fn().mockReturnThis(),
        greyscale: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        threshold: jest.fn().mockReturnThis(),
        resize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(buffer),
      }));

      // Process scanned PDF with EXIF orientation
      await (testService as any).preprocessImage(buffer, true);

      // OSD should NOT be called when EXIF orientation exists
      expect(detectCalled).toBe(false);
    });

    it('should NOT run OSD for standalone images (not from scanned PDF)', async () => {
      OCR_SERVICE_CONFIG.ENABLE_OSD = true;
      const buffer = createMockImageBuffer(150);
      let detectCalled = false;

      const testService = new OCRService();

      const mockLegacyWorker = {
        detect: jest.fn().mockImplementation(() => {
          detectCalled = true;
          return { data: { orientation_degrees: 90, orientation_confidence: 95, script: 'Latin' } };
        }),
        terminate: jest.fn().mockResolvedValue(undefined),
      };

      (testService as any).legacyWorker = mockLegacyWorker;
      (testService as any).legacyInitialized = true;

      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        metadata: jest.fn().mockResolvedValue({ width: 100, height: 100 }), // No EXIF
        rotate: jest.fn().mockReturnThis(),
        greyscale: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        threshold: jest.fn().mockReturnThis(),
        resize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(buffer),
      }));

      // Process as standalone image (isFromScannedPdf = false)
      await (testService as any).preprocessImage(buffer, false);

      // OSD should NOT be called for standalone images
      expect(detectCalled).toBe(false);
    });

    it('should run OSD when enabled AND scanned PDF AND no EXIF', async () => {
      OCR_SERVICE_CONFIG.ENABLE_OSD = true;
      const buffer = createMockImageBuffer(150);
      const rotatedBuffer = createMockImageBuffer(160);
      let detectCalled = false;

      const testService = new OCRService();

      const mockLegacyWorker = {
        detect: jest.fn().mockImplementation(() => {
          detectCalled = true;
          return { data: { orientation_degrees: 90, orientation_confidence: 80, script: 'Latin' } };
        }),
        terminate: jest.fn().mockResolvedValue(undefined),
      };

      (testService as any).legacyWorker = mockLegacyWorker;
      (testService as any).legacyInitialized = true;

      let rotateCalledWithDegrees: number | null = null;
      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        metadata: jest.fn().mockResolvedValue({ width: 100, height: 100 }), // No EXIF
        rotate: jest.fn().mockImplementation((degrees?: number) => {
          if (degrees !== undefined) {
            rotateCalledWithDegrees = degrees;
          }
          return {
            greyscale: jest.fn().mockReturnThis(),
            normalize: jest.fn().mockReturnThis(),
            sharpen: jest.fn().mockReturnThis(),
            threshold: jest.fn().mockReturnThis(),
            resize: jest.fn().mockReturnThis(),
            toBuffer: jest.fn().mockResolvedValue(rotatedBuffer),
          };
        }),
        greyscale: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        threshold: jest.fn().mockReturnThis(),
        resize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(buffer),
      }));

      // Process as scanned PDF without EXIF
      await (testService as any).preprocessImage(buffer, true);

      // OSD should be called
      expect(detectCalled).toBe(true);
      // And rotation should be applied (90° detected)
      expect(rotateCalledWithDegrees).toBe(90);
    });

    it('should NOT rotate when OSD detects 0° orientation', async () => {
      OCR_SERVICE_CONFIG.ENABLE_OSD = true;
      const buffer = createMockImageBuffer(150);

      const testService = new OCRService();

      const mockLegacyWorker = {
        detect: jest.fn().mockResolvedValue({
          data: { orientation_degrees: 0, orientation_confidence: 90, script: 'Latin' },
        }),
        terminate: jest.fn().mockResolvedValue(undefined),
      };

      (testService as any).legacyWorker = mockLegacyWorker;
      (testService as any).legacyInitialized = true;

      let explicitRotateCalled = false;
      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        metadata: jest.fn().mockResolvedValue({ width: 100, height: 100 }), // No EXIF
        rotate: jest.fn().mockImplementation((degrees?: number) => {
          if (degrees !== undefined && degrees !== 0) {
            explicitRotateCalled = true;
          }
          return {
            greyscale: jest.fn().mockReturnThis(),
            normalize: jest.fn().mockReturnThis(),
            sharpen: jest.fn().mockReturnThis(),
            threshold: jest.fn().mockReturnThis(),
            resize: jest.fn().mockReturnThis(),
            toBuffer: jest.fn().mockResolvedValue(buffer),
          };
        }),
        greyscale: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        threshold: jest.fn().mockReturnThis(),
        resize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(buffer),
      }));

      await (testService as any).preprocessImage(buffer, true);

      // No explicit rotation should be called for 0° orientation
      expect(explicitRotateCalled).toBe(false);
    });

    it('should NOT rotate when OSD confidence is below threshold (50%)', async () => {
      OCR_SERVICE_CONFIG.ENABLE_OSD = true;
      const buffer = createMockImageBuffer(150);

      const testService = new OCRService();

      const mockLegacyWorker = {
        detect: jest.fn().mockResolvedValue({
          data: { orientation_degrees: 180, orientation_confidence: 30, script: 'Latin' }, // Low confidence
        }),
        terminate: jest.fn().mockResolvedValue(undefined),
      };

      (testService as any).legacyWorker = mockLegacyWorker;
      (testService as any).legacyInitialized = true;

      let explicitRotateCalled = false;
      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        metadata: jest.fn().mockResolvedValue({ width: 100, height: 100 }),
        rotate: jest.fn().mockImplementation((degrees?: number) => {
          if (degrees !== undefined && degrees !== 0) {
            explicitRotateCalled = true;
          }
          return {
            greyscale: jest.fn().mockReturnThis(),
            normalize: jest.fn().mockReturnThis(),
            sharpen: jest.fn().mockReturnThis(),
            threshold: jest.fn().mockReturnThis(),
            resize: jest.fn().mockReturnThis(),
            toBuffer: jest.fn().mockResolvedValue(buffer),
          };
        }),
        greyscale: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        threshold: jest.fn().mockReturnThis(),
        resize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(buffer),
      }));

      await (testService as any).preprocessImage(buffer, true);

      // No rotation when confidence < 50%
      expect(explicitRotateCalled).toBe(false);
    });

    it('should gracefully handle OSD detection failure (NFR-005)', async () => {
      OCR_SERVICE_CONFIG.ENABLE_OSD = true;
      const buffer = createMockImageBuffer(150);

      const testService = new OCRService();

      const mockLegacyWorker = {
        detect: jest.fn().mockRejectedValue(new Error('OSD detection failed')),
        terminate: jest.fn().mockResolvedValue(undefined),
      };

      (testService as any).legacyWorker = mockLegacyWorker;
      (testService as any).legacyInitialized = true;

      (sharp as unknown as jest.Mock).mockImplementation(() => ({
        metadata: jest.fn().mockResolvedValue({ width: 100, height: 100 }),
        rotate: jest.fn().mockReturnThis(),
        greyscale: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        threshold: jest.fn().mockReturnThis(),
        resize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(buffer),
      }));

      // Should NOT throw - graceful degradation
      const result = await (testService as any).preprocessImage(buffer, true);

      // Should return processed buffer despite OSD failure
      expect(result.buffer).toBeTruthy();
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
