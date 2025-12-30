# Protected Routes Reference - QuikAdmin API

## Overview

This document provides a comprehensive reference for all protected routes in the QuikAdmin API. As of Phase 4 of the Supabase Auth migration, all protected routes support **dual authentication**, accepting both Supabase JWT tokens and legacy custom JWT tokens.

## Table of Contents

- [Authentication Overview](#authentication-overview)
- [Document Processing Routes](#document-processing-routes)
- [Document Management Routes](#document-management-routes)
- [Statistics and Template Routes](#statistics-and-template-routes)
- [Job Management Routes](#job-management-routes)
- [Authentication Requirements](#authentication-requirements)
- [Error Responses](#error-responses)
- [Migration Guide](#migration-guide)

## Authentication Overview

### Dual Authentication Support

All protected routes use the `dualAuthenticate` middleware, which supports:

1. **Supabase JWT Tokens** (new, recommended)
   - Issued by Supabase Auth
   - Long-lived tokens (7 days)
   - Integrated with Supabase user management

2. **Legacy Custom JWT Tokens** (existing users)
   - Issued by QuikAdmin's legacy auth system
   - Short-lived tokens (15 minutes)
   - Backwards compatible

### Authorization Header Format

```http
Authorization: Bearer <token>
```

Both token types use the same `Bearer` token format, making the transition seamless for API consumers.

### Token Characteristics

| Feature          | Supabase JWT               | Legacy JWT                     |
| ---------------- | -------------------------- | ------------------------------ |
| **Issuer**       | Supabase                   | QuikAdmin API                  |
| **Expiry**       | 7 days                     | 15 minutes                     |
| **Algorithm**    | HS256                      | HS256                          |
| **Refresh**      | Automatic via Supabase SDK | Manual via `/api/auth/refresh` |
| **User Context** | `req.user`                 | `req.user`                     |

## Document Processing Routes

### POST /api/process/single

Process a single document and fill a single form.

**Authentication:** Required (Dual)

**Request:**

```http
POST /api/process/single
Authorization: Bearer <token>
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="document"; filename="invoice.pdf"
Content-Type: application/pdf

<document content>
--boundary
Content-Disposition: form-data; name="form"; filename="template.pdf"
Content-Type: application/pdf

<form content>
--boundary--
```

**Response:**

```json
{
  "success": true,
  "message": "PDF form filled successfully",
  "data": {
    "documentId": "doc_abc123",
    "outputPath": "outputs/filled_123_1234567890.pdf",
    "filledFields": 15,
    "confidence": 98.5,
    "processingTime": 2400,
    "warnings": []
  }
}
```

**Status Codes:**

- `200` - Success
- `400` - Missing files or processing failed
- `401` - Authentication required or invalid token
- `500` - Server error

---

### POST /api/process/multiple

Process multiple documents with a single form.

**Authentication:** Required (Dual)

**Request:**

```http
POST /api/process/multiple
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Fields:**

- `documents` - Array of document files (max 10)
- `form` - Single form file

**Response:**

```json
{
  "success": true,
  "message": "PDF forms filled successfully",
  "data": {
    "outputPath": "outputs/filled_1234567890.pdf",
    "filledFields": 15,
    "confidence": 96.8,
    "processingTime": 5200,
    "warnings": [],
    "documentCount": 3
  }
}
```

---

### POST /api/process/batch

Batch process with different forms for each document.

**Authentication:** Required (Dual)

**Request:**

```http
POST /api/process/batch
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Fields:**

- `documents` - Array of document files (max 20)
- `forms` - Array of form files (max 20)

**Note:** Number of documents must match number of forms.

**Response:**

```json
{
  "success": true,
  "message": "Batch processing completed",
  "data": {
    "totalJobs": 5,
    "successfulJobs": 4,
    "failedJobs": 1,
    "results": [
      {
        "success": true,
        "outputPath": "outputs/batch_1234567890_0.pdf"
      }
    ]
  }
}
```

---

### POST /api/validate

Validate document data extraction.

**Authentication:** Required (Dual)

**Request:**

```http
POST /api/validate
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Fields:**

- `document` - Document file to validate

**Response:**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "fields": ["field1", "field2"],
    "confidence": 95.2,
    "issues": []
  }
}
```

## Document Management Routes

### GET /api/documents

List all documents for the authenticated user.

**Authentication:** Required (Dual)

**Query Parameters:**

- `type` - Filter by file type (optional)
- `search` - Search by filename (optional)
- `limit` - Maximum results (default: 50)

**Request:**

```http
GET /api/documents?limit=10&search=invoice
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "documents": [
    {
      "id": "doc_abc123",
      "fileName": "invoice_march.pdf",
      "fileType": "application/pdf",
      "fileSize": 245760,
      "status": "COMPLETED",
      "confidence": 98.5,
      "createdAt": "2024-03-15T10:30:00Z",
      "processedAt": "2024-03-15T10:31:30Z"
    }
  ]
}
```

---

### GET /api/documents/:id

Get details for a specific document.

**Authentication:** Required (Dual)

**Authorization:** Users can only access their own documents.

**Request:**

```http
GET /api/documents/doc_abc123
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "document": {
    "id": "doc_abc123",
    "fileName": "invoice_march.pdf",
    "fileType": "application/pdf",
    "fileSize": 245760,
    "storageUrl": "uploads/encrypted_file.enc",
    "status": "COMPLETED",
    "confidence": 98.5,
    "extractedData": {
      "invoice_number": "INV-2024-001",
      "date": "2024-03-15",
      "amount": 1250.0
    },
    "createdAt": "2024-03-15T10:30:00Z",
    "processedAt": "2024-03-15T10:31:30Z"
  }
}
```

**Status Codes:**

- `200` - Success
- `401` - Authentication required
- `404` - Document not found or not owned by user

---

### GET /api/documents/:id/data

Get extracted data only (optimized for form filling).

**Authentication:** Required (Dual)

**Request:**

```http
GET /api/documents/doc_abc123/data
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "fileName": "invoice_march.pdf",
  "data": {
    "invoice_number": "INV-2024-001",
    "date": "2024-03-15",
    "amount": 1250.0,
    "vendor": "Acme Corp"
  }
}
```

**Status Codes:**

- `200` - Success
- `400` - Document processing not completed
- `401` - Authentication required
- `404` - Document not found

---

### POST /api/documents/:id/fill

Fill a new form using stored document data.

**Authentication:** Required (Dual)

**Request:**

```http
POST /api/documents/doc_abc123/fill
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Fields:**

- `form` - PDF form file to fill

**Response:**

```json
{
  "success": true,
  "documentId": "doc_xyz789",
  "confidence": 96.8,
  "filledFields": 12,
  "downloadUrl": "/api/documents/doc_xyz789/download",
  "warnings": []
}
```

---

### GET /api/documents/:id/download

Download a filled PDF document.

**Authentication:** Required (Dual)

**Request:**

```http
GET /api/documents/doc_abc123/download
Authorization: Bearer <token>
```

**Response:**

- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="document.pdf"`
- Body: Decrypted PDF file

---

### DELETE /api/documents/:id

Delete a document and its associated file.

**Authentication:** Required (Dual)

**Request:**

```http
DELETE /api/documents/doc_abc123
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Document deleted"
}
```

**Status Codes:**

- `200` - Success
- `401` - Authentication required
- `404` - Document not found

## Statistics and Template Routes

### POST /api/templates

Create a new template for document processing.

**Authentication:** Required (Dual)

**Request:**

```http
POST /api/templates
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Invoice Template",
  "description": "Standard invoice processing",
  "fields": [
    {
      "name": "invoice_number",
      "type": "text",
      "required": true
    },
    {
      "name": "amount",
      "type": "number",
      "required": true
    }
  ],
  "config": {
    "threshold": 0.85
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Template created successfully",
  "data": {
    "template": {
      "id": "tpl_abc123",
      "name": "Invoice Template",
      "fields": [...],
      "usage": 0,
      "createdAt": "2024-03-15T10:30:00Z"
    }
  }
}
```

---

### POST /api/extract

Extract data from an uploaded document.

**Authentication:** Required (Dual)

**Request:**

```http
POST /api/extract
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Fields:**

- `document` - Document file to extract data from

**Response:**

```json
{
  "data": {
    "invoice_number": "INV-2024-001",
    "date": "2024-03-15",
    "amount": 1250.0,
    "vendor": "Acme Corp"
  }
}
```

---

### POST /api/validate/form

Validate a form structure and extract field definitions.

**Authentication:** Required (Dual)

**Request:**

```http
POST /api/validate/form
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Fields:**

- `form` - PDF form file to validate

**Response:**

```json
{
  "data": {
    "fields": ["invoice_number", "date", "amount", "vendor"],
    "fieldTypes": {
      "invoice_number": "text",
      "date": "date",
      "amount": "number",
      "vendor": "text"
    }
  }
}
```

## Job Management Routes

### GET /jobs/recent

Get recent jobs for the authenticated user.

**Authentication:** Required (Dual) - **Security Fix Applied**

**Note:** This route was previously unprotected. As of Phase 4, authentication is now required.

**Request:**

```http
GET /jobs/recent
Authorization: Bearer <token>
```

**Response:**

```json
[
  {
    "id": "job_abc123",
    "type": "document_processing",
    "status": "completed",
    "progress": 100,
    "createdAt": "2024-03-15T10:30:00Z",
    "completedAt": "2024-03-15T10:31:30Z"
  }
]
```

---

### POST /jobs/:id/cancel

Cancel a running or queued job.

**Authentication:** Required (Dual) - **Security Fix Applied**

**Note:** This route was previously unprotected. As of Phase 4, authentication is now required.

**Request:**

```http
POST /jobs/job_abc123/cancel
Authorization: Bearer <token>
```

**Response:**

```json
{
  "message": "Job cancelled successfully",
  "jobId": "job_abc123"
}
```

---

### POST /jobs/:id/retry

Retry a failed job.

**Authentication:** Required (Dual) - **Security Fix Applied**

**Note:** This route was previously unprotected. As of Phase 4, authentication is now required.

**Request:**

```http
POST /jobs/job_abc123/retry
Authorization: Bearer <token>
```

**Response:**

```json
{
  "message": "Job requeued successfully",
  "jobId": "job_abc123",
  "status": "queued"
}
```

## Authentication Requirements

### Required Protected Routes (16 total)

All routes below require valid authentication:

**Document Processing (4 routes):**

- POST /api/process/single
- POST /api/process/multiple
- POST /api/process/batch
- POST /api/validate

**Document Management (6 routes):**

- GET /api/documents
- GET /api/documents/:id
- GET /api/documents/:id/data
- POST /api/documents/:id/fill
- GET /api/documents/:id/download
- DELETE /api/documents/:id

**Stats and Templates (3 routes):**

- POST /api/templates
- POST /api/extract
- POST /api/validate/form

**Job Management (3 routes):**

- GET /jobs/recent
- POST /jobs/:id/cancel
- POST /jobs/:id/retry

### Optional Authentication Routes

These routes work with or without authentication:

- POST /api/form/fields
- GET /api/statistics
- GET /api/jobs
- GET /api/jobs/:jobId
- GET /api/jobs/:jobId/status
- GET /api/documents (stats route, not document management)
- GET /api/templates
- GET /api/queue/metrics

## Error Responses

### 401 Unauthorized

Returned when authentication is required but not provided or invalid.

```json
{
  "error": "Unauthorized",
  "message": "Authentication failed. Please login again."
}
```

**Common Causes:**

- Missing Authorization header
- Invalid token format
- Expired token
- Invalid token signature
- Malformed JWT

### 403 Forbidden

Returned when user is authenticated but lacks required permissions.

```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

### 404 Not Found

Returned when resource doesn't exist or user doesn't have access.

```json
{
  "error": "Document not found"
}
```

## Migration Guide

### For API Consumers

#### No Changes Required

If you're already using the QuikAdmin API with JWT tokens, **no changes are required**. Your existing tokens will continue to work during the migration period.

#### Upgrading to Supabase Auth (Recommended)

1. **Sign up via Supabase Auth:**

   ```http
   POST /api/auth/v2/signup
   Content-Type: application/json

   {
     "email": "user@example.com",
     "password": "secure-password",
     "fullName": "John Doe"
   }
   ```

2. **Login via Supabase Auth:**

   ```http
   POST /api/auth/v2/login
   Content-Type: application/json

   {
     "email": "user@example.com",
     "password": "secure-password"
   }
   ```

3. **Use the returned access token:**
   ```http
   GET /api/documents
   Authorization: Bearer <supabase_access_token>
   ```

#### Token Refresh

**Legacy JWT:**

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "<refresh_token>"
}
```

**Supabase:**
Handled automatically by Supabase SDK (no manual refresh required).

### For Frontend Developers

The frontend API client (`web/src/services/api.ts`) already supports dual authentication. No changes required.

**Token Management:**

```typescript
import { useAuthStore } from '@/stores/simpleAuthStore';

// Get token (works for both types)
const { tokens } = useAuthStore.getState();

// Make authenticated request
const response = await api.get('/documents', {
  headers: {
    Authorization: `Bearer ${tokens.accessToken}`,
  },
});
```

### Testing Both Token Types

```bash
# Test with legacy JWT
curl -H "Authorization: Bearer <legacy_jwt>" \
  http://localhost:3002/api/documents

# Test with Supabase JWT
curl -H "Authorization: Bearer <supabase_jwt>" \
  http://localhost:3002/api/documents
```

## Best Practices

### Security

1. **Always use HTTPS** in production
2. **Never log tokens** in production environments
3. **Set appropriate token expiry** (15min for legacy, 7 days for Supabase)
4. **Implement token refresh** before expiry
5. **Validate tokens server-side** (never trust client validation)

### Performance

1. **Cache tokens** on the client (using Zustand or similar)
2. **Implement automatic refresh** to avoid 401 errors
3. **Use connection pooling** for database queries
4. **Enable compression** for large file transfers

### Error Handling

```typescript
try {
  const response = await api.get('/documents');
} catch (error) {
  if (error.response?.status === 401) {
    // Token expired or invalid - try refresh
    await authStore.refreshToken();
    // Retry request
  } else if (error.response?.status === 403) {
    // Insufficient permissions
    console.error('Access denied');
  } else {
    // Other error
    console.error('Request failed:', error);
  }
}
```

## Support

For issues or questions:

- **GitHub Issues:** [quikadmin/issues](https://github.com/yourusername/quikadmin/issues)
- **Documentation:** `/docs/SUPABASE_AUTH_MIGRATION_PLAN.md`
- **API Reference:** `/docs/300-api/304-auth-routes-reference.md`

---

**Last Updated:** 2025-01-25 (Phase 4 Migration Complete)
**API Version:** 1.0.0
**Auth Version:** Dual (Supabase + Legacy JWT)
