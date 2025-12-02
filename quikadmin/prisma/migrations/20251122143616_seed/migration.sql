/*
  Warnings:

  - You are about to drop the column `documentType` on the `templates` table. All the data in the column will be lost.
  - Added the required column `formType` to the `templates` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."templates" DROP COLUMN "documentType",
ADD COLUMN     "formType" TEXT NOT NULL,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "usageCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "fieldMappings" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "templates_userId_idx" ON "public"."templates"("userId");

-- CreateIndex
CREATE INDEX "templates_formType_idx" ON "public"."templates"("formType");

-- CreateIndex
CREATE INDEX "templates_isPublic_idx" ON "public"."templates"("isPublic");
