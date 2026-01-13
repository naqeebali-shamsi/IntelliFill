# Phase 1: Smart Profile UX Simplification - Research

**Researched:** 2026-01-13
**Domain:** Document Upload UX, OCR Confidence Display, Progressive Disclosure, Multi-Step Wizards
**Confidence:** HIGH

---

## Summary

Researched UX patterns and libraries for simplifying IntelliFill's document upload → OCR extraction → profile → form filling flow into a streamlined "Upload → See → Fill" experience.

The standard approach combines:

- **react-dropzone** for file uploads with validation
- **Framer Motion** for micro-interactions and transitions
- **Zustand** for multi-step form state management
- **Progressive disclosure** patterns for reducing cognitive load
- **Confidence visualization** patterns for AI/ML predictions

**Primary recommendation:** Use a wizard-style flow with auto-skip for happy paths. Show confidence only when action is needed. Let ML handle document type detection with user confirmation only when uncertain.

---

## Standard Stack

### Core Libraries

| Library        | Version | Purpose                  | Why Standard                                         |
| -------------- | ------- | ------------------------ | ---------------------------------------------------- |
| react-dropzone | 14.x    | Drag-drop file uploads   | De facto standard, hooks-based, excellent validation |
| framer-motion  | 11.x    | Animations & transitions | Best React animation library, layout animations      |
| zustand        | 5.x     | State management         | Already in stack, persist middleware for save/resume |
| sonner         | 1.x     | Toast notifications      | Already in stack, excellent for undo flows           |

### Supporting Libraries

| Library                      | Version | Purpose              | When to Use                  |
| ---------------------------- | ------- | -------------------- | ---------------------------- |
| @radix-ui/react-progress     | latest  | Progress indicators  | Processing status display    |
| @radix-ui/react-alert-dialog | latest  | Confirmation dialogs | Person grouping confirmation |
| lucide-react                 | latest  | Icons                | Already in stack             |
| clsx/tailwind-merge          | latest  | Conditional classes  | Dynamic confidence styling   |

### Already In Stack (Leverage)

- TailwindCSS 4.0 - Styling with semantic tokens
- Radix UI primitives - Accessible components
- React Hook Form + Zod - Form validation
- @tanstack/react-query - Server state

**Installation:**

```bash
# Already have most - just ensure latest react-dropzone
bun add react-dropzone@latest
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── smart-profile/           # New Smart Profile feature
│   │   ├── upload-zone.tsx      # Drag-drop with auto-detect
│   │   ├── person-grouper.tsx   # Multi-person grouping UI
│   │   ├── confidence-review.tsx # Low-confidence field review
│   │   ├── profile-view.tsx     # Unified profile display
│   │   ├── form-suggester.tsx   # Smart form suggestions
│   │   └── index.tsx            # Smart Profile wizard orchestrator
│   └── ui/
│       ├── confidence-badge.tsx # Reusable confidence indicator
│       └── field-source.tsx     # Field source indicator
├── stores/
│   └── smart-profile-store.ts   # Wizard state with persistence
├── hooks/
│   └── use-document-detection.ts # Auto-detection logic
└── lib/
    └── confidence-utils.ts      # Confidence thresholds & colors
```

### Pattern 1: Wizard State Machine

**What:** Use Zustand with persist middleware for multi-step wizard state
**When to use:** Any multi-step flow that may be interrupted

```typescript
// Source: Zustand docs + best practices
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface SmartProfileState {
  step: 'upload' | 'grouping' | 'review' | 'profile' | 'form-select';
  uploadedFiles: UploadedFile[];
  detectedPeople: DetectedPerson[];
  lowConfidenceFields: LowConfidenceField[];
  profileData: Record<string, any>;
  selectedFormId: string | null;

  // Actions
  setStep: (step: SmartProfileState['step']) => void;
  addFiles: (files: File[]) => void;
  confirmGrouping: (groups: PersonGroup[]) => void;
  confirmFields: (fields: Record<string, any>) => void;
  selectForm: (formId: string) => void;
  reset: () => void;
}

export const useSmartProfileStore = create<SmartProfileState>()(
  persist(
    immer((set) => ({
      step: 'upload',
      uploadedFiles: [],
      detectedPeople: [],
      lowConfidenceFields: [],
      profileData: {},
      selectedFormId: null,

      setStep: (step) => set({ step }),
      addFiles: (files) =>
        set((state) => {
          state.uploadedFiles.push(...files.map((f) => ({ file: f, status: 'pending' })));
        }),
      // ... other actions
      reset: () => set({ step: 'upload', uploadedFiles: [] /* ... */ }),
    })),
    { name: 'smart-profile-wizard' }
  )
);
```

### Pattern 2: Progressive Disclosure with Auto-Skip

**What:** Skip steps that don't need user input
**When to use:** When ML confidence is high enough

```typescript
// After OCR completes, check if steps can be skipped
async function processUploadedFiles(files: File[]) {
  const results = await extractDocuments(files);

  // Step 1: Person Grouping
  const detectedPeople = groupByPerson(results);
  if (detectedPeople.length === 1) {
    // Auto-skip grouping step for single person
    store.setStep('review');
  } else {
    store.setStep('grouping');
  }

  // Step 2: Confidence Review
  const lowConfidence = results.filter((r) => r.confidence < 0.85);
  if (lowConfidence.length === 0) {
    // Auto-skip review step if all fields high confidence
    store.setStep('profile');
  }
}
```

### Pattern 3: Confidence Visualization

**What:** Color-coded confidence with action triggers
**When to use:** Any AI/ML prediction shown to users

```typescript
// Source: AI UX Design Patterns research
const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85, // Green - No action needed
  MEDIUM: 0.6, // Yellow - Optional review
  LOW: 0.6, // Red - Requires user action
};

function getConfidenceDisplay(confidence: number) {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return { color: 'text-status-success', label: 'Verified', action: 'none' };
  }
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return { color: 'text-status-warning', label: 'Review suggested', action: 'optional' };
  }
  return { color: 'text-status-error', label: 'Please verify', action: 'required' };
}
```

### Anti-Patterns to Avoid

- **Showing raw confidence percentages:** Users don't understand "82%". Use labels like "High confidence" or "Please verify"
- **Requiring confirmation for high-confidence fields:** Only ask when uncertain - this is the core of progressive disclosure
- **Linear wizard without skip logic:** The flow should adapt based on ML confidence and data
- **Hiding all complexity:** Power users (PRO agents) need access to full client list, search, etc.

---

## Don't Hand-Roll

| Problem                | Don't Build           | Use Instead                              | Why                                                     |
| ---------------------- | --------------------- | ---------------------------------------- | ------------------------------------------------------- |
| File drag-drop         | Custom drag events    | react-dropzone                           | MIME validation, multiple files, accessibility baked in |
| Step transitions       | CSS transitions       | Framer Motion AnimatePresence            | Exit animations, layout animations, gesture support     |
| Form state persistence | localStorage directly | Zustand persist middleware               | Hydration handling, versioning, migration support       |
| Confidence colors      | Hardcoded Tailwind    | Semantic tokens (--status-success, etc.) | Theme consistency, dark mode support                    |
| Undo functionality     | Custom history stack  | Sonner toast with action                 | Standard pattern, accessibility, auto-dismiss           |

**Key insight:** Document upload UX has 10+ years of solved problems. react-dropzone handles file validation, MIME types, drag state, and accessibility. Rolling your own leads to subtle bugs with file type detection and accessibility.

---

## Common Pitfalls

### Pitfall 1: Overwhelming Users with Confidence Data

**What goes wrong:** Showing confidence scores on every field creates cognitive overload
**Why it happens:** Engineers want transparency, users want simplicity
**How to avoid:** Only surface confidence when action is needed (< 85%). High-confidence fields just show checkmarks.
**Warning signs:** Users not engaging with confidence indicators, skipping review entirely

### Pitfall 2: Breaking PRO Agent Workflows

**What goes wrong:** Simplified flow doesn't support batch processing of families/companies
**Why it happens:** Optimizing for first-time experience, ignoring repeat users
**How to avoid:** Add person grouping step that detects multiple entities. Provide "Add another person" after completion.
**Warning signs:** PRO agents creating duplicate profiles, searching for existing clients

### Pitfall 3: Auto-Skip Confusion

**What goes wrong:** Users don't understand why some steps were skipped
**Why it happens:** Silent auto-skip with no feedback
**How to avoid:** Show brief notification: "All fields verified automatically" when skipping review step
**Warning signs:** Users looking for review step, not trusting auto-filled data

### Pitfall 4: Merge Conflicts Not Surfaced

**What goes wrong:** Mohamed vs Mohammed silently picked, user finds wrong data later
**Why it happens:** Auto-merge without conflict detection
**How to avoid:** Detect name/date discrepancies between documents, surface as explicit choice
**Warning signs:** Users editing fields that were "auto-filled", support tickets about wrong data

### Pitfall 5: No Save & Resume

**What goes wrong:** User loses progress if interrupted during multi-file upload
**Why it happens:** Wizard state not persisted
**How to avoid:** Use Zustand persist middleware, show "Resume previous session?" on return
**Warning signs:** Repeat uploads of same documents, abandoned wizard sessions

---

## Code Examples

### Drag-Drop Upload Zone with Auto-Detection

```typescript
// Source: react-dropzone docs + IntelliFill patterns
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'

export function SmartUploadZone({ onFilesReady }: Props) {
  const [files, setFiles] = useState<UploadedFile[]>([])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    onDrop: async (acceptedFiles) => {
      const newFiles = acceptedFiles.map(file => ({
        file,
        id: crypto.randomUUID(),
        status: 'uploading' as const,
        detectedType: null,
      }))
      setFiles(prev => [...prev, ...newFiles])

      // Auto-detect document types
      for (const f of newFiles) {
        const detected = await detectDocumentType(f.file)
        setFiles(prev => prev.map(p =>
          p.id === f.id ? { ...p, status: 'ready', detectedType: detected } : p
        ))
      }
    }
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
        isDragActive && 'border-primary bg-primary/5',
        isDragReject && 'border-status-error bg-status-error/5'
      )}
    >
      <input {...getInputProps()} />
      <p>Drop documents here - Passport, Emirates ID, License...</p>
      <p className="text-sm text-muted-foreground">We'll figure out what they are</p>

      <AnimatePresence>
        {files.map(f => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <FileCard file={f} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
```

### Confidence Badge Component

```typescript
// Source: AI UX Design Patterns research
interface ConfidenceBadgeProps {
  confidence: number
  showLabel?: boolean
}

export function ConfidenceBadge({ confidence, showLabel = true }: ConfidenceBadgeProps) {
  const display = getConfidenceDisplay(confidence)

  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs',
      display.color
    )}>
      {confidence >= 0.85 ? (
        <CheckCircle className="h-3 w-3" />
      ) : confidence >= 0.60 ? (
        <AlertCircle className="h-3 w-3" />
      ) : (
        <XCircle className="h-3 w-3" />
      )}
      {showLabel && <span>{display.label}</span>}
    </span>
  )
}
```

### Person Grouping UI

```typescript
// Source: Bulk action UX patterns
interface PersonGrouperProps {
  documents: DetectedDocument[]
  onConfirm: (groups: PersonGroup[]) => void
}

export function PersonGrouper({ documents, onConfirm }: PersonGrouperProps) {
  const [groups, setGroups] = useState<PersonGroup[]>(() =>
    autoGroupByIdentifiers(documents)
  )

  return (
    <div className="space-y-4">
      <h3>We found {groups.length} people in your documents</h3>
      <p className="text-muted-foreground">
        Drag documents between groups if needed
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map(group => (
          <div key={group.id} className="border rounded-lg p-4">
            <h4 className="font-medium">{group.suggestedName || 'Unknown'}</h4>
            <ul className="mt-2 space-y-1">
              {group.documents.map(doc => (
                <li key={doc.id} className="text-sm flex items-center gap-2">
                  <FileIcon type={doc.type} />
                  {doc.fileName}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setGroups([mergeAll(groups)])}>
          These are all one person
        </Button>
        <Button onClick={() => onConfirm(groups)}>
          Confirm Grouping
        </Button>
      </div>
    </div>
  )
}
```

---

## State of the Art (2025-2026)

| Old Approach                   | Current Approach                    | When Changed | Impact                             |
| ------------------------------ | ----------------------------------- | ------------ | ---------------------------------- |
| Show raw confidence %          | Semantic labels (High/Low)          | 2024         | Reduces confusion, increases trust |
| Linear wizard forms            | Adaptive flow with auto-skip        | 2024         | Faster happy path, less friction   |
| Manual document categorization | AI auto-detection with confirmation | 2024-2025    | Removes cognitive burden           |
| Single-entity assumption       | Multi-person detection              | 2024         | Supports real B2B workflows        |
| Toast-only feedback            | Toast with undo action              | 2024         | Better error recovery              |

**New tools/patterns to consider:**

- **Framer Motion layout animations:** Smooth reordering when grouping documents
- **Optimistic UI updates:** Show profile immediately, sync in background
- **LLM-based document detection:** Beyond OCR patterns, use LLM to classify document type

**Deprecated/outdated:**

- **Showing percentage confidence:** Users prefer labels
- **Modal-heavy wizards:** Inline progressive disclosure preferred
- **Forcing account creation before value:** Let users upload first

---

## Open Questions

1. **Threshold for auto-skip**
   - What we know: 85% is common for high confidence
   - What's unclear: Whether IntelliFill's OCR calibration matches industry standards
   - Recommendation: Start conservative (90%), tune based on user corrections

2. **Person detection algorithm**
   - What we know: Can match by ID numbers, names, faces
   - What's unclear: Accuracy of cross-document entity matching
   - Recommendation: Default to separate profiles, let user merge rather than split

3. **PRO agent workflow coexistence**
   - What we know: Need client list, search, repeat workflows
   - What's unclear: Whether single entry point works for both B2C and B2B
   - Recommendation: Single upload flow, but add "Clients" navigation for logged-in PRO users

---

## Sources

### Primary (HIGH confidence)

- /react-dropzone/react-dropzone - File upload hooks, validation, accessibility
- /websites/motion-dev-docs - Animation patterns, stagger, layout
- /pmndrs/zustand - State management, persist middleware

### Secondary (MEDIUM confidence)

- [NN/Group Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) - Pattern definition
- [Confidence Visualization UI Patterns](https://agentic-design.ai/patterns/ui-ux-patterns/confidence-visualization-patterns) - AI UX patterns
- [Multi-Step Form Best Practices](https://www.webstacks.com/blog/multi-step-form) - Wizard design
- [Bulk Actions UX](https://www.eleken.co/blog-posts/bulk-actions-ux) - Grouping patterns

### Tertiary (LOW confidence - needs validation)

- LLM-based document detection - Emerging pattern, needs prototyping

---

## Metadata

**Research scope:**

- Core technology: React + Zustand + Framer Motion
- Ecosystem: react-dropzone, Radix UI, TailwindCSS
- Patterns: Progressive disclosure, wizard, confidence visualization
- Pitfalls: Cognitive overload, PRO workflow, auto-skip confusion

**Confidence breakdown:**

- Standard stack: HIGH - Already using most libraries
- Architecture: HIGH - Patterns well-documented
- Pitfalls: HIGH - From UX panel discussion + research
- Code examples: HIGH - From Context7 + official docs

**Research date:** 2026-01-13
**Valid until:** 2026-02-13 (30 days - patterns stable)

---

_Phase: 01-smart-profile-ux_
_Research completed: 2026-01-13_
_Ready for planning: yes_
