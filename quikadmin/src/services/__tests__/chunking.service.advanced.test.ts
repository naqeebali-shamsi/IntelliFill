/**
 * Chunking Service Tests - Advanced Features
 *
 * Unit tests for ChunkingService covering:
 * - Document type configurations (REQ-CHK-006)
 * - Edge cases (REQ-CHK-005)
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

describe('ChunkingService - Advanced Features', () => {
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
  // Document Type Tests (REQ-CHK-006)
  // ==========================================================================

  describe('Document Type Configurations (REQ-CHK-006)', () => {
    it('should use smaller chunks for passport documents', () => {
      const text = loadFixture('sample-text-short.txt');
      const result = createMockExtractionResult(text);

      const passportChunked = service.chunkDocument(result, 'PASSPORT');
      const defaultChunked = service.chunkDocument(result, 'DEFAULT');

      // Passport should use smaller target size
      const passportConfig = service.getConfigForDocumentType('PASSPORT');
      expect(passportConfig.targetChunkSize).toBeLessThan(400);
      expect(passportConfig.strategy).toBe('fixed');
    });

    it('should use larger chunks for bank statements', () => {
      const bankConfig = service.getConfigForDocumentType('BANK_STATEMENT');

      expect(bankConfig.targetChunkSize).toBe(500);
      expect(bankConfig.strategy).toBe('semantic');
    });

    it('should use semantic chunking for contracts', () => {
      const contractConfig = service.getConfigForDocumentType('CONTRACT');

      expect(contractConfig.strategy).toBe('semantic');
      expect(contractConfig.overlapTokens).toBe(100);
    });

    it('should fall back to default config for unknown types', () => {
      const defaultConfig = service.getConfigForDocumentType('DEFAULT');

      expect(defaultConfig.targetChunkSize).toBe(400);
      expect(defaultConfig.maxChunkSize).toBe(800);
      expect(defaultConfig.strategy).toBe('hybrid');
    });
  });

  // ==========================================================================
  // Edge Cases (REQ-CHK-005)
  // ==========================================================================

  describe('Edge Cases (REQ-CHK-005)', () => {
    it('should handle very short documents', () => {
      const text = 'Short.';
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      expect(chunked.chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunked.chunks[0].text).toContain('Short');
    });

    it('should handle single-page documents', () => {
      const text = loadFixture('sample-text-short.txt');
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      expect(chunked.chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunked.chunks.every(c => c.metadata.pageNumber === 1)).toBe(true);
    });

    it('should handle multi-page documents', () => {
      const textPage1 = loadFixture('sample-text-short.txt');
      const textPage2 = loadFixture('sample-text-medium.txt');
      const pages: PageContent[] = [
        { pageNumber: 1, text: textPage1, wordCount: textPage1.split(/\s+/).length, ocrUsed: false },
        { pageNumber: 2, text: textPage2, wordCount: textPage2.split(/\s+/).length, ocrUsed: false },
      ];
      const result = createMockExtractionResult('Combined', pages);

      const chunked = service.chunkDocument(result);

      expect(chunked.chunks.length).toBeGreaterThan(1);
    });

    it('should handle text with special characters', () => {
      const text = 'Special chars: @#$%^&*()_+{}[]|\\:";\'<>?,./~`';
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      expect(chunked.chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle Unicode text', () => {
      const text = 'Unicode: Café, naïve, résumé. Chinese: 你好. Emoji: 😀';
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      expect(chunked.chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle very long sentences', () => {
      // Use medium text which contains longer paragraphs
      const text = loadFixture('sample-text-medium.txt');
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      // Should successfully chunk even with longer content
      expect(chunked.chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle table-like content', () => {
      const tableText = `
        Name    Age    City
        John    25     NYC
        Jane    30     LA
        Bob     35     Chicago
      `;
      const result = createMockExtractionResult(tableText);

      const chunked = service.chunkDocument(result);

      expect(chunked.chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle numbered lists', () => {
      const listText = `
        1. First item in the list.
        2. Second item in the list.
        3. Third item in the list.
        4. Fourth item in the list.
      `;
      const result = createMockExtractionResult(listText);

      const chunked = service.chunkDocument(result);

      expect(chunked.chunks.length).toBeGreaterThanOrEqual(1);
    });
  });
});
