# E2E Test Fixtures

This directory contains test files used by the Playwright E2E tests.

## Files

### PDF Documents

- **sample-document.pdf** - A simple 1-page PDF used for basic upload tests
- **sample-document-2.pdf** - A second PDF used for multiple file upload tests
- **large-document.pdf** - A PDF used to test upload progress indicators
- **oversized-document.pdf** - A PDF used to test file size validation (note: actual validation is server-side)

All PDFs are minimal valid PDF 1.4 documents with basic text content.

### Invalid Files

- **invalid-file.txt** - A plain text file used to test file type validation

## Usage

These fixtures are referenced in the Playwright tests using relative paths:

```typescript
import path from 'path';

const testFilePath = path.join(__dirname, '../fixtures/sample-document.pdf');
await fileInput.setInputFiles(testFilePath);
```

## Regenerating Fixtures

If you need to regenerate these files, they were created as minimal valid PDF documents following the PDF 1.4 specification. The PDFs contain simple text content rendered using the Helvetica font.

## Notes

- The "large" and "oversized" PDFs are currently the same size as the sample PDFs because file size validation is handled server-side in the actual tests
- If you need truly large files for testing, you can manually create them or generate them programmatically using pdf-lib or similar libraries
