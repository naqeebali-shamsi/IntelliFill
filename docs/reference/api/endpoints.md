---
title: API Endpoints Reference
description: Complete reference for all IntelliFill API endpoints
category: reference
tags: [api, endpoints, rest]
lastUpdated: 2025-11-25
---

# API Endpoints Reference

Complete reference for all IntelliFill REST API endpoints.

**Base URL**: `http://localhost:3002/api`

---

## Authentication

All protected endpoints require a valid JWT token in the Authorization header or as a cookie.

```http
Authorization: Bearer <token>
```

---

## Health Check

### GET /health

Check API health status.

**Authentication**: None

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-11-25T10:00:00.000Z",
  "version": "1.0.0",
  "environment": "development"
}
```

---

## Authentication Endpoints

### POST /api/auth/v2/register

Register a new user.

**Authentication**: None

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response** (201):
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "message": "Registration successful"
}
```

**Errors**:
- `400`: Invalid input
- `409`: Email already exists

---

### POST /api/auth/v2/login

Authenticate a user.

**Authentication**: None

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response** (200):
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "jwt-token",
  "expiresIn": 604800
}
```

**Errors**:
- `400`: Invalid input
- `401`: Invalid credentials

---

### POST /api/auth/v2/logout

Log out the current user.

**Authentication**: Required

**Response** (200):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### POST /api/auth/v2/refresh

Refresh the authentication token.

**Authentication**: Required (refresh token)

**Response** (200):
```json
{
  "success": true,
  "token": "new-jwt-token",
  "expiresIn": 604800
}
```

---

### POST /api/auth/v2/change-password

Change the user's password.

**Authentication**: Required

**Request Body**:
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### POST /api/auth/v2/forgot-password

Request a password reset email.

**Authentication**: None

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

---

### POST /api/auth/v2/reset-password

Reset password with token.

**Authentication**: None

**Request Body**:
```json
{
  "token": "reset-token",
  "newPassword": "newpassword123"
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

## Document Endpoints

### GET /api/documents

List all documents for the current user.

**Authentication**: Required

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20) |
| status | string | Filter by status |
| search | string | Search in filename |

**Response** (200):
```json
{
  "success": true,
  "documents": [
    {
      "id": "uuid",
      "filename": "invoice.pdf",
      "mimeType": "application/pdf",
      "status": "completed",
      "confidence": 0.93,
      "createdAt": "2025-11-25T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

---

### GET /api/documents/:id

Get a specific document.

**Authentication**: Required

**Response** (200):
```json
{
  "success": true,
  "document": {
    "id": "uuid",
    "filename": "invoice.pdf",
    "mimeType": "application/pdf",
    "status": "completed",
    "ocrText": "Invoice #12345...",
    "extracted": {
      "invoiceNumber": "12345",
      "amount": "$1,500.00"
    },
    "confidence": 0.93,
    "createdAt": "2025-11-25T10:00:00.000Z"
  }
}
```

**Errors**:
- `404`: Document not found

---

### POST /api/documents/upload

Upload a new document.

**Authentication**: Required

**Content-Type**: `multipart/form-data`

**Request Body**:
| Field | Type | Description |
|-------|------|-------------|
| document | file | The document file (PDF, PNG, JPG) |

**Response** (201):
```json
{
  "success": true,
  "document": {
    "id": "uuid",
    "filename": "invoice.pdf",
    "status": "processing"
  },
  "message": "Document uploaded successfully"
}
```

**Errors**:
- `400`: Invalid file type or size
- `413`: File too large (max 10MB)

---

### DELETE /api/documents/:id

Delete a document.

**Authentication**: Required

**Response** (200):
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

---

### PATCH /api/documents/:id

Update a document.

**Authentication**: Required

**Request Body**:
```json
{
  "filename": "new-name.pdf",
  "status": "reviewed"
}
```

**Response** (200):
```json
{
  "success": true,
  "document": {
    "id": "uuid",
    "filename": "new-name.pdf",
    "status": "reviewed"
  }
}
```

---

## Processing Endpoints

### POST /api/process/single

Process a single document and fill a form.

**Authentication**: Required

**Content-Type**: `multipart/form-data`

**Request Body**:
| Field | Type | Description |
|-------|------|-------------|
| document | file | Source document |
| form | file | PDF form to fill |

**Response** (200):
```json
{
  "success": true,
  "jobId": "uuid",
  "status": "processing"
}
```

---

### POST /api/process/multiple

Process multiple documents.

**Authentication**: Required

**Content-Type**: `multipart/form-data`

**Request Body**:
| Field | Type | Description |
|-------|------|-------------|
| documents | file[] | Source documents |

**Response** (200):
```json
{
  "success": true,
  "jobId": "uuid",
  "documentCount": 5
}
```

---

### GET /api/jobs/:id/status

Get the status of a processing job.

**Authentication**: Required

**Response** (200):
```json
{
  "success": true,
  "job": {
    "id": "uuid",
    "status": "completed",
    "progress": 100,
    "result": {
      "extractedData": {...},
      "filledFormUrl": "/downloads/uuid.pdf"
    },
    "startedAt": "2025-11-25T10:00:00.000Z",
    "completedAt": "2025-11-25T10:00:05.000Z"
  }
}
```

---

## User Profile Endpoints

### GET /api/users/me/profile

Get the current user's profile.

**Authentication**: Required

**Response** (200):
```json
{
  "success": true,
  "profile": {
    "id": "uuid",
    "userId": "uuid",
    "data": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phone": "(555) 123-4567"
    },
    "updatedAt": "2025-11-25T10:00:00.000Z"
  }
}
```

---

### PUT /api/users/me/profile

Update the current user's profile.

**Authentication**: Required

**Request Body**:
```json
{
  "data": {
    "firstName": "John",
    "lastName": "Doe",
    "phone": "(555) 123-4567"
  }
}
```

**Response** (200):
```json
{
  "success": true,
  "profile": {...},
  "message": "Profile updated successfully"
}
```

---

### POST /api/users/me/fill-form

Fill a form using the user's profile data.

**Authentication**: Required

**Content-Type**: `multipart/form-data`

**Request Body**:
| Field | Type | Description |
|-------|------|-------------|
| form | file | PDF form to fill |

**Response** (200):
```json
{
  "success": true,
  "filledFormUrl": "/downloads/uuid.pdf",
  "fieldsMatched": 15,
  "totalFields": 20
}
```

---

## Template Endpoints

### GET /api/templates

List all templates.

**Authentication**: Required

**Response** (200):
```json
{
  "success": true,
  "templates": [
    {
      "id": "uuid",
      "name": "W-9 Form",
      "description": "IRS W-9 tax form",
      "fieldCount": 25,
      "isPublic": true,
      "createdAt": "2025-11-25T10:00:00.000Z"
    }
  ]
}
```

---

### GET /api/templates/public

List public templates.

**Authentication**: None

**Response** (200):
```json
{
  "success": true,
  "templates": [...]
}
```

---

### POST /api/templates

Create a new template.

**Authentication**: Required

**Request Body**:
```json
{
  "name": "Custom Form",
  "description": "My custom form template",
  "fields": [
    { "name": "full_name", "type": "text", "label": "Full Name" }
  ],
  "isPublic": false
}
```

**Response** (201):
```json
{
  "success": true,
  "template": {...}
}
```

---

### PUT /api/templates/:id

Update a template.

**Authentication**: Required

**Request Body**:
```json
{
  "name": "Updated Name",
  "fields": [...]
}
```

**Response** (200):
```json
{
  "success": true,
  "template": {...}
}
```

---

### DELETE /api/templates/:id

Delete a template.

**Authentication**: Required

**Response** (200):
```json
{
  "success": true,
  "message": "Template deleted successfully"
}
```

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| VALIDATION_ERROR | 400 | Invalid request data |
| UNAUTHORIZED | 401 | Missing or invalid auth |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource conflict |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## Rate Limiting

API endpoints are rate limited:

- **Unauthenticated**: 20 requests/minute
- **Authenticated**: 100 requests/minute
- **File uploads**: 10 requests/minute

Rate limit headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1637840000
```

---

## Related Documentation

- [Environment Variables](../configuration/environment.md)
- [Authentication Guide](../../how-to/troubleshooting/auth-issues.md)
- [Architecture Overview](../architecture/system-overview.md)

