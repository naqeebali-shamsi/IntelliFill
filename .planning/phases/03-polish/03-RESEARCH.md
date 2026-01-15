# Phase 3: Polish - Research

**Researched:** 2026-01-16
**Domain:** React wizard UX polish (animations, form suggestion, user preferences)
**Confidence:** HIGH

<research_summary>

## Summary

Researched the React ecosystem for polishing a multi-step wizard with animations, smart form suggestions, and user mode preferences. This is a commodity domain - the standard patterns are well-established and the project already has Framer Motion v12.23.25 installed.

Key findings:

1. **Framer Motion** (now "Motion" from the same creators) is already installed and partially implemented in SmartProfile.tsx with basic AnimatePresence transitions
2. **Form suggestion** can use simple rule-based matching (document types → form types) - no ML needed for MVP
3. **Assisted vs Express mode** is a standard user preference pattern stored in Zustand/localStorage
4. **Performance** - React 19 compiler auto-memoizes, but third-party libs (like @dnd-kit) still need manual useMemo/useCallback

**Primary recommendation:** Enhance existing Framer Motion usage with variants for consistent animations, add rule-based FormSuggester, implement mode toggle with Zustand persist. No new dependencies needed.
</research_summary>

<standard_stack>

## Standard Stack

### Core (Already Installed)

| Library       | Version  | Purpose             | Why Standard                                               |
| ------------- | -------- | ------------------- | ---------------------------------------------------------- |
| framer-motion | 12.23.25 | Animations          | De facto React animation library, already in use           |
| zustand       | 5.0.9    | State management    | Already used for wizard state, supports persist middleware |
| sonner        | 2.0.7    | Toast notifications | Already in use for user feedback                           |

### Supporting (Already Installed)

| Library                  | Version  | Purpose         | When to Use                         |
| ------------------------ | -------- | --------------- | ----------------------------------- |
| @dnd-kit/\*              | 6.x/10.x | Drag-drop       | Already used in PersonGrouper       |
| lucide-react             | 0.537.0  | Icons           | Already used throughout UI          |
| class-variance-authority | 0.7.1    | Variant styling | Already used for component variants |

### No New Dependencies Needed

Phase 3 can be completed with existing dependencies. The project already has everything needed:

- Animations: framer-motion
- State: zustand with immer
- UI: Radix UI primitives
- Styling: TailwindCSS 4.0

**Installation:**

```bash
# No new installations needed
# All dependencies already present in quikadmin-web/package.json
```

</standard_stack>

<architecture_patterns>

## Architecture Patterns

### Recommended Project Structure

```
src/components/smart-profile/
├── FormSuggester/
│   ├── index.tsx           # Main component
│   ├── FormCard.tsx        # Individual form suggestion card
│   └── form-mappings.ts    # Document type → form type rules
├── ModeToggle/
│   └── index.tsx           # Assisted/Express mode switch
└── animations/
    └── wizard-variants.ts  # Shared animation variants
```

### Pattern 1: Centralized Animation Variants

**What:** Define all wizard animation variants in one place for consistency
**When to use:** Multi-step wizards with consistent transitions
**Example:**

```typescript
// src/components/smart-profile/animations/wizard-variants.ts
import type { Variants } from 'framer-motion';

export const stepVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 100 : -100,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 100 : -100,
    opacity: 0,
  }),
};

export const stepTransition = {
  x: { type: 'spring', stiffness: 300, damping: 30 },
  opacity: { duration: 0.2 },
};
```

### Pattern 2: Rule-Based Form Suggestion

**What:** Simple mapping from detected document types to suggested forms
**When to use:** When document-to-form relationship is deterministic
**Example:**

```typescript
// src/lib/form-mappings.ts
export const documentToFormMapping: Record<string, string[]> = {
  PASSPORT: ['visa-application', 'travel-permit'],
  EMIRATES_ID: ['visa-application', 'residency-permit'],
  BANK_STATEMENT: ['visa-application', 'loan-application'],
  // ...
};

export function suggestForms(documentTypes: string[]): FormSuggestion[] {
  const formScores = new Map<string, number>();

  for (const docType of documentTypes) {
    const forms = documentToFormMapping[docType] || [];
    for (const form of forms) {
      formScores.set(form, (formScores.get(form) || 0) + 1);
    }
  }

  return Array.from(formScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([formId, score]) => ({
      formId,
      confidence: score / documentTypes.length,
      matchedDocuments: score,
    }));
}
```

### Pattern 3: User Mode Preference with Zustand Persist

**What:** Store user preference (Assisted vs Express) in localStorage via Zustand
**When to use:** User preferences that should persist across sessions
**Example:**

```typescript
// src/stores/userPreferencesStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type WizardMode = 'assisted' | 'express';

interface UserPreferencesState {
  wizardMode: WizardMode;
  setWizardMode: (mode: WizardMode) => void;
}

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set) => ({
      wizardMode: 'assisted', // Default to assisted for new users
      setWizardMode: (mode) => set({ wizardMode: mode }),
    }),
    {
      name: 'user-preferences',
    }
  )
);
```

### Pattern 4: Reduced Motion Accessibility

**What:** Respect user's reduced motion preference
**When to use:** Always - required for accessibility
**Example:**

```typescript
// In wizard component
import { useReducedMotion } from 'framer-motion';

function WizardStep({ children, direction }: Props) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      custom={direction}
      variants={shouldReduceMotion ? fadeVariants : stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={shouldReduceMotion ? { duration: 0.15 } : stepTransition}
    >
      {children}
    </motion.div>
  );
}
```

### Anti-Patterns to Avoid

- **Over-animating:** Don't animate every element; focus on meaningful transitions
- **Inline animation objects:** Creates new objects each render, hurting performance
- **Ignoring reduced motion:** Always check `useReducedMotion` for accessibility
- **Complex ML for form suggestion:** Rule-based is sufficient for MVP
  </architecture_patterns>

<dont_hand_roll>

## Don't Hand-Roll

| Problem             | Don't Build            | Use Instead                | Why                                               |
| ------------------- | ---------------------- | -------------------------- | ------------------------------------------------- |
| Animation library   | Custom CSS transitions | framer-motion (installed)  | Handles AnimatePresence, variants, spring physics |
| Toast notifications | Custom toast system    | sonner (installed)         | Already integrated, handles positioning/stacking  |
| Drag-drop           | Custom drag handlers   | @dnd-kit (installed)       | Accessibility, keyboard support, sensors          |
| Form suggestion ML  | Complex ML model       | Simple rule-based mapping  | Deterministic relationship, no training data      |
| User preferences    | Custom localStorage    | Zustand persist middleware | Already using Zustand, persist is built-in        |

**Key insight:** Phase 3 is about polishing existing functionality, not adding new infrastructure. The existing stack (Framer Motion, Zustand, Radix UI) provides everything needed. Focus on using these tools effectively rather than introducing new dependencies.
</dont_hand_roll>

<common_pitfalls>

## Common Pitfalls

### Pitfall 1: Animation Performance on Low-End Devices

**What goes wrong:** Janky animations, especially on mobile
**Why it happens:** Animating properties that trigger layout (width, height, top/left)
**How to avoid:** Stick to transform and opacity - they're GPU-accelerated
**Warning signs:** Choppy animations, high CPU usage during transitions

### Pitfall 2: AnimatePresence Key Conflicts

**What goes wrong:** Exit animations don't play, elements flash
**Why it happens:** Missing or duplicate keys on AnimatePresence children
**How to avoid:** Always use unique keys on direct children of AnimatePresence
**Warning signs:** Elements disappearing without exit animation

### Pitfall 3: Unnecessary Re-renders with Zustand

**What goes wrong:** Entire wizard re-renders on any state change
**Why it happens:** Selecting whole store instead of specific slices
**How to avoid:** Use selector functions: `useStore(state => state.specificField)`
**Warning signs:** React DevTools shows excessive renders

### Pitfall 4: Mode Toggle Breaking Mid-Flow

**What goes wrong:** Changing Assisted/Express mode mid-wizard causes confusion
**Why it happens:** Mode affects step visibility, changing mid-flow skips steps unexpectedly
**How to avoid:** Only allow mode change at wizard start or in settings
**Warning signs:** Users reporting "skipped steps" or "missing data"

### Pitfall 5: Ignoring Reduced Motion

**What goes wrong:** Users with vestibular disorders experience discomfort
**Why it happens:** Forgetting to check prefers-reduced-motion
**How to avoid:** Always use `useReducedMotion` hook, replace transforms with opacity
**Warning signs:** Accessibility audit failures, user complaints
</common_pitfalls>

<code_examples>

## Code Examples

Verified patterns from official sources and existing codebase:

### AnimatePresence with Direction-Aware Transitions

```typescript
// Source: motion.dev docs + existing SmartProfile.tsx pattern
import { motion, AnimatePresence } from 'framer-motion';

const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 50 : -50,
    opacity: 0,
  }),
};

function WizardContent({ step, direction }: Props) {
  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={step}
        custom={direction}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.2, ease: 'easeInOut' }}
      >
        {renderStep(step)}
      </motion.div>
    </AnimatePresence>
  );
}
```

### Staggered List Animation

```typescript
// Source: motion.dev docs + existing animations.ts
import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp } from '@/lib/animations';

function FormSuggestionList({ suggestions }: Props) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {suggestions.map((form) => (
        <motion.div key={form.id} variants={fadeInUp}>
          <FormCard form={form} />
        </motion.div>
      ))}
    </motion.div>
  );
}
```

### Mode Toggle with Zustand Persist

```typescript
// Source: Zustand docs pattern
import { Switch } from '@/components/ui/switch';
import { useUserPreferencesStore } from '@/stores/userPreferencesStore';

function ModeToggle() {
  const wizardMode = useUserPreferencesStore(s => s.wizardMode);
  const setWizardMode = useUserPreferencesStore(s => s.setWizardMode);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Assisted</span>
      <Switch
        checked={wizardMode === 'express'}
        onCheckedChange={(checked) =>
          setWizardMode(checked ? 'express' : 'assisted')
        }
      />
      <span className="text-sm text-muted-foreground">Express</span>
    </div>
  );
}
```

### Performance-Optimized Selector

```typescript
// Source: React docs + Zustand best practices
// BAD - subscribes to entire store
const store = useSmartProfileStore();
const files = store.uploadedFiles;

// GOOD - subscribes only to uploadedFiles
const files = useSmartProfileStore((state) => state.uploadedFiles);

// GOOD - memoized derived data
const detectedFiles = useSmartProfileStore((state) =>
  state.uploadedFiles.filter((f) => f.status === 'detected')
);
```

</code_examples>

<sota_updates>

## State of the Art (2025-2026)

| Old Approach               | Current Approach          | When Changed | Impact                                       |
| -------------------------- | ------------------------- | ------------ | -------------------------------------------- |
| framer-motion              | motion (same API)         | 2025 rebrand | Import from "framer-motion" still works      |
| Manual useMemo/useCallback | React 19 auto-memoization | 2025         | Manual memoization still needed for @dnd-kit |
| Complex ML form suggestion | Rule-based for MVP        | N/A          | ML only needed at scale with training data   |

**New tools/patterns to consider:**

- **React 19 Compiler:** Auto-memoizes, but not yet stable - keep manual memoization for now
- **View Transitions API:** Browser-native page transitions, but limited React support
- **Motion v12:** Latest version already installed, uses spring physics by default

**Deprecated/outdated:**

- **react-spring:** Framer Motion has become the dominant choice
- **CSS-only transitions:** AnimatePresence handles mount/unmount animations better
  </sota_updates>

<open_questions>

## Open Questions

Things that couldn't be fully resolved:

1. **Form catalog structure**
   - What we know: FormSuggester needs to suggest from available forms
   - What's unclear: Current form storage/catalog structure in database
   - Recommendation: Check existing form/template endpoints during planning

2. **Express mode step skipping threshold**
   - What we know: Express mode should auto-skip more aggressively
   - What's unclear: Exact confidence threshold for auto-skipping review step
   - Recommendation: Start with 90% (vs 85% in assisted), tune based on user feedback

3. **Performance baseline**
   - What we know: PRD targets <3s detection, <10s extraction
   - What's unclear: Current actual performance metrics
   - Recommendation: Add performance logging before optimization work
     </open_questions>

<sources>
## Sources

### Primary (HIGH confidence)

- /websites/motion-dev-docs - AnimatePresence, variants, accessibility, performance
- /websites/react_dev_reference - useMemo, useCallback, memo patterns
- Existing codebase: quikadmin-web/src/lib/animations.ts, src/pages/SmartProfile.tsx

### Secondary (MEDIUM confidence)

- [Framer Motion Recipes - Multistep Wizard](https://buildui.com/courses/framer-motion-recipes/multistep-wizard) - wizard transition patterns
- [React Performance Optimization 2025](https://www.growin.com/blog/react-performance-optimization-2025/) - memoization best practices
- [DebugBear - Preventing Re-renders](https://www.debugbear.com/blog/react-rerenders) - re-render optimization

### Tertiary (LOW confidence - needs validation)

- None - all findings verified against official docs or existing codebase
  </sources>

<metadata>
## Metadata

**Research scope:**

- Core technology: Framer Motion (React animation)
- Ecosystem: Zustand persist, rule-based form matching
- Patterns: Wizard transitions, user preferences, accessibility
- Pitfalls: Animation performance, mode toggle timing, re-renders

**Confidence breakdown:**

- Standard stack: HIGH - all libraries already installed and in use
- Architecture: HIGH - patterns verified in existing codebase
- Pitfalls: HIGH - documented in official Motion docs
- Code examples: HIGH - from Context7/official sources + existing code

**Research date:** 2026-01-16
**Valid until:** 2026-02-16 (30 days - stable ecosystem, no major changes expected)
</metadata>

---

_Phase: 03-polish_
_Research completed: 2026-01-16_
_Ready for planning: yes_
