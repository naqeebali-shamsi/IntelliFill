# Document Reprocessing User Guide

## What is Document Reprocessing?

Document reprocessing allows you to re-run OCR (Optical Character Recognition) on documents that had low confidence scores or extraction errors. The system uses enhanced settings to improve text extraction accuracy.

## When to Reprocess a Document

You should consider reprocessing a document when:

1. **Low Confidence Score** (< 70%)
   - The OCR engine was uncertain about the extracted text
   - Indicates potential errors or missing information

2. **Missing or Incorrect Data**
   - Key information wasn't extracted
   - Extracted text contains obvious errors

3. **Poor Scan Quality**
   - Document was scanned at low resolution
   - Image had poor contrast or lighting

4. **Initial Processing Failed**
   - Document status shows as "Failed"
   - Error messages indicate OCR issues

## How to Reprocess Documents

### Method 1: Single Document Reprocessing

1. **Navigate to Document Library**
   - Go to "Documents" in the main navigation

2. **Open Document Details**
   - Click on a document to view details
   - Review the confidence score

3. **Click Reprocess Button**
   - Look for the "Reprocess OCR" button
   - Button appears for documents with confidence < 70%
   - Click to queue the document for reprocessing

4. **Monitor Progress**
   - Document status changes to "Reprocessing"
   - Processing time: 2-5 minutes (depending on document size)
   - You'll receive a notification when complete

### Method 2: Batch Reprocessing

1. **Filter Low Confidence Documents**
   - In Document Library, apply confidence filter
   - Options: < 50%, 50-70%, 70-90%

2. **Select Multiple Documents**
   - Check boxes next to documents you want to reprocess
   - Or use "Select All" for bulk operations

3. **Click Batch Reprocess**
   - Look for "Reprocess Selected" button in toolbar
   - Confirm the batch operation

4. **Track Progress**
   - Each document processes independently
   - View individual status in document list
   - Filter by "Reprocessing" status to see active jobs

## Understanding Reprocessing Results

### Confidence Score Improvements

After reprocessing, you'll see:

- **Old Confidence**: Original extraction confidence
- **New Confidence**: Updated confidence after reprocessing
- **Improvement**: Percentage point increase

Example:

```
Old Confidence: 45%
New Confidence: 78%
Improvement: +33 points
```

### Reprocessing History

Each document tracks its reprocessing history:

- Number of reprocessing attempts
- Timestamp of each attempt
- Confidence improvements
- Technical settings used (DPI, preprocessing)

**View History:**

1. Open document details
2. Click "History" tab
3. Review reprocessing timeline

## Enhanced OCR Settings

Reprocessing uses higher quality settings:

| Feature           | Standard OCR | Reprocessing |
| ----------------- | ------------ | ------------ |
| Resolution        | 300 DPI      | 600 DPI      |
| Image Enhancement | Basic        | Advanced     |
| Text Detection    | Standard     | Enhanced     |
| Processing Time   | 1-2 min      | 2-5 min      |

## Limitations and Best Practices

### Reprocessing Limits

- **Maximum Attempts**: 3 reprocessings per document
- **Status Restrictions**: Cannot reprocess while processing
- **Queue Priority**: Reprocessing jobs have higher priority

### When Reprocessing Won't Help

Reprocessing may not improve results if:

- Original document is severely damaged or degraded
- Text is handwritten (OCR works best on printed text)
- Document is in a language not supported by OCR
- Image quality is extremely poor (< 150 DPI original)

### Tips for Best Results

1. **Check Original Document Quality**
   - Ensure source PDF/image is clear and readable
   - Higher resolution originals yield better results

2. **Review After Reprocessing**
   - Verify extracted data is now accurate
   - Update profile if needed

3. **Don't Over-Reprocess**
   - If confidence doesn't improve after 2 attempts, consider:
     - Re-scanning the original document at higher quality
     - Manual data entry for critical information

4. **Use Batch Operations**
   - More efficient for processing multiple low-confidence documents
   - Saves time compared to individual reprocessing

## Confidence Score Guide

Understanding confidence scores:

| Score Range | Quality   | Action                  |
| ----------- | --------- | ----------------------- |
| 90-100%     | Excellent | No action needed        |
| 70-89%      | Good      | Review if critical data |
| 50-69%      | Fair      | Consider reprocessing   |
| < 50%       | Poor      | Reprocess recommended   |

## Troubleshooting

### Reprocessing Failed

**Possible causes:**

- Server is busy (try again later)
- Document file is corrupted
- Maximum attempts reached

**Solutions:**

1. Check document status
2. Contact support if persistent
3. Try re-uploading the document

### No Improvement After Reprocessing

**Possible causes:**

- Original scan quality too poor
- Handwritten text
- Unsupported language

**Solutions:**

1. Re-scan document at higher quality (600+ DPI)
2. Ensure document is in supported language
3. Consider manual data entry

### Reprocess Button Disabled

**Reasons:**

- Document confidence is already high (> 70%)
- Document is currently processing
- Maximum reprocessing attempts reached
- Document status is not eligible

## FAQ

**Q: How long does reprocessing take?**
A: Typically 2-5 minutes depending on document size and page count.

**Q: Will reprocessing always improve confidence?**
A: Not always. If the original document quality is very poor, reprocessing may not help significantly.

**Q: Can I reprocess the same document multiple times?**
A: Yes, up to 3 times. After that, the system prevents further reprocessing to avoid wasted resources.

**Q: Do I need to do anything after reprocessing completes?**
A: No, extracted data is automatically updated. You may want to review it to verify accuracy.

**Q: What happens to my profile after reprocessing?**
A: Your profile is automatically updated with the new extracted data if confidence improves.

**Q: Can I cancel a reprocessing job?**
A: Currently, reprocessing jobs cannot be cancelled once started. They typically complete within 5 minutes.

**Q: Does reprocessing cost extra?**
A: No, reprocessing is included in your plan. However, excessive reprocessing (> 3 attempts) is prevented to manage system resources.

## Getting Help

If you encounter issues with document reprocessing:

1. Check the document status and error messages
2. Review this guide for troubleshooting steps
3. Contact support with:
   - Document ID
   - Error message (if any)
   - Screenshots of the issue

**Support:** support@intellifill.com
