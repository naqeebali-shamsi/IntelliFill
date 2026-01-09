# PRD: IntelliFill E2E Playwright Test Suite

## Overview

### Purpose
Implement a comprehensive End-to-End (E2E) test suite using Playwright for the IntelliFill application, covering critical user journeys, security scenarios, and infrastructure reliability.

### Background
The current test suite contains 31 tests across 3 spec files focusing only on visual regression and responsive layout testing. There are **no user journey tests, no authentication flow tests, and no API integration tests**. This PRD addresses these gaps with 28 prioritized test cases derived from an adversarial expert panel debate.

### Goals
1. Achieve 80%+ coverage of critical user journeys
2. Validate security controls through E2E security tests
3. Ensure infrastructure reliability under failure conditions
4. Maintain test execution time under 15 minutes for CI/CD

### Non-Goals
- Performance/load testing (separate initiative)
- Mobile native app testing
- Third-party integration testing (Supabase admin, Stripe)

---

## Technical Architecture

### Existing Infrastructure
- **Framework**: Playwright 1.52.0
- **Test Directory**: `quikadmin-web/e2e/tests/`
- **Config**: `quikadmin-web/playwright.config.ts`
- **Base URL**: `http://localhost:8080`
- **Package Manager**: `bun` (NOT npm)
- **Viewports**: 5 responsive breakpoints (375, 640, 768, 1024, 1280px)

### Proposed Architecture

```
quikadmin-web/e2e/
├── tests/
│   ├── auth/                    # Authentication tests
│   │   ├── registration.spec.ts
│   │   ├── login.spec.ts
│   │   └── session.spec.ts
│   ├── security/                # Security tests
│   │   ├── token-security.spec.ts
│   │   ├── idor-prevention.spec.ts
│   │   ├── input-validation.spec.ts
│   │   └── rate-limiting.spec.ts
│   ├── documents/               # Document workflow tests
│   │   ├── upload-ocr.spec.ts
│   │   ├── template-autofill.spec.ts
│   │   └── batch-processing.spec.ts
│   ├── organization/            # Organization tests
│   │   ├── org-lifecycle.spec.ts
│   │   └── member-management.spec.ts
│   ├── profile/                 # Profile tests
│   │   └── profile-crud.spec.ts
│   ├── infrastructure/          # Infrastructure tests
│   │   ├── health-check.spec.ts
│   │   └── failure-recovery.spec.ts
│   └── existing/                # Move existing tests
│       ├── dashboard-layout.spec.ts
│       ├── layout-responsive.spec.ts
│       └── visual-regression.spec.ts
├── fixtures/
│   ├── auth.fixture.ts          # Authentication state fixtures
│   ├── org.fixture.ts           # Organization fixtures
│   └── document.fixture.ts      # Document fixtures
├── pages/                       # Page Object Model
│   ├── LoginPage.ts
│   ├── RegisterPage.ts
│   ├── DashboardPage.ts
│   ├── DocumentsPage.ts
│   ├── SettingsPage.ts
│   └── BasePage.ts
├── helpers/
│   ├── api.helper.ts            # Direct API calls for setup/teardown
│   ├── db.helper.ts             # Database seeding utilities
│   └── mock.helper.ts           # Request interception helpers
└── data/
    ├── test-users.json          # Test user credentials
    ├── test-documents/          # Sample PDF/images for upload
    └── test-templates.json      # Form template test data
```

### Test Data Strategy
1. **Isolated Test Users**: Each test suite creates unique test users with `test-e2e-{uuid}` prefix
2. **Cleanup on Teardown**: All test data deleted after test completion
3. **No Shared State**: Tests are independent and can run in parallel
4. **Mock External Services**: Mock R2/S3, OCR services for deterministic results

### Sample Documents (IMPORTANT)

**Location**: `quikadmin-web/e2e/sample-docs/`

All document-related tests (upload, OCR, batch processing) MUST use the pre-downloaded sample files:

| File | Type | Size | Use Case |
|------|------|------|----------|
| `sample-pdf-text.pdf` | PDF | 142 KB | Standard OCR testing |
| `sample-multipage.pdf` | PDF | 58 KB | Multi-page/batch tests |
| `sample-image.jpg` | JPEG | 146 KB | Image upload tests |
| `sample-image.png` | PNG | 2 KB | Image format tests |
| `corrupt-file.pdf` | Invalid | 49 B | Error handling tests |

**Usage in Tests**:
```typescript
import path from 'path';

const SAMPLE_DOCS = path.join(__dirname, '..', 'sample-docs');

// Valid PDF for OCR testing
const validPdf = path.join(SAMPLE_DOCS, 'sample-pdf-text.pdf');

// Multi-page PDF for batch tests
const multiPagePdf = path.join(SAMPLE_DOCS, 'sample-multipage.pdf');

// Images for upload tests
const jpgImage = path.join(SAMPLE_DOCS, 'sample-image.jpg');
const pngImage = path.join(SAMPLE_DOCS, 'sample-image.png');

// Corrupt file for error handling
const corruptFile = path.join(SAMPLE_DOCS, 'corrupt-file.pdf');
```

See `quikadmin-web/e2e/sample-docs/README.md` for detailed usage examples.

---

## Test Cases - Tier 1 (Must Have)

### E2E-001: Complete Registration & Onboarding Flow
**Priority**: Critical | **Complexity**: Medium | **Est. Time**: 12 min

**Description**: Verify new user can register, confirm email (mocked), complete profile setup, and access dashboard.

**Test Steps**:
1. Navigate to `/register`
2. Fill registration form (email, password, confirm password)
3. Submit form and verify success message
4. Mock email confirmation callback
5. Complete profile setup (name, company optional)
6. Verify redirect to dashboard
7. Verify user data persisted correctly

**Acceptance Criteria**:
- Registration completes without errors
- User session created with correct tokens
- Profile data saved to database
- Dashboard accessible after onboarding

**Dependencies**: None

---

### E2E-002: Token Lifecycle Security
**Priority**: Critical | **Complexity**: High | **Est. Time**: 15 min

**Description**: Verify JWT access/refresh token lifecycle, expiration handling, and secure storage.

**Test Steps**:
1. Login with valid credentials
2. Verify access token in memory (not localStorage)
3. Verify refresh token in httpOnly cookie
4. Wait for access token expiration (mock short TTL)
5. Verify automatic token refresh on API call
6. Verify logout clears all tokens
7. Verify expired refresh token requires re-login

**Acceptance Criteria**:
- Access tokens not exposed in localStorage
- Refresh tokens use httpOnly cookies
- Automatic refresh works seamlessly
- Logout completely clears authentication state

**Dependencies**: E2E-001

---

### E2E-003: Cross-Organization Isolation (IDOR Prevention)
**Priority**: Critical | **Complexity**: High | **Est. Time**: 15 min

**Description**: Verify users cannot access resources from other organizations.

**Test Steps**:
1. Create two test organizations with different users
2. Login as User A (Org 1)
3. Attempt to access Org 2's documents via URL manipulation
4. Verify 403 Forbidden response
5. Attempt to access Org 2's members list
6. Verify 403 Forbidden response
7. Attempt API calls with Org 2's resource IDs
8. Verify all cross-org access blocked

**Acceptance Criteria**:
- All cross-organization access attempts return 403
- No data leakage in error responses
- Audit logs capture attempted violations

**Dependencies**: E2E-001

---

### E2E-004: Single Document OCR Processing
**Priority**: Critical | **Complexity**: Medium | **Est. Time**: 10 min

**Description**: Verify single document upload triggers OCR and displays results.

**Sample Files**: Use `sample-docs/sample-pdf-text.pdf` for this test.

**Test Steps**:
1. Login and navigate to Documents page
2. Upload `sample-docs/sample-pdf-text.pdf` using file chooser
3. Verify upload progress indicator
4. Wait for OCR processing (mock queue response)
5. Verify document appears in list with status "Processed"
6. Click document to view OCR results
7. Verify extracted text displayed correctly

**Acceptance Criteria**:
- Document upload accepts PDF, PNG, JPG
- Progress indicator shows during processing
- OCR results displayed within 30 seconds
- Extracted fields match expected data

**Dependencies**: E2E-001

---

### E2E-005: Template & Form Auto-Fill
**Priority**: Critical | **Complexity**: High | **Est. Time**: 12 min

**Description**: Verify template selection and auto-fill from extracted document data.

**Sample Files**: Use `sample-docs/sample-pdf-text.pdf` (already processed from E2E-004).

**Test Steps**:
1. Upload `sample-docs/sample-pdf-text.pdf` and wait for OCR
2. Navigate to Templates page
3. Select a form template (e.g., UAE visa application)
4. Click "Auto-fill from document"
5. Select the processed document
6. Verify fields populated from OCR data
7. Edit a field and save
8. Verify changes persisted

**Acceptance Criteria**:
- Auto-fill maps OCR fields to template correctly
- Manual edits are saved
- Template preview shows filled data
- Export generates correctly filled form

**Dependencies**: E2E-004

---

### E2E-006: Role Escalation Prevention
**Priority**: Critical | **Complexity**: Medium | **Est. Time**: 10 min

**Description**: Verify users cannot escalate their own roles or modify permissions.

**Test Steps**:
1. Login as MEMBER role user
2. Navigate to Settings > Organization
3. Verify admin-only actions are hidden/disabled
4. Attempt direct API call to promote self to ADMIN
5. Verify 403 Forbidden response
6. Attempt to modify organization settings
7. Verify 403 Forbidden response

**Acceptance Criteria**:
- UI hides admin-only controls from non-admins
- API rejects unauthorized role changes
- No escalation path exists for regular members

**Dependencies**: E2E-001

---

### E2E-007: Input Validation Security (SQLi/XSS)
**Priority**: Critical | **Complexity**: High | **Est. Time**: 12 min

**Description**: Verify application sanitizes inputs against injection attacks.

**Test Steps**:
1. Attempt SQL injection in login email field
2. Verify login fails safely (no DB error exposed)
3. Attempt XSS in profile name field
4. Verify script tags are escaped on display
5. Attempt path traversal in document download
6. Verify download restricted to allowed paths
7. Attempt CRLF injection in headers
8. Verify headers properly sanitized

**Acceptance Criteria**:
- SQL injection attempts fail without DB errors
- XSS payloads are escaped, not executed
- Path traversal blocked
- No sensitive error messages exposed

**Dependencies**: E2E-001

---

### E2E-008: API Health Check
**Priority**: Critical | **Complexity**: Low | **Est. Time**: 5 min

**Description**: Verify health check endpoint and basic API availability.

**Test Steps**:
1. Call GET /api/health
2. Verify 200 response with status "healthy"
3. Verify response includes version info
4. Verify response time < 500ms
5. Verify database connectivity check passes
6. Verify Redis connectivity check passes

**Acceptance Criteria**:
- Health endpoint returns 200 when healthy
- All dependency checks included
- Response time within SLA

**Dependencies**: None

---

### E2E-009: Queue Failure Recovery
**Priority**: Critical | **Complexity**: High | **Est. Time**: 15 min

**Description**: Verify system handles queue failures gracefully and recovers.

**Sample Files**: Use `sample-docs/sample-multipage.pdf` to test queue processing.

**Test Steps**:
1. Upload `sample-docs/sample-multipage.pdf` to trigger OCR queue
2. Mock Redis disconnection mid-processing
3. Verify user sees appropriate error message
4. Verify job moves to failed queue
5. Restore Redis connection
6. Trigger manual retry via UI
7. Verify job completes successfully

**Acceptance Criteria**:
- Queue failures don't crash application
- Failed jobs are persisted for retry
- User informed of processing issues
- Manual retry mechanism works

**Dependencies**: E2E-004

---

### E2E-010: Account Lockout & Rate Limiting
**Priority**: Critical | **Complexity**: Medium | **Est. Time**: 8 min

**Description**: Verify brute force protection and rate limiting.

**Test Steps**:
1. Attempt 5 failed logins with wrong password
2. Verify account locked message after 5th attempt
3. Verify lockout duration displayed (15 minutes)
4. Attempt login with correct password while locked
5. Verify still blocked
6. Wait for lockout expiry (mock time advancement)
7. Verify successful login after lockout expires

**Acceptance Criteria**:
- Account locks after 5 failed attempts
- Lockout message shows remaining time
- Cannot bypass lockout with correct password
- Lockout expires after configured duration

**Dependencies**: E2E-001

---

## Test Cases - Tier 2 (Should Have)

### E2E-011: Password Reset Flow
**Priority**: High | **Complexity**: Medium | **Est. Time**: 10 min
- Request password reset
- Mock email delivery
- Click reset link
- Set new password
- Login with new password

**Dependencies**: E2E-001

---

### E2E-012: Organization Lifecycle (Create/Update/Delete)
**Priority**: High | **Complexity**: Medium | **Est. Time**: 12 min
- Create new organization
- Update organization name/settings
- Add member to organization
- Remove member from organization
- Delete organization (owner only)

**Dependencies**: E2E-001

---

### E2E-013: Batch Document Processing
**Priority**: High | **Complexity**: High | **Est. Time**: 12 min

**Sample Files**: Use all files from `sample-docs/`:
- `sample-pdf-text.pdf`
- `sample-multipage.pdf`
- `sample-image.jpg`

**Steps**:
- Upload multiple documents (3 sample files above)
- Verify batch queue processing
- Monitor progress of all documents
- Verify all complete successfully
- Verify document list shows all items

**Dependencies**: E2E-004

---

### E2E-014: Document Download & Export
**Priority**: High | **Complexity**: Low | **Est. Time**: 6 min

**Sample Files**: Use `sample-docs/sample-pdf-text.pdf` (processed).

**Steps**:
- Process `sample-docs/sample-pdf-text.pdf`
- Download original document
- Export OCR results as JSON
- Export filled template as PDF
- Verify file integrity

**Dependencies**: E2E-004

---

### E2E-015: Session Management
**Priority**: High | **Complexity**: Medium | **Est. Time**: 10 min
- Login on two browser contexts
- Verify both sessions active
- Logout from one session
- Verify other session still active
- Verify "logout all" terminates both

**Dependencies**: E2E-001

---

### E2E-016: Profile CRUD Operations
**Priority**: High | **Complexity**: Low | **Est. Time**: 8 min
- View profile page
- Update name and email
- Upload profile avatar
- Verify changes persisted
- Verify email change requires confirmation

**Dependencies**: E2E-001

---

### E2E-017: Redis Disconnection Resilience
**Priority**: High | **Complexity**: High | **Est. Time**: 10 min
- Simulate Redis disconnection
- Verify rate limiting falls back gracefully
- Verify queue operations show appropriate errors
- Verify reconnection recovery

**Dependencies**: E2E-008

---

### E2E-018: S3/R2 Storage Failure Handling
**Priority**: High | **Complexity**: High | **Est. Time**: 10 min

**Sample Files**: Use `sample-docs/sample-pdf-text.pdf` for upload testing.

**Steps**:
- Attempt to upload `sample-docs/sample-pdf-text.pdf` with mocked S3 failure
- Verify user sees clear error message
- Verify retry mechanism available
- Mock S3 recovery
- Verify upload succeeds on retry

**Dependencies**: E2E-004

---

### E2E-019: Member Invitation Flow
**Priority**: High | **Complexity**: Medium | **Est. Time**: 10 min
- Admin invites new member
- Verify invitation email (mocked)
- Accept invitation
- Verify member added to organization
- Verify role permissions correct

**Dependencies**: E2E-012

---

### E2E-020: Role-Based UI Rendering
**Priority**: High | **Complexity**: Low | **Est. Time**: 6 min
- Login as VIEWER - verify limited UI
- Login as MEMBER - verify standard UI
- Login as ADMIN - verify admin controls
- Login as OWNER - verify owner controls
- Verify consistent across viewports

**Dependencies**: E2E-001

---

## Test Cases - Tier 3 (Nice to Have)

### E2E-021: Error Recovery UX
**Priority**: Medium | **Complexity**: Low | **Est. Time**: 5 min

**Sample Files**: Use `sample-docs/corrupt-file.pdf` for error testing.

**Steps**:
- Upload `sample-docs/corrupt-file.pdf` to trigger error state
- Verify friendly error messages (not stack traces)
- Verify "try again" buttons work
- Verify no sensitive info exposed

**Dependencies**: E2E-001

---

### E2E-022: Document Search & Filter
**Priority**: Medium | **Complexity**: Medium | **Est. Time**: 8 min

**Sample Files**: Upload all files from `sample-docs/` to create searchable data.

**Steps**:
- Upload all sample documents to create test data
- Search by document name
- Filter by status (pending, processed, failed)
- Filter by date range
- Verify pagination works

**Dependencies**: E2E-004

---

### E2E-023: Settings Persistence
**Priority**: Medium | **Complexity**: Low | **Est. Time**: 5 min
- Change theme/preferences
- Verify localStorage updated
- Refresh page
- Verify settings retained

**Dependencies**: E2E-001

---

### E2E-024: Template CRUD Operations
**Priority**: Medium | **Complexity**: Medium | **Est. Time**: 8 min
- Create new template
- Edit template fields
- Duplicate template
- Delete template
- Verify changes persisted

**Dependencies**: E2E-005

---

### E2E-025: Complete Logout Flow
**Priority**: Medium | **Complexity**: Low | **Est. Time**: 4 min
- Logout from authenticated state
- Verify redirect to login
- Verify cannot access protected routes
- Verify back button doesn't expose data

**Dependencies**: E2E-001

---

### E2E-026: CORS Configuration Validation
**Priority**: Medium | **Complexity**: Medium | **Est. Time**: 6 min
- Verify API accepts requests from allowed origins
- Verify API rejects requests from disallowed origins
- Verify preflight requests handled correctly

**Dependencies**: E2E-008

---

### E2E-027: Session Persistence Across Tabs
**Priority**: Low | **Complexity**: Low | **Est. Time**: 5 min
- Login in one tab
- Open new tab to application
- Verify already authenticated
- Logout in first tab
- Verify second tab shows logged out

**Dependencies**: E2E-001

---

### E2E-028: Network Timeout Handling
**Priority**: Low | **Complexity**: Medium | **Est. Time**: 6 min
- Mock slow API responses (>10s)
- Verify timeout error displayed
- Verify retry mechanism available
- Verify pending state indicators

**Dependencies**: E2E-001

---

## Implementation Requirements

### Test Fixtures Required
```typescript
// auth.fixture.ts
export const authenticatedUser = test.extend({
  page: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: 'auth.json' });
    const page = await context.newPage();
    await use(page);
    await context.close();
  }
});

// Roles: viewer, member, admin, owner
export const viewerUser = createRoleFixture('VIEWER');
export const memberUser = createRoleFixture('MEMBER');
export const adminUser = createRoleFixture('ADMIN');
export const ownerUser = createRoleFixture('OWNER');
```

### Page Object Model Required
- `LoginPage`: login, getErrorMessage, isLoaded
- `RegisterPage`: register, fillForm, submit
- `DashboardPage`: getStats, navigateTo
- `DocumentsPage`: upload, waitForProcessing, getDocuments, search
- `SettingsPage`: updateProfile, updatePassword, getOrgSettings
- `TemplatesPage`: selectTemplate, autoFill, save

### Test Data Requirements
Sample documents are already downloaded in `quikadmin-web/e2e/sample-docs/`:
- `sample-pdf-text.pdf` - Valid PDF with text (142 KB)
- `sample-multipage.pdf` - Multi-page PDF (58 KB)
- `sample-image.jpg` - JPEG image (146 KB)
- `sample-image.png` - PNG image (2 KB)
- `corrupt-file.pdf` - Invalid file for error testing (49 B)

Additional requirements:
- Test user credentials file (`data/test-users.json`)
- Form template definitions (`data/test-templates.json`)

### Mock Requirements
- Supabase auth (for email confirmation)
- OCR service responses
- S3/R2 upload/download
- Redis for queue testing
- Email service

---

## Execution Strategy

### CI/CD Integration
```yaml
# GitHub Actions workflow
e2e-tests:
  strategy:
    matrix:
      shard: [1, 2, 3, 4]  # 4 parallel shards
  steps:
    - run: bun run test:e2e --shard=${{ matrix.shard }}/4
```

### Test Execution Order
1. **Tier 1 tests run first** - block deployment on failure
2. **Tier 2 tests run second** - report failures but don't block
3. **Tier 3 tests run last** - informational only

### Parallelization Strategy
- Auth setup tests: Sequential (shared state setup)
- Security tests: Can run parallel (independent)
- Document tests: Sequential (shared upload state)
- Infrastructure tests: Isolated parallel

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Tier 1 Pass Rate | 100% |
| Tier 2 Pass Rate | 95%+ |
| Full Suite Duration | < 15 min |
| Flaky Test Rate | < 2% |
| Coverage (critical paths) | 80%+ |

---

## Timeline Estimate

| Phase | Tasks | Estimate |
|-------|-------|----------|
| Setup | Fixtures, POM, helpers | 2-3 tasks |
| Tier 1 | 10 test implementations | 10 tasks |
| Tier 2 | 10 test implementations | 10 tasks |
| Tier 3 | 8 test implementations | 8 tasks |
| CI/CD | GitHub Actions integration | 1-2 tasks |
| **Total** | **~32-35 tasks** | |

---

## References

- Existing tests: `quikadmin-web/e2e/tests/`
- Playwright config: `quikadmin-web/playwright.config.ts`
- Frontend routes: `quikadmin-web/src/App.tsx`
- API routes: `quikadmin/src/api/routes.ts`
- Auth store: `quikadmin-web/src/stores/auth.ts`
