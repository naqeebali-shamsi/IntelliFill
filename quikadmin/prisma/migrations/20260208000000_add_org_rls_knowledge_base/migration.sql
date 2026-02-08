-- ============================================================================
-- Organization-Level RLS for Knowledge Base Tables
-- ============================================================================
--
-- Purpose: Add organization-level row-level security to document_sources and
-- document_chunks tables to prevent cross-tenant data leakage in the
-- knowledge base system.
--
-- Also adds organizationId and maxAccessCount to document_shares for
-- org-bounded document sharing.
--
-- Pattern: Uses session variable app.current_org_id set via set_org_context()
-- ============================================================================

-- ============================================================================
-- STEP 1: Create Organization Context Functions
-- ============================================================================

-- Function: Set organization context for RLS policies
CREATE OR REPLACE FUNCTION set_org_context(org_id text)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_org_id', org_id, true);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_org_context(text) IS
'Sets the current organization ID for RLS policies. Call alongside set_user_context().
Transaction-scoped (auto-resets after commit/rollback) for connection pool safety.';

-- Function: Get current organization ID from session
CREATE OR REPLACE FUNCTION get_current_org_id()
RETURNS text AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_org_id', true), '');
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_current_org_id() IS
'Returns the current organization ID from session context. Returns NULL if not set.';

-- ============================================================================
-- STEP 2: Enable RLS on Knowledge Base Tables
-- ============================================================================

-- document_sources - Organization-owned knowledge base sources
ALTER TABLE document_sources ENABLE ROW LEVEL SECURITY;

-- document_chunks - Chunks belong to sources (which belong to organizations)
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: RLS Policies for DOCUMENT_SOURCES Table
-- ============================================================================

CREATE POLICY "document_sources_select_policy" ON document_sources
    FOR SELECT
    USING (
        organization_id = get_current_org_id()
        OR is_admin()
    );

CREATE POLICY "document_sources_insert_policy" ON document_sources
    FOR INSERT
    WITH CHECK (
        organization_id = get_current_org_id()
    );

CREATE POLICY "document_sources_update_policy" ON document_sources
    FOR UPDATE
    USING (
        organization_id = get_current_org_id()
        OR is_admin()
    )
    WITH CHECK (
        organization_id = get_current_org_id()
    );

CREATE POLICY "document_sources_delete_policy" ON document_sources
    FOR DELETE
    USING (
        organization_id = get_current_org_id()
        OR is_admin()
    );

-- ============================================================================
-- STEP 4: RLS Policies for DOCUMENT_CHUNKS Table
-- ============================================================================

CREATE POLICY "document_chunks_select_policy" ON document_chunks
    FOR SELECT
    USING (
        organization_id = get_current_org_id()
        OR is_admin()
    );

CREATE POLICY "document_chunks_insert_policy" ON document_chunks
    FOR INSERT
    WITH CHECK (
        organization_id = get_current_org_id()
    );

CREATE POLICY "document_chunks_update_policy" ON document_chunks
    FOR UPDATE
    USING (
        organization_id = get_current_org_id()
        OR is_admin()
    )
    WITH CHECK (
        organization_id = get_current_org_id()
    );

CREATE POLICY "document_chunks_delete_policy" ON document_chunks
    FOR DELETE
    USING (
        organization_id = get_current_org_id()
        OR is_admin()
    );

-- ============================================================================
-- STEP 5: Harden Document Sharing - Add org boundary + access limits
-- ============================================================================

ALTER TABLE document_shares
    ADD COLUMN organization_id TEXT,
    ADD COLUMN max_access_count INT;

CREATE INDEX idx_document_shares_organization_id ON document_shares(organization_id);

-- ============================================================================
-- Migration Complete
-- ============================================================================
--
-- IMPORTANT: Application Integration Required
--
-- The organization context middleware must call set_org_context() alongside
-- set_user_context() for knowledge base queries to work correctly:
--
--   await prisma.$executeRawUnsafe('SELECT set_org_context($1)', organizationId);
--
-- Without org context set, RLS will deny access to document_sources and
-- document_chunks (defense-in-depth with RLS_FAIL_CLOSED).
--
-- ============================================================================
