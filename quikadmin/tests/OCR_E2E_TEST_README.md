# OCR End-to-End Test Suite

## Overview

This test suite provides comprehensive end-to-end testing for OCR (Optical Character Recognition) functionality in the IntelliFill system. It tests document upload, OCR processing, status polling, error handling, and document management using real sample files.

## Test Files Location

Sample files are located in the `sample-pdfs/` directory at the project root:
- `passport-sample.pdf` - Sample passport document
- `passport-sample-form.pdf` - Sample passport form to fill
- `ejari.pdf` - Sample Ejari document
- `emirated-id-sample.jpeg` - Sample Emirates ID image

## Prerequisites

1. **Backend API Running**: The backend must be running on `http://localhost:3002`
2. **Database Connected**: PostgreSQL database must be accessible
3. **Authentication**: Test user must exist or will be auto-created
4. **Dependencies**: All npm packages must be installed

## Running the Tests

### Using TypeScript (Recommended)

```bash
cd quikadmin
npx ts-node tests/ocr-e2e-test.ts
```

### Using Node.js (if compiled)

```bash
cd quikadmin
node dist/tests/ocr-e2e-test.js
```

### With Environment Variables

```bash
API_URL=http://localhost:3002 npx ts-node tests/ocr-e2e-test.ts
```

## Test Scenarios

### 1. Authentication
- ✅ Login with existing test user
- ✅ Auto-register if user doesn't exist

### 2. Document Upload Tests
- ✅ Upload PDF document with form (`/api/process/single`)
- ⚠️ Upload JPEG image (may require form)
- ✅ Upload invalid file type (should fail)
- ✅ Upload without authentication (should fail)
- ✅ Upload large file > 10MB (should fail)

### 3. Document Status Tests
- ✅ Get document status by ID
- ✅ List all documents
- ✅ Poll document status until complete
- ✅ Get document extracted data

### 4. Document Processing Tests
- ✅ Wait for OCR processing to complete
- ✅ Verify confidence score
- ✅ Check extracted data availability

### 5. Document Management Tests
- ✅ Reprocess document
- ✅ Delete document
- ✅ Get document without authentication (should fail)

## Test Results

The test suite outputs:
- ✅ **PASS** - Test passed successfully
- ❌ **FAIL** - Test failed with error details
- Summary statistics (total, passed, failed, success rate)

## Expected Behavior

### Successful Upload Flow

1. **Upload**: Document uploaded via `/api/process/single`
   - Returns: `documentId`, `confidence`, `processingTime`
   - Status: `PROCESSING` initially

2. **Processing**: OCR processing happens asynchronously
   - Status transitions: `PROCESSING` → `COMPLETED` or `FAILED`
   - Can be polled via `/api/documents/:id/status`

3. **Completion**: Document ready for use
   - Status: `COMPLETED`
   - Extracted data available via `/api/documents/:id/data`
   - Confidence score available

### Error Scenarios

- **Invalid File Type**: Returns 400 Bad Request
- **Missing Authentication**: Returns 401 Unauthorized
- **File Too Large**: Returns 413 Payload Too Large
- **Missing Form**: Returns 400 (for `/api/process/single`)

## Troubleshooting

### Test Failures

1. **Authentication Failed**
   - Check if backend is running
   - Verify test user credentials
   - Check Supabase configuration

2. **File Not Found**
   - Ensure sample files exist in `sample-pdfs/` directory
   - Check file paths in test code

3. **Processing Timeout**
   - OCR processing can take time (especially for multi-page PDFs)
   - Increase `maxWaitTime` in `waitForDocumentProcessing()`

4. **Connection Errors**
   - Verify backend URL: `http://localhost:3002`
   - Check if backend health endpoint responds: `/health`

### Common Issues

**Issue**: "Sample file not found"
- **Solution**: Ensure `sample-pdfs/` directory exists with test files

**Issue**: "Authentication failed"
- **Solution**: Create test user manually or check Supabase connection

**Issue**: "Processing timeout"
- **Solution**: OCR processing is slow; increase timeout or check queue workers

**Issue**: "Document not found"
- **Solution**: Verify document was created in database; check user ID matches

## Integration with CI/CD

To integrate with CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run OCR E2E Tests
  run: |
    cd quikadmin
    npm install
    npx ts-node tests/ocr-e2e-test.ts
  env:
    API_URL: http://localhost:3002
```

## Extending the Tests

### Adding New Test Cases

1. Create a new test function following the pattern:
```typescript
async function testNewScenario() {
  try {
    // Test implementation
    logTest('Test Name', true);
    return result;
  } catch (error: any) {
    logTest('Test Name', false, error.message);
    return null;
  }
}
```

2. Add to `runAllTests()` function:
```typescript
await testNewScenario();
```

### Testing Different File Types

Add new test functions for different file types:
- DOCX documents
- PNG images
- Multi-page PDFs
- Scanned documents

### Testing Performance

Add performance tests:
- Processing time benchmarks
- Memory usage monitoring
- Concurrent upload testing

## Notes

- Tests use real file uploads and OCR processing
- Processing time varies based on document complexity
- Some tests may be skipped if sample files are missing
- Authentication is required for most operations
- Tests clean up by deleting created documents

## Related Files

- `quikadmin/src/services/OCRService.ts` - OCR service implementation
- `quikadmin/src/queues/ocrQueue.ts` - OCR queue processing
- `quikadmin/tests/integration/ocr.test.ts` - Unit/integration tests
- `quikadmin/src/api/documents.routes.ts` - Document API routes

