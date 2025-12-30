---
title: 'Authentication API Reference'
id: 'api-authentication'
version: '2.0.0'
last_updated: '2025-01-11'
created: '2025-01-11'
status: 'active'
phase: 'current'
maintainer: 'team'
depends_on: []
related_to:
  - 'arch-auth-flow'
  - 'arch-security'
  - 'guide-implementing-auth'
ai_priority: 'high'
ai_context_level: 'reference'
ai_required_reading: false
ai_auto_update: true
category: 'api'
tags:
  - 'api'
  - 'authentication'
  - 'endpoints'
  - 'jwt'
  - 'supabase'
  - 'rest'
audience:
  - 'developers'
  - 'ai-agents'
verified_against_code: '2025-01-11'
code_references:
  - 'src/api/auth.routes.ts'
  - 'src/services/PrismaAuthService.ts'
---

# Authentication API Reference

**API Version:** 2.0.0 (Supabase) + 1.0.0 (Legacy)
**Last Updated:** 2025-01-11
**Status:** Phase 3 SDK Migration - Dual Auth Active

---

## Table of Contents

- [Overview](#overview)
- [Base URLs](#base-urls)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Supabase Auth Endpoints (v2)](#supabase-auth-endpoints-v2)
- [Legacy JWT Endpoints (v1)](#legacy-jwt-endpoints-v1)
- [Token Information](#token-information)
- [Error Codes Reference](#error-codes-reference)
- [Code Examples](#code-examples)

---

## Overview

QuikAdmin provides two authentication systems during the migration phase:

| System                 | Base URL       | Status            | Recommendation           |
| ---------------------- | -------------- | ----------------- | ------------------------ |
| **Supabase Auth (v2)** | `/api/auth/v2` | ✅ **Preferred**  | Use for new integrations |
| **Legacy JWT**         | `/api/auth`    | ⚠️ **Deprecated** | Existing users only      |

**Migration Timeline:**

- **Phase 3** (Current): Both systems active
- **Phase 4-5**: User migration to Supabase
- **Phase 6**: Legacy system removed

For architecture and conceptual understanding, see [Authentication Flow Architecture](../../architecture/current/auth-flow.md).

---

## Base URLs

| Environment     | URL                                 |
| --------------- | ----------------------------------- |
| **Development** | `http://localhost:3002`             |
| **Staging**     | `https://staging-api.quikadmin.com` |
| **Production**  | `https://api.quikadmin.com`         |

**Example:**

```
https://api.quikadmin.com/api/auth/v2/login
```

---

## Authentication

All protected endpoints require authentication via the `Authorization` header:

```http
Authorization: Bearer <access_token>
```

**Example:**

```http
GET /api/documents HTTP/1.1
Host: api.quikadmin.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

---

## Rate Limiting

Rate limits protect against abuse and brute-force attacks.

### Rate Limit Configuration

| Endpoint Type            | Limit        | Window     | HTTP Status on Exceeded |
| ------------------------ | ------------ | ---------- | ----------------------- |
| **Login endpoints**      | 5 requests   | 15 minutes | 429 Too Many Requests   |
| **Registration**         | 3 requests   | 1 hour     | 429 Too Many Requests   |
| **Other auth endpoints** | 100 requests | 15 minutes | 429 Too Many Requests   |

### Rate Limit Headers

Every response includes rate limit information:

```http
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1704883200000
```

**Headers:**

- `X-RateLimit-Limit` - Maximum requests allowed in window
- `X-RateLimit-Remaining` - Requests remaining in current window
- `X-RateLimit-Reset` - Timestamp when limit resets (Unix milliseconds)

### Rate Limit Exceeded Response

```json
{
  "error": "Too many requests",
  "message": "Too many authentication attempts. Please try again later.",
  "retryAfter": 900
}
```

---

## Supabase Auth Endpoints (v2)

### POST /api/auth/v2/register

Create a new user account using Supabase Auth.

**Endpoint:**

```
POST /api/auth/v2/register
```

**Request Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "fullName": "John Doe",
  "role": "user"
}
```

**Parameters:**

| Field      | Type   | Required | Validation                                      | Description                                              |
| ---------- | ------ | -------- | ----------------------------------------------- | -------------------------------------------------------- |
| `email`    | string | Yes      | Valid email format                              | User's email address                                     |
| `password` | string | Yes      | Min 8 chars, 1 uppercase, 1 lowercase, 1 number | User's password                                          |
| `fullName` | string | Yes      | Non-empty                                       | User's full name (will be split into firstName/lastName) |
| `role`     | string | No       | `user` or `admin`                               | User role (default: `user`)                              |

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
      "emailVerified": false,
      "isActive": true,
      "createdAt": "2025-01-11T12:00:00.000Z",
      "updatedAt": "2025-01-11T12:00:00.000Z"
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

| Status                    | Error          | Example Response                                                                                         |
| ------------------------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| **400 Bad Request**       | Missing fields | `{"error": "Email, password, and full name are required"}`                                               |
| **400 Bad Request**       | Invalid email  | `{"error": "Invalid email format"}`                                                                      |
| **400 Bad Request**       | Weak password  | `{"error": "Password must contain at least one uppercase letter, one lowercase letter, and one number"}` |
| **409 Conflict**          | User exists    | `{"error": "User with this email already exists"}`                                                       |
| **429 Too Many Requests** | Rate limit     | `{"error": "Too many registration attempts. Please try again later."}`                                   |

**cURL Example:**

```bash
curl -X POST https://api.quikadmin.com/api/auth/v2/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "fullName": "John Doe"
  }'
```

---

### POST /api/auth/v2/login

Authenticate user and receive session tokens.

**Endpoint:**

```
POST /api/auth/v2/login
```

**Request Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Parameters:**

| Field      | Type   | Required | Description          |
| ---------- | ------ | -------- | -------------------- |
| `email`    | string | Yes      | User's email address |
| `password` | string | Yes      | User's password      |

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
      "lastLogin": "2025-01-11T12:34:56.789Z",
      "createdAt": "2025-01-10T10:00:00.000Z"
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

| Status                    | Error               | Example Response                                                                              |
| ------------------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| **400 Bad Request**       | Missing fields      | `{"error": "Email and password are required"}`                                                |
| **401 Unauthorized**      | Invalid credentials | `{"error": "Invalid email or password"}`                                                      |
| **403 Forbidden**         | Account deactivated | `{"error": "Account is deactivated. Please contact support.", "code": "ACCOUNT_DEACTIVATED"}` |
| **429 Too Many Requests** | Rate limit          | `{"error": "Too many authentication attempts. Please try again later."}`                      |

**cURL Example:**

```bash
curl -X POST https://api.quikadmin.com/api/auth/v2/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

---

### POST /api/auth/v2/logout

Log out user and invalidate all sessions globally.

**Endpoint:**

```
POST /api/auth/v2/logout
```

**Request Headers:**

```
Authorization: Bearer <access_token>
```

**Request Body:**

```
None
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Logout successful"
}
```

**Error Responses:**

| Status               | Error             | Example Response                                                                  |
| -------------------- | ----------------- | --------------------------------------------------------------------------------- |
| **401 Unauthorized** | Not authenticated | `{"error": "Unauthorized", "message": "Missing or invalid Authorization header"}` |

**Notes:**

- Logout is idempotent - always returns success
- Invalidates all sessions globally (all devices)
- Frontend should clear stored tokens after logout

**cURL Example:**

```bash
curl -X POST https://api.quikadmin.com/api/auth/v2/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### POST /api/auth/v2/refresh

Refresh access token using refresh token.

**Endpoint:**

```
POST /api/auth/v2/refresh
```

**Request Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
  "refreshToken": "v1.MR_N3vu_IW3oZpdjNjYdEA..."
}
```

**Parameters:**

| Field          | Type   | Required | Description                                |
| -------------- | ------ | -------- | ------------------------------------------ |
| `refreshToken` | string | Yes      | Refresh token from login/register response |

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

| Status               | Error         | Example Response                                |
| -------------------- | ------------- | ----------------------------------------------- |
| **400 Bad Request**  | Missing token | `{"error": "Refresh token is required"}`        |
| **401 Unauthorized** | Invalid token | `{"error": "Invalid or expired refresh token"}` |

**Notes:**

- Returns **new access token AND new refresh token**
- Old refresh token is invalidated (token rotation for security)
- Last login timestamp is updated

**cURL Example:**

```bash
curl -X POST https://api.quikadmin.com/api/auth/v2/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "v1.MR_N3vu_IW3oZpdjNjYdEA..."}'
```

---

### GET /api/auth/v2/me

Get current authenticated user profile.

**Endpoint:**

```
GET /api/auth/v2/me
```

**Request Headers:**

```
Authorization: Bearer <access_token>
```

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
      "created_at": "2025-01-10T10:00:00.000Z",
      "updated_at": "2025-01-11T12:34:56.789Z",
      "last_login": "2025-01-11T12:34:56.789Z",
      "supabase_user_id": "a1b2c3d4-e5f6-7890-1234-567890abcdef"
    }
  }
}
```

**Error Responses:**

| Status               | Error             | Example Response                                                   |
| -------------------- | ----------------- | ------------------------------------------------------------------ |
| **401 Unauthorized** | Not authenticated | `{"error": "Unauthorized", "message": "Invalid or expired token"}` |
| **404 Not Found**    | User not found    | `{"error": "User not found"}`                                      |

**cURL Example:**

```bash
curl -X GET https://api.quikadmin.com/api/auth/v2/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### POST /api/auth/v2/change-password

Change user password.

**Endpoint:**

```
POST /api/auth/v2/change-password
```

**Request Headers:**

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewSecurePass456!"
}
```

**Parameters:**

| Field             | Type   | Required | Description                                     |
| ----------------- | ------ | -------- | ----------------------------------------------- |
| `currentPassword` | string | Yes      | Current password for verification               |
| `newPassword`     | string | Yes      | New password (min 8 chars, complexity required) |

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Password changed successfully. Please login again with your new password."
}
```

**Error Responses:**

| Status               | Error              | Example Response                                              |
| -------------------- | ------------------ | ------------------------------------------------------------- |
| **400 Bad Request**  | Missing fields     | `{"error": "Current password and new password are required"}` |
| **400 Bad Request**  | Incorrect password | `{"error": "Current password is incorrect"}`                  |
| **400 Bad Request**  | Weak password      | `{"error": "Password must be at least 8 characters long"}`    |
| **401 Unauthorized** | Not authenticated  | `{"error": "Authentication required"}`                        |

**Important:**

- All sessions are invalidated after password change (security best practice)
- User must login again with new password
- Current password must be verified before change

**cURL Example:**

```bash
curl -X POST https://api.quikadmin.com/api/auth/v2/change-password \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "OldPass123!",
    "newPassword": "NewSecurePass456!"
  }'
```

---

## Legacy JWT Endpoints (v1)

### POST /api/auth/register

Register a new user account (Legacy system).

**Endpoint:**

```
POST /api/auth/register
```

**Request Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "Password123!",
  "fullName": "John Doe",
  "role": "user"
}
```

**Parameters:**

| Field      | Type   | Required | Validation                                      | Description                              |
| ---------- | ------ | -------- | ----------------------------------------------- | ---------------------------------------- |
| `email`    | string | Yes      | Valid email format                              | User's email address (lowercase)         |
| `password` | string | Yes      | Min 8 chars, 1 uppercase, 1 lowercase, 1 number | User's password                          |
| `fullName` | string | Yes      | Non-empty                                       | User's full name (split into first/last) |
| `role`     | string | No       | "user" or "admin"                               | User role (default: "user")              |

**Success Response (201 Created):**

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
      "createdAt": "2025-01-11T12:00:00.000Z",
      "updatedAt": "2025-01-11T12:00:00.000Z"
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

| Status  | Error                                       | Cause                   | Solution                     |
| ------- | ------------------------------------------- | ----------------------- | ---------------------------- |
| **400** | "Email and password required"               | Missing fields          | Provide all required fields  |
| **400** | "Invalid email format"                      | Email validation failed | Use valid email address      |
| **400** | "Password must be at least 8 characters..." | Weak password           | Use stronger password        |
| **409** | "User with this email already exists"       | Duplicate email         | Login or use different email |
| **429** | "Too many registration attempts"            | Rate limit exceeded     | Wait 1 hour                  |

**cURL Example:**

```bash
curl -X POST https://api.quikadmin.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "fullName": "John Doe"
  }'
```

---

### POST /api/auth/login

Authenticate user and receive tokens (Legacy system).

**Endpoint:**

```
POST /api/auth/login
```

**Request Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```

**Success Response (200 OK):**

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
      "lastLogin": "2025-01-11T12:00:00.000Z"
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

| Status  | Error                              | Cause               | Solution             |
| ------- | ---------------------------------- | ------------------- | -------------------- |
| **400** | "Email and password required"      | Missing fields      | Provide credentials  |
| **401** | "Invalid email or password"        | Wrong credentials   | Check email/password |
| **403** | "Account is deactivated"           | Account inactive    | Contact support      |
| **429** | "Too many authentication attempts" | Rate limit exceeded | Wait 15 minutes      |

**cURL Example:**

```bash
curl -X POST https://api.quikadmin.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123!"}'
```

---

### POST /api/auth/refresh

Refresh access token using refresh token (Legacy system).

**Endpoint:**

```
POST /api/auth/refresh
```

**Request Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200 OK):**

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

| Status  | Error                              | Cause                 | Solution              |
| ------- | ---------------------------------- | --------------------- | --------------------- |
| **400** | "Refresh token is required"        | Missing token         | Provide refresh token |
| **401** | "Invalid or expired refresh token" | Token invalid/expired | Login again           |

**cURL Example:**

```bash
curl -X POST https://api.quikadmin.com/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
```

---

### POST /api/auth/logout

Logout from current device (Legacy system).

**Endpoint:**

```
POST /api/auth/logout
```

**Request Headers:**

```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Logout successful"
}
```

**Note:** Logout is idempotent and always returns success. Access token remains valid until expiry (max 15 minutes).

**cURL Example:**

```bash
curl -X POST https://api.quikadmin.com/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
```

---

### POST /api/auth/logout-all

Logout from all devices (Legacy system).

**Endpoint:**

```
POST /api/auth/logout-all
```

**Request Headers:**

```
Authorization: Bearer <accessToken>
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Logged out from all devices successfully"
}
```

**Use Case:** When user changes password or suspects account compromise.

**cURL Example:**

```bash
curl -X POST https://api.quikadmin.com/api/auth/logout-all \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### GET /api/auth/me

Get current user profile (Legacy system).

**Endpoint:**

```
GET /api/auth/me
```

**Request Headers:**

```
Authorization: Bearer <accessToken>
```

**Success Response (200 OK):**

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

| Status  | Error                     | Cause                | Solution                     |
| ------- | ------------------------- | -------------------- | ---------------------------- |
| **401** | "Authentication required" | No token provided    | Include Authorization header |
| **401** | "Token expired"           | Access token expired | Use refresh token            |
| **404** | "User not found"          | User deleted         | Re-register                  |

**cURL Example:**

```bash
curl -X GET https://api.quikadmin.com/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### POST /api/auth/change-password

Change user password (Legacy system).

**Endpoint:**

```
POST /api/auth/change-password
```

**Request Headers:**

```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request Body:**

```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!"
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Password changed successfully. Please login again with your new password."
}
```

**Important:** After password change, all refresh tokens are revoked. User must login again.

**Error Responses:**

| Status  | Error                                            | Cause                  | Solution                |
| ------- | ------------------------------------------------ | ---------------------- | ----------------------- |
| **400** | "Current password and new password are required" | Missing fields         | Provide both passwords  |
| **400** | "Current password is incorrect"                  | Wrong current password | Verify current password |
| **400** | "Password must be at least 8 characters..."      | Weak new password      | Use stronger password   |

**cURL Example:**

```bash
curl -X POST https://api.quikadmin.com/api/auth/change-password \
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

**Endpoint:**

```
POST /api/auth/verify-token
```

**Request Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200 OK):**

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

## Token Information

### Access Token

#### Supabase (v2)

- **Type:** JWT (JSON Web Token)
- **Algorithm:** RS256 (asymmetric)
- **Expiration:** 1 hour (3600 seconds)
- **Issued by:** Supabase Auth service
- **Usage:** Include in `Authorization: Bearer <token>` header

#### Legacy (v1)

- **Type:** JWT (JSON Web Token)
- **Algorithm:** HS256 (symmetric)
- **Expiration:** 15 minutes (900 seconds)
- **Issued by:** QuikAdmin API
- **Usage:** Include in `Authorization: Bearer <token>` header

### Refresh Token

#### Supabase (v2)

- **Type:** Opaque token
- **Expiration:** 7 days
- **Rotation:** Automatic on refresh
- **Storage:** Server-side only (not exposed to client)

#### Legacy (v1)

- **Type:** JWT
- **Expiration:** 7 days
- **Storage:** PostgreSQL `refresh_tokens` table
- **Rotation:** Manual

### Token Security

**Algorithm Enforcement (Legacy):**

- Only HS256 is accepted
- 'none' algorithm explicitly rejected
- Algorithm confusion attacks prevented
- Token header validated before verification

**Secret Requirements (Legacy):**

- Minimum 64 characters
- Minimum 256 bits entropy
- Validated on startup (fail-fast)

---

## Error Codes Reference

### HTTP Status Codes

| Status                        | Meaning               | Common Scenarios                              |
| ----------------------------- | --------------------- | --------------------------------------------- |
| **200 OK**                    | Success               | Login, logout, token refresh                  |
| **201 Created**               | Resource created      | User registration                             |
| **400 Bad Request**           | Invalid request       | Missing fields, validation errors             |
| **401 Unauthorized**          | Authentication failed | Invalid credentials, expired token            |
| **403 Forbidden**             | Access denied         | Account deactivated, insufficient permissions |
| **404 Not Found**             | Resource not found    | User not found                                |
| **409 Conflict**              | Resource conflict     | Email already exists                          |
| **429 Too Many Requests**     | Rate limit exceeded   | Too many login attempts                       |
| **500 Internal Server Error** | Server error          | Database error, unexpected exception          |

### Application Error Codes

| Code                    | HTTP Status | Meaning                    | Action                      |
| ----------------------- | ----------- | -------------------------- | --------------------------- |
| `TOKEN_EXPIRED`         | 401         | Access token expired       | Use refresh token           |
| `ACCOUNT_DEACTIVATED`   | 403         | Account inactive/deleted   | Contact support             |
| `ALGORITHM_VIOLATION`   | 401         | Token uses wrong algorithm | Regenerate token (security) |
| `INVALID_SIGNATURE`     | 401         | Token signature invalid    | Login again                 |
| `AUTHENTICATION_FAILED` | 401         | General auth failure       | Verify credentials          |

### Error Response Format

```json
{
  "error": "Error title",
  "message": "Detailed error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "error detail"
  }
}
```

---

## Code Examples

### JavaScript/TypeScript (Fetch API)

#### Register

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
  // Store tokens
  const { accessToken, refreshToken } = data.data.tokens;
  localStorage.setItem('accessToken', accessToken);
  // Store refreshToken in httpOnly cookie (server-side)
}
```

#### Login

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

if (data.success) {
  const { accessToken, refreshToken } = data.data.tokens;
  localStorage.setItem('accessToken', accessToken);
}
```

#### Authenticated Request

```typescript
const accessToken = localStorage.getItem('accessToken');

const response = await fetch('https://api.quikadmin.com/api/documents', {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
});

const data = await response.json();
```

#### Automatic Token Refresh

```typescript
async function apiCall(url, options = {}) {
  // Add access token
  options.headers = {
    ...options.headers,
    Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
  };

  let response = await fetch(url, options);

  // If token expired, refresh and retry
  if (response.status === 401) {
    const refreshResponse = await fetch('/api/auth/v2/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: getRefreshToken(),
      }),
    });

    if (refreshResponse.ok) {
      const data = await refreshResponse.json();
      const { accessToken, refreshToken } = data.data.tokens;

      localStorage.setItem('accessToken', accessToken);
      storeRefreshToken(refreshToken);

      // Retry original request
      options.headers['Authorization'] = `Bearer ${accessToken}`;
      response = await fetch(url, options);
    } else {
      // Refresh failed - redirect to login
      window.location.href = '/login';
    }
  }

  return response;
}
```

### cURL Examples

#### Register

```bash
curl -X POST https://api.quikadmin.com/api/auth/v2/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "fullName": "John Doe"
  }'
```

#### Login

```bash
curl -X POST https://api.quikadmin.com/api/auth/v2/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

#### Get Profile

```bash
curl -X GET https://api.quikadmin.com/api/auth/v2/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### Refresh Token

```bash
curl -X POST https://api.quikadmin.com/api/auth/v2/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "v1.MR_N3vu_IW3oZpdjNjYdEA..."}'
```

#### Logout

```bash
curl -X POST https://api.quikadmin.com/api/auth/v2/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Related Documentation

### Architecture & Concepts

- **[Authentication Flow Architecture](../../architecture/current/auth-flow.md)** - Understand how auth works
- **[Security Architecture](../../architecture/204-security-architecture.md)** - Security implementation details

### Implementation Guides

- **[Implementing Authentication](../../guides/developer/implementing-auth.md)** - Step-by-step integration guide
- **[Supabase Setup](../../300-api/302-supabase-setup.md)** - Supabase configuration
- **[Supabase Middleware](../../300-api/303-supabase-middleware.md)** - Middleware usage

---

## Support

For questions or issues:

- **Architecture Questions:** See [Authentication Flow Architecture](../../architecture/current/auth-flow.md)
- **Implementation Help:** See [Implementation Guide](../../guides/developer/implementing-auth.md)
- **API Issues:** Check error codes above or contact support

---

**Last Updated:** 2025-01-11
**API Version:** 2.0.0 (Supabase) + 1.0.0 (Legacy)
**Status:** Production Ready
