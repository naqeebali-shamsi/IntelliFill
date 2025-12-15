/**
 * Chunking Service
 *
 * Service for splitting documents into semantic chunks for vector embedding.
 * Implements requirements from PRD Vector Search v2.0:
 * - REQ-CHK-001: Semantic chunking with sentence boundaries
 * - REQ-CHK-002: Target 400 tokens, 15% overlap (60 tokens)
 * - REQ-CHK-003: Preserve metadata (page numbers, section headers)
 * - REQ-CHK-004: Character-based estimation (4 chars/token)
 * - REQ-CHK-005: Handle edge cases (short docs, single-page, tables)
 * - REQ-CHK-006: Document-type-specific configurations
 *
 * @module services/chunking.service
 */

import crypto from 'crypto';
import { logger } from '../utils/logger';
import { PageContent, ExtractionResult } from './documentExtraction.service';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type ChunkingStrategy = 'semantic' | 'fixed' | 'hybrid';

export interface ChunkingConfig {
  strategy: ChunkingStrategy;
  targetChunkSize: number;      // Target tokens per chunk
  maxChunkSize: number;         // Maximum tokens per chunk
  minChunkSize: number;         // Minimum tokens per chunk
  overlapTokens: number;        // Overlap between chunks
  preserveSentences: boolean;   // Try to preserve sentence boundaries
  charsPerToken: number;        // Characters per token (estimation)
}

export interface ChunkMetadata {
  pageNumber?: number;
  sectionHeader?: string;
  startChar: number;
  endChar: number;
  isOverlap: boolean;
}

export interface DocumentChunk {
  text: string;
  tokenCount: number;
  chunkIndex: number;
  metadata: ChunkMetadata;
  textHash: string;
}

export interface ChunkingResult {
  chunks: DocumentChunk[];
  totalChunks: number;
  totalTokens: number;
  avgTokensPerChunk: number;
  duplicatesRemoved: number;
  config: ChunkingConfig;
}

export type DocumentType =
  | 'PASSPORT'
  | 'DRIVERS_LICENSE'
  | 'BANK_STATEMENT'
  | 'TAX_FORM'
  | 'INVOICE'
  | 'CONTRACT'
  | 'DEFAULT';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default chunking configuration
 * Based on PRD requirements for optimal embedding performance
 */
const DEFAULT_CONFIG: ChunkingConfig = {
  strategy: 'hybrid',
  targetChunkSize: 400,         // Conservative target for Google text-embedding-004
  maxChunkSize: 800,            // Safety margin under 8192 token limit
  minChunkSize: 100,            // Minimum meaningful chunk
  overlapTokens: 60,            // 15% overlap
  preserveSentences: true,
  charsPerToken: 4,             // Character-based estimation for English
};

/**
 * Document-type-specific chunking configurations
 * Different document types benefit from different strategies
 */
const DOCUMENT_TYPE_CONFIGS: Record<DocumentType, Partial<ChunkingConfig>> = {
  PASSPORT: {
    strategy: 'fixed',
    targetChunkSize: 200,        // Small chunks for structured data
    maxChunkSize: 400,
    preserveSentences: false,    // Structured data doesn't have sentences
  },
  DRIVERS_LICENSE: {
    strategy: 'fixed',
    targetChunkSize: 200,
    maxChunkSize: 400,
    preserveSentences: false,
  },
  BANK_STATEMENT: {
    strategy: 'semantic',
    targetChunkSize: 500,        // Larger for transaction groups
    maxChunkSize: 1000,
    overlapTokens: 75,           // More overlap for context
  },
  TAX_FORM: {
    strategy: 'hybrid',
    targetChunkSize: 400,
    preserveSentences: true,
  },
  INVOICE: {
    strategy: 'semantic',
    targetChunkSize: 300,
    maxChunkSize: 600,
  },
  CONTRACT: {
    strategy: 'semantic',
    targetChunkSize: 500,        // Longer for legal paragraphs
    maxChunkSize: 1000,
    overlapTokens: 100,          // More overlap for legal context
  },
  DEFAULT: {},                   // Use default config
};

// Sentence boundary patterns
const SENTENCE_ENDINGS = /[.!?][\s\n]+/g;
const PARAGRAPH_ENDINGS = /\n\n+/g;
const SECTION_HEADER_PATTERN = /^(?:#{1,6}\s+.+|\d+\.\s+.+|[A-Z][A-Z\s]+:)/gm;

// ============================================================================
// Chunking Service Class
// ============================================================================

export class ChunkingService {
  private config: ChunkingConfig;

  constructor(config: Partial<ChunkingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Chunk extracted document content
   * Main entry point for chunking pipeline
   *
   * @param extractionResult - Result from DocumentExtractionService
   * @param documentType - Optional document type for specialized chunking
   * @returns Chunking result with all chunks and metadata
   */
  chunkDocument(
    extractionResult: ExtractionResult,
    documentType: DocumentType = 'DEFAULT'
  ): ChunkingResult {
    const startTime = Date.now();
    const config = this.getConfigForDocumentType(documentType);

    logger.info('Starting document chunking', {
      documentType,
      strategy: config.strategy,
      pageCount: extractionResult.metadata.pageCount,
      totalWords: extractionResult.metadata.totalWordCount,
    });

    let chunks: DocumentChunk[];

    switch (config.strategy) {
      case 'semantic':
        chunks = this.chunkSemantic(extractionResult, config);
        break;
      case 'fixed':
        chunks = this.chunkFixed(extractionResult, config);
        break;
      case 'hybrid':
      default:
        chunks = this.chunkHybrid(extractionResult, config);
        break;
    }

    // Remove duplicates based on text hash
    const { uniqueChunks, duplicatesRemoved } = this.deduplicateChunks(chunks);

    // Re-index chunks after deduplication
    const indexedChunks = uniqueChunks.map((chunk, index) => ({
      ...chunk,
      chunkIndex: index,
    }));

    const totalTokens = indexedChunks.reduce((sum, c) => sum + c.tokenCount, 0);
    const avgTokensPerChunk = indexedChunks.length > 0
      ? Math.round(totalTokens / indexedChunks.length)
      : 0;

    const result: ChunkingResult = {
      chunks: indexedChunks,
      totalChunks: indexedChunks.length,
      totalTokens,
      avgTokensPerChunk,
      duplicatesRemoved,
      config,
    };

    logger.info('Document chunking completed', {
      documentType,
      totalChunks: result.totalChunks,
      totalTokens: result.totalTokens,
      avgTokensPerChunk: result.avgTokensPerChunk,
      duplicatesRemoved,
      durationMs: Date.now() - startTime,
    });

    return result;
  }

  /**
   * Chunk a single text string (for testing or simple use cases)
   *
   * @param text - Text to chunk
   * @param pageNumber - Optional page number for metadata
   * @returns Array of document chunks
   */
  chunkText(
    text: string,
    pageNumber?: number
  ): DocumentChunk[] {
    // Create a minimal extraction result for the text
    const extractionResult: ExtractionResult = {
      text,
      pages: [{
        pageNumber: pageNumber || 1,
        text,
        wordCount: this.countWords(text),
        ocrUsed: false,
      }],
      metadata: {
        filename: 'text',
        mimeType: 'text/plain',
        pageCount: 1,
        totalWordCount: this.countWords(text),
        extractedAt: new Date(),
        ocrUsed: false,
        extractionTimeMs: 0,
      },
      confidence: 100,
      warnings: [],
    };

    const result = this.chunkDocument(extractionResult);
    return result.chunks;
  }

  /**
   * Get configuration for a specific document type
   */
  getConfigForDocumentType(documentType: DocumentType): ChunkingConfig {
    const typeConfig = DOCUMENT_TYPE_CONFIGS[documentType] || {};
    return { ...this.config, ...typeConfig };
  }

  /**
   * Estimate token count for text using character-based estimation
   */
  estimateTokenCount(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }
    return Math.ceil(text.length / this.config.charsPerToken);
  }

  /**
   * Generate SHA-256 hash for text (for deduplication)
   */
  generateTextHash(text: string): string {
    return crypto.createHash('sha256').update(text.trim()).digest('hex');
  }

  // ==========================================================================
  // Private Chunking Methods
  // ==========================================================================

  /**
   * Semantic chunking - Split by sentence boundaries
   * Best for well-structured documents with clear sentences
   */
  private chunkSemantic(
    extractionResult: ExtractionResult,
    config: ChunkingConfig
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    let chunkIndex = 0;

    for (const page of extractionResult.pages) {
      const pageChunks = this.chunkTextSemantic(
        page.text,
        config,
        page.pageNumber,
        chunkIndex
      );
      chunks.push(...pageChunks);
      chunkIndex += pageChunks.length;
    }

    return chunks;
  }

  /**
   * Semantic chunking for a single text block
   */
  private chunkTextSemantic(
    text: string,
    config: ChunkingConfig,
    pageNumber: number,
    startIndex: number
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];

    if (!text || text.trim().length === 0) {
      return chunks;
    }

    // Extract section headers for metadata
    const sectionHeaders = this.extractSectionHeaders(text);

    // Split into sentences
    const sentences = this.splitIntoSentences(text);

    if (sentences.length === 0) {
      // If no sentences found, fall back to fixed chunking
      return this.chunkTextFixed(text, config, pageNumber, startIndex);
    }

    let currentChunk: string[] = [];
    let currentTokenCount = 0;
    let currentStartChar = 0;
    let chunkIndex = startIndex;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const sentenceTokens = this.estimateTokenCount(sentence);

      // If adding this sentence would exceed max, finalize current chunk
      if (currentTokenCount + sentenceTokens > config.maxChunkSize && currentChunk.length > 0) {
        const chunkText = currentChunk.join(' ');
        const endChar = currentStartChar + chunkText.length;

        chunks.push({
          text: chunkText,
          tokenCount: currentTokenCount,
          chunkIndex: chunkIndex++,
          metadata: {
            pageNumber,
            sectionHeader: this.findSectionHeader(currentStartChar, sectionHeaders),
            startChar: currentStartChar,
            endChar,
            isOverlap: false,
          },
          textHash: this.generateTextHash(chunkText),
        });

        // Start new chunk with overlap
        const overlapSentences = this.getOverlapSentences(
          currentChunk,
          config.overlapTokens,
          config.charsPerToken
        );
        currentChunk = overlapSentences;
        currentTokenCount = this.estimateTokenCount(currentChunk.join(' '));
        currentStartChar = endChar - currentChunk.join(' ').length;
      }

      // Add sentence to current chunk
      currentChunk.push(sentence);
      currentTokenCount += sentenceTokens;
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      const chunkText = currentChunk.join(' ');
      const tokenCount = this.estimateTokenCount(chunkText);

      // Only add if meets minimum size or it's the only chunk
      if (tokenCount >= config.minChunkSize || chunks.length === 0) {
        chunks.push({
          text: chunkText,
          tokenCount,
          chunkIndex: chunkIndex++,
          metadata: {
            pageNumber,
            sectionHeader: this.findSectionHeader(currentStartChar, sectionHeaders),
            startChar: currentStartChar,
            endChar: currentStartChar + chunkText.length,
            isOverlap: false,
          },
          textHash: this.generateTextHash(chunkText),
        });
      } else if (chunks.length > 0) {
        // Merge with previous chunk if too small
        const lastChunk = chunks[chunks.length - 1];
        const mergedText = lastChunk.text + ' ' + chunkText;
        const mergedTokenCount = this.estimateTokenCount(mergedText);

        if (mergedTokenCount <= config.maxChunkSize) {
          chunks[chunks.length - 1] = {
            ...lastChunk,
            text: mergedText,
            tokenCount: mergedTokenCount,
            metadata: {
              ...lastChunk.metadata,
              endChar: lastChunk.metadata.startChar + mergedText.length,
            },
            textHash: this.generateTextHash(mergedText),
          };
        }
      }
    }

    return chunks;
  }

  /**
   * Fixed chunking - Split by character count
   * Best for unstructured or heavily formatted documents
   */
  private chunkFixed(
    extractionResult: ExtractionResult,
    config: ChunkingConfig
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    let chunkIndex = 0;

    for (const page of extractionResult.pages) {
      const pageChunks = this.chunkTextFixed(
        page.text,
        config,
        page.pageNumber,
        chunkIndex
      );
      chunks.push(...pageChunks);
      chunkIndex += pageChunks.length;
    }

    return chunks;
  }

  /**
   * Fixed chunking for a single text block
   */
  private chunkTextFixed(
    text: string,
    config: ChunkingConfig,
    pageNumber: number,
    startIndex: number
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];

    if (!text || text.trim().length === 0) {
      return chunks;
    }

    const targetChars = config.targetChunkSize * config.charsPerToken;
    const overlapChars = config.overlapTokens * config.charsPerToken;

    let position = 0;
    let chunkIndex = startIndex;

    while (position < text.length) {
      let endPos = Math.min(position + targetChars, text.length);

      // Try to break at word boundary
      if (endPos < text.length) {
        const breakPos = this.findWordBoundary(text, endPos);
        if (breakPos > position) {
          endPos = breakPos;
        }
      }

      const chunkText = text.substring(position, endPos).trim();

      if (chunkText.length > 0) {
        const tokenCount = this.estimateTokenCount(chunkText);

        chunks.push({
          text: chunkText,
          tokenCount,
          chunkIndex: chunkIndex++,
          metadata: {
            pageNumber,
            startChar: position,
            endChar: endPos,
            isOverlap: position > 0,
          },
          textHash: this.generateTextHash(chunkText),
        });
      }

      // Move position with overlap
      position = endPos - overlapChars;
      if (position < 0) position = 0;
      if (position >= text.length) break;
    }

    return chunks;
  }

  /**
   * Hybrid chunking - Use semantic when possible, fall back to fixed
   * Best general-purpose strategy
   */
  private chunkHybrid(
    extractionResult: ExtractionResult,
    config: ChunkingConfig
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    let chunkIndex = 0;

    for (const page of extractionResult.pages) {
      // Analyze text structure
      const hasSentences = SENTENCE_ENDINGS.test(page.text);
      const hasParagraphs = PARAGRAPH_ENDINGS.test(page.text);

      let pageChunks: DocumentChunk[];

      if (hasSentences || hasParagraphs) {
        // Use semantic chunking for well-structured text
        pageChunks = this.chunkTextSemantic(
          page.text,
          config,
          page.pageNumber,
          chunkIndex
        );
      } else {
        // Fall back to fixed chunking for unstructured text
        pageChunks = this.chunkTextFixed(
          page.text,
          config,
          page.pageNumber,
          chunkIndex
        );
      }

      chunks.push(...pageChunks);
      chunkIndex += pageChunks.length;
    }

    return chunks;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Normalize whitespace
    const normalized = text.replace(/\s+/g, ' ').trim();

    if (!normalized) {
      return [];
    }

    // Split by sentence endings
    const parts = normalized.split(SENTENCE_ENDINGS);

    // Filter empty parts and trim
    const sentences = parts
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // If no sentences found but text exists, return the whole text
    if (sentences.length === 0 && normalized.length > 0) {
      return [normalized];
    }

    return sentences;
  }

  /**
   * Extract section headers from text
   */
  private extractSectionHeaders(text: string): Array<{ header: string; position: number }> {
    const headers: Array<{ header: string; position: number }> = [];
    let match;

    SECTION_HEADER_PATTERN.lastIndex = 0;
    while ((match = SECTION_HEADER_PATTERN.exec(text)) !== null) {
      headers.push({
        header: match[0].trim(),
        position: match.index,
      });
    }

    return headers;
  }

  /**
   * Find the section header for a given position
   */
  private findSectionHeader(
    position: number,
    headers: Array<{ header: string; position: number }>
  ): string | undefined {
    let currentHeader: string | undefined;

    for (const header of headers) {
      if (header.position <= position) {
        currentHeader = header.header;
      } else {
        break;
      }
    }

    return currentHeader;
  }

  /**
   * Get overlap sentences from the end of a chunk
   */
  private getOverlapSentences(
    sentences: string[],
    overlapTokens: number,
    charsPerToken: number
  ): string[] {
    const overlapChars = overlapTokens * charsPerToken;
    const result: string[] = [];
    let totalChars = 0;

    // Work backwards from the end
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentence = sentences[i];
      if (totalChars + sentence.length > overlapChars && result.length > 0) {
        break;
      }
      result.unshift(sentence);
      totalChars += sentence.length + 1; // +1 for space
    }

    return result;
  }

  /**
   * Find word boundary near position
   */
  private findWordBoundary(text: string, position: number): number {
    // Search backwards for whitespace
    let i = position;
    while (i > position - 50 && i > 0) {
      if (/\s/.test(text[i])) {
        return i;
      }
      i--;
    }
    return position;
  }

  /**
   * Remove duplicate chunks based on text hash
   */
  private deduplicateChunks(
    chunks: DocumentChunk[]
  ): { uniqueChunks: DocumentChunk[]; duplicatesRemoved: number } {
    const seen = new Set<string>();
    const uniqueChunks: DocumentChunk[] = [];
    let duplicatesRemoved = 0;

    for (const chunk of chunks) {
      if (!seen.has(chunk.textHash)) {
        seen.add(chunk.textHash);
        uniqueChunks.push(chunk);
      } else {
        duplicatesRemoved++;
      }
    }

    return { uniqueChunks, duplicatesRemoved };
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
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const chunkingService = new ChunkingService();

export default chunkingService;
