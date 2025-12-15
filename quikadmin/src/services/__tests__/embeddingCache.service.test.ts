/**
 * Embedding Cache Service Unit Tests
 *
 * Tests for the EmbeddingCacheService class covering:
 * - Connection management
 * - Cache get/set operations
 * - Batch operations
 * - Validation
 * - Statistics tracking
 *
 * @module services/__tests__/embeddingCache.service.test
 */

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  set: jest.fn(),
  setEx: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(1),
  mGet: jest.fn(),
  multi: jest.fn().mockReturnValue({
    setEx: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  }),
  scan: jest.fn().mockResolvedValue({ cursor: 0, keys: [] }),
  on: jest.fn(),
};

jest.mock('redis', () => ({
  createClient: jest.fn().mockReturnValue(mockRedisClient),
}));

import {
  EmbeddingCacheService,
  createEmbeddingCacheService,
} from '../embeddingCache.service';

describe('EmbeddingCacheService', () => {
  let service: EmbeddingCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = createEmbeddingCacheService({
      redisUrl: 'redis://localhost:6379',
      ttlSeconds: 3600,
    });
  });

  afterEach(async () => {
    if (service.isReady()) {
      await service.disconnect();
    }
  });

  describe('Connection Management', () => {
    it('should connect to Redis', async () => {
      await service.connect();
      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it('should not reconnect if already connected', async () => {
      await service.connect();
      await service.connect();
      expect(mockRedisClient.connect).toHaveBeenCalledTimes(1);
    });

    it('should disconnect from Redis', async () => {
      await service.connect();
      await service.disconnect();
      expect(mockRedisClient.quit).toHaveBeenCalled();
    });

    it('should report ready status', async () => {
      expect(service.isReady()).toBe(false);
      await service.connect();
      expect(service.isReady()).toBe(true);
    });
  });

  describe('Key Generation', () => {
    it('should generate consistent keys for same text', () => {
      const key1 = service.generateKey('test text');
      const key2 = service.generateKey('test text');
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different text', () => {
      const key1 = service.generateKey('text one');
      const key2 = service.generateKey('text two');
      expect(key1).not.toBe(key2);
    });

    it('should include model in key generation', () => {
      const key1 = service.generateKey('text', 'model-a');
      const key2 = service.generateKey('text', 'model-b');
      expect(key1).not.toBe(key2);
    });

    it('should start with configured prefix', () => {
      const key = service.generateKey('test');
      expect(key).toMatch(/^emb:/);
    });
  });

  describe('Get Operation', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should return null when not connected', async () => {
      await service.disconnect();
      const result = await service.get('some-key');
      expect(result).toBeNull();
    });

    it('should return null for cache miss', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      const result = await service.get('missing-key');
      expect(result).toBeNull();
    });

    it('should return embedding for cache hit', async () => {
      const embedding = Array(768).fill(0.1);
      const cached = {
        embedding,
        model: 'text-embedding-004',
        createdAt: new Date().toISOString(),
        textHash: 'hash',
      };
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cached));

      const result = await service.get('valid-key');
      expect(result).toEqual(embedding);
    });

    it('should track cache hits', async () => {
      const embedding = Array(768).fill(0.1);
      const cached = {
        embedding,
        model: 'text-embedding-004',
        createdAt: new Date().toISOString(),
        textHash: 'hash',
      };
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cached));

      await service.get('valid-key');
      const stats = service.getStats();
      expect(stats.hits).toBe(1);
    });

    it('should track cache misses', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      await service.get('missing-key');
      const stats = service.getStats();
      expect(stats.misses).toBe(1);
    });

    it('should invalidate corrupted cache entries', async () => {
      mockRedisClient.get.mockResolvedValueOnce('invalid json');
      const result = await service.get('corrupted-key');
      expect(result).toBeNull();
    });

    it('should invalidate cache entries with wrong dimensions', async () => {
      const cached = {
        embedding: Array(100).fill(0.1), // Wrong dimensions
        model: 'text-embedding-004',
        createdAt: new Date().toISOString(),
        textHash: 'hash',
      };
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(cached));

      const result = await service.get('wrong-dims-key');
      expect(result).toBeNull();
      expect(mockRedisClient.del).toHaveBeenCalled();
    });
  });

  describe('Set Operation', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should skip when not connected', async () => {
      await service.disconnect();
      await service.set('key', Array(768).fill(0.1));
      expect(mockRedisClient.setEx).not.toHaveBeenCalled();
    });

    it('should store valid embedding', async () => {
      const embedding = Array(768).fill(0.1);
      await service.set('valid-key', embedding);
      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });

    it('should use configured TTL', async () => {
      const embedding = Array(768).fill(0.1);
      await service.set('ttl-key', embedding);

      const [, ttl] = mockRedisClient.setEx.mock.calls[0];
      expect(ttl).toBe(3600);
    });

    it('should allow custom TTL', async () => {
      const embedding = Array(768).fill(0.1);
      await service.set('custom-ttl-key', embedding, 7200);

      const [, ttl] = mockRedisClient.setEx.mock.calls[0];
      expect(ttl).toBe(7200);
    });

    it('should skip invalid embeddings', async () => {
      await service.set('invalid-key', Array(100).fill(0.1));
      expect(mockRedisClient.setEx).not.toHaveBeenCalled();
    });

    it('should skip embeddings with NaN values', async () => {
      const embedding = Array(768).fill(0.1);
      embedding[0] = NaN;
      await service.set('nan-key', embedding);
      expect(mockRedisClient.setEx).not.toHaveBeenCalled();
    });
  });

  describe('Delete Operation', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should delete existing key', async () => {
      mockRedisClient.del.mockResolvedValueOnce(1);
      const result = await service.delete('existing-key');
      expect(result).toBe(true);
    });

    it('should return false for non-existing key', async () => {
      mockRedisClient.del.mockResolvedValueOnce(0);
      const result = await service.delete('non-existing-key');
      expect(result).toBe(false);
    });
  });

  describe('Exists Operation', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should return true for existing key', async () => {
      mockRedisClient.exists.mockResolvedValueOnce(1);
      const result = await service.exists('existing-key');
      expect(result).toBe(true);
    });

    it('should return false for non-existing key', async () => {
      mockRedisClient.exists.mockResolvedValueOnce(0);
      const result = await service.exists('non-existing-key');
      expect(result).toBe(false);
    });
  });

  describe('Batch Operations', () => {
    beforeEach(async () => {
      await service.connect();
    });

    describe('getMany', () => {
      it('should return map of results', async () => {
        const embedding = Array(768).fill(0.1);
        const cached = {
          embedding,
          model: 'text-embedding-004',
          createdAt: new Date().toISOString(),
          textHash: 'hash',
        };

        mockRedisClient.mGet.mockResolvedValueOnce([
          JSON.stringify(cached),
          null,
        ]);

        const results = await service.getMany(['key1', 'key2']);

        expect(results.get('key1')).toEqual(embedding);
        expect(results.get('key2')).toBeNull();
      });

      it('should handle empty array', async () => {
        const results = await service.getMany([]);
        expect(results.size).toBe(0);
      });
    });

    describe('setMany', () => {
      it('should store multiple embeddings', async () => {
        const entries: [string, number[]][] = [
          ['key1', Array(768).fill(0.1)],
          ['key2', Array(768).fill(0.2)],
        ];

        await service.setMany(entries);

        const multi = mockRedisClient.multi();
        expect(multi.exec).toHaveBeenCalled();
      });

      it('should handle empty array', async () => {
        await service.setMany([]);
        expect(mockRedisClient.multi).not.toHaveBeenCalled();
      });
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should track hit rate', async () => {
      const embedding = Array(768).fill(0.1);
      const cached = {
        embedding,
        model: 'text-embedding-004',
        createdAt: new Date().toISOString(),
        textHash: 'hash',
      };

      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(cached)) // Hit
        .mockResolvedValueOnce(null); // Miss

      await service.get('key1');
      await service.get('key2');

      const stats = service.getStats();
      expect(stats.hitRate).toBe(0.5);
    });

    it('should reset stats', () => {
      service.resetStats();
      const stats = service.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should clear cache', async () => {
      mockRedisClient.scan.mockResolvedValueOnce({
        cursor: 0,
        keys: ['emb:key1', 'emb:key2'],
      });
      mockRedisClient.del.mockResolvedValueOnce(2);

      const count = await service.clear();
      expect(count).toBe(2);
    });

    it('should get entry count', async () => {
      mockRedisClient.scan.mockResolvedValueOnce({
        cursor: 0,
        keys: ['emb:key1', 'emb:key2', 'emb:key3'],
      });

      const count = await service.getEntryCount();
      expect(count).toBe(3);
    });
  });

  describe('Pre-warming', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should pre-warm cache with texts', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      const generateEmbedding = jest.fn().mockResolvedValue(Array(768).fill(0.1));

      const result = await service.prewarm(['text1', 'text2'], generateEmbedding);

      expect(result.warmed).toBe(2);
      expect(result.skipped).toBe(0);
      expect(generateEmbedding).toHaveBeenCalledTimes(2);
    });

    it('should skip already cached texts', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const generateEmbedding = jest.fn();

      const result = await service.prewarm(['text1', 'text2'], generateEmbedding);

      expect(result.warmed).toBe(0);
      expect(result.skipped).toBe(2);
      expect(generateEmbedding).not.toHaveBeenCalled();
    });

    it('should track errors during pre-warming', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      const generateEmbedding = jest.fn().mockRejectedValue(new Error('API error'));

      const result = await service.prewarm(['text1'], generateEmbedding);

      expect(result.errors).toBe(1);
      expect(result.warmed).toBe(0);
    });
  });
});
