# Roadmap: Smart Profile UX

## Overview

Transform IntelliFill's 6-step document-to-form flow into a streamlined 3-step "Upload → See → Fill" experience. Four phases deliver incremental value: foundation wizard, intelligent grouping/review, polish/UX refinements, and PRO agent features.

## Domain Expertise

- ~/.claude/skills/frontend-component/SKILL.md (React patterns)
- ~/.claude/skills/zustand-store/SKILL.md (state management)

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases: Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Foundation** - Wizard structure, upload zone, batch extraction, basic profile view
- [ ] **Phase 2: Intelligence** - Person grouping, confidence review, field sources, missing fields
- [ ] **Phase 3: Polish** - Form suggestion, animations, assisted/express mode, performance
- [ ] **Phase 4: PRO Features** - Client list, batch history, analytics, admin dashboard

## Phase Details

### Phase 1: Foundation

**Goal**: Working wizard that uploads documents, extracts data, and displays profile
**Depends on**: Nothing (first phase)
**Research**: Unlikely (patterns established in 01-RESEARCH.md)
**Plans**: 6 plans

Key deliverables:

- `/smart-profile` route and SmartProfileWizard component
- SmartUploadZone with react-dropzone and auto-detection
- Backend `/api/smart-profile/detect-types` and `/api/smart-profile/extract-batch`
- Basic ProfileView showing extracted data
- Pipeline hardening (error handling, timeouts, rate limiting, validation)
- Honest confidence UI and extraction progress

Plans:

- [x] 01-01: Infrastructure & Routing (store, page shell, route) ✓
- [x] 01-02: Smart Upload Zone (react-dropzone, detect-types API) ✓
- [x] 01-03: Batch Extraction (extract-batch API, service integration) ✓
- [x] 01-04: Profile View (display, inline editing, save to client) ✓
- [x] 01-05: Pipeline Hardening (error handling, timeouts, rate limiting, JSON validation) ✓
- [ ] 01-06: Confidence UX (honest badges, extraction progress)

### Phase 2: Intelligence

**Goal**: Multi-person support and confidence-based review flow
**Depends on**: Phase 1
**Research**: Likely (entity resolution algorithm)
**Research topics**: Person grouping by ID matching, name similarity algorithms, drag-drop grouping UI patterns
**Plans**: TBD (estimate 3 plans)

Key deliverables:

- PersonGrouper component with drag-drop reassignment
- ConfidenceReview step for low-certainty fields
- Field source tracking (which document, manual edit)
- Missing field detection against selected form

### Phase 3: Polish

**Goal**: UX refinements and smart form selection
**Depends on**: Phase 2
**Research**: Unlikely (internal patterns, Framer Motion known)
**Plans**: TBD (estimate 2-3 plans)

Key deliverables:

- FormSuggester with document-to-form mapping
- Framer Motion animations for wizard transitions
- Assisted vs Express mode toggle
- Performance optimization (<3s detection, <10s extraction)

### Phase 4: PRO Features

**Goal**: Power-user features for returning PRO agents
**Depends on**: Phase 3
**Research**: Unlikely (extending existing client management)
**Plans**: TBD (estimate 2-3 plans)

Key deliverables:

- Client list and search accessible from Smart Profile
- Batch history with resume capability
- Form usage analytics
- Admin dashboard for accuracy metrics

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase           | Plans Complete | Status      | Completed |
| --------------- | -------------- | ----------- | --------- |
| 1. Foundation   | 5/6            | In Progress | -         |
| 2. Intelligence | 0/TBD          | Not started | -         |
| 3. Polish       | 0/TBD          | Not started | -         |
| 4. PRO Features | 0/TBD          | Not started | -         |

---

**Created:** 2026-01-13
**PRD Reference:** `.planning/phases/01-smart-profile-ux/PRD.md`
