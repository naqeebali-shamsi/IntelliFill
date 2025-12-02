-- CreateEnum
CREATE TYPE "public"."JobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "public"."JobType" AS ENUM ('single', 'multiple', 'batch');

-- CreateTable
CREATE TABLE "public"."jobs" (
    "id" TEXT NOT NULL,
    "type" "public"."JobType" NOT NULL,
    "status" "public"."JobStatus" NOT NULL DEFAULT 'pending',
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
CREATE TABLE "public"."processing_history" (
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
CREATE TABLE "public"."user_settings" (
    "user_id" TEXT NOT NULL,
    "default_validation_rules" JSONB,
    "preferred_language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "webhook_url" TEXT,
    "auto_ocr" BOOLEAN NOT NULL DEFAULT false,
    "auto_ml_enhancement" BOOLEAN NOT NULL DEFAULT true,
    "default_output_format" VARCHAR(20) NOT NULL DEFAULT 'pdf',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "public"."api_usage" (
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
CREATE TABLE "public"."ml_models" (
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
CREATE TABLE "public"."audit_log" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT,
    "action" VARCHAR(255) NOT NULL,
    "entity_type" VARCHAR(100),
    "entity_id" VARCHAR(255),
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobs_userId_idx" ON "public"."jobs"("userId");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "public"."jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_created_at_idx" ON "public"."jobs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "jobs_type_status_idx" ON "public"."jobs"("type", "status");

-- CreateIndex
CREATE INDEX "processing_history_job_id_idx" ON "public"."processing_history"("job_id");

-- CreateIndex
CREATE INDEX "processing_history_created_at_idx" ON "public"."processing_history"("created_at" DESC);

-- CreateIndex
CREATE INDEX "api_usage_user_id_idx" ON "public"."api_usage"("user_id");

-- CreateIndex
CREATE INDEX "api_usage_created_at_idx" ON "public"."api_usage"("created_at" DESC);

-- CreateIndex
CREATE INDEX "api_usage_endpoint_idx" ON "public"."api_usage"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "ml_models_model_name_version_key" ON "public"."ml_models"("model_name", "version");

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "public"."audit_log"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "public"."audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "public"."audit_log"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "public"."jobs" ADD CONSTRAINT "jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processing_history" ADD CONSTRAINT "processing_history_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."api_usage" ADD CONSTRAINT "api_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
