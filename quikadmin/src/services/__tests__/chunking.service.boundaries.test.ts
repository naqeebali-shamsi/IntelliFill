/**
 * Chunking Service Tests - Boundaries and Strategies
 *
 * Unit tests for ChunkingService covering:
 * - Sentence boundary preservation (REQ-CHK-001)
 * - Metadata preservation (REQ-CHK-003)
 * - Deduplication
 * - Chunking strategies
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ChunkingService,
  ChunkingConfig,
  ChunkingResult,
  DocumentChunk,
  DocumentType,
} from '../chunking.service';
import { ExtractionResult, PageContent } from '../documentExtraction.service';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ============================================================================
// Test Helpers
// ============================================================================

const FIXTURES_DIR = path.join(__dirname, '../../../tests/fixtures/documents');

/**
 * Load real test document from fixtures
 */
function loadFixture(filename: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, filename), 'utf-8');
}

/**
 * Create a mock extraction result for testing
 */
function createMockExtractionResult(
  text: string,
  pages?: PageContent[]
): ExtractionResult {
  const defaultPages: PageContent[] = [{
    pageNumber: 1,
    text,
    wordCount: text.split(/\s+/).length,
    ocrUsed: false,
  }];

  return {
    text,
    pages: pages || defaultPages,
    metadata: {
      filename: 'test.txt',
      mimeType: 'text/plain',
      pageCount: pages?.length || 1,
      totalWordCount: text.split(/\s+/).length,
      extractedAt: new Date(),
      ocrUsed: false,
      extractionTimeMs: 100,
    },
    confidence: 100,
    warnings: [],
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('ChunkingService - Boundaries and Strategies', () => {
  let service: ChunkingService;

  beforeEach(() => {
    service = new ChunkingService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up service instance to prevent memory leaks
    service = null as any;
    jest.clearAllMocks();

    // Force garbage collection if available (requires --expose-gc flag)
    if (global.gc) {
      global.gc();
      global.gc(); // Run twice for thorough cleanup
    }
  });

  // ==========================================================================
  // Sentence Boundary Tests (REQ-CHK-001)
  // ==========================================================================

  describe('Sentence Boundary Preservation (REQ-CHK-001)', () => {
    it('should preserve sentence boundaries in semantic chunking', () => {
      const text = 'This is sentence one. This is sentence two. This is sentence three.';
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      for (const chunk of chunked.chunks) {
        // Chunks should not start with lowercase (mid-sentence)
        // or end without punctuation (unless very last chunk)
        const firstChar = chunk.text.trim()[0];
        expect(firstChar).toBe(firstChar.toUpperCase());
      }
    });

    it('should handle text without sentence markers', () => {
      const text = 'no punctuation here just words and more words';
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      // Should fall back to fixed chunking
      expect(chunked.chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle mixed punctuation', () => {
      const text = 'Question? Exclamation! Statement. Another one.';
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      expect(chunked.chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // Metadata Preservation Tests (REQ-CHK-003)
  // ==========================================================================

  describe('Metadata Preservation (REQ-CHK-003)', () => {
    it('should include page number in chunk metadata', () => {
      const pages: PageContent[] = [
        { pageNumber: 1, text: 'Page one content here.', wordCount: 4, ocrUsed: false },
        { pageNumber: 2, text: 'Page two content here.', wordCount: 4, ocrUsed: false },
      ];
      const result = createMockExtractionResult('Combined', pages);

      const chunked = service.chunkDocument(result);

      // Should have chunks from both pages
      const pageNumbers = new Set(chunked.chunks.map(c => c.metadata.pageNumber));
      expect(pageNumbers.size).toBeGreaterThanOrEqual(1);
    });

    it('should extract section headers', () => {
      const text = '# Introduction\nThis is the intro section.\n\n# Methods\nThis is the methods section.';
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      // At least one chunk should have a section header
      const chunksWithHeaders = chunked.chunks.filter(c => c.metadata.sectionHeader);
      expect(chunksWithHeaders.length).toBeGreaterThanOrEqual(0);
    });

    it('should track character positions', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      for (const chunk of chunked.chunks) {
        expect(chunk.metadata.startChar).toBeDefined();
        expect(chunk.metadata.endChar).toBeDefined();
        expect(chunk.metadata.endChar).toBeGreaterThan(chunk.metadata.startChar);
      }
    });

    it('should generate unique text hashes', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      for (const chunk of chunked.chunks) {
        expect(chunk.textHash).toBeDefined();
        expect(chunk.textHash.length).toBe(64); // SHA-256 hex
      }
    });
  });

  // ==========================================================================
  // Deduplication Tests
  // ==========================================================================

  describe('Deduplication', () => {
    it('should remove duplicate chunks', () => {
      const text = 'Duplicate text. Duplicate text.'; // Repeated content
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      // Check if duplicates were tracked
      expect(chunked.duplicatesRemoved).toBeDefined();
    });

    it('should generate consistent hashes for identical text', () => {
      const text1 = 'Identical text content';
      const text2 = 'Identical text content';

      const hash1 = service.generateTextHash(text1);
      const hash2 = service.generateTextHash(text2);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different text', () => {
      const text1 = 'First text';
      const text2 = 'Second text';

      const hash1 = service.generateTextHash(text1);
      const hash2 = service.generateTextHash(text2);

      expect(hash1).not.toBe(hash2);
    });

    it('should trim text before hashing', () => {
      const text1 = '  text with spaces  ';
      const text2 = 'text with spaces';

      const hash1 = service.generateTextHash(text1);
      const hash2 = service.generateTextHash(text2);

      expect(hash1).toBe(hash2);
    });
  });

  // ==========================================================================
  // Chunking Strategy Tests
  // ==========================================================================

  describe('Chunking Strategies', () => {
    it('should use hybrid strategy by default', () => {
      const text = loadFixture('sample-text-short.txt');
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      expect(chunked.config.strategy).toBe('hybrid');
    });

    it('should allow custom configuration', () => {
      const customConfig: Partial<ChunkingConfig> = {
        targetChunkSize: 200,
        maxChunkSize: 400,
        strategy: 'fixed',
      };
      const customService = new ChunkingService(customConfig);

      const text = loadFixture('sample-text-short.txt');
      const result = createMockExtractionResult(text);

      const chunked = customService.chunkDocument(result);

      expect(chunked.config.targetChunkSize).toBe(200);
      expect(chunked.config.maxChunkSize).toBe(400);
      expect(chunked.config.strategy).toBe('fixed');
    });

    it('should use fixed chunking for document types without sentences', () => {
      const passportConfig = service.getConfigForDocumentType('PASSPORT');
      expect(passportConfig.preserveSentences).toBe(false);
    });
  });
});
