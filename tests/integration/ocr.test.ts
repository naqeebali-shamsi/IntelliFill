import { OCRService, OCRResult, OCRProgress } from '../../src/services/OCRService';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('OCR Service Integration Tests', () => {
  let ocrService: OCRService;
  const testDataDir = path.join(__dirname, '../test-data');
  const samplePdfPath = path.join(testDataDir, 'sample-form.pdf');
  const sampleImagePath = path.join(testDataDir, 'test-ocr-image.png');

  beforeAll(async () => {
    ocrService = new OCRService();
    await ocrService.initialize();
  });

  afterAll(async () => {
    await ocrService.cleanup();
  });

  describe('PDF Page-to-Image Conversion', () => {
    it('should convert PDF pages to images and extract text', async () => {
      // Verify test PDF exists
      const pdfExists = await fs.access(samplePdfPath).then(() => true).catch(() => false);
      if (!pdfExists) {
        console.warn('Sample PDF not found, skipping test');
        return;
      }

      const result = await ocrService.processPDF(samplePdfPath);

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
      expect(result.pages).toBeInstanceOf(Array);
      expect(result.pages.length).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.pageCount).toBeGreaterThan(0);
      expect(result.metadata.processingTime).toBeGreaterThan(0);
    }, 60000); // 60 second timeout for OCR processing

    it('should achieve minimum 80% OCR accuracy on clear documents', async () => {
      const pdfExists = await fs.access(samplePdfPath).then(() => true).catch(() => false);
      if (!pdfExists) {
        console.warn('Sample PDF not found, skipping test');
        return;
      }

      const result = await ocrService.processPDF(samplePdfPath);

      // Check confidence score
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    }, 60000);

    it('should process each page in less than 5 seconds', async () => {
      const pdfExists = await fs.access(samplePdfPath).then(() => true).catch(() => false);
      if (!pdfExists) {
        console.warn('Sample PDF not found, skipping test');
        return;
      }

      const result = await ocrService.processPDF(samplePdfPath);

      // Calculate average time per page
      const avgTimePerPage = result.metadata.processingTime / result.metadata.pageCount;

      // Should be less than 5 seconds (5000ms) per page
      expect(avgTimePerPage).toBeLessThan(5000);
    }, 60000);

    it('should provide progress tracking during conversion', async () => {
      const pdfExists = await fs.access(samplePdfPath).then(() => true).catch(() => false);
      if (!pdfExists) {
        console.warn('Sample PDF not found, skipping test');
        return;
      }

      const progressUpdates: OCRProgress[] = [];

      await ocrService.processPDF(samplePdfPath, (progress) => {
        progressUpdates.push(progress);
      });

      // Verify progress updates were received
      expect(progressUpdates.length).toBeGreaterThan(0);

      // Verify progress stages
      const stages = progressUpdates.map(p => p.stage);
      expect(stages).toContain('converting');
      expect(stages).toContain('preprocessing');
      expect(stages).toContain('recognizing');
      expect(stages).toContain('complete');

      // Verify progress is monotonically increasing
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i].progress).toBeGreaterThanOrEqual(progressUpdates[i - 1].progress);
      }

      // Verify final progress is 100%
      const lastProgress = progressUpdates[progressUpdates.length - 1];
      expect(lastProgress.progress).toBe(100);
      expect(lastProgress.stage).toBe('complete');
    }, 60000);
  });

  describe('Multi-page PDF Processing', () => {
    it('should process multi-page PDFs without memory leaks', async () => {
      const pdfExists = await fs.access(samplePdfPath).then(() => true).catch(() => false);
      if (!pdfExists) {
        console.warn('Sample PDF not found, skipping test');
        return;
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Process the same PDF multiple times
      for (let i = 0; i < 3; i++) {
        await ocrService.processPDF(samplePdfPath);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // Memory increase should be reasonable (less than 100MB for 3 runs)
      expect(memoryIncrease).toBeLessThan(100);
    }, 180000); // 3 minute timeout

    it('should correctly track page numbers', async () => {
      const pdfExists = await fs.access(samplePdfPath).then(() => true).catch(() => false);
      if (!pdfExists) {
        console.warn('Sample PDF not found, skipping test');
        return;
      }

      const result = await ocrService.processPDF(samplePdfPath);

      // Verify page numbers are sequential
      result.pages.forEach((page, index) => {
        expect(page.pageNumber).toBe(index + 1);
      });

      // Verify all pages have content
      result.pages.forEach(page => {
        expect(page.text).toBeDefined();
        expect(page.confidence).toBeGreaterThanOrEqual(0);
      });
    }, 60000);
  });

  describe('Image Processing', () => {
    it('should process images with OCR', async () => {
      const imageExists = await fs.access(sampleImagePath).then(() => true).catch(() => false);
      if (!imageExists) {
        console.warn('Sample image not found, skipping test');
        return;
      }

      const result = await ocrService.processImage(sampleImagePath);

      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.pages.length).toBe(1);
      expect(result.metadata.pageCount).toBe(1);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle non-existent PDF files gracefully', async () => {
      const nonExistentPath = path.join(testDataDir, 'nonexistent.pdf');

      await expect(ocrService.processPDF(nonExistentPath)).rejects.toThrow();
    });

    it('should handle corrupted PDF files gracefully', async () => {
      // Create a temporary corrupted PDF
      const corruptedPath = path.join(testDataDir, 'corrupted-temp.pdf');
      await fs.writeFile(corruptedPath, 'This is not a valid PDF file');

      try {
        await expect(ocrService.processPDF(corruptedPath)).rejects.toThrow();
      } finally {
        // Clean up
        await fs.unlink(corruptedPath).catch(() => {});
      }
    });

    it('should handle non-existent image files gracefully', async () => {
      const nonExistentPath = path.join(testDataDir, 'nonexistent.png');

      await expect(ocrService.processImage(nonExistentPath)).rejects.toThrow();
    });
  });

  describe('Text Extraction Quality', () => {
    it('should extract structured data from OCR text', async () => {
      // Sample text with structured data
      const sampleText = `
        Email: john.doe@example.com
        Phone: +1 (555) 123-4567
        Date: 12/31/2023
        SSN: 123-45-6789
        ZIP: 12345
        Amount: $1,234.56
        Percentage: 75.5%
      `;

      const structuredData = await ocrService.extractStructuredData(sampleText);

      expect(structuredData.email).toContain('john.doe@example.com');
      expect(structuredData.phone).toBeDefined();
      expect(structuredData.date).toBeDefined();
      expect(structuredData.ssn).toContain('123-45-6789');
      expect(structuredData.zipCode).toContain('12345');
      expect(structuredData.currency).toContain('$1,234.56');
      expect(structuredData.percentage).toContain('75.5%');
    });

    it('should merge OCR text with original text', async () => {
      const originalText = 'This is original text from PDF.';
      const ocrText = 'This is OCR extracted text.';

      const merged = await ocrService.enhanceWithOCR(originalText, ocrText);

      expect(merged).toContain('original');
      expect(merged).toContain('OCR');
    });

    it('should prefer OCR text when original is minimal', async () => {
      const originalText = '   ';
      const ocrText = 'This is OCR extracted text with meaningful content.';

      const result = await ocrService.enhanceWithOCR(originalText, ocrText);

      expect(result).toBe(ocrText);
    });
  });

  describe('Performance', () => {
    it('should initialize OCR service quickly', async () => {
      const newService = new OCRService();
      const startTime = Date.now();

      await newService.initialize();

      const initTime = Date.now() - startTime;

      // Initialization should be quick (less than 10 seconds)
      expect(initTime).toBeLessThan(10000);

      await newService.cleanup();
    }, 15000);

    it('should clean up resources properly', async () => {
      const newService = new OCRService();
      await newService.initialize();

      await newService.cleanup();

      // After cleanup, worker should be null
      // This is internal state, but we can verify by trying to use it
      // It should reinitialize if needed
      const pdfExists = await fs.access(samplePdfPath).then(() => true).catch(() => false);
      if (pdfExists) {
        await newService.processPDF(samplePdfPath);
        // If this doesn't throw, reinit worked
        expect(true).toBe(true);
        await newService.cleanup();
      }
    }, 60000);
  });
});
