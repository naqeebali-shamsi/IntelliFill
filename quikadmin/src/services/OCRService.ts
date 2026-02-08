import Tesseract from 'tesseract.js';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';
import sharp from 'sharp';
import { fromPath } from 'pdf2pic';
import * as path from 'path';
import * as os from 'os';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';
import { getFileBuffer, isUrl } from '../utils/fileReader';
import { FEATURE_FLAGS, VLM_CONFIG, COMPLEXITY_THRESHOLDS } from '../config/featureFlags';

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
    /** OCR engine used for extraction */
    engineUsed?: 'tesseract' | 'vlm' | 'hybrid';
    /** Document complexity assessment */
    complexity?: 'simple' | 'complex';
  };
}

/**
 * Bounding box for extracted field location in document
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

/**
 * Result of extracting a single field from OCR text
 * Includes confidence score and source information for transparency
 */
export interface ExtractedFieldResult {
  /** Extracted value - can be string, number, boolean, or null if extraction failed */
  value: string | number | boolean | null;
  /** Confidence score from 0-100 indicating extraction reliability */
  confidence: number;
  /** Source of extraction: ocr (raw text match), pattern (regex), or llm (AI-assisted) */
  source: 'ocr' | 'pattern' | 'llm';
  /** Optional bounding box indicating where the field was found in the document */
  boundingBox?: BoundingBox;
  /** Optional raw text that was matched before normalization */
  rawText?: string;
}

/**
 * Structured data extraction result with per-field confidence scores
 */
export interface StructuredDataResult {
  /** Extracted email addresses with confidence */
  email?: ExtractedFieldResult[];
  /** Extracted phone numbers with confidence */
  phone?: ExtractedFieldResult[];
  /** Extracted dates with confidence */
  date?: ExtractedFieldResult[];
  /** Extracted SSN values with confidence */
  ssn?: ExtractedFieldResult[];
  /** Extracted zip codes with confidence */
  zipCode?: ExtractedFieldResult[];
  /** Extracted currency amounts with confidence */
  currency?: ExtractedFieldResult[];
  /** Extracted percentages with confidence */
  percentage?: ExtractedFieldResult[];
  /** Extracted passport numbers with confidence */
  passport?: ExtractedFieldResult[];
  /** Extracted Emirates ID numbers with confidence */
  emiratesId?: ExtractedFieldResult[];
  /** Key-value pairs extracted from document */
  fields: Record<string, ExtractedFieldResult>;
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
  private static instance: OCRService | null = null;

  /**
   * Get the singleton instance of OCRService.
   * This prevents re-initialization of Tesseract workers on each request.
   */
  static getInstance(): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService();
    }
    return OCRService.instance;
  }

  /**
   * Reset the singleton instance (primarily for testing purposes).
   * This allows tests to get a fresh instance.
   */
  static resetInstance(): void {
    if (OCRService.instance) {
      // Don't await cleanup here to avoid blocking
      OCRService.instance.cleanup().catch((err) => {
        logger.warn('Error during OCRService instance cleanup:', err);
      });
      OCRService.instance = null;
    }
  }

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
      this.worker = await Tesseract.createWorker('eng+ara', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            logger.debug(`OCR Progress: ${(m.progress * 100).toFixed(1)}%`);
          }
        },
      });

      // Configure for better accuracy
      // Note: Using PSM.AUTO instead of PSM.AUTO_OSD to avoid requiring osd.traineddata
      // AUTO_OSD requires the OSD trained data file which may not be available on all deployments
      // NOTE: Removed tessedit_char_whitelist to support Arabic/multilingual documents.
      // The whitelist was ASCII-only, silently dropping Arabic characters from UAE documents.
      await this.worker.setParameters({
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

  // ============================================================================
  // VLM (Vision Language Model) OCR - Phase 1.1
  // ============================================================================

  /**
   * Get Gemini API key from environment
   */
  private getGeminiApiKey(): string {
    const keys = [
      process.env.GEMINI_API_KEY,
      process.env.GOOGLE_API_KEY,
      process.env.GOOGLE_GENERATIVE_AI_KEY,
    ].filter((k): k is string => !!k && k.length > 0);

    if (keys.length === 0) {
      throw new Error('No Gemini API key configured for VLM OCR');
    }

    return keys[0];
  }

  /**
   * Detect document complexity to route between Tesseract and VLM
   *
   * Complex documents (scanned, forms, handwritten) benefit from VLM.
   * Simple documents (digital PDFs with clear text) work well with Tesseract.
   *
   * @param imageBuffer - Image buffer to analyze
   * @param tesseractResult - Optional Tesseract result for comparison
   * @returns 'simple' if Tesseract is sufficient, 'complex' if VLM needed
   */
  async detectDocumentComplexity(
    imageBuffer: Buffer,
    tesseractResult?: { text: string; confidence: number }
  ): Promise<'simple' | 'complex'> {
    // If VLM feature is disabled, always return 'simple' to use Tesseract
    if (!FEATURE_FLAGS.VLM_OCR) {
      return 'simple';
    }

    // If we have Tesseract results, use them for routing
    if (tesseractResult) {
      const textLength = tesseractResult.text.trim().length;
      const confidence = tesseractResult.confidence;

      // High confidence + reasonable text = simple document
      if (
        confidence >= COMPLEXITY_THRESHOLDS.HIGH_OCR_CONFIDENCE &&
        textLength >= COMPLEXITY_THRESHOLDS.SIMPLE_TEXT_DENSITY
      ) {
        logger.debug('Document detected as SIMPLE (high Tesseract confidence)', {
          confidence,
          textLength,
        });
        return 'simple';
      }

      // Low confidence or minimal text = complex document, needs VLM
      if (
        confidence < VLM_CONFIG.CONFIDENCE_THRESHOLD ||
        textLength < VLM_CONFIG.MIN_TEXT_DENSITY_THRESHOLD
      ) {
        logger.debug('Document detected as COMPLEX (low Tesseract confidence)', {
          confidence,
          textLength,
        });
        return 'complex';
      }
    }

    // Without Tesseract results, analyze image characteristics
    try {
      const metadata = await sharp(imageBuffer).metadata();
      const { width, height } = metadata;

      // Very large images often indicate scanned documents
      if (width && height && (width > 2000 || height > 2000)) {
        logger.debug('Document detected as COMPLEX (high resolution scan)', {
          width,
          height,
        });
        return 'complex';
      }

      // Default to simple for routing efficiency
      return 'simple';
    } catch (error) {
      logger.warn('Failed to analyze image for complexity, defaulting to simple:', error);
      return 'simple';
    }
  }

  /**
   * Extract text using Vision Language Model (Gemini Pro Vision)
   *
   * VLMs understand document layout and context, achieving 94%+ accuracy
   * on scanned documents compared to ~85% with traditional OCR.
   *
   * @param imageBuffer - Image buffer to extract text from
   * @returns OCR result with extracted text and confidence
   */
  async extractWithVLM(imageBuffer: Buffer): Promise<{
    text: string;
    confidence: number;
  }> {
    if (!FEATURE_FLAGS.VLM_OCR) {
      throw new Error('VLM OCR feature is not enabled');
    }

    const startTime = Date.now();

    try {
      const apiKey = this.getGeminiApiKey();
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: VLM_CONFIG.MODEL });

      // Convert buffer to base64
      const base64Image = imageBuffer.toString('base64');

      // Detect MIME type from buffer
      const mimeType = await this.detectMimeType(imageBuffer);

      const prompt = `You are an expert document OCR system. Extract ALL text from this document image with the following requirements:

1. PRESERVE the exact structure and layout of the text
2. Maintain line breaks and spacing where meaningful
3. Extract text in reading order (left-to-right, top-to-bottom for English)
4. Include all visible text including:
   - Headers and titles
   - Form field labels AND their values
   - Tables (preserve structure with pipes or tabs)
   - Footnotes and small print
   - Numbers, dates, and IDs
   - Any handwritten text (if legible)

5. For form documents:
   - Extract "Field Label: Field Value" pairs
   - Include checkbox states if visible (checked/unchecked)

6. If text is unclear, make your best interpretation but indicate with [?] if uncertain

Return ONLY the extracted text, no commentary or explanation.`;

      // Call Gemini Vision API with timeout
      const result = await Promise.race([
        model.generateContent([
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: base64Image,
            },
          },
        ]),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`VLM extraction timed out after ${VLM_CONFIG.TIMEOUT_MS}ms`)),
            VLM_CONFIG.TIMEOUT_MS
          )
        ),
      ]);

      const response = result.response;
      const extractedText = response.text();

      const processingTime = Date.now() - startTime;

      // Estimate confidence based on response quality
      // VLM typically has high confidence but we're conservative
      const confidence = this.estimateVLMConfidence(extractedText);

      logger.info('VLM OCR extraction completed', {
        processingTimeMs: processingTime,
        textLength: extractedText.length,
        estimatedConfidence: confidence,
      });

      return {
        text: extractedText,
        confidence,
      };
    } catch (error) {
      logger.error('VLM OCR extraction failed:', error);
      throw error;
    }
  }

  /**
   * Detect MIME type from image buffer
   */
  private async detectMimeType(buffer: Buffer): Promise<string> {
    // Check magic bytes
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return 'image/png';
    }
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return 'image/gif';
    }
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
      return 'image/webp';
    }

    // Default to JPEG
    return 'image/jpeg';
  }

  /**
   * Estimate confidence score for VLM extraction
   *
   * Based on output quality indicators:
   * - Text length (more text = likely successful extraction)
   * - Presence of structured data patterns
   * - Absence of error indicators
   */
  /**
   * Estimate confidence for VLM extraction.
   *
   * IMPORTANT: These are heuristic estimates, NOT model-calibrated probabilities.
   * The score is capped at 85 for heuristic estimates. Future improvement:
   * replace with Gemini response metadata or calibrated logits.
   */
  private estimateVLMConfidence(text: string): number {
    // Start conservative - VLM confidence is inherently uncertain
    let confidence = 60;

    // Text length indicates extraction happened (but not correctness)
    if (text.length > 100) confidence += 5;
    if (text.length > 500) confidence += 5;
    if (text.length > 1000) confidence += 3;

    // Structured patterns suggest real document content
    if (/\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(text)) confidence += 3; // Date pattern
    if (/[A-Z]{1,2}\d{6,9}/.test(text)) confidence += 3; // ID pattern
    if (/\w+:\s*\w+/.test(text)) confidence += 2; // Key:value pattern

    // Penalize for uncertainty markers
    const uncertainCount = (text.match(/\[\?\]/g) || []).length;
    confidence -= uncertainCount * 3;

    // Negative signals
    if (text.length < 20) confidence -= 20; // Suspiciously short
    if (/error|sorry|unable|cannot/i.test(text)) confidence -= 15; // Error response
    if (text.length > 100 && text === text.toUpperCase()) confidence -= 5; // All caps anomaly

    return Math.max(10, Math.min(confidence, 85)); // Cap at 85 for heuristic estimates
  }

  /**
   * Smart OCR extraction with automatic routing between Tesseract and VLM
   *
   * This method provides the best of both worlds:
   * - Fast Tesseract for simple, clear documents
   * - Accurate VLM for complex, scanned, or low-quality documents
   *
   * @param imageBuffer - Image buffer to process
   * @param forceEngine - Optional: force a specific engine ('tesseract' or 'vlm')
   * @returns OCR result with extracted text, confidence, and engine used
   */
  async extractWithSmartRouting(
    imageBuffer: Buffer,
    forceEngine?: 'tesseract' | 'vlm'
  ): Promise<{
    text: string;
    confidence: number;
    engineUsed: 'tesseract' | 'vlm' | 'hybrid';
  }> {
    const startTime = Date.now();

    // If VLM is disabled or Tesseract is forced, use Tesseract only
    if (!FEATURE_FLAGS.VLM_OCR || forceEngine === 'tesseract') {
      await this.initialize();
      const { buffer: processedImage } = await this.preprocessImage(imageBuffer, false);
      const result = await this.worker!.recognize(processedImage);

      logger.debug('Smart routing: Using Tesseract only', {
        processingTimeMs: Date.now() - startTime,
      });

      return {
        text: result.data.text,
        confidence: result.data.confidence,
        engineUsed: 'tesseract',
      };
    }

    // If VLM is forced, use VLM only
    if (forceEngine === 'vlm') {
      const result = await this.extractWithVLM(imageBuffer);
      return {
        ...result,
        engineUsed: 'vlm',
      };
    }

    // Smart routing: Start with Tesseract for quick assessment
    await this.initialize();
    const { buffer: processedImage } = await this.preprocessImage(imageBuffer, false);
    const tesseractResult = await this.worker!.recognize(processedImage);

    const complexity = await this.detectDocumentComplexity(imageBuffer, {
      text: tesseractResult.data.text,
      confidence: tesseractResult.data.confidence,
    });

    // If document is simple, Tesseract result is good enough
    if (complexity === 'simple') {
      logger.debug('Smart routing: Document is simple, using Tesseract result', {
        confidence: tesseractResult.data.confidence,
        processingTimeMs: Date.now() - startTime,
      });

      return {
        text: tesseractResult.data.text,
        confidence: tesseractResult.data.confidence,
        engineUsed: 'tesseract',
      };
    }

    // Complex document: Use VLM
    try {
      const vlmResult = await this.extractWithVLM(imageBuffer);

      // If VLM result is better, use it
      if (vlmResult.confidence > tesseractResult.data.confidence) {
        logger.info('Smart routing: Using VLM result (higher confidence)', {
          vlmConfidence: vlmResult.confidence,
          tesseractConfidence: tesseractResult.data.confidence,
          processingTimeMs: Date.now() - startTime,
        });

        return {
          ...vlmResult,
          engineUsed: 'vlm',
        };
      }

      // If both are close, merge them (hybrid approach)
      if (Math.abs(vlmResult.confidence - tesseractResult.data.confidence) < 10) {
        const mergedText = await this.enhanceWithOCR(tesseractResult.data.text, vlmResult.text);
        const mergedConfidence = Math.max(vlmResult.confidence, tesseractResult.data.confidence);

        logger.info('Smart routing: Using hybrid result (merged)', {
          vlmConfidence: vlmResult.confidence,
          tesseractConfidence: tesseractResult.data.confidence,
          mergedConfidence,
          processingTimeMs: Date.now() - startTime,
        });

        return {
          text: mergedText,
          confidence: mergedConfidence,
          engineUsed: 'hybrid',
        };
      }

      // Fallback to Tesseract if VLM didn't improve
      return {
        text: tesseractResult.data.text,
        confidence: tesseractResult.data.confidence,
        engineUsed: 'tesseract',
      };
    } catch (vlmError) {
      // If VLM fails, fall back to Tesseract
      logger.warn('VLM extraction failed, falling back to Tesseract:', vlmError);

      return {
        text: tesseractResult.data.text,
        confidence: tesseractResult.data.confidence,
        engineUsed: 'tesseract',
      };
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

    try {
      // Get image bytes - either from URL or local file using shared fileReader
      const imageBuffer = await getFileBuffer(imagePathOrUrl);
      if (isUrl(imagePathOrUrl)) {
        logger.info(`Image downloaded (${imageBuffer.length} bytes)`);
      }

      // Use smart routing if VLM is enabled
      if (FEATURE_FLAGS.VLM_OCR) {
        const smartResult = await this.extractWithSmartRouting(imageBuffer);
        const processingTime = Date.now() - startTime;

        // Detect complexity for metadata
        const complexity = await this.detectDocumentComplexity(imageBuffer, {
          text: smartResult.text,
          confidence: smartResult.confidence,
        });

        return {
          text: smartResult.text,
          confidence: smartResult.confidence,
          pages: [
            {
              pageNumber: 1,
              text: smartResult.text,
              confidence: smartResult.confidence,
            },
          ],
          metadata: {
            language: 'eng',
            processingTime,
            pageCount: 1,
            engineUsed: smartResult.engineUsed,
            complexity,
          },
        };
      }

      // Traditional Tesseract-only path
      await this.initialize();

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
          engineUsed: 'tesseract',
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
        .threshold() // Otsu's adaptive threshold - auto-selects optimal value per image
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

  /**
   * Base confidence scores for different pattern types
   * These represent the inherent reliability of each pattern match
   */
  private static readonly PATTERN_BASE_CONFIDENCE: Record<string, number> = {
    email: 95, // Email patterns are highly specific
    phone: 80, // Phone patterns can have false positives
    date: 85, // Date patterns are moderately specific
    ssn: 92, // SSN pattern is very specific (xxx-xx-xxxx)
    zipCode: 85, // Zip codes can match other 5-digit numbers
    currency: 88, // Currency with symbol is fairly specific
    percentage: 82, // Percentages can match other numbers with %
    passport: 90, // Passport numbers have specific formats
    emiratesId: 95, // Emirates ID has very specific format (784-YYYY-XXXXXXX-X)
    keyValue: 75, // Key-value pairs have variable reliability
  };

  /**
   * OCR artifact patterns that reduce confidence when present
   * Only penalize when ambiguous character combinations occur
   * e.g., |l (pipe confused with lowercase L), l1 (L confused with 1), O0 (O confused with zero)
   */
  private static readonly OCR_ARTIFACT_PATTERNS = /(\|l|\|I|l1|1l|O0|0O|lI|Il)/;

  /**
   * Calculate confidence score for an extracted field
   *
   * @param patternType - Type of pattern (email, phone, date, etc.)
   * @param matchedText - The text that was matched
   * @param matchIndex - Index in the original text where match occurred
   * @param fullText - Full OCR text for context analysis
   * @param ocrConfidence - Overall OCR confidence (0-100) to apply as multiplier
   * @returns Calculated confidence score (0-100)
   */
  calculateFieldConfidence(
    patternType: string,
    matchedText: string,
    matchIndex: number,
    fullText: string,
    ocrConfidence: number = 100
  ): number {
    // Get base confidence for this pattern type
    let confidence = OCRService.PATTERN_BASE_CONFIDENCE[patternType] ?? 70;

    // Boost for line-start matches (+5)
    // Fields at the start of a line are more likely to be intentional/structured
    const lineStartRegex = new RegExp(`(^|\\n)\\s*${this.escapeRegex(matchedText)}`, 'm');
    if (lineStartRegex.test(fullText)) {
      confidence += 5;
      logger.debug(`Line-start boost applied for ${patternType}: +5`);
    }

    // Penalize for OCR artifact patterns (-5)
    // Only penalize when ambiguous character combinations are present (e.g., |l, l1, O0)
    if (OCRService.OCR_ARTIFACT_PATTERNS.test(matchedText)) {
      confidence -= 5;
      logger.debug(`OCR artifact penalty applied for ${patternType}: -5`);
    }

    // Apply OCR page confidence as multiplier
    // If overall OCR confidence is low, field extraction confidence should be reduced
    if (ocrConfidence < 100) {
      const ocrMultiplier = ocrConfidence / 100;
      confidence = Math.round(confidence * ocrMultiplier);
      logger.debug(`OCR confidence multiplier applied: ${ocrMultiplier.toFixed(2)}`);
    }

    // Additional pattern-specific adjustments
    confidence = this.applyPatternSpecificAdjustments(patternType, matchedText, confidence);

    // Clamp confidence to valid range
    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * Apply pattern-specific confidence adjustments
   *
   * @param patternType - Type of pattern
   * @param matchedText - The matched text
   * @param baseConfidence - Current confidence score
   * @returns Adjusted confidence score
   */
  private applyPatternSpecificAdjustments(
    patternType: string,
    matchedText: string,
    baseConfidence: number
  ): number {
    let confidence = baseConfidence;

    switch (patternType) {
      case 'email':
        // Higher confidence for common domains
        if (/\.(com|org|net|gov|edu)$/i.test(matchedText)) {
          confidence += 3;
        }
        // Lower confidence for very short local parts
        if (matchedText.split('@')[0].length < 3) {
          confidence -= 5;
        }
        break;

      case 'phone':
        // Higher confidence for complete international format
        if (/^\+\d{1,3}[-.\s]?\d/.test(matchedText)) {
          confidence += 5;
        }
        // Lower confidence for very short phone numbers
        if (matchedText.replace(/\D/g, '').length < 7) {
          confidence -= 10;
        }
        break;

      case 'date':
        // Higher confidence for ISO format (YYYY-MM-DD)
        if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(matchedText)) {
          confidence += 5;
        }
        break;

      case 'passport':
        // Higher confidence for standard passport format (letter + digits)
        if (/^[A-Z]{1,2}\d{6,9}$/i.test(matchedText)) {
          confidence += 5;
        }
        break;

      case 'emiratesId':
        // Emirates ID format: 784-YYYY-XXXXXXX-X
        // Higher confidence for complete format
        if (/^784-\d{4}-\d{7}-\d$/.test(matchedText)) {
          confidence += 3;
        }
        break;
    }

    return confidence;
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Extract structured data from OCR text with per-field confidence scores
   *
   * @param text - OCR extracted text
   * @param ocrConfidence - Optional overall OCR confidence (0-100) to factor into field confidence
   * @returns Structured data with confidence scores for each extracted field
   */
  async extractStructuredData(
    text: string,
    ocrConfidence: number = 100
  ): Promise<StructuredDataResult> {
    const structuredData: StructuredDataResult = {
      fields: {},
    };

    // Pattern definitions with base confidence factors
    const patterns: Record<string, RegExp> = {
      email: /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
      phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
      date: /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})|(\d{4}[-/]\d{1,2}[-/]\d{1,2})/g,
      ssn: /\d{3}-\d{2}-\d{4}/g,
      zipCode: /\b\d{5}(-\d{4})?\b/g,
      currency: /[$€£¥]\s?\d+(?:,\d{3})*(?:\.\d{2})?/g,
      percentage: /\d+(?:\.\d+)?%/g,
      passport: /\b[A-Z]{1,2}\d{6,9}\b/gi,
      emiratesId: /\b784-\d{4}-\d{7}-\d\b/g,
    };

    // Extract matches for each pattern type
    for (const [patternType, pattern] of Object.entries(patterns)) {
      const matches: ExtractedFieldResult[] = [];
      const seenValues = new Set<string>();
      let match: RegExpExecArray | null;

      // Reset regex state for each pattern
      pattern.lastIndex = 0;

      while ((match = pattern.exec(text)) !== null) {
        const matchedText = match[0];

        // Deduplicate matches
        if (seenValues.has(matchedText)) {
          continue;
        }
        seenValues.add(matchedText);

        // Calculate confidence for this specific match
        const confidence = this.calculateFieldConfidence(
          patternType,
          matchedText,
          match.index,
          text,
          ocrConfidence
        );

        matches.push({
          value: matchedText,
          confidence,
          source: 'pattern',
          rawText: matchedText,
        });
      }

      // Only add to result if matches were found
      if (matches.length > 0) {
        (structuredData as any)[patternType] = matches;
      }
    }

    // Extract key-value pairs with confidence
    const keyValuePattern = /([A-Za-z\s]+):\s*([^\n]+)/g;
    let kvMatch: RegExpExecArray | null;

    while ((kvMatch = keyValuePattern.exec(text)) !== null) {
      const key = kvMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
      const value = kvMatch[2].trim();

      // Calculate confidence for key-value extraction
      const confidence = this.calculateFieldConfidence(
        'keyValue',
        value,
        kvMatch.index,
        text,
        ocrConfidence
      );

      structuredData.fields[key] = {
        value,
        confidence,
        source: 'pattern',
        rawText: kvMatch[0],
      };
    }

    logger.debug(
      `Extracted structured data with ${Object.keys(structuredData.fields).length} fields`
    );

    return structuredData;
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use extractStructuredData with ocrConfidence parameter instead
   */
  async extractStructuredDataLegacy(text: string): Promise<Record<string, any>> {
    const structuredData: Record<string, any> = {};

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

/**
 * Singleton instance of OCRService.
 * Use this instead of `new OCRService()` to prevent Tesseract worker re-initialization.
 */
export const ocrService = OCRService.getInstance();
