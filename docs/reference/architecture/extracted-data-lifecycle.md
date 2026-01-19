---
title: Extracted Data Lifecycle
description: Complete end-to-end flow of document data from upload to form filling
category: reference
tags: [architecture, data-flow, ocr, extraction, encryption]
lastUpdated: 2026-01-15
relatedDocs:
  - ../api/endpoints.md
  - ./system-overview.md
  - ../../explanation/adr/ADR-001-document-processing-pipeline.md
---

# Extracted Data Lifecycle

This document describes the complete end-to-end lifecycle of extracted data in IntelliFill, from document upload through OCR processing to form filling.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTRACTED DATA LIFECYCLE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  UPLOAD ──▶ DETECT ──▶ EXTRACT ──▶ STRUCTURE ──▶ ENCRYPT ──▶ STORE         │
│                                                                    │         │
│  DOWNLOAD ◀── FILL ◀── MAP ◀── DISPLAY ◀── DECRYPT ◀── RETRIEVE ◀─┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Document Upload

### Frontend Components

| Component         | File                                                         | Purpose                 |
| ----------------- | ------------------------------------------------------------ | ----------------------- |
| `FileUploadZone`  | `quikadmin-web/src/components/features/file-upload-zone.tsx` | Drag-drop upload UI     |
| `uploadStore`     | `quikadmin-web/src/stores/uploadStore.ts`                    | Upload queue state      |
| `useUpload`       | `quikadmin-web/src/hooks/useUpload.ts`                       | Concurrent upload logic |
| `uploadDocuments` | `quikadmin-web/src/services/api.ts:310-354`                  | API call                |

### Upload Flow

```
User drops file
       │
       ▼
FileUploadZone validates (type, size)
       │
       ▼
uploadStore.addFiles() - queue management
       │
       ▼
useUpload processes queue (max 3 concurrent)
       │
       ▼
uploadDocuments() → POST /api/documents
```

### File Validation

- **Accepted types**: PDF, PNG, JPG, JPEG, TIFF
- **Max size**: 20MB per file
- **Max concurrent**: 3 uploads

### Backend Endpoint

**`POST /api/documents`** - `documents.routes.ts:100-219`

1. Multer saves file to `uploads/documents/`
2. Creates Document record with `status: PENDING`
3. Triggers detection logic

---

## Phase 2: Document Detection

### Service

**`DocumentDetectionService`** - `quikadmin/src/services/DocumentDetectionService.ts`

### Detection Method

```typescript
async isScannedPDF(filePath: string): Promise<boolean>
```

Uses `pdf-parse` to extract native text and applies heuristics:

### Heuristics

| Metric          | Formula                    | Text-Based | Scanned |
| --------------- | -------------------------- | ---------- | ------- |
| textPerPage     | totalChars / pageCount     | ≥50        | <50     |
| meaningfulRatio | nonWhitespace / totalChars | ≥0.1       | <0.1    |

### Decision Points

- `textLength === 0` → **SCANNED** (no text layer)
- `textPerPage < 50` → **SCANNED** (low density)
- `meaningfulRatio < 0.1` → **SCANNED** (mostly whitespace)
- Otherwise → **TEXT-BASED**

---

## Phase 3: Text Extraction

### Path A: Text-Based PDFs (Synchronous)

```typescript
// Immediate extraction - no queue
const text = await detectionService.extractTextFromPDF(filePath);
const structuredData = await ocrService.extractStructuredData(text);
```

- **Library**: pdf-parse
- **Latency**: <100ms
- **Confidence**: 0.95 (fixed high value)

### Path B: Scanned Documents (Asynchronous)

```typescript
// Queue for background processing
const job = await enqueueDocumentForOCR(documentId, userId, filePath);
```

**Queue Configuration** (`ocrQueue.ts`):

```typescript
{
  name: 'ocr-processing',
  attempts: 3,
  backoff: { type: 'exponential', delay: 3000 }, // 3s → 9s → 27s
  timeout: 600000, // 10 minutes
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 }
}
```

**OCR Pipeline** (`OCRService.ts`):

1. **Initialize** - Create Tesseract worker (eng+spa+fra+deu)
2. **Convert** - PDF pages to images (pdf2pic, 300 DPI)
3. **Preprocess** - Sharp.js enhancement:
   - Greyscale conversion
   - Contrast normalization
   - Sharpen edges
   - Threshold filter
   - Resize to 2400px width
4. **Recognize** - Tesseract OCR per page
5. **Combine** - Merge page results

**OCR Output**:

```typescript
interface OCRResult {
  text: string; // Combined text
  confidence: number; // Average 0-100
  pages: Array<{
    pageNumber: number;
    text: string;
    confidence: number;
  }>;
  metadata: {
    language: string;
    processingTime: number;
    pageCount: number;
  };
}
```

---

## Phase 4: Structured Data Extraction

### Method

**`OCRService.extractStructuredData()`** - `OCRService.ts:261-294`

**LLM Fallback (Optional)**:
- If enabled (`ENABLE_LLM_EXTRACTION=true`) and OCR confidence is below the threshold (default 70), the Gemini-based extractor runs on OCR text (and image input for images).
- LLM results are merged with pattern/OCR extraction, keeping higher-confidence values.

### Extracted Patterns

| Field        | Regex Pattern                                                    | Example          |
| ------------ | ---------------------------------------------------------------- | ---------------- |
| `email`      | `[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+`                | john@example.com |
| `phone`      | `(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}`  | +1-555-123-4567  |
| `date`       | `(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\|(\d{4}[-/]\d{1,2}[-/]\d{1,2})` | 01/15/2025       |
| `ssn`        | `\d{3}-\d{2}-\d{4}`                                              | 123-45-6789      |
| `zipCode`    | `\b\d{5}(-\d{4})?\b`                                             | 12345-6789       |
| `currency`   | `[$€£¥]\s?\d+(?:,\d{3})*(?:\.\d{2})?`                            | $1,234.56        |
| `percentage` | `\d+(?:\.\d+)?%`                                                 | 85.5%            |
| `fields`     | `([A-Za-z\s]+):\s*([^\n]+)`                                      | Name: John Doe   |

### Output Structure

```typescript
{
  full_name: { value: "John Doe", confidence: 92, source: "ocr" },
  emirates_id: { value: "784-1989-1593287-9", confidence: 95, source: "pattern" },
  date_of_birth: { value: "04/10/1989", confidence: 84, source: "llm" }
}
```

---

## Phase 5: Encryption & Storage

### Encryption

**Location**: `quikadmin/src/utils/encryption.ts`

**Algorithm**: AES-256-GCM (authenticated encryption)

**Key Derivation**:

```typescript
const key = crypto.createHash('sha256').update(process.env.JWT_SECRET).digest();
```

**Encryption Format**:

```
base64(IV):base64(AuthTag):base64(Ciphertext)
```

**Functions**:

- `encryptJSON(data)` - Encrypt object to string
- `decryptJSON(encrypted)` - Decrypt string to object
- `encryptExtractedData(data)` - Wrapper for extracted data (used for all OCR paths)
- `decryptExtractedData(encrypted)` - Wrapper with error handling

### Database Schema

**Document Model** - `schema.prisma:304-326`

```prisma
model Document {
  id              String         @id @default(uuid())
  userId          String
  fileName        String
  fileType        String         // MIME type
  fileSize        Int            // Bytes
  storageUrl      String         // Disk path
  status          DocumentStatus // PENDING|PROCESSING|COMPLETED|FAILED
  extractedText   String?        // Raw OCR text
  extractedData   Json?          // Encrypted structured data
  confidence      Float?         // 0-1 score
  processedAt     DateTime?
  reprocessCount  Int            @default(0)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}
```

---

## Phase 6: Data Retrieval

### API Endpoints

| Endpoint                | Method | Purpose           | Returns                          |
| ----------------------- | ------ | ----------------- | -------------------------------- |
| `/documents`            | GET    | List documents    | Metadata only                    |
| `/documents/:id`        | GET    | Full document     | All fields + decrypted data      |
| `/documents/:id/data`   | GET    | Data only         | fileName + extractedData         |
| `/documents/:id/status` | GET    | Processing status | status, confidence, job progress |

### Decryption Flow

```
Database (encrypted JSON string)
         │
         ▼
decryptExtractedData(document.extractedData)
         │
         ▼
API Response (plaintext object over HTTPS)
```

**Security Notes**:

- Decryption happens server-side only
- Plaintext sent over HTTPS
- No encryption keys exposed to frontend

### Frontend Hooks

| Hook                 | File                                | Purpose                   |
| -------------------- | ----------------------------------- | ------------------------- |
| `useDocumentDetail`  | `hooks/useDocumentDetail.ts:48-72`  | Fetch full document       |
| `useDocumentData`    | `hooks/useDocumentDetail.ts:88-112` | Fetch data only           |
| `useDocumentActions` | `hooks/useDocumentActions.ts`       | Download/delete/reprocess |

---

## Phase 7: Form Filling

### Flow

```
POST /api/documents/:id/fill (multipart with form PDF)
         │
         ▼
Retrieve & decrypt source document data
         │
         ▼
FieldMapper.mapFields(extractedData, formFields)
         │
         ▼
FormFiller.fillPDFForm(formPath, mappings, outputPath)
         │
         ▼
Response: { downloadUrl, confidence, warnings }
```

### Field Mapping

**Location**: `quikadmin/src/mappers/FieldMapper.ts`

**Matching Strategy**:

1. **Direct Match** - Field name similarity (Levenshtein distance)
2. **Entity Match** - Pattern-based (email → emails[], phone → phones[])
3. **Type Validation** - Boost confidence if value matches expected format

**Confidence Scoring**:

| Match Type         | Base Confidence | With Validation Boost |
| ------------------ | --------------- | --------------------- |
| Email entity       | 0.90            | 0.90                  |
| Phone entity       | 0.90            | 0.90                  |
| Name entity        | 0.85            | 0.85                  |
| Date entity        | 0.80            | 0.95                  |
| Direct field match | 0.70            | 0.85-0.90             |

### Form Filling

**Location**: `quikadmin/src/fillers/FormFiller.ts`

**Library**: pdf-lib

**Supported Field Types**:

- `PDFTextField` - Text input
- `PDFCheckBox` - Boolean checkbox
- `PDFDropdown` - Select dropdown
- `PDFRadioGroup` - Radio buttons

**Output**:

- Filled PDF saved to `outputs/` directory
- Optionally flattened (non-editable)
- Encrypted before storage

---

## Complete Sequence Diagram

```
┌────────┐    ┌─────────┐    ┌─────────┐    ┌───────┐    ┌────────┐
│Frontend│    │ Backend │    │  Queue  │    │ Redis │    │Database│
└───┬────┘    └────┬────┘    └────┬────┘    └───┬───┘    └───┬────┘
    │              │              │              │            │
    │ POST /documents             │              │            │
    │─────────────▶│              │              │            │
    │              │              │              │            │
    │              │ Save file    │              │            │
    │              │─────────────────────────────────────────▶│
    │              │              │              │            │
    │              │ Detect type  │              │            │
    │              │──────┐       │              │            │
    │              │      │       │              │            │
    │              │◀─────┘       │              │            │
    │              │              │              │            │
    │              │ [If Scanned] │              │            │
    │              │ Add job      │              │            │
    │              │─────────────▶│              │            │
    │              │              │ Store job    │            │
    │              │              │─────────────▶│            │
    │              │              │              │            │
    │◀─────────────│ Response     │              │            │
    │ (jobId)      │              │              │            │
    │              │              │              │            │
    │              │              │ Process job  │            │
    │              │              │◀─────────────│            │
    │              │              │              │            │
    │              │              │ OCR + Extract│            │
    │              │              │──────┐       │            │
    │              │              │      │       │            │
    │              │              │◀─────┘       │            │
    │              │              │              │            │
    │              │              │ Update doc   │            │
    │              │              │─────────────────────────▶│
    │              │              │              │            │
    │ GET /documents/:id/status   │              │            │
    │─────────────▶│              │              │            │
    │              │ Query        │              │            │
    │              │─────────────────────────────────────────▶│
    │◀─────────────│              │              │            │
    │ (status)     │              │              │            │
    │              │              │              │            │
    │ GET /documents/:id          │              │            │
    │─────────────▶│              │              │            │
    │              │ Fetch + Decrypt             │            │
    │              │─────────────────────────────────────────▶│
    │◀─────────────│              │              │            │
    │ (data)       │              │              │            │
    │              │              │              │            │
┌───┴────┐    ┌────┴────┐    ┌────┴────┐    ┌───┴───┐    ┌───┴────┐
│Frontend│    │ Backend │    │  Queue  │    │ Redis │    │Database│
└────────┘    └─────────┘    └─────────┘    └───────┘    └────────┘
```

---

## Key Files Reference

### Backend

| Component         | File                                   | Key Lines            |
| ----------------- | -------------------------------------- | -------------------- |
| Upload endpoint   | `api/documents.routes.ts`              | 100-219              |
| Detection service | `services/DocumentDetectionService.ts` | Full file            |
| OCR service       | `services/OCRService.ts`               | 261-294 (extraction) |
| OCR queue         | `queues/ocrQueue.ts`                   | 54-140 (processing)  |
| Encryption        | `utils/encryption.ts`                  | Full file            |
| Field mapper      | `mappers/FieldMapper.ts`               | 87-271               |
| Form filler       | `fillers/FormFiller.ts`                | 14-118               |
| Schema            | `prisma/schema.prisma`                 | 304-326              |

### Frontend

| Component      | File                                       |
| -------------- | ------------------------------------------ |
| Upload zone    | `components/features/file-upload-zone.tsx` |
| Upload store   | `stores/uploadStore.ts`                    |
| Upload hook    | `hooks/useUpload.ts`                       |
| Document store | `stores/documentStore.ts`                  |
| Document hooks | `hooks/useDocumentDetail.ts`               |
| API service    | `services/api.ts`                          |

---

## Error Handling

### Upload Errors

| Error                 | Cause                  | Resolution             |
| --------------------- | ---------------------- | ---------------------- |
| 400 Bad Request       | Invalid file type/size | Validate before upload |
| 401 Unauthorized      | Missing/invalid token  | Re-authenticate        |
| 413 Payload Too Large | File >20MB             | Compress or split      |

### Processing Errors

| Error          | Cause              | Resolution                            |
| -------------- | ------------------ | ------------------------------------- |
| OCR timeout    | Document too large | Reprocess with timeout increase       |
| Low confidence | Poor scan quality  | Reprocess with enhanced preprocessing |
| Queue failure  | Redis unavailable  | Check Redis connection                |

### Reprocessing

```typescript
// Reprocess with enhanced settings
POST /api/documents/:id/reprocess

// Enhanced config:
{
  dpi: 600,           // Higher resolution
  enhancedPreprocessing: true,
  priority: 1         // Higher queue priority
}
```

Maximum 3 reprocess attempts per document.

---

## Security Considerations

1. **Encryption at rest**: All extracted data encrypted with AES-256-GCM
2. **Key management**: Derived from JWT_SECRET (no separate key storage)
3. **Authentication**: All endpoints require valid Supabase token
4. **Authorization**: Users can only access their own documents
5. **File validation**: Type and size checks on upload
6. **Path traversal**: Sanitized file paths

---

## Related Documentation

- [ADR-001: Document Processing Pipeline](../../explanation/adr/ADR-001-document-processing-pipeline.md)
- [System Overview](./system-overview.md)
- [API Endpoints](../api/endpoints.md)
- [Database Schema](../database/schema.md)
