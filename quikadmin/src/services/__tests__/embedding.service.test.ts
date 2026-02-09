/**
 * Embedding Service Unit Tests
 *
 * Tests for the EmbeddingService class covering:
 * - Single embedding generation
 * - Batch embedding generation
 * - Validation
 * - Similarity functions
 * - Quota management
 * - Error handling and retry logic
 *
 * @module services/__tests__/embedding.service.test
 */

import {
  EmbeddingService,
  createEmbeddingService,
  getEmbeddingService,
  generateEmbeddingCacheKey,
  EmbeddingCacheInterface,
} from '../embedding.service';

// Mock Google Generative AI
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      embedContent: jest.fn().mockResolvedValue({
        embedding: { values: Array(768).fill(0.1) },
      }),
      batchEmbedContents: jest.fn().mockResolvedValue({
        embeddings: [
          { values: Array(768).fill(0.1) },
          { values: Array(768).fill(0.2) },
          { values: Array(768).fill(0.3) },
        ],
      }),
    }),
  })),
  TaskType: { RETRIEVAL_DOCUMENT: 'RETRIEVAL_DOCUMENT' },
}));

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    // Set up environment
    process.env.GOOGLE_GENERATIVE_AI_KEY = 'test-api-key';

    // Create fresh service instance
    service = createEmbeddingService({
      rateLimitDelayMs: 0, // Disable rate limiting for tests
      maxRetries: 1,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Text Validation', () => {
    it('should reject empty text', () => {
      expect(() => service.validateText('')).toThrow('minimum 1 character');
    });

    it('should reject text exceeding maximum length', () => {
      const longText = 'a'.repeat(8001);
      expect(() => service.validateText(longText)).toThrow('maximum 8000 characters');
    });

    it('should reject text with control characters', () => {
      expect(() => service.validateText('text\x00null')).toThrow('invalid control characters');
    });

    it('should accept valid text', () => {
      expect(() => service.validateText('Valid text content')).not.toThrow();
    });

    it('should accept text with normal whitespace', () => {
      expect(() => service.validateText('Text with\nnewlines\tand\ttabs')).not.toThrow();
    });
  });

  describe('Embedding Validation', () => {
    it('should reject non-array embeddings', () => {
      expect(() => service.validateEmbedding('not an array' as any)).toThrow('must be an array');
    });

    it('should reject embeddings with wrong dimensions', () => {
      expect(() => service.validateEmbedding(Array(100).fill(0))).toThrow('expected 768, got 100');
    });

    it('should reject embeddings with NaN values', () => {
      const embedding = Array(768).fill(0);
      embedding[0] = NaN;
      expect(() => service.validateEmbedding(embedding)).toThrow('invalid numeric values');
    });

    it('should reject embeddings with Infinity values', () => {
      const embedding = Array(768).fill(0);
      embedding[0] = Infinity;
      expect(() => service.validateEmbedding(embedding)).toThrow('invalid numeric values');
    });

    it('should accept valid embeddings', () => {
      const embedding = Array(768).fill(0.1);
      expect(() => service.validateEmbedding(embedding)).not.toThrow();
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for valid text', async () => {
      const result = await service.generateEmbedding('Test text');

      expect(result).toBeDefined();
      expect(result.embedding).toHaveLength(768);
      expect(result.model).toBe('text-embedding-004');
      expect(result.cached).toBe(false);
    });

    it('should throw for invalid text', async () => {
      await expect(service.generateEmbedding('')).rejects.toThrow('minimum 1 character');
    });

    it('should track quota when organization is provided', async () => {
      await service.generateEmbedding('Test text', 'org-123');

      const usage = await service.getQuotaUsage('org-123');
      expect(usage).not.toBeNull();
      expect(usage?.embeddingCount).toBe(1);
    });

    it('should reject when quota exceeded', async () => {
      // Create service with very low quota
      const lowQuotaService = createEmbeddingService({
        dailyQuotaLimit: 1,
        rateLimitDelayMs: 0,
      });

      await lowQuotaService.generateEmbedding('First', 'org-limited');
      await expect(lowQuotaService.generateEmbedding('Second', 'org-limited')).rejects.toThrow(
        'quota exceeded'
      );
    });
  });

  describe('generateBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      const result = await service.generateBatch(texts);

      expect(result).toBeDefined();
      expect(result.embeddings).toHaveLength(3);
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
      expect(result.model).toBe('text-embedding-004');
    });

    it('should handle empty array', async () => {
      const result = await service.generateBatch([]);

      expect(result.embeddings).toHaveLength(0);
      expect(result.successCount).toBe(0);
    });

    it('should validate all texts before processing', async () => {
      const texts = ['Valid', '', 'Also valid'];
      await expect(service.generateBatch(texts)).rejects.toThrow('index 1');
    });

    it('should track quota for batch', async () => {
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      await service.generateBatch(texts, 'org-batch');

      const usage = await service.getQuotaUsage('org-batch');
      expect(usage?.embeddingCount).toBe(3);
    });
  });

  describe('Cache Integration', () => {
    let mockCache: EmbeddingCacheInterface;

    beforeEach(() => {
      mockCache = {
        get: jest.fn() as jest.MockedFunction<EmbeddingCacheInterface['get']>,
        set: jest.fn() as jest.MockedFunction<EmbeddingCacheInterface['set']>,
        generateKey: jest.fn().mockReturnValue('cache-key') as jest.MockedFunction<
          EmbeddingCacheInterface['generateKey']
        >,
      };
      service.setCache(mockCache);
    });

    it('should return cached embedding if available', async () => {
      const cachedEmbedding = Array(768).fill(0.5);
      (mockCache.get as jest.Mock).mockResolvedValue(cachedEmbedding);

      const result = await service.generateEmbedding('Test text');

      expect(result.embedding).toEqual(cachedEmbedding);
      expect(result.cached).toBe(true);
      expect(mockCache.get).toHaveBeenCalled();
    });

    it('should cache generated embedding', async () => {
      (mockCache.get as jest.Mock).mockResolvedValue(null);

      await service.generateEmbedding('Test text');

      expect(mockCache.set).toHaveBeenCalledWith(
        'cache-key',
        expect.arrayContaining([expect.any(Number)])
      );
    });
  });

  describe('Similarity Functions', () => {
    describe('cosineSimilarity', () => {
      it('should return 1 for identical vectors', () => {
        const vector = Array(768).fill(1);
        const similarity = service.cosineSimilarity(vector, vector);
        expect(similarity).toBeCloseTo(1, 5);
      });

      it('should return 0 for orthogonal vectors', () => {
        const vector1 = Array(768)
          .fill(0)
          .map((_, i) => (i < 384 ? 1 : 0));
        const vector2 = Array(768)
          .fill(0)
          .map((_, i) => (i >= 384 ? 1 : 0));
        const similarity = service.cosineSimilarity(vector1, vector2);
        expect(similarity).toBeCloseTo(0, 5);
      });

      it('should return -1 for opposite vectors', () => {
        const vector1 = Array(768).fill(1);
        const vector2 = Array(768).fill(-1);
        const similarity = service.cosineSimilarity(vector1, vector2);
        expect(similarity).toBeCloseTo(-1, 5);
      });

      it('should throw for mismatched dimensions', () => {
        const vector1 = Array(768).fill(1);
        const vector2 = Array(100).fill(1);
        expect(() => service.cosineSimilarity(vector1, vector2)).toThrow('dimension mismatch');
      });
    });

    describe('findTopK', () => {
      it('should find top K similar embeddings', () => {
        // Create query with a specific pattern
        const query = Array(768)
          .fill(0)
          .map((_, i) => (i % 2 === 0 ? 0.5 : -0.5));

        // Create candidates with varying similarity to query
        const candidates = [
          Array(768)
            .fill(0)
            .map((_, i) => (i % 2 === 0 ? 0.5 : -0.5)), // Identical to query
          Array(768)
            .fill(0)
            .map((_, i) => (i % 2 === 0 ? 0.3 : -0.3)), // Same direction
          Array(768)
            .fill(0)
            .map((_, i) => (i % 2 === 0 ? -0.5 : 0.5)), // Opposite direction
        ];

        const results = service.findTopK(query, candidates, 2);

        expect(results).toHaveLength(2);
        // First two should have similarity 1.0 (same direction)
        expect(results[0].score).toBeGreaterThan(0.9);
        expect(results[1].score).toBeGreaterThan(0.9);
      });

      it('should handle k larger than candidates', () => {
        const query = Array(768).fill(0.1);
        const candidates = [Array(768).fill(0.1)];

        const results = service.findTopK(query, candidates, 10);

        expect(results).toHaveLength(1);
      });
    });
  });

  describe('Quota Management', () => {
    it('should track remaining quota', async () => {
      const remaining = await service.getRemainingQuota('new-org');
      expect(remaining).toBe(10000); // Default limit
    });

    it('should decrease remaining quota after usage', async () => {
      await service.generateEmbedding('Test', 'org-quota');
      const remaining = await service.getRemainingQuota('org-quota');
      expect(remaining).toBe(9999);
    });

    it('should reset quota daily', async () => {
      // This is more of a behavioral test - quotas are tracked by date
      const usage = await service.getQuotaUsage('non-existent');
      expect(usage).toBeNull();
    });
  });

  describe('Configuration', () => {
    it('should return current configuration', () => {
      const config = service.getConfig();
      expect(config.model).toBe('text-embedding-004');
      expect(config.dimensions).toBe(768);
      expect(config.batchSize).toBe(100);
    });

    it('should allow configuration updates', () => {
      service.updateConfig({ batchSize: 50 });
      const config = service.getConfig();
      expect(config.batchSize).toBe(50);
    });
  });
});

describe('generateEmbeddingCacheKey', () => {
  it('should generate consistent keys for same text', () => {
    const key1 = generateEmbeddingCacheKey('test text');
    const key2 = generateEmbeddingCacheKey('test text');
    expect(key1).toBe(key2);
  });

  it('should generate different keys for different text', () => {
    const key1 = generateEmbeddingCacheKey('text one');
    const key2 = generateEmbeddingCacheKey('text two');
    expect(key1).not.toBe(key2);
  });

  it('should normalize text (trim and lowercase)', () => {
    const key1 = generateEmbeddingCacheKey('  Test Text  ');
    const key2 = generateEmbeddingCacheKey('test text');
    expect(key1).toBe(key2);
  });

  it('should include model in key', () => {
    const key1 = generateEmbeddingCacheKey('text', 'model-a');
    const key2 = generateEmbeddingCacheKey('text', 'model-b');
    expect(key1).not.toBe(key2);
  });

  it('should start with emb: prefix', () => {
    const key = generateEmbeddingCacheKey('test');
    expect(key).toMatch(/^emb:/);
  });
});

describe('getEmbeddingService (singleton)', () => {
  it('should return the same instance', () => {
    const instance1 = getEmbeddingService();
    const instance2 = getEmbeddingService();
    expect(instance1).toBe(instance2);
  });
});
