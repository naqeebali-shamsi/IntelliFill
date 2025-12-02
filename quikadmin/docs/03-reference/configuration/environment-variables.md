---
title: Environment Variables Reference
category: reference
status: active
last_updated: 2025-11-11
---

# Environment Variables Reference

Complete reference for all environment variables used in QuikAdmin.

## Overview

QuikAdmin uses environment variables for configuration management. Variables are loaded from `.env` files and validated using type-safe configuration.

## Configuration File

**Location:** `.env` (root directory)

**Example:**
```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname"
DIRECT_URL="postgresql://user:password@host:5432/dbname"

# Authentication
JWT_SECRET="your-jwt-secret-key"
SESSION_SECRET="your-session-secret-key"

# Redis
REDIS_URL="redis://localhost:6379"

# Application
NODE_ENV="development"
PORT="3001"
```

## Database Variables

### DATABASE_URL
- **Type:** Connection String
- **Required:** Yes
- **Description:** PostgreSQL connection string for Prisma
- **Format:** `postgresql://[user]:[password]@[host]:[port]/[database]`
- **Example:** `postgresql://admin:pass123@localhost:5432/quikadmin`
- **Note:** For Neon, use the pooled connection string

### DIRECT_URL
- **Type:** Connection String
- **Required:** Yes (for migrations)
- **Description:** Direct PostgreSQL connection for migrations
- **Format:** Same as DATABASE_URL
- **Example:** `postgresql://admin:pass123@localhost:5432/quikadmin`
- **Note:** For Neon, use the direct (non-pooled) connection string

## Authentication Variables

### JWT_SECRET
- **Type:** String
- **Required:** Yes
- **Description:** Secret key for JWT token signing
- **Length:** Minimum 32 characters recommended
- **Example:** `your-super-secret-jwt-key-change-in-production`
- **Security:** Generate using `openssl rand -base64 32`

### SESSION_SECRET
- **Type:** String
- **Required:** Yes
- **Description:** Secret key for session encryption
- **Length:** Minimum 32 characters recommended
- **Example:** `your-super-secret-session-key-change-in-production`
- **Security:** Generate using `openssl rand -base64 32`

### SUPABASE_URL
- **Type:** URL
- **Required:** No (if using Supabase auth)
- **Description:** Supabase project URL
- **Example:** `https://your-project.supabase.co`

### SUPABASE_ANON_KEY
- **Type:** String
- **Required:** No (if using Supabase auth)
- **Description:** Supabase anonymous public key
- **Example:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### SUPABASE_SERVICE_ROLE_KEY
- **Type:** String
- **Required:** No (if using Supabase auth)
- **Description:** Supabase service role key (server-side only)
- **Example:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Security:** Keep this secret, never expose to client

## Redis Variables

### REDIS_URL
- **Type:** Connection String
- **Required:** No (optional for caching)
- **Description:** Redis connection string
- **Format:** `redis://[user]:[password]@[host]:[port]`
- **Example:** `redis://localhost:6379`
- **Cloud Example:** `redis://default:password@redis.upstash.io:6379`

### REDIS_HOST
- **Type:** String
- **Required:** No (alternative to REDIS_URL)
- **Description:** Redis server hostname
- **Default:** `localhost`

### REDIS_PORT
- **Type:** Number
- **Required:** No (alternative to REDIS_URL)
- **Description:** Redis server port
- **Default:** `6379`

### REDIS_PASSWORD
- **Type:** String
- **Required:** No
- **Description:** Redis authentication password
- **Default:** None (no auth)

## Application Variables

### NODE_ENV
- **Type:** Enum
- **Required:** No
- **Values:** `development`, `production`, `test`
- **Default:** `development`
- **Description:** Application environment mode
- **Effects:**
  - Controls logging verbosity
  - Enables/disables debugging
  - Affects error responses

### PORT
- **Type:** Number
- **Required:** No
- **Default:** `3001`
- **Description:** Port for backend API server
- **Range:** 1024-65535

### FRONTEND_PORT
- **Type:** Number
- **Required:** No
- **Default:** `3000`
- **Description:** Port for frontend development server
- **Range:** 1024-65535

### CORS_ORIGIN
- **Type:** String (URL or comma-separated)
- **Required:** No
- **Default:** `http://localhost:3000`
- **Description:** Allowed CORS origins
- **Example:** `http://localhost:3000,https://app.example.com`

## API Integration Variables

### OPENAI_API_KEY
- **Type:** String
- **Required:** No (if using AI features)
- **Description:** OpenAI API key for AI services
- **Example:** `sk-...`
- **Security:** Keep secret, never commit to version control

### STRIPE_SECRET_KEY
- **Type:** String
- **Required:** No (if using payments)
- **Description:** Stripe secret key for payment processing
- **Example:** `sk_test_...` or `sk_live_...`
- **Security:** Keep secret, use test keys in development

### STRIPE_WEBHOOK_SECRET
- **Type:** String
- **Required:** No (if using Stripe webhooks)
- **Description:** Stripe webhook signing secret
- **Example:** `whsec_...`

## Feature Flags

### ENABLE_REGISTRATION
- **Type:** Boolean
- **Required:** No
- **Default:** `true`
- **Values:** `true`, `false`
- **Description:** Enable/disable user registration

### ENABLE_EMAIL_VERIFICATION
- **Type:** Boolean
- **Required:** No
- **Default:** `false`
- **Values:** `true`, `false`
- **Description:** Require email verification for new users

### ENABLE_TWO_FACTOR
- **Type:** Boolean
- **Required:** No
- **Default:** `false`
- **Values:** `true`, `false`
- **Description:** Enable two-factor authentication

## Email Variables

### SMTP_HOST
- **Type:** String
- **Required:** No (if using email)
- **Description:** SMTP server hostname
- **Example:** `smtp.gmail.com`

### SMTP_PORT
- **Type:** Number
- **Required:** No (if using email)
- **Description:** SMTP server port
- **Common Values:** `587` (TLS), `465` (SSL), `25` (unsecured)

### SMTP_USER
- **Type:** String
- **Required:** No (if using email)
- **Description:** SMTP authentication username
- **Example:** `your-email@gmail.com`

### SMTP_PASSWORD
- **Type:** String
- **Required:** No (if using email)
- **Description:** SMTP authentication password
- **Security:** Use app-specific passwords for Gmail

### EMAIL_FROM
- **Type:** Email Address
- **Required:** No (if using email)
- **Description:** Default sender email address
- **Example:** `noreply@quikadmin.com`

## Logging Variables

### LOG_LEVEL
- **Type:** Enum
- **Required:** No
- **Values:** `error`, `warn`, `info`, `debug`, `trace`
- **Default:** `info` (production), `debug` (development)
- **Description:** Logging verbosity level

### LOG_FORMAT
- **Type:** Enum
- **Required:** No
- **Values:** `json`, `pretty`
- **Default:** `json` (production), `pretty` (development)
- **Description:** Log output format

## Security Best Practices

### Generating Secrets
Use cryptographically secure random strings:

```bash
# Generate JWT_SECRET
openssl rand -base64 32

# Generate SESSION_SECRET
openssl rand -hex 32

# Generate random password
openssl rand -base64 24
```

### Environment-Specific Files

**Development:**
- Use `.env.development` for development settings
- Include example values in `.env.example`
- Never commit `.env` files

**Production:**
- Use environment variables directly (not `.env` files)
- Use secret management services (AWS Secrets Manager, HashiCorp Vault)
- Rotate secrets regularly

### Validation

QuikAdmin validates environment variables on startup using:
- `src/config/index.ts` - Type-safe configuration loader
- Zod schemas for runtime validation
- Fails fast on missing or invalid variables

## Common Configurations

### Local Development
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/quikadmin"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/quikadmin"
JWT_SECRET="dev-jwt-secret-change-in-production"
SESSION_SECRET="dev-session-secret-change-in-production"
NODE_ENV="development"
PORT="3001"
CORS_ORIGIN="http://localhost:3000"
```

### Neon Database (Cloud)
```env
DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require&connect_timeout=10"
```

### Production
```env
DATABASE_URL="postgresql://..."
JWT_SECRET="<generate-with-openssl>"
SESSION_SECRET="<generate-with-openssl>"
NODE_ENV="production"
PORT="3001"
CORS_ORIGIN="https://app.yourcompany.com"
LOG_LEVEL="warn"
LOG_FORMAT="json"
```

## Troubleshooting

### Missing Variables
**Error:** `Configuration validation failed: Missing required variable`

**Solution:**
1. Check `.env` file exists in project root
2. Verify variable name spelling
3. Ensure no extra spaces around `=`
4. Restart the application

### Database Connection Issues
**Error:** `Connection refused` or `timeout`

**Solution:**
1. Verify `DATABASE_URL` format
2. Check database server is running
3. Confirm firewall allows connection
4. Test connection with `psql`

### JWT Errors
**Error:** `Invalid token` or `Token verification failed`

**Solution:**
1. Ensure `JWT_SECRET` is set and consistent
2. Check token hasn't expired
3. Verify no leading/trailing spaces in secret

## Related Documentation

- [Configuration Overview](./README.md)
- [Security Architecture](../../01-current-state/architecture/security.md)
- [Deployment Guide](../../deployment/platforms/README.md)
- [Infrastructure Setup](../../deployment/infrastructure/overview.md)

---

**Last Updated:** 2025-11-11
**Maintained By:** Development Team

