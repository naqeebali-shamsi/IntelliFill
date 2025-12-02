# Template API Reference

The Template API enables users to save, load, and manage form field mapping templates for reusable form filling workflows.

## Base URL

All template endpoints are prefixed with `/api/templates`

## Authentication

All endpoints require authentication via Bearer token in the Authorization header (except for public template endpoints).

```
Authorization: Bearer <your-token>
```

---

## Endpoints

### Create Template

Creates a new template for the authenticated user.

**Endpoint:** `POST /api/templates`

**Authentication:** Required

**Request Body:**
```json
{
  "name": "W-2 Tax Form",
  "description": "Standard W-2 form for tax reporting",
  "formType": "W2",
  "fieldMappings": [
    {
      "sourceField": "employer_ein",
      "targetField": "ein",
      "confidence": 1.0
    },
    {
      "sourceField": "wages",
      "targetField": "box_1",
      "confidence": 1.0
    }
  ],
  "isPublic": false
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Template name |
| description | string | No | Template description |
| formType | string | Yes | Form type (W2, I9, PASSPORT, JOB_APPLICATION, CUSTOM) |
| fieldMappings | array | Yes | Array of field mapping objects |
| isPublic | boolean | No | Whether template should be public (default: false) |

**Field Mapping Object:**
```typescript
{
  sourceField: string;    // Source field name from user data
  targetField: string;    // Target field name in form
  transform?: string;     // Optional transformation rule
  confidence?: number;    // Confidence score (0-1)
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Template created successfully",
  "template": {
    "id": "uuid",
    "name": "W-2 Tax Form",
    "description": "Standard W-2 form for tax reporting",
    "formType": "W2",
    "isPublic": false,
    "createdAt": "2025-11-20T10:30:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields or invalid data
- `401 Unauthorized` - Missing or invalid authentication token

---

### Get User Templates

Retrieves all templates created by the authenticated user.

**Endpoint:** `GET /api/templates`

**Authentication:** Required

**Response (200 OK):**
```json
{
  "success": true,
  "templates": [
    {
      "id": "uuid",
      "name": "W-2 Tax Form",
      "description": "Standard W-2 form for tax reporting",
      "formType": "W2",
      "isPublic": false,
      "usageCount": 5,
      "createdAt": "2025-11-20T10:30:00Z",
      "updatedAt": "2025-11-20T11:00:00Z"
    }
  ],
  "count": 1
}
```

---

### Get Template by ID

Retrieves a specific template with decrypted field mappings.

**Endpoint:** `GET /api/templates/:id`

**Authentication:** Required

**Parameters:**
- `id` (path parameter) - Template UUID

**Response (200 OK):**
```json
{
  "success": true,
  "template": {
    "id": "uuid",
    "name": "W-2 Tax Form",
    "description": "Standard W-2 form for tax reporting",
    "formType": "W2",
    "fieldMappings": [
      {
        "sourceField": "employer_ein",
        "targetField": "ein",
        "confidence": 1.0
      }
    ],
    "isPublic": false,
    "usageCount": 5,
    "createdAt": "2025-11-20T10:30:00Z",
    "updatedAt": "2025-11-20T11:00:00Z"
  }
}
```

**Error Responses:**
- `404 Not Found` - Template not found or access denied

---

### Update Template

Updates an existing template.

**Endpoint:** `PUT /api/templates/:id`

**Authentication:** Required

**Parameters:**
- `id` (path parameter) - Template UUID

**Request Body** (all fields optional):
```json
{
  "name": "Updated Template Name",
  "description": "Updated description",
  "formType": "CUSTOM",
  "fieldMappings": [...],
  "isPublic": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Template updated successfully",
  "template": {
    "id": "uuid",
    "name": "Updated Template Name",
    "description": "Updated description",
    "formType": "CUSTOM",
    "isPublic": true,
    "updatedAt": "2025-11-20T12:00:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - No update fields provided
- `404 Not Found` - Template not found or access denied

---

### Delete Template

Soft deletes a template (marks as inactive).

**Endpoint:** `DELETE /api/templates/:id`

**Authentication:** Required

**Parameters:**
- `id` (path parameter) - Template UUID

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Template deleted successfully"
}
```

**Error Responses:**
- `404 Not Found` - Template not found or access denied

---

### Detect Form Type

Analyzes field names and detects the most likely form type.

**Endpoint:** `POST /api/templates/detect`

**Authentication:** Required

**Request Body:**
```json
{
  "fieldNames": [
    "employer_ein",
    "employee_ssn",
    "wages",
    "federal_income_tax"
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "detection": {
    "formType": "W2",
    "confidence": 85.5,
    "matchedPatterns": [
      "employer_ein",
      "employee_ssn",
      "wages",
      "federal_income_tax"
    ]
  }
}
```

**Form Types:**
- `W2` - W-2 Wage and Tax Statement
- `I9` - I-9 Employment Eligibility Verification
- `PASSPORT` - US Passport Application
- `JOB_APPLICATION` - Job Application Form
- `CUSTOM` - Custom/Unknown Form Type

**Error Responses:**
- `400 Bad Request` - Missing or invalid fieldNames array

---

### Match Templates

Finds templates that match the provided field names, ranked by similarity.

**Endpoint:** `POST /api/templates/match`

**Authentication:** Required

**Request Body:**
```json
{
  "fieldNames": [
    "employer_ein",
    "wages",
    "federal_tax"
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "matches": [
    {
      "template": {
        "id": "uuid",
        "name": "W-2 Tax Form",
        "description": "Standard W-2 form for tax reporting",
        "formType": "W2",
        "isPublic": false,
        "usageCount": 10
      },
      "similarity": 75.5,
      "matchedFields": ["employer_ein", "wages"],
      "matchedFieldCount": 2
    }
  ],
  "count": 1
}
```

**Similarity Scoring:**
- Uses Jaccard similarity coefficient
- Includes fuzzy matching for similar field names
- Returns matches with >10% similarity
- Results sorted by similarity (highest first)

---

### Get Public Templates (Marketplace)

Retrieves all public templates available in the marketplace.

**Endpoint:** `GET /api/templates/public`

**Authentication:** Not required

**Response (200 OK):**
```json
{
  "success": true,
  "templates": [
    {
      "id": "uuid",
      "name": "W-2 Tax Form",
      "description": "Standard W-2 form for tax reporting",
      "formType": "W2",
      "usageCount": 150,
      "createdAt": "2025-01-01T00:00:00Z",
      "author": {
        "firstName": "IntelliFill",
        "lastName": "System"
      }
    }
  ],
  "count": 4
}
```

**Pre-loaded Templates:**
- W-2 Wage and Tax Statement
- I-9 Employment Eligibility Verification
- US Passport Application
- Job Application Form

---

### Increment Usage Count

Records template usage (increments usage counter).

**Endpoint:** `POST /api/templates/:id/use`

**Authentication:** Required

**Parameters:**
- `id` (path parameter) - Template UUID

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Template usage recorded"
}
```

**Note:** This endpoint is non-critical and won't fail the workflow if it errors.

---

## Security

### Encryption

Field mappings are encrypted at rest using AES-256-GCM encryption:
- Encryption key derived from `JWT_SECRET` environment variable
- Each encrypted field uses unique IV (initialization vector)
- Includes authentication tag for integrity verification
- Format: `iv:authTag:encryptedData` (base64 encoded)

### Access Control

- Users can only access their own templates
- Public templates are readable by all users
- Templates can only be modified/deleted by their owners
- Soft delete prevents accidental data loss

---

## Rate Limiting

Standard rate limits apply to all template endpoints:
- 100 requests per 15 minutes per user
- 1000 requests per hour per IP address

---

## Example Workflows

### Create and Use a Template

```javascript
// 1. Create template
const createResponse = await fetch('/api/templates', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'My W-2 Template',
    formType: 'W2',
    fieldMappings: [
      { sourceField: 'employer_ein', targetField: 'ein' },
      { sourceField: 'wages', targetField: 'box_1' }
    ]
  })
});

const { template } = await createResponse.json();

// 2. Use template to fill form
await fetch(`/api/templates/${template.id}/use`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});

// 3. Get template with field mappings
const getResponse = await fetch(`/api/templates/${template.id}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

const { template: fullTemplate } = await getResponse.json();
// Use fullTemplate.fieldMappings for form filling
```

### Auto-detect Form Type

```javascript
// Extract field names from form
const formFields = ['employer_ein', 'wages', 'ssn'];

// Detect form type
const detectionResponse = await fetch('/api/templates/detect', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ fieldNames: formFields })
});

const { detection } = await detectionResponse.json();
console.log(`Form type: ${detection.formType}, confidence: ${detection.confidence}%`);

// Find matching templates
const matchResponse = await fetch('/api/templates/match', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ fieldNames: formFields })
});

const { matches } = await matchResponse.json();
// Suggest best matching template to user
if (matches.length > 0) {
  console.log(`Best match: ${matches[0].template.name} (${matches[0].similarity}% similar)`);
}
```

---

## See Also

- [User Guide: Managing Templates](/docs/guides/user/templates.md)
- [Profile API Reference](/docs/api/reference/profile.md)
- [Form Filling API Reference](/docs/api/reference/forms.md)
