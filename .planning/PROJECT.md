# Project Brief: Smart Profile UX

## Current State (v1.2 Shipped)

**Shipped:** 2026-01-25
**LOC:** ~33k TypeScript/React (190+ files)
**Tech stack:** React 18, Vite, Zustand 5, Framer Motion, @dnd-kit, Radix UI, Stripe SDK v17, Astro 5.2 (marketing)

The Smart Profile wizard is live at `/smart-profile` with:

- 3-step wizard: Upload → See → Fill
- Smart document detection with Gemini AI
- Multi-person entity resolution with drag-drop grouping
- Confidence-based review flow
- Smart form suggestions
- PRO features with Stripe subscriptions: client library, form analytics, admin dashboard

**New in v1.2:**
- Separate marketing site at intellifill.com (Astro)
- App at app.intellifill.com
- Cleaned auth pages (no marketing content)
- Consolidated navigation (6 items)
- Settings with sub-tabs (Profile/Organization/Security)
- Template favorites with direct-to-editor flow
- Collapsible dashboard stats
- Mobile bottom navigation
- Removed fake/broken UI elements

## What This Is

A simplified "Upload → See → Fill" experience for IntelliFill that hides backend complexity while preserving power-user capabilities. This is a **new entry point** (`/smart-profile`), not a rewrite of the existing frontend.

## Core Value

**Users want to drop documents and fill forms** — not manage sync/async extraction, mergeToProfile parameters, or document categories.

## Requirements

### Validated

**v1.0:**
- New `/smart-profile` route with wizard flow
- Smart Upload Zone with auto-detection (F1)
- Person Grouping UI for multi-person uploads (F2)
- Quick Confidence Review for low-certainty fields (F3)
- Smart Profile View with missing field alerts (F4)
- Smart Form Suggestion (F5)
- Assisted vs Express mode toggle (F6)
- 4 new backend endpoints under `/api/smart-profile/`
- PRO client library and search (scaffolded)
- Form usage analytics (scaffolded)
- Admin accuracy dashboard (scaffolded)

**v1.1:**
- Stripe SDK integration with subscription management
- Checkout session creation for PRO tier ($19/month)
- Customer Portal for billing self-service
- Webhook handling for subscription lifecycle events
- Instant PRO unlock on successful payment
- Public pricing page at `/pricing`
- Subscription settings in user account

**v1.2:**
- Marketing site at intellifill.com (Astro 5.2)
- Auth pages cleaned (no marketing content)
- Navigation consolidated to 6 items
- Settings restructured with Account sub-tabs
- Template favorites with localStorage
- Collapsible dashboard stats
- Mobile bottom navigation bar
- Upload animation polish

### Active

- Real-user validation and feedback collection
- Performance tuning based on production metrics
- Mobile-responsive polish
- Accessibility audit (WCAG 2.1 AA)
- Production Stripe webhook configuration

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

| Metric                            | Before  | v1.0 Target | v1.1 Actual |
| --------------------------------- | ------- | ----------- | ----------- |
| Steps to first form fill          | 6+      | 3           | 3 ✓         |
| Document categorization errors    | Manual  | Auto 90%+   | TBD         |
| Time to first extracted data view | ~30s    | <10s        | TBD         |
| Form completion rate              | Unknown | 85%+        | TBD         |
| PRO conversion (new in v1.1)      | N/A     | Track       | TBD         |

## Constraints

- Must not regress existing client management flow
- PRO agents need full client list access alongside Smart Profile
- Performance: <3s document detection, <10s full extraction
- Existing OCR confidence scores must be exposed to frontend
- Stripe webhook must handle all subscription lifecycle events

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
| 2026-01-17 | String for subscriptionStatus        | Accommodates all Stripe status values (not enum)      | Good    |
| 2026-01-17 | `prisma db push` for schema changes  | Existing migration drift, safer than migrate          | Good    |
| 2026-01-17 | Pricing page as public route         | Users can view before logging in                      | Good    |
| 2026-01-17 | Raw body middleware before JSON      | Required for webhook signature verification           | Good    |
| 2026-01-17 | userId in subscription metadata      | Enables instant unlock without customer lookup        | Good    |
| 2026-01-21 | Remove vs implement fake elements    | Less scope, surfaces future work as conscious choice  | Good    |
| 2026-01-21 | VITE_MULTI_TENANT feature flag       | B2C default (hidden), B2B can enable                  | Good    |
| 2026-01-22 | Astro 5.2 for marketing              | Excellent SEO, fast loading, minimal JS               | Good    |
| 2026-01-22 | Two Vercel projects same repo        | Clean domain separation                               | Good    |
| 2026-01-25 | localStorage for favorites           | Simpler for v1, can migrate to backend later          | Good    |
| 2026-01-25 | Remove preview modal                 | Direct navigation reduces friction                    | Good    |
| 2026-01-25 | Bottom nav with 5 items              | Home, Profile, Docs, Templates, More                  | Good    |

## References

- PRD: `.planning/phases/01-smart-profile-ux/PRD.md`
- Research: `.planning/phases/01-smart-profile-ux/01-RESEARCH.md`
- UX Panel: 5 experts voted "Ship with changes" (see PRD Appendix A)
- Milestone Archives:
  - [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
  - [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
  - [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

---

_Last updated: 2026-01-25 after v1.2 milestone_
