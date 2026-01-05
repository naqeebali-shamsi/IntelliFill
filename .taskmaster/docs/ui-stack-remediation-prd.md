# PRD: IntelliFill Frontend UI Stack Remediation

## Executive Summary

The IntelliFill frontend (`quikadmin-web/`) has accumulated significant technical debt in its UI layer, identified through a comprehensive 6-agent adversarial discovery audit. This PRD addresses 10 critical issues affecting 151+ files, including design token violations that break dark mode, duplicate utility functions, orphaned components, EOL dependencies, and accessibility gaps. Remediation will restore design system integrity, improve maintainability, and ensure consistent user experience across themes.

## Problem Statement

### Current Situation

The frontend was built with a solid foundation (Radix UI + CVA + TailwindCSS v4) but inconsistent execution has created:

- **151+ hardcoded color violations** across 31 files, bypassing the semantic token system
- **Dual theme systems** causing potential desynchronization (custom ThemeProvider + next-themes)
- **Copy-pasted utilities** (formatFileSize duplicated 3x)
- **Orphaned components** consuming bundle size with zero usage
- **Accessibility gaps** failing WCAG compliance

### User Impact

- Dark mode is broken in 31 components (colors don't adapt)
- Inconsistent loading states create jarring UX
- Screen reader users face navigation barriers
- Theme changes require editing 31+ files instead of CSS variables

### Business Impact

- Maintenance burden: 3x effort to update colors
- Technical debt slowing feature development
- Accessibility non-compliance risk
- Increased bug surface area from duplicate code

### Why Solve Now

- Dark mode is a premium feature users expect
- EOL dependencies (react-hook-form v7) pose security risks
- Technical debt compounds with each new feature
- Clear remediation path identified by discovery audit

## Goals & Success Metrics

### Goal 1: Design Token Compliance

- **Metric**: Hardcoded color violations
- **Baseline**: 151+ violations in 31 files
- **Target**: 0 violations
- **Timeframe**: End of remediation

### Goal 2: Theme System Unification

- **Metric**: Theme provider implementations
- **Baseline**: 2 (custom + next-themes)
- **Target**: 1 (custom only)
- **Timeframe**: Phase 1

### Goal 3: Code Deduplication

- **Metric**: Duplicate utility functions
- **Baseline**: 3 (formatFileSize)
- **Target**: 0
- **Timeframe**: Phase 1

### Goal 4: Accessibility Compliance

- **Metric**: ARIA violations
- **Baseline**: 26+ issues
- **Target**: 0 critical/high issues
- **Timeframe**: Phase 3

### Goal 5: Dependency Health

- **Metric**: EOL/unused dependencies
- **Baseline**: 3 (react-hook-form v7, next-themes, immer)
- **Target**: 0 EOL, remove unused
- **Timeframe**: Phase 2

## User Stories

### US-1: Developer Theming Experience

**As a** developer maintaining the UI
**I want** all colors to use semantic tokens
**So that** I can change the theme by updating CSS variables only

**Acceptance Criteria:**

1. All 151+ hardcoded colors replaced with semantic tokens
2. New semantic tokens created: --status-pending, --status-success, --status-warning, --status-error
3. Dark mode works correctly in all 31 affected files
4. No Tailwind color utilities (text-green-600, bg-blue-100) used directly in components
5. Documentation updated with token usage guide

### US-2: Consistent Loading States

**As a** user waiting for content
**I want** consistent loading indicators
**So that** I have a predictable experience across the app

**Acceptance Criteria:**

1. Single LoadingState component created
2. All 4 existing patterns migrated to shared component
3. ARIA role="status" and aria-busy applied consistently
4. Skeleton shimmer animation unified

### US-3: Accessible File Upload

**As a** keyboard-only user
**I want** to trigger file upload with Enter/Space keys
**So that** I can use the app without a mouse

**Acceptance Criteria:**

1. file-upload-zone.tsx responds to Enter and Space keydown
2. All interactive elements have aria-labels
3. Focus states are visible
4. Screen reader announces upload state changes

### US-4: Form Validation Consistency

**As a** developer building forms
**I want** clear guidance on form handling approach
**So that** I implement forms consistently

**Acceptance Criteria:**

1. Decision documented: RHF+Zod for complex forms, native for simple
2. form-preview.tsx refactored to follow pattern
3. All form components have consistent error display
4. Validation feedback shown before submit (not just on submit)

## Functional Requirements

### REQ-001: Create Semantic Status Color Tokens (Must Have)

Add CSS variables for status colors that adapt to light/dark themes.

- Location: `src/index.css`
- Tokens: --status-pending, --status-success, --status-warning, --status-error (bg and fg variants)
- Extend tailwind.config.js with status color mappings
- **Task hint**: Single file change + config update

### REQ-002: Migrate status-badge.tsx to Semantic Tokens (Must Have)

Replace all hardcoded colors in StatusBadge and StatusDot components.

- Current: `bg-gray-100 text-gray-700`, `bg-green-100 text-green-700`, etc.
- Target: `bg-status-pending text-status-pending-foreground`, etc.
- **Task hint**: CVA variants update, test dark mode

### REQ-003: Migrate processing-status.tsx to Semantic Tokens (Must Have)

Replace statusConfig object hardcoded colors and inline conditionals.

- Lines 80-84: statusConfig colors
- Lines 152-155: Inline bg-\* classes
- **Task hint**: Extract to shared status utility

### REQ-004: Migrate 11 Remaining Status Color Files (Must Have)

Batch migrate remaining files with hardcoded status colors:

- document-statistics.tsx
- ocr-confidence-alert.tsx
- profile-field-editor.tsx
- form-fill-history-card.tsx
- SuggestionPopover.tsx
- document-detail.tsx
- profile-selector.tsx
- SearchInterface.tsx
- OCRScanning.tsx
- ConnectedUpload.tsx
- Settings.tsx
- **Task hint**: Create migration script, apply systematically

### REQ-005: Remove next-themes Dependency (Must Have)

Eliminate dual theme system conflict.

- Remove from package.json
- Update sonner.tsx to use custom ThemeProvider
- Verify theme switching still works
- **Task hint**: Update imports, test toast theming

### REQ-006: Deduplicate formatFileSize Utility (Must Have)

Single source of truth for file size formatting.

- Keep: `utils/fileValidation.ts` (lines 167-175)
- Remove from: document-card.tsx, file-upload-zone.tsx
- Update imports in all consumers
- **Task hint**: Search for duplicates, update imports

### REQ-007: Remove Orphaned LazyRender Component (Should Have)

Delete unused component to reduce bundle size.

- Delete: `ui/lazy-render.tsx`
- Remove from index.ts exports
- Verify no broken imports
- **Task hint**: Grep for imports first

### REQ-008: Complete or Remove Collapsible Component (Should Have)

Either add CVA styling or document as Radix passthrough.

- Current: 9 lines, no styling
- Option A: Add CVA variants matching other primitives
- Option B: Document as intentional passthrough
- **Task hint**: Check SearchInterface usage pattern

### REQ-009: Fix ProgressCircular Export (Should Have)

Remove phantom export from index.ts.

- Currently exported but doesn't exist
- Either implement or remove export
- **Task hint**: Check if feature is needed

### REQ-010: Upgrade react-hook-form to v8 (Must Have)

Address EOL dependency.

- Current: v7.67.0 (EOL)
- Target: v8.x (latest stable)
- Update all 5 consuming files
- Run form tests after upgrade
- **Task hint**: Check migration guide for breaking changes

### REQ-011: Remove Unused immer Dependency (Should Have)

Clean up test-only dependency.

- Only used in test/setup.tsx
- Zustand doesn't require it
- Remove from package.json
- Update test setup if needed
- **Task hint**: Verify Zustand works without it

### REQ-012: Add Keyboard Activation to file-upload-zone (Must Have)

Fix accessibility gap.

- Add onKeyDown handler for Enter/Space
- Trigger file dialog on activation
- Ensure focus ring is visible
- **Task hint**: Mirror button keyboard behavior

### REQ-013: Add aria-live Regions for Status Updates (Must Have)

Screen reader support for dynamic content.

- processing-status.tsx needs aria-live="polite"
- Status changes should announce
- Loading states need aria-busy
- **Task hint**: Test with screen reader

### REQ-014: Standardize Loading State Component (Should Have)

Create unified loading pattern.

- New: `ui/loading-state.tsx`
- Props: variant (skeleton, spinner, overlay), size, aria-label
- Migrate 4 existing patterns
- **Task hint**: Start with skeleton variant

### REQ-015: Extract Magic Numbers to Constants (Should Have)

Improve maintainability.

- data-table.tsx: debounce (300ms), rowHeight (52px), maxHeight (400px)
- document-card.tsx: formatFileSize k (1024)
- ocr-confidence-alert.tsx: thresholds (already has constant, enforce usage)
- **Task hint**: Create constants file per domain

### REQ-016: Document Form Handling Strategy (Should Have)

Clear guidance for developers.

- When to use RHF+Zod (complex forms with validation)
- When to use native (simple forms, read-only)
- Add to CLAUDE.md or create forms guide
- **Task hint**: Document existing patterns

## Non-Functional Requirements

### NFR-001: Performance

- Bundle size increase: < 2KB after remediation
- No runtime performance regression
- Lazy loading maintained for heavy components

### NFR-002: Accessibility

- WCAG 2.1 AA compliance for all modified components
- All interactive elements keyboard accessible
- Color contrast ratio >= 4.5:1 for text

### NFR-003: Maintainability

- Zero duplicate utility functions
- Single theme system
- All colors via semantic tokens

### NFR-004: Compatibility

- Dark mode works in all browsers (Chrome, Firefox, Safari, Edge)
- No visual regressions in existing functionality

## Technical Considerations

### Architecture Impact

- CSS variable system extended (low risk)
- Component prop interfaces unchanged (backward compatible)
- No database or API changes

### Migration Strategy

1. Create new tokens (additive, non-breaking)
2. Migrate components one at a time
3. Remove old patterns after migration complete
4. Update tests alongside components

### Testing Strategy

- Visual regression tests for theme switching
- Unit tests for utility functions
- Accessibility audit with axe-core
- Manual dark mode verification

### Dependencies

- REQ-001 must complete before REQ-002 through REQ-004
- REQ-005 independent (can parallelize)
- REQ-010 (RHF upgrade) should be isolated branch

## Implementation Roadmap

### Phase 1: Foundation (Tasks 1-5)

- Create semantic status tokens
- Remove next-themes
- Deduplicate formatFileSize
- Estimated: 5 tasks

### Phase 2: Token Migration (Tasks 6-10)

- Migrate status-badge.tsx
- Migrate processing-status.tsx
- Migrate remaining 11 files
- Estimated: 5 tasks (batched migration)

### Phase 3: Cleanup & Accessibility (Tasks 11-15)

- Remove orphaned components
- Fix exports
- Add keyboard support
- Add aria-live regions
- Estimated: 5 tasks

### Phase 4: Standardization (Tasks 16-20)

- Create loading state component
- Extract magic numbers
- Upgrade react-hook-form
- Document form strategy
- Estimated: 5 tasks

### Phase 5: Validation (Tasks 21-22)

- Full dark mode audit
- Accessibility audit
- Performance verification
- Estimated: 2 tasks

## Out of Scope

- New feature development
- Backend changes
- Database modifications
- API changes
- New component creation (beyond loading-state)
- Major dependency upgrades beyond react-hook-form
- Full redesign of existing components
- Performance optimization beyond bundle size

## Open Questions & Risks

### Open Questions

1. Should Collapsible get CVA styling or remain a passthrough? (Owner: Frontend lead)
2. Is ProgressCircular needed for any planned features? (Owner: Product)
3. Should we remove react-hook-form entirely from unused areas? (Owner: Frontend lead)

### Risks

1. **Risk**: react-hook-form v8 has breaking changes
   - **Mitigation**: Review migration guide, test thoroughly, isolated branch

2. **Risk**: Token migration introduces visual regressions
   - **Mitigation**: Visual regression tests, manual QA for each component

3. **Risk**: Removing next-themes breaks toast theming
   - **Mitigation**: Test sonner.tsx thoroughly before removing dependency

## Validation Checkpoints

### Checkpoint 1: After Phase 1

- [ ] Semantic tokens created and documented
- [ ] next-themes removed, theme still works
- [ ] formatFileSize deduplicated

### Checkpoint 2: After Phase 2

- [ ] All 31 files migrated to semantic tokens
- [ ] Dark mode works in all components
- [ ] No hardcoded color classes remain

### Checkpoint 3: After Phase 3

- [ ] Orphaned components removed
- [ ] Keyboard accessibility complete
- [ ] Screen reader tested

### Checkpoint 4: After Phase 4

- [ ] Loading states unified
- [ ] Magic numbers extracted
- [ ] RHF upgraded
- [ ] Form strategy documented

### Checkpoint 5: Final

- [ ] Full accessibility audit passes
- [ ] Dark mode audit passes
- [ ] Bundle size verified
- [ ] All tests pass

## SME Adversarial Deliberation Protocol

For EACH task generated from this PRD, the following validation process MUST occur:

### Pre-Implementation Validation

1. **Task Validity Review**: SME agent challenges whether the task is actually needed
2. **Implementation Approach Review**: SME agent proposes alternative approaches
3. **Risk Assessment**: SME agent identifies what could go wrong
4. **Dependency Check**: SME agent verifies all prerequisites are met
5. **Acceptance Criteria Review**: SME agent confirms criteria are testable

### Post-Implementation Validation

1. **Code Review**: Expert agent reviews implementation quality
2. **Test Verification**: Agent confirms tests cover acceptance criteria
3. **Integration Check**: Agent verifies no regressions introduced

This adversarial approach ensures each task is valid, correctly implemented, and properly tested before marking complete.
