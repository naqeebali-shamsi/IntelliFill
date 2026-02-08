# CI/CD Pipeline Audit & Prisma Migration Integration Proposal

**Author:** Infrastructure Auditor Agent
**Date:** 2026-02-08
**Status:** Proposal

---

## 1. Current CI/CD Architecture

### 1.1 Pipeline Overview

```
GitHub push to main
       |
       +---> ci.yml (tests)
       |        |-- test-backend (npm ci, typecheck, lint, jest, build)
       |        |-- test-frontend (bun install, typecheck, test, build)
       |        +-- security-scan (npm audit, trufflehog)
       |
       +---> deploy.yml
                |-- build-and-push (Docker images -> GHCR)
                |-- deploy-frontend (Vercel via vercel-action)
                |-- deploy-backend (Render via deploy hook curl)
                +-- deploy-staging / deploy-production (TODO placeholders)
```

### 1.2 Render.com Deployment (Current)

**File:** `render.yaml`
**Runtime:** Native Node (NOT Docker)

| Setting            | Value                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `buildCommand`     | `cd .. && corepack enable && pnpm install --frozen-lockfile && cd quikadmin && npx prisma generate && pnpm run build` |
| `startCommand`     | `pnpm run start:prod`                                                                                                 |
| `preDeployCommand` | **Not configured**                                                                                                    |
| `healthCheckPath`  | `/api/health`                                                                                                         |

**Key observation:** The build command runs `prisma generate` but **never runs `prisma migrate deploy`**. Migrations must currently be applied manually.

### 1.3 Docker Setup (GHCR Path)

The Dockerfile builds a multi-stage image:

1. Stage 1 (builder): `pnpm install` -> copy source/prisma -> `prisma generate && pnpm run build` -> prune
2. Stage 2 (runtime): Copy dist, node_modules, prisma dir -> `node dist/index.js`

No migration step exists in either stage or the entrypoint.

### 1.4 Environment Variable Mismatch (BUG)

**Critical finding:** The Prisma schema and Render config disagree on the direct URL env var name:

| Location                        | Variable Name         | Purpose                         |
| ------------------------------- | --------------------- | ------------------------------- |
| `prisma/schema.prisma` (line 8) | `DIRECT_DATABASE_URL` | Prisma directUrl for migrations |
| `render.yaml` (line 29)         | `DIRECT_URL`          | Render dashboard env var        |

**Impact:** Even if `prisma migrate deploy` were added today, it would fail because Prisma looks for `DIRECT_DATABASE_URL` but Render only provides `DIRECT_URL`. This must be resolved before any migration automation works.

**Fix:** Either rename the Render env var to `DIRECT_DATABASE_URL` in the Render dashboard (and update `render.yaml`) or change the Prisma schema to use `env("DIRECT_URL")`. The former is recommended for clarity.

### 1.5 Migration History

12 migrations exist (from `20250812184626_init` through `20260208000000_add_org_rls_knowledge_base`). The latest adds RLS policies and DDL changes that require a direct (non-pooled) connection to Neon.

---

## 2. Option Analysis

### Option A: Render Build Command

**Change:** Modify `render.yaml` `buildCommand` to:

```yaml
buildCommand: >-
  cd .. && corepack enable && pnpm install --frozen-lockfile &&
  cd quikadmin && npx prisma migrate deploy && npx prisma generate && pnpm run build
```

| Criterion                        | Assessment                                                                                                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration failure blocks deploy? | **Partially.** Fails the build, so no new code deploys. But build failure is a blunt signal -- hard to distinguish migration errors from build errors in logs.                                                                                                        |
| DATABASE_URL security?           | **OK.** Render injects env vars into build environment. They are not exposed in logs by default.                                                                                                                                                                      |
| Works with Neon DIRECT_URL?      | **Yes**, if the env var naming mismatch is fixed (see Section 1.4). `prisma migrate deploy` uses the `directUrl` from the schema.                                                                                                                                     |
| Concurrent deploy safety?        | **Safe.** Render serializes builds per service. Only one build runs at a time.                                                                                                                                                                                        |
| Rollback behavior?               | **Poor.** If the build succeeds (migration applied + code compiled) but the deploy is later rolled back, the database schema is ahead of the running code. Prisma handles forward-only migrations, but the old code running queries may break against the new schema. |

**Verdict:** Workable but suboptimal. Migrations in the build phase means they run even on failed builds that never deploy. No separation of concerns.

---

### Option B: Separate GitHub Actions Job

**Change:** Add a `migrate-database` job in `deploy.yml`:

```yaml
migrate-database:
  name: Run Database Migrations
  runs-on: ubuntu-latest
  needs: build-and-push
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  environment: production
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: '20' }
    - name: Install Prisma CLI
      run: cd quikadmin && npm ci --ignore-scripts && npx prisma generate
    - name: Run migrations
      env:
        DATABASE_URL: ${{ secrets.DATABASE_URL }}
        DIRECT_DATABASE_URL: ${{ secrets.DIRECT_DATABASE_URL }}
      run: cd quikadmin && npx prisma migrate deploy

deploy-backend:
  needs: [build-and-push, migrate-database]
  # ... existing config
```

| Criterion                        | Assessment                                                                                                                                                                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration failure blocks deploy? | **Yes.** `deploy-backend` has `needs: [migrate-database]`, so it only runs after migration succeeds.                                                                                                                                                       |
| DATABASE_URL security?           | **Requires secrets.** `DATABASE_URL` and `DIRECT_DATABASE_URL` must be stored as GitHub Actions secrets in the `production` environment. This means the CI runner has direct DB access -- acceptable for GH-hosted runners but expands the attack surface. |
| Works with Neon DIRECT_URL?      | **Yes.** Secrets can store the direct (non-pooled) Neon connection string. The CI runner connects from GitHub's IP range, which Neon allows by default.                                                                                                    |
| Concurrent deploy safety?        | **Needs concurrency group.** Without one, two pushes in quick succession could run migrations in parallel. Fix with: `concurrency: { group: 'deploy-prod', cancel-in-progress: false }`                                                                    |
| Rollback behavior?               | **Better.** Migration is a separate visible step. Can add manual approval gates via GH environments. But rollback still has the schema-ahead-of-code problem.                                                                                              |

**Verdict:** Good separation of concerns and visibility. But adds complexity and requires DB credentials in GitHub secrets.

---

### Option C: Docker Entrypoint Script

**Change:** Create `quikadmin/docker-entrypoint.sh`:

```bash
#!/bin/sh
set -e
echo "Running database migrations..."
npx prisma migrate deploy
echo "Starting application..."
exec node dist/index.js
```

Update `Dockerfile` CMD:

```dockerfile
COPY --chown=nodejs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
CMD ["./docker-entrypoint.sh"]
```

| Criterion                        | Assessment                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Migration failure blocks deploy? | **No.** Migration runs at container start time, not build time. If migration fails, the container crashes and Render may restart it (causing a retry loop). The old container may have already been stopped. |
| DATABASE_URL security?           | **OK.** Uses runtime env vars already configured in Render.                                                                                                                                                  |
| Works with Neon DIRECT_URL?      | **Yes**, if available at runtime.                                                                                                                                                                            |
| Concurrent deploy safety?        | **Dangerous.** Multiple replicas starting simultaneously would race to apply migrations. Prisma uses advisory locks to handle this, but it adds risk with connection pools and serverless databases.         |
| Rollback behavior?               | **Poor.** Migration runs on every start, adding latency. Rollback to old image still has new schema.                                                                                                         |

**Additional problem:** The current Render deployment uses **native Node runtime** (not Docker). The Dockerfile is only used for the GHCR image path, which has placeholder deploy steps. This option would require switching Render to Docker deployment, which is a significant architectural change.

**Verdict:** Not recommended. Misaligned with current deployment model, introduces race conditions, and migration-on-every-start is an anti-pattern.

---

### Option D: Render Pre-Deploy Command

**Change:** Add `preDeployCommand` to `render.yaml`:

```yaml
services:
  - type: web
    name: intellifill-api
    # ... existing config ...
    buildCommand: >-
      cd .. && corepack enable && pnpm install --frozen-lockfile &&
      cd quikadmin && npx prisma generate && pnpm run build
    preDeployCommand: cd quikadmin && npx prisma migrate deploy
    startCommand: pnpm run start:prod
```

| Criterion                        | Assessment                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration failure blocks deploy? | **Yes.** Render's pre-deploy command runs after build but before the new version replaces the old one. If it fails, the deploy is aborted and the old version keeps running. This is the ideal behavior.                                                                                                                                                            |
| DATABASE_URL security?           | **Excellent.** Uses the same env vars already configured in Render dashboard. No additional secret storage needed. No exposure to CI runners.                                                                                                                                                                                                                       |
| Works with Neon DIRECT_URL?      | **Yes**, once the env var naming mismatch (Section 1.4) is fixed. The pre-deploy command runs in the same environment as the build, with all env vars available.                                                                                                                                                                                                    |
| Concurrent deploy safety?        | **Safe.** Render serializes deploys per service. The pre-deploy command is part of the deploy transaction.                                                                                                                                                                                                                                                          |
| Rollback behavior?               | **Best available.** If pre-deploy fails, nothing changes. If deploy succeeds but needs rollback, Render reverts to the old code but the migration is already applied. This schema-ahead-of-code issue is inherent to all options with forward-only migrations. However, since pre-deploy only runs on successful builds, the window for inconsistency is minimized. |

**Additional benefits:**

- Zero changes to GitHub Actions workflows
- Zero changes to Dockerfile
- No DB credentials needed outside Render
- Render logs show pre-deploy output separately from build/start logs
- Works with Render's existing deploy lifecycle

**Verdict:** Strongly recommended. Purpose-built for this use case, minimal change surface, best security posture.

---

## 3. Recommendation

### Primary: Option D (Render Pre-Deploy Command)

**Why:**

1. **Purpose-built:** Render's `preDeployCommand` exists specifically for database migrations
2. **Atomic deploy:** Migration runs between build and traffic switch -- if it fails, old version stays live
3. **Minimal change:** Single line addition to `render.yaml`
4. **Secure:** DB credentials stay in Render, never exposed to CI
5. **Compatible:** Works with existing native Node deployment on Render
6. **Observable:** Render dashboard shows pre-deploy logs separately

### Enhancement: Add Migration Lint in CI (Option B Lite)

Add a lightweight migration validation step to `ci.yml` (NOT the full `prisma migrate deploy`) to catch issues early:

```yaml
validate-migrations:
  name: Validate Prisma Migrations
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: quikadmin
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: '20' }
    - run: npm ci --ignore-scripts
    - run: npx prisma validate
    - run: npx prisma generate
```

This catches schema errors and invalid migration files in PRs, without requiring database access.

---

## 4. Implementation Plan

### Step 1: Fix Environment Variable Mismatch (PREREQUISITE)

**Option A (Recommended):** Update the Render dashboard env var from `DIRECT_URL` to `DIRECT_DATABASE_URL`, and update `render.yaml`:

```yaml
# render.yaml - change this:
- key: DIRECT_URL
  sync: false
# to this:
- key: DIRECT_DATABASE_URL
  sync: false
```

**Option B (Alternative):** Change `prisma/schema.prisma` line 8:

```prisma
directUrl = env("DIRECT_URL")
```

Option A is preferred because `DIRECT_DATABASE_URL` is more descriptive and follows the convention of `DATABASE_URL`.

### Step 2: Add Pre-Deploy Command to render.yaml

```yaml
services:
  - type: web
    name: intellifill-api
    # ... existing config unchanged ...
    buildCommand: cd .. && corepack enable && pnpm install --frozen-lockfile && cd quikadmin && npx prisma generate && pnpm run build
    preDeployCommand: cd quikadmin && npx prisma migrate deploy
    startCommand: pnpm run start:prod
```

### Step 3: Add Migration Validation to CI

Add a `validate-migrations` job to `.github/workflows/ci.yml` to catch schema issues in PRs before they reach production.

### Step 4: Test the Pipeline

1. Create a test migration (`prisma migrate dev --name test_cicd`)
2. Push to a branch, verify CI validation passes
3. Merge to main, verify Render pre-deploy runs the migration
4. Check Render deploy logs for migration output
5. Verify the app starts correctly after migration
6. Delete the test migration

### Step 5: Document the Process

Add developer documentation explaining:

- How to create new migrations locally (`npx prisma migrate dev`)
- How migrations are applied in production (automated via pre-deploy)
- What to do if a migration fails in production
- Rollback procedures (create a corrective migration, not a manual rollback)

---

## 5. Risk Assessment

| Risk                                     | Likelihood | Impact                       | Mitigation                                                                                                                               |
| ---------------------------------------- | ---------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Pre-deploy migration fails               | Medium     | Low (old version stays live) | Fix migration, redeploy. Render blocks bad deploys.                                                                                      |
| Schema-ahead-of-code after rollback      | Low        | Medium                       | Design migrations to be backwards-compatible. Add columns before code references them; remove columns after code stops referencing them. |
| Neon connection timeout during migration | Low        | Low                          | Neon direct connections are reliable for short DDL. Large data migrations should be split.                                               |
| Render pre-deploy timeout                | Low        | Medium                       | Render allows up to 30 min for pre-deploy. RLS policy migrations (like the latest) are fast DDL.                                         |
| Concurrent migration from manual deploy  | Very Low   | Medium                       | Prisma uses advisory locks. Render serializes deploys.                                                                                   |

---

## 6. Comparison Summary

| Criterion                  | A: Build Cmd | B: GH Actions | C: Entrypoint | **D: Pre-Deploy** |
| -------------------------- | :----------: | :-----------: | :-----------: | :---------------: |
| Failure blocks deploy      |   Partial    |      Yes      |      No       |      **Yes**      |
| DB creds stay in Render    |     Yes      |      No       |      Yes      |      **Yes**      |
| Works with Neon direct URL |     Yes      |      Yes      |      Yes      |      **Yes**      |
| Concurrent deploy safety   |     Yes      | Needs config  |      No       |      **Yes**      |
| Change complexity          |     Low      |     High      |     High      |      **Low**      |
| Observability              |     Poor     |     Good      |     Poor      |     **Good**      |
| Aligned with Render model  |     Yes      |      N/A      |      No       |      **Yes**      |

**Winner: Option D (Render Pre-Deploy Command)**

---

## Appendix: Key File Locations

| File                             | Purpose          | Relevant Lines                         |
| -------------------------------- | ---------------- | -------------------------------------- |
| `.github/workflows/deploy.yml`   | Deploy pipeline  | L98-115 (backend deploy)               |
| `.github/workflows/ci.yml`       | CI tests         | Full file                              |
| `render.yaml`                    | Render blueprint | L16 (buildCommand), L17 (startCommand) |
| `quikadmin/Dockerfile`           | Docker build     | L37 (prisma generate)                  |
| `quikadmin/prisma/schema.prisma` | DB schema        | L8 (directUrl env var)                 |
| `quikadmin/package.json`         | Scripts          | L36-37 (db:migrate, db:generate)       |
