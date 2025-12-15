/**
 * Vector Storage Service Tests
 *
 * Unit tests for VectorStorageService covering:
 * - Embedding validation (ARCH-001)
 * - Organization isolation (VULN-001)
 * - SQL injection prevention (VULN-005)
 * - Search functionality
 */

import { VectorStorageService, ChunkInsertData, SearchOptions } from '../vectorStorage.service';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
const mockPrisma = {
  $executeRaw: jest.fn(),
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
} as unknown as PrismaClient;

describe('VectorStorageService', () => {
  let service: VectorStorageService;
  const validOrgId = '12345678-1234-4234-a234-123456789012';
  const validSourceId = '87654321-4321-4321-a321-210987654321';
  const validUserId = 'abcdefab-abcd-abcd-abcd-abcdefabcdef';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VectorStorageService(mockPrisma);
  });

  // ==========================================================================
  // Embedding Validation Tests
  // ==========================================================================

  describe('validateEmbedding', () => {
    it('should accept valid 768-dimensional embedding', () => {
      const validEmbedding = new Array(768).fill(0.1);
      expect(() => service.validateEmbedding(validEmbedding)).not.toThrow();
    });

    it('should reject non-array embeddings', () => {
      expect(() => service.validateEmbedding('not an array' as any)).toThrow(
        'Embedding must be an array'
      );
      expect(() => service.validateEmbedding(null as any)).toThrow();
      expect(() => service.validateEmbedding(undefined as any)).toThrow();
    });

    it('should reject embeddings with wrong dimensions', () => {
      const wrongDimensions = new Array(512).fill(0.1);
      expect(() => service.validateEmbedding(wrongDimensions)).toThrow(
        'Invalid embedding dimensions'
      );
    });

    it('should reject embeddings with invalid numeric values', () => {
      const invalidEmbedding = new Array(768).fill(0.1);
      invalidEmbedding[100] = NaN;
      expect(() => service.validateEmbedding(invalidEmbedding)).toThrow(
        'Embedding contains invalid numeric values'
      );

      const infiniteEmbedding = new Array(768).fill(0.1);
      infiniteEmbedding[200] = Infinity;
      expect(() => service.validateEmbedding(infiniteEmbedding)).toThrow(
        'Embedding contains invalid numeric values'
      );
    });

    it('should accept normalized embeddings', () => {
      const normalizedEmbedding = new Array(768).fill(0).map(() => Math.random() * 2 - 1);
      expect(() => service.validateEmbedding(normalizedEmbedding)).not.toThrow();
    });
  });

  // ==========================================================================
  // UUID Validation Tests
  // ==========================================================================

  describe('UUID validation', () => {
    it('should accept valid UUIDs in search', async () => {
      const validEmbedding = new Array(768).fill(0.1);
      mockPrisma.$executeRaw = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([]);

      await expect(
        service.searchSimilar(validEmbedding, validOrgId)
      ).resolves.not.toThrow();
    });

    it('should reject invalid UUIDs in search', async () => {
      const validEmbedding = new Array(768).fill(0.1);

      await expect(
        service.searchSimilar(validEmbedding, 'invalid-uuid')
      ).rejects.toThrow('Invalid UUID format');

      await expect(
        service.searchSimilar(validEmbedding, '12345')
      ).rejects.toThrow('Invalid UUID format');
    });
  });

  // ==========================================================================
  // Organization Isolation Tests (VULN-001)
  // ==========================================================================

  describe('organizationId requirement', () => {
    const validEmbedding = new Array(768).fill(0.1);

    it('should require organizationId for search', async () => {
      await expect(
        service.searchSimilar(validEmbedding, '')
      ).rejects.toThrow('organizationId is REQUIRED');

      await expect(
        service.searchSimilar(validEmbedding, null as any)
      ).rejects.toThrow('organizationId is REQUIRED');
    });

    it('should require organizationId for insertChunk', async () => {
      const chunkData: ChunkInsertData = {
        sourceId: validSourceId,
        organizationId: '',
        text: 'Test text',
        tokenCount: 10,
        chunkIndex: 0,
        embedding: validEmbedding,
      };

      await expect(service.insertChunk(chunkData)).rejects.toThrow(
        'organizationId is REQUIRED'
      );
    });

    it('should require organizationId for deleteChunksBySource', async () => {
      await expect(
        service.deleteChunksBySource(validSourceId, '')
      ).rejects.toThrow('organizationId is REQUIRED');
    });

    it('should set organization context before queries', async () => {
      mockPrisma.$executeRaw = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([]);

      await service.searchSimilar(validEmbedding, validOrgId);

      // Verify setOrganizationContext was called (sets app.current_organization_id)
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // toPgVector Conversion Tests
  // ==========================================================================

  describe('toPgVector', () => {
    it('should convert embedding array to pgvector string format', () => {
      const embedding = [0.1, 0.2, 0.3, -0.4, 0.5];
      const result = service.toPgVector(embedding);
      expect(result).toBe('[0.1,0.2,0.3,-0.4,0.5]');
    });

    it('should handle large embeddings', () => {
      const embedding = new Array(768).fill(0.123456789);
      const result = service.toPgVector(embedding);
      expect(result.startsWith('[')).toBe(true);
      expect(result.endsWith(']')).toBe(true);
      expect(result.split(',').length).toBe(768);
    });

    it('should preserve negative values', () => {
      const embedding = [-0.5, 0.5, -1.0, 1.0, 0];
      const result = service.toPgVector(embedding);
      expect(result).toBe('[-0.5,0.5,-1,1,0]');
    });
  });

  // ==========================================================================
  // Text Hash Generation Tests
  // ==========================================================================

  describe('generateTextHash', () => {
    it('should generate consistent SHA-256 hashes', () => {
      const text = 'This is test content for hashing';
      const hash1 = service.generateTextHash(text);
      const hash2 = service.generateTextHash(text);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different text', () => {
      const hash1 = service.generateTextHash('Text 1');
      const hash2 = service.generateTextHash('Text 2');
      expect(hash1).not.toBe(hash2);
    });

    it('should return 64-character hex string', () => {
      const hash = service.generateTextHash('Any text');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  // ==========================================================================
  // Insert Chunk Tests
  // ==========================================================================

  describe('insertChunk', () => {
    const validEmbedding = new Array(768).fill(0.1);
    const validChunkData: ChunkInsertData = {
      sourceId: validSourceId,
      organizationId: validOrgId,
      text: 'This is test chunk content',
      tokenCount: 5,
      chunkIndex: 0,
      embedding: validEmbedding,
      pageNumber: 1,
      sectionHeader: 'Test Section',
    };

    it('should insert chunk with valid data', async () => {
      mockPrisma.$executeRaw = jest.fn().mockResolvedValue(1);

      const result = await service.insertChunk(validChunkData);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      // UUID format
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('should set organization context before insert', async () => {
      mockPrisma.$executeRaw = jest.fn().mockResolvedValue(1);

      await service.insertChunk(validChunkData);

      // First call should be setOrganizationContext, second should be INSERT
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(2);
    });

    it('should reject invalid embedding in chunk data', async () => {
      const invalidChunkData = {
        ...validChunkData,
        embedding: new Array(512).fill(0.1), // Wrong dimensions
      };

      await expect(service.insertChunk(invalidChunkData)).rejects.toThrow(
        'Invalid embedding dimensions'
      );
    });

    it('should handle optional fields', async () => {
      mockPrisma.$executeRaw = jest.fn().mockResolvedValue(1);

      const minimalChunkData: ChunkInsertData = {
        sourceId: validSourceId,
        organizationId: validOrgId,
        text: 'Minimal chunk',
        tokenCount: 2,
        chunkIndex: 0,
        embedding: validEmbedding,
        // No pageNumber, sectionHeader, or metadata
      };

      await expect(service.insertChunk(minimalChunkData)).resolves.toBeDefined();
    });
  });

  // ==========================================================================
  // Batch Insert Tests
  // ==========================================================================

  describe('insertChunksBatch', () => {
    const validEmbedding = new Array(768).fill(0.1);

    it('should return empty array for empty input', async () => {
      const result = await service.insertChunksBatch([]);
      expect(result).toEqual([]);
    });

    it('should reject batch with mixed organization IDs', async () => {
      const chunks: ChunkInsertData[] = [
        {
          sourceId: validSourceId,
          organizationId: validOrgId,
          text: 'Chunk 1',
          tokenCount: 2,
          chunkIndex: 0,
          embedding: validEmbedding,
        },
        {
          sourceId: validSourceId,
          organizationId: '99999999-9999-9999-9999-999999999999', // Different org
          text: 'Chunk 2',
          tokenCount: 2,
          chunkIndex: 1,
          embedding: validEmbedding,
        },
      ];

      await expect(service.insertChunksBatch(chunks)).rejects.toThrow(
        'All chunks in batch must belong to same organization'
      );
    });
  });

  // ==========================================================================
  // Search Tests
  // ==========================================================================

  describe('searchSimilar', () => {
    const validEmbedding = new Array(768).fill(0.1);

    it('should return search results', async () => {
      const mockResults = [
        {
          id: 'chunk-1',
          sourceId: validSourceId,
          sourceTitle: 'Test Document',
          text: 'Result text',
          pageNumber: 1,
          sectionHeader: 'Section',
          chunkIndex: 0,
          similarity: 0.95,
        },
      ];

      mockPrisma.$executeRaw = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue(mockResults);

      const results = await service.searchSimilar(validEmbedding, validOrgId);

      expect(results).toHaveLength(1);
      expect(results[0].similarity).toBe(0.95);
    });

    it('should filter results below minScore', async () => {
      const mockResults = [
        { id: '1', similarity: 0.9 },
        { id: '2', similarity: 0.6 },
        { id: '3', similarity: 0.3 }, // Below default minScore of 0.5
      ];

      mockPrisma.$executeRaw = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue(mockResults);

      const results = await service.searchSimilar(validEmbedding, validOrgId, {
        minScore: 0.5,
      });

      expect(results).toHaveLength(2);
    });

    it('should respect topK option', async () => {
      mockPrisma.$executeRaw = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([]);

      await service.searchSimilar(validEmbedding, validOrgId, { topK: 10 });

      // Verify query was called (we can't easily verify the LIMIT without more complex mocking)
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('should filter by sourceIds when provided', async () => {
      mockPrisma.$executeRaw = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([]);

      await service.searchSimilar(validEmbedding, validOrgId, {
        sourceIds: [validSourceId],
      });

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('should validate sourceIds UUIDs', async () => {
      await expect(
        service.searchSimilar(validEmbedding, validOrgId, {
          sourceIds: ['invalid-uuid'],
        })
      ).rejects.toThrow('Invalid UUID format');
    });
  });

  // ==========================================================================
  // Hybrid Search Tests
  // ==========================================================================

  describe('hybridSearch', () => {
    const validEmbedding = new Array(768).fill(0.1);

    it('should perform hybrid search with query and embedding', async () => {
      const mockResults = [
        {
          id: 'chunk-1',
          sourceId: validSourceId,
          sourceTitle: 'Test',
          text: 'Result',
          vectorScore: 0.9,
          keywordScore: 0.8,
          finalScore: 0.87,
          similarity: 0.9,
        },
      ];

      mockPrisma.$executeRaw = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue(mockResults);

      const results = await service.hybridSearch(
        'test query',
        validEmbedding,
        validOrgId
      );

      expect(results).toHaveLength(1);
      expect(results[0].finalScore).toBe(0.87);
    });

    it('should require organizationId for hybrid search', async () => {
      await expect(
        service.hybridSearch('query', validEmbedding, '')
      ).rejects.toThrow('organizationId is REQUIRED');
    });
  });

  // ==========================================================================
  // Delete Tests
  // ==========================================================================

  describe('deleteChunksBySource', () => {
    it('should delete chunks and return count', async () => {
      mockPrisma.$executeRaw = jest.fn()
        .mockResolvedValueOnce(undefined) // setOrganizationContext
        .mockResolvedValueOnce(5); // DELETE

      const count = await service.deleteChunksBySource(validSourceId, validOrgId);

      expect(count).toBe(5);
    });

    it('should validate UUIDs before delete', async () => {
      await expect(
        service.deleteChunksBySource('invalid', validOrgId)
      ).rejects.toThrow('Invalid UUID format');
    });
  });

  describe('deleteChunk', () => {
    const validChunkId = '11111111-1111-4111-a111-111111111111';

    it('should return true when chunk is deleted', async () => {
      mockPrisma.$executeRaw = jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(1);

      const result = await service.deleteChunk(validChunkId, validOrgId);

      expect(result).toBe(true);
    });

    it('should return false when chunk not found', async () => {
      mockPrisma.$executeRaw = jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(0);

      const result = await service.deleteChunk(validChunkId, validOrgId);

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Statistics Tests
  // ==========================================================================

  describe('getChunkCount', () => {
    it('should return chunk count for source', async () => {
      mockPrisma.$executeRaw = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ count: BigInt(42) }]);

      const count = await service.getChunkCount(validSourceId, validOrgId);

      expect(count).toBe(42);
    });

    it('should require organizationId', async () => {
      await expect(
        service.getChunkCount(validSourceId, '')
      ).rejects.toThrow('organizationId is REQUIRED');
    });
  });

  describe('checkDuplicate', () => {
    it('should return true when duplicate exists', async () => {
      mockPrisma.$executeRaw = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ exists: true }]);

      const result = await service.checkDuplicate(
        'abc123hash',
        validSourceId,
        validOrgId
      );

      expect(result).toBe(true);
    });

    it('should return false when no duplicate', async () => {
      mockPrisma.$executeRaw = jest.fn().mockResolvedValue(undefined);
      mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ exists: false }]);

      const result = await service.checkDuplicate(
        'unique-hash',
        validSourceId,
        validOrgId
      );

      expect(result).toBe(false);
    });
  });
});
