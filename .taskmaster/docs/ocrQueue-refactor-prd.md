# PRD: ocrQueue.ts Comprehensive Refactoring

## Overview

This PRD addresses critical issues identified during a multi-perspective code review of `quikadmin/src/queues/ocrQueue.ts`. The review was conducted by four specialized agents (Security, Performance, Error Handling, Code Quality) and achieved unanimous consensus on priority fixes.

## Problem Statement

The ocrQueue.ts file (487 lines) has accumulated technical debt across multiple dimensions:

- **Security**: IDOR vulnerability allows unauthorized access to job status
- **Performance**: Memory leaks from missing cleanup, no concurrency limits
- **Error Handling**: Resources not released on error paths
- **Code Quality**: DRY violations, missing types, excessive responsibilities

## Goals

1. Fix all critical security vulnerabilities
2. Eliminate memory leaks and resource exhaustion risks
3. Improve error handling and recovery
4. Reduce code duplication and improve maintainability
5. Add comprehensive input validation

## Non-Goals

- Rewriting the entire queue system
- Changing the Bull queue library
- Modifying the OCRService internals (separate concern)

---

## Technical Requirements

### 1. Critical: OCRService Cleanup on Error Path

**Current State**: When OCR processing fails, `ocrService.cleanup()` is never called, leading to Tesseract worker memory leaks.

**Location**: `quikadmin/src/queues/ocrQueue.ts` lines 153-271

**Requirements**:

- Convert job processor to use try-finally pattern
- Ensure `ocrService.cleanup()` is called in all code paths
- Add error handling for cleanup failures (log warning, don't throw)
- Verify cleanup is idempotent (safe to call multiple times)

**Acceptance Criteria**:

- OCRService cleanup called on success AND failure paths
- No Tesseract workers left dangling after job completion/failure
- Unit test verifies cleanup called in error scenarios

---

### 2. Critical: Fix IDOR Vulnerability in getOCRJobStatus

**Current State**: Any authenticated user can access any job's status by ID, exposing other users' document information.

**Location**: `quikadmin/src/queues/ocrQueue.ts` lines 392-418

**Requirements**:

- Add `requestingUserId` parameter to `getOCRJobStatus` function
- Verify `job.data.userId === requestingUserId` before returning data
- Return null or throw UnauthorizedError for unauthorized access
- Update all callers to pass the requesting user's ID
- Filter sensitive fields (filePath) from response

**Acceptance Criteria**:

- Users can only access their own job statuses
- Unauthorized access returns null (not an error to prevent enumeration)
- API endpoint updated to pass authenticated user ID
- Unit test verifies authorization check

---

### 3. High: Add Input Validation for Job Data

**Current State**: Job processor destructures data without validation. Missing/malformed fields cause cryptic errors.

**Location**: `quikadmin/src/queues/ocrQueue.ts` lines 149-151

**Requirements**:

- Validate required fields (documentId, filePath) at processor start
- Validate documentId is valid UUID format
- Validate filePath is either:
  - A valid URL starting with allowed domains (R2 storage URL)
  - A valid local path within allowed directories (if applicable)
- Throw descriptive errors for validation failures
- Add similar validation to `enqueueDocumentForOCR` and `enqueueDocumentForReprocessing`

**Acceptance Criteria**:

- Invalid job data fails fast with clear error message
- Path traversal attempts blocked
- SSRF attempts blocked (only allowed domains for URLs)
- Unit tests cover validation edge cases

---

### 4. High: Add Concurrency Limit to Queue Processor

**Current State**: No explicit concurrency limit. Under load, unlimited concurrent OCR jobs can exhaust memory.

**Location**: `quikadmin/src/queues/ocrQueue.ts` line 149

**Requirements**:

- Add concurrency parameter to `ocrQueue.process()`
- Make concurrency configurable via `OCR_CONCURRENCY` environment variable
- Default to 1 (OCR is memory-intensive)
- Document recommended values in environment config

**Acceptance Criteria**:

- Processor uses explicit concurrency limit
- Concurrency configurable via environment variable
- Default is safe for memory-constrained environments

---

### 5. High: Fix Unhandled Promise in Error Handler

**Current State**: Dynamic import in queue error handler can throw, causing unhandled promise rejection.

**Location**: `quikadmin/src/queues/ocrQueue.ts` lines 116-125

**Requirements**:

- Wrap dynamic import in try-catch
- Log warning if health check import fails
- Consider changing to static import at module top
- Ensure error handler never throws

**Acceptance Criteria**:

- Error handler gracefully handles import failures
- No unhandled promise rejections from error handler
- Queue error logging always succeeds

---

### 6. Medium: Extract Shared Redis Configuration

**Current State**: `getRedisConfig()` function is duplicated across ocrQueue.ts, documentQueue.ts, and multiagentQueue.ts.

**Requirements**:

- Create `quikadmin/src/utils/redisConfig.ts` with shared configuration
- Export `getRedisConfig()` function
- Export `defaultBullSettings` object with queue settings
- Update all queue files to import from shared module
- Remove duplicated code from queue files

**Acceptance Criteria**:

- Single source of truth for Redis configuration
- All queue files use shared module
- No duplicated getRedisConfig implementations
- Tests pass after refactoring

---

### 7. Medium: Add Job Deduplication

**Current State**: Same document can be queued multiple times, wasting resources.

**Location**: `quikadmin/src/queues/ocrQueue.ts` lines 350-355

**Requirements**:

- Add `jobId` option when adding jobs: `jobId: \`ocr-${documentId}\``
- Handle duplicate job gracefully (return existing job or skip)
- Log when duplicate job is detected
- Apply same pattern to reprocessing jobs

**Acceptance Criteria**:

- Same document cannot be queued twice simultaneously
- Duplicate attempts logged for debugging
- Existing job returned when duplicate detected

---

### 8. Medium: Handle Document Not Found in Reprocessing

**Current State**: If document doesn't exist, reprocessing proceeds with undefined reprocessCount.

**Location**: `quikadmin/src/queues/ocrQueue.ts` lines 446-453

**Requirements**:

- Add explicit null check after `prisma.document.findUnique`
- Throw descriptive error if document not found
- Log document not found with documentId for debugging

**Acceptance Criteria**:

- Reprocessing of non-existent document fails with clear error
- Error message includes documentId
- Unit test covers document not found case

---

### 9. Medium: Add TypeScript Return Types

**Current State**: Several exported functions lack explicit return type annotations.

**Requirements**:

- Define `QueueHealthStatus` interface for `getOCRQueueHealth` return
- Define `OCRJobStatus` interface for `getOCRJobStatus` return
- Add explicit return types to all exported async functions
- Ensure interfaces are exported for consumer use

**Acceptance Criteria**:

- All exported functions have explicit return types
- Interfaces exported from module
- TypeScript strict mode passes

---

### 10. Medium: Extract Magic Numbers to Constants

**Current State**: Queue configuration uses inline magic numbers (100, 50, 3, 3000, 600000, etc.).

**Requirements**:

- Create `OCR_QUEUE_CONFIG` constant object at module top
- Include all configuration values with descriptive names
- Add JSDoc comments explaining each value
- Reference constants in queue configuration

**Acceptance Criteria**:

- No magic numbers in queue configuration
- All values have descriptive names
- Configuration is self-documenting

---

### 11. Low: Move Global Process Handlers

**Current State**: `unhandledRejection` and `uncaughtException` handlers registered in queue module.

**Requirements**:

- Remove process handlers from ocrQueue.ts
- Verify handlers exist in main entry point (index.ts)
- If not, add centralized handlers to index.ts
- Document error handling strategy

**Acceptance Criteria**:

- No process handlers in queue modules
- Centralized handlers in application entry point
- Error handling documented

---

### 12. Low: Add SIGINT Handler for Development

**Current State**: Only SIGTERM handled, SIGINT (Ctrl+C) doesn't trigger cleanup.

**Location**: `quikadmin/src/queues/ocrQueue.ts` lines 424-430

**Requirements**:

- Add SIGINT handler alongside SIGTERM
- Use `process.once` instead of `process.on` to prevent duplicate handlers
- Add timeout to queue.close() to prevent hanging
- Log if graceful shutdown times out

**Acceptance Criteria**:

- Ctrl+C triggers graceful shutdown in development
- Shutdown has timeout (10 seconds)
- Handlers registered only once

---

## Implementation Order

1. **Phase 1 - Critical Security & Stability** (Tasks 1-3)
   - OCRService cleanup
   - IDOR fix
   - Input validation

2. **Phase 2 - Performance** (Tasks 4-5)
   - Concurrency limit
   - Error handler fix

3. **Phase 3 - Code Quality** (Tasks 6-10)
   - Extract Redis config
   - Job deduplication
   - Document not found handling
   - TypeScript types
   - Magic numbers

4. **Phase 4 - Polish** (Tasks 11-12)
   - Global handlers
   - SIGINT support

---

## Testing Strategy

- Unit tests for each fix
- Integration test for full job lifecycle
- Load test to verify memory stability under concurrent jobs
- Security test for IDOR prevention

## Success Metrics

- Zero memory leaks after 100 consecutive job failures
- Authorization check blocks 100% of cross-user access attempts
- All TypeScript strict mode checks pass
- Code duplication reduced by extracting shared Redis config
