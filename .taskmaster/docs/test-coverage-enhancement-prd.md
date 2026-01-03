# IntelliFill Test Coverage Enhancement PRD

## Overview

**Project**: IntelliFill Document-to-Profile Pipeline Test Coverage
**Version**: 1.0
**Priority**: High
**Estimated Scope**: 40+ test files, ~2500 lines of test code

## Background

Analysis of the IntelliFill codebase reveals significant gaps in test coverage for the document-to-profile data pipeline. Current overall coverage is approximately 65%, with critical functions like `mergeToClientProfile()` having zero test coverage. This PRD defines the requirements for comprehensive test coverage enhancement.

## Objectives

1. Achieve 90%+ unit test coverage for document processing pipeline
2. Implement E2E tests for all user-critical flows
3. Add integration tests for API endpoints with missing coverage
4. Create test fixtures for consistent, repeatable testing

---

## Requirements

### REQ-001: FormFiller Unit Tests (P0 Critical)

**Description**: Create comprehensive unit tests for `quikadmin/src/fillers/FormFiller.ts`

**Acceptance Criteria**:
- Test `fillPDFForm()` with valid PDF forms
- Test checkbox, radio button, dropdown field handling
- Test boolean parsing variations (`"yes"`, `"checked"`, `"1"`, `true`)
- Test text field truncation for long values
- Test Unicode text handling in form fields
- Test corrupted PDF input error handling
- Test PDF with no fillable fields
- Test PDF with encrypted/locked fields
- Test `FLATTEN_FORMS` environment variable behavior
- Minimum 15 test cases

**Files to Create**:
- `quikadmin/src/fillers/__tests__/FormFiller.test.ts`

---

### REQ-002: DataExtractor Unit Tests (P0 Critical)

**Description**: Create unit tests for `quikadmin/src/extractors/DataExtractor.ts`

**Acceptance Criteria**:
- Test email extraction regex patterns
- Test phone number extraction (US, international formats)
- Test name extraction with titles (Dr., Mrs., etc.)
- Test address extraction with/without street keywords
- Test date extraction (US and European formats)
- Test SSN/ID number extraction
- Test `extractFromMultiple()` document handling
- Test confidence calculation logic
- Test empty document content handling
- Test overlapping regex match resolution
- Minimum 12 test cases

**Files to Create**:
- `quikadmin/src/extractors/__tests__/DataExtractor.test.ts`

---

### REQ-003: mergeToClientProfile Unit Tests (P0 Critical)

**Description**: Create unit tests for the `mergeToClientProfile()` function in client-documents routes

**Acceptance Criteria**:
- Test creating new ClientProfile when none exists
- Test merging fields into existing profile
- Test skipping manually edited fields (`manuallyEdited: true`)
- Test fieldSources tracking with correct documentId
- Test handling empty/null extracted values
- Test concurrent merge operations (race conditions)
- Test database error handling and rollback
- Test field overwrite prevention (first-wins behavior)
- Minimum 10 test cases

**Files to Create**:
- `quikadmin/src/api/__tests__/client-documents.routes.test.ts`

---

### REQ-004: Client Profile API Integration Tests (P0 Critical)

**Description**: Create integration tests for client profile API endpoints

**Acceptance Criteria**:
- Test GET `/api/clients/:clientId/profile` returns categorized structure
- Test PUT `/api/clients/:clientId/profile` creates manual edit flags
- Test PATCH `/api/clients/:clientId/profile/fields/:fieldName` updates single field
- Test DELETE profile clears all data
- Test export endpoints (JSON and CSV formats)
- Test empty profile state handling (auto-creation)
- Test cross-user access prevention (security)
- Minimum 10 test cases

**Files to Create**:
- `quikadmin/src/api/__tests__/client-profile.routes.test.ts`

---

### REQ-005: MultiAgent Workflow Node Tests (P1 High)

**Description**: Create unit tests for LangGraph workflow nodes

**Acceptance Criteria**:
- Test `classifyNode()` document classification
- Test `extractNode()` data extraction
- Test `mapNode()` field mapping
- Test `qaNode()` quality assurance checks
- Test `errorRecoverNode()` retry logic
- Test `finalizeNode()` result formatting
- Test routing logic (`routeAfterQA`, `routeAfterErrorRecovery`)
- Test full graph traversal end-to-end
- Test state mutations at each step
- Test max retry limit behavior
- Minimum 12 test cases

**Files to Create**:
- `quikadmin/src/multiagent/__tests__/workflow.test.ts`

---

### REQ-006: IntelliFillService Unit Tests (P1 High)

**Description**: Create unit tests for the IntelliFill orchestration service

**Acceptance Criteria**:
- Test form filling orchestration flow
- Test template selection logic
- Test profile-to-form field mapping
- Test error handling for missing templates
- Test partial data mapping warnings
- Test confidence threshold handling
- Minimum 8 test cases

**Files to Create**:
- `quikadmin/src/services/__tests__/IntelliFillService.test.ts`

---

### REQ-007: Worker Processor Tests (P1 High)

**Description**: Create tests for queue worker processor functions

**Acceptance Criteria**:
- Test OCR worker processor actual logic (not mocked)
- Test knowledge processor worker
- Test job progress updates
- Test failure handling with database status updates
- Test RealtimeService notification calls
- Test job timeout handling
- Test job cancellation mid-processing
- Minimum 10 test cases

**Files to Create**:
- `quikadmin/src/workers/__tests__/ocrProcessor.test.ts`
- `quikadmin/src/workers/__tests__/knowledgeProcessor.test.ts`

---

### REQ-008: E2E Profile Aggregation Tests (P0 Critical)

**Description**: Implement E2E tests for profile aggregation flows

**Test Scenarios**:
- PROF-AGG-001: Single document creates profile with extracted fields
- PROF-AGG-002: Multiple documents merge fields correctly
- PROF-AGG-003: Conflicting data merge handling (first-wins)
- PROF-AGG-004: Field sources tracking accuracy

**Acceptance Criteria**:
- Create test fixtures: `test-passport.pdf`, `test-emirates-id.jpg`, `test-trade-license.pdf`
- Verify document status transitions: UPLOADED -> PROCESSING -> EXTRACTED
- Verify ClientProfile created with correct fields
- Verify fieldSources contains documentId, extractedAt, manuallyEdited
- Verify categorizedData structure in API response

**Files to Create**:
- `e2e/tests/profile-aggregation.spec.ts`
- `e2e/fixtures/test-passport.pdf`
- `e2e/fixtures/test-emirates-id.jpg`
- `e2e/fixtures/test-trade-license.pdf`

---

### REQ-009: E2E Manual Edit Protection Tests (P0 Critical)

**Description**: Implement E2E tests for manual edit protection flows

**Test Scenarios**:
- PROF-EDIT-001: Manual edit preserved after new document upload
- PROF-EDIT-002: Clear manual edit flag allows OCR overwrite
- PROF-EDIT-003: PUT profile creates manual edit flags automatically

**Acceptance Criteria**:
- Verify manual edits are not overwritten by OCR
- Verify clearing manuallyEdited flag allows OCR update
- Verify all PUT operations set manuallyEdited: true
- Test field-level manual edit API

**Files to Create**:
- `e2e/tests/manual-edit-protection.spec.ts`

---

### REQ-010: E2E Form Filling Integration Tests (P1 High)

**Description**: Implement E2E tests for complete form filling flow

**Test Scenarios**:
- FORM-FILL-001: Auto-fill form from client profile
- FORM-FILL-002: Partial data mapping (missing fields warning)
- FORM-FILL-003: Confidence indicators on filled fields

**Acceptance Criteria**:
- Verify filled PDF created with mapped fields
- Verify unmapped fields handled gracefully
- Verify missingFields array in response
- Verify confidence metadata returned
- Test download functionality

**Files to Create**:
- `e2e/tests/form-filling.spec.ts`
- `e2e/fixtures/visa-application-template.pdf`

---

### REQ-011: E2E Error Handling Tests (P1 High)

**Description**: Implement E2E tests for error scenarios

**Test Scenarios**:
- ERR-OCR-001: OCR failure handling (corrupted file)
- ERR-OCR-002: Invalid document format rejection
- ERR-MERGE-001: Profile merge failure recovery
- ERR-QUEUE-001: Queue unavailable fallback
- ERR-FILE-001: Document file not found on disk

**Acceptance Criteria**:
- Verify graceful error messages
- Verify profile not corrupted by failed extraction
- Verify retry options available
- Verify fallback to sync processing when queue unavailable

**Files to Create**:
- `e2e/tests/error-handling.spec.ts`
- `e2e/fixtures/test-corrupted.pdf`

---

### REQ-012: E2E Security Tests (P0 Critical)

**Description**: Implement E2E tests for security scenarios

**Test Scenarios**:
- SEC-AUTH-001: Unauthorized profile access prevention
- SEC-FILE-001: Malicious file upload prevention

**Acceptance Criteria**:
- Verify cross-user profile access returns 404
- Verify malicious files rejected or sanitized
- Verify path traversal attacks blocked
- Verify audit logging of access attempts

**Files to Create**:
- `e2e/tests/security.spec.ts`

---

### REQ-013: DocumentDetectionService Unit Tests (P1 High)

**Description**: Create unit tests for document type detection

**Acceptance Criteria**:
- Test passport detection
- Test Emirates ID detection
- Test trade license detection
- Test visa detection
- Test unknown document type handling
- Test confidence scoring for detection
- Minimum 8 test cases

**Files to Create**:
- `quikadmin/src/services/__tests__/DocumentDetectionService.test.ts`

---

### REQ-014: R2 Storage Service Unit Tests (P1 High)

**Description**: Create unit tests for R2/S3 storage operations

**Acceptance Criteria**:
- Test file upload to R2
- Test file download from R2
- Test file deletion
- Test presigned URL generation
- Test error handling for network failures
- Test retry logic
- Minimum 8 test cases

**Files to Create**:
- `quikadmin/src/services/__tests__/r2Storage.service.test.ts`

---

### REQ-015: Frontend Store Tests (P2 Medium)

**Description**: Create tests for frontend Zustand stores

**Acceptance Criteria**:
- Test documentStore state transitions
- Test profileStore aggregation and caching
- Test error states in stores
- Test store reset functionality
- Minimum 6 test cases per store

**Files to Create**:
- `quikadmin-web/src/stores/__tests__/documentStore.test.ts`
- `quikadmin-web/src/stores/__tests__/profileStore.test.ts`

---

### REQ-016: OCR Service Edge Case Tests (P2 Medium)

**Description**: Extend OCR service tests for edge cases

**Acceptance Criteria**:
- Test international phone formats (+44, +91, +971)
- Test Unicode text extraction
- Test very large documents (>50 pages)
- Test partially corrupted files
- Test non-standard date formats (European DD/MM/YYYY)
- Minimum 8 additional test cases

**Files to Modify**:
- `quikadmin/src/services/__tests__/OCRService.test.ts`

---

### REQ-017: FieldMapper Edge Case Tests (P2 Medium)

**Description**: Extend FieldMapper tests for edge cases

**Acceptance Criteria**:
- Test extremely long field names (>255 chars)
- Test field names with only special characters
- Test Levenshtein distance with very similar names
- Test entity extraction with undefined entities array
- Test type validation for non-string values
- Minimum 6 additional test cases

**Files to Modify**:
- `quikadmin/src/mappers/__tests__/FieldMapper.test.ts`

---

### REQ-018: Performance Tests (P2 Medium)

**Description**: Create performance tests for critical paths

**Test Scenarios**:
- PERF-LARGE-001: Large document processing (50 pages)
- PERF-BULK-001: Bulk document upload (5 documents concurrent)

**Acceptance Criteria**:
- Upload completes within 30s
- Extraction completes within 10 minutes for large docs
- No race conditions in concurrent profile merge
- Progress events received correctly

**Files to Create**:
- `e2e/tests/performance.spec.ts`

---

## Test Fixtures Required

| Fixture File | Description | Location |
|--------------|-------------|----------|
| `test-passport.pdf` | Clear passport scan with MRZ | `e2e/fixtures/` |
| `test-emirates-id.jpg` | Emirates ID card image | `e2e/fixtures/` |
| `test-trade-license.pdf` | Trade license document | `e2e/fixtures/` |
| `test-visa.pdf` | UAE visa page | `e2e/fixtures/` |
| `test-corrupted.pdf` | Malformed PDF for error tests | `e2e/fixtures/` |
| `visa-application-template.pdf` | Form template with mappings | `e2e/fixtures/` |
| `large-document-50pages.pdf` | Performance test document | `e2e/fixtures/` |

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Backend Unit Test Coverage | 65% | 90% |
| E2E Test Files | 5 | 12 |
| Critical Functions Tested | 60% | 100% |
| P0 Requirements Covered | 0% | 100% |

---

## Priority Summary

| Priority | Requirements | Description |
|----------|--------------|-------------|
| P0 (Critical) | REQ-001, REQ-002, REQ-003, REQ-004, REQ-008, REQ-009, REQ-012 | Core pipeline and security |
| P1 (High) | REQ-005, REQ-006, REQ-007, REQ-010, REQ-011, REQ-013, REQ-014 | Supporting infrastructure |
| P2 (Medium) | REQ-015, REQ-016, REQ-017, REQ-018 | Edge cases and performance |

---

## Dependencies

- Existing test infrastructure (Jest, Vitest, Playwright)
- Mock data generators
- Test database setup scripts
- CI/CD pipeline test stages

## Out of Scope

- Load testing infrastructure
- Visual regression testing
- Accessibility testing (separate initiative)
