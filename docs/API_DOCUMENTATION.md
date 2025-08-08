# QuikAdmin API Documentation

## Overview

QuikAdmin provides a secure, JWT-based API for PDF form filling and document processing. All endpoints require authentication unless otherwise noted.

## Base URL
```
http://localhost:3000/api
```

## Authentication

The API uses JWT-based authentication with refresh tokens for security.

### Authentication Flow
1. Register a new user or login with existing credentials
2. Receive an access token (expires in 15 minutes) and refresh token (expires in 7 days)
3. Include the access token in the Authorization header for protected endpoints
4. Use the refresh token to obtain new access tokens when they expire

### Token Format
```
Authorization: Bearer <access_token>
```

---

## Authentication Endpoints

### Register User
**POST** `/auth/register`

Register a new user account.

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "fullName": "John Doe",
  "role": "user"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "role": "user",
      "is_active": true,
      "email_verified": false,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ...",
      "expiresIn": 900,
      "tokenType": "Bearer"
    }
  }
}
```

#### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

#### Rate Limit
- 3 registrations per hour per IP

---

### Login
**POST** `/auth/login`

Authenticate user and receive tokens.

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "role": "user",
      "is_active": true,
      "email_verified": true,
      "last_login": "2024-01-01T00:00:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ...",
      "expiresIn": 900,
      "tokenType": "Bearer"
    }
  }
}
```

#### Error Responses
- **401 Unauthorized**: Invalid credentials
- **423 Locked**: Account locked due to failed login attempts

#### Rate Limit
- 5 attempts per 15 minutes per IP

---

### Refresh Token
**POST** `/auth/refresh`

Get new access token using refresh token.

#### Request Body
```json
{
  "refreshToken": "eyJ..."
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ...",
      "expiresIn": 900,
      "tokenType": "Bearer"
    }
  }
}
```

---

### Get User Profile
**GET** `/auth/me`

Get current user profile information.

#### Headers
```
Authorization: Bearer <access_token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "role": "user",
      "is_active": true,
      "email_verified": true,
      "created_at": "2024-01-01T00:00:00.000Z",
      "last_login": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

---

### Change Password
**POST** `/auth/change-password`

Change user password (requires current password).

#### Headers
```
Authorization: Bearer <access_token>
```

#### Request Body
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Password changed successfully. Please login again with your new password."
}
```

**Note**: All refresh tokens are revoked after password change, requiring re-authentication.

---

### Logout
**POST** `/auth/logout`

Logout and revoke refresh token.

#### Headers
```
Authorization: Bearer <access_token>
```

#### Request Body
```json
{
  "refreshToken": "eyJ..."
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

### Logout All Devices
**POST** `/auth/logout-all`

Logout from all devices by revoking all refresh tokens.

#### Headers
```
Authorization: Bearer <access_token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Logged out from all devices successfully"
}
```

---

### Verify Token
**POST** `/auth/verify-token`

Verify if an access token is valid.

#### Request Body
```json
{
  "token": "eyJ..."
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "payload": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "user",
      "iat": 1640995200,
      "exp": 1640999800
    }
  }
}
```

---

## PDF Processing Endpoints

All PDF processing endpoints require authentication.

### Process Single Document
**POST** `/process/single`

Process a single document and fill a PDF form.

#### Headers
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

#### Form Data
- `document`: Document file to extract data from
- `form`: PDF form to fill

#### Response (200 OK)
```json
{
  "success": true,
  "message": "PDF form filled successfully",
  "data": {
    "outputPath": "outputs/filled_1640995200000.pdf",
    "filledFields": ["field1", "field2"],
    "confidence": 0.95,
    "processingTime": 1500,
    "warnings": []
  }
}
```

---

### Process Multiple Documents
**POST** `/process/multiple`

Process multiple documents and fill a single PDF form.

#### Headers
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

#### Form Data
- `documents`: Array of document files (max 10)
- `form`: PDF form to fill

#### Response (200 OK)
```json
{
  "success": true,
  "message": "PDF form filled successfully",
  "data": {
    "outputPath": "outputs/filled_1640995200000.pdf",
    "filledFields": ["field1", "field2"],
    "confidence": 0.92,
    "processingTime": 3200,
    "documentsProcessed": 3,
    "warnings": []
  }
}
```

---

### Validate Form
**POST** `/validate/form`

Validate PDF form fields and get field information.

#### Headers
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

#### Form Data
- `form`: PDF form to validate

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "fields": [
      {
        "name": "firstName",
        "type": "text",
        "required": true,
        "maxLength": 50
      }
    ]
  }
}
```

---

### Extract Data
**POST** `/extract`

Extract data from a document.

#### Headers
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

#### Form Data
- `document`: Document file to extract data from

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "documentType": "pdf",
    "metadata": {
      "pages": 2,
      "size": "A4"
    },
    "extractedFields": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "extractedEntities": ["Person", "Email"],
    "confidence": 0.88
  }
}
```

---

### Batch Processing
**POST** `/process/batch`

Process multiple jobs in batch.

#### Headers
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

#### Form Data
- `files`: Array of files (max 20)
- `jobs`: JSON configuration for batch jobs

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Processed 3 jobs",
  "data": [
    {
      "job": 1,
      "success": true,
      "filledFields": 5,
      "confidence": 0.94,
      "errors": []
    }
  ]
}
```

---

## Error Responses

### Common Error Format
```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

### HTTP Status Codes
- **200** - Success
- **201** - Created
- **400** - Bad Request
- **401** - Unauthorized
- **403** - Forbidden
- **404** - Not Found
- **409** - Conflict
- **423** - Locked
- **429** - Too Many Requests
- **500** - Internal Server Error

### Authentication Errors
- **401** - Invalid or expired token
- **401** - Authentication required
- **403** - Account deactivated
- **423** - Account locked

### Validation Errors
- **400** - Missing required fields
- **400** - Invalid email format
- **400** - Password requirements not met
- **409** - User already exists

---

## Security Features

### Rate Limiting
- **General API**: 100 requests per 15 minutes
- **Authentication**: 5 attempts per 15 minutes
- **Registration**: 3 attempts per hour
- **File Upload**: 20 uploads per hour

### Account Security
- **Password Requirements**: 8+ chars, uppercase, lowercase, number
- **Account Locking**: 5 failed attempts = 30 minute lockout
- **Token Expiration**: Access tokens expire in 15 minutes
- **Refresh Tokens**: Expire in 7 days, single use

### File Security
- **File Size Limit**: 10MB per file
- **Supported Types**: PDF, DOCX, DOC, TXT, CSV
- **Upload Path**: Configurable, outside web root

---

## Environment Variables

### Required
```env
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
DATABASE_URL=postgresql://user:password@localhost:5432/database
```

### Optional
```env
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=30
USE_REFRESH_TOKEN_COOKIE=true
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

---

## SDK Examples

### JavaScript/Node.js
```javascript
const API_BASE_URL = 'http://localhost:3000/api';

class QuikAdminAPI {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
  }

  async register(userData) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    const data = await response.json();
    if (data.success) {
      this.accessToken = data.data.tokens.accessToken;
      this.refreshToken = data.data.tokens.refreshToken;
    }
    return data;
  }

  async login(email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    if (data.success) {
      this.accessToken = data.data.tokens.accessToken;
      this.refreshToken = data.data.tokens.refreshToken;
    }
    return data;
  }

  async processSingle(documentFile, formFile) {
    const formData = new FormData();
    formData.append('document', documentFile);
    formData.append('form', formFile);

    const response = await fetch(`${API_BASE_URL}/process/single`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      },
      body: formData
    });

    return await response.json();
  }
}
```

### Python
```python
import requests

class QuikAdminAPI:
    def __init__(self, base_url='http://localhost:3000/api'):
        self.base_url = base_url
        self.access_token = None
        self.refresh_token = None
    
    def register(self, user_data):
        response = requests.post(f'{self.base_url}/auth/register', json=user_data)
        data = response.json()
        
        if data.get('success'):
            self.access_token = data['data']['tokens']['accessToken']
            self.refresh_token = data['data']['tokens']['refreshToken']
        
        return data
    
    def login(self, email, password):
        response = requests.post(f'{self.base_url}/auth/login', json={
            'email': email,
            'password': password
        })
        data = response.json()
        
        if data.get('success'):
            self.access_token = data['data']['tokens']['accessToken']
            self.refresh_token = data['data']['tokens']['refreshToken']
        
        return data
    
    def process_single(self, document_path, form_path):
        with open(document_path, 'rb') as doc_file, open(form_path, 'rb') as form_file:
            files = {
                'document': doc_file,
                'form': form_file
            }
            headers = {'Authorization': f'Bearer {self.access_token}'}
            
            response = requests.post(f'{self.base_url}/process/single', 
                                   files=files, headers=headers)
            return response.json()
```

---

## Testing

### Running Tests
```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# Watch mode
npm run test:watch
```

### Test Coverage
- Authentication Service: 95%+
- API Endpoints: 90%+
- Integration Tests: All major flows
- Rate Limiting: All endpoints
- Security: Token validation, password hashing

---

## Migration Guide

### Database Setup
1. Run the initial migration:
   ```sql
   psql -U username -d database -f scripts/init.sql
   ```

2. Run the authentication migration:
   ```sql
   psql -U username -d database -f scripts/auth-migration.sql
   ```

### Environment Setup
1. Copy `.env.example` to `.env`
2. Update database credentials
3. Generate secure JWT secrets:
   ```bash
   openssl rand -base64 32
   ```

### Existing User Migration
If you have existing users without proper password hashing, run:
```sql
UPDATE users SET password_hash = crypt(password_hash, gen_salt('bf')) WHERE password_hash NOT LIKE '$2%';
```

---

## Support

- **GitHub Issues**: For bug reports and feature requests
- **Documentation**: This file and inline code comments
- **API Health**: Check `/health` endpoint for system status
- **Logs**: Check application logs for detailed error information