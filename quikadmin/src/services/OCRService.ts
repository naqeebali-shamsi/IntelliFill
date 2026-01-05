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

/**
 * OCR Service Configuration
 */
export const OCR_SERVICE_CONFIG = {
  /** REQ-010: Feature flag to enable Tesseract OSD (Stage 2) */
  ENABLE_OSD: process.env.ENABLE_TESSERACT_OSD === 'true',
  /** NFR-004: Maximum allowed memory increase for legacy worker (100MB) */
  MAX_LEGACY_MEMORY_DELTA_MB: 100,
};

/**
 * Result from preprocessing with EXIF tracking
 */
export interface PreprocessingResult {
  /** Processed image buffer */
  buffer: Buffer;
  /** Whether EXIF orientation was detected and applied */
  hadExifOrientation: boolean;
}

/**
 * Result from orientation detection (OSD)
 */
export interface OrientationDetectionResult {
  /** Detected orientation in degrees (0, 90, 180, 270) */
  orientation: number;
  /** Detected script type (e.g., 'Latin', 'Cyrillic') */
  script: string;
  /** Confidence of detection (0-100) */
  confidence: number;
}

export class OCRService {
  private worker: Tesseract.Worker | null = null;
  private initialized = false;

  /** REQ-006: Separate legacy worker for OSD (lazy initialized) */
  private legacyWorker: Tesseract.Worker | null = null;
  private legacyInitialized = false;

  /** Memory tracking for NFR-004 compliance */
  private memoryBeforeLegacyInit: number | null = null;

  /**
   * Check if an image buffer has EXIF orientation metadata
   * EXIF orientation values (1-8) indicate how the image should be rotated/flipped.
   * Value 1 means no rotation needed, but EXIF orientation data is still present.
   *
   * @param buffer - Image buffer to check
   * @returns true if EXIF orientation tag exists (value 1-8), false otherwise
   */
  async checkHasExifOrientation(buffer: Buffer): Promise<boolean> {
    if (!buffer || buffer.length === 0) {
      return false;
    }

    try {
      const metadata = await sharp(buffer).metadata();
      // EXIF orientation values are 1-8
      // 1 = no rotation needed, but orientation data exists
      // 2-8 = various rotations/flips needed
      const hasOrientation =
        typeof metadata.orientation === 'number' &&
        metadata.orientation >= 1 &&
        metadata.orientation <= 8;

      if (hasOrientation) {
        logger.debug(`EXIF orientation detected: ${metadata.orientation}`);
      }

      return hasOrientation;
    } catch (error) {
      // Graceful fallback: if we can't read metadata, assume no EXIF
      logger.debug('Failed to read EXIF metadata:', error);
      return false;
    }
  }

  /**
   * Auto-orient buffer based on EXIF metadata (REQ-001, REQ-002)
   * Sharp's rotate() with no args reads EXIF orientation tags (1-8)
   * and auto-rotates the image, then removes the tag to prevent double-rotation.
   * Handles invalid EXIF gracefully per NFR-005.
   *
   * @param buffer - Input image buffer
   * @returns PreprocessingResult with buffer and hadExifOrientation flag
   */
  async autoOrientBuffer(buffer: Buffer): Promise<PreprocessingResult> {
    if (!buffer || buffer.length === 0) {
      return { buffer, hadExifOrientation: false };
    }

    try {
      // Check for EXIF orientation BEFORE rotation
      const hadExifOrientation = await this.checkHasExifOrientation(buffer);

      const start = Date.now();
      const oriented = await sharp(buffer, { failOn: 'none' })
        .rotate() // Auto-orient based on EXIF metadata
        .toBuffer();
      const elapsed = Date.now() - start;

      // Log timing per NFR-002 (target <10ms)
      if (elapsed > 10) {
        logger.debug(`EXIF auto-rotation took ${elapsed}ms (exceeds 10ms target)`);
      } else {
        logger.debug(`EXIF auto-rotation completed in ${elapsed}ms`);
      }

      return { buffer: oriented, hadExifOrientation };
    } catch (error) {
      // Graceful fallback per NFR-005: return original if orientation fails
      logger.debug('EXIF auto-rotation skipped (no EXIF or error):', error);
      return { buffer, hadExifOrientation: false };
    }
  }

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

  /**
   * Check if OSD feature is enabled (REQ-010)
   * @returns true if ENABLE_TESSERACT_OSD=true in environment
   */
  isOSDEnabled(): boolean {
    return OCR_SERVICE_CONFIG.ENABLE_OSD;
  }

  /**
   * Get current memory usage in MB
   * Used for NFR-004 memory monitoring
   */
  private getMemoryUsageMB(): number {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024);
  }

  /**
   * REQ-006: Initialize legacy Tesseract worker for OSD (Orientation Script Detection)
   * Lazy initialization - only called when OSD is actually needed.
   * Requires legacyCore and legacyLang for worker.detect() support.
   *
   * @throws Error if OSD is not enabled or initialization fails
   * @throws Error if memory increase exceeds NFR-004 limit (100MB)
   */
  async initializeLegacyWorker(): Promise<void> {
    // Check feature flag first
    if (!OCR_SERVICE_CONFIG.ENABLE_OSD) {
      throw new Error('Tesseract OSD is not enabled. Set ENABLE_TESSERACT_OSD=true to enable.');
    }

    if (this.legacyInitialized) return;

    try {
      // NFR-004: Track memory before initialization
      this.memoryBeforeLegacyInit = this.getMemoryUsageMB();
      logger.info(
        `Starting legacy Tesseract worker initialization. Memory before: ${this.memoryBeforeLegacyInit}MB`
      );

      // REQ-006: Create worker with legacy support for OSD
      // IMPORTANT: OSD detection requires 'osd' traineddata, NOT 'eng'
      // Tesseract.js will automatically download osd.traineddata.gz from CDN
      this.legacyWorker = await Tesseract.createWorker('osd', 1, {
        legacyCore: true,
        legacyLang: true,
        logger: (m: any) => {
          if (m.status) {
            logger.debug(
              `Tesseract Legacy: ${m.status} ${m.progress ? `${(m.progress * 100).toFixed(1)}%` : ''}`
            );
          }
        },
      });

      this.legacyInitialized = true;

      // NFR-004: Check memory increase
      const memoryAfter = this.getMemoryUsageMB();
      const memoryDelta = memoryAfter - this.memoryBeforeLegacyInit;

      logger.info(
        `Legacy Tesseract worker initialized. Memory after: ${memoryAfter}MB (delta: ${memoryDelta}MB)`
      );

      if (memoryDelta > OCR_SERVICE_CONFIG.MAX_LEGACY_MEMORY_DELTA_MB) {
        logger.warn(
          `Legacy worker memory increase (${memoryDelta}MB) exceeds NFR-004 limit (${OCR_SERVICE_CONFIG.MAX_LEGACY_MEMORY_DELTA_MB}MB)`
        );
      }
    } catch (error) {
      logger.error('Failed to initialize legacy Tesseract worker:', error);
      throw new Error(`Legacy Tesseract initialization failed: ${error}`);
    }
  }

  /**
   * Check if legacy worker is ready for OSD
   */
  isLegacyWorkerReady(): boolean {
    return this.legacyInitialized && this.legacyWorker !== null;
  }

  /**
   * Get memory delta from legacy worker initialization (for monitoring)
   * @returns Memory increase in MB, or null if not yet initialized
   */
  getLegacyWorkerMemoryDelta(): number | null {
    if (this.memoryBeforeLegacyInit === null || !this.legacyInitialized) {
      return null;
    }
    return this.getMemoryUsageMB() - this.memoryBeforeLegacyInit;
  }

  /**
   * REQ-007: Detect document orientation using Tesseract OSD
   * Uses the legacy worker's detect() method to determine rotation angle.
   *
   * @param buffer - Image buffer to analyze
   * @returns Orientation detection result with angle (0, 90, 180, 270) and script type
   * @throws Error if OSD is not enabled or legacy worker not initialized
   */
  async detectOrientation(buffer: Buffer): Promise<OrientationDetectionResult> {
    // Validate input buffer (REQ-003 style validation)
    if (!buffer || buffer.length === 0) {
      logger.warn('detectOrientation called with empty buffer');
      return { orientation: 0, script: 'unknown', confidence: 0 };
    }

    // Minimum valid image size (a 1x1 PNG is ~68 bytes)
    if (buffer.length < 50) {
      logger.warn(`detectOrientation: buffer too small (${buffer.length} bytes)`);
      return { orientation: 0, script: 'unknown', confidence: 0 };
    }

    // Check feature flag
    if (!OCR_SERVICE_CONFIG.ENABLE_OSD) {
      throw new Error('Tesseract OSD is not enabled. Set ENABLE_TESSERACT_OSD=true to enable.');
    }

    // Ensure legacy worker is initialized (lazy init)
    if (!this.legacyInitialized) {
      await this.initializeLegacyWorker();
    }

    if (!this.legacyWorker) {
      throw new Error('Legacy Tesseract worker not available for OSD');
    }

    try {
      const start = Date.now();

      // Call Tesseract OSD detection
      const result = await this.legacyWorker.detect(buffer);

      const elapsed = Date.now() - start;
      logger.debug(`OSD detection completed in ${elapsed}ms`);

      // Tesseract returns orientation_degrees directly (0, 90, 180, 270)
      // and orientation_confidence as a percentage
      const orientation = result.data?.orientation_degrees ?? 0;
      const script = result.data?.script ?? 'unknown';
      const confidence = result.data?.orientation_confidence ?? 0;

      logger.info(
        `OSD detected orientation: ${orientation}°, script: ${script}, confidence: ${confidence}%`
      );

      return { orientation, script, confidence };
    } catch (error) {
      // NFR-005: Graceful fallback on detection failure
      logger.warn('OSD detection failed, returning default orientation (0°):', error);
      return { orientation: 0, script: 'unknown', confidence: 0 };
    }
  }

  /**
   * Rotate an image buffer by the specified degrees
   * Used after OSD detection to correct document orientation.
   *
   * @param buffer - Image buffer to rotate
   * @param degrees - Rotation angle (0, 90, 180, 270)
   * @returns Rotated image buffer
   */
  async rotateBuffer(buffer: Buffer, degrees: number): Promise<Buffer> {
    if (!buffer || buffer.length === 0) {
      return buffer;
    }

    // Only rotate if degrees is non-zero
    if (degrees === 0) {
      return buffer;
    }

    // Validate degrees (must be 0, 90, 180, or 270)
    if (![0, 90, 180, 270].includes(degrees)) {
      logger.warn(
        `Invalid rotation degrees: ${degrees}. Must be 0, 90, 180, or 270. Returning original.`
      );
      return buffer;
    }

    try {
      const start = Date.now();
      const rotated = await sharp(buffer).rotate(degrees).toBuffer();
      const elapsed = Date.now() - start;
      logger.debug(`Rotated image by ${degrees}° in ${elapsed}ms`);
      return rotated;
    } catch (error) {
      logger.warn(`Failed to rotate image by ${degrees}°:`, error);
      return buffer;
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

        // Preprocess image for better OCR (scanned PDF = true for OSD detection)
        const { buffer: processedImage } = await this.preprocessImage(imageBuffer, true);

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

      // Preprocess image (standalone image, not from scanned PDF)
      const { buffer: processedImage } = await this.preprocessImage(imageBuffer, false);

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

  /**
   * Preprocess an image buffer for OCR
   * Includes EXIF auto-orientation and optional OSD-based rotation
   *
   * @param imageBuffer - Raw image buffer
   * @param isFromScannedPdf - Whether this image came from a scanned PDF page
   * @returns PreprocessingResult with processed buffer and EXIF tracking
   */
  private async preprocessImage(
    imageBuffer: Buffer,
    isFromScannedPdf: boolean = false
  ): Promise<PreprocessingResult> {
    // CRITICAL: Validate input buffer to prevent tesseract worker crashes
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Cannot preprocess empty image buffer');
    }

    // Minimum valid image size (a 1x1 PNG is ~68 bytes)
    if (imageBuffer.length < 50) {
      throw new Error(`Image buffer too small (${imageBuffer.length} bytes)`);
    }

    try {
      // Stage 1: EXIF auto-orientation (REQ-001, REQ-002)
      // Uses reusable helper function for consistent handling
      const { buffer: orientedBuffer, hadExifOrientation } =
        await this.autoOrientBuffer(imageBuffer);

      // Stage 2: OSD-based rotation for scanned PDFs without EXIF (REQ-008)
      // Only run OSD if: feature enabled AND scanned PDF AND no EXIF was applied
      let finalBuffer = orientedBuffer;
      if (OCR_SERVICE_CONFIG.ENABLE_OSD && isFromScannedPdf && !hadExifOrientation) {
        logger.debug('Running OSD detection for scanned PDF without EXIF');
        try {
          const osdResult = await this.detectOrientation(orientedBuffer);

          if (osdResult.orientation !== 0 && osdResult.confidence > 50) {
            logger.info(
              `OSD detected ${osdResult.orientation}° rotation with ${osdResult.confidence}% confidence`
            );
            finalBuffer = await this.rotateBuffer(orientedBuffer, osdResult.orientation);
          } else {
            logger.debug(
              `OSD: No rotation needed (${osdResult.orientation}° with ${osdResult.confidence}% confidence)`
            );
          }
        } catch (osdError) {
          // NFR-005: Graceful fallback - continue without OSD rotation
          logger.warn('OSD detection failed, continuing without rotation:', osdError);
        }
      }

      // Apply image preprocessing for better OCR accuracy
      const processed = await sharp(finalBuffer)
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

      return { buffer: processed, hadExifOrientation };
    } catch (error) {
      logger.warn('Image preprocessing failed:', error);
      // Don't return empty/invalid buffer - throw instead
      if (!imageBuffer || imageBuffer.length < 50) {
        throw new Error('Cannot fall back to invalid original buffer');
      }
      // Graceful fallback per NFR-005: return original if orientation fails
      return { buffer: imageBuffer, hadExifOrientation: false };
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

      // Apply auto-orientation per REQ-002 (consistent across all paths)
      // Note: pdf2pic-generated images typically don't have EXIF, but this ensures
      // consistent handling if source PDF contains embedded images with EXIF data
      // We don't do OSD here - it will be done in preprocessImage() for scanned PDFs
      const { buffer: orientedBuffer } = await this.autoOrientBuffer(buffer);

      return orientedBuffer;
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
    const cleanupTasks: Promise<void>[] = [];

    if (this.worker) {
      cleanupTasks.push(
        this.worker.terminate().then(() => {
          this.worker = null;
          this.initialized = false;
        })
      );
    }

    // Also cleanup legacy worker if initialized
    if (this.legacyWorker) {
      cleanupTasks.push(
        this.legacyWorker.terminate().then(() => {
          this.legacyWorker = null;
          this.legacyInitialized = false;
          this.memoryBeforeLegacyInit = null;
        })
      );
    }

    if (cleanupTasks.length > 0) {
      await Promise.all(cleanupTasks);
      logger.info('OCR Service cleaned up');
    }
  }
}
