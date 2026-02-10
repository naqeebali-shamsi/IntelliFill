-- CreateTable
CREATE TABLE "field_inference_cache" (
    "id" TEXT NOT NULL,
    "field_hash" VARCHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL DEFAULT '',
    "label" VARCHAR(200) NOT NULL DEFAULT '',
    "input_type" VARCHAR(50) NOT NULL DEFAULT '',
    "placeholder" VARCHAR(200) NOT NULL DEFAULT '',
    "profile_key" VARCHAR(50) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "hit_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_inference_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "field_inference_cache_field_hash_key" ON "field_inference_cache"("field_hash");

-- CreateIndex
CREATE INDEX "field_inference_cache_field_hash_idx" ON "field_inference_cache"("field_hash");

-- CreateIndex
CREATE INDEX "field_inference_cache_profile_key_idx" ON "field_inference_cache"("profile_key");
