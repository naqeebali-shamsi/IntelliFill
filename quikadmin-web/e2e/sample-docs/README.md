# E2E Test Sample Documents

This folder contains sample documents for E2E Playwright tests. These files are used for testing document upload, OCR processing, and batch operations.

## Available Files

| File | Type | Size | Purpose |
|------|------|------|---------|
| `sample-pdf-text.pdf` | PDF | ~142 KB | Standard PDF with text for OCR testing |
| `sample-multipage.pdf` | PDF | ~58 KB | Multi-page PDF for batch/pagination tests |
| `sample-image.jpg` | JPEG | ~146 KB | JPEG image for image upload tests |
| `sample-image.png` | PNG | ~2 KB | PNG image for transparency/format tests |
| `corrupt-file.pdf` | Invalid | 49 B | Invalid PDF for error handling tests |

## Usage in Tests

### Importing Sample Files

```typescript
import path from 'path';

// Get absolute path to sample files
const SAMPLE_DOCS_DIR = path.join(__dirname, '..', 'sample-docs');

const sampleFiles = {
  validPdf: path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf'),
  multiPagePdf: path.join(SAMPLE_DOCS_DIR, 'sample-multipage.pdf'),
  jpgImage: path.join(SAMPLE_DOCS_DIR, 'sample-image.jpg'),
  pngImage: path.join(SAMPLE_DOCS_DIR, 'sample-image.png'),
  corruptPdf: path.join(SAMPLE_DOCS_DIR, 'corrupt-file.pdf'),
};
```

### Document Upload Test Example

```typescript
import { test, expect } from '@playwright/test';
import path from 'path';

const SAMPLE_DOCS_DIR = path.join(__dirname, '..', 'sample-docs');

test('should upload and process PDF document', async ({ page }) => {
  // Navigate to documents page
  await page.goto('/documents');

  // Upload file using file chooser
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.click('[data-testid="upload-button"]');
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf'));

  // Wait for processing
  await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
  await expect(page.locator('[data-testid="document-status"]')).toHaveText('Processed', { timeout: 30000 });
});
```

### Batch Upload Test Example

```typescript
test('should handle batch upload of multiple documents', async ({ page }) => {
  await page.goto('/documents');

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.click('[data-testid="upload-button"]');
  const fileChooser = await fileChooserPromise;

  // Upload multiple files
  await fileChooser.setFiles([
    path.join(SAMPLE_DOCS_DIR, 'sample-pdf-text.pdf'),
    path.join(SAMPLE_DOCS_DIR, 'sample-multipage.pdf'),
    path.join(SAMPLE_DOCS_DIR, 'sample-image.jpg'),
  ]);

  // Verify batch queue
  await expect(page.locator('[data-testid="batch-progress"]')).toBeVisible();
  await expect(page.locator('[data-testid="documents-list"] li')).toHaveCount(3, { timeout: 60000 });
});
```

### Error Handling Test Example

```typescript
test('should show error for corrupt PDF', async ({ page }) => {
  await page.goto('/documents');

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.click('[data-testid="upload-button"]');
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(path.join(SAMPLE_DOCS_DIR, 'corrupt-file.pdf'));

  // Expect error message
  await expect(page.locator('[data-testid="upload-error"]')).toContainText('Invalid PDF');
});
```

## Adding New Sample Files

When adding new sample files:

1. Place file in this directory (`quikadmin-web/e2e/sample-docs/`)
2. Use descriptive names: `sample-{type}-{purpose}.{ext}`
3. Keep files under 1MB for fast test execution
4. Update this README with file details
5. Do NOT commit files with real PII or sensitive data

## Source Attribution

- `sample-pdf-text.pdf`: [Learning Container](https://www.learningcontainer.com/sample-pdf-files-for-testing/)
- `sample-multipage.pdf`: [Africa University](https://www.africau.edu/)
- Image files: Public domain samples
