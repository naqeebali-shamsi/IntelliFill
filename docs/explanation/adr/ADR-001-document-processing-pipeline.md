---
title: 'ADR-001: Document Processing Pipeline Architecture'
id: 'dec-001-document-processing'
version: '1.0.0'
status: 'active'
phase: 'current'
category: 'decision'
ai_priority: 'high'
ai_context_level: 'reference'
lastUpdated: 2025-12-17
---

# ADR-001: Document Processing Pipeline Architecture

**Status:** [![Status](https://img.shields.io/badge/status-accepted-green)]()
**Date:** 2025-12-17
**Deciders:** Engineering Team
**Context:** Document upload, OCR processing, and data extraction pipeline

---

## Context

IntelliFill needs to process uploaded documents (PDFs and images) to extract structured data for form filling. The system must:

1. Handle both text-based PDFs (with selectable text) and scanned documents (images)
2. Extract structured data (emails, phones, dates, etc.) from raw text
3. Store extracted data securely (encryption at rest)
4. Support asynchronous processing for resource-intensive OCR
5. Provide real-time progress updates to users
6. Enable form filling with extracted data

### Constraints

- Must work with free/open-source tools (no cloud OCR API costs)
- Must handle documents up to 20MB
- Must support concurrent uploads (3 simultaneous)
- Must encrypt sensitive extracted data
- Must provide confidence scoring for data quality

---

## Decision

Implement a **dual-path processing pipeline** with intelligent document detection:

### Architecture Overview

```
Document Upload
      │
      ▼
┌─────────────────┐
│ Document        │
│ Detection       │ ──▶ isScannedPDF() heuristics
└─────────────────┘
      │
      ├─── Text-Based ───▶ Synchronous Processing
      │                    (pdf-parse → immediate)
      │
      └─── Scanned ──────▶ Asynchronous Processing
                           (Bull Queue → Tesseract OCR)
```

### Key Components

1. **DocumentDetectionService** - Determines processing path using heuristics
2. **OCRService** - Tesseract.js wrapper with image preprocessing
3. **Bull Queue** - Redis-backed job queue for async OCR
4. **AES-256-GCM Encryption** - Encrypts extracted data at rest
5. **FieldMapper** - Maps extracted data to form fields
6. **FormFiller** - Populates PDF forms with mapped data

### Detection Heuristics

| Metric              | Text-Based | Scanned |
| ------------------- | ---------- | ------- |
| Characters per page | ≥50        | <50     |
| Meaningful ratio    | ≥0.1       | <0.1    |

### Processing Paths

**Path A: Text-Based PDFs (Synchronous)**

- Uses `pdf-parse` for immediate text extraction
- No queue delay, instant response
- Confidence: 0.95 (high)

**Path B: Scanned Documents (Asynchronous)**

- Queued via Bull (Redis)
- Tesseract.js OCR with Sharp.js preprocessing
- Progress tracking via job events
- Confidence: Calculated from OCR (typically 0.70-0.90)

---

## Consequences

### Positive

1. **Cost-effective**: No cloud OCR API costs (Tesseract is open-source)
2. **Fast for text PDFs**: Instant processing without queue overhead
3. **Scalable**: Bull queue handles concurrent OCR jobs
4. **Secure**: AES-256-GCM encryption protects sensitive data
5. **Resilient**: Retry logic with exponential backoff
6. **Observable**: Progress tracking and confidence scoring

### Negative

1. **OCR accuracy**: Tesseract less accurate than cloud solutions
2. **Infrastructure**: Requires Redis for job queue
3. **Complexity**: Two processing paths to maintain
4. **Memory usage**: Tesseract workers consume significant RAM

### Neutral

1. **Cold start**: First OCR job initializes Tesseract worker (~2-3s)
2. **Preprocessing required**: Image enhancement needed for good OCR results

---

## Alternatives Considered

### Alternative 1: Cloud OCR Only (Google Vision / AWS Textract)

- **Pros**: Higher accuracy, structured data extraction, no infrastructure
- **Cons**: Expensive at scale ($1.50-$3 per 1000 pages), API dependency
- **Why not chosen**: Cost prohibitive for startup phase, vendor lock-in

### Alternative 2: Synchronous Processing Only

- **Pros**: Simpler architecture, no Redis dependency
- **Cons**: Blocks requests during OCR (30-60s per document), poor UX
- **Why not chosen**: Unacceptable latency for users

### Alternative 3: Separate Microservice for OCR

- **Pros**: Independent scaling, isolation
- **Cons**: Deployment complexity, network overhead, overkill for current scale
- **Why not chosen**: Premature optimization, monolith sufficient

### Alternative 4: Client-Side OCR (Tesseract.js in browser)

- **Pros**: Offloads processing to client, reduces server load
- **Cons**: Inconsistent performance, large bundle size (~15MB), battery drain
- **Why not chosen**: Poor mobile experience, security concerns

---

## Implementation Details

### File Locations

| Component         | Location                                             |
| ----------------- | ---------------------------------------------------- |
| Upload Endpoint   | `quikadmin/src/api/documents.routes.ts:100-219`      |
| Detection Service | `quikadmin/src/services/DocumentDetectionService.ts` |
| OCR Service       | `quikadmin/src/services/OCRService.ts`               |
| OCR Queue         | `quikadmin/src/queues/ocrQueue.ts`                   |
| Encryption        | `quikadmin/src/utils/encryption.ts`                  |
| Field Mapper      | `quikadmin/src/mappers/FieldMapper.ts`               |
| Form Filler       | `quikadmin/src/fillers/FormFiller.ts`                |

### Queue Configuration

```typescript
{
  name: 'ocr-processing',
  attempts: 3,
  backoff: { type: 'exponential', delay: 3000 },
  timeout: 600000, // 10 minutes
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 }
}
```

### Encryption Specification

- **Algorithm**: AES-256-GCM
- **Key derivation**: SHA-256 of JWT_SECRET
- **Format**: `base64(IV):base64(AuthTag):base64(Ciphertext)`

---

## References

- [Extracted Data Lifecycle](../reference/architecture/extracted-data-lifecycle.md)
- [System Overview](../reference/architecture/system-overview.md)
- [OCR Engine Decision](#ocr-engine-tesseractjs) (in architecture-decisions.md)
- [Job Queue Decision](#job-queue-bull) (in architecture-decisions.md)

---

**ADR Number:** 001
**Related ADRs:** None
**Supersedes:** None
