/**
 * Vector Storage Service
 *
 * Abstraction layer for pgvector operations with proper security controls.
 * Implements requirements from PRD Vector Search v2.0:
 * - ARCH-001: Prisma + pgvector integration
 * - VULN-001: Mandatory organization isolation
 * - VULN-005: SQL injection prevention via parameterized queries
 *
 * Critical service for vector search functionality.
 *
 * @module services/vectorStorage.service
 */

import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';
import { logger } from '../utils/logger';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ChunkInsertData {
  sourceId: string;
  organizationId: string;
  text: string;
  tokenCount: number;
  chunkIndex: number;
  embedding: number[];
  pageNumber?: number;
  sectionHeader?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  sourceId: string;
  sourceTitle: string;
  text: string;
  pageNumber: number | null;
  sectionHeader: string | null;
  chunkIndex: number;
  similarity: number;
}

export interface HybridSearchResult extends SearchResult {
  vectorScore: number;
  keywordScore: number;
  finalScore: number;
}

export interface SearchOptions {
  topK?: number;
  minScore?: number;
  sourceIds?: string[];
  pageNumbers?: number[];
}

export interface HybridSearchOptions extends SearchOptions {
  vectorWeight?: number;
  keywordWeight?: number;
}

// ============================================================================
// Constants
// ============================================================================

const EMBEDDING_DIMENSIONS = 768;
const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SCORE = 0.5;
const DEFAULT_VECTOR_WEIGHT = 0.7;

// ============================================================================
// Vector Storage Service Class
// ============================================================================

export class VectorStorageService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // ==========================================================================
  // Organization Context Management
  // ==========================================================================

  /**
   * Set the organization context for Row-Level Security
   * MUST be called before any vector operations
   *
   * @param organizationId - Organization UUID
   */
  async setOrganizationContext(organizationId: string): Promise<void> {
    if (!organizationId) {
      throw new Error('organizationId is REQUIRED for vector operations');
    }

    this.validateUUID(organizationId);

    await this.prisma.$executeRaw`
      SELECT set_config('app.current_organization_id', ${organizationId}, true)
    `;
  }

  // ==========================================================================
  // Chunk Operations
  // ==========================================================================

  /**
   * Insert a document chunk with embedding
   * Uses raw SQL with proper parameterization for pgvector
   *
   * @param chunk - Chunk data including embedding
   * @returns Inserted chunk ID
   */
  async insertChunk(chunk: ChunkInsertData): Promise<string> {
    // Validate required fields
    if (!chunk.organizationId) {
      throw new Error('organizationId is REQUIRED for chunk insertion');
    }

    this.validateUUID(chunk.sourceId);
    this.validateUUID(chunk.organizationId);
    this.validateEmbedding(chunk.embedding);

    const id = crypto.randomUUID();
    const textHash = this.generateTextHash(chunk.text);
    const vectorString = this.toPgVector(chunk.embedding);
    const metadata = JSON.stringify(chunk.metadata || {});

    try {
      // Set organization context for RLS
      await this.setOrganizationContext(chunk.organizationId);

      // Use tagged template literal for SQL injection prevention
      await this.prisma.$executeRaw`
        INSERT INTO document_chunks (
          id, source_id, organization_id, text, token_count, text_hash,
          chunk_index, page_number, section_header, embedding, metadata,
          created_at, updated_at
        ) VALUES (
          ${id}::text,
          ${chunk.sourceId}::text,
          ${chunk.organizationId}::text,
          ${chunk.text},
          ${chunk.tokenCount},
          ${textHash},
          ${chunk.chunkIndex},
          ${chunk.pageNumber ?? null},
          ${chunk.sectionHeader ?? null},
          ${vectorString}::vector(768),
          ${metadata}::jsonb,
          NOW(),
          NOW()
        )
      `;

      logger.debug('Chunk inserted successfully', {
        chunkId: id,
        sourceId: chunk.sourceId,
        chunkIndex: chunk.chunkIndex,
      });

      return id;
    } catch (error) {
      logger.error('Failed to insert chunk', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sourceId: chunk.sourceId,
        chunkIndex: chunk.chunkIndex,
      });
      throw error;
    }
  }

  /**
   * Insert multiple chunks in a batch
   * More efficient than individual inserts
   *
   * @param chunks - Array of chunk data
   * @returns Array of inserted chunk IDs
   */
  async insertChunksBatch(chunks: ChunkInsertData[]): Promise<string[]> {
    if (chunks.length === 0) {
      return [];
    }

    // All chunks must belong to same organization
    const organizationId = chunks[0].organizationId;
    if (chunks.some((c) => c.organizationId !== organizationId)) {
      throw new Error('All chunks in batch must belong to same organization');
    }

    await this.setOrganizationContext(organizationId);

    const ids: string[] = [];

    // Use transaction for batch insert
    await this.prisma.$transaction(async (tx) => {
      for (const chunk of chunks) {
        const id = await this.insertChunkWithTransaction(tx, chunk);
        ids.push(id);
      }
    });

    logger.info('Batch insert completed', {
      count: ids.length,
      sourceId: chunks[0].sourceId,
    });

    return ids;
  }

  private async insertChunkWithTransaction(
    tx: Prisma.TransactionClient,
    chunk: ChunkInsertData
  ): Promise<string> {
    this.validateEmbedding(chunk.embedding);

    const id = crypto.randomUUID();
    const textHash = this.generateTextHash(chunk.text);
    const vectorString = this.toPgVector(chunk.embedding);
    const metadata = JSON.stringify(chunk.metadata || {});

    await tx.$executeRaw`
      INSERT INTO document_chunks (
        id, source_id, organization_id, text, token_count, text_hash,
        chunk_index, page_number, section_header, embedding, metadata,
        created_at, updated_at
      ) VALUES (
        ${id}::text,
        ${chunk.sourceId}::text,
        ${chunk.organizationId}::text,
        ${chunk.text},
        ${chunk.tokenCount},
        ${textHash},
        ${chunk.chunkIndex},
        ${chunk.pageNumber ?? null},
        ${chunk.sectionHeader ?? null},
        ${vectorString}::vector(768),
        ${metadata}::jsonb,
        NOW(),
        NOW()
      )
    `;

    return id;
  }

  // ==========================================================================
  // Search Operations
  // ==========================================================================

  /**
   * Search for similar chunks using vector similarity
   * MANDATORY organization filtering for data isolation
   *
   * @param queryEmbedding - Query vector (768 dimensions)
   * @param organizationId - Organization UUID (REQUIRED)
   * @param options - Search options
   * @returns Array of search results
   */
  async searchSimilar(
    queryEmbedding: number[],
    organizationId: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    // Validate MANDATORY organizationId
    if (!organizationId) {
      throw new Error('organizationId is REQUIRED for vector search');
    }

    this.validateUUID(organizationId);
    this.validateEmbedding(queryEmbedding);

    const topK = options.topK ?? DEFAULT_TOP_K;
    const minScore = options.minScore ?? DEFAULT_MIN_SCORE;

    // Set organization context for RLS
    await this.setOrganizationContext(organizationId);

    const vectorString = this.toPgVector(queryEmbedding);

    try {
      let results: SearchResult[];

      if (options.sourceIds && options.sourceIds.length > 0) {
        // Validate all source IDs
        options.sourceIds.forEach((id) => this.validateUUID(id));

        results = await this.prisma.$queryRaw<SearchResult[]>`
          SELECT
            dc.id,
            dc.source_id as "sourceId",
            ds.title as "sourceTitle",
            dc.text,
            dc.page_number as "pageNumber",
            dc.section_header as "sectionHeader",
            dc.chunk_index as "chunkIndex",
            1 - (dc.embedding <=> ${vectorString}::vector(768)) as similarity
          FROM document_chunks dc
          JOIN document_sources ds ON dc.source_id = ds.id
          WHERE dc.organization_id = ${organizationId}::text
            AND ds.organization_id = ${organizationId}::text
            AND ds.deleted_at IS NULL
            AND dc.source_id = ANY(${options.sourceIds}::text[])
          ORDER BY dc.embedding <=> ${vectorString}::vector(768)
          LIMIT ${topK}
        `;
      } else {
        results = await this.prisma.$queryRaw<SearchResult[]>`
          SELECT
            dc.id,
            dc.source_id as "sourceId",
            ds.title as "sourceTitle",
            dc.text,
            dc.page_number as "pageNumber",
            dc.section_header as "sectionHeader",
            dc.chunk_index as "chunkIndex",
            1 - (dc.embedding <=> ${vectorString}::vector(768)) as similarity
          FROM document_chunks dc
          JOIN document_sources ds ON dc.source_id = ds.id
          WHERE dc.organization_id = ${organizationId}::text
            AND ds.organization_id = ${organizationId}::text
            AND ds.deleted_at IS NULL
          ORDER BY dc.embedding <=> ${vectorString}::vector(768)
          LIMIT ${topK}
        `;
      }

      // Filter by minimum score
      const filteredResults = results.filter((r) => r.similarity >= minScore);

      logger.debug('Vector search completed', {
        organizationId,
        resultsCount: filteredResults.length,
        topK,
        minScore,
      });

      return filteredResults;
    } catch (error) {
      logger.error('Vector search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId,
      });
      throw error;
    }
  }

  /**
   * Hybrid search combining vector similarity and full-text search
   * Uses weighted combination of scores
   *
   * @param query - Text query for keyword search
   * @param queryEmbedding - Query vector for similarity search
   * @param organizationId - Organization UUID (REQUIRED)
   * @param options - Hybrid search options
   * @returns Array of hybrid search results
   */
  async hybridSearch(
    query: string,
    queryEmbedding: number[],
    organizationId: string,
    options: HybridSearchOptions = {}
  ): Promise<HybridSearchResult[]> {
    // Validate MANDATORY organizationId
    if (!organizationId) {
      throw new Error('organizationId is REQUIRED for hybrid search');
    }

    this.validateUUID(organizationId);
    this.validateEmbedding(queryEmbedding);

    const topK = options.topK ?? DEFAULT_TOP_K;
    const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
    const vectorWeight = options.vectorWeight ?? DEFAULT_VECTOR_WEIGHT;
    const keywordWeight = 1 - vectorWeight;

    // Sanitize query for full-text search (escape special characters)
    const sanitizedQuery = this.sanitizeTextSearchQuery(query);

    await this.setOrganizationContext(organizationId);

    const vectorString = this.toPgVector(queryEmbedding);

    try {
      const results = await this.prisma.$queryRaw<HybridSearchResult[]>`
        WITH vector_results AS (
          SELECT
            dc.id,
            dc.source_id,
            dc.text,
            dc.page_number,
            dc.section_header,
            dc.chunk_index,
            1 - (dc.embedding <=> ${vectorString}::vector(768)) as vector_score
          FROM document_chunks dc
          JOIN document_sources ds ON dc.source_id = ds.id
          WHERE dc.organization_id = ${organizationId}::text
            AND ds.organization_id = ${organizationId}::text
            AND ds.deleted_at IS NULL
        ),
        keyword_results AS (
          SELECT
            dc.id,
            ts_rank(dc.text_search, plainto_tsquery('english', ${sanitizedQuery})) as keyword_score
          FROM document_chunks dc
          WHERE dc.organization_id = ${organizationId}::text
            AND dc.text_search @@ plainto_tsquery('english', ${sanitizedQuery})
        )
        SELECT
          vr.id,
          vr.source_id as "sourceId",
          ds.title as "sourceTitle",
          vr.text,
          vr.page_number as "pageNumber",
          vr.section_header as "sectionHeader",
          vr.chunk_index as "chunkIndex",
          vr.vector_score as "vectorScore",
          COALESCE(kr.keyword_score, 0) as "keywordScore",
          vr.vector_score as similarity,
          (vr.vector_score * ${vectorWeight} + COALESCE(kr.keyword_score, 0) * ${keywordWeight}) as "finalScore"
        FROM vector_results vr
        JOIN document_sources ds ON vr.source_id = ds.id
        LEFT JOIN keyword_results kr ON vr.id = kr.id
        WHERE ds.organization_id = ${organizationId}::text
        ORDER BY "finalScore" DESC
        LIMIT ${topK}
      `;

      // Filter by minimum score
      const filteredResults = results.filter((r) => r.finalScore >= minScore);

      logger.debug('Hybrid search completed', {
        organizationId,
        query: query.substring(0, 50),
        resultsCount: filteredResults.length,
        vectorWeight,
      });

      return filteredResults;
    } catch (error) {
      logger.error('Hybrid search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId,
      });
      throw error;
    }
  }

  // ==========================================================================
  // Delete Operations
  // ==========================================================================

  /**
   * Delete all chunks for a document source
   * Cascades from document_sources due to FK constraint
   *
   * @param sourceId - Document source UUID
   * @param organizationId - Organization UUID (REQUIRED)
   */
  async deleteChunksBySource(
    sourceId: string,
    organizationId: string
  ): Promise<number> {
    if (!organizationId) {
      throw new Error('organizationId is REQUIRED for delete operation');
    }

    this.validateUUID(sourceId);
    this.validateUUID(organizationId);

    await this.setOrganizationContext(organizationId);

    try {
      const result = await this.prisma.$executeRaw`
        DELETE FROM document_chunks
        WHERE source_id = ${sourceId}::text
          AND organization_id = ${organizationId}::text
      `;

      logger.info('Chunks deleted', {
        sourceId,
        organizationId,
        deletedCount: result,
      });

      return Number(result);
    } catch (error) {
      logger.error('Failed to delete chunks', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sourceId,
        organizationId,
      });
      throw error;
    }
  }

  /**
   * Delete a single chunk by ID
   *
   * @param chunkId - Chunk UUID
   * @param organizationId - Organization UUID (REQUIRED)
   */
  async deleteChunk(chunkId: string, organizationId: string): Promise<boolean> {
    if (!organizationId) {
      throw new Error('organizationId is REQUIRED for delete operation');
    }

    this.validateUUID(chunkId);
    this.validateUUID(organizationId);

    await this.setOrganizationContext(organizationId);

    try {
      const result = await this.prisma.$executeRaw`
        DELETE FROM document_chunks
        WHERE id = ${chunkId}::text
          AND organization_id = ${organizationId}::text
      `;

      return Number(result) > 0;
    } catch (error) {
      logger.error('Failed to delete chunk', {
        error: error instanceof Error ? error.message : 'Unknown error',
        chunkId,
        organizationId,
      });
      throw error;
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Validate embedding array
   * Ensures correct dimensions and valid numeric values
   *
   * @param embedding - Embedding array to validate
   */
  validateEmbedding(embedding: number[]): void {
    if (!Array.isArray(embedding)) {
      throw new Error('Embedding must be an array');
    }

    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Invalid embedding dimensions: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`
      );
    }

    if (embedding.some((n) => !Number.isFinite(n))) {
      throw new Error('Embedding contains invalid numeric values');
    }

    // Check for reasonable value ranges (embeddings should be normalized)
    const maxAbs = Math.max(...embedding.map(Math.abs));
    if (maxAbs > 100) {
      logger.warn('Embedding values may not be properly normalized', {
        maxAbsValue: maxAbs,
      });
    }
  }

  /**
   * Convert embedding array to pgvector string format
   *
   * @param embedding - Embedding array
   * @returns pgvector string format [x1,x2,...]
   */
  toPgVector(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  /**
   * Generate SHA-256 hash of text for deduplication
   *
   * @param text - Text to hash
   * @returns Hex-encoded SHA-256 hash
   */
  generateTextHash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Validate UUID format
   *
   * @param uuid - UUID string to validate
   */
  private validateUUID(uuid: string): void {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      throw new Error(`Invalid UUID format: ${uuid}`);
    }
  }

  /**
   * Sanitize text for full-text search query
   * Prevents query injection
   *
   * @param query - Raw query string
   * @returns Sanitized query
   */
  private sanitizeTextSearchQuery(query: string): string {
    // Remove special PostgreSQL full-text search operators
    return query
      .replace(/[&|!():<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1000); // Limit query length
  }

  // ==========================================================================
  // Statistics & Monitoring
  // ==========================================================================

  /**
   * Get chunk count for a document source
   *
   * @param sourceId - Document source UUID
   * @param organizationId - Organization UUID (REQUIRED)
   */
  async getChunkCount(
    sourceId: string,
    organizationId: string
  ): Promise<number> {
    if (!organizationId) {
      throw new Error('organizationId is REQUIRED');
    }

    this.validateUUID(sourceId);
    this.validateUUID(organizationId);

    await this.setOrganizationContext(organizationId);

    const result = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM document_chunks
      WHERE source_id = ${sourceId}::text
        AND organization_id = ${organizationId}::text
    `;

    return Number(result[0]?.count || 0);
  }

  /**
   * Get total chunk count for organization
   *
   * @param organizationId - Organization UUID
   */
  async getOrganizationChunkCount(organizationId: string): Promise<number> {
    this.validateUUID(organizationId);

    await this.setOrganizationContext(organizationId);

    const result = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM document_chunks
      WHERE organization_id = ${organizationId}::text
    `;

    return Number(result[0]?.count || 0);
  }

  /**
   * Check if a text hash already exists (deduplication check)
   *
   * @param textHash - SHA-256 hash of text
   * @param sourceId - Document source UUID
   * @param organizationId - Organization UUID (REQUIRED)
   */
  async checkDuplicate(
    textHash: string,
    sourceId: string,
    organizationId: string
  ): Promise<boolean> {
    if (!organizationId) {
      throw new Error('organizationId is REQUIRED');
    }

    await this.setOrganizationContext(organizationId);

    const result = await this.prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM document_chunks
        WHERE text_hash = ${textHash}
          AND source_id = ${sourceId}::text
          AND organization_id = ${organizationId}::text
      ) as exists
    `;

    return result[0]?.exists || false;
  }
}

// ============================================================================
// Default Export - Factory Function
// ============================================================================

/**
 * Create a VectorStorageService instance
 *
 * @param prisma - PrismaClient instance
 * @returns VectorStorageService instance
 */
export function createVectorStorageService(
  prisma: PrismaClient
): VectorStorageService {
  return new VectorStorageService(prisma);
}

export default VectorStorageService;
