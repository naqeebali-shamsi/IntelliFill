-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OrgMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'LEFT');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('COMPANY', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('PASSPORT', 'EMIRATES_ID', 'TRADE_LICENSE', 'VISA', 'LABOR_CARD', 'ESTABLISHMENT_CARD', 'MOA', 'BANK_STATEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ClientDocumentStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'EXTRACTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'COMPLETED', 'REVIEWED', 'FAILED');

-- CreateEnum
CREATE TYPE "FormCategory" AS ENUM ('VISA', 'COMPANY_FORMATION', 'LABOR', 'IMMIGRATION', 'BANKING', 'GOVERNMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER', 'VIEWER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'REPROCESSING', 'COMPLETED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('single', 'multiple', 'batch');

-- CreateEnum
CREATE TYPE "DocumentSourceStatus" AS ENUM ('PENDING', 'EXTRACTING', 'CHUNKING', 'EMBEDDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MultiAgentProcessingStatus" AS ENUM ('PENDING', 'CLASSIFYING', 'EXTRACTING', 'MAPPING', 'VALIDATING', 'RECOVERING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ABTestVariant" AS ENUM ('CONTROL', 'TREATMENT');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "logo_url" TEXT,
    "website" VARCHAR(255),
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "avatar_url" TEXT,
    "phone" VARCHAR(30),
    "job_title" VARCHAR(100),
    "bio" VARCHAR(500),
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "supabaseUserId" TEXT,
    "organization_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLogin" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" "OrgMemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "invited_by" TEXT,
    "invited_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_invitations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrgMemberRole" NOT NULL DEFAULT 'MEMBER',
    "invited_by" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ClientType" NOT NULL DEFAULT 'INDIVIDUAL',
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_profiles" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "field_sources" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_documents" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_url" TEXT NOT NULL,
    "category" "DocumentCategory",
    "status" "ClientDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracted_data" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "raw_text" TEXT,
    "fields" JSONB NOT NULL DEFAULT '{}',
    "status" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "extracted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extracted_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_templates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "FormCategory",
    "file_url" TEXT NOT NULL,
    "field_mappings" JSONB NOT NULL DEFAULT '{}',
    "detected_fields" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filled_forms" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "data_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filled_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "extractedText" TEXT,
    "extractedData" JSONB,
    "multi_agent_result" JSONB,
    "confidence" DOUBLE PRECISION,
    "templateId" TEXT,
    "processedAt" TIMESTAMP(3),
    "reprocess_count" INTEGER NOT NULL DEFAULT 0,
    "last_reprocessed_at" TIMESTAMP(3),
    "reprocessing_history" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "fieldMappings" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_mappings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceField" TEXT NOT NULL,
    "targetField" TEXT NOT NULL,
    "transformRules" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "userId" TEXT,
    "documents_count" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "result" JSONB,
    "error" TEXT,
    "metadata" JSONB,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_history" (
    "id" SERIAL NOT NULL,
    "job_id" TEXT NOT NULL,
    "form_path" TEXT NOT NULL,
    "document_paths" TEXT[],
    "output_path" TEXT NOT NULL,
    "filled_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" DECIMAL(3,2),
    "processing_time" INTEGER,
    "ocr_applied" BOOLEAN NOT NULL DEFAULT false,
    "ml_enhanced" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" TEXT NOT NULL,
    "default_validation_rules" JSONB,
    "preferred_language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_process_complete" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_org_invite" BOOLEAN NOT NULL DEFAULT true,
    "digest_frequency" VARCHAR(20) NOT NULL DEFAULT 'never',
    "webhook_url" TEXT,
    "auto_ocr" BOOLEAN NOT NULL DEFAULT false,
    "auto_ml_enhancement" BOOLEAN NOT NULL DEFAULT true,
    "default_output_format" VARCHAR(20) NOT NULL DEFAULT 'pdf',
    "theme" VARCHAR(20) NOT NULL DEFAULT 'system',
    "compact_mode" BOOLEAN NOT NULL DEFAULT false,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "profile_data" JSONB NOT NULL,
    "last_aggregated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" VARCHAR(255) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "status_code" INTEGER,
    "response_time" INTEGER,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ml_models" (
    "id" SERIAL NOT NULL,
    "model_name" VARCHAR(255) NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "accuracy" DECIMAL(3,2),
    "precision_score" DECIMAL(3,2),
    "recall_score" DECIMAL(3,2),
    "f1_score" DECIMAL(3,2),
    "training_samples" INTEGER,
    "model_path" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ml_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT,
    "organization_id" TEXT,
    "action" VARCHAR(255) NOT NULL,
    "entity_type" VARCHAR(100),
    "entity_id" VARCHAR(255),
    "old_value" JSONB,
    "new_value" JSONB,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sources" (
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
    "status" "DocumentSourceStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "processing_time_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "document_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunks" (
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

-- CreateTable
CREATE TABLE "processing_checkpoints" (
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

-- CreateTable
CREATE TABLE "multi_agent_processing" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "status" "MultiAgentProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "pipeline_version" VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "current_agent" VARCHAR(50),
    "agent_history" JSONB NOT NULL DEFAULT '[]',
    "extractedData" JSONB,
    "multi_agent_result" JSONB,
    "confidence" DOUBLE PRECISION,
    "quality_score" DOUBLE PRECISION,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "multi_agent_processing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "multi_agent_checkpoints" (
    "id" TEXT NOT NULL,
    "processing_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "checkpoint_id" TEXT NOT NULL,
    "parent_checkpoint_id" TEXT,
    "state_data" BYTEA NOT NULL,
    "state_metadata" JSONB NOT NULL DEFAULT '{}',
    "current_node" VARCHAR(50) NOT NULL,
    "pending_nodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "completed_nodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "multi_agent_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_test_assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "test_name" VARCHAR(100) NOT NULL,
    "variant" "ABTestVariant" NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ab_test_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_comparisons" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "multi_agent_processing_id" TEXT NOT NULL,
    "legacy_result" JSONB,
    "legacy_confidence" DOUBLE PRECISION,
    "legacy_processing_time_ms" INTEGER,
    "multi_agent_result" JSONB,
    "multi_agent_confidence" DOUBLE PRECISION,
    "multi_agent_processing_time_ms" INTEGER,
    "field_diff" JSONB,
    "matching_fields_count" INTEGER,
    "total_fields_count" INTEGER,
    "accuracy_delta" DOUBLE PRECISION,
    "winner" VARCHAR(20),
    "assessed_by" TEXT,
    "assessment_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_feedback" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "job_id" TEXT,
    "accuracy_rating" INTEGER NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "fields_feedback" JSONB,
    "comments" TEXT,
    "processing_type" VARCHAR(20) NOT NULL,
    "test_variant" "ABTestVariant",
    "document_category" VARCHAR(50),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "percentage" INTEGER NOT NULL DEFAULT 0,
    "rules" JSONB NOT NULL DEFAULT '{}',
    "target_users" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exclude_users" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_metrics" (
    "id" TEXT NOT NULL,
    "agent_name" VARCHAR(50) NOT NULL,
    "model_name" VARCHAR(50) NOT NULL,
    "processing_time_ms" INTEGER NOT NULL,
    "token_count" INTEGER,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL,
    "confidence_score" DOUBLE PRECISION,
    "quality_score" DOUBLE PRECISION,
    "error_type" VARCHAR(100),
    "error_message" TEXT,
    "document_category" VARCHAR(50),
    "job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csp_reports" (
    "id" TEXT NOT NULL,
    "document_uri" VARCHAR(2048) NOT NULL,
    "blocked_uri" VARCHAR(2048) NOT NULL,
    "violated_directive" VARCHAR(255) NOT NULL,
    "effective_directive" VARCHAR(255),
    "source_file" VARCHAR(2048),
    "line_number" INTEGER,
    "column_number" INTEGER,
    "user_agent" VARCHAR(500),
    "ip_address" VARCHAR(45),
    "count" INTEGER NOT NULL DEFAULT 1,
    "first_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alert_sent" BOOLEAN NOT NULL DEFAULT false,
    "alert_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "csp_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_supabaseUserId_key" ON "users"("supabaseUserId");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "organization_memberships_user_id_idx" ON "organization_memberships"("user_id");

-- CreateIndex
CREATE INDEX "organization_memberships_organization_id_idx" ON "organization_memberships"("organization_id");

-- CreateIndex
CREATE INDEX "organization_memberships_status_idx" ON "organization_memberships"("status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_memberships_user_id_organization_id_key" ON "organization_memberships"("user_id", "organization_id");

-- CreateIndex
CREATE INDEX "organization_invitations_email_idx" ON "organization_invitations"("email");

-- CreateIndex
CREATE INDEX "organization_invitations_status_idx" ON "organization_invitations"("status");

-- CreateIndex
CREATE INDEX "organization_invitations_expires_at_idx" ON "organization_invitations"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "organization_invitations_organization_id_email_key" ON "organization_invitations"("organization_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "clients_user_id_idx" ON "clients"("user_id");

-- CreateIndex
CREATE INDEX "clients_status_idx" ON "clients"("status");

-- CreateIndex
CREATE INDEX "clients_name_idx" ON "clients"("name");

-- CreateIndex
CREATE UNIQUE INDEX "client_profiles_client_id_key" ON "client_profiles"("client_id");

-- CreateIndex
CREATE INDEX "client_profiles_client_id_idx" ON "client_profiles"("client_id");

-- CreateIndex
CREATE INDEX "client_documents_client_id_idx" ON "client_documents"("client_id");

-- CreateIndex
CREATE INDEX "client_documents_user_id_idx" ON "client_documents"("user_id");

-- CreateIndex
CREATE INDEX "client_documents_category_idx" ON "client_documents"("category");

-- CreateIndex
CREATE INDEX "client_documents_status_idx" ON "client_documents"("status");

-- CreateIndex
CREATE UNIQUE INDEX "extracted_data_document_id_key" ON "extracted_data"("document_id");

-- CreateIndex
CREATE INDEX "extracted_data_client_id_idx" ON "extracted_data"("client_id");

-- CreateIndex
CREATE INDEX "extracted_data_document_id_idx" ON "extracted_data"("document_id");

-- CreateIndex
CREATE INDEX "extracted_data_status_idx" ON "extracted_data"("status");

-- CreateIndex
CREATE INDEX "form_templates_user_id_idx" ON "form_templates"("user_id");

-- CreateIndex
CREATE INDEX "form_templates_category_idx" ON "form_templates"("category");

-- CreateIndex
CREATE INDEX "form_templates_is_active_idx" ON "form_templates"("is_active");

-- CreateIndex
CREATE INDEX "filled_forms_client_id_idx" ON "filled_forms"("client_id");

-- CreateIndex
CREATE INDEX "filled_forms_template_id_idx" ON "filled_forms"("template_id");

-- CreateIndex
CREATE INDEX "filled_forms_user_id_idx" ON "filled_forms"("user_id");

-- CreateIndex
CREATE INDEX "filled_forms_created_at_idx" ON "filled_forms"("created_at" DESC);

-- CreateIndex
CREATE INDEX "templates_userId_idx" ON "templates"("userId");

-- CreateIndex
CREATE INDEX "templates_formType_idx" ON "templates"("formType");

-- CreateIndex
CREATE INDEX "templates_isPublic_idx" ON "templates"("isPublic");

-- CreateIndex
CREATE INDEX "jobs_userId_idx" ON "jobs"("userId");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_created_at_idx" ON "jobs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "jobs_type_status_idx" ON "jobs"("type", "status");

-- CreateIndex
CREATE INDEX "processing_history_job_id_idx" ON "processing_history"("job_id");

-- CreateIndex
CREATE INDEX "processing_history_created_at_idx" ON "processing_history"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "user_profiles_user_id_idx" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "api_usage_user_id_idx" ON "api_usage"("user_id");

-- CreateIndex
CREATE INDEX "api_usage_created_at_idx" ON "api_usage"("created_at" DESC);

-- CreateIndex
CREATE INDEX "api_usage_endpoint_idx" ON "api_usage"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "ml_models_model_name_version_key" ON "ml_models"("model_name", "version");

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_organization_id_idx" ON "audit_log"("organization_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "document_sources_organization_id_idx" ON "document_sources"("organization_id");

-- CreateIndex
CREATE INDEX "document_sources_user_id_idx" ON "document_sources"("user_id");

-- CreateIndex
CREATE INDEX "document_sources_status_idx" ON "document_sources"("status");

-- CreateIndex
CREATE INDEX "document_sources_organization_id_status_idx" ON "document_sources"("organization_id", "status");

-- CreateIndex
CREATE INDEX "document_chunks_source_id_idx" ON "document_chunks"("source_id");

-- CreateIndex
CREATE INDEX "document_chunks_organization_id_idx" ON "document_chunks"("organization_id");

-- CreateIndex
CREATE INDEX "document_chunks_organization_id_source_id_idx" ON "document_chunks"("organization_id", "source_id");

-- CreateIndex
CREATE INDEX "document_chunks_text_hash_idx" ON "document_chunks"("text_hash");

-- CreateIndex
CREATE UNIQUE INDEX "processing_checkpoints_source_id_key" ON "processing_checkpoints"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "multi_agent_processing_job_id_key" ON "multi_agent_processing"("job_id");

-- CreateIndex
CREATE INDEX "multi_agent_processing_document_id_idx" ON "multi_agent_processing"("document_id");

-- CreateIndex
CREATE INDEX "multi_agent_processing_user_id_idx" ON "multi_agent_processing"("user_id");

-- CreateIndex
CREATE INDEX "multi_agent_processing_job_id_idx" ON "multi_agent_processing"("job_id");

-- CreateIndex
CREATE INDEX "multi_agent_processing_status_idx" ON "multi_agent_processing"("status");

-- CreateIndex
CREATE INDEX "multi_agent_processing_created_at_idx" ON "multi_agent_processing"("created_at" DESC);

-- CreateIndex
CREATE INDEX "multi_agent_checkpoints_processing_id_idx" ON "multi_agent_checkpoints"("processing_id");

-- CreateIndex
CREATE INDEX "multi_agent_checkpoints_thread_id_idx" ON "multi_agent_checkpoints"("thread_id");

-- CreateIndex
CREATE INDEX "multi_agent_checkpoints_created_at_idx" ON "multi_agent_checkpoints"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "multi_agent_checkpoints_processing_id_checkpoint_id_key" ON "multi_agent_checkpoints"("processing_id", "checkpoint_id");

-- CreateIndex
CREATE INDEX "ab_test_assignments_user_id_idx" ON "ab_test_assignments"("user_id");

-- CreateIndex
CREATE INDEX "ab_test_assignments_test_name_variant_idx" ON "ab_test_assignments"("test_name", "variant");

-- CreateIndex
CREATE INDEX "ab_test_assignments_is_active_idx" ON "ab_test_assignments"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "ab_test_assignments_user_id_test_name_key" ON "ab_test_assignments"("user_id", "test_name");

-- CreateIndex
CREATE UNIQUE INDEX "processing_comparisons_multi_agent_processing_id_key" ON "processing_comparisons"("multi_agent_processing_id");

-- CreateIndex
CREATE INDEX "processing_comparisons_document_id_idx" ON "processing_comparisons"("document_id");

-- CreateIndex
CREATE INDEX "processing_comparisons_winner_idx" ON "processing_comparisons"("winner");

-- CreateIndex
CREATE INDEX "processing_comparisons_created_at_idx" ON "processing_comparisons"("created_at" DESC);

-- CreateIndex
CREATE INDEX "user_feedback_user_id_idx" ON "user_feedback"("user_id");

-- CreateIndex
CREATE INDEX "user_feedback_document_id_idx" ON "user_feedback"("document_id");

-- CreateIndex
CREATE INDEX "user_feedback_processing_type_idx" ON "user_feedback"("processing_type");

-- CreateIndex
CREATE INDEX "user_feedback_accuracy_rating_idx" ON "user_feedback"("accuracy_rating");

-- CreateIndex
CREATE INDEX "user_feedback_created_at_idx" ON "user_feedback"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_name_key" ON "feature_flags"("name");

-- CreateIndex
CREATE INDEX "feature_flags_name_idx" ON "feature_flags"("name");

-- CreateIndex
CREATE INDEX "feature_flags_enabled_idx" ON "feature_flags"("enabled");

-- CreateIndex
CREATE INDEX "agent_metrics_agent_name_idx" ON "agent_metrics"("agent_name");

-- CreateIndex
CREATE INDEX "agent_metrics_model_name_idx" ON "agent_metrics"("model_name");

-- CreateIndex
CREATE INDEX "agent_metrics_success_idx" ON "agent_metrics"("success");

-- CreateIndex
CREATE INDEX "agent_metrics_created_at_idx" ON "agent_metrics"("created_at" DESC);

-- CreateIndex
CREATE INDEX "agent_metrics_agent_name_created_at_idx" ON "agent_metrics"("agent_name", "created_at" DESC);

-- CreateIndex
CREATE INDEX "csp_reports_document_uri_blocked_uri_idx" ON "csp_reports"("document_uri", "blocked_uri");

-- CreateIndex
CREATE INDEX "csp_reports_violated_directive_idx" ON "csp_reports"("violated_directive");

-- CreateIndex
CREATE INDEX "csp_reports_created_at_idx" ON "csp_reports"("created_at" DESC);

-- CreateIndex
CREATE INDEX "csp_reports_alert_sent_idx" ON "csp_reports"("alert_sent");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_data" ADD CONSTRAINT "extracted_data_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "client_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_data" ADD CONSTRAINT "extracted_data_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filled_forms" ADD CONSTRAINT "filled_forms_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filled_forms" ADD CONSTRAINT "filled_forms_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "form_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_mappings" ADD CONSTRAINT "field_mappings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_history" ADD CONSTRAINT "processing_history_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sources" ADD CONSTRAINT "document_sources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sources" ADD CONSTRAINT "document_sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "document_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_checkpoints" ADD CONSTRAINT "processing_checkpoints_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "document_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multi_agent_checkpoints" ADD CONSTRAINT "multi_agent_checkpoints_processing_id_fkey" FOREIGN KEY ("processing_id") REFERENCES "multi_agent_processing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_comparisons" ADD CONSTRAINT "processing_comparisons_multi_agent_processing_id_fkey" FOREIGN KEY ("multi_agent_processing_id") REFERENCES "multi_agent_processing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

