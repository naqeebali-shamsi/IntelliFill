-- ============================================================================
-- E2E Test Data Verification Script
-- ============================================================================
-- Purpose: Verify that E2E test data exists correctly in the database
-- Usage: psql -d <database_url> -f verify-e2e-data.sql
--
-- This script performs read-only SELECT queries to verify:
-- 1. All 5 test users exist with valid bcrypt password hashes
-- 2. The e2e-test-org organization exists with ACTIVE status
-- 3. All 5 organization memberships exist with correct roles
--
-- Expected test users:
--   - test-admin@intellifill.local      (ADMIN role)
--   - test-owner@intellifill.local      (OWNER role)
--   - test-member@intellifill.local     (MEMBER role)
--   - test-viewer@intellifill.local     (VIEWER role)
--   - test-password-reset@intellifill.local (MEMBER role)
--
-- Expected organization:
--   - Name: E2E Test Organization
--   - Slug: e2e-test-org
--   - Status: ACTIVE
-- ============================================================================

-- Enable expanded output for better readability
\x auto

-- ============================================================================
-- CHECK 1: Verify all test users exist
-- ============================================================================
\echo ''
\echo '============================================================================'
\echo 'CHECK 1: Verifying test users exist'
\echo '============================================================================'

SELECT
    CASE
        WHEN COUNT(*) = 5 THEN 'PASS: All 5 test users exist'
        ELSE 'FAIL: Expected 5 test users, found ' || COUNT(*)::text
    END AS user_existence_check,
    COUNT(*) AS users_found
FROM users
WHERE email IN (
    'test-admin@intellifill.local',
    'test-owner@intellifill.local',
    'test-member@intellifill.local',
    'test-viewer@intellifill.local',
    'test-password-reset@intellifill.local'
);

-- Show details of which users exist or are missing
\echo ''
\echo 'User existence details:'
SELECT
    email,
    CASE WHEN id IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status,
    id,
    role,
    "emailVerified" AS email_verified,
    "isActive" AS is_active
FROM (
    SELECT 'test-admin@intellifill.local' AS expected_email
    UNION ALL SELECT 'test-owner@intellifill.local'
    UNION ALL SELECT 'test-member@intellifill.local'
    UNION ALL SELECT 'test-viewer@intellifill.local'
    UNION ALL SELECT 'test-password-reset@intellifill.local'
) expected
LEFT JOIN users ON users.email = expected.expected_email
ORDER BY expected.expected_email;

-- ============================================================================
-- CHECK 2: Verify password hashes are valid bcrypt format
-- ============================================================================
\echo ''
\echo '============================================================================'
\echo 'CHECK 2: Verifying password hashes are valid bcrypt format'
\echo '============================================================================'
\echo 'Bcrypt hashes should start with $2a$, $2b$, or $2y$ followed by cost factor'

SELECT
    CASE
        WHEN COUNT(*) = 5 THEN 'PASS: All 5 users have valid bcrypt password hashes'
        ELSE 'FAIL: Only ' || COUNT(*)::text || ' users have valid bcrypt hashes'
    END AS password_hash_check,
    COUNT(*) AS valid_hashes_count
FROM users
WHERE email IN (
    'test-admin@intellifill.local',
    'test-owner@intellifill.local',
    'test-member@intellifill.local',
    'test-viewer@intellifill.local',
    'test-password-reset@intellifill.local'
)
AND password IS NOT NULL
AND password != ''
AND password ~ '^\$2[aby]?\$[0-9]{2}\$';

-- Show password hash details (first 20 chars only for security)
\echo ''
\echo 'Password hash details (truncated for security):'
SELECT
    email,
    CASE
        WHEN password IS NULL OR password = '' THEN 'FAIL: Empty or null'
        WHEN password ~ '^\$2[aby]?\$[0-9]{2}\$' THEN 'PASS: Valid bcrypt'
        ELSE 'FAIL: Invalid format'
    END AS hash_status,
    CASE
        WHEN password IS NOT NULL THEN LEFT(password, 20) || '...'
        ELSE 'NULL'
    END AS hash_preview
FROM users
WHERE email IN (
    'test-admin@intellifill.local',
    'test-owner@intellifill.local',
    'test-member@intellifill.local',
    'test-viewer@intellifill.local',
    'test-password-reset@intellifill.local'
)
ORDER BY email;

-- ============================================================================
-- CHECK 3: Verify test organization exists with ACTIVE status
-- ============================================================================
\echo ''
\echo '============================================================================'
\echo 'CHECK 3: Verifying test organization exists'
\echo '============================================================================'

SELECT
    CASE
        WHEN COUNT(*) = 1 AND MAX(status) = 'ACTIVE' THEN 'PASS: Organization e2e-test-org exists with ACTIVE status'
        WHEN COUNT(*) = 1 THEN 'FAIL: Organization exists but status is ' || MAX(status)::text
        WHEN COUNT(*) = 0 THEN 'FAIL: Organization e2e-test-org not found'
        ELSE 'FAIL: Multiple organizations with slug e2e-test-org found'
    END AS organization_check
FROM organizations
WHERE slug = 'e2e-test-org';

-- Show organization details
\echo ''
\echo 'Organization details:'
SELECT
    id,
    name,
    slug,
    status,
    "createdAt" AS created_at,
    "updatedAt" AS updated_at
FROM organizations
WHERE slug = 'e2e-test-org';

-- ============================================================================
-- CHECK 4: Verify organization memberships exist for all test users
-- ============================================================================
\echo ''
\echo '============================================================================'
\echo 'CHECK 4: Verifying organization memberships exist'
\echo '============================================================================'

SELECT
    CASE
        WHEN COUNT(*) = 5 THEN 'PASS: All 5 test users have organization memberships'
        ELSE 'FAIL: Only ' || COUNT(*)::text || ' memberships found (expected 5)'
    END AS membership_existence_check,
    COUNT(*) AS memberships_found
FROM organization_memberships om
JOIN users u ON om.user_id = u.id
JOIN organizations o ON om.organization_id = o.id
WHERE u.email IN (
    'test-admin@intellifill.local',
    'test-owner@intellifill.local',
    'test-member@intellifill.local',
    'test-viewer@intellifill.local',
    'test-password-reset@intellifill.local'
)
AND o.slug = 'e2e-test-org';

-- Show membership details
\echo ''
\echo 'Membership details:'
SELECT
    u.email,
    om.role AS membership_role,
    om.status AS membership_status,
    o.slug AS organization_slug,
    om.joined_at
FROM users u
LEFT JOIN organization_memberships om ON u.id = om.user_id
LEFT JOIN organizations o ON om.organization_id = o.id AND o.slug = 'e2e-test-org'
WHERE u.email IN (
    'test-admin@intellifill.local',
    'test-owner@intellifill.local',
    'test-member@intellifill.local',
    'test-viewer@intellifill.local',
    'test-password-reset@intellifill.local'
)
ORDER BY u.email;

-- ============================================================================
-- CHECK 5: Verify each user has the correct membership role
-- ============================================================================
\echo ''
\echo '============================================================================'
\echo 'CHECK 5: Verifying membership roles are correct'
\echo '============================================================================'
\echo 'Expected roles:'
\echo '  - test-admin@intellifill.local: ADMIN'
\echo '  - test-owner@intellifill.local: OWNER'
\echo '  - test-member@intellifill.local: MEMBER'
\echo '  - test-viewer@intellifill.local: VIEWER'
\echo '  - test-password-reset@intellifill.local: MEMBER'
\echo ''

WITH expected_roles AS (
    SELECT 'test-admin@intellifill.local' AS email, 'ADMIN'::text AS expected_role
    UNION ALL SELECT 'test-owner@intellifill.local', 'OWNER'
    UNION ALL SELECT 'test-member@intellifill.local', 'MEMBER'
    UNION ALL SELECT 'test-viewer@intellifill.local', 'VIEWER'
    UNION ALL SELECT 'test-password-reset@intellifill.local', 'MEMBER'
),
actual_roles AS (
    SELECT
        u.email,
        om.role::text AS actual_role
    FROM users u
    JOIN organization_memberships om ON u.id = om.user_id
    JOIN organizations o ON om.organization_id = o.id
    WHERE o.slug = 'e2e-test-org'
    AND u.email IN (
        'test-admin@intellifill.local',
        'test-owner@intellifill.local',
        'test-member@intellifill.local',
        'test-viewer@intellifill.local',
        'test-password-reset@intellifill.local'
    )
)
SELECT
    CASE
        WHEN COUNT(*) FILTER (WHERE er.expected_role != COALESCE(ar.actual_role, '')) = 0
             AND COUNT(*) FILTER (WHERE ar.actual_role IS NULL) = 0
        THEN 'PASS: All membership roles are correct'
        ELSE 'FAIL: ' || COUNT(*) FILTER (WHERE er.expected_role != COALESCE(ar.actual_role, '') OR ar.actual_role IS NULL)::text || ' role(s) incorrect or missing'
    END AS role_verification_check
FROM expected_roles er
LEFT JOIN actual_roles ar ON er.email = ar.email;

-- Show role comparison details
\echo ''
\echo 'Role comparison details:'
WITH expected_roles AS (
    SELECT 'test-admin@intellifill.local' AS email, 'ADMIN'::text AS expected_role
    UNION ALL SELECT 'test-owner@intellifill.local', 'OWNER'
    UNION ALL SELECT 'test-member@intellifill.local', 'MEMBER'
    UNION ALL SELECT 'test-viewer@intellifill.local', 'VIEWER'
    UNION ALL SELECT 'test-password-reset@intellifill.local', 'MEMBER'
)
SELECT
    er.email,
    er.expected_role,
    COALESCE(om.role::text, 'MISSING') AS actual_role,
    CASE
        WHEN om.role::text = er.expected_role THEN 'PASS'
        WHEN om.role IS NULL THEN 'FAIL: No membership'
        ELSE 'FAIL: Wrong role'
    END AS status
FROM expected_roles er
LEFT JOIN users u ON u.email = er.email
LEFT JOIN organization_memberships om ON u.id = om.user_id
LEFT JOIN organizations o ON om.organization_id = o.id AND o.slug = 'e2e-test-org'
ORDER BY er.email;

-- ============================================================================
-- SUMMARY: Overall verification result
-- ============================================================================
\echo ''
\echo '============================================================================'
\echo 'VERIFICATION SUMMARY'
\echo '============================================================================'

WITH checks AS (
    -- Check 1: User existence
    SELECT
        'Users exist' AS check_name,
        CASE WHEN COUNT(*) = 5 THEN 'PASS' ELSE 'FAIL' END AS result
    FROM users
    WHERE email IN (
        'test-admin@intellifill.local',
        'test-owner@intellifill.local',
        'test-member@intellifill.local',
        'test-viewer@intellifill.local',
        'test-password-reset@intellifill.local'
    )

    UNION ALL

    -- Check 2: Password hashes valid
    SELECT
        'Password hashes valid' AS check_name,
        CASE WHEN COUNT(*) = 5 THEN 'PASS' ELSE 'FAIL' END AS result
    FROM users
    WHERE email IN (
        'test-admin@intellifill.local',
        'test-owner@intellifill.local',
        'test-member@intellifill.local',
        'test-viewer@intellifill.local',
        'test-password-reset@intellifill.local'
    )
    AND password ~ '^\$2[aby]?\$[0-9]{2}\$'

    UNION ALL

    -- Check 3: Organization exists
    SELECT
        'Organization exists (ACTIVE)' AS check_name,
        CASE WHEN COUNT(*) = 1 AND MAX(status) = 'ACTIVE' THEN 'PASS' ELSE 'FAIL' END AS result
    FROM organizations
    WHERE slug = 'e2e-test-org'

    UNION ALL

    -- Check 4: Memberships exist
    SELECT
        'Memberships exist' AS check_name,
        CASE WHEN COUNT(*) = 5 THEN 'PASS' ELSE 'FAIL' END AS result
    FROM organization_memberships om
    JOIN users u ON om.user_id = u.id
    JOIN organizations o ON om.organization_id = o.id
    WHERE u.email IN (
        'test-admin@intellifill.local',
        'test-owner@intellifill.local',
        'test-member@intellifill.local',
        'test-viewer@intellifill.local',
        'test-password-reset@intellifill.local'
    )
    AND o.slug = 'e2e-test-org'

    UNION ALL

    -- Check 5: Roles correct
    SELECT
        'Membership roles correct' AS check_name,
        CASE
            WHEN COUNT(*) FILTER (
                WHERE (u.email = 'test-admin@intellifill.local' AND om.role = 'ADMIN')
                   OR (u.email = 'test-owner@intellifill.local' AND om.role = 'OWNER')
                   OR (u.email = 'test-member@intellifill.local' AND om.role = 'MEMBER')
                   OR (u.email = 'test-viewer@intellifill.local' AND om.role = 'VIEWER')
                   OR (u.email = 'test-password-reset@intellifill.local' AND om.role = 'MEMBER')
            ) = 5 THEN 'PASS'
            ELSE 'FAIL'
        END AS result
    FROM organization_memberships om
    JOIN users u ON om.user_id = u.id
    JOIN organizations o ON om.organization_id = o.id
    WHERE u.email IN (
        'test-admin@intellifill.local',
        'test-owner@intellifill.local',
        'test-member@intellifill.local',
        'test-viewer@intellifill.local',
        'test-password-reset@intellifill.local'
    )
    AND o.slug = 'e2e-test-org'
)
SELECT
    check_name,
    result,
    CASE result WHEN 'PASS' THEN '[OK]' ELSE '[!!]' END AS indicator
FROM checks
ORDER BY check_name;

-- Final pass/fail determination
\echo ''
WITH all_checks AS (
    SELECT COUNT(*) FILTER (WHERE result = 'FAIL') AS fail_count
    FROM (
        SELECT CASE WHEN COUNT(*) = 5 THEN 'PASS' ELSE 'FAIL' END AS result
        FROM users WHERE email IN ('test-admin@intellifill.local','test-owner@intellifill.local','test-member@intellifill.local','test-viewer@intellifill.local','test-password-reset@intellifill.local')
        UNION ALL
        SELECT CASE WHEN COUNT(*) = 5 THEN 'PASS' ELSE 'FAIL' END FROM users WHERE email IN ('test-admin@intellifill.local','test-owner@intellifill.local','test-member@intellifill.local','test-viewer@intellifill.local','test-password-reset@intellifill.local') AND password ~ '^\$2[aby]?\$[0-9]{2}\$'
        UNION ALL
        SELECT CASE WHEN COUNT(*) = 1 AND MAX(status) = 'ACTIVE' THEN 'PASS' ELSE 'FAIL' END FROM organizations WHERE slug = 'e2e-test-org'
        UNION ALL
        SELECT CASE WHEN COUNT(*) = 5 THEN 'PASS' ELSE 'FAIL' END FROM organization_memberships om JOIN users u ON om.user_id = u.id JOIN organizations o ON om.organization_id = o.id WHERE u.email IN ('test-admin@intellifill.local','test-owner@intellifill.local','test-member@intellifill.local','test-viewer@intellifill.local','test-password-reset@intellifill.local') AND o.slug = 'e2e-test-org'
        UNION ALL
        SELECT CASE WHEN COUNT(*) FILTER (WHERE (u.email = 'test-admin@intellifill.local' AND om.role = 'ADMIN') OR (u.email = 'test-owner@intellifill.local' AND om.role = 'OWNER') OR (u.email = 'test-member@intellifill.local' AND om.role = 'MEMBER') OR (u.email = 'test-viewer@intellifill.local' AND om.role = 'VIEWER') OR (u.email = 'test-password-reset@intellifill.local' AND om.role = 'MEMBER')) = 5 THEN 'PASS' ELSE 'FAIL' END FROM organization_memberships om JOIN users u ON om.user_id = u.id JOIN organizations o ON om.organization_id = o.id WHERE u.email IN ('test-admin@intellifill.local','test-owner@intellifill.local','test-member@intellifill.local','test-viewer@intellifill.local','test-password-reset@intellifill.local') AND o.slug = 'e2e-test-org'
    ) checks
)
SELECT
    CASE
        WHEN fail_count = 0 THEN '*** ALL CHECKS PASSED - E2E test data is correctly configured ***'
        ELSE '*** ' || fail_count::text || ' CHECK(S) FAILED - Review output above for details ***'
    END AS final_result
FROM all_checks;

\echo ''
\echo '============================================================================'
\echo 'Verification complete.'
\echo '============================================================================'
