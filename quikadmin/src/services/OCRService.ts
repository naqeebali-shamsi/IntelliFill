import Tesseract from 'tesseract.js';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';
import sharp from 'sharp';
import { fromPath } from 'pdf2pic';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../utils/logger';
import { getFileBuffer, isUrl } from '../utils/fileReader';

export interface OCRResult {
  text: string;
  confidence: number;
  pages: Array<{
    pageNumber: number;
    text: string;
    confidence: number;
  }>;
  metadata: {
    language: string;
    processingTime: number;
    pageCount: number;
  };
}

export interface OCRProgress {
  currentPage: number;
  totalPages: number;
  stage: 'converting' | 'preprocessing' | 'recognizing' | 'complete';
  progress: number; // 0-100
  message: string;
}

export type ProgressCallback = (progress: OCRProgress) => void;

export class OCRService {
  private worker: Tesseract.Worker | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.worker = await Tesseract.createWorker('eng+spa+fra+deu', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            logger.debug(`OCR Progress: ${(m.progress * 100).toFixed(1)}%`);
          }
        },
      });

      // Configure for better accuracy
      // Note: Using PSM.AUTO instead of PSM.AUTO_OSD to avoid requiring osd.traineddata
      // AUTO_OSD requires the OSD trained data file which may not be available on all deployments
      await this.worker.setParameters({
        tessedit_char_whitelist:
          '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,;:!?@#$%&*()-_+=[]{}|\\/<>"\' ',
        preserve_interword_spaces: '1',
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      });

      this.initialized = true;
      logger.info('OCR Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize OCR service:', error);
      throw new Error(`OCR initialization failed: ${error}`);
    }
  }

  async processPDF(pdfPathOrUrl: string, onProgress?: ProgressCallback): Promise<OCRResult> {
    const startTime = Date.now();
    await this.initialize();

    // Create temporary directory for PDF conversion
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ocr-'));
    let tempPdfPath: string | null = null;

    try {
      // Get PDF bytes - either from URL or local file using shared fileReader
      const pdfBytes = await getFileBuffer(pdfPathOrUrl);
      let pdfPath: string;

      if (isUrl(pdfPathOrUrl)) {
        // Save to temp file for pdf2pic (which requires a file path)
        tempPdfPath = path.join(tempDir, 'input.pdf');
        await fs.writeFile(tempPdfPath, pdfBytes);
        pdfPath = tempPdfPath;
        logger.info(`PDF downloaded (${pdfBytes.length} bytes)`);
      } else {
        pdfPath = pdfPathOrUrl;
      }

      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pageCount = pdfDoc.getPageCount();

      const pages: OCRResult['pages'] = [];
      let fullText = '';
      let totalConfidence = 0;

      logger.info(`Starting OCR processing for ${pageCount} pages`);

      for (let i = 0; i < pageCount; i++) {
        const pageNum = i + 1;

        // Progress: Converting
        onProgress?.({
          currentPage: pageNum,
          totalPages: pageCount,
          stage: 'converting',
          progress: (i / pageCount) * 100,
          message: `Converting page ${pageNum}/${pageCount} to image...`,
        });

        // Convert PDF page to image
        const imageBuffer = await this.pdfPageToImage(pdfPath, i, tempDir);

        // Progress: Preprocessing
        onProgress?.({
          currentPage: pageNum,
          totalPages: pageCount,
          stage: 'preprocessing',
          progress: ((i + 0.3) / pageCount) * 100,
          message: `Preprocessing page ${pageNum}/${pageCount}...`,
        });

        // Preprocess image for better OCR
        const processedImage = await this.preprocessImage(imageBuffer);

        // Progress: Recognizing
        onProgress?.({
          currentPage: pageNum,
          totalPages: pageCount,
          stage: 'recognizing',
          progress: ((i + 0.5) / pageCount) * 100,
          message: `Recognizing text on page ${pageNum}/${pageCount}...`,
        });

        // Perform OCR with explicit error handling for tesseract worker errors
        let result;
        try {
          result = await this.worker!.recognize(processedImage);
        } catch (recognizeError) {
          // Tesseract worker errors can crash the process if not caught
          logger.error(`Tesseract OCR failed for page ${pageNum}:`, recognizeError);
          throw new Error(
            `OCR recognition failed for page ${pageNum}: ${recognizeError instanceof Error ? recognizeError.message : 'Unknown error'}`
          );
        }

        // Validate OCR result
        if (!result || !result.data) {
          logger.warn(`OCR returned empty result for page ${pageNum}`);
          pages.push({
            pageNumber: pageNum,
            text: '',
            confidence: 0,
          });
          continue;
        }

        pages.push({
          pageNumber: pageNum,
          text: result.data.text || '',
          confidence: result.data.confidence || 0,
        });

        fullText += (result.data.text || '') + '\n\n';
        totalConfidence += result.data.confidence || 0;

        logger.debug(
          `Processed page ${pageNum}/${pageCount} with confidence ${result.data.confidence}%`
        );

        // Clean up page image to free memory
        if (imageBuffer) {
          // Buffer will be garbage collected
        }
      }

      const processingTime = Date.now() - startTime;

      // Progress: Complete
      onProgress?.({
        currentPage: pageCount,
        totalPages: pageCount,
        stage: 'complete',
        progress: 100,
        message: `OCR complete. Processed ${pageCount} pages in ${(processingTime / 1000).toFixed(1)}s`,
      });

      return {
        text: fullText.trim(),
        confidence: totalConfidence / pageCount,
        pages,
        metadata: {
          language: 'eng',
          processingTime,
          pageCount,
        },
      };
    } catch (error) {
      logger.error('OCR processing error:', error);
      throw new Error(`Failed to process PDF with OCR: ${error}`);
    } finally {
      // Clean up temporary directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        logger.debug(`Cleaned up temporary directory: ${tempDir}`);
      } catch (cleanupError) {
        logger.warn('Failed to clean up temporary directory:', cleanupError);
      }
    }
  }

  async processImage(imagePathOrUrl: string): Promise<OCRResult> {
    const startTime = Date.now();
    await this.initialize();

    try {
      // Get image bytes - either from URL or local file using shared fileReader
      const imageBuffer = await getFileBuffer(imagePathOrUrl);
      if (isUrl(imagePathOrUrl)) {
        logger.info(`Image downloaded (${imageBuffer.length} bytes)`);
      }

      // Preprocess image
      const processedImage = await this.preprocessImage(imageBuffer);

      // Perform OCR
      const result = await this.worker!.recognize(processedImage);

      const processingTime = Date.now() - startTime;

      return {
        text: result.data.text,
        confidence: result.data.confidence,
        pages: [
          {
            pageNumber: 1,
            text: result.data.text,
            confidence: result.data.confidence,
          },
        ],
        metadata: {
          language: 'eng',
          processingTime,
          pageCount: 1,
        },
      };
    } catch (error) {
      logger.error('Image OCR error:', error);
      throw new Error(`Failed to process image with OCR: ${error}`);
    }
  }

  private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    // CRITICAL: Validate input buffer to prevent tesseract worker crashes
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Cannot preprocess empty image buffer');
    }

    // Minimum valid image size (a 1x1 PNG is ~68 bytes)
    if (imageBuffer.length < 50) {
      throw new Error(`Image buffer too small (${imageBuffer.length} bytes)`);
    }

    try {
      // Apply image preprocessing for better OCR accuracy
      const processed = await sharp(imageBuffer)
        .greyscale() // Convert to grayscale
        .normalize() // Normalize contrast
        .sharpen() // Sharpen text
        .threshold(128) // Apply threshold for better text extraction
        .resize({ width: 2400 }) // Resize for optimal OCR (300 DPI equivalent)
        .toBuffer();

      // Validate output buffer
      if (!processed || processed.length === 0) {
        throw new Error('Sharp produced empty output buffer');
      }

      return processed;
    } catch (error) {
      logger.warn('Image preprocessing failed:', error);
      // Don't return empty/invalid buffer - throw instead
      if (!imageBuffer || imageBuffer.length < 50) {
        throw new Error('Cannot fall back to invalid original buffer');
      }
      return imageBuffer;
    }
  }

  private async pdfPageToImage(
    pdfPath: string,
    pageIndex: number,
    tempDir: string
  ): Promise<Buffer> {
    try {
      const pageNum = pageIndex + 1;

      // Configure pdf2pic for high-quality conversion
      const options = {
        density: 300, // 300 DPI for high quality OCR
        saveFilename: `page-${pageNum}`,
        savePath: tempDir,
        format: 'png',
        width: 2480, // A4 at 300 DPI
        height: 3508, // A4 at 300 DPI
        compression: 'jpeg', // Use JPEG compression to save memory
        quality: 90, // High quality but compressed
      };

      const convert = fromPath(pdfPath, options);

      // Convert specific page (pdf2pic uses 1-based indexing)
      const result = await convert(pageNum, { responseType: 'buffer' });

      if (!result || !result.buffer) {
        throw new Error(`Failed to convert page ${pageNum} to image: no buffer returned`);
      }

      const buffer = result.buffer as Buffer;

      // CRITICAL: Validate buffer is not empty (prevents tesseract worker crash)
      if (buffer.length === 0) {
        throw new Error(`PDF page ${pageNum} conversion produced empty buffer`);
      }

      // Minimum valid image size check (a 1x1 PNG is ~68 bytes)
      if (buffer.length < 100) {
        throw new Error(
          `PDF page ${pageNum} produced suspiciously small image (${buffer.length} bytes)`
        );
      }

      logger.debug(`Converted PDF page ${pageNum} to image (${buffer.length} bytes)`);

      return buffer;
    } catch (error) {
      logger.error(`Failed to convert PDF page ${pageIndex + 1} to image:`, error);
      throw new Error(`PDF page ${pageIndex + 1} conversion failed: ${error}`);
    }
  }

  async extractStructuredData(text: string): Promise<Record<string, any>> {
    const structuredData: Record<string, any> = {};

    // Extract common patterns
    const patterns = {
      email: /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
      phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
      date: /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})|(\d{4}[-/]\d{1,2}[-/]\d{1,2})/g,
      ssn: /\d{3}-\d{2}-\d{4}/g,
      zipCode: /\b\d{5}(-\d{4})?\b/g,
      currency: /[$€£¥]\s?\d+(?:,\d{3})*(?:\.\d{2})?/g,
      percentage: /\d+(?:\.\d+)?%/g,
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        structuredData[key] = [...new Set(matches)];
      }
    }

    // Extract key-value pairs
    const keyValuePattern = /([A-Za-z\s]+):\s*([^\n]+)/g;
    const keyValueMatches = [...text.matchAll(keyValuePattern)];

    structuredData.fields = {};
    for (const match of keyValueMatches) {
      const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
      const value = match[2].trim();
      structuredData.fields[key] = value;
    }

    return structuredData;
  }

  async enhanceWithOCR(originalText: string, ocrText: string): Promise<string> {
    // Merge original extracted text with OCR results
    // This is useful when PDF has both searchable and scanned content

    if (!originalText || originalText.trim().length < 50) {
      // If original text is minimal, use OCR text
      return ocrText;
    }

    if (!ocrText || ocrText.trim().length < 50) {
      // If OCR text is minimal, use original
      return originalText;
    }

    // Merge both texts, removing duplicates
    const originalLines = originalText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l);
    const ocrLines = ocrText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l);

    const mergedLines = [...new Set([...originalLines, ...ocrLines])];

    return mergedLines.join('\n');
  }

  async cleanup(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.initialized = false;
      logger.info('OCR Service cleaned up');
    }
  }
}
