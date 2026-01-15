---
phase: 02-intelligence
plan: 01
subsystem: entity-resolution
tags: [entity-resolution, person-grouping, fuzzball, dnd-kit, multi-person]

# Dependency graph
requires:
  - phase: 01-06
    provides: Confident UX foundation
provides:
  - Entity resolution utilities (frontend)
  - PersonGroupingService (backend)
  - extract-batch endpoint returns detected people
affects: [02-02-plan, smart-profile-wizard, frontend-grouping-ui]

# Tech tracking
tech-stack:
  added:
    - fuzzball@2.2.3 (backend - Jaro-Winkler string similarity)
    - "@dnd-kit/core@6.3.1" (frontend - drag-drop)
    - "@dnd-kit/sortable@10.0.0" (frontend - sortable lists)
    - "@dnd-kit/utilities@3.2.2" (frontend - DnD helpers)
    - fuse.js@7.1.0 (frontend - fuzzy search)
  patterns:
    - Three-tier entity matching (exact ID, high similarity, moderate suggest)
    - Union-Find algorithm for efficient grouping
    - Name transliteration detection for Arabic variants

key-files:
  created:
    - quikadmin-web/src/lib/entity-resolution/nameSimilarity.ts
    - quikadmin-web/src/lib/entity-resolution/idMatcher.ts
    - quikadmin-web/src/lib/entity-resolution/personMatcher.ts
    - quikadmin-web/src/lib/entity-resolution/index.ts
    - quikadmin/src/services/PersonGroupingService.ts
  modified:
    - quikadmin/package.json
    - quikadmin-web/package.json
    - quikadmin/src/api/smart-profile.routes.ts

key-decisions:
  - "Use fuzzball token_sort_ratio for name matching (handles reordering)"
  - "Three thresholds: AUTO_GROUP=0.95, SUGGEST=0.85, REVIEW=0.70"
  - "Keep documents separate by default (safer than false merge)"
  - "Union-Find for O(n) amortized grouping efficiency"

patterns-established:
  - "DocumentExtraction interface for grouping input"
  - "PersonGroup and SuggestedMerge types for output"
  - "Arabic transliteration map for Mohamed/Mohammed variants"

issues-created: []

# Metrics
duration: 25min
completed: 2026-01-15
---

# Phase 02 Plan 01: Entity Resolution Backend Summary

**Backend foundation for multi-person document grouping with entity resolution**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-01-15
- **Completed:** 2026-01-15
- **Tasks:** 4
- **Files created:** 5
- **Files modified:** 3

## Accomplishments

- Installed entity resolution dependencies (fuzzball, @dnd-kit, fuse.js)
- Created frontend entity resolution utilities for display and UI logic
- Implemented PersonGroupingService with Jaro-Winkler similarity matching
- Enhanced extract-batch endpoint to detect and return person groups

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies** - `07023e2` - fuzzball (backend), @dnd-kit + fuse.js (frontend)
2. **Task 2: Entity resolution utilities** - `b2bc205` - nameSimilarity, idMatcher, personMatcher
3. **Task 3: PersonGroupingService** - `328fb8d` - Union-Find grouping with three-tier matching
4. **Task 4: Extract-batch enhancement** - `5917306` - Returns detectedPeople array

## Files Created/Modified

### Frontend (quikadmin-web)

- `src/lib/entity-resolution/nameSimilarity.ts` - Name normalization, transliteration variants, TRANSLITERATION_MAP
- `src/lib/entity-resolution/idMatcher.ts` - ID normalization, compareIds with tiered matching
- `src/lib/entity-resolution/personMatcher.ts` - MATCH_THRESHOLDS, MatchResult type, helper functions
- `src/lib/entity-resolution/index.ts` - Re-exports all utilities
- `package.json` - Added @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, fuse.js

### Backend (quikadmin)

- `src/services/PersonGroupingService.ts` - Core grouping logic with fuzzball
- `src/api/smart-profile.routes.ts` - ExtractBatchResponse includes detectedPeople
- `package.json` - Added fuzzball

## Decisions Made

- **fuzzball over string-similarity:** Jaro-Winkler handles name prefixes better
- **token_sort_ratio:** Handles "Ali Mohamed" vs "Mohamed Ali" correctly
- **Conservative thresholds:** 0.95 for auto-group prevents false merges
- **Union-Find algorithm:** Efficient for transitive grouping (A=B, B=C -> A=B=C)

## Deviations from Plan

- @types/fuzzball doesn't exist on npm - fuzzball includes its own TypeScript definitions
- @dnd-kit/sortable installed at v10.0.0 (newer than planned v8.0.0)

## Issues Encountered

- npm install issues due to pnpm workspace setup - resolved by using `pnpm add -F`
- Pre-existing TypeScript errors in other files (not related to this plan)

## Next Plan Readiness

- Plan 02-01 complete - backend entity resolution foundation ready
- Plan 02-02 will implement PersonGrouper UI component
- Frontend has utilities for display; backend provides grouping data

---

_Phase: 02-intelligence_
_Plan: 01_
_Completed: 2026-01-15_
