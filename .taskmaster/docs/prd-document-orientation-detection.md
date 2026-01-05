# PRD: Document Orientation Detection for OCR Pipeline

## Executive Summary

Implement a staged hybrid approach for detecting and correcting document orientation before OCR processing. Stage 1 adds EXIF-based auto-orientation using Sharp with low-confidence logging. Stage 2 (data-driven) adds Tesseract Legacy OSD for scanned PDFs if monitoring shows need.

## Problem Statement

### Current Situation

- OCR pipeline uses PSM.AUTO which does not detect document orientation
- Rotated documents (90°, 180°, 270°) produce garbage OCR text
- Users uploading phone photos of documents may have rotation issues
- No visibility into OCR quality issues related to orientation

### User Impact

- Users receive incorrect extracted data from rotated documents
- Form auto-fill fails silently with wrong information
- Trust in the product decreases when OCR "doesn't work"

### Business Impact

- Support tickets for "OCR not working"
- User churn due to poor extraction quality
- No data to understand scope of the problem

### Why Solve This Now

- Recent production deployment revealed orientation issues
- Expert panel unanimously approved staged approach
- Minimal implementation cost for Stage 1

## Goals & Success Metrics

### Goal 1: Handle EXIF-based Rotation (Stage 1)

- **Metric:** % of phone photo uploads correctly oriented
- **Baseline:** 0% (no EXIF handling)
- **Target:** 95%+ of phone photos auto-corrected
- **Measurement:** Compare OCR confidence before/after change

### Goal 2: Visibility into Orientation Issues

- **Metric:** Low-confidence OCR events logged with metadata
- **Baseline:** No logging
- **Target:** 100% of <40% confidence results logged
- **Measurement:** Log aggregation dashboard

### Goal 3: Data-Driven Stage 2 Trigger

- **Metric:** Percentage of documents below confidence threshold
- **Baseline:** Unknown
- **Target:** <5% of documents below 40% confidence
- **Measurement:** Daily monitoring alert

### Goal 4: Zero Performance Regression

- **Metric:** Cold start time, memory usage, processing time
- **Baseline:** Current metrics
- **Target:** No measurable regression (±5%)
- **Measurement:** APM monitoring

## User Stories

### US-1: Phone Photo Auto-Correction

**As a** user uploading a phone photo of my passport
**I want** the system to automatically correct rotation
**So that** OCR extracts my information correctly even if I held my phone sideways

**Acceptance Criteria:**

- Photos with EXIF orientation tags are auto-rotated before OCR
- EXIF tag is removed after rotation to prevent double-rotation
- No user action required
- Works for PNG, JPG, JPEG, TIFF formats

### US-2: Quality Monitoring

**As a** system administrator
**I want** visibility into OCR quality issues
**So that** I can identify when Stage 2 implementation is needed

**Acceptance Criteria:**

- OCR results with confidence <40% are logged
- Logs include: documentId, confidence, fileType, storageUrl, timestamp
- Logs are queryable for trend analysis
- Alert triggers if >5% of documents in 24 hours fall below threshold

### US-3: Scanned PDF Handling (Stage 2)

**As a** user uploading a scanned PDF that was scanned sideways
**I want** the system to detect and correct the rotation
**So that** OCR works correctly on poorly-scanned documents

**Acceptance Criteria:**

- Tesseract OSD detects orientation (0°, 90°, 180°, 270°)
- Image is rotated before OCR processing
- Only triggered for scanned PDFs (not native text PDFs)
- Graceful fallback if OSD fails

## Functional Requirements

### REQ-001: Sharp EXIF Auto-Orientation (Must Have - Stage 1)

Add `sharp().rotate()` with no arguments to the image preprocessing pipeline to trigger EXIF-based auto-orientation.

**Priority:** Must Have
**Implementation Hint:** Single line addition to `preprocessImage()` in OCRService.ts

### REQ-002: Consistent Preprocessing Pipeline (Must Have - Stage 1)

Apply auto-orientation to all image processing paths:

- Direct image uploads (PNG, JPG, etc.)
- PDF page conversions from pdf2pic
- Any other image buffers entering OCR

**Priority:** Must Have
**Implementation Hint:** Ensure `rotate()` is called in all preprocessing code paths

### REQ-003: Low-Confidence Logging (Must Have - Stage 1)

Log detailed information when OCR confidence falls below 40%:

- documentId
- confidence score
- fileType (image vs scanned PDF)
- storageUrl (truncated for security)
- wasConvertedFromPdf flag
- timestamp

**Priority:** Must Have
**Implementation Hint:** Add logging after OCR completion in ocrQueue.ts processor

### REQ-004: Confidence Threshold Configuration (Should Have - Stage 1)

Make the 40% confidence threshold configurable via environment variable.

**Priority:** Should Have
**Implementation Hint:** `OCR_LOW_CONFIDENCE_THRESHOLD` env var with default 40

### REQ-005: Monitoring Alert (Should Have - Stage 1)

Implement alerting when >5% of documents in a 24-hour period fall below the confidence threshold.

**Priority:** Should Have
**Implementation Hint:** Can use existing logging infrastructure with aggregation query

### REQ-006: Tesseract Legacy Mode Setup (Must Have - Stage 2)

Configure Tesseract worker with legacy support for OSD:

```typescript
await Tesseract.createWorker('eng', 1, {
  legacyCore: true,
  legacyLang: true,
});
```

**Priority:** Must Have (Stage 2)
**Implementation Hint:** Conditional initialization based on feature flag

### REQ-007: OSD Detection Function (Must Have - Stage 2)

Implement orientation detection using `worker.detect()`:

- Returns orientation in degrees (0, 90, 180, 270)
- Returns script type
- Handles detection failures gracefully

**Priority:** Must Have (Stage 2)
**Implementation Hint:** New method in OCRService: `detectOrientation()`

### REQ-008: Conditional OSD Trigger (Must Have - Stage 2)

Only run OSD detection for:

- Scanned PDFs (no native text layer)
- Images without EXIF orientation data
- Optionally: documents that failed first OCR attempt

**Priority:** Must Have (Stage 2)
**Implementation Hint:** Check file type and EXIF presence before OSD

### REQ-009: Image Rotation Based on OSD (Must Have - Stage 2)

Rotate image buffer based on OSD detection results before OCR.

**Priority:** Must Have (Stage 2)
**Implementation Hint:** Use sharp().rotate(degrees) with detected angle

### REQ-010: Stage 2 Feature Flag (Should Have - Stage 2)

Control Stage 2 features via environment variable for gradual rollout.

**Priority:** Should Have (Stage 2)
**Implementation Hint:** `ENABLE_TESSERACT_OSD=true` env var

## Non-Functional Requirements

### NFR-001: Performance - No Cold Start Regression

Stage 1 must not increase worker cold start time by more than 100ms.

**Target:** <100ms additional cold start time
**Measurement:** APM cold start metrics

### NFR-002: Performance - Minimal Processing Overhead

EXIF auto-orientation must add less than 10ms per image.

**Target:** <10ms per image
**Measurement:** Timing logs around preprocessing

### NFR-003: Memory - No Increase (Stage 1)

Stage 1 must not increase memory usage (Sharp is already loaded).

**Target:** 0 additional MB baseline memory
**Measurement:** Container memory metrics

### NFR-004: Memory - Bounded Increase (Stage 2)

Stage 2 legacy Tesseract support may add up to 100MB.

**Target:** <100MB additional memory
**Measurement:** Container memory metrics

### NFR-005: Reliability - Graceful Degradation

If auto-orientation fails, continue with original image (don't block OCR).

**Target:** 100% of images processed even if orientation correction fails
**Measurement:** Error rate metrics

### NFR-006: Logging - No PII in Logs

Low-confidence logs must not contain extracted text or full storage URLs.

**Target:** Zero PII in orientation-related logs
**Measurement:** Log audit

## Technical Considerations

### Architecture

```
Image Upload → Preprocessing (Sharp) → OCR (Tesseract) → Result
                    ↓
              Auto-Orient (EXIF)
                    ↓
              [Stage 2: OSD Detection if needed]
```

### Files to Modify (Stage 1)

1. `quikadmin/src/services/OCRService.ts`
   - Add `rotate()` to `preprocessImage()`
   - Add `rotate()` to any other preprocessing methods

2. `quikadmin/src/queues/ocrQueue.ts`
   - Add low-confidence logging after OCR completion

3. `quikadmin/src/utils/logger.ts` (if needed)
   - Ensure structured logging supports new fields

### Files to Modify (Stage 2)

1. `quikadmin/src/services/OCRService.ts`
   - Add `detectOrientation()` method
   - Modify `initialize()` for conditional legacy support

2. `quikadmin/src/queues/ocrQueue.ts`
   - Add OSD detection before OCR for scanned PDFs

### API Changes

None - this is an internal processing improvement.

### Database Changes

None required. Consider adding `orientationCorrected` boolean to Document model for analytics (optional).

### Dependencies

- Sharp (already installed) - used for rotation
- Tesseract.js (already installed) - Stage 2 uses legacy mode

### Testing Strategy

1. **Unit Tests:**
   - Test `preprocessImage()` with rotated images
   - Test `detectOrientation()` (Stage 2)
   - Test low-confidence logging

2. **Integration Tests:**
   - Upload rotated phone photo → verify correct extraction
   - Upload sideways scanned PDF → verify logging (Stage 1) / correction (Stage 2)

3. **Test Images Needed:**
   - Phone photo with EXIF orientation 6 (90° CW)
   - Phone photo with EXIF orientation 8 (90° CCW)
   - Phone photo with EXIF orientation 3 (180°)
   - Scanned PDF rotated 90°
   - Normal correctly-oriented image (regression test)

## Implementation Roadmap

### Phase 1: Stage 1 Core (Must Have)

1. Add Sharp auto-orientation to preprocessing
2. Add low-confidence logging
3. Unit tests for preprocessing
4. Integration test with rotated image

### Phase 2: Stage 1 Monitoring (Should Have)

1. Configure confidence threshold env var
2. Set up monitoring dashboard/alerts
3. Document monitoring runbook

### Phase 3: Stage 2 Foundation (Future - If Data Shows Need)

1. Implement legacy Tesseract initialization
2. Implement OSD detection function
3. Unit tests for OSD

### Phase 4: Stage 2 Integration (Future - If Data Shows Need)

1. Integrate OSD into OCR pipeline
2. Add feature flag control
3. Integration tests for scanned PDFs

## Out of Scope

- Cloud OCR integration (Google Vision, AWS Textract)
- ML-based orientation detection models
- User-facing rotation controls in UI
- Batch re-processing of historical documents
- Skew detection (slight angle, not 90° rotations)

## Open Questions & Risks

### Q1: What is the actual percentage of rotated documents?

**Owner:** Engineering
**Status:** Will be answered by Stage 1 logging
**Mitigation:** Stage 1 logging will provide data

### Q2: Does pdf2pic preserve any orientation metadata?

**Owner:** Engineering
**Status:** Needs investigation
**Mitigation:** Test with known rotated PDF

### Risk 1: EXIF rotation makes image worse

**Probability:** Low
**Impact:** Medium
**Mitigation:** Sharp handles invalid EXIF gracefully (does nothing)

### Risk 2: Stage 2 memory usage exceeds container limits

**Probability:** Medium
**Impact:** High
**Mitigation:** Test in staging environment before production; consider separate OSD worker

## Validation Checkpoints

### Checkpoint 1: After Stage 1 Core

- [ ] Rotated phone photo produces correct OCR
- [ ] Low-confidence results are logged
- [ ] No performance regression in processing time
- [ ] Unit tests pass

### Checkpoint 2: After Stage 1 Monitoring

- [ ] Dashboard shows low-confidence trends
- [ ] Alerts fire correctly on test data
- [ ] Runbook is documented

### Checkpoint 3: After Stage 2 (if implemented)

- [ ] Sideways scanned PDF produces correct OCR
- [ ] OSD detection accuracy >90%
- [ ] Memory usage within limits
- [ ] Feature flag controls behavior correctly

---

**Document Version:** 1.0
**Created:** 2026-01-05
**Author:** Expert Panel (Dr. Chen, Sarah, Marcus, Alex) + Claude
**Status:** Approved for Implementation
