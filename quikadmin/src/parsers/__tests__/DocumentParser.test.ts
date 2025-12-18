/**
 * DocumentParser Tests
 *
 * Comprehensive unit tests for DocumentParser covering:
 * - PDF text extraction using pdf-parse
 * - Empty PDF handling and requiresOCR flag
 * - Scanned PDF detection
 * - Error handling and fallback mechanisms
 */

import { DocumentParser, ParsedDocument } from '../DocumentParser';
import * as fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import { PDFDocument } from 'pdf-lib';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('pdf-parse');
jest.mock('pdf-lib');
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('DocumentParser', () => {
  let parser: DocumentParser;
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockPdfParse = pdfParse as jest.MockedFunction<typeof pdfParse>;

  beforeEach(() => {
    parser = new DocumentParser();
    jest.clearAllMocks();
  });

  // ==========================================================================
  // PDF Text Extraction Tests
  // ==========================================================================

  describe('parsePDF - Text Extraction', () => {
    it('should extract text from native PDF successfully', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 test content');
      const mockPdfData = {
        text: 'This is extracted text from the PDF',
        numpages: 2,
        numrender: 2,
        info: {
          Title: 'Test Document',
          Author: 'Test Author',
        },
        metadata: null,
        version: '1.4',
      };

      mockFs.readFile.mockResolvedValue(mockPdfBuffer);
      mockPdfParse.mockResolvedValue(mockPdfData as any);

      // Mock pdf-lib PDFDocument
      const mockPdfDoc = {
        getPageCount: jest.fn().mockReturnValue(2),
        getTitle: jest.fn().mockReturnValue('Test Document'),
        getAuthor: jest.fn().mockReturnValue('Test Author'),
        getCreationDate: jest.fn().mockReturnValue(new Date('2024-01-01')),
      };
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      const result = await parser.parse('/test/document.pdf');

      expect(result).toEqual({
        type: 'pdf',
        content: 'This is extracted text from the PDF',
        metadata: {
          pageCount: 2,
          title: 'Test Document',
          author: 'Test Author',
          creationDate: new Date('2024-01-01'),
          hasText: true,
          textLength: 36,
          requiresOCR: false,
          numpages: 2,
          numrender: 2,
          info: {
            Title: 'Test Document',
            Author: 'Test Author',
          },
          metadata: null,
        },
      });

      expect(mockPdfParse).toHaveBeenCalledWith(mockPdfBuffer);
    });

    it('should handle PDFs with empty text content', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 empty content');
      const mockPdfData = {
        text: '',
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: null,
        version: '1.4',
      };

      mockFs.readFile.mockResolvedValue(mockPdfBuffer);
      mockPdfParse.mockResolvedValue(mockPdfData as any);

      const mockPdfDoc = {
        getPageCount: jest.fn().mockReturnValue(1),
        getTitle: jest.fn().mockReturnValue(null),
        getAuthor: jest.fn().mockReturnValue(null),
        getCreationDate: jest.fn().mockReturnValue(null),
      };
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      const result = await parser.parse('/test/empty.pdf');

      expect(result.content).toBe('');
      expect(result.metadata.hasText).toBe(false);
      expect(result.metadata.requiresOCR).toBe(true);
      expect(result.metadata.textLength).toBe(0);
    });

    it('should handle PDFs with only whitespace', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 whitespace content');
      const mockPdfData = {
        text: '   \n\n\t\t  ',
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: null,
        version: '1.4',
      };

      mockFs.readFile.mockResolvedValue(mockPdfBuffer);
      mockPdfParse.mockResolvedValue(mockPdfData as any);

      const mockPdfDoc = {
        getPageCount: jest.fn().mockReturnValue(1),
        getTitle: jest.fn().mockReturnValue(null),
        getAuthor: jest.fn().mockReturnValue(null),
        getCreationDate: jest.fn().mockReturnValue(null),
      };
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      const result = await parser.parse('/test/whitespace.pdf');

      expect(result.content.trim().length).toBe(0);
      expect(result.metadata.requiresOCR).toBe(true);
      expect(result.metadata.hasText).toBe(false);
    });

    it('should flag scanned PDFs for OCR processing', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 scanned content');
      const mockPdfData = {
        text: null,
        numpages: 5,
        numrender: 5,
        info: {
          Producer: 'Scanner Pro',
        },
        metadata: null,
        version: '1.4',
      };

      mockFs.readFile.mockResolvedValue(mockPdfBuffer);
      mockPdfParse.mockResolvedValue(mockPdfData as any);

      const mockPdfDoc = {
        getPageCount: jest.fn().mockReturnValue(5),
        getTitle: jest.fn().mockReturnValue(null),
        getAuthor: jest.fn().mockReturnValue(null),
        getCreationDate: jest.fn().mockReturnValue(null),
      };
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      const result = await parser.parse('/test/scanned.pdf');

      expect(result.metadata.requiresOCR).toBe(true);
      expect(result.metadata.hasText).toBe(false);
      expect(result.content).toBe('');
    });

    it('should handle multi-page PDFs correctly', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 multi-page content');
      const multiPageText = 'Page 1 content\nPage 2 content\nPage 3 content';
      const mockPdfData = {
        text: multiPageText,
        numpages: 3,
        numrender: 3,
        info: {},
        metadata: null,
        version: '1.4',
      };

      mockFs.readFile.mockResolvedValue(mockPdfBuffer);
      mockPdfParse.mockResolvedValue(mockPdfData as any);

      const mockPdfDoc = {
        getPageCount: jest.fn().mockReturnValue(3),
        getTitle: jest.fn().mockReturnValue(null),
        getAuthor: jest.fn().mockReturnValue(null),
        getCreationDate: jest.fn().mockReturnValue(null),
      };
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      const result = await parser.parse('/test/multipage.pdf');

      expect(result.content).toBe(multiPageText);
      expect(result.metadata.pageCount).toBe(3);
      expect(result.metadata.numpages).toBe(3);
      expect(result.metadata.requiresOCR).toBe(false);
    });
  });

  // ==========================================================================
  // PDF Parse Error Handling Tests
  // ==========================================================================

  describe('parsePDF - Error Handling', () => {
    it('should fallback to pdf-lib when pdf-parse fails', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 corrupted content');

      mockFs.readFile.mockResolvedValue(mockPdfBuffer);
      mockPdfParse.mockRejectedValue(new Error('PDF parse failed'));

      const mockPdfDoc = {
        getPageCount: jest.fn().mockReturnValue(1),
        getTitle: jest.fn().mockReturnValue('Fallback Title'),
        getAuthor: jest.fn().mockReturnValue('Fallback Author'),
        getCreationDate: jest.fn().mockReturnValue(new Date('2024-01-01')),
      };
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      const result = await parser.parse('/test/corrupted.pdf');

      expect(result.type).toBe('pdf');
      expect(result.content).toBe('');
      expect(result.metadata.title).toBe('Fallback Title');
      expect(result.metadata.author).toBe('Fallback Author');
      expect(result.metadata.requiresOCR).toBe(true);
    });

    it('should throw error when both pdf-parse and pdf-lib fail', async () => {
      const mockPdfBuffer = Buffer.from('invalid pdf');

      mockFs.readFile.mockResolvedValue(mockPdfBuffer);
      mockPdfParse.mockRejectedValue(new Error('PDF parse failed'));
      (PDFDocument.load as jest.Mock).mockRejectedValue(new Error('PDF lib failed'));

      await expect(parser.parse('/test/invalid.pdf')).rejects.toThrow(
        'Failed to parse PDF'
      );
    });

    it('should handle file read errors', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(parser.parse('/test/nonexistent.pdf')).rejects.toThrow(
        'Failed to parse PDF'
      );
    });

    it('should handle PDFs with missing metadata gracefully', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 no metadata');
      const mockPdfData = {
        text: 'Content without metadata',
        numpages: 1,
        numrender: 1,
        info: null,
        metadata: null,
        version: '1.4',
      };

      mockFs.readFile.mockResolvedValue(mockPdfBuffer);
      mockPdfParse.mockResolvedValue(mockPdfData as any);

      const mockPdfDoc = {
        getPageCount: jest.fn().mockReturnValue(1),
        getTitle: jest.fn().mockReturnValue(null),
        getAuthor: jest.fn().mockReturnValue(null),
        getCreationDate: jest.fn().mockReturnValue(null),
      };
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      const result = await parser.parse('/test/no-metadata.pdf');

      expect(result.type).toBe('pdf');
      expect(result.metadata.title).toBe('Untitled');
      expect(result.metadata.author).toBeUndefined();
    });
  });

  // ==========================================================================
  // Metadata Extraction Tests
  // ==========================================================================

  describe('parsePDF - Metadata Extraction', () => {
    it('should extract comprehensive PDF metadata', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 test content');
      const mockPdfData = {
        text: 'Test content',
        numpages: 1,
        numrender: 1,
        info: {
          Title: 'Test Document',
          Author: 'John Doe',
          Subject: 'Testing',
          Keywords: 'test, document, pdf',
          Creator: 'Test Creator',
          Producer: 'Test Producer',
          CreationDate: 'D:20240101120000Z',
        },
        metadata: {
          _metadata: {
            'dc:title': 'Test Document',
          },
        },
        version: '1.4',
      };

      mockFs.readFile.mockResolvedValue(mockPdfBuffer);
      mockPdfParse.mockResolvedValue(mockPdfData as any);

      const mockPdfDoc = {
        getPageCount: jest.fn().mockReturnValue(1),
        getTitle: jest.fn().mockReturnValue('Test Document'),
        getAuthor: jest.fn().mockReturnValue('John Doe'),
        getCreationDate: jest.fn().mockReturnValue(new Date('2024-01-01')),
      };
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      const result = await parser.parse('/test/metadata.pdf');

      expect(result.metadata.title).toBe('Test Document');
      expect(result.metadata.author).toBe('John Doe');
      expect(result.metadata.info.Subject).toBe('Testing');
      expect(result.metadata.info.Keywords).toBe('test, document, pdf');
    });

    it('should prefer pdf-lib metadata over pdf-parse when available', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 test content');
      const mockPdfData = {
        text: 'Test content',
        numpages: 1,
        numrender: 1,
        info: {
          Title: 'pdf-parse title',
        },
        metadata: null,
        version: '1.4',
      };

      mockFs.readFile.mockResolvedValue(mockPdfBuffer);
      mockPdfParse.mockResolvedValue(mockPdfData as any);

      const mockPdfDoc = {
        getPageCount: jest.fn().mockReturnValue(1),
        getTitle: jest.fn().mockReturnValue('pdf-lib title'),
        getAuthor: jest.fn().mockReturnValue('pdf-lib author'),
        getCreationDate: jest.fn().mockReturnValue(new Date('2024-01-01')),
      };
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      const result = await parser.parse('/test/metadata.pdf');

      // pdf-lib values should take precedence
      expect(result.metadata.title).toBe('pdf-lib title');
      expect(result.metadata.author).toBe('pdf-lib author');
    });
  });

  // ==========================================================================
  // File Type Detection Tests
  // ==========================================================================

  describe('parse - File Type Detection', () => {
    it('should detect PDF files by extension', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 test');
      mockFs.readFile.mockResolvedValue(mockPdfBuffer);
      mockPdfParse.mockResolvedValue({
        text: 'test',
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: null,
        version: '1.4',
      } as any);

      const mockPdfDoc = {
        getPageCount: jest.fn().mockReturnValue(1),
        getTitle: jest.fn().mockReturnValue(null),
        getAuthor: jest.fn().mockReturnValue(null),
        getCreationDate: jest.fn().mockReturnValue(null),
      };
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      const result = await parser.parse('/test/document.pdf');
      expect(result.type).toBe('pdf');
    });

    it('should throw error for unsupported file types', async () => {
      await expect(parser.parse('/test/document.exe')).rejects.toThrow(
        'Unsupported file type: exe'
      );
    });

    it('should handle files without extensions', async () => {
      await expect(parser.parse('/test/document')).rejects.toThrow(
        'Unsupported file type: undefined'
      );
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('parseMultiple', () => {
    it('should parse multiple PDFs successfully', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 test');
      mockFs.readFile.mockResolvedValue(mockPdfBuffer);

      mockPdfParse.mockResolvedValue({
        text: 'test content',
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: null,
        version: '1.4',
      } as any);

      const mockPdfDoc = {
        getPageCount: jest.fn().mockReturnValue(1),
        getTitle: jest.fn().mockReturnValue(null),
        getAuthor: jest.fn().mockReturnValue(null),
        getCreationDate: jest.fn().mockReturnValue(null),
      };
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      const results = await parser.parseMultiple([
        '/test/doc1.pdf',
        '/test/doc2.pdf',
        '/test/doc3.pdf',
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].type).toBe('pdf');
      expect(results[1].type).toBe('pdf');
      expect(results[2].type).toBe('pdf');
    });

    it('should handle partial failures in batch processing', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 test');
      mockFs.readFile
        .mockResolvedValueOnce(mockPdfBuffer)
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce(mockPdfBuffer);

      mockPdfParse.mockResolvedValue({
        text: 'test',
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: null,
        version: '1.4',
      } as any);

      const mockPdfDoc = {
        getPageCount: jest.fn().mockReturnValue(1),
        getTitle: jest.fn().mockReturnValue(null),
        getAuthor: jest.fn().mockReturnValue(null),
        getCreationDate: jest.fn().mockReturnValue(null),
      };
      (PDFDocument.load as jest.Mock).mockResolvedValue(mockPdfDoc);

      await expect(
        parser.parseMultiple(['/test/doc1.pdf', '/test/missing.pdf', '/test/doc3.pdf'])
      ).rejects.toThrow();
    });
  });
});
