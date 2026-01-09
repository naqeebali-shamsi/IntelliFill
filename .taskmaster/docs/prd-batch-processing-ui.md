# PRD: Batch Processing UI Enhancements

**Version:** 1.0
**Created:** 2026-01-09
**Author:** Product Team
**Status:** Draft

---

## Executive Summary

### Problem Statement

IntelliFill's document upload system has robust backend infrastructure supporting batch processing with 4 queues and concurrent upload handling. However, the frontend UI lacks critical batch management features that users expect when uploading multiple documents. Users cannot efficiently manage bulk uploads, lack visibility into overall progress, and have limited control over active upload operations.

### Solution Overview

Enhance the ConnectedUpload page and upload queue components with batch management capabilities including bulk selection, aggregated progress displays, Cancel All functionality, and optional Pause/Resume controls. These changes will improve user experience when processing multiple documents while leveraging existing backend infrastructure.

### Business Impact

- **Reduced user frustration** when managing large document batches
- **Improved operational efficiency** with bulk actions reducing click counts by 80%+
- **Increased user confidence** through clear progress visibility
- **Better error recovery** with granular control over failed uploads

### Resource Requirements

- **Frontend Development:** 3-5 days
- **Testing:** 1-2 days (E2E tests already scaffolded)
- **Design:** Minimal (follows existing UI patterns)

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| State management complexity | Medium | Medium | Leverage existing uploadStore patterns |
| Performance with 100+ files | Low | Medium | Virtual scrolling already implemented |
| SSE event handling gaps | Low | High | Existing infrastructure is robust |

---

## Product Overview

### Product Vision

Transform IntelliFill's document upload experience from individual file management to efficient batch processing with enterprise-grade controls that scale from single documents to hundreds.

### Target Users

1. **Primary: Insurance Processors** - Upload 20-100 documents per session, need bulk management
2. **Secondary: Agency Administrators** - Batch upload historical documents, require progress tracking
3. **Tertiary: Individual Users** - Occasional multi-file uploads, benefit from clear status

### Value Proposition

| Current State | Future State |
|--------------|--------------|
| Manage uploads individually | Bulk select/deselect with one click |
| Guess overall progress | See "45 of 100 uploaded" clearly |
| Cancel files one by one | Cancel All Active with confirmation |
| No pause capability | Pause/Resume batch processing |
| Fixed concurrent limit | Optional: Adjustable concurrency |

### Success Criteria

1. **Primary:** Users can select and act on multiple queued items with ≤2 clicks
2. **Primary:** Aggregated progress visible at all times during batch upload
3. **Primary:** Cancel All Active completes in <500ms regardless of queue size
4. **Secondary:** Pause/Resume maintains upload state correctly
5. **Metric:** E2E batch-processing.spec.ts passes 100%

### Assumptions

1. Existing uploadStore architecture supports proposed enhancements
2. p-queue library supports pause/resume operations
3. Users have reliable network connections during uploads
4. Maximum batch size remains 100 documents (current limit)

---

## Functional Requirements

### FR-1: Bulk Selection UI

**Priority:** P0 (Must Have)

#### Description
Add a "Select All" checkbox to the upload queue header that toggles selection state for all visible queue items. Include individual checkboxes per item for granular selection.

#### User Stories

**US-1.1: Select All Queued Items**
```
As an insurance processor,
I want to select all queued documents with one click,
So that I can perform bulk actions without clicking each item.

Acceptance Criteria:
GIVEN I have 10 documents in the upload queue
WHEN I click the "Select All" checkbox in the queue header
THEN all 10 documents become selected
AND the checkbox shows a checked state
AND a selection count appears (e.g., "10 selected")
```

**US-1.2: Deselect All**
```
As an insurance processor,
I want to deselect all documents with one click,
So that I can quickly clear my selection.

Acceptance Criteria:
GIVEN I have 10 documents selected
WHEN I click the checked "Select All" checkbox
THEN all documents become deselected
AND the checkbox shows an unchecked state
AND the selection count disappears or shows "0 selected"
```

**US-1.3: Individual Item Selection**
```
As a user,
I want to select/deselect individual documents,
So that I can perform actions on a specific subset.

Acceptance Criteria:
GIVEN I have 10 documents in the queue
WHEN I click the checkbox next to document #3
THEN only document #3 becomes selected
AND the "Select All" checkbox shows an indeterminate state
AND the selection count shows "1 selected"
```

**US-1.4: Partial Selection State**
```
As a user,
I want to see when some (but not all) items are selected,
So that I understand the current selection state.

Acceptance Criteria:
GIVEN I have 10 documents with 5 selected
WHEN I view the "Select All" checkbox
THEN it displays an indeterminate/partial state (dash icon)
AND clicking it selects all remaining items
```

#### Technical Requirements

```typescript
// uploadStore additions
interface UploadStore {
  // Existing...
  selectedIds: Set<string>;
  selectAll: () => void;
  deselectAll: () => void;
  toggleSelection: (id: string) => void;
  isAllSelected: boolean; // computed
  isPartiallySelected: boolean; // computed
  selectedCount: number; // computed
}
```

#### UI Specifications

- Checkbox in queue header row, aligned left
- Individual checkboxes per queue item, aligned left
- Selection count displayed: "{n} selected" or hidden when 0
- Indeterminate state uses Radix UI Checkbox with `checked="indeterminate"`

---

### FR-2: Aggregated Progress Display

**Priority:** P0 (Must Have)

#### Description
Display overall batch upload progress in a clear, prominent format showing completed count, total count, and visual progress indicator.

#### User Stories

**US-2.1: View Overall Progress**
```
As a user uploading many documents,
I want to see aggregated progress like "45 of 100 uploaded",
So that I understand overall completion status at a glance.

Acceptance Criteria:
GIVEN I am uploading 100 documents
AND 45 have completed successfully
WHEN I view the upload queue header
THEN I see text reading "45 of 100 uploaded"
AND I see a progress bar showing 45% complete
```

**US-2.2: Progress with Errors**
```
As a user,
I want to see error counts in the aggregate progress,
So that I know if uploads are failing.

Acceptance Criteria:
GIVEN I am uploading 100 documents
AND 40 completed, 5 failed, 55 pending
WHEN I view the upload queue header
THEN I see "40 of 100 uploaded" in primary text
AND I see "5 failed" in warning/error styling
AND the progress bar shows 40% green, 5% red
```

**US-2.3: Dynamic Progress Updates**
```
As a user,
I want progress to update in real-time,
So that I can monitor active uploads.

Acceptance Criteria:
GIVEN uploads are in progress
WHEN a document completes or fails
THEN the aggregate counts update within 100ms
AND the progress bar animates smoothly
AND no page refresh is required
```

#### Technical Requirements

```typescript
// uploadStore computed values
interface UploadProgress {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  active: number;
  percentage: number; // (completed / total) * 100
}

// Selector
const useAggregatedProgress = () => useUploadStore(selectProgress);
```

#### UI Specifications

- Location: Upload queue header, right-aligned or below queue title
- Format: "{completed} of {total} uploaded" in semibold
- Error indicator: "• {n} failed" in text-destructive color
- Progress bar: Full width, 8px height, rounded-full
- Progress bar segments: green (completed), red (failed), gray (remaining)
- Animation: CSS transition on width changes (150ms ease-out)

---

### FR-3: Cancel All Active Button

**Priority:** P0 (Must Have)

#### Description
Add a "Cancel All" button that cancels all currently active and pending uploads with a confirmation dialog.

#### User Stories

**US-3.1: Cancel All Active Uploads**
```
As a user who started the wrong batch,
I want to cancel all active uploads at once,
So that I can stop the process immediately.

Acceptance Criteria:
GIVEN I have 50 documents uploading (10 active, 40 pending)
WHEN I click "Cancel All Active"
THEN a confirmation dialog appears
AND upon confirmation, all 50 items are cancelled
AND the queue shows all items with "Cancelled" status
AND network requests are aborted within 500ms
```

**US-3.2: Cancel Confirmation**
```
As a user,
I want to confirm before cancelling all uploads,
So that I don't accidentally stop important uploads.

Acceptance Criteria:
GIVEN I click "Cancel All Active"
WHEN the confirmation dialog appears
THEN it shows "Cancel {n} uploads?"
AND has "Cancel" (secondary) and "Confirm" (destructive) buttons
AND pressing Escape closes without action
```

**US-3.3: Selective Cancel via Selection**
```
As a user,
I want to cancel only selected uploads,
So that I can remove specific items while keeping others.

Acceptance Criteria:
GIVEN I have 10 documents with 3 selected
WHEN I click "Cancel Selected"
THEN only the 3 selected items are cancelled
AND the other 7 continue uploading
AND selection is cleared after action
```

#### Technical Requirements

```typescript
// uploadStore additions
interface UploadStore {
  // Existing cancelUpload(id)...
  cancelAll: () => Promise<void>;
  cancelSelected: () => Promise<void>;
}

// Must use AbortController for each request
// Must clear pending items from p-queue
```

#### UI Specifications

- Button location: Queue header toolbar, grouped with other actions
- Button style: variant="outline" with destructive styling on hover
- Icon: X or XCircle from lucide-react
- Disabled state: When no active/pending uploads exist
- Confirmation dialog: Uses AlertDialog from Radix UI

---

### FR-4: Pause/Resume UI

**Priority:** P1 (Should Have)

#### Description
Add Pause and Resume buttons to temporarily halt batch upload processing while preserving queue state.

#### User Stories

**US-4.1: Pause Active Uploads**
```
As a user with limited bandwidth,
I want to pause all uploads temporarily,
So that I can use bandwidth for other tasks.

Acceptance Criteria:
GIVEN I have uploads in progress
WHEN I click the "Pause" button
THEN currently uploading files complete (no mid-file abort)
AND no new uploads start from the queue
AND the button changes to "Resume"
AND the queue header shows "Paused" status
```

**US-4.2: Resume Paused Uploads**
```
As a user,
I want to resume paused uploads,
So that processing continues where it left off.

Acceptance Criteria:
GIVEN uploads are paused with 50 items remaining
WHEN I click "Resume"
THEN uploads begin processing from the queue
AND the button changes back to "Pause"
AND the "Paused" status indicator disappears
```

**US-4.3: Pause Persists Across Navigation**
```
As a user,
I want pause state to persist if I navigate away,
So that uploads don't restart unexpectedly.

Acceptance Criteria:
GIVEN I pause uploads and navigate to another page
WHEN I return to the upload page
THEN the queue is still paused
AND the "Resume" button is displayed
AND queue state is intact
```

#### Technical Requirements

```typescript
// p-queue supports pause/resume natively
// uploadStore additions
interface UploadStore {
  isPaused: boolean;
  pause: () => void;
  resume: () => void;
}

// Implementation uses queue.pause() and queue.start()
```

#### UI Specifications

- Button location: Queue header toolbar, primary position
- Pause button: variant="outline", PauseCircle icon
- Resume button: variant="default", PlayCircle icon
- Status indicator: "Paused" badge in amber/yellow styling
- Transition: Button icon/text animates on state change

---

### FR-5: Clear All Button Enhancement

**Priority:** P1 (Should Have)

#### Description
Enable the "Clear Completed" button during active uploads and add a "Clear All" option.

#### User Stories

**US-5.1: Clear Completed During Upload**
```
As a user,
I want to clear completed items while uploads continue,
So that I can keep my queue manageable.

Acceptance Criteria:
GIVEN I have 30 completed and 20 active uploads
WHEN I click "Clear Completed"
THEN the 30 completed items are removed
AND the 20 active items remain
AND uploads continue uninterrupted
```

**US-5.2: Clear All with Confirmation**
```
As a user,
I want to clear all items including active,
So that I can reset the queue entirely.

Acceptance Criteria:
GIVEN I have items in various states
WHEN I click "Clear All" and confirm
THEN all active uploads are cancelled
AND all items are removed from queue
AND the queue shows empty state
```

#### Technical Requirements

```typescript
// Modify existing clearCompleted behavior
// Add new clearAll function
interface UploadStore {
  clearCompleted: () => void; // Already exists, remove disabled state
  clearAll: () => Promise<void>; // New: cancels then clears
}
```

---

### FR-6: Concurrent Upload Limit Control (Optional)

**Priority:** P2 (Nice to Have)

#### Description
Add a slider or dropdown to adjust the number of concurrent uploads (1-10 range).

#### User Stories

**US-6.1: Adjust Concurrency**
```
As a power user,
I want to adjust how many files upload simultaneously,
So that I can balance speed vs system resources.

Acceptance Criteria:
GIVEN the current concurrency is 3
WHEN I adjust the slider to 6
THEN up to 6 files upload concurrently
AND the change takes effect immediately
AND the setting persists for the session
```

#### Technical Requirements

```typescript
// p-queue concurrency is immutable, need to recreate queue
// or use queue.concurrency setter (if supported in version)
interface UploadStore {
  concurrency: number;
  setConcurrency: (value: number) => void;
}
```

#### UI Specifications

- Location: Settings panel or queue header (collapsed by default)
- Control: Slider with 1-10 range, or Select dropdown
- Default: 3 (current value)
- Label: "Concurrent uploads: {n}"

---

## Non-Functional Requirements

### NFR-1: Performance

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Select All response time | <50ms | Time from click to UI update |
| Cancel All completion | <500ms | Time to abort all requests |
| Progress bar updates | <100ms | Latency from event to render |
| Memory with 100 items | <50MB increase | Browser dev tools |

### NFR-2: Usability

- All new controls must be keyboard accessible (Tab, Enter, Space)
- Screen reader announcements for state changes
- Color-blind safe progress indicators (not color-only)
- Mobile responsive (touch targets ≥44px)

### NFR-3: Reliability

- Queue state survives page refresh (via zustand persist)
- Graceful degradation if SSE connection drops
- Retry logic for transient failures (already exists)

### NFR-4: Security

- No new API endpoints required
- Uses existing authentication context
- No sensitive data in localStorage (file content never cached)

---

## Technical Considerations

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ConnectedUpload Page                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Queue Header (NEW COMPONENTS)           │    │
│  │  ┌──────────┬────────────┬─────────┬────────────┐   │    │
│  │  │ ☐ Select │ 45/100     │ Pause   │ Cancel All │   │    │
│  │  │   All    │ uploaded   │ ▶/⏸     │     ✕      │   │    │
│  │  └──────────┴────────────┴─────────┴────────────┘   │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │ ████████████████░░░░░░░░ 45%                │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Queue Items (ENHANCED)                  │    │
│  │  ┌──┬────────────────────────┬──────────┬──────┐    │    │
│  │  │☐ │ document1.pdf          │ ████ 75% │  ✕   │    │    │
│  │  │☐ │ document2.pdf          │ Complete │  ✕   │    │    │
│  │  │☐ │ document3.pdf          │ Pending  │  ✕   │    │    │
│  │  └──┴────────────────────────┴──────────┴──────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **State Management:** Zustand 5.0 (existing uploadStore)
- **Queue Library:** p-queue (already integrated)
- **UI Components:** Radix UI primitives
- **Styling:** TailwindCSS 4.0

### Component Structure

```
quikadmin-web/src/components/features/upload/
├── UploadQueueHeader.tsx       # NEW: Aggregate progress, bulk actions
├── UploadQueueItem.tsx         # MODIFY: Add selection checkbox
├── UploadProgressBar.tsx       # NEW: Segmented progress component
├── BulkActionToolbar.tsx       # NEW: Cancel All, Pause, Clear buttons
└── ConcurrencyControl.tsx      # NEW (P2): Slider component
```

### State Changes (uploadStore)

```typescript
// New state fields
interface UploadStoreState {
  // ... existing fields
  selectedIds: Set<string>;
  isPaused: boolean;
  concurrency: number;
}

// New actions
interface UploadStoreActions {
  // ... existing actions
  selectAll: () => void;
  deselectAll: () => void;
  toggleSelection: (id: string) => void;
  cancelAll: () => Promise<void>;
  cancelSelected: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  clearAll: () => Promise<void>;
  setConcurrency: (n: number) => void;
}

// New computed selectors
const selectProgress = (state: UploadStoreState): UploadProgress => ({
  total: state.queue.length,
  completed: state.queue.filter(i => i.status === 'completed').length,
  failed: state.queue.filter(i => i.status === 'error').length,
  pending: state.queue.filter(i => i.status === 'pending').length,
  active: state.queue.filter(i => i.status === 'uploading').length,
  percentage: /* calculated */,
});

const selectIsAllSelected = (state: UploadStoreState): boolean =>
  state.selectedIds.size === state.queue.length && state.queue.length > 0;

const selectIsPartiallySelected = (state: UploadStoreState): boolean =>
  state.selectedIds.size > 0 && state.selectedIds.size < state.queue.length;
```

### Data Model

No database changes required. All state is client-side.

### Integration Requirements

- **SSE Events:** No changes needed (existing progress events sufficient)
- **API Endpoints:** No changes needed (existing batch endpoints sufficient)
- **Backend Queues:** No changes needed (cancelation handled client-side via AbortController)

### Infrastructure Needs

None. All changes are frontend-only.

---

## Implementation Plan

### Phase 1: Core Selection & Progress (P0)

**Duration:** 2 days

| Task | Description | Effort |
|------|-------------|--------|
| 1.1 | Add selection state to uploadStore | 2h |
| 1.2 | Create UploadQueueHeader component | 4h |
| 1.3 | Add checkboxes to UploadQueueItem | 2h |
| 1.4 | Implement aggregated progress display | 3h |
| 1.5 | Create UploadProgressBar component | 2h |

### Phase 2: Bulk Actions (P0)

**Duration:** 1.5 days

| Task | Description | Effort |
|------|-------------|--------|
| 2.1 | Implement cancelAll in uploadStore | 3h |
| 2.2 | Implement cancelSelected | 2h |
| 2.3 | Create BulkActionToolbar component | 3h |
| 2.4 | Add confirmation dialogs | 2h |

### Phase 3: Pause/Resume & Polish (P1)

**Duration:** 1 day

| Task | Description | Effort |
|------|-------------|--------|
| 3.1 | Implement pause/resume in uploadStore | 2h |
| 3.2 | Add pause/resume UI | 2h |
| 3.3 | Fix clearCompleted during active uploads | 1h |
| 3.4 | Add clearAll functionality | 1h |

### Phase 4: Testing & Refinement

**Duration:** 1 day

| Task | Description | Effort |
|------|-------------|--------|
| 4.1 | Update batch-processing.spec.ts E2E tests | 3h |
| 4.2 | Add unit tests for new store methods | 2h |
| 4.3 | Accessibility audit and fixes | 2h |
| 4.4 | Performance testing with 100+ files | 1h |

### Phase 5: Optional Enhancements (P2)

**Duration:** 0.5 days (if time permits)

| Task | Description | Effort |
|------|-------------|--------|
| 5.1 | Create ConcurrencyControl component | 2h |
| 5.2 | Wire up concurrency to p-queue | 2h |

---

## Success Criteria

### Primary Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| E2E Tests Pass | 100% | CI pipeline |
| Select All Response | <50ms | Performance test |
| Cancel All Response | <500ms | Performance test |
| User Clicks (10 file cancel) | 2 (was 10) | Manual test |

### Secondary Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Accessibility Score | 100 | axe-core audit |
| Mobile Usability | Pass | Manual test on 375px width |
| Memory Increase (100 files) | <50MB | Chrome DevTools |

### User Acceptance Criteria

1. Users can upload 50+ documents and manage them efficiently
2. Users always know how many uploads completed vs remaining
3. Users can stop all uploads in emergency situations
4. Users can pause uploads without losing progress

---

## Out of Scope

The following items are explicitly excluded from this PRD:

1. **Drag-and-drop reordering of queue items** - Complex and low priority
2. **Priority queue (upload certain files first)** - Backend changes required
3. **Upload scheduling (time-based uploads)** - New feature entirely
4. **Folder upload support** - Browser compatibility concerns
5. **Resume interrupted uploads (after browser close)** - Requires chunked upload backend
6. **Upload speed throttling** - Network-level concern
7. **Duplicate file detection** - Separate feature with backend implications
8. **Batch metadata editing** - Separate PRD recommended
9. **Backend queue UI (documentQueue, ocrQueue, etc.)** - Admin feature
10. **Mobile app support** - Web only

---

## Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Should selection persist after page refresh? | Product | Pending |
| 2 | Should we show estimated time remaining? | Product | Deferred (complex) |
| 3 | What's the max file count we should test? | Engineering | 100 (confirmed) |
| 4 | Should cancel confirmation be skippable? | UX | Pending |

---

## Appendix

### A. Existing Code References

**uploadStore location:** `quikadmin-web/src/stores/uploadStore.ts`
**ConnectedUpload page:** `quikadmin-web/src/pages/ConnectedUpload.tsx`
**E2E tests:** `quikadmin-web/e2e/batch-processing.spec.ts`

### B. Related PRDs

- None (new capability)

### C. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-09 | Product Team | Initial draft |

---

*End of PRD*
