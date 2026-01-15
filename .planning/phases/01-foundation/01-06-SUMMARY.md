---
phase: 01-foundation
plan: 06
subsystem: ui
tags: [confidence, ux, progress, zustand, react]

# Dependency graph
requires:
  - phase: 01-05
    provides: Hardened extraction pipeline
provides:
  - Honest confidence badges (no misleading "Verified")
  - Extraction progress tracking in store
  - ExtractionProgressIndicator component
affects: [02-intelligence, ui, smart-profile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Semantic confidence labels ("High/Good confidence", "Review suggested")
    - Extraction progress state pattern in Zustand store
    - Accessible progress indicators with ARIA live regions

key-files:
  created:
    - quikadmin-web/src/components/smart-profile/ExtractionProgressIndicator.tsx
  modified:
    - quikadmin-web/src/components/smart-profile/ConfidenceBadge.tsx
    - quikadmin-web/src/stores/smartProfileStore.ts

key-decisions:
  - 'Removed "Verified" label entirely - it overstated AI certainty'
  - 'Four-tier confidence labels: High (95%+), Good (85-94%), Review (70-84%), Low (<70%)'
  - 'Tooltips show actual percentage for transparency'
  - 'Extraction progress not persisted (resets on page reload)'

patterns-established:
  - 'Honest AI uncertainty communication via semantic labels'
  - 'Progress tracking pattern with status/currentFile/counts'
  - 'useExtractionProgress hook for extraction UI feedback'

issues-created: []

# Metrics
duration: 8min
completed: 2026-01-15
---

# Phase 01 Plan 06: Confidence UX Summary

**Honest confidence badges with semantic labels and extraction progress indicators showing current file and document count**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-15T09:00:00Z
- **Completed:** 2026-01-15T09:08:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Replaced misleading "Verified" label with honest semantic confidence tiers
- Added tooltip showing actual extraction percentage on hover
- Created ExtractionProgress state in Zustand store with status tracking
- Built ExtractionProgressIndicator component with file name, count, and progress bar
- Users now understand AI uncertainty and what's happening during extraction

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix confidence badge thresholds and labels** - `a368aa3` (feat)
2. **Task 2: Add extraction progress indicators** - `dd4bffd` (feat)

**Plan metadata:** `cfe4c4e` (docs: complete plan)

## Files Created/Modified

- `quikadmin-web/src/components/smart-profile/ConfidenceBadge.tsx` - Updated labels: High/Good confidence, Review suggested, Low confidence; added percentage tooltip
- `quikadmin-web/src/stores/smartProfileStore.ts` - Added ExtractionProgress interface, state, actions, selectors, and useExtractionProgress hook
- `quikadmin-web/src/components/smart-profile/ExtractionProgressIndicator.tsx` - New component showing current file, X of Y count, progress bar, status messages

## Decisions Made

- **Removed "Verified":** Users were trusting uncertain data when they saw "Verified" at 85%. Honest labels encourage review.
- **Four confidence tiers:** Maps well to user mental model - high/good means probably correct, review/low means check it
- **Percentage in tooltip:** Power users can see exact number without cluttering UI for everyone
- **Progress not persisted:** Extraction is transient; should reset on page reload

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Phase 1 Foundation complete - all 6 plans finished
- Ready for Phase 2: Intelligence (person grouping, confidence review)
- All P0 issues from expert review addressed (backend in 01-05, frontend in 01-06)

---

_Phase: 01-foundation_
_Completed: 2026-01-15_
