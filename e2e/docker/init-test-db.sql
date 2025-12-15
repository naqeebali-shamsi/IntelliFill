-- IntelliFill E2E Test Database Initialization
--
-- This script:
-- 1. Enables pgvector extension
-- 2. Creates all required tables (matching Prisma schema)
-- 3. Seeds test data (users, documents, templates)
--
-- Runs automatically when postgres-test container starts

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Organizations (multi-tenancy)
CREATE TABLE IF NOT EXISTS "organizations" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "email" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  "first_name" TEXT,
  "last_name" TEXT,
  "role" TEXT NOT NULL DEFAULT 'USER',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "email_verified" BOOLEAN NOT NULL DEFAULT false,
  "supabase_user_id" TEXT UNIQUE,
  "organization_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_login" TIMESTAMP(3),
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "users_organization_id_idx" ON "users"("organization_id");

-- Refresh Tokens
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "token" TEXT NOT NULL UNIQUE,
  "user_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Sessions
CREATE TABLE IF NOT EXISTS "sessions" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "user_id" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- ============================================================================
-- CLIENT & DOCUMENT TABLES (Client-Centric Architecture)
-- ============================================================================

-- Clients
CREATE TABLE IF NOT EXISTS "clients" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "clients_user_id_idx" ON "clients"("user_id");
CREATE INDEX IF NOT EXISTS "clients_status_idx" ON "clients"("status");
CREATE INDEX IF NOT EXISTS "clients_name_idx" ON "clients"("name");

-- Client Profiles (unified data from all client documents)
CREATE TABLE IF NOT EXISTS "client_profiles" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "client_id" TEXT NOT NULL UNIQUE,
  "data" JSONB NOT NULL DEFAULT '{}',
  "field_sources" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "client_profiles_client_id_idx" ON "client_profiles"("client_id");

-- Client Documents
CREATE TABLE IF NOT EXISTS "client_documents" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "client_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_type" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "storage_url" TEXT NOT NULL,
  "category" TEXT,
  "status" TEXT NOT NULL DEFAULT 'UPLOADED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "client_documents_client_id_idx" ON "client_documents"("client_id");
CREATE INDEX IF NOT EXISTS "client_documents_user_id_idx" ON "client_documents"("user_id");
CREATE INDEX IF NOT EXISTS "client_documents_category_idx" ON "client_documents"("category");
CREATE INDEX IF NOT EXISTS "client_documents_status_idx" ON "client_documents"("status");

-- Extracted Data (OCR results)
CREATE TABLE IF NOT EXISTS "extracted_data" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "document_id" TEXT NOT NULL UNIQUE,
  "client_id" TEXT NOT NULL,
  "raw_text" TEXT,
  "fields" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "extracted_at" TIMESTAMP(3),
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("document_id") REFERENCES "client_documents"("id") ON DELETE CASCADE,
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "extracted_data_client_id_idx" ON "extracted_data"("client_id");
CREATE INDEX IF NOT EXISTS "extracted_data_document_id_idx" ON "extracted_data"("document_id");
CREATE INDEX IF NOT EXISTS "extracted_data_status_idx" ON "extracted_data"("status");

-- Form Templates
CREATE TABLE IF NOT EXISTS "form_templates" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "file_url" TEXT NOT NULL,
  "field_mappings" JSONB NOT NULL DEFAULT '{}',
  "detected_fields" JSONB NOT NULL DEFAULT '[]',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "form_templates_user_id_idx" ON "form_templates"("user_id");
CREATE INDEX IF NOT EXISTS "form_templates_category_idx" ON "form_templates"("category");
CREATE INDEX IF NOT EXISTS "form_templates_is_active_idx" ON "form_templates"("is_active");

-- Filled Forms (generated forms history)
CREATE TABLE IF NOT EXISTS "filled_forms" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "client_id" TEXT NOT NULL,
  "template_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "file_url" TEXT NOT NULL,
  "data_snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE,
  FOREIGN KEY ("template_id") REFERENCES "form_templates"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "filled_forms_client_id_idx" ON "filled_forms"("client_id");
CREATE INDEX IF NOT EXISTS "filled_forms_template_id_idx" ON "filled_forms"("template_id");
CREATE INDEX IF NOT EXISTS "filled_forms_user_id_idx" ON "filled_forms"("user_id");

-- ============================================================================
-- LEGACY DOCUMENT TABLES (for form-filling)
-- ============================================================================

-- Documents (legacy)
CREATE TABLE IF NOT EXISTS "documents" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "user_id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_type" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "storage_url" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "extracted_text" TEXT,
  "extracted_data" JSONB,
  "confidence" DOUBLE PRECISION,
  "template_id" TEXT,
  "processed_at" TIMESTAMP(3),
  "reprocess_count" INTEGER NOT NULL DEFAULT 0,
  "last_reprocessed_at" TIMESTAMP(3),
  "reprocessing_history" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Templates (legacy)
CREATE TABLE IF NOT EXISTS "templates" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "user_id" TEXT NOT NULL,
  "form_type" TEXT NOT NULL,
  "field_mappings" TEXT NOT NULL,
  "is_public" BOOLEAN NOT NULL DEFAULT false,
  "usage_count" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- ============================================================================
-- VECTOR SEARCH TABLES
-- ============================================================================

-- Document Sources (for vector search)
CREATE TABLE IF NOT EXISTS "document_sources" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "organization_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "linked_document_id" TEXT,
  "title" TEXT NOT NULL,
  "filename" TEXT,
  "mime_type" TEXT,
  "file_size" INTEGER,
  "page_count" INTEGER,
  "storage_url" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "error_message" TEXT,
  "chunk_count" INTEGER NOT NULL DEFAULT 0,
  "processing_time_ms" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id"),
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "document_sources_organization_id_idx" ON "document_sources"("organization_id");
CREATE INDEX IF NOT EXISTS "document_sources_user_id_idx" ON "document_sources"("user_id");
CREATE INDEX IF NOT EXISTS "document_sources_status_idx" ON "document_sources"("status");

-- Document Chunks (with vector embeddings)
CREATE TABLE IF NOT EXISTS "document_chunks" (
  "id" TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  "source_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "token_count" INTEGER NOT NULL,
  "text_hash" VARCHAR(64) NOT NULL,
  "chunk_index" INTEGER NOT NULL,
  "page_number" INTEGER,
  "section_header" TEXT,
  "embedding_model" TEXT NOT NULL DEFAULT 'text-embedding-004',
  "embedding" vector(768),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("source_id") REFERENCES "document_sources"("id") ON DELETE CASCADE,
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
);

CREATE INDEX IF NOT EXISTS "document_chunks_source_id_idx" ON "document_chunks"("source_id");
CREATE INDEX IF NOT EXISTS "document_chunks_organization_id_idx" ON "document_chunks"("organization_id");
CREATE INDEX IF NOT EXISTS "document_chunks_text_hash_idx" ON "document_chunks"("text_hash");

-- ============================================================================
-- SEED TEST DATA
-- ============================================================================

-- Create test organization
INSERT INTO "organizations" ("id", "name", "status") VALUES
  ('test-org-001', 'Test Organization', 'ACTIVE')
ON CONFLICT DO NOTHING;

-- Create test users
-- Password: Test123!@# (hashed with bcrypt)
INSERT INTO "users" ("id", "email", "password", "first_name", "last_name", "role", "is_active", "email_verified", "organization_id") VALUES
  ('test-user-001', 'test@intellifill.local', '$2b$10$wQYMOJ1DkdfopKu3JJ8mXezi4SXGo0UvMl5Gd8301HuOEiKSpz2jS', 'Test', 'User', 'USER', true, true, 'test-org-001'),
  ('test-admin-001', 'admin@intellifill.local', '$2b$10$YOX3xdFNaV1tqFFAlH48FO1trm7xOQ5fLN0CzULr4GRHWofQeI7EG', 'Admin', 'User', 'ADMIN', true, true, 'test-org-001')
ON CONFLICT DO NOTHING;

-- Create test client
INSERT INTO "clients" ("id", "user_id", "name", "type", "status") VALUES
  ('test-client-001', 'test-user-001', 'John Doe', 'INDIVIDUAL', 'ACTIVE')
ON CONFLICT DO NOTHING;

-- Create test client profile
INSERT INTO "client_profiles" ("id", "client_id", "data", "field_sources") VALUES
  ('test-profile-001', 'test-client-001',
   '{"firstName": "John", "lastName": "Doe", "email": "john.doe@example.com", "phone": "555-0100"}',
   '{"firstName": {"documentId": null, "extractedAt": null}, "lastName": {"documentId": null, "extractedAt": null}}')
ON CONFLICT DO NOTHING;

-- Create test form template
INSERT INTO "form_templates" ("id", "user_id", "name", "description", "category", "file_url", "field_mappings", "detected_fields") VALUES
  ('test-template-001', 'test-user-001', 'Sample W2 Form', 'Test W2 form template', 'GOVERNMENT',
   '/templates/sample-w2.pdf',
   '{"employeeName": "firstName", "employeeSSN": "ssn", "employerName": "employerName"}',
   '["employeeName", "employeeSSN", "employerName", "wages"]')
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO intellifill_test;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO intellifill_test;

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to relevant tables
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name
        FROM information_schema.columns
        WHERE column_name = 'updated_at'
          AND table_schema = 'public'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', t, t);
        EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Vacuum and analyze for performance
VACUUM ANALYZE;
