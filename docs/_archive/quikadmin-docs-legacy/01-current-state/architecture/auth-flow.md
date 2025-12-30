---
title: 'Authentication Flow Architecture'
id: 'arch-auth-flow'
version: '1.0.0'
last_updated: '2025-01-11'
created: '2025-01-11'
status: 'active'
phase: 'current'
maintainer: 'team'
depends_on: []
related_to:
  - 'arch-security'
  - 'arch-system-overview'
  - 'api-authentication'
ai_priority: 'high'
ai_context_level: 'foundational'
ai_required_reading: true
ai_auto_update: true
category: 'architecture'
tags:
  - 'authentication'
  - 'security'
  - 'jwt'
  - 'architecture'
  - 'current-state'
audience:
  - 'architects'
  - 'developers'
  - 'security-engineers'
  - 'ai-agents'
verified_against_code: '2025-01-11'
code_references:
  - 'src/services/PrismaAuthService.ts'
  - 'src/middleware/auth.ts'
  - 'src/api/auth.routes.ts'
---

# Authentication Flow Architecture

**Status:** Phase 3 SDK Migration - Dual Auth Active
**Last Updated:** 2025-01-11
**Audience:** Architects, Senior Developers, Security Engineers

---

## Table of Contents

- [Overview](#overview)
- [Dual Authentication System](#dual-authentication-system)
- [Authentication Flows](#authentication-flows)
- [Token Architecture](#token-architecture)
- [Security Design Patterns](#security-design-patterns)
- [Phase 0 Security Fixes](#phase-0-security-fixes)
- [Middleware Architecture](#middleware-architecture)
- [Migration Strategy](#migration-strategy)
- [Architecture Diagrams](#architecture-diagrams)

---

## Overview

QuikAdmin implements a **dual authentication system** during the migration from custom JWT to Supabase Auth. This architecture document explains how authentication works at a conceptual level, the design decisions behind the implementation, and the security patterns employed.

### Why Dual Authentication?

During the Phase 3-5 migration period, QuikAdmin supports both authentication systems to:

1. **Zero-downtime migration** - Existing users continue working
2. **Gradual adoption** - New users get Supabase Auth benefits
3. **Safe rollback** - Legacy system remains operational
4. **Testing in production** - Real-world validation of Supabase integration

### Authentication Systems Comparison

| Aspect                 | Supabase Auth (v2)               | Legacy JWT (v1)            |
| ---------------------- | -------------------------------- | -------------------------- |
| **Algorithm**          | RS256 (asymmetric)               | HS256 (symmetric)          |
| **Token Source**       | Supabase Auth API                | Custom implementation      |
| **Session Management** | Automatic refresh                | Manual refresh logic       |
| **Token Expiry**       | 1 hour                           | 15 minutes                 |
| **Refresh Token**      | 7 days (auto-rotate)             | 7 days (manual)            |
| **Verification**       | Server-side `getUser()`          | Local JWT verification     |
| **Security**           | Battle-tested, industry standard | Custom, maintenance burden |
| **Features**           | OAuth, 2FA, email verification   | Basic email/password only  |
| **Status**             | ✅ Preferred                     | ⚠️ Deprecated              |

---

## Dual Authentication System

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     QuikAdmin API Layer                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │          Dual Authentication Middleware               │  │
│  │                                                         │  │
│  │  ┌──────────────────┐      ┌───────────────────┐     │  │
│  │  │  Supabase Auth   │      │   Legacy JWT     │     │  │
│  │  │   (Priority 1)   │──┬───│   (Fallback)     │     │  │
│  │  └──────────────────┘  │   └───────────────────┘     │  │
│  │                        │                              │  │
│  │                        ▼                              │  │
│  │              User Authenticated                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Protected Endpoints                       │  │
│  │  • /api/documents      • /api/users                   │  │
│  │  • /api/jobs          • /api/admin/*                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Authentication Decision Flow

```
Incoming Request
    │
    ▼
Authorization Header Present?
    │
    ├─ No ──► 401 Unauthorized
    │
    ▼ Yes
Extract Token
    │
    ▼
Token Format Check (length, structure)
    │
    ├─ Invalid ──► 401 Unauthorized
    │
    ▼ Valid
┌─────────────────────────────┐
│ Try Supabase Verification   │
│                              │
│ • Call getUser(token)        │
│ • Server-side validation     │
│ • Network round-trip         │
└─────────────────────────────┘
    │
    ├─ Success ──► Load User from DB ──► Continue
    │
    ▼ Failure
┌─────────────────────────────┐
│ Try Legacy JWT Verification │
│                              │
│ • Decode header              │
│ • Check algorithm (HS256)    │
│ • Verify signature           │
│ • Validate payload           │
└─────────────────────────────┘
    │
    ├─ Success ──► Load User from DB ──► Continue
    │
    ▼ Failure
401 Unauthorized
```

### Base URL Structure

| System               | Base URL       | Example Endpoint                |
| -------------------- | -------------- | ------------------------------- |
| **Supabase Auth**    | `/api/auth/v2` | `/api/auth/v2/login`            |
| **Legacy JWT**       | `/api/auth`    | `/api/auth/login`               |
| **Protected Routes** | `/api/*`       | `/api/documents` (accepts both) |

---

## Authentication Flows

### 1. Registration Flow (Supabase)

```
User Registration
    │
    ▼
Frontend: POST /api/auth/v2/register
    │
    ├─ Email validation
    ├─ Password complexity check
    └─ Full name parsing
    │
    ▼
Backend: Supabase Auth API
    │
    ├─ Create auth.users record
    ├─ Hash password (bcrypt)
    └─ Generate initial session
    │
    ▼
Backend: Prisma Database
    │
    ├─ Create User record
    ├─ Link to Supabase user ID
    └─ Set default role
    │
    ▼
Backend: Generate Tokens
    │
    ├─ Access token (JWT, 1 hour)
    ├─ Refresh token (7 days)
    └─ Session metadata
    │
    ▼
Frontend: Store Tokens
    │
    ├─ Access token → Memory/localStorage
    ├─ Refresh token → httpOnly cookie
    └─ User state → Zustand store
    │
    ▼
Redirect to Dashboard
```

### 2. Login Flow (Dual Auth)

```
User Login
    │
    ▼
Frontend: POST /api/auth/v2/login OR /api/auth/login
    │
    ├─ Email (lowercase)
    └─ Password
    │
    ▼
Backend: Authenticate
    │
    ├─ Supabase: signInWithPassword()
    │   └─ Password verification
    │
    OR
    │
    └─ Legacy: bcrypt.compare()
        └─ Database password hash
    │
    ▼
Backend: Check Account Status
    │
    ├─ isActive === true?
    ├─ Not deleted?
    └─ Email verified? (production only)
    │
    ▼
Backend: Generate Session
    │
    ├─ Create access token
    ├─ Create refresh token
    ├─ Update lastLogin timestamp
    └─ Return user + tokens
    │
    ▼
Frontend: Session Established
    │
    └─ Redirect to dashboard
```

### 3. Token Refresh Flow

```
API Request
    │
    ▼
401 Unauthorized Response
    │
    ▼
Frontend: Detect Token Expiry
    │
    ▼
POST /api/auth/v2/refresh
    │
    ├─ Send refresh token
    │
    ▼
Backend: Validate Refresh Token
    │
    ├─ Supabase: refreshSession()
    │   └─ Validate token signature
    │   └─ Check expiration
    │   └─ Rotate refresh token
    │
    OR
    │
    └─ Legacy: JWT verify
        └─ Check refresh_tokens table
        └─ Generate new tokens
    │
    ▼
Backend: Issue New Tokens
    │
    ├─ New access token (1 hour)
    ├─ New refresh token (7 days)
    └─ Invalidate old refresh token
    │
    ▼
Frontend: Update Stored Tokens
    │
    └─ Retry original API request
```

### 4. Logout Flow

```
User Logout
    │
    ▼
Frontend: POST /api/auth/v2/logout
    │
    ├─ Include access token
    │
    ▼
Backend: Invalidate Session
    │
    ├─ Supabase: signOut() - global
    │   └─ Revoke all refresh tokens
    │
    OR
    │
    └─ Legacy: Delete refresh token
        └─ Single device logout
    │
    ▼
Frontend: Clear Local State
    │
    ├─ Remove tokens from storage
    ├─ Clear Zustand auth state
    ├─ Clear Supabase session
    └─ Redirect to login
    │
    ▼
Logged Out State
```

### 5. Password Change Flow

```
Change Password Request
    │
    ▼
POST /api/auth/v2/change-password
    │
    ├─ Current password
    ├─ New password
    └─ Access token (authentication)
    │
    ▼
Backend: Verify Current Password
    │
    ├─ Supabase: reauthenticate
    └─ Legacy: bcrypt compare
    │
    ▼
Backend: Update Password
    │
    ├─ Supabase: updateUser()
    └─ Legacy: Update DB hash
    │
    ▼
Backend: Revoke All Sessions
    │
    └─ Security best practice
    │
    ▼
Frontend: Force Re-login
    │
    └─ User must authenticate with new password
```

---

## Token Architecture

### Access Token Structure

#### Supabase JWT (RS256)

```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT",
    "kid": "key-identifier"
  },
  "payload": {
    "sub": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    "email": "user@example.com",
    "role": "authenticated",
    "aud": "authenticated",
    "iss": "https://project.supabase.co/auth/v1",
    "iat": 1704883200,
    "exp": 1704886800,
    "app_metadata": {
      "provider": "email"
    },
    "user_metadata": {
      "firstName": "John",
      "lastName": "Doe",
      "role": "user"
    }
  }
}
```

**Key Characteristics:**

- **RS256** - Asymmetric algorithm, signed by Supabase private key
- **Verification** - Public key from Supabase (no shared secret)
- **Claims** - Standard JWT claims + Supabase metadata
- **Expiry** - 1 hour (3600 seconds)

#### Legacy JWT (HS256)

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "role": "USER",
    "iat": 1704883200,
    "exp": 1704884100,
    "iss": "quikadmin-api",
    "aud": "quikadmin-client",
    "jti": "unique-token-id"
  }
}
```

**Key Characteristics:**

- **HS256** - Symmetric algorithm, shared secret
- **Verification** - HMAC with JWT_SECRET
- **Claims** - Custom claims structure
- **Expiry** - 15 minutes (900 seconds) - Phase 0 hardening

### Token Lifecycle

```
Token Creation
    │
    ├─ Access Token: 15 min (Legacy) / 1 hour (Supabase)
    └─ Refresh Token: 7 days
    │
    ▼
┌──────────────────────────────────────┐
│         Active Token Window          │
│                                      │
│  Time: 0 ─────────► 15min/1h        │
│                                      │
│  • Token valid for all requests     │
│  • No refresh needed                │
└──────────────────────────────────────┘
    │
    ▼
Token Expires
    │
    ▼
┌──────────────────────────────────────┐
│        Refresh Token Window          │
│                                      │
│  Time: 15min/1h ──────► 7 days      │
│                                      │
│  • Access token expired             │
│  • Refresh token still valid        │
│  • Automatic refresh triggered      │
└──────────────────────────────────────┘
    │
    ▼
New Tokens Issued
    │
    ├─ New access token
    ├─ New refresh token (rotated)
    └─ Old refresh token invalidated
    │
    ▼
Cycle Repeats OR Session Ends (7 days)
```

### Token Storage Strategy

| Location            | Access Token   | Refresh Token | Rationale                                          |
| ------------------- | -------------- | ------------- | -------------------------------------------------- |
| **Frontend Memory** | ✅ Recommended | ❌ Never      | Fast access, XSS protected (clears on page reload) |
| **localStorage**    | ⚠️ Acceptable  | ❌ Never      | Persists across reloads, vulnerable to XSS         |
| **sessionStorage**  | ⚠️ Acceptable  | ❌ Never      | Clears on tab close, XSS vulnerable                |
| **httpOnly Cookie** | ✅ Best        | ✅ Best       | CSRF protection needed, XSS immune                 |
| **Regular Cookie**  | ❌ Never       | ❌ Never      | XSS + CSRF vulnerable                              |

**Current Implementation:**

- **Supabase SDK**: Manages storage automatically (localStorage)
- **Legacy Frontend**: Memory + localStorage fallback
- **Refresh Token**: Not exposed to frontend (server-side only)

---

## Security Design Patterns

### 1. Defense in Depth

Multiple layers of validation for every token:

```
Layer 1: Format Validation
    ├─ Non-empty string
    ├─ Length check (20-2048 chars)
    └─ Structure check (header.payload.signature)

Layer 2: Header Validation
    ├─ Algorithm check (HS256 only, reject 'none')
    ├─ Token type (typ: JWT)
    └─ Algorithm confusion prevention

Layer 3: Signature Verification
    ├─ HMAC-SHA256 verification
    ├─ Secret validation (64+ chars, 256+ bits entropy)
    └─ Timing-safe comparison

Layer 4: Payload Validation
    ├─ Required fields (id, email, role)
    ├─ Expiration timestamp
    ├─ Issuer/Audience claims
    └─ Not-before timestamp

Layer 5: Database Validation
    ├─ User exists
    ├─ Account active (isActive = true)
    ├─ Not deleted
    └─ Role matches token claim

Layer 6: Business Logic Validation
    └─ User has permission for requested resource
```

### 2. Fail-Fast Validation

Environment validation on application startup prevents runtime security failures:

```typescript
// Executed BEFORE server starts
function validateSecrets() {
  if (!JWT_SECRET || JWT_SECRET.length < 64) {
    throw new Error('JWT_SECRET must be at least 64 characters');
  }

  if (calculateEntropy(JWT_SECRET) < 256) {
    throw new Error('JWT_SECRET has insufficient entropy (minimum 256 bits)');
  }

  if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET.length < 64) {
    throw new Error('JWT_REFRESH_SECRET must be at least 64 characters');
  }
}

// Application crashes if validation fails - prevents insecure deployment
validateSecrets();
```

**Why Fail-Fast:**

- **Prevents insecure deployment** - Won't start with weak secrets
- **Early detection** - Fails at startup, not during user request
- **Clear error messages** - Developers know exactly what's wrong
- **Production safety** - No silent security failures

### 3. Algorithm Confusion Prevention (CVE-2015-9235)

Protection against JWT algorithm confusion attacks:

```typescript
// SECURITY: Decode and validate header BEFORE verification
let header;
try {
  header = JSON.parse(Buffer.from(tokenParts[0], 'base64url').toString());
} catch {
  reject(new Error('Invalid token header'));
  return;
}

// SECURITY: Explicitly reject 'none' algorithm and enforce HS256 only
if (!header.alg || header.alg === 'none' || header.alg !== 'HS256') {
  reject(new Error('Invalid or unsupported algorithm'));
  return;
}

// SECURITY: Verify with strict algorithm enforcement
jwt.verify(token, JWT_SECRET, {
  algorithms: ['HS256'], // Whitelist approach
  // ... other options
});
```

**Attack Scenario Prevented:**

```
Attacker crafts token with "alg": "none"
    │
    ▼
Header check rejects "none" algorithm
    │
    ▼
Attack fails BEFORE signature verification
```

### 4. Token Binding

Unique JWT ID (jti) prevents replay attacks:

```typescript
const accessToken = jwt.sign(payload, secret, {
  jwtid: crypto.randomUUID(), // Unique identifier
  // ... other options
});
```

**Replay Attack Prevention:**

1. Each token has unique `jti` claim
2. Backend can track used tokens (if needed)
3. Prevents token reuse after logout

### 5. Short-Lived Tokens

**Principle:** Minimize blast radius of token theft

| Token Type                  | Old Expiry | New Expiry     | Rationale              |
| --------------------------- | ---------- | -------------- | ---------------------- |
| **Access Token (Legacy)**   | 24 hours   | **15 minutes** | Reduce theft window    |
| **Access Token (Supabase)** | N/A        | **1 hour**     | Supabase default       |
| **Refresh Token**           | 7 days     | **7 days**     | Balance UX vs security |

**Impact of Theft:**

- **Access token stolen**: Max 15 min (Legacy) / 1 hour (Supabase) of unauthorized access
- **Refresh token stolen**: Can generate new access tokens for up to 7 days
- **Both stolen**: Logout revokes refresh token, access token expires quickly

### 6. Rate Limiting

Prevent brute-force and DoS attacks:

```
┌─────────────────────────────────────┐
│      Rate Limiting Strategy         │
├─────────────────────────────────────┤
│                                     │
│  Authentication Endpoints:          │
│  • /api/auth/login                  │
│  • /api/auth/v2/login               │
│  • Limit: 5 requests / 15 minutes   │
│  • Prevents: Password guessing      │
│                                     │
│  Registration Endpoints:            │
│  • /api/auth/register               │
│  • /api/auth/v2/register            │
│  • Limit: 3 requests / 1 hour       │
│  • Prevents: Spam accounts          │
│                                     │
│  General API:                       │
│  • All other endpoints              │
│  • Limit: 100 requests / 15 min     │
│  • Prevents: DoS attacks            │
└─────────────────────────────────────┘
```

---

## Phase 0 Security Fixes

### Critical Vulnerabilities Eliminated

Phase 0 addressed **5 critical security vulnerabilities** discovered during architecture review:

#### 1. Hardcoded JWT Secrets Removed ✅

**Vulnerability:**

- JWT secrets hardcoded in source code
- Exposed in version control
- Impossible to rotate without code change

**Fix:**

```typescript
// BEFORE (VULNERABLE):
const JWT_SECRET = 'hardcoded-secret-DO-NOT-USE-IN-PRODUCTION';

// AFTER (SECURE):
const JWT_SECRET = process.env.JWT_SECRET;

// Validation on startup
if (!JWT_SECRET || JWT_SECRET.length < 64) {
  throw new Error('JWT_SECRET must be at least 64 characters');
}

// Entropy validation
if (calculateEntropy(JWT_SECRET) < 256) {
  throw new Error('JWT_SECRET has insufficient entropy');
}
```

#### 2. Algorithm Confusion Attack Prevention ✅

**Vulnerability:**

- JWT library accepted 'none' algorithm
- Attacker could forge unsigned tokens

**Fix:**

```typescript
// Header validation BEFORE verification
if (!header.alg || header.alg === 'none' || header.alg !== 'HS256') {
  reject(new Error('Invalid or unsupported algorithm'));
  return;
}

// Explicit algorithm enforcement
jwt.verify(token, JWT_SECRET, {
  algorithms: ['HS256'], // Whitelist only HS256
  // ...
});
```

#### 3. Payload Validation Bypass Fixed ✅

**Vulnerability:**

- Missing validation of token payload
- Incomplete tokens could authenticate

**Fix:**

```typescript
// Structure validation
if (!token || typeof token !== 'string') {
  return res.status(401).json({ error: 'Invalid token format' });
}

const tokenParts = token.split('.');
if (tokenParts.length !== 3) {
  return res.status(401).json({ error: 'Invalid token structure' });
}

// Payload completeness validation
if (!payload.id || !payload.email || !payload.role) {
  return res.status(401).json({ error: 'Token payload incomplete' });
}
```

#### 4. Environment Validation Implemented ✅

**Vulnerability:**

- Application started with missing/weak secrets
- Security failures at runtime

**Fix:**

```typescript
// Constructor validation (fail-fast)
constructor() {
  if (!this.jwtSecret || !this.jwtRefreshSecret) {
    throw new Error('JWT secrets are required');
  }

  if (this.jwtSecret.length < 64 || this.jwtRefreshSecret.length < 64) {
    throw new Error('JWT secrets must be at least 64 characters');
  }
}
```

#### 5. Token Expiry Hardening ✅

**Vulnerability:**

- 24-hour access tokens provided excessive window for exploitation

**Fix:**

```typescript
// BEFORE: 24 hours
expiresIn: '24h';

// AFTER: 15 minutes (industry standard)
expiresIn: '15m';
```

### Security Impact

| Metric                 | Before Phase 0 | After Phase 0 | Improvement          |
| ---------------------- | -------------- | ------------- | -------------------- |
| **Hardcoded Secrets**  | 3 locations    | 0             | 100% eliminated      |
| **Algorithm Attacks**  | Vulnerable     | Protected     | CVE-2015-9235 fixed  |
| **Payload Bypass**     | Possible       | Prevented     | 6 validation layers  |
| **Startup Validation** | None           | Comprehensive | Fail-fast deployment |
| **Token Theft Window** | 24 hours       | 15 minutes    | 96% reduction        |

---

## Middleware Architecture

### Middleware Stack

```
Incoming HTTP Request
    │
    ▼
┌─────────────────────────────────────┐
│  1. Helmet.js Security Headers      │
│     • CSP, HSTS, X-Frame-Options    │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  2. CORS Protection                 │
│     • Allowed origins               │
│     • Credentials handling          │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  3. Rate Limiting                   │
│     • Per-endpoint limits           │
│     • IP-based throttling           │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  4. Authentication Middleware       │
│     • dualAuthenticate              │
│     • authenticateSupabase          │
│     • authenticate (legacy)         │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  5. Authorization Middleware        │
│     • dualAuthorize                 │
│     • authorizeSupabase             │
│     • authorize (legacy)            │
└─────────────────────────────────────┘
    │
    ▼
Protected Route Handler
```

### Middleware Types

#### 1. Required Authentication

**Middleware:** `authenticateSupabase` (Supabase only) or `dualAuthenticate` (dual mode)

**Behavior:**

- Extracts token from Authorization header
- Verifies token signature
- Loads user from database
- Attaches `req.user` object
- Returns 401 if authentication fails

**Usage:**

```typescript
router.get('/api/documents', authenticateSupabase, handler);
// OR during migration
router.get('/api/documents', dualAuthenticate, handler);
```

#### 2. Role-Based Authorization

**Middleware:** `authorizeSupabase(['admin'])` or `dualAuthorize(['admin'])`

**Behavior:**

- Requires authentication first
- Checks user role against allowed roles
- Returns 403 if role doesn't match
- Case-insensitive role comparison

**Usage:**

```typescript
router.delete('/api/admin/users/:id', authenticateSupabase, authorizeSupabase(['admin']), handler);
```

#### 3. Optional Authentication

**Middleware:** `optionalAuthSupabase` or `optionalDualAuth`

**Behavior:**

- Tries to authenticate
- Attaches `req.user` if successful
- Continues without user if authentication fails
- Useful for public endpoints with user context

**Usage:**

```typescript
router.get('/api/stats', optionalAuthSupabase, handler);
// Handler can check: if (req.user) { ... }
```

### Request Object Extensions

After successful authentication, `req` object is extended:

```typescript
interface AuthenticatedRequest extends Request {
  user: {
    id: string; // Primary key (matches Supabase ID)
    email: string; // User email
    role: string; // USER, ADMIN, VIEWER
    supabaseUserId: string; // Supabase auth.users.id
    firstName?: string; // Optional first name
    lastName?: string; // Optional last name
  };

  supabaseUser?: {
    // Raw Supabase user (advanced use)
    // Full Supabase user object
  };
}
```

---

## Migration Strategy

### Phase Overview

```
Phase 0: Critical Security Fixes (COMPLETED)
    │
    ├─ Remove hardcoded secrets
    ├─ Fix algorithm confusion
    ├─ Implement payload validation
    ├─ Add startup validation
    └─ Reduce token expiry
    │
    ▼
Phase 1-2: Supabase Setup (COMPLETED)
    │
    ├─ Create Supabase project
    ├─ Configure environment
    ├─ Install SDK
    └─ Create middleware
    │
    ▼
Phase 3: Auth Routes Migration (COMPLETED)
    │
    ├─ Create /api/auth/v2 routes
    ├─ Test Supabase auth flow
    ├─ Maintain /api/auth legacy routes
    └─ 37/37 integration tests passing
    │
    ▼
Phase 4: Protected Routes Migration (COMPLETED)
    │
    ├─ Migrate routes to dualAuthenticate
    ├─ Fix unprotected routes
    ├─ Add integration tests
    └─ 32 new tests added
    │
    ▼
Phase 5: Frontend Migration (CURRENT)
    │
    ├─ Install @supabase/supabase-js
    ├─ Update auth store
    ├─ Update API interceptors
    └─ Test session management
    │
    ▼
Phase 6: User Migration
    │
    ├─ Provide migration guide
    ├─ Monitor adoption metrics
    ├─ Offer incentives for migration
    └─ Support legacy users
    │
    ▼
Phase 7: Legacy Deprecation
    │
    ├─ Announce EOL date
    ├─ Force remaining users to migrate
    ├─ Remove legacy middleware
    └─ Delete PrismaAuthService
```

### Migration Decision Matrix

| Scenario                          | Auth System | Middleware                           | Base URL        |
| --------------------------------- | ----------- | ------------------------------------ | --------------- |
| **New user registration**         | Supabase    | `authenticateSupabase`               | `/api/auth/v2`  |
| **Existing user (pre-migration)** | Legacy JWT  | `dualAuthenticate`                   | `/api/auth`     |
| **New application integration**   | Supabase    | `authenticateSupabase`               | `/api/auth/v2`  |
| **Protected routes (current)**    | Dual        | `dualAuthenticate`                   | `/api/*`        |
| **Admin routes**                  | Dual        | `dualAuthenticate` + `dualAuthorize` | `/api/admin/*`  |
| **Public routes**                 | N/A         | No auth middleware                   | `/api/public/*` |

### Rollback Strategy

If critical issues arise with Supabase:

1. **Immediate Rollback**
   - Set feature flag: `DISABLE_SUPABASE_AUTH=true`
   - All routes use legacy JWT only
   - Frontend uses legacy auth flow

2. **Gradual Rollback**
   - Disable Supabase for new registrations
   - Existing Supabase users continue working
   - New users use legacy system

3. **Partial Rollback**
   - Specific routes use legacy only
   - Others remain dual-auth
   - Isolated problem resolution

---

## Architecture Diagrams

### System Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│                                                               │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │  Login Page    │  │  Register Page │  │  Dashboard     │ │
│  └────────────────┘  └────────────────┘  └────────────────┘ │
│           │                   │                   │          │
│           └───────────────────┴───────────────────┘          │
│                               │                              │
│                    ┌──────────▼──────────┐                   │
│                    │  Zustand Auth Store │                   │
│                    └──────────┬──────────┘                   │
│                               │                              │
│                    ┌──────────▼──────────┐                   │
│                    │  API Client (Axios) │                   │
│                    │  + Interceptors     │                   │
│                    └──────────┬──────────┘                   │
└───────────────────────────────┼──────────────────────────────┘
                                │ HTTPS
                                │
┌───────────────────────────────▼──────────────────────────────┐
│                    Backend (Express.js)                       │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Middleware Stack                          │  │
│  │                                                         │  │
│  │  [Helmet] → [CORS] → [Rate Limit] → [Dual Auth]       │  │
│  └────────────────────────────────────────────────────────┘  │
│                               │                              │
│           ┌───────────────────┴───────────────────┐          │
│           │                                       │          │
│  ┌────────▼────────┐                   ┌─────────▼────────┐ │
│  │  Supabase Auth  │                   │   Legacy JWT     │ │
│  │   Middleware    │                   │   Middleware     │ │
│  └────────┬────────┘                   └─────────┬────────┘ │
│           │                                       │          │
│           └───────────────────┬───────────────────┘          │
│                               │                              │
│                    ┌──────────▼──────────┐                   │
│                    │   Prisma ORM        │                   │
│                    └──────────┬──────────┘                   │
└───────────────────────────────┼──────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────┐
│                   PostgreSQL Database                         │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │    users     │  │refresh_tokens│  │  documents   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   Supabase Auth Service                       │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │ auth.users   │  │   sessions   │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

### Token Flow Diagram

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. Login Request (email, password)
       │
       ▼
┌──────────────────────────────────────────┐
│  Backend: POST /api/auth/v2/login        │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ Supabase.auth.signInWithPassword() │ │
│  └───────────────┬────────────────────┘ │
│                  │                      │
│  ┌───────────────▼────────────────────┐ │
│  │ Load User from Prisma (isActive)   │ │
│  └───────────────┬────────────────────┘ │
│                  │                      │
│  ┌───────────────▼────────────────────┐ │
│  │ Generate Tokens                    │ │
│  │ • Access: JWT (1h)                 │ │
│  │ • Refresh: Opaque (7d)             │ │
│  └───────────────┬────────────────────┘ │
└──────────────────┼──────────────────────┘
                   │ 2. Tokens + User
       ┌───────────▼───────────┐
       │  Client Stores Tokens │
       └───────────┬───────────┘
                   │
       ┌───────────▼───────────────────────┐
       │ 3. API Request + Access Token     │
       │    Authorization: Bearer <token>  │
       └───────────┬───────────────────────┘
                   │
       ┌───────────▼─────────────────────────┐
       │  Backend: Verify Token              │
       │  • Supabase.auth.getUser(token)     │
       │  • Load user from Prisma            │
       │  • Attach req.user                  │
       └───────────┬─────────────────────────┘
                   │
       ┌───────────▼───────────┐
       │ 4. Protected Resource │
       └───────────────────────┘
```

---

## Related Documentation

### For API Integration

- **[Authentication API Reference](../../api/reference/authentication.md)** - Complete endpoint documentation
- **[Auth Routes Reference](../../300-api/304-auth-routes-reference.md)** - Detailed route specifications

### For Implementation

- **[Implementing Authentication Guide](../../guides/developer/implementing-auth.md)** - Step-by-step integration
- **[Supabase Setup Guide](../../300-api/302-supabase-setup.md)** - Supabase configuration
- **[Supabase Middleware Guide](../../300-api/303-supabase-middleware.md)** - Middleware usage

### For Security

- **[Security Architecture](../204-security-architecture.md)** - Security implementation details
- **[OWASP Compliance Status](../204-security-architecture.md#owasp-top-10-2021-compliance-status)** - Security checklist

---

## Summary

QuikAdmin's authentication architecture implements a **dual authentication system** that balances **security**, **user experience**, and **migration safety**. The system:

1. **Supports both Supabase and Legacy JWT** during transition period
2. **Enforces defense-in-depth** with 6 layers of token validation
3. **Prevents critical vulnerabilities** through Phase 0 security fixes
4. **Enables zero-downtime migration** with gradual adoption
5. **Provides flexible middleware** for different authentication needs

The architecture is designed to be **secure by default**, **fail-fast on misconfiguration**, and **easy to migrate away from legacy systems**.

---

**Questions?** Check the [Implementation Guide](../../guides/developer/implementing-auth.md) or [API Reference](../../api/reference/authentication.md) for practical usage examples.
