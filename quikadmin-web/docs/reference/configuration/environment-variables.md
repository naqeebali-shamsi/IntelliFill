# Environment Variables

Complete reference for configuring QuikAdmin Web through environment variables.

## Overview

QuikAdmin Web uses environment variables for configuration. Variables must be prefixed with `VITE_` to be accessible in the browser.

**Files:**
- `.env.example` - Template with all variables (committed to git)
- `.env` - Your local configuration (gitignored)
- `.env.local` - Local overrides (gitignored)
- `.env.production` - Production configuration

## Quick Setup

```bash
# Copy template
cp .env.example .env

# Edit with your values
nano .env  # or your preferred editor
```

## Required Variables

### API Configuration

#### `VITE_API_URL`
- **Type**: String (URL)
- **Required**: Yes
- **Description**: Backend API base URL
- **Example**: `http://localhost:3000/api`
- **Production**: `https://api.yourdomain.com/api`

```env
# Development
VITE_API_URL=http://localhost:3000/api

# Production
VITE_API_URL=https://api.quikadmin.com/api
```

### Supabase Configuration

#### `VITE_SUPABASE_URL`
- **Type**: String (URL)
- **Required**: Yes (if using Supabase)
- **Description**: Your Supabase project URL
- **Example**: `https://your-project.supabase.co`
- **Where to find**: Supabase Dashboard > Settings > API

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
```

#### `VITE_SUPABASE_ANON_KEY`
- **Type**: String (JWT)
- **Required**: Yes (if using Supabase)
- **Description**: Supabase anonymous/public key
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to find**: Supabase Dashboard > Settings > API
- **Security**: Safe for frontend (public key)

```env
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**WARNING:** Never use the `service_role` key on the frontend!

## Optional Variables

### Feature Flags

#### `VITE_ENABLE_ANALYTICS`
- **Type**: Boolean
- **Default**: `false`
- **Description**: Enable analytics tracking

```env
VITE_ENABLE_ANALYTICS=true
```

#### `VITE_ENABLE_DEBUG`
- **Type**: Boolean
- **Default**: `false` (production), `true` (development)
- **Description**: Enable debug logging

```env
VITE_ENABLE_DEBUG=true
```

### API Configuration

#### `VITE_API_TIMEOUT`
- **Type**: Number (milliseconds)
- **Default**: `30000` (30 seconds)
- **Description**: API request timeout

```env
VITE_API_TIMEOUT=60000
```

#### `VITE_WEBSOCKET_URL`
- **Type**: String (URL)
- **Default**: Derived from `VITE_API_URL`
- **Description**: WebSocket connection URL

```env
VITE_WEBSOCKET_URL=ws://localhost:3000/socket
```

### Upload Configuration

#### `VITE_MAX_FILE_SIZE`
- **Type**: Number (bytes)
- **Default**: `10485760` (10MB)
- **Description**: Maximum file upload size

```env
VITE_MAX_FILE_SIZE=20971520  # 20MB
```

#### `VITE_MAX_FILES`
- **Type**: Number
- **Default**: `10`
- **Description**: Maximum files per upload

```env
VITE_MAX_FILES=20
```

#### `VITE_ALLOWED_FILE_TYPES`
- **Type**: String (comma-separated)
- **Default**: `pdf,doc,docx,xls,xlsx`
- **Description**: Allowed file extensions

```env
VITE_ALLOWED_FILE_TYPES=pdf,doc,docx,xls,xlsx,png,jpg
```

### UI Configuration

#### `VITE_APP_NAME`
- **Type**: String
- **Default**: `QuikAdmin`
- **Description**: Application name

```env
VITE_APP_NAME=IntelliFill
```

#### `VITE_DEFAULT_THEME`
- **Type**: String (`light` | `dark` | `system`)
- **Default**: `system`
- **Description**: Default theme

```env
VITE_DEFAULT_THEME=dark
```

### External Services

#### `VITE_SENTRY_DSN`
- **Type**: String (URL)
- **Optional**: Yes
- **Description**: Sentry error tracking DSN

```env
VITE_SENTRY_DSN=https://your-key@sentry.io/project-id
```

#### `VITE_GOOGLE_ANALYTICS_ID`
- **Type**: String
- **Optional**: Yes
- **Description**: Google Analytics tracking ID

```env
VITE_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
```

## Complete .env Template

```env
# ============================================
# QuikAdmin Web - Environment Configuration
# ============================================

# --------------------------------------------
# API Configuration (Required)
# --------------------------------------------
VITE_API_URL=http://localhost:3000/api

# --------------------------------------------
# Supabase Configuration (Required)
# --------------------------------------------
# Get these from: https://app.supabase.com
# Your Project > Settings > API
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# --------------------------------------------
# Feature Flags (Optional)
# --------------------------------------------
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG=true

# --------------------------------------------
# API Settings (Optional)
# --------------------------------------------
VITE_API_TIMEOUT=30000
VITE_WEBSOCKET_URL=ws://localhost:3000/socket

# --------------------------------------------
# Upload Configuration (Optional)
# --------------------------------------------
VITE_MAX_FILE_SIZE=10485760
VITE_MAX_FILES=10
VITE_ALLOWED_FILE_TYPES=pdf,doc,docx,xls,xlsx

# --------------------------------------------
# UI Configuration (Optional)
# --------------------------------------------
VITE_APP_NAME=QuikAdmin
VITE_DEFAULT_THEME=system

# --------------------------------------------
# External Services (Optional)
# --------------------------------------------
# VITE_SENTRY_DSN=
# VITE_GOOGLE_ANALYTICS_ID=
```

## Usage in Code

### Accessing Variables

```typescript
// Vite exposes env vars through import.meta.env
const apiUrl = import.meta.env.VITE_API_URL
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

// Built-in Vite variables
const isDev = import.meta.env.DEV
const isProd = import.meta.env.PROD
const mode = import.meta.env.MODE  // 'development' | 'production'
```

### Type Safety

Create `src/vite-env.d.ts`:

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_ENABLE_ANALYTICS?: string
  readonly VITE_ENABLE_DEBUG?: string
  // Add other variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

### Environment Helper

```typescript
// src/utils/env.ts
export const env = {
  apiUrl: import.meta.env.VITE_API_URL,
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  },
  features: {
    analytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    debug: import.meta.env.VITE_ENABLE_DEBUG === 'true',
  },
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const

// Usage:
import { env } from '@/utils/env'
console.log(env.apiUrl)
```

## Environment-Specific Configuration

### Development (.env.development)

```env
VITE_API_URL=http://localhost:3000/api
VITE_ENABLE_DEBUG=true
VITE_WEBSOCKET_URL=ws://localhost:3000/socket
```

### Production (.env.production)

```env
VITE_API_URL=https://api.quikadmin.com/api
VITE_ENABLE_DEBUG=false
VITE_ENABLE_ANALYTICS=true
VITE_WEBSOCKET_URL=wss://api.quikadmin.com/socket
```

### Local Overrides (.env.local)

```env
# Override for local development
VITE_API_URL=http://192.168.1.100:3000/api
```

**Precedence**: `.env.local` > `.env.[mode]` > `.env`

## Security Best Practices

### DO:
- Use `VITE_` prefix for frontend variables
- Commit `.env.example` to git
- Use Supabase `anon` key (public key)
- Rotate keys regularly
- Use different keys per environment

### DON'T:
- Commit `.env` or `.env.local` to git
- Use `service_role` key in frontend
- Store secrets in frontend env vars
- Share production keys in chat/email
- Use production keys in development

### Gitignore Configuration

Ensure `.gitignore` includes:

```gitignore
# Environment variables
.env
.env.local
.env.*.local

# Keep template
!.env.example
```

## Troubleshooting

### Variable Not Loading

**Problem:** Variable undefined in code

**Solutions:**
```bash
# 1. Check variable name starts with VITE_
# ❌ Bad
API_URL=http://localhost:3000

# ✅ Good
VITE_API_URL=http://localhost:3000

# 2. Restart dev server (required after .env changes)
# Ctrl+C, then:
bun run dev

# 3. Check file name is exactly .env (not .env.txt)
ls -la | grep .env

# 4. Verify variable in browser console
console.log(import.meta.env.VITE_API_URL)
```

### Wrong Environment Used

**Problem:** Development config used in production

**Solution:**
```bash
# Explicitly set mode
bun run build --mode production

# Or create .env.production
# Vite automatically loads .env.production when building
```

### Type Errors

**Problem:** TypeScript errors with env variables

**Solution:**
```typescript
// Update src/vite-env.d.ts with all variables
interface ImportMetaEnv {
  readonly VITE_MY_NEW_VAR: string
}
```

## Validation

### Runtime Validation

```typescript
// src/utils/validateEnv.ts
export function validateEnv() {
  const required = [
    'VITE_API_URL',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
  ]

  const missing = required.filter(
    (key) => !import.meta.env[key]
  )

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file.'
    )
  }
}

// In src/main.tsx
validateEnv()
```

## Deployment

### Vercel

Set environment variables in Vercel Dashboard:
1. Project Settings > Environment Variables
2. Add variables (without `VITE_` showing in dashboard)
3. Select environments (Production, Preview, Development)
4. Save and redeploy

### Netlify

```toml
# netlify.toml
[build.environment]
  VITE_API_URL = "https://api.quikadmin.com/api"
  VITE_SUPABASE_URL = "https://project.supabase.co"
```

Or use Netlify UI: Site Settings > Environment Variables

### Docker

```dockerfile
# Dockerfile
ARG VITE_API_URL
ARG VITE_SUPABASE_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
```

```bash
# docker-compose.yml
environment:
  - VITE_API_URL=${VITE_API_URL}
  - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
```

## Related Documentation

- [Installation Guide](../../getting-started/installation.md)
- [Configuration Reference](./README.md)
- [Deployment Guide](../../deployment/README.md)
- [Security Best Practices](../../development/standards/README.md)

---

[Back to Reference](../README.md) | [Back to Configuration](./README.md)
