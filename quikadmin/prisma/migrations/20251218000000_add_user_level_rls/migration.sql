-- ============================================================================
-- RLS (Row Level Security) Migration for User-Level Data Isolation
-- ============================================================================
--
-- Purpose: Implement Row Level Security policies for all user-owned tables
-- to ensure data isolation in multi-tenant environment.
--
-- Implementation: Uses PostgreSQL session variables (NOT Supabase auth.uid())
-- This is compatible with Neon PostgreSQL and any external auth provider.
--
-- Pattern: Application sets user context via set_user_context() before queries
-- RLS policies then filter based on current_setting('app.current_user_id')
--
-- Tables covered:
--   1. clients (user-owned)
--   2. client_documents (user-owned)
--   3. client_profiles (via client ownership)
--   4. extracted_data (via client ownership)
--   5. filled_forms (user-owned)
--   6. form_templates (user-owned)
--   7. documents (user-owned, legacy form-filling)
--   8. templates (user-owned)
--   9. user_settings (user-owned)
--  10. user_profiles (user-owned)
--  11. field_mappings (user-owned)
--
-- Security Model:
--   - Users can only access their own data
--   - For client-owned data, verify ownership through client.user_id
--   - Admins bypass all policies via is_admin() helper
-- ============================================================================

-- ============================================================================
-- STEP 1: Create Helper Functions
-- ============================================================================

-- Function: Set user context for RLS policies
-- Must be called BEFORE any queries that need RLS filtering
-- Uses transaction-scoped setting (true) for connection pool safety
CREATE OR REPLACE FUNCTION set_user_context(user_id text)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_id, true);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_user_context(text) IS
'Sets the current user ID for RLS policies. Call this at the start of each request.
Transaction-scoped (auto-resets after commit/rollback) for connection pool safety.';

-- Function: Get current user ID from session
-- Returns NULL if not set (policy will deny access)
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS text AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_user_id', true), '');
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_current_user_id() IS
'Returns the current user ID from session context. Returns NULL if not set.';

-- Function: Check if current user is an admin
-- Used to bypass RLS policies for admin operations
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
DECLARE
    current_user_id text;
    user_role text;
BEGIN
    current_user_id := get_current_user_id();
    IF current_user_id IS NULL THEN
        RETURN false;
    END IF;

    SELECT role INTO user_role
    FROM users
    WHERE id = current_user_id;

    RETURN user_role = 'ADMIN';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION is_admin() IS
'Returns true if the current user (from session context) has ADMIN role.
SECURITY DEFINER allows checking user role regardless of RLS on users table.';

-- ============================================================================
-- STEP 2: Enable RLS on User-Owned Tables
-- ============================================================================

-- 1. clients - Users own clients directly
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- 2. client_documents - Documents belong to users via user_id column
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

-- 3. client_profiles - Profiles belong to clients (which belong to users)
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

-- 4. extracted_data - Extracted data belongs to clients
ALTER TABLE extracted_data ENABLE ROW LEVEL SECURITY;

-- 5. filled_forms - Filled forms have direct user_id
ALTER TABLE filled_forms ENABLE ROW LEVEL SECURITY;

-- 6. form_templates - Templates have direct user_id
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;

-- 7. documents - Legacy form-filling documents (userId column)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 8. templates - User-owned templates
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- 9. user_settings - User's own settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 10. user_profiles - User's own profile
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 11. field_mappings - User's field mappings
ALTER TABLE field_mappings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: RLS Policies for CLIENTS Table
-- ============================================================================

-- SELECT: Users can view their own clients, admins can view all
CREATE POLICY "clients_select_policy" ON clients
    FOR SELECT
    USING (
        user_id = get_current_user_id()
        OR is_admin()
    );

-- INSERT: Users can create clients for themselves
CREATE POLICY "clients_insert_policy" ON clients
    FOR INSERT
    WITH CHECK (
        user_id = get_current_user_id()
    );

-- UPDATE: Users can update their own clients, admins can update all
CREATE POLICY "clients_update_policy" ON clients
    FOR UPDATE
    USING (
        user_id = get_current_user_id()
        OR is_admin()
    )
    WITH CHECK (
        user_id = get_current_user_id()
        OR is_admin()
    );

-- DELETE: Users can delete their own clients, admins can delete all
CREATE POLICY "clients_delete_policy" ON clients
    FOR DELETE
    USING (
        user_id = get_current_user_id()
        OR is_admin()
    );

-- ============================================================================
-- STEP 4: RLS Policies for CLIENT_DOCUMENTS Table
-- ============================================================================

-- SELECT: Users can view documents they own
CREATE POLICY "client_documents_select_policy" ON client_documents
    FOR SELECT
    USING (
        user_id = get_current_user_id()
        OR is_admin()
    );

-- INSERT: Users can create documents for their clients
CREATE POLICY "client_documents_insert_policy" ON client_documents
    FOR INSERT
    WITH CHECK (
        user_id = get_current_user_id()
        AND client_id IN (
            SELECT id FROM clients WHERE user_id = get_current_user_id()
        )
    );

-- UPDATE: Users can update their own documents
CREATE POLICY "client_documents_update_policy" ON client_documents
    FOR UPDATE
    USING (
        user_id = get_current_user_id()
        OR is_admin()
    )
    WITH CHECK (
        user_id = get_current_user_id()
    );

-- DELETE: Users can delete their own documents
CREATE POLICY "client_documents_delete_policy" ON client_documents
    FOR DELETE
    USING (
        user_id = get_current_user_id()
        OR is_admin()
    );

-- ============================================================================
-- STEP 5: RLS Policies for CLIENT_PROFILES Table
-- ============================================================================

-- SELECT: Users can view profiles for their clients
CREATE POLICY "client_profiles_select_policy" ON client_profiles
    FOR SELECT
    USING (
        client_id IN (
            SELECT id FROM clients WHERE user_id = get_current_user_id()
        )
        OR is_admin()
    );

-- INSERT: Users can create profiles for their clients
CREATE POLICY "client_profiles_insert_policy" ON client_profiles
    FOR INSERT
    WITH CHECK (
        client_id IN (
            SELECT id FROM clients WHERE user_id = get_current_user_id()
        )
    );

-- UPDATE: Users can update profiles for their clients
CREATE POLICY "client_profiles_update_policy" ON client_profiles
    FOR UPDATE
    USING (
        client_id IN (
            SELECT id FROM clients WHERE user_id = get_current_user_id()
        )
        OR is_admin()
    )
    WITH CHECK (
        client_id IN (
            SELECT id FROM clients WHERE user_id = get_current_user_id()
        )
    );

-- DELETE: Users can delete profiles for their clients
CREATE POLICY "client_profiles_delete_policy" ON client_profiles
    FOR DELETE
    USING (
        client_id IN (
            SELECT id FROM clients WHERE user_id = get_current_user_id()
        )
        OR is_admin()
    );

-- ============================================================================
-- STEP 6: RLS Policies for EXTRACTED_DATA Table
-- ============================================================================

-- SELECT: Users can view extracted data for their clients
CREATE POLICY "extracted_data_select_policy" ON extracted_data
    FOR SELECT
    USING (
        client_id IN (
            SELECT id FROM clients WHERE user_id = get_current_user_id()
        )
        OR is_admin()
    );

-- INSERT: Users can create extracted data for their clients
CREATE POLICY "extracted_data_insert_policy" ON extracted_data
    FOR INSERT
    WITH CHECK (
        client_id IN (
            SELECT id FROM clients WHERE user_id = get_current_user_id()
        )
    );

-- UPDATE: Users can update extracted data for their clients
CREATE POLICY "extracted_data_update_policy" ON extracted_data
    FOR UPDATE
    USING (
        client_id IN (
            SELECT id FROM clients WHERE user_id = get_current_user_id()
        )
        OR is_admin()
    )
    WITH CHECK (
        client_id IN (
            SELECT id FROM clients WHERE user_id = get_current_user_id()
        )
    );

-- DELETE: Users can delete extracted data for their clients
CREATE POLICY "extracted_data_delete_policy" ON extracted_data
    FOR DELETE
    USING (
        client_id IN (
            SELECT id FROM clients WHERE user_id = get_current_user_id()
        )
        OR is_admin()
    );

-- ============================================================================
-- STEP 7: RLS Policies for FILLED_FORMS Table
-- ============================================================================

-- SELECT: Users can view their filled forms
CREATE POLICY "filled_forms_select_policy" ON filled_forms
    FOR SELECT
    USING (
        user_id = get_current_user_id()
        OR is_admin()
    );

-- INSERT: Users can create filled forms for their clients
CREATE POLICY "filled_forms_insert_policy" ON filled_forms
    FOR INSERT
    WITH CHECK (
        user_id = get_current_user_id()
        AND client_id IN (
            SELECT id FROM clients WHERE user_id = get_current_user_id()
        )
    );

-- UPDATE: Users can update their filled forms
CREATE POLICY "filled_forms_update_policy" ON filled_forms
    FOR UPDATE
    USING (
        user_id = get_current_user_id()
        OR is_admin()
    )
    WITH CHECK (
        user_id = get_current_user_id()
    );

-- DELETE: Users can delete their filled forms
CREATE POLICY "filled_forms_delete_policy" ON filled_forms
    FOR DELETE
    USING (
        user_id = get_current_user_id()
        OR is_admin()
    );

-- ============================================================================
-- STEP 8: RLS Policies for FORM_TEMPLATES Table
-- ============================================================================

-- SELECT: Users can view their own templates
CREATE POLICY "form_templates_select_policy" ON form_templates
    FOR SELECT
    USING (
        user_id = get_current_user_id()
        OR is_admin()
    );

-- INSERT: Users can create their own templates
CREATE POLICY "form_templates_insert_policy" ON form_templates
    FOR INSERT
    WITH CHECK (
        user_id = get_current_user_id()
    );

-- UPDATE: Users can update their own templates
CREATE POLICY "form_templates_update_policy" ON form_templates
    FOR UPDATE
    USING (
        user_id = get_current_user_id()
        OR is_admin()
    )
    WITH CHECK (
        user_id = get_current_user_id()
    );

-- DELETE: Users can delete their own templates
CREATE POLICY "form_templates_delete_policy" ON form_templates
    FOR DELETE
    USING (
        user_id = get_current_user_id()
        OR is_admin()
    );

-- ============================================================================
-- STEP 9: RLS Policies for DOCUMENTS Table (Legacy Form-Filling)
-- ============================================================================

-- SELECT: Users can view their own documents
CREATE POLICY "documents_select_policy" ON documents
    FOR SELECT
    USING (
        "userId" = get_current_user_id()
        OR is_admin()
    );

-- INSERT: Users can create their own documents
CREATE POLICY "documents_insert_policy" ON documents
    FOR INSERT
    WITH CHECK (
        "userId" = get_current_user_id()
    );

-- UPDATE: Users can update their own documents
CREATE POLICY "documents_update_policy" ON documents
    FOR UPDATE
    USING (
        "userId" = get_current_user_id()
        OR is_admin()
    )
    WITH CHECK (
        "userId" = get_current_user_id()
    );

-- DELETE: Users can delete their own documents
CREATE POLICY "documents_delete_policy" ON documents
    FOR DELETE
    USING (
        "userId" = get_current_user_id()
        OR is_admin()
    );

-- ============================================================================
-- STEP 10: RLS Policies for TEMPLATES Table
-- ============================================================================

-- SELECT: Users can view their own templates
CREATE POLICY "templates_select_policy" ON templates
    FOR SELECT
    USING (
        "userId" = get_current_user_id()
        OR is_admin()
    );

-- INSERT: Users can create their own templates
CREATE POLICY "templates_insert_policy" ON templates
    FOR INSERT
    WITH CHECK (
        "userId" = get_current_user_id()
    );

-- UPDATE: Users can update their own templates
CREATE POLICY "templates_update_policy" ON templates
    FOR UPDATE
    USING (
        "userId" = get_current_user_id()
        OR is_admin()
    )
    WITH CHECK (
        "userId" = get_current_user_id()
    );

-- DELETE: Users can delete their own templates
CREATE POLICY "templates_delete_policy" ON templates
    FOR DELETE
    USING (
        "userId" = get_current_user_id()
        OR is_admin()
    );

-- ============================================================================
-- STEP 11: RLS Policies for USER_SETTINGS Table
-- ============================================================================

-- SELECT: Users can view their own settings
CREATE POLICY "user_settings_select_policy" ON user_settings
    FOR SELECT
    USING (
        user_id = get_current_user_id()
        OR is_admin()
    );

-- INSERT: Users can create their own settings
CREATE POLICY "user_settings_insert_policy" ON user_settings
    FOR INSERT
    WITH CHECK (
        user_id = get_current_user_id()
    );

-- UPDATE: Users can update their own settings
CREATE POLICY "user_settings_update_policy" ON user_settings
    FOR UPDATE
    USING (
        user_id = get_current_user_id()
        OR is_admin()
    )
    WITH CHECK (
        user_id = get_current_user_id()
    );

-- DELETE: Users can delete their own settings
CREATE POLICY "user_settings_delete_policy" ON user_settings
    FOR DELETE
    USING (
        user_id = get_current_user_id()
        OR is_admin()
    );

-- ============================================================================
-- STEP 12: RLS Policies for USER_PROFILES Table
-- ============================================================================

-- SELECT: Users can view their own profile
CREATE POLICY "user_profiles_select_policy" ON user_profiles
    FOR SELECT
    USING (
        user_id = get_current_user_id()
        OR is_admin()
    );

-- INSERT: Users can create their own profile
CREATE POLICY "user_profiles_insert_policy" ON user_profiles
    FOR INSERT
    WITH CHECK (
        user_id = get_current_user_id()
    );

-- UPDATE: Users can update their own profile
CREATE POLICY "user_profiles_update_policy" ON user_profiles
    FOR UPDATE
    USING (
        user_id = get_current_user_id()
        OR is_admin()
    )
    WITH CHECK (
        user_id = get_current_user_id()
    );

-- DELETE: Users can delete their own profile
CREATE POLICY "user_profiles_delete_policy" ON user_profiles
    FOR DELETE
    USING (
        user_id = get_current_user_id()
        OR is_admin()
    );

-- ============================================================================
-- STEP 13: RLS Policies for FIELD_MAPPINGS Table
-- ============================================================================

-- SELECT: Users can view their own field mappings
CREATE POLICY "field_mappings_select_policy" ON field_mappings
    FOR SELECT
    USING (
        "userId" = get_current_user_id()
        OR is_admin()
    );

-- INSERT: Users can create their own field mappings
CREATE POLICY "field_mappings_insert_policy" ON field_mappings
    FOR INSERT
    WITH CHECK (
        "userId" = get_current_user_id()
    );

-- UPDATE: Users can update their own field mappings
CREATE POLICY "field_mappings_update_policy" ON field_mappings
    FOR UPDATE
    USING (
        "userId" = get_current_user_id()
        OR is_admin()
    )
    WITH CHECK (
        "userId" = get_current_user_id()
    );

-- DELETE: Users can delete their own field mappings
CREATE POLICY "field_mappings_delete_policy" ON field_mappings
    FOR DELETE
    USING (
        "userId" = get_current_user_id()
        OR is_admin()
    );

-- ============================================================================
-- STEP 14: Create indexes for RLS performance
-- ============================================================================

-- These indexes improve RLS policy evaluation performance
-- Most already exist from schema, but add any missing ones

-- ============================================================================
-- Migration Complete
-- ============================================================================
--
-- IMPORTANT: Application Integration Required
--
-- For RLS to work, the application must call set_user_context() before queries:
--
--   await prisma.$executeRawUnsafe(
--     'SELECT set_user_context($1)',
--     userId
--   );
--
-- Or in a transaction:
--
--   await prisma.$transaction(async (tx) => {
--     await tx.$executeRawUnsafe('SELECT set_user_context($1)', userId);
--     // ... your queries here, automatically filtered by RLS
--   });
--
-- The existing authenticateSupabase middleware should be updated to set
-- the user context after validating the JWT token.
--
-- Testing recommendations:
--   1. Test as regular user - should only see own data
--   2. Test as admin - should see all data
--   3. Test client ownership - should not access other users' clients
--   4. Test INSERT with wrong user_id - should fail
--   5. Test UPDATE of other users' data - should fail
--   6. Test without setting user context - should return empty results
--
-- ============================================================================
