---
title: Environment Variables
description: Complete reference for all IntelliFill environment variables
category: reference
tags: [configuration, environment, settings, redis, tls, security]
lastUpdated: 2025-12-31
---

# Environment Variables

Complete reference for all environment variables used by IntelliFill.

---

## File Authority Model

IntelliFill uses **three separate `.env` files**, each authoritative for specific variables:

| File                 | Purpose                | Authoritative For                                             |
| -------------------- | ---------------------- | ------------------------------------------------------------- |
| `quikadmin/.env`     | Backend configuration  | DATABASE*URL, SUPABASE*_, JWT\__, REDIS*URL, R2*\*, LOG_LEVEL |
| `quikadmin-web/.env` | Frontend configuration | VITE*API_URL, VITE_SUPABASE*_, VITE\__ feature flags          |
| `.env` (root)        | AI tooling only        | PERPLEXITY_API_KEY, GEMINI_API_KEY, GROQ_API_KEY              |

**IMPORTANT Security Notes**:

- `SUPABASE_SERVICE_ROLE_KEY` must **ONLY** exist in `quikadmin/.env` (never root)
- Root `.env` should **NOT** contain any Supabase keys
- Never duplicate keys across files - each key has ONE authoritative source

**Why separate files?**

1. **Security**: Backend secrets (SERVICE_ROLE_KEY) isolated from root exposure
2. **Clarity**: Each sub-project (backend/frontend) has self-contained config
3. **Deployment**: Different deployment targets need different variables

---

## Backend Environment Variables

File: `quikadmin/.env`

### Server Configuration

| Variable   | Required | Default       | Description                                           |
| ---------- | -------- | ------------- | ----------------------------------------------------- |
| `NODE_ENV` | No       | `development` | Environment mode: `development`, `production`, `test` |
| `PORT`     | No       | `3002`        | HTTP server port                                      |
| `HOST`     | No       | `0.0.0.0`     | Server host binding                                   |

**Example**:

```env
NODE_ENV=development
PORT=3002
```

---

### Database Configuration

| Variable       | Required | Default | Description                               |
| -------------- | -------- | ------- | ----------------------------------------- |
| `DATABASE_URL` | Yes      | -       | PostgreSQL connection string (pooled)     |
| `DIRECT_URL`   | Yes      | -       | PostgreSQL direct connection (migrations) |

**Example** (Neon):

```env
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.region.neon.tech/neondb?sslmode=require"
```

**Example** (Local):

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/intellifill"
DIRECT_URL="postgresql://postgres:password@localhost:5432/intellifill"
```

**Connection String Options**:

- `sslmode=require`: Enable SSL (required for cloud databases)
- `connection_limit=10`: Max connections (for pooling)
- `pool_timeout=10`: Connection timeout in seconds

---

### Supabase Configuration

| Variable                    | Required | Default | Description                              |
| --------------------------- | -------- | ------- | ---------------------------------------- |
| `SUPABASE_URL`              | Yes      | -       | Supabase project URL                     |
| `SUPABASE_ANON_KEY`         | Yes      | -       | Supabase anonymous/public key            |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | -       | Supabase service role key (backend only) |

**Example**:

```env
SUPABASE_URL="https://abcdefghijklmnop.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Getting Keys**:

1. Go to Supabase Dashboard
2. Select your project
3. Settings > API
4. Copy "Project URL", "anon public", and "service_role"

---

### JWT Configuration

| Variable             | Required | Default | Description                                |
| -------------------- | -------- | ------- | ------------------------------------------ |
| `JWT_SECRET`         | Yes      | -       | Secret key for signing JWTs (min 32 chars) |
| `JWT_EXPIRY`         | No       | `7d`    | Token expiration time                      |
| `JWT_REFRESH_SECRET` | No       | -       | Secret for refresh tokens                  |

**Example**:

```env
JWT_SECRET="your-super-secret-key-minimum-32-characters-long"
JWT_EXPIRY="7d"
JWT_REFRESH_SECRET="your-refresh-secret-key-minimum-32-chars"
```

---

### Redis Configuration

| Variable                   | Required | Default | Description                                    |
| -------------------------- | -------- | ------- | ---------------------------------------------- |
| `REDIS_URL`                | No       | -       | Redis connection URL (use `rediss://` for TLS) |
| `UPSTASH_REDIS_REST_URL`   | No       | -       | Upstash REST API URL (fallback)                |
| `UPSTASH_REDIS_REST_TOKEN` | No       | -       | Upstash REST API token                         |

**Example** (Local development):

```env
REDIS_URL="redis://localhost:6379"
```

**Example** (Upstash production - TLS required):

```env
REDIS_URL="rediss://default:password@us1-example.upstash.io:6379"
UPSTASH_REDIS_REST_URL="https://us1-example.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-rest-token"
```

**IMPORTANT**: For cloud Redis providers like Upstash, use `rediss://` (with double 's') to enable TLS encryption. Using `redis://` will fail with TLS-required endpoints.

**Protocol Reference**:

- `redis://` - Plain TCP connection (local development only)
- `rediss://` - TLS-encrypted connection (required for Upstash, recommended for production)

**Note**: If not configured, the application falls back to in-memory rate limiting. Bull queues require Redis for production use.

---

### File Upload Configuration

| Variable             | Required | Default     | Description                   |
| -------------------- | -------- | ----------- | ----------------------------- |
| `UPLOAD_MAX_SIZE`    | No       | `10485760`  | Max file size in bytes (10MB) |
| `UPLOAD_DIR`         | No       | `./uploads` | Upload directory path         |
| `ALLOWED_MIME_TYPES` | No       | -           | Comma-separated MIME types    |

**Example**:

```env
UPLOAD_MAX_SIZE=10485760
UPLOAD_DIR="./uploads"
ALLOWED_MIME_TYPES="application/pdf,image/png,image/jpeg"
```

---

### OCR Configuration

| Variable       | Required | Default | Description                  |
| -------------- | -------- | ------- | ---------------------------- |
| `OCR_LANGUAGE` | No       | `eng`   | Tesseract language code      |
| `OCR_WORKERS`  | No       | `4`     | Number of OCR worker threads |

**Example**:

```env
OCR_LANGUAGE="eng+spa"
OCR_WORKERS=4
```

---

### Logging Configuration

| Variable     | Required | Default  | Description                                 |
| ------------ | -------- | -------- | ------------------------------------------- |
| `LOG_LEVEL`  | No       | `info`   | Log level: `error`, `warn`, `info`, `debug` |
| `LOG_FORMAT` | No       | `json`   | Log format: `json`, `simple`                |
| `LOG_DIR`    | No       | `./logs` | Log files directory                         |

**Example**:

```env
LOG_LEVEL="debug"
LOG_FORMAT="simple"
LOG_DIR="./logs"
```

---

### Security Configuration

| Variable          | Required | Default | Description                                  |
| ----------------- | -------- | ------- | -------------------------------------------- |
| `RLS_FAIL_CLOSED` | No       | `false` | Reject requests when RLS context setup fails |

**Example**:

```env
# Production: fail-closed for security
RLS_FAIL_CLOSED=true
```

**RLS_FAIL_CLOSED Behavior**:

| Value   | Behavior                                     | Environment |
| ------- | -------------------------------------------- | ----------- |
| `true`  | Reject request with 500 on RLS setup failure | Production  |
| `false` | Log error, continue without RLS protection   | Development |

**Recommendation**: Always set `RLS_FAIL_CLOSED=true` in production to prevent potential data access without proper Row-Level Security context.

---

## Frontend Environment Variables

File: `quikadmin-web/.env`

### API Configuration

| Variable       | Required | Default | Description          |
| -------------- | -------- | ------- | -------------------- |
| `VITE_API_URL` | Yes      | -       | Backend API base URL |

**Example**:

```env
VITE_API_URL="http://localhost:3002/api"
```

---

### Supabase Configuration (Frontend)

| Variable                 | Required | Default | Description            |
| ------------------------ | -------- | ------- | ---------------------- |
| `VITE_SUPABASE_URL`      | Yes      | -       | Supabase project URL   |
| `VITE_SUPABASE_ANON_KEY` | Yes      | -       | Supabase anonymous key |

**Example**:

```env
VITE_SUPABASE_URL="https://abcdefghijklmnop.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### Feature Flags

| Variable                | Required | Default | Description                    |
| ----------------------- | -------- | ------- | ------------------------------ |
| `VITE_ENABLE_DEMO`      | No       | `true`  | Enable demo credentials button |
| `VITE_ENABLE_ANALYTICS` | No       | `false` | Enable analytics tracking      |

**Example**:

```env
VITE_ENABLE_DEMO="true"
VITE_ENABLE_ANALYTICS="false"
```

---

## Environment File Templates

### Backend Template

```env
# Server
NODE_ENV=development
PORT=3002

# Database (Neon)
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"

# Supabase
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# JWT
JWT_SECRET="minimum-32-character-secret-key-here"

# Redis (optional)
REDIS_URL="redis://localhost:6379"

# Logging
LOG_LEVEL="info"
```

### Frontend Template

```env
# API
VITE_API_URL=http://localhost:3002/api

# Supabase
VITE_SUPABASE_URL="https://xxx.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJ..."

# Features
VITE_ENABLE_DEMO=true
```

---

## Production Considerations

### Security Best Practices

1. **Never commit `.env` files** - Add to `.gitignore`
2. **Use strong secrets** - Generate with `openssl rand -base64 32`
3. **Rotate secrets regularly** - Change JWT_SECRET periodically
4. **Use separate keys per environment** - Different secrets for dev/prod

### Cloud Deployment

**Vercel/Netlify** (Frontend):

- Add variables in project settings
- Prefix with `VITE_` for Vite projects

**Railway/Render** (Backend):

- Add variables in service settings
- No prefix needed

**Docker**:

```yaml
environment:
  - NODE_ENV=production
  - DATABASE_URL=${DATABASE_URL}
```

---

## Validation

The backend validates all required environment variables on startup with detailed error messages.

**Validated Variables**:

| Variable                    | Required | Validation                              |
| --------------------------- | -------- | --------------------------------------- |
| `DATABASE_URL`              | Yes      | Must be valid PostgreSQL connection URL |
| `JWT_SECRET`                | Yes      | Min 64 chars in production              |
| `JWT_REFRESH_SECRET`        | Yes      | Min 64 chars in production              |
| `SUPABASE_URL`              | Yes      | Must be present                         |
| `SUPABASE_ANON_KEY`         | Yes      | Must be present                         |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | Must be present                         |

**Example Error Output**:

```
❌ Configuration Errors:

   SUPABASE_SERVICE_ROLE_KEY
     Message: Supabase service role key is required for admin operations
     Source:  quikadmin/.env
     Fix:     Get from Supabase Dashboard > Project Settings > API (Keep secret!)

────────────────────────────────────────────────────────────

📁 Environment Variable Sources:
   • Root .env        → AI tool keys only (TaskMaster, Claude)
   • quikadmin/.env   → All backend config (DB, Auth, Supabase)
   • quikadmin-web/.env → Frontend VITE_* vars only
```

**Code Location**: `quikadmin/src/config/index.ts` → `validateConfig()`

---

## Related Documentation

- [Local Setup](../../how-to/development/local-setup.md)
- [Database Setup](../../how-to/development/database-setup.md)
- [Docker Deployment](../../how-to/deployment/docker-deployment.md)
- [Render Deployment](../../how-to/deployment/render-deployment.md)
- [Upstash Redis Setup](../../how-to/deployment/upstash-redis-setup.md)
- [Deployment Troubleshooting](../../how-to/troubleshooting/deployment-issues.md)
