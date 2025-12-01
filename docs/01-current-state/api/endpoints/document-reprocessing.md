# Document Reprocessing API

## Overview

The Document Reprocessing API allows users to re-run OCR processing on documents that had low confidence scores or errors. Reprocessing uses enhanced OCR settings (600 DPI, advanced preprocessing) to improve extraction accuracy.

## Endpoints

### 1. Reprocess Single Document

Re-run OCR processing on a single document with higher quality settings.

**Endpoint:** `POST /api/documents/:id/reprocess`

**Authentication:** Required (Bearer token)

**Parameters:**
- `id` (path parameter): Document ID to reprocess

**Request Example:**
```bash
curl -X POST \
  http://localhost:3000/api/documents/doc-123/reprocess \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Document queued for reprocessing",
  "jobId": "job-456",
  "documentId": "doc-123",
  "statusUrl": "/api/documents/doc-123/status"
}
```

**Error Responses:**

- `400 Bad Request`: Maximum reprocessing attempts reached
```json
{
  "error": "Maximum reprocessing attempts (3) reached for this document"
}
```

- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Document not found or access denied

**Limitations:**
- Maximum 3 reprocessing attempts per document
- Cannot reprocess documents already being processed
- Only available for documents in COMPLETED or FAILED status

---

### 2. Batch Reprocess Documents

Re-run OCR processing on multiple documents at once.

**Endpoint:** `POST /api/documents/reprocess/batch`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "documentIds": ["doc-123", "doc-456", "doc-789"]
}
```

**Request Example:**
```bash
curl -X POST \
  http://localhost:3000/api/documents/reprocess/batch \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"documentIds": ["doc-123", "doc-456"]}'
```

**Response:**
```json
{
  "success": true,
  "message": "2 documents queued for reprocessing",
  "jobs": [
    {
      "jobId": "job-456",
      "documentId": "doc-123"
    },
    {
      "jobId": "job-457",
      "documentId": "doc-456"
    }
  ],
  "totalQueued": 2
}
```

**Error Responses:**

- `400 Bad Request`: Invalid request body
```json
{
  "error": "documentIds array is required"
}
```

- `401 Unauthorized`: Missing or invalid authentication token

**Notes:**
- Documents that have reached max reprocessing attempts are skipped
- Documents currently being processed are skipped
- Only eligible documents are queued

---

### 3. Get Low Confidence Documents

Retrieve documents with confidence scores below a specified threshold.

**Endpoint:** `GET /api/documents/low-confidence`

**Authentication:** Required (Bearer token)

**Query Parameters:**
- `threshold` (optional): Confidence threshold (0-1). Default: 0.7

**Request Example:**
```bash
curl -X GET \
  "http://localhost:3000/api/documents/low-confidence?threshold=0.7" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "documents": [
    {
      "id": "doc-123",
      "fileName": "scanned-document.pdf",
      "confidence": 0.45,
      "reprocessCount": 1,
      "processedAt": "2025-01-20T10:30:00Z",
      "createdAt": "2025-01-20T10:00:00Z"
    },
    {
      "id": "doc-456",
      "fileName": "low-quality-scan.pdf",
      "confidence": 0.62,
      "reprocessCount": 0,
      "processedAt": "2025-01-20T11:15:00Z",
      "createdAt": "2025-01-20T11:00:00Z"
    }
  ],
  "count": 2
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid authentication token

**Use Cases:**
- Identify documents that may benefit from reprocessing
- Filter documents by confidence thresholds (< 50%, 50-70%, 70-90%)
- Bulk select low-confidence documents for reprocessing

---

### 4. Get Reprocessing History

Retrieve reprocessing history and metadata for a document.

**Endpoint:** `GET /api/documents/:id/reprocessing-history`

**Authentication:** Required (Bearer token)

**Parameters:**
- `id` (path parameter): Document ID

**Request Example:**
```bash
curl -X GET \
  http://localhost:3000/api/documents/doc-123/reprocessing-history \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "reprocessCount": 2,
  "lastReprocessedAt": "2025-01-20T12:00:00Z",
  "reprocessingHistory": [
    {
      "attemptNumber": 1,
      "timestamp": "2025-01-20T10:45:00Z",
      "triggeredBy": "user",
      "oldConfidence": 45,
      "newConfidence": 68,
      "improvement": 23,
      "dpi": 600,
      "enhancedPreprocessing": true
    },
    {
      "attemptNumber": 2,
      "timestamp": "2025-01-20T12:00:00Z",
      "triggeredBy": "user",
      "oldConfidence": 68,
      "newConfidence": 87,
      "improvement": 19,
      "dpi": 600,
      "enhancedPreprocessing": true
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Document not found or access denied

---

## Enhanced OCR Settings

When reprocessing, the following enhanced settings are used:

| Setting | Normal OCR | Reprocessing |
|---------|-----------|--------------|
| DPI | 300 | 600 |
| Adaptive Thresholding | No | Yes |
| Deskewing | No | Yes |
| Noise Reduction | No | Yes |
| PSM Mode | AUTO_OSD | Fully Automatic (PSM 3) |
| Timeout | 5 minutes | 10 minutes |
| Priority | Normal | High |

## Best Practices

1. **When to Reprocess:**
   - Confidence score < 70%
   - OCR errors or missing text
   - Poor scan quality

2. **Monitoring:**
   - Use `/api/documents/:id/status` to track reprocessing progress
   - Check reprocessing history to see improvement trends
   - Monitor confidence improvements

3. **Limitations:**
   - Max 3 reprocessing attempts per document
   - Cannot reprocess while document is being processed
   - Higher quality OCR takes longer (expect 2-3x processing time)

4. **Performance:**
   - Batch reprocessing is more efficient for multiple documents
   - Use low-confidence endpoint to identify candidates
   - Reprocessing jobs have higher priority in queue

## Workflow Example

```javascript
// 1. Get low confidence documents
const lowConfDocs = await fetch('/api/documents/low-confidence?threshold=0.7', {
  headers: { 'Authorization': 'Bearer TOKEN' }
});

// 2. Batch reprocess them
const docIds = lowConfDocs.documents.map(d => d.id);
const reprocessJob = await fetch('/api/documents/reprocess/batch', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ documentIds: docIds })
});

// 3. Monitor progress
for (const job of reprocessJob.jobs) {
  const status = await fetch('/api/documents/' + job.documentId + '/status', {
    headers: { 'Authorization': 'Bearer TOKEN' }
  });
  console.log('Status:', status.document.status);
}

// 4. Check improvements
for (const docId of docIds) {
  const history = await fetch('/api/documents/' + docId + '/reprocessing-history', {
    headers: { 'Authorization': 'Bearer TOKEN' }
  });
  console.log('Improvement:', history.reprocessingHistory);
}
```

## Error Handling

All endpoints return standard error responses:

```json
{
  "error": "Error message description",
  "details": "Optional additional details"
}
```

Common HTTP status codes:
- `200 OK`: Request successful
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

## Rate Limiting

- Single reprocessing: No specific limit
- Batch reprocessing: Maximum 50 documents per request
- API calls: Standard rate limiting applies (100 requests/minute)
