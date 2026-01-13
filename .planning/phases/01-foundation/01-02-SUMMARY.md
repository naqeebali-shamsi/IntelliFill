# Plan 01-02 Summary: Smart Upload Zone

**Completed**: 2026-01-13
**Duration**: ~20 minutes

## Objective

Create the Smart Upload Zone with react-dropzone and document type auto-detection.

## What Was Built

### 1. Backend: detect-types API Endpoint (`smart-profile.routes.ts`)

Created `/api/smart-profile/detect-types` endpoint:

**Features:**

- Accepts multipart/form-data with `files[]` array
- PDF, JPG, PNG support up to 10MB per file
- Uses existing `classifyDocument()` from classifierAgent for type detection
- Returns detection results with confidence scores
- Automatic file cleanup after processing

**Response Format:**

```typescript
{
  success: boolean;
  results: Array<{
    fileId: string;
    fileName: string;
    detectedType: 'PASSPORT' | 'EMIRATES_ID' | 'DRIVERS_LICENSE' | 'BANK_STATEMENT' | 'OTHER';
    confidence: number; // 0-1 scale
    alternativeTypes?: Array<{ type: string; confidence: number }>;
    error?: string;
  }>;
  totalFiles: number;
  detectedCount: number;
  errorCount: number;
}
```

### 2. Frontend: SmartUploadZone Component

Created three components in `quikadmin-web/src/components/smart-profile/`:

**SmartUploadZone.tsx:**

- Uses react-dropzone for drag-drop file handling
- Calls detect-types API automatically on file drop
- Updates Zustand store with detection results
- Visual feedback for drag states (active, rejected)
- AnimatePresence for smooth file card animations
- File rejection error display

**FileCard.tsx:**

- Displays file name, size, and icon
- Shows detected document type with dropdown for override
- Shows ConfidenceBadge with semantic label
- States: pending, detecting, detected, error
- Framer Motion animations for enter/exit

**ConfidenceBadge.tsx:**

- High (>=85%): Green "Verified" with checkmark
- Medium (60-84%): Yellow "Review suggested" with warning
- Low (<60%): Red "Please verify" with alert
- Uses semantic tokens (text-status-success, etc.)
- No raw percentages shown to users

### 3. Wizard Integration

Updated `SmartProfile.tsx`:

- Replaced upload step placeholder with SmartUploadZone
- Added file count summary when files are ready
- Continue button enabled when at least one file is detected

## Files Created/Modified

| File                                                             | Action   | Description                     |
| ---------------------------------------------------------------- | -------- | ------------------------------- |
| `quikadmin/src/api/smart-profile.routes.ts`                      | Created  | detect-types API endpoint       |
| `quikadmin/src/api/routes.ts`                                    | Modified | Added smart-profile route mount |
| `quikadmin-web/src/components/smart-profile/SmartUploadZone.tsx` | Created  | Drag-drop upload component      |
| `quikadmin-web/src/components/smart-profile/FileCard.tsx`        | Created  | File display with type override |
| `quikadmin-web/src/components/smart-profile/ConfidenceBadge.tsx` | Created  | Semantic confidence display     |
| `quikadmin-web/src/components/smart-profile/index.ts`            | Created  | Component exports               |
| `quikadmin-web/src/pages/SmartProfile.tsx`                       | Modified | Integrated SmartUploadZone      |

## Verification

- [x] Backend: `cd quikadmin && npm run build` succeeds
- [x] Frontend: `cd quikadmin-web && bun run build` succeeds
- [x] SmartUploadZone renders with drag-drop functionality
- [x] FileCard shows file info with detected type
- [x] ConfidenceBadge shows semantic labels (not percentages)
- [x] Manual type override via dropdown works
- [x] Files stored in Zustand store
- [x] Continue button works when files detected

## Deviations from Plan

None. Implementation followed the plan exactly.

## API Integration Notes

The detect-types endpoint uses the existing `classifyDocument()` function from:
`quikadmin/src/multiagent/agents/classifierAgent.ts`

This provides:

- Gemini AI-based classification with pattern-based fallback
- Support for multi-modal classification (text + image)
- Confidence scoring with alternative types
- Language and photo detection metadata

Document types are mapped from backend categories to frontend types:

- PASSPORT → PASSPORT
- EMIRATES_ID → EMIRATES_ID
- ID_CARD → DRIVERS_LICENSE
- BANK_STATEMENT → BANK_STATEMENT
- All others → OTHER

## Next Steps

**Plan 01-03: Batch Extraction**

- Create extract-batch API endpoint
- Integrate with multiagent OCR pipeline
- Return structured extracted data for profile building

## Code Patterns Established

```typescript
// Confidence display pattern (no raw percentages)
const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85, // "Verified" - green
  MEDIUM: 0.6, // "Review suggested" - yellow
  // Below 0.6: "Please verify" - red
};

// File detection API call pattern
const response = await api.post<DetectTypesResponse>('/smart-profile/detect-types', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});

// Store integration for file management
const { files, addFiles, updateFileDetection, setFileError } = useSmartUpload();
```
