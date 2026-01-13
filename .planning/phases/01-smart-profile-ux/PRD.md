# Product Requirements Document: Smart Profile UX

**Version:** 1.0
**Date:** 2026-01-13
**Author:** Claude (AI) + User Collaboration
**Status:** Draft - Pending Review

---

## Executive Summary

IntelliFill's current document upload → OCR extraction → client profile → form filling flow is technically sound but overwhelming for non-technical users. This PRD defines a simplified "Upload → See → Fill" experience that hides backend complexity while preserving power-user capabilities.

**Core Insight:** Users don't care about `sync` vs `async` extraction, `mergeToProfile` parameters, or document categories. They want to drop documents and fill forms.

---

## Problem Statement

### Current State

1. **6+ steps** to fill a form: Create Client → Upload Document → Select Category → Trigger Extraction → Review Data → Merge to Profile → Select Form → Fill
2. **Technical concepts exposed:** sync/async, mergeToProfile, document categories, extraction status
3. **No auto-detection:** Users must manually categorize documents
4. **No multi-person support:** PRO agents processing families create confusion
5. **Missing field discovery too late:** Users find out at download time

### Impact

- High abandonment rate for first-time users
- PRO agents creating duplicate profiles
- Support tickets about "wrong data" from silent merge conflicts
- Users not trusting auto-filled data

---

## Goals & Success Metrics

### Goals

1. Reduce time-to-first-form-fill by 70%
2. Eliminate technical concept exposure for end users
3. Support batch upload of family/company documents
4. Surface ML confidence in user-friendly way
5. Maintain PRO agent power-user workflows

### Success Metrics

| Metric                            | Current | Target    | Measurement           |
| --------------------------------- | ------- | --------- | --------------------- |
| Steps to first form fill          | 6+      | 3         | User session tracking |
| Document categorization errors    | Manual  | Auto 90%+ | ML accuracy metrics   |
| Form completion rate              | Unknown | 85%+      | Funnel analytics      |
| Time to first extracted data view | ~30s    | <10s      | Performance metrics   |
| User trust score (survey)         | Unknown | 4.2/5     | Post-session survey   |

---

## User Personas

### Persona 1: Sarah - B2C Individual User

- **Context:** Filling visa application for herself
- **Documents:** Passport, Emirates ID, bank statement
- **Goal:** Fill form quickly, one time
- **Pain points:** Technical jargon, too many steps, doesn't know what "extraction" means

### Persona 2: Ahmed - PRO Agent (Visa Consultant)

- **Context:** Processing visa applications for 50+ clients/month
- **Documents:** Family sets (4-6 documents per family)
- **Goal:** Efficient batch processing, client management, repeat workflows
- **Pain points:** No client search, duplicate profiles, can't process families together

### Persona 3: Lisa - B2B HR Manager

- **Context:** Onboarding employees, filling compliance forms
- **Documents:** Employee ID documents, certifications
- **Goal:** Process multiple employees, track document expiry
- **Pain points:** No bulk processing, manual data entry

---

## Proposed Solution: Smart Profile Flow

### Core Principle: "Upload → See → Fill"

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Upload Documents                                   │
│  - Drag & drop any documents                                │
│  - Auto-detect document type (no category selection)        │
│  - Show upload progress with detected type                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 1.5: Person Grouping (if multiple detected)           │
│  - "We found 3 people. Confirm groups?"                     │
│  - Visual grouping with drag-to-reorder                     │
│  - Auto-skip for single person uploads                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Quick Confidence Review (if needed)                │
│  - Show only low-confidence fields (0-3 typically)          │
│  - "Quick check: Is this name correct?"                     │
│  - Auto-skip if all fields high-confidence                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Smart Profile View                                 │
│  - Unified profile with all extracted data                  │
│  - Field source indicators (which doc, manual edit)         │
│  - Missing fields banner: "3 fields needed for Visa Form"   │
│  - Inline editing with auto-mark as manual                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Smart Form Suggestion                              │
│  - "Based on your docs: UAE Visa Application"               │
│  - One-click confirm or browse alternatives                 │
│  - Show form completion percentage                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: Preview & Download                                 │
│  - PDF preview with filled fields highlighted               │
│  - All fields complete (guaranteed by Step 3)               │
│  - Download immediately                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Feature Requirements

### F1: Smart Upload Zone

**Priority:** P0 (Must Have)

**Description:**
Drag-and-drop file upload with automatic document type detection. No manual category selection required.

**Acceptance Criteria:**

- [ ] Accept PDF, JPG, PNG files up to 10MB
- [ ] Show upload progress per file
- [ ] Auto-detect document type within 3 seconds
- [ ] Display detected type with confidence badge
- [ ] Allow manual type override if detection wrong
- [ ] Support multiple file upload in single drop
- [ ] Show clear error messages for rejected files

**UX Details:**

- Drop zone with encouraging copy: "Drop documents here - we'll figure out what they are"
- Animated file cards appearing as files are added
- Detected type shown as badge: "Passport (detected)" with edit icon
- Progress indicator during detection

**Technical Notes:**

- Use existing OCR service for detection
- Add new endpoint: `POST /api/documents/detect-type`
- Fallback to "Other" if confidence < 60%

---

### F2: Person Grouping UI

**Priority:** P0 (Must Have)

**Description:**
When multiple people's documents are detected, show a grouping interface to prevent data contamination.

**Acceptance Criteria:**

- [ ] Detect multiple people by matching ID numbers, names, or distinct patterns
- [ ] Show visual grouping with suggested person names
- [ ] Allow drag-and-drop to reassign documents between groups
- [ ] Provide "These are all one person" shortcut
- [ ] Auto-skip when only one person detected
- [ ] Create separate profiles per person group

**UX Details:**

- Card-based layout showing document groups
- Each group shows suggested name from documents
- Clear visual separation between groups
- "Confirm Grouping" primary action

**Technical Notes:**

- Add entity resolution algorithm to OCR service
- Match by: Emirates ID number, passport number, name similarity
- Store person groups in wizard state

---

### F3: Quick Confidence Review

**Priority:** P0 (Must Have)

**Description:**
Show only fields where OCR confidence is below threshold, allowing quick verification.

**Acceptance Criteria:**

- [ ] Filter fields where confidence < 85%
- [ ] Show original extracted value with edit option
- [ ] Allow quick confirmation: "Correct" / "Edit"
- [ ] Auto-skip step if all fields high-confidence
- [ ] Show notification when auto-skipped: "All fields verified automatically"
- [ ] Track corrections for ML improvement

**UX Details:**

- One field per card for focus
- Large, readable text
- Checkmark and edit buttons prominent
- Progress indicator: "2 of 3 fields to review"

**Technical Notes:**

- Leverage existing confidence scores from OCR service
- Store corrections for future training data
- Persist review state in wizard store

---

### F4: Smart Profile View

**Priority:** P0 (Must Have)

**Description:**
Unified view of extracted profile data with source tracking and missing field alerts.

**Acceptance Criteria:**

- [ ] Display all extracted fields in organized sections
- [ ] Show source indicator per field (document name or "Manual")
- [ ] Highlight fields marked as manually edited
- [ ] Show missing fields banner for selected form
- [ ] Allow inline editing with auto-save
- [ ] Mark edited fields as `manuallyEdited: true`
- [ ] Prevent OCR overwrites of manually edited fields

**UX Details:**

- Grouped by category: Personal, Documents, Contact, etc.
- Small source pill next to each field value
- Yellow banner for missing fields: "3 fields needed for UAE Visa"
- Inline edit with checkmark/cancel

**Technical Notes:**

- Use existing ClientProfile model with fieldSources
- Add form-specific field requirements endpoint
- Real-time validation against selected form

---

### F5: Smart Form Suggestion

**Priority:** P1 (Should Have)

**Description:**
Recommend most likely form based on uploaded document types.

**Acceptance Criteria:**

- [ ] Analyze document types to suggest appropriate form
- [ ] Show primary suggestion prominently
- [ ] Allow browsing full form catalog
- [ ] Display form completion percentage
- [ ] Remember user's form history for better suggestions

**UX Details:**

- Hero card: "Based on your documents: UAE Visa Application"
- Completion percentage: "85% of fields ready"
- Secondary: "Show other forms" link
- Recent forms section

**Technical Notes:**

- Create document-to-form mapping rules
- Add endpoint: `GET /api/forms/suggest?documentTypes=[]`
- Track form usage per user for personalization

---

### F6: Assisted vs Express Mode

**Priority:** P2 (Nice to Have)

**Description:**
Toggle between guided mode (shows all confirmations) and express mode (auto-skips more aggressively).

**Acceptance Criteria:**

- [ ] Default to "Assisted" mode for new users
- [ ] Allow toggle in settings
- [ ] Express mode: auto-skip grouping for single person, skip confidence review if >80%
- [ ] Assisted mode: show all steps with brief confirmation
- [ ] Track accuracy to unlock Express mode recommendation

**UX Details:**

- Toggle in settings: "Trust level"
- Tooltip explaining modes
- Badge showing current mode in wizard

**Technical Notes:**

- Store preference in user settings
- Track correction rate to measure accuracy
- Recommend Express when correction rate < 5%

---

## Non-Functional Requirements

### Performance

- Document type detection: < 3 seconds
- Full OCR extraction: < 10 seconds for single document
- Profile view load: < 500ms
- Form preview generation: < 2 seconds

### Accessibility

- All interactive elements keyboard accessible
- Screen reader announcements for step changes
- Color not sole indicator (use icons + labels)
- Minimum 4.5:1 contrast ratio

### Mobile Responsiveness

- Full functionality on tablet
- Upload and review on mobile
- Form preview may require desktop

### Data Privacy

- No document images stored after extraction (configurable)
- Extracted data encrypted at rest
- Session timeout after 30 minutes inactive

---

## Technical Architecture

### Frontend Changes

```
quikadmin-web/
├── src/
│   ├── components/
│   │   └── smart-profile/
│   │       ├── SmartProfileWizard.tsx    # Main orchestrator
│   │       ├── UploadZone.tsx            # F1: File upload
│   │       ├── PersonGrouper.tsx         # F2: Entity grouping
│   │       ├── ConfidenceReview.tsx      # F3: Field verification
│   │       ├── ProfileView.tsx           # F4: Unified profile
│   │       ├── FormSuggester.tsx         # F5: Form selection
│   │       └── components/
│   │           ├── FileCard.tsx
│   │           ├── ConfidenceBadge.tsx
│   │           └── FieldSourcePill.tsx
│   ├── stores/
│   │   └── smartProfileStore.ts          # Wizard state
│   └── pages/
│       └── SmartProfile.tsx              # Route: /smart-profile
```

### Backend Changes

```
quikadmin/
├── src/
│   └── api/
│       └── smart-profile.routes.ts       # New unified endpoint
│           ├── POST /detect-types        # Document type detection
│           ├── POST /extract-batch       # Batch extraction
│           ├── GET /suggest-form         # Form suggestion
│           └── POST /merge-profile       # Profile merge with conflict detection
```

### New API Endpoints

| Endpoint                           | Method | Purpose                                            |
| ---------------------------------- | ------ | -------------------------------------------------- |
| `/api/smart-profile/detect-types`  | POST   | Detect document types from files                   |
| `/api/smart-profile/extract-batch` | POST   | Extract multiple documents, return grouped results |
| `/api/smart-profile/suggest-form`  | GET    | Suggest form based on document types               |
| `/api/smart-profile/merge-profile` | POST   | Merge extracted data with conflict detection       |

---

## Rollout Plan

### Phase 1: Foundation (Week 1-2)

- [ ] Create smart-profile route and basic wizard structure
- [ ] Implement SmartUploadZone with auto-detection
- [ ] Add batch extraction endpoint
- [ ] Basic ProfileView with extracted data

### Phase 2: Intelligence (Week 3-4)

- [ ] Person grouping detection and UI
- [ ] Confidence review step
- [ ] Field source tracking in ProfileView
- [ ] Missing field detection

### Phase 3: Polish (Week 5-6)

- [ ] Smart form suggestion
- [ ] Animations and transitions
- [ ] Assisted/Express mode toggle
- [ ] Performance optimization

### Phase 4: PRO Features (Week 7-8)

- [ ] Client list and search for returning users
- [ ] Batch history and resume
- [ ] Form usage analytics
- [ ] Admin dashboard for accuracy metrics

---

## Risks & Mitigations

| Risk                                       | Impact | Likelihood | Mitigation                                                              |
| ------------------------------------------ | ------ | ---------- | ----------------------------------------------------------------------- |
| OCR detection accuracy below 90%           | High   | Medium     | Start with conservative thresholds, tune based on data                  |
| Person grouping creates wrong associations | High   | Low        | Default to separate profiles, let users merge                           |
| PRO agents confused by new flow            | Medium | Medium     | Keep existing client management, add Smart Profile as alternative entry |
| Performance degradation with batch upload  | Medium | Low        | Queue large batches, show progress                                      |

---

## Success Criteria for Launch

### MVP (Phase 1-2)

- [ ] User can upload documents and see extracted data in < 15 seconds
- [ ] Document type auto-detected with > 85% accuracy
- [ ] Single-person flow works end-to-end
- [ ] No regression in existing client management

### Full Launch (Phase 3-4)

- [ ] Multi-person grouping works for family uploads
- [ ] Form completion rate > 80%
- [ ] PRO agents can manage client list alongside Smart Profile
- [ ] User satisfaction score > 4.0/5

---

## Appendix

### A. UX Panel Recommendations (Incorporated)

From adversarial UX expert panel review:

1. **Sarah Chen (Enterprise):** Person grouping UI - INCORPORATED in F2
2. **Marcus Webb (Consumer):** Smart form suggestion - INCORPORATED in F5
3. **Dr. Priya Sharma (Accessibility):** Quick confidence review - INCORPORATED in F3
4. **Tom Kowalski (Conversion):** Missing fields in Step 3, not Step 5 - INCORPORATED in F4
5. **Aisha Patel (Startup):** Assisted vs Express mode - INCORPORATED in F6

### B. Research References

See `.planning/phases/01-smart-profile-ux/01-RESEARCH.md` for:

- Standard library stack
- Architecture patterns
- Common pitfalls
- Code examples

### C. Glossary

| Term             | Definition                                                       |
| ---------------- | ---------------------------------------------------------------- |
| Smart Profile    | The new simplified document-to-form flow                         |
| Person Grouping  | Detecting and separating documents belonging to different people |
| Confidence Score | OCR accuracy estimate (0-100%)                                   |
| Field Source     | Which document a profile field was extracted from                |
| Express Mode     | Reduced confirmation flow for trusted/power users                |

---

**Document History:**

| Version | Date       | Author        | Changes       |
| ------- | ---------- | ------------- | ------------- |
| 1.0     | 2026-01-13 | Claude + User | Initial draft |

---

_Ready for stakeholder review_
