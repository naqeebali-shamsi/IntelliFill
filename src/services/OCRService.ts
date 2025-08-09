import Tesseract from 'tesseract.js';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';
import sharp from 'sharp';
import { logger } from '../utils/logger';

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
        }
      });
      
      // Configure for better accuracy
      await this.worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,;:!?@#$%&*()-_+=[]{}|\\/<>"\' ',
        preserve_interword_spaces: '1',
        tessedit_pageseg_mode: Tesseract.PSM.AUTO_OSD
      });

      this.initialized = true;
      logger.info('OCR Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize OCR service:', error);
      throw new Error(`OCR initialization failed: ${error}`);
    }
  }

  async processPDF(pdfPath: string): Promise<OCRResult> {
    const startTime = Date.now();
    await this.initialize();

    try {
      const pdfBytes = await fs.readFile(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pageCount = pdfDoc.getPageCount();
      
      const pages: OCRResult['pages'] = [];
      let fullText = '';
      let totalConfidence = 0;

      logger.info(`Starting OCR processing for ${pageCount} pages`);

      for (let i = 0; i < pageCount; i++) {
        const page = pdfDoc.getPage(i);
        
        // Convert PDF page to image
        const imageBuffer = await this.pdfPageToImage(pdfBytes, i);
        
        // Preprocess image for better OCR
        const processedImage = await this.preprocessImage(imageBuffer);
        
        // Perform OCR
        const result = await this.worker!.recognize(processedImage);
        
        pages.push({
          pageNumber: i + 1,
          text: result.data.text,
          confidence: result.data.confidence
        });

        fullText += result.data.text + '\n\n';
        totalConfidence += result.data.confidence;

        logger.debug(`Processed page ${i + 1}/${pageCount} with confidence ${result.data.confidence}%`);
      }

      const processingTime = Date.now() - startTime;

      return {
        text: fullText.trim(),
        confidence: totalConfidence / pageCount,
        pages,
        metadata: {
          language: 'eng',
          processingTime,
          pageCount
        }
      };
    } catch (error) {
      logger.error('OCR processing error:', error);
      throw new Error(`Failed to process PDF with OCR: ${error}`);
    }
  }

  async processImage(imagePath: string): Promise<OCRResult> {
    const startTime = Date.now();
    await this.initialize();

    try {
      // Preprocess image
      const imageBuffer = await fs.readFile(imagePath);
      const processedImage = await this.preprocessImage(imageBuffer);
      
      // Perform OCR
      const result = await this.worker!.recognize(processedImage);
      
      const processingTime = Date.now() - startTime;

      return {
        text: result.data.text,
        confidence: result.data.confidence,
        pages: [{
          pageNumber: 1,
          text: result.data.text,
          confidence: result.data.confidence
        }],
        metadata: {
          language: 'eng',
          processingTime,
          pageCount: 1
        }
      };
    } catch (error) {
      logger.error('Image OCR error:', error);
      throw new Error(`Failed to process image with OCR: ${error}`);
    }
  }

  private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      // Apply image preprocessing for better OCR accuracy
      const processed = await sharp(imageBuffer)
        .greyscale() // Convert to grayscale
        .normalize() // Normalize contrast
        .sharpen() // Sharpen text
        .threshold(128) // Apply threshold for better text extraction
        .resize({ width: 2400 }) // Resize for optimal OCR (300 DPI equivalent)
        .toBuffer();

      return processed;
    } catch (error) {
      logger.warn('Image preprocessing failed, using original:', error);
      return imageBuffer;
    }
  }

  private async pdfPageToImage(pdfBytes: Buffer, pageIndex: number): Promise<Buffer> {
    // This is a simplified version - in production, use pdf2pic or similar
    // For now, we'll return a placeholder that would be replaced with actual PDF rendering
    const placeholderImage = Buffer.from('placeholder');
    
    // In production, you would use:
    // - pdf2pic for PDF to image conversion
    // - or pdfjs with canvas for rendering
    
    logger.warn(`PDF page ${pageIndex} conversion simplified - use pdf2pic in production`);
    return placeholderImage;
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
      percentage: /\d+(?:\.\d+)?%/g
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
    const originalLines = originalText.split('\n').map(l => l.trim()).filter(l => l);
    const ocrLines = ocrText.split('\n').map(l => l.trim()).filter(l => l);
    
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