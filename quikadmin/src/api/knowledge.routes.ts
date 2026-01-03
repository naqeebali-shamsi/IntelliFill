/**
 * Knowledge API Routes
 *
 * REST API endpoints for the Knowledge Base and Vector Search functionality.
 * Implements requirements from PRD Vector Search v2.0:
 * - Task #130: Knowledge API Routes
 * - Task #131: Semantic Search endpoint
 * - Task #132: Hybrid Search endpoint
 *
 * All endpoints require authentication and organization isolation.
 *
 * @module api/knowledge.routes
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import { Prisma, DocumentSourceStatus } from '@prisma/client';
import { authenticateSupabase } from '../middleware/supabaseAuth';
import { requireOrganization, OrganizationRequest } from '../middleware/organizationContext';
import { prisma } from '../utils/prisma';
import {
  knowledgeSearchLimiter,
  knowledgeSuggestLimiter,
  knowledgeUploadLimiter,
} from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import { createVectorStorageService } from '../services/vectorStorage.service';
import { getEmbeddingService } from '../services/embedding.service';
import { getSearchCacheService } from '../services/searchCache.service';
import {
  getFormSuggestionService,
  FormSuggestionsRequest,
} from '../services/formSuggestion.service';
import { fileValidationService } from '../services/fileValidation.service';

// ============================================================================
// Types & Interfaces
// ============================================================================

// Use OrganizationRequest from middleware (extends AuthenticatedRequest)
type KnowledgeRequest = OrganizationRequest;

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Semantic search request validation schema
 * - query: 3-1000 characters
 * - topK: 1-50 results (default: 5)
 * - minScore: 0-1 similarity threshold (default: 0.5)
 */
const semanticSearchSchema = z.object({
  query: z
    .string()
    .min(3, 'Query must be at least 3 characters')
    .max(1000, 'Query must not exceed 1000 characters'),
  topK: z.number().int().min(1).max(50).default(5),
  minScore: z.number().min(0).max(1).default(0.5),
  sourceIds: z.array(z.string().uuid()).optional(),
});

/**
 * Hybrid search request validation schema
 * Extends semantic search with hybrid-specific options
 */
const hybridSearchSchema = semanticSearchSchema.extend({
  hybridMode: z.enum(['balanced', 'semantic', 'keyword']).default('balanced'),
  hybridWeight: z.number().min(0).max(1).optional(),
});

/**
 * Form suggestions request validation schema
 * Validates field names and suggestion parameters
 */
const formSuggestSchema = z.object({
  formId: z.string().uuid().optional(),
  fieldNames: z.array(z.string().min(1).max(100)).min(1).max(50),
  fieldTypes: z
    .record(z.string(), z.enum(['text', 'date', 'email', 'phone', 'number', 'address', 'name']))
    .optional(),
  context: z.string().max(500).optional(),
  maxSuggestions: z.number().int().min(1).max(20).default(5),
});

/**
 * Single field suggestion request schema
 */
const fieldSuggestSchema = z.object({
  fieldName: z.string().min(1).max(100),
  fieldType: z.enum(['text', 'date', 'email', 'phone', 'number', 'address', 'name']).optional(),
  context: z.string().max(500).optional(),
  formContext: z.string().max(1000).optional(),
  maxSuggestions: z.number().int().min(1).max(20).default(5),
});

/**
 * Contextual suggestions request schema
 */
const contextualSuggestSchema = z.object({
  fieldName: z.string().min(1).max(100),
  filledFields: z.record(z.string(), z.string().max(500)),
  maxSuggestions: z.number().int().min(1).max(20).default(5),
});

/**
 * Document source upload validation
 * Note: Schema aligned with Prisma DocumentSource model
 */
const uploadSourceSchema = z.object({
  title: z.string().min(1).max(255),
});

// ============================================================================
// Middleware
// ============================================================================

// Organization validation is handled by requireOrganization from organizationContext middleware
// See: ../middleware/organizationContext.ts

/**
 * Audit logging middleware for knowledge operations
 */
function auditLogger(action: string) {
  return (req: KnowledgeRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Log on response finish
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.info('Knowledge API audit', {
        action,
        userId: req.user?.id,
        organizationId: req.organizationId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    });

    next();
  };
}

// ============================================================================
// File Upload Configuration
// ============================================================================

/**
 * Custom error class for file validation failures
 */
class FileValidationError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'FileValidationError';
    this.code = code;
  }
}

const knowledgeAllowedTypes = ['.pdf', '.docx', '.doc', '.txt', '.csv'];
const knowledgeMimeTypes: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.doc': ['application/msword'],
  '.txt': ['text/plain'],
  '.csv': ['text/csv', 'application/csv'],
};

const storage = multer.diskStorage({
  destination: 'uploads/knowledge/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `knowledge-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for knowledge documents
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    // Check for double extensions (e.g., file.pdf.exe)
    const doubleExtCheck = fileValidationService.hasDoubleExtension(
      file.originalname,
      knowledgeAllowedTypes
    );
    if (doubleExtCheck.isDouble) {
      logger.warn('Double extension attack detected in knowledge upload', {
        filename: file.originalname,
        extensions: doubleExtCheck.extensions,
        dangerousExtension: doubleExtCheck.dangerousExtension,
      });
      return cb(
        new FileValidationError(
          `Suspicious double extension detected: ${file.originalname}. File rejected for security reasons.`,
          'DOUBLE_EXTENSION'
        )
      );
    }

    // Check for MIME type spoofing
    const expectedMimes = knowledgeMimeTypes[ext];
    if (expectedMimes && !expectedMimes.includes(file.mimetype)) {
      logger.warn('MIME type spoofing detected in knowledge upload', {
        filename: file.originalname,
        extension: ext,
        declaredMimeType: file.mimetype,
        expectedMimeTypes: expectedMimes,
      });
      return cb(
        new FileValidationError(
          `MIME type mismatch: file extension ${ext} does not match declared type ${file.mimetype}`,
          'MIME_TYPE_MISMATCH'
        )
      );
    }

    if (knowledgeAllowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not supported for knowledge base`));
    }
  },
});

// ============================================================================
// Route Factory
// ============================================================================

export function createKnowledgeRoutes(): Router {
  const router = Router();
  // Uses singleton prisma client from utils/prisma
  const vectorStorage = createVectorStorageService(prisma);
  const embeddingService = getEmbeddingService();
  const searchCache = getSearchCacheService();
  const formSuggestionService = getFormSuggestionService(prisma);

  // ==========================================================================
  // Document Source Endpoints
  // ==========================================================================

  /**
   * POST /api/knowledge/sources/upload
   * Upload a new document to the knowledge base
   */
  router.post(
    '/sources/upload',
    authenticateSupabase,
    requireOrganization,
    knowledgeUploadLimiter,
    auditLogger('knowledge:source:upload'),
    upload.single('document'),
    async (req: KnowledgeRequest, res: Response, next: NextFunction) => {
      try {
        const organizationId = req.organizationId;
        const userId = req.user?.id;

        if (!organizationId || !userId) {
          return res.status(401).json({ error: 'Authentication and organization required' });
        }

        // Validate request body
        const bodyResult = uploadSourceSchema.safeParse(req.body);
        if (!bodyResult.success) {
          return res.status(400).json({
            error: 'Validation failed',
            details: bodyResult.error.errors,
          });
        }

        const { title } = bodyResult.data;

        if (!req.file) {
          return res.status(400).json({ error: 'Document file is required' });
        }

        // Create document source record
        const source = await prisma.documentSource.create({
          data: {
            organizationId,
            userId,
            title,
            filename: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            storageUrl: req.file.path,
            status: 'PENDING',
          },
        });

        // Invalidate search cache for this organization
        await searchCache.invalidateOrganization(organizationId);

        logger.info('Knowledge source uploaded', {
          sourceId: source.id,
          organizationId,
          userId,
          filename: req.file.originalname,
        });

        res.status(201).json({
          success: true,
          source: {
            id: source.id,
            title: source.title,
            status: source.status,
            filename: source.filename,
            fileSize: source.fileSize,
            createdAt: source.createdAt,
          },
          message: 'Document uploaded successfully. Processing will begin shortly.',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/knowledge/sources
   * List all document sources for the organization
   */
  router.get(
    '/sources',
    authenticateSupabase,
    requireOrganization,
    auditLogger('knowledge:source:list'),
    async (req: KnowledgeRequest, res: Response, next: NextFunction) => {
      try {
        const organizationId = req.organizationId;
        if (!organizationId) {
          return res.status(403).json({ error: 'Organization required' });
        }
        const { status, limit = 50, offset = 0, search } = req.query;

        const where: Prisma.DocumentSourceWhereInput = {
          organizationId,
          deletedAt: null,
        };

        if (status) {
          where.status = status as DocumentSourceStatus;
        }

        if (search) {
          where.title = { contains: search as string, mode: 'insensitive' };
        }

        const [sources, total] = await Promise.all([
          prisma.documentSource.findMany({
            where,
            select: {
              id: true,
              title: true,
              filename: true,
              fileSize: true,
              mimeType: true,
              status: true,
              chunkCount: true,
              processingTimeMs: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: Number(limit),
            skip: Number(offset),
          }),
          prisma.documentSource.count({ where }),
        ]);

        res.json({
          success: true,
          sources,
          pagination: {
            total,
            limit: Number(limit),
            offset: Number(offset),
            hasMore: Number(offset) + sources.length < total,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/knowledge/sources/:id
   * Get details of a specific document source
   */
  router.get(
    '/sources/:id',
    authenticateSupabase,
    requireOrganization,
    auditLogger('knowledge:source:get'),
    async (req: KnowledgeRequest, res: Response, next: NextFunction) => {
      try {
        const organizationId = req.organizationId!;
        const { id } = req.params;

        const source = await prisma.documentSource.findFirst({
          where: {
            id,
            organizationId,
            deletedAt: null,
          },
          include: {
            _count: {
              select: { chunks: true },
            },
          },
        });

        if (!source) {
          return res.status(404).json({ error: 'Document source not found' });
        }

        res.json({
          success: true,
          source: {
            ...source,
            chunkCount: source._count.chunks,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /api/knowledge/sources/:id
   * Soft delete a document source and its chunks
   */
  router.delete(
    '/sources/:id',
    authenticateSupabase,
    requireOrganization,
    auditLogger('knowledge:source:delete'),
    async (req: KnowledgeRequest, res: Response, next: NextFunction) => {
      try {
        const organizationId = req.organizationId!;
        const { id } = req.params;

        // Verify ownership
        const source = await prisma.documentSource.findFirst({
          where: {
            id,
            organizationId,
            deletedAt: null,
          },
        });

        if (!source) {
          return res.status(404).json({ error: 'Document source not found' });
        }

        // Soft delete the source (chunks cascade via FK)
        await prisma.documentSource.update({
          where: { id },
          data: { deletedAt: new Date() },
        });

        // Delete associated chunks from vector storage
        await vectorStorage.deleteChunksBySource(id, organizationId);

        // Invalidate search cache
        await searchCache.invalidateOrganization(organizationId);

        res.json({
          success: true,
          message: 'Document source deleted successfully',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/knowledge/sources/batch
   * Batch get multiple document sources by IDs
   * More efficient than multiple individual GET requests for polling
   */
  router.post(
    '/sources/batch',
    authenticateSupabase,
    requireOrganization,
    auditLogger('knowledge:source:batch'),
    async (req: KnowledgeRequest, res: Response, next: NextFunction) => {
      try {
        const organizationId = req.organizationId!;
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'IDs array required',
          });
        }

        // Limit batch size to prevent abuse
        if (ids.length > 50) {
          return res.status(400).json({
            success: false,
            error: 'Maximum 50 IDs per batch',
          });
        }

        const sources = await prisma.documentSource.findMany({
          where: {
            id: { in: ids },
            organizationId,
            deletedAt: null,
          },
          select: {
            id: true,
            title: true,
            filename: true,
            fileSize: true,
            mimeType: true,
            status: true,
            chunkCount: true,
            processingTimeMs: true,
            errorMessage: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        res.json({
          success: true,
          sources,
        });
      } catch (error) {
        next(error);
      }
    }
  );
  /**
   * GET /api/knowledge/sources/:id/status
   * Get processing status of a document source
   */
  router.get(
    '/sources/:id/status',
    authenticateSupabase,
    requireOrganization,
    auditLogger('knowledge:source:status'),
    async (req: KnowledgeRequest, res: Response, next: NextFunction) => {
      try {
        const organizationId = req.organizationId!;
        const { id } = req.params;

        const source = await prisma.documentSource.findFirst({
          where: {
            id,
            organizationId,
          },
          select: {
            id: true,
            status: true,
            errorMessage: true,
            chunkCount: true,
            processingTimeMs: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        if (!source) {
          return res.status(404).json({ error: 'Document source not found' });
        }

        // Get checkpoint if exists
        const checkpoint = await prisma.processingCheckpoint.findUnique({
          where: { sourceId: id },
        });

        res.json({
          success: true,
          status: {
            ...source,
            progress: checkpoint
              ? {
                  stage: checkpoint.stage,
                  completedChunks: checkpoint.lastCompletedChunkIndex,
                  totalChunks: checkpoint.totalChunks,
                  percentage: Math.round(
                    (checkpoint.lastCompletedChunkIndex / checkpoint.totalChunks) * 100
                  ),
                }
              : null,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ==========================================================================
  // Search Endpoints
  // ==========================================================================

  /**
   * POST /api/knowledge/search
   * Semantic search using vector similarity
   * Rate limit: 20/min per organization
   */
  router.post(
    '/search',
    authenticateSupabase,
    requireOrganization,
    knowledgeSearchLimiter,
    auditLogger('knowledge:search:semantic'),
    async (req: KnowledgeRequest, res: Response, next: NextFunction) => {
      try {
        const organizationId = req.organizationId!;
        const startTime = Date.now();

        // Validate request
        const result = semanticSearchSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({
            error: 'Validation failed',
            details: result.error.errors,
          });
        }

        const { query, topK, minScore, sourceIds } = result.data;

        // Check cache first
        const cacheKey = searchCache.generateKey(organizationId, 'semantic', query, {
          topK,
          minScore,
          sourceIds,
        });
        const cachedResult = await searchCache.get(cacheKey);
        if (cachedResult) {
          logger.debug('Search cache hit', { organizationId, cacheKey });
          return res.json({
            success: true,
            ...cachedResult,
            cached: true,
            searchTime: Date.now() - startTime,
          });
        }

        // Generate query embedding
        const embeddingResult = await embeddingService.generateEmbedding(query, organizationId);

        // Perform vector search
        const results = await vectorStorage.searchSimilar(
          embeddingResult.embedding,
          organizationId,
          { topK, minScore, sourceIds }
        );

        const searchTime = Date.now() - startTime;

        // Cache the results
        const response = {
          results,
          query,
          totalResults: results.length,
          searchParams: { topK, minScore, sourceIds },
        };
        await searchCache.set(cacheKey, response);

        logger.info('Semantic search completed', {
          organizationId,
          query: query.substring(0, 50),
          resultsCount: results.length,
          searchTime,
        });

        res.json({
          success: true,
          ...response,
          cached: false,
          searchTime,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/knowledge/search/hybrid
   * Hybrid search combining vector similarity and full-text search
   */
  router.post(
    '/search/hybrid',
    authenticateSupabase,
    requireOrganization,
    knowledgeSearchLimiter,
    auditLogger('knowledge:search:hybrid'),
    async (req: KnowledgeRequest, res: Response, next: NextFunction) => {
      try {
        const organizationId = req.organizationId!;
        const startTime = Date.now();

        // Validate request
        const result = hybridSearchSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({
            error: 'Validation failed',
            details: result.error.errors,
          });
        }

        const { query, topK, minScore, sourceIds, hybridMode, hybridWeight } = result.data;

        // Determine vector weight based on mode
        let vectorWeight: number;
        switch (hybridMode) {
          case 'semantic':
            vectorWeight = 0.9;
            break;
          case 'keyword':
            vectorWeight = 0.3;
            break;
          case 'balanced':
          default:
            vectorWeight = hybridWeight ?? 0.7;
        }

        // Check cache first
        const cacheKey = searchCache.generateKey(organizationId, 'hybrid', query, {
          topK,
          minScore,
          sourceIds,
          hybridMode,
          vectorWeight,
        });
        const cachedResult = await searchCache.get(cacheKey);
        if (cachedResult) {
          logger.debug('Hybrid search cache hit', { organizationId, cacheKey });
          return res.json({
            success: true,
            ...cachedResult,
            cached: true,
            searchTime: Date.now() - startTime,
          });
        }

        // Generate query embedding
        const embeddingResult = await embeddingService.generateEmbedding(query, organizationId);

        // Perform hybrid search
        const results = await vectorStorage.hybridSearch(
          query,
          embeddingResult.embedding,
          organizationId,
          { topK, minScore, sourceIds, vectorWeight }
        );

        const searchTime = Date.now() - startTime;

        // Cache the results
        const response = {
          results,
          query,
          totalResults: results.length,
          searchParams: { topK, minScore, sourceIds, hybridMode, vectorWeight },
        };
        await searchCache.set(cacheKey, response);

        logger.info('Hybrid search completed', {
          organizationId,
          query: query.substring(0, 50),
          hybridMode,
          vectorWeight,
          resultsCount: results.length,
          searchTime,
        });

        res.json({
          success: true,
          ...response,
          cached: false,
          searchTime,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/knowledge/suggest
   * Quick autocomplete suggestions based on query prefix
   * Rate limit: 30/min per organization
   */
  router.post(
    '/suggest',
    authenticateSupabase,
    requireOrganization,
    knowledgeSuggestLimiter,
    auditLogger('knowledge:suggest'),
    async (req: KnowledgeRequest, res: Response, next: NextFunction) => {
      try {
        const organizationId = req.organizationId;
        if (!organizationId) {
          return res.status(403).json({ error: 'Organization required' });
        }
        const { query, limit = 5 } = req.body;

        if (!query || query.length < 2) {
          return res.status(400).json({
            error: 'Query must be at least 2 characters',
          });
        }

        // Use full-text search for suggestions
        const suggestions = await prisma.$queryRaw<{ text: string; sourceTitle: string }[]>`
          SELECT DISTINCT
            SUBSTRING(dc.text, 1, 200) as text,
            ds.title as "sourceTitle"
          FROM document_chunks dc
          JOIN document_sources ds ON dc.source_id = ds.id
          WHERE dc.organization_id = ${organizationId}::text
            AND ds.deleted_at IS NULL
            AND dc.text ILIKE ${'%' + query + '%'}
          LIMIT ${Number(limit)}
        `;

        res.json({
          success: true,
          suggestions,
          query,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ==========================================================================
  // Form Suggestion Endpoints
  // ==========================================================================

  /**
   * POST /api/knowledge/suggest/form
   * Get field suggestions for form auto-fill
   * Rate limit: 30/min per organization
   *
   * Request body:
   * - formId (optional): UUID of the form being filled
   * - fieldNames: Array of field names to get suggestions for
   * - fieldTypes (optional): Map of field name to type hint
   * - context (optional): Additional context about the form
   * - maxSuggestions (optional): Max suggestions per field (default: 5)
   *
   * Response:
   * - fields: Map of field name to array of suggestions
   * - totalSearchTime: Total time in milliseconds
   * - cacheHits: Number of cached results used
   */
  router.post(
    '/suggest/form',
    authenticateSupabase,
    requireOrganization,
    knowledgeSuggestLimiter,
    auditLogger('knowledge:suggest:form'),
    async (req: KnowledgeRequest, res: Response, next: NextFunction) => {
      try {
        const organizationId = req.organizationId!;
        const startTime = Date.now();

        // Validate request
        const result = formSuggestSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({
            error: 'Validation failed',
            details: result.error.errors,
          });
        }

        const { formId, fieldNames, fieldTypes, context, maxSuggestions } = result.data;

        const suggestionsResult = await formSuggestionService.getFormSuggestions(
          {
            formId,
            fieldNames,
            fieldTypes: fieldTypes as FormSuggestionsRequest['fieldTypes'],
            context,
            maxSuggestions,
          },
          organizationId
        );

        logger.info('Form suggestions generated', {
          organizationId,
          formId,
          fieldsCount: fieldNames.length,
          totalSearchTime: suggestionsResult.totalSearchTime,
          cacheHits: suggestionsResult.cacheHits,
        });

        res.json({
          success: true,
          ...suggestionsResult,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/knowledge/suggest/field
   * Get suggestions for a single form field
   * Rate limit: 30/min per organization
   */
  router.post(
    '/suggest/field',
    authenticateSupabase,
    requireOrganization,
    knowledgeSuggestLimiter,
    auditLogger('knowledge:suggest:field'),
    async (req: KnowledgeRequest, res: Response, next: NextFunction) => {
      try {
        const organizationId = req.organizationId;
        if (!organizationId) {
          return res.status(403).json({ error: 'Organization required' });
        }

        // Validate request
        const result = fieldSuggestSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({
            error: 'Validation failed',
            details: result.error.errors,
          });
        }

        const { fieldName, fieldType, context, formContext, maxSuggestions } = result.data;

        const suggestionsResult = await formSuggestionService.getFieldSuggestions(
          {
            fieldName,
            fieldType: fieldType as
              | 'text'
              | 'date'
              | 'email'
              | 'phone'
              | 'number'
              | 'address'
              | 'name',
            context,
            formContext,
          },
          organizationId,
          maxSuggestions
        );

        logger.info('Field suggestions generated', {
          organizationId,
          fieldName,
          suggestionsCount: suggestionsResult.suggestions.length,
          searchTime: suggestionsResult.searchTime,
        });

        res.json({
          success: true,
          ...suggestionsResult,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/knowledge/suggest/contextual
   * Get contextual suggestions based on already-filled fields
   * Rate limit: 30/min per organization
   */
  router.post(
    '/suggest/contextual',
    authenticateSupabase,
    requireOrganization,
    knowledgeSuggestLimiter,
    auditLogger('knowledge:suggest:contextual'),
    async (req: KnowledgeRequest, res: Response, next: NextFunction) => {
      try {
        const organizationId = req.organizationId;
        if (!organizationId) {
          return res.status(403).json({ error: 'Organization required' });
        }

        // Validate request
        const result = contextualSuggestSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({
            error: 'Validation failed',
            details: result.error.errors,
          });
        }

        const { fieldName, filledFields, maxSuggestions } = result.data;

        const suggestionsResult = await formSuggestionService.getContextualSuggestions(
          fieldName,
          filledFields,
          organizationId,
          maxSuggestions
        );

        logger.info('Contextual suggestions generated', {
          organizationId,
          fieldName,
          filledFieldsCount: Object.keys(filledFields).length,
          suggestionsCount: suggestionsResult.suggestions.length,
          searchTime: suggestionsResult.searchTime,
        });

        res.json({
          success: true,
          ...suggestionsResult,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ==========================================================================
  // Statistics Endpoints
  // ==========================================================================

  /**
   * GET /api/knowledge/stats
   * Get knowledge base statistics for the organization
   */
  router.get(
    '/stats',
    authenticateSupabase,
    requireOrganization,
    auditLogger('knowledge:stats'),
    async (req: KnowledgeRequest, res: Response, next: NextFunction) => {
      try {
        const organizationId = req.organizationId;
        if (!organizationId) {
          return res.status(403).json({ error: 'Organization required' });
        }

        const [sourceStats, chunkCount, recentSources] = await Promise.all([
          prisma.documentSource.groupBy({
            by: ['status'],
            where: {
              organizationId,
              deletedAt: null,
            },
            _count: true,
          }),
          vectorStorage.getOrganizationChunkCount(organizationId),
          prisma.documentSource.findMany({
            where: {
              organizationId,
              deletedAt: null,
            },
            select: {
              id: true,
              title: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
        ]);

        // Calculate totals
        const statusCounts: Record<string, number> = {};
        let totalSources = 0;
        for (const stat of sourceStats) {
          statusCounts[stat.status] = stat._count;
          totalSources += stat._count;
        }

        res.json({
          success: true,
          stats: {
            totalSources,
            totalChunks: chunkCount,
            statusBreakdown: statusCounts,
            recentSources,
            embeddingQuota: embeddingService.getRemainingQuota(organizationId),
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

export default createKnowledgeRoutes;
