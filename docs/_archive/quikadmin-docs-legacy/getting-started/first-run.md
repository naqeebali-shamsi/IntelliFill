# Your First Document Processing

**Last Updated:** 2025-01-10
**Status:** Complete
**Difficulty:** Beginner
**Estimated Time:** 10 minutes
**Audience:** Developers

---

## Overview

In this tutorial, you'll process your first document with QuikAdmin. You'll learn how to authenticate, upload a source document and target PDF form, and download the automatically filled result. By the end, you'll have a complete working example you can use as a template for your own integrations.

## Prerequisites

Before starting, ensure you have:

- [ ] QuikAdmin running locally (backend on port 3002, frontend on port 5173)
- [ ] A PDF form to fill (target form)
- [ ] A source document with data to extract (PDF, DOCX, or image)
- [ ] cURL or Postman for API testing (or use the web interface)

**Need to install?** See [101-installation.md](./101-installation.md)

## Step 1: Create a Test User Account

First, we need to create a user account to get authentication tokens.

### Using cURL:

```bash
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "fullName": "Test User"
  }'
```

### Expected Response:

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "test@example.com",
      "firstName": "Test",
      "lastName": "User",
      "role": "USER",
      "isActive": true
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900,
      "tokenType": "Bearer"
    }
  }
}
```

**Save the `accessToken`** - you'll need it for subsequent requests!

### Using the Web Interface:

1. Open http://localhost:5173 in your browser
2. Click "Register" or navigate to the registration page
3. Fill in:
   - Email: `test@example.com`
   - Password: `Test123!` (must have uppercase, lowercase, and number)
   - Full Name: `Test User`
4. Click "Register"
5. You'll be automatically logged in

**Troubleshooting:**

- **"User already exists"**: Use a different email or login with existing credentials
- **"Password too weak"**: Ensure password has at least 8 characters with uppercase, lowercase, and number
- **Connection refused**: Check that backend is running on port 3002

## Step 2: Verify Authentication

Test that your token works by getting your profile:

```bash
# Replace YOUR_ACCESS_TOKEN with the token from Step 1
curl -X GET http://localhost:3002/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Expected Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "test@example.com",
      "full_name": "Test User",
      "role": "user",
      "is_active": true,
      "email_verified": false,
      "created_at": "2025-01-10T12:00:00.000Z",
      "updated_at": "2025-01-10T12:00:00.000Z",
      "last_login": "2025-01-10T12:00:00.000Z"
    }
  }
}
```

**Troubleshooting:**

- **401 Unauthorized**: Token is invalid or expired. Register/login again.
- **Token expired**: Access tokens expire after 15 minutes. Use refresh token to get a new one (see [301-authentication.md](../300-api/301-authentication.md))

## Step 3: Prepare Your Documents

For this tutorial, you need two files:

1. **Source Document** - Contains the data to extract
   - Can be: PDF, DOCX, TXT, CSV, or image
   - Example: An invoice, ID card, receipt, or form with data

2. **Target PDF Form** - The form to fill
   - Must be a PDF with fillable fields
   - Example: A tax form, application form, or government form

**Test Files:**
If you don't have test files, you can:

- Use files from `tests/test-data/` directory (if available)
- Create a simple PDF form using Adobe Acrobat or online tools
- Use any document with text you want to extract

## Step 4: Upload and Process Documents

Now we'll upload both documents and process them together.

### API Method (Recommended):

```bash
# Replace paths with your actual file paths
curl -X POST http://localhost:3002/api/documents/process \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "sourceDocument=@/path/to/source-document.pdf" \
  -F "targetForm=@/path/to/target-form.pdf"
```

**Important:**

- Use `-F` for multipart/form-data (file uploads)
- Path must be absolute or relative to your current directory
- Replace `YOUR_ACCESS_TOKEN` with your actual token

### Expected Response:

```json
{
  "success": true,
  "message": "Document processing started",
  "data": {
    "job_id": "job_abc123",
    "status": "processing",
    "estimated_time": 5
  }
}
```

The API returns immediately with a job ID. Processing happens asynchronously in the background.

### Web Interface Method:

1. Navigate to http://localhost:5173/dashboard (or the upload page)
2. Click "Upload Source Document" and select your source file
3. Click "Upload Target Form" and select your PDF form
4. Click "Process Documents"
5. Wait for processing to complete (typically 2-10 seconds)
6. Download the filled PDF when ready

## Step 5: Check Processing Status

If using the API, check the job status:

```bash
curl -X GET http://localhost:3002/api/jobs/job_abc123 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Expected Responses:

**Processing:**

```json
{
  "status": "processing",
  "progress": 50,
  "message": "Extracting data from source document..."
}
```

**Completed:**

```json
{
  "status": "completed",
  "result": {
    "document_id": "doc_xyz789",
    "confidence": 0.92,
    "fields_filled": 15,
    "download_url": "/api/documents/doc_xyz789/download"
  }
}
```

**Failed:**

```json
{
  "status": "failed",
  "error": "Could not extract text from source document",
  "details": "Document may be scanned without OCR"
}
```

## Step 6: Download Filled PDF

Once processing is complete, download your filled form:

```bash
# Using the document_id from the job result
curl -X GET http://localhost:3002/api/documents/doc_xyz789/download \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  --output filled-form.pdf
```

This will save the filled PDF to `filled-form.pdf` in your current directory.

### Verify the Result:

1. Open `filled-form.pdf` in a PDF viewer
2. Check that fields are correctly filled
3. Note the confidence score (0-1) indicates extraction accuracy:
   - **0.9-1.0** - Excellent, high confidence
   - **0.8-0.9** - Good, likely accurate
   - **0.7-0.8** - Fair, review recommended
   - **<0.7** - Poor, manual review required

## Complete Working Example (JavaScript)

Here's a complete script you can use:

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const BASE_URL = 'http://localhost:3002/api';

async function processDocument() {
  // Step 1: Register/Login
  const authResponse = await axios.post(`${BASE_URL}/auth/register`, {
    email: 'test@example.com',
    password: 'Test123!',
    fullName: 'Test User',
  });

  const accessToken = authResponse.data.data.tokens.accessToken;
  console.log('✅ Authenticated successfully');

  // Step 2: Upload and process documents
  const formData = new FormData();
  formData.append('sourceDocument', fs.createReadStream('./source.pdf'));
  formData.append('targetForm', fs.createReadStream('./form.pdf'));

  const processResponse = await axios.post(`${BASE_URL}/documents/process`, formData, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...formData.getHeaders(),
    },
  });

  const jobId = processResponse.data.data.job_id;
  console.log(`✅ Processing started: ${jobId}`);

  // Step 3: Wait for completion (poll every 2 seconds)
  let status = 'processing';
  while (status === 'processing') {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const statusResponse = await axios.get(`${BASE_URL}/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    status = statusResponse.data.status;
    console.log(`Status: ${status}`);
  }

  // Step 4: Download result
  if (status === 'completed') {
    const documentId = processResponse.data.data.result.document_id;
    const downloadResponse = await axios.get(`${BASE_URL}/documents/${documentId}/download`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'stream',
    });

    const writer = fs.createWriteStream('filled-form.pdf');
    downloadResponse.data.pipe(writer);

    writer.on('finish', () => {
      console.log('✅ Downloaded filled form to filled-form.pdf');
    });
  } else {
    console.error('❌ Processing failed');
  }
}

processDocument().catch(console.error);
```

Save this as `test-process.js` and run:

```bash
npm install axios form-data
node test-process.js
```

## Common Issues

### Issue: "Authentication required"

**Cause:** Missing or invalid token

**Solution:**

```bash
# Re-authenticate to get a new token
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

### Issue: "Could not extract text from document"

**Cause:** Document may be scanned without searchable text

**Solution:**

- Ensure PDF has searchable text (not just scanned image)
- OCR service may need configuration (see [01-current-state/architecture/system-overview.md](../01-current-state/architecture/system-overview.md))
- Try a different source document

### Issue: "Field mapping confidence too low"

**Cause:** ML model couldn't confidently match fields

**Solution:**

- Use source documents with clear labels
- Ensure field names are descriptive
- Confidence <0.7 indicates manual review needed

### Issue: "Rate limit exceeded"

**Cause:** Too many requests in short time

**Solution:**

- Wait 15 minutes for rate limit to reset
- Upload limit: 10 requests/hour per IP
- See [301-authentication.md](../300-api/301-authentication.md) for limits

## Next Steps

Congratulations! You've successfully processed your first document with QuikAdmin.

**Explore More:**

- [Authentication API](../300-api/301-authentication.md) - Learn about token refresh, logout, password change
- [Security Architecture](../200-architecture/204-security-architecture.md) - Understand JWT security
- [Troubleshooting Guide](../400-guides/407-troubleshooting.md) - Solutions to common problems
- [01-current-state/architecture/system-overview.md](../01-current-state/architecture/system-overview.md) - Deep dive into the system

**Advanced Topics:**

- Batch processing multiple documents
- Custom field mapping configuration
- Template learning from corrections
- API integration patterns

## What You Learned

- ✅ How to register a user and get authentication tokens
- ✅ How to make authenticated API requests
- ✅ How to upload and process documents
- ✅ How to check processing status
- ✅ How to download filled PDF forms
- ✅ How to handle common errors
- ✅ Complete working examples in cURL and JavaScript

---

**Need Help?** Check the [Troubleshooting Guide](../400-guides/407-troubleshooting.md) or review [SETUP_GUIDE_WINDOWS.md](../../SETUP_GUIDE_WINDOWS.md) for Windows-specific issues.
