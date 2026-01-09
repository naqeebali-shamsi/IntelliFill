# Product Requirements Document: OCR Field Mapping Enhancement

**Document Version:** 1.0
**Status:** Draft
**Author:** AI Product Specialist
**Created:** 2026-01-09
**Last Updated:** 2026-01-09

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Overview](#3-product-overview)
4. [User Stories](#4-user-stories)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Technical Considerations](#7-technical-considerations)
8. [Implementation Plan](#8-implementation-plan)
9. [Success Criteria](#9-success-criteria)
10. [Risk Assessment](#10-risk-assessment)
11. [Appendix](#appendix)

---

## 1. Executive Summary

### 1.1 Overview

This PRD defines the requirements for enhancing IntelliFill's OCR field mapping capabilities to provide per-field confidence scores, complete the multiagent processing pipeline, and deliver a comprehensive form template management experience. The goal is to transform the current prototype-level field mapping into a production-ready feature that enables users to confidently auto-fill forms with extracted document data.

### 1.2 Business Impact

- **User Efficiency:** Reduce form filling time by 80% through intelligent auto-fill with confidence indicators
- **Error Reduction:** Minimize data entry errors by highlighting low-confidence extractions requiring manual review
- **User Adoption:** Enable power users to create and reuse mapping templates, increasing platform stickiness
- **Competitive Advantage:** Differentiate from basic OCR tools by providing explainable AI with per-field transparency

### 1.3 Key Deliverables

| Deliverable | Priority | Estimated Effort |
|-------------|----------|------------------|
| Per-field confidence exposure | P0 | 3-5 days |
| FormTemplate management UI | P1 | 5-7 days |
| Filled form history view | P1 | 3-4 days |
| Multiagent pipeline completion | P2 | 10-15 days |
| E2E test completion (FF-040, FF-041) | P1 | 2-3 days |

### 1.4 Resource Requirements

- **Frontend:** 1 React developer (2 sprints)
- **Backend:** 1 Node.js developer (2-3 sprints)
- **AI/ML:** 1 LLM integration specialist (1-2 sprints for multiagent)
- **QA:** 1 test engineer (throughout)

---

## 2. Problem Statement

### 2.1 Current State Analysis

IntelliFill has foundational OCR and field mapping infrastructure in place:

**What Exists:**
- `OCRService` with Tesseract.js + Gemini Vision fallback for text extraction
- `generateAutoMappings()` utility with Levenshtein similarity matching (60% threshold)
- `FieldMappingTable` component displaying form-to-document field mappings
- `TemplateManager` component for saving/loading mapping templates
- `SimpleFillForm` page with 3-step stepper workflow (Upload -> Map -> Download)
- Multiagent pipeline scaffold (LangGraph StateGraph with classifier/extractor/mapper/qa nodes)
- Database models: `FormTemplate`, `FilledForm`, `ExtractedData`, `ClientProfile`

**Critical Gaps Identified:**

| Gap | Impact | Severity |
|-----|--------|----------|
| Per-field confidence not exposed to UI | Users cannot assess individual field reliability | High |
| Multiagent nodes are placeholders | No LLM-powered intelligent extraction/validation | High |
| No FormTemplate management page | Users cannot manage their form library | Medium |
| No filled form history UI | Users cannot review past submissions | Medium |
| E2E tests FF-040, FF-041 missing | Cannot verify template autofill flows | Medium |

### 2.2 User Pain Points

1. **Confidence Opacity:** Users see overall document confidence (e.g., 85%) but cannot identify which specific fields are unreliable
2. **No Template Library:** Users must recreate field mappings for recurring forms (visa applications, company formation docs)
3. **No Audit Trail:** Users cannot review what data was used to fill past forms
4. **Manual Override Friction:** Resetting to auto-mapping loses manual corrections without confirmation

### 2.3 Technical Debt

1. **OCRService returns page-level confidence only:**
   ```typescript
   // Current: Only overall confidence available
   interface OCRResult {
     text: string;
     confidence: number; // Overall document confidence
     pages: Array<{ pageNumber, text, confidence }>;
   }
   ```

2. **Multiagent workflow nodes return placeholder data:**
   ```typescript
   // Current: Placeholder implementation
   async function extractNode(state, config) {
     // TODO: Implement actual extraction with Llama 8B
     return { extractedFields: {}, ... };
   }
   ```

3. **ExtractedField type exists but not fully utilized:**
   ```typescript
   // Defined in state.ts but confidence not surfaced to UI
   interface ExtractedField {
     value: string | number | boolean | null;
     confidence: number; // 0-100 - exists but not exposed!
     source: 'ocr' | 'llm' | 'rule' | 'user';
     boundingBox?: { x, y, width, height, page };
   }
   ```

---

## 3. Product Overview

### 3.1 Product Vision

Enable IntelliFill users to confidently auto-fill any PDF form using extracted document data, with full transparency into extraction confidence at the field level, and the ability to save, reuse, and audit form filling workflows.

### 3.2 Target Users

| Persona | Description | Key Needs |
|---------|-------------|-----------|
| **PRO Agent** | Immigration/visa processing agent handling 50+ applications/week | Speed, accuracy, template reuse, audit trail |
| **Business Owner** | Company formation client submitting multiple government forms | Easy form filling, confidence in data accuracy |
| **Back Office Staff** | Data entry operators processing documents for multiple clients | Batch processing, error detection, history review |

### 3.3 Value Proposition

| User Type | Current Pain | Proposed Solution | Expected Outcome |
|-----------|--------------|-------------------|------------------|
| PRO Agent | Manually fills same form types repeatedly | Save mapping templates, one-click reuse | 5x faster form completion |
| Business Owner | Uncertain which extracted data is reliable | Per-field confidence badges | Reduced errors, higher confidence |
| Back Office | No record of what was submitted | Filled form history with data snapshots | Complete audit trail |

### 3.4 Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Form fill completion rate | Unknown | >90% | Analytics: forms started vs. completed |
| Average fill time | Unknown | <2 min | Time from upload to download |
| Manual override rate | Unknown | <20% | Fields manually changed / total fields |
| Template reuse rate | 0% | >40% | Templates used / total fills |

---

## 4. User Stories

### 4.1 Epic: Per-Field Confidence Display

#### US-001: View Field-Level Confidence
**As a** PRO agent processing visa applications
**I want to** see confidence scores for each auto-filled field
**So that** I can quickly identify and verify low-confidence entries before submission

**Acceptance Criteria:**
```gherkin
Given I have uploaded a document for OCR processing
When the OCR extraction completes
Then I should see a confidence percentage (0-100%) next to each extracted field
And fields with confidence <70% should be highlighted in yellow/orange
And fields with confidence <50% should be highlighted in red
And I should be able to hover over a field to see the extraction source
```

**Technical Notes:**
- Requires exposing `ExtractedField.confidence` from multiagent state to API response
- UI already has `getConfidenceBadgeVariant()` utility - wire it to actual per-field data

---

#### US-002: Filter by Confidence Level
**As a** back office operator reviewing extracted data
**I want to** filter fields by confidence level
**So that** I can focus my review time on uncertain extractions

**Acceptance Criteria:**
```gherkin
Given I am viewing the field mapping table
When I click the "Filter" dropdown
Then I should see options: "All", "High (>90%)", "Medium (70-90%)", "Low (<70%)"
And selecting a filter should hide fields not matching that confidence range
And the count of visible/total fields should update
```

---

### 4.2 Epic: Auto-Fill from Document OCR

#### US-003: Auto-Fill Template from OCR Data (E2E Test: template-autofill.spec.ts)
**As a** user who has uploaded and processed a document
**I want to** auto-fill a form template using extracted OCR data
**So that** I save time compared to manual data entry

**Acceptance Criteria:**
```gherkin
Given I have processed a document with OCR
And the document contains fields: Passport No, Full Name, Date of Birth, Nationality
When I select a form template (e.g., "UAE Visa Application")
Then the template fields should auto-populate with matched OCR data
And each auto-filled field should display its confidence score
And unmapped fields should show "Unmapped" with a warning icon
```

**Test Reference:** `authTest('should auto-fill template from OCR data')`

---

#### US-004: Edit Auto-Filled Data
**As a** user reviewing auto-filled form data
**I want to** edit any field value
**So that** I can correct errors before final submission

**Acceptance Criteria:**
```gherkin
Given a form has been auto-filled from OCR data
When I click on any field value
Then the field should become editable
And I should be able to type a new value
And a "Manual" badge should appear next to manually edited fields
And I should be able to reset to the original OCR value
```

**Test Reference:** `authTest('should allow editing auto-filled data')`

---

#### US-005: Handle Missing OCR Data Gracefully
**As a** user filling a form from incomplete OCR data
**I want to** see which required fields could not be auto-filled
**So that** I know what to manually enter

**Acceptance Criteria:**
```gherkin
Given OCR extraction returned only some fields (e.g., only "Full Name")
When I load a form template requiring Passport No, Full Name, DOB
Then "Full Name" should be auto-filled with the extracted value
And "Passport No" and "DOB" should show "No data available"
And required empty fields should display a red validation indicator
And the "Fill Form" button should be disabled until all required fields have values
```

**Test Reference:** `authTest('should handle missing OCR data gracefully')`

---

### 4.3 Epic: Manual Field Override

#### US-006: Manual Field Selection for Auto-Fill
**As a** user with multiple processed documents
**I want to** choose which document's data to use for a specific field
**So that** I can combine data from multiple sources (e.g., passport + visa)

**Acceptance Criteria:**
```gherkin
Given I have processed multiple documents (Passport.pdf, Visa.pdf)
When I click on the "Source" dropdown for a field
Then I should see a list of available documents with that field
And each option should show: Document Name, Extracted Value, Confidence
And selecting a different source should update the field value
And the source badge should reflect the new document
```

**Test Reference:** `authTest('should allow manual field selection for auto-fill')`

---

#### US-007: Reset to Auto-Mapping
**As a** user who has made manual overrides
**I want to** reset a field to its auto-detected mapping
**So that** I can undo mistakes without starting over

**Acceptance Criteria:**
```gherkin
Given I have manually changed a field mapping or value
When I click the "Reset" icon next to that field
Then a confirmation tooltip should appear: "Reset to auto-detected value?"
And confirming should restore the original OCR value and mapping
And the "Manual" badge should disappear
```

---

### 4.4 Epic: PDF Export of Filled Form

#### US-008: Export Filled Form as PDF
**As a** user who has completed form filling
**I want to** download the filled PDF form
**So that** I can submit it to the relevant authority

**Acceptance Criteria:**
```gherkin
Given I have filled all required fields in a form template
When I click "Fill Form" / "Download PDF"
Then the system should generate a PDF with all field values filled
And the download should start automatically
And the filled form should be saved to my history
And I should see a success toast with file name
```

**Test Reference:** `authTest('should export filled form as PDF')`

---

#### US-009: Show Confidence Indicator for Auto-Filled Fields
**As a** user reviewing a filled form
**I want to** see visual confidence indicators
**So that** I can quickly assess data reliability before download

**Acceptance Criteria:**
```gherkin
Given a form has been auto-filled
Then each field should display a confidence indicator:
  - Green badge (>90%): High confidence
  - Yellow badge (70-90%): Medium confidence - review recommended
  - Red badge (<70%): Low confidence - manual verification required
And hovering over the badge should show the exact percentage
```

**Test Reference:** `authTest('should show confidence indicator for auto-filled fields')`

---

### 4.5 Epic: Template Management

#### US-010: Save Completed Form as Template
**As a** power user processing recurring form types
**I want to** save my field mappings as a reusable template
**So that** I don't have to recreate mappings every time

**Acceptance Criteria:**
```gherkin
Given I have completed field mappings for a form
When I click "Save as Template"
Then a modal should appear with fields: Template Name, Description (optional)
And saving should store the mappings for future use
And the template should appear in my template library
```

**Test Reference:** `authTest('should save completed form')`

---

#### US-011: Browse and Select Templates
**As a** user with saved templates
**I want to** browse my template library
**So that** I can quickly select the right form for my needs

**Acceptance Criteria:**
```gherkin
Given I have saved multiple form templates
When I navigate to "Templates" or "Form Library" page
Then I should see a grid/list of my templates
And each template should show: Name, Description, Field Count, Last Used
And I should be able to search/filter templates by name or category
And clicking a template should open it in the form filler
```

**Test Reference:** `authTest('should support multiple templates')`

---

#### US-012: Delete Template
**As a** user managing my template library
**I want to** delete templates I no longer need
**So that** my library stays organized

**Acceptance Criteria:**
```gherkin
Given I am viewing my template library
When I click the delete icon on a template
Then a confirmation dialog should appear
And confirming should remove the template from my library
And any filled forms using that template should retain their data (soft delete)
```

---

### 4.6 Epic: Filled Form History

#### US-013: View Filled Form History
**As a** user who has filled multiple forms
**I want to** view my form filling history
**So that** I can review what was submitted and when

**Acceptance Criteria:**
```gherkin
Given I have filled and downloaded multiple forms
When I navigate to "History" or "Filled Forms" page
Then I should see a list of all my filled forms
And each entry should show: Template Name, Client Name, Date, Action buttons
And I should be able to filter by date range, template, or client
And clicking "View" should show the data snapshot used
```

---

#### US-014: Re-download Filled Form
**As a** user who needs a copy of a previously filled form
**I want to** re-download the PDF
**So that** I don't have to re-fill it from scratch

**Acceptance Criteria:**
```gherkin
Given I am viewing a filled form in history
When I click "Download"
Then the original filled PDF should download
And if the file is no longer available, show an error message with option to regenerate
```

---

### 4.7 Epic: Validate Required Fields

#### US-015: Validate Required Fields Before Save
**As a** user attempting to save or download a form
**I want to** be alerted to any missing required fields
**So that** I don't submit incomplete forms

**Acceptance Criteria:**
```gherkin
Given a form template has required fields marked
And some required fields are empty or unmapped
When I click "Fill Form" or "Save"
Then the submission should be blocked
And an error message should display: "Please fill all required fields"
And the empty required fields should be highlighted with red borders
And the form should scroll to the first empty required field
```

**Test Reference:** `authTest('should validate required fields before save')`

---

## 5. Functional Requirements

### 5.1 Per-Field Confidence Exposure

#### FR-001: Confidence Score API Response
The backend API shall include per-field confidence scores in extraction responses.

**Current State:**
```typescript
// GET /api/users/me/data response
{
  data: { fields: { "Full Name": "John Doe", ... } },
  fieldSources: { "Full Name": [{ documentId, fileName, confidence: null }] }
  // ^ confidence is null - not populated!
}
```

**Required State:**
```typescript
// GET /api/users/me/data response
{
  data: {
    fields: {
      "Full Name": { value: "John Doe", confidence: 92, source: "ocr" },
      "Passport No": { value: "AB1234567", confidence: 78, source: "llm" }
    }
  },
  fieldSources: {
    "Full Name": [{ documentId, fileName, confidence: 92, extractedAt }]
  }
}
```

**Implementation Path:**
1. Update `OCRService.extractStructuredData()` to return per-field confidence
2. Modify `ExtractedData` model usage to store `confidence` per field
3. Update aggregation logic in `users.routes.ts` to include confidence in response

---

#### FR-002: Confidence Display in Field Mapping Table

The `FieldMappingTable` component shall display actual per-field confidence.

**Current State:**
```typescript
// field-mapping-table.tsx
const getConfidence = (formFieldName: string): number => {
  const mapping = getMapping(formFieldName);
  return mapping?.confidence || 0; // Returns mapping confidence, not extraction confidence
};
```

**Required State:**
```typescript
// Use extraction confidence from document data
const getExtractionConfidence = (documentField: string | null): number => {
  if (!documentField) return 0;
  const fieldData = documentData.fields?.[documentField];
  return typeof fieldData === 'object' ? fieldData.confidence || 0 : 0;
};
```

---

### 5.2 Multiagent Pipeline Completion

#### FR-003: Classifier Agent Implementation

Replace placeholder with actual document classification using Phi-3 or similar model.

**Requirements:**
- Input: Raw document text/image
- Output: `DocumentCategory` (PASSPORT, EMIRATES_ID, VISA, etc.)
- Confidence threshold: 0.8 for auto-classification, <0.8 triggers manual review flag

**API Contract:**
```typescript
interface ClassificationResult {
  category: DocumentCategory;
  confidence: number; // 0-1
  alternativeCategories: Array<{ category: DocumentCategory; confidence: number }>;
  classifiedAt: Date;
}
```

---

#### FR-004: Extractor Agent Implementation

Replace placeholder with LLM-powered field extraction using Llama 8B or Gemini.

**Requirements:**
- Input: Classified document + raw OCR text
- Output: Structured `ExtractedField` records with per-field confidence
- Support for document-type-specific field schemas (passport fields vs. visa fields)

**API Contract:**
```typescript
interface ExtractionResult {
  extractedFields: Record<string, ExtractedField>;
  metadata: {
    model: string;
    promptVersion: string;
    processingTimeMs: number;
    totalFields: number;
    highConfidenceFields: number; // >90%
    lowConfidenceFields: number; // <70%
  };
}
```

---

#### FR-005: Mapper Agent Implementation

Replace placeholder with intelligent field-to-form mapping using Mistral 7B or rule-based system.

**Requirements:**
- Input: Extracted fields + target form schema
- Output: Mapped fields with confidence scores
- Support for semantic matching beyond string similarity

**Enhancement over current `generateAutoMappings()`:**
- Use embeddings for semantic similarity (e.g., "DOB" matches "Date of Birth")
- Handle multi-value fields (e.g., "Address" splitting into Street, City, ZIP)

---

#### FR-006: QA Agent Implementation

Replace placeholder with validation agent to catch extraction errors.

**Requirements:**
- Input: Mapped fields + document classification
- Output: Validation result with issues and suggestions
- Checks: Format validation (dates, numbers), cross-field consistency, completeness

**API Contract:**
```typescript
interface QualityAssessment {
  isValid: boolean;
  overallScore: number; // 0-100
  issues: QualityIssue[];
  suggestions: string[];
  needsHumanReview: boolean;
}
```

---

### 5.3 FormTemplate Management

#### FR-007: FormTemplate Management Page

Create dedicated UI for browsing, creating, editing, and deleting form templates.

**Page Requirements:**
- URL: `/templates` or `/form-library`
- Layout: Grid view with template cards
- Actions: Create, Edit, Delete, Duplicate, Preview
- Filters: By category, by usage count, by date

**Template Card Display:**
- Template name
- Description (truncated)
- Category badge (Visa, Labor, Banking, etc.)
- Field count
- Usage count
- Last used date
- Created by (for shared templates)

---

#### FR-008: Template Creation Flow

Enable users to create templates from scratch or from a filled form.

**Flow A: From Scratch**
1. Upload blank PDF form
2. System detects form fields
3. User maps fields to profile field names
4. User saves with name/description

**Flow B: From Filled Form (Save as Template)**
1. User completes form filling workflow
2. User clicks "Save as Template"
3. System saves current mappings as template
4. Template appears in library

---

### 5.4 Filled Form History

#### FR-009: Filled Form History Page

Create UI for viewing and managing filled form history.

**Page Requirements:**
- URL: `/history` or `/filled-forms`
- Layout: Table view with sorting/filtering
- Columns: Template Name, Client Name, Date Filled, Confidence Score, Actions
- Actions: View Details, Re-download, Delete

**Detail View:**
- Data snapshot used at fill time
- Template used
- Client profile at time of fill
- Download link (if file still exists)
- Regenerate option (if file expired)

---

#### FR-010: Data Snapshot Storage

Store complete data snapshot when filling forms for audit purposes.

**Requirements:**
- Capture all field values at fill time
- Store in `FilledForm.dataSnapshot` (JSON)
- Include source document references
- Enable regeneration from snapshot

---

### 5.5 Validation Requirements

#### FR-011: Required Field Validation

Enforce required field completion before form generation.

**Requirements:**
- Mark fields as required based on form metadata or manual flagging
- Block "Fill Form" action if required fields are empty
- Display inline validation errors
- Auto-scroll to first error

---

#### FR-012: Format Validation

Validate field values match expected formats.

**Validation Rules:**
| Field Type | Validation |
|------------|------------|
| Date | Valid date format (configurable: DD/MM/YYYY, YYYY-MM-DD) |
| Email | RFC 5322 compliant |
| Phone | E.164 or local format |
| Passport | Country-specific patterns |
| Emirates ID | 15-digit format |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Requirement | Target | Current | Priority |
|-------------|--------|---------|----------|
| OCR processing time (per page) | <3s | ~5s | P1 |
| Auto-mapping generation | <500ms | <200ms | Met |
| Template library load time | <1s | N/A | P1 |
| PDF generation | <2s | ~1.5s | Met |
| History page load (100 items) | <2s | N/A | P2 |

### 6.2 Reliability

| Requirement | Target | Priority |
|-------------|--------|----------|
| OCR service uptime | 99.5% | P0 |
| Graceful degradation (Tesseract->Gemini fallback) | Automatic | P0 |
| Data consistency (no partial saves) | Transactional | P0 |
| File storage durability | S3 Standard (99.999999999%) | Met |

### 6.3 Security

| Requirement | Implementation | Priority |
|-------------|----------------|----------|
| PII data encryption at rest | AES-256 via Prisma encrypted fields | P0 |
| Field-level access control | RLS via Supabase + organization context | P0 |
| Audit logging | All form fills logged with user ID | P1 |
| Data retention policy | 90 days default, configurable | P2 |

### 6.4 Usability

| Requirement | Target | Priority |
|-------------|--------|----------|
| Mobile responsiveness | Tablet and above | P2 |
| Accessibility (WCAG 2.1 AA) | All new UI components | P1 |
| Keyboard navigation | Full support in mapping table | P1 |
| Error message clarity | Actionable, non-technical | P1 |

### 6.5 Scalability

| Requirement | Target | Priority |
|-------------|--------|----------|
| Concurrent users | 100+ | P1 |
| Templates per user | 500+ | P2 |
| Filled forms per user | 10,000+ | P2 |
| Document storage | Unlimited (S3) | Met |

---

## 7. Technical Considerations

### 7.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend (quikadmin-web)                       │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────┐  ┌───────────┐ │
│  │SimpleFillForm│  │TemplateLibraryPage│  │FilledFormHistory│  │FieldMapping││
│  │   (exists)   │  │    (NEW)         │  │     (NEW)       │  │Table(exists)│
│  └──────┬───────┘  └────────┬─────────┘  └────────┬────────┘  └──────┬────┘ │
│         │                   │                     │                   │      │
│         └───────────────────┴─────────────────────┴───────────────────┘      │
│                                    │                                         │
│                          Zustand Stores                                      │
│         ┌─────────────────────────────────────────────────────┐             │
│         │templateStore (exists) │ filledFormStore (NEW)       │             │
│         └─────────────────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Backend (quikadmin)                            │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────────────┐  │
│  │form-template.   │  │filled-form.      │  │users.routes.ts            │  │
│  │routes.ts (exists)│  │routes.ts (NEW)   │  │(enhance with confidence)  │  │
│  └────────┬────────┘  └────────┬─────────┘  └───────────┬───────────────┘  │
│           │                    │                        │                   │
│           └────────────────────┴────────────────────────┘                   │
│                                │                                            │
│                    ┌───────────┴───────────┐                               │
│                    │   Multiagent Pipeline  │                               │
│                    │      (LangGraph)       │                               │
│  ┌────────────┐    │  ┌────┐ ┌────┐ ┌────┐ │    ┌────────────────┐        │
│  │ OCRService │───▶│  │Cls │→│Ext │→│Map │ │───▶│ FormFiller     │        │
│  │ (Tesseract/│    │  └────┘ └────┘ └────┘ │    │ (pdf-lib)      │        │
│  │  Gemini)   │    │         │      │      │    └────────────────┘        │
│  └────────────┘    │         ▼      ▼      │                               │
│                    │       ┌────┐ ┌────┐   │                               │
│                    │       │QA  │ │Err │   │                               │
│                    │       └────┘ └────┘   │                               │
│                    └───────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Data Layer                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐               │
│  │ FormTemplate   │  │ FilledForm     │  │ ExtractedData  │               │
│  │ (Prisma)       │  │ (Prisma)       │  │ (Prisma)       │               │
│  └────────────────┘  └────────────────┘  └────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Technology Stack Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Multiagent LLM | Gemini 1.5 Flash (primary), Ollama (fallback) | Cost-effective, fast, good at structured extraction |
| Field matching | Levenshtein + sentence embeddings | Hybrid approach for best coverage |
| PDF manipulation | pdf-lib (existing) | Already in use, battle-tested |
| State management | LangGraph (existing) | Already scaffolded, supports checkpointing |

### 7.3 Data Model Additions

No schema changes required. Existing models are sufficient:

```prisma
// Already exists - fully supports requirements
model FormTemplate {
  id            String   @id
  userId        String
  name          String
  description   String?
  category      FormCategory?
  fileUrl       String
  fieldMappings Json     // { formFieldName: profileFieldName }
  detectedFields Json    // ["field1", "field2", ...]
  isActive      Boolean
  // ...
}

model FilledForm {
  id           String   @id
  clientId     String
  templateId   String
  userId       String
  fileUrl      String
  dataSnapshot Json     // Complete fill data for audit
  createdAt    DateTime
  // ...
}

model ExtractedData {
  id           String   @id
  documentId   String
  clientId     String
  rawText      String?
  fields       Json     // { fieldName: { value, confidence, source } }
  status       ExtractionStatus
  // ...
}
```

### 7.4 API Additions

#### New Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/form-templates` | GET | List user's templates |
| `/api/form-templates` | POST | Create template |
| `/api/form-templates/:id` | GET | Get template details |
| `/api/form-templates/:id` | PUT | Update template |
| `/api/form-templates/:id` | DELETE | Delete template |
| `/api/filled-forms` | GET | List filled form history |
| `/api/filled-forms/:id` | GET | Get filled form details |
| `/api/filled-forms/:id/download` | GET | Download filled PDF |
| `/api/filled-forms/:id` | DELETE | Delete filled form |

#### Enhanced Endpoints

| Endpoint | Enhancement |
|----------|-------------|
| `/api/users/me/data` | Include per-field confidence in response |
| `/api/documents/:id/extracted` | Include per-field confidence |
| `/api/users/me/fill-form` | Save to FilledForm history |

### 7.5 Frontend Component Tree

```
src/
├── pages/
│   ├── SimpleFillForm.tsx          (existing - enhance)
│   ├── TemplateLibrary.tsx         (NEW)
│   └── FilledFormHistory.tsx       (NEW)
├── components/features/
│   ├── field-mapping-table.tsx     (existing - enhance with real confidence)
│   ├── template-manager.tsx        (existing - enhance)
│   ├── template-card.tsx           (NEW)
│   ├── template-editor.tsx         (NEW)
│   └── filled-form-detail.tsx      (NEW)
├── stores/
│   ├── templateStore.ts            (existing - enhance)
│   └── filledFormStore.ts          (NEW)
├── services/
│   ├── formService.ts              (existing - add new endpoints)
│   └── filledFormService.ts        (NEW)
└── types/
    ├── formFilling.ts              (existing - enhance types)
    └── filledForm.ts               (NEW)
```

### 7.6 Integration Points

| Integration | Current State | Required Changes |
|-------------|---------------|------------------|
| OCRService -> ExtractedData | Saves overall confidence | Add per-field confidence extraction |
| ExtractedData -> User Data API | Returns flat fields | Return fields with confidence objects |
| User Data -> FieldMappingTable | Uses mapping confidence | Use extraction confidence |
| FormFiller -> FilledForm | No history saved | Save to FilledForm table |

---

## 8. Implementation Plan

### 8.1 Phase 1: Per-Field Confidence (Sprint 1 - Week 1-2)

**Objective:** Expose per-field confidence from OCR to UI

| Task | Owner | Effort | Dependencies |
|------|-------|--------|--------------|
| 1.1 Enhance OCR pattern extraction with confidence | Backend | 2d | - |
| 1.2 Update ExtractedData storage with field confidence | Backend | 1d | 1.1 |
| 1.3 Modify /users/me/data to return confidence | Backend | 1d | 1.2 |
| 1.4 Update FieldMappingTable to display real confidence | Frontend | 1d | 1.3 |
| 1.5 Add confidence filtering UI | Frontend | 1d | 1.4 |
| 1.6 Write unit tests for confidence logic | QA | 1d | 1.4 |

**Deliverables:**
- API returns `{ fieldName: { value, confidence, source } }`
- UI displays per-field confidence badges
- Filter by confidence level works

---

### 8.2 Phase 2: FormTemplate Management (Sprint 1-2 - Week 2-3)

**Objective:** Create dedicated template management experience

| Task | Owner | Effort | Dependencies |
|------|-------|--------|--------------|
| 2.1 Create TemplateLibrary page scaffold | Frontend | 1d | - |
| 2.2 Create TemplateCard component | Frontend | 1d | 2.1 |
| 2.3 Implement template CRUD API (exists, enhance) | Backend | 1d | - |
| 2.4 Create TemplateEditor component | Frontend | 2d | 2.3 |
| 2.5 Add template duplication feature | Full-stack | 1d | 2.4 |
| 2.6 Add template preview modal | Frontend | 1d | 2.4 |
| 2.7 Write E2E tests for template management | QA | 2d | 2.6 |

**Deliverables:**
- `/templates` page with grid view
- Create/Edit/Delete template flows
- Template preview before use

---

### 8.3 Phase 3: Filled Form History (Sprint 2 - Week 3-4)

**Objective:** Enable users to view and manage form filling history

| Task | Owner | Effort | Dependencies |
|------|-------|--------|--------------|
| 3.1 Create FilledFormHistory page | Frontend | 1d | - |
| 3.2 Create filledFormService API client | Frontend | 0.5d | - |
| 3.3 Implement filled-form API endpoints | Backend | 1d | - |
| 3.4 Create FilledFormDetail component | Frontend | 1d | 3.2 |
| 3.5 Modify fill-form to save to FilledForm | Backend | 1d | 3.3 |
| 3.6 Add re-download / regenerate feature | Full-stack | 1d | 3.5 |
| 3.7 Write E2E tests for history | QA | 1d | 3.6 |

**Deliverables:**
- `/history` page with table view
- View filled form details with data snapshot
- Re-download or regenerate filled PDFs

---

### 8.4 Phase 4: E2E Test Completion (Sprint 2 - Week 4)

**Objective:** Implement missing E2E tests (FF-040, FF-041)

| Task | Owner | Effort | Dependencies |
|------|-------|--------|--------------|
| 4.1 Review template-autofill.spec.ts requirements | QA | 0.5d | - |
| 4.2 Create TemplatesPage page object | QA | 0.5d | 4.1 |
| 4.3 Implement FF-040 test cases | QA | 1d | 4.2, Phase 1-3 |
| 4.4 Implement FF-041 test cases | QA | 1d | 4.3 |
| 4.5 Run full E2E suite, fix flakes | QA | 1d | 4.4 |

**Deliverables:**
- All `template-autofill.spec.ts` tests passing
- CI pipeline green

---

### 8.5 Phase 5: Multiagent Pipeline Completion (Sprint 3-4 - Week 5-8)

**Objective:** Replace placeholder agent nodes with working LLM implementations

| Task | Owner | Effort | Dependencies |
|------|-------|--------|--------------|
| 5.1 Research/select LLM for each agent role | AI/ML | 2d | - |
| 5.2 Implement Classifier agent (Phi-3) | AI/ML | 3d | 5.1 |
| 5.3 Implement Extractor agent (Llama/Gemini) | AI/ML | 5d | 5.2 |
| 5.4 Implement Mapper agent (Mistral/rules) | AI/ML | 3d | 5.3 |
| 5.5 Implement QA agent | AI/ML | 3d | 5.4 |
| 5.6 Implement Error Recovery agent | AI/ML | 2d | 5.5 |
| 5.7 End-to-end pipeline testing | QA | 3d | 5.6 |
| 5.8 Performance optimization | Backend | 2d | 5.7 |

**Deliverables:**
- Full multiagent pipeline processing documents
- Per-field confidence from LLM extraction
- Quality assessment flagging low-confidence results

---

### 8.6 Timeline Summary

```
Week 1-2:  Phase 1 (Per-Field Confidence)
Week 2-3:  Phase 2 (Template Management)
Week 3-4:  Phase 3 (Filled Form History) + Phase 4 (E2E Tests)
Week 5-8:  Phase 5 (Multiagent Pipeline)
```

**Total Duration:** 8 weeks (2 sprints for Phases 1-4, 2 sprints for Phase 5)

---

## 9. Success Criteria

### 9.1 Phase 1 Success (Per-Field Confidence)

| Criteria | Measurement | Target |
|----------|-------------|--------|
| Per-field confidence visible in UI | Manual verification | 100% of fields show confidence |
| Confidence accuracy | Sample comparison with ground truth | >80% correlation |
| No regression in existing flows | E2E test suite | All tests passing |

### 9.2 Phase 2 Success (Template Management)

| Criteria | Measurement | Target |
|----------|-------------|--------|
| Template CRUD operations work | E2E tests | 100% pass rate |
| Template library page loads | Performance metrics | <1s load time |
| Users can find templates | Usability test | 5 users, <30s to find template |

### 9.3 Phase 3 Success (Filled Form History)

| Criteria | Measurement | Target |
|----------|-------------|--------|
| History displays all filled forms | Query verification | 100% completeness |
| Re-download works | E2E test | 100% success rate |
| Data snapshot accurate | Audit comparison | 100% match |

### 9.4 Phase 4 Success (E2E Tests)

| Criteria | Measurement | Target |
|----------|-------------|--------|
| All template-autofill tests pass | CI pipeline | 10/10 tests green |
| No flaky tests | 10 consecutive runs | 0 intermittent failures |
| Test coverage | Code coverage report | >80% for new code |

### 9.5 Phase 5 Success (Multiagent Pipeline)

| Criteria | Measurement | Target |
|----------|-------------|--------|
| Classification accuracy | Test set evaluation | >90% for known document types |
| Extraction F1 score | Named entity extraction | >85% |
| End-to-end processing time | Performance metrics | <10s per document |
| QA agent catches errors | Manual review sampling | >80% error detection |

### 9.6 Overall Product Success

| Metric | Baseline | Target | Timeline |
|--------|----------|--------|----------|
| Form fill completion rate | N/A | >90% | 30 days post-launch |
| Average fill time | N/A | <2 min | 30 days post-launch |
| Template reuse rate | 0% | >40% | 60 days post-launch |
| User satisfaction (NPS) | N/A | >40 | 60 days post-launch |
| Support tickets (form fill issues) | N/A | <5/week | 30 days post-launch |

---

## 10. Risk Assessment

### 10.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| LLM extraction quality inconsistent | Medium | High | Implement fallback to rule-based extraction; human review for low confidence |
| Multiagent pipeline performance slow | Medium | Medium | Parallelize agents where possible; cache embeddings |
| PDF form field detection unreliable | Low | High | Use pdf-lib + manual field definition fallback |
| Per-field confidence calculation inaccurate | Medium | Medium | Calibrate with human-labeled dataset; show ranges instead of exact numbers |

### 10.2 Resource Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| AI/ML specialist unavailable | Medium | High | Train backend dev on LLM integration; use managed APIs |
| Scope creep from stakeholder requests | Medium | Medium | Strict PRD adherence; defer to backlog |
| Testing bottleneck | Low | Medium | Automate E2E tests early; parallel test development |

### 10.3 Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Users don't adopt templates feature | Medium | Low | In-app onboarding; default templates for common forms |
| Competitor releases similar feature | Low | Medium | Accelerate timeline; focus on UAE-specific document types |
| LLM API costs exceed budget | Medium | Medium | Implement caching; rate limiting; cost alerts |

### 10.4 Contingency Plans

| Scenario | Trigger | Action |
|----------|---------|--------|
| Multiagent pipeline not ready | Phase 5 delayed >2 weeks | Ship Phases 1-4 first; use enhanced rule-based extraction |
| LLM costs too high | >$500/month | Switch to Ollama self-hosted; reduce LLM calls per document |
| E2E tests unstable | >10% flake rate | Increase timeouts; use test retries; simplify test scenarios |

---

## Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| Auto-fill | Automatically populating form fields with extracted document data |
| Confidence Score | Numerical measure (0-100%) of extraction reliability |
| Field Mapping | Association between form field name and document data field |
| LangGraph | LangChain library for building stateful, multi-agent workflows |
| Multiagent Pipeline | Sequence of LLM-powered agents processing documents |
| OCR | Optical Character Recognition - converting images to text |
| Template | Saved field mapping configuration for a specific form type |

### B. Reference Documents

- [LangGraph Documentation](https://python.langchain.com/docs/langgraph)
- [Tesseract.js API](https://tesseract.projectnaptha.com/)
- [pdf-lib Documentation](https://pdf-lib.js.org/)
- [IntelliFill Architecture: `/docs/reference/architecture/system-overview.md`]
- [E2E Test Spec: `quikadmin-web/e2e/tests/documents/template-autofill.spec.ts`]

### C. Current Implementation Files

| File | Purpose | Enhancement Needed |
|------|---------|-------------------|
| `quikadmin/src/services/OCRService.ts` | OCR processing | Add per-field confidence extraction |
| `quikadmin/src/multiagent/workflow.ts` | LangGraph pipeline | Replace placeholder nodes |
| `quikadmin/src/multiagent/types/state.ts` | State types | Already defined - use properly |
| `quikadmin-web/src/pages/SimpleFillForm.tsx` | Form filling UI | Wire real confidence data |
| `quikadmin-web/src/components/features/field-mapping-table.tsx` | Mapping table | Display extraction confidence |
| `quikadmin-web/src/components/features/template-manager.tsx` | Template UI | Enhance with full CRUD |
| `quikadmin-web/src/utils/fieldMapping.ts` | Mapping utilities | No change needed |

### D. Database Models

```prisma
// Core models already exist in schema.prisma

model FormTemplate {
  id            String   @id @default(uuid())
  userId        String
  name          String
  description   String?
  category      FormCategory?
  fileUrl       String
  fieldMappings Json     // { formFieldName: profileFieldName }
  detectedFields Json    // ["field1", "field2", ...]
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  filledForms   FilledForm[]
}

model FilledForm {
  id           String       @id @default(uuid())
  clientId     String
  client       Client       @relation(...)
  templateId   String
  template     FormTemplate @relation(...)
  userId       String
  fileUrl      String
  dataSnapshot Json         // { fieldName: { value, confidence, source } }
  createdAt    DateTime     @default(now())
}

model ExtractedData {
  id           String   @id @default(uuid())
  documentId   String   @unique
  clientId     String
  rawText      String?
  fields       Json     // { fieldName: { value, confidence, source } }
  status       ExtractionStatus
  extractedAt  DateTime?
}
```

### E. E2E Test Coverage Matrix

| Test ID | Test Name | Phase | Status |
|---------|-----------|-------|--------|
| FF-031 | Auto-fill template from OCR data | 1-2 | Exists, needs fixing |
| FF-032 | Allow editing auto-filled data | 1 | Exists, needs fixing |
| FF-033 | Save completed form | 3 | Exists, needs fixing |
| FF-034 | Map OCR fields to template fields | 1 | Exists, needs fixing |
| FF-035 | Handle missing OCR data gracefully | 1 | Exists, needs fixing |
| FF-036 | Validate required fields before save | 1 | Exists, needs fixing |
| FF-037 | Support multiple templates | 2 | Exists, needs fixing |
| FF-038 | Export filled form as PDF | 3 | Exists, needs fixing |
| FF-039 | Show confidence indicator | 1 | Exists, needs fixing |
| FF-040 | Manual field selection for auto-fill | 1 | **NOT IMPLEMENTED** |
| FF-041 | (Additional test TBD) | TBD | **NOT IMPLEMENTED** |

---

**Document Approval**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Tech Lead | | | |
| Engineering Manager | | | |
| QA Lead | | | |

---

*End of Document*
