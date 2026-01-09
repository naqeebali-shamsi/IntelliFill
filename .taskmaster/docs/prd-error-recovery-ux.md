# PRD: Error Recovery and Security Feedback UI

**Document Version**: 1.0
**Status**: Draft
**Priority**: HIGH
**Author**: AI Product Specialist
**Created**: 2026-01-09
**Target Release**: Sprint 2026-Q1-W2

---

## Executive Summary

### Problem Statement

IntelliFill's E2E test suite is failing critical tests related to error recovery and security feedback UI. The application lacks proper user-facing error states for common scenarios including 404 Not Found pages, rate limiting lockout UI, API error recovery mechanisms, timeout handling, 403 Forbidden pages, and input validation feedback. Users encounter silent failures, confusing error states, or are exposed to technical stack traces instead of friendly, actionable error messages.

### Solution Overview

Implement a comprehensive error recovery and security feedback UI layer that provides:
1. Dedicated error pages (404, 403) with navigation options
2. Prominent rate limiting lockout UI with countdown timers
3. Retry buttons on all data fetch error states
4. Timeout handling with user feedback
5. Input validation with inline error messages and XSS protection feedback

### Business Impact

| Metric | Current State | Target State |
|--------|---------------|--------------|
| E2E Test Pass Rate (Error Recovery) | 0% | 100% |
| User Support Tickets (Error Confusion) | High | Reduced 60% |
| Security Compliance | Partial | Full OWASP compliance |
| User Retry Success Rate | Unknown | Track and improve |

### Resource Requirements

- **Frontend Development**: 3-4 days
- **QA/Testing**: 1-2 days
- **Design Review**: 0.5 day
- **Total Estimated Effort**: 5-7 days

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing error handling | Medium | High | Incremental rollout, feature flags |
| Timer performance issues | Low | Medium | Use `useEffect` cleanup properly |
| Inconsistent UX across error types | Medium | Medium | Design system components |
| Stack trace exposure in production | High (current) | Critical | Environment-based rendering |

---

## Product Overview

### Product Vision

Create a robust, user-friendly error handling experience that guides users through recovery actions rather than leaving them stranded. Every error state should provide clear context about what happened and actionable next steps.

### Target Users

| User Type | Description | Primary Concerns |
|-----------|-------------|------------------|
| PRO Agency Staff | Daily IntelliFill users | Clear guidance on how to recover from errors |
| New Users | First-time users during onboarding | Confidence that errors are handled gracefully |
| Admin Users | Organization administrators | Security feedback visibility |

### Value Proposition

"IntelliFill handles errors gracefully, providing clear feedback and recovery options so you can continue your work without frustration or confusion."

### Success Criteria

| Criterion | Measurement | Target |
|-----------|-------------|--------|
| E2E Tests Pass | Automated test results | 100% pass rate |
| Error Recovery Rate | Analytics tracking | 70%+ users successfully recover |
| Stack Trace Exposure | Security audit | 0 exposures in production |
| Time to Recovery | User session analytics | < 30 seconds average |

### Assumptions

1. Backend API returns appropriate HTTP status codes (401, 403, 404, 429)
2. Rate limiting is enforced at 5 failed login attempts
3. Users have basic understanding of web navigation
4. Design system components (Alert, Button, Card) are available

---

## Functional Requirements

### FR-001: 404 Not Found Page

**Priority**: P0 - Critical

#### Description
Create a dedicated 404 Not Found page component that displays when users navigate to non-existent routes or resources.

#### User Stories

**US-001.1**: As a user, I want to see a clear "404 - Not Found" message when I navigate to a non-existent page, so I understand the page doesn't exist.

```
Given: I am a logged-in user
When: I navigate to "/documents/non-existent-id"
Then: I see a page displaying "404" and "Not Found" or "Page not found"
And: I see a "Go Home" or "Back to Dashboard" button
And: I do NOT see any stack traces or technical error details
```

**US-001.2**: As a user, I want a way to return to a safe location from the 404 page, so I can continue using the application.

```
Given: I am on the 404 page
When: I click "Go Home" button
Then: I am navigated to "/dashboard"
```

#### Acceptance Criteria
- [ ] Component renders when navigating to unknown routes
- [ ] Displays "404" prominently (heading or large text)
- [ ] Displays human-readable message containing "not found" (case-insensitive)
- [ ] Provides "Go Home" or equivalent navigation button
- [ ] Button navigates to /dashboard or / (root)
- [ ] No stack traces, error objects, or technical details visible
- [ ] Consistent styling with application design system
- [ ] Accessible (proper heading hierarchy, button labels)

#### Technical Specification

**File**: `quikadmin-web/src/pages/NotFoundPage.tsx`

```typescript
// Component structure
export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card>
        <CardHeader>
          <h1>404</h1>
          <p>Page not found</p>
        </CardHeader>
        <CardContent>
          <p>The page you're looking for doesn't exist or has been moved.</p>
          <Button onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Route Configuration** (App.tsx):
```typescript
// Add catch-all route at the end of Routes
<Route path="*" element={<NotFoundPage />} />
```

---

### FR-002: Rate Limiting Lockout UI

**Priority**: P0 - Critical

#### Description
Enhance the login page to display prominent lockout messaging when a user's account is locked due to multiple failed login attempts, including a live countdown timer.

#### User Stories

**US-002.1**: As a user who has been locked out, I want to see a clear "account locked" message, so I understand why I cannot log in.

```
Given: I have failed login 5 times
When: The login form is displayed
Then: I see an Alert with text containing "locked" or "too many attempts"
And: The Alert is prominent (not just a toast notification)
```

**US-002.2**: As a locked-out user, I want to see how much time remains until I can try again, so I know when to return.

```
Given: My account is locked for 15 minutes
When: I view the login page
Then: I see a countdown timer in format "MM:SS" or "X minutes remaining"
And: The timer updates every second
And: When timer reaches 0, the lockout UI disappears
```

**US-002.3**: As a user approaching lockout, I want to see how many attempts I have remaining, so I can be careful.

```
Given: I have failed login 3 times (2 attempts remaining before lockout)
When: I view the login page
Then: I see a warning message showing "2 attempts remaining"
```

**US-002.4**: As a locked-out user, I expect the login form to be disabled, so I don't waste time trying.

```
Given: My account is locked
When: I view the login form
Then: The email and password inputs are disabled
And: The submit button is disabled
And: The form shows visual indication of being locked
```

#### Acceptance Criteria
- [ ] Alert displays when `isLocked` is true and `lockExpiry` is in the future
- [ ] Alert contains text matching /locked|too many attempts/i
- [ ] Countdown timer displays remaining time in MM:SS or descriptive format
- [ ] Timer updates every second using `setInterval` with cleanup
- [ ] When timer expires, lockout state is cleared automatically
- [ ] Warning Alert shows remaining attempts when `loginAttempts > 0 && loginAttempts < 5`
- [ ] Form inputs (email, password) are disabled when locked
- [ ] Submit button is disabled when locked
- [ ] Lockout state persists across page refreshes (stored in localStorage)

#### Technical Specification

**Enhanced State** (backendAuthStore.ts - already exists):
```typescript
// Existing state
isLocked: boolean;
lockExpiry: number | null;
loginAttempts: number;
```

**Timer Hook** (new file: `hooks/useCountdownTimer.ts`):
```typescript
export function useCountdownTimer(endTime: number | null) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    if (!endTime) return;

    const updateTimer = () => {
      const remaining = Math.max(0, endTime - Date.now());
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        // Optionally trigger unlock callback
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  return {
    minutes: Math.floor(timeRemaining / 60000),
    seconds: Math.floor((timeRemaining % 60000) / 1000),
    isExpired: timeRemaining <= 0,
    totalMs: timeRemaining,
  };
}
```

**Login.tsx Modifications**:
```typescript
// Add prominent lockout Alert above form
{isLocked && lockExpiry && Date.now() < lockExpiry && (
  <Alert variant="destructive" className="mb-4">
    <Lock className="h-4 w-4" />
    <AlertTitle>Account Locked</AlertTitle>
    <AlertDescription>
      <p>Too many failed login attempts.</p>
      <p className="font-mono mt-2">
        Try again in: {formatTime(timeRemaining)}
      </p>
    </AlertDescription>
  </Alert>
)}

// Disable form inputs when locked
<Input
  disabled={isLoading || isAccountLocked}
  // ... other props
/>

// Disable submit button
<Button
  disabled={isLoading || isAccountLocked}
  type="submit"
>
  {isAccountLocked ? 'Account Locked' : 'Sign In'}
</Button>
```

---

### FR-003: Error Recovery Buttons

**Priority**: P0 - Critical

#### Description
Add "Try Again" or "Retry" buttons to all error states, including API fetch failures, network errors, and component errors. Ensure no stack traces are visible to users.

#### User Stories

**US-003.1**: As a user experiencing a data loading error, I want to see a "Retry" button, so I can attempt to load the data again.

```
Given: I am on the Document Library page
And: The API call to fetch documents fails
When: The error state is displayed
Then: I see a friendly error message (not a stack trace)
And: I see a "Retry" or "Try Again" button
And: Clicking the button re-attempts the data fetch
```

**US-003.2**: As a user, I want error messages to be helpful and non-technical, so I can understand what went wrong.

```
Given: An API error occurs
When: The error is displayed
Then: I see a message like "Failed to load documents. Please try again."
And: I do NOT see stack traces, error objects, or HTTP status codes
```

**US-003.3**: As a user who retries after an error, I want the operation to succeed if the issue was temporary.

```
Given: I see an error state with "Retry" button
And: The underlying issue has been resolved (network restored, etc.)
When: I click "Retry"
Then: The operation succeeds
And: The error state is replaced with the successful content
```

#### Acceptance Criteria
- [ ] All data fetching operations have error states with retry buttons
- [ ] Retry button triggers re-fetch of failed operation
- [ ] Error messages are user-friendly (no technical jargon)
- [ ] No stack traces visible in any error state
- [ ] Retry button shows loading state while retrying
- [ ] ErrorBoundary component includes "Try Again" button (already exists)
- [ ] API service layer catches errors and formats user-friendly messages

#### Technical Specification

**Error State Component** (new file: `components/features/ErrorState.tsx`):
```typescript
interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  showHomeButton?: boolean;
}

export function ErrorState({
  title = "Something went wrong",
  message = "An error occurred. Please try again.",
  onRetry,
  retryLabel = "Try Again",
  showHomeButton = false,
}: ErrorStateProps) {
  const navigate = useNavigate();

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <CardTitle className="text-center">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-muted-foreground">{message}</p>
        <div className="flex gap-2 justify-center">
          {onRetry && (
            <Button onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {retryLabel}
            </Button>
          )}
          {showHomeButton && (
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Usage in Pages**:
```typescript
// Example: DocumentLibrary.tsx
const { data, error, isLoading, refetch } = useDocuments();

if (error) {
  return (
    <ErrorState
      title="Failed to load documents"
      message="We couldn't retrieve your documents. Please check your connection and try again."
      onRetry={refetch}
    />
  );
}
```

---

### FR-004: Timeout Handling UI

**Priority**: P1 - High

#### Description
Display appropriate feedback when API requests take longer than expected or time out.

#### User Stories

**US-004.1**: As a user waiting for a slow operation, I want feedback that the system is still working, so I don't think it has frozen.

```
Given: I initiate a document upload
And: The operation takes longer than 5 seconds
When: The loading state is active
Then: I see a message like "This is taking longer than expected" or "Still processing..."
```

**US-004.2**: As a user experiencing a timeout, I want to know the operation failed and have option to retry.

```
Given: An API request times out (> 30 seconds)
When: The timeout error is caught
Then: I see a message containing "timeout" or "taking too long"
And: I see a "Retry" button
```

#### Acceptance Criteria
- [ ] Loading states show "taking longer" message after threshold (5s)
- [ ] Timeout errors display user-friendly timeout message
- [ ] Timeout errors include retry functionality
- [ ] Loading spinners have accessible loading indicators

#### Technical Specification

**Enhanced Loading Component** (`components/ui/LoadingState.tsx`):
```typescript
interface LoadingStateProps {
  message?: string;
  showExtendedMessage?: boolean;
  extendedMessageDelay?: number; // milliseconds
}

export function LoadingState({
  message = "Loading...",
  showExtendedMessage = true,
  extendedMessageDelay = 5000,
}: LoadingStateProps) {
  const [isExtended, setIsExtended] = useState(false);

  useEffect(() => {
    if (!showExtendedMessage) return;

    const timeout = setTimeout(() => {
      setIsExtended(true);
    }, extendedMessageDelay);

    return () => clearTimeout(timeout);
  }, [showExtendedMessage, extendedMessageDelay]);

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">{message}</p>
      {isExtended && (
        <p className="mt-2 text-sm text-muted-foreground">
          This is taking longer than expected...
        </p>
      )}
    </div>
  );
}
```

**API Timeout Configuration** (services/api.ts):
```typescript
// Add timeout to axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 second timeout
  timeoutErrorMessage: 'Request timed out. Please try again.',
});

// Error interceptor to format timeout errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return Promise.reject({
        ...error,
        userMessage: 'The request took too long. Please check your connection and try again.',
        isTimeout: true,
      });
    }
    return Promise.reject(error);
  }
);
```

---

### FR-005: 403 Forbidden Page

**Priority**: P1 - High

#### Description
Create a dedicated 403 Forbidden page component that displays when users attempt to access resources they don't have permission for.

#### User Stories

**US-005.1**: As a user without permission, I want to see a clear "Access Denied" message, so I understand I'm not authorized.

```
Given: I am a logged-in user without admin role
When: I navigate to "/admin/settings" (admin-only route)
Then: I see a page displaying "403" or "Access Denied" or "Forbidden"
And: I see a message explaining I don't have permission
And: I see navigation options to return to safe location
```

#### Acceptance Criteria
- [ ] Component renders for 403 authorization errors
- [ ] Displays "403", "Forbidden", "Access Denied", "Unauthorized", or "Permission" in content
- [ ] Provides "Go Home" or "Go Back" navigation button
- [ ] No stack traces or technical details visible
- [ ] Optionally shows contact support option for permission requests

#### Technical Specification

**File**: `quikadmin-web/src/pages/ForbiddenPage.tsx`

```typescript
export default function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 rounded-full bg-destructive/10 p-4">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">403 - Access Denied</CardTitle>
          <CardDescription>
            You don't have permission to access this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            If you believe this is a mistake, please contact your administrator.
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => navigate(-1)} variant="outline">
              Go Back
            </Button>
            <Button onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**API Error Handling**:
```typescript
// In API interceptor or protected route
if (error.response?.status === 403) {
  navigate('/forbidden');
}
```

---

### FR-006: Input Validation Feedback

**Priority**: P1 - High

#### Description
Provide immediate, inline validation feedback for form inputs, including protection against XSS payloads with user-visible warnings.

#### User Stories

**US-006.1**: As a user entering an invalid email, I want immediate feedback showing the error, so I can correct it before submitting.

```
Given: I am filling out the registration form
When: I type "invalid-email" in the email field
And: I move focus to the next field
Then: I see an inline error message under the email field
And: The message contains "email" and indicates it's invalid
```

**US-006.2**: As a security-aware system, when a user enters potentially malicious input, I want to show a warning and sanitize the input.

```
Given: I enter "<script>alert('xss')</script>" in a text field
When: I submit the form
Then: The script is NOT executed
And: I may see a warning about "invalid characters" or input being sanitized
And: The form either rejects the input or escapes it safely
```

**US-006.3**: As a user, I want password strength feedback, so I can create a secure password.

```
Given: I am on the registration page
When: I type a password
Then: I see real-time feedback about password strength
And: I see requirements (minimum length, complexity)
```

#### Acceptance Criteria
- [ ] Email fields show inline validation errors for invalid format
- [ ] Required fields show error when empty on blur or submit
- [ ] XSS payloads are escaped/sanitized (no script execution)
- [ ] Potentially malicious input shows warning message
- [ ] Password fields show strength indicator
- [ ] Validation errors are accessible (aria-describedby)
- [ ] Forms do not submit with validation errors

#### Technical Specification

**Input Validation Schema** (lib/validations/auth.ts):
```typescript
import { z } from 'zod';

// XSS pattern detection
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<\s*img[^>]+onerror/gi,
];

const sanitizeInput = (value: string) => {
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

const hasSuspiciousContent = (value: string) => {
  return XSS_PATTERNS.some(pattern => pattern.test(value));
};

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const textInputSchema = z
  .string()
  .refine(
    (val) => !hasSuspiciousContent(val),
    { message: 'Input contains invalid characters that have been removed for security.' }
  )
  .transform(sanitizeInput);
```

**Form Input Component Enhancement**:
```typescript
// Enhanced Input with validation display
interface FormInputProps extends InputProps {
  error?: string;
  showValidation?: boolean;
}

export function FormInput({ error, showValidation, ...props }: FormInputProps) {
  return (
    <div className="space-y-1">
      <Input
        {...props}
        aria-invalid={!!error}
        aria-describedby={error ? `${props.id}-error` : undefined}
        className={cn(props.className, error && 'border-destructive')}
      />
      {error && (
        <p
          id={`${props.id}-error`}
          className="text-sm text-destructive flex items-center gap-1"
        >
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}
```

---

## Non-Functional Requirements

### NFR-001: Performance

| Requirement | Specification |
|-------------|---------------|
| Countdown timer CPU usage | < 1% CPU for timer updates |
| Error page load time | < 100ms TTI |
| Form validation feedback | < 50ms response time |
| Memory usage for timers | Proper cleanup prevents memory leaks |

### NFR-002: Security

| Requirement | Specification |
|-------------|---------------|
| Stack trace exposure | Never in production |
| XSS prevention | All user input sanitized |
| Error message information leakage | No sensitive data in error messages |
| Rate limit bypass prevention | Client-side lockout matches server |

### NFR-003: Usability

| Requirement | Specification |
|-------------|---------------|
| Error message clarity | 8th-grade reading level |
| Action discoverability | Primary action button always visible |
| Color contrast | WCAG 2.1 AA compliance |
| Screen reader support | All error states announced |

### NFR-004: Reliability

| Requirement | Specification |
|-------------|---------------|
| Timer accuracy | Within 1 second of actual time |
| State persistence | Lockout survives page refresh |
| Error boundary coverage | All routes wrapped |

### NFR-005: Compliance

| Requirement | Specification |
|-------------|---------------|
| WCAG 2.1 AA | Error states accessible |
| OWASP Top 10 | No stack trace exposure |
| GDPR | No PII in error logs |

---

## Technical Considerations

### Architecture Overview

```
App.tsx (ErrorBoundary wrapper)
  |
  +-- Routes
  |     |
  |     +-- ProtectedRoute (auth check)
  |     |     |
  |     |     +-- Page Components (use ErrorState for API errors)
  |     |
  |     +-- Public Routes (Login with lockout UI)
  |     |
  |     +-- NotFoundPage (catch-all "*")
  |
  +-- Global Error Handling
        |
        +-- API interceptors (format errors)
        +-- Toast notifications (transient errors)
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Error Pages | React components | 404, 403 pages |
| State Management | Zustand (existing) | Lockout state |
| Validation | Zod (existing) | Input validation |
| Timer | useEffect/setInterval | Countdown |
| HTTP Client | Axios (existing) | Timeout handling |

### Data Model

**Auth Store State (existing, enhanced)**:
```typescript
interface AuthState {
  // Existing
  isLocked: boolean;
  lockExpiry: number | null;  // Unix timestamp (ms)
  loginAttempts: number;

  // Actions
  resetLoginAttempts: () => void;
}
```

### Integration Requirements

| System | Integration Point | Data Exchange |
|--------|-------------------|---------------|
| Backend API | Error responses | HTTP status codes, error codes |
| Auth Service | Rate limiting | 429 status, Retry-After header |
| Analytics | Error tracking | Error events (non-PII) |

### Infrastructure Needs

- No new infrastructure required
- Uses existing React/TypeScript setup
- No backend changes required (API already returns appropriate errors)

---

## Implementation Plan

### Phase 1: Core Error Pages (Day 1-2)

| Task ID | Description | Est. Hours |
|---------|-------------|------------|
| T1.1 | Create NotFoundPage component | 2 |
| T1.2 | Add catch-all route to App.tsx | 0.5 |
| T1.3 | Create ForbiddenPage component | 2 |
| T1.4 | Create reusable ErrorState component | 3 |
| T1.5 | Write unit tests for error pages | 2 |

### Phase 2: Rate Limiting UI (Day 2-3)

| Task ID | Description | Est. Hours |
|---------|-------------|------------|
| T2.1 | Create useCountdownTimer hook | 2 |
| T2.2 | Enhance Login.tsx lockout Alert | 3 |
| T2.3 | Add form disabling when locked | 1 |
| T2.4 | Add "attempts remaining" warning | 1 |
| T2.5 | Write tests for lockout UI | 2 |

### Phase 3: Error Recovery & Timeout (Day 3-4)

| Task ID | Description | Est. Hours |
|---------|-------------|------------|
| T3.1 | Add ErrorState to all data-fetching pages | 4 |
| T3.2 | Create LoadingState with extended message | 2 |
| T3.3 | Configure API timeout handling | 2 |
| T3.4 | Write integration tests | 3 |

### Phase 4: Input Validation (Day 4-5)

| Task ID | Description | Est. Hours |
|---------|-------------|------------|
| T4.1 | Create validation schemas with XSS protection | 2 |
| T4.2 | Enhance form inputs with inline errors | 3 |
| T4.3 | Add password strength indicator | 2 |
| T4.4 | Write validation tests | 2 |

### Phase 5: QA & Polish (Day 5-6)

| Task ID | Description | Est. Hours |
|---------|-------------|------------|
| T5.1 | Run full E2E test suite | 2 |
| T5.2 | Fix any failing tests | 4 |
| T5.3 | Accessibility audit | 2 |
| T5.4 | Design review and polish | 2 |

---

## Quality Assurance

### Test Strategy

#### Unit Tests
- ErrorState component renders correctly
- useCountdownTimer updates correctly
- Validation schemas reject invalid input
- XSS patterns are detected

#### Integration Tests
- Login lockout flow end-to-end
- Form validation prevents submission
- Error recovery with retry works

#### E2E Tests (Critical Path)
```typescript
// e2e/tests/error-recovery/404-page.spec.ts
test('shows 404 for non-existent document', async ({ page }) => {
  await page.goto('/documents/non-existent-id');
  await expect(page.getByText(/404|not found/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /home|dashboard/i })).toBeVisible();
});

// e2e/tests/error-recovery/rate-limiting.spec.ts
test('shows lockout after 5 failed logins', async ({ page }) => {
  for (let i = 0; i < 5; i++) {
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);
  }
  await expect(page.getByText(/locked|too many attempts/i)).toBeVisible();
  await expect(page.locator('[name="email"]')).toBeDisabled();
});
```

### Acceptance Test Scenarios

| Scenario | Test Type | Expected Result |
|----------|-----------|-----------------|
| Navigate to /unknown-route | E2E | 404 page displayed |
| 5 failed logins | E2E | Lockout UI with timer |
| Document fetch fails | Integration | ErrorState with retry |
| Enter XSS in input | Unit | Input sanitized, warning shown |
| API timeout | Integration | Timeout message displayed |

---

## Dependencies

### Internal Dependencies

| Dependency | Status | Risk |
|------------|--------|------|
| Existing ErrorBoundary | Available | Low |
| Zustand auth store | Available | Low |
| UI components (Alert, Button, Card) | Available | Low |
| React Router | Available | Low |

### External Dependencies

None required.

---

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| Timer memory leaks | Medium | Medium | Proper useEffect cleanup |
| Stack trace in production | High (current) | Critical | Environment check in ErrorBoundary |
| Breaking existing flows | Medium | High | Feature flags, incremental rollout |
| Timer drift | Low | Low | Use Date.now() for accuracy |
| State desync | Medium | Medium | Single source of truth in store |

---

## Open Questions

1. **Q**: Should rate limit lockout time be configurable or match backend exactly?
   **Recommendation**: Match backend (15 minutes) but make configurable via env var.

2. **Q**: Should 403 page offer "Request Access" functionality?
   **Recommendation**: Phase 2 enhancement; initial implementation just shows message.

3. **Q**: How to handle offline/network errors differently from API errors?
   **Recommendation**: Detect navigator.onLine and show specific "You're offline" message.

---

## Appendix

### A. File Structure

```
quikadmin-web/src/
├── pages/
│   ├── NotFoundPage.tsx          # NEW
│   └── ForbiddenPage.tsx         # NEW
├── components/
│   ├── features/
│   │   └── ErrorState.tsx        # NEW
│   └── ui/
│       └── LoadingState.tsx      # NEW/ENHANCED
├── hooks/
│   └── useCountdownTimer.ts      # NEW
├── lib/
│   └── validations/
│       └── auth.ts               # ENHANCED
└── pages/
    └── Login.tsx                 # ENHANCED
```

### B. Related PRDs

- PRD: E2E Test Architecture Fixes (prd-e2e-test-architecture-fixes.md)
- PRD: Middleware Security Fixes (prd-middleware-security-fixes.md)

### C. Glossary

| Term | Definition |
|------|------------|
| E2E | End-to-End testing |
| XSS | Cross-Site Scripting |
| TTI | Time to Interactive |
| WCAG | Web Content Accessibility Guidelines |
| Lockout | Temporary account access restriction after failed attempts |

---

**Document Approval**

| Role | Name | Date | Status |
|------|------|------|--------|
| Product Owner | - | - | Pending |
| Tech Lead | - | - | Pending |
| QA Lead | - | - | Pending |
| Security | - | - | Pending |

---

*This PRD was generated based on E2E test gap analysis. All functional requirements map directly to failing test expectations.*
