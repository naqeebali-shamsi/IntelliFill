-- Vector Search & Document Intelligence Tables
-- PRD: Vector Search Implementation v2.0
-- Task: #110 (pgvector), #111 (Migration), #112 (Schema)
--
-- This migration creates:
-- 1. Organization model for multi-tenancy
-- 2. DocumentSource for knowledge base documents
-- 3. DocumentChunk for text chunks with vector embeddings
-- 4. ProcessingCheckpoint for recovery
-- 5. Updates to User model for organization relation
-- 6. Updates to AuditLog for organization tracking

-- ============================================================================
-- STEP 1: Enable pgvector extension (requires superuser on Neon)
-- Note: On Neon, pgvector is pre-installed but may need to be enabled
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- STEP 2: Create Organization enum and table
-- ============================================================================
-- CreateEnum
CREATE TYPE "public"."OrganizationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "public"."organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "public"."OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- STEP 3: Update User table with organizationId
-- ============================================================================
-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN "organization_id" TEXT;

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "public"."users"("organization_id");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- STEP 4: Create DocumentSourceStatus enum
-- ============================================================================
-- CreateEnum
CREATE TYPE "public"."DocumentSourceStatus" AS ENUM ('PENDING', 'EXTRACTING', 'CHUNKING', 'EMBEDDING', 'COMPLETED', 'FAILED');

-- ============================================================================
-- STEP 5: Create DocumentSource table
-- ============================================================================
-- CreateTable
CREATE TABLE "public"."document_sources" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "linked_document_id" TEXT,
    "title" VARCHAR(255) NOT NULL,
    "filename" VARCHAR(255),
    "mime_type" VARCHAR(100),
    "file_size" INTEGER,
    "page_count" INTEGER,
    "storage_url" TEXT,
    "status" "public"."DocumentSourceStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "processing_time_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "document_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_sources_organization_id_idx" ON "public"."document_sources"("organization_id");

-- CreateIndex
CREATE INDEX "document_sources_user_id_idx" ON "public"."document_sources"("user_id");

-- CreateIndex
CREATE INDEX "document_sources_status_idx" ON "public"."document_sources"("status");

-- CreateIndex
CREATE INDEX "document_sources_organization_id_status_idx" ON "public"."document_sources"("organization_id", "status");

-- AddForeignKey
ALTER TABLE "public"."document_sources" ADD CONSTRAINT "document_sources_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_sources" ADD CONSTRAINT "document_sources_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- STEP 6: Create DocumentChunk table with vector column
-- Note: embedding column uses pgvector type vector(768)
-- ============================================================================
-- CreateTable
CREATE TABLE "public"."document_chunks" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL,
    "text_hash" VARCHAR(64) NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "page_number" INTEGER,
    "section_header" VARCHAR(255),
    "embedding_model" VARCHAR(100) NOT NULL DEFAULT 'text-embedding-004',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- Add vector column for embeddings (768 dimensions for Google text-embedding-004)
ALTER TABLE "public"."document_chunks" ADD COLUMN "embedding" vector(768);

-- CreateIndex - Standard B-tree indexes
CREATE INDEX "document_chunks_source_id_idx" ON "public"."document_chunks"("source_id");

-- CreateIndex
CREATE INDEX "document_chunks_organization_id_idx" ON "public"."document_chunks"("organization_id");

-- CreateIndex
CREATE INDEX "document_chunks_organization_id_source_id_idx" ON "public"."document_chunks"("organization_id", "source_id");

-- CreateIndex for deduplication
CREATE INDEX "document_chunks_text_hash_idx" ON "public"."document_chunks"("text_hash");

-- AddForeignKey
ALTER TABLE "public"."document_chunks" ADD CONSTRAINT "document_chunks_source_id_fkey"
    FOREIGN KEY ("source_id") REFERENCES "public"."document_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_chunks" ADD CONSTRAINT "document_chunks_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- STEP 7: Create HNSW index for vector similarity search
-- Parameters: m=32, ef_construction=128 (per PRD recommendations)
-- ============================================================================
CREATE INDEX "document_chunks_embedding_hnsw_idx"
    ON "public"."document_chunks"
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 32, ef_construction = 128);

-- ============================================================================
-- STEP 8: Create Full-Text Search infrastructure
-- ============================================================================
-- Add tsvector column for full-text search
ALTER TABLE "public"."document_chunks" ADD COLUMN "text_search" tsvector;

-- Create GIN index for full-text search
CREATE INDEX "document_chunks_text_search_gin_idx"
    ON "public"."document_chunks"
    USING gin(text_search);

-- Create trigger to automatically update tsvector
CREATE OR REPLACE FUNCTION update_document_chunk_text_search()
RETURNS TRIGGER AS $$
BEGIN
    NEW.text_search = to_tsvector('english', NEW.text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_chunks_text_search_trigger
    BEFORE INSERT OR UPDATE OF text ON "public"."document_chunks"
    FOR EACH ROW
    EXECUTE FUNCTION update_document_chunk_text_search();

-- ============================================================================
-- STEP 9: Create ProcessingCheckpoint table for recovery
-- ============================================================================
-- CreateTable
CREATE TABLE "public"."processing_checkpoints" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "stage" VARCHAR(50) NOT NULL,
    "last_completed_chunk_index" INTEGER NOT NULL DEFAULT 0,
    "total_chunks" INTEGER NOT NULL,
    "extracted_text" TEXT,
    "chunks_json" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex - Unique constraint on source_id
CREATE UNIQUE INDEX "processing_checkpoints_source_id_key" ON "public"."processing_checkpoints"("source_id");

-- AddForeignKey
ALTER TABLE "public"."processing_checkpoints" ADD CONSTRAINT "processing_checkpoints_source_id_fkey"
    FOREIGN KEY ("source_id") REFERENCES "public"."document_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- STEP 10: Update AuditLog table with organization_id
-- ============================================================================
-- AlterTable - Add organization_id column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'audit_log'
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE "public"."audit_log" ADD COLUMN "organization_id" TEXT;
    END IF;
END $$;

-- CreateIndex for organization_id on audit_log
CREATE INDEX IF NOT EXISTS "audit_log_organization_id_idx" ON "public"."audit_log"("organization_id");

-- ============================================================================
-- STEP 11: Enable Row-Level Security (RLS) for multi-tenant isolation
-- Critical security requirement from PRD (VULN-001)
-- ============================================================================
-- Enable RLS on document_sources
ALTER TABLE "public"."document_sources" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on document_chunks
ALTER TABLE "public"."document_chunks" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for organization isolation
-- Note: These policies use app.current_organization_id set by the application
CREATE POLICY "org_isolation_sources" ON "public"."document_sources"
    FOR ALL
    USING (organization_id = current_setting('app.current_organization_id', true)::text);

CREATE POLICY "org_isolation_chunks" ON "public"."document_chunks"
    FOR ALL
    USING (organization_id = current_setting('app.current_organization_id', true)::text);

-- ============================================================================
-- STEP 12: Create helper function for setting organization context
-- Used by VectorStorageService before queries
-- ============================================================================
CREATE OR REPLACE FUNCTION set_organization_context(org_id text)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_organization_id', org_id, true);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 13: Seed default organization for existing users (optional)
-- Uncomment if you want to auto-create a default org
-- ============================================================================
-- INSERT INTO "public"."organizations" ("id", "name", "status", "createdAt", "updatedAt")
-- VALUES (gen_random_uuid()::text, 'Default Organization', 'ACTIVE', NOW(), NOW())
-- ON CONFLICT DO NOTHING;
