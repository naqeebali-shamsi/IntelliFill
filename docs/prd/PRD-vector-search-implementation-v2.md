# Product Requirements Document: Vector Search & Document Intelligence

**Document Version:** 2.0 (Post-Review)
**Created:** 2025-12-11
**Author:** AI Assistant
**Status:** APPROVED WITH CHANGES
**Project:** IntelliFill (QuikAdmin)

---

## Review Summary

| Review | Score | Status |
|--------|-------|--------|
| Technical Architecture | 7.5/10 | Approved with changes |
| Security | 6.5/10 | Approved with changes |
| Performance | 7/10 | Approved with changes |

### Critical Issues Identified (Must Fix Before Implementation)

| ID | Category | Issue | Priority |
|----|----------|-------|----------|
| ARCH-001 | Architecture | Prisma + pgvector integration incomplete | CRITICAL |
| ARCH-002 | Architecture | Missing Organization model in schema | CRITICAL |
| VULN-001 | Security | Insufficient org-level isolation in vector queries | CRITICAL |
| VULN-002 | Security | Malicious file upload vulnerabilities | CRITICAL |
| VULN-003 | Security | Embedding poisoning & data leakage | CRITICAL |
| VULN-004 | Security | Google API key exposure & quota exhaustion | CRITICAL |
| VULN-005 | Security | SQL injection in raw vector queries | CRITICAL |
| PERF-001 | Performance | Memory exhaustion during large document processing | CRITICAL |

---

## Executive Summary

This PRD outlines the implementation of document scanning, intelligent chunking, embedding generation, and vector database storage capabilities for the IntelliFill platform. This feature will enable semantic search across uploaded documents, intelligent form field suggestions, and context-aware document processing.

### Business Objectives

1. **Improve Form Filling Accuracy** - Use semantic search to find relevant data from previously uploaded documents
2. **Enable Knowledge Base** - Allow users to build searchable document repositories
3. **Reduce Manual Data Entry** - Auto-suggest form field values based on document context
4. **Competitive Differentiation** - Position IntelliFill as an AI-first document automation platform

### Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Form field auto-fill accuracy | >85% | User acceptance rate of suggestions |
| Document processing time | <30 seconds/page | Performance monitoring |
| Search relevance | >90% precision@5 | User feedback + click-through |
| User adoption | 60% of users using search within 30 days | Analytics |

---

## Technical Requirements

### 1. Document Processing Pipeline

#### 1.1 Supported Document Types

| Format | Library | Priority |
|--------|---------|----------|
| PDF (text-based) | `pdf-parse` | P0 |
| PDF (scanned/image) | `Tesseract.js` (existing) | P0 |
| DOCX | `mammoth` | P1 |
| Images (JPG, PNG) | `Tesseract.js` | P0 |
| Plain Text | Native | P1 |

#### 1.2 Text Extraction Service

```typescript
// Location: quikadmin/src/services/documentExtraction.service.ts

interface ExtractionResult {
  text: string;
  pages: PageContent[];
  metadata: DocumentMetadata;
  confidence: number;
}

interface PageContent {
  pageNumber: number;
  text: string;
  tables?: TableData[];
  formFields?: FormFieldData[];
}

interface DocumentMetadata {
  filename: string;
  mimeType: string;
  pageCount: number;
  extractedAt: Date;
  ocrUsed: boolean;
  language?: string;
}
```

#### 1.3 File Security Requirements (NEW - From Security Review)

```typescript
// Location: quikadmin/src/services/fileValidation.service.ts

import { fileTypeFromBuffer } from 'file-type';
import path from 'path';

interface FileValidationResult {
  isValid: boolean;
  sanitizedFilename: string;
  detectedMimeType: string;
  securityFlags: string[];
}

// REQ-SEC-001: Magic number validation
async function validateFileType(buffer: Buffer, expectedType: string): Promise<boolean> {
  const fileType = await fileTypeFromBuffer(buffer);
  if (!fileType || fileType.mime !== expectedType) {
    throw new Error('File type mismatch');
  }
  return true;
}

// REQ-SEC-002: Filename sanitization for path traversal prevention
function sanitizeFilename(filename: string): string {
  return path.basename(filename)
    .replace(/\0/g, '')           // Remove null bytes
    .replace(/\.\./g, '')         // Remove path traversal
    .replace(/[<>:"|?*]/g, '_');  // Remove invalid chars
}

// REQ-SEC-003: Decompression limits
const FILE_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024,           // 10MB
  MAX_DECOMPRESSED_SIZE: 100 * 1024 * 1024,  // 100MB
  MAX_EXTRACTION_TIME: 30000,                 // 30 seconds
  MAX_PAGES: 50
};

// REQ-SEC-004: PDF security validation
async function validatePDF(buffer: Buffer): Promise<void> {
  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.load(buffer, {
    ignoreEncryption: false,
    throwOnInvalidObject: true
  });

  // Check for JavaScript (potential XSS)
  // Reject if contains malicious scripts
}
```

#### 1.4 Requirements

- **REQ-EXT-001**: Extract text from PDF documents with >95% accuracy for text-based PDFs
- **REQ-EXT-002**: Support OCR extraction for scanned documents using existing Tesseract.js integration
- **REQ-EXT-003**: Preserve document structure metadata (page numbers, sections)
- **REQ-EXT-004**: Handle documents up to 50 pages / 10MB
- **REQ-EXT-005**: Process documents asynchronously via Bull queue (existing infrastructure)
- **REQ-SEC-001**: Validate file types using magic numbers, not just extensions
- **REQ-SEC-002**: Sanitize filenames to prevent path traversal attacks
- **REQ-SEC-003**: Enforce decompression limits to prevent zip bombs
- **REQ-SEC-004**: Scan PDFs for malicious JavaScript content

---

### 2. Intelligent Chunking System

#### 2.1 Chunking Strategy

Based on industry best practices research, implement a **hybrid chunking approach**:

1. **Primary**: Semantic chunking using sentence boundaries
2. **Fallback**: Fixed-size chunking with overlap for unstructured text

#### 2.2 Chunking Configuration (UPDATED - From Architecture Review)

```typescript
// Location: quikadmin/src/services/chunking.service.ts

interface ChunkingConfig {
  strategy: 'semantic' | 'fixed' | 'hybrid';
  targetChunkSize: number;      // Target: 400 tokens (~1600 chars)
  maxChunkSize: number;         // Maximum: 800 tokens (~3200 chars)
  minChunkSize: number;         // Minimum: 100 tokens (~400 chars)
  overlapTokens: number;        // Target: 60 tokens (15% of 400)
  preserveSentences: boolean;
  charsPerToken: number;        // 4 chars/token for English
}

const DEFAULT_CONFIG: ChunkingConfig = {
  strategy: 'hybrid',
  targetChunkSize: 400,         // Conservative target (was 512)
  maxChunkSize: 800,            // Safety margin (was 1024)
  minChunkSize: 100,
  overlapTokens: 60,            // 15% overlap
  preserveSentences: true,
  charsPerToken: 4              // Character-based estimation
};

// Document-type specific configurations (NEW)
const CHUNKING_STRATEGIES: Record<string, ChunkingConfig> = {
  PASSPORT: {
    ...DEFAULT_CONFIG,
    strategy: 'fixed',
    targetChunkSize: 200,       // Small chunks for structured data
    preserveSentences: false
  },
  BANK_STATEMENT: {
    ...DEFAULT_CONFIG,
    strategy: 'semantic',
    targetChunkSize: 500        // Larger for transaction groups
  },
  DEFAULT: DEFAULT_CONFIG
};
```

#### 2.3 Chunk Entity

```typescript
interface DocumentChunk {
  id: string;                   // UUID
  sourceId: string;             // FK to source document
  organizationId: string;       // FK for multi-tenancy (REQUIRED)
  userId: string;               // FK to uploading user

  // Content
  text: string;                 // Chunk text content
  tokenCount: number;           // Estimated token count

  // Position metadata
  chunkIndex: number;           // Order within document
  pageNumber?: number;          // Source page (if applicable)
  sectionHeader?: string;       // Nearest section header

  // Vector (stored separately via raw SQL)
  // embedding: number[];       // 768-dimensional vector
  embeddingModel: string;       // Model used for embedding

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
```

#### 2.4 Requirements

- **REQ-CHK-001**: Implement semantic chunking that respects sentence boundaries
- **REQ-CHK-002**: Target 400 tokens per chunk with 15% overlap (60 tokens)
- **REQ-CHK-003**: Preserve metadata (page numbers, section headers) in chunks
- **REQ-CHK-004**: Use character-based estimation (4 chars/token) with safety margin
- **REQ-CHK-005**: Handle edge cases (very short docs, single-page, tables)
- **REQ-CHK-006**: Support document-type-specific chunking strategies

---

### 3. Embedding Generation

#### 3.1 Embedding Model Selection

| Option | Dimensions | Cost | Latency | Recommendation |
|--------|------------|------|---------|----------------|
| Google text-embedding-004 | 768 | Free tier available | Fast | **Primary** |
| OpenAI text-embedding-3-small | 1536 | $0.02/1M tokens | Medium | Fallback |
| Local (sentence-transformers) | 384-768 | Infrastructure only | Variable | Future option |

**Decision**: Use **Google text-embedding-004** as primary (768 dimensions) for cost-effectiveness and speed.

#### 3.2 Embedding Service (UPDATED - From Security Review)

```typescript
// Location: quikadmin/src/services/embedding.service.ts

interface EmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  generateBatch(texts: string[], batchSize?: number): Promise<number[][]>;
  cosineSimilarity(a: number[], b: number[]): number;
  findTopK(query: number[], candidates: number[][], k: number): SimilarityResult[];
}

interface EmbeddingConfig {
  provider: 'google' | 'openai' | 'local';
  model: string;
  dimensions: number;
  batchSize: number;
  maxConcurrentBatches: number;  // NEW: Parallel processing
  rateLimitDelay: number;
  maxRetries: number;
  dailyQuotaLimit: number;       // NEW: Cost control
}

const GOOGLE_CONFIG: EmbeddingConfig = {
  provider: 'google',
  model: 'text-embedding-004',
  dimensions: 768,
  batchSize: 100,
  maxConcurrentBatches: 3,       // NEW: Process 3 batches in parallel
  rateLimitDelay: 500,           // UPDATED: Reduced from 1000ms
  maxRetries: 3,
  dailyQuotaLimit: 10000         // NEW: Per-organization limit
};

// Embedding validation (NEW - Security requirement)
function validateEmbeddingInput(embedding: number[]): void {
  if (!Array.isArray(embedding)) {
    throw new Error('Invalid embedding format');
  }
  if (embedding.length !== 768) {
    throw new Error('Invalid embedding dimensions');
  }
  if (embedding.some(n => !Number.isFinite(n))) {
    throw new Error('Invalid embedding values');
  }
}
```

#### 3.3 Secrets Management (NEW - From Security Review)

```typescript
// Location: quikadmin/src/config/secrets.ts

// REQ-SEC-005: Use environment variables with rotation support
interface SecretsConfig {
  primaryKey: string;
  secondaryKey?: string;  // For rotation
  keyRotatedAt?: Date;
}

async function getEmbeddingApiKey(): Promise<string> {
  // Option 1: Environment variables (development)
  if (process.env.NODE_ENV === 'development') {
    return process.env.GOOGLE_GENERATIVE_AI_KEY!;
  }

  // Option 2: Google Secret Manager (production)
  // Implementation for cloud deployments
}

// Key rotation support
const ACTIVE_KEYS = [
  process.env.GOOGLE_API_KEY_PRIMARY,
  process.env.GOOGLE_API_KEY_SECONDARY
].filter(Boolean);

async function embedWithFallback(text: string): Promise<number[]> {
  for (const key of ACTIVE_KEYS) {
    try {
      return await generateEmbedding(text, key);
    } catch (error) {
      logger.warn('Embedding failed, trying next key');
    }
  }
  throw new Error('All embedding keys failed');
}
```

#### 3.4 Requirements

- **REQ-EMB-001**: Generate 768-dimensional embeddings using Google text-embedding-004
- **REQ-EMB-002**: Support batch processing with parallel batches (3 concurrent)
- **REQ-EMB-003**: Implement rate limiting to respect API quotas
- **REQ-EMB-004**: Handle API failures with exponential backoff retry
- **REQ-EMB-005**: Implement embedding caching with integrity validation
- **REQ-EMB-006**: Validate all embedding inputs to prevent injection
- **REQ-EMB-007**: Support API key rotation without downtime
- **REQ-EMB-008**: Enforce per-organization daily quota limits

---

### 4. Vector Database Storage

#### 4.1 Database Choice: pgvector

**Rationale**: IntelliFill already uses PostgreSQL (Neon). pgvector:
- No additional infrastructure required
- Integrates with existing Prisma ORM
- Cost-effective (no separate vector DB fees)
- Sufficient performance for expected scale (<10M vectors)

#### 4.2 Schema Design (UPDATED - From Architecture Review)

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Organization model (REQUIRED - was missing)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document sources table
CREATE TABLE document_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),

  -- Optional link to existing Document (for form-filling)
  linked_document_id UUID REFERENCES documents(id),

  -- Document info
  title VARCHAR(255) NOT NULL,
  filename VARCHAR(255),
  mime_type VARCHAR(100),
  file_size INTEGER,
  page_count INTEGER,

  -- Processing status
  status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,

  -- Metadata
  chunk_count INTEGER DEFAULT 0,
  processing_time_ms INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Document chunks with vectors
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES document_sources(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Content
  text TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  text_hash VARCHAR(64) NOT NULL, -- NEW: For deduplication

  -- Position
  chunk_index INTEGER NOT NULL,
  page_number INTEGER,
  section_header VARCHAR(255),

  -- Vector embedding (768 dimensions)
  embedding vector(768) NOT NULL,
  embedding_model VARCHAR(100) DEFAULT 'text-embedding-004',

  -- Full-text search (NEW - for hybrid search)
  text_search tsvector,

  -- Metadata (flexible JSON)
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index (UPDATED - better parameters)
CREATE INDEX idx_chunks_embedding_hnsw
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 32, ef_construction = 128);  -- Changed from m=16, ef=64

-- Full-text search index (NEW)
CREATE INDEX idx_chunks_text_search
  ON document_chunks
  USING gin(text_search);

-- Trigger for tsvector (NEW)
CREATE TRIGGER update_text_search_trigger
  BEFORE INSERT OR UPDATE ON document_chunks
  FOR EACH ROW
  EXECUTE FUNCTION tsvector_update_trigger(text_search, 'pg_catalog.english', text);

-- Supporting indexes
CREATE INDEX idx_chunks_source ON document_chunks(source_id);
CREATE INDEX idx_chunks_org ON document_chunks(organization_id);
CREATE INDEX idx_chunks_org_source ON document_chunks(organization_id, source_id);
CREATE INDEX idx_sources_org ON document_sources(organization_id);
CREATE INDEX idx_sources_user ON document_sources(user_id);
CREATE INDEX idx_sources_status ON document_sources(status);
CREATE INDEX idx_sources_org_status ON document_sources(organization_id, status);

-- Row-Level Security (NEW - Critical security requirement)
ALTER TABLE document_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation_sources ON document_sources
  FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY org_isolation_chunks ON document_chunks
  FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Processing checkpoints (NEW - for recovery)
CREATE TABLE processing_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES document_sources(id) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL,
  last_completed_chunk_index INTEGER DEFAULT 0,
  total_chunks INTEGER NOT NULL,
  extracted_text TEXT,
  chunks_json TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id)
);
```

#### 4.3 Vector Storage Service (NEW - From Architecture Review)

```typescript
// Location: quikadmin/src/services/vectorStorage.service.ts

/**
 * VectorStorageService - Abstraction layer for pgvector operations
 * Addresses: ARCH-001 (Prisma + pgvector integration)
 * Security: VULN-005 (SQL injection prevention)
 */
class VectorStorageService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Insert chunk with embedding using raw SQL
   * Always parameterized to prevent SQL injection
   */
  async insertChunk(chunk: {
    sourceId: string;
    organizationId: string;
    text: string;
    tokenCount: number;
    chunkIndex: number;
    embedding: number[];
    pageNumber?: number;
    sectionHeader?: string;
  }): Promise<string> {
    // Validate embedding
    this.validateEmbedding(chunk.embedding);

    const id = uuidv4();
    const textHash = crypto.createHash('sha256').update(chunk.text).digest('hex');

    // SAFE: Using Prisma's $queryRaw with tagged template
    await this.prisma.$executeRaw`
      INSERT INTO document_chunks (
        id, source_id, organization_id, text, token_count, text_hash,
        chunk_index, page_number, section_header, embedding, created_at, updated_at
      ) VALUES (
        ${id}::uuid,
        ${chunk.sourceId}::uuid,
        ${chunk.organizationId}::uuid,
        ${chunk.text},
        ${chunk.tokenCount},
        ${textHash},
        ${chunk.chunkIndex},
        ${chunk.pageNumber},
        ${chunk.sectionHeader},
        ${this.toPgVector(chunk.embedding)}::vector(768),
        NOW(),
        NOW()
      )
    `;

    return id;
  }

  /**
   * Search similar vectors with MANDATORY organization filtering
   * Addresses: VULN-001 (Organization isolation)
   */
  async searchSimilar(
    queryEmbedding: number[],
    organizationId: string,
    topK: number = 5,
    minScore: number = 0.5
  ): Promise<SearchResult[]> {
    // Validate inputs
    this.validateEmbedding(queryEmbedding);
    if (!organizationId) {
      throw new Error('organizationId is REQUIRED for vector search');
    }

    const vectorString = this.toPgVector(queryEmbedding);

    // Set organization context for RLS
    await this.prisma.$executeRaw`
      SELECT set_config('app.current_organization_id', ${organizationId}, true)
    `;

    const results = await this.prisma.$queryRaw<SearchResult[]>`
      SELECT
        dc.id,
        dc.source_id,
        dc.text,
        dc.page_number,
        dc.section_header,
        dc.chunk_index,
        ds.title as source_title,
        1 - (dc.embedding <=> ${vectorString}::vector(768)) as similarity
      FROM document_chunks dc
      JOIN document_sources ds ON dc.source_id = ds.id
      WHERE dc.organization_id = ${organizationId}::uuid
        AND ds.organization_id = ${organizationId}::uuid
        AND ds.deleted_at IS NULL
      ORDER BY dc.embedding <=> ${vectorString}::vector(768)
      LIMIT ${topK}
    `;

    // Filter by minimum score
    return results.filter(r => r.similarity >= minScore);
  }

  /**
   * Hybrid search: vector + keyword
   */
  async hybridSearch(
    query: string,
    queryEmbedding: number[],
    organizationId: string,
    topK: number = 5,
    vectorWeight: number = 0.7
  ): Promise<SearchResult[]> {
    // ... implementation combining vector and ts_rank
  }

  private validateEmbedding(embedding: number[]): void {
    if (!Array.isArray(embedding)) {
      throw new Error('Invalid embedding format');
    }
    if (embedding.length !== 768) {
      throw new Error(`Invalid embedding dimensions: ${embedding.length}`);
    }
    if (embedding.some(n => !Number.isFinite(n))) {
      throw new Error('Invalid embedding values');
    }
  }

  private toPgVector(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }
}
```

#### 4.4 Requirements

- **REQ-VDB-001**: Use pgvector extension for vector storage
- **REQ-VDB-002**: Implement HNSW indexing with m=32, ef_construction=128
- **REQ-VDB-003**: Store 768-dimensional vectors (Google embedding size)
- **REQ-VDB-004**: Support cosine similarity search via `<=>` operator
- **REQ-VDB-005**: MANDATORY organization-scoped queries for data isolation
- **REQ-VDB-006**: Support soft deletes with cascade to chunks
- **REQ-VDB-007**: Implement Row-Level Security on all vector tables
- **REQ-VDB-008**: Use VectorStorageService abstraction for all operations
- **REQ-VDB-009**: Support hybrid search (vector + full-text)
- **REQ-VDB-010**: Implement chunk deduplication via text_hash

---

### 5. Search & Retrieval API

#### 5.1 API Endpoints

```typescript
// Location: quikadmin/src/api/knowledge.routes.ts

// All endpoints REQUIRE authentication middleware
// router.use(authenticateSupabase);
// router.use(validateOrganization);
// router.use(auditLogger);

// Document Source Management
POST   /api/knowledge/sources/upload     // Upload and process document
GET    /api/knowledge/sources            // List all sources for org
GET    /api/knowledge/sources/:id        // Get source details
DELETE /api/knowledge/sources/:id        // Delete source and chunks

// Search
POST   /api/knowledge/search             // Semantic search
POST   /api/knowledge/search/hybrid      // Hybrid search (semantic + keyword)

// Form Integration
POST   /api/knowledge/suggest            // Get field suggestions for form
```

#### 5.2 Search Request/Response (UPDATED - From Reviews)

```typescript
import { z } from 'zod';

// Input validation schema (NEW - Security requirement)
const searchSchema = z.object({
  query: z.string()
    .min(3, 'Query too short')
    .max(1000, 'Query too long')
    .regex(/^[\w\s\-.,!?'"()]+$/i, 'Invalid characters'),
  topK: z.number().min(1).max(50).default(5),
  minScore: z.number().min(0).max(1).default(0.5),
  hybridMode: z.enum(['vector', 'keyword', 'both']).default('vector'),
  hybridWeight: z.number().min(0).max(1).default(0.7),
  rerank: z.boolean().default(false),
  filters: z.object({
    sourceIds: z.array(z.string().uuid()).max(10).optional(),
    dateRange: z.object({
      from: z.date().optional(),
      to: z.date().optional()
    }).optional(),
    pageNumbers: z.array(z.number()).optional()
  }).optional()
});

// Search Response
interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  queryTime: number;
}

interface SearchResult {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  text: string;

  vectorScore: number;      // Cosine similarity
  keywordScore?: number;    // BM25 score (if hybrid)
  finalScore: number;       // Combined/reranked score

  pageNumber?: number;
  sectionHeader?: string;
  highlights?: string[];

  context?: {
    before?: string;
    after?: string;
  };
}
```

#### 5.3 Rate Limiting (UPDATED - From Security Review)

```typescript
const RATE_LIMITS = {
  upload: { window: '1m', max: 10 },      // 10 uploads/minute (unchanged)
  search: { window: '1m', max: 20 },      // REDUCED from 100 to 20
  suggest: { window: '1m', max: 30 },     // REDUCED from 200 to 30
};

// Additional: Organization-level quotas
const ORG_LIMITS = {
  upload: { daily: 100, monthly: 3000 },
  embedding: { daily: 1000, monthly: 30000 }
};
```

#### 5.4 Requirements

- **REQ-API-001**: Implement semantic search with configurable topK results
- **REQ-API-002**: Support filtering by source, date range, and page number
- **REQ-API-003**: Return similarity scores normalized to 0-1 range
- **REQ-API-004**: Implement form field suggestion API for auto-fill
- **REQ-API-005**: Add rate limiting (20 searches/minute per organization)
- **REQ-API-006**: Log all searches for analytics and security auditing
- **REQ-API-007**: Validate all input using Zod schemas
- **REQ-API-008**: Implement hybrid search (vector + keyword)
- **REQ-API-009**: Return generic errors to clients, detailed logs internally

---

### 6. Security Architecture (NEW SECTION)

#### 6.1 Authentication & Authorization Chain

```typescript
// Location: quikadmin/src/api/knowledge.routes.ts

import { Router } from 'express';
import { authenticateSupabase } from '../middleware/supabaseAuth';
import { validateOrganization } from '../middleware/validateOrganization';
import { rateLimiter } from '../middleware/rateLimiter';
import { auditLogger } from '../middleware/auditLogger';

const router = Router();

// REQUIRED middleware chain for ALL endpoints
router.use(authenticateSupabase);      // Verify JWT
router.use(validateOrganization);      // Validate org membership
router.use(rateLimiter);               // Rate limiting
router.use(auditLogger);               // Audit all requests
```

#### 6.2 Organization Isolation

```typescript
// Location: quikadmin/src/middleware/validateOrganization.ts

/**
 * Validates that the user belongs to the claimed organization
 * and sets the organization context for RLS
 */
async function validateOrganization(req: Request, res: Response, next: NextFunction) {
  const userId = req.user.id;
  const organizationId = req.user.organizationId;

  if (!organizationId) {
    return res.status(403).json({ error: 'Organization context required' });
  }

  // Verify user belongs to organization
  const membership = await prisma.user.findFirst({
    where: { id: userId, organizationId }
  });

  if (!membership) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Set organization context for Row-Level Security
  await prisma.$executeRaw`
    SELECT set_config('app.current_organization_id', ${organizationId}, true)
  `;

  next();
}
```

#### 6.3 Audit Logging

```typescript
// Location: quikadmin/src/middleware/auditLogger.ts

interface AuditLogEntry {
  userId: string;
  organizationId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  await prisma.auditLog.create({ data: entry });

  // Anomaly detection
  const recentSearches = await countRecentSearches(entry.userId, 60);
  if (recentSearches > 50) {
    logger.warn('Potential embedding probing attack', {
      userId: entry.userId,
      organizationId: entry.organizationId,
      searchCount: recentSearches
    });
    // Alert security team
  }
}
```

#### 6.4 Security Requirements

- **REQ-SEC-001**: Magic number validation for all file uploads
- **REQ-SEC-002**: Filename sanitization for path traversal prevention
- **REQ-SEC-003**: Decompression limits to prevent zip bombs
- **REQ-SEC-004**: PDF scanning for malicious JavaScript
- **REQ-SEC-005**: API key rotation support without downtime
- **REQ-SEC-006**: Row-Level Security on all vector tables
- **REQ-SEC-007**: Audit logging for all vector operations
- **REQ-SEC-008**: Anomaly detection for suspicious search patterns
- **REQ-SEC-009**: MANDATORY organizationId in all vector queries
- **REQ-SEC-010**: Parameterized queries only (no string concatenation)
- **REQ-SEC-011**: Generic error messages to clients
- **REQ-SEC-012**: Minimum similarity score threshold (0.5)

---

### 7. Performance Architecture (NEW SECTION)

#### 7.1 Memory Management

```typescript
// Location: quikadmin/src/services/memoryManager.ts

import v8 from 'v8';

const MEMORY_THRESHOLDS = {
  WARNING: 0.75,   // 75% heap usage
  CRITICAL: 0.85,  // 85% heap usage
  MAX_CONCURRENT_UPLOADS: 5
};

class MemoryManager {
  private activeUploads = 0;

  async checkMemory(): Promise<boolean> {
    const heapStats = v8.getHeapStatistics();
    const usedHeap = heapStats.used_heap_size / heapStats.heap_size_limit;

    if (usedHeap > MEMORY_THRESHOLDS.CRITICAL) {
      logger.error('Critical memory usage', { usedHeap });
      throw new Error('System under high load, retry later');
    }

    if (usedHeap > MEMORY_THRESHOLDS.WARNING) {
      logger.warn('High memory usage', { usedHeap });
    }

    return true;
  }

  async acquireUploadSlot(): Promise<boolean> {
    await this.checkMemory();

    if (this.activeUploads >= MEMORY_THRESHOLDS.MAX_CONCURRENT_UPLOADS) {
      throw new Error('Upload queue full, retry later');
    }

    this.activeUploads++;
    return true;
  }

  releaseUploadSlot(): void {
    this.activeUploads = Math.max(0, this.activeUploads - 1);
  }
}
```

#### 7.2 Incremental Document Processing

```typescript
// Location: quikadmin/src/workers/documentProcessor.ts

/**
 * Process documents page-by-page to avoid memory exhaustion
 * Addresses: PERF-001
 */
async function processLargePDF(
  sourceId: string,
  pdfPath: string,
  organizationId: string
): Promise<void> {
  const pageCount = await getPDFPageCount(pdfPath);

  for (let pageNum = 0; pageNum < pageCount; pageNum++) {
    // Process one page at a time
    const pageText = await extractPage(pdfPath, pageNum);
    const chunks = await chunkText(pageText, { pageNumber: pageNum });

    // Generate embeddings and store
    for (const chunk of chunks) {
      const embedding = await embeddingService.generateEmbedding(chunk.text);
      await vectorStorage.insertChunk({
        sourceId,
        organizationId,
        ...chunk,
        embedding
      });
    }

    // Update checkpoint
    await updateCheckpoint(sourceId, 'processing', pageNum);

    // Allow GC to run every 5 pages
    if (pageNum % 5 === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }
}
```

#### 7.3 Circuit Breaker

```typescript
// Location: quikadmin/src/utils/circuitBreaker.ts

class CircuitBreaker {
  private failureCount = 0;
  private readonly threshold = 5;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private resetTimeout = 60000; // 1 minute

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      throw new Error('Circuit breaker OPEN - system overloaded');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      setTimeout(() => { this.state = 'HALF_OPEN'; }, this.resetTimeout);
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
}
```

#### 7.4 Performance Requirements

- **REQ-PERF-001**: Maximum 5 concurrent document uploads per instance
- **REQ-PERF-002**: Memory usage threshold at 85% triggers rejection
- **REQ-PERF-003**: Page-by-page processing for documents >5 pages
- **REQ-PERF-004**: Circuit breaker after 5 consecutive failures
- **REQ-PERF-005**: HNSW index with m=32, ef_construction=128
- **REQ-PERF-006**: Query-time ef_search=100 for recall/latency balance
- **REQ-PERF-007**: Parallel embedding batches (3 concurrent)
- **REQ-PERF-008**: Embedding cache with 24-hour TTL

---

### 8. Implementation Phases (UPDATED)

#### Phase 0: Prerequisites (REQUIRED Before Phase 1)
- [ ] Add Organization model to Prisma schema (or confirm existing)
- [ ] Implement VectorStorageService abstraction
- [ ] Create file validation service with security checks
- [ ] Design memory management strategy
- [ ] Set up audit logging infrastructure
- [ ] Clarify Document vs DocumentSource relationship

#### Phase 1: Foundation
- [ ] Enable pgvector extension on Neon database
- [ ] Create database migrations with RLS policies
- [ ] Implement DocumentExtractionService with security checks
- [ ] Implement ChunkingService with character-based estimation
- [ ] Add unit tests including security scenarios

#### Phase 2: Embeddings & Storage
- [ ] Implement EmbeddingService with Google API
- [ ] Implement VectorStorageService with parameterized queries
- [ ] Extend existing ocrQueue for knowledge processing
- [ ] Add integration tests for multi-tenant isolation
- [ ] Implement checkpointing for recovery

#### Phase 3: Search API
- [ ] Implement semantic search endpoint with validation
- [ ] Implement hybrid search (semantic + keyword)
- [ ] Add search result ranking and scoring
- [ ] Implement caching layer with integrity checks
- [ ] Add rate limiting per organization

#### Phase 4: Form Integration
- [ ] Implement field suggestion API
- [ ] Integrate with existing form filling workflow
- [ ] Add confidence scoring for suggestions
- [ ] UI integration for suggestions

#### Phase 5: Security Hardening & Optimization
- [ ] Penetration testing for multi-tenant isolation
- [ ] Load testing with 100K+ vectors
- [ ] Performance optimization based on metrics
- [ ] Implement anomaly detection
- [ ] Documentation and runbooks

---

### 9. Dependencies

#### 9.1 New NPM Packages

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.24.1",
    "pdf-parse": "^2.2.7",
    "mammoth": "^1.11.0",
    "file-type": "^19.0.0",
    "zod": "^3.22.0"
  }
}
```

#### 9.2 Environment Variables

```env
# Add to quikadmin/.env
GOOGLE_GENERATIVE_AI_KEY=your-api-key
GOOGLE_API_KEY_SECONDARY=rotation-key  # For rotation

EMBEDDING_MODEL=text-embedding-004
EMBEDDING_DIMENSIONS=768

MAX_DOCUMENT_SIZE_MB=10
MAX_CHUNKS_PER_DOCUMENT=1000
MAX_CONCURRENT_UPLOADS=5

# Rate limits
SEARCH_RATE_LIMIT_PER_MINUTE=20
UPLOAD_RATE_LIMIT_PER_MINUTE=10

# Organization quotas
ORG_DAILY_UPLOAD_LIMIT=100
ORG_DAILY_EMBEDDING_LIMIT=1000
```

---

### 10. Acceptance Criteria (UPDATED)

#### Must Have (P0)
- [ ] Upload PDF/DOCX/TXT documents with security validation
- [ ] Process into searchable chunks with organization isolation
- [ ] Semantic search returns relevant results with >80% precision
- [ ] Organization data isolation verified via security testing
- [ ] Processing completes within 30s/page
- [ ] Row-Level Security enabled on all tables
- [ ] Audit logging for all operations

#### Should Have (P1)
- [ ] Form field suggestions with confidence scores
- [ ] Hybrid search (semantic + keyword)
- [ ] Real-time processing status updates
- [ ] Memory management preventing OOM errors
- [ ] Circuit breaker for system stability

#### Nice to Have (P2)
- [ ] Multiple embedding provider support
- [ ] Custom chunking configurations per document type
- [ ] Search analytics dashboard
- [ ] Anomaly detection alerting

---

## Appendix A: Security Checklist

### Pre-Implementation
- [ ] Organization model exists in schema
- [ ] RLS policies defined
- [ ] VectorStorageService with parameterized queries
- [ ] File validation service implemented
- [ ] API key rotation strategy documented

### Pre-Launch
- [ ] Penetration testing completed
- [ ] IDOR testing passed
- [ ] Multi-tenant isolation verified
- [ ] Rate limiting tested
- [ ] Audit logs reviewed

### Post-Launch
- [ ] Daily audit log review
- [ ] Weekly dependency scanning
- [ ] Monthly security review
- [ ] Quarterly key rotation

---

## Appendix B: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-11 | AI Assistant | Initial draft |
| 2.0 | 2025-12-11 | AI Assistant | Post-review updates |

### Changes in v2.0

1. **Architecture**:
   - Added VectorStorageService abstraction
   - Updated HNSW parameters (m=32, ef=128)
   - Added Organization model requirement
   - Reduced chunk size target (400 tokens)

2. **Security**:
   - Added Row-Level Security
   - Added file validation service
   - Reduced rate limits (100→20 searches/min)
   - Added audit logging requirements
   - Added anomaly detection

3. **Performance**:
   - Added memory management
   - Added circuit breaker
   - Added incremental processing
   - Added parallel embedding batches

4. **New Sections**:
   - Security Architecture (Section 6)
   - Performance Architecture (Section 7)
   - Security Checklist (Appendix A)

---

**Document Status:** APPROVED WITH CHANGES
**Next Steps:** Implement Phase 0 prerequisites before starting Phase 1
