# PRD: Theme Modernization - Brand Color Alignment

**Version:** 1.0
**Date:** 2026-01-05
**Status:** Ready for Implementation
**Author:** Multi-Agent Expert Panel (Unanimous Agreement)

---

## Executive Summary

Modernize IntelliFill's theme system to align with brand identity by replacing the current indigo primary (#6366f1) with brand teal (#02C39A), anchoring neutrals to logo black (#222823), and eliminating 57+ hardcoded color instances across the codebase. This creates a distinctive, accessible, GTM-ready visual identity.

---

## Problem Statement

### Current Situation

- Primary color (#6366f1 indigo) does not match the brand logo colors
- 31+ instances of hardcoded gray Tailwind classes bypass the semantic token system
- 6+ instances of purple/indigo accents are inconsistent with brand identity
- Avatar.svg uses wrong colors (#6366f1 instead of brand colors)
- Mixed use of semantic tokens and literal colors creates maintenance burden

### User Impact

- Inconsistent visual experience between auth pages and core app
- Dark mode partially broken in hardcoded areas
- Brand recognition weakened by non-cohesive color usage

### Business Impact

- Diluted brand identity reduces market differentiation
- Technical debt increases maintenance costs
- Inaccessible color combinations risk compliance issues

### Why Solve Now

- Theme modernization report completed with unanimous expert agreement
- All research, accessibility analysis, and token specifications ready
- Clear atomic migration path defined

---

## Goals & Success Metrics

### Goal 1: Brand Color Alignment

- **Metric:** Primary color usage across UI
- **Baseline:** 0% brand teal usage (currently indigo)
- **Target:** 100% primary actions use brand teal (#02C39A)
- **Timeframe:** Immediate upon completion

### Goal 2: Eliminate Hardcoded Colors

- **Metric:** Count of hardcoded Tailwind color classes
- **Baseline:** 57+ hardcoded color instances
- **Target:** 0 hardcoded color instances (all semantic tokens)
- **Timeframe:** By end of Phase 2

### Goal 3: Accessibility Compliance

- **Metric:** WCAG AA contrast compliance
- **Baseline:** Unknown (hardcoded values not tested)
- **Target:** 100% AA compliance, 80% AAA for key elements
- **Timeframe:** Verified during implementation

### Goal 4: Dark Mode Consistency

- **Metric:** Components with proper dark mode support
- **Baseline:** ~70% (auth pages broken)
- **Target:** 100% dark mode support
- **Timeframe:** By end of Phase 2

---

## User Stories

### US-1: Consistent Brand Experience

**As a** user visiting IntelliFill
**I want to** see consistent teal branding across all pages
**So that I** immediately recognize the brand and feel trust

**Acceptance Criteria:**

- All CTA buttons use brand teal (#02C39A)
- All links use accessible teal-700 on light backgrounds
- Logo colors match UI accent colors
- Login page matches dashboard branding

### US-2: Accessible Color Contrast

**As a** user with visual impairments
**I want to** clearly see all text and interactive elements
**So that I** can use the application effectively

**Acceptance Criteria:**

- All text meets WCAG AA 4.5:1 contrast ratio
- Focus rings visible on all backgrounds
- Status colors distinct from brand colors
- Dark mode maintains same accessibility standards

### US-3: Seamless Mode Switching

**As a** user switching between light and dark mode
**I want to** see consistent, comfortable visuals in both modes
**So that I** can use my preferred mode without issues

**Acceptance Criteria:**

- No hardcoded colors that break in dark mode
- Teal accent visible in both modes
- Text remains readable in both modes
- No flash of wrong colors during switch

---

## Functional Requirements

### REQ-001: Update CSS Variable Definitions (MUST)

**Priority:** P0 - Critical
**Description:** Update index.css CSS variables to use brand colors
**Implementation:**

- Replace `--primary: 239 84% 67%` with `--primary: 163 98% 39%`
- Update `--ring` to match new primary
- Verify `--primary-foreground` provides sufficient contrast
  **Test:** Visual inspection + contrast ratio validation

### REQ-002: Update Light Mode Neutral Tokens (MUST)

**Priority:** P0 - Critical
**Description:** Ensure neutral tokens use slate scale for cool harmony
**Implementation:**

- Verify `--background`, `--foreground`, `--muted`, `--border` use slate values
- Current values already correct (slate-based), minimal changes needed
  **Test:** Build succeeds, visual inspection

### REQ-003: Update Dark Mode Tokens (MUST)

**Priority:** P0 - Critical
**Description:** Ensure dark mode tokens are correct
**Implementation:**

- Keep `--primary: 163 98% 39%` (same as light - AAA compliant)
- Update `--primary-foreground: 0 0% 100%` (white text in dark mode)
  **Test:** Toggle dark mode, verify all elements visible

### REQ-004: Migrate Auth Page Gray Classes (MUST)

**Priority:** P1 - High
**Description:** Replace hardcoded gray-\* classes with semantic tokens
**Files:** Login.tsx, Register.tsx, ForgotPassword.tsx, ResetPassword.tsx, VerifyEmail.tsx, AuthCallback.tsx
**Implementation:**

- Replace `from-gray-50 to-gray-100` with `from-background to-muted`
- Replace `text-gray-500/600` with `text-muted-foreground`
- Replace `bg-gray-*` with `bg-muted` or `bg-background`
  **Test:** Visual inspection in both modes

### REQ-005: Migrate Accent Gradients (MUST)

**Priority:** P1 - High
**Description:** Replace purple/indigo gradients with teal-based
**Files:** index.css (.text-gradient), AppLayout.tsx, SimpleFillForm.tsx
**Implementation:**

- Update `.text-gradient` utility to use primary colors
- Replace `from-indigo-*` and `via-purple-*` patterns
  **Test:** Visual inspection of gradient elements

### REQ-006: Update Avatar SVG (MUST)

**Priority:** P1 - High
**Description:** Fix avatar.svg to use brand colors
**File:** public/avatar.svg
**Implementation:**

- Replace #6366f1 with #02C39A
- Replace #e0e7ff with appropriate teal tint
  **Test:** Visual inspection of user avatars

### REQ-007: Keep Semantic Status Colors (SHOULD)

**Priority:** P2 - Medium
**Description:** Preserve distinct status colors for accessibility
**Implementation:**

- Keep green for success, red for error, amber for warning, blue for info
- Do NOT consolidate success with teal
  **Test:** Status badges display correct colors

### REQ-008: Verify Component Focus States (SHOULD)

**Priority:** P2 - Medium
**Description:** Ensure focus rings use new primary color
**Implementation:**

- `--ring` already updated in REQ-001
- Verify buttons, inputs, links show teal focus ring
  **Test:** Tab through interface, verify focus visibility

### REQ-009: Update Demo Mode Indicator (COULD)

**Priority:** P3 - Low
**Description:** Review amber demo indicator for brand harmony
**File:** demo-mode-indicator.tsx
**Implementation:**

- Keep amber (semantic warning color) but verify harmony
- No changes required if acceptable
  **Test:** Visual inspection in demo mode

---

## Non-Functional Requirements

### NFR-001: Contrast Accessibility

- All text on light backgrounds: minimum 4.5:1 contrast (WCAG AA)
- All text on dark backgrounds: minimum 4.5:1 contrast
- Large text (18px+): minimum 3:1 contrast
- UI components: minimum 3:1 against background

### NFR-002: Performance

- No impact on bundle size (token changes only)
- No impact on runtime performance
- CSS variable resolution unchanged

### NFR-003: Browser Compatibility

- Support all browsers that support CSS custom properties
- Maintain existing browser support matrix

### NFR-004: Maintainability

- Zero hardcoded color values after migration
- All colors via semantic tokens
- ESLint rules to prevent future hardcoding

---

## Technical Considerations

### Architecture

The theme system uses:

- CSS custom properties defined in index.css
- Tailwind config extending colors via `hsl(var(--token))`
- shadcn/ui component library consuming tokens
- ThemeProvider managing class-based dark mode

### Key Files to Modify

| File                                | Changes                       | Risk Level |
| ----------------------------------- | ----------------------------- | ---------- |
| src/index.css                       | CSS variables (lines 145-234) | Low        |
| public/avatar.svg                   | Replace indigo colors         | Low        |
| src/pages/Login.tsx                 | Replace 8 gray classes        | Low        |
| src/pages/Register.tsx              | Replace 11 gray classes       | Low        |
| src/pages/ForgotPassword.tsx        | Replace 5 gray classes        | Low        |
| src/pages/ResetPassword.tsx         | Replace 9 gray classes        | Low        |
| src/pages/VerifyEmail.tsx           | Replace 5 gray classes        | Low        |
| src/pages/AuthCallback.tsx          | Replace 4 gray classes        | Low        |
| src/components/layout/AppLayout.tsx | Replace purple gradient       | Low        |
| src/pages/SimpleFillForm.tsx        | Replace indigo gradient       | Low        |

### Migration Strategy

1. **Phase 1:** Update CSS variables (foundation)
2. **Phase 2:** Migrate auth pages (highest impact)
3. **Phase 3:** Migrate accent gradients
4. **Phase 4:** Verify and polish

### Testing Strategy

- Visual regression: Screenshot comparison before/after
- Accessibility: Automated contrast checking
- Dark mode: Toggle and verify all screens
- Build: Ensure no compilation errors

---

## Implementation Roadmap

### Phase 1: Token Foundation (1-2 hours)

1. Update CSS variables in index.css
2. Update avatar.svg colors
3. Verify build succeeds
4. Visual spot-check both modes

### Phase 2: Auth Page Migration (2-3 hours)

1. Login.tsx migration
2. Register.tsx migration
3. ForgotPassword.tsx migration
4. ResetPassword.tsx migration
5. VerifyEmail.tsx migration
6. AuthCallback.tsx migration
7. ProtectedRoute.tsx migration

### Phase 3: Accent Migration (1 hour)

1. Update .text-gradient utility
2. AppLayout.tsx gradient
3. SimpleFillForm.tsx gradient
4. Settings.tsx accents

### Phase 4: Verification & Polish (1 hour)

1. Full visual audit both modes
2. Accessibility verification
3. Component focus states
4. Documentation update

---

## Out of Scope

- **Status color changes:** Green/red/amber/blue remain distinct
- **Typography changes:** Font family and sizing unchanged
- **Layout changes:** No structural modifications
- **Animation changes:** Keyframes and transitions unchanged
- **Component API changes:** No props or behavior changes
- **New components:** No new UI components created

---

## Open Questions & Risks

### Resolved Questions

- Q: Should teal be primary or secondary? A: PRIMARY (unanimous)
- Q: Which neutral scale? A: Slate (unanimous)
- Q: Same teal in both modes? A: Yes, AAA compliant (unanimous)

### Known Risks

| Risk               | Likelihood | Impact | Mitigation                  |
| ------------------ | ---------- | ------ | --------------------------- |
| Visual regression  | Low        | Medium | Screenshot comparison       |
| Accessibility miss | Low        | High   | Automated contrast checks   |
| Dark mode break    | Medium     | Medium | Test toggle after each file |
| Merge conflicts    | Low        | Low    | Work on feature branch      |

---

## Validation Checkpoints

### Checkpoint 1: After Phase 1

- [ ] CSS variables updated
- [ ] Build succeeds
- [ ] Both modes render correctly
- [ ] Avatar shows new colors

### Checkpoint 2: After Phase 2

- [ ] All auth pages migrated
- [ ] No gray-\* classes in auth pages
- [ ] Dark mode works on all auth pages
- [ ] Accessibility verified

### Checkpoint 3: After Phase 3

- [ ] All gradients use teal
- [ ] No purple/indigo in codebase
- [ ] Visual harmony achieved

### Checkpoint 4: Final

- [ ] Zero hardcoded colors
- [ ] WCAG AA compliance verified
- [ ] Documentation updated
- [ ] Ready for merge

---

## References

- [Theme Modernization Report](docs/design/theme-modernization-report.md)
- [Accessibility Research Report](docs/research/theme-accessibility-report.md)
- [Brand Identity Brief](Brand Guardian agent output)
- [Trend Research](Trend Researcher agent output)

---

## Appendix: Token Specification

### Light Mode Final Tokens

```css
:root {
  --primary: 163 98% 39%; /* #02C39A */
  --primary-foreground: 135 5% 14%; /* #222823 */
  --ring: 163 98% 39%;
  /* Neutrals remain slate-based (current values correct) */
}
```

### Dark Mode Final Tokens

```css
.dark {
  --primary: 163 98% 39%; /* Same teal */
  --primary-foreground: 0 0% 100%; /* White text */
  --ring: 163 98% 39%;
  /* Neutrals remain slate-based (current values correct) */
}
```

### Hardcoded Replacements

| Pattern                    | Replace With               |
| -------------------------- | -------------------------- |
| `text-gray-500`            | `text-muted-foreground`    |
| `text-gray-600`            | `text-foreground/80`       |
| `bg-gray-50`               | `bg-background`            |
| `bg-gray-100`              | `bg-muted`                 |
| `from-gray-50 to-gray-100` | `from-background to-muted` |
| `from-indigo-*`            | `from-primary`             |
| `via-purple-*`             | Remove or `via-primary/80` |
