# PRD: Auth & Security Improvements (Batch 1)

**Document ID:** PRD-AUTH-001
**Version:** 1.0
**Status:** Draft
**Created:** 2026-01-09
**Author:** Claude AI Engineering Agent

---

## 1. Overview

### 1.1 Problem Statement

The IntelliFill authentication system has gaps in testability, security, and compliance:
- **Testability:** 47% of auth UI elements lack `data-testid` attributes, blocking reliable E2E testing
- **Security:** Login lockout is client-side only, bypassable via localStorage clear
- **Compliance:** Terms acceptance and marketing consent are not persisted for GDPR/CCPA audits
- **Feature Gap:** Demo login endpoint exists but has no UI button

### 1.2 Goals

| Goal | Success Metric |
|------|----------------|
| Full E2E test coverage for auth flows | 31/31 elements have data-testid |
| Brute-force protection | Failed attempts tracked server-side with 15-min lockout |
| Legal compliance | 100% of registrations have consent timestamps |
| Demo accessibility | Demo login available when VITE_ENABLE_DEMO=true |

### 1.3 Non-Goals

- Multi-factor authentication (separate initiative)
- OAuth/social login (separate initiative)
- Password policy changes (current policy is adequate)
- Session management improvements (separate initiative)

---

## 2. User Stories

### 2.1 E2E Test Engineer

> As a QA engineer writing E2E tests, I need reliable selectors for all auth form elements so that my tests don't break on CSS changes.

**Acceptance Criteria:**
- [ ] All forms have `data-testid` attribute
- [ ] All inputs have `data-testid` attribute
- [ ] All submit buttons have `data-testid` attribute
- [ ] All toggle elements have `data-testid` attribute

### 2.2 Security-Conscious User

> As a user concerned about account security, I want to know if someone is trying to brute-force my account and have the system protect me automatically.

**Acceptance Criteria:**
- [ ] After 3 failed attempts, I see a warning with attempts remaining
- [ ] After 5 failed attempts, my account is temporarily locked
- [ ] I see a clear message explaining the lockout and when I can try again
- [ ] The lockout persists even if I clear my browser or use a different device

### 2.3 Legal/Compliance Officer

> As a compliance officer, I need evidence that users consented to terms of service at registration to meet GDPR/CCPA requirements.

**Acceptance Criteria:**
- [ ] Each user record includes `acceptedTermsAt` timestamp
- [ ] Each user record includes `marketingConsent` boolean
- [ ] Consent data is set server-side (not user-controllable)
- [ ] Data can be exported for audit purposes

### 2.4 Prospective User

> As a prospective user, I want to try the demo before creating an account so I can evaluate if IntelliFill meets my needs.

**Acceptance Criteria:**
- [ ] Demo login button is visible on login page (when enabled)
- [ ] One-click demo login creates restricted demo session
- [ ] Demo session clearly indicates demo mode in UI
- [ ] Demo session cannot access or modify production data

---

## 3. Functional Requirements

### 3.1 Testability: Add data-testid Attributes

**FR-TEST-001:** Add `data-testid` to Login form elements

| Element | data-testid | File |
|---------|-------------|------|
| Form container | `login-form` | Login.tsx:198 |
| Email input | `login-email-input` | Login.tsx:267 |
| Password input | `login-password-input` | Login.tsx:301 |
| Submit button | `login-submit-button` | Login.tsx:363 |
| Remember me checkbox | `remember-me-checkbox` | Login.tsx:335 |
| Password toggle | `toggle-password-visibility` | Login.tsx:317 |

**FR-TEST-002:** Add `data-testid` to Verify Email elements

| Element | data-testid | File |
|---------|-------------|------|
| Form container | `verify-email-form` | VerifyEmail.tsx:173 |
| Code input | `verify-email-code-input` | VerifyEmail.tsx |
| Submit button | `verify-email-submit-button` | VerifyEmail.tsx |
| Resend button | `resend-verification-button` | VerifyEmail.tsx:256 |

**FR-TEST-003:** Add `data-testid` to Accept Invite elements

| Element | data-testid | File |
|---------|-------------|------|
| Accept button | `accept-invite-button` | AcceptInvitePage.tsx:293 |
| Decline button | `decline-invite-button` | AcceptInvitePage.tsx |

### 3.2 Security: Server-Side Login Lockout

**FR-SEC-001:** Track failed login attempts in Redis

- Key pattern: `lockout:${email.toLowerCase()}`
- Value: `{ attempts: number, lockedUntil?: number }`
- TTL: 15 minutes from first failed attempt
- Reset on successful login

**FR-SEC-002:** Lock account after threshold

- Threshold: 5 failed attempts
- Lockout duration: 15 minutes
- Lockout persists across clients/devices
- Return lockout info in API response

**FR-SEC-003:** API Response Changes

```typescript
// Failed login with attempts remaining
{
  success: false,
  error: {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
    attemptsRemaining: 3,
    maxAttempts: 5
  }
}

// Locked account
{
  success: false,
  error: {
    code: 'ACCOUNT_LOCKED',
    message: 'Account temporarily locked due to multiple failed login attempts.',
    lockoutExpiresAt: '2026-01-09T12:30:00.000Z',
    retryAfterSeconds: 720
  }
}
```

**FR-SEC-004:** Graceful degradation

- If Redis unavailable, log warning and allow login (fail-open)
- Add circuit breaker for Redis failures

**FR-SEC-005:** Fixed response timing

- All login error responses must take consistent time (e.g., 200-300ms)
- Prevents timing attacks to enumerate accounts

### 3.3 Compliance: Consent Persistence

**FR-COMP-001:** Database schema changes

```prisma
model User {
  // existing fields...
  acceptedTermsAt   DateTime?   // Set server-side at registration
  marketingConsent  Boolean     @default(false)
}
```

**FR-COMP-002:** Registration endpoint changes

- Accept `acceptTerms: boolean` and `marketingConsent: boolean` in request
- Set `acceptedTermsAt = new Date()` server-side when `acceptTerms: true`
- Store `marketingConsent` value from request

**FR-COMP-003:** Validation

- Registration MUST fail if `acceptTerms !== true`
- Error code: `TERMS_NOT_ACCEPTED`

### 3.4 Feature: Demo Login Button

**FR-DEMO-001:** Conditional UI rendering

- Render demo button only when `import.meta.env.VITE_ENABLE_DEMO === 'true'`
- Button text: "Try Demo Account"
- Placement: Below login form, above register link

**FR-DEMO-002:** Demo login handler

- Call `POST /api/auth/v2/demo` endpoint (already exists)
- Show loading state during request
- On success, redirect to dashboard

**FR-DEMO-003:** Demo restrictions

- Demo session returns `isDemo: true` in user object
- Frontend should display demo mode indicator
- Frontend should disable destructive actions in demo mode

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Metric | Requirement |
|--------|-------------|
| Lockout check latency | < 50ms (Redis GET) |
| Login response time | < 500ms (including lockout check) |
| Error response timing | Consistent 200-300ms |

### 4.2 Reliability

| Metric | Requirement |
|--------|-------------|
| Redis unavailability handling | Fail-open with logging |
| Lockout service uptime | 99.9% (same as auth) |

### 4.3 Accessibility

| Metric | Requirement |
|--------|-------------|
| Touch targets | Minimum 44x44px |
| Keyboard navigation | All interactive elements focusable |
| Screen reader support | All elements have accessible names |

### 4.4 Monitoring

| Metric | Alert Threshold |
|--------|-----------------|
| auth.lockout.triggered | > 10/minute = warning, > 50/minute = alert |
| auth.failed_attempts | Histogram for analysis |
| redis.lockout.errors | Any = warning |

---

## 5. Technical Design

### 5.1 New File: Lockout Service

**Location:** `quikadmin/src/services/lockout.service.ts`

```typescript
interface LockoutStatus {
  isLocked: boolean;
  attemptsRemaining: number;
  lockoutExpiresAt: Date | null;
}

interface LockoutService {
  checkLockout(email: string): Promise<LockoutStatus>;
  recordFailedAttempt(email: string): Promise<LockoutStatus>;
  clearLockout(email: string): Promise<void>;
}
```

### 5.2 New Component: PasswordVisibilityToggle

**Location:** `quikadmin-web/src/components/auth/PasswordVisibilityToggle.tsx`

```typescript
interface PasswordVisibilityToggleProps {
  showPassword: boolean;
  onToggle: () => void;
  testId?: string;
}
```

### 5.3 Schema Migration

**Name:** `add_consent_fields`

```sql
ALTER TABLE "User" ADD COLUMN "acceptedTermsAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "marketingConsent" BOOLEAN NOT NULL DEFAULT false;
```

### 5.4 Zustand Store Changes

**Location:** `quikadmin-web/src/stores/backendAuthStore.ts`

```typescript
interface AuthState {
  // existing...
  serverLockout: {
    isLocked: boolean;
    attemptsRemaining: number;
    lockoutExpiresAt: Date | null;
  } | null;
}
```

---

## 6. Implementation Tasks

### 6.1 Phase A: Testability (Effort: 1 hour)

| Task | File | Estimate |
|------|------|----------|
| A1: Add login form test IDs | Login.tsx | 15 min |
| A2: Add verify-email test IDs | VerifyEmail.tsx | 15 min |
| A3: Add accept-invite test IDs | AcceptInvitePage.tsx | 10 min |
| A4: Add password toggle test IDs | Login.tsx, Register.tsx, ResetPassword.tsx | 15 min |
| A5: Add remember-me test ID | Login.tsx | 5 min |

### 6.2 Phase B: Compliance (Effort: 1 hour)

| Task | File | Estimate |
|------|------|----------|
| B1: Add consent fields to schema | prisma/schema.prisma | 10 min |
| B2: Generate and apply migration | CLI | 5 min |
| B3: Update register endpoint | supabase-auth.routes.ts | 20 min |
| B4: Update register request type | authService.ts | 10 min |
| B5: Update Register.tsx form submission | Register.tsx | 15 min |

### 6.3 Phase C: Security (Effort: 3 hours)

| Task | File | Estimate |
|------|------|----------|
| C1: Create lockout service | src/services/lockout.service.ts | 45 min |
| C2: Add Redis connection helper | src/utils/redis.ts | 15 min |
| C3: Integrate lockout with login | supabase-auth.routes.ts | 30 min |
| C4: Add fixed timing to error responses | supabase-auth.routes.ts | 15 min |
| C5: Update frontend to show lockout | Login.tsx | 30 min |
| C6: Update Zustand store | backendAuthStore.ts | 20 min |
| C7: Add lockout service tests | tests/lockout.service.test.ts | 45 min |

### 6.4 Phase D: Demo Login (Effort: 45 min)

| Task | File | Estimate |
|------|------|----------|
| D1: Add demo button to Login.tsx | Login.tsx | 15 min |
| D2: Add demo login handler | Login.tsx | 15 min |
| D3: Add VITE_ENABLE_DEMO to .env.example | quikadmin-web/.env.example | 5 min |
| D4: Add CI check for demo flag | .github/workflows/deploy.yml | 10 min |

### 6.5 Phase E: UX Polish (Effort: 1 hour)

| Task | File | Estimate |
|------|------|----------|
| E1: Create PasswordVisibilityToggle | components/auth/PasswordVisibilityToggle.tsx | 30 min |
| E2: Replace toggle implementations | Login.tsx, Register.tsx, ResetPassword.tsx | 20 min |
| E3: Add color-coded attempt warnings | Login.tsx | 10 min |

### 6.6 Total Effort

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| A: Testability | 1 hour | None |
| B: Compliance | 1 hour | None |
| C: Security | 3 hours | Redis available |
| D: Demo Login | 45 min | Phase A |
| E: UX Polish | 1 hour | Phase C |

**Total: ~7 hours implementation**

---

## 7. Testing Requirements

### 7.1 Unit Tests

| Test | File |
|------|------|
| Lockout service - record attempt | lockout.service.test.ts |
| Lockout service - check lockout | lockout.service.test.ts |
| Lockout service - clear on success | lockout.service.test.ts |
| Lockout service - Redis fallback | lockout.service.test.ts |

### 7.2 Integration Tests

| Test | File |
|------|------|
| Login with lockout flow | auth.integration.test.ts |
| Registration with consent | auth.integration.test.ts |
| Demo login | auth.integration.test.ts |

### 7.3 E2E Tests

| Test | File |
|------|------|
| Login flow | e2e/tests/auth/login.spec.ts |
| Registration flow | e2e/tests/auth/register.spec.ts |
| Password reset flow | e2e/tests/auth/reset-password.spec.ts |
| Email verification flow | e2e/tests/auth/verify-email.spec.ts |
| Demo login flow | e2e/tests/auth/demo-login.spec.ts |

---

## 8. Rollout Plan

### 8.1 Phase 1: Testability + Compliance (Low Risk)

1. Deploy migration (add nullable consent fields)
2. Deploy backend changes (consent storage)
3. Deploy frontend changes (test IDs + consent passing)
4. Verify E2E tests pass with new selectors

### 8.2 Phase 2: Security (Medium Risk)

1. Deploy lockout service (disabled behind feature flag)
2. Enable lockout in staging, run load tests
3. Enable lockout in production with monitoring
4. Monitor for false positives (legitimate user lockouts)

### 8.3 Phase 3: Demo Login (Low Risk)

1. Ensure VITE_ENABLE_DEMO=false in production
2. Deploy demo button code
3. Enable in staging for testing
4. Keep disabled in production unless marketing requests

---

## 9. Success Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| E2E test reliability | 85% pass rate | 99% pass rate | CI metrics |
| Brute-force attempts blocked | 0% | 100% after 5 attempts | Lockout logs |
| Consent data coverage | 0% of users | 100% of new users | DB query |
| Demo engagement | N/A | Track if enabled | Analytics |

---

## 10. Open Questions

| Question | Owner | Status |
|----------|-------|--------|
| Should lockout duration increase for repeat offenders? | Security | Deferred to v2 |
| Should we add reCAPTCHA after N attempts? | Product | Deferred |
| Do we need consent version tracking? | Legal | Deferred to v2 |

---

## 11. Appendix

### A. Related Documents

- Phase 4: Runtime Validation Report
- Phase 5: AS-IS End-to-End Mapping
- Phase 6: TO-BE Design + ADRs
- Phase 7: Adversarial Review Panel

### B. Glossary

| Term | Definition |
|------|------------|
| Lockout | Temporary account access restriction after failed attempts |
| data-testid | HTML attribute for E2E test element selection |
| Consent | User agreement to terms/marketing communications |

---

**Document Status:** Ready for Implementation
**Next Step:** Phase 9 - Create TaskMaster tasks and implement
