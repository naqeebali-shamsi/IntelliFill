---
title: Your First Document
description: Upload and process your first document with IntelliFill
category: tutorials
tags: [documents, ocr, processing]
lastUpdated: 2025-11-25
---

# Your First Document

This tutorial shows you how to upload a document and watch IntelliFill extract data using OCR. By the end, you'll understand the basic document processing workflow.

**Time Required**: 15 minutes

**Prerequisites**: Complete [Getting Started](./getting-started.md) first.

---

## What You'll Do

1. Log in to IntelliFill
2. Upload a sample document
3. Watch OCR extraction
4. View extracted data
5. (Optional) Fill a PDF form

---

## Step 1: Log In

1. Open http://localhost:8080
2. Click "Use demo credentials" or enter:
   - Email: `admin@intellifill.com`
   - Password: `Admin123!`
3. Click "Sign In"

You should see the dashboard.

---

## Step 2: Navigate to Upload

1. Click "Upload" in the sidebar (or top navigation)
2. You'll see the document upload area

---

## Step 3: Upload a Document

### Using the UI

1. Drag and drop a document onto the upload area, OR
2. Click "Browse files" and select a document

**Supported formats**: PDF, PNG, JPG, JPEG

### Using a Sample Document

If you don't have a document ready, create a simple test:

1. Create a text file with sample information:
   ```
   Name: John Smith
   Email: john.smith@example.com
   Phone: (555) 123-4567
   Date: November 25, 2025
   Amount: $1,234.56
   ```
2. Save as PDF or take a screenshot
3. Upload the file

---

## Step 4: Watch Processing

After upload, you'll see:

1. **Upload Progress** - File uploading indicator
2. **Processing Status** - "Processing", "Extracting text", etc.
3. **Completion** - Green checkmark when done

The processing pipeline:

```
Upload → OCR Scan → Text Extraction → Data Parsing → Complete
```

---

## Step 5: View Extracted Data

Once processing completes:

1. Click on the document card to view details
2. You'll see extracted data including:
   - **Raw text** from OCR
   - **Structured data** (emails, phones, dates, etc.)
   - **Confidence scores** for each extraction

### Example Extracted Data

```json
{
  "rawText": "Name: John Smith\nEmail: john.smith@example.com...",
  "structured": {
    "names": ["John Smith"],
    "emails": ["john.smith@example.com"],
    "phones": ["(555) 123-4567"],
    "dates": ["November 25, 2025"],
    "amounts": ["$1,234.56"]
  },
  "confidence": 0.93
}
```

---

## Step 6: (Optional) Fill a PDF Form

If you have a fillable PDF form:

1. Go to the "Fill Form" section
2. Select your uploaded document as the data source
3. Upload or select a PDF form template
4. Click "Fill Form"
5. Download the completed PDF

---

## Understanding the Results

### Confidence Scores

- **90-100%**: High confidence, likely accurate
- **70-89%**: Medium confidence, may need review
- **Below 70%**: Low confidence, manual review recommended

### Extracted Data Types

IntelliFill automatically detects:

| Type      | Examples                        |
| --------- | ------------------------------- |
| Names     | John Smith, Jane Doe            |
| Emails    | user@example.com                |
| Phones    | (555) 123-4567, +1-555-123-4567 |
| Dates     | Nov 25, 2025, 11/25/2025        |
| Amounts   | $1,234.56, USD 1000             |
| SSN       | 123-45-6789                     |
| Addresses | 123 Main St, City, ST 12345     |

---

## What Happened Behind the Scenes

1. **Upload**: Document saved to server storage
2. **OCR**: Tesseract.js scanned the image/PDF
3. **Preprocessing**: Image enhanced for better accuracy
4. **Text Extraction**: Raw text extracted from OCR
5. **Data Parsing**: Regex and ML patterns identified structured data
6. **Storage**: Results saved to database
7. **Display**: Data returned to frontend

---

## Next Steps

- [Understanding the Workflow](./understanding-workflow.md) - Deep dive into processing
- [API Reference](../reference/api/endpoints.md) - Use the API directly
- [Templates](../how-to/development/templates.md) - Create form templates

---

## Troubleshooting

### Upload fails

- Check file size (max 10MB)
- Verify file format (PDF, PNG, JPG)
- Check backend logs: `logs/backend.log`

### Poor OCR accuracy

- Ensure image is clear and high-resolution
- Check for skewed or rotated text
- Try preprocessing the image

### No data extracted

- Verify the document contains readable text
- Check if the document format is supported
- View raw OCR text in document details

---

## Related Documentation

- [Understanding the Workflow](./understanding-workflow.md)
- [Document Processing API](../reference/api/endpoints.md#documents)
- [OCR Implementation](../how-to/development/ocr-implementation.md)
