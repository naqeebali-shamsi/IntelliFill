/**
 * DocumentDetectionService Unit Tests
 *
 * Tests for the DocumentDetectionService class covering:
 * - PDF scanning detection (scanned vs text-based)
 * - Text density analysis
 * - Text extraction from PDFs
 * - PDF metadata retrieval
 * - Batch PDF scanning detection
 * - Edge cases with empty/corrupted PDFs
 * - Meaningful text ratio detection
 *
 * @module services/__tests__/DocumentDetectionService.test
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { DocumentDetectionService } from '../DocumentDetectionService';
import * as fs from 'fs/promises';
import pdfParse from 'pdf-parse';

// Mock fs/promises
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

// Mock pdf-parse
jest.mock('pdf-parse', () => jest.fn());

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('DocumentDetectionService', () => {
  let service: DocumentDetectionService;
  let mockReadFile: jest.MockedFunction<typeof fs.readFile>;
  let mockPdfParse: jest.MockedFunction<typeof pdfParse>;

  beforeEach(() => {
    service = new DocumentDetectionService();
    mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
    mockPdfParse = pdfParse as jest.MockedFunction<typeof pdfParse>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isScannedPDF', () => {
    it('should detect PDF as scanned when no text is extracted', async () => {
      const mockBuffer = Buffer.from('fake-pdf-data');
      mockReadFile.mockResolvedValue(mockBuffer);
      mockPdfParse.mockResolvedValue({
        text: '',
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any);

      const result = await service.isScannedPDF('test.pdf');

      expect(result).toBe(true);
      expect(mockReadFile).toHaveBeenCalledWith('test.pdf');
      expect(mockPdfParse).toHaveBeenCalledWith(mockBuffer);
    });

    it('should detect PDF as scanned when text density is very low (< 50 chars/page)', async () => {
      const mockBuffer = Buffer.from('fake-pdf-data');
      mockReadFile.mockResolvedValue(mockBuffer);
      mockPdfParse.mockResolvedValue({
        text: 'Hello',  // Only 5 characters
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any);

      const result = await service.isScannedPDF('test.pdf');

      expect(result).toBe(true);
    });

    it('should detect PDF as scanned when text is mostly whitespace', async () => {
      const mockBuffer = Buffer.from('fake-pdf-data');
      mockReadFile.mockResolvedValue(mockBuffer);
      // 100 characters total, but only 5 meaningful (95% whitespace)
      const whitespaceText = '   a \n\n\n  b  \t\t\t c   \r\r d    e    ' + ' '.repeat(50);
      mockPdfParse.mockResolvedValue({
        text: whitespaceText,
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any);

      const result = await service.isScannedPDF('test.pdf');

      expect(result).toBe(true);
    });

    it('should detect PDF as text-based when substantial text is present', async () => {
      const mockBuffer = Buffer.from('fake-pdf-data');
      mockReadFile.mockResolvedValue(mockBuffer);
      const substantialText = 'This is a text-based PDF document with plenty of content that can be extracted directly without OCR. '.repeat(10);
      mockPdfParse.mockResolvedValue({
        text: substantialText,
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any);

      const result = await service.isScannedPDF('test.pdf');

      expect(result).toBe(false);
    });

    it('should detect PDF as text-based for multi-page document with good text density', async () => {
      const mockBuffer = Buffer.from('fake-pdf-data');
      mockReadFile.mockResolvedValue(mockBuffer);
      const substantialText = 'Page content with meaningful information. '.repeat(100);
      mockPdfParse.mockResolvedValue({
        text: substantialText,
        numpages: 10,
        numrender: 10,
        info: {},
        metadata: null,
        version: '1.0',
      } as any);

      const result = await service.isScannedPDF('test.pdf');

      expect(result).toBe(false);
      // Text per page = ~4200 chars / 10 pages = 420 chars/page (well above 50 threshold)
    });

    it('should default to scanned (true) when PDF parsing fails', async () => {
      mockReadFile.mockResolvedValue(Buffer.from('fake-pdf-data'));
      mockPdfParse.mockRejectedValue(new Error('Corrupt PDF'));

      const result = await service.isScannedPDF('test-corrupt.pdf');

      expect(result).toBe(true);
    });

    it('should handle file read errors gracefully and default to scanned', async () => {
      mockReadFile.mockRejectedValue(new Error('File not found'));

      const result = await service.isScannedPDF('missing.pdf');

      expect(result).toBe(true);
    });

    it('should detect borderline case at exactly 50 chars/page threshold', async () => {
      const mockBuffer = Buffer.from('fake-pdf-data');
      mockReadFile.mockResolvedValue(mockBuffer);
      // Exactly 50 characters with good meaningful ratio
      const borderlineText = 'A'.repeat(50);
      mockPdfParse.mockResolvedValue({
        text: borderlineText,
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any);

      const result = await service.isScannedPDF('test.pdf');

      // At exactly 50 chars/page, should still be detected as text-based
      // because meaningful ratio is good (1.0)
      expect(result).toBe(false);
    });
  });

  describe('extractTextFromPDF', () => {
    it('should successfully extract text from a PDF', async () => {
      const mockBuffer = Buffer.from('fake-pdf-data');
      const expectedText = 'Extracted text content from PDF document.';
      mockReadFile.mockResolvedValue(mockBuffer);
      mockPdfParse.mockResolvedValue({
        text: expectedText,
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any);

      const result = await service.extractTextFromPDF('test.pdf');

      expect(result).toBe(expectedText);
      expect(mockReadFile).toHaveBeenCalledWith('test.pdf');
    });

    it('should return empty string for PDF with no text', async () => {
      const mockBuffer = Buffer.from('fake-pdf-data');
      mockReadFile.mockResolvedValue(mockBuffer);
      mockPdfParse.mockResolvedValue({
        text: '',
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any);

      const result = await service.extractTextFromPDF('scanned.pdf');

      expect(result).toBe('');
    });

    it('should throw error when PDF extraction fails', async () => {
      mockReadFile.mockResolvedValue(Buffer.from('fake-pdf-data'));
      mockPdfParse.mockRejectedValue(new Error('Extraction failed'));

      await expect(service.extractTextFromPDF('corrupt.pdf'))
        .rejects.toThrow('Failed to extract text from PDF');
    });
  });

  describe('getPDFInfo', () => {
    it('should return comprehensive PDF information for text-based PDF', async () => {
      const mockBuffer = Buffer.from('fake-pdf-data');
      const mockText = 'This is a substantial text-based PDF. '.repeat(20);
      mockReadFile.mockResolvedValue(mockBuffer);

      let callCount = 0;
      mockPdfParse.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          text: mockText,
          numpages: 3,
          numrender: 3,
          info: { Title: 'Test Document', Author: 'Test Author' },
          metadata: { Producer: 'Test Producer' },
          version: '1.7',
        } as any);
      });

      const result = await service.getPDFInfo('test.pdf');

      expect(result.numPages).toBe(3);
      expect(result.textLength).toBe(mockText.trim().length);
      expect(result.textPerPage).toBeGreaterThan(200);
      expect(result.isScanned).toBe(false);
      expect(result.metadata).toMatchObject({
        Title: 'Test Document',
        Author: 'Test Author',
      });
    });

    it('should return correct info for scanned PDF', async () => {
      const mockBuffer = Buffer.from('fake-pdf-data');
      mockReadFile.mockResolvedValue(mockBuffer);

      let callCount = 0;
      mockPdfParse.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          text: '',
          numpages: 2,
          numrender: 2,
          info: {},
          metadata: null,
          version: '1.0',
        } as any);
      });

      const result = await service.getPDFInfo('scanned.pdf');

      expect(result.numPages).toBe(2);
      expect(result.textLength).toBe(0);
      expect(result.textPerPage).toBe(0);
      expect(result.isScanned).toBe(true);
    });

    it('should throw error when PDF info retrieval fails', async () => {
      mockReadFile.mockRejectedValue(new Error('File not found'));

      await expect(service.getPDFInfo('missing.pdf'))
        .rejects.toThrow('Failed to get PDF info');
    });
  });

  describe('batchCheckScanned', () => {
    it('should process multiple PDFs and return scanned status for each', async () => {
      const paths = ['doc1.pdf', 'doc2.pdf', 'doc3.pdf'];
      const mockBuffer = Buffer.from('fake-pdf-data');
      mockReadFile.mockResolvedValue(mockBuffer);

      // Mock different responses for different files
      let callIndex = 0;
      mockPdfParse.mockImplementation(() => {
        const responses = [
          { text: 'Substantial text content. '.repeat(50), numpages: 1 },
          { text: '', numpages: 1 },
          { text: 'More good content. '.repeat(30), numpages: 2 },
        ];
        return Promise.resolve({
          ...responses[callIndex++ % 3],
          numrender: 1,
          info: {},
          metadata: null,
          version: '1.0',
        } as any);
      });

      const result = await service.batchCheckScanned(paths);

      expect(result.size).toBe(3);
      expect(result.get('doc1.pdf')).toBe(false); // Text-based
      expect(result.get('doc2.pdf')).toBe(true);  // Scanned (no text)
      expect(result.get('doc3.pdf')).toBe(false); // Text-based
    });

    it('should handle errors gracefully and default failed PDFs to scanned', async () => {
      const paths = ['good.pdf', 'bad.pdf', 'ugly.pdf'];
      const mockBuffer = Buffer.from('fake-pdf-data');

      let callIndex = 0;
      mockReadFile.mockImplementation((path) => {
        if (path === 'bad.pdf') {
          return Promise.reject(new Error('Read error'));
        }
        return Promise.resolve(mockBuffer);
      });

      mockPdfParse.mockImplementation(() => {
        const responses = [
          { text: 'Good content. '.repeat(50), numpages: 1 },
          { text: 'Ugly content. '.repeat(40), numpages: 1 },
        ];
        return Promise.resolve({
          ...responses[callIndex++ % 2],
          numrender: 1,
          info: {},
          metadata: null,
          version: '1.0',
        } as any);
      });

      const result = await service.batchCheckScanned(paths);

      expect(result.size).toBe(3);
      expect(result.get('good.pdf')).toBe(false); // Text-based
      expect(result.get('bad.pdf')).toBe(true);   // Error -> defaults to scanned
      expect(result.get('ugly.pdf')).toBe(false); // Text-based
    });

    it('should handle empty array input', async () => {
      const result = await service.batchCheckScanned([]);

      expect(result.size).toBe(0);
    });

    it('should process all PDFs in parallel', async () => {
      const paths = Array.from({ length: 10 }, (_, i) => `doc${i}.pdf`);
      const mockBuffer = Buffer.from('fake-pdf-data');
      mockReadFile.mockResolvedValue(mockBuffer);
      mockPdfParse.mockResolvedValue({
        text: 'Content. '.repeat(100),
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any);

      const startTime = Date.now();
      const result = await service.batchCheckScanned(paths);
      const duration = Date.now() - startTime;

      expect(result.size).toBe(10);
      // Should complete quickly due to parallel processing
      // (this is a basic check - actual timing depends on system)
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle PDF with only special characters', async () => {
      const mockBuffer = Buffer.from('fake-pdf-data');
      mockReadFile.mockResolvedValue(mockBuffer);
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      mockPdfParse.mockResolvedValue({
        text: specialChars.repeat(10),
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any);

      const result = await service.isScannedPDF('special-chars.pdf');

      // Special characters are considered meaningful content
      expect(result).toBe(false);
    });

    it('should handle PDF with mixed content (text + whitespace)', async () => {
      const mockBuffer = Buffer.from('fake-pdf-data');
      mockReadFile.mockResolvedValue(mockBuffer);
      // 60% meaningful content, 40% whitespace
      const mixedText = 'Word '.repeat(100) + ' '.repeat(200);
      mockPdfParse.mockResolvedValue({
        text: mixedText,
        numpages: 1,
        numrender: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any);

      const result = await service.isScannedPDF('mixed.pdf');

      // Should be detected as text-based (meaningful ratio > 10%)
      expect(result).toBe(false);
    });

    it('should handle very large PDF with many pages', async () => {
      const mockBuffer = Buffer.from('fake-pdf-data');
      mockReadFile.mockResolvedValue(mockBuffer);
      const pageContent = 'This is page content. '.repeat(50);
      mockPdfParse.mockResolvedValue({
        text: pageContent.repeat(100), // Simulate 100 pages worth of content
        numpages: 100,
        numrender: 100,
        info: {},
        metadata: null,
        version: '1.0',
      } as any);

      const result = await service.isScannedPDF('large.pdf');

      expect(result).toBe(false);
    });

    it('should handle zero-page PDF edge case', async () => {
      const mockBuffer = Buffer.from('fake-pdf-data');
      mockReadFile.mockResolvedValue(mockBuffer);
      mockPdfParse.mockResolvedValue({
        text: 'Some text',
        numpages: 0, // Edge case
        numrender: 0,
        info: {},
        metadata: null,
        version: '1.0',
      } as any);

      const result = await service.isScannedPDF('zero-pages.pdf');

      // Division by zero protection: textPerPage should be 0
      // Low density should result in scanned detection
      expect(result).toBe(true);
    });
  });
});
