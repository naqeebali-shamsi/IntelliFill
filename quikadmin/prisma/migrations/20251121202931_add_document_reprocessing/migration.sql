-- AlterEnum
ALTER TYPE "DocumentStatus" ADD VALUE 'REPROCESSING';

-- AlterTable
ALTER TABLE "documents" 
ADD COLUMN "reprocess_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "last_reprocessed_at" TIMESTAMP(3),
ADD COLUMN "reprocessing_history" JSONB;
