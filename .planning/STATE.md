# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-13)

**Core value:** Users want to drop documents and fill forms — not manage technical complexity
**Current focus:** Phase 2 — Intelligence

## Current Position

Phase: 2 of 4 (Intelligence)
Plan: 1 of N complete
Status: Plan 02-01 complete
Last activity: 2026-01-15 — Completed 02-01: Entity Resolution Backend

Progress: ████░░░░░░ 40% (Phase 2)

## Performance Metrics

**Velocity:**

- Total plans completed: 7
- Average duration: ~17 min
- Total execution time: ~123 min

**By Phase:**

| Phase          | Plans | Total   | Avg/Plan |
| -------------- | ----- | ------- | -------- |
| 1-Foundation   | 6/6   | ~98 min | ~16 min  |
| 2-Intelligence | 1/N   | ~25 min | ~25 min  |

**Recent Trend:**

- Last 3 plans: 01-05 (~12 min), 01-06 (~8 min), 02-01 (~25 min)
- Trend: 02-01 took longer due to new library integration

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Parallel flow, not replacement (PRO agents need existing power-user features)
- Person grouping defaults to separate (safer to let users merge)
- Confidence thresholds start at 85% (conservative, tune based on corrections)
- Confidence badges show semantic labels, not raw percentages
- 30-second timeout for Gemini API calls
- Max 5 concurrent Gemini calls (rate limiting)
- Native Semaphore implementation for rate limiting
- Removed "Verified" label - overstated AI certainty
- Four-tier confidence: High (95%+), Good (85-94%), Review (70-84%), Low (<70%)
- **NEW:** Entity resolution thresholds: AUTO_GROUP=0.95, SUGGEST=0.85, REVIEW=0.70
- **NEW:** Use fuzzball token_sort_ratio for name matching (handles name reordering)
- **NEW:** Union-Find algorithm for grouping efficiency

### Deferred Issues

None yet.

### Blockers/Concerns

- Pre-existing TypeScript errors in modified files from prior work (not blocking)

## Session Continuity

Last session: 2026-01-15
Stopped at: Completed 02-01-PLAN.md - Entity Resolution Backend
Resume file: None
Next: 02-02-PLAN.md (PersonGrouper UI)

## Plan 02-01 Summary

**Entity Resolution Backend Foundation:**

- Installed fuzzball (backend), @dnd-kit + fuse.js (frontend)
- Created frontend entity-resolution utilities
- Implemented PersonGroupingService with Union-Find grouping
- Enhanced extract-batch endpoint to return detectedPeople

**Commits:**

- `07023e2`: Install dependencies
- `b2bc205`: Frontend entity resolution utilities
- `328fb8d`: PersonGroupingService
- `5917306`: Enhance extract-batch endpoint
