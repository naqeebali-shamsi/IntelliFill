---
title: Security Model
description: How security works in IntelliFill
category: explanation
tags: [security, authentication, authorization, rls, audit, jwt-rotation, compliance]
lastUpdated: 2026-01-04
---

# Security Model

This document explains how security is implemented in IntelliFill, covering authentication, authorization, and data protection.

---

## Security Overview

IntelliFill implements a defense-in-depth security model with multiple layers:

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   Rate Limiting                      │    │
│  │  ┌───────────────────────────────────────────────┐  │    │
│  │  │              Input Validation                  │  │    │
│  │  │  ┌─────────────────────────────────────────┐  │  │    │
│  │  │  │           Authentication                 │  │  │    │
│  │  │  │  ┌───────────────────────────────────┐  │  │  │    │
│  │  │  │  │        Authorization              │  │  │  │    │
│  │  │  │  │  ┌─────────────────────────────┐  │  │  │  │    │
│  │  │  │  │  │    Protected Resources      │  │  │  │  │    │
│  │  │  │  │  └─────────────────────────────┘  │  │  │  │    │
│  │  │  │  └───────────────────────────────────┘  │  │  │    │
│  │  │  └─────────────────────────────────────────┘  │  │    │
│  │  └───────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Authentication

### How It Works

IntelliFill uses Supabase Auth for authentication, providing:

1. **Email/password authentication**
2. **JWT tokens** for session management
3. **Secure token storage** via httpOnly cookies
4. **Automatic token refresh**

### Authentication Flow

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Client  │         │  Backend │         │ Supabase │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │
     │ 1. Login Request   │                    │
     │───────────────────▶│                    │
     │                    │ 2. Verify Creds    │
     │                    │───────────────────▶│
     │                    │                    │
     │                    │ 3. Return JWT      │
     │                    │◀───────────────────│
     │ 4. Set Cookie      │                    │
     │◀───────────────────│                    │
     │                    │                    │
     │ 5. API Request     │                    │
     │   (with cookie)    │                    │
     │───────────────────▶│                    │
     │                    │ 6. Validate JWT    │
     │                    │───────────────────▶│
     │                    │ 7. User Info       │
     │                    │◀───────────────────│
     │ 8. Response        │                    │
     │◀───────────────────│                    │
```

### Token Management

**Access tokens**:

- Short-lived (1 hour default)
- Stored in httpOnly cookie
- Automatically refreshed

**Refresh tokens**:

- Long-lived (7 days default)
- Used to obtain new access tokens
- Revoked on logout

### Password Security

- **Minimum length**: 8 characters
- **Hashing**: bcrypt via Supabase
- **Rate limiting**: Prevents brute force
- **Reset flow**: Secure email-based reset

---

## Authorization

### Role-Based Access Control

IntelliFill uses a simple RBAC model:

| Role    | Permissions                           |
| ------- | ------------------------------------- |
| `user`  | CRUD own documents, profile           |
| `admin` | All user permissions + admin features |

### Resource Ownership

Users can only access resources they own:

```typescript
// Middleware checks ownership
async function checkOwnership(req, res, next) {
  const document = await prisma.document.findUnique({
    where: { id: req.params.id },
  });

  if (document.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}
```

### Endpoint Protection

All sensitive endpoints require authentication:

```typescript
// Protected route
router.get('/documents', authMiddleware, async (req, res) => {
  const documents = await prisma.document.findMany({
    where: { userId: req.user.id }, // Only user's documents
  });
  res.json(documents);
});
```

---

## Input Validation

### Server-Side Validation

All inputs are validated before processing:

```typescript
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

router.post('/login', async (req, res) => {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues,
    });
  }

  // Proceed with validated data
});
```

### Validation Rules

| Input Type  | Validation                 |
| ----------- | -------------------------- |
| Email       | Valid email format         |
| Password    | Min 8 chars, complexity    |
| File upload | Type, size limits          |
| IDs         | UUID format                |
| Pagination  | Numeric, reasonable limits |

### SQL Injection Prevention

Prisma uses parameterized queries:

```typescript
// Safe - parameterized
const user = await prisma.user.findUnique({
  where: { email: userInput },
});

// Never do raw queries with user input
// ❌ prisma.$queryRaw`SELECT * FROM users WHERE email = ${userInput}`
```

---

## Supabase Row-Level Security (RLS)

### How It Works

IntelliFill uses Supabase Row-Level Security for database-level access control. The RLS context is set per-request via the `supabaseAuth.ts` middleware.

### RLS Context Flow

```
┌──────────┐         ┌──────────────────┐         ┌──────────────┐
│  Client  │         │   supabaseAuth   │         │   Database   │
│ Request  │────────▶│   Middleware     │────────▶│  (with RLS)  │
└──────────┘         └──────────────────┘         └──────────────┘
                            │
                            ▼
                     Sets RLS context:
                     - request.jwt.claims
                     - request.jwt.claim.sub (user ID)
```

### Error Handling

RLS setup errors are logged at ERROR level with full context:

```typescript
// Logged fields on RLS failure:
{
  userId: string,
  error: string,
  stack: string,
  endpoint: string
}
```

### Production Hardening (RLS_FAIL_CLOSED)

For production environments, enable fail-closed behavior:

```env
RLS_FAIL_CLOSED=true
```

When enabled:

- RLS setup failures reject the request with 500 error
- Prevents potential data access without proper RLS context
- Recommended for production deployments

When disabled (default):

- RLS setup failures log error but continue
- Request proceeds with limited/no RLS protection
- Suitable for development only

### Request Tracking

The middleware sets `req.rlsContextSet` flag:

- `true`: RLS context successfully established
- `false`/undefined: RLS context failed or not set

Services can check this flag for additional validation.

---

## Audit Logging

### Global Audit Middleware

All `/api/` routes are monitored by `createAuditMiddleware`:

```typescript
// Registered in index.ts
app.use(
  '/api',
  createAuditMiddleware({
    logRequestBody: true,
    excludePaths: ['/health', '/metrics', '/docs'],
  })
);
```

### What Gets Logged

| Field        | Description                          |
| ------------ | ------------------------------------ |
| `method`     | HTTP method (GET, POST, etc.)        |
| `path`       | Request path                         |
| `userId`     | Authenticated user ID (if available) |
| `ip`         | Client IP address                    |
| `userAgent`  | Client user agent                    |
| `statusCode` | Response status code                 |
| `duration`   | Request duration in ms               |
| `body`       | Request body (sanitized)             |

### Excluded Endpoints

These paths are not audited:

- `/health` - Health checks
- `/metrics` - Prometheus metrics
- `/docs` - API documentation

---

## Rate Limiting

### Implementation

Rate limiting prevents abuse:

```typescript
import rateLimit from 'express-rate-limit';

// General API limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too many requests' },
});

// Strict limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: { error: 'Too many login attempts' },
});
```

### Rate Limits

| Endpoint       | Limit | Window     |
| -------------- | ----- | ---------- |
| General API    | 100   | 1 minute   |
| Auth endpoints | 5     | 15 minutes |
| File uploads   | 10    | 1 minute   |

---

## Data Protection

### In Transit

- **HTTPS**: Enforced in production
- **TLS 1.2+**: Minimum version
- **HSTS**: Strict Transport Security headers

### At Rest

- **Database encryption**: Neon encrypts at rest
- **File storage**: Encrypted volumes
- **Secrets**: Environment variables only

### Sensitive Data Handling

```typescript
// Never log sensitive data
logger.info('Login attempt', { email: user.email });
// NOT: { password: user.password }

// Mask sensitive fields in responses
const userResponse = {
  id: user.id,
  email: user.email,
  // Never include password hash
};
```

---

## Security Headers

Helmet.js configures security headers:

```typescript
import helmet from 'helmet';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);
```

### Headers Applied

| Header                    | Purpose               |
| ------------------------- | --------------------- |
| Content-Security-Policy   | Prevent XSS           |
| X-Frame-Options           | Prevent clickjacking  |
| X-Content-Type-Options    | Prevent MIME sniffing |
| Strict-Transport-Security | Enforce HTTPS         |
| Referrer-Policy           | Control referrer info |

---

## CORS Configuration

```typescript
import cors from 'cors';

app.use(
  cors({
    origin: ['http://localhost:8080', 'http://localhost:5173', 'https://intellifill.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
```

---

## File Upload Security

### Validation

```typescript
const uploadConfig = {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
};
```

### File Storage

- Files stored outside web root
- Random filenames (UUID)
- No directory traversal possible
- Virus scanning (future)

---

## Security Checklist

### Development

- [ ] No secrets in code
- [ ] Environment variables for config
- [ ] Input validation on all endpoints
- [ ] Authentication required for protected routes
- [ ] Rate limiting enabled

### Deployment

- [ ] HTTPS enabled
- [ ] Security headers configured
- [ ] Database credentials rotated
- [ ] Logging enabled (no sensitive data)
- [ ] Error messages don't leak info

### Ongoing

- [ ] Dependencies updated regularly
- [ ] Security patches applied
- [ ] Access logs reviewed
- [ ] Failed login attempts monitored

---

## Incident Response

### If Credentials Compromised

1. Rotate affected secrets immediately
2. Invalidate all active sessions
3. Notify affected users
4. Audit access logs
5. Document and review

### If Data Breach Suspected

1. Isolate affected systems
2. Preserve evidence
3. Assess scope
4. Notify as required by law
5. Remediate and prevent

---

## JWT Secrets Rotation (Zero-Downtime)

IntelliFill implements dual-key JWT verification for zero-downtime secret rotation (Task 283).

### How Dual-Key Rotation Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                    JWT Verification Flow                             │
│                                                                      │
│   Token → Try PRIMARY_SECRET → Success? → Return payload             │
│                    │                                                 │
│                    └─ Signature Error + OLD_SECRET exists?           │
│                                    │                                 │
│                                    └─ Try OLD_SECRET                 │
│                                            │                         │
│                                Success → Return payload (log usage)  │
│                                Failure → Reject token                │
└─────────────────────────────────────────────────────────────────────┘
```

### Rotation Procedure

**Pre-Rotation Checklist:**

- [ ] New secrets generated (`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
- [ ] Access to deployment environment
- [ ] Monitoring dashboards accessible
- [ ] Off-peak hours selected

**Step-by-Step Rotation:**

1. **Generate new secrets:**

   ```bash
   # Access token secret
   node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

   # Refresh token secret
   node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
   ```

2. **Copy current secrets to OLD variables:**

   ```bash
   # In your deployment environment (Render, Vercel, etc.)
   # Copy current JWT_SECRET value to JWT_SECRET_OLD
   # Copy current JWT_REFRESH_SECRET to JWT_REFRESH_SECRET_OLD
   ```

3. **Set new primary secrets:**

   ```bash
   # Replace JWT_SECRET with newly generated value
   # Replace JWT_REFRESH_SECRET with newly generated value
   ```

4. **Deploy and monitor:**
   - Deploy with all four secrets set
   - Monitor Security Dashboard for tokens using old secrets
   - Check `/api/admin/security/metrics` for `jwtRotationActive: true`

5. **Remove old secrets after grace period:**
   - Wait for refresh token TTL (7 days default)
   - Verify no tokens still using old secrets via logs
   - Remove `JWT_SECRET_OLD` and `JWT_REFRESH_SECRET_OLD`

**Environment Variables:**

| Variable                 | Purpose                                 | Required |
| ------------------------ | --------------------------------------- | -------- |
| `JWT_SECRET`             | Primary access token signing secret     | Yes      |
| `JWT_SECRET_OLD`         | Previous access secret (rotation only)  | No       |
| `JWT_REFRESH_SECRET`     | Primary refresh token signing secret    | Yes      |
| `JWT_REFRESH_SECRET_OLD` | Previous refresh secret (rotation only) | No       |

### Monitoring Rotation Progress

Check the Security Dashboard API:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.intellifill.com/api/admin/security/metrics
```

Response includes:

```json
{
  "systemStatus": {
    "jwtRotationActive": true,
    "accessSecretRotating": true,
    "refreshSecretRotating": true
  }
}
```

Watch logs for:

```
[JWT] Token verified using old secret (rotation in progress)
[TokenFamily] Token verified using old secret (rotation in progress)
```

---

## HSTS Configuration

### Production Settings

HTTP Strict Transport Security enforces HTTPS:

```typescript
// Production: 1 year with preload
res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
```

| Directive           | Value             | Purpose                             |
| ------------------- | ----------------- | ----------------------------------- |
| `max-age`           | 31536000 (1 year) | Browser remembers HTTPS requirement |
| `includeSubDomains` | Yes               | Applies to all subdomains           |
| `preload`           | Yes               | Eligible for browser preload lists  |

### Local Development

HSTS is **disabled by default** in development to avoid certificate issues.

**To enable HSTS in development:**

1. Set up local HTTPS (mkcert recommended):

   ```bash
   # Install mkcert
   brew install mkcert   # macOS
   choco install mkcert  # Windows

   # Create local CA and certificates
   mkcert -install
   mkcert localhost 127.0.0.1 ::1
   ```

2. Configure environment:

   ```env
   # quikadmin/.env
   ENABLE_HSTS_DEV=true
   ```

3. HSTS will use 1-hour max-age for development:
   ```
   Strict-Transport-Security: max-age=3600
   ```

**IMPORTANT:** Never commit development certificates to version control.

---

## Security Events Reference

All security events are logged via `SecurityEventService` and stored in the `AuditLog` table for compliance auditing.

### Event Types

#### Authentication Events

| Event Type               | Severity    | Description                              | GDPR/SOC 2 Relevance        |
| ------------------------ | ----------- | ---------------------------------------- | --------------------------- |
| `AUTH_FAILED`            | MEDIUM/HIGH | Login attempt with incorrect credentials | Access control audit        |
| `AUTH_LOCKOUT`           | HIGH        | Account locked after repeated failures   | Access control audit        |
| `TOKEN_INVALID`          | MEDIUM      | Invalid JWT presented                    | Unauthorized access attempt |
| `TOKEN_EXPIRED`          | LOW         | Expired token used                       | Session management          |
| `TOKEN_REVOKED`          | HIGH        | Revoked token used (theft detection)     | Security incident           |
| `SESSION_HIJACK_ATTEMPT` | CRITICAL    | Refresh token reuse detected             | Security incident           |

#### Protection Events

| Event Type              | Severity | Description                          | GDPR/SOC 2 Relevance   |
| ----------------------- | -------- | ------------------------------------ | ---------------------- |
| `CSRF_BLOCKED`          | HIGH     | Cross-Site Request Forgery blocked   | Attack prevention      |
| `XSS_BLOCKED`           | HIGH     | Cross-Site Scripting attempt blocked | Attack prevention      |
| `SQL_INJECTION_BLOCKED` | CRITICAL | SQL injection attempt detected       | Attack prevention      |
| `CSP_VIOLATION`         | MEDIUM   | Content Security Policy violation    | Security configuration |
| `CSP_VIOLATION_SPIKE`   | HIGH     | High volume of CSP violations        | Potential attack       |

#### Rate Limiting Events

| Event Type            | Severity | Description                    | GDPR/SOC 2 Relevance |
| --------------------- | -------- | ------------------------------ | -------------------- |
| `RATE_LIMIT_EXCEEDED` | MEDIUM   | Client exceeded rate limits    | Abuse prevention     |
| `RATE_LIMIT_WARNING`  | LOW      | Client approaching rate limits | Monitoring           |

#### Access Control Events

| Event Type             | Severity | Description                           | GDPR/SOC 2 Relevance |
| ---------------------- | -------- | ------------------------------------- | -------------------- |
| `CORS_REJECTED`        | MEDIUM   | Cross-origin request rejected         | Access control       |
| `PRIVILEGE_ESCALATION` | CRITICAL | Attempted unauthorized role elevation | Security incident    |
| `UNAUTHORIZED_ACCESS`  | HIGH     | Access without authentication         | Access control       |
| `FORBIDDEN_RESOURCE`   | MEDIUM   | Access to forbidden resource          | Authorization audit  |

#### Data Security Events

| Event Type               | Severity | Description                          | GDPR/SOC 2 Relevance |
| ------------------------ | -------- | ------------------------------------ | -------------------- |
| `PII_ACCESS`             | LOW      | Personal data accessed (audit trail) | GDPR Art. 30         |
| `SENSITIVE_DATA_EXPORT`  | MEDIUM   | Sensitive data exported              | GDPR Art. 30         |
| `DATA_TAMPERING_ATTEMPT` | CRITICAL | Data modification attack detected    | Data integrity       |

#### Account Security Events

| Event Type                 | Severity | Description                        | GDPR/SOC 2 Relevance   |
| -------------------------- | -------- | ---------------------------------- | ---------------------- |
| `PASSWORD_RESET_REQUESTED` | LOW      | Password reset initiated           | Account recovery audit |
| `PASSWORD_CHANGED`         | LOW      | Password successfully changed      | Account security audit |
| `MFA_FAILED`               | MEDIUM   | Multi-factor authentication failed | Authentication audit   |
| `ACCOUNT_LOCKED`           | HIGH     | Account locked (security measure)  | Access control         |

#### System Events

| Event Type             | Severity | Description                     | GDPR/SOC 2 Relevance |
| ---------------------- | -------- | ------------------------------- | -------------------- |
| `SUSPICIOUS_PATTERN`   | HIGH     | Anomalous behavior detected     | Threat detection     |
| `BRUTE_FORCE_DETECTED` | CRITICAL | Brute force attack identified   | Attack detection     |
| `BOT_DETECTED`         | MEDIUM   | Automated bot activity detected | Abuse prevention     |

### Severity Levels

| Severity   | Level | Response Time | Action Required                   |
| ---------- | ----- | ------------- | --------------------------------- |
| `LOW`      | 0     | None          | Logged for compliance             |
| `MEDIUM`   | 1     | 24 hours      | Investigate if recurring          |
| `HIGH`     | 2     | 4 hours       | Prompt investigation required     |
| `CRITICAL` | 3     | Immediate     | Alert triggered, immediate action |

### Compliance Configuration

**Minimum Persistence Level:**

```env
# Only persist MEDIUM and above (default)
SECURITY_MIN_PERSIST_LEVEL=MEDIUM

# Persist all events for strict compliance
SECURITY_MIN_PERSIST_LEVEL=LOW
```

### Querying Security Events

**Via Security Dashboard API (admin only):**

```bash
# Get recent events
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.intellifill.com/api/admin/security/events?limit=50"

# Filter by type
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.intellifill.com/api/admin/security/events?type=AUTH_FAILED"

# Filter by severity
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.intellifill.com/api/admin/security/events?severity=CRITICAL"

# Export for compliance report
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.intellifill.com/api/admin/security/export?format=csv&startDate=2024-01-01"
```

**Direct Database Query:**

```sql
SELECT * FROM audit_log
WHERE action LIKE 'SECURITY:%'
  AND created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;
```

---

## Related Documentation

- [Architecture Decisions](./architecture-decisions.md)
- [Environment Variables](../reference/configuration/environment.md)
- [Auth Issues Troubleshooting](../how-to/troubleshooting/auth-issues.md)
- [System Overview](../reference/architecture/system-overview.md)
