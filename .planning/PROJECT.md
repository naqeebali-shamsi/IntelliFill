# Project Brief: Smart Profile UX

## Current State (v1.0 Shipped)

**Shipped:** 2026-01-16
**LOC:** ~13k TypeScript/React (60 files)
**Tech stack:** React 18, Vite, Zustand 5, Framer Motion, @dnd-kit, Radix UI

The Smart Profile wizard is live at `/smart-profile` with:

- 3-step wizard: Upload → See → Fill
- Smart document detection with Gemini AI
- Multi-person entity resolution with drag-drop grouping
- Confidence-based review flow
- Smart form suggestions
- PRO features (scaffolded): client library, form analytics, admin dashboard

## What This Is

A simplified "Upload → See → Fill" experience for IntelliFill that hides backend complexity while preserving power-user capabilities. This is a **new entry point** (`/smart-profile`), not a rewrite of the existing frontend.

## Core Value

**Users want to drop documents and fill forms** — not manage sync/async extraction, mergeToProfile parameters, or document categories.

## Requirements

### Validated (v1.0)

- New `/smart-profile` route with wizard flow — v1.0
- Smart Upload Zone with auto-detection (F1) — v1.0
- Person Grouping UI for multi-person uploads (F2) — v1.0
- Quick Confidence Review for low-certainty fields (F3) — v1.0
- Smart Profile View with missing field alerts (F4) — v1.0
- Smart Form Suggestion (F5) — v1.0
- Assisted vs Express mode toggle (F6) — v1.0
- 4 new backend endpoints under `/api/smart-profile/` — v1.0
- PRO client library and search — v1.0 (scaffolded)
- Form usage analytics — v1.0 (scaffolded)
- Admin accuracy dashboard — v1.0 (scaffolded)

### Active

- Real-user validation and feedback collection
- Performance tuning based on production metrics
- Mobile-responsive polish
- Accessibility audit (WCAG 2.1 AA)

### Out of Scope

- Rewriting existing client management — parallel flow strategy
- Changing existing document library — preserved for power users
- Modifying core OCR service (only wrapping it)
- Mobile app — web-first approach, PWA works well
- Offline mode — real-time sync is core value

## Target Users

| Persona           | Use Case                    | Key Need                        |
| ----------------- | --------------------------- | ------------------------------- |
| Sarah (B2C)       | Filling visa for herself    | Quick, one-time, no jargon      |
| Ahmed (PRO Agent) | 50+ clients/month, families | Batch processing, client search |
| Lisa (HR Manager) | Employee onboarding         | Bulk processing, tracking       |

## Success Metrics

| Metric                            | Before  | v1.0 Target | v1.0 Actual |
| --------------------------------- | ------- | ----------- | ----------- |
| Steps to first form fill          | 6+      | 3           | 3           |
| Document categorization errors    | Manual  | Auto 90%+   | TBD         |
| Time to first extracted data view | ~30s    | <10s        | TBD         |
| Form completion rate              | Unknown | 85%+        | TBD         |

## Constraints

- Must not regress existing client management flow
- PRO agents need full client list access alongside Smart Profile
- Performance: <3s document detection, <10s full extraction
- Existing OCR confidence scores must be exposed to frontend

## Key Decisions

| Date       | Decision                             | Rationale                                             | Outcome |
| ---------- | ------------------------------------ | ----------------------------------------------------- | ------- |
| 2026-01-13 | Parallel flow, not replacement       | PRO agents need existing power-user features          | Good    |
| 2026-01-13 | Person grouping defaults to separate | Safer to let users merge than auto-combine            | Good    |
| 2026-01-13 | Confidence thresholds start at 85%   | Conservative, tune based on user corrections          | Good    |
| 2026-01-15 | Remove "Verified" label              | Overstated AI certainty, users trusted uncertain data | Good    |
| 2026-01-15 | Four-tier confidence labels          | Maps to user mental model (High/Good/Review/Low)      | Good    |
| 2026-01-15 | Union-Find for entity grouping       | O(n) efficiency for multi-person detection            | Good    |
| 2026-01-15 | 8px drag activation distance         | Prevents accidental drags during normal use           | Good    |
| 2026-01-16 | Auto-skip review when all high conf  | Reduces unnecessary steps for clean extractions       | Good    |
| 2026-01-16 | Default to 'assisted' mode           | Safer for new users, Express for power users          | Good    |

## References

- PRD: `.planning/phases/01-smart-profile-ux/PRD.md`
- Research: `.planning/phases/01-smart-profile-ux/01-RESEARCH.md`
- UX Panel: 5 experts voted "Ship with changes" (see PRD Appendix A)
- Milestone Archive: `.planning/milestones/v1.0-ROADMAP.md`

---

_Last updated: 2026-01-16 after v1.0 milestone_
