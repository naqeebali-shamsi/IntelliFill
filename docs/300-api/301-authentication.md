# Authentication API Reference

**Last Updated:** 2025-10-25
**Status:** Phase 3 SDK Migration - Dual Auth Active
**API Version:** 2.0.0 (Supabase) + 1.0.0 (Legacy)

---

## 🚀 MIGRATION NOTICE

QuikAdmin is migrating to **Supabase Auth** for improved security and features. During Phase 3-5, both authentication systems are active:

| System | Base URL | Status | Recommendation |
|--------|----------|--------|----------------|
| **Supabase Auth (v2)** | `/api/auth/v2` | ✅ **Preferred** | Use for new integrations |
| **Legacy JWT** | `/api/auth` | ⚠️ **Deprecated** | Existing users only |

**New users:** Please use **Supabase Auth v2 endpoints** documented in [Auth Routes Reference](./304-auth-routes-reference.md).

**Migration Timeline:**
- **Phase 3** (Current): Both systems active
- **Phase 4-5**: User migration to Supabase
- **Phase 6**: Legacy system removed

---

## Quick Start

### For New Applications (Supabase Auth v2)

```javascript
// Register
const response = await fetch('/api/auth/v2/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!',
    fullName: 'John Doe'
  })
});

const { tokens, user } = response.data.data;
```

**See:** [Supabase Auth Routes Reference](./304-auth-routes-reference.md) for complete v2 documentation.

---

## Overview (Legacy System)

The Legacy Authentication API uses custom JWT (JSON Web Tokens) with secure HS256 algorithm enforcement.

**Note:** This system is being phased out. New integrations should use Supabase Auth v2.

**Security Features:**
- 15-minute access token expiry (reduced from 1h for security)
- 7-day refresh token expiry
- bcrypt password hashing (12 rounds)
- Algorithm confusion attack prevention
- Entropy-validated secrets (256+ bits)

## Authentication Flow

```
1. Register/Login → Receive access token + refresh token
2. Use access token for API requests (Bearer token)
3. When access token expires (15min) → Use refresh token to get new access token
4. When refresh token expires (7 days) → Re-login required
```

## Rate Limiting

| Endpoint Type | Limit | Window | HTTP Header |
|--------------|-------|--------|-------------|
| Login/Register | 5 requests | 15 minutes | `X-RateLimit-Limit: 5` |
| Registration | 3 requests | 1 hour | `X-RateLimit-Limit: 3` |
| Other auth endpoints | 100 requests | 15 minutes | `X-RateLimit-Limit: 100` |

**Rate limit headers in response:**
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1704883200000
```

---

## Endpoints

### POST /api/auth/register

Register a new user account.

**Request:**

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123!",
  "fullName": "John Doe",
  "role": "user"  // optional: "user" or "admin", defaults to "user"
}
```

**Request Body Parameters:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `email` | string | Yes | Valid email format | User's email address (lowercase) |
| `password` | string | Yes | Min 8 chars, 1 uppercase, 1 lowercase, 1 number | User's password |
| `fullName` | string | Yes | Non-empty | User's full name (split into first/last) |
| `role` | string | No | "user" or "admin" | User role (default: "user") |

**Response (201 Created):**

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "USER",
      "isActive": true,
      "emailVerified": false,
      "createdAt": "2025-01-10T12:00:00.000Z",
      "updatedAt": "2025-01-10T12:00:00.000Z"
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

**Error Responses:**

| Status | Error | Cause | Solution |
|--------|-------|-------|----------|
| 400 | "Email and password required" | Missing fields | Provide all required fields |
| 400 | "Invalid email format" | Email validation failed | Use valid email address |
| 400 | "Password must be at least 8 characters..." | Weak password | Use stronger password |
| 409 | "User with this email already exists" | Duplicate email | Login or use different email |
| 429 | "Too many registration attempts" | Rate limit exceeded | Wait 1 hour |

**cURL Example:**

```bash
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "fullName": "John Doe"
  }'
```

**JavaScript Example:**

```javascript
const response = await fetch('http://localhost:3002/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!',
    fullName: 'John Doe'
  })
});

const data = await response.json();
const accessToken = data.data.tokens.accessToken;
```

---

### POST /api/auth/login

Authenticate user and receive tokens.

**Request:**

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123!"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "USER",
      "isActive": true,
      "lastLogin": "2025-01-10T12:00:00.000Z"
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

**Error Responses:**

| Status | Error | Cause | Solution |
|--------|-------|-------|----------|
| 400 | "Email and password required" | Missing fields | Provide credentials |
| 401 | "Invalid email or password" | Wrong credentials | Check email/password |
| 403 | "Account is deactivated" | Account inactive | Contact support |
| 429 | "Too many authentication attempts" | Rate limit exceeded | Wait 15 minutes |

**cURL Example:**

```bash
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123!"}'
```

---

### POST /api/auth/refresh

Refresh access token using refresh token.

**Request:**

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900,
      "tokenType": "Bearer"
    }
  }
}
```

**Error Responses:**

| Status | Error | Cause | Solution |
|--------|-------|-------|----------|
| 400 | "Refresh token is required" | Missing token | Provide refresh token |
| 401 | "Invalid or expired refresh token" | Token invalid/expired | Login again |

**cURL Example:**

```bash
curl -X POST http://localhost:3002/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
```

**Usage Pattern:**

```javascript
// Store tokens
let accessToken = loginResponse.data.tokens.accessToken;
let refreshToken = loginResponse.data.tokens.refreshToken;

// When API call fails with 401
try {
  const response = await fetch('/api/documents', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
} catch (error) {
  if (error.status === 401) {
    // Refresh token
    const refreshResponse = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    const newTokens = refreshResponse.data.data.tokens;
    accessToken = newTokens.accessToken;
    refreshToken = newTokens.refreshToken;

    // Retry original request with new token
  }
}
```

---

### POST /api/auth/logout

Logout from current device by revoking refresh token.

**Request:**

```http
POST /api/auth/logout
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Logout successful"
}
```

**Note:** Even if logout fails server-side, returns success to prevent client issues. Access token remains valid until expiry (max 15 minutes).

**cURL Example:**

```bash
curl -X POST http://localhost:3002/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
```

---

### POST /api/auth/logout-all

Logout from all devices by revoking all refresh tokens.

**Request:**

```http
POST /api/auth/logout-all
Authorization: Bearer <accessToken>
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Logged out from all devices successfully"
}
```

**Use Case:** When user changes password or suspects account compromise.

**cURL Example:**

```bash
curl -X POST http://localhost:3002/api/auth/logout-all \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### GET /api/auth/me

Get current user profile.

**Request:**

```http
GET /api/auth/me
Authorization: Bearer <accessToken>
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "full_name": "John Doe",
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

**Error Responses:**

| Status | Error | Cause | Solution |
|--------|-------|-------|----------|
| 401 | "Authentication required" | No token provided | Include Authorization header |
| 401 | "Token expired" | Access token expired | Use refresh token to get new access token |
| 404 | "User not found" | User deleted | Re-register |

**cURL Example:**

```bash
curl -X GET http://localhost:3002/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### POST /api/auth/change-password

Change user password.

**Request:**

```http
POST /api/auth/change-password
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Password changed successfully. Please login again with your new password."
}
```

**Important:** After password change, all refresh tokens are revoked (automatic logout from all devices). User must login again.

**Error Responses:**

| Status | Error | Cause | Solution |
|--------|-------|-------|----------|
| 400 | "Current password and new password are required" | Missing fields | Provide both passwords |
| 400 | "Current password is incorrect" | Wrong current password | Verify current password |
| 400 | "Password must be at least 8 characters..." | Weak new password | Use stronger password |

**cURL Example:**

```bash
curl -X POST http://localhost:3002/api/auth/change-password \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "OldPassword123!",
    "newPassword": "NewSecurePassword123!"
  }'
```

---

### POST /api/auth/verify-token

Verify if a token is valid (for debugging).

**Request:**

```http
POST /api/auth/verify-token
Content-Type: application/json

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "payload": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "role": "user",
      "iat": 1704883200,
      "exp": 1704884100,
      "iss": "quikadmin-api",
      "aud": "quikadmin-client"
    }
  }
}
```

**Error Response (401 Unauthorized):**

```json
{
  "success": false,
  "error": "Invalid or expired token"
}
```

---

## Token Structure

### Access Token Payload

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "role": "USER",
  "iat": 1704883200,
  "exp": 1704884100,
  "iss": "quikadmin-api",
  "aud": "quikadmin-client",
  "alg": "HS256",
  "jti": "unique-token-id"
}
```

**Claims:**
- `id` - User ID (UUID)
- `email` - User email
- `role` - User role (USER, ADMIN, VIEWER)
- `iat` - Issued at timestamp
- `exp` - Expiration timestamp (15 minutes from iat)
- `iss` - Issuer (quikadmin-api)
- `aud` - Audience (quikadmin-client)
- `jti` - JWT ID (unique identifier for replay attack prevention)

### Token Security

**Algorithm Enforcement:**
- Only HS256 is accepted
- 'none' algorithm explicitly rejected
- Algorithm confusion attacks prevented
- Token header validated before verification

**Secret Requirements:**
- Minimum 64 characters
- Minimum 256 bits entropy
- Validated on startup (fail-fast)

---

## Common Authentication Patterns

### 1. Registration + Login Flow

```javascript
// 1. Register
const registerResponse = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'Password123!',
    fullName: 'John Doe'
  })
});

const { accessToken, refreshToken } = registerResponse.data.data.tokens;

// Store tokens securely
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);

// 2. Use access token for API calls
const documentsResponse = await fetch('/api/documents', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### 2. Automatic Token Refresh

```javascript
async function apiCall(url, options = {}) {
  // Add access token to request
  options.headers = {
    ...options.headers,
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  };

  let response = await fetch(url, options);

  // If token expired, refresh and retry
  if (response.status === 401) {
    const refreshResponse = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: localStorage.getItem('refreshToken')
      })
    });

    if (refreshResponse.ok) {
      const newTokens = refreshResponse.data.data.tokens;
      localStorage.setItem('accessToken', newTokens.accessToken);
      localStorage.setItem('refreshToken', newTokens.refreshToken);

      // Retry original request with new token
      options.headers['Authorization'] = `Bearer ${newTokens.accessToken}`;
      response = await fetch(url, options);
    } else {
      // Refresh failed - redirect to login
      window.location.href = '/login';
    }
  }

  return response;
}
```

### 3. Secure Logout

```javascript
async function logout() {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');

  // Call logout endpoint
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refreshToken })
  });

  // Clear local storage
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');

  // Redirect to login
  window.location.href = '/login';
}
```

---

## Error Code Reference

| Code | HTTP Status | Meaning | Action |
|------|-------------|---------|--------|
| `TOKEN_EXPIRED` | 401 | Access token expired | Use refresh token |
| `ACCOUNT_DEACTIVATED` | 403 | Account inactive/deleted | Contact support |
| `ALGORITHM_VIOLATION` | 401 | Token uses wrong algorithm | Regenerate token (security) |
| `INVALID_SIGNATURE` | 401 | Token signature invalid | Login again |
| `AUTHENTICATION_FAILED` | 401 | General auth failure | Verify credentials |

---

## Security Best Practices

1. **Always use HTTPS in production** - Tokens transmitted in plaintext over HTTP are vulnerable
2. **Store tokens securely** - Use httpOnly cookies or secure localStorage (not regular cookies)
3. **Implement token refresh** - Don't ask users to re-login every 15 minutes
4. **Logout on password change** - Revoke all refresh tokens (already implemented)
5. **Validate tokens server-side** - Never trust client-side validation alone
6. **Use strong passwords** - Enforce password complexity requirements
7. **Rate limit endpoints** - Prevent brute-force attacks (already implemented)
8. **Monitor suspicious activity** - Log failed authentication attempts

---

## Related Documentation

- [Security Architecture](../200-architecture/204-security-architecture.md) - JWT security implementation details
- [Troubleshooting](../400-guides/407-troubleshooting.md) - Common authentication issues
- [Your First Document](../100-getting-started/104-first-document.md) - Tutorial using authentication

---

**Questions?** Check [CURRENT_ARCHITECTURE.md](../CURRENT_ARCHITECTURE.md) for authentication service implementation details.
