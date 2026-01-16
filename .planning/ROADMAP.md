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

- [x] **Phase 1: Foundation** - Wizard structure, upload zone, batch extraction, basic profile view ✓
- [x] **Phase 2: Intelligence** - Person grouping, confidence review, field sources, missing fields ✓
- [x] **Phase 3: Polish** - Form suggestion, animations, assisted/express mode, performance ✓
- [x] **Phase 4: PRO Features** - Client list, batch history, analytics, admin dashboard ✓

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
- [x] 01-06: Confidence UX (honest badges, extraction progress) ✓

### Phase 2: Intelligence

**Goal**: Multi-person support and confidence-based review flow
**Depends on**: Phase 1
**Research**: Complete (02-RESEARCH.md)
**Plans**: 4 plans

Key deliverables:

- PersonGrouper component with drag-drop reassignment
- ConfidenceReview step for low-certainty fields
- Field source tracking (which document, manual edit)
- Missing field detection against selected form

Plans:

- [x] 02-01: Entity Resolution Backend (fuzzball, Union-Find grouping, enhanced extract-batch) ✓
- [x] 02-02: PersonGrouper UI (drag-drop with @dnd-kit, inline name editing) ✓
- [x] 02-03: ConfidenceReview Step (low confidence fields, conflict resolution) ✓
- [x] 02-04: Field Source & Missing Fields (FieldSourceBadge, MissingFieldsAlert) ✓

### Phase 3: Polish

**Goal**: UX refinements and smart form selection
**Depends on**: Phase 2
**Research**: Complete (03-RESEARCH.md)
**Plans**: 4 plans

Key deliverables:

- FormSuggester with document-to-form mapping
- Framer Motion animations for wizard transitions
- Assisted vs Express mode toggle
- Performance measurement (<3s detection, <10s extraction)

Plans:

- [x] 03-01: FormSuggester (form mapping utilities, FormSuggester UI, wizard integration) ✓
- [x] 03-02: Wizard Animations (wizard-variants.ts, direction-aware transitions, reduced motion) ✓
- [x] 03-03: Assisted/Express Mode (userPreferencesStore, ModeToggle, step-skipping logic) ✓
- [x] 03-04: UI Polish & Verification (performance logging, visual consistency, user checkpoint) ✓

### Phase 4: PRO Features

**Goal**: Power-user features for returning PRO agents
**Depends on**: Phase 3
**Research**: None needed
**Plans**: 5 plans

Key deliverables:

- Client list and search accessible from Smart Profile
- Form usage analytics backend and dashboard
- SmartProfile-Client integration for save workflow
- Admin dashboard for accuracy metrics

Plans:

- [x] 04-01: Client Library (clientsService, clientsStore, ClientLibrary page) ✓
- [x] 04-02: Form Analytics Backend (form-analytics.routes, formAnalyticsService) ✓
- [x] 04-03: Form Analytics Dashboard (formAnalyticsStore, FormAnalytics page) ✓
- [x] 04-04: SmartProfile-Client Integration (ClientSelector, save to client flow) ✓
- [x] 04-05: Admin Accuracy Dashboard (admin-accuracy.routes, AdminAccuracyDashboard) ✓

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase           | Plans Complete | Status   | Completed  |
| --------------- | -------------- | -------- | ---------- |
| 1. Foundation   | 6/6            | Complete | 2026-01-15 |
| 2. Intelligence | 4/4            | Complete | 2026-01-15 |
| 3. Polish       | 4/4            | Complete | 2026-01-16 |
| 4. PRO Features | 5/5            | Complete | 2026-01-16 |

---

**Created:** 2026-01-13
**PRD Reference:** `.planning/phases/01-smart-profile-ux/PRD.md`
