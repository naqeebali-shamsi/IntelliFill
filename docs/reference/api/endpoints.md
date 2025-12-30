---
title: API Endpoints Reference
description: Complete reference for all IntelliFill API endpoints
category: reference
tags: [api, endpoints, rest]
lastUpdated: 2025-12-30
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

**Request Body**:

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

### POST /api/auth/v2/login

Authenticate a user.

### POST /api/auth/v2/logout

Log out the current user.

### POST /api/auth/v2/refresh

Refresh the authentication token.

### POST /api/auth/v2/change-password

Change the user's password.

### POST /api/auth/v2/forgot-password

Request a password reset email.

### POST /api/auth/v2/reset-password

Reset password with token.

---

## Document Endpoints

### GET /api/documents

List all documents for the current user.

### GET /api/documents/:id

Get a specific document.

### POST /api/documents/upload

Upload a new document.

### DELETE /api/documents/:id

Delete a document.

### PATCH /api/documents/:id

Update a document.

---

## Processing Endpoints

### POST /api/process/single

Process a single document and fill a form.

### POST /api/process/multiple

Process multiple documents.

### GET /api/jobs/:id/status

Get the status of a processing job.

---

## User Profile Endpoints

### GET /api/users/me/profile

Get the current user's profile.

### PUT /api/users/me/profile

Update the current user's profile.

### POST /api/users/me/fill-form

Fill a form using the user's profile data.

---

## Template Endpoints

### GET /api/templates

List all templates.

### GET /api/templates/public

List public templates.

### POST /api/templates

Create a new template.

### PUT /api/templates/:id

Update a template.

### DELETE /api/templates/:id

Delete a template.

---

## Profile API (Detailed)

The User Profile API provides intelligent aggregation and management of user data extracted from all uploaded documents.

### Key Features

- Automatic data aggregation from all user documents
- Intelligent deduplication (phone numbers, emails, SSNs)
- Encrypted storage at rest
- Manual profile editing with merge capabilities
- Field-level confidence scoring
- Source attribution (track which documents contributed data)

### POST /api/users/me/profile/refresh

Manually trigger profile refresh by re-aggregating data from all documents.

### DELETE /api/users/me/profile

Delete the user's aggregated profile. Documents remain intact.

### GET /api/users/me/profile/field/:fieldKey

Retrieve a specific field from the user's profile.

---

## Template API (Detailed)

### POST /api/templates/detect

Analyzes field names and detects the most likely form type.

**Supported Form Types:**

- W2 - W-2 Wage and Tax Statement
- I9 - I-9 Employment Eligibility Verification
- PASSPORT - US Passport Application
- JOB_APPLICATION - Job Application Form
- CUSTOM - Custom/Unknown Form Type

### POST /api/templates/match

Finds templates that match the provided field names, ranked by similarity.

### POST /api/templates/:id/use

Records template usage (increments usage counter).

---

## Document Reprocessing API

### POST /api/documents/:id/reprocess

Re-run OCR processing on a single document with higher quality settings.

### POST /api/documents/reprocess/batch

Re-run OCR processing on multiple documents at once.

### GET /api/documents/low-confidence

Retrieve documents with confidence scores below a specified threshold.

### GET /api/documents/:id/reprocessing-history

Retrieve reprocessing history and metadata for a document.

### Enhanced OCR Settings (Reprocessing)

| Setting               | Normal OCR | Reprocessing |
| --------------------- | ---------- | ------------ |
| DPI                   | 300        | 600          |
| Adaptive Thresholding | No         | Yes          |
| Deskewing             | No         | Yes          |
| Noise Reduction       | No         | Yes          |
| Timeout               | 5 minutes  | 10 minutes   |
| Priority              | Normal     | High         |

---

## Related Documentation

- [Environment Variables](../configuration/environment.md)
- [Authentication Guide](../../how-to/troubleshooting/auth-issues.md)
- [Architecture Overview](../architecture/system-overview.md)
- [Document Reprocessing Guide](../../tutorials/document-reprocessing.md)
- [Template Usage Guide](../../tutorials/template-usage.md)
