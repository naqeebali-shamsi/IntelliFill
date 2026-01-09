# PRD: Authentication Flow E2E Test Fixes

**Document Version:** 1.0
**Status:** Draft
**Priority:** HIGH
**Created:** 2026-01-09
**Author:** AI Development Agent
**Stakeholders:** Frontend Team, QA Team, DevOps

---

## Executive Summary

### Problem Statement

The IntelliFill E2E test suite has critical failures in authentication flow tests. The tests cannot reliably locate and interact with UI elements due to missing `data-testid` attributes, fragile DOM traversal patterns, and accessibility issues with the logout button when the sidebar is collapsed.

### Solution Overview

This PRD defines targeted fixes to the authentication UI components to ensure E2E tests can reliably:
1. Locate and click the logout button in all viewport states
2. Verify session persistence via localStorage
3. Navigate the password reset flow
4. Validate registration form requirements

### Business Impact

- **Test Reliability:** Eliminates flaky E2E tests, reducing CI/CD pipeline failures
- **Developer Productivity:** Clear, stable selectors reduce test maintenance overhead
- **Quality Assurance:** Enables comprehensive regression testing of critical auth flows
- **Time to Market:** Unblocks release pipeline blocked by failing auth tests

### Resource Requirements

- **Frontend Development:** 4-6 hours
- **QA Validation:** 2 hours
- **Files Affected:** 4-6 frontend components

### Risk Assessment

- **Low Risk:** Changes are additive (data-testid attributes) or UI improvements
- **No Backend Changes:** All fixes are frontend-only
- **Backward Compatible:** No breaking changes to existing functionality

---

## Product Overview

### Product Vision

IntelliFill requires robust, testable authentication flows that work reliably across all device viewports (desktop, tablet, mobile). The authentication UI must be accessible, testable, and provide consistent behavior regardless of sidebar state.

### Target Users

1. **E2E Test Suite:** Playwright tests that verify authentication flows
2. **End Users:** PRO agency staff logging in/out of the application
3. **QA Engineers:** Manual testers verifying auth functionality

### Value Proposition

By adding stable test selectors and improving UI accessibility:
- E2E tests become deterministic (no flaky failures)
- Tests are resilient to CSS/layout changes
- Accessibility improves for keyboard/screen reader users
- Debug sessions are faster with clear element identification

### Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| E2E Auth Test Pass Rate | 100% | All auth.spec.ts tests pass |
| Logout Button Accessibility | Always Clickable | Logout visible in all viewport states |
| Session Persistence | Verified | localStorage contains expected keys |
| Password Reset Flow | Complete | Full flow testable end-to-end |

### Assumptions

1. Backend auth endpoints are stable and working correctly
2. E2E test infrastructure (Playwright, seeded users) is functioning
3. No changes needed to authentication business logic
4. Current localStorage key `intellifill-backend-auth` is the source of truth

---

## Functional Requirements

### FR-1: Logout Button Test Selectors and Accessibility

**Priority:** Critical
**Complexity:** Low

#### Current State Analysis

The logout button in `AppLayout.tsx` (lines 162-174):
- Is hidden when sidebar is collapsed (`!collapsed && (...)`)
- Has no `data-testid` attribute
- Requires complex DOM traversal to locate in tests

Current E2E test approach (auth.spec.ts lines 86-89):
```typescript
const userEmailElement = page.getByText(TEST_USERS.user.email);
const userSection = userEmailElement.locator('..').locator('..');
const logoutButton = userSection.getByRole('button');
await logoutButton.click();
```

This approach is fragile because:
- DOM structure changes break the test
- Sidebar collapse hides the button entirely
- Mobile view may have different structure

#### Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-1.1 | Add `data-testid="logout-button"` to logout button | Attribute present on Button element |
| FR-1.2 | Logout button visible when sidebar collapsed | Button accessible in collapsed state |
| FR-1.3 | Logout accessible on mobile via sheet menu | Button in mobile sheet content |
| FR-1.4 | Add aria-label for accessibility | `aria-label="Logout"` present |

#### User Stories

**US-1.1: E2E Test Logout Selection**
```
As an E2E test
I want to locate the logout button via data-testid
So that the test is resilient to UI changes

Acceptance Criteria:
Given I am on any authenticated page
When I query for [data-testid="logout-button"]
Then I should find exactly one element
And clicking it should trigger logout
```

**US-1.2: Collapsed Sidebar Logout**
```
As a user with collapsed sidebar
I want to access the logout function
So that I can log out without expanding the sidebar

Acceptance Criteria:
Given the sidebar is collapsed
When I look at the user profile section
Then I should see a logout button (icon-only)
And clicking it should log me out
```

**US-1.3: Mobile Logout Access**
```
As a mobile user
I want to log out from the mobile menu
So that I can end my session on mobile devices

Acceptance Criteria:
Given I am on a mobile viewport
When I open the mobile sheet menu
Then I should see a logout option
And clicking it should log me out
```

---

### FR-2: Session Persistence Verification

**Priority:** High
**Complexity:** Low

#### Current State Analysis

The `backendAuthStore.ts` uses Zustand persist middleware with key `intellifill-backend-auth`:

```typescript
{
  name: AUTH_STORAGE_KEY, // 'intellifill-backend-auth'
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    user: state.user,
    tokens: { expiresIn, tokenType }, // accessToken excluded for security
    tokenExpiresAt: state.tokenExpiresAt,
    sessionIndicator: state.isAuthenticated,
    rememberMe: state.rememberMe,
    isInitialized: state.isInitialized,
    lastActivity: state.lastActivity,
  }),
}
```

E2E test expectations (auth.spec.ts lines 148-157):
```typescript
await page.waitForFunction(() => {
  const auth = localStorage.getItem('intellifill-backend-auth');
  if (!auth) return false;
  try {
    const parsed = JSON.parse(auth);
    return parsed.state?.sessionIndicator === true || parsed.state?.isAuthenticated === true;
  } catch {
    return false;
  }
}, { timeout: 10000 });
```

#### Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-2.1 | Persist `sessionIndicator` property | Property saved to localStorage after login |
| FR-2.2 | Persist `isAuthenticated` for test compat | Property available (even if false after reload) |
| FR-2.3 | Persist `loadingStage` property | Property shows 'ready' after initialization |
| FR-2.4 | Persist `isInitialized` property | Property true after successful login |

#### User Stories

**US-2.1: Session Indicator Persistence**
```
As an E2E test verifying session persistence
I want localStorage to contain sessionIndicator=true after login
So that I can verify the session was established

Acceptance Criteria:
Given a user has successfully logged in
When I check localStorage['intellifill-backend-auth']
Then parsed.state.sessionIndicator should be true
```

**US-2.2: Loading Stage Ready State**
```
As an E2E test checking initialization
I want to verify the app is fully initialized
So that I can proceed with test actions

Acceptance Criteria:
Given the app has completed auth initialization
When I check localStorage['intellifill-backend-auth']
Then parsed.state.loadingStage should be 'ready'
```

---

### FR-3: Password Reset Flow (Already Implemented - Verification)

**Priority:** Medium
**Complexity:** Verification Only

#### Current State Analysis

The password reset flow is already implemented:
- `ForgotPassword.tsx` - Email submission page
- `ResetPassword.tsx` - New password entry with validation
- Routes configured in `App.tsx` lines 158-159

Login page has "Forgot password?" link (Login.tsx lines 257-262):
```tsx
<Link
  to="/forgot-password"
  className="text-sm text-primary hover:text-primary/80 transition-colors"
  tabIndex={-1}
>
  Forgot password?
</Link>
```

#### Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-3.1 | "Forgot password?" link exists on login | Link visible and navigates to /forgot-password |
| FR-3.2 | Add data-testid to forgot password link | `data-testid="forgot-password-link"` |
| FR-3.3 | Add data-testid to reset form elements | Email input, submit button have testids |
| FR-3.4 | Password validation visible on reset | Strength requirements displayed |

#### User Stories

**US-3.1: Navigate to Password Reset**
```
As an E2E test
I want to click "Forgot password?" and reach the reset page
So that I can test the password reset flow

Acceptance Criteria:
Given I am on the login page
When I click the link with data-testid="forgot-password-link"
Then I should navigate to /forgot-password
And I should see "Forgot password?" heading
```

**US-3.2: Submit Password Reset Request**
```
As an E2E test
I want to submit an email for password reset
So that I can verify the flow works

Acceptance Criteria:
Given I am on /forgot-password
When I enter an email and click submit
Then I should see a success message
And the page should show "Check your email"
```

---

### FR-4: Registration Form Validation

**Priority:** Medium
**Complexity:** Low

#### Current State Analysis

Registration form in `Register.tsx` includes:
- Terms checkbox (lines 426-449) - Uses `agreedToTerms` state
- Password strength validation with visual requirements (lines 365-397)
- Form validation before submit (lines 96-116)

Current test expectations need stable selectors for:
- Terms checkbox
- Validation error messages
- Password strength indicators

#### Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-4.1 | Add data-testid to terms checkbox | `data-testid="terms-checkbox"` |
| FR-4.2 | Add data-testid to registration form | `data-testid="register-form"` |
| FR-4.3 | Add data-testid to submit button | `data-testid="register-submit"` |
| FR-4.4 | Add data-testid to password requirements | `data-testid="password-requirements"` |
| FR-4.5 | Error messages have testable selectors | Errors in elements with role="alert" |

#### User Stories

**US-4.1: Verify Terms Checkbox Required**
```
As an E2E test
I want to verify registration requires terms acceptance
So that I can test form validation

Acceptance Criteria:
Given I am on the registration page
When I fill all fields except terms checkbox
Then the submit button should be disabled
And when I check terms, the button should enable
```

**US-4.2: Verify Password Strength Validation**
```
As an E2E test
I want to see password requirements update in real-time
So that I can verify the validation UI

Acceptance Criteria:
Given I am on the registration page
When I type in the password field
Then I should see requirement indicators update
And weak passwords should show unfulfilled requirements
```

---

## Non-Functional Requirements

### NFR-1: Performance

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| No render performance impact | <1ms additional | data-testid adds minimal DOM overhead |
| Test execution time | No increase | Stable selectors reduce retry/wait times |

### NFR-2: Security

| Requirement | Implementation |
|-------------|----------------|
| No sensitive data in testids | Use generic names (logout-button, not user-123) |
| Test attributes production-safe | data-testid can remain in production builds |

### NFR-3: Usability

| Requirement | Implementation |
|-------------|----------------|
| Logout accessible in all states | Icon-only button when collapsed |
| Keyboard navigation maintained | All buttons remain keyboard-accessible |

### NFR-4: Reliability

| Requirement | Target |
|-------------|--------|
| E2E test stability | 0% flaky failures on auth tests |
| Cross-browser compatibility | Chrome, Firefox, Safari, Edge |
| Viewport compatibility | 320px - 2560px width |

---

## Technical Requirements

### TR-1: Component Changes

#### AppLayout.tsx Changes

**File:** `quikadmin-web/src/components/layout/AppLayout.tsx`

**Change 1: Add data-testid to logout button (line 163)**

Current:
```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={async () => {
    await logout();
    navigate('/login');
  }}
  className="h-8 w-8 text-muted-foreground hover:text-destructive"
>
  <LogOut className="h-4 w-4" />
</Button>
```

Required:
```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={async () => {
    await logout();
    navigate('/login');
  }}
  className="h-8 w-8 text-muted-foreground hover:text-destructive"
  data-testid="logout-button"
  aria-label="Logout"
>
  <LogOut className="h-4 w-4" />
</Button>
```

**Change 2: Show logout button in collapsed state**

Current (line 162):
```tsx
{!collapsed && (
  <Button ...>
```

Required: Remove the `{!collapsed &&` wrapper OR add a separate icon-only button visible when collapsed:

```tsx
{/* Always show logout button, icon-only when collapsed */}
<Button
  variant="ghost"
  size="icon"
  onClick={async () => {
    await logout();
    navigate('/login');
  }}
  className="h-8 w-8 text-muted-foreground hover:text-destructive"
  data-testid="logout-button"
  aria-label="Logout"
  title="Logout"
>
  <LogOut className="h-4 w-4" />
</Button>
```

#### Login.tsx Changes

**File:** `quikadmin-web/src/pages/Login.tsx`

**Change: Add data-testid to forgot password link (line 257-262)**

Current:
```tsx
<Link
  to="/forgot-password"
  className="text-sm text-primary hover:text-primary/80 transition-colors"
  tabIndex={-1}
>
  Forgot password?
</Link>
```

Required:
```tsx
<Link
  to="/forgot-password"
  className="text-sm text-primary hover:text-primary/80 transition-colors"
  tabIndex={-1}
  data-testid="forgot-password-link"
>
  Forgot password?
</Link>
```

#### Register.tsx Changes

**File:** `quikadmin-web/src/pages/Register.tsx`

**Changes:**

1. Add `data-testid="register-form"` to form element (line 271)
2. Add `data-testid="terms-checkbox"` to terms Checkbox (line 426)
3. Add `data-testid="register-submit"` to submit Button (line 469)
4. Add `data-testid="password-requirements"` to requirements container (line 366)

```tsx
// Form element
<form onSubmit={handleSubmit} className="space-y-4" data-testid="register-form">

// Terms checkbox
<Checkbox
  id="terms"
  checked={agreedToTerms}
  onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
  disabled={isLoading}
  className="mt-0.5 border-sleek-line-default data-[state=checked]:bg-primary data-[state=checked]:border-primary"
  data-testid="terms-checkbox"
/>

// Submit button
<Button
  type="submit"
  className="w-full h-11 text-[15px] font-medium mt-2"
  disabled={isLoading || !agreedToTerms || passwordStrength.score < 4}
  data-testid="register-submit"
>

// Password requirements (wrap in container)
{formData.password && (
  <div className="space-y-2 mt-2" data-testid="password-requirements">
```

#### ForgotPassword.tsx Changes

**File:** `quikadmin-web/src/pages/ForgotPassword.tsx`

**Changes:**

1. Add `data-testid="forgot-password-form"` to form
2. Add `data-testid="forgot-password-email"` to email input
3. Add `data-testid="forgot-password-submit"` to submit button

```tsx
<form onSubmit={handleSubmit} data-testid="forgot-password-form">
  <Input
    id="email"
    name="email"
    data-testid="forgot-password-email"
    ...
  />
  <Button type="submit" data-testid="forgot-password-submit">
```

#### ResetPassword.tsx Changes

**File:** `quikadmin-web/src/pages/ResetPassword.tsx`

**Changes:**

1. Add `data-testid="reset-password-form"` to form
2. Add `data-testid="reset-password-input"` to password input
3. Add `data-testid="reset-password-confirm"` to confirm input
4. Add `data-testid="reset-password-submit"` to submit button
5. Add `data-testid="password-validation-errors"` to validation errors container

---

### TR-2: E2E Test Updates

**File:** `e2e/tests/auth.spec.ts`

Update logout test to use data-testid:

```typescript
test('should logout successfully', async ({ page }) => {
  // Login first
  await page.getByLabel(/email/i).fill(TEST_USERS.user.email);
  await page.getByLabel(/password/i).fill(TEST_USERS.user.password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for dashboard
  await page.waitForURL(/.*dashboard/, { timeout: 15000 });
  await expect(page.getByText(TEST_USERS.user.email)).toBeVisible({ timeout: 5000 });

  // Use stable data-testid selector instead of DOM traversal
  const logoutButton = page.getByTestId('logout-button');
  await logoutButton.click();

  // Should redirect to login page
  await page.waitForURL(/.*login/, { timeout: 10000 });
  await expect(page.getByText('Welcome back')).toBeVisible({ timeout: 5000 });
});
```

---

## Implementation Plan

### Phase 1: Critical Fixes (Day 1 - 2 hours)

| Task | File | Description | Effort |
|------|------|-------------|--------|
| 1.1 | AppLayout.tsx | Add data-testid to logout button | 10 min |
| 1.2 | AppLayout.tsx | Make logout visible when collapsed | 30 min |
| 1.3 | Login.tsx | Add data-testid to forgot password link | 5 min |
| 1.4 | auth.spec.ts | Update logout test to use data-testid | 15 min |
| 1.5 | - | Run E2E tests, verify logout test passes | 20 min |

### Phase 2: Registration Form (Day 1 - 1 hour)

| Task | File | Description | Effort |
|------|------|-------------|--------|
| 2.1 | Register.tsx | Add data-testid to form element | 5 min |
| 2.2 | Register.tsx | Add data-testid to terms checkbox | 5 min |
| 2.3 | Register.tsx | Add data-testid to submit button | 5 min |
| 2.4 | Register.tsx | Add data-testid to password requirements | 10 min |
| 2.5 | - | Verify registration E2E tests | 15 min |

### Phase 3: Password Reset Flow (Day 1 - 1 hour)

| Task | File | Description | Effort |
|------|------|-------------|--------|
| 3.1 | ForgotPassword.tsx | Add data-testids | 15 min |
| 3.2 | ResetPassword.tsx | Add data-testids | 15 min |
| 3.3 | - | Add password reset E2E test (optional) | 30 min |

### Phase 4: Session Persistence Verification (Day 1 - 30 min)

| Task | File | Description | Effort |
|------|------|-------------|--------|
| 4.1 | backendAuthStore.ts | Verify partialize includes required fields | 10 min |
| 4.2 | auth.spec.ts | Verify session persistence test passes | 20 min |

### Phase 5: Validation & Testing (Day 2 - 2 hours)

| Task | Description | Effort |
|------|-------------|--------|
| 5.1 | Run full E2E suite | 30 min |
| 5.2 | Test on mobile viewport | 30 min |
| 5.3 | Test collapsed sidebar logout | 15 min |
| 5.4 | Cross-browser verification | 30 min |
| 5.5 | Update test documentation | 15 min |

---

## Success Criteria

### Primary Criteria (Must Pass)

| ID | Criteria | Verification Method |
|----|----------|-------------------|
| SC-1 | Logout test passes with data-testid | `bun run test:e2e -- auth.spec.ts` |
| SC-2 | Session persistence test passes | Same as above |
| SC-3 | All auth.spec.ts tests pass | CI pipeline green |
| SC-4 | No regressions in other E2E tests | Full suite passes |

### Secondary Criteria (Should Pass)

| ID | Criteria | Verification Method |
|----|----------|-------------------|
| SC-5 | Logout works when sidebar collapsed | Manual test |
| SC-6 | Logout works on mobile viewport | E2E with mobile project |
| SC-7 | Password reset flow testable | Manual or new E2E test |

### Test Commands

```bash
# Run auth tests only
cd quikadmin-web && bun run test:e2e -- --grep "Authentication"

# Run with UI for debugging
bun run test:e2e:ui

# Run full suite
bun run test:e2e:auto
```

---

## Out of Scope

The following items are explicitly NOT in scope for this PRD:

1. **Backend Authentication Changes** - No changes to `/api/auth/v2/*` endpoints
2. **New Authentication Features** - No social login, MFA, or SSO additions
3. **Session Timeout UI** - No changes to session expiry handling
4. **Password Policy Changes** - Using existing password requirements
5. **Email Template Changes** - Password reset emails unchanged
6. **Admin Panel Auth** - Focus is on main application auth flows
7. **Rate Limiting UI** - No changes to lockout messaging
8. **Cookie/Token Storage Changes** - Using existing httpOnly cookie approach

---

## Dependencies

### Technical Dependencies

| Dependency | Type | Status | Risk |
|------------|------|--------|------|
| Playwright | E2E Testing | Installed | Low |
| E2E Test Users | Seeded Data | Available | Low |
| Backend Auth API | API | Stable | Low |
| Zustand Persist | State | Configured | Low |

### External Dependencies

| Dependency | Owner | Status |
|------------|-------|--------|
| CI/CD Pipeline | DevOps | Active |
| Test Environment | DevOps | Running |

---

## Risks and Mitigations

### Risk 1: Collapsed Sidebar Layout Change

**Risk:** Changing logout button visibility may affect sidebar layout
**Probability:** Medium
**Impact:** Low
**Mitigation:** Use icon-only button, maintain same height/padding

### Risk 2: Test Selector Conflicts

**Risk:** New data-testid might conflict with existing selectors
**Probability:** Low
**Impact:** Low
**Mitigation:** Search codebase for existing usage before adding

### Risk 3: Mobile Menu Behavior

**Risk:** Mobile sheet menu may need restructuring
**Probability:** Low
**Impact:** Medium
**Mitigation:** Mobile already uses non-collapsed SidebarContent

### Risk 4: Regression in Existing Tests

**Risk:** Changes could break other passing tests
**Probability:** Low
**Impact:** High
**Mitigation:** Run full E2E suite before merging

---

## Appendix

### A. Current File Locations

| Component | Path |
|-----------|------|
| AppLayout | `quikadmin-web/src/components/layout/AppLayout.tsx` |
| Login | `quikadmin-web/src/pages/Login.tsx` |
| Register | `quikadmin-web/src/pages/Register.tsx` |
| ForgotPassword | `quikadmin-web/src/pages/ForgotPassword.tsx` |
| ResetPassword | `quikadmin-web/src/pages/ResetPassword.tsx` |
| Auth Store | `quikadmin-web/src/stores/backendAuthStore.ts` |
| Auth Tests | `e2e/tests/auth.spec.ts` |
| Storage Key | `quikadmin-web/src/utils/migrationUtils.ts` |

### B. LocalStorage Schema

Key: `intellifill-backend-auth`

```json
{
  "state": {
    "user": { "id": "...", "email": "...", "firstName": "..." },
    "tokens": {
      "expiresIn": 3600,
      "tokenType": "Bearer"
    },
    "tokenExpiresAt": 1736500000000,
    "sessionIndicator": true,
    "rememberMe": false,
    "isInitialized": true,
    "lastActivity": 1736496400000
  },
  "version": 1
}
```

### C. E2E Test User Credentials

From `e2e/playwright.config.ts`:

```typescript
export const TEST_USERS = {
  user: {
    email: 'test@intellifill.local',
    password: 'Test123!@#',
  },
  admin: {
    email: 'admin@intellifill.local',
    password: 'Admin123!@#',
  },
};
```

### D. Related Documentation

- [Frontend CLAUDE.md](../../quikadmin-web/CLAUDE.md) - Frontend development context
- [E2E Testing Architecture](../../quikadmin-web/CLAUDE.md#e2e-testing-architecture) - Test patterns
- [Backend Auth API](../../docs/reference/api/) - API documentation

---

## Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-09 | AI Agent | Initial draft |

---

**End of Document**
