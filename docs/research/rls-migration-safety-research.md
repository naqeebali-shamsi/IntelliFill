# RLS Migration Safety Research: Zero-Downtime Patterns for PostgreSQL

> **Date:** 2026-02-08
> **Context:** Organization-level RLS migration for `document_sources`, `document_chunks`, and `document_shares` tables
> **Database:** Neon Serverless PostgreSQL
> **ORM:** Prisma 6.14

---

## Table of Contents

1. [Lock Analysis per DDL Operation](#1-lock-analysis-per-ddl-operation)
2. [CREATE POLICY Lock Behavior](#2-create-policy-lock-behavior)
3. [ADD COLUMN Safety](#3-add-column-safety)
4. [CREATE FUNCTION Safety](#4-create-function-safety)
5. [CREATE INDEX Considerations](#5-create-index-considerations)
6. [Order of Operations: Code vs. Migration](#6-order-of-operations-code-vs-migration)
7. [Rollback Strategies](#7-rollback-strategies)
8. [Neon-Specific Considerations](#8-neon-specific-considerations)
9. [Recommended Deployment Plan](#9-recommended-deployment-plan)
10. [Sources](#10-sources)

---

## 1. Lock Analysis per DDL Operation

### ALTER TABLE ... ENABLE ROW LEVEL SECURITY

| Property                | Value                                                         |
| ----------------------- | ------------------------------------------------------------- |
| **Lock Level**          | `AccessExclusiveLock` (level 8/8 -- most restrictive)         |
| **Blocks**              | ALL operations -- SELECT, INSERT, UPDATE, DELETE, and all DDL |
| **Table Rewrite**       | NO -- metadata-only catalog change                            |
| **Expected Duration**   | Milliseconds (sub-second for any table size)                  |
| **Safe for Production** | YES, with caveats (see below)                                 |

**Key insight:** Although `ENABLE ROW LEVEL SECURITY` takes the strongest lock (AccessExclusiveLock), it is a **metadata-only** operation that modifies `pg_class.relrowsecurity`. There is no table rewrite or data scan. The lock is held for only the time it takes to update the system catalog, which is typically **< 10ms** regardless of table size.

**Risk factor:** If there are long-running queries holding locks on the same table, the `AccessExclusiveLock` will **queue behind them** and also **block all subsequent queries** from starting (lock queue starvation). This is the primary risk for production.

**Mitigation:** Use `SET lock_timeout = '3s'` before the ALTER TABLE statement. If the lock cannot be acquired within 3 seconds, the statement fails safely rather than blocking the entire application.

### Our Migration Has 2 Tables for ENABLE RLS

```sql
ALTER TABLE document_sources ENABLE ROW LEVEL SECURITY;  -- ~ms
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;    -- ~ms
```

**Assessment: LOW RISK** -- Both are fast metadata operations. Total blocking time: ~20ms under normal conditions.

---

## 2. CREATE POLICY Lock Behavior

| Property                | Value                                       |
| ----------------------- | ------------------------------------------- |
| **Lock Level**          | `AccessExclusiveLock` (same as ALTER TABLE) |
| **Blocks**              | ALL operations on the target table          |
| **Table Rewrite**       | NO -- modifies `pg_policy` catalog only     |
| **Expected Duration**   | Milliseconds per policy                     |
| **Safe for Production** | YES, same caveats as ENABLE RLS             |

`CREATE POLICY` modifies the `pg_policy` system catalog to register the new policy. Like `ENABLE ROW LEVEL SECURITY`, it requires an `AccessExclusiveLock` on the target table but holds it only for the catalog write duration.

### Our Migration Creates 8 Policies

```
document_sources: 4 policies (SELECT, INSERT, UPDATE, DELETE)
document_chunks:  4 policies (SELECT, INSERT, UPDATE, DELETE)
```

**Assessment: LOW RISK** -- 8 catalog writes, each taking ~ms. However, they should ideally run **within the same transaction** as `ENABLE RLS` to avoid a window where RLS is enabled but no policies exist (which would result in default-deny blocking all access).

**CRITICAL:** If RLS is enabled on a table but no policies exist yet, PostgreSQL uses a **default-deny** policy. This means ALL queries to that table will return zero rows (for SELECT) or fail (for INSERT/UPDATE/DELETE). The migration MUST be atomic -- `ENABLE RLS` and `CREATE POLICY` in the same transaction.

---

## 3. ADD COLUMN Safety

### Nullable Columns Without Defaults (Our Case)

```sql
ALTER TABLE document_shares
    ADD COLUMN organization_id TEXT,
    ADD COLUMN max_access_count INT;
```

| Property                | Value                                           |
| ----------------------- | ----------------------------------------------- |
| **Lock Level**          | `AccessExclusiveLock`                           |
| **Table Rewrite**       | **NO** -- nullable + no default = metadata-only |
| **Expected Duration**   | Milliseconds                                    |
| **Safe for Production** | YES                                             |

**Why this is safe:** Since PostgreSQL 11, adding a nullable column without a default value is a **metadata-only** operation. PostgreSQL records the new column in the system catalog and returns `NULL` for existing rows without physically modifying any data pages. The `AccessExclusiveLock` is held for only the catalog update duration (~ms).

**Contrast with unsafe patterns:**

- `ADD COLUMN ... DEFAULT 'value'` -- Safe since PG 11 (metadata-only with virtual default)
- `ADD COLUMN ... NOT NULL DEFAULT 'value'` -- Safe since PG 11
- `ADD COLUMN ... NOT NULL` (no default) -- **UNSAFE** -- requires table scan to validate constraint

**Assessment: LOW RISK** -- Our columns are nullable with no defaults. This is the safest ADD COLUMN pattern.

---

## 4. CREATE FUNCTION Safety

```sql
CREATE OR REPLACE FUNCTION set_org_context(org_id text) RETURNS void AS $$ ... $$;
CREATE OR REPLACE FUNCTION get_current_org_id() RETURNS text AS $$ ... $$;
```

| Property                | Value                                                      |
| ----------------------- | ---------------------------------------------------------- |
| **Lock Level**          | None on user tables (only `pg_proc` catalog)               |
| **Blocks**              | Nothing -- function creation does not lock any user tables |
| **Expected Duration**   | Milliseconds                                               |
| **Safe for Production** | YES -- completely safe                                     |

`CREATE OR REPLACE FUNCTION` operates on the `pg_proc` system catalog only. It does **not** acquire any locks on user tables. Existing connections using the old function definition will see the new version on their next call.

**Assessment: NO RISK** -- These are independent catalog operations that don't affect table access at all.

---

## 5. CREATE INDEX Considerations

```sql
CREATE INDEX idx_document_shares_organization_id ON document_shares(organization_id);
```

| Property                | Value                                        |
| ----------------------- | -------------------------------------------- |
| **Lock Level**          | `ShareLock` (blocks writes, allows reads)    |
| **Table Scan**          | YES -- must scan entire table to build index |
| **Duration**            | Proportional to table size                   |
| **Safe for Production** | DEPENDS on table size                        |

**Risk:** `CREATE INDEX` (without `CONCURRENTLY`) takes a `ShareLock` which blocks all INSERT, UPDATE, DELETE operations on `document_shares` for the duration of the index build. For small tables (< 100K rows), this is typically < 1 second. For larger tables, it can take minutes.

**Safer alternative:**

```sql
CREATE INDEX CONCURRENTLY idx_document_shares_organization_id ON document_shares(organization_id);
```

`CREATE INDEX CONCURRENTLY` takes only a `ShareUpdateExclusiveLock` which does **not** block writes. However, it cannot run inside a transaction, and Prisma migrations run inside a transaction by default.

**Assessment: MEDIUM RISK** -- For `document_shares` (likely < 10K rows in early production), the non-concurrent index build will complete in < 1 second. If the table is larger, consider a separate migration step with `CREATE INDEX CONCURRENTLY`.

**Prisma-specific note:** To use `CREATE INDEX CONCURRENTLY` in a Prisma migration, you must add a comment at the top of the migration file:

```sql
-- CreateIndex
-- DropIndex
```

Or use the `prisma migrate deploy` with a custom migration that has transactions disabled.

---

## 6. Order of Operations: Code vs. Migration

This is the most critical decision for zero-downtime deployment.

### Failure Mode Analysis

#### Scenario A: Migration FIRST, Then Code Deploy

**State:** New schema (RLS enabled, functions exist) + Old code (doesn't call `set_org_context()`)

| Impact                     | Description                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| `document_sources` queries | **FAIL** -- RLS is enabled, old code doesn't set org context, default fail-closed returns zero rows |
| `document_chunks` queries  | **FAIL** -- Same as above                                                                           |
| `document_shares` queries  | **OK** -- New columns are nullable, old code ignores them                                           |
| Duration of breakage       | From migration completion until new code is deployed and running                                    |

**Severity: HIGH** -- Knowledge base features would be completely broken during the gap between migration and code deployment.

#### Scenario B: Code FIRST, Then Migration

**State:** Old schema (no RLS, no `set_org_context()` function) + New code (calls `set_org_context()`)

| Impact                         | Description                                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `set_org_context()` call       | **FAIL** -- Function does not exist, `$executeRawUnsafe('SELECT set_org_context($1)')` throws PostgreSQL error |
| All queries after context call | **FAIL** -- If the context-setting middleware throws, subsequent queries may also fail                         |
| Duration of breakage           | From new code deployment until migration runs                                                                  |

**Severity: HIGH** -- All requests that hit the org context middleware would throw 500 errors.

#### Scenario C: Expand/Contract Pattern (RECOMMENDED)

Split the deployment into phases:

**Phase 1 -- Expand (Schema-only, backward compatible):**

1. `CREATE OR REPLACE FUNCTION set_org_context(...)` -- Safe, no impact
2. `CREATE OR REPLACE FUNCTION get_current_org_id()` -- Safe, no impact
3. `ALTER TABLE document_shares ADD COLUMN organization_id TEXT` -- Safe, nullable
4. `ALTER TABLE document_shares ADD COLUMN max_access_count INT` -- Safe, nullable
5. `CREATE INDEX idx_document_shares_organization_id ...` -- Brief write-lock

**DO NOT** enable RLS or create policies in Phase 1.

**Phase 2 -- Code Deploy:**
Deploy new application code that:

- Calls `set_org_context()` in middleware (function now exists from Phase 1)
- Writes to new `organization_id` and `max_access_count` columns on `document_shares`
- Is **prepared** for RLS but doesn't depend on it yet

**Phase 3 -- Contract (Enable RLS):**

1. `ALTER TABLE document_sources ENABLE ROW LEVEL SECURITY`
2. `ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY`
3. `CREATE POLICY ...` (all 8 policies)

This must be atomic (single transaction) to avoid the default-deny gap.

### Why Expand/Contract is Safest

| Phase Transition | Old Code Impact                                          | New Code Impact                                     |
| ---------------- | -------------------------------------------------------- | --------------------------------------------------- |
| After Phase 1    | No impact (functions exist but unused, columns nullable) | No impact (not deployed yet)                        |
| After Phase 2    | N/A (old code replaced)                                  | Works fine (functions exist, RLS not yet enabled)   |
| After Phase 3    | N/A                                                      | Works fine (code already calls `set_org_context()`) |

**Rollback at any phase:**

- After Phase 1: Drop functions, drop columns (no data loss)
- After Phase 2: Roll back code (schema is backward compatible)
- After Phase 3: Disable RLS + drop policies (see Section 7)

---

## 7. Rollback Strategies

### Rollback from Full Migration (Phase 3)

```sql
-- STEP 1: Drop all policies FIRST
DROP POLICY IF EXISTS "document_sources_select_policy" ON document_sources;
DROP POLICY IF EXISTS "document_sources_insert_policy" ON document_sources;
DROP POLICY IF EXISTS "document_sources_update_policy" ON document_sources;
DROP POLICY IF EXISTS "document_sources_delete_policy" ON document_sources;

DROP POLICY IF EXISTS "document_chunks_select_policy" ON document_chunks;
DROP POLICY IF EXISTS "document_chunks_insert_policy" ON document_chunks;
DROP POLICY IF EXISTS "document_chunks_update_policy" ON document_chunks;
DROP POLICY IF EXISTS "document_chunks_delete_policy" ON document_chunks;

-- STEP 2: Disable RLS on tables
ALTER TABLE document_sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks DISABLE ROW LEVEL SECURITY;

-- STEP 3 (optional): Remove functions
DROP FUNCTION IF EXISTS set_org_context(text);
DROP FUNCTION IF EXISTS get_current_org_id();

-- STEP 4 (optional): Remove new columns
ALTER TABLE document_shares DROP COLUMN IF EXISTS organization_id;
ALTER TABLE document_shares DROP COLUMN IF EXISTS max_access_count;
DROP INDEX IF EXISTS idx_document_shares_organization_id;
```

**CRITICAL WARNING:** If you `DROP POLICY` without `DISABLE ROW LEVEL SECURITY`, the table will use PostgreSQL's **default-deny** policy, blocking ALL access. Always `DISABLE RLS` as part of rollback.

### Pre-built Rollback Migration

Create a `down.sql` file alongside the migration:

```
prisma/migrations/20260208000000_add_org_rls_knowledge_base/
  migration.sql     -- Forward migration
  down.sql          -- Rollback (not auto-run by Prisma, manual only)
```

Prisma does not support automatic rollbacks. The `down.sql` must be run manually:

```bash
psql $DATABASE_URL -f prisma/migrations/20260208000000_add_org_rls_knowledge_base/down.sql
```

---

## 8. Neon-Specific Considerations

### Cold Start and Compute Suspension

| Factor                          | Impact                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Auto-suspend**                | Neon suspends compute after 5 min idle (configurable on paid plans)                             |
| **Cold start latency**          | 500ms - few seconds to wake compute                                                             |
| **Migration during cold start** | Migration connection may trigger compute wake-up; add `connect_timeout=10` to connection string |

**Recommendation:** Before running the migration, ensure the Neon compute is **active** by running a simple query (`SELECT 1`) first. This prevents the migration from timing out during cold start.

### Connection Pooling (PgBouncer)

| Factor                    | Impact                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Pooling mode**          | Neon uses PgBouncer in **transaction mode** by default                                                                     |
| **Session variables**     | `set_config('app.current_org_id', ..., true)` with `true` = transaction-scoped -- **SAFE** with PgBouncer transaction mode |
| **Migration connections** | Use the **direct (non-pooled)** connection string for migrations                                                           |

**CRITICAL:** The migration's `set_org_context()` function uses `set_config(..., true)` which sets the variable for the current **transaction** only. This is the correct approach for PgBouncer transaction pooling because:

- The variable automatically resets when the transaction ends
- No session state leaks between different clients sharing the same connection
- This matches the existing `set_user_context()` pattern from the user-level RLS migration

**Prisma connection strings:**

- `DATABASE_URL` (pooled) -- For application queries
- `DIRECT_URL` (non-pooled) -- For `prisma migrate deploy`

### DDL and Neon Storage

Neon separates storage and compute. DDL operations (like `ENABLE RLS`, `CREATE POLICY`) modify the PostgreSQL catalog, which is stored in Neon's storage layer. These operations work identically to standard PostgreSQL -- Neon does not add any additional overhead or restrictions for DDL.

### Branching for Testing

Neon supports database branching. **Strongly recommended:**

```bash
# Create a test branch from production
neon branches create --name rls-migration-test --parent main

# Test the migration on the branch
DATABASE_URL=<branch-url> npx prisma migrate deploy

# Verify RLS works correctly
# Delete branch after testing
neon branches delete rls-migration-test
```

---

## 9. Recommended Deployment Plan

### Pre-Deployment Checklist

- [ ] Create `down.sql` rollback script
- [ ] Test migration on Neon branch (if available)
- [ ] Verify `set_org_context()` is called in all knowledge base code paths
- [ ] Ensure `DIRECT_URL` is set for migration (non-pooled)
- [ ] Confirm Neon compute is active (not suspended)

### Option A: Single Atomic Migration (Simplest -- Recommended for Small Teams)

If the gap between `prisma migrate deploy` and application restart is < 30 seconds:

1. **Set maintenance awareness** (no maintenance window needed, just team awareness)
2. Run `prisma migrate deploy` (entire migration is atomic in one transaction)
3. Deploy new application code immediately after
4. Verify knowledge base queries work

**Risk window:** ~10-30 seconds between migration completion and new code deployment where knowledge base queries return empty results (RLS enabled but code doesn't call `set_org_context()` yet).

**Acceptable if:** Knowledge base is not a critical real-time feature, or traffic is low.

### Option B: Two-Phase Expand/Contract (Recommended for Production)

**Phase 1 Migration (expand.sql):**

```sql
-- Safe: functions + columns only
CREATE OR REPLACE FUNCTION set_org_context(org_id text) RETURNS void AS $$ ... $$;
CREATE OR REPLACE FUNCTION get_current_org_id() RETURNS text AS $$ ... $$;
ALTER TABLE document_shares ADD COLUMN organization_id TEXT;
ALTER TABLE document_shares ADD COLUMN max_access_count INT;
CREATE INDEX idx_document_shares_organization_id ON document_shares(organization_id);
```

**Code Deploy:** Deploy application code that calls `set_org_context()`.

**Phase 2 Migration (enable_rls.sql):**

```sql
-- Enable RLS + policies (must be atomic)
ALTER TABLE document_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
-- ... all 8 CREATE POLICY statements ...
```

**Tradeoff:** Requires splitting the Prisma migration into two separate migrations.

### Option C: Feature Flag Guard (Most Defensive)

1. Deploy code with feature flag: `ENABLE_ORG_RLS=false`
2. Run full migration (RLS enabled but code doesn't route through RLS paths yet)
3. Flip feature flag: `ENABLE_ORG_RLS=true`
4. Monitor for errors
5. If issues: flip flag back to `false` + run rollback SQL

**Best for:** High-traffic production with strict SLA requirements.

---

## 10. Sources

- [PostgreSQL 18 - Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PostgreSQL 18 - CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html)
- [PostgreSQL 18 - Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [pglocks.org - ALTER TABLE ENABLE/DISABLE ROW LEVEL SECURITY](https://pglocks.org/?pgcommand=ALTER+TABLE+ENABLE/DISABLE+ROW+LEVEL+SECURITY)
- [Prisma - Deploying Database Changes](https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate)
- [Prisma Data Guide - Expand and Contract Pattern](https://www.prisma.io/dataguide/types/relational/expand-and-contract-pattern)
- [Neon - Benchmarking Latency](https://neon.com/docs/guides/benchmarking-latency)
- [Neon - Row-Level Security with Drizzle](https://neon.com/docs/guides/rls-drizzle)
- [Neon - Scaling Serverless Postgres](https://neon.com/blog/scaling-serverless-postgres)
- [PostgreSQL ADD COLUMN Performance (brandur.org)](https://brandur.org/postgres-default)
- [Safe and Unsafe Operations for PostgreSQL](http://leopard.in.ua/2016/09/20/safe-and-unsafe-operations-postgresql)
- [Martin Fowler - Parallel Change (Expand/Contract)](https://martinfowler.com/bliki/ParallelChange.html)
- [PlanetScale - Backward Compatible Database Changes](https://planetscale.com/blog/backward-compatible-databases-changes)
- [PostgreSQL DROP POLICY Documentation](https://www.postgresql.org/docs/current/sql-droppolicy.html)

---

## Summary of Key Findings

| Operation                                       | Lock                     | Duration | Safe Online?    |
| ----------------------------------------------- | ------------------------ | -------- | --------------- |
| `CREATE OR REPLACE FUNCTION`                    | None (catalog only)      | ~ms      | YES             |
| `ALTER TABLE ADD COLUMN` (nullable, no default) | AccessExclusiveLock      | ~ms      | YES             |
| `ALTER TABLE ENABLE ROW LEVEL SECURITY`         | AccessExclusiveLock      | ~ms      | YES (fast)      |
| `CREATE POLICY`                                 | AccessExclusiveLock      | ~ms      | YES (fast)      |
| `CREATE INDEX` (non-concurrent)                 | ShareLock                | Varies   | DEPENDS on size |
| `CREATE INDEX CONCURRENTLY`                     | ShareUpdateExclusiveLock | Varies   | YES             |

**Bottom line:** Every operation in our migration is safe for online execution. The total lock time is expected to be < 100ms for all DDL statements combined (excluding the index build). The primary risk is not locking but the **deployment ordering** -- ensuring code and schema changes are coordinated to avoid the default-deny gap.
