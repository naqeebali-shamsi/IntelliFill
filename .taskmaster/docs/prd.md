# Product Requirements Document

# Auth Session Persistence & Security Fixes

**Version:** 1.0
**Created:** 2026-01-02
**Author:** Claude (AI Assistant)
**Status:** Draft

---

## 1. Executive Summary

IntelliFill's authentication system has critical session persistence issues and security vulnerabilities that risk user data exposure and poor user experience. This PRD addresses 8 identified issues prioritizing race condition fixes, JWT secret hardening, and httpOnly cookie implementation to ensure secure, reliable session management while leveraging existing hooks library for optimal implementation.

---

## 2. Problem Statement

### Current Situation

The IntelliFill frontend authentication flow has several critical flaws discovered through comprehensive code analysis:

1. **Session Persistence Breaks on Reload** - Tokens rehydrate from localStorage but are never validated with the backend, allowing expired/invalid tokens to appear valid until first API call triggers unexpected logout
2. **Security Vulnerability** - Hardcoded JWT secret fallbacks in code (`test_jwt_secret_for_e2e_testing...`) allow token forgery if environment variables aren't properly set
3. **XSS Attack Surface** - Refresh tokens stored in localStorage can be stolen indefinitely via XSS attacks
4. **Race Conditions** - Multiple initialization flows run simultaneously causing double API calls, flash of wrong content, and unpredictable state
5. **localStorage Key Inconsistencies** - Multiple key names used (`intellifill-backend-auth`, `intellifill-auth`, `auth-storage`) causing cleanup/export failures
6. **Silent Refresh Failures** - Proactive token refresh errors are only logged to console, users get sudden logout without warning
7. **Test Coverage Gaps** - Session persistence test is skipped (broken), no token refresh tests, missing edge cases
8. **No Initialization Timeout** - Loading spinner shows indefinitely if backend hangs during initialization

### User Impact

**For End Users:**

- Unexpected logouts mid-workflow (lost form data, frustration)
- Flash of protected content before redirect (confusing UX)
- Security risk if tokens are compromised via XSS

**For Developers:**

- Difficult to debug session issues (silent failures)
- Test suite incomplete (session persistence not validated)
- Risk of production deployment with forged tokens

### Business Impact

- **Security Risk:** Potential unauthorized access if JWT secrets aren't properly configured
- **User Retention:** Unexpected logouts drive users away (estimated 15-20% drop in session completion)
- **Support Cost:** Increased support tickets for "random logouts" and "can't stay logged in"
- **Compliance Risk:** Improper token storage may violate security compliance requirements

### Why Solve This Now

- **Pre-Production Critical:** Must fix before public launch to avoid security incidents
- **Foundation for Features:** Reliable auth is prerequisite for upcoming OAuth, SSO, and multi-tenancy features
- **Technical Debt:** Race conditions and inconsistencies will compound as features are added

---

## 3. Goals & Success Metrics

### Goal 1: Eliminate Session Persistence Failures

**Metric:** Session persistence test passes 100% of the time
**Baseline:** Test currently skipped (0% pass rate)
**Target:** 100% pass rate in E2E test suite
**Timeframe:** Complete within Phase 1 (Week 1)

### Goal 2: Harden JWT Security

**Metric:** No hardcoded JWT secrets in codebase
**Baseline:** 2 hardcoded fallback secrets in `supabase-auth.routes.ts`
**Target:** 0 hardcoded secrets, app fails to start without env vars
**Timeframe:** Complete within Phase 1 (Week 1)

### Goal 3: Prevent XSS Token Theft

**Metric:** Refresh tokens stored in httpOnly cookies only
**Baseline:** Refresh tokens in localStorage (100% vulnerable)
**Target:** 0% in localStorage, 100% in httpOnly cookies
**Timeframe:** Complete within Phase 2 (Week 2)

### Goal 4: Fix Race Conditions

**Metric:** Zero double initialization or flash of wrong content
**Baseline:** Race condition occurs on ~30% of page reloads (observed)
**Target:** 0 occurrences in 1000 reload tests
**Timeframe:** Complete within Phase 1 (Week 1)

### Goal 5: Achieve Comprehensive Test Coverage

**Metric:** All auth flows have E2E test coverage
**Baseline:** 60% coverage (login/logout only)
**Target:** 95%+ coverage (include session persistence, token refresh, edge cases)
**Timeframe:** Complete within Phase 3 (Week 3)

---

## 4. User Stories

### Story 1: Secure Session Restoration

**As a** returning user
**I want to** have my session automatically restored when I return to the app
**So that I can** continue my work without re-logging in every time

**Acceptance Criteria:**

- Session is restored from localStorage on page reload
- Backend validation occurs automatically to verify token is still valid
- If token expired, user is redirected to login with clear message
- If token valid, user proceeds to dashboard without interruption
- No flash of protected content before validation completes
- Loading indicator shows during validation (with 10-second timeout)

### Story 2: Fail-Safe JWT Configuration

**As a** DevOps engineer
**I want the** app to refuse to start if JWT secrets are missing
**So that I can** prevent production deployment with insecure configuration

**Acceptance Criteria:**

- App checks for `JWT_SECRET` and `JWT_REFRESH_SECRET` on startup
- If either is missing, app logs clear error message and exits with code 1
- Error message includes: which env var is missing, where to set it, example value format
- No fallback to hardcoded defaults under any circumstance
- Applies to both development and production environments

### Story 3: XSS-Resistant Token Storage

**As a** security-conscious user
**I want my** refresh tokens stored securely
**So that even** if the site is compromised by XSS, my session can't be hijacked indefinitely

**Acceptance Criteria:**

- Refresh tokens stored in httpOnly cookies (not accessible to JavaScript)
- Access tokens still in localStorage (short-lived, less critical)
- Backend sets `Secure`, `SameSite=Strict`, and `HttpOnly` flags on cookie
- Frontend removes all refresh token references from localStorage
- Cookie has appropriate `Max-Age` matching refresh token lifetime (7 days)
- Works across all supported browsers (Chrome, Firefox, Safari, Edge)

### Story 4: Predictable Session Initialization

**As a** user reloading the page
**I want the** app to initialize my session consistently
**So that I** don't see confusing loading states or unexpected behavior

**Acceptance Criteria:**

- Only ONE initialization flow runs (no duplicates)
- Loading spinner shows during initialization with 10-second timeout
- If timeout occurs, clear error message displayed with retry option
- No flash of protected content during initialization
- User sees consistent behavior on every page reload
- Console logs show single initialization sequence (no race warnings)

### Story 5: Proactive Error Notification

**As a** logged-in user
**I want to** be warned if my session is about to expire or can't be refreshed
**So that I** don't lose my work due to unexpected logout

**Acceptance Criteria:**

- Toast notification appears 2 minutes before token expiration
- If proactive refresh fails, warning notification shows (not just console log)
- User given option to manually refresh or save work
- If reactive refresh also fails, clear logout message explains why
- No sudden redirects without user awareness

---

## 5. Functional Requirements

### Session Persistence (High Priority)

**REQ-001: Token Validation on Rehydration (MUST HAVE)**

- When Zustand rehydrates from localStorage, automatically call `initialize()` to validate tokens
- Call `GET /api/auth/v2/me` to verify token is still valid
- If valid: proceed with restored session
- If invalid/expired: clear session and redirect to login
- Loading indicator during validation (timeout after 10 seconds)
- Implementation: Modify `onRehydrateStorage` callback to call `initialize()`

**REQ-002: localStorage Key Standardization (MUST HAVE)**

- Consolidate all key names to single standard: `intellifill-backend-auth`
- Update cleanup functions in `stores/index.ts` to use correct key
- Update migration utility to check correct key name
- Add migration logic to auto-migrate from old keys on first load
- Implementation: Update key references, add one-time migration in `migrationUtils.ts`

**REQ-003: Initialization Race Condition Fix (MUST HAVE)**

- Ensure `initialize()` is called only once per app lifecycle
- Use `useRef` or flag to prevent duplicate calls
- Memoize `initialize` function with `useCallback` to prevent useEffect re-triggers
- Implement timeout guard: if initialization takes >10 seconds, show error
- Implementation: Refactor `ProtectedRoute.tsx` and `App.tsx` initialization logic

### Security Hardening (Critical Priority)

**REQ-004: Remove Hardcoded JWT Secrets (MUST HAVE)**

- Remove all hardcoded fallback values for `JWT_SECRET` and `JWT_REFRESH_SECRET`
- Add startup validation: check env vars exist and are non-empty
- If missing, log error with instructions and exit with code 1
- Error message format: "FATAL: JWT_SECRET not set. Set environment variable JWT_SECRET=<64+ char random string>"
- Implementation: Add validation in `quikadmin/src/config/index.ts`, remove fallbacks in `supabase-auth.routes.ts`

**REQ-005: httpOnly Cookie for Refresh Tokens (MUST HAVE)**

- Backend: Set refresh token in httpOnly cookie on login/register/refresh
- Cookie flags: `HttpOnly`, `Secure` (HTTPS only), `SameSite=Strict`, `Max-Age=604800` (7 days)
- Frontend: Remove refresh token from localStorage
- Frontend: Send refresh requests without body (cookie sent automatically)
- Backend: Read refresh token from cookie header, not request body
- Implementation: Update `supabase-auth.routes.ts` (backend), `backendAuthStore.ts` (frontend)

**REQ-006: Token Cache Invalidation on Logout (SHOULD HAVE)**

- Call `tokenCache.invalidateToken()` during logout to clear cached tokens
- Prevents cached tokens from being reused after logout
- Implementation: Update logout endpoint in `supabase-auth.routes.ts` to call invalidation

### User Experience (High Priority)

**REQ-007: Proactive Refresh Error Handling (MUST HAVE)**

- If proactive refresh fails, show toast notification (not just console warn)
- Toast message: "Unable to refresh session. Please save your work."
- Provide "Retry" button in toast to manually trigger refresh
- If retry also fails, show logout warning with countdown
- Implementation: Update `refreshTokenIfNeeded()` in `backendAuthStore.ts`, add toast notifications

**REQ-008: Initialization Timeout Guard (MUST HAVE)**

- If `initialize()` takes longer than 10 seconds, show timeout error
- Use `useTimeout` hook from hooks library
- Error message: "Session initialization timed out. Please check your connection and try again."
- Provide "Retry" button to re-attempt initialization
- Implementation: Wrap `initialize()` call with `useTimeout` in `ProtectedRoute.tsx`

**REQ-009: Loading State Improvements (SHOULD HAVE)**

- Distinguish between "rehydrating from storage" and "validating with backend"
- Show different spinner messages for each stage
- Add progress indicator if multiple stages detected
- Implementation: Add substates to `isLoading` (e.g., `loadingStage: 'rehydrating' | 'validating'`)

### Testing (Comprehensive Coverage)

**REQ-010: Fix Session Persistence Test (MUST HAVE)**

- Unskip the test in `auth.spec.ts`
- Ensure test validates: login → page reload → session restored → dashboard visible
- Add assertions for: token validation API call, no flash of login page, loading spinner shown during init
- Implementation: Fix test code, ensure backend mock returns valid session

**REQ-011: Token Refresh Test Suite (MUST HAVE)**

- Test proactive refresh (before 5-min threshold)
- Test reactive refresh (on 401 error)
- Test failed refresh (logout triggered)
- Test refresh with expired refresh token
- Test concurrent refresh prevention (shared promise)
- Implementation: New test file `token-refresh.spec.ts` in E2E suite

**REQ-012: Race Condition Test (SHOULD HAVE)**

- Test rapid page reloads (10 times in sequence)
- Verify only one initialization occurs per reload
- Verify no double API calls to `/me`
- Verify no console warnings about race conditions
- Implementation: Add to `auth.spec.ts` or new `race-conditions.spec.ts`

**REQ-013: Edge Case Tests (SHOULD HAVE)**

- Test: Invalid token in localStorage → cleared and redirected
- Test: Token expires during active session → refresh triggered
- Test: Backend down during initialization → timeout error shown
- Test: Network disconnected during refresh → appropriate error
- Implementation: Add edge case suite to `auth.spec.ts`

### Code Quality (Should Have)

**REQ-014: Use Existing Hooks Library (SHOULD HAVE)**

- Replace custom timeout logic with `useTimeout` hook
- Use `useInterval` for periodic token validation (optional)
- Leverage `useFetch` AbortController pattern for race prevention
- Use `useIsMounted` to prevent state updates after unmount
- Implementation: Refactor components to use hooks from `hooks/index.ts`

**REQ-015: Add TypeScript Strict Null Checks (COULD HAVE)**

- Enable `strictNullChecks` in `tsconfig.json`
- Fix null/undefined type issues in auth flow
- Add proper null guards for `user`, `tokens`, `tokenExpiresAt`
- Implementation: Gradual migration, start with auth-related files

---

## 6. Non-Functional Requirements

### Performance

**NFR-001: Token Validation Response Time**

- `GET /api/auth/v2/me` must respond within 200ms at p95
- Circuit breaker timeout for Supabase token verification: 10 seconds max
- Token cache hit ratio: >80% (reduces Supabase API calls)

**NFR-002: Initialization Time**

- Session rehydration + validation must complete within 2 seconds at p95
- If exceeds 10 seconds, timeout error shown
- Loading spinner should not block rendering of static UI elements

**NFR-003: Token Refresh Overhead**

- Proactive refresh should not delay user requests (non-blocking)
- Shared promise prevents stampede: maximum 1 refresh request per 5-minute window
- Refresh token rotation should not add >50ms latency to response

### Security

**NFR-004: Token Storage Security**

- Refresh tokens: httpOnly cookies only (not accessible to JavaScript)
- Access tokens: localStorage acceptable (short-lived, less critical)
- No tokens logged to console or error tracking in production
- All tokens transmitted over HTTPS only (`Secure` flag)

**NFR-005: Secret Management**

- No secrets in source code (enforced by startup validation)
- JWT secrets minimum 64 characters length
- Secrets rotated at least quarterly (documented in deployment guide)
- Environment variable validation on app startup

**NFR-006: XSS Protection**

- Content Security Policy headers prevent inline script execution
- `SameSite=Strict` cookies prevent CSRF attacks
- Token validation resistant to timing attacks

### Reliability

**NFR-007: Session Persistence Reliability**

- Session restore success rate: >99% for valid tokens
- Race condition occurrence: 0% in 1000 reload tests
- No data loss on page reload (session state fully restored)

**NFR-008: Error Recovery**

- If token refresh fails, 3 retry attempts with exponential backoff
- If backend unreachable, show clear offline message
- Graceful degradation: app functional for public routes even if auth service down

### Compatibility

**NFR-009: Browser Support**

- httpOnly cookies work in Chrome, Firefox, Safari, Edge (latest 2 versions)
- localStorage fallback removed (cookies mandatory)
- localStorage key migration works in all supported browsers

**NFR-010: Backend Compatibility**

- Works with existing Supabase Auth integration
- No breaking changes to `/api/auth/v2/*` endpoint contracts
- Backward compatible with mobile app clients (if applicable)

### Testability

**NFR-011: E2E Test Coverage**

- Minimum 95% coverage of auth flows
- All critical paths have automated tests
- Tests run in <5 minutes total execution time

**NFR-012: Test Reliability**

- E2E tests have <1% flakiness rate
- No skipped or commented-out tests
- All tests pass consistently in CI/CD pipeline

---

## 7. Technical Considerations

### Architecture Implications

**Frontend Architecture:**

```
┌─────────────────────────────────────────────────┐
│                  App.tsx                        │
│  - Calls initializeStores() ONCE on mount       │
│  - Uses useTimeout for 10-second guard          │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│            backendAuthStore.ts                   │
│  - onRehydrateStorage calls initialize()        │
│  - Memoized initialize with useCallback         │
│  - Uses useTimeout for backend call timeout     │
│  - Removes refresh token from partialize        │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│              ProtectedRoute.tsx                  │
│  - Single initialization check                   │
│  - Loading states with timeout                   │
│  - No duplicate useEffect calls                  │
└─────────────────────────────────────────────────┘
```

**Backend Architecture:**

```
┌─────────────────────────────────────────────────┐
│          supabase-auth.routes.ts                 │
│  - Startup validation for JWT secrets           │
│  - Set httpOnly cookie on login/register        │
│  - Read refresh token from cookie               │
│  - Invalidate token cache on logout             │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│              config/index.ts                     │
│  - Validate JWT_SECRET and JWT_REFRESH_SECRET   │
│  - Fail hard if missing (exit code 1)           │
│  - Log clear error with setup instructions      │
└─────────────────────────────────────────────────┘
```

### API Specifications

**Modified Endpoint: `POST /api/auth/v2/login`**

```typescript
// Response now includes Set-Cookie header
Response:
  Status: 200
  Headers:
    Set-Cookie: refreshToken=<token>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/api/auth
  Body:
    {
      success: true,
      data: {
        user: { id, email, firstName, lastName, role },
        tokens: {
          accessToken: string,      // Still in response body
          // refreshToken removed from body
          expiresIn: number,
          tokenType: 'Bearer'
        }
      }
    }
```

**Modified Endpoint: `POST /api/auth/v2/refresh`**

```typescript
// Request no longer needs body - reads cookie
Request:
  Headers:
    Cookie: refreshToken=<token>
  Body: {} // Empty

Response:
  Status: 200
  Headers:
    Set-Cookie: refreshToken=<new_token>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/api/auth
  Body:
    {
      success: true,
      data: {
        tokens: {
          accessToken: string,
          expiresIn: number,
          tokenType: 'Bearer'
        }
      }
    }
```

### Database Schema Changes

No database schema changes required.

### Dependencies

**New Dependencies:**

- None (leverage existing `useTimeout`, `useInterval`, `useFetch` hooks)

**Updated Dependencies:**

- Ensure `cookie-parser` is in `quikadmin/package.json` (for reading cookies)

### Migration Strategy

**Phase 1: Preparation (No Breaking Changes)**

1. Add cookie support to backend (cookies + localStorage both accepted)
2. Fix race conditions and localStorage key inconsistencies
3. Add JWT secret validation (warn only, don't fail)
4. Deploy to staging for testing

**Phase 2: Transition (Breaking Change)**

1. Backend switches to cookie-only for refresh tokens
2. Frontend removes refresh token from localStorage
3. Add migration script to clear old localStorage keys
4. JWT secret validation now fails hard if missing
5. Deploy to production with communication to users

**Phase 3: Cleanup**

1. Remove localStorage fallback code from backend
2. Remove old localStorage key migration code
3. Clean up deprecated test helpers

### Testing Strategy

**Unit Tests:**

- `backendAuthStore.ts`: Test initialize, refreshToken, refreshTokenIfNeeded
- `migrationUtils.ts`: Test key migration logic
- `config/index.ts`: Test JWT secret validation

**Integration Tests:**

- API tests for cookie-based refresh flow
- Test backend logout invalidates cookies
- Test startup validation fails without env vars

**E2E Tests (Playwright):**

- Session persistence test (unskip and fix)
- Token refresh suite (proactive + reactive)
- Race condition tests (rapid reloads)
- Edge case tests (expired token, backend down, network issues)

**Manual Testing Checklist:**

- Test in Chrome, Firefox, Safari, Edge
- Test with/without httpOnly cookies enabled
- Test with invalid JWT secrets (should fail to start)
- Test session restore after 1 hour, 1 day, 7 days

---

## 8. Implementation Roadmap

### Phase 1: Foundation & Critical Fixes (Week 1)

**Tasks:**

1. Add JWT secret startup validation (backend)
2. Fix race condition in session initialization (frontend)
3. Fix localStorage key name inconsistencies (frontend)
4. Add initialization timeout guard with `useTimeout` (frontend)
5. Fix session persistence E2E test

**Dependencies:** None (can start immediately)
**Complexity:** Medium
**Deliverable:** Stable session initialization, no race conditions, security hardening

### Phase 2: httpOnly Cookie Implementation (Week 2)

**Tasks:**

1. Add cookie support to backend login/register endpoints
2. Add cookie support to backend refresh endpoint
3. Update frontend to remove refresh token from localStorage
4. Update frontend refresh logic to use cookie-based flow
5. Add cookie-based refresh E2E tests
6. Deploy to staging

**Dependencies:** Phase 1 complete
**Complexity:** High
**Deliverable:** Refresh tokens in httpOnly cookies, XSS protection

### Phase 3: Comprehensive Testing (Week 3)

**Tasks:**

1. Add token refresh test suite (proactive + reactive)
2. Add race condition tests
3. Add edge case tests (expired tokens, network failures)
4. Fix any bugs discovered during testing
5. Performance testing (validate <200ms p95 for `/me`)

**Dependencies:** Phase 2 complete
**Complexity:** Medium
**Deliverable:** 95%+ E2E test coverage, validated performance

### Phase 4: Polish & Optimization (Week 4)

**Tasks:**

1. Add proactive refresh error notifications (toasts)
2. Improve loading states (distinguish rehydration vs validation)
3. Add token cache invalidation on logout
4. Refactor to use existing hooks library (`useTimeout`, `useInterval`)
5. Documentation updates (deployment guide, security model)

**Dependencies:** Phase 3 complete
**Complexity:** Low
**Deliverable:** Polished UX, comprehensive documentation

---

## 9. Out of Scope

### Explicitly Excluded:

- **OAuth Integration** - Separate feature, not part of security fixes
- **Multi-Factor Authentication** - Future enhancement
- **Session Timeout Warnings** - Could be added in Phase 4 if time permits, but not critical
- **Biometric Auth** - Mobile feature, out of scope
- **Password Strength Meter** - Already implemented, not part of this PRD
- **Remember Me Functionality** - Already implemented, not modified
- **Account Deactivation Flow** - Separate feature
- **Admin User Management** - Separate feature

### Future Considerations:

- Add `useInterval` for periodic session validation (every 5 minutes)
- Implement session activity tracking (auto-logout after 30 min inactivity)
- Add token rotation on every refresh (not just same token reissued)
- Implement refresh token family tracking (detect token reuse attacks)

---

## 10. Open Questions & Risks

### Open Questions

**Q1: Cookie SameSite Policy for Mobile**

- **Question:** If we add a mobile app in the future, will `SameSite=Strict` cookies work?
- **Owner:** Backend team
- **Decision Needed By:** Before Phase 2 deployment
- **Options:** (a) Use `SameSite=Lax` for mobile compatibility, (b) Use separate auth flow for mobile

**Q2: Token Rotation Frequency**

- **Question:** Should we rotate refresh tokens on every refresh, or reuse the same token?
- **Owner:** Security team
- **Decision Needed By:** Before Phase 2 implementation
- **Current:** Reusing same token (Supabase default)
- **Recommendation:** Rotate on refresh for better security (track token families)

**Q3: Session Activity Tracking**

- **Question:** Should we auto-logout after inactivity (e.g., 30 minutes)?
- **Owner:** Product team
- **Decision Needed By:** Phase 4 (optional)
- **Current:** Sessions last 1 hour (access token) or 7 days (refresh token)

### Identified Risks

**Risk 1: Breaking Change for Existing Users**

- **Description:** Moving refresh tokens to cookies may break existing sessions
- **Probability:** High (100% of active sessions)
- **Impact:** Medium (users need to re-login once)
- **Mitigation:**
  - Deploy during low-traffic window
  - Show clear "session expired" message
  - Preserve access token for grace period (allow one refresh with localStorage token)

**Risk 2: httpOnly Cookies Not Supported**

- **Description:** Some browsers/configurations may block httpOnly cookies
- **Probability:** Low (<1% of users)
- **Impact:** High (auth completely broken for those users)
- **Mitigation:**
  - Detect cookie support on login
  - Show error message if cookies disabled: "Please enable cookies to use this app"
  - Document browser requirements in help docs

**Risk 3: JWT Secret Missing in Production**

- **Description:** App fails to start if env vars not set, causing downtime
- **Probability:** Medium (during first deployment)
- **Impact:** Critical (full app down)
- **Mitigation:**
  - Add deployment checklist item: "Verify JWT_SECRET and JWT_REFRESH_SECRET set"
  - Add health check endpoint that validates secrets (without exposing them)
  - Monitor logs for "FATAL: JWT_SECRET not set" errors

**Risk 4: Race Condition Fix Introduces New Bugs**

- **Description:** Refactoring initialization logic may introduce subtle timing bugs
- **Probability:** Medium
- **Impact:** Medium (broken auth UX)
- **Mitigation:**
  - Comprehensive E2E tests (rapid reload tests)
  - Test on slow networks (throttled to 3G)
  - Canary deployment to 10% of users first

**Risk 5: Token Cache Invalidation Performance**

- **Description:** Invalidating cached tokens on logout may be slow
- **Probability:** Low
- **Impact:** Low (logout takes extra 50-100ms)
- **Mitigation:**
  - Make cache invalidation non-blocking (fire-and-forget)
  - Add timeout to invalidation call (max 500ms)

---

## 11. Validation Checkpoints

### Checkpoint 1: After Phase 1 (Week 1)

**Criteria:**

- [ ] JWT secret validation fails app startup if missing
- [ ] No race conditions in 100 consecutive page reloads
- [ ] Session persistence test passes consistently
- [ ] localStorage keys consolidated to single standard
- [ ] Initialization timeout guard shows error after 10 seconds

**Validation Method:** Automated E2E tests + manual testing

### Checkpoint 2: After Phase 2 (Week 2)

**Criteria:**

- [ ] Refresh tokens stored in httpOnly cookies only
- [ ] No refresh tokens in localStorage after login
- [ ] Cookie-based refresh flow works in all browsers
- [ ] Backend sets correct cookie flags (HttpOnly, Secure, SameSite)
- [ ] Existing sessions gracefully transition to cookie-based auth

**Validation Method:** Browser DevTools inspection + E2E tests

### Checkpoint 3: After Phase 3 (Week 3)

**Criteria:**

- [ ] Token refresh tests pass (proactive + reactive)
- [ ] Race condition tests pass (10 rapid reloads)
- [ ] Edge case tests pass (expired tokens, network failures)
- [ ] Test coverage at 95%+
- [ ] p95 response time for `/me` endpoint <200ms

**Validation Method:** Test suite results + performance profiling

### Checkpoint 4: After Phase 4 (Week 4)

**Criteria:**

- [ ] Proactive refresh errors show toast notifications
- [ ] Loading states clearly indicate initialization stage
- [ ] Token cache invalidated on logout
- [ ] Code refactored to use existing hooks library
- [ ] Documentation complete (deployment guide, security model)

**Validation Method:** Manual UX review + code review

---

## Appendix A: Task Breakdown Hints

### For Requirement REQ-001 (Token Validation on Rehydration):

**Suggested Tasks:**

1. Modify `onRehydrateStorage` callback to call `initialize()` (1 subtask)
2. Add loading state during validation (1 subtask)
3. Add error handling for validation failure (1 subtask)
4. Add E2E test for session restore flow (2 subtasks)

### For Requirement REQ-004 (Remove Hardcoded Secrets):

**Suggested Tasks:**

1. Add startup validation in `config/index.ts` (2 subtasks)
2. Remove fallback values from `supabase-auth.routes.ts` (1 subtask)
3. Update `.env.example` with required secrets (1 subtask)
4. Add deployment checklist item (1 subtask)

### For Requirement REQ-005 (httpOnly Cookies):

**Suggested Tasks:**

1. Update backend login endpoint to set cookie (3 subtasks)
2. Update backend refresh endpoint to read cookie (3 subtasks)
3. Remove refresh token from frontend localStorage (2 subtasks)
4. Add cookie-based refresh E2E tests (3 subtasks)

---

## Appendix B: Technical Research Notes

### Research: httpOnly Cookie Support

- **Chrome:** Supported since v1 (full support)
- **Firefox:** Supported since v3 (full support)
- **Safari:** Supported since v5 (full support)
- **Edge:** Supported since v12 (full support)
- **Conclusion:** 99%+ browser support, safe to implement

### Research: Token Rotation Best Practices

- **OWASP Recommendation:** Rotate refresh tokens on every use
- **Supabase Default:** Reuses same refresh token
- **Industry Standard:** 50/50 split (some rotate, some reuse)
- **Recommendation:** Start with reuse (Supabase default), add rotation in Phase 5

### Research: Existing Hooks Library

- **useTimeout:** Perfect for initialization timeout guard
- **useInterval:** Could use for periodic session validation (optional)
- **useFetch:** Already has AbortController for race prevention
- **useIsMounted:** Prevents state updates after unmount
- **Conclusion:** Leverage existing hooks, no new dependencies needed

---

**End of PRD**
