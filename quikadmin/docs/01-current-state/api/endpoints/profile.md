# User Profile API Reference

**Status:** Phase 1 Complete - Production Ready
**Last Updated:** 2025-01-19

## Overview

The User Profile API provides intelligent aggregation and management of user data extracted from all uploaded documents. It automatically deduplicates values (e.g., same email from multiple documents) and provides a centralized profile that can be used for form auto-filling.

**Key Features:**
- Automatic data aggregation from all user documents
- Intelligent deduplication (phone numbers, emails, SSNs)
- Encrypted storage at rest
- Manual profile editing with merge capabilities
- Field-level confidence scoring
- Source attribution (track which documents contributed data)

---

## Base URL

All profile endpoints are mounted under: `/api/users`

---

## Authentication

All profile endpoints require Supabase authentication. Include the access token in the Authorization header:

```http
Authorization: Bearer <access_token>
```

---

## Endpoints

### GET /api/users/me/profile

Retrieve the user's aggregated profile data from all completed documents.

**Request:**
```http
GET /api/users/me/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "profile": {
    "userId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    "fields": [
      {
        "key": "email",
        "values": ["john.doe@example.com", "j.doe@work.com"],
        "sourceCount": 3,
        "confidence": 92.5,
        "lastUpdated": "2025-01-19T12:30:00.000Z"
      },
      {
        "key": "phone",
        "values": ["+1-555-0100"],
        "sourceCount": 2,
        "confidence": 88.0,
        "lastUpdated": "2025-01-19T12:30:00.000Z"
      },
      {
        "key": "first_name",
        "values": ["John"],
        "sourceCount": 4,
        "confidence": 95.0,
        "lastUpdated": "2025-01-19T12:30:00.000Z"
      },
      {
        "key": "last_name",
        "values": ["Doe"],
        "sourceCount": 4,
        "confidence": 95.0,
        "lastUpdated": "2025-01-19T12:30:00.000Z"
      },
      {
        "key": "ssn",
        "values": ["123-45-6789"],
        "sourceCount": 1,
        "confidence": 90.0,
        "lastUpdated": "2025-01-19T12:30:00.000Z"
      }
    ],
    "lastAggregated": "2025-01-19T12:30:00.000Z",
    "documentCount": 4
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `profile.userId` | string | User's unique identifier |
| `profile.fields` | array | Array of profile fields with values |
| `profile.fields[].key` | string | Normalized field key (lowercase, underscores) |
| `profile.fields[].values` | array | Deduplicated values for this field |
| `profile.fields[].sourceCount` | number | Number of documents that contributed this field |
| `profile.fields[].confidence` | number | Weighted average confidence score (0-100) |
| `profile.fields[].lastUpdated` | string | ISO timestamp of last update |
| `profile.lastAggregated` | string | ISO timestamp of last aggregation |
| `profile.documentCount` | number | Total documents included in aggregation |

**Behavior:**
- If no profile exists, automatically aggregates from all completed documents
- Returns cached profile if less than 1 hour old
- Automatically refreshes stale profiles (older than 1 hour)
- Returns empty profile if user has no completed documents

**Error Responses:**

`401 Unauthorized` - Missing or invalid authentication token
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid Authorization header"
}
```

---

### PUT /api/users/me/profile

Manually update profile fields. New values are merged with existing aggregated data.

**Request:**
```http
PUT /api/users/me/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "email": "new.email@example.com",
  "phone": "+1-555-9999",
  "middle_name": "Robert",
  "custom_field": "Custom Value"
}
```

**Request Body:**
- Any key-value pairs to add/update in profile
- Keys are normalized to lowercase with underscores
- Values can be strings, numbers, booleans, or arrays
- Nested objects are flattened

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "profile": {
    "userId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    "fields": [
      {
        "key": "email",
        "values": ["john.doe@example.com", "new.email@example.com"],
        "sourceCount": 4,
        "confidence": 94.0,
        "lastUpdated": "2025-01-19T13:00:00.000Z"
      },
      {
        "key": "phone",
        "values": ["+1-555-0100", "+1-555-9999"],
        "sourceCount": 3,
        "confidence": 90.0,
        "lastUpdated": "2025-01-19T13:00:00.000Z"
      },
      {
        "key": "middle_name",
        "values": ["Robert"],
        "sourceCount": 1,
        "confidence": 100.0,
        "lastUpdated": "2025-01-19T13:00:00.000Z"
      }
    ],
    "lastAggregated": "2025-01-19T13:00:00.000Z",
    "documentCount": 4
  }
}
```

**Behavior:**
- Manual edits have 100% confidence score
- New values are added to existing field values (not replaced)
- Creates profile if it doesn't exist (aggregates from documents first)
- Automatically deduplicates after merge
- Sources marked as "manual_edit" for traceability

**Error Responses:**

`400 Bad Request` - Empty or invalid request body
```json
{
  "error": "Bad Request",
  "message": "Profile updates are required"
}
```

`401 Unauthorized` - Missing or invalid authentication
```json
{
  "error": "Unauthorized",
  "message": "User ID not found in request"
}
```

---

### POST /api/users/me/profile/refresh

Manually trigger profile refresh by re-aggregating data from all documents.

**Request:**
```http
POST /api/users/me/profile/refresh
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Use Cases:**
- User just uploaded new documents and wants immediate profile update
- Force refresh after document deletion
- Troubleshooting/debugging profile issues

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile refreshed successfully",
  "profile": {
    "userId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    "fields": [...],
    "lastAggregated": "2025-01-19T13:15:00.000Z",
    "documentCount": 5
  }
}
```

**Behavior:**
- Discards cached profile and re-aggregates from scratch
- Includes all completed documents with extracted data
- Recalculates all confidence scores
- Updates lastAggregated timestamp

**Error Responses:**

`401 Unauthorized`
```json
{
  "error": "Unauthorized",
  "message": "User ID not found in request"
}
```

---

### DELETE /api/users/me/profile

Delete the user's aggregated profile. Documents remain intact.

**Request:**
```http
DELETE /api/users/me/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile deleted successfully"
}
```

**Behavior:**
- Deletes UserProfile record from database
- Does NOT delete user's documents or extracted data
- Profile will be re-created on next GET request
- Cannot be undone (manual edits are lost)

**Error Responses:**

`404 Not Found` - Profile doesn't exist
```json
{
  "error": "Not Found",
  "message": "Profile not found"
}
```

`401 Unauthorized`
```json
{
  "error": "Unauthorized",
  "message": "User ID not found in request"
}
```

---

### GET /api/users/me/profile/field/:fieldKey

Retrieve a specific field from the user's profile.

**Request:**
```http
GET /api/users/me/profile/field/email
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `fieldKey` | string | The field key to retrieve (e.g., "email", "phone", "ssn") |

**Success Response (200 OK):**
```json
{
  "success": true,
  "field": {
    "key": "email",
    "values": ["john.doe@example.com", "j.doe@work.com"],
    "sourceCount": 3,
    "confidence": 92.5,
    "lastUpdated": "2025-01-19T12:30:00.000Z"
  }
}
```

**Behavior:**
- Field key is normalized before lookup (case-insensitive, underscores)
- Returns 404 if field doesn't exist in profile
- Useful for targeted field retrieval in UI

**Error Responses:**

`404 Not Found` - Profile or field doesn't exist
```json
{
  "error": "Not Found",
  "message": "Field 'email' not found in profile"
}
```

`400 Bad Request` - Missing field key
```json
{
  "error": "Bad Request",
  "message": "Field key is required"
}
```

`401 Unauthorized`
```json
{
  "error": "Unauthorized",
  "message": "User ID not found in request"
}
```

---

## Data Aggregation & Deduplication

### Field Key Normalization

All field keys are normalized to a consistent format:
- Convert to lowercase
- Replace spaces, hyphens, and multiple underscores with single underscore
- Remove special characters
- Trim leading/trailing underscores

**Examples:**
```
"First Name"     → "first_name"
"Email-Address"  → "email_address"
"Phone__Number"  → "phone_number"
"SSN#"           → "ssn"
```

### Intelligent Deduplication

Different deduplication strategies are applied based on field type:

**Email Addresses:**
- Case-insensitive comparison
- `John.Doe@Example.com` = `john.doe@example.com`

**Phone Numbers:**
- Normalize by extracting digits only
- Remove country code if US (+1)
- `+1-555-0100` = `(555) 010-0100` = `555-010-0100`

**SSN/ID Numbers:**
- Remove all formatting characters
- `123-45-6789` = `123 45 6789` = `123456789`

**Other Fields:**
- Case-sensitive exact match
- No normalization

### Confidence Scoring

Confidence scores indicate data reliability:

| Source | Confidence |
|--------|------------|
| Manual edit | 100% |
| Multiple documents agree | Weighted average |
| Single document | Document's OCR confidence |

**Weighted Average Formula:**
```
confidence = (conf₁ + conf₂ + ... + confₙ) / n
```

where n = number of source documents

---

## Examples

### Example 1: First-Time Profile Access

User uploads 3 documents (resume, passport, bank statement) and accesses profile for first time.

**Request:**
```http
GET /api/users/me/profile
Authorization: Bearer <token>
```

**System Behavior:**
1. No profile exists → trigger automatic aggregation
2. Fetch all completed documents (3 documents)
3. Decrypt and process extracted data from each
4. Deduplicate values across all sources
5. Calculate confidence scores
6. Encrypt and save profile to database
7. Return formatted profile

**Response:**
```json
{
  "success": true,
  "profile": {
    "userId": "user-123",
    "fields": [
      {
        "key": "email",
        "values": ["john@example.com"],
        "sourceCount": 3,
        "confidence": 93.3,
        "lastUpdated": "2025-01-19T10:00:00.000Z"
      },
      {
        "key": "phone",
        "values": ["+1-555-0100"],
        "sourceCount": 2,
        "confidence": 90.0,
        "lastUpdated": "2025-01-19T10:00:00.000Z"
      }
    ],
    "lastAggregated": "2025-01-19T10:00:00.000Z",
    "documentCount": 3
  }
}
```

### Example 2: Manual Profile Update

User corrects their phone number and adds middle name.

**Request:**
```http
PUT /api/users/me/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone": "+1-555-9999",
  "middle_name": "Robert"
}
```

**System Behavior:**
1. Load existing profile
2. Normalize field keys: `phone`, `middle_name`
3. Merge new values with existing (phone gets 2nd value)
4. Mark sources as "manual_edit" with 100% confidence
5. Recalculate weighted confidence for phone field
6. Save updated profile
7. Return merged profile

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "profile": {
    "fields": [
      {
        "key": "phone",
        "values": ["+1-555-0100", "+1-555-9999"],
        "sourceCount": 3,
        "confidence": 95.0,
        "lastUpdated": "2025-01-19T10:05:00.000Z"
      },
      {
        "key": "middle_name",
        "values": ["Robert"],
        "sourceCount": 1,
        "confidence": 100.0,
        "lastUpdated": "2025-01-19T10:05:00.000Z"
      }
    ]
  }
}
```

### Example 3: Form Auto-Fill Integration

Frontend retrieves profile to auto-fill a job application form.

**Step 1: Get Profile**
```http
GET /api/users/me/profile
Authorization: Bearer <token>
```

**Step 2: Map Fields**
```javascript
const profile = response.data.profile;

// Find values for form fields
const email = profile.fields.find(f => f.key === 'email')?.values[0];
const phone = profile.fields.find(f => f.key === 'phone')?.values[0];
const firstName = profile.fields.find(f => f.key === 'first_name')?.values[0];
const lastName = profile.fields.find(f => f.key === 'last_name')?.values[0];

// Auto-fill form
document.getElementById('email').value = email;
document.getElementById('phone').value = phone;
document.getElementById('firstName').value = firstName;
document.getElementById('lastName').value = lastName;
```

**Step 3: Let User Review & Submit**

User reviews pre-filled values, makes edits, and submits form.

---

## Security & Privacy

### Encryption at Rest

All profile data is encrypted before storage:
- Uses AES-256-GCM encryption
- Encryption keys managed via environment variables
- Profile data stored as encrypted JSON in database
- Automatic decryption on retrieval

### Data Access

- Users can only access their own profile
- Admin users cannot access other users' profiles without consent
- All profile access is logged in audit trail

### GDPR Compliance

Profile deletion:
```http
DELETE /api/users/me/profile
```

Full user deletion (cascades to profile):
```http
DELETE /api/users/me
```

---

## Performance Considerations

### Caching Strategy

- Profiles cached for 1 hour after aggregation
- Stale profiles auto-refresh on next GET request
- Manual refresh available via POST /refresh endpoint

### Optimization Tips

1. **Use field-specific endpoint** for single field retrieval:
   ```http
   GET /api/users/me/profile/field/email
   ```
   (Faster than fetching entire profile)

2. **Trigger refresh after bulk document upload**:
   ```http
   POST /api/users/me/profile/refresh
   ```

3. **Cache profile data in frontend** for form filling session

---

## Troubleshooting

### Profile Not Updating After Document Upload

**Problem:** Uploaded new document but profile still shows old data.

**Solution:** Profile cached for 1 hour. Either:
- Wait for auto-refresh (next access after 1 hour)
- Manually trigger refresh:
  ```http
  POST /api/users/me/profile/refresh
  ```

### Missing Fields in Profile

**Problem:** Certain fields from documents not appearing in profile.

**Possible Causes:**
1. Document status not "COMPLETED"
2. Document has no extractedData
3. Extraction failed for those specific fields

**Debug Steps:**
1. Check document status:
   ```http
   GET /api/documents/:id
   ```
2. Verify extractedData exists
3. Trigger profile refresh
4. Check server logs for extraction errors

### Duplicate Values Not Deduplicating

**Problem:** Same phone number appears multiple times with different formats.

**Expected Behavior:** Phone numbers should normalize and deduplicate.

**Solution:** Ensure field key includes "phone", "tel", or "mobile" for auto-deduplication. Otherwise, values must match exactly.

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| GET /profile | 100 requests | 15 minutes |
| PUT /profile | 50 requests | 15 minutes |
| POST /refresh | 20 requests | 15 minutes |
| DELETE /profile | 10 requests | 15 minutes |

---

## Changelog

### 2025-01-19 - Initial Release (Phase 1)
- ✅ GET /api/users/me/profile
- ✅ PUT /api/users/me/profile
- ✅ POST /api/users/me/profile/refresh
- ✅ DELETE /api/users/me/profile
- ✅ GET /api/users/me/profile/field/:fieldKey
- ✅ Automatic aggregation from documents
- ✅ Intelligent deduplication
- ✅ Encrypted storage at rest
- ✅ Weighted confidence scoring
- ✅ Source attribution
