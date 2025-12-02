-- CreateEnum
CREATE TYPE "public"."DocumentCategory" AS ENUM ('PASSPORT', 'EMIRATES_ID', 'TRADE_LICENSE', 'VISA', 'LABOR_CARD', 'ESTABLISHMENT_CARD', 'MOA', 'BANK_STATEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ClientDocumentStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'EXTRACTED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."ExtractionStatus" AS ENUM ('PENDING', 'COMPLETED', 'REVIEWED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."FormCategory" AS ENUM ('VISA', 'COMPANY_FORMATION', 'LABOR', 'IMMIGRATION', 'BANKING', 'GOVERNMENT', 'OTHER');

-- CreateTable
CREATE TABLE "public"."client_profiles" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "field_sources" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."client_documents" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_url" TEXT NOT NULL,
    "category" "public"."DocumentCategory",
    "status" "public"."ClientDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."extracted_data" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "raw_text" TEXT,
    "fields" JSONB NOT NULL DEFAULT '{}',
    "status" "public"."ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "extracted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extracted_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."form_templates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "public"."FormCategory",
    "file_url" TEXT NOT NULL,
    "field_mappings" JSONB NOT NULL DEFAULT '{}',
    "detected_fields" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."filled_forms" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "data_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filled_forms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_profiles_client_id_key" ON "public"."client_profiles"("client_id");

-- CreateIndex
CREATE INDEX "client_profiles_client_id_idx" ON "public"."client_profiles"("client_id");

-- CreateIndex
CREATE INDEX "client_documents_client_id_idx" ON "public"."client_documents"("client_id");

-- CreateIndex
CREATE INDEX "client_documents_user_id_idx" ON "public"."client_documents"("user_id");

-- CreateIndex
CREATE INDEX "client_documents_category_idx" ON "public"."client_documents"("category");

-- CreateIndex
CREATE INDEX "client_documents_status_idx" ON "public"."client_documents"("status");

-- CreateIndex
CREATE UNIQUE INDEX "extracted_data_document_id_key" ON "public"."extracted_data"("document_id");

-- CreateIndex
CREATE INDEX "extracted_data_client_id_idx" ON "public"."extracted_data"("client_id");

-- CreateIndex
CREATE INDEX "extracted_data_document_id_idx" ON "public"."extracted_data"("document_id");

-- CreateIndex
CREATE INDEX "extracted_data_status_idx" ON "public"."extracted_data"("status");

-- CreateIndex
CREATE INDEX "form_templates_user_id_idx" ON "public"."form_templates"("user_id");

-- CreateIndex
CREATE INDEX "form_templates_category_idx" ON "public"."form_templates"("category");

-- CreateIndex
CREATE INDEX "form_templates_is_active_idx" ON "public"."form_templates"("is_active");

-- CreateIndex
CREATE INDEX "filled_forms_client_id_idx" ON "public"."filled_forms"("client_id");

-- CreateIndex
CREATE INDEX "filled_forms_template_id_idx" ON "public"."filled_forms"("template_id");

-- CreateIndex
CREATE INDEX "filled_forms_user_id_idx" ON "public"."filled_forms"("user_id");

-- CreateIndex
CREATE INDEX "filled_forms_created_at_idx" ON "public"."filled_forms"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "public"."client_profiles" ADD CONSTRAINT "client_profiles_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."client_documents" ADD CONSTRAINT "client_documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."extracted_data" ADD CONSTRAINT "extracted_data_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."client_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."extracted_data" ADD CONSTRAINT "extracted_data_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."filled_forms" ADD CONSTRAINT "filled_forms_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."filled_forms" ADD CONSTRAINT "filled_forms_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."form_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
