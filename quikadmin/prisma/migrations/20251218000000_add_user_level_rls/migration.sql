-- ============================================================================
-- RLS (Row Level Security) Migration for User-Level Data Isolation
-- ============================================================================
--
-- Purpose: Implement Row Level Security policies for all user-owned tables
-- to ensure data isolation in multi-tenant environment.
--
-- Tables covered:
--   1. clients
--   2. client_documents
--   3. client_profiles
--   4. extracted_data
--   5. filled_forms
--   6. form_templates
--   7. documents
--   8. user_settings
--   9. user_profiles
--  10. field_mappings
--
-- Security Model:
--   - Users can only access their own data (user_id = auth.uid())
--   - For client-owned data, verify ownership through client.user_id
--   - Admins can bypass all policies
-- ============================================================================

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function: Check if current user is an admin
-- Returns: boolean indicating if user has ADMIN role
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT role = 'ADMIN'
    FROM users
    WHERE id = auth.uid()::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on function for documentation
COMMENT ON FUNCTION is_admin() IS 'Helper function to check if the current authenticated user has ADMIN role';

-- ============================================================================
-- Enable RLS on All User-Owned Tables
-- ============================================================================

-- 1. clients - Users own clients directly
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- 2. client_documents - Documents belong to clients
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

-- 3. client_profiles - Profiles belong to clients
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

-- 4. extracted_data - Extracted data belongs to clients
ALTER TABLE extracted_data ENABLE ROW LEVEL SECURITY;

-- 5. filled_forms - Filled forms belong to clients
ALTER TABLE filled_forms ENABLE ROW LEVEL SECURITY;

-- 6. form_templates - Templates are owned by users
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;

-- 7. documents - Documents are owned by users (legacy form-filling)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 8. user_settings - Settings are owned by users
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 9. user_profiles - Profiles are owned by users
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 10. field_mappings - Mappings are owned by users
ALTER TABLE field_mappings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for CLIENTS Table
-- ============================================================================

-- SELECT: Users can view their own clients, admins can view all
CREATE POLICY "clients_select_policy" ON clients
  FOR SELECT
  USING (
    user_id = auth.uid()::text
    OR is_admin()
  );

-- INSERT: Users can create clients for themselves
CREATE POLICY "clients_insert_policy" ON clients
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::text
  );

-- UPDATE: Users can update their own clients, admins can update all
CREATE POLICY "clients_update_policy" ON clients
  FOR UPDATE
  USING (
    user_id = auth.uid()::text
    OR is_admin()
  )
  WITH CHECK (
    user_id = auth.uid()::text
    OR is_admin()
  );

-- DELETE: Users can delete their own clients, admins can delete all
CREATE POLICY "clients_delete_policy" ON clients
  FOR DELETE
  USING (
    user_id = auth.uid()::text
    OR is_admin()
  );

-- ============================================================================
-- RLS Policies for CLIENT_DOCUMENTS Table
-- ============================================================================

-- SELECT: Users can view documents for their clients
CREATE POLICY "client_documents_select_policy" ON client_documents
  FOR SELECT
  USING (
    user_id = auth.uid()::text
    OR client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
    OR is_admin()
  );

-- INSERT: Users can create documents for their clients
CREATE POLICY "client_documents_insert_policy" ON client_documents
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::text
    AND client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
  );

-- UPDATE: Users can update documents for their clients
CREATE POLICY "client_documents_update_policy" ON client_documents
  FOR UPDATE
  USING (
    user_id = auth.uid()::text
    OR client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
    OR is_admin()
  )
  WITH CHECK (
    user_id = auth.uid()::text
    AND client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
  );

-- DELETE: Users can delete documents for their clients
CREATE POLICY "client_documents_delete_policy" ON client_documents
  FOR DELETE
  USING (
    user_id = auth.uid()::text
    OR client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
    OR is_admin()
  );

-- ============================================================================
-- RLS Policies for CLIENT_PROFILES Table
-- ============================================================================

-- SELECT: Users can view profiles for their clients
CREATE POLICY "client_profiles_select_policy" ON client_profiles
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
    OR is_admin()
  );

-- INSERT: Users can create profiles for their clients
CREATE POLICY "client_profiles_insert_policy" ON client_profiles
  FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
  );

-- UPDATE: Users can update profiles for their clients
CREATE POLICY "client_profiles_update_policy" ON client_profiles
  FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
    OR is_admin()
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
  );

-- DELETE: Users can delete profiles for their clients
CREATE POLICY "client_profiles_delete_policy" ON client_profiles
  FOR DELETE
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
    OR is_admin()
  );

-- ============================================================================
-- RLS Policies for EXTRACTED_DATA Table
-- ============================================================================

-- SELECT: Users can view extracted data for their clients
CREATE POLICY "extracted_data_select_policy" ON extracted_data
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
    OR is_admin()
  );

-- INSERT: Users can create extracted data for their clients
CREATE POLICY "extracted_data_insert_policy" ON extracted_data
  FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
  );

-- UPDATE: Users can update extracted data for their clients
CREATE POLICY "extracted_data_update_policy" ON extracted_data
  FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
    OR is_admin()
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
  );

-- DELETE: Users can delete extracted data for their clients
CREATE POLICY "extracted_data_delete_policy" ON extracted_data
  FOR DELETE
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
    OR is_admin()
  );

-- ============================================================================
-- RLS Policies for FILLED_FORMS Table
-- ============================================================================

-- SELECT: Users can view filled forms for their clients
CREATE POLICY "filled_forms_select_policy" ON filled_forms
  FOR SELECT
  USING (
    user_id = auth.uid()::text
    OR client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
    OR is_admin()
  );

-- INSERT: Users can create filled forms for their clients
CREATE POLICY "filled_forms_insert_policy" ON filled_forms
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::text
    AND client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
  );

-- UPDATE: Users can update filled forms for their clients
CREATE POLICY "filled_forms_update_policy" ON filled_forms
  FOR UPDATE
  USING (
    user_id = auth.uid()::text
    OR client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
    OR is_admin()
  )
  WITH CHECK (
    user_id = auth.uid()::text
    AND client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
  );

-- DELETE: Users can delete filled forms for their clients
CREATE POLICY "filled_forms_delete_policy" ON filled_forms
  FOR DELETE
  USING (
    user_id = auth.uid()::text
    OR client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()::text
    )
    OR is_admin()
  );

-- ============================================================================
-- RLS Policies for FORM_TEMPLATES Table
-- ============================================================================

-- SELECT: Users can view their own templates
CREATE POLICY "form_templates_select_policy" ON form_templates
  FOR SELECT
  USING (
    user_id = auth.uid()::text
    OR is_admin()
  );

-- INSERT: Users can create their own templates
CREATE POLICY "form_templates_insert_policy" ON form_templates
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::text
  );

-- UPDATE: Users can update their own templates
CREATE POLICY "form_templates_update_policy" ON form_templates
  FOR UPDATE
  USING (
    user_id = auth.uid()::text
    OR is_admin()
  )
  WITH CHECK (
    user_id = auth.uid()::text
    OR is_admin()
  );

-- DELETE: Users can delete their own templates
CREATE POLICY "form_templates_delete_policy" ON form_templates
  FOR DELETE
  USING (
    user_id = auth.uid()::text
    OR is_admin()
  );

-- ============================================================================
-- RLS Policies for DOCUMENTS Table (Legacy Form-Filling)
-- ============================================================================

-- SELECT: Users can view their own documents
CREATE POLICY "documents_select_policy" ON documents
  FOR SELECT
  USING (
    "userId" = auth.uid()::text
    OR is_admin()
  );

-- INSERT: Users can create their own documents
CREATE POLICY "documents_insert_policy" ON documents
  FOR INSERT
  WITH CHECK (
    "userId" = auth.uid()::text
  );

-- UPDATE: Users can update their own documents
CREATE POLICY "documents_update_policy" ON documents
  FOR UPDATE
  USING (
    "userId" = auth.uid()::text
    OR is_admin()
  )
  WITH CHECK (
    "userId" = auth.uid()::text
    OR is_admin()
  );

-- DELETE: Users can delete their own documents
CREATE POLICY "documents_delete_policy" ON documents
  FOR DELETE
  USING (
    "userId" = auth.uid()::text
    OR is_admin()
  );

-- ============================================================================
-- RLS Policies for USER_SETTINGS Table
-- ============================================================================

-- SELECT: Users can view their own settings
CREATE POLICY "user_settings_select_policy" ON user_settings
  FOR SELECT
  USING (
    user_id = auth.uid()::text
    OR is_admin()
  );

-- INSERT: Users can create their own settings
CREATE POLICY "user_settings_insert_policy" ON user_settings
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::text
  );

-- UPDATE: Users can update their own settings
CREATE POLICY "user_settings_update_policy" ON user_settings
  FOR UPDATE
  USING (
    user_id = auth.uid()::text
    OR is_admin()
  )
  WITH CHECK (
    user_id = auth.uid()::text
    OR is_admin()
  );

-- DELETE: Users can delete their own settings
CREATE POLICY "user_settings_delete_policy" ON user_settings
  FOR DELETE
  USING (
    user_id = auth.uid()::text
    OR is_admin()
  );

-- ============================================================================
-- RLS Policies for USER_PROFILES Table
-- ============================================================================

-- SELECT: Users can view their own profile
CREATE POLICY "user_profiles_select_policy" ON user_profiles
  FOR SELECT
  USING (
    user_id = auth.uid()::text
    OR is_admin()
  );

-- INSERT: Users can create their own profile
CREATE POLICY "user_profiles_insert_policy" ON user_profiles
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::text
  );

-- UPDATE: Users can update their own profile
CREATE POLICY "user_profiles_update_policy" ON user_profiles
  FOR UPDATE
  USING (
    user_id = auth.uid()::text
    OR is_admin()
  )
  WITH CHECK (
    user_id = auth.uid()::text
    OR is_admin()
  );

-- DELETE: Users can delete their own profile
CREATE POLICY "user_profiles_delete_policy" ON user_profiles
  FOR DELETE
  USING (
    user_id = auth.uid()::text
    OR is_admin()
  );

-- ============================================================================
-- RLS Policies for FIELD_MAPPINGS Table
-- ============================================================================

-- SELECT: Users can view their own field mappings
CREATE POLICY "field_mappings_select_policy" ON field_mappings
  FOR SELECT
  USING (
    "userId" = auth.uid()::text
    OR is_admin()
  );

-- INSERT: Users can create their own field mappings
CREATE POLICY "field_mappings_insert_policy" ON field_mappings
  FOR INSERT
  WITH CHECK (
    "userId" = auth.uid()::text
  );

-- UPDATE: Users can update their own field mappings
CREATE POLICY "field_mappings_update_policy" ON field_mappings
  FOR UPDATE
  USING (
    "userId" = auth.uid()::text
    OR is_admin()
  )
  WITH CHECK (
    "userId" = auth.uid()::text
    OR is_admin()
  );

-- DELETE: Users can delete their own field mappings
CREATE POLICY "field_mappings_delete_policy" ON field_mappings
  FOR DELETE
  USING (
    "userId" = auth.uid()::text
    OR is_admin()
  );

-- ============================================================================
-- Security Comments and Documentation
-- ============================================================================

-- Add comments to explain the security model
COMMENT ON TABLE clients IS 'RLS enabled: Users can only access their own clients';
COMMENT ON TABLE client_documents IS 'RLS enabled: Users can only access documents for their clients';
COMMENT ON TABLE client_profiles IS 'RLS enabled: Users can only access profiles for their clients';
COMMENT ON TABLE extracted_data IS 'RLS enabled: Users can only access extracted data for their clients';
COMMENT ON TABLE filled_forms IS 'RLS enabled: Users can only access filled forms for their clients';
COMMENT ON TABLE form_templates IS 'RLS enabled: Users can only access their own templates';
COMMENT ON TABLE documents IS 'RLS enabled: Users can only access their own documents';
COMMENT ON TABLE user_settings IS 'RLS enabled: Users can only access their own settings';
COMMENT ON TABLE user_profiles IS 'RLS enabled: Users can only access their own profile';
COMMENT ON TABLE field_mappings IS 'RLS enabled: Users can only access their own field mappings';

-- ============================================================================
-- Migration Complete
-- ============================================================================
--
-- This migration has implemented Row Level Security policies for all user-owned
-- tables in the IntelliFill application.
--
-- Security features implemented:
--   ✓ User-level data isolation (users can only see their own data)
--   ✓ Client ownership verification for client-related tables
--   ✓ Admin bypass for all policies
--   ✓ Comprehensive CRUD policies (SELECT, INSERT, UPDATE, DELETE)
--   ✓ Helper function for admin role checks
--
-- Testing recommendations:
--   1. Test as regular user - should only see own data
--   2. Test as admin - should see all data
--   3. Test client ownership - should not access other users' clients
--   4. Test INSERT with wrong user_id - should fail
--   5. Test UPDATE of other users' data - should fail
--
-- ============================================================================
