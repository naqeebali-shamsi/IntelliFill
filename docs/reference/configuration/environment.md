---
title: Environment Variables
description: Complete reference for all IntelliFill environment variables
category: reference
tags: [configuration, environment, settings]
lastUpdated: 2025-11-25
---

# Environment Variables

Complete reference for all environment variables used by IntelliFill.

---

## Backend Environment Variables

File: `quikadmin/.env`

### Server Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment mode: `development`, `production`, `test` |
| `PORT` | No | `3002` | HTTP server port |
| `HOST` | No | `0.0.0.0` | Server host binding |

**Example**:
```env
NODE_ENV=development
PORT=3002
```

---

### Database Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string (pooled) |
| `DIRECT_URL` | Yes | - | PostgreSQL direct connection (migrations) |

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

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | Yes | - | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | - | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | - | Supabase service role key (backend only) |

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

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | - | Secret key for signing JWTs (min 32 chars) |
| `JWT_EXPIRY` | No | `7d` | Token expiration time |
| `JWT_REFRESH_SECRET` | No | - | Secret for refresh tokens |

**Example**:
```env
JWT_SECRET="your-super-secret-key-minimum-32-characters-long"
JWT_EXPIRY="7d"
JWT_REFRESH_SECRET="your-refresh-secret-key-minimum-32-chars"
```

---

### Redis Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | - | Redis connection URL |

**Example**:
```env
REDIS_URL="redis://localhost:6379"
REDIS_URL="redis://user:password@redis-host:6379"
```

**Note**: If not configured, the application falls back to in-memory rate limiting.

---

### File Upload Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `UPLOAD_MAX_SIZE` | No | `10485760` | Max file size in bytes (10MB) |
| `UPLOAD_DIR` | No | `./uploads` | Upload directory path |
| `ALLOWED_MIME_TYPES` | No | - | Comma-separated MIME types |

**Example**:
```env
UPLOAD_MAX_SIZE=10485760
UPLOAD_DIR="./uploads"
ALLOWED_MIME_TYPES="application/pdf,image/png,image/jpeg"
```

---

### OCR Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OCR_LANGUAGE` | No | `eng` | Tesseract language code |
| `OCR_WORKERS` | No | `4` | Number of OCR worker threads |

**Example**:
```env
OCR_LANGUAGE="eng+spa"
OCR_WORKERS=4
```

---

### Logging Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LOG_LEVEL` | No | `info` | Log level: `error`, `warn`, `info`, `debug` |
| `LOG_FORMAT` | No | `json` | Log format: `json`, `simple` |
| `LOG_DIR` | No | `./logs` | Log files directory |

**Example**:
```env
LOG_LEVEL="debug"
LOG_FORMAT="simple"
LOG_DIR="./logs"
```

---

## Frontend Environment Variables

File: `quikadmin-web/.env`

### API Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | Yes | - | Backend API base URL |

**Example**:
```env
VITE_API_URL="http://localhost:3002/api"
```

---

### Supabase Configuration (Frontend)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_SUPABASE_URL` | Yes | - | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | - | Supabase anonymous key |

**Example**:
```env
VITE_SUPABASE_URL="https://abcdefghijklmnop.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### Feature Flags

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_ENABLE_DEMO` | No | `true` | Enable demo credentials button |
| `VITE_ENABLE_ANALYTICS` | No | `false` | Enable analytics tracking |

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

The backend validates required environment variables on startup:

```typescript
// src/config/index.ts
const required = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'JWT_SECRET'
];

required.forEach(key => {
  if (!process.env[key]) {
    throw new Error(`Missing required env: ${key}`);
  }
});
```

---

## Related Documentation

- [Local Setup](../../how-to/development/local-setup.md)
- [Database Setup](../../how-to/development/database-setup.md)
- [Docker Deployment](../../how-to/deployment/docker-deployment.md)

