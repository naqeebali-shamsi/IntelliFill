# PRD: Middleware Security & Standardization Fixes

## Document Information
- **Version:** 1.0
- **Date:** 2026-01-04
- **Author:** AI Orchestrator
- **Status:** Ready for Implementation
- **Priority:** CRITICAL

---

## 1. Executive Summary

This PRD addresses 16 issues identified in the hostile middleware audit of the IntelliFill application. The issues span security vulnerabilities, architectural inconsistencies, and technical debt across both frontend and backend middleware layers.

### Business Impact
- **Security:** 3 critical vulnerabilities that could lead to data exposure
- **Reliability:** 5 high-priority issues affecting system stability
- **Maintainability:** 8 medium-priority issues creating technical debt

### Success Metrics
- All 3 critical security issues resolved
- 100% test coverage for new/modified middleware
- Zero regression in existing functionality
- All changes pass security review

---

## 2. Problem Statement

The middleware audit revealed that while the overall architecture is sound, several security invariants are not properly enforced:

1. **RLS (Row Level Security) fails open** - Database-level security silently degrades
2. **CSRF protection disabled in development** - Parity issues between environments
3. **Token storage state mismatch** - Inconsistent authentication state
4. **No global request correlation** - Cannot trace requests across services
5. **Race conditions in token refresh** - Fragile implementation

---

## 3. Goals & Non-Goals

### Goals
- Fix all CRITICAL security vulnerabilities
- Implement fail-closed security patterns
- Add global request ID tracking
- Standardize error handling
- Remove dead code and unused utilities
- Achieve 100% test coverage for middleware

### Non-Goals
- Changing authentication providers
- Adding new middleware types
- Refactoring non-middleware code
- Performance optimization (unless security-related)

---

## 4. Technical Requirements

### 4.1 CRITICAL: RLS Fail-Closed Default

**File:** `quikadmin/src/middleware/supabaseAuth.ts`
**Lines:** 162-174

**Current Behavior:**
```typescript
if (process.env.RLS_FAIL_CLOSED === 'true') {
  // Only fails if explicitly set
}
// Default: continues without RLS protection
```

**Required Behavior:**
```typescript
const shouldFailClosed = process.env.RLS_FAIL_CLOSED !== 'false';
if (shouldFailClosed) {
  // Fail closed by default, opt-out requires explicit 'false'
}
```

**Tests Required:**
- Test RLS context success path
- Test RLS context failure with default (should reject)
- Test RLS context failure with RLS_FAIL_CLOSED=false (should continue)
- Test health service records RLS failure

**Acceptance Criteria:**
- [ ] Default behavior is fail-closed
- [ ] Opt-out requires explicit `RLS_FAIL_CLOSED=false`
- [ ] Failure logged at ERROR level
- [ ] Health service notified of failure
- [ ] 500 response includes proper error code

---

### 4.2 CRITICAL: Global Error Boundary

**File:** `quikadmin-web/src/App.tsx`

**Current Behavior:**
- ErrorBoundary component exists but not mounted at root
- Async errors bypass ErrorBoundary

**Required Behavior:**
- ErrorBoundary wraps entire app at root level
- Global error handler for unhandled promise rejections
- Error reporting integration point (Sentry placeholder)

**Tests Required:**
- Test ErrorBoundary catches render errors
- Test ErrorBoundary reset functionality
- Test global promise rejection handler
- Test error callback is invoked

**Acceptance Criteria:**
- [ ] ErrorBoundary wraps App root
- [ ] Unhandled promise rejections are caught
- [ ] Error details shown in development
- [ ] Generic message shown in production
- [ ] Reset/retry functionality works

---

### 4.3 CRITICAL: Token Storage Consistency

**File:** `quikadmin-web/src/stores/backendAuthStore.ts`

**Current Behavior:**
- `isAuthenticated` persists to localStorage
- `accessToken` is memory-only
- On refresh: state says authenticated but no token exists

**Required Behavior:**
- Add `hasValidSession` flag separate from `isAuthenticated`
- `isAuthenticated` should only be true when token exists in memory
- Persist `sessionIndicator` (not isAuthenticated) for silent refresh detection

**Tests Required:**
- Test fresh login sets all state correctly
- Test page refresh triggers silent refresh
- Test failed silent refresh clears session
- Test state consistency after logout

**Acceptance Criteria:**
- [ ] `isAuthenticated` reflects actual token presence
- [ ] `sessionIndicator` persists for refresh detection
- [ ] Silent refresh restores full auth state
- [ ] Failed refresh clears all auth state

---

### 4.4 HIGH: CSRF Enabled by Default

**File:** `quikadmin/src/index.ts`
**Lines:** 237-242

**Current Behavior:**
```typescript
if (config.server.nodeEnv === 'production' || process.env.ENABLE_CSRF === 'true') {
  app.use(csrfProtection);
}
```

**Required Behavior:**
```typescript
if (process.env.DISABLE_CSRF !== 'true') {
  app.use(csrfProtection);
}
```

**Tests Required:**
- Test CSRF enabled by default in all environments
- Test CSRF can be disabled with explicit flag
- Test CSRF validation works for POST/PUT/DELETE
- Test CSRF skips safe methods (GET/HEAD/OPTIONS)

**Acceptance Criteria:**
- [ ] CSRF enabled by default
- [ ] Opt-out requires `DISABLE_CSRF=true`
- [ ] Warning logged when disabled
- [ ] All existing auth endpoints still work

---

### 4.5 HIGH: Request Interceptor Mutex

**File:** `quikadmin-web/src/services/api.ts`
**Lines:** 44-52

**Current Behavior:**
```typescript
if (!proactiveRefreshPromise) {
  proactiveRefreshPromise = authState.refreshTokenIfNeeded();
  proactiveRefreshPromise.finally(() => {
    queueMicrotask(() => { proactiveRefreshPromise = null; });
  });
}
```

**Required Behavior:**
- Use proper mutex/lock pattern
- Clear promise synchronously after resolution
- Add timeout for stuck refresh attempts

**Tests Required:**
- Test concurrent requests share single refresh
- Test refresh completes before requests proceed
- Test timeout triggers logout
- Test successful refresh updates all pending requests

**Acceptance Criteria:**
- [ ] No race conditions in refresh logic
- [ ] Mutex prevents duplicate refreshes
- [ ] 30-second timeout on refresh
- [ ] All queued requests use new token

---

### 4.6 HIGH: Router-Based Redirect

**File:** `quikadmin-web/src/services/api.ts`
**Lines:** 127-129

**Current Behavior:**
```typescript
window.location.href = '/login';
```

**Required Behavior:**
- Use React Router navigation
- Preserve return URL for post-login redirect
- Handle redirect in interceptor context

**Tests Required:**
- Test 401 triggers navigation to login
- Test return URL is preserved
- Test no full page reload occurs

**Acceptance Criteria:**
- [ ] Uses React Router navigate()
- [ ] Return URL passed in state
- [ ] No browser history issues

---

### 4.7 HIGH: Disable DevTools in Production

**File:** `quikadmin-web/src/stores/backendAuthStore.ts`
**Lines:** 189-190

**Current Behavior:**
- DevTools middleware always enabled

**Required Behavior:**
- Only enable in development mode
- Remove from production build

**Tests Required:**
- Test devtools not present in production build
- Test devtools work in development

**Acceptance Criteria:**
- [ ] DevTools disabled in production
- [ ] No sensitive data exposed
- [ ] Development functionality preserved

---

### 4.8 HIGH: Global Request ID Middleware

**File:** `quikadmin/src/index.ts` (new middleware addition)

**Current Behavior:**
- requestContext() exists but not globally mounted

**Required Behavior:**
- Mount requestContext() as first middleware
- Generate UUID for all requests
- Set X-Request-ID header on response
- Pass to logger context

**Tests Required:**
- Test all responses have X-Request-ID
- Test request ID in logs
- Test request ID correlation across middleware

**Acceptance Criteria:**
- [ ] Every response has X-Request-ID
- [ ] ID is valid UUID
- [ ] ID appears in all logs for request
- [ ] Error responses include ID

---

### 4.9 MEDIUM: checkSession Expiration Check

**File:** `quikadmin-web/src/stores/backendAuthStore.ts`
**Lines:** 603-606

**Current Behavior:**
```typescript
checkSession: () => {
  const { tokens, isAuthenticated } = get();
  return isAuthenticated && !!tokens?.accessToken;
}
```

**Required Behavior:**
```typescript
checkSession: () => {
  const { isAuthenticated } = get();
  return isAuthenticated && tokenManager.hasToken() && !tokenManager.isExpiringSoon(0);
}
```

**Tests Required:**
- Test returns false when token expired
- Test returns false when token missing
- Test returns true when valid token exists

**Acceptance Criteria:**
- [ ] Checks actual token presence
- [ ] Checks token expiration
- [ ] Uses tokenManager as source of truth

---

### 4.10 MEDIUM: Sanitize Request Middleware

**File:** `quikadmin/src/index.ts`

**Current Behavior:**
- sanitizeRequest() exists but not mounted

**Required Behavior:**
- Mount sanitizeRequest() after body parsers
- Remove null bytes and control characters
- Log sanitization events

**Tests Required:**
- Test null bytes removed
- Test control characters removed
- Test valid data unchanged
- Test nested objects sanitized

**Acceptance Criteria:**
- [ ] All request data sanitized
- [ ] No false positives on valid data
- [ ] Sanitization logged for audit

---

### 4.11 MEDIUM: Error Handler Request ID

**File:** `quikadmin/src/index.ts`
**Lines:** 291-400

**Current Behavior:**
- Error responses don't include request ID

**Required Behavior:**
- Include X-Request-ID in error response body
- Log error with request ID

**Tests Required:**
- Test error response includes requestId field
- Test request ID matches header
- Test error logged with request ID

**Acceptance Criteria:**
- [ ] Error JSON includes requestId
- [ ] Logs include request ID
- [ ] Client can correlate errors

---

### 4.12 MEDIUM: CORS Pattern Security

**File:** `quikadmin/src/index.ts`
**Lines:** 163-166

**Current Behavior:**
```typescript
/^https:\/\/intellifill.*\.vercel\.app$/
```

**Required Behavior:**
- More specific pattern to prevent subdomain hijacking
- Explicit list preferred over patterns

**Tests Required:**
- Test valid Vercel URLs allowed
- Test invalid subdomains rejected
- Test exact match takes precedence

**Acceptance Criteria:**
- [ ] Pattern more restrictive
- [ ] No wildcard subdomain matching
- [ ] Security event logged on rejection

---

### 4.13 LOW: Delete Unused Utilities

**Files:**
- `quikadmin/src/middleware/security.ts`: AdaptiveRateLimiter, verifyRequestSignature, compose, performanceMonitor

**Required Behavior:**
- Remove unused code
- Keep asyncHandler and cacheControl (used)

**Tests Required:**
- Test removed code not imported anywhere
- Test remaining utilities still work

**Acceptance Criteria:**
- [ ] Dead code removed
- [ ] No broken imports
- [ ] Bundle size reduced

---

### 4.14 LOW: Consistent Error Codes

**Files:**
- `quikadmin/src/index.ts` (error handler)
- `quikadmin-web/src/stores/backendAuthStore.ts` (createAuthError)

**Required Behavior:**
- Share error code constants between FE and BE
- Consistent mapping of HTTP status to error codes

**Tests Required:**
- Test error codes match specification
- Test FE correctly interprets BE error codes

**Acceptance Criteria:**
- [ ] Shared error code enum/constants
- [ ] Consistent error response format
- [ ] Documentation updated

---

### 4.15 LOW: Audit Middleware Exclude Paths

**File:** `quikadmin/src/index.ts`
**Lines:** 220-225

**Current Behavior:**
- Excludes /health, /metrics, /docs

**Required Behavior:**
- Also exclude /api/csp-report (high volume, low value)
- Make exclude list configurable via env

**Tests Required:**
- Test excluded paths not logged
- Test included paths are logged
- Test env override works

**Acceptance Criteria:**
- [ ] CSP reports not logged
- [ ] Configuration via environment
- [ ] No audit data loss for important paths

---

### 4.16 LOW: Upload Store Cleanup

**File:** `quikadmin-web/src/hooks/useUpload.ts`

**Current Behavior:**
- AbortController per file but no global cleanup

**Required Behavior:**
- Abort all pending uploads on unmount
- Clear completed/failed uploads periodically

**Tests Required:**
- Test unmount aborts pending uploads
- Test completed uploads cleared after timeout

**Acceptance Criteria:**
- [ ] No memory leaks
- [ ] Clean unmount behavior
- [ ] Stale uploads cleaned

---

## 5. Implementation Order

### Phase 1: Critical Security (Day 1)
1. 4.1 RLS Fail-Closed Default
2. 4.2 Global Error Boundary
3. 4.3 Token Storage Consistency

### Phase 2: High Priority (Day 2)
4. 4.4 CSRF Enabled by Default
5. 4.5 Request Interceptor Mutex
6. 4.6 Router-Based Redirect
7. 4.7 Disable DevTools in Production
8. 4.8 Global Request ID Middleware

### Phase 3: Medium Priority (Day 3)
9. 4.9 checkSession Expiration Check
10. 4.10 Sanitize Request Middleware
11. 4.11 Error Handler Request ID
12. 4.12 CORS Pattern Security

### Phase 4: Low Priority & Cleanup (Day 4)
13. 4.13 Delete Unused Utilities
14. 4.14 Consistent Error Codes
15. 4.15 Audit Middleware Exclude Paths
16. 4.16 Upload Store Cleanup

---

## 6. Testing Strategy

### Unit Tests
- Each middleware tested in isolation
- Mock external dependencies
- Test success, failure, and edge cases

### Integration Tests
- Full request flow through middleware chain
- Auth flow end-to-end
- Error propagation

### Security Tests
- CSRF token validation
- RLS enforcement verification
- Token refresh race conditions

---

## 7. Rollback Plan

Each change can be rolled back independently:
- Environment variables control new behaviors
- Feature flags for gradual rollout
- Previous behavior preserved via config

---

## 8. Documentation Updates

- Update CLAUDE.md with new middleware order
- Update API documentation with error codes
- Add security hardening guide

---

## 9. Sign-off Requirements

- [ ] Security review approved
- [ ] All tests passing
- [ ] No regression in existing features
- [ ] Performance benchmarks within 5% of baseline
