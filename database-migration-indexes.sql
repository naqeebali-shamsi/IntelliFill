-- Migration: Add indexes and encryption support for QuikAdmin MVP
-- Date: 2025-10-03
-- Purpose: Performance optimization and security enhancements

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_user_id_status
  ON documents(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_user_id_file_type
  ON documents(user_id, file_type);

-- GIN index for JSONB extracted_data field (enables fast querying)
-- Note: extracted_data will now store encrypted strings, so this is for future when we need it
CREATE INDEX IF NOT EXISTS idx_documents_created_at
  ON documents(created_at DESC);

-- Add index for templates
CREATE INDEX IF NOT EXISTS idx_templates_user_id
  ON templates(user_id, is_active);

-- Add index for field_mappings
CREATE INDEX IF NOT EXISTS idx_field_mappings_user_id
  ON field_mappings(user_id, is_active);

-- Add index for refresh_tokens (for faster auth lookups)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
  ON refresh_tokens(user_id, expires_at);

-- Add index for sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_id
  ON sessions(user_id, expires_at);

-- Performance: Add partial index for active documents only
CREATE INDEX IF NOT EXISTS idx_documents_active
  ON documents(user_id, created_at DESC)
  WHERE status = 'COMPLETED';

COMMENT ON INDEX idx_documents_user_id_status IS 'Composite index for user document listings with status filter';
COMMENT ON INDEX idx_documents_active IS 'Partial index for completed documents - most common query';
