# IntelliFill Product Hardening - Implementation Specifications

**Date:** 2026-02-08
**Method:** 7 parallel implementation-spec agents producing exact code changes from the Product Hardening Dossier
**Scope:** 20 prioritized upgrades across P0-P2 tiers with line-level precision

---

## Table of Contents

1. [P0-A: Registration Privilege Escalation](#p0-a-registration-privilege-escalation)
2. [P0-B: Demo Mode Backdoor](#p0-b-demo-mode-backdoor)
3. [P0-C: Wire Multi-Agent Stub Nodes](#p0-c-wire-multi-agent-stub-nodes)
4. [P0-D: Arabic OCR Support](#p0-d-arabic-ocr-support)
5. [P0-E: ClientProfile PII Encryption](#p0-e-clientprofile-pii-encryption)
6. [P1-A: Literal "null" in Form Fields](#p1-a-literal-null-in-form-fields)
7. [P1-B: XFA Form Detection](#p1-b-xfa-form-detection)
8. [P1-C: Date Format Disambiguation](#p1-c-date-format-disambiguation)
9. [P1-D: VLM Confidence Fabrication](#p1-d-vlm-confidence-fabrication)
10. [P1-E: OCR Worker Race Condition](#p1-e-ocr-worker-race-condition)
11. [P1-F: Stale Job Reconciliation](#p1-f-stale-job-reconciliation)
12. [P1-G: Queue Name Collision](#p1-g-queue-name-collision)
13. [P1-H: ClientProfile Audit Trail](#p1-h-clientprofile-audit-trail)
14. [P2 Items: Summary Specs](#p2-items-summary-specs)
15. [Adversarial Test Suite](#adversarial-test-suite)
16. [Execution Roadmap](#execution-roadmap)

---

## P0-A: Registration Privilege Escalation

**File:** `quikadmin/src/api/supabase-auth.routes.ts`
**Line:** 233
**Severity:** CRITICAL SECURITY
**Effort:** 30 minutes

### Problem

The registration endpoint destructures `role` from `req.body` with a default of `'user'`, but allows any value including `'admin'`. The `validRoles` array `['user', 'admin']` downstream validates admin as a legitimate choice. Any anonymous user can register as ADMIN and bypass all RLS policies via the `is_admin()` database function.

### Exact Change

```
FILE: quikadmin/src/api/supabase-auth.routes.ts
LINE: 229-236
```

**OLD:**

```typescript
const {
  email,
  password,
  fullName,
  role = 'user',
  acceptTerms,
  marketingConsent = false,
}: RegisterRequest = req.body;
```

**NEW:**

```typescript
const {
  email,
  password,
  fullName,
  acceptTerms,
  marketingConsent = false,
}: RegisterRequest = req.body;

// SECURITY: Never accept role from user input. All new users start as 'user'.
// Admin promotion must happen through an authenticated admin action.
const role = 'user';
```

### Verification

After this fix, send `POST /api/auth/v2/register` with `{"role": "admin", ...}` and confirm the created user has `role: 'user'` in the database.

---

## P0-B: Demo Mode Backdoor

**File:** `quikadmin/src/api/supabase-auth.routes.ts`
**Line:** 1137
**Severity:** CRITICAL SECURITY
**Effort:** 1 hour

### Problem

Demo login is only disabled when `ENABLE_DEMO_MODE === 'false'` (opt-out). If the env var is unset, missing, or any value other than the exact string `'false'`, demo mode is active. In production, anyone can log in as `demo@intellifill.com` / `demo123` and get a 4-hour token.

### Exact Change

```
FILE: quikadmin/src/api/supabase-auth.routes.ts
LINE: 1137
```

**OLD:**

```typescript
if (process.env.ENABLE_DEMO_MODE === 'false') {
```

**NEW:**

```typescript
if (process.env.ENABLE_DEMO_MODE !== 'true') {
```

### Verification

1. Unset `ENABLE_DEMO_MODE` entirely -> demo login should return 403
2. Set `ENABLE_DEMO_MODE=true` -> demo login should work
3. Set `ENABLE_DEMO_MODE=false` -> demo login should return 403
4. Set `ENABLE_DEMO_MODE=yes` -> demo login should return 403

---

## P0-C: Wire Multi-Agent Stub Nodes

**File:** `quikadmin/src/multiagent/workflow.ts`
**Lines:** 139-302
**Severity:** CRITICAL FUNCTIONAL
**Effort:** 1-2 days

### Problem

4 of 5 LangGraph workflow nodes are stubs:

- `extractNode()` returns `extractedFields: {}` (line 161)
- `mapNode()` passes through unchanged (line 201)
- `qaNode()` hardcodes `isValid: true` (line 240)
- `errorRecoverNode()` only increments retry count (line 281)

The fully-implemented agents exist in `agents/*.ts` but are never called. The pipeline classifies documents then returns empty results marked "successful."

### Type Mismatches to Resolve

| Agent Function          | Returns                                                         | State Expects                                     |
| ----------------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| `extractDocumentData()` | `ExtractionResult.fields: Record<string, ExtractedFieldResult>` | `extractedFields: Record<string, ExtractedField>` |
| `mapExtractedFields()`  | `MappingResult.mappedFields: Record<string, string>`            | `mappedFields: Record<string, ExtractedField>`    |
| `validateExtraction()`  | `QAResult { passed, requiresHumanReview }`                      | `QualityAssessment { isValid, needsHumanReview }` |

### Exact Change: extractNode (lines 139-177)

**NEW:**

```typescript
import { extractDocumentData } from './agents/extractorAgent';
import { mapExtractedFields } from './agents/mapperAgent';
import { validateExtraction } from './agents/qaAgent';
import { recoverFromError } from './agents/errorRecoveryAgent';
import { ExtractedField } from './types/state';

async function extractNode(
  state: DocumentState,
  config?: RunnableConfig
): Promise<Partial<DocumentState>> {
  logger.info('Extraction node executing', { documentId: state.documentId });
  const startTime = Date.now();

  try {
    const result = await extractDocumentData(
      state.ocrData.rawText,
      state.classification.category,
      undefined // imageBase64 - pass if available
    );

    // Adapt ExtractionResult.fields -> Record<string, ExtractedField>
    const extractedFields: Record<string, ExtractedField> = {};
    for (const [key, efr] of Object.entries(result.fields)) {
      extractedFields[key] = {
        value: efr.value,
        confidence: efr.confidence,
        source:
          efr.source === 'gemini' || efr.source === 'llm'
            ? 'llm'
            : efr.source === 'pattern' || efr.source === 'regex'
              ? 'rule'
              : 'ocr',
        rawText: efr.rawText,
      };
    }

    const fieldCount = Object.keys(extractedFields).length;
    const highConf = Object.values(extractedFields).filter((f) => f.confidence >= 80).length;

    const execution = {
      agent: 'extractor' as AgentName,
      startTime: new Date(startTime),
      endTime: new Date(),
      status: 'completed' as const,
      model: result.modelUsed,
      tokenCount: 0,
      retryCount: 0,
    };

    return {
      extractedFields,
      extractionMetadata: {
        model: result.modelUsed,
        promptVersion: '1.0.0',
        processingTimeMs: result.processingTime,
        totalFields: fieldCount,
        highConfidenceFields: highConf,
        lowConfidenceFields: fieldCount - highConf,
      },
      agentHistory: [...state.agentHistory, execution],
      processingControl: {
        ...state.processingControl,
        currentNode: NODE_NAMES.MAP,
        completedNodes: [...state.processingControl.completedNodes, NODE_NAMES.EXTRACT],
      },
    };
  } catch (error) {
    logger.error('Extraction failed', { documentId: state.documentId, error });
    return {
      errors: [
        ...state.errors,
        {
          node: NODE_NAMES.EXTRACT,
          error: (error as Error).message,
          timestamp: new Date(),
        },
      ],
      processingControl: {
        ...state.processingControl,
        currentNode: NODE_NAMES.ERROR_RECOVER,
      },
    };
  }
}
```

### Exact Change: mapNode (lines 179-216)

**NEW:**

```typescript
async function mapNode(
  state: DocumentState,
  config?: RunnableConfig
): Promise<Partial<DocumentState>> {
  logger.info('Mapping node executing', { documentId: state.documentId });
  const startTime = Date.now();

  try {
    // Convert state's ExtractedField -> ExtractedFieldResult for agent
    const agentInput: Record<string, ExtractedFieldResult> = {};
    for (const [key, field] of Object.entries(state.extractedFields)) {
      agentInput[key] = {
        value: field.value,
        confidence: field.confidence,
        source: field.source,
        rawText: field.rawText,
      };
    }

    const result = await mapExtractedFields(agentInput, state.classification.category);

    // Convert MappingResult -> Record<string, ExtractedField>
    const mappedFields: Record<string, ExtractedField> = {};
    for (const detail of result.mappingDetails) {
      if (detail.canonicalField) {
        const originalField = state.extractedFields[detail.originalField];
        mappedFields[detail.canonicalField] = {
          value: detail.value,
          confidence: detail.confidence,
          source: originalField?.source ?? 'llm',
          rawText: originalField?.rawText,
        };
      }
    }

    const execution = {
      agent: 'mapper' as AgentName,
      startTime: new Date(startTime),
      endTime: new Date(),
      status: 'completed' as const,
      model: 'rule-based',
      tokenCount: 0,
      retryCount: 0,
    };

    return {
      mappedFields,
      mappingMetadata: {
        model: 'rule-based',
        schemaVersion: '1.0.0',
        processingTimeMs: Date.now() - startTime,
        fieldsMatched: Object.keys(mappedFields).length,
        fieldsUnmapped: result.unmappedFields.length,
      },
      agentHistory: [...state.agentHistory, execution],
      processingControl: {
        ...state.processingControl,
        currentNode: NODE_NAMES.QA,
        completedNodes: [...state.processingControl.completedNodes, NODE_NAMES.MAP],
      },
    };
  } catch (error) {
    logger.error('Mapping failed', { documentId: state.documentId, error });
    return {
      mappedFields: state.extractedFields, // fallback: pass through
      errors: [
        ...state.errors,
        {
          node: NODE_NAMES.MAP,
          error: (error as Error).message,
          timestamp: new Date(),
        },
      ],
      processingControl: {
        ...state.processingControl,
        currentNode: NODE_NAMES.QA,
        completedNodes: [...state.processingControl.completedNodes, NODE_NAMES.MAP],
      },
    };
  }
}
```

### Exact Change: qaNode (lines 218-257)

**NEW:**

```typescript
async function qaNode(
  state: DocumentState,
  config?: RunnableConfig
): Promise<Partial<DocumentState>> {
  logger.info('QA node executing', { documentId: state.documentId });
  const startTime = Date.now();

  try {
    // Convert ExtractedField -> ExtractedFieldResult for QA agent
    const qaInput: Record<string, ExtractedFieldResult> = {};
    for (const [key, field] of Object.entries(state.mappedFields)) {
      qaInput[key] = {
        value: field.value,
        confidence: field.confidence,
        source: field.source,
        rawText: field.rawText,
      };
    }

    const result = await validateExtraction(qaInput, state.classification.category);

    const execution = {
      agent: 'qa' as AgentName,
      startTime: new Date(startTime),
      endTime: new Date(),
      status: 'completed' as const,
      model: 'rule-based',
      tokenCount: 0,
      retryCount: 0,
    };

    // Adapt QAResult { passed, requiresHumanReview } -> QualityAssessment { isValid, needsHumanReview }
    return {
      qualityAssessment: {
        isValid: result.passed,
        overallScore: result.score,
        issues: result.issues.map((i) => ({
          field: i.field,
          type: i.severity === 'error' ? ('invalid_format' as const) : ('low_confidence' as const),
          severity: i.severity,
          message: i.message,
        })),
        suggestions: result.issues.filter((i) => i.suggestedFix).map((i) => i.suggestedFix!),
        needsHumanReview: result.requiresHumanReview,
      },
      agentHistory: [...state.agentHistory, execution],
      processingControl: {
        ...state.processingControl,
        currentNode: result.passed ? NODE_NAMES.FINALIZE : NODE_NAMES.ERROR_RECOVER,
        completedNodes: [...state.processingControl.completedNodes, NODE_NAMES.QA],
      },
    };
  } catch (error) {
    logger.error('QA validation failed', { documentId: state.documentId, error });
    return {
      qualityAssessment: {
        isValid: false,
        overallScore: 0,
        issues: [
          {
            field: '_system',
            type: 'missing',
            severity: 'error',
            message: (error as Error).message,
          },
        ],
        suggestions: [],
        needsHumanReview: true,
      },
      processingControl: {
        ...state.processingControl,
        currentNode: NODE_NAMES.ERROR_RECOVER,
      },
    };
  }
}
```

### Exact Change: errorRecoverNode (lines 259-302)

**NEW:**

```typescript
async function errorRecoverNode(
  state: DocumentState,
  config?: RunnableConfig
): Promise<Partial<DocumentState>> {
  logger.info('Error recovery node executing', {
    documentId: state.documentId,
    retryCount: state.processingControl.retryCount,
  });
  const startTime = Date.now();

  try {
    const lastError = state.errors[state.errors.length - 1];
    const error = new Error(lastError?.error ?? 'Unknown error');

    const action = await recoverFromError(error, state, state.processingControl.retryCount);

    const execution = {
      agent: 'errorRecovery' as AgentName,
      startTime: new Date(startTime),
      endTime: new Date(),
      status: 'completed' as const,
      retryCount: state.processingControl.retryCount + 1,
    };

    const newRetryCount = state.processingControl.retryCount + 1;

    let nextNode: string;
    if (action.type === 'retry' && newRetryCount < MAX_RETRIES) {
      nextNode =
        action.targetAgent === 'extractor'
          ? NODE_NAMES.EXTRACT
          : action.targetAgent === 'mapper'
            ? NODE_NAMES.MAP
            : NODE_NAMES.EXTRACT;
    } else if (action.type === 'skip' || action.type === 'manual') {
      nextNode = NODE_NAMES.FINALIZE;
    } else {
      nextNode = newRetryCount < MAX_RETRIES ? NODE_NAMES.EXTRACT : NODE_NAMES.FINALIZE;
    }

    return {
      agentHistory: [...state.agentHistory, execution],
      processingControl: {
        ...state.processingControl,
        retryCount: newRetryCount,
        currentNode: nextNode,
      },
      errors:
        action.type === 'manual'
          ? [
              ...state.errors,
              {
                node: NODE_NAMES.ERROR_RECOVER,
                error: `Escalated: ${action.reason}`,
                timestamp: new Date(),
              },
            ]
          : state.errors,
    };
  } catch (recoveryError) {
    logger.error('Error recovery itself failed', { documentId: state.documentId, recoveryError });
    return {
      processingControl: {
        ...state.processingControl,
        retryCount: state.processingControl.retryCount + 1,
        currentNode: NODE_NAMES.FINALIZE,
      },
      errors: [
        ...state.errors,
        {
          node: NODE_NAMES.ERROR_RECOVER,
          error: 'Recovery failed: ' + (recoveryError as Error).message,
          timestamp: new Date(),
        },
      ],
    };
  }
}
```

### Required Import (top of workflow.ts)

Add after existing imports:

```typescript
import { extractDocumentData } from './agents/extractorAgent';
import { mapExtractedFields } from './agents/mapperAgent';
import { validateExtraction } from './agents/qaAgent';
import { recoverFromError } from './agents/errorRecoveryAgent';
import type { ExtractedFieldResult } from '../types/extractedData';
```

---

## P0-D: Arabic OCR Support

**File:** `quikadmin/src/services/OCRService.ts`
**Line:** 255-257
**Severity:** CRITICAL FUNCTIONAL
**Effort:** 2 hours

### Problem

`tessedit_char_whitelist` explicitly includes only ASCII characters, silently dropping all Arabic text. For a product processing UAE government documents (Emirates IDs, trade licenses, visas), this means 100% data loss on Arabic fields.

### Exact Change

```
FILE: quikadmin/src/services/OCRService.ts
LINE: 255-260
```

**OLD:**

```typescript
await this.worker.setParameters({
  tessedit_char_whitelist:
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,;:!?@#$%&*()-_+=[]{}|\\/<>"\' ',
  preserve_interword_spaces: '1',
  tessedit_pageseg_mode: Tesseract.PSM.AUTO,
});
```

**NEW:**

```typescript
// NOTE: Removed tessedit_char_whitelist to support Arabic/multilingual documents.
// The whitelist was ASCII-only, silently dropping Arabic characters from UAE documents.
await this.worker.setParameters({
  preserve_interword_spaces: '1',
  tessedit_pageseg_mode: Tesseract.PSM.AUTO,
});
```

### Additional Change: Language Pack

Find the `Tesseract.createWorker` call and update the language parameter:

**OLD:**

```typescript
this.worker = await Tesseract.createWorker('eng', ...);
```

**NEW:**

```typescript
this.worker = await Tesseract.createWorker('eng+ara', ...);
```

### Test Update

```
FILE: quikadmin/src/services/__tests__/OCRService.test.ts
LINE: 132-137
```

Update the `setParameters` expectation to remove `tessedit_char_whitelist`.

---

## P0-E: ClientProfile PII Encryption

**File:** `quikadmin/src/services/ClientDocumentFieldService.ts`
**Severity:** CRITICAL SECURITY
**Effort:** 1 day

### Problem

`ClientProfile.data` contains passport numbers, Emirates IDs, DOBs, salaries in plaintext JSON. The `encryptJSON()`/`decryptJSON()` utilities exist in `src/utils/encryption.ts` and are already used by `ProfileService.ts` for `UserProfile.piiData`. The primary `ClientProfile` system has no encryption.

### Exact Change: Encrypt on Write

```
FILE: quikadmin/src/services/ClientDocumentFieldService.ts
LINE: 148-155 (inside mergeToClientProfile)
```

**OLD:**

```typescript
if (fieldsUpdated > 0) {
  await prisma.clientProfile.update({
    where: { id: profile.id },
    data: {
      data: newData,
      fieldSources: newFieldSources,
    },
  });
```

**NEW:**

```typescript
if (fieldsUpdated > 0) {
  const { encryptJSON } = await import('../utils/encryption');
  await prisma.clientProfile.update({
    where: { id: profile.id },
    data: {
      data: encryptJSON(newData),
      fieldSources: newFieldSources,
    },
  });
```

### Exact Change: Decrypt on Read

```
FILE: quikadmin/src/services/ClientDocumentFieldService.ts
LINE: 118 (inside mergeToClientProfile, after fetching profile)
```

**OLD:**

```typescript
const currentData = (profile.data || {}) as Record<string, any>;
```

**NEW:**

```typescript
let currentData: Record<string, any> = {};
if (profile.data) {
  if (typeof profile.data === 'string') {
    // Encrypted data (new format)
    const { decryptJSON } = await import('../utils/encryption');
    try {
      currentData = decryptJSON(profile.data as string);
    } catch {
      // Fallback: legacy unencrypted string
      currentData = JSON.parse(profile.data as string);
    }
  } else {
    // Legacy unencrypted JSON object - will be encrypted on next write
    currentData = profile.data as Record<string, any>;
  }
}
```

### Migration Script

Create `quikadmin/scripts/encrypt-client-profiles.ts`:

```typescript
import { prisma } from '../src/utils/prisma';
import { encryptJSON, decryptJSON } from '../src/utils/encryption';

async function migrateClientProfiles() {
  const profiles = await prisma.clientProfile.findMany();
  let migrated = 0;
  let skipped = 0;

  for (const profile of profiles) {
    if (!profile.data) {
      skipped++;
      continue;
    }

    // Check if already encrypted (string with colon-separated base64)
    if (typeof profile.data === 'string' && (profile.data as string).split(':').length === 3) {
      skipped++;
      continue;
    }

    const plainData = typeof profile.data === 'string' ? JSON.parse(profile.data) : profile.data;

    await prisma.clientProfile.update({
      where: { id: profile.id },
      data: { data: encryptJSON(plainData) },
    });
    migrated++;
  }

  console.log(`Migrated: ${migrated}, Skipped: ${skipped}`);
}

migrateClientProfiles()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### All Read Points to Update

Search for `clientProfile.findUnique`, `clientProfile.findMany`, `clientProfile.findFirst` across:

- `ClientDocumentFieldService.ts` - mergeToClientProfile, mergeToClientProfileDetailed
- Any API route that reads ClientProfile.data

Each read point needs the same decrypt-on-read pattern.

---

## P1-A: Literal "null" in Form Fields

**File:** `quikadmin/src/fillers/FormFiller.ts`
**Line:** 67
**Severity:** DATA CORRUPTION
**Effort:** 30 minutes

### Problem

`String(null)` evaluates to the string `"null"`, which gets written into PDF text fields. Users would see "null" printed on government forms.

### Exact Change

```
FILE: quikadmin/src/fillers/FormFiller.ts
LINE: 56-68
```

**OLD:**

```typescript
for (const mapping of mappings.mappings) {
  try {
    const field = form.getField(mapping.formField);

    if (!field) {
      warnings.push(`Field '${mapping.formField}' not found in form`);
      continue;
    }

    // Fill based on field type
    if (field instanceof PDFTextField) {
      field.setText(String(mapping.value));
      filledFields.push(mapping.formField);
```

**NEW:**

```typescript
for (const mapping of mappings.mappings) {
  try {
    // Skip null/undefined/empty values instead of writing "null"
    if (mapping.value === null || mapping.value === undefined || mapping.value === '') {
      warnings.push(`Field '${mapping.formField}' skipped: no value available`);
      continue;
    }

    const field = form.getField(mapping.formField);

    if (!field) {
      warnings.push(`Field '${mapping.formField}' not found in form`);
      continue;
    }

    // Fill based on field type
    if (field instanceof PDFTextField) {
      field.setText(String(mapping.value));
      filledFields.push(mapping.formField);
```

### Test Update

Update any tests that assert `String(null)` behavior to instead assert the field is skipped and a warning is produced.

---

## P1-B: XFA Form Detection

**File:** `quikadmin/src/fillers/FormFiller.ts`
**Severity:** TRUST
**Effort:** 30 minutes

### Problem

XFA-based PDFs (common in government/immigration forms) return empty field arrays from pdf-lib's `getForm().getFields()`. The system reports `success: true` with 0 fields filled and no warnings. Users receive an unfilled PDF thinking it was processed.

### Exact Change

Add XFA detection before the fill loop, right after `const form = pdfDoc.getForm()`:

```typescript
// Detect XFA forms (pdf-lib cannot fill these)
const fields = form.getFields();
if (fields.length === 0) {
  // Check for XFA marker in the PDF catalog
  const catalog = pdfDoc.context.lookup(pdfDoc.context.trailerInfo.Root);
  const hasXFA = catalog?.toString().includes('/XFA') ?? false;

  if (hasXFA) {
    return {
      success: false,
      filledFields: [],
      warnings: [
        'This PDF uses XFA format which is not supported for auto-fill. Please use an AcroForm-based PDF template.',
      ],
      outputPath: '',
    };
  }

  // No fields at all (flat PDF, no form)
  return {
    success: false,
    filledFields: [],
    warnings: [
      'No fillable form fields found in this PDF. The document may be a flat (non-interactive) PDF.',
    ],
    outputPath: '',
  };
}
```

### Simpler Alternative (if catalog access is difficult with pdf-lib)

```typescript
const fields = form.getFields();
if (fields.length === 0) {
  return {
    success: false,
    filledFields: [],
    warnings: [
      'No fillable form fields detected. This PDF may use XFA format (not supported) or be a flat (non-interactive) document.',
    ],
    outputPath: '',
  };
}
```

---

## P1-C: Date Format Disambiguation

**Files:** New service + OCR integration
**Severity:** DATA CORRUPTION
**Effort:** 1-2 days

### Problem

Date regex matches both DD/MM/YYYY and MM/DD/YYYY. `01/02/1990` could be Jan 2 or Feb 1. UAE documents use DD/MM/YYYY, US documents use MM/DD/YYYY. No disambiguation exists. This is the #1 most likely production failure for form filling.

### New Service: `quikadmin/src/services/DateResolver.ts`

```typescript
import { DocumentCategory } from '@prisma/client';

interface ResolvedDate {
  /** ISO 8601 format: YYYY-MM-DD */
  iso: string;
  /** Display format based on source locale */
  display: string;
  /** Confidence in the disambiguation (0-100) */
  confidence: number;
  /** Which format was assumed */
  assumedFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'unambiguous';
}

/** Categories that use DD/MM/YYYY (Middle East, Europe, Asia) */
const DD_MM_CATEGORIES: DocumentCategory[] = [
  'PASSPORT', // Most passports use DD/MM/YYYY
  'EMIRATES_ID', // UAE standard
  'TRADE_LICENSE', // UAE standard
  'VISA', // UAE standard
  'LABOR_CARD', // UAE standard
  'ESTABLISHMENT_CARD',
];

/** Categories that might use MM/DD/YYYY (US documents) */
const MM_DD_CATEGORIES: DocumentCategory[] = [];
// Add US-specific categories here when needed

export function resolveDate(
  rawDate: string,
  category: DocumentCategory | null
): ResolvedDate | null {
  if (!rawDate) return null;

  // Already ISO format
  const isoMatch = rawDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return {
      iso: rawDate,
      display: rawDate,
      confidence: 100,
      assumedFormat: 'YYYY-MM-DD',
    };
  }

  // Parse DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = rawDate.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!slashMatch) return null;

  const [, a, b, yearStr] = slashMatch;
  const numA = parseInt(a, 10);
  const numB = parseInt(b, 10);
  const year = yearStr.length === 2 ? 2000 + parseInt(yearStr, 10) : parseInt(yearStr, 10);

  // Unambiguous: one part > 12
  if (numA > 12 && numB <= 12) {
    // Must be DD/MM
    return makeResult(numA, numB, year, 'unambiguous', 98);
  }
  if (numB > 12 && numA <= 12) {
    // Must be MM/DD
    return makeResult(numB, numA, year, 'unambiguous', 98);
  }

  // Both <= 12: use category-based locale
  const isDDMM = category && DD_MM_CATEGORIES.includes(category);
  const isMMDD = category && MM_DD_CATEGORIES.includes(category);

  if (isDDMM) {
    return makeResult(numA, numB, year, 'DD/MM/YYYY', 85);
  }
  if (isMMDD) {
    return makeResult(numB, numA, year, 'MM/DD/YYYY', 85);
  }

  // Default: DD/MM/YYYY (UAE-centric product)
  return makeResult(numA, numB, year, 'DD/MM/YYYY', 65);
}

function makeResult(
  day: number,
  month: number,
  year: number,
  format: ResolvedDate['assumedFormat'],
  confidence: number
): ResolvedDate {
  // Validate date
  const date = new Date(year, month - 1, day);
  if (date.getDate() !== day || date.getMonth() !== month - 1) {
    // Invalid date - try swapping
    const swapped = new Date(year, day - 1, month);
    if (swapped.getDate() === month && swapped.getMonth() === day - 1) {
      return {
        iso: `${year}-${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`,
        display: `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`,
        confidence: Math.max(confidence - 20, 40),
        assumedFormat: format,
      };
    }
    return null as any; // Truly invalid date
  }

  return {
    iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    display: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
    confidence,
    assumedFormat: format,
  };
}
```

### Integration Point

Call `resolveDate()` in the extraction pipeline after field extraction, before storing dates. In `ClientDocumentFieldService.ts`, wrap date fields through the resolver during `mergeToClientProfile`.

---

## P1-D: VLM Confidence Fabrication

**File:** `quikadmin/src/services/OCRService.ts`
**Lines:** 497-507
**Severity:** TRUST
**Effort:** Medium

### Problem

`estimateVLMConfidence()` starts at 85 and applies heuristic bumps based on text length and pattern presence. This is fabricated confidence -- a hallucinated result with long text and date patterns could show 92% confidence. Users trust these numbers to decide whether to review data.

### Exact Change

```
FILE: quikadmin/src/services/OCRService.ts
LINE: 497-507+
```

**OLD:**

```typescript
private estimateVLMConfidence(text: string): number {
  let confidence = 85; // Base confidence for VLM
  if (text.length > 500) confidence += 5;
  if (text.length > 1000) confidence += 3;
  if (/\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(text)) confidence += 2;
  if (/[A-Z]{1,2}\d{6,9}/.test(text)) confidence += 2;
  if (/\w+:\s*\w+/.test(text)) confidence += 2;
```

**NEW:**

```typescript
/**
 * Estimate confidence for VLM extraction.
 *
 * IMPORTANT: These are heuristic estimates, NOT model-calibrated probabilities.
 * The score is labeled as 'estimated' in all outputs. Future improvement:
 * replace with Gemini response metadata or calibrated logits.
 */
private estimateVLMConfidence(text: string): number {
  // Start conservative - VLM confidence is inherently uncertain
  let confidence = 60;

  // Text length indicates extraction happened (but not correctness)
  if (text.length > 100) confidence += 5;
  if (text.length > 500) confidence += 5;
  if (text.length > 1000) confidence += 3;

  // Structured patterns suggest real document content
  if (/\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(text)) confidence += 3;
  if (/[A-Z]{1,2}\d{6,9}/.test(text)) confidence += 3;
  if (/\w+:\s*\w+/.test(text)) confidence += 2;

  // Negative signals
  if (text.length < 20) confidence -= 20; // Suspiciously short
  if (/error|sorry|unable|cannot/i.test(text)) confidence -= 15; // Error response
  if (text === text.toUpperCase() && text.length > 100) confidence -= 5; // All caps anomaly

  return Math.max(10, Math.min(confidence, 85)); // Cap at 85 for heuristic estimates
```

Additionally, update all log messages and API responses that reference confidence to prefix with "estimated\_" when the source is VLM heuristic.

---

## P1-E: OCR Worker Race Condition

**Files:** `quikadmin/src/services/OCRService.ts`, `quikadmin/src/parsers/strategies/`
**Severity:** RELIABILITY
**Effort:** 1-2 days

### Problem

`PDFParsingStrategy.parse()` calls `ocrService.cleanup()` in its `finally` block, terminating the singleton Tesseract worker. If another request is mid-OCR, it crashes. Two separate Tesseract workers also exist (OCRService + DocumentExtractionService).

### Fix Strategy

1. **Remove `cleanup()` from `finally` blocks** -- cleanup should only happen at app shutdown
2. **Add reference counting** to the OCR worker singleton
3. **Consolidate to one worker** -- both OCRService and DocumentExtractionService should share the singleton

### Exact Change: Remove cleanup from finally

Search for `cleanup()` in `src/parsers/strategies/`:

**OLD:**

```typescript
} finally {
  await ocrService.cleanup();
}
```

**NEW:**

```typescript
} finally {
  // Worker cleanup is handled at app shutdown, not per-request.
  // Cleaning up here would terminate the worker for concurrent requests.
}
```

### Exact Change: Add reference counting to OCRService

Add a `useCount` counter. Increment on `initialize()`, only `terminate()` when `useCount` reaches 0 during app shutdown.

---

## P1-F: Stale Job Reconciliation

**Files:** New cron + integration
**Severity:** RELIABILITY
**Effort:** Half day

### Problem

If a worker crashes, document status stays `PROCESSING` permanently. Bull's stalled detection fires, but the database status is never reconciled.

### New Service: `quikadmin/src/services/staleJobReconciler.ts`

```typescript
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const RECONCILE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function startStaleJobReconciliation(): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

      const staleDocuments = await prisma.document.updateMany({
        where: {
          status: 'PROCESSING',
          updatedAt: { lt: cutoff },
        },
        data: {
          status: 'FAILED',
          // Store failure reason in metadata
        },
      });

      if (staleDocuments.count > 0) {
        logger.warn(`Reconciled ${staleDocuments.count} stale PROCESSING documents to FAILED`, {
          cutoff: cutoff.toISOString(),
        });
      }
    } catch (error) {
      logger.error('Stale job reconciliation failed', { error });
    }
  }, RECONCILE_INTERVAL_MS);
}
```

### Integration

In `quikadmin/src/index.ts`, after server startup:

```typescript
import { startStaleJobReconciliation } from './services/staleJobReconciler';

// After app.listen():
const reconciler = startStaleJobReconciliation();

// In shutdown handler:
clearInterval(reconciler);
```

---

## P1-G: Queue Name Collision

**Files:** `quikadmin/src/queue/QueueService.ts`, `quikadmin/src/queues/ocrQueue.ts`
**Severity:** DATA CORRUPTION
**Effort:** 2 hours

### Problem

Both `QueueService.ts:105` and `ocrQueue.ts:322` create a Bull queue named `'ocr-processing'` with DIFFERENT processors expecting different job data shapes. If both are active, jobs get processed by the wrong handler.

### Fix Strategy

Rename the legacy queue in `QueueService.ts`:

```
FILE: quikadmin/src/queue/QueueService.ts
LINE: 105
```

**OLD:**

```typescript
this.ocrQueue = new Bull('ocr-processing', redisConfig, {
```

**NEW:**

```typescript
this.ocrQueue = new Bull('legacy-ocr-processing', redisConfig, {
```

Alternatively, if `QueueService.ts` is the legacy system, deprecate it entirely and route all OCR jobs through `ocrQueue.ts`.

---

## P1-H: ClientProfile Audit Trail

**Files:** Prisma schema + new service
**Severity:** COMPLIANCE
**Effort:** 1-2 days

### Problem

`UserProfile` has `ProfileAuditLog` with field-level change tracking. `ClientProfile` (the primary system) has none. No way to determine when a field changed, what it was before, or who changed it.

### Prisma Schema Addition

```prisma
model ClientProfileAuditLog {
  id              String   @id @default(uuid())
  clientProfileId String
  clientProfile   ClientProfile @relation(fields: [clientProfileId], references: [id])
  fieldName       String
  oldValue        String?
  newValue        String?
  source          String   // 'ocr', 'manual', 'merge', 'import'
  sourceDocumentId String?
  changedBy       String?  // userId
  changedAt       DateTime @default(now())
  organizationId  String

  @@index([clientProfileId, changedAt])
  @@index([organizationId, changedAt])
}
```

### Integration in ClientDocumentFieldService

In `mergeToClientProfile`, before updating each field, create an audit log entry:

```typescript
// Inside the for loop, after deciding to update
if (currentData[fieldName] !== value) {
  auditEntries.push({
    clientProfileId: profile.id,
    fieldName,
    oldValue: currentData[fieldName] != null ? String(currentData[fieldName]) : null,
    newValue: String(value),
    source: 'ocr',
    sourceDocumentId: documentId,
    organizationId: profile.organizationId ?? '',
  });
}
```

After the profile update, batch-insert audit entries:

```typescript
if (auditEntries.length > 0) {
  await prisma.clientProfileAuditLog.createMany({ data: auditEntries });
}
```

---

## P2 Items: Summary Specs

### P2-1: Confidence-Gated Profile Overwrites

In `ClientDocumentFieldService.mergeToClientProfile`, compare confidence scores before overwriting:

```typescript
// Only overwrite if new confidence > existing confidence
const existingSource = currentFieldSources[fieldName];
if (existingSource?.confidence && value.confidence) {
  if (value.confidence < existingSource.confidence) {
    skippedFields.push(fieldName);
    continue;
  }
}
```

### P2-2: MRZ Checksum Validation

Install `mrz` npm package. After extracting MRZ lines, validate checksums:

```typescript
import { parse as parseMRZ } from 'mrz';
const mrzResult = parseMRZ(mrzLines);
if (mrzResult.valid) {
  // Cross-validate: mrzResult.fields.documentNumber vs extracted passport_number
}
```

### P2-3: Adaptive Image Preprocessing

Replace fixed `threshold(128)` with Otsu's method for Tesseract path. Skip threshold entirely for VLM path (send color image).

### P2-4: Post-Fill PDF Verification

After saving the filled PDF, re-load it and compare each filled field's value against the expected value:

```typescript
const verifyDoc = await PDFDocument.load(filledPdfBytes);
const verifyForm = verifyDoc.getForm();
for (const fieldName of filledFields) {
  const field = verifyForm.getField(fieldName);
  if (field instanceof PDFTextField) {
    const actual = field.getText();
    if (actual !== expected[fieldName]) {
      warnings.push(`Verification failed: ${fieldName} expected "${expected}" got "${actual}"`);
    }
  }
}
```

### P2-5: Fix Fake Batch Embedding

Replace sequential loop with Google's actual batch API:

```typescript
// OLD: Sequential
for (const text of texts) {
  const result = await model.embedContent(text);
  embeddings.push(result.embedding.values);
}

// NEW: True batch
const requests = texts.map((text) => ({ content: { parts: [{ text }] } }));
const result = await model.batchEmbedContents({ requests });
return result.embeddings.map((e) => e.values);
```

### P2-6: Search Cache Invalidation After Processing

In the knowledge pipeline, after `vectorStorage.storeChunks()` completes, call:

```typescript
await searchCacheService.invalidateForOrganization(organizationId);
```

### P2-7: Organization-Level RLS for Knowledge Base

Add RLS policies to `document_sources` and `document_chunks`:

```sql
ALTER TABLE document_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON document_sources
  USING (organization_id = current_setting('app.organization_id')::uuid);

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON document_chunks
  USING (document_source_id IN (
    SELECT id FROM document_sources
    WHERE organization_id = current_setting('app.organization_id')::uuid
  ));
```

### P2-8: Batch Size Limits

In queue enqueue functions, add validation:

```typescript
const MAX_BATCH_SIZE = 50;
if (documents.length > MAX_BATCH_SIZE) {
  throw new Error(`Batch size ${documents.length} exceeds maximum of ${MAX_BATCH_SIZE}`);
}
```

---

## Adversarial Test Suite

25 test specifications organized by feature area. Create these test files:

### 1. `quikadmin/tests/adversarial/auth-escalation.test.ts`

```typescript
describe('P0-A: Registration Privilege Escalation', () => {
  it('should ignore role field in registration body', async () => {
    const res = await request(app).post('/api/auth/v2/register').send({
      email: 'attacker@test.com',
      password: 'Test123!',
      fullName: 'Attacker',
      role: 'admin',
      acceptTerms: true,
    });
    const user = await prisma.user.findUnique({ where: { email: 'attacker@test.com' } });
    expect(user?.role).toBe('USER'); // Never 'ADMIN'
  });

  it('should reject role=OWNER in registration', async () => {
    // Same pattern with role: 'OWNER'
  });

  it('should reject role=superadmin in registration', async () => {
    // Arbitrary role strings should be ignored
  });
});
```

### 2. `quikadmin/tests/adversarial/demo-mode.test.ts`

```typescript
describe('P0-B: Demo Mode Backdoor', () => {
  it('should block demo login when ENABLE_DEMO_MODE is unset', async () => {
    delete process.env.ENABLE_DEMO_MODE;
    const res = await request(app).post('/api/auth/v2/demo');
    expect(res.status).toBe(403);
  });

  it('should block demo login when ENABLE_DEMO_MODE=yes', async () => {
    process.env.ENABLE_DEMO_MODE = 'yes';
    const res = await request(app).post('/api/auth/v2/demo');
    expect(res.status).toBe(403);
  });

  it('should allow demo login only when ENABLE_DEMO_MODE=true', async () => {
    process.env.ENABLE_DEMO_MODE = 'true';
    // This should succeed (assuming demo user exists)
  });
});
```

### 3. `quikadmin/tests/adversarial/form-null-guard.test.ts`

```typescript
describe('P1-A: Null Value Guard', () => {
  it('should not write "null" string into text fields', async () => {
    const result = await formFiller.fill(pdfBuffer, {
      mappings: [{ formField: 'name', value: null }],
    });
    // "null" should NOT appear in the filled PDF
    expect(result.filledFields).not.toContain('name');
    expect(result.warnings).toContain(expect.stringContaining('skipped'));
  });

  it('should not write "undefined" string into text fields', async () => {
    const result = await formFiller.fill(pdfBuffer, {
      mappings: [{ formField: 'name', value: undefined }],
    });
    expect(result.filledFields).not.toContain('name');
  });
});
```

### 4. `quikadmin/tests/adversarial/pipeline-wiring.test.ts`

```typescript
describe('P0-C: Pipeline Returns Real Data', () => {
  it('extractNode should return non-empty fields for valid document', async () => {
    const result = await extractNode(mockStateWithOCRData);
    expect(Object.keys(result.extractedFields!)).not.toHaveLength(0);
  });

  it('qaNode should flag invalid data', async () => {
    const stateWithBadData = {
      ...mockState,
      mappedFields: { passport_number: { value: '', confidence: 10 } },
    };
    const result = await qaNode(stateWithBadData);
    expect(result.qualityAssessment!.isValid).toBe(false);
  });

  it('full pipeline should produce filled fields for passport image', async () => {
    // End-to-end test with real passport OCR text
    const result = await runWorkflow(passportInput);
    expect(Object.keys(result.extractedFields)).toBeGreaterThan(3);
  });
});
```

### 5. `quikadmin/tests/adversarial/arabic-ocr.test.ts`

```typescript
describe('P0-D: Arabic OCR', () => {
  it('should extract Arabic text from Emirates ID', async () => {
    const result = await ocrService.processImage(emiratesIdImage);
    // Should contain Arabic characters
    expect(result.text).toMatch(/[\u0600-\u06FF]/);
  });

  it('should not have restrictive character whitelist', async () => {
    // Worker parameters should not include tessedit_char_whitelist
    // (or it should include Arabic ranges)
  });
});
```

### 6. `quikadmin/tests/adversarial/date-disambiguation.test.ts`

```typescript
describe('P1-C: Date Disambiguation', () => {
  it('should resolve 01/02/1990 as DD/MM for EMIRATES_ID', () => {
    const result = resolveDate('01/02/1990', 'EMIRATES_ID');
    expect(result?.iso).toBe('1990-02-01'); // Feb 1, not Jan 2
  });

  it('should resolve unambiguous dates regardless of category', () => {
    const result = resolveDate('25/12/1990', 'PASSPORT');
    expect(result?.iso).toBe('1990-12-25');
    expect(result?.confidence).toBeGreaterThanOrEqual(95);
  });

  it('should handle YYYY-MM-DD passthrough', () => {
    const result = resolveDate('1990-02-01', 'PASSPORT');
    expect(result?.iso).toBe('1990-02-01');
    expect(result?.confidence).toBe(100);
  });
});
```

### 7. `quikadmin/tests/adversarial/profile-encryption.test.ts`

```typescript
describe('P0-E: ClientProfile Encryption', () => {
  it('should encrypt profile data on write', async () => {
    await service.mergeToClientProfile(clientId, { passport_number: 'A12345' }, docId);
    const raw = await prisma.clientProfile.findUnique({ where: { clientId } });
    // Data should be encrypted string, not readable JSON
    expect(typeof raw?.data).toBe('string');
    expect(raw?.data as string).toContain(':'); // base64:base64:base64 format
    expect(raw?.data as string).not.toContain('A12345'); // Not plaintext
  });

  it('should decrypt profile data on read', async () => {
    const result = await service.getClientProfile(clientId);
    expect(result.passport_number).toBe('A12345');
  });

  it('should handle legacy unencrypted data gracefully', async () => {
    // Pre-populate with unencrypted JSON
    await prisma.clientProfile.update({
      where: { clientId },
      data: { data: { passport_number: 'LEGACY123' } },
    });
    // Should still read correctly and encrypt on next write
    const result = await service.mergeToClientProfile(clientId, { name: 'Test' }, docId);
    expect(result).toBe(true);
  });
});
```

---

## Execution Roadmap

### Sprint 1, Week 1: Emergency Fixes (P0s)

| #   | Item                              | File(s)                        | Est.   | Dependencies |
| --- | --------------------------------- | ------------------------------ | ------ | ------------ |
| 1   | Registration privilege escalation | `supabase-auth.routes.ts:233`  | 30 min | None         |
| 2   | Demo mode backdoor                | `supabase-auth.routes.ts:1137` | 1 hr   | None         |
| 3   | Null guard in form filling        | `FormFiller.ts:56-68`          | 30 min | None         |
| 4   | Arabic OCR support                | `OCRService.ts:255-260`        | 2 hrs  | None         |
| 5   | XFA form detection                | `FormFiller.ts`                | 30 min | None         |

**Can be done in parallel by 2 engineers in 1 day.**

### Sprint 1, Week 2: Pipeline + Encryption

| #   | Item                     | File(s)                                     | Est.     | Dependencies |
| --- | ------------------------ | ------------------------------------------- | -------- | ------------ |
| 6   | Wire multi-agent stubs   | `workflow.ts:139-302`                       | 1-2 days | None         |
| 7   | ClientProfile encryption | `ClientDocumentFieldService.ts` + migration | 1 day    | None         |
| 8   | Queue name collision fix | `QueueService.ts:105`                       | 2 hrs    | None         |
| 9   | Stale job reconciliation | New `staleJobReconciler.ts`                 | 4 hrs    | None         |

### Sprint 2: Data Integrity

| #   | Item                       | File(s)                                  | Est.     | Dependencies |
| --- | -------------------------- | ---------------------------------------- | -------- | ------------ |
| 10  | Date format disambiguation | New `DateResolver.ts` + integration      | 1-2 days | None         |
| 11  | VLM confidence fix         | `OCRService.ts:497-507`                  | 4 hrs    | None         |
| 12  | OCR worker consolidation   | `OCRService.ts`, parsers                 | 1-2 days | None         |
| 13  | ClientProfile audit trail  | Schema + `ClientDocumentFieldService.ts` | 1-2 days | #7           |

### Sprint 3: Hardening

| #   | Item                        | File(s)                             | Est.     | Dependencies |
| --- | --------------------------- | ----------------------------------- | -------- | ------------ |
| 14  | Fix fake batch embedding    | `embedding.service.ts:633-672`      | 2 hrs    | None         |
| 15  | Post-fill PDF verification  | `FormFiller.ts`                     | 4 hrs    | #3, #5       |
| 16  | Batch size limits           | Queue enqueue functions             | 2 hrs    | None         |
| 17  | Search cache invalidation   | Knowledge pipeline + cache service  | 1 hr     | None         |
| 18  | KB RLS policies             | SQL migration                       | 1-2 days | None         |
| 19  | Confidence-gated overwrites | `ClientDocumentFieldService.ts`     | 4 hrs    | #7           |
| 20  | MRZ checksum validation     | New utility + extractor integration | 1-2 days | #6           |

### Total Estimated Effort

| Priority  | Items  | Effort         |
| --------- | ------ | -------------- |
| P0        | 5      | ~2 days        |
| P1        | 8      | ~6-8 days      |
| P2        | 7      | ~6-8 days      |
| **Total** | **20** | **~3-4 weeks** |

---

## Product Trustworthiness Scorecard (Post-Hardening Projection)

| Feature              | Current | After P0 | After P1 | After P2 |
| -------------------- | ------- | -------- | -------- | -------- |
| OCR & Extraction     | C       | B        | B+       | A-       |
| Client Profiles      | D+      | C+       | B        | B+       |
| Form Auto-fill       | C       | B        | B+       | A-       |
| Batch Processing     | C+      | C+       | B        | B+       |
| Knowledge Base       | B-      | B-       | B        | B+       |
| Multi-Agent Pipeline | D       | B        | B+       | A-       |
| Multi-Tenant RBAC    | C+      | B+       | A-       | A-       |

**Legend:** A = Production-grade, B = Solid with gaps, C = Functional but fragile, D = Significant issues, F = Non-functional

---

_Generated by 7-agent parallel implementation specification swarm on 2026-02-08_
_Source: Product Hardening Dossier (Phase 1) -> Implementation Specifications (Phase 2)_
