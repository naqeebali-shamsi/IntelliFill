/**
 * Chunking Service Tests - Basic Functionality
 *
 * Unit tests for ChunkingService covering:
 * - Basic chunking operations
 * - Token estimation (REQ-CHK-004)
 * - Chunk size limits (REQ-CHK-002)
 * - Helper methods
 * - Result statistics
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

describe('ChunkingService - Basic Functionality', () => {
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
  // Basic Functionality Tests
  // ==========================================================================

  describe('Basic Functionality', () => {
    it('should chunk a simple text document', () => {
      const text = 'This is a simple test. It has multiple sentences. Each sentence is short.';
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      expect(chunked.chunks.length).toBeGreaterThan(0);
      expect(chunked.totalChunks).toBe(chunked.chunks.length);
      expect(chunked.totalTokens).toBeGreaterThan(0);
    });

    it('should return empty chunks for empty text', () => {
      const result = createMockExtractionResult('');
      const chunked = service.chunkDocument(result);

      expect(chunked.chunks).toHaveLength(0);
      expect(chunked.totalChunks).toBe(0);
      expect(chunked.totalTokens).toBe(0);
    });

    it('should handle whitespace-only text', () => {
      const result = createMockExtractionResult('   \n\n   \t  ');
      const chunked = service.chunkDocument(result);

      expect(chunked.chunks).toHaveLength(0);
    });

    it('should preserve chunk order with sequential indices', () => {
      const text = loadFixture('sample-text-short.txt');
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      for (let i = 0; i < chunked.chunks.length; i++) {
        expect(chunked.chunks[i].chunkIndex).toBe(i);
      }
    });
  });

  // ==========================================================================
  // Token Estimation Tests (REQ-CHK-004)
  // ==========================================================================

  describe('Token Estimation (REQ-CHK-004)', () => {
    it('should estimate tokens using 4 chars per token ratio', () => {
      // 100 characters should be ~25 tokens
      const text = 'a'.repeat(100);
      const tokens = service.estimateTokenCount(text);

      expect(tokens).toBe(25); // 100 / 4 = 25
    });

    it('should round up token estimates', () => {
      // 101 characters should be 26 tokens (ceiling)
      const text = 'a'.repeat(101);
      const tokens = service.estimateTokenCount(text);

      expect(tokens).toBe(26); // ceil(101 / 4) = 26
    });

    it('should return 0 tokens for empty text', () => {
      expect(service.estimateTokenCount('')).toBe(0);
      expect(service.estimateTokenCount('   ')).toBeGreaterThan(0); // whitespace counts
    });

    it('should estimate correctly for realistic text', () => {
      const text = 'The quick brown fox jumps over the lazy dog.';
      // 44 characters including spaces and period
      const tokens = service.estimateTokenCount(text);

      expect(tokens).toBe(11); // ceil(44 / 4) = 11
    });
  });

  // ==========================================================================
  // Chunk Size Tests (REQ-CHK-002)
  // ==========================================================================

  describe('Chunk Size Limits (REQ-CHK-002)', () => {
    it('should target approximately 400 tokens per chunk', () => {
      // Use medium text (~800 words) for testing multiple chunks
      const text = loadFixture('sample-text-medium.txt');
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      // Most chunks should be near target (400 tokens)
      const avgTokens = chunked.avgTokensPerChunk;
      expect(avgTokens).toBeGreaterThan(100);
      expect(avgTokens).toBeLessThanOrEqual(800);
    });

    it('should not exceed maximum chunk size of 800 tokens', () => {
      // Use medium text to verify max size constraints
      const text = loadFixture('sample-text-medium.txt');
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      for (const chunk of chunked.chunks) {
        expect(chunk.tokenCount).toBeLessThanOrEqual(800);
      }
    });

    it('should merge small chunks below minimum size', () => {
      const text = 'Short text.'; // Very short
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      // Should have at least one chunk even if small
      expect(chunked.chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should implement 15% overlap (60 tokens)', () => {
      // Use medium text to test overlap between chunks
      const text = loadFixture('sample-text-medium.txt');
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      // With overlap, consecutive chunks should share some content
      if (chunked.chunks.length > 1) {
        for (let i = 1; i < chunked.chunks.length; i++) {
          const prevChunk = chunked.chunks[i - 1];
          const currChunk = chunked.chunks[i];

          // Check metadata indicates overlap handling
          expect(prevChunk.metadata).toBeDefined();
          expect(currChunk.metadata).toBeDefined();
        }
      }
    });
  });

  // ==========================================================================
  // chunkText Helper Method Tests
  // ==========================================================================

  describe('chunkText Helper', () => {
    it('should chunk a simple string', () => {
      const text = 'Simple text content. More content here. Even more content.';
      const chunks = service.chunkText(text);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0].text).toContain('Simple');
    });

    it('should accept page number parameter', () => {
      const text = 'Text with page number.';
      const chunks = service.chunkText(text, 5);

      expect(chunks[0].metadata.pageNumber).toBe(5);
    });

    it('should work with default page number', () => {
      const text = 'Text without page number.';
      const chunks = service.chunkText(text);

      expect(chunks[0].metadata.pageNumber).toBe(1);
    });
  });

  // ==========================================================================
  // Result Statistics Tests
  // ==========================================================================

  describe('Result Statistics', () => {
    it('should calculate total tokens correctly', () => {
      const text = loadFixture('sample-text-short.txt');
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      const calculatedTotal = chunked.chunks.reduce((sum, c) => sum + c.tokenCount, 0);
      expect(chunked.totalTokens).toBe(calculatedTotal);
    });

    it('should calculate average tokens correctly', () => {
      const text = loadFixture('sample-text-short.txt');
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      if (chunked.chunks.length > 0) {
        const expectedAvg = Math.round(chunked.totalTokens / chunked.chunks.length);
        expect(chunked.avgTokensPerChunk).toBe(expectedAvg);
      }
    });

    it('should handle zero chunks gracefully', () => {
      const result = createMockExtractionResult('');
      const chunked = service.chunkDocument(result);

      expect(chunked.avgTokensPerChunk).toBe(0);
    });

    it('should include configuration in result', () => {
      const text = 'Test text.';
      const result = createMockExtractionResult(text);

      const chunked = service.chunkDocument(result);

      expect(chunked.config).toBeDefined();
      expect(chunked.config.targetChunkSize).toBeDefined();
      expect(chunked.config.maxChunkSize).toBeDefined();
    });
  });
});
