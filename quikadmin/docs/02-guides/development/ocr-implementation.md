# OCR Implementation Guide

**Last Updated:** 2025-01-19
**Status:** Production Ready
**Version:** 2.0

## Overview

The OCR (Optical Character Recognition) service enables IntelliFill to extract text from scanned documents and images. This implementation uses Tesseract.js for OCR processing and pdf2pic for PDF-to-image conversion.

## Architecture

### Components

1. **OCRService** (`src/services/OCRService.ts`)
   - Main service class handling OCR operations
   - Manages Tesseract worker lifecycle
   - Handles PDF and image processing

2. **pdf2pic Integration**
   - Converts PDF pages to high-quality images
   - Optimized for OCR accuracy (300 DPI)
   - Memory-efficient processing

3. **Sharp Image Processing**
   - Preprocessing pipeline for OCR optimization
   - Grayscale conversion, normalization, sharpening
   - Threshold application for better text extraction

## Features

### 1. PDF Page-to-Image Conversion

The `pdfPageToImage()` method converts PDF pages to images for OCR processing.

**Configuration:**
- **DPI:** 300 (high quality for accurate OCR)
- **Format:** PNG (lossless for text clarity)
- **Size:** 2480x3508 pixels (A4 at 300 DPI)
- **Compression:** JPEG with 90% quality (memory optimization)

**Example:**
```typescript
import { OCRService } from './services/OCRService';

const ocrService = new OCRService();
await ocrService.initialize();

const result = await ocrService.processPDF('/path/to/document.pdf');
console.log(result.text);
console.log(`Confidence: ${result.confidence}%`);
```

### 2. Progress Tracking

Real-time progress updates for multi-page documents:

```typescript
await ocrService.processPDF('/path/to/document.pdf', (progress) => {
  console.log(`Stage: ${progress.stage}`);
  console.log(`Page: ${progress.currentPage}/${progress.totalPages}`);
  console.log(`Progress: ${progress.progress}%`);
  console.log(`Message: ${progress.message}`);
});
```

**Progress Stages:**
- `converting` - PDF page being converted to image
- `preprocessing` - Image optimization for OCR
- `recognizing` - Text recognition in progress
- `complete` - OCR processing complete

### 3. Memory Management

**Automatic Cleanup:**
- Temporary files are stored in OS temp directory
- Files are automatically deleted after processing
- Buffer references are released for garbage collection

**Multi-page Optimization:**
- Pages processed sequentially to limit memory usage
- Temporary directory cleaned up in `finally` block
- Worker reused across pages for efficiency

### 4. Image Preprocessing

Preprocessing pipeline for optimal OCR accuracy:

```typescript
private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
  const processed = await sharp(imageBuffer)
    .greyscale()           // Convert to grayscale
    .normalize()           // Normalize contrast
    .sharpen()             // Sharpen text edges
    .threshold(128)        // Apply binary threshold
    .resize({ width: 2400 }) // Resize to optimal DPI
    .toBuffer();

  return processed;
}
```

## API Reference

### OCRService Class

#### Methods

**`initialize(): Promise<void>`**
- Initializes Tesseract worker
- Loads language models (eng, spa, fra, deu)
- Configures OCR parameters

**`processPDF(pdfPath: string, onProgress?: ProgressCallback): Promise<OCRResult>`**
- Processes PDF document with OCR
- Parameters:
  - `pdfPath`: Path to PDF file
  - `onProgress`: Optional callback for progress updates
- Returns: OCR result with extracted text and metadata

**`processImage(imagePath: string): Promise<OCRResult>`**
- Processes single image with OCR
- Parameters:
  - `imagePath`: Path to image file
- Returns: OCR result

**`extractStructuredData(text: string): Promise<Record<string, any>>`**
- Extracts structured data from text
- Patterns: email, phone, date, SSN, ZIP, currency, percentage
- Returns: Object with extracted data fields

**`enhanceWithOCR(originalText: string, ocrText: string): Promise<string>`**
- Merges original PDF text with OCR results
- Useful for hybrid PDFs with searchable and scanned content
- Returns: Enhanced merged text

**`cleanup(): Promise<void>`**
- Terminates Tesseract worker
- Releases resources

### Interfaces

**OCRResult**
```typescript
interface OCRResult {
  text: string;              // Full extracted text
  confidence: number;        // Overall confidence (0-100)
  pages: Array<{
    pageNumber: number;
    text: string;
    confidence: number;
  }>;
  metadata: {
    language: string;        // Language code
    processingTime: number;  // Time in milliseconds
    pageCount: number;       // Total pages processed
  };
}
```

**OCRProgress**
```typescript
interface OCRProgress {
  currentPage: number;       // Current page being processed
  totalPages: number;        // Total pages in document
  stage: 'converting' | 'preprocessing' | 'recognizing' | 'complete';
  progress: number;          // Progress percentage (0-100)
  message: string;           // Human-readable status message
}
```

## Performance Targets

### Benchmarks

- **OCR Accuracy:** ≥ 80% confidence on clear documents
- **Processing Speed:** < 5 seconds per page
- **Memory Usage:** < 100MB increase for multi-page documents
- **Initialization Time:** < 10 seconds

### Optimization Tips

1. **Batch Processing:**
   - Reuse OCRService instance for multiple documents
   - Worker initialization is expensive, amortize across calls

2. **Image Quality:**
   - 300 DPI provides optimal balance of quality and performance
   - Lower DPI reduces processing time but decreases accuracy
   - Higher DPI increases time with diminishing returns

3. **Memory Management:**
   - Process pages sequentially for large documents
   - Use progress callbacks to implement streaming updates
   - Clean up service when done: `await ocrService.cleanup()`

4. **Preprocessing:**
   - Preprocessing improves accuracy by 10-15%
   - Threshold value of 128 works well for most documents
   - Adjust for documents with poor contrast or colored backgrounds

## Testing

### Integration Tests

Run OCR integration tests:

```bash
npm test -- tests/integration/ocr.test.ts
```

**Test Coverage:**
- PDF page-to-image conversion
- Multi-page document processing
- Progress tracking functionality
- Memory leak detection
- OCR accuracy validation
- Error handling

### Manual Testing

Test with real scanned PDFs:

```bash
# Using the test OCR script
npx ts-node scripts/test-ocr.ts /path/to/scanned.pdf
```

## Troubleshooting

### Common Issues

**1. Low OCR Accuracy**
- Check image quality (DPI should be 300)
- Verify preprocessing is applied
- Ensure text is clear and high contrast
- Try adjusting threshold value in preprocessing

**2. Slow Processing**
- Reduce DPI if accuracy is acceptable at lower resolution
- Ensure worker is reused across pages
- Check system resources (CPU, memory)
- Consider processing pages in parallel for very large documents

**3. Memory Issues**
- Verify temporary files are being cleaned up
- Check that buffers are released after processing
- Monitor memory usage during processing
- Reduce concurrent processing if running multiple instances

**4. pdf2pic Errors**
- Ensure GraphicsMagick or ImageMagick is installed
- Check PDF file is not corrupted
- Verify sufficient disk space for temporary files
- Check file permissions on temp directory

### Debug Mode

Enable detailed logging:

```typescript
import { logger } from './utils/logger';

logger.level = 'debug';

const ocrService = new OCRService();
await ocrService.processPDF('/path/to/file.pdf');
```

## Dependencies

### Required Packages

```json
{
  "tesseract.js": "^6.0.1",
  "pdf2pic": "^2.x.x",
  "sharp": "^0.33.5",
  "pdf-lib": "^1.17.1"
}
```

### System Dependencies

**pdf2pic** requires either:
- **GraphicsMagick** (recommended)
- **ImageMagick**

**Installation:**

```bash
# Ubuntu/Debian
sudo apt-get install graphicsmagick

# macOS
brew install graphicsmagick

# Windows
# Download and install from http://www.graphicsmagick.org/
```

## Future Enhancements

### Planned Features

1. **GPU Acceleration**
   - Use TensorFlow.js for GPU-accelerated OCR
   - Fallback to CPU-based Tesseract

2. **Language Auto-Detection**
   - Automatically detect document language
   - Load appropriate language models dynamically

3. **Layout Analysis**
   - Preserve document structure (headers, tables, columns)
   - Export to structured formats (JSON, Markdown)

4. **Batch Processing API**
   - Process multiple documents in parallel
   - Queue-based job management
   - Webhook notifications on completion

5. **Cloud OCR Integration**
   - Google Cloud Vision API fallback
   - AWS Textract for complex documents
   - Azure Computer Vision for forms

## References

- [Tesseract.js Documentation](https://tesseract.projectnaptha.com/)
- [pdf2pic Documentation](https://www.npmjs.com/package/pdf2pic)
- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [OCR Best Practices](https://github.com/tesseract-ocr/tesseract/wiki/ImproveQuality)

## Support

For issues or questions:
- Check integration tests for usage examples
- Review error logs in debug mode
- Consult team documentation in `/docs`
- Contact backend team for support

---

**Document Version:** 2.0
**Last Updated:** 2025-01-19
**Maintainer:** Backend Team
