# Security Hardening PRD - IntelliFill Application

## Document Information

- **Version**: 1.0
- **Created**: 2026-01-04
- **Status**: Ready for Implementation
- **Priority**: CRITICAL
- **Expert Panel**: Security Architect, AppSec Engineer, DevOps Security, Frontend Security, Compliance/GRC

---

## Executive Summary

### Business Context

IntelliFill is a document processing application handling sensitive PII (SSN, addresses, financial data). A comprehensive security audit identified **22 vulnerabilities** across 10 security domains, with a current security score of **5.6/10 (VULNERABLE)**.

### Current State Assessment

| Category           | Score | Status          |
| ------------------ | ----- | --------------- |
| JWT Handling       | 6/10  | NEEDS WORK      |
| Cookie Security    | 8/10  | GOOD            |
| CSP Headers        | 0/10  | MISSING         |
| HSTS Headers       | 7/10  | PARTIAL         |
| Secrets Management | 4/10  | CRITICAL        |
| Session Management | 7/10  | NEEDS WORK      |
| CORS               | 3/10  | NOT IMPLEMENTED |
| Rate Limiting      | 8/10  | GOOD            |
| Input Validation   | 6/10  | INCONSISTENT    |
| Audit Logging      | 7/10  | GOOD            |

### Target State

- Phase 1 Complete: 7.5/10 (HARDENED)
- Phase 2 Complete: 8.5/10 (SECURE)
- Phase 3 Complete: 9.5/10 (ENTERPRISE-READY)

### Compliance Requirements

- GDPR: Data protection, encryption at rest, audit logging
- CCPA: PII handling, right to erasure
- SOC 2 Type II: Access control, security monitoring, incident logging

---

## Phase 1: Critical Vulnerabilities (Sprint 1)

### 1.1 Implement Content Security Policy (CSP) Headers

**Severity**: CRITICAL
**OWASP**: A05:2021 Security Misconfiguration, A07:2021 XSS
**Current State**: No CSP headers implemented
**Impact**: Application vulnerable to XSS attacks, inline script injection, data exfiltration

#### Technical Requirements

1. **Create CSP middleware** in `quikadmin/src/middleware/csp.ts`:

   ```typescript
   // Development CSP (allows Vite HMR)
   const devCSP = {
     'default-src': ["'self'"],
     'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
     'style-src': ["'self'", "'unsafe-inline'"],
     'img-src': ["'self'", 'data:', 'https:', 'blob:'],
     'font-src': ["'self'"],
     'connect-src': ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
     'frame-ancestors': ["'none'"],
     'form-action': ["'self'"],
     'base-uri': ["'self'"],
     'report-uri': ['/api/csp-report'],
   };

   // Production CSP (stricter)
   const prodCSP = {
     ...devCSP,
     'script-src': ["'self'"], // No unsafe-inline in production
     'style-src': ["'self'"],
   };
   ```

2. **Add CSP violation reporting endpoint** at `/api/csp-report`:
   - Log all CSP violations to security event log
   - Rate limit reporting endpoint (100 reports/min)
   - Store violations for analysis

3. **Frontend nonce generation** for production:
   - Generate cryptographic nonce per request
   - Pass nonce to frontend via response header or template
   - Apply nonce to script tags

#### Acceptance Criteria

- [ ] CSP header present on all responses
- [ ] No XSS payloads execute in browser
- [ ] CSP violations logged to security events
- [ ] Development mode allows Vite HMR
- [ ] Production mode blocks inline scripts

#### Test Strategy

- Unit test: CSP header format validation
- Integration test: XSS payload injection blocked
- E2E test: Application functional with CSP enabled

---

### 1.2 Implement CORS Middleware

**Severity**: CRITICAL
**OWASP**: A01:2021 Broken Access Control
**Current State**: CORS config defined but middleware not applied
**Impact**: Cross-origin requests accepted from any domain, cookies sent to attackers

#### Technical Requirements

1. **Install and apply CORS middleware** in `quikadmin/src/index.ts`:

   ```typescript
   import cors from 'cors';

   const corsOptions = {
     origin: (origin, callback) => {
       const allowedOrigins = config.server.corsOrigins;
       if (!origin || allowedOrigins.includes(origin)) {
         callback(null, true);
       } else {
         callback(new Error('CORS not allowed'));
       }
     },
     credentials: true,
     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
     allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID'],
     exposedHeaders: ['X-Request-ID', 'RateLimit-Remaining'],
     maxAge: 600, // 10 minutes preflight cache
   };

   app.use(cors(corsOptions));
   ```

2. **Update config** to include production domains:

   ```typescript
   corsOrigins: getEnvArray('CORS_ORIGINS', [
     'http://localhost:3000',
     'http://localhost:5173',
     'http://localhost:8080',
     'https://intellifill.app',
     'https://app.intellifill.com',
   ]),
   ```

3. **Add CORS error handling**:
   - Log blocked origins to security events
   - Return 403 with JSON error for CORS failures

#### Acceptance Criteria

- [ ] CORS headers present on all responses
- [ ] Requests from allowed origins succeed
- [ ] Requests from unknown origins blocked with 403
- [ ] Preflight OPTIONS requests handled correctly
- [ ] Credentials (cookies) only sent to allowed origins

#### Test Strategy

- Unit test: CORS middleware configuration
- Integration test: Cross-origin request handling
- E2E test: Frontend-backend cookie flow works

---

### 1.3 Remove Hardcoded JWT Secret Fallback

**Severity**: CRITICAL
**OWASP**: A02:2021 Cryptographic Failures
**Current State**: Hardcoded 64-char fallback if JWT_SECRET env var missing
**Impact**: Predictable secret allows token forgery

#### Technical Requirements

1. **Remove fallback** in `quikadmin/src/utils/supabase.ts`:

   ```typescript
   // BEFORE (vulnerable)
   const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret...';

   // AFTER (secure)
   const JWT_SECRET = process.env.JWT_SECRET;
   if (!JWT_SECRET) {
     throw new Error('FATAL: JWT_SECRET environment variable is required');
   }
   ```

2. **Add startup validation** in `quikadmin/src/config/index.ts`:

   ```typescript
   function validateSecurityConfig() {
     const requiredSecrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
     const missing = requiredSecrets.filter((s) => !process.env[s]);
     if (missing.length > 0) {
       throw new Error(`Missing required secrets: ${missing.join(', ')}`);
     }

     // Validate JWT_SECRET strength
     if (process.env.JWT_SECRET!.length < 64) {
       throw new Error('JWT_SECRET must be at least 64 characters');
     }
   }
   ```

3. **Create test environment setup**:
   - Add `scripts/setup-test-env.sh` to generate test secrets
   - Update CI/CD to inject test secrets
   - Document required environment variables

#### Acceptance Criteria

- [ ] Application fails to start without JWT_SECRET
- [ ] No hardcoded secrets in codebase
- [ ] Test environment uses generated secrets
- [ ] CI/CD pipeline provides test secrets
- [ ] Documentation updated with setup requirements

#### Test Strategy

- Unit test: Startup validation rejects missing secrets
- Integration test: Application starts with valid secrets
- Security audit: No hardcoded secrets in git history

---

### 1.4 Implement Security Event Logging

**Severity**: HIGH
**OWASP**: A09:2021 Security Logging and Monitoring Failures
**Current State**: Basic audit logging exists, no security-specific events
**Impact**: Unable to detect attacks, no forensic trail

#### Technical Requirements

1. **Create SecurityEventService** in `quikadmin/src/services/SecurityEventService.ts`:

   ```typescript
   export enum SecurityEventType {
     AUTH_FAILED = 'auth.failed',
     AUTH_SUCCESS = 'auth.success',
     AUTH_LOGOUT = 'auth.logout',
     TOKEN_INVALID = 'token.invalid',
     TOKEN_EXPIRED = 'token.expired',
     TOKEN_REFRESH = 'token.refresh',
     RATE_LIMITED = 'rate.limited',
     CSRF_BLOCKED = 'csrf.blocked',
     CSP_VIOLATION = 'csp.violation',
     CORS_BLOCKED = 'cors.blocked',
     SUSPICIOUS_ACTIVITY = 'suspicious.activity',
   }

   export enum SecuritySeverity {
     INFO = 'info',
     WARN = 'warn',
     ERROR = 'error',
     CRITICAL = 'critical',
   }

   interface SecurityEvent {
     type: SecurityEventType;
     severity: SecuritySeverity;
     userId?: string;
     ip: string;
     userAgent: string;
     details: Record<string, any>;
     timestamp: Date;
   }
   ```

2. **Integrate with existing audit middleware**:
   - Add security event logging to `auditMiddleware.ts`
   - Log failed auth attempts after 3 failures
   - Alert on rate limit threshold breaches

3. **Add alerting thresholds**:
   ```typescript
   const ALERT_THRESHOLDS = {
     authFailedPerIp: { count: 5, window: '15m', severity: 'WARN' },
     authFailedPerEmail: { count: 10, window: '1h', severity: 'ERROR' },
     rateLimitHits: { count: 100, window: '1h', severity: 'WARN' },
     csrfBlocked: { count: 3, window: '5m', severity: 'CRITICAL' },
   };
   ```

#### Acceptance Criteria

- [ ] All security events logged with timestamp, IP, user agent
- [ ] Failed auth attempts tracked per IP and email
- [ ] Rate limit hits logged
- [ ] CSP violations captured
- [ ] CORS blocks logged
- [ ] Alerts triggered at thresholds

#### Test Strategy

- Unit test: SecurityEventService methods
- Integration test: Events logged on security failures
- Load test: Logging doesn't impact performance

---

## Phase 2: High Priority Vulnerabilities (Sprint 2)

### 2.1 Migrate Access Token to Memory-Only Storage

**Severity**: HIGH
**OWASP**: A07:2021 XSS (token theft via localStorage)
**Current State**: accessToken persisted to localStorage via Zustand
**Impact**: XSS attack can steal token from localStorage

#### Technical Requirements

1. **Update backendAuthStore** to exclude token from persistence:

   ```typescript
   // quikadmin-web/src/stores/backendAuthStore.ts
   partialize: (state) => ({
     user: state.user,
     isAuthenticated: state.isAuthenticated,
     tokenExpiresAt: state.tokenExpiresAt,
     // REMOVED: tokens.accessToken
     // Keep only user state, not tokens
   }),
   ```

2. **Create in-memory token holder**:

   ```typescript
   // quikadmin-web/src/lib/tokenManager.ts
   let accessToken: string | null = null;
   let tokenExpiresAt: number | null = null;

   export const tokenManager = {
     setToken: (token: string, expiresIn: number) => {
       accessToken = token;
       tokenExpiresAt = Date.now() + expiresIn * 1000;
     },
     getToken: () => accessToken,
     clearToken: () => {
       accessToken = null;
       tokenExpiresAt = null;
     },
     isExpired: () => !tokenExpiresAt || Date.now() > tokenExpiresAt,
   };
   ```

3. **Update API interceptor** to use tokenManager:

   ```typescript
   // quikadmin-web/src/services/api.ts
   api.interceptors.request.use((config) => {
     const token = tokenManager.getToken();
     if (token && !tokenManager.isExpired()) {
       config.headers.Authorization = `Bearer ${token}`;
     }
     return config;
   });
   ```

4. **Handle page refresh** - Token will be lost on refresh, trigger silent refresh:
   ```typescript
   // On app initialization
   if (isAuthenticated && !tokenManager.getToken()) {
     await silentRefresh(); // Uses httpOnly cookie
   }
   ```

#### Acceptance Criteria

- [ ] accessToken not in localStorage
- [ ] Token stored only in JavaScript memory
- [ ] Page refresh triggers silent token refresh
- [ ] XSS cannot access token
- [ ] All API calls still authenticated

#### Test Strategy

- Unit test: tokenManager functions
- Integration test: Silent refresh flow
- Security test: localStorage inspection shows no token
- E2E test: Full auth flow with page refresh

---

### 2.2 Implement Token Rotation on Backend

**Severity**: HIGH
**OWASP**: A02:2021 Cryptographic Failures
**Current State**: No token rotation mechanism
**Impact**: Stolen tokens valid indefinitely until manual rotation

#### Technical Requirements

1. **Add token family tracking** for refresh token rotation:

   ```typescript
   // Each refresh token gets a family ID
   // If old token reused after rotation, invalidate entire family (token theft detection)
   interface RefreshTokenPayload {
     sub: string;
     family: string; // UUID for token family
     generation: number; // Increments on each refresh
     iat: number;
     exp: number;
   }
   ```

2. **Implement rotation on refresh**:

   ```typescript
   // On /api/auth/v2/refresh
   async function rotateTokens(oldRefreshToken: string) {
     const decoded = verifyRefreshToken(oldRefreshToken);

     // Check if token was already used (replay attack)
     if (await isTokenUsed(oldRefreshToken)) {
       // Potential theft - invalidate entire family
       await invalidateTokenFamily(decoded.family);
       throw new SecurityError('Token reuse detected - all sessions invalidated');
     }

     // Mark old token as used
     await markTokenUsed(oldRefreshToken);

     // Issue new tokens
     const newAccessToken = issueAccessToken(decoded.sub);
     const newRefreshToken = issueRefreshToken(decoded.sub, decoded.family, decoded.generation + 1);

     return { accessToken: newAccessToken, refreshToken: newRefreshToken };
   }
   ```

3. **Add Redis storage for used tokens**:
   ```typescript
   // Track used refresh tokens with TTL matching token expiry
   await redis.set(`used_token:${tokenHash}`, '1', 'EX', REFRESH_TOKEN_EXPIRY);
   ```

#### Acceptance Criteria

- [ ] Refresh tokens rotated on each use
- [ ] Old refresh tokens invalidated after use
- [ ] Token reuse triggers family invalidation
- [ ] Redis tracks used tokens efficiently
- [ ] Graceful handling of Redis failures

#### Test Strategy

- Unit test: Token rotation logic
- Integration test: Refresh flow with rotation
- Security test: Token reuse detection
- Load test: Redis token tracking performance

---

### 2.3 Enforce HSTS in All Environments

**Severity**: MEDIUM
**OWASP**: A05:2021 Security Misconfiguration
**Current State**: HSTS only enabled in production
**Impact**: Development/staging vulnerable to downgrade attacks

#### Technical Requirements

1. **Update security middleware**:

   ```typescript
   // quikadmin/src/middleware/security.ts
   const hstsMaxAge = {
     production: 31536000, // 1 year
     staging: 86400, // 1 day
     development: 3600, // 1 hour
     test: 0, // Disabled for testing
   };

   res.setHeader(
     'Strict-Transport-Security',
     `max-age=${hstsMaxAge[process.env.NODE_ENV || 'development']}; includeSubDomains${
       process.env.NODE_ENV === 'production' ? '; preload' : ''
     }`
   );
   ```

2. **Enable secure cookies in development**:

   ```typescript
   secure: process.env.NODE_ENV !== 'test', // Secure in dev too
   ```

3. **Configure local HTTPS for development**:
   - Document mkcert setup for local HTTPS
   - Update Vite config for HTTPS dev server
   - Update backend to serve HTTPS locally

#### Acceptance Criteria

- [ ] HSTS header present in all environments
- [ ] Cookies secure flag enabled except in test
- [ ] Local development works with HTTPS
- [ ] Documentation for local HTTPS setup

#### Test Strategy

- Unit test: HSTS header values per environment
- Integration test: Cookie secure flag
- Manual test: Local HTTPS development

---

### 2.4 Implement Global Input Validation

**Severity**: MEDIUM
**OWASP**: A03:2021 Injection
**Current State**: Inconsistent validation across routes
**Impact**: Injection attacks possible on unvalidated endpoints

#### Technical Requirements

1. **Create validation middleware factory**:

   ```typescript
   // quikadmin/src/middleware/validation.ts
   import Joi from 'joi';

   export function validateBody(schema: Joi.Schema) {
     return (req: Request, res: Response, next: NextFunction) => {
       const { error, value } = schema.validate(req.body, {
         abortEarly: false,
         stripUnknown: true,
       });

       if (error) {
         return res.status(400).json({
           error: 'Validation failed',
           details: error.details.map((d) => ({
             field: d.path.join('.'),
             message: d.message,
           })),
         });
       }

       req.body = value;
       next();
     };
   }
   ```

2. **Create common validation schemas**:

   ```typescript
   // quikadmin/src/schemas/common.ts
   export const emailSchema = Joi.string().email().max(255).required();
   export const passwordSchema = Joi.string().min(8).max(128).required();
   export const uuidSchema = Joi.string().uuid().required();
   export const paginationSchema = Joi.object({
     limit: Joi.number().integer().min(1).max(100).default(20),
     offset: Joi.number().integer().min(0).default(0),
   });
   ```

3. **Apply validation to all routes**:
   - Auth routes: email, password schemas
   - Document routes: file type, size validation
   - Profile routes: user data schemas
   - Search routes: query sanitization

#### Acceptance Criteria

- [ ] All POST/PUT/PATCH endpoints have validation
- [ ] Invalid input returns 400 with details
- [ ] Validation prevents SQL/NoSQL injection
- [ ] Validation prevents XSS in stored data
- [ ] Unknown fields stripped from input

#### Test Strategy

- Unit test: Validation schemas
- Integration test: Endpoint validation responses
- Security test: Injection payload rejection

---

## Phase 3: Medium Priority & Hardening (Sprint 3)

### 3.1 Add CSP Violation Reporting Dashboard

**Severity**: MEDIUM
**Current State**: CSP violations logged but not visualized
**Impact**: Unable to monitor XSS attempts effectively

#### Technical Requirements

1. **Create CSP report aggregation**:
   - Store CSP reports in database
   - Aggregate by violation type, URL, blocked-uri
   - Track frequency and patterns

2. **Add admin dashboard view**:
   - List recent CSP violations
   - Filter by severity, type, date
   - Export reports for analysis

3. **Implement alerting**:
   - Alert on new violation types
   - Alert on violation spike (>10x baseline)

#### Acceptance Criteria

- [ ] CSP violations stored in database
- [ ] Dashboard shows violations with filters
- [ ] Alerts triggered on spikes
- [ ] Export functionality works

---

### 3.2 Implement Secrets Rotation Procedure

**Severity**: MEDIUM
**Current State**: No rotation mechanism
**Impact**: Compromised secrets remain valid indefinitely

#### Technical Requirements

1. **Document rotation procedure**:
   - Generate new secret
   - Deploy with both old and new (dual-key period)
   - Validate new secret works
   - Remove old secret
   - Update all environments

2. **Implement dual-key JWT verification**:

   ```typescript
   function verifyJWT(token: string) {
     try {
       return jwt.verify(token, JWT_SECRET);
     } catch (e) {
       if (JWT_SECRET_OLD) {
         return jwt.verify(token, JWT_SECRET_OLD);
       }
       throw e;
     }
   }
   ```

3. **Add rotation reminder system**:
   - Track last rotation date
   - Alert 7 days before recommended rotation
   - Recommended rotation: 90 days

#### Acceptance Criteria

- [ ] Rotation procedure documented
- [ ] Dual-key verification works
- [ ] Rotation reminder system active
- [ ] Zero-downtime rotation possible

---

### 3.3 Comprehensive Rate Limiting Enhancement

**Severity**: MEDIUM
**Current State**: Good rate limiting but gaps exist
**Impact**: Some endpoints vulnerable to abuse

#### Technical Requirements

1. **Add rate limiting to uncovered endpoints**:
   - Password reset: 5/hour per email
   - Demo endpoint: 3/hour per IP
   - CSP report: 100/min per IP
   - File download: 50/hour per user

2. **Add rate limit headers to all responses**:

   ```
   RateLimit-Limit: 100
   RateLimit-Remaining: 95
   RateLimit-Reset: 1640000000
   ```

3. **Implement adaptive rate limiting**:
   - Reduce limits after suspicious activity
   - Gradually restore after clean period

#### Acceptance Criteria

- [ ] All endpoints rate limited
- [ ] Rate limit headers present
- [ ] Adaptive limiting works
- [ ] Redis failover to memory works

---

### 3.4 Security Audit Dashboard

**Severity**: LOW
**Current State**: Security events logged but not visualized
**Impact**: Security team lacks visibility

#### Technical Requirements

1. **Create security dashboard**:
   - Failed auth attempts (graph)
   - Rate limit hits (graph)
   - CSP violations (list)
   - Suspicious IPs (list)
   - Active sessions (list)

2. **Add export functionality**:
   - Export security events as CSV/JSON
   - Filter by date range, event type
   - Include for compliance audits

#### Acceptance Criteria

- [ ] Dashboard shows key security metrics
- [ ] Export works for compliance
- [ ] Real-time updates via SSE

---

## Test Strategy

### Unit Tests

- All new security middleware functions
- Validation schemas
- Token management functions
- SecurityEventService methods

### Integration Tests

- CSP header enforcement
- CORS request handling
- Token rotation flow
- Rate limiting behavior

### Security Tests

- XSS payload injection (should be blocked)
- CSRF attack simulation
- Token theft simulation
- Injection attack vectors

### E2E Tests

- Full auth flow with security headers
- Page refresh with silent token refresh
- Rate limiting user experience

### Penetration Testing

- Schedule external pentest after Phase 2
- Focus on OWASP Top 10 vulnerabilities
- Validate CSP, CORS, token security

---

## Success Metrics

| Metric           | Current      | Phase 1          | Phase 2       | Phase 3   |
| ---------------- | ------------ | ---------------- | ------------- | --------- |
| Security Score   | 5.6/10       | 7.5/10           | 8.5/10        | 9.5/10    |
| XSS Protection   | None         | CSP enabled      | Memory tokens | Full      |
| CORS Enforcement | None         | Enabled          | Validated     | Hardened  |
| Token Security   | localStorage | httpOnly refresh | Memory access | Rotated   |
| Audit Coverage   | 60%          | 80%              | 90%           | 100%      |
| Compliance Ready | No           | Partial          | Yes           | Certified |

---

## Risk Matrix

| Risk            | Likelihood | Impact   | Mitigation                  |
| --------------- | ---------- | -------- | --------------------------- |
| XSS token theft | High       | Critical | CSP + Memory tokens         |
| CSRF attack     | Medium     | High     | CORS + CSRF tokens          |
| JWT forgery     | Low        | Critical | Remove hardcoded secret     |
| Session hijack  | Medium     | High     | httpOnly cookies + rotation |
| Brute force     | Medium     | Medium   | Rate limiting + lockout     |
| Data breach     | Low        | Critical | Encryption + logging        |

---

## Dependencies

- `helmet` npm package for security headers
- `cors` npm package for CORS middleware
- Redis for token tracking and rate limiting
- Existing audit middleware (extend)
- Existing rate limiter (extend)

---

## Rollback Plan

Each phase can be rolled back independently:

1. **CSP**: Remove CSP middleware, headers disappear
2. **CORS**: Remove CORS middleware, reverts to permissive
3. **Token storage**: Revert store partialize, add token back
4. **Secrets**: No rollback needed (improvement only)

---

## Timeline Estimate

- **Phase 1**: 1 sprint (5-7 days)
- **Phase 2**: 1 sprint (5-7 days)
- **Phase 3**: 1 sprint (5-7 days)
- **Total**: 3 sprints (~21 days)

---

## Appendix A: Vulnerability Reference

| ID  | Vulnerability           | Severity | Phase | Task |
| --- | ----------------------- | -------- | ----- | ---- |
| V01 | No CSP Headers          | Critical | 1     | 1.1  |
| V02 | CORS Not Applied        | Critical | 1     | 1.2  |
| V03 | JWT Secret Hardcoded    | Critical | 1     | 1.3  |
| V04 | Token in localStorage   | High     | 2     | 2.1  |
| V05 | No Token Rotation       | High     | 2     | 2.2  |
| V06 | HSTS Dev Only           | Medium   | 2     | 2.3  |
| V07 | Inconsistent Validation | Medium   | 2     | 2.4  |
| V08 | No CSP Reporting        | Medium   | 3     | 3.1  |
| V09 | No Secrets Rotation     | Medium   | 3     | 3.2  |
| V10 | Rate Limit Gaps         | Medium   | 3     | 3.3  |
| V11 | No Security Dashboard   | Low      | 3     | 3.4  |

---

## Appendix B: Expert Panel Signatures

- **Security Architect** (Dr. Elena Vasquez): Architecture & Threat Modeling
- **AppSec Engineer** (Marcus Chen): OWASP & Code-Level Security
- **DevOps Security** (Sarah Kowalski): Infrastructure & Secrets
- **Frontend Security** (Dr. Kenji Tanaka): XSS, CSP, Client-side
- **Compliance/GRC** (Jennifer Williams): Regulatory & Best Practices

---

_PRD Generated via Meta-Prompting Expert Committee Deliberation_
_IntelliFill Security Hardening Initiative 2026_
