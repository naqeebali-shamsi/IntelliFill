# PRD: Dashboard Layout E2E Test Fixes

**Document ID**: PRD-DASHBOARD-LAYOUT-001
**Priority**: Medium
**Status**: Draft
**Created**: 2026-01-09
**Author**: AI Product Specialist

---

## Executive Summary

### Problem Statement

14 of 16 Dashboard Layout E2E tests are failing due to authentication and selector mismatches between test expectations and the current implementation. The tests assume unauthenticated access to protected routes and rely on selectors that may not correctly match the DOM structure.

### Solution Overview

This PRD outlines a two-phase fix:
1. **Phase 1 (Authentication)**: Integrate tests with the existing authentication fixture pattern to ensure authenticated access to dashboard routes
2. **Phase 2 (Selector Alignment)**: Audit and align data-testid attributes and selectors between tests and implementation

### Business Impact

- **Quality Assurance**: Restore E2E test coverage for the dashboard, the primary user interface
- **Developer Confidence**: Enable reliable regression testing during feature development
- **Release Velocity**: Unblock deployments that require passing E2E tests

### Resource Requirements

- **Effort**: 4-6 hours of frontend development
- **Dependencies**: None (authentication fixtures already exist)
- **Testing**: All 16 dashboard tests must pass across all viewport configurations

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Authentication state conflicts | Medium | High | Use worker isolation via existing fixtures |
| Selector changes break other tests | Low | Medium | Use semantic data-testid patterns |
| Loading state timing issues | Medium | Medium | Add explicit wait conditions |

---

## Product Overview

### Product Vision

The Dashboard is the primary landing page for authenticated IntelliFill users. It provides:
- Overview statistics (Total Documents, Processed Today, In Progress, Failed)
- Recent documents list with status indicators
- Processing queue widget with live metrics
- Quick action buttons for common workflows

A fully tested dashboard ensures users have a reliable, responsive experience across all device sizes.

### Target Users

| User Type | Description | Dashboard Usage |
|-----------|-------------|-----------------|
| Agency Staff | Daily document processors | Primary workspace; checks stats and queue |
| Agency Managers | Team oversight | Reviews processing metrics and failures |
| Solo Practitioners | Individual users | Monitors personal document workflow |

### Value Proposition

Fixing these E2E tests provides:
1. **Automated Regression Testing**: Catch layout bugs before production
2. **Responsive Verification**: Ensure dashboard works on mobile (375px) to desktop (1280px)
3. **Component Contract**: Maintain data-testid contracts for external integrations

### Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Test Pass Rate | 100% (16/16) | Playwright test results |
| Viewport Coverage | 5 sizes | All viewport projects pass |
| No Horizontal Overflow | 0px overflow | Automated assertion in tests |
| Layout Stability | < 500px shift | CLS measurement in tests |

### Assumptions

1. The existing authentication fixture (`auth.fixture.ts`) works correctly
2. Backend API endpoints return expected data structures
3. The StatCard component correctly forwards the `data-testid` prop
4. The ResponsiveGrid component renders correct grid classes

---

## Functional Requirements

### FR-1: Authentication Integration

**Description**: Dashboard tests must use authenticated sessions to access protected routes.

**Current State**: Tests navigate directly to `/dashboard` without authentication, likely causing redirect to `/login`.

**Required Changes**:

| File | Change Required |
|------|-----------------|
| `dashboard-layout.spec.ts` | Import and use `authenticatedTest` from auth fixture |
| `global.setup.ts` | Verify setup creates valid authenticated storage state |

**User Stories**:

**US-1.1**: As a test runner, I want tests to use pre-authenticated sessions so that dashboard pages load without login redirects.

Acceptance Criteria:
- Given: A test extends `authenticatedTest`
- When: The test navigates to `/dashboard`
- Then: The dashboard content loads without redirect to `/login`

**US-1.2**: As a test runner, I want authentication state to persist across tests in the same worker so that tests run efficiently.

Acceptance Criteria:
- Given: Multiple dashboard tests in one worker
- When: Tests run sequentially
- Then: Authentication is reused, not re-created

### FR-2: Stat Cards Test ID Alignment

**Description**: Ensure stat cards have correct data-testid attributes that tests can locate.

**Current Implementation Analysis**:

| Stat Card | Implementation testid | Page Object Selector | Status |
|-----------|----------------------|----------------------|--------|
| Total Documents | `stat-card-dashboard-1` | `stat-card-total-documents, stat-card-dashboard-1` | OK |
| Processed Today | `stat-card-dashboard-2` | `stat-card-processed-today, stat-card-dashboard-2` | OK |
| In Progress | `stat-card-dashboard-3` | `stat-card-in-progress, stat-card-dashboard-3` | OK |
| Failed | `stat-card-dashboard-4` | `stat-card-failed, stat-card-dashboard-4` | OK |

**Note**: The Page Object (`DashboardPage.ts`) uses fallback selectors that should match. However, the tests in `dashboard-layout.spec.ts` use `.grid:first` which may not match correctly.

**User Stories**:

**US-2.1**: As a test, I want to locate stat cards by semantic data-testid so that tests are resilient to DOM changes.

Acceptance Criteria:
- Given: Dashboard is loaded
- When: Test queries `[data-testid="stat-card-dashboard-1"]`
- Then: The Total Documents stat card is returned

**US-2.2**: As a test, I want the stats grid to have a data-testid so that I can verify the grid container exists.

Acceptance Criteria:
- Given: Dashboard is loaded
- When: Test queries `[data-testid="dashboard-stats-grid"]`
- Then: The stats grid container is returned

### FR-3: Recent Documents Section

**Description**: The Recent Documents section must be testable with explicit data-testid attributes.

**Current State**:
- Section has text "Recent Documents" but no dedicated data-testid
- Document rows use inline markup without data-testid
- Tests rely on text-based selectors

**Required Changes**:

| Element | Current Selector | Required data-testid |
|---------|-----------------|----------------------|
| Section container | `:has-text("Recent Documents")` | `dashboard-recent-documents` |
| Document row | `.document-row` | `document-row-{index}` |
| Empty state | Text-based | `recent-documents-empty` |
| Loading skeleton | Class-based | `recent-documents-loading` |

**User Stories**:

**US-3.1**: As a test, I want to verify the Recent Documents section is visible by data-testid.

Acceptance Criteria:
- Given: Dashboard is loaded
- When: Test queries `[data-testid="dashboard-recent-documents"]`
- Then: The section container is returned

### FR-4: Processing Queue Widget

**Description**: The Processing Queue widget must be testable with explicit data-testid attributes.

**Current State**:
- Widget has "Processing Queue" text but no data-testid
- Metrics (Active Jobs, Avg Time, Success Rate) are inline
- Live badge exists but not testable

**Required Changes**:

| Element | Current | Required data-testid |
|---------|---------|----------------------|
| Widget container | Text-based | `dashboard-processing-queue` |
| Active jobs count | Inline text | `queue-active-jobs` |
| Avg time metric | Inline text | `queue-avg-time` |
| Success rate | Inline text | `queue-success-rate` |
| Live badge | Class-based | `queue-live-badge` |

**User Stories**:

**US-4.1**: As a test, I want to verify queue metrics are displayed with correct values.

Acceptance Criteria:
- Given: Dashboard is loaded with queue data
- When: Test reads `[data-testid="queue-active-jobs"]`
- Then: The active jobs count is returned as a number

### FR-5: Quick Actions Section

**Description**: Quick Actions buttons must be testable.

**Current State**:
- Section has "Quick Actions" text header
- Buttons have text content but no data-testid
- Tests rely on text matching

**Required Changes**:

| Button | Current Selector | Required data-testid |
|--------|-----------------|----------------------|
| Upload Document | `text=Upload Document` | `quick-action-upload` |
| Create Template | `text=Create Template` | `quick-action-template` |
| Browse Library | `text=Browse Library` | `quick-action-library` |

**User Stories**:

**US-5.1**: As a test, I want to click quick action buttons by data-testid for reliability.

Acceptance Criteria:
- Given: Dashboard is loaded
- When: Test clicks `[data-testid="quick-action-upload"]`
- Then: Navigation to `/upload` occurs

### FR-6: Responsive Layout Verification

**Description**: Tests must verify correct grid behavior across viewport sizes.

**Current Test Logic** (from `dashboard-layout.spec.ts`):
```typescript
// Tests expect specific grid column classes based on viewport
if (viewport.width >= 1024) {
  expect(gridClasses).toContain('lg:grid-cols-4');
} else if (viewport.width >= 768) {
  expect(gridClasses).toContain('md:grid-cols-2');
}
```

**Implementation** (`responsive-grid.tsx`):
```typescript
stats: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
```

**Issue**: Test expects `md:grid-cols-2` but implementation uses `sm:grid-cols-2`. The behavior is the same but the class name differs.

**Required Changes**:
- Update tests to check computed styles rather than class names
- Or standardize the class naming convention

**User Stories**:

**US-6.1**: As a test, I want to verify the number of visible columns at each breakpoint.

Acceptance Criteria:
- Given: Dashboard at 1280px viewport
- When: Test evaluates computed grid-template-columns
- Then: 4 columns are computed

### FR-7: Dashboard Header and Greeting

**Description**: The dashboard greeting message must be testable.

**Current State**:
- Greeting "Good {morning|afternoon|evening}, Team" exists
- No data-testid on header

**Required Changes**:

| Element | Required data-testid |
|---------|----------------------|
| Header container | `dashboard-header` |
| Greeting text | `dashboard-greeting` |
| Refresh button | `dashboard-refresh-btn` |
| Upload New button | `dashboard-upload-btn` |

---

## Non-Functional Requirements

### NFR-1: Performance

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Test execution time | < 60s per test | Playwright timeout |
| Layout Shift (CLS) | < 0.1 | Web Vitals measurement |
| Skeleton to content | < 3s | Loading state duration |

### NFR-2: Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Loading states | Use `role="status"` and `aria-label` |
| Stat cards | Include `aria-labelledby` for screen readers |
| Quick actions | Use semantic button elements |

### NFR-3: Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chromium | Latest | Primary target |
| Firefox | Latest | Optional (commented in config) |
| WebKit | Latest | Optional (commented in config) |

### NFR-4: Viewport Coverage

All tests must pass at these viewport sizes:

| Name | Width | Height | Breakpoint |
|------|-------|--------|------------|
| mobile | 375px | 667px | base |
| phablet | 640px | 1136px | sm |
| tablet | 768px | 1024px | md |
| laptop | 1024px | 768px | lg |
| desktop | 1280px | 720px | xl |

---

## Technical Considerations

### Architecture Overview

```
E2E Test Architecture:

  [Playwright Test Runner]
         |
         v
  [Global Setup]
    - API health check
    - User verification
    - Auth state creation
         |
         v
  [Browser Projects]
    - chromium-mobile
    - chromium-phablet
    - chromium-tablet
    - chromium-laptop
    - chromium-desktop
         |
         v
  [Test Fixtures]
    - auth.fixture.ts (mutex-protected)
    - org.fixture.ts (worker isolation)
         |
         v
  [Page Objects]
    - DashboardPage.ts
    - BasePage.ts
         |
         v
  [Test Specs]
    - dashboard-layout.spec.ts
         |
         v
  [Global Teardown]
    - Logout
    - Auth state cleanup
```

### Data-TestID Strategy

**Naming Convention**: `{page}-{section}-{element}` or `{component}-{context}-{index}`

Examples:
- `dashboard-stats-grid` - Dashboard page, stats section, grid container
- `stat-card-dashboard-1` - StatCard component, dashboard context, first card
- `quick-action-upload` - Quick action, upload purpose

**Component Forwarding**: The StatCard component must forward `data-testid` to the outer element:

```typescript
// stat-card.tsx (lines 176-197)
export function StatCard({
  'data-testid': testId,
  ...props
}: StatCardProps) {
  return (
    <motion.div
      data-testid={testId}  // Correctly forwarded
      ...
    >
```

This is already implemented correctly.

### Integration Points

| Integration | File | Status |
|-------------|------|--------|
| Auth Fixture | `e2e/fixtures/auth.fixture.ts` | Exists, needs integration |
| Page Object | `e2e/pages/DashboardPage.ts` | Exists, selectors need update |
| Global Setup | `e2e/global.setup.ts` | Exists, creates auth state |
| ResponsiveGrid | `components/layout/responsive-grid.tsx` | No changes needed |
| StatCard | `components/features/stat-card.tsx` | No changes needed |

### Infrastructure Needs

- No new infrastructure required
- Tests use existing Playwright configuration
- Servers started automatically via `webServer` config

---

## Implementation Tasks

### Task Breakdown

| ID | Task | Priority | Effort | Dependencies |
|----|------|----------|--------|--------------|
| T1 | Integrate auth fixture into dashboard tests | High | 1h | None |
| T2 | Add data-testid to ResponsiveGrid in Dashboard | High | 30m | None |
| T3 | Add data-testid to Recent Documents section | Medium | 30m | None |
| T4 | Add data-testid to Processing Queue widget | Medium | 30m | None |
| T5 | Add data-testid to Quick Actions buttons | Medium | 30m | None |
| T6 | Add data-testid to Dashboard header elements | Low | 15m | None |
| T7 | Update test selectors to use data-testid | High | 1h | T2-T6 |
| T8 | Fix responsive grid class assertions | Medium | 30m | None |
| T9 | Verify all tests pass across viewports | High | 1h | T1-T8 |

### Detailed Task Specifications

#### T1: Integrate Auth Fixture

**File**: `quikadmin-web/e2e/tests/existing/dashboard-layout.spec.ts`

**Change**: Replace `test` import with authenticated version

```typescript
// Before
import { test, expect } from '@playwright/test';

// After
import { expect } from '@playwright/test';
import { test } from '../../fixtures/auth.fixture';
```

**Acceptance Criteria**:
- Tests use `authenticatedTest`
- Tests no longer redirect to login
- Auth state is reused across tests in same worker

#### T2: Add Stats Grid data-testid

**File**: `quikadmin-web/src/pages/ConnectedDashboard.tsx`

**Change**: Add data-testid to ResponsiveGrid

```typescript
// Line 111
<ResponsiveGrid preset="stats" data-testid="dashboard-stats-grid">
```

**Acceptance Criteria**:
- Grid container can be located by `[data-testid="dashboard-stats-grid"]`
- Existing tests using `.grid` selectors still work

#### T3: Add Recent Documents data-testid

**File**: `quikadmin-web/src/pages/ConnectedDashboard.tsx`

**Changes**:
```typescript
// Around line 169
<motion.div
  data-testid="dashboard-recent-documents"
  variants={fadeInUp}
  className="glass-panel rounded-xl overflow-hidden..."
>

// Around line 196-199 (empty state)
<div
  data-testid="recent-documents-empty"
  className="h-full flex flex-col items-center..."
>

// Around line 203 (document row)
<div
  key={job.id}
  data-testid={`document-row-${job.id}`}
  className="flex items-center gap-4 p-4..."
>
```

#### T4: Add Processing Queue data-testid

**File**: `quikadmin-web/src/pages/ConnectedDashboard.tsx`

**Changes**:
```typescript
// Around line 242
<div
  data-testid="dashboard-processing-queue"
  className="glass-card p-6 rounded-xl..."
>

// Around line 261-264 (active jobs)
<span
  data-testid="queue-active-jobs"
  className="font-medium"
>
  {queueMetrics?.active || 0}

// Around line 273 (avg time)
<p
  data-testid="queue-avg-time"
  className="font-medium text-lg font-mono"
>
  {statistics?.averageProcessingTime || '0'}m

// Around line 278 (success rate)
<p
  data-testid="queue-success-rate"
  className="font-medium text-lg font-mono text-success"
>
  {statistics?.successRate || '0'}%
```

#### T5: Add Quick Actions data-testid

**File**: `quikadmin-web/src/pages/ConnectedDashboard.tsx`

**Changes**:
```typescript
// Around line 290
<div
  data-testid="dashboard-quick-actions"
  className="glass-panel p-6 rounded-xl..."
>

// Around line 295 (Upload button)
<Button
  data-testid="quick-action-upload"
  variant="outline"
  onClick={() => navigate('/upload')}
  ...
>

// Around line 311 (Template button)
<Button
  data-testid="quick-action-template"
  variant="outline"
  onClick={() => navigate('/templates')}
  ...
>

// Around line 327 (Library button)
<Button
  data-testid="quick-action-library"
  variant="outline"
  onClick={() => navigate('/documents')}
  ...
>
```

#### T6: Add Header data-testid

**File**: `quikadmin-web/src/pages/ConnectedDashboard.tsx`

**Changes**:
```typescript
// Around line 80
<div
  data-testid="dashboard-header"
  className="flex flex-col md:flex-row..."
>

// Around line 82
<h1
  data-testid="dashboard-greeting"
  className="text-3xl font-heading..."
>

// Around line 91 (Refresh button)
<Button
  data-testid="dashboard-refresh-btn"
  variant="outline"
  ...
>

// Around line 100 (Upload New button)
<Button
  data-testid="dashboard-upload-btn"
  onClick={() => navigate('/upload')}
  ...
>
```

#### T7: Update Test Selectors

**File**: `quikadmin-web/e2e/tests/existing/dashboard-layout.spec.ts`

**Changes**: Replace generic selectors with data-testid

```typescript
// Before
const statsGrid = page.locator('.grid').first();

// After
const statsGrid = page.locator('[data-testid="dashboard-stats-grid"]');
```

#### T8: Fix Responsive Grid Assertions

**File**: `quikadmin-web/e2e/tests/existing/dashboard-layout.spec.ts`

**Issue**: Test expects `md:grid-cols-2` but implementation uses `sm:grid-cols-2`

**Change**: Update assertions to match actual class names or use computed styles

```typescript
// Option A: Fix class expectation
if (viewport && viewport.width >= 640) {
  expect(gridClasses).toContain('sm:grid-cols-2');
}

// Option B: Test computed styles (preferred)
const columns = await statsGrid.evaluate((el) => {
  return window.getComputedStyle(el).gridTemplateColumns.split(' ').length;
});
expect(columns).toBe(expectedColumnCount);
```

---

## Quality Assurance

### Test Matrix

| Test Name | Expected Behavior | Viewport Coverage |
|-----------|------------------|-------------------|
| Navigate to dashboard | Load without redirect | All |
| Stats grid visible | 4 stat cards displayed | All |
| No horizontal overflow | scrollWidth <= viewportWidth | All |
| Recent documents visible | Section header and content | All |
| Processing queue visible | Queue widget with metrics | All |
| Quick actions visible | 3 action buttons | All |
| Responsive layout | Correct columns per breakpoint | All |
| Stat card icons | 4+ icons rendered | All |
| Viewport switching | Layout remains stable | Desktop only |
| Sidebar toggle (mobile) | Toggle button functional | Mobile only |
| No layout shift | Height change < 500px | All |

### Acceptance Criteria Summary

1. All 16 tests in `dashboard-layout.spec.ts` pass
2. Tests pass across all 5 viewport configurations
3. Tests use authentication fixture correctly
4. Tests use semantic data-testid selectors
5. No regression in existing test suites
6. Test execution completes within 60s timeout

### Rollback Plan

If implementation causes regressions:
1. Revert component changes (data-testid additions are non-breaking)
2. Restore original test selectors
3. Document failed approach for future reference

---

## Appendix

### A. File Locations

| File | Path | Purpose |
|------|------|---------|
| Dashboard Component | `quikadmin-web/src/pages/ConnectedDashboard.tsx` | Main dashboard page |
| StatCard Component | `quikadmin-web/src/components/features/stat-card.tsx` | Reusable stat card |
| ResponsiveGrid | `quikadmin-web/src/components/layout/responsive-grid.tsx` | Grid layout |
| Dashboard Tests | `quikadmin-web/e2e/tests/existing/dashboard-layout.spec.ts` | E2E tests |
| Dashboard Page Object | `quikadmin-web/e2e/pages/DashboardPage.ts` | Page object model |
| Auth Fixture | `quikadmin-web/e2e/fixtures/auth.fixture.ts` | Authentication fixture |
| Playwright Config | `quikadmin-web/playwright.config.ts` | Test configuration |

### B. Current Test Failures Summary

Based on the gap analysis, the 14 failing tests are likely:

1. `should navigate to dashboard successfully` - Auth redirect
2. `should display dashboard stats grid` - Auth redirect
3. `should render stat cards in correct grid layout` - Auth redirect + class mismatch
4. `should display recent documents section` - Auth redirect
5. `should display processing queue widget` - Auth redirect
6. `should display quick actions section` - Auth redirect
7. `should handle layout responsively` - Auth redirect
8. `should render all stat card icons` - Auth redirect
9. `should maintain consistent layout` - Auth redirect
10. `should render sidebar toggle on mobile` - Auth redirect
11. `should not have layout shift` - Auth redirect
12. `should display correct columns at each breakpoint` - Auth redirect + class mismatch

The 2 passing tests are likely on other pages (Templates, History, Knowledge Base, Upload) where the tests happen to work or have different auth requirements.

### C. Related PRDs

- `prd-e2e-playwright-tests.md` - Overall E2E test architecture
- `prd-e2e-test-architecture-fixes.md` - Test infrastructure improvements
- `prd-middleware-security-fixes.md` - Security middleware (affects auth)

---

**Document History**:
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-09 | AI Product Specialist | Initial draft |
