---
phase: 02-intelligence
plan: 02
subsystem: person-grouper-ui
tags: [dnd-kit, drag-drop, person-grouping, wizard, react]

# Dependency graph
requires:
  - phase: 02-01
    provides: Entity resolution backend, @dnd-kit dependencies
provides:
  - PersonGrouper component with drag-drop
  - DocumentItem draggable card
  - PersonCard droppable container
  - MergeSuggestion banner component
  - Wizard integration for grouping step
affects: [02-03-plan, smart-profile-wizard, confidence-review]

# Tech tracking
tech-stack:
  used:
    - "@dnd-kit/core@6.3.1" (DndContext, sensors, collision detection)
    - "@dnd-kit/sortable@10.0.0" (useSortable, SortableContext)
    - "@dnd-kit/utilities@3.2.2" (CSS transforms)
  patterns:
    - Multi-container drag-drop with DragOverlay
    - Inline editable person names
    - Responsive grid layout (1/2/3 columns)
    - Merge suggestion banners with dismiss

key-files:
  created:
    - quikadmin-web/src/components/smart-profile/PersonGrouper/DocumentItem.tsx
    - quikadmin-web/src/components/smart-profile/PersonGrouper/PersonCard.tsx
    - quikadmin-web/src/components/smart-profile/PersonGrouper/MergeSuggestion.tsx
    - quikadmin-web/src/components/smart-profile/PersonGrouper/index.tsx
  modified:
    - quikadmin-web/src/components/smart-profile/index.ts
    - quikadmin-web/src/services/smartProfileService.ts
    - quikadmin-web/src/pages/SmartProfile.tsx

key-decisions:
  - "Use PointerSensor with 8px activation distance (prevents accidental drags)"
  - "PersonCard uses useDroppable for container detection during drag"
  - "Inline edit pattern for person names (not modal)"
  - "Merge suggestions dismissable per-session (not persisted)"
  - "Show grouping step only when >1 person detected"

patterns-established:
  - "DocumentItemDocument interface for document props"
  - "PersonGroup interface with id, name, confidence, documentIds"
  - "SuggestedMerge type matching backend response"
  - "handleGroupingChange callback pattern for wizard integration"

issues-created: []

# Metrics
duration: ~18min
completed: 2026-01-15
---

# Phase 02 Plan 02: PersonGrouper UI Summary

**Drag-drop UI for organizing documents by person in Smart Profile wizard**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-01-15
- **Completed:** 2026-01-15
- **Tasks:** 4
- **Files created:** 4
- **Files modified:** 3

## Accomplishments

- Created DocumentItem component with useSortable hook for drag handles
- Built PersonCard droppable container with inline name editing
- Implemented PersonGrouper orchestrating DndContext with DragOverlay
- Integrated PersonGrouper into SmartProfile wizard flow
- Added MergeSuggestion component for backend merge suggestions

## Task Commits

Each task was committed atomically:

1. **Task 1: DocumentItem** - `940d629` - Draggable document card with useSortable
2. **Task 2: PersonCard** - `76c9419` - Droppable container with inline edit
3. **Task 3: PersonGrouper + MergeSuggestion** - `d63c22a` - Main component with DndContext
4. **Task 4: Wizard integration** - `815cbd7` - Wire into SmartProfile page

## Files Created/Modified

### Created

- `PersonGrouper/DocumentItem.tsx` - Draggable document with GripVertical handle
- `PersonGrouper/PersonCard.tsx` - Droppable container, inline name editing
- `PersonGrouper/MergeSuggestion.tsx` - Merge suggestion banner with actions
- `PersonGrouper/index.tsx` - Main component, DndContext orchestration

### Modified

- `smart-profile/index.ts` - Export PersonGrouper and types
- `smartProfileService.ts` - Add DetectedPerson, SuggestedMerge types
- `SmartProfile.tsx` - Integrate PersonGrouper into grouping step

## Component API

```typescript
// PersonGrouper props
interface PersonGrouperProps {
  groups: PersonGroup[];
  documents: DocumentItemDocument[];
  suggestedMerges?: SuggestedMerge[];
  onGroupingChange: (
    groups: Array<{ id: string; name: string | null; documentIds: string[] }>
  ) => void;
}

// PersonGroup shape
interface PersonGroup {
  id: string;
  name: string | null;
  confidence: number;
  documentIds: string[];
}
```

## Features Implemented

1. **Drag documents between person cards** - Full @dnd-kit integration
2. **DragOverlay** - Shows dragged document visually during drag
3. **Visual feedback** - Ring highlight on drop targets
4. **Merge All button** - Combines all groups into one
5. **Create New Person button** - Adds empty group for splitting
6. **Inline name editing** - Click pencil to edit person name
7. **Merge suggestions** - Banner showing backend suggestions with Merge/Dismiss
8. **Empty state** - "Drag documents here" when no documents in group
9. **Responsive grid** - 1 column mobile, 2 tablet, 3 desktop

## Wizard Flow Update

- After extraction, if `detectedPeople.length > 1`, wizard navigates to grouping step
- If single person, skips to review (if low confidence fields) or profile
- GroupingStepContent converts store data to PersonGrouper props
- Grouping changes persist back to store via `setDetectedPeople`

## Deviations from Plan

- None significant - plan was well-specified

## Issues Encountered

- Pre-existing TypeScript errors in test files (not related to this plan)
- Linter auto-formatted some files (expected behavior)

## Verification

- [x] `bun run build` succeeds
- [x] TypeScript compiles without errors in new files
- [x] PersonGrouper exports from smart-profile/index.ts
- [x] Wizard shows grouping step when appropriate

## Next Plan Readiness

- Plan 02-02 complete - PersonGrouper UI ready
- Plan 02-03 will implement ConfidenceReview component (partially done)
- All drag-drop infrastructure in place for future enhancements

---

_Phase: 02-intelligence_
_Plan: 02_
_Completed: 2026-01-15_
