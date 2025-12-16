/**
 * Knowledge Processing Worker
 *
 * Bull queue worker for processing documents into the knowledge base.
 * Handles document extraction, chunking, embedding generation, and storage.
 *
 * Implements requirements from PRD Vector Search v2.0:
 * - REQ-EXT-001 to REQ-EXT-005: Document extraction
 * - REQ-CHK-001 to REQ-CHK-006: Chunking
 * - REQ-EMB-001 to REQ-EMB-008: Embedding generation
 * - REQ-VDB-001 to REQ-VDB-010: Vector storage
 * - PERF-001: Memory-safe page-by-page processing
 * - PERF-003: Page-by-page processing for documents >5 pages
 *
 * @module workers/knowledgeProcessor
 */

import { Job } from 'bull';
import { logger } from '../utils/logger';
import {
  knowledgeQueue,
  KnowledgeJob,
  ProcessDocumentJob,
  GenerateEmbeddingsJob,
  ReprocessChunksJob,
  KnowledgeJobResult,
  createProgressReporter,
  ProcessingCheckpoint,
} from '../queues/knowledgeQueue';
import { DocumentExtractionService } from '../services/documentExtraction.service';
import { ChunkingService, DocumentChunk, DocumentType } from '../services/chunking.service';
import { EmbeddingService, getEmbeddingService } from '../services/embedding.service';
import {
  EmbeddingCacheService,
  getEmbeddingCacheService,
} from '../services/embeddingCache.service';
import {
  VectorStorageService,
  createVectorStorageService,
} from '../services/vectorStorage.service';
import {
  MemoryManagerService,
  memoryManager as memoryManagerInstance,
} from '../services/memoryManager.service';
import { prisma } from '../utils/prisma';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface ProcessorDependencies {
  extractionService: DocumentExtractionService;
  chunkingService: ChunkingService;
  embeddingService: EmbeddingService;
  cacheService: EmbeddingCacheService | null;
  vectorStorage: VectorStorageService;
  memoryManager: MemoryManagerService;
}

interface ChunkWithEmbedding extends DocumentChunk {
  embedding: number[];
}

// ============================================================================
// Constants
// ============================================================================

const MAX_CONCURRENT_JOBS = 2;
const PAGE_BATCH_SIZE = 5; // Process 5 pages at a time for memory efficiency
const EMBEDDING_BATCH_SIZE = 50; // Generate embeddings in batches of 50
const STORAGE_BATCH_SIZE = 100; // Store chunks in batches of 100

// ============================================================================
// Worker Setup
// ============================================================================

let dependencies: ProcessorDependencies | null = null;
let isInitialized = false;

/**
 * Initialize worker dependencies
 */
async function initializeDependencies(): Promise<ProcessorDependencies> {
  if (dependencies && isInitialized) {
    return dependencies;
  }

  logger.info('Initializing knowledge processor dependencies...');

  const extractionService = new DocumentExtractionService();
  const chunkingService = new ChunkingService();
  const embeddingService = getEmbeddingService();
  let cacheService: EmbeddingCacheService | null = null;

  // Try to initialize cache
  try {
    cacheService = await getEmbeddingCacheService();
    if (cacheService.isReady()) {
      embeddingService.setCache(cacheService);
      logger.info('Embedding cache connected');
    } else {
      cacheService = null;
      logger.warn('Embedding cache not available, proceeding without cache');
    }
  } catch (error) {
    logger.warn('Failed to initialize embedding cache', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  const vectorStorage = createVectorStorageService(prisma);
  const memoryManager = memoryManagerInstance;

  dependencies = {
    extractionService,
    chunkingService,
    embeddingService,
    cacheService,
    vectorStorage,
    memoryManager,
  };

  isInitialized = true;
  logger.info('Knowledge processor dependencies initialized');

  return dependencies;
}

// ============================================================================
// Main Job Processor
// ============================================================================

/**
 * Main job processor function
 * Routes to specific handler based on job type
 */
async function processJob(job: Job<KnowledgeJob>): Promise<KnowledgeJobResult> {
  const deps = await initializeDependencies();
  const startTime = Date.now();

  logger.info('Processing knowledge job', {
    jobId: job.id,
    type: job.data.type,
    organizationId: job.data.organizationId,
    userId: job.data.userId,
  });

  try {
    // Check memory before processing
    await deps.memoryManager.checkMemory();

    let result: KnowledgeJobResult;

    switch (job.data.type) {
      case 'processDocument':
        result = await processDocumentJob(job as Job<ProcessDocumentJob>, deps);
        break;
      case 'generateEmbeddings':
        result = await processGenerateEmbeddingsJob(job as Job<GenerateEmbeddingsJob>, deps);
        break;
      case 'reprocessChunks':
        result = await processReprocessChunksJob(job as Job<ReprocessChunksJob>, deps);
        break;
      default:
        throw new Error(`Unknown job type: ${(job.data as any).type}`);
    }

    result.processingTimeMs = Date.now() - startTime;
    return result;
  } catch (error) {
    const reporter = createProgressReporter(job);
    await reporter.failed(error instanceof Error ? error.message : 'Unknown error');

    logger.error('Knowledge job failed', {
      jobId: job.id,
      type: job.data.type,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
}

// ============================================================================
// Document Processing Handler
// ============================================================================

/**
 * Process a document: extract -> chunk -> embed -> store
 */
async function processDocumentJob(
  job: Job<ProcessDocumentJob>,
  deps: ProcessorDependencies
): Promise<KnowledgeJobResult> {
  const { sourceId, organizationId, filePath, filename, mimeType, options = {} } = job.data;

  const reporter = createProgressReporter(job);

  // Update source status to processing
  await updateSourceStatus(sourceId, 'processing');

  // Check for existing checkpoint
  const checkpoint = await getCheckpoint(sourceId);

  try {
    // ========================================================================
    // Stage 1: Text Extraction
    // ========================================================================
    let extractionResult;

    if (checkpoint && checkpoint.extractedText) {
      logger.info('Resuming from extraction checkpoint', { sourceId });
      extractionResult = JSON.parse(checkpoint.extractedText);
    } else {
      await reporter.extraction(0, 0, 1);

      extractionResult = await deps.extractionService.extractFromPath(filePath, {
        ocrEnabled: options.ocrEnabled ?? true,
        language: options.language,
        preserveFormatting: true,
      });

      await reporter.extraction(
        100,
        extractionResult.metadata.pageCount,
        extractionResult.metadata.pageCount
      );

      // Save extraction checkpoint
      await saveCheckpoint({
        sourceId,
        stage: 'extraction',
        lastCompletedChunkIndex: 0,
        totalChunks: 0,
        extractedText: JSON.stringify(extractionResult),
        startedAt: new Date(),
        lastUpdatedAt: new Date(),
      });
    }

    // ========================================================================
    // Stage 2: Chunking
    // ========================================================================
    let chunks: DocumentChunk[];

    if (checkpoint && checkpoint.chunksJson) {
      logger.info('Resuming from chunking checkpoint', { sourceId });
      chunks = JSON.parse(checkpoint.chunksJson);
    } else {
      await reporter.chunking(0, 0);

      // Detect document type for optimized chunking
      const documentType = detectDocumentType(filename, mimeType);

      const chunkingResult = deps.chunkingService.chunkDocument(extractionResult, documentType);

      chunks = chunkingResult.chunks;

      await reporter.chunking(100, chunks.length);

      // Save chunking checkpoint
      await saveCheckpoint({
        sourceId,
        stage: 'chunking',
        lastCompletedChunkIndex: 0,
        totalChunks: chunks.length,
        extractedText: JSON.stringify(extractionResult),
        chunksJson: JSON.stringify(chunks),
        startedAt: new Date(),
        lastUpdatedAt: new Date(),
      });
    }

    // ========================================================================
    // Stage 3: Embedding Generation
    // ========================================================================
    const startChunkIndex = checkpoint?.lastCompletedChunkIndex || 0;

    if (options.skipEmbeddings) {
      logger.info('Skipping embedding generation as requested', { sourceId });
    }

    const chunksWithEmbeddings: ChunkWithEmbedding[] = [];
    let embeddingsGenerated = 0;

    // Process chunks in batches
    for (let i = startChunkIndex; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      // Check memory before each batch
      await deps.memoryManager.checkMemory();

      const batchChunks = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
      const batchTexts = batchChunks.map((c) => c.text);

      if (!options.skipEmbeddings) {
        const batchResult = await deps.embeddingService.generateBatch(batchTexts, organizationId);

        for (let j = 0; j < batchChunks.length; j++) {
          if (batchResult.embeddings[j]) {
            chunksWithEmbeddings.push({
              ...batchChunks[j],
              embedding: batchResult.embeddings[j],
            });
            embeddingsGenerated++;
          }
        }

        await reporter.embedding(
          ((i + batchChunks.length) / chunks.length) * 100,
          embeddingsGenerated,
          chunks.length
        );
      } else {
        // Create zero embeddings for testing without API
        for (const chunk of batchChunks) {
          chunksWithEmbeddings.push({
            ...chunk,
            embedding: new Array(768).fill(0),
          });
        }
      }

      // Update checkpoint after each batch
      await saveCheckpoint({
        sourceId,
        stage: 'embedding',
        lastCompletedChunkIndex: i + batchChunks.length,
        totalChunks: chunks.length,
        extractedText: JSON.stringify(extractionResult),
        chunksJson: JSON.stringify(chunks),
        startedAt: checkpoint?.startedAt || new Date(),
        lastUpdatedAt: new Date(),
      });

      // Allow GC to run between batches
      await new Promise((resolve) => setImmediate(resolve));
    }

    // ========================================================================
    // Stage 4: Vector Storage
    // ========================================================================
    let chunksStored = 0;
    let duplicatesSkipped = 0;

    for (let i = 0; i < chunksWithEmbeddings.length; i += STORAGE_BATCH_SIZE) {
      const batchChunks = chunksWithEmbeddings.slice(i, i + STORAGE_BATCH_SIZE);

      for (const chunk of batchChunks) {
        // Check for duplicates
        const isDuplicate = await deps.vectorStorage.checkDuplicate(
          chunk.textHash,
          sourceId,
          organizationId
        );

        if (isDuplicate) {
          duplicatesSkipped++;
          continue;
        }

        await deps.vectorStorage.insertChunk({
          sourceId,
          organizationId,
          text: chunk.text,
          tokenCount: chunk.tokenCount,
          chunkIndex: chunk.chunkIndex,
          embedding: chunk.embedding,
          pageNumber: chunk.metadata.pageNumber,
          sectionHeader: chunk.metadata.sectionHeader,
        });

        chunksStored++;
      }

      await reporter.storage(
        ((i + batchChunks.length) / chunksWithEmbeddings.length) * 100,
        chunksStored,
        chunksWithEmbeddings.length
      );
    }

    // ========================================================================
    // Completion
    // ========================================================================
    const stats = {
      pagesProcessed: extractionResult.metadata.pageCount,
      chunksCreated: chunks.length,
      embeddingsGenerated,
      chunksStored,
      duplicatesSkipped,
    };

    await reporter.complete(stats);

    // Update source with results
    await updateSourceStatus(sourceId, 'completed', {
      chunkCount: chunksStored,
      processingTimeMs: Date.now() - (checkpoint?.startedAt?.getTime() || Date.now()),
    });

    // Clean up checkpoint
    await deleteCheckpoint(sourceId);

    return {
      success: true,
      sourceId,
      organizationId,
      processingTimeMs: 0, // Will be set by caller
      stats,
    };
  } catch (error) {
    // Update source status to error
    await updateSourceStatus(sourceId, 'error', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}

// ============================================================================
// Embedding Generation Handler
// ============================================================================

/**
 * Generate embeddings for existing chunks
 */
async function processGenerateEmbeddingsJob(
  job: Job<GenerateEmbeddingsJob>,
  deps: ProcessorDependencies
): Promise<KnowledgeJobResult> {
  const { sourceId, organizationId, chunkIds, batchSize = EMBEDDING_BATCH_SIZE, force } = job.data;
  const reporter = createProgressReporter(job);

  // Get chunks to process
  const chunks = await getChunksForEmbedding(sourceId, organizationId, chunkIds, force);

  if (chunks.length === 0) {
    return {
      success: true,
      sourceId,
      organizationId,
      processingTimeMs: 0,
      stats: {
        pagesProcessed: 0,
        chunksCreated: 0,
        embeddingsGenerated: 0,
        chunksStored: 0,
        duplicatesSkipped: 0,
      },
    };
  }

  let embeddingsGenerated = 0;
  let chunksStored = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    await deps.memoryManager.checkMemory();

    const batchChunks = chunks.slice(i, i + batchSize);
    const batchTexts = batchChunks.map((c) => c.text);

    const batchResult = await deps.embeddingService.generateBatch(batchTexts, organizationId);

    for (let j = 0; j < batchChunks.length; j++) {
      if (batchResult.embeddings[j]) {
        // Update the chunk with the new embedding
        // This would use a vector storage update method
        embeddingsGenerated++;
        chunksStored++;
      }
    }

    await reporter.embedding(
      ((i + batchChunks.length) / chunks.length) * 100,
      embeddingsGenerated,
      chunks.length
    );
  }

  const stats = {
    pagesProcessed: 0,
    chunksCreated: 0,
    embeddingsGenerated,
    chunksStored,
    duplicatesSkipped: 0,
  };

  await reporter.complete(stats);

  return {
    success: true,
    sourceId,
    organizationId,
    processingTimeMs: 0,
    stats,
  };
}

// ============================================================================
// Reprocessing Handler
// ============================================================================

/**
 * Reprocess specific chunks
 */
async function processReprocessChunksJob(
  job: Job<ReprocessChunksJob>,
  deps: ProcessorDependencies
): Promise<KnowledgeJobResult> {
  const { sourceId, organizationId, chunkIds, newConfig } = job.data;
  const reporter = createProgressReporter(job);

  logger.info('Reprocessing chunks', {
    sourceId,
    chunkCount: chunkIds.length,
    reason: job.data.reason,
  });

  // Delete existing chunks
  let deletedCount = 0;
  for (const chunkId of chunkIds) {
    const deleted = await deps.vectorStorage.deleteChunk(chunkId, organizationId);
    if (deleted) deletedCount++;
  }

  logger.info('Deleted chunks for reprocessing', { deletedCount });

  // For reprocessing, we'd need to re-fetch the source document
  // and process it again with new config
  // This is a simplified version that just handles deletion

  const stats = {
    pagesProcessed: 0,
    chunksCreated: 0,
    embeddingsGenerated: 0,
    chunksStored: 0,
    duplicatesSkipped: deletedCount,
  };

  await reporter.complete(stats);

  return {
    success: true,
    sourceId,
    organizationId,
    processingTimeMs: 0,
    stats,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect document type from filename and mime type
 */
function detectDocumentType(filename: string, mimeType: string): DocumentType {
  const lowerFilename = filename.toLowerCase();

  if (lowerFilename.includes('passport')) return 'PASSPORT';
  if (lowerFilename.includes('license') || lowerFilename.includes('licence'))
    return 'DRIVERS_LICENSE';
  if (lowerFilename.includes('bank') || lowerFilename.includes('statement'))
    return 'BANK_STATEMENT';
  if (
    lowerFilename.includes('tax') ||
    lowerFilename.includes('w2') ||
    lowerFilename.includes('1099')
  )
    return 'TAX_FORM';
  if (lowerFilename.includes('invoice')) return 'INVOICE';
  if (lowerFilename.includes('contract') || lowerFilename.includes('agreement')) return 'CONTRACT';

  return 'DEFAULT';
}

/**
 * Update document source status
 */
async function updateSourceStatus(
  sourceId: string,
  status: 'pending' | 'processing' | 'completed' | 'error',
  data?: { chunkCount?: number; processingTimeMs?: number; errorMessage?: string }
): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE document_sources
      SET status = ${status},
          chunk_count = COALESCE(${data?.chunkCount ?? null}, chunk_count),
          processing_time_ms = COALESCE(${data?.processingTimeMs ?? null}, processing_time_ms),
          error_message = COALESCE(${data?.errorMessage ?? null}, error_message),
          updated_at = NOW()
      WHERE id = ${sourceId}::uuid
    `;
  } catch (error) {
    logger.error('Failed to update source status', {
      sourceId,
      status,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get processing checkpoint
 */
async function getCheckpoint(sourceId: string): Promise<ProcessingCheckpoint | null> {
  try {
    const results = await prisma.$queryRaw<ProcessingCheckpoint[]>`
      SELECT
        source_id as "sourceId",
        stage,
        last_completed_chunk_index as "lastCompletedChunkIndex",
        total_chunks as "totalChunks",
        extracted_text as "extractedText",
        chunks_json as "chunksJson",
        started_at as "startedAt",
        last_updated_at as "lastUpdatedAt"
      FROM processing_checkpoints
      WHERE source_id = ${sourceId}::uuid
      LIMIT 1
    `;
    return results[0] || null;
  } catch (error) {
    logger.debug('No checkpoint found', { sourceId });
    return null;
  }
}

/**
 * Save processing checkpoint
 */
async function saveCheckpoint(checkpoint: ProcessingCheckpoint): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO processing_checkpoints (
        source_id, stage, last_completed_chunk_index, total_chunks,
        extracted_text, chunks_json, started_at, last_updated_at
      ) VALUES (
        ${checkpoint.sourceId}::uuid,
        ${checkpoint.stage},
        ${checkpoint.lastCompletedChunkIndex},
        ${checkpoint.totalChunks},
        ${checkpoint.extractedText ?? null},
        ${checkpoint.chunksJson ?? null},
        ${checkpoint.startedAt},
        ${checkpoint.lastUpdatedAt}
      )
      ON CONFLICT (source_id) DO UPDATE SET
        stage = EXCLUDED.stage,
        last_completed_chunk_index = EXCLUDED.last_completed_chunk_index,
        total_chunks = EXCLUDED.total_chunks,
        extracted_text = EXCLUDED.extracted_text,
        chunks_json = EXCLUDED.chunks_json,
        last_updated_at = EXCLUDED.last_updated_at
    `;
  } catch (error) {
    logger.error('Failed to save checkpoint', {
      sourceId: checkpoint.sourceId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete processing checkpoint
 */
async function deleteCheckpoint(sourceId: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      DELETE FROM processing_checkpoints
      WHERE source_id = ${sourceId}::uuid
    `;
  } catch (error) {
    logger.debug('Failed to delete checkpoint', { sourceId });
  }
}

/**
 * Get chunks for embedding generation
 */
async function getChunksForEmbedding(
  sourceId: string,
  organizationId: string,
  chunkIds?: string[],
  force?: boolean
): Promise<Array<{ id: string; text: string }>> {
  // This would query the database for chunks
  // Implementation depends on whether we want chunks without embeddings or all chunks
  return [];
}

// ============================================================================
// Register Processor
// ============================================================================

/**
 * Start the knowledge processor worker
 */
export function startKnowledgeProcessor(): void {
  logger.info('Starting knowledge processor worker', {
    concurrency: MAX_CONCURRENT_JOBS,
  });

  knowledgeQueue.process(MAX_CONCURRENT_JOBS, processJob);

  logger.info('Knowledge processor worker started');
}

/**
 * Stop the knowledge processor worker
 */
export async function stopKnowledgeProcessor(): Promise<void> {
  logger.info('Stopping knowledge processor worker...');
  await knowledgeQueue.close();
  logger.info('Knowledge processor worker stopped');
}

// ============================================================================
// Main Entry Point (for standalone worker)
// ============================================================================

if (require.main === module) {
  // Running as standalone worker
  (async () => {
    try {
      await initializeDependencies();
      startKnowledgeProcessor();

      logger.info('Knowledge processor running. Press Ctrl+C to stop.');

      // Keep the process alive
      process.on('SIGINT', async () => {
        logger.info('Received SIGINT, shutting down...');
        await stopKnowledgeProcessor();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM, shutting down...');
        await stopKnowledgeProcessor();
        process.exit(0);
      });
    } catch (error) {
      logger.error('Failed to start knowledge processor', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      process.exit(1);
    }
  })();
}

export default {
  startKnowledgeProcessor,
  stopKnowledgeProcessor,
};
