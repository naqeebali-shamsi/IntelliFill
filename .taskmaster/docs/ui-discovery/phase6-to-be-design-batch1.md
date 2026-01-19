# Phase 6: TO-BE Design + ADR - Batch 1 (Auth & Security)

**Generated:** 2026-01-09
**Project:** IntelliFill
**Batch:** 1 - Authentication & Security (Critical Priority)

---

## Executive Summary

This document outlines targeted improvements for the 13 auth elements analyzed in Phases 4-5. Focus areas:
1. **Testability** - Add missing data-testid attributes
2. **Security** - Server-side lockout, consent persistence
3. **UX Consistency** - Standardize password visibility toggle
4. **Compliance** - Persist terms/marketing consent
5. **Feature Gap** - Demo login UI missing

**Total Improvements:** 24 discrete changes
**Breaking Changes:** 0
**ADRs Required:** 2

---

## Gap Analysis Summary

| Issue | AS-IS | TO-BE | Priority | Effort |
|-------|-------|-------|----------|--------|
| Client-side lockout | Bypassable via state reset | Server-side lockout with Redis | High | Medium |
| Terms consent storage | Not persisted | Store in User model with timestamp | Medium | Low |
| Marketing consent | Not persisted | Store in User model | Low | Low |
| Test ID coverage | 8/15 elements have data-testid | 15/15 coverage | High | Low |
| Password toggle variants | 3 different implementations | Unified component | Low | Low |
| Demo login button | Backend exists, no UI | Add conditional UI button | Low | Low |
| Login rate limit visibility | No UI feedback on approach | Show warning at N-2 attempts | Medium | Low |

---

## Element-by-Element TO-BE Design

### 1. auth-login-form

**Current Issues:**
- No `data-testid` on form element
- Client-side lockout can be bypassed
- No server-side failed attempt tracking

**TO-BE Changes:**

| Change | Type | File | Details |
|--------|------|------|---------|
| Add data-testid="login-form" | Testability | Login.tsx:198 | Add attribute to form tag |
| Add data-testid="login-submit-button" | Testability | Login.tsx:363 | Add attribute to submit button |
| Add data-testid="login-email-input" | Testability | Login.tsx:267 | Add attribute to email input |
| Add data-testid="login-password-input" | Testability | Login.tsx:301 | Add attribute to password input |
| Add server-side lockout | Security | supabase-auth.routes.ts | Track failed attempts in Redis, return lockout info in response |

**Server-side Lockout Implementation:**

```typescript
// TO-BE: Redis key pattern
const lockoutKey = `lockout:${email.toLowerCase()}`;

// TO-BE: Response on failed login
{
  success: false,
  error: {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
    attemptsRemaining: 3, // NEW
    lockoutAt: 5           // NEW
  }
}

// TO-BE: Response when locked
{
  success: false,
  error: {
    code: 'ACCOUNT_LOCKED',
    message: 'Too many failed attempts. Please try again later.',
    lockoutExpiresAt: '2026-01-09T12:30:00Z' // NEW
  }
}
```

---

### 2. auth-register-form

**Current Issues:**
- Terms acceptance (`acceptedTermsAt`) not stored
- Marketing consent not persisted in Prisma

**TO-BE Changes:**

| Change | Type | File | Details |
|--------|------|------|---------|
| Add `acceptedTermsAt` column | Compliance | schema.prisma | DateTime field on User model |
| Add `marketingConsent` column | Compliance | schema.prisma | Boolean field on User model |
| Store consent on registration | Backend | supabase-auth.routes.ts | Pass values to Prisma create |

**Schema Addition:**

```prisma
// TO-BE: Add to User model in schema.prisma
model User {
  // existing fields...
  acceptedTermsAt   DateTime?  // NEW - Compliance requirement
  marketingConsent  Boolean    @default(false) // NEW
}
```

---

### 3. auth-logout

**Current Issues:**
- No data-testid (already has `logout-button`)
- Works correctly

**TO-BE Changes:**

| Change | Type | File | Details |
|--------|------|------|---------|
| No changes needed | - | - | Element fully compliant |

---

### 4. auth-forgot-password-form

**Current Issues:**
- All test IDs present - compliant

**TO-BE Changes:**

| Change | Type | File | Details |
|--------|------|------|---------|
| No changes needed | - | - | Element fully compliant |

---

### 5. auth-reset-password-form

**Current Issues:**
- All test IDs present - compliant

**TO-BE Changes:**

| Change | Type | File | Details |
|--------|------|------|---------|
| No changes needed | - | - | Element fully compliant |

---

### 6. auth-verify-email-form

**Current Issues:**
- No `data-testid` on form element

**TO-BE Changes:**

| Change | Type | File | Details |
|--------|------|------|---------|
| Add data-testid="verify-email-form" | Testability | VerifyEmail.tsx:173 | Add attribute to form tag |
| Add data-testid="verify-email-code-input" | Testability | VerifyEmail.tsx | Add attribute to code input |
| Add data-testid="verify-email-submit-button" | Testability | VerifyEmail.tsx | Add attribute to submit button |

---

### 7. auth-resend-verification

**Current Issues:**
- No `data-testid` on button

**TO-BE Changes:**

| Change | Type | File | Details |
|--------|------|------|---------|
| Add data-testid="resend-verification-button" | Testability | VerifyEmail.tsx:256 | Add attribute to resend button |

---

### 8. auth-demo-login

**Current Issues:**
- Backend endpoint exists, no UI button
- Feature gated by ENABLE_DEMO_MODE env var

**TO-BE Changes:**

| Change | Type | File | Details |
|--------|------|------|---------|
| Add conditional demo button | Feature | Login.tsx | Render button when VITE_ENABLE_DEMO=true |
| Add data-testid="demo-login-button" | Testability | Login.tsx | Add attribute to demo button |

**UI Implementation:**

```tsx
// TO-BE: Add in Login.tsx (after form, before register link)
{import.meta.env.VITE_ENABLE_DEMO === 'true' && (
  <Button
    type="button"
    variant="outline"
    data-testid="demo-login-button"
    onClick={handleDemoLogin}
    className="w-full mt-4"
    disabled={isLoading}
  >
    Try Demo Account
  </Button>
)}
```

---

### 9. auth-remember-me-toggle

**Current Issues:**
- No `data-testid` attribute

**TO-BE Changes:**

| Change | Type | File | Details |
|--------|------|------|---------|
| Add data-testid="remember-me-checkbox" | Testability | Login.tsx:335 | Add attribute to checkbox |

---

### 10. auth-terms-toggle

**Current Issues:**
- Has `data-testid="terms-checkbox"` - compliant

**TO-BE Changes:**

| Change | Type | File | Details |
|--------|------|------|---------|
| No changes needed | - | - | Element fully compliant |

---

### 11. auth-marketing-toggle

**Current Issues:**
- Has `data-testid="marketing-checkbox"` - compliant

**TO-BE Changes:**

| Change | Type | File | Details |
|--------|------|------|---------|
| No changes needed | - | - | Element fully compliant |

---

### 12. auth-password-visibility-toggle

**Current Issues:**
- Three different implementations (Login, Register, ResetPassword)
- No `data-testid` on any

**TO-BE Changes:**

| Change | Type | File | Details |
|--------|------|------|---------|
| Add data-testid="toggle-password-visibility" | Testability | Login.tsx:317 | Add attribute |
| Add data-testid="toggle-password-visibility" | Testability | Register.tsx:361 | Add attribute |
| Add data-testid="toggle-password-visibility" | Testability | ResetPassword.tsx:236 | Add attribute |
| Add data-testid="toggle-confirm-password-visibility" | Testability | ResetPassword.tsx | Add for confirm field |
| Standardize on SleekIconButton | Consistency | All auth pages | Use same component pattern |

**Standardized Implementation:**

```tsx
// TO-BE: Unified PasswordVisibilityToggle pattern
<SleekIconButton
  type="button"
  variant="ghost"
  data-testid="toggle-password-visibility"
  aria-label={showPassword ? 'Hide password' : 'Show password'}
  onClick={() => setShowPassword(!showPassword)}
  tabIndex={-1}
>
  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
</SleekIconButton>
```

---

### 13. invite-accept-mutation

**Current Issues:**
- No `data-testid` on accept/decline buttons

**TO-BE Changes:**

| Change | Type | File | Details |
|--------|------|------|---------|
| Add data-testid="accept-invite-button" | Testability | AcceptInvitePage.tsx:293 | Add attribute to accept button |
| Add data-testid="decline-invite-button" | Testability | AcceptInvitePage.tsx | Add attribute to decline button |

---

## Architecture Decision Records

### ADR-001: Server-Side Login Lockout

**Status:** Proposed

**Context:**
The current login lockout mechanism is implemented client-side only in the Zustand auth store. Users can bypass this by clearing localStorage, using incognito mode, or refreshing the page.

**Decision:**
Implement server-side login attempt tracking using Redis with the following behavior:
- Track failed attempts per email address (not per IP to avoid shared network issues)
- Lock after 5 failed attempts
- Lockout duration: 15 minutes (exponential backoff for repeat offenders optional)
- Return attempts remaining in API response
- Reset counter on successful login

**Consequences:**
- **Positive:** Actual brute-force protection, consistent across clients
- **Positive:** Works regardless of client state
- **Negative:** Requires Redis (already a dependency for Bull queues)
- **Negative:** Slight increase in login latency (Redis read/write)

**Implementation:**
```typescript
// Key structure
`lockout:${email}` -> { attempts: number, lockedUntil?: timestamp }

// TTL: 15 minutes from first failed attempt
// Reset on successful login
```

---

### ADR-002: Terms and Marketing Consent Persistence

**Status:** Proposed

**Context:**
Legal compliance (GDPR, CCPA) requires evidence that users consented to terms of service at registration. Currently, the `agreedToTerms` and `marketingConsent` values are passed to the backend but not persisted.

**Decision:**
Add two new columns to the User model:
- `acceptedTermsAt: DateTime?` - Timestamp of terms acceptance
- `marketingConsent: Boolean @default(false)` - Marketing opt-in status

These will be populated during registration and can be audited later.

**Consequences:**
- **Positive:** Legal compliance for GDPR/CCPA
- **Positive:** Audit trail for consent
- **Positive:** Enables future consent management UI
- **Negative:** Migration required (non-breaking, nullable field)

**Implementation:**
```prisma
// Migration: add_consent_fields
model User {
  acceptedTermsAt   DateTime?
  marketingConsent  Boolean    @default(false)
}
```

---

## Implementation Roadmap

### Phase 6A: Testability (Low Risk, High Value)

| Task | Files | Effort |
|------|-------|--------|
| Add login form test IDs | Login.tsx | 15 min |
| Add verify-email test IDs | VerifyEmail.tsx | 10 min |
| Add resend-verification test ID | VerifyEmail.tsx | 5 min |
| Add remember-me test ID | Login.tsx | 5 min |
| Add password visibility test IDs | Login.tsx, Register.tsx, ResetPassword.tsx | 15 min |
| Add invite accept/decline test IDs | AcceptInvitePage.tsx | 10 min |

**Total: ~1 hour**

### Phase 6B: Compliance (Medium Risk, High Value)

| Task | Files | Effort |
|------|-------|--------|
| Add consent fields to schema | schema.prisma | 10 min |
| Generate and apply migration | CLI | 5 min |
| Update register endpoint | supabase-auth.routes.ts | 20 min |
| Add consent to register request | authService.ts, Register.tsx | 15 min |

**Total: ~1 hour**

### Phase 6C: Security (Medium Risk, High Value)

| Task | Files | Effort |
|------|-------|--------|
| Create Redis lockout service | src/services/lockout.service.ts | 45 min |
| Integrate with login endpoint | supabase-auth.routes.ts | 30 min |
| Update frontend to show attempts remaining | Login.tsx | 30 min |
| Add tests for lockout | tests/auth/lockout.test.ts | 45 min |

**Total: ~2.5 hours**

### Phase 6D: Feature Gap (Low Risk, Low Value)

| Task | Files | Effort |
|------|-------|--------|
| Add demo login button | Login.tsx | 20 min |
| Add VITE_ENABLE_DEMO env var | quikadmin-web/.env.example | 5 min |
| Add demo login handler | Login.tsx | 15 min |

**Total: ~40 minutes**

### Phase 6E: UX Consistency (Low Risk, Low Value)

| Task | Files | Effort |
|------|-------|--------|
| Create PasswordVisibilityToggle component | src/components/ui/PasswordVisibilityToggle.tsx | 30 min |
| Replace implementations in auth pages | Login.tsx, Register.tsx, ResetPassword.tsx | 30 min |

**Total: ~1 hour**

---

## Test ID Coverage Matrix (TO-BE)

| Element | data-testid (TO-BE) |
|---------|---------------------|
| Login form | `login-form` |
| Login email input | `login-email-input` |
| Login password input | `login-password-input` |
| Login submit button | `login-submit-button` |
| Remember me checkbox | `remember-me-checkbox` |
| Password visibility (login) | `toggle-password-visibility` |
| Demo login button | `demo-login-button` |
| Register form | `register-form` (existing) |
| Register email input | `register-email-input` (existing) |
| Register password input | `register-password-input` (existing) |
| Register confirm password | `register-confirm-password-input` (existing) |
| Register submit button | `register-submit-button` (existing) |
| Terms checkbox | `terms-checkbox` (existing) |
| Marketing checkbox | `marketing-checkbox` (existing) |
| Login link (register) | `login-link` (existing) |
| Forgot password form | `forgot-password-form` (existing) |
| Forgot password email | `forgot-password-email-input` (existing) |
| Forgot password submit | `forgot-password-submit-button` (existing) |
| Forgot password back link | `forgot-password-back-link` (existing) |
| Reset password form | `reset-password-form` (existing) |
| Reset password input | `reset-password-input` (existing) |
| Reset confirm password | `reset-password-confirm-input` (existing) |
| Reset password submit | `reset-password-submit-button` (existing) |
| Password strength indicator | `password-strength-indicator` (existing) |
| Verify email form | `verify-email-form` |
| Verify email code input | `verify-email-code-input` |
| Verify email submit | `verify-email-submit-button` |
| Resend verification button | `resend-verification-button` |
| Logout button | `logout-button` (existing) |
| Accept invite button | `accept-invite-button` |
| Decline invite button | `decline-invite-button` |

**Coverage: 31 test IDs (15 existing + 16 new)**

---

## Risk Assessment

| Change | Risk Level | Mitigation |
|--------|------------|------------|
| Add data-testid attributes | Very Low | No behavioral change, additive only |
| Add consent columns | Low | Nullable fields, backward compatible |
| Server-side lockout | Medium | Feature flag, extensive testing |
| Demo login button | Very Low | Behind env var flag |
| Password toggle standardization | Low | Visual parity testing |

---

## Acceptance Criteria

### For Testability Improvements
- [ ] All 31 test IDs are present in DOM
- [ ] Existing E2E tests continue to pass
- [ ] New auth E2E tests can target elements reliably

### For Compliance Improvements
- [ ] Registration persists `acceptedTermsAt` timestamp
- [ ] Registration persists `marketingConsent` boolean
- [ ] Existing users unaffected (nullable migration)

### For Security Improvements
- [ ] Failed login attempts tracked server-side
- [ ] Account locks after 5 failures
- [ ] Lockout expires after 15 minutes
- [ ] Successful login resets counter
- [ ] UI shows attempts remaining when < 3

### For Demo Login
- [ ] Demo button only visible when VITE_ENABLE_DEMO=true
- [ ] Demo login successfully authenticates to demo account
- [ ] Demo session has appropriate restrictions

---

## Dependencies

| Improvement | Depends On |
|-------------|------------|
| Server-side lockout | Redis (existing) |
| Consent persistence | Prisma migration |
| Demo login UI | VITE_ENABLE_DEMO env var, backend demo endpoint (existing) |

---

**Phase 6 Status:** COMPLETE
**Next Phase:** Phase 7 - Adversarial Review Panel
