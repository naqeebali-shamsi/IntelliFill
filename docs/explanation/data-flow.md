---
title: Data Flow
description: How data moves through the IntelliFill system
category: explanation
tags: [data, flow, processing, pipeline]
lastUpdated: 2025-11-25
---

# Data Flow

This document explains how data flows through the IntelliFill system, from document upload to filled PDF output.

---

## Overview

IntelliFill processes documents through a multi-stage pipeline:

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Upload  │────▶│   OCR    │────▶│ Extract  │────▶│   Map    │────▶│   Fill   │
│          │     │          │     │          │     │          │     │          │
│ Document │     │  Image   │     │  Parse   │     │ Match    │     │  PDF     │
│ received │     │ to text  │     │  data    │     │ fields   │     │  form    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │                │
     ▼                ▼                ▼                ▼                ▼
  Storage         Raw Text        Structured       Mappings        Filled PDF
  (file)          (string)        Data (JSON)      (JSON)          (buffer)
```

---

## Stage 1: Document Upload

### What Happens

1. User selects a file in the frontend
2. File is validated client-side (type, size)
3. FormData sent to backend via POST
4. Backend validates file again
5. File saved to storage
6. Document record created in database
7. Processing job queued

### Data Transformation

```
Input:  File (binary)
Output: Document record + stored file

Database Record:
{
  id: "uuid",
  userId: "user-uuid",
  filename: "invoice.pdf",
  mimeType: "application/pdf",
  status: "pending",
  storagePath: "/uploads/uuid.pdf"
}
```

### Frontend Code

```typescript
const uploadFile = async (file: File) => {
  const formData = new FormData();
  formData.append('document', file);
  
  const response = await api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progress) => {
      setProgress(Math.round((progress.loaded * 100) / progress.total));
    },
  });
  
  return response.data;
};
```

### Backend Code

```typescript
router.post('/upload', authMiddleware, upload.single('document'), async (req, res) => {
  const file = req.file;
  
  // Create database record
  const document = await prisma.document.create({
    data: {
      userId: req.user.id,
      filename: file.originalname,
      mimeType: file.mimetype,
      storagePath: file.path,
      status: 'pending',
    },
  });
  
  // Queue processing job
  await ocrQueue.add({ documentId: document.id });
  
  res.status(201).json({ success: true, document });
});
```

---

## Stage 2: OCR Processing

### What Happens

1. Job processor picks up queued job
2. Document file loaded from storage
3. If PDF, pages converted to images
4. Images preprocessed for better OCR
5. Tesseract.js extracts text
6. Confidence score calculated
7. Raw text saved to database

### Data Transformation

```
Input:  Image/PDF file
Output: Raw text + confidence score

OCR Result:
{
  text: "Invoice #12345\nDate: Nov 25, 2025\nTotal: $1,500.00...",
  confidence: 0.93,
  words: [
    { text: "Invoice", confidence: 0.98, bbox: {...} },
    { text: "#12345", confidence: 0.95, bbox: {...} },
    ...
  ]
}
```

### Preprocessing Steps

```typescript
async preprocessImage(imagePath: string): Promise<Buffer> {
  return sharp(imagePath)
    .grayscale()                    // Convert to grayscale
    .normalize()                    // Normalize contrast
    .sharpen()                      // Enhance edges
    .threshold(128)                 // Binarize
    .toBuffer();
}
```

### OCR Execution

```typescript
async extractText(imagePath: string): Promise<OCRResult> {
  const preprocessed = await this.preprocessImage(imagePath);
  
  const { data } = await Tesseract.recognize(preprocessed, 'eng', {
    logger: (m) => this.logProgress(m),
  });
  
  return {
    text: data.text,
    confidence: data.confidence / 100,
    words: data.words,
  };
}
```

---

## Stage 3: Data Extraction

### What Happens

1. Raw OCR text analyzed
2. Pattern matching finds structured data
3. Named entity recognition (optional)
4. Data normalized to standard formats
5. Confidence scores calculated per field
6. Structured data saved to database

### Data Transformation

```
Input:  Raw text string
Output: Structured JSON object

Extracted Data:
{
  invoiceNumber: { value: "12345", confidence: 0.95 },
  date: { value: "2025-11-25", confidence: 0.92 },
  amount: { value: 1500.00, confidence: 0.98 },
  vendor: { value: "Acme Corp", confidence: 0.88 },
  items: [
    { description: "Widget", quantity: 10, price: 150.00 }
  ]
}
```

### Extraction Patterns

```typescript
const patterns = {
  email: /[\w.-]+@[\w.-]+\.\w+/gi,
  phone: /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  date: /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g,
  amount: /\$[\d,]+\.?\d*/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
};

function extractPatterns(text: string): ExtractedData {
  const extracted: ExtractedData = {};
  
  for (const [type, pattern] of Object.entries(patterns)) {
    const matches = text.match(pattern);
    if (matches) {
      extracted[type] = matches.map(m => normalizeValue(type, m));
    }
  }
  
  return extracted;
}
```

---

## Stage 4: Field Mapping

### What Happens

1. PDF form analyzed for fillable fields
2. Field names and types extracted
3. Extracted data matched to fields
4. Multiple matching strategies applied
5. Best matches selected with confidence
6. Mapping saved for user review

### Data Transformation

```
Input:  Extracted data + PDF form fields
Output: Field-to-data mappings

Form Fields:
[
  { name: "applicant_name", type: "text" },
  { name: "email_address", type: "text" },
  { name: "date_of_birth", type: "date" },
]

Mappings:
{
  "applicant_name": { source: "name", confidence: 0.92 },
  "email_address": { source: "email", confidence: 0.98 },
  "date_of_birth": { source: "dob", confidence: 0.85 },
}
```

### Matching Strategies

```typescript
class FieldMapper {
  private strategies: MappingStrategy[] = [
    new ExactMatchStrategy(),       // Field name = data label
    new FuzzyMatchStrategy(),       // Similar names (Levenshtein)
    new SemanticMatchStrategy(),    // ML-based meaning match
    new PositionMatchStrategy(),    // Location-based
  ];
  
  async mapFields(data: ExtractedData, fields: FormField[]): Promise<Mappings> {
    const mappings: Mappings = {};
    
    for (const field of fields) {
      let bestMatch = null;
      let bestConfidence = 0;
      
      for (const strategy of this.strategies) {
        const match = await strategy.findMatch(field, data);
        if (match && match.confidence > bestConfidence) {
          bestMatch = match;
          bestConfidence = match.confidence;
        }
      }
      
      if (bestMatch) {
        mappings[field.name] = bestMatch;
      }
    }
    
    return mappings;
  }
}
```

---

## Stage 5: Form Filling

### What Happens

1. PDF form loaded from template or upload
2. Mappings applied to fill fields
3. Different field types handled appropriately
4. Filled PDF generated as buffer
5. Buffer sent to client or saved
6. Job marked complete

### Data Transformation

```
Input:  Empty PDF + mappings + data
Output: Filled PDF buffer

Filling Process:
1. Load PDF: PDFDocument.load(pdfBytes)
2. Get form: pdfDoc.getForm()
3. For each mapping:
   - Get field: form.getField(fieldName)
   - Set value based on type
4. Save: pdfDoc.save()
```

### Form Filling Code

```typescript
async fillForm(
  pdfBytes: Buffer,
  data: Record<string, any>,
  mappings: Mappings
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  
  for (const [fieldName, mapping] of Object.entries(mappings)) {
    const value = data[mapping.source];
    if (value === undefined) continue;
    
    const field = form.getField(fieldName);
    
    if (field instanceof PDFTextField) {
      field.setText(String(value));
    } else if (field instanceof PDFCheckBox) {
      value ? field.check() : field.uncheck();
    } else if (field instanceof PDFDropdown) {
      field.select(String(value));
    } else if (field instanceof PDFRadioGroup) {
      field.select(String(value));
    }
  }
  
  const filledBytes = await pdfDoc.save();
  return Buffer.from(filledBytes);
}
```

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 FRONTEND                                     │
│  ┌─────────────┐                                         ┌─────────────┐    │
│  │   Upload    │                                         │  Download   │    │
│  │  Component  │                                         │   Button    │    │
│  └──────┬──────┘                                         └──────▲──────┘    │
│         │                                                       │           │
│         ▼                                                       │           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Document Store (Zustand)                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                       ▲           │
└─────────┼───────────────────────────────────────────────────────┼───────────┘
          │ HTTP POST                                     HTTP GET │
          ▼                                                       │
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  BACKEND                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│  │   Upload    │───▶│   Queue     │───▶│  Process    │───▶│   Serve     │   │
│  │   Route     │    │    Job      │    │   Worker    │    │   Result    │   │
│  └─────────────┘    └─────────────┘    └──────┬──────┘    └─────────────┘   │
│                                               │                              │
│                     ┌─────────────────────────┼─────────────────────────┐   │
│                     │                         │                         │   │
│                     ▼                         ▼                         ▼   │
│              ┌─────────────┐          ┌─────────────┐          ┌───────────┐│
│              │ OCR Service │          │  Extractor  │          │Form Filler││
│              └──────┬──────┘          └──────┬──────┘          └─────┬─────┘│
│                     │                        │                       │      │
│                     ▼                        ▼                       ▼      │
│              ┌─────────────┐          ┌─────────────┐          ┌───────────┐│
│              │ Tesseract   │          │   Regex +   │          │  pdf-lib  ││
│              │             │          │     ML      │          │           ││
│              └─────────────┘          └─────────────┘          └───────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────┐
│   PostgreSQL    │
│   (Neon)        │
└─────────────────┘
```

---

## Data Storage Summary

| Stage | Storage | Data Type |
|-------|---------|-----------|
| Upload | File system | Binary file |
| Upload | PostgreSQL | Document record |
| OCR | PostgreSQL | Raw text |
| Extract | PostgreSQL | JSON (extracted) |
| Map | PostgreSQL | JSON (mappings) |
| Fill | Response/Storage | PDF buffer |

---

## Error Handling

Each stage has specific error handling:

| Stage | Error | Recovery |
|-------|-------|----------|
| Upload | Invalid file | Reject with message |
| Upload | File too large | Reject with message |
| OCR | Image unreadable | Mark failed, notify user |
| Extract | No patterns found | Return empty data |
| Map | No matches | Allow manual mapping |
| Fill | PDF corrupted | Return error |

---

## Performance Metrics

| Stage | Typical Time | Bottleneck |
|-------|-------------|------------|
| Upload | 1-5s | Network speed |
| OCR | 2-10s | Image complexity |
| Extract | <500ms | Text length |
| Map | <500ms | Field count |
| Fill | <2s | PDF size |

---

## Related Documentation

- [Understanding the Workflow](../tutorials/understanding-workflow.md)
- [System Overview](../reference/architecture/system-overview.md)
- [API Endpoints](../reference/api/endpoints.md)

