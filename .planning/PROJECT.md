# Project Brief: Smart Profile UX

## What This Is

A simplified "Upload → See → Fill" experience for IntelliFill that hides backend complexity while preserving power-user capabilities. This is a **new entry point** (`/smart-profile`), not a rewrite of the existing frontend.

## Core Value

**Users want to drop documents and fill forms** — not manage sync/async extraction, mergeToProfile parameters, or document categories.

## Problem Being Solved

Current flow requires 6+ steps and exposes technical concepts:

1. Create Client → Upload Document → Select Category → Trigger Extraction → Review Data → Merge to Profile → Select Form → Fill

Impact:

- High abandonment rate for first-time users
- PRO agents creating duplicate profiles
- Support tickets about "wrong data" from silent merge conflicts

## Target Users

| Persona           | Use Case                    | Key Need                        |
| ----------------- | --------------------------- | ------------------------------- |
| Sarah (B2C)       | Filling visa for herself    | Quick, one-time, no jargon      |
| Ahmed (PRO Agent) | 50+ clients/month, families | Batch processing, client search |
| Lisa (HR Manager) | Employee onboarding         | Bulk processing, tracking       |

## Success Metrics

| Metric                            | Current | Target    |
| --------------------------------- | ------- | --------- |
| Steps to first form fill          | 6+      | 3         |
| Document categorization errors    | Manual  | Auto 90%+ |
| Time to first extracted data view | ~30s    | <10s      |
| Form completion rate              | Unknown | 85%+      |

## Scope

### In Scope

- New `/smart-profile` route with wizard flow
- Smart Upload Zone with auto-detection (F1)
- Person Grouping UI for multi-person uploads (F2)
- Quick Confidence Review for low-certainty fields (F3)
- Smart Profile View with missing field alerts (F4)
- Smart Form Suggestion (F5)
- Assisted vs Express mode toggle (F6)
- 4 new backend endpoints under `/api/smart-profile/`

### Out of Scope

- Rewriting existing client management
- Changing existing document library
- Modifying core OCR service (only wrapping it)
- Mobile app

## Technical Approach

**Frontend:**

- ~6 new components in `components/smart-profile/`
- 1 new Zustand store with persist middleware
- 1 new page/route
- Uses: react-dropzone, Framer Motion (already in stack)

**Backend:**

- 1 new routes file: `smart-profile.routes.ts`
- 4 endpoints wrapping existing OCR/extraction services
- No database schema changes

## Constraints

- Must not regress existing client management flow
- PRO agents need full client list access alongside Smart Profile
- Performance: <3s document detection, <10s full extraction
- Existing OCR confidence scores must be exposed to frontend

## Key Decisions

| Date       | Decision                             | Rationale                                    |
| ---------- | ------------------------------------ | -------------------------------------------- |
| 2026-01-13 | Parallel flow, not replacement       | PRO agents need existing power-user features |
| 2026-01-13 | Person grouping defaults to separate | Safer to let users merge than auto-combine   |
| 2026-01-13 | Confidence thresholds start at 85%   | Conservative, tune based on user corrections |

## References

- PRD: `.planning/phases/01-smart-profile-ux/PRD.md`
- Research: `.planning/phases/01-smart-profile-ux/01-RESEARCH.md`
- UX Panel: 5 experts voted "Ship with changes" (see PRD Appendix A)

---

**Created:** 2026-01-13
**Status:** Planning
