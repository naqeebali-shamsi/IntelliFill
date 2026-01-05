/**
 * Document Extraction Service
 *
 * Service for extracting text content from various document formats.
 * Implements requirements from PRD Vector Search v2.0:
 * - REQ-EXT-001: Extract text from PDF with >95% accuracy
 * - REQ-EXT-002: OCR extraction for scanned documents
 * - REQ-EXT-003: Preserve document structure metadata
 * - REQ-EXT-004: Handle documents up to 50 pages / 10MB
 * - REQ-EXT-005: Process documents asynchronously
 *
 * Integrates with FileValidationService for security validation.
 *
 * @module services/documentExtraction.service
 */

import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import Tesseract from 'tesseract.js';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger';
import { fileValidationService, FileValidationResult, FILE_LIMITS } from './fileValidation.service';
import { memoryManager } from './memoryManager.service';
import { getFileBuffer, isUrl } from '../utils/fileReader';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface PageContent {
  pageNumber: number;
  text: string;
  wordCount: number;
  ocrUsed: boolean;
  confidence?: number;
}

export interface DocumentMetadata {
  filename: string;
  mimeType: string;
  pageCount: number;
  totalWordCount: number;
  extractedAt: Date;
  ocrUsed: boolean;
  language?: string;
  title?: string;
  author?: string;
  creationDate?: Date;
  extractionTimeMs: number;
}

export interface ExtractionResult {
  text: string;
  pages: PageContent[];
  metadata: DocumentMetadata;
  confidence: number;
  warnings: string[];
}

export interface ExtractionOptions {
  maxPages?: number;
  ocrEnabled?: boolean;
  language?: string;
  preserveFormatting?: boolean;
  timeout?: number;
}

export type SupportedMimeType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'text/plain'
  | 'image/jpeg'
  | 'image/png'
  | 'image/tiff';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: ExtractionOptions = {
  maxPages: FILE_LIMITS.MAX_PAGES,
  ocrEnabled: true,
  language: 'eng',
  preserveFormatting: false,
  timeout: FILE_LIMITS.MAX_EXTRACTION_TIME,
};

const MIN_TEXT_LENGTH_FOR_OCR = 50; // Characters per page before considering OCR
const OCR_CONFIDENCE_THRESHOLD = 60; // Minimum confidence to use OCR result

// ============================================================================
// Document Extraction Service Class
// ============================================================================

export class DocumentExtractionService {
  private tesseractWorker: Tesseract.Worker | null = null;
  private workerInitialized = false;

  /**
   * Extract text from a document buffer
   *
   * @param buffer - Document file buffer
   * @param filename - Original filename
   * @param mimeType - Document MIME type (optional, will be detected)
   * @param options - Extraction options
   * @returns Extraction result with text, pages, and metadata
   */
  async extract(
    buffer: Buffer,
    filename: string,
    mimeType?: string,
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const warnings: string[] = [];

    // Step 1: Validate file security
    const validation = await this.validateFile(buffer, filename, mimeType);
    if (!validation.isValid) {
      throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
    }

    // Add any security warnings
    if (validation.securityFlags.length > 0) {
      warnings.push(...validation.securityFlags.map((f) => `Security flag: ${f}`));
    }

    const detectedMimeType = validation.detectedMimeType || mimeType || 'application/octet-stream';
    const sanitizedFilename = validation.sanitizedFilename;

    // Step 2: Check memory before processing
    const memoryCheck = memoryManager.checkMemory();
    if (!memoryCheck.allowed) {
      throw new Error('System under high load. Please try again later.');
    }

    // Step 3: Extract based on MIME type
    let result: ExtractionResult;

    try {
      switch (detectedMimeType) {
        case 'application/pdf':
          result = await this.extractPDF(buffer, sanitizedFilename, opts, warnings);
          break;

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          result = await this.extractDOCX(buffer, sanitizedFilename, opts, warnings);
          break;

        case 'text/plain':
          result = await this.extractText(buffer, sanitizedFilename, opts, warnings);
          break;

        case 'image/jpeg':
        case 'image/png':
        case 'image/tiff':
          if (!opts.ocrEnabled) {
            throw new Error('OCR is disabled but image file requires OCR extraction');
          }
          result = await this.extractImage(
            buffer,
            sanitizedFilename,
            detectedMimeType,
            opts,
            warnings
          );
          break;

        default:
          throw new Error(`Unsupported document type: ${detectedMimeType}`);
      }

      // Update metadata with extraction time
      result.metadata.extractionTimeMs = Date.now() - startTime;
      result.metadata.mimeType = detectedMimeType;

      logger.info('Document extraction completed', {
        filename: sanitizedFilename,
        mimeType: detectedMimeType,
        pageCount: result.metadata.pageCount,
        wordCount: result.metadata.totalWordCount,
        extractionTimeMs: result.metadata.extractionTimeMs,
        ocrUsed: result.metadata.ocrUsed,
      });

      return result;
    } catch (error) {
      logger.error('Document extraction failed', {
        filename: sanitizedFilename,
        mimeType: detectedMimeType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // ==========================================================================
  // PDF Extraction
  // ==========================================================================

  /**
   * Extract text from PDF document
   */
  private async extractPDF(
    buffer: Buffer,
    filename: string,
    options: ExtractionOptions,
    warnings: string[]
  ): Promise<ExtractionResult> {
    const pages: PageContent[] = [];
    let ocrUsed = false;
    let totalConfidence = 0;
    let confidenceCount = 0;

    try {
      // First attempt: Extract text directly
      const pdfData = await pdfParse(buffer, {
        max: options.maxPages,
      });

      // Check if we have meaningful text
      const hasText = pdfData.text && pdfData.text.trim().length > MIN_TEXT_LENGTH_FOR_OCR;

      if (hasText) {
        // Parse text into pages (pdf-parse gives us page count but not per-page text)
        // We'll split by common page break patterns
        const pageTexts = this.splitPDFTextIntoPages(pdfData.text, pdfData.numpages);

        for (let i = 0; i < pageTexts.length; i++) {
          const pageText = pageTexts[i];
          pages.push({
            pageNumber: i + 1,
            text: pageText,
            wordCount: this.countWords(pageText),
            ocrUsed: false,
          });
        }

        totalConfidence = 95; // High confidence for text-based PDFs
        confidenceCount = 1;
      } else if (options.ocrEnabled) {
        // Scanned PDF - need OCR
        warnings.push('PDF appears to be scanned, using OCR');
        ocrUsed = true;

        // For scanned PDFs, we need to convert to images and OCR each page
        // This is a simplified implementation - in production, use pdf2pic
        const ocrResult = await this.ocrBuffer(buffer, options.language || 'eng');

        pages.push({
          pageNumber: 1,
          text: ocrResult.text,
          wordCount: this.countWords(ocrResult.text),
          ocrUsed: true,
          confidence: ocrResult.confidence,
        });

        totalConfidence = ocrResult.confidence;
        confidenceCount = 1;
      } else {
        throw new Error('PDF appears to be scanned but OCR is disabled');
      }

      // Extract metadata
      const metadata: DocumentMetadata = {
        filename,
        mimeType: 'application/pdf',
        pageCount: pdfData.numpages,
        totalWordCount: pages.reduce((sum, p) => sum + p.wordCount, 0),
        extractedAt: new Date(),
        ocrUsed,
        title: pdfData.info?.Title || undefined,
        author: pdfData.info?.Author || undefined,
        creationDate: pdfData.info?.CreationDate
          ? this.parsePDFDate(pdfData.info.CreationDate)
          : undefined,
        extractionTimeMs: 0, // Will be set by caller
      };

      return {
        text: pages.map((p) => p.text).join('\n\n'),
        pages,
        metadata,
        confidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
        warnings,
      };
    } catch (error) {
      logger.error('PDF extraction error', {
        filename,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to extract PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Split PDF text into pages using heuristics
   */
  private splitPDFTextIntoPages(text: string, pageCount: number): string[] {
    if (pageCount <= 1) {
      return [text];
    }

    // Try to split by form feed character (common in PDFs)
    const formFeedSplit = text.split('\f');
    if (formFeedSplit.length === pageCount) {
      return formFeedSplit.map((t) => t.trim());
    }

    // Try to split by page break patterns
    const pageBreakPattern = /\n\s*\d+\s*\n/g;
    const patternSplit = text.split(pageBreakPattern);
    if (patternSplit.length >= pageCount) {
      return patternSplit.slice(0, pageCount).map((t) => t.trim());
    }

    // Fallback: Split evenly
    const avgLength = Math.ceil(text.length / pageCount);
    const pages: string[] = [];

    for (let i = 0; i < pageCount; i++) {
      const start = i * avgLength;
      const end = Math.min(start + avgLength, text.length);

      // Try to split at sentence boundary
      let pageText = text.substring(start, end);
      if (i < pageCount - 1 && end < text.length) {
        const lastSentenceEnd = pageText.search(/[.!?]\s*$/);
        if (lastSentenceEnd > avgLength * 0.5) {
          pageText = pageText.substring(0, lastSentenceEnd + 1);
        }
      }

      pages.push(pageText.trim());
    }

    return pages;
  }

  /**
   * Parse PDF date format
   */
  private parsePDFDate(dateString: string): Date | undefined {
    try {
      // PDF date format: D:YYYYMMDDHHmmSSOHH'mm'
      const match = dateString.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
      if (match) {
        const [, year, month, day, hour = '00', min = '00', sec = '00'] = match;
        return new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(min),
          parseInt(sec)
        );
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  // ==========================================================================
  // DOCX Extraction
  // ==========================================================================

  /**
   * Extract text from DOCX document
   */
  private async extractDOCX(
    buffer: Buffer,
    filename: string,
    options: ExtractionOptions,
    warnings: string[]
  ): Promise<ExtractionResult> {
    try {
      const result = await mammoth.extractRawText({ buffer });

      if (result.messages.length > 0) {
        warnings.push(...result.messages.map((m) => `DOCX warning: ${m.message}`));
      }

      const text = result.value;
      const wordCount = this.countWords(text);

      // DOCX doesn't have clear page boundaries in text extraction
      // Estimate pages based on word count (avg ~300 words per page)
      const estimatedPages = Math.max(1, Math.ceil(wordCount / 300));

      const pages: PageContent[] = [];
      if (estimatedPages === 1) {
        pages.push({
          pageNumber: 1,
          text,
          wordCount,
          ocrUsed: false,
        });
      } else {
        // Split into estimated pages
        const wordsPerPage = Math.ceil(wordCount / estimatedPages);
        const words = text.split(/\s+/);

        for (let i = 0; i < estimatedPages; i++) {
          const start = i * wordsPerPage;
          const end = Math.min(start + wordsPerPage, words.length);
          const pageText = words.slice(start, end).join(' ');

          pages.push({
            pageNumber: i + 1,
            text: pageText,
            wordCount: end - start,
            ocrUsed: false,
          });
        }
      }

      const metadata: DocumentMetadata = {
        filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        pageCount: estimatedPages,
        totalWordCount: wordCount,
        extractedAt: new Date(),
        ocrUsed: false,
        extractionTimeMs: 0,
      };

      return {
        text,
        pages,
        metadata,
        confidence: 95, // High confidence for DOCX
        warnings,
      };
    } catch (error) {
      logger.error('DOCX extraction error', {
        filename,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to extract DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ==========================================================================
  // Plain Text Extraction
  // ==========================================================================

  /**
   * Extract text from plain text file
   */
  private async extractText(
    buffer: Buffer,
    filename: string,
    options: ExtractionOptions,
    warnings: string[]
  ): Promise<ExtractionResult> {
    try {
      // Detect encoding - assume UTF-8 for now
      const text = buffer.toString('utf-8');
      const wordCount = this.countWords(text);

      // Estimate pages based on word count
      const estimatedPages = Math.max(1, Math.ceil(wordCount / 300));

      const pages: PageContent[] = [
        {
          pageNumber: 1,
          text,
          wordCount,
          ocrUsed: false,
        },
      ];

      const metadata: DocumentMetadata = {
        filename,
        mimeType: 'text/plain',
        pageCount: estimatedPages,
        totalWordCount: wordCount,
        extractedAt: new Date(),
        ocrUsed: false,
        extractionTimeMs: 0,
      };

      return {
        text,
        pages,
        metadata,
        confidence: 100, // Perfect confidence for plain text
        warnings,
      };
    } catch (error) {
      logger.error('Text extraction error', {
        filename,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ==========================================================================
  // Image OCR Extraction
  // ==========================================================================

  /**
   * Extract text from image using OCR
   */
  private async extractImage(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    options: ExtractionOptions,
    warnings: string[]
  ): Promise<ExtractionResult> {
    try {
      const ocrResult = await this.ocrBuffer(buffer, options.language || 'eng');

      if (ocrResult.confidence < OCR_CONFIDENCE_THRESHOLD) {
        warnings.push(`Low OCR confidence (${ocrResult.confidence.toFixed(1)}%)`);
      }

      const wordCount = this.countWords(ocrResult.text);

      const pages: PageContent[] = [
        {
          pageNumber: 1,
          text: ocrResult.text,
          wordCount,
          ocrUsed: true,
          confidence: ocrResult.confidence,
        },
      ];

      const metadata: DocumentMetadata = {
        filename,
        mimeType,
        pageCount: 1,
        totalWordCount: wordCount,
        extractedAt: new Date(),
        ocrUsed: true,
        language: options.language,
        extractionTimeMs: 0,
      };

      return {
        text: ocrResult.text,
        pages,
        metadata,
        confidence: ocrResult.confidence,
        warnings,
      };
    } catch (error) {
      logger.error('Image OCR error', {
        filename,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to OCR image: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Perform OCR on a buffer
   */
  private async ocrBuffer(
    buffer: Buffer,
    language: string
  ): Promise<{ text: string; confidence: number }> {
    try {
      // Initialize worker if not already done
      if (!this.tesseractWorker) {
        this.tesseractWorker = await Tesseract.createWorker(language);
        this.workerInitialized = true;
      }

      const result = await this.tesseractWorker.recognize(buffer);

      return {
        text: result.data.text,
        confidence: result.data.confidence,
      };
    } catch (error) {
      logger.error('Tesseract OCR error', { error });
      throw error;
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Validate file using FileValidationService
   */
  private async validateFile(
    buffer: Buffer,
    filename: string,
    declaredMimeType?: string
  ): Promise<FileValidationResult> {
    return fileValidationService.validateFile(buffer, filename, declaredMimeType);
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    if (!text || text.trim().length === 0) {
      return 0;
    }
    return text.trim().split(/\s+/).length;
  }

  /**
   * Extract text from file path or R2 URL (convenience method)
   *
   * @param pathOrUrl - Local file path or R2 URL
   * @param options - Extraction options
   */
  async extractFromPath(
    pathOrUrl: string,
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    // Use shared fileReader utility for both local paths and R2 URLs
    const buffer = await getFileBuffer(pathOrUrl);

    // Extract filename from path or URL
    let filename: string;
    if (isUrl(pathOrUrl)) {
      // For URLs, extract filename from the path portion
      const url = new URL(pathOrUrl);
      filename = path.basename(url.pathname) || 'document';
    } else {
      filename = path.basename(pathOrUrl);
    }

    return this.extract(buffer, filename, undefined, options);
  }

  /**
   * Check if MIME type is supported
   */
  isSupported(mimeType: string): boolean {
    const supportedTypes: string[] = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/tiff',
    ];
    return supportedTypes.includes(mimeType);
  }

  /**
   * Get supported MIME types
   */
  getSupportedTypes(): string[] {
    return [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/tiff',
    ];
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate();
      this.tesseractWorker = null;
      this.workerInitialized = false;
      logger.info('Tesseract worker terminated');
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const documentExtractionService = new DocumentExtractionService();

// ============================================================================
// Process cleanup handlers
// ============================================================================

process.on('SIGTERM', async () => {
  await documentExtractionService.cleanup();
});

process.on('SIGINT', async () => {
  await documentExtractionService.cleanup();
});

export default documentExtractionService;
