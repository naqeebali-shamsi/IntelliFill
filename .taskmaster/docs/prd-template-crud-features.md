# PRD: Template CRUD Features Enhancement

**Version:** 1.0
**Author:** Claude Code Agent
**Date:** 2026-01-09
**Status:** Draft

---

## Executive Summary

### Problem Statement
The current Template Management system in IntelliFill has significant gaps between what the E2E tests expect and what the UI implements. While the backend API provides full CRUD functionality for templates (9 endpoints), the frontend Templates.tsx page lacks critical features including Edit, Duplicate, and field management capabilities. This causes all E2E-427 template CRUD tests to fail.

### Solution Overview
Implement a comprehensive Template Editor component with full CRUD operations, field management UI (add/remove/reorder fields, type selection), and proper data-testid attributes for E2E test compatibility.

### Business Impact
- **E2E Test Coverage:** Enable 11 E2E-427 tests to pass (currently 0 passing)
- **User Productivity:** Allow users to efficiently manage form templates with visual field editing
- **Feature Completeness:** Fulfill the template management functionality promised in marketing materials

### Resource Requirements
- **Engineering:** 2-3 sprint days for frontend implementation
- **Backend:** 0.5 sprint day for duplicate endpoint
- **QA:** 1 sprint day for E2E test verification

### Risk Assessment
- **Low Risk:** Backend APIs are already implemented and tested
- **Medium Risk:** UI component complexity for field reordering (drag-and-drop)
- **Low Risk:** Backward compatibility (additive changes only)

---

## Product Overview

### Product Vision
A complete, intuitive template management system that allows users to create, edit, duplicate, and delete form field mapping templates with a visual field editor supporting multiple field types.

### Target Users
- **Primary:** IntelliFill power users who frequently fill similar forms
- **Secondary:** Organization administrators managing shared templates
- **Tertiary:** Marketplace contributors sharing public templates

### Value Proposition
Enable users to efficiently create and manage reusable form templates with a visual field editor, reducing manual data entry time by 80% for recurring form types.

### Success Criteria
1. All 11 E2E-427 Template CRUD tests pass
2. Template creation time reduced by 50% vs current workflow
3. Field management operations complete in < 500ms
4. Zero regression in existing template functionality

### Assumptions
1. Users understand the concept of field mapping (source -> target)
2. Backend TemplateService encryption/decryption remains unchanged
3. React Query caching strategy continues to work with mutations

---

## Gap Analysis: Current State vs. E2E Expectations

### Backend Capabilities (COMPLETE)

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/templates` | Implemented | Lists user's templates |
| `GET /api/templates/public` | Implemented | Marketplace templates |
| `GET /api/templates/:id` | Implemented | Template details with decrypted fields |
| `POST /api/templates` | Implemented | Create with fieldMappings array |
| `PUT /api/templates/:id` | Implemented | Update name, description, formType, fieldMappings |
| `DELETE /api/templates/:id` | Implemented | Soft delete (isActive=false) |
| `POST /api/templates/detect` | Implemented | Detect form type from field names |
| `POST /api/templates/match` | Implemented | Find matching templates |
| `POST /api/templates/:id/use` | Implemented | Increment usage count |
| `POST /api/templates/:id/duplicate` | **MISSING** | Needs implementation |

### Frontend Capabilities

| Feature | E2E Expects | Current Status | Gap |
|---------|-------------|----------------|-----|
| Create template | Yes | Partial | Missing field management |
| Template name input | `input[name="name"]` | `input#t-name` (no `name` attr) | Input uses `id` not `name` |
| Add Field button | Yes | No | Not implemented |
| Field name input | `input[name="fieldName"]` | No | Not implemented |
| Field type select | `select[name="fieldType"]` | No | Not implemented |
| Edit button on card | Yes | No | Not implemented |
| Duplicate button | Yes | No | Not implemented |
| Delete with confirm | Yes | Yes | Working |
| Reorder fields (up/down) | Yes | No | Not implemented |
| Remove field button | Yes | No | Not implemented |
| Template editor panel | `[data-testid="template-editor"]` | No | Not implemented |
| Template cards | `[data-testid="template-row"]` | `.template-card` class only | Missing data-testid |
| Save button | `button:has-text("Save")` | Yes | Working |
| Validation errors | `[role="alert"]` | No | Not implemented |

### E2E Test File Analysis: `template-crud.spec.ts`

The test file expects these specific selectors:
```typescript
// Template list
'[data-testid="template-row"]' or '.template-card'

// Create flow
'button:has-text("Create")' or 'button:has-text("New Template")'
'input[name="name"]' // Template name
'button:has-text("Add Field")'
'input[name="fieldName"]'
'select[name="fieldType"]'
'button:has-text("Save")'

// Edit flow
'button:has-text("Edit")' or '[aria-label="Edit"]'

// Duplicate flow
'button:has-text("Duplicate")' or 'button:has-text("Copy")'

// Delete flow
'button:has-text("Delete")' or '[aria-label="Delete"]'
'button:has-text("Confirm")'

// Reorder fields
'button[aria-label*="Move up"]' or 'button:has-text("Up")'
'button[aria-label*="Move down"]' or 'button:has-text("Down")'

// Remove field
'button:has-text("Remove")' or 'button[aria-label*="Remove"]'

// Validation
'[role="alert"]' or '.error-message' or '[aria-invalid="true"]'
```

---

## Functional Requirements

### FR-1: Template Card Actions

**Description:** Add Edit and Duplicate buttons to each template card.

**User Stories:**

**US-1.1: Edit Template**
> As a user, I want to click an Edit button on a template card so that I can modify the template's name, description, form type, and fields.

**Acceptance Criteria:**
- Given I am on the Templates page
- And I have at least one template
- When I click the "Edit" button on a template card
- Then a Template Editor panel opens
- And the template's current values are pre-filled
- And I can modify all fields

**US-1.2: Duplicate Template**
> As a user, I want to click a Duplicate button on a template card so that I can create a copy of an existing template for modification.

**Acceptance Criteria:**
- Given I am on the Templates page
- And I have at least one template
- When I click the "Duplicate" button on a template card
- Then a new template is created with name "[Original Name] (Copy)"
- And the duplicate appears in the template list
- And a success toast is displayed

### FR-2: Template Editor Component

**Description:** Create a comprehensive Template Editor with field management capabilities.

**User Stories:**

**US-2.1: Template Editor Panel**
> As a user, I want a dedicated template editor panel so that I can manage all aspects of a template in one place.

**Acceptance Criteria:**
- Given I click Create New Template or Edit on an existing template
- Then a Template Editor panel is displayed
- And it includes:
  - Template name input (`name="name"`)
  - Form type selector
  - Description textarea
  - Fields section with Add Field button
  - Save and Cancel buttons
- And it has `data-testid="template-editor"` attribute

**US-2.2: Add Field to Template**
> As a user, I want to add fields to my template so that I can define what data the template captures.

**Acceptance Criteria:**
- Given I am in the Template Editor
- When I click "Add Field"
- Then a new field row appears with:
  - Field name input (`name="fieldName"`)
  - Field label input (`name="fieldLabel"`)
  - Field type selector (`name="fieldType"`)
  - Required checkbox
  - Remove button
- And the field type selector includes: text, number, date, select

**US-2.3: Remove Field from Template**
> As a user, I want to remove a field from my template so that I can correct mistakes or simplify the template.

**Acceptance Criteria:**
- Given I am in the Template Editor
- And I have at least one field
- When I click the Remove button on a field row
- Then the field is removed from the list
- And the remaining fields maintain their order

**US-2.4: Reorder Fields**
> As a user, I want to reorder fields in my template so that they appear in the desired sequence.

**Acceptance Criteria:**
- Given I am in the Template Editor
- And I have at least two fields
- When I click the "Move Up" button on a field (not first)
- Then that field moves up one position
- When I click the "Move Down" button on a field (not last)
- Then that field moves down one position
- And both buttons have appropriate `aria-label` attributes

**US-2.5: Field Type Selection**
> As a user, I want to select a field type so that the form knows how to validate and display the field.

**Acceptance Criteria:**
- Given I am adding or editing a field
- When I open the field type selector
- Then I see options for: text, number, date, select
- And selecting a type updates the field configuration

### FR-3: Form Validation

**Description:** Provide clear validation feedback for template creation/editing.

**User Stories:**

**US-3.1: Required Field Validation**
> As a user, I want to see validation errors when I miss required fields so that I can correct them before saving.

**Acceptance Criteria:**
- Given I am in the Template Editor
- And I have not entered a template name
- When I click Save
- Then a validation error appears with `role="alert"` or `aria-invalid="true"`
- And the save operation is blocked
- And focus moves to the invalid field

### FR-4: Data Test ID Attributes

**Description:** Add data-testid attributes for E2E test compatibility.

**Requirements:**

| Element | data-testid Value |
|---------|-------------------|
| Template cards container | `template-grid` |
| Individual template card | `template-card` or `template-row` |
| Template name in card | `template-name` |
| Edit button | `edit-template-btn` |
| Duplicate button | `duplicate-template-btn` |
| Delete button | `delete-template-btn` |
| Template Editor panel | `template-editor` |
| Template name input | `template-name-input` |
| Add Field button | `add-field-btn` |
| Field row | `field-row` |
| Save Template button | `save-template-btn` |
| Error messages | `validation-error` |

---

## Non-Functional Requirements

### NFR-1: Performance
- Field add/remove operations complete in < 100ms
- Template save completes in < 500ms
- Template list renders < 50 templates in < 200ms

### NFR-2: Usability
- Keyboard navigation support for all actions
- Focus management when adding/removing fields
- Clear visual feedback for all operations

### NFR-3: Accessibility
- ARIA labels on all buttons
- `aria-invalid` on validation errors
- Proper heading hierarchy in editor

### NFR-4: Reliability
- Optimistic UI updates with rollback on error
- Confirmation dialog for destructive actions
- Auto-save draft support (stretch goal)

### NFR-5: Compatibility
- Works in Chrome, Firefox, Safari, Edge (latest 2 versions)
- Responsive design for tablet+ viewports

---

## Technical Requirements

### Backend: Duplicate Endpoint

**New Endpoint:** `POST /api/templates/:id/duplicate`

```typescript
// Request: No body required
// Response:
{
  "success": true,
  "template": {
    "id": "uuid",
    "name": "Original Template (Copy)",
    "description": "...",
    "formType": "...",
    "fieldMappings": [...],
    "isPublic": false, // Always private for copies
    "createdAt": "..."
  }
}
```

**Implementation in TemplateService.ts:**
```typescript
async duplicateTemplate(templateId: string, userId: string): Promise<Template> {
  const original = await this.getTemplateById(templateId, userId);
  if (!original) throw new Error('Template not found');

  const fieldMappings = await this.getTemplateFieldMappings(templateId, userId);

  return this.createTemplate(userId, {
    name: `${original.name} (Copy)`,
    description: original.description || undefined,
    formType: original.formType,
    fieldMappings,
    isPublic: false
  });
}
```

### Frontend: Component Architecture

```
quikadmin-web/src/
├── components/
│   └── features/
│       └── templates/
│           ├── TemplateEditor.tsx      # Main editor panel
│           ├── TemplateFieldList.tsx   # Field list with reorder
│           ├── TemplateFieldRow.tsx    # Single field configuration
│           └── TemplateCard.tsx        # Card with Edit/Duplicate/Delete
├── pages/
│   └── Templates.tsx                   # Updated to use new components
└── services/
    └── formService.ts                  # Add duplicateTemplate()
```

### Frontend: Form Service Addition

```typescript
// formService.ts
export async function duplicateTemplate(templateId: string): Promise<MappingTemplate> {
  const response = await api.post(`/templates/${templateId}/duplicate`);
  return response.data.template;
}
```

### Frontend: Input Attribute Changes

The current implementation uses `id` attributes without `name`:
```tsx
// Current (breaks E2E)
<Input id="t-name" value={...} />

// Required (E2E compatible)
<Input id="t-name" name="name" value={...} />
```

All form inputs must have both `id` and `name` attributes for E2E test compatibility.

---

## User Stories Summary

| ID | Story | Priority | Complexity |
|----|-------|----------|------------|
| US-1.1 | Edit Template | High | Medium |
| US-1.2 | Duplicate Template | High | Low |
| US-2.1 | Template Editor Panel | High | Medium |
| US-2.2 | Add Field to Template | High | Medium |
| US-2.3 | Remove Field from Template | High | Low |
| US-2.4 | Reorder Fields | Medium | Medium |
| US-2.5 | Field Type Selection | High | Low |
| US-3.1 | Required Field Validation | High | Low |
| FR-4 | Data Test ID Attributes | High | Low |

---

## Implementation Plan

### Phase 1: Foundation (Day 1)
**Goal:** Backend duplicate endpoint + basic frontend structure

1. Implement `POST /api/templates/:id/duplicate` endpoint
2. Add `duplicateTemplate()` to formService.ts
3. Create TemplateCard component with Edit/Duplicate buttons
4. Add data-testid attributes to Templates.tsx
5. Update input elements to include `name` attributes

**E2E Tests Enabled:**
- "should duplicate template" (partial)
- "should delete template" (already works)

### Phase 2: Template Editor (Day 2)
**Goal:** Full template editor with field management

1. Create TemplateEditor component
2. Create TemplateFieldList component
3. Create TemplateFieldRow component
4. Implement Add/Remove field functionality
5. Implement field type selector
6. Wire up Edit button to open TemplateEditor

**E2E Tests Enabled:**
- "should create new template with fields"
- "should edit existing template"
- "should add multiple fields to template"
- "should remove field from template"
- "should support different field types"

### Phase 3: Polish (Day 3)
**Goal:** Reordering, validation, and edge cases

1. Implement field reorder (Move Up/Down buttons)
2. Add form validation with error display
3. Add persistence verification
4. Fix any remaining E2E test failures
5. Add keyboard navigation support

**E2E Tests Enabled:**
- "should reorder template fields"
- "should validate required template fields"
- "should persist template across page refresh"

---

## Success Criteria

### E2E Test Pass Rate
All 11 tests in `template-crud.spec.ts` must pass:

1. should create new template with fields
2. should edit existing template
3. should duplicate template
4. should delete template
5. should persist template across page refresh
6. should add multiple fields to template
7. should validate required template fields
8. should reorder template fields
9. should remove field from template
10. should support different field types

### Code Quality
- TypeScript strict mode compliance
- 80%+ unit test coverage for new components
- No console errors/warnings
- Lighthouse accessibility score > 90

### UX Metrics
- Template creation task completion < 60 seconds
- Zero user-reported confusion on field management

---

## Out of Scope

The following items are explicitly excluded from this PRD:

1. **Drag-and-drop reordering** - Using button-based reordering instead
2. **Template versioning** - Future enhancement
3. **Template import/export** - Future enhancement
4. **Conditional field logic** - Future enhancement
5. **Field grouping/sections** - Future enhancement
6. **Template sharing permissions** - Existing isPublic flag suffices
7. **Template analytics dashboard** - Future enhancement
8. **Batch template operations** - Future enhancement
9. **Template categories/tags** - Existing formType suffices
10. **AI-suggested field mappings** - Existing match/detect endpoints cover this

---

## Dependencies

### Technical Dependencies
- React 18+ (forwardRef, hooks)
- TailwindCSS 4.0 (styling)
- Radix UI (accessible primitives)
- React Query (cache invalidation)
- Zod (form validation)
- React Hook Form (form state management)

### API Dependencies
- All existing template endpoints must remain backward compatible
- New duplicate endpoint must follow existing response format

### External Dependencies
- None (all self-contained)

### Blocking Dependencies
- None (can start immediately)

---

## Test Strategy

### Unit Tests
- TemplateEditor component rendering
- TemplateFieldRow add/remove behavior
- Field reordering logic
- Validation error display

### Integration Tests
- Create template with multiple fields
- Edit template and verify persistence
- Duplicate template and verify isolation

### E2E Tests
- Existing `template-crud.spec.ts` tests must pass
- Add new tests for edge cases discovered during implementation

---

## Appendix

### A: Current Templates.tsx Structure
```tsx
// Key components in current implementation:
- TemplateCard (inline component)
- Create Dialog (inline)
- Delete AlertDialog
// Missing:
- Edit functionality
- Field management
- Duplicate button
```

### B: E2E Page Object: TemplatesPage.ts
The page object already defines expected selectors - implementation must match these selectors for tests to pass.

### C: Backend FieldMapping Interface
```typescript
interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform?: string;
  confidence?: number;
}
```

### D: Related Files
| File | Purpose |
|------|---------|
| `quikadmin/src/api/template.routes.ts` | Backend API routes |
| `quikadmin/src/services/TemplateService.ts` | Backend service |
| `quikadmin-web/src/pages/Templates.tsx` | Frontend page |
| `quikadmin-web/src/stores/templateStore.ts` | Zustand store |
| `quikadmin-web/src/services/formService.ts` | API service |
| `quikadmin-web/e2e/tests/documents/template-crud.spec.ts` | E2E tests |
| `quikadmin-web/e2e/pages/TemplatesPage.ts` | E2E page object |

---

**End of PRD**
