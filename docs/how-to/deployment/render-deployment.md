---
title: Render Deployment
description: Deploy IntelliFill backend to Render with pnpm and native binary handling
category: how-to
tags: [deployment, render, pnpm, production]
lastUpdated: 2025-12-19
---

# Render Deployment

This guide covers deploying the IntelliFill backend API to Render.com, including the pnpm migration for cross-platform native binary compatibility.

---

## Prerequisites

- GitHub repository with IntelliFill code
- Render.com account
- Environment variables ready (see [Environment Variables](../../reference/configuration/environment.md))
- Upstash Redis configured (see [Upstash Redis Setup](./upstash-redis-setup.md))

---

## Quick Start with Blueprint

The easiest way to deploy is using the `render.yaml` blueprint.

### 1. Connect Repository

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** > **Blueprint**
3. Connect your GitHub repository
4. Select the repository containing `render.yaml`
5. Click **Apply**

### 2. Configure Environment Variables

After the blueprint creates the service, configure variables marked with `sync: false`:

1. Go to your service in Render Dashboard
2. Click **Environment** tab
3. Add required variables (see Environment Variables section below)
4. Click **Save Changes**

---

## render.yaml Configuration

The current `render.yaml` uses pnpm for reliable cross-platform native binary handling:

```yaml
services:
  - type: web
    name: intellifill-api
    runtime: node
    region: oregon
    plan: free
    branch: main
    rootDir: quikadmin
    buildCommand: cd .. && corepack enable && pnpm install --frozen-lockfile && cd quikadmin && npx prisma generate && pnpm run build
    startCommand: pnpm run start:prod
    healthCheckPath: /api/health
```

### Build Command Breakdown

```bash
cd .. &&                          # Move to monorepo root
corepack enable &&                # Enable pnpm via corepack (built into Node 18+)
pnpm install --frozen-lockfile && # Install dependencies with lockfile integrity
cd quikadmin &&                   # Move to backend directory
npx prisma generate &&            # Generate Prisma client for Linux
pnpm run build                    # Compile TypeScript
```

### Why pnpm?

We migrated from npm to pnpm for deployment because:

1. **Native binary handling**: pnpm correctly resolves platform-specific binaries (like sharp) when developing on Windows and deploying to Linux
2. **Lockfile integrity**: `--frozen-lockfile` ensures reproducible builds
3. **Corepack integration**: Node.js 18+ includes corepack, making pnpm available without global installation
4. **Faster installs**: pnpm's content-addressable storage is more efficient

### Sharp Native Binary Issue (Solved)

**Problem**: Developing on Windows and deploying to Linux (Render) caused sharp module errors:

```
Error: Could not load the "sharp" module using the linux-x64 runtime
```

**Solution**: pnpm automatically handles platform-specific binary resolution when installing with `--frozen-lockfile`. The key was:

1. Using pnpm instead of npm
2. Running install from the monorepo root (not the subdirectory)
3. Using `--frozen-lockfile` to respect platform resolution

---

## Environment Variables

### Required Variables (sync: false)

These must be set manually in Render Dashboard:

| Variable             | Description                       | Example                                     |
| -------------------- | --------------------------------- | ------------------------------------------- |
| `DATABASE_URL`       | Neon PostgreSQL pooled connection | `postgresql://user:pass@...pooler.../db`    |
| `DIRECT_URL`         | Neon PostgreSQL direct connection | `postgresql://user:pass@.../db`             |
| `REDIS_URL`          | Upstash Redis with TLS            | `rediss://default:pass@....upstash.io:6379` |
| `JWT_SECRET`         | JWT signing secret (32+ chars)    | Generated random string                     |
| `JWT_REFRESH_SECRET` | Refresh token secret              | Generated random string                     |

### Optional Variables (sync: false)

| Variable                    | Description                    |
| --------------------------- | ------------------------------ |
| `SUPABASE_URL`              | Supabase project URL           |
| `SUPABASE_ANON_KEY`         | Supabase anonymous key         |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key      |
| `R2_ACCOUNT_ID`             | Cloudflare R2 account ID       |
| `R2_ACCESS_KEY_ID`          | R2 access key                  |
| `R2_SECRET_ACCESS_KEY`      | R2 secret key                  |
| `GOOGLE_API_KEY`            | Google AI API key (embeddings) |
| `SENTRY_DSN`                | Sentry error tracking DSN      |

### Pre-configured Variables

These are set in `render.yaml`:

| Variable         | Value                                | Description       |
| ---------------- | ------------------------------------ | ----------------- |
| `NODE_ENV`       | `production`                         | Production mode   |
| `PORT`           | `3002`                               | Server port       |
| `R2_BUCKET_NAME` | `intellifill-files`                  | R2 bucket name    |
| `CORS_ORIGINS`   | `https://intellifill.vercel.app,...` | Allowed origins   |
| `LOG_LEVEL`      | `info`                               | Logging verbosity |

---

## Deployment Process

### Initial Deployment

1. Push code to GitHub (main branch)
2. Render automatically detects `render.yaml`
3. Build starts with configured build command
4. Health check verifies `/api/health` endpoint
5. Service becomes available

### Manual Deployment

```bash
# Trigger deployment via Render CLI
render deploy

# Or via GitHub
git push origin main
```

### Build Cache Management

If you encounter native binary issues after dependency changes:

1. Go to Render Dashboard > Your Service > Settings
2. Scroll to **Build & Deploy**
3. Click **Clear build cache**
4. Trigger a new deployment

---

## Health Checks

### Available Endpoints

```bash
# Basic health (fast)
curl https://your-api.onrender.com/api/health
# Response: {"status":"ok","timestamp":...}

# Full readiness check (includes DB/Redis)
curl https://your-api.onrender.com/api/ready
# Response: {"status":"ready","checks":{"database":true,"redis":true,...}}
```

### Health Check Configuration

The blueprint configures:

- **Path**: `/api/health`
- **Interval**: Render's default (30 seconds)
- **Timeout**: 5 minutes for initial health check (cold start tolerance)

---

## Free Tier Considerations

### Limitations

- **Spin-down**: Service sleeps after 15 minutes of inactivity
- **Cold start**: First request after sleep takes 30-60 seconds
- **Hours**: 750 free instance hours per month

### Preventing Spin-down

Set up external monitoring to keep the service warm:

1. Create account on [UptimeRobot](https://uptimerobot.com) (free)
2. Add new monitor:
   - **Monitor Type**: HTTP(s)
   - **URL**: `https://your-api.onrender.com/api/health`
   - **Monitoring Interval**: 10 minutes
3. Enable only during business hours to conserve free hours

---

## Troubleshooting

### Build Failures

**Symptom**: Build fails with module not found errors

**Solutions**:

1. Clear build cache in Render Dashboard
2. Verify `pnpm-lock.yaml` is committed
3. Check that build command runs from correct directory

### Native Binary Errors

**Symptom**: Sharp or other native module errors

**Solutions**:

1. Ensure build command uses `pnpm install` from monorepo root
2. Clear build cache after dependency changes
3. Verify Node version matches between dev and Render (18.x)

### Health Check Failures

**Symptom**: Service fails to pass health check

**Solutions**:

1. Check Render logs for startup errors
2. Verify all required environment variables are set
3. Ensure database and Redis are accessible
4. Increase health check timeout for initial deployment

### Redis Connection Errors

**Symptom**: Redis connection failures in logs

**Solutions**:

1. Verify REDIS_URL uses `rediss://` protocol (with TLS)
2. Check Upstash dashboard for correct endpoint
3. See [Upstash Redis Setup](./upstash-redis-setup.md) for TLS configuration

---

## Monitoring and Logs

### Viewing Logs

1. Go to Render Dashboard > Your Service
2. Click **Logs** tab
3. Use search/filter to find specific errors

### Log Levels

Set `LOG_LEVEL` environment variable:

- `error` - Only errors
- `warn` - Warnings and errors
- `info` - Standard operations (default)
- `debug` - Detailed debugging

---

## Updating Deployment

### Automatic Deployments

By default, Render deploys on every push to main branch.

### Manual Control

1. Go to Render Dashboard > Your Service > Settings
2. Under **Build & Deploy**, toggle **Auto-Deploy**
3. Manually deploy when ready via **Manual Deploy** button

---

## Related Documentation

- [Upstash Redis Setup](./upstash-redis-setup.md)
- [Docker Deployment](./docker-deployment.md)
- [Deployment Troubleshooting](../troubleshooting/deployment-issues.md)
- [Environment Variables](../../reference/configuration/environment.md)
- [Render Documentation](https://render.com/docs)
