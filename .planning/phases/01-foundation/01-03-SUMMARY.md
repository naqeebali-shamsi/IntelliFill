# Plan 01-03 Summary: Batch Extraction

**Completed**: 2026-01-13
**Duration**: ~25 minutes

## Objective

Create the batch extraction endpoint and wire it to the wizard flow for seamless document-to-profile extraction.

## What Was Built

### 1. Backend: extract-batch API Endpoint (`smart-profile.routes.ts`)

Added `/api/smart-profile/extract-batch` endpoint:

**Features:**

- Accepts multipart/form-data with `files[]` and `documentTypes[]` arrays
- Uses `OCRService` for text extraction (PDF/image)
- Uses `extractDocumentData` from extractorAgent for structured extraction
- Merges fields across documents (highest confidence wins)
- Returns `profileData`, `fieldSources`, and `lowConfidenceFields`
- Automatic file cleanup after processing

**Response Format:**

```typescript
interface ExtractBatchResponse {
  success: boolean;
  profileData: Record<string, unknown>; // Merged profile data
  fieldSources: Record<string, FieldSource>; // Which document each field came from
  lowConfidenceFields: LowConfidenceField[]; // Fields below 85% confidence
  processingTime: number; // Total processing time in ms
  documentsProcessed: number;
  totalFieldsExtracted: number;
}
```

**Helper Functions:**

- `mapFrontendTypeToCategory()` - Maps frontend document types to backend categories
- `mapFieldToProfileKey()` - Maps snake_case extraction fields to camelCase profile keys

### 2. Frontend: smartProfileService.ts

Created new service file with API functions:

**Functions:**

- `detectTypes(files: File[])` - Calls detect-types API (from Plan 01-02)
- `extractBatch(files: File[], documentTypes: string[])` - Calls extract-batch API

**Types exported:**

- `DetectionResult`, `DetectTypesResponse`
- `FieldSource`, `LowConfidenceField`, `ExtractBatchResponse`

### 3. Frontend: fileObjectStore.ts

Created singleton store for File objects:

**Purpose:**

- Stores actual `File` objects that can't be persisted to localStorage
- Used by `SmartUploadZone` to store files on drop
- Used by `SmartProfile` to retrieve files for extraction

**API:**

- `set(id, file)`, `get(id)`, `remove(id)`, `clear()`
- `getByIds(ids)`, `getEntries()`

### 4. Wizard Integration (SmartProfile.tsx)

Updated wizard to trigger extraction:

**Changes:**

- Added `isExtracting` and `extractionError` state
- On Continue from upload step:
  - Gets detected files and their types from store
  - Retrieves actual File objects from `fileObjectStore`
  - Calls `extractBatch()` API
  - Stores results in Zustand (`profileData`, `fieldSources`, `lowConfidenceFields`)
  - Auto-skips to profile step if no low confidence fields
- Shows loading spinner during extraction
- Displays extraction errors if they occur
- Clears `fileObjectStore` on reset

### 5. SmartUploadZone Update

Modified to use `fileObjectStore` instead of local ref:

- Files stored in singleton on drop
- Files removed from singleton on delete
- Enables SmartProfile page to access File objects

## Files Created/Modified

| File                                                             | Action   | Description                  |
| ---------------------------------------------------------------- | -------- | ---------------------------- |
| `quikadmin/src/api/smart-profile.routes.ts`                      | Modified | Added extract-batch endpoint |
| `quikadmin-web/src/services/smartProfileService.ts`              | Created  | API service functions        |
| `quikadmin-web/src/stores/fileObjectStore.ts`                    | Created  | Singleton File object store  |
| `quikadmin-web/src/pages/SmartProfile.tsx`                       | Modified | Wired extraction to wizard   |
| `quikadmin-web/src/components/smart-profile/SmartUploadZone.tsx` | Modified | Use fileObjectStore          |

## Verification

- [x] Backend: `cd quikadmin && npm run build` succeeds
- [x] Frontend: `cd quikadmin-web && bun run build` succeeds
- [x] extract-batch endpoint handles multipart/form-data
- [x] OCR extraction uses existing OCRService
- [x] Data extraction uses existing extractorAgent
- [x] Field merging uses highest confidence wins strategy
- [x] Low confidence fields tracked (< 85% threshold)
- [x] Wizard triggers extraction on Continue from upload
- [x] Loading state shown during extraction
- [x] Error state displayed on failure
- [x] Auto-skip to profile if no low confidence fields
- [x] File objects accessible via fileObjectStore singleton

## Deviations from Plan

None. Implementation followed the plan exactly.

## API Integration Notes

The extract-batch endpoint integrates with existing services:

**OCRService** (`quikadmin/src/services/OCRService.ts`):

- `processPDF(path)` for PDF files
- `processImage(path)` for JPG/PNG files
- Returns `OCRResult` with text, confidence, pages

**extractorAgent** (`quikadmin/src/multiagent/agents/extractorAgent.ts`):

- `extractDocumentData(text, category, imageBase64?)`
- Uses Gemini AI with pattern-based fallback
- Returns structured fields with confidence scores

## Next Steps

**Plan 01-04: Profile View**

- Create ProfileView component to display extracted data
- Organize fields by category (identity, contact, financial)
- Show field sources with confidence indicators
- Highlight missing required fields

## Code Patterns Established

```typescript
// Batch extraction flow pattern
const result = await extractBatch(files, documentTypes);
if (result.success) {
  setProfileData(result.profileData);
  setFieldSources(result.fieldSources);
  setLowConfidenceFields(result.lowConfidenceFields);

  // Auto-skip review if all high confidence
  const nextStep = result.lowConfidenceFields.length === 0 ? 'profile' : 'review';
}

// File object store pattern (singleton for non-serializable File objects)
import { fileObjectStore } from '@/stores/fileObjectStore';
fileObjectStore.set(id, file); // On drop
const files = fileObjectStore.getByIds(fileIds); // On extraction
fileObjectStore.remove(id); // On delete
fileObjectStore.clear(); // On reset

// Field merging strategy (highest confidence wins)
if (!profileData[profileKey] || currentConfidence > existingConfidence) {
  profileData[profileKey] = fieldValue;
  fieldSources[profileKey] = { documentId, documentName, confidence, extractedAt };
}
```
