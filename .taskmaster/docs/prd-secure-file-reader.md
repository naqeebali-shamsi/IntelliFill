# PRD: Secure File Reader Utility for R2 URL Support

## Executive Summary

Multiple backend services fail when processing files stored in Cloudflare R2 because they use `fs.readFile()` directly on URLs. This PRD defines a shared `fileReader.ts` utility module that provides secure, consistent file reading from both local paths and R2 URLs, with SSRF protection, size limits, and timeout handling.

## Problem Statement

### Current Situation

- 8+ services use `fs.readFile()` directly and fail with ENOENT when given R2 URLs
- Only `OCRService.ts` and `DocumentDetectionService.ts` have URL handling, but with security gaps
- No SSRF protection (accepts any URL)
- No file size limits (memory exhaustion risk)
- No download timeouts (slow loris attack vector)
- Code duplication across services

### User Impact

- Document uploads fail in production when R2 storage is enabled
- Knowledge processing pipeline fails completely
- Form filling and PDF processing broken for R2-stored files

### Business Impact

- Production environment non-functional for core features
- Security vulnerabilities in existing implementations
- Technical debt from duplicated code

## Goals & Success Metrics

| Goal                         | Metric                     | Baseline | Target  |
| ---------------------------- | -------------------------- | -------- | ------- |
| All services support R2 URLs | Services with URL support  | 2/10     | 10/10   |
| Zero SSRF vulnerabilities    | Allowed URL domains        | Any      | R2 only |
| Memory protection            | Max file size enforced     | None     | 50MB    |
| Timeout protection           | Download timeout           | None     | 30s     |
| Code deduplication           | Duplicate helper functions | 2        | 0       |

## User Stories

### US-001: As a backend service, I want to read files from both local paths and R2 URLs

**Acceptance Criteria:**

- Can pass local file path → returns Buffer
- Can pass R2 URL → downloads and returns Buffer
- Transparent API (same function handles both)
- Proper error handling for both cases

### US-002: As a security engineer, I want URL downloads restricted to allowed domains

**Acceptance Criteria:**

- Only R2 domains allowed (SSRF protection)
- Configurable domain allowlist
- Clear error message when domain blocked
- No localhost/internal IP access

### US-003: As an ops engineer, I want protection against large files and slow downloads

**Acceptance Criteria:**

- 50MB max file size enforced
- Streaming size check (not just Content-Length)
- 30 second timeout with abort
- Retry logic for transient failures

## Functional Requirements

### REQ-001: Core Utility Functions (Must Have)

Create `quikadmin/src/utils/fileReader.ts` with:

- `isUrl(path: string): boolean` - Check if string is HTTP/HTTPS URL
- `isAllowedUrl(url: string): boolean` - Validate URL against domain allowlist
- `downloadFile(url: string): Promise<Buffer>` - Download with security controls
- `downloadFileWithRetry(url: string): Promise<Buffer>` - Add retry logic
- `getFileBuffer(pathOrUrl: string): Promise<Buffer>` - Main API entry point

### REQ-002: Security Controls (Must Have)

- Domain allowlist: Only `*.r2.cloudflarestorage.com` and `*.r2.dev` patterns
- Environment variable `R2_PUBLIC_DOMAIN` for custom domains
- Reject localhost, 127.0.0.1, 10.x.x.x, 192.168.x.x, 172.16-31.x.x
- Log blocked attempts with URL (truncated for privacy)

### REQ-003: Resource Limits (Must Have)

- Max file size: 50MB (configurable)
- Download timeout: 30 seconds (configurable)
- Streaming size check (abort if exceeds during download)
- AbortController for clean timeout handling

### REQ-004: Retry Logic (Must Have)

- 3 retry attempts for transient failures
- Exponential backoff: 1s, 2s, 4s (max 10s)
- No retry on validation errors (UrlNotAllowedError, FileTooLargeError)
- Log retry attempts

### REQ-005: Custom Error Classes (Must Have)

- `UrlNotAllowedError` - SSRF blocked
- `FileTooLargeError` - Size limit exceeded
- `DownloadTimeoutError` - Timeout reached

### REQ-006: Configuration Interface (Should Have)

```typescript
interface FileReaderConfig {
  allowedDomains: string[];
  maxSizeBytes: number;
  timeoutMs: number;
  retry: { attempts: number; initialDelayMs: number; maxDelayMs: number };
}
```

### REQ-007: Unit Tests - TDD (Must Have)

Write tests BEFORE implementation:

- `isUrl()` - true for http/https, false for paths
- `isAllowedUrl()` - blocks localhost, internal IPs, non-R2 domains
- `downloadFile()` - throws on blocked domains, large files, timeouts
- `getFileBuffer()` - routes correctly to fs.readFile or download

### REQ-008: Refactor DocumentDetectionService (Must Have)

- Remove inline `isUrl()`, `downloadFile()`, `getFileBuffer()` functions
- Import from `../utils/fileReader`
- Update tests to mock fileReader module

### REQ-009: Refactor OCRService (Must Have)

- Remove inline `isUrl()`, `downloadFile()` functions
- Import from `../utils/fileReader`
- Keep temp file logic for pdf2pic (needs file path)
- Update tests to mock fileReader module

### REQ-010: Update documentExtraction.service.ts (Must Have)

- Modify `extractFromPath()` to use `getFileBuffer()`
- Handle both paths and URLs transparently

### REQ-011: Update DocumentParser.ts (Must Have)

- Update `parsePDF()`, `parseDOCX()`, `parseTXT()`, `parseCSV()`
- All methods use `getFileBuffer()` instead of `fs.readFile()`

### REQ-012: Update IntelliFillService.ts (Must Have)

- Update `fillPDF()`, `extractFormFields()`, `mergeDocuments()`
- All methods use `getFileBuffer()`

### REQ-013: Update Strategy Pattern Files (Must Have)

- `PDFParsingStrategy.ts` - use `getFileBuffer()`
- `DOCXParsingStrategy.ts` - use `getFileBuffer()`

### REQ-014: Update FormFiller.ts (Must Have)

- Update `fillPDFForm()` and `validateFormFields()`
- Both methods use `getFileBuffer()`

## Non-Functional Requirements

### NFR-001: Performance

- Download should not block event loop (use streaming)
- Memory usage: max 50MB per download + overhead
- Parallel downloads limited by Node.js fetch pool

### NFR-002: Security

- No arbitrary URL access (SSRF protection)
- No sensitive data in logs (truncate URLs)
- Fail closed on validation errors

### NFR-003: Reliability

- Graceful degradation on R2 outage
- Clear error messages for debugging
- Retry for transient failures only

### NFR-004: Maintainability

- Single source of truth for URL handling
- Well-documented public API
- 100% test coverage for utility module

## Technical Considerations

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Service Layer                         │
│  DocumentDetectionService, OCRService, FormFiller, etc. │
└─────────────────────────┬───────────────────────────────┘
                          │ getFileBuffer(pathOrUrl)
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  fileReader.ts                           │
│  isUrl() → isAllowedUrl() → downloadFile() → Buffer     │
│            ↓                                             │
│       fs.readFile()                                      │
└─────────────────────────────────────────────────────────┘
```

### Dependencies

- Node.js native `fetch` (v18+)
- `fs/promises` for local files
- No external HTTP libraries needed

### Environment Variables

```bash
# Optional: Custom R2 domain
R2_PUBLIC_DOMAIN=your-bucket.pub-xxx.r2.dev
```

## Implementation Roadmap

### Phase 1: Foundation (TDD)

1. Write unit tests for fileReader.ts (REQ-007)
2. Implement fileReader.ts core functions (REQ-001 to REQ-006)
3. Verify all tests pass

### Phase 2: Refactor Existing

4. Refactor DocumentDetectionService (REQ-008)
5. Refactor OCRService (REQ-009)
6. Run existing tests, update mocks

### Phase 3: Extend Coverage

7. Update documentExtraction.service.ts (REQ-010)
8. Update DocumentParser.ts (REQ-011)
9. Update IntelliFillService.ts (REQ-012)

### Phase 4: Complete Migration

10. Update PDFParsingStrategy.ts (REQ-013)
11. Update DOCXParsingStrategy.ts (REQ-013)
12. Update FormFiller.ts (REQ-014)

### Phase 5: Validation

13. Integration test with actual R2 URL
14. TypeScript compilation check
15. Commit and deploy

## Out of Scope

- S3, Azure Blob, GCS support (R2 only for now)
- Caching downloaded files (future enhancement)
- Streaming API (buffer-based only)
- Write operations (read-only utility)

## Open Questions

1. Should we cache downloaded files to avoid re-downloading? (Defer to future)
2. Should we support streaming for very large files? (Defer - 50MB limit sufficient)

## Validation Checkpoints

- [ ] After Phase 1: fileReader.ts tests pass (TDD complete)
- [ ] After Phase 2: Existing services work with R2 URLs
- [ ] After Phase 4: All services updated
- [ ] After Phase 5: Production deployment successful
