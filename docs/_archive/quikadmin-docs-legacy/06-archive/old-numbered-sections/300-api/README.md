# API Reference

**Section Number:** 300
**Purpose:** Complete API documentation and endpoint reference
**Last Updated:** 2025-01-10

---

## Overview

This section documents all QuikAdmin API endpoints, request/response formats, authentication, and error handling.

**Base URL (Development):** `http://localhost:3002/api`

## Documents in This Section

| Document                                         | Description                                         | Difficulty | Status      |
| ------------------------------------------------ | --------------------------------------------------- | ---------- | ----------- |
| [301-authentication.md](./301-authentication.md) | Authentication endpoints (register, login, refresh) | Beginner   | ✅ Complete |

## Quick Start

### Authentication Flow

```bash
# 1. Register a new user
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123!","fullName":"John Doe"}'

# 2. Login to get tokens
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123!"}'

# 3. Use access token for protected endpoints
curl -X GET http://localhost:3002/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## API Sections

### Authentication (`/api/auth`)

Complete authentication flow including registration, login, token refresh, and password management.

**Documentation:** [301-authentication.md](./301-authentication.md)

**Endpoints:**

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout current device
- `POST /api/auth/logout-all` - Logout all devices
- `GET /api/auth/me` - Get user profile
- `POST /api/auth/change-password` - Change password

### Documents (`/api/documents`)

Document upload, processing, and retrieval endpoints.

**Status:** Documented in [CURRENT_ARCHITECTURE.md](../CURRENT_ARCHITECTURE.md#document-endpoints)

### Statistics (`/api/stats`)

System and user statistics endpoints.

**Status:** Documented in [CURRENT_ARCHITECTURE.md](../CURRENT_ARCHITECTURE.md#statistics-endpoints)

## Authentication

All protected endpoints require a JWT bearer token:

```
Authorization: Bearer <access_token>
```

**Token Expiry:**

- Access Token: 15 minutes
- Refresh Token: 7 days

**Security Features:**

- HS256 algorithm enforcement
- Algorithm confusion attack prevention
- Explicit token structure validation
- Entropy-checked secrets (256+ bits)

## Rate Limiting

| Endpoint Type  | Limit        | Window     | Details                   |
| -------------- | ------------ | ---------- | ------------------------- |
| Standard API   | 100 requests | 15 minutes | Per IP address            |
| Authentication | 5 requests   | 15 minutes | Login/register endpoints  |
| File Upload    | 10 requests  | 15 minutes | Document upload endpoints |

## Error Handling

### Standard Error Response

```json
{
  "error": "Error message",
  "message": "Detailed description",
  "code": "ERROR_CODE"
}
```

### Common HTTP Status Codes

| Code | Meaning               | When It Happens                             |
| ---- | --------------------- | ------------------------------------------- |
| 200  | OK                    | Request successful                          |
| 201  | Created               | Resource created (e.g., user registration)  |
| 400  | Bad Request           | Invalid input/validation error              |
| 401  | Unauthorized          | Missing or invalid token                    |
| 403  | Forbidden             | Insufficient permissions                    |
| 404  | Not Found             | Resource doesn't exist                      |
| 409  | Conflict              | Resource already exists (e.g., email taken) |
| 429  | Too Many Requests     | Rate limit exceeded                         |
| 500  | Internal Server Error | Server-side error                           |

### Authentication Error Codes

| Code                    | Meaning                 | Action                                    |
| ----------------------- | ----------------------- | ----------------------------------------- |
| `TOKEN_EXPIRED`         | Access token expired    | Use refresh token to get new access token |
| `ACCOUNT_DEACTIVATED`   | Account inactive        | Contact support                           |
| `ALGORITHM_VIOLATION`   | Invalid token algorithm | Regenerate token (security issue)         |
| `INVALID_SIGNATURE`     | Token signature invalid | Login again                               |
| `AUTHENTICATION_FAILED` | General auth failure    | Verify credentials and retry              |

## CORS Configuration

**Allowed Origins (Development):**

- `http://localhost:3000`
- `http://localhost:3001`
- `http://localhost:5173`

**Credentials:** Enabled (cookies, authorization headers)

## Related Sections

- [Authentication Guide](../400-guides/406-security-best-practices.md) - Security best practices
- [Troubleshooting](../400-guides/407-troubleshooting.md) - Common API issues
- [Getting Started](../100-getting-started/104-first-document.md) - First API call tutorial

## API Testing

```bash
# Health check (no auth required)
curl http://localhost:3002/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2025-01-10T12:00:00.000Z",
  "version": "1.0.0",
  "environment": "development"
}
```

## Contributing

When adding new API endpoints:

1. Document in this section (300-api)
2. Update CURRENT_ARCHITECTURE.md with endpoint details
3. Add request/response examples
4. Include error scenarios
5. Add cURL examples

---

**Start Here:** Read [301-authentication.md](./301-authentication.md) for authentication implementation.
