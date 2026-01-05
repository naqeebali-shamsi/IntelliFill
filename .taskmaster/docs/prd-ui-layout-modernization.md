# PRD: IntelliFill UI Layout Modernization

## Overview

**Project**: IntelliFill Frontend Layout Standardization
**Target**: `quikadmin-web` React application
**Timeline**: 6 weeks (Stages 0-4)
**Priority**: High - Affects maintainability and UX consistency

## Problem Statement

The IntelliFill frontend has well-designed layout primitives (`PageHeader`, `ResponsiveGrid`, `ContentContainer`) that are largely unused. Pages implement ad-hoc patterns creating:

1. **Inconsistent UX**: 4 different grid breakpoint patterns for similar content
2. **Code duplication**: 5 StatCard implementations (~135 duplicated lines)
3. **Maintenance burden**: Animation variants duplicated in 7 files (~98 lines)
4. **Container confusion**: Three different max-width values (1280px, 1400px, 1536px)

### Current State Metrics

| Metric                   | Current          | Target    |
| ------------------------ | ---------------- | --------- |
| PageHeader adoption      | 31% (4/13 pages) | 100%      |
| ResponsiveGrid adoption  | 0%               | 100%      |
| StatCard implementations | 5 separate       | 1 unified |
| Layout test coverage     | ~33%             | 80%       |

## Goals

### Primary Goals

1. **Standardize container width** to `max-w-7xl` (1280px) across all pages
2. **Unify StatCard** into single reusable component with consistent API
3. **Achieve 80% adoption** of layout primitives (PageHeader, ResponsiveGrid)
4. **Add test coverage** before any migrations to prevent regressions

### Non-Goals

- Full UI redesign or visual overhaul
- Business logic changes
- Adding new UI frameworks
- Changing the auth layout system

## Technical Requirements

### Requirement 1: Test Infrastructure Foundation

**Priority**: P0 (Blocker for all other work)

Create comprehensive test coverage before any layout changes:

- E2E responsive breakpoint tests covering 5 viewport sizes (375px, 640px, 768px, 1024px, 1280px)
- Unit tests for AppLayout component (currently 0 tests)
- Unit tests for content-container component
- Add `data-testid` attributes to all existing StatCard usages (5 locations)
- Visual regression test baseline screenshots

**Acceptance Criteria**:

- All 5 viewport sizes have passing E2E tests for grid layouts
- AppLayout has minimum 6 unit tests covering sidebar collapse, mobile drawer, logout
- All StatCard usages have `data-testid` for migration tracking

### Requirement 2: Shared Animation Library

**Priority**: P1

Extract duplicated animation variants to shared location:

- Create `lib/animations.ts` with reusable Framer Motion variants
- Export `fadeInUp`, `staggerContainer`, `slideIn` variants
- Migrate 7 files to use shared variants
- Remove duplicated animation code from pages

**Files Affected**:

- `ConnectedDashboard.tsx`
- `DocumentLibrary.tsx`
- `Templates.tsx`
- `History.tsx`
- `ProfileList.tsx`
- `ConnectedUpload.tsx`
- `Settings.tsx`

**Acceptance Criteria**:

- Single source of truth for animation variants in `lib/animations.ts`
- All 7 pages import from shared location
- No animation variant definitions remain in page files
- Existing animations unchanged visually

### Requirement 3: AppLayout Bottom Padding

**Priority**: P1

Move `pb-20` from individual pages to AppLayout:

- Add `pb-20` to AppLayout main content area
- Remove `pb-20` from all 8 page containers
- Ensure consistent bottom spacing across all routes

**Files Affected**:

- `components/layout/AppLayout.tsx`
- `ConnectedDashboard.tsx`, `DocumentLibrary.tsx`, `Templates.tsx`, `History.tsx`
- `ProfileList.tsx`, `ConnectedUpload.tsx`, `Settings.tsx`, `KnowledgeBase.tsx`

**Acceptance Criteria**:

- AppLayout adds bottom padding to main content
- No pages have inline `pb-20` classes
- Visual appearance unchanged

### Requirement 4: Enhanced ResponsiveGrid

**Priority**: P1

Extend ResponsiveGrid to cover all current use cases:

- Add `xl:grid-cols-4` variant (missing, needed by 3 pages)
- Add named presets: `stats`, `cards`, `sidebar`, `twoColumn`
- Add `className` passthrough for custom styling
- Update tests for new variants

**Current ResponsiveGrid variants**:

```typescript
cols: {
  (1, 2, 3, 4, 5, 6);
}
gap: {
  (none, sm, md, lg, xl);
}
```

**Required additions**:

```typescript
preset: {
  stats: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
  cards: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
  sidebar: "grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8",
  twoColumn: "grid-cols-1 lg:grid-cols-2 gap-6"
}
```

**Acceptance Criteria**:

- ResponsiveGrid supports `preset` prop
- All 4 presets render correct grid classes
- Existing `cols` and `gap` props still work
- 6 new unit tests for preset functionality

### Requirement 5: Unified StatCard Component

**Priority**: P1

Create single StatCard component replacing 5 implementations:

**Location**: `components/features/stat-card.tsx`

**Interface**:

```typescript
interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'error';
  loading?: boolean;
  animationDelay?: number;
  className?: string;
}
```

**Current implementations to replace**:

1. `Templates.tsx:88-119` (32 lines)
2. `History.tsx:137-152` (16 lines)
3. `KnowledgeBase.tsx:101-130` (30 lines)
4. `ConnectedUpload.tsx:71-76` (6 lines)
5. `document-statistics.tsx:169-219` (51 lines)

**Acceptance Criteria**:

- Single StatCard component in features folder
- Supports all prop variations from existing implementations
- Loading skeleton state
- Variant-based color coding
- Animation delay support for staggered entry
- 8 unit tests minimum
- Exported from components index

### Requirement 6: Page Migration - History

**Priority**: P2

Migrate History page to use unified components:

- Replace inline StatCard with unified component
- Already uses PageHeader (keep as-is)
- Use ResponsiveGrid `preset="stats"` for stats section
- Verify visual parity with before/after screenshots

**Acceptance Criteria**:

- History page imports unified StatCard
- Uses ResponsiveGrid for stats layout
- No visual differences from current implementation
- E2E tests pass at all 5 viewports

### Requirement 7: Page Migration - DocumentLibrary

**Priority**: P2

Migrate DocumentLibrary to layout primitives:

- Add PageHeader with breadcrumbs
- Use ResponsiveGrid `preset="cards"` for document grid
- Remove inline grid classes
- Add FilterToolbar pattern extraction (optional)

**Acceptance Criteria**:

- DocumentLibrary uses PageHeader
- Uses ResponsiveGrid preset for document cards
- Grid shows 1/2/3/4 columns at mobile/sm/lg/xl
- E2E tests pass at all 5 viewports

### Requirement 8: Page Migration - ProfileList

**Priority**: P2

Migrate ProfileList to layout primitives:

- Add PageHeader with title and actions
- Use ResponsiveGrid `preset="cards"` for profile cards
- Remove inline grid and container classes

**Acceptance Criteria**:

- ProfileList uses PageHeader
- Uses ResponsiveGrid for profile cards
- Grid responsive behavior matches DocumentLibrary
- E2E tests pass

### Requirement 9: Page Migration - Templates

**Priority**: P2

Migrate Templates page to layout primitives:

- Add PageHeader
- Use unified StatCard for template stats
- Use ResponsiveGrid `preset="cards"` for template grid
- Remove inline implementations

**Acceptance Criteria**:

- Templates uses PageHeader, StatCard, ResponsiveGrid
- All inline layout code removed
- Visual parity maintained
- E2E tests pass

### Requirement 10: Page Migration - Dashboard

**Priority**: P3

Migrate ConnectedDashboard to layout primitives:

- Use unified StatCard for all dashboard stats
- Use ResponsiveGrid presets for layout sections
- This is the most complex page - careful migration required

**Acceptance Criteria**:

- Dashboard uses unified StatCard (4 instances)
- Uses appropriate ResponsiveGrid presets
- Activity feed and recent documents sections use grid
- No visual regressions

### Requirement 11: Remaining Page Migrations

**Priority**: P3

Migrate remaining pages:

- `ConnectedUpload.tsx` - Use StatCard and ResponsiveGrid
- `Settings.tsx` - Use PageHeader
- `KnowledgeBase.tsx` - Use StatCard and PageHeader

**Acceptance Criteria**:

- All pages use layout primitives
- 100% PageHeader adoption
- 100% ResponsiveGrid adoption for card/grid layouts
- All E2E tests pass

### Requirement 12: Design Tokens Documentation

**Priority**: P4

Document standardized design tokens:

- Create `docs/design-tokens.md` with spacing scale
- Document container widths
- Document z-index scale
- Add CSS custom properties to `index.css` if beneficial

**Acceptance Criteria**:

- Design tokens documented
- Team aware of standard values
- No new magic numbers introduced

## Technical Specifications

### File Structure

```
quikadmin-web/src/
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx        # Add pb-20 to main
│   │   ├── page-header.tsx      # Existing
│   │   ├── responsive-grid.tsx  # Add presets
│   │   └── __tests__/
│   │       ├── AppLayout.test.tsx      # NEW
│   │       └── responsive-grid.test.tsx # Expand
│   └── features/
│       ├── stat-card.tsx        # NEW unified
│       └── __tests__/
│           └── stat-card.test.tsx  # NEW
├── lib/
│   └── animations.ts            # NEW shared variants
└── pages/
    ├── History.tsx              # Stage 3 pilot
    ├── DocumentLibrary.tsx      # Stage 3 pilot
    └── ...                      # Stage 4
```

### Testing Requirements

| Component      | Unit Tests | E2E Tests |
| -------------- | ---------- | --------- |
| AppLayout      | 6 minimum  | 2         |
| ResponsiveGrid | 10 total   | 4         |
| StatCard       | 8 minimum  | 4         |
| PageHeader     | 8 existing | 2         |

### Rollback Strategy

- Each requirement is a separate PR
- Feature flags not needed (additive changes)
- Old implementations kept until migration verified
- Git revert available for each stage

## Success Metrics

1. **Code Reduction**: -200 lines from deduplication
2. **Test Coverage**: Layout components at 80%
3. **Adoption**: 100% PageHeader, 100% ResponsiveGrid usage
4. **Zero Regressions**: All E2E tests pass after migration

## Dependencies

- No external dependencies required
- Uses existing shadcn/ui patterns
- Uses existing Tailwind configuration
- Uses existing Framer Motion

## Risks

| Risk                               | Mitigation                          |
| ---------------------------------- | ----------------------------------- |
| Visual regression during migration | Screenshot comparison, E2E tests    |
| Breaking responsive behavior       | Test at 5 viewports before/after    |
| Incomplete StatCard API coverage   | Analyze all 5 implementations first |
| Team velocity impact               | Phased rollout, pilot pages first   |
