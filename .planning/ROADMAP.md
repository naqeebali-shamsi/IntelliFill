# Roadmap: Smart Profile UX

## Milestones

- ✅ [v1.0 MVP](milestones/v1.0-ROADMAP.md) (Phases 1-4) — SHIPPED 2026-01-16
- ✅ [v1.1 Stripe Integration](milestones/v1.1-ROADMAP.md) (Phase 5) — SHIPPED 2026-01-20
- 🚧 **v1.2 UI/UX Cleanup & Marketing Site** (Phases 6-8) — IN PROGRESS

## Overview

Transform IntelliFill's 6-step document-to-form flow into a streamlined 3-step "Upload → See → Fill" experience.

## Domain Expertise

- ~/.claude/skills/frontend-component/SKILL.md (React patterns)
- ~/.claude/skills/zustand-store/SKILL.md (state management)

## Completed Milestones

<details>
<summary>v1.0 MVP (Phases 1-4) — SHIPPED 2026-01-16</summary>

- [x] Phase 1: Foundation (6/6 plans) — completed 2026-01-15
- [x] Phase 2: Intelligence (4/4 plans) — completed 2026-01-15
- [x] Phase 3: Polish (4/4 plans) — completed 2026-01-16
- [x] Phase 4: PRO Features (5/5 plans) — completed 2026-01-16

**Total:** 4 phases, 19 plans, 60 files, +13k LOC

See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full details.

</details>

<details>
<summary>v1.1 Stripe Integration (Phase 5) — SHIPPED 2026-01-20</summary>

- [x] Phase 5: Stripe Integration (4/4 plans) — completed 2026-01-20
  - 05-01: Database schema + Stripe setup ✓
  - 05-02: Backend webhook & checkout ✓
  - 05-03: Frontend pricing & subscription UI ✓
  - 05-04: Integration testing & verification ✓

**Total:** 1 phase, 4 plans, 71 files, +9.5k LOC

**Delivered:** PRO subscription payments via Stripe with instant unlock

See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) for full details.

</details>

## Current Milestone

### 🚧 v1.2 UI/UX Cleanup & Marketing Site (In Progress)

**Milestone Goal:** Transform IntelliFill into an addictively simple experience by removing UI clutter, fixing broken elements, and separating marketing from the app.

Based on comprehensive UI/UX audit: 76 validated issues → 17 v1.2 requirements.

- [ ] **Phase 6: UX Cleanup** - Fix critical/high priority UX issues
- [ ] **Phase 7: Marketing Site** - Separate marketing from app
- [ ] **Phase 8: Polish** - Medium priority refinements

## Phase Details

### Phase 6: UX Cleanup
**Goal**: Remove broken/fake UI, surface hidden actions, simplify navigation
**Depends on**: Nothing (first phase of v1.2)
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-06, UX-07, UX-08, UX-09, UX-10
**Research**: Unlikely (internal cleanup, established patterns)
**Plans**: 2 (06-01: Critical UX Fixes, 06-02: Navigation Consolidation)

Key deliverables:
- Remove/implement fake search bar
- Fix broken View button in FilledFormHistory
- Remove fake status filters
- Surface "Use Template" as visible button
- Remove duplicate Quick Actions panel
- Consolidate nav from 8-10 to 5-6 items
- Rename "Smart Profile" to "My Profile"
- Simplify Documents page stats

### Phase 7: Marketing Site
**Goal**: Create separate marketing site, clean up auth pages
**Depends on**: Phase 6
**Requirements**: UX-05, MKT-01, MKT-02
**Research**: Likely (Astro/static site setup, deployment strategy)
**Research topics**: Astro vs Next.js static, Vercel multi-domain, SEO best practices
**Plans**: TBD

Key deliverables:
- Create intellifill.com marketing landing page
- Remove testimonials/marketing from auth pages
- Configure app.intellifill.com for application
- SEO-optimized hero, features, pricing sections

### Phase 8: Polish
**Goal**: Medium priority UX refinements
**Depends on**: Phase 7
**Requirements**: UX-11, UX-12, UX-13, UX-14, UX-15
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Key deliverables:
- Merge Organization tab into Account settings
- Make stats dashboard collapsible
- Simplify template flow (remove Preview modal)
- Fix mobile navigation
- Reduce upload page animation

## Progress

**Execution Order:** 6 → 7 → 8

| Phase                 | Milestone | Plans Complete | Status      | Completed  |
| --------------------- | --------- | -------------- | ----------- | ---------- |
| 1. Foundation         | v1.0      | 6/6            | Complete    | 2026-01-15 |
| 2. Intelligence       | v1.0      | 4/4            | Complete    | 2026-01-15 |
| 3. Polish             | v1.0      | 4/4            | Complete    | 2026-01-16 |
| 4. PRO Features       | v1.0      | 5/5            | Complete    | 2026-01-16 |
| 5. Stripe Integration | v1.1      | 4/4            | Complete    | 2026-01-20 |
| 6. UX Cleanup         | v1.2      | 0/2            | Planned     | -          |
| 7. Marketing Site     | v1.2      | 0/TBD          | Not started | -          |
| 8. Polish             | v1.2      | 0/TBD          | Not started | -          |

---

**Created:** 2026-01-13
**v1.0 Shipped:** 2026-01-16
**v1.1 Shipped:** 2026-01-20
**PRD Reference:** `.planning/phases/01-smart-profile-ux/PRD.md`
