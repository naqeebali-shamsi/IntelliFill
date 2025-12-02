---
title: Security Model
description: How security works in IntelliFill
category: explanation
tags: [security, authentication, authorization]
lastUpdated: 2025-11-25
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

| Role | Permissions |
|------|-------------|
| `user` | CRUD own documents, profile |
| `admin` | All user permissions + admin features |

### Resource Ownership

Users can only access resources they own:

```typescript
// Middleware checks ownership
async function checkOwnership(req, res, next) {
  const document = await prisma.document.findUnique({
    where: { id: req.params.id }
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
    where: { userId: req.user.id }  // Only user's documents
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
      details: result.error.issues 
    });
  }
  
  // Proceed with validated data
});
```

### Validation Rules

| Input Type | Validation |
|------------|------------|
| Email | Valid email format |
| Password | Min 8 chars, complexity |
| File upload | Type, size limits |
| IDs | UUID format |
| Pagination | Numeric, reasonable limits |

### SQL Injection Prevention

Prisma uses parameterized queries:

```typescript
// Safe - parameterized
const user = await prisma.user.findUnique({
  where: { email: userInput }
});

// Never do raw queries with user input
// ❌ prisma.$queryRaw`SELECT * FROM users WHERE email = ${userInput}`
```

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
  message: { error: 'Too many requests' }
});

// Strict limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: { error: 'Too many login attempts' }
});
```

### Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 100 | 1 minute |
| Auth endpoints | 5 | 15 minutes |
| File uploads | 10 | 1 minute |

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

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

### Headers Applied

| Header | Purpose |
|--------|---------|
| Content-Security-Policy | Prevent XSS |
| X-Frame-Options | Prevent clickjacking |
| X-Content-Type-Options | Prevent MIME sniffing |
| Strict-Transport-Security | Enforce HTTPS |
| Referrer-Policy | Control referrer info |

---

## CORS Configuration

```typescript
import cors from 'cors';

app.use(cors({
  origin: [
    'http://localhost:8080',
    'http://localhost:5173',
    'https://intellifill.com',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
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

## Related Documentation

- [Architecture Decisions](./architecture-decisions.md)
- [Environment Variables](../reference/configuration/environment.md)
- [Auth Issues Troubleshooting](../how-to/troubleshooting/auth-issues.md)

