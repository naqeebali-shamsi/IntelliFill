# Plan 03-01 Summary: FormSuggester

**Phase:** 03-polish
**Status:** Complete
**Duration:** ~12 min

## What Was Built

Smart form suggestion based on uploaded documents. Users upload documents, and IntelliFill suggests which forms they can complete based on the document types detected.

### Task 1: Form Mapping Utilities (9860d04)

Extended `form-fields.ts` with:

- `DOCUMENT_TO_FORM_MAPPING` - maps document types to forms they help complete
- `FormSuggestion` type - includes formId, confidence, matched/missing docs
- `suggestForms()` function - scores forms by field coverage from uploaded docs
- `getDocumentsForForm()` - helper to find docs needed for a form
- 22 unit tests covering all form suggestion functionality

### Task 2: FormSuggester UI Components (b4cd6e7)

Created `FormSuggester/` directory with:

**FormCard.tsx:**

- Form name with icon
- Confidence badge matching existing UI pattern
- Matched documents count with green badges
- Missing documents warning for incomplete coverage
- Selected state with checkmark indicator

**index.tsx (FormSuggester):**

- Uses `suggestForms()` to get ranked suggestions
- Staggered animation using existing `staggerContainer` variant
- Empty states for no documents or no matching forms
- Header showing high-coverage form count
- Select prompt when no form selected

### Task 3: Wizard Integration (ddaa1dd)

- Exported FormSuggester from `smart-profile/index.ts`
- Replaced form-select step placeholder with working FormSuggester
- Converts internal doc types (PASSPORT) to display names (Passport)
- Wires `selectForm` action from store to FormSuggester
- Profile step MissingFieldsAlert uses selected form ID

## Files Changed

```
quikadmin-web/src/lib/form-fields.ts               # Extended with mapping/suggestion logic
quikadmin-web/src/lib/__tests__/form-fields.test.ts # 22 new unit tests
quikadmin-web/src/components/smart-profile/FormSuggester/FormCard.tsx    # New
quikadmin-web/src/components/smart-profile/FormSuggester/index.tsx       # New
quikadmin-web/src/components/smart-profile/index.ts # Export FormSuggester
quikadmin-web/src/pages/SmartProfile.tsx           # Integrate FormSuggester
```

## Decisions Made

- Form confidence calculated as ratio of coverable fields to total required
- Only forms with at least one matching document are suggested
- Suggestions sorted by confidence descending, then by form ID for stability
- Document type conversion happens at wizard level (PASSPORT -> Passport)
- Store already had `selectedFormId` and `selectForm` action (no changes needed)

## Verification

- [x] `bun run build` succeeds
- [x] FormSuggester shows ranked forms based on uploaded documents
- [x] Selecting a form updates MissingFieldsAlert via store
- [x] Forms with higher coverage ranked first
- [x] 22 unit tests pass

## Commits

| Hash      | Description                               |
| --------- | ----------------------------------------- |
| `9860d04` | Add form mapping utilities to form-fields |
| `b4cd6e7` | Build FormSuggester UI components         |
| `ddaa1dd` | Integrate FormSuggester into wizard       |
