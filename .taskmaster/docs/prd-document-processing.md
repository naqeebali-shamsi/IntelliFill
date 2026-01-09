# Product Requirements Document: Document Processing UI Fixes

**Document Version:** 1.0
**Priority:** MEDIUM
**Created:** 2026-01-09
**Author:** AI Product Specialist
**Status:** Draft

---

## Executive Summary

### Problem Statement

IntelliFill's E2E test suite reports 36 document-related test failures across three critical areas: batch upload functionality, template autofill capabilities, and single document upload/OCR processing. These failures indicate gaps between user expectations (as defined by tests) and the current UI implementation, blocking release confidence and feature completeness.

### Solution Overview

Implement missing UI components and enhance existing functionality to support:
1. **Batch Upload (8 tests):** Multi-document progress tracking, bulk actions, and aggregate status
2. **Template Autofill (10 tests):** OCR-to-template field mapping UI with confidence indicators
3. **Upload/OCR (18 tests):** Real-time processing status, document preview, search/filter, and export capabilities

### Business Impact

- **User Experience:** Enable efficient document batch processing for enterprise users handling multiple forms
- **Competitive Advantage:** Template autofill with confidence scoring differentiates IntelliFill from basic OCR tools
- **Release Quality:** Passing E2E tests ensures production readiness and reduces post-release defects
- **Time Savings:** Estimated 70% reduction in manual form-filling time for users

### Resource Requirements

- **Frontend Development:** 2-3 sprints (3-4 weeks)
- **Backend Integration:** 1 sprint (minimal - mostly frontend work)
- **QA/Testing:** Integrated throughout development
- **Design Review:** 1 week for UX validation

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Performance degradation with batch uploads | Medium | High | Implement virtual scrolling, throttle progress updates |
| Field mapping accuracy issues | Medium | Medium | Display confidence scores, allow manual override |
| Complex state management | Low | Medium | Leverage existing Zustand patterns, incremental development |

---

## Product Overview

### Product Vision

IntelliFill aims to be the premier intelligent form-filling solution that transforms uploaded documents into auto-completed government forms through AI-powered OCR extraction and smart field mapping.

### Target Users

| Persona | Description | Key Needs |
|---------|-------------|-----------|
| Immigration Agent | Processes 20-50 visa applications daily | Batch upload, fast processing, accuracy indicators |
| HR Administrator | Handles employee onboarding documents | Template selection, bulk operations, export filled forms |
| Individual Applicant | Uploads personal documents for form completion | Simple upload, clear status, confidence in accuracy |

### Value Proposition

- **For Agents:** "Process document batches 5x faster with real-time progress tracking and automatic template population"
- **For Individuals:** "Upload once, fill many forms - see exactly which fields are auto-detected with confidence scores"

### Success Criteria

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| E2E Test Pass Rate (Document) | 0/36 (0%) | 36/36 (100%) | Playwright test results |
| Batch Upload Completion Rate | N/A | >95% | Analytics tracking |
| Template Autofill Accuracy | N/A | >85% user acceptance | User feedback surveys |
| Document Processing Time (UI) | ~5s perceived | <3s perceived | Performance monitoring |

### Assumptions

1. Backend OCR processing and job queue infrastructure is functional
2. FormFiller and FieldMapper backend services work as designed
3. Users have modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
4. Documents uploaded are valid and uncorrupted (graceful error handling for exceptions)

---

## Functional Requirements

### FR-1: Batch Upload Enhancement

**Priority:** High
**Dependencies:** uploadStore.ts, ConnectedUpload.tsx

#### FR-1.1: Multi-Document Progress Tracking

**Description:** Display individual progress for each file in a batch upload, with clear visual distinction between upload phase and OCR processing phase.

**User Stories:**

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| FR-1.1-US1 | As a user, I want to upload 3+ documents simultaneously so that I can process batches efficiently | Given: User selects 5 PDF files<br>When: Files are added to queue<br>Then: All 5 files appear in queue with individual progress indicators |
| FR-1.1-US2 | As a user, I want to see progress per upload so that I know which files are completing | Given: Batch upload in progress<br>When: File 2/5 completes<br>Then: File 2 shows 100% with checkmark, others show current progress |

**Technical Requirements:**
- Extend existing `UploadFile` interface with `processingProgress` separate from `uploadProgress`
- Add visual indicator distinguishing "Uploading" vs "Processing" states
- Support up to 10 concurrent file uploads (configurable via `maxConcurrent`)

**UI Components Needed:**
```
BatchUploadProgress
  - ProgressBar (individual file upload %)
  - ProcessingIndicator (OCR spinner when status='processing')
  - AggregateProgress (total files: X/Y completed)
```

#### FR-1.2: Batch Operations

**Description:** Provide bulk actions for managing multiple uploads simultaneously.

**User Stories:**

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| FR-1.2-US1 | As a user, I want to cancel all active uploads so that I can abort a batch operation | Given: 3 files uploading<br>When: Click "Cancel All"<br>Then: All uploads abort, status shows 'cancelled' |
| FR-1.2-US2 | As a user, I want a "Retry Failed" button so that I can re-attempt failed uploads | Given: 2/5 files failed<br>When: Click "Retry Failed"<br>Then: Only the 2 failed files restart |
| FR-1.2-US3 | As a user, I want to select all files in queue so that I can perform bulk actions | Given: 5 files in queue<br>When: Click "Select All"<br>Then: All 5 files are selected, bulk action toolbar appears |

**Technical Requirements:**
- Leverage existing `cancelAllActiveUploads()` from uploadStore
- Add `retryFailed()` action to uploadStore
- Implement selection state for upload queue items

**UI Components Needed:**
```
BatchActionsToolbar (for upload page)
  - "Cancel All" button (conditional: visible when hasActiveUploads)
  - "Retry Failed" button (conditional: visible when failedCount > 0)
  - "Select All" checkbox
  - "Clear Completed" button
  - Selected count badge
```

#### FR-1.3: Mixed File Type Handling

**Description:** Handle batches containing different file types (PDF, images, DOCX) with appropriate icons and processing.

**User Stories:**

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| FR-1.3-US1 | As a user, I want different file types to display appropriate icons so that I can identify file types at a glance | Given: Upload includes PDF, JPG, DOCX<br>When: Files appear in queue<br>Then: Each file shows correct type icon |

**Technical Requirements:**
- File type detection already exists in `validateFiles()`
- Use existing `fileTypeIconMap` from document-card.tsx pattern

#### FR-1.4: Corrupt File Handling

**Description:** Gracefully handle corrupt or invalid files within a batch without failing the entire upload.

**User Stories:**

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| FR-1.4-US1 | As a user, I want corrupt files to show errors while other files continue so that one bad file doesn't block my batch | Given: 5 files including 1 corrupt PDF<br>When: Batch processes<br>Then: 4 files complete successfully, corrupt file shows error message |

**Technical Requirements:**
- Backend returns 400 for corrupt files - handle gracefully in UI
- Show specific error message per file
- Implement file-level error isolation (already supported by individual file status)

---

### FR-2: Template Autofill System

**Priority:** High
**Dependencies:** FieldMapper.ts (backend), FormFiller.ts (backend)

#### FR-2.1: OCR-to-Template Field Mapping UI

**Description:** Display extracted OCR data and allow mapping to template form fields with visual connections.

**User Stories:**

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| FR-2.1-US1 | As a user, I want OCR data to auto-fill template fields so that I don't manually copy data | Given: Document processed with OCR data<br>When: I select a template<br>Then: Template fields auto-populate from OCR extraction |
| FR-2.1-US2 | As a user, I want to see which OCR field maps to which template field so that I can verify accuracy | Given: Auto-filled template<br>When: I view the mapping<br>Then: Visual lines/highlights connect source OCR data to destination fields |

**Technical Requirements:**
- Create new `FieldMappingPanel` component showing source -> destination relationships
- Integrate with backend `FieldMapper.mapFields()` API
- Store mapping result in document/template state

**UI Components Needed:**
```
FieldMappingUI
  - SourceDataPanel (left side: OCR extracted fields)
  - MappingLines (visual connections between panels)
  - DestinationFieldsPanel (right side: template form fields)
  - AutoFillButton ("Apply Mapping")
```

#### FR-2.2: Field-Level Confidence Indicators

**Description:** Display confidence scores for each auto-filled field to indicate OCR accuracy.

**User Stories:**

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| FR-2.2-US1 | As a user, I want to see confidence scores per field so that I know which fields to verify | Given: Auto-filled template<br>When: I view form fields<br>Then: Each field shows confidence badge (high/medium/low) |
| FR-2.2-US2 | As a user, I want low-confidence fields highlighted so that I prioritize verification | Given: Field with 60% confidence<br>When: Template displays<br>Then: Field shows amber/warning styling |

**Technical Requirements:**
- Backend `MappingResult.mappings[].confidence` provides per-field scores
- Existing `ConfidenceBadge` component can be reused
- Threshold values: High (>=85%), Medium (65-84%), Low (<65%)

**UI Components Needed:**
```
FieldWithConfidence (wrapper for form inputs)
  - FormInput (text/select/date field)
  - ConfidenceBadge (position: top-right corner)
  - WarningHighlight (conditional border styling)
```

#### FR-2.3: Manual Mapping Adjustment

**Description:** Allow users to manually adjust field mappings when automatic mapping is incorrect.

**User Stories:**

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| FR-2.3-US1 | As a user, I want to change a field's source data so that I can correct wrong mappings | Given: "Passport No" field mapped to wrong OCR value<br>When: I click field and select correct source<br>Then: Field updates with new value |
| FR-2.3-US2 | As a user, I want to clear an auto-filled field so that I can enter data manually | Given: Auto-filled field with wrong value<br>When: I click "Clear" button<br>Then: Field becomes empty for manual entry |

**Technical Requirements:**
- Dropdown/modal showing available OCR data sources per field
- Store user overrides separately from auto-mappings
- Mark manually-adjusted fields visually

**UI Components Needed:**
```
MappingAdjustmentDropdown
  - SourceSelector (list of available OCR fields)
  - ClearButton
  - ManualEntryToggle
  - "Use Original" reset button
```

#### FR-2.4: Template Selection During Upload

**Description:** Allow users to pre-select target templates during the upload process.

**User Stories:**

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| FR-2.4-US1 | As a user, I want to choose a template before uploading so that processing targets specific forms | Given: On upload page<br>When: I select "UAE Visa Application" template<br>Then: Uploaded documents process with that template mapping |

**Technical Requirements:**
- Add template selector to ConnectedUpload page
- Pass template ID to processing request
- Template list fetched from existing API

**UI Components Needed:**
```
TemplatePreSelector (add to FileUploadZone area)
  - TemplateDropdown (list available templates)
  - TemplatePreview (mini preview of selected template)
  - "No Template" option (for general OCR extraction)
```

#### FR-2.5: PDF Export of Filled Form

**Description:** Generate downloadable PDF with auto-filled form data.

**User Stories:**

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| FR-2.5-US1 | As a user, I want to export filled form as PDF so that I can print/submit the application | Given: Template filled with OCR data<br>When: Click "Export PDF"<br>Then: Browser downloads PDF file with all fields populated |

**Technical Requirements:**
- Leverage backend `FormFiller.fillPDFForm()`
- Create API endpoint or use existing `/api/process/fill`
- Handle PDF generation loading state

**UI Components Needed:**
```
ExportButton (existing pattern from document-detail)
  - Loading state during generation
  - Success toast with download link
  - Error handling for failed generation
```

---

### FR-3: Upload/OCR Processing Enhancement

**Priority:** High
**Dependencies:** ProcessingStatus patterns, FileUploadZone, DocumentLibrary

#### FR-3.1: Real-Time Processing Status

**Description:** Show live updates during OCR processing with granular progress information.

**User Stories:**

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| FR-3.1-US1 | As a user, I want to see processing stages so that I understand what's happening | Given: Document in OCR processing<br>When: Status updates<br>Then: See stages: "Uploading" -> "Queued" -> "Processing" -> "Extracting" -> "Complete" |
| FR-3.1-US2 | As a user, I want real-time progress updates so that I know processing is active | Given: OCR processing running<br>When: 30% complete<br>Then: Progress bar shows 30%, updates in real-time |

**Technical Requirements:**
- Leverage existing `useQueueJobPolling` hook
- Add processing stages to status display
- Backend already provides job progress via Bull queue polling

**UI Components Needed:**
```
ProcessingStatusIndicator
  - StageLabel (current processing stage name)
  - ProgressBar (0-100% with animation)
  - TimeEstimate (optional: "~30 seconds remaining")
  - PulsingIndicator (activity heartbeat)
```

#### FR-3.2: Document Library Progress Cards

**Description:** Show processing progress directly on document cards in the library view.

**User Stories:**

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| FR-3.2-US1 | As a user, I want to see processing status in library view so that I don't need to open each document | Given: Document list with processing items<br>When: Viewing library<br>Then: Processing documents show progress bars on cards |

**Technical Requirements:**
- Extend `DocumentCard` with inline progress display
- Only show for status='processing'
- Poll for updates or use WebSocket

**UI Modifications:**
```
DocumentCard (existing) - add:
  - ProcessingOverlay (when status='processing')
  - MiniProgressBar (in card header area)
  - "Processing..." status text with spinner
```

#### FR-3.3: Document Preview Modal

**Description:** Preview uploaded document before/during/after processing.

**User Stories:**

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| FR-3.3-US1 | As a user, I want to preview my uploaded document so that I verify the correct file | Given: Document in library<br>When: Click preview icon<br>Then: Modal shows document thumbnail/preview |

**Technical Requirements:**
- For PDFs: Use pdf.js or similar for rendering first page
- For images: Direct image display
- Handle large files with lazy loading

**UI Components Needed:**
```
DocumentPreviewModal
  - PreviewCanvas (PDF/image renderer)
  - PageNavigation (for multi-page documents)
  - ZoomControls
  - CloseButton
```

#### FR-3.4: OCR Confidence Score Display

**Description:** Display overall and per-field OCR confidence prominently.

**User Stories:**

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| FR-3.4-US1 | As a user, I want to see overall OCR confidence so that I know extraction quality | Given: Processed document<br>When: View document detail<br>Then: See "95% confidence" badge prominently |
| FR-3.4-US2 | As a user, I want confidence shown as percentage so that I understand the score | Given: OCR complete with 0.85 confidence<br>When: View results<br>Then: Display "85% accuracy" (not raw 0.85) |

**Technical Requirements:**
- Backend provides `confidence` in OCR result
- Convert decimal to percentage for display
- Color-code: Green (>=85%), Yellow (65-84%), Red (<65%)

**UI Components Needed:**
```
ConfidenceDisplay (expand existing ConfidenceBadge)
  - PercentageLabel ("95%")
  - ColorCoding (semantic colors)
  - Tooltip (explain what confidence means)
```

#### FR-3.5: Multipage PDF Support

**Description:** Handle and display multi-page PDF documents appropriately.

**User Stories:**

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| FR-3.5-US1 | As a user, I want to see page count for multi-page PDFs so that I know document length | Given: 5-page PDF uploaded<br>When: View in library<br>Then: Card shows "5 pages" |
| FR-3.5-US2 | As a user, I want OCR from all pages combined so that no data is missed | Given: 3-page PDF processed<br>When: View extracted data<br>Then: Data from all 3 pages is extracted |

**Technical Requirements:**
- Page count already in `Document.pageCount`
- Ensure DocumentCard displays page count (already implemented)
- Backend handles multi-page extraction

**UI Verification:**
- Existing `DocumentCard` shows `pageCount` - verify working
- Document detail shows "Page X of Y" in preview

#### FR-3.6: Document Download

**Description:** Allow downloading original uploaded documents.

**User Stories:**

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| FR-3.6-US1 | As a user, I want to download my original document so that I have a local copy | Given: Processed document<br>When: Click download button<br>Then: Browser downloads original file with correct filename |

**Technical Requirements:**
- Download endpoint exists: `/api/documents/:id/download`
- Preserve original filename
- Handle download errors gracefully

**UI Components:**
- `DocumentCard.onDownload` - already implemented
- `DocumentDetail` download button - verify implementation
- Add download progress for large files

#### FR-3.7: Document Search and Filter

**Description:** Search documents by name and filter by status.

**User Stories:**

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| FR-3.7-US1 | As a user, I want to search documents by name so that I find specific files | Given: 20 documents in library<br>When: Search "passport"<br>Then: Only documents with "passport" in name display |
| FR-3.7-US2 | As a user, I want to filter by status so that I see only completed/failed documents | Given: Mixed status documents<br>When: Filter to "Failed"<br>Then: Only failed documents display |

**Technical Requirements:**
- Search already implemented in `DocumentLibrary`
- Status filter exists in `DocumentFilters` component
- Verify E2E test selectors match implementation

**UI Verification:**
- Search input: `input[placeholder="Search documents..."]`
- Status filter: `DocumentFilters` component
- Ensure test selectors are correct

---

## Non-Functional Requirements

### NFR-1: Performance

| Requirement | Specification | Measurement |
|-------------|--------------|-------------|
| Batch upload progress update | <100ms latency | Chrome DevTools Performance |
| Document library load time | <2s for 100 documents | Lighthouse metrics |
| Search debounce | 300ms (existing) | User testing |
| Progress polling interval | 2000ms (existing) | Balance between responsiveness and server load |

### NFR-2: Accessibility

| Requirement | Specification |
|-------------|--------------|
| WCAG Level | AA compliance |
| Screen reader support | All progress states announced |
| Keyboard navigation | Full keyboard operability for upload, selection, actions |
| Color contrast | Confidence indicators readable for color-blind users |

### NFR-3: Responsiveness

| Breakpoint | Expected Behavior |
|------------|------------------|
| Desktop (>1024px) | Full feature set with side-by-side field mapping |
| Tablet (768-1024px) | Stacked layout for field mapping |
| Mobile (<768px) | Simplified batch progress, touch-friendly buttons |

### NFR-4: Error Handling

| Scenario | Expected Behavior |
|----------|------------------|
| Network failure during upload | Retry option with preserved progress, offline queue |
| Invalid file type | Immediate toast notification, file not added to queue |
| OCR service unavailable | Clear error state, manual retry option |
| Download failure | Toast notification, retry button |

### NFR-5: Data Security

| Requirement | Implementation |
|-------------|----------------|
| PII in OCR data | Encrypt at rest, TLS in transit |
| Temporary files | Auto-cleanup after 24 hours |
| Audit logging | Log all document operations |

---

## Technical Considerations

### Architecture Overview

```
Frontend (React)                    Backend (Express)
================                    =================

[ConnectedUpload]                   [/api/documents/upload]
       |                                    |
       v                                    v
[uploadStore] ----HTTP/SSE----> [Bull Queue - OCR Processing]
       |                                    |
       v                                    v
[DocumentLibrary]                  [/api/documents/:id/status]
       |                                    |
       v                                    v
[FieldMappingUI] ----HTTP----> [FieldMapper Service]
       |                                    |
       v                                    v
[TemplateForm] ----HTTP----> [FormFiller Service]
       |                                    v
       v                           [/api/process/fill]
[PDF Export]                              |
                                          v
                                [Filled PDF Response]
```

### Technology Stack (Frontend Changes)

| Layer | Technology | Purpose |
|-------|------------|---------|
| State | Zustand + Immer | Upload queue, document selection |
| Polling | useQueueJobPolling | Real-time status updates |
| Animations | Framer Motion | Progress transitions |
| PDF Preview | react-pdf or @react-pdf/renderer | Document preview |
| Forms | React Hook Form + Zod | Template field validation |

### Data Model Extensions

```typescript
// Extended UploadFile (uploadStore)
interface UploadFile {
  // ... existing fields
  uploadProgress: number;      // 0-100 for upload phase
  processingProgress: number;  // 0-100 for OCR phase
  processingStage: 'queued' | 'processing' | 'extracting' | 'complete';
  isSelected: boolean;         // For batch selection
}

// Field Mapping (new)
interface FieldMappingUI {
  documentId: string;
  templateId: string;
  mappings: Array<{
    sourceField: string;
    sourceValue: string;
    targetField: string;
    confidence: number;
    isOverridden: boolean;
    overrideValue?: string;
  }>;
  overallConfidence: number;
}
```

### API Integration Points

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/documents/upload` | POST | Upload files | Existing |
| `/api/documents/:id/status` | GET | Get processing status | Existing |
| `/api/documents/:id/download` | GET | Download original | Existing |
| `/api/documents/:id/mapping` | GET | Get field mappings | **New** |
| `/api/templates/:id/fill` | POST | Apply mappings to template | **New** |
| `/api/process/fill` | POST | Generate filled PDF | Existing |

### Infrastructure Needs

- **Redis:** Already used for Bull queue
- **File Storage:** R2/S3 already configured
- **PDF Generation:** pdf-lib already in backend dependencies

---

## User Story Development

### Epic 1: Batch Upload Enhancements

```
Epic: As an immigration agent, I want to upload and track multiple documents
      simultaneously so that I can process batches efficiently.

US-1.1: Individual File Progress Tracking
  As a user, I want to see progress for each file individually
  so that I know which files are completing.

  Acceptance Criteria:
  - Given: I upload 5 files simultaneously
  - When: Upload begins
  - Then: Each file shows its own progress bar (0-100%)
  - And: Completed files show checkmark
  - And: Failed files show error icon with message

  Story Points: 3
  Dependencies: None

US-1.2: Cancel Individual Upload
  As a user, I want to cancel a specific file upload
  so that I can remove unwanted files without stopping others.

  Acceptance Criteria:
  - Given: 3 files uploading, file #2 is unwanted
  - When: I click cancel on file #2
  - Then: Only file #2 is cancelled
  - And: Files #1 and #3 continue uploading

  Story Points: 2
  Dependencies: US-1.1

US-1.3: Retry Failed Uploads
  As a user, I want to retry all failed uploads with one click
  so that I can recover from transient errors.

  Acceptance Criteria:
  - Given: 2 of 5 uploads failed
  - When: I click "Retry Failed"
  - Then: Only the 2 failed files restart
  - And: Completed files are unchanged

  Story Points: 2
  Dependencies: US-1.1

US-1.4: Cancel All Uploads
  As a user, I want to cancel all active uploads
  so that I can abort an incorrect batch.

  Acceptance Criteria:
  - Given: 5 files uploading
  - When: I click "Cancel All"
  - Then: All uploads are aborted
  - And: Status shows "Cancelled" for each

  Story Points: 1
  Dependencies: US-1.1

US-1.5: Aggregate Progress Display
  As a user, I want to see overall batch progress
  so that I know total completion status.

  Acceptance Criteria:
  - Given: 5 files uploading
  - When: 2 files complete, 3 in progress
  - Then: Display shows "2/5 completed"
  - And: Overall progress bar shows ~40%

  Story Points: 2
  Dependencies: US-1.1
```

### Epic 2: Template Autofill System

```
Epic: As a user, I want OCR data to automatically fill template forms
      so that I save time on data entry.

US-2.1: Auto-Fill Template from OCR
  As a user, I want template fields to auto-populate from OCR data
  so that I don't manually copy values.

  Acceptance Criteria:
  - Given: Document processed with OCR data containing "Passport No: AB123456"
  - When: I select "Visa Application" template
  - Then: Passport number field auto-fills with "AB123456"

  Story Points: 5
  Dependencies: Backend FieldMapper API

US-2.2: Display Field Confidence
  As a user, I want to see confidence levels for auto-filled fields
  so that I know which values to verify.

  Acceptance Criteria:
  - Given: Template with auto-filled fields
  - When: I view the form
  - Then: Each field shows confidence badge (High/Medium/Low)
  - And: Low confidence fields are highlighted

  Story Points: 3
  Dependencies: US-2.1

US-2.3: Manual Mapping Override
  As a user, I want to change which OCR value fills a field
  so that I can correct wrong mappings.

  Acceptance Criteria:
  - Given: Wrong OCR value in passport field
  - When: I click field dropdown and select correct value
  - Then: Field updates with new value
  - And: Field is marked as "manually adjusted"

  Story Points: 3
  Dependencies: US-2.1

US-2.4: Export Filled PDF
  As a user, I want to export the filled template as PDF
  so that I can print or submit it.

  Acceptance Criteria:
  - Given: Template with filled fields
  - When: I click "Export PDF"
  - Then: Browser downloads PDF with all values filled in

  Story Points: 3
  Dependencies: US-2.1, Backend FormFiller API

US-2.5: Template Selection During Upload
  As a user, I want to pre-select a template before uploading
  so that processing is targeted to specific forms.

  Acceptance Criteria:
  - Given: On upload page
  - When: I select "UAE Visa" template before uploading
  - Then: Documents are processed with UAE Visa field expectations

  Story Points: 2
  Dependencies: None
```

### Epic 3: OCR Processing Enhancement

```
Epic: As a user, I want clear visibility into document processing status
      so that I understand what's happening with my uploads.

US-3.1: Processing Status Stages
  As a user, I want to see processing stages
  so that I understand the workflow.

  Acceptance Criteria:
  - Given: Document submitted for processing
  - When: Processing progresses
  - Then: Status shows: "Queued" -> "Processing" -> "Extracting" -> "Complete"

  Story Points: 3
  Dependencies: None

US-3.2: Real-Time Progress Updates
  As a user, I want progress to update in real-time
  so that I know processing is active.

  Acceptance Criteria:
  - Given: Document in processing
  - When: Backend reports 50% progress
  - Then: UI updates within 3 seconds to show 50%

  Story Points: 2
  Dependencies: US-3.1

US-3.3: Library Card Progress
  As a user, I want to see processing status on library cards
  so that I don't need to open each document.

  Acceptance Criteria:
  - Given: Document library with processing items
  - When: Viewing grid/list view
  - Then: Processing cards show mini progress bar

  Story Points: 2
  Dependencies: US-3.2

US-3.4: Document Preview
  As a user, I want to preview uploaded documents
  so that I verify the correct file was uploaded.

  Acceptance Criteria:
  - Given: Document in library
  - When: Click preview button
  - Then: Modal shows document first page/image
  - And: Can navigate pages for multi-page docs

  Story Points: 5
  Dependencies: None

US-3.5: Confidence Score Display
  As a user, I want to see OCR confidence as a percentage
  so that I understand extraction quality.

  Acceptance Criteria:
  - Given: Processed document with 0.92 confidence
  - When: View document details
  - Then: Display shows "92% confidence" with green indicator

  Story Points: 1
  Dependencies: None

US-3.6: Search Documents
  As a user, I want to search documents by name
  so that I can find specific files.

  Acceptance Criteria:
  - Given: 50 documents in library
  - When: Search "passport"
  - Then: Only documents with "passport" in name display

  Story Points: 1 (verify existing implementation)
  Dependencies: None

US-3.7: Filter by Status
  As a user, I want to filter documents by status
  so that I see only relevant items.

  Acceptance Criteria:
  - Given: Documents with mixed statuses
  - When: Filter to "Failed"
  - Then: Only failed documents display

  Story Points: 1 (verify existing implementation)
  Dependencies: None
```

---

## Implementation Roadmap

### Sprint 1: Batch Upload Foundation (Week 1-2)

| Task | Story | Estimate | Owner |
|------|-------|----------|-------|
| Extend uploadStore with selection state | US-1.1, US-1.4 | 3h | FE Dev |
| Create BatchActionsToolbar component | US-1.2, US-1.3, US-1.4 | 4h | FE Dev |
| Add retryFailed action to uploadStore | US-1.3 | 2h | FE Dev |
| Implement aggregate progress display | US-1.5 | 3h | FE Dev |
| Update ConnectedUpload with batch UI | All | 4h | FE Dev |
| Write unit tests for batch actions | All | 3h | FE Dev |

### Sprint 2: OCR Status Enhancement (Week 2-3)

| Task | Story | Estimate | Owner |
|------|-------|----------|-------|
| Add processing stages to status display | US-3.1 | 3h | FE Dev |
| Enhance DocumentCard with progress overlay | US-3.3 | 4h | FE Dev |
| Implement DocumentPreviewModal | US-3.4 | 6h | FE Dev |
| Verify/fix search and filter selectors | US-3.6, US-3.7 | 2h | FE Dev |
| Enhance confidence display formatting | US-3.5 | 2h | FE Dev |
| E2E test fixes for OCR tests | All | 4h | QA |

### Sprint 3: Template Autofill System (Week 3-4)

| Task | Story | Estimate | Owner |
|------|-------|----------|-------|
| Create FieldMappingPanel component | US-2.1 | 8h | FE Dev |
| Integrate with backend FieldMapper API | US-2.1 | 4h | FE Dev |
| Add field-level confidence indicators | US-2.2 | 3h | FE Dev |
| Implement manual mapping override | US-2.3 | 4h | FE Dev |
| Add template selector to upload page | US-2.5 | 3h | FE Dev |
| Integrate PDF export functionality | US-2.4 | 4h | FE Dev |
| E2E test fixes for template tests | All | 4h | QA |

### Sprint 4: Polish and Testing (Week 4)

| Task | Story | Estimate | Owner |
|------|-------|----------|-------|
| Accessibility audit and fixes | All | 4h | FE Dev |
| Performance optimization | All | 4h | FE Dev |
| Error handling improvements | All | 3h | FE Dev |
| Full E2E test suite validation | All | 6h | QA |
| Documentation updates | All | 2h | Tech Writer |

---

## Quality Assurance

### Test Strategy

| Test Type | Coverage | Tool |
|-----------|----------|------|
| Unit Tests | 80%+ code coverage | Vitest |
| Component Tests | Key interactions | Testing Library |
| Integration Tests | API integrations | MSW + Vitest |
| E2E Tests | 36 document scenarios | Playwright |
| Visual Regression | Key screens | Playwright screenshots |

### E2E Test Alignment Checklist

| Test File | Test Count | Status |
|-----------|------------|--------|
| document-upload.spec.ts | 10 | To validate |
| upload-ocr.spec.ts | 18 | To validate |
| template-autofill.spec.ts | 10 | To validate |

### Acceptance Testing

- [ ] All 36 E2E tests pass in CI
- [ ] Manual QA sign-off on batch upload flows
- [ ] Manual QA sign-off on template autofill accuracy
- [ ] Accessibility testing with screen reader
- [ ] Performance benchmarks met

---

## Appendix

### A. Existing Component Inventory

| Component | Location | Reusability |
|-----------|----------|-------------|
| uploadStore | stores/uploadStore.ts | Extend with batch actions |
| ConnectedUpload | pages/ConnectedUpload.tsx | Modify for batch UI |
| DocumentCard | components/features/document-card.tsx | Add progress overlay |
| ConfidenceBadge | components/features/ocr-confidence-alert.tsx | Reuse directly |
| StatusBadge | components/features/status-badge.tsx | Reuse directly |
| DocumentFilters | components/features/document-filters.tsx | Verify selectors |
| BulkActionsToolbar | components/features/bulk-actions-toolbar.tsx | Adapt for upload page |

### B. Backend API Reference

| Service | Method | Returns |
|---------|--------|---------|
| FieldMapper.mapFields() | async | MappingResult |
| FormFiller.fillPDFForm() | async | FillResult |
| Bull Queue | job.progress | Number (0-100) |

### C. Design Mockup References

- Batch upload progress: Follow existing upload queue design
- Field mapping UI: Two-panel layout with connecting lines
- Confidence indicators: Use existing badge patterns with color coding

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-09 | AI Product Specialist | Initial PRD creation |

---

**END OF DOCUMENT**
