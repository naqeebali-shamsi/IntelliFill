# Authentication Implementation Scope

## Overview
Implement JWT-based authentication system to connect the React frontend with the Express backend, replacing dummy data with real user sessions.

## Current State Analysis

### Frontend (React)
- **Auth Context**: Already exists at `/web/src/contexts/AuthContext.tsx`
- **Login Page**: UI ready at `/web/src/pages/Login.tsx`
- **API Service**: Configured but calling non-existent endpoints
- **Protected Routes**: Already implemented with route guards

### Backend (Express)
- **Database**: PostgreSQL with user_settings table (needs users table)
- **Middleware**: Auth middleware exists but incomplete
- **Redis**: Available for session/token management
- **Missing**: Login, register, refresh token endpoints

## Implementation Plan

### Phase 1: Backend Authentication (Current Focus)

#### 1.1 Database Schema
```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens table
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 1.2 API Endpoints to Implement
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login with JWT
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Invalidate refresh token
- `GET /api/auth/me` - Get current user info

#### 1.3 JWT Strategy
- **Access Token**: 15 minutes expiry, contains userId, email, role
- **Refresh Token**: 7 days expiry, stored in database
- **Secret Keys**: From environment variables
- **Token Rotation**: New refresh token on each use

### Phase 2: Frontend Integration

#### 2.1 Update Auth Context
- Implement real API calls instead of mock
- Handle JWT token storage (localStorage/sessionStorage)
- Auto-refresh mechanism
- Logout cleanup

#### 2.2 API Interceptors
- Add Authorization header to all requests
- Handle 401 responses with token refresh
- Redirect to login on auth failure

### Phase 3: Connect UI Features

#### 3.1 Dashboard
- Replace mock statistics with real user data
- Connect to `/api/statistics` endpoint
- Show actual processing history

#### 3.2 Upload Page
- Connect to `/api/process/*` endpoints
- Real file upload with progress
- Queue job creation

#### 3.3 History Page
- Fetch from `/api/jobs` endpoint
- Real pagination
- Download processed files

## Success Criteria
1. ✅ Users can register and login
2. ✅ JWT tokens are properly generated and validated
3. ✅ Protected routes work with real authentication
4. ✅ Dashboard shows real user-specific data
5. ✅ File upload creates actual processing jobs
6. ✅ History shows real processed documents

## Technical Decisions
- **Password Hashing**: bcrypt with 10 rounds
- **JWT Library**: jsonwebtoken
- **Validation**: express-validator for input validation
- **CORS**: Configured for frontend origin
- **Security Headers**: helmet.js for security

## Next Immediate Steps
1. Create database migration for users and refresh_tokens tables
2. Implement authentication service with JWT
3. Create auth API endpoints
4. Test with Postman/curl
5. Update frontend AuthContext to use real API

## Estimated Timeline
- Backend auth implementation: 2-3 hours
- Frontend integration: 1-2 hours
- Testing and debugging: 1 hour
- Total: ~5 hours for complete authentication