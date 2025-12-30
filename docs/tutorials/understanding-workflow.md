---
title: Understanding the Workflow
description: Learn how IntelliFill processes documents from upload to form filling
category: tutorials
tags: [workflow, processing, architecture]
lastUpdated: 2025-11-25
---

# Understanding the Workflow

This tutorial explains how IntelliFill processes documents, from initial upload through OCR extraction to PDF form filling. Understanding this workflow helps you use the system effectively and troubleshoot issues.

**Time Required**: 20 minutes

---

## The Processing Pipeline

IntelliFill uses a multi-stage pipeline:

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Upload  │────▶│   OCR    │────▶│ Extract  │────▶│   Map    │────▶│   Fill   │
│          │     │  Scan    │     │   Data   │     │  Fields  │     │   Form   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
```

Let's explore each stage.

---

## Stage 1: Document Upload

### What Happens

1. User uploads a file (PDF, PNG, JPG)
2. File is validated (size, type)
3. File is stored on server
4. Document record created in database
5. Processing job queued

### Key Components

- **Frontend**: `FileUploadZone` component
- **Backend**: `POST /api/documents/upload`
- **Storage**: Local filesystem or cloud storage
- **Database**: `Document` table

### Example Flow

```typescript
// Frontend uploads file
const formData = new FormData();
formData.append('document', file);
await api.post('/documents/upload', formData);

// Backend receives and stores
app.post('/documents/upload', async (req, res) => {
  const file = req.file;
  const document = await documentService.create(file);
  await ocrQueue.add({ documentId: document.id });
  res.json({ document });
});
```

---

## Stage 2: OCR Scanning

### What Happens

1. Document retrieved from storage
2. If PDF, pages converted to images
3. Image preprocessing applied
4. Tesseract.js performs OCR
5. Raw text extracted

### Preprocessing Steps

1. **Grayscale conversion** - Remove color complexity
2. **Normalization** - Adjust brightness/contrast
3. **Sharpening** - Enhance text edges
4. **Thresholding** - Convert to black/white

### Key Components

- **Service**: `OCRService`
- **Engine**: Tesseract.js
- **Queue**: Bull job queue

### Example Code

```typescript
// OCR Service
class OCRService {
  async extractText(imagePath: string): Promise<OCRResult> {
    // Preprocess image
    const processed = await this.preprocess(imagePath);

    // Run OCR
    const result = await Tesseract.recognize(processed, 'eng', {
      logger: (m) => console.log(m.progress),
    });

    return {
      text: result.data.text,
      confidence: result.data.confidence,
      words: result.data.words,
    };
  }
}
```

---

## Stage 3: Data Extraction

### What Happens

1. Raw text analyzed
2. Pattern matching applied
3. ML models identify entities
4. Structured data created
5. Confidence scores calculated

### Extracted Data Types

| Type   | Pattern                               | Example          |
| ------ | ------------------------------------- | ---------------- |
| Email  | `[\w.-]+@[\w.-]+\.\w+`                | user@example.com |
| Phone  | `\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}` | (555) 123-4567   |
| Date   | Various date patterns                 | Nov 25, 2025     |
| SSN    | `\d{3}-\d{2}-\d{4}`                   | 123-45-6789      |
| Amount | `\$[\d,]+\.?\d*`                      | $1,234.56        |

### Key Components

- **Service**: `DataExtractor`
- **Patterns**: Regex + ML models
- **Output**: Structured JSON

### Example Output

```json
{
  "rawText": "Invoice #12345\nJohn Smith\njohn@example.com\nTotal: $1,500.00",
  "extracted": {
    "invoiceNumber": "12345",
    "name": "John Smith",
    "email": "john@example.com",
    "amount": "$1,500.00"
  },
  "metadata": {
    "confidence": 0.92,
    "processingTime": 1234,
    "language": "en"
  }
}
```

---

## Stage 4: Field Mapping

### What Happens

1. PDF form analyzed for fields
2. Field types identified (text, checkbox, etc.)
3. Extracted data matched to fields
4. ML model improves matching
5. Mapping validated

### Mapping Strategies

1. **Exact match** - Field name matches data label
2. **Fuzzy match** - Similar names matched
3. **Semantic match** - ML understands meaning
4. **Position match** - Location-based matching

### Key Components

- **Service**: `FieldMapper`
- **ML Model**: TensorFlow.js
- **PDF Parser**: pdf-lib

### Example Mapping

```typescript
// Extracted data
const data = {
  'Full Name': 'John Smith',
  'Email Address': 'john@example.com',
};

// PDF form fields
const fields = [
  { name: 'applicant_name', type: 'text' },
  { name: 'email', type: 'text' },
];

// Mapping result
const mapping = {
  applicant_name: 'Full Name', // Fuzzy matched
  email: 'Email Address', // Exact matched
};
```

---

## Stage 5: Form Filling

### What Happens

1. PDF form loaded
2. Mapped data applied to fields
3. Different field types handled
4. Completed PDF generated
5. Result returned to user

### Supported Field Types

| Type     | Description       | Example         |
| -------- | ----------------- | --------------- |
| Text     | Text input fields | Name, address   |
| Checkbox | True/false fields | Agree to terms  |
| Radio    | Single selection  | Gender options  |
| Dropdown | Select list       | State selection |
| Date     | Date picker       | Birth date      |

### Key Components

- **Service**: `FormFiller`
- **Library**: pdf-lib
- **Output**: Filled PDF buffer

### Example Code

```typescript
// Form Filler
class FormFiller {
  async fill(pdfBytes: Buffer, data: Record<string, any>): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    for (const [fieldName, value] of Object.entries(data)) {
      const field = form.getField(fieldName);

      if (field instanceof PDFTextField) {
        field.setText(String(value));
      } else if (field instanceof PDFCheckBox) {
        value ? field.check() : field.uncheck();
      }
    }

    return Buffer.from(await pdfDoc.save());
  }
}
```

---

## Complete Flow Diagram

```
User                    Frontend                  Backend                    Services
  │                        │                         │                          │
  │── Upload file ────────▶│                         │                          │
  │                        │── POST /upload ────────▶│                          │
  │                        │                         │── Store file ───────────▶│
  │                        │                         │── Create record ─────────▶│
  │                        │                         │── Queue OCR job ─────────▶│
  │                        │◀── Return document ID ──│                          │
  │                        │                         │                          │
  │                        │                         │◀── Process OCR ──────────│
  │                        │                         │◀── Extract data ─────────│
  │                        │                         │◀── Update record ────────│
  │                        │                         │                          │
  │── Request status ─────▶│── GET /status ─────────▶│                          │
  │◀── Return results ─────│◀── Document data ──────│                          │
  │                        │                         │                          │
  │── Request fill ───────▶│── POST /fill ──────────▶│── Map fields ───────────▶│
  │                        │                         │◀── Fill PDF ─────────────│
  │◀── Download PDF ───────│◀── PDF buffer ─────────│                          │
```

---

## Performance Characteristics

| Stage      | Typical Time | Factors                |
| ---------- | ------------ | ---------------------- |
| Upload     | 1-5s         | File size, network     |
| OCR        | 1-10s        | Image size, complexity |
| Extraction | <1s          | Text length            |
| Mapping    | <1s          | Field count            |
| Filling    | <2s          | PDF complexity         |

---

## Error Handling

Each stage has specific error handling:

| Stage   | Common Errors      | Recovery              |
| ------- | ------------------ | --------------------- |
| Upload  | File too large     | Reject with message   |
| OCR     | Image unreadable   | Return low confidence |
| Extract | No patterns found  | Return empty data     |
| Map     | No matching fields | Manual mapping        |
| Fill    | Invalid PDF        | Return error          |

---

## Next Steps

- [API Reference](../reference/api/endpoints.md) - Detailed API documentation
- [Architecture Overview](../reference/architecture/system-overview.md) - System design
- [Data Flow](../explanation/data-flow.md) - Deeper understanding

---

## Related Documentation

- [Getting Started](./getting-started.md)
- [Your First Document](./first-document.md)
- [OCR Implementation](../how-to/development/ocr-implementation.md)
