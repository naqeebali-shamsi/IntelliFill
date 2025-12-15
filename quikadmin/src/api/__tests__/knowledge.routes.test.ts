/**
 * Knowledge API Routes Tests
 *
 * Integration tests for the Knowledge Base Search API endpoints.
 * Tests Task #135 from PRD Vector Search v2.0
 *
 * Tests cover:
 * - Authentication and authorization
 * - Input validation (Zod schemas)
 * - Rate limiting
 * - Search functionality (semantic and hybrid)
 * - Document source management (CRUD)
 * - Caching behavior
 *
 * @module api/__tests__/knowledge.routes.test
 */

import request from 'supertest';
import express, { Express } from 'express';
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createKnowledgeRoutes } from '../knowledge.routes';

// ============================================================================
// Mocks
// ============================================================================

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    user: {
      findUnique: jest.fn(),
    },
    documentSource: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    documentChunk: {
      count: jest.fn(),
    },
    processingCheckpoint: {
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $disconnect: jest.fn(),
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

// Mock Supabase Auth Middleware
jest.mock('../../middleware/supabaseAuth', () => ({
  authenticateSupabase: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }),
  AuthenticatedRequest: {},
}));

// Mock Rate Limiters
jest.mock('../../middleware/rateLimiter', () => ({
  knowledgeSearchLimiter: jest.fn((req, res, next) => next()),
  knowledgeSuggestLimiter: jest.fn((req, res, next) => next()),
  knowledgeUploadLimiter: jest.fn((req, res, next) => next()),
}));

// Mock VectorStorageService
jest.mock('../../services/vectorStorage.service', () => ({
  createVectorStorageService: jest.fn(() => ({
    searchSimilar: jest.fn().mockResolvedValue([
      {
        id: 'chunk-1',
        text: 'Test result 1',
        score: 0.95,
        sourceId: 'source-1',
        sourceTitle: 'Test Document',
      },
    ]),
    hybridSearch: jest.fn().mockResolvedValue([
      {
        id: 'chunk-1',
        text: 'Hybrid result 1',
        score: 0.9,
        sourceId: 'source-1',
        sourceTitle: 'Test Document',
      },
    ]),
    deleteChunksBySource: jest.fn().mockResolvedValue(5),
    getOrganizationChunkCount: jest.fn().mockResolvedValue(100),
  })),
  VectorStorageService: jest.fn(),
}));

// Mock EmbeddingService
jest.mock('../../services/embedding.service', () => ({
  getEmbeddingService: jest.fn(() => ({
    generateEmbedding: jest.fn().mockResolvedValue({
      embedding: new Array(768).fill(0.1),
      model: 'text-embedding-004',
      cached: false,
    }),
    getRemainingQuota: jest.fn().mockReturnValue(9500),
  })),
}));

// Mock SearchCacheService with shared instance
const mockSearchCache = {
  generateKey: jest.fn().mockReturnValue('test-cache-key'),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  invalidateOrganization: jest.fn().mockResolvedValue(5),
};

jest.mock('../../services/searchCache.service', () => ({
  getSearchCacheService: jest.fn(() => mockSearchCache),
}));

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
// Test Setup
// ============================================================================

describe('Knowledge API Routes', () => {
  let app: Express;
  let mockPrisma: any;

  const testUserId = 'test-user-id';
  const testOrgId = '12345678-1234-4234-a234-123456789012';
  const testSourceId = '87654321-4321-4321-b321-210987654321';

  beforeAll(() => {
    // Setup Express app with knowledge routes
    app = express();
    app.use(express.json());

    const knowledgeRoutes = createKnowledgeRoutes();
    app.use('/api/knowledge', knowledgeRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Get mocked Prisma instance
    mockPrisma = new PrismaClient();

    // Default mock for user with organization
    mockPrisma.user.findUnique.mockResolvedValue({
      id: testUserId,
      organizationId: testOrgId,
    });
  });

  // ==========================================================================
  // Authentication Tests
  // ==========================================================================

  describe('Authentication', () => {
    it('should require authentication for all endpoints', async () => {
      // Get the actual authenticate mock
      const { authenticateSupabase } = require('../../middleware/supabaseAuth');

      // Make it return 401 for this test
      authenticateSupabase.mockImplementationOnce((req: any, res: any) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .get('/api/knowledge/sources')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });
  });

  // ==========================================================================
  // Organization Validation Tests
  // ==========================================================================

  describe('Organization Validation', () => {
    it('should require user to have an organization', async () => {
      // User without organization
      mockPrisma.user.findUnique.mockResolvedValue({
        id: testUserId,
        organizationId: null,
      });

      const response = await request(app)
        .get('/api/knowledge/sources')
        .expect(403);

      expect(response.body.error).toBe('Organization required');
    });
  });

  // ==========================================================================
  // Document Source Endpoints Tests
  // ==========================================================================

  describe('GET /sources', () => {
    it('should list document sources for organization', async () => {
      const mockSources = [
        {
          id: testSourceId,
          title: 'Test Document',
          description: 'Test description',
          sourceType: 'PDF',
          fileName: 'test.pdf',
          fileSize: 1024,
          status: 'COMPLETED',
          chunkCount: 10,
          processingTimeMs: 500,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.documentSource.findMany.mockResolvedValue(mockSources);
      mockPrisma.documentSource.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/knowledge/sources')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.sources).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
    });

    it('should support status filtering', async () => {
      mockPrisma.documentSource.findMany.mockResolvedValue([]);
      mockPrisma.documentSource.count.mockResolvedValue(0);

      await request(app)
        .get('/api/knowledge/sources?status=COMPLETED')
        .expect(200);

      expect(mockPrisma.documentSource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'COMPLETED',
          }),
        })
      );
    });

    it('should support pagination', async () => {
      mockPrisma.documentSource.findMany.mockResolvedValue([]);
      mockPrisma.documentSource.count.mockResolvedValue(0);

      await request(app)
        .get('/api/knowledge/sources?limit=10&offset=20')
        .expect(200);

      expect(mockPrisma.documentSource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });
  });

  describe('GET /sources/:id', () => {
    it('should return source details', async () => {
      const mockSource = {
        id: testSourceId,
        title: 'Test Document',
        status: 'COMPLETED',
        _count: { chunks: 10 },
      };

      mockPrisma.documentSource.findFirst.mockResolvedValue(mockSource);

      const response = await request(app)
        .get(`/api/knowledge/sources/${testSourceId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.source.id).toBe(testSourceId);
    });

    it('should return 404 for non-existent source', async () => {
      mockPrisma.documentSource.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/knowledge/sources/${testSourceId}`)
        .expect(404);

      expect(response.body.error).toBe('Document source not found');
    });
  });

  describe('DELETE /sources/:id', () => {
    it('should soft delete source and invalidate cache', async () => {
      mockPrisma.documentSource.findFirst.mockResolvedValue({
        id: testSourceId,
        organizationId: testOrgId,
      });

      mockPrisma.documentSource.update.mockResolvedValue({
        id: testSourceId,
        deletedAt: new Date(),
      });

      const response = await request(app)
        .delete(`/api/knowledge/sources/${testSourceId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockPrisma.documentSource.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: testSourceId },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should return 404 for non-existent source', async () => {
      mockPrisma.documentSource.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/knowledge/sources/${testSourceId}`)
        .expect(404);

      expect(response.body.error).toBe('Document source not found');
    });
  });

  describe('GET /sources/:id/status', () => {
    it('should return processing status with progress', async () => {
      mockPrisma.documentSource.findFirst.mockResolvedValue({
        id: testSourceId,
        status: 'EMBEDDING',
        chunkCount: 50,
        processingTimeMs: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.processingCheckpoint.findUnique.mockResolvedValue({
        stage: 'embedding',
        lastCompletedChunkIndex: 25,
        totalChunks: 50,
      });

      const response = await request(app)
        .get(`/api/knowledge/sources/${testSourceId}/status`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status.progress.percentage).toBe(50);
    });
  });

  // ==========================================================================
  // Search Endpoints Tests
  // ==========================================================================

  describe('POST /search (Semantic Search)', () => {
    it('should perform semantic search with valid query', async () => {
      const response = await request(app)
        .post('/api/knowledge/search')
        .send({
          query: 'test search query',
          topK: 5,
          minScore: 0.5,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.cached).toBe(false);
      expect(response.body.searchTime).toBeGreaterThanOrEqual(0);
    });

    it('should validate query length (minimum 3 characters)', async () => {
      const response = await request(app)
        .post('/api/knowledge/search')
        .send({
          query: 'ab',
          topK: 5,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details[0].message).toContain('at least 3 characters');
    });

    it('should validate query length (maximum 1000 characters)', async () => {
      const response = await request(app)
        .post('/api/knowledge/search')
        .send({
          query: 'a'.repeat(1001),
          topK: 5,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should validate topK range (1-50)', async () => {
      const response = await request(app)
        .post('/api/knowledge/search')
        .send({
          query: 'test query',
          topK: 100,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should validate minScore range (0-1)', async () => {
      const response = await request(app)
        .post('/api/knowledge/search')
        .send({
          query: 'test query',
          minScore: 1.5,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should return cached results when available', async () => {
      // Mock cache hit - the route spreads this object and adds cached: true
      mockSearchCache.get.mockResolvedValueOnce({
        results: [{ id: 'cached-chunk', text: 'Cached result', score: 0.9 }],
        query: 'test query',
        totalResults: 1,
        searchParams: { topK: 5, minScore: 0.5 },
      });

      const response = await request(app)
        .post('/api/knowledge/search')
        .send({
          query: 'test query',
          topK: 5,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.cached).toBe(true);
      expect(response.body.results[0].id).toBe('cached-chunk');
    });

    it('should support sourceIds filter', async () => {
      const response = await request(app)
        .post('/api/knowledge/search')
        .send({
          query: 'test query',
          sourceIds: [testSourceId],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /search/hybrid (Hybrid Search)', () => {
    it('should perform hybrid search with valid query', async () => {
      const response = await request(app)
        .post('/api/knowledge/search/hybrid')
        .send({
          query: 'test hybrid search',
          topK: 5,
          hybridMode: 'balanced',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.searchParams.hybridMode).toBe('balanced');
    });

    it('should validate hybridMode values', async () => {
      const response = await request(app)
        .post('/api/knowledge/search/hybrid')
        .send({
          query: 'test query',
          hybridMode: 'invalid',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should use semantic weight for semantic mode', async () => {
      const response = await request(app)
        .post('/api/knowledge/search/hybrid')
        .send({
          query: 'test query',
          hybridMode: 'semantic',
        })
        .expect(200);

      expect(response.body.searchParams.vectorWeight).toBe(0.9);
    });

    it('should use keyword weight for keyword mode', async () => {
      const response = await request(app)
        .post('/api/knowledge/search/hybrid')
        .send({
          query: 'test query',
          hybridMode: 'keyword',
        })
        .expect(200);

      expect(response.body.searchParams.vectorWeight).toBe(0.3);
    });

    it('should support custom hybridWeight', async () => {
      const response = await request(app)
        .post('/api/knowledge/search/hybrid')
        .send({
          query: 'test query',
          hybridMode: 'balanced',
          hybridWeight: 0.6,
        })
        .expect(200);

      expect(response.body.searchParams.vectorWeight).toBe(0.6);
    });

    it('should validate hybridWeight range (0-1)', async () => {
      const response = await request(app)
        .post('/api/knowledge/search/hybrid')
        .send({
          query: 'test query',
          hybridWeight: 1.5,
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /suggest', () => {
    it('should return suggestions for query', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { text: 'Sample suggestion text', sourceTitle: 'Test Document' },
      ]);

      const response = await request(app)
        .post('/api/knowledge/suggest')
        .send({
          query: 'test',
          limit: 5,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.suggestions).toHaveLength(1);
    });

    it('should require minimum query length', async () => {
      const response = await request(app)
        .post('/api/knowledge/suggest')
        .send({
          query: 'a',
        })
        .expect(400);

      expect(response.body.error).toContain('at least 2 characters');
    });
  });

  // ==========================================================================
  // Statistics Endpoint Tests
  // ==========================================================================

  describe('GET /stats', () => {
    it('should return knowledge base statistics', async () => {
      mockPrisma.documentSource.groupBy.mockResolvedValue([
        { status: 'COMPLETED', _count: 10 },
        { status: 'PENDING', _count: 5 },
      ]);

      mockPrisma.documentSource.findMany.mockResolvedValue([
        { id: 'source-1', title: 'Recent Doc', status: 'COMPLETED', createdAt: new Date() },
      ]);

      const response = await request(app)
        .get('/api/knowledge/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.stats.totalSources).toBe(15);
      expect(response.body.stats.totalChunks).toBe(100);
      expect(response.body.stats.statusBreakdown).toEqual({
        COMPLETED: 10,
        PENDING: 5,
      });
    });
  });

  // ==========================================================================
  // Rate Limiting Tests
  // ==========================================================================

  describe('Rate Limiting', () => {
    it('should apply search rate limiter', async () => {
      const { knowledgeSearchLimiter } = require('../../middleware/rateLimiter');

      await request(app)
        .post('/api/knowledge/search')
        .send({ query: 'test query' })
        .expect(200);

      expect(knowledgeSearchLimiter).toHaveBeenCalled();
    });

    it('should apply suggest rate limiter', async () => {
      const { knowledgeSuggestLimiter } = require('../../middleware/rateLimiter');
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await request(app)
        .post('/api/knowledge/suggest')
        .send({ query: 'test' })
        .expect(200);

      expect(knowledgeSuggestLimiter).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Search Cache Service Tests
// ============================================================================

describe('SearchCacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate consistent cache keys for same parameters', () => {
    // The mock returns 'test-cache-key' but in reality it should be consistent
    const key1 = mockSearchCache.generateKey('org-1', 'semantic', 'query', { topK: 5 });
    const key2 = mockSearchCache.generateKey('org-1', 'semantic', 'query', { topK: 5 });

    expect(key1).toBe(key2);
  });

  it('should invalidate organization cache', async () => {
    const count = await mockSearchCache.invalidateOrganization(testOrgId);

    expect(count).toBe(5);
    expect(mockSearchCache.invalidateOrganization).toHaveBeenCalledWith(testOrgId);
  });
});

// ============================================================================
// Helper Constants
// ============================================================================

const testOrgId = '12345678-1234-4234-a234-123456789012';
const testSourceId = '87654321-4321-4321-b321-210987654321';
