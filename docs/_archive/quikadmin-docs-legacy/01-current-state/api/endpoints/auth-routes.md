# Authentication API Reference

**Status:** Phase 3 SDK Migration Complete
**Last Updated:** 2025-10-25

## Overview

QuikAdmin provides two authentication systems during the Phase 3-5 SDK migration period:

1. **Supabase Auth (Recommended)** - New auth system using Supabase Auth SDK
2. **Legacy JWT Auth** - Custom JWT implementation (being phased out)

All new integrations should use **Supabase Auth endpoints** (v2).

---

## Base URLs

| System        | Base URL       | Status        |
| ------------- | -------------- | ------------- |
| Supabase Auth | `/api/auth/v2` | ✅ Preferred  |
| Legacy JWT    | `/api/auth`    | ⚠️ Deprecated |

---

## Supabase Auth Endpoints (v2)

### POST /api/auth/v2/register

Create a new user account using Supabase Auth.

**Request:**

```http
POST /api/auth/v2/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "fullName": "John Doe",
  "role": "user"
}
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email address |
| `password` | string | Yes | Min 8 chars, uppercase, lowercase, number |
| `fullName` | string | Yes | User's full name |
| `role` | string | No | `user` or `admin` (default: `user`) |

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user",
      "emailVerified": false
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "v1.MR_N3vu_IW3oZpdjNjYdEA...",
      "expiresIn": 3600,
      "tokenType": "Bearer"
    }
  }
}
```

**Error Responses:**

`400 Bad Request` - Validation error

```json
{
  "error": "Email, password, and full name are required",
  "details": {
    "email": null,
    "password": "Password is required",
    "fullName": null
  }
}
```

`409 Conflict` - User already exists

```json
{
  "error": "User with this email already exists"
}
```

**Rate Limiting:**

- 3 registrations per hour per IP address

**Notes:**

- Email verification required in production (auto-verified in development)
- Password must meet complexity requirements
- User profile created in both Supabase and Prisma databases

---

### POST /api/auth/v2/login

Authenticate user and receive session tokens.

**Request:**

```http
POST /api/auth/v2/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User's email address |
| `password` | string | Yes | User's password |

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user",
      "emailVerified": true,
      "lastLogin": "2025-10-25T12:34:56.789Z",
      "createdAt": "2025-10-20T10:00:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "v1.MR_N3vu_IW3oZpdjNjYdEA...",
      "expiresIn": 3600,
      "tokenType": "Bearer"
    }
  }
}
```

**Error Responses:**

`400 Bad Request` - Missing fields

```json
{
  "error": "Email and password are required",
  "details": {
    "email": "Email is required",
    "password": null
  }
}
```

`401 Unauthorized` - Invalid credentials

```json
{
  "error": "Invalid email or password"
}
```

`403 Forbidden` - Account deactivated

```json
{
  "error": "Account is deactivated. Please contact support.",
  "code": "ACCOUNT_DEACTIVATED"
}
```

**Rate Limiting:**

- 5 login attempts per 15 minutes per IP address

**Notes:**

- Access token expires in 1 hour
- Refresh token expires in 7 days
- Last login timestamp updated on successful login

---

### POST /api/auth/v2/logout

Log out user and invalidate all sessions globally.

**Request:**

```http
POST /api/auth/v2/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Headers:**
| Header | Value | Required | Description |
|--------|-------|----------|-------------|
| `Authorization` | Bearer `<token>` | Yes | Access token from login |

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Logout successful"
}
```

**Error Responses:**

`401 Unauthorized` - Not authenticated

```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid Authorization header"
}
```

**Notes:**

- Logout is idempotent - always returns success
- Invalidates all sessions globally (all devices)
- Frontend should clear stored tokens

---

### POST /api/auth/v2/refresh

Refresh access token using refresh token.

**Request:**

```http
POST /api/auth/v2/refresh
Content-Type: application/json

{
  "refreshToken": "v1.MR_N3vu_IW3oZpdjNjYdEA..."
}
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `refreshToken` | string | Yes | Refresh token from login/register |

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "v1.NEW_REFRESH_TOKEN...",
      "expiresIn": 3600,
      "tokenType": "Bearer"
    }
  }
}
```

**Error Responses:**

`400 Bad Request` - Missing refresh token

```json
{
  "error": "Refresh token is required"
}
```

`401 Unauthorized` - Invalid or expired token

```json
{
  "error": "Invalid or expired refresh token"
}
```

**Notes:**

- Returns new access token AND new refresh token
- Old refresh token is invalidated
- Last login timestamp updated

---

### GET /api/auth/v2/me

Get current authenticated user profile.

**Request:**

```http
GET /api/auth/v2/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Headers:**
| Header | Value | Required | Description |
|--------|-------|----------|-------------|
| `Authorization` | Bearer `<token>` | Yes | Access token from login |

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
      "email": "user@example.com",
      "full_name": "John Doe",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user",
      "is_active": true,
      "email_verified": true,
      "created_at": "2025-10-20T10:00:00.000Z",
      "updated_at": "2025-10-25T12:34:56.789Z",
      "last_login": "2025-10-25T12:34:56.789Z",
      "supabase_user_id": "a1b2c3d4-e5f6-7890-1234-567890abcdef"
    }
  }
}
```

**Error Responses:**

`401 Unauthorized` - Not authenticated

```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

`404 Not Found` - User not found in database

```json
{
  "error": "User not found"
}
```

**Notes:**

- Requires valid access token
- Returns user data from Prisma database
- Email verification status from Supabase

---

### POST /api/auth/v2/change-password

Change user password.

**Request:**

```http
POST /api/auth/v2/change-password
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "currentPassword": "OldPass123!",
  "newPassword": "NewSecurePass456!"
}
```

**Request Headers:**
| Header | Value | Required | Description |
|--------|-------|----------|-------------|
| `Authorization` | Bearer `<token>` | Yes | Access token from login |

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `currentPassword` | string | Yes | Current password for verification |
| `newPassword` | string | Yes | New password (min 8 chars, complexity required) |

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Password changed successfully. Please login again with your new password."
}
```

**Error Responses:**

`400 Bad Request` - Validation error

```json
{
  "error": "Current password and new password are required",
  "details": {
    "currentPassword": null,
    "newPassword": "New password is required"
  }
}
```

`400 Bad Request` - Incorrect current password

```json
{
  "error": "Current password is incorrect"
}
```

`401 Unauthorized` - Not authenticated

```json
{
  "error": "Authentication required"
}
```

**Notes:**

- Requires valid access token
- Current password must be correct
- New password must meet complexity requirements
- All sessions invalidated after password change (security best practice)
- User must login again with new password

---

## Token Information

### Access Token

- **Type:** JWT (JSON Web Token)
- **Algorithm:** RS256 (Supabase) or HS256 (Legacy)
- **Expiration:** 1 hour
- **Storage:** Memory or secure httpOnly cookie (frontend)
- **Usage:** Include in `Authorization: Bearer <token>` header

### Refresh Token

- **Type:** Opaque token
- **Expiration:** 7 days
- **Storage:** Secure httpOnly cookie (recommended) or secure storage
- **Usage:** POST to `/api/auth/v2/refresh` to get new access token
- **Security:** Automatically rotated on refresh

---

## Authentication Flow

### Initial Login Flow

```
1. User submits email/password
   └─> POST /api/auth/v2/login

2. Backend verifies credentials with Supabase
   └─> Supabase validates password

3. Backend loads user profile from Prisma
   └─> Checks isActive status
   └─> Updates lastLogin timestamp

4. Backend returns tokens + user data
   └─> Frontend stores tokens securely

5. Frontend uses access token for API calls
   └─> Include in Authorization header
```

### Token Refresh Flow

```
1. Access token expires (after 1 hour)
   └─> API returns 401 Unauthorized

2. Frontend detects 401 error
   └─> POST /api/auth/v2/refresh with refreshToken

3. Backend validates refresh token with Supabase
   └─> Issues new access token + new refresh token

4. Frontend receives new tokens
   └─> Stores new tokens
   └─> Retries original request with new access token
```

### Logout Flow

```
1. User clicks logout
   └─> POST /api/auth/v2/logout with access token

2. Backend invalidates all sessions in Supabase
   └─> Global sign out (all devices)

3. Frontend clears stored tokens
   └─> Redirects to login page
```

---

## Error Codes Reference

| HTTP Status | Error Code            | Description          | Action               |
| ----------- | --------------------- | -------------------- | -------------------- |
| 400         | -                     | Validation error     | Check request body   |
| 401         | `TOKEN_EXPIRED`       | Access token expired | Refresh token        |
| 401         | -                     | Invalid credentials  | Re-enter credentials |
| 403         | `ACCOUNT_DEACTIVATED` | Account disabled     | Contact support      |
| 409         | -                     | User already exists  | Use different email  |
| 429         | -                     | Rate limit exceeded  | Wait and retry       |
| 500         | -                     | Server error         | Contact support      |

---

## Migration Notes

### Legacy Endpoints (Deprecated)

These endpoints are being phased out:

- `POST /api/auth/register` → Use `POST /api/auth/v2/register`
- `POST /api/auth/login` → Use `POST /api/auth/v2/login`
- `POST /api/auth/refresh` → Use `POST /api/auth/v2/refresh`
- `POST /api/auth/logout` → Use `POST /api/auth/v2/logout`
- `GET /api/auth/me` → Use `GET /api/auth/v2/me`
- `POST /api/auth/change-password` → Use `POST /api/auth/v2/change-password`

### Migration Timeline

- **Phase 3** (Current): Both systems active, v2 preferred
- **Phase 4-5**: Gradual user migration to Supabase
- **Phase 6**: Legacy endpoints removed

---

## Security Best Practices

### Client-Side

1. **Store access token** in memory or sessionStorage
2. **Store refresh token** in secure httpOnly cookie
3. **Never** expose tokens in URLs or localStorage
4. **Always** use HTTPS in production
5. **Clear tokens** on logout

### Server-Side

1. **Verify tokens** on every protected endpoint
2. **Use Supabase getUser()** for token verification (not getSession())
3. **Check user.isActive** status
4. **Rate limit** auth endpoints
5. **Log** authentication failures

---

## Code Examples

### JavaScript/TypeScript (Fetch API)

**Register:**

```typescript
const response = await fetch('https://api.quikadmin.com/api/auth/v2/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!',
    fullName: 'John Doe',
  }),
});

const data = await response.json();
if (data.success) {
  // Store tokens securely
  localStorage.setItem('accessToken', data.data.tokens.accessToken);
  // Store refresh token in httpOnly cookie (server-side)
}
```

**Login:**

```typescript
const response = await fetch('https://api.quikadmin.com/api/auth/v2/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!',
  }),
});

const data = await response.json();
```

**Authenticated Request:**

```typescript
const accessToken = localStorage.getItem('accessToken');

const response = await fetch('https://api.quikadmin.com/api/auth/v2/me', {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

**Refresh Token:**

```typescript
const refreshToken = getRefreshToken(); // From secure storage

const response = await fetch('https://api.quikadmin.com/api/auth/v2/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken }),
});

const data = await response.json();
if (data.success) {
  localStorage.setItem('accessToken', data.data.tokens.accessToken);
  storeRefreshToken(data.data.tokens.refreshToken);
}
```

### cURL

**Register:**

```bash
curl -X POST https://api.quikadmin.com/api/auth/v2/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "fullName": "John Doe"
  }'
```

**Login:**

```bash
curl -X POST https://api.quikadmin.com/api/auth/v2/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

**Get Profile:**

```bash
curl -X GET https://api.quikadmin.com/api/auth/v2/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Support

For questions or issues:

- **Documentation:** [Authentication Guide](./301-authentication.md)
- **Middleware Guide:** [Supabase Middleware](./303-supabase-middleware.md)
- **Migration Plan:** [../SUPABASE_AUTH_MIGRATION_PLAN.md](../SUPABASE_AUTH_MIGRATION_PLAN.md)

---

**Last Updated:** 2025-10-25
**Version:** 3.0 (Supabase Auth)
**Status:** Production Ready
