# Multi-Tenant RBAC Hardening Analysis

**Date:** 2026-02-08
**Scope:** Authentication, Authorization, Multi-Tenancy, Data Isolation, Session Management
**Status:** Brutally Honest Assessment

---

## PHASE 1: How It Actually Works Today

### 1.1 Authentication Flow

IntelliFill uses a **dual-auth architecture**: Supabase Auth for identity management + Prisma/PostgreSQL for application profiles.

**Production mode:**

1. Client sends JWT in `Authorization: Bearer <token>` header
2. `authenticateSupabase` middleware extracts and validates the token via `verifySupabaseToken()` (calls Supabase `getUser()` -- server-side validation, not client-side `getSession()`)
3. Middleware looks up the user in Prisma by `supabaseUserId`
4. Checks `isActive` flag (deactivated accounts get 403)
5. Sets PostgreSQL RLS context via `set_user_context(userId)` using `$executeRawUnsafe`
6. If RLS context fails and `RLS_FAIL_CLOSED !== 'false'`, the request is rejected (500)
7. Attaches `req.user` with `{ id, email, role, supabaseUserId, firstName, lastName }`

**Test/E2E mode (`E2E_TEST_MODE=true`):**

- Bypasses Supabase entirely
- Uses bcrypt password comparison against Prisma `user.password`
- Generates custom JWTs via `JwtTokenService` (signed with `JWT_SECRET`)
- MFA is explicitly bypassed in test mode

**Token types:**

- **Access token:** 1h expiry (4h for demo accounts), contains `sub`, `email`, `role`, `aud`, `iss`
- **Refresh token:** 7d expiry, stored as httpOnly cookie, supports token family rotation with theft detection
- **Supabase tokens:** Standard Supabase JWT in production mode

### 1.2 Organization & Membership Management

**Organization creation:**

- Any authenticated user can create an organization via `POST /api/organizations`
- Creator automatically becomes `OWNER` with `ACTIVE` membership
- User's `organizationId` field is updated on the User model
- A user can only belong to one organization (checked at creation time)

**Membership model:**

- `OrganizationMembership` table with `userId + organizationId` unique constraint
- Status: `PENDING`, `ACTIVE`, `SUSPENDED`, `LEFT`
- Soft-delete pattern: removed members get status `LEFT`, not deleted

**Organization context middleware:**

- `requireOrganization`: Looks up user's org from `User.organizationId`, attaches to `req.organizationId` and `req.organizationContext`
- `optionalOrganization`: Same but doesn't fail if no org
- `validateOrganizationAccess`: Checks user belongs to specific org ID from params/query/body
- Has 5-minute in-memory cache (up to 10K entries) for org lookups

### 1.3 RBAC Implementation

**Two distinct role systems exist (this is a problem):**

1. **UserRole enum** (Prisma): `ADMIN`, `USER`, `VIEWER` -- applied to `User.role` field
2. **OrgMemberRole enum** (Prisma): `OWNER`, `ADMIN`, `MEMBER`, `VIEWER` -- applied to `OrganizationMembership.role`

**How roles are checked:**

- `authorizeSupabase(allowedRoles)`: Checks `req.user.role` (the **UserRole**, not OrgMemberRole). Case-insensitive comparison.
- `requireOrgAdmin`: Checks `OrganizationMembership.role` is `OWNER` or `ADMIN` for the specific org
- `requireOrgOwner`: Checks `OrganizationMembership.role` is `OWNER` for the specific org
- `requireOrgMember`: Checks user has any active membership in the org

**Key discrepancy:** The `supabaseAuth` middleware attaches `req.user.role` from the **User model** (UserRole), but organization routes check `OrganizationMembership.role` (OrgMemberRole). These are different enums with different values. A user could be `USER` at the app level but `OWNER` at the org level.

### 1.4 Permission Enforcement Layers

**Layer 1 - Application-level (route handlers):**

- All document/client queries include `where: { userId }` in Prisma queries
- `verifyClientOwnership` middleware checks `client.userId === req.user.id`
- Organization routes check membership via `findActiveMembership()`

**Layer 2 - Database-level (PostgreSQL RLS):**

- 11 tables have RLS enabled: clients, client_documents, client_profiles, extracted_data, filled_forms, form_templates, documents, templates, user_settings, user_profiles, field_mappings
- Uses `set_user_context(userId)` with transaction-scoped session variable `app.current_user_id`
- Policies: owner can access own data, `ADMIN` role bypasses all via `is_admin()` function
- **RLS is user-level, NOT organization-level** -- there are no org-based RLS policies

**Layer 3 - Organization-level (knowledge base):**

- `document_sources`, `document_chunks` tables are organization-scoped
- Queries filter by `organizationId` from `req.organizationId`
- But these tables do NOT have RLS enabled

### 1.5 Invitation System

- Admins/Owners can invite via `POST /api/organizations/:id/members/invite`
- Generates a UUID invitation ID (not a cryptographic token)
- 7-day expiration
- Email sent with invitation link
- Acceptance requires: authentication, email match, pending status, not expired
- Uses `upsert` to handle re-invitations for same email
- Atomic acceptance via `$transaction`: updates invitation, creates membership, updates user.organizationId

### 1.6 Tenant Data Isolation

**User-level isolation (strong):**

- Application-level: All queries filter by `userId`
- Database-level: RLS policies on 11 tables enforce `user_id = get_current_user_id()`

**Organization-level isolation (partial):**

- Knowledge base (document_sources, document_chunks): Application-level `organizationId` filtering only, no RLS
- Audit logs: Include `organizationId` for filtering but no RLS enforcement
- Most other tables (clients, documents, etc.) are user-scoped, not org-scoped

**Tables with NO isolation at all:**

- `jobs`: Has `userId` column but no RLS
- `processing_history`: No user isolation
- `multi_agent_processing`: Has `userId` but no RLS
- `document_shares`: Public access via token, no org boundaries
- `notifications`: Only `userId` filtering, no RLS

### 1.7 Document Sharing

- `DocumentShare` model with `accessToken` for public link sharing
- Share permissions: `VIEW`, `COMMENT`, `EDIT`
- `EDIT` permission allows file download
- **Completely public endpoints** (`/api/shared/:token`) -- no authentication required
- No rate limiting on share access
- No maximum access count limit
- Shares can optionally expire (`expiresAt`)
- Access count and last access time tracked

### 1.8 Security Events & Audit Trail

- **AuditLoggerService** logs all API operations with PII sanitization
- Anomaly detection: HIGH_FREQUENCY_SEARCH, HIGH_FREQUENCY_UPLOAD, BULK_DELETE, CROSS_TENANT_ATTEMPT
- Redis-backed counters (memory fallback)
- Compliance fields: PII/PHI detection, data classification, retention periods
- **Critical alerts** (CROSS_TENANT_ATTEMPT) only logged, not acted upon (`// TODO: Send to security team, block user, etc.`)

### 1.9 Token Refresh & Session Management

- Refresh tokens stored in httpOnly cookies
- Token family rotation with theft detection via `RefreshTokenFamilyService`
- If a refresh token is reused (potential theft), the entire family is revoked
- Supabase handles production refresh; custom JWT handles test mode
- Token cache invalidation on logout (non-blocking, 500ms timeout)
- All sessions invalidated on password change/reset (via `supabaseAdmin.auth.admin.signOut(userId, 'global')`)

---

## PHASE 2: How Serious Systems Do This Better

### 2.1 Unified Role Model (Auth0/Clerk/WorkOS)

Production multi-tenant systems use a **single, hierarchical role model** -- not two separate enums. The standard pattern:

- **Organization-scoped roles** are the primary permission model (OWNER > ADMIN > MEMBER > VIEWER)
- **System-level roles** (like "platform admin") exist separately and are checked via a dedicated "super admin" flag, not a generic `role` field
- Permissions are derived from roles, not hard-coded in middleware

**What IntelliFill has wrong:** Two competing role systems (`UserRole` vs `OrgMemberRole`) that can conflict. A `USER` with `ADMIN` UserRole could be a `VIEWER` at the org level, creating confusion about what they can actually do.

### 2.2 Tenant Data Isolation (WorkOS/Clerk)

Production systems enforce tenant isolation at **every layer**:

1. **Connection-level:** Schema-per-tenant or connection string per tenant
2. **Row-level:** PostgreSQL RLS with `org_id` columns on every tenant-scoped table
3. **Application-level:** Middleware that rejects any request without valid tenant context
4. **API-level:** All resource URLs include tenant identifier

**What IntelliFill has wrong:** RLS is user-level only. Knowledge base tables, jobs, notifications, and audit logs have no RLS. Organization isolation depends entirely on application code remembering to filter by `organizationId`.

### 2.3 Permission Inheritance

Production systems implement hierarchical permissions:

- OWNER inherits all ADMIN permissions
- ADMIN inherits all MEMBER permissions
- Permissions are **additive and enumerable**, not just role name comparisons

IntelliFill checks roles with `role: { in: ['OWNER', 'ADMIN'] }` which works but isn't extensible.

### 2.4 Invitation Security

Production systems:

- Use **cryptographically random tokens** (not UUIDs) for invitation links
- Rate-limit invitation creation per org
- Limit maximum pending invitations per org
- Allow invitation acceptance without requiring the email to exactly match (with confirmation step)
- Track invitation audit trail separately

**What IntelliFill has:** UUIDs as invitation tokens (predictable format, though random content), no rate limiting on invitation creation, no cap on pending invitations.

### 2.5 API Key & Service Account Management

Production systems (Auth0, WorkOS) provide:

- Machine-to-machine tokens with scoped permissions
- API key management UI
- Key rotation without downtime
- Service accounts that aren't tied to human users

**IntelliFill has none of this.** All access requires a user-bound JWT. No programmatic access story.

### 2.6 Audit Compliance

Production systems provide:

- **Immutable audit logs** (append-only, separate storage)
- Export capabilities for compliance (SOC2, GDPR)
- Audit log retention policies enforced at infrastructure level
- Data subject access requests (DSAR) tooling
- Right-to-erasure workflows

**IntelliFill:** Audit logs are in the same database, mutable (can be deleted via Prisma), no export tooling, retention is a metadata field but not enforced.

---

## PHASE 3: How This Feature Can Fail in Production

### 3.1 Cross-Tenant Data Leakage via Knowledge Base

**Severity: HIGH**

The knowledge base (`document_sources`, `document_chunks`) filters by `organizationId` in application code only. There is **no RLS** on these tables. If:

- A developer writes a new query and forgets the `organizationId` filter
- A Prisma raw query bypasses the application filter
- The `organizationId` middleware cache serves stale data

...then one org's knowledge base could be exposed to another org.

### 3.2 Role Confusion Between UserRole and OrgMemberRole

**Severity: MEDIUM-HIGH**

The `authorizeSupabase(['ADMIN'])` check uses `User.role` (UserRole), while org membership uses `OrgMemberRole`. Scenarios:

- A user with `UserRole=ADMIN` can pass `authorizeSupabase(['ADMIN'])` checks even if they're a `VIEWER` in their organization
- The `is_admin()` RLS function checks `User.role = 'ADMIN'`, not org membership -- so a Prisma ADMIN can bypass all RLS regardless of org role
- There's no `OWNER` or `MEMBER` in the UserRole enum, creating a mapping gap

### 3.3 Privilege Escalation via Registration

**Severity: MEDIUM**

The registration endpoint accepts a `role` parameter:

```typescript
const { role = 'user' } = req.body;
const validRoles = ['user', 'admin'];
```

A user can register with `role: 'admin'` and get `UserRole=ADMIN`, which:

- Bypasses all RLS policies (via `is_admin()` function)
- Passes `authorizeSupabase(['ADMIN'])` checks

This is a **privilege escalation vulnerability**. Registration should never accept admin role from client input.

### 3.4 RLS Bypass via Connection Pooling

**Severity: MEDIUM**

The RLS context is set via `set_config('app.current_user_id', userId, true)` with `true` for transaction-local scope. However:

- Prisma's connection pooling can reuse connections across requests
- If a query runs outside a transaction, the context could leak to the next request
- The `$executeRawUnsafe` call is in the middleware, but individual queries in route handlers may not be in the same transaction scope

### 3.5 Invitation Token Enumeration

**Severity: LOW-MEDIUM**

Invitation tokens are UUIDs used as primary keys. The `GET /api/invites/:token` endpoint is **public** (no authentication). While UUIDs are practically unguessable, this endpoint reveals:

- The invitation email address
- The organization name and slug
- The role being offered
- Expiration time

This is an information disclosure issue.

### 3.6 Document Sharing Without Org Boundaries

**Severity: MEDIUM**

The `DocumentShare` model and `/api/shared/:token` routes have **no organization awareness**:

- A user can share a document with anyone via access token
- No check that the recipient is in the same organization
- No check that sharing is permitted by org policy
- No rate limiting on share link access
- No maximum access count (potential for data scraping)

A malicious insider could create share links for all documents and exfiltrate them.

### 3.7 Demo Account as Persistent Backdoor

**Severity: MEDIUM**

The demo login endpoint (`/api/auth/v2/demo`):

- Has hardcoded credentials (`demo@intellifill.com` / `demo123`)
- Generates a 4h access token
- Is only disabled when `ENABLE_DEMO_MODE=false` (opt-out, not opt-in)
- The demo token includes `organizationId` in claims

If `ENABLE_DEMO_MODE` is not explicitly set to `false` in production, this is a persistent backdoor.

### 3.8 Token Cache Invalidation Race Condition

**Severity: LOW**

On logout, token cache invalidation is fire-and-forget with a 500ms timeout:

```typescript
Promise.race([
  (async () => { await tokenCache.invalidate(refreshToken); })(),
  new Promise((_, reject) => setTimeout(() => reject(...), 500))
]).catch(...)
```

If the cache invalidation times out, the refresh token remains valid in cache. An attacker who captured the refresh token before logout could still use it.

### 3.9 Stale Organization Cache

**Severity: LOW-MEDIUM**

The organization context middleware uses a 5-minute in-memory cache. If a user is demoted or removed from an organization:

- They could continue accessing org-scoped resources for up to 5 minutes
- The cache is per-process (not shared across instances), so invalidation is unreliable in multi-instance deployments
- `invalidateOrganizationCache(userId)` only works on the same process

### 3.10 Audit Log Gaps

**Severity: LOW**

- Critical security events (role changes, member removal, org deletion) are logged but not differentiated from routine operations
- The anomaly detection TODO for critical alerts (`// TODO: Send to security team, block user, etc.`) means CRITICAL alerts are only logged, never acted upon
- Audit logs are stored in the same database as application data -- they could be tampered with by an ADMIN

---

## PHASE 4: Shippable Improvement Plan

### Upgrade 1: Fix Registration Privilege Escalation

**What to change:** Remove `role` from user-controlled registration input. All new users should be `USER`. Admin role should only be assignable by existing admins.

**Why:** This is the most critical vulnerability. Any user can register as ADMIN and bypass all RLS policies.

**Files:**

- `quikadmin/src/api/supabase-auth.routes.ts` (lines 233-234, 266-271)
- `quikadmin/src/services/AuthService.ts` (line 184)

**Change:**

```typescript
// BEFORE
const { role = 'user' } = req.body;
const validRoles = ['user', 'admin'];

// AFTER
const role = 'user'; // Always USER on self-registration
```

**Effort:** S (Small) -- 30 minutes
**Regression risk:** LOW -- only affects registration, E2E tests may need role assignment via admin API

---

### Upgrade 2: Unify Role Model -- Deprecate UserRole for Authorization

**What to change:** Stop using `User.role` (UserRole) for authorization decisions. Use `OrganizationMembership.role` (OrgMemberRole) as the single source of truth for permissions. Keep `User.role` only for backward compatibility and system-level admin detection.

**Why:** Two competing role systems cause privilege confusion and the RLS `is_admin()` bypass.

**Files:**

- `quikadmin/src/middleware/supabaseAuth.ts` (authorizeSupabase function)
- `quikadmin/prisma/migrations/` (update `is_admin()` to check org membership)
- All routes using `authorizeSupabase(['ADMIN'])`

**Implementation approach:**

1. Add a `isSuperAdmin` boolean to User model for platform-level admin access
2. Update `is_admin()` RLS function to check `isSuperAdmin` instead of `role = 'ADMIN'`
3. Replace `authorizeSupabase()` calls with org-membership-based checks where appropriate
4. Deprecate the `UserRole` enum for new code

**Effort:** M (Medium) -- 2-3 days
**Regression risk:** MEDIUM -- requires careful migration of all authorization checks. Feature flags recommended.

---

### Upgrade 3: Add Organization-Level RLS for Knowledge Base

**What to change:** Enable RLS on `document_sources` and `document_chunks` tables with `organization_id = get_current_org_id()` policies. Add `set_org_context()` function similar to `set_user_context()`.

**Why:** Knowledge base is the highest-value cross-tenant leakage vector. Application-level filtering alone is insufficient for defense-in-depth.

**Files:**

- New migration SQL
- `quikadmin/src/middleware/supabaseAuth.ts` (set org context alongside user context)
- `quikadmin/src/middleware/organizationContext.ts` (call set_org_context)

**Implementation:**

```sql
CREATE OR REPLACE FUNCTION set_org_context(org_id text) RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_org_id', org_id, true);
END;
$$ LANGUAGE plpgsql;

ALTER TABLE document_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "document_sources_org_policy" ON document_sources
    FOR ALL USING (organization_id = get_current_org_id() OR is_admin());

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "document_chunks_org_policy" ON document_chunks
    FOR ALL USING (organization_id = get_current_org_id() OR is_admin());
```

**Effort:** M (Medium) -- 1-2 days
**Regression risk:** MEDIUM -- must ensure org context is set before all KB queries. RLS_FAIL_CLOSED protects against missed context.

---

### Upgrade 4: Harden Document Sharing with Org Boundaries

**What to change:**

1. Add `organizationId` to `DocumentShare` model
2. Add org-level sharing policies (configurable: allow/deny external sharing)
3. Add rate limiting to `/api/shared/:token` endpoints
4. Add maximum access count option
5. Use cryptographically random tokens instead of Prisma default UUIDs

**Why:** Current sharing has zero organization awareness and no abuse protection.

**Files:**

- `quikadmin/prisma/schema.prisma` (DocumentShare model)
- `quikadmin/src/api/documents.routes.ts` (share creation)
- `quikadmin/src/api/shared.routes.ts` (share access)
- New migration

**Effort:** M (Medium) -- 2 days
**Regression risk:** LOW -- additive changes, existing shares continue to work

---

### Upgrade 5: Disable Demo Mode by Default + Environment Safety

**What to change:**

1. Change demo endpoint to opt-IN: require `ENABLE_DEMO_MODE=true` explicitly (currently treats unset as enabled)
2. Add startup validation that rejects `ENABLE_DEMO_MODE=true` when `NODE_ENV=production`
3. Log a CRITICAL security event when demo login is used

**Why:** Default-enabled demo mode with hardcoded credentials is a backdoor in production.

**Files:**

- `quikadmin/src/api/supabase-auth.routes.ts` (line 1137)
- `quikadmin/src/index.ts` (startup validation)

**Change:**

```typescript
// BEFORE
if (process.env.ENABLE_DEMO_MODE === 'false') { // opt-out

// AFTER
if (process.env.ENABLE_DEMO_MODE !== 'true') { // opt-in
```

**Effort:** S (Small) -- 1 hour
**Regression risk:** LOW -- local dev needs to set `ENABLE_DEMO_MODE=true` explicitly

---

### Upgrade 6: Close Org Context Cache Staleness Gap

**What to change:**

1. Invalidate org cache on role change, member removal, and org status change
2. Use Redis-backed cache instead of in-memory (shared across instances)
3. Reduce cache TTL to 60 seconds (from 5 minutes) until Redis cache is in place
4. Add cache invalidation pub/sub for multi-instance deployments

**Why:** 5-minute stale cache means revoked users retain access for too long. In multi-instance deployments, cache invalidation is per-process and unreliable.

**Files:**

- `quikadmin/src/middleware/organizationContext.ts`
- `quikadmin/src/api/organization.routes.ts` (call invalidate after role/member changes)

**Effort:** S-M (Small-Medium) -- 1 day for immediate TTL fix, 2 days for Redis migration
**Regression risk:** LOW -- cache is a performance optimization, reducing TTL only affects latency

---

### Upgrade 7: Act on Critical Anomaly Alerts

**What to change:** Implement the TODO at `auditLogger.ts` line 447. When a CRITICAL alert fires (e.g., CROSS_TENANT_ATTEMPT):

1. Temporarily lock the user's account (set `isActive=false`)
2. Invalidate all sessions
3. Send alert to configured webhook (Slack/email)
4. Log the incident with full request context

**Why:** Currently, CRITICAL security alerts are logged and ignored. A cross-tenant attack is detected but not prevented.

**Files:**

- `quikadmin/src/middleware/auditLogger.ts` (raiseAlert method)
- New: `quikadmin/src/services/securityResponse.service.ts`

**Effort:** M (Medium) -- 1-2 days
**Regression risk:** MEDIUM -- false positives could lock legitimate users. Implement with a "shadow mode" first that alerts but doesn't auto-lock.

---

## Summary Table

| #   | Upgrade                               | Severity Fixed | Effort | Risk | Priority         |
| --- | ------------------------------------- | -------------- | ------ | ---- | ---------------- |
| 1   | Fix registration privilege escalation | CRITICAL       | S      | LOW  | P0 - Do Now      |
| 5   | Disable demo mode by default          | MEDIUM         | S      | LOW  | P0 - Do Now      |
| 2   | Unify role model                      | HIGH           | M      | MED  | P1 - Next Sprint |
| 3   | Org-level RLS for knowledge base      | HIGH           | M      | MED  | P1 - Next Sprint |
| 4   | Harden document sharing               | MEDIUM         | M      | LOW  | P2 - Planned     |
| 6   | Fix org cache staleness               | LOW-MED        | S-M    | LOW  | P2 - Planned     |
| 7   | Act on critical alerts                | MEDIUM         | M      | MED  | P2 - Planned     |

**The registration privilege escalation (Upgrade 1) and demo mode default (Upgrade 5) should be fixed immediately -- they are both one-line changes with minimal regression risk.**
