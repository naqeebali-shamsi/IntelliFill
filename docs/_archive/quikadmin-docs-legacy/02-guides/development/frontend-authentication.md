# Frontend Authentication Guide

**Status**: Production Ready (Phase 5 Complete)
**Last Updated**: 2025-01-25
**Migration**: Custom JWT → Supabase Auth SDK

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Setup](#setup)
- [Authentication Flows](#authentication-flows)
- [API Integration](#api-integration)
- [Session Management](#session-management)
- [Error Handling](#error-handling)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)
- [Migration Notes](#migration-notes)

## Overview

The QuikAdmin frontend uses **Supabase Auth SDK** for modern, secure authentication. This replaces the previous custom JWT implementation with a battle-tested authentication solution that provides:

- Automatic token refresh
- Secure session persistence
- Multi-tenant support (via Neon integration)
- Real-time auth state synchronization
- OAuth provider support (future)

### Key Technologies

- **Supabase Auth SDK v2**: Authentication client
- **Zustand**: Application state management
- **Axios**: HTTP client with auth interceptors
- **React Router**: Protected route handling
- **TypeScript**: Type-safe implementation

## Architecture

### Component Structure

```
web/src/
├── lib/
│   └── supabase.ts           # Supabase client configuration
├── stores/
│   └── simpleAuthStore.ts    # Auth state management
├── services/
│   └── api.ts                # API client with auth interceptors
├── components/
│   └── ProtectedRoute.tsx    # Route protection
└── pages/
    ├── Login.tsx             # Login page
    └── Register.tsx          # Registration page
```

### Data Flow

```
User Action (Login)
    ↓
Login Component
    ↓
Auth Store (login method)
    ↓
Supabase SDK (signInWithPassword)
    ↓
Supabase Auth Server
    ↓
Auth Store (update state)
    ↓
Zustand Subscribers (React components)
    ↓
UI Update (redirect to dashboard)
```

### Dual Authentication Support

The system supports two authentication modes:

1. **Regular Auth**: Direct Supabase authentication
2. **Neon Auth**: Supabase + company context for multi-tenant apps

```typescript
// Regular Auth Flow
Supabase Login → User State → Dashboard

// Neon Auth Flow (with company slug)
Supabase Login → Neon API (company context) → User + Company State → Dashboard
```

## Setup

### 1. Install Dependencies

```bash
cd web
bun add @supabase/supabase-js
# or
npm install @supabase/supabase-js
```

### 2. Environment Variables

Create `web/.env`:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# API Configuration
VITE_API_URL=http://localhost:3002/api
```

**Get Supabase Credentials:**

1. Go to [app.supabase.com](https://app.supabase.com)
2. Select your project
3. Go to Settings > API
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`

**Security Note**: Never expose the `service_role` key on the frontend!

### 3. Supabase Client Configuration

The Supabase client is pre-configured in `web/src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true, // Auto-refresh before expiry
      persistSession: true, // Save to localStorage
      detectSessionInUrl: true, // For OAuth redirects
      storageKey: 'intellifill-supabase-auth',
    },
  }
);
```

## Authentication Flows

### Login Flow

```typescript
import { useAuthStore } from '@/stores/simpleAuthStore';

function LoginComponent() {
  const { login, isLoading, error } = useAuthStore();

  const handleLogin = async () => {
    try {
      await login({
        email: 'user@example.com',
        password: 'password123',
        rememberMe: true,
      });
      // Success - auth store handles redirect
    } catch (err) {
      console.error('Login failed:', err);
      // Error displayed via auth store
    }
  };
}
```

**What Happens:**

1. User submits credentials
2. Auth store calls `supabase.auth.signInWithPassword()`
3. Supabase validates credentials
4. Returns session + user data
5. Auth store updates Zustand state
6. Components react to state change
7. User redirected to dashboard

### Registration Flow

```typescript
import { useAuthStore } from '@/stores/simpleAuthStore';

function RegisterComponent() {
  const { register } = useAuthStore();

  const handleRegister = async () => {
    await register({
      email: 'user@example.com',
      password: 'password123',
      fullName: 'John Doe',
      acceptTerms: true,
    });
  };
}
```

**With Company (Neon)**:

```typescript
await register({
  email: 'admin@company.com',
  password: 'password123',
  fullName: 'Admin User',
  companyName: 'Acme Corp',
  companySlug: 'acme-corp',
  acceptTerms: true,
});
```

### Logout Flow

```typescript
const { logout } = useAuthStore();

await logout();
// User signed out, state cleared, redirected to login
```

**What Happens:**

1. `supabase.auth.signOut()` called
2. Supabase session invalidated
3. LocalStorage cleared
4. Zustand state reset
5. User redirected to login page

### Session Restoration

On app load, the auth store automatically restores the session:

```typescript
// Happens automatically in App.tsx
useEffect(() => {
  initializeStores();
}, []);
```

**Process:**

1. App mounts
2. Auth store `initialize()` called
3. Supabase checks localStorage for session
4. If valid session exists, user is authenticated
5. If no/invalid session, user sees login page

## API Integration

### Request Interceptor

All API requests automatically include the auth token:

```typescript
// web/src/services/api.ts
api.interceptors.request.use(async (config) => {
  const { tokens, session } = useAuthStore.getState();

  // Primary: Use Zustand-stored token
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  // Fallback: Get from Supabase directly
  else {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  }

  return config;
});
```

### Response Interceptor (Auto-Refresh)

On 401 errors, the interceptor automatically attempts token refresh:

```typescript
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Try to refresh session
      const { data } = await supabase.auth.refreshSession();

      if (data.session) {
        // Retry request with new token
        return api(originalRequest);
      } else {
        // Refresh failed, logout user
        await logout();
      }
    }
    return Promise.reject(error);
  }
);
```

### Making Authenticated Requests

```typescript
import api from '@/services/api';

// Automatic auth token injection
const response = await api.get('/documents');
const documents = response.data;

// Multi-tenant with company context
const { company } = useAuthStore.getState();
// X-Company-ID header automatically added if company exists
```

## Session Management

### Auto-Refresh

Supabase handles token refresh automatically:

- Default token lifespan: **1 hour**
- Auto-refresh starts: **~10 minutes before expiry**
- Refresh happens transparently in background
- No user interruption

### Session Persistence

Sessions persist across:

- Page reloads
- Browser restarts (if "Remember me" enabled)
- Tab closures

**Storage**:

- **Supabase**: `localStorage['intellifill-supabase-auth']`
- **Zustand**: `localStorage['intellifill-auth']`

### Session Validation

Protected routes validate the session on mount:

```typescript
// web/src/components/ProtectedRoute.tsx
export function ProtectedRoute({ children }) {
  const isSessionValid = checkSession();

  if (!isSessionValid) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}
```

### Auth State Listener

The auth store listens for Supabase auth events:

```typescript
supabase.auth.onAuthStateChange((event, session) => {
  switch (event) {
    case 'SIGNED_IN':
      // Update user state
      break;
    case 'SIGNED_OUT':
      // Clear user state
      break;
    case 'TOKEN_REFRESHED':
      // Update token in state
      break;
  }
});
```

## Error Handling

### Error Types

```typescript
interface AppError {
  id: string;
  code: string; // 'INVALID_CREDENTIALS', 'EMAIL_EXISTS', etc.
  message: string; // User-friendly message
  details?: string; // Technical details
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string; // 'auth'
  resolved: boolean;
}
```

### Common Error Codes

| Code                  | Message                    | Cause                    |
| --------------------- | -------------------------- | ------------------------ |
| `INVALID_CREDENTIALS` | Invalid email or password  | Wrong email/password     |
| `EMAIL_EXISTS`        | Account already exists     | Duplicate registration   |
| `ACCOUNT_LOCKED`      | Account temporarily locked | Too many failed attempts |
| `RATE_LIMIT`          | Too many requests          | Rate limiting triggered  |
| `SESSION_EXPIRED`     | Session has expired        | Token expired            |
| `AUTH_ERROR`          | Authentication error       | Generic auth failure     |

### Error Handling Example

```typescript
import { useAuthStore, useAuthError } from '@/stores/simpleAuthStore';

function LoginComponent() {
  const { login } = useAuthStore();
  const { error, clearError } = useAuthError();

  const handleLogin = async (credentials) => {
    clearError(); // Clear previous errors

    try {
      await login(credentials);
    } catch (err) {
      // Error automatically set in auth store
      // Display error to user
      if (err.code === 'INVALID_CREDENTIALS') {
        toast.error('Invalid email or password');
      } else {
        toast.error(err.message);
      }
    }
  };

  return (
    <form onSubmit={handleLogin}>
      {error && <Alert variant="error">{error.message}</Alert>}
      {/* Form fields */}
    </form>
  );
}
```

## Security Best Practices

### 1. Environment Variables

✅ **DO**:

- Store credentials in `.env` (gitignored)
- Use `VITE_` prefix for Vite env vars
- Only use `anon` key on frontend
- Validate env vars on app start

❌ **DON'T**:

- Commit `.env` to git
- Use `service_role` key on frontend
- Hard-code credentials
- Expose keys in client-side code

### 2. Token Storage

✅ **DO**:

- Let Supabase handle storage
- Use httpOnly cookies when possible
- Clear storage on logout
- Validate sessions on protected routes

❌ **DON'T**:

- Store tokens in plain text
- Share tokens between apps
- Store sensitive data in localStorage
- Trust client-side session data

### 3. Password Security

✅ **DO**:

- Enforce strong password requirements
- Use HTTPS only
- Hash passwords server-side (Supabase handles this)
- Implement rate limiting

❌ **DON'T**:

- Log passwords
- Send passwords in URLs
- Store passwords client-side
- Validate passwords client-side only

### 4. Session Management

✅ **DO**:

- Validate sessions on every request
- Implement automatic logout on long inactivity
- Use short token lifespans
- Monitor for suspicious activity

❌ **DON'T**:

- Trust expired sessions
- Allow indefinite sessions
- Skip session validation
- Ignore auth state changes

## Troubleshooting

### Issue: "Missing VITE_SUPABASE_URL"

**Cause**: Environment variable not set

**Solution**:

1. Copy `web/.env.example` to `web/.env`
2. Fill in Supabase credentials
3. Restart dev server

### Issue: "Invalid login credentials"

**Causes**:

- Wrong email/password
- User not registered in Supabase
- Supabase project misconfigured

**Solution**:

1. Verify credentials
2. Check Supabase Auth dashboard for user
3. Verify Supabase project settings

### Issue: "Session not persisting"

**Causes**:

- LocalStorage disabled
- Private browsing mode
- Browser clearing storage

**Solution**:

1. Check browser localStorage permissions
2. Disable private browsing
3. Check `persistSession: true` in config

### Issue: "401 Unauthorized on API calls"

**Causes**:

- Token expired
- Backend not accepting Supabase tokens
- Token not included in request

**Solution**:

1. Check API interceptor is working
2. Verify backend Phase 4 complete
3. Check token in request headers
4. Try manual refresh

### Issue: "TypeScript errors"

**Cause**: Type mismatches after migration

**Solution**:

```bash
cd web
npm run typecheck
```

Check for:

- User type compatibility
- Session type from Supabase
- Token structure

## Migration Notes

### From Custom JWT to Supabase

**What Changed:**

- ✅ Login/Register now use Supabase SDK
- ✅ Automatic token refresh (no manual logic)
- ✅ Session managed by Supabase
- ✅ Auth state listener for real-time updates
- ✅ Type-safe User mapping

**What Stayed:**

- ✅ Zustand state management
- ✅ Component interfaces unchanged
- ✅ Protected route logic
- ✅ API client structure
- ✅ Neon multi-tenant support

**Breaking Changes:**

- ⚠️ `tokens` structure changed (now from Supabase)
- ⚠️ User properties updated (matches Supabase user)
- ⚠️ Environment variables changed (`VITE_SUPABASE_*`)
- ⚠️ LocalStorage keys changed

**Migration Checklist:**

- [x] Install `@supabase/supabase-js`
- [x] Add Supabase env vars
- [x] Create Supabase client
- [x] Update auth store methods
- [x] Update API interceptors
- [x] Test login/logout flows
- [x] Test session persistence
- [x] Test token refresh
- [x] Update documentation

## API Reference

### Auth Store Hooks

```typescript
// Primary hook
const {
  user, // Current user
  isAuthenticated, // Auth status
  isLoading, // Loading state
  login, // Login method
  logout, // Logout method
  register, // Register method
} = useAuth();

// Error handling hook
const {
  error, // Current error
  clearError, // Clear error
  setError, // Set custom error
} = useAuthError();
```

### Auth Store Selectors

```typescript
import { authSelectors } from '@/stores/simpleAuthStore';

const isAuthenticated = authSelectors.isAuthenticated(state);
const user = authSelectors.user(state);
const error = authSelectors.error(state);
```

### Supabase Client

```typescript
import { supabase } from '@/lib/supabase';

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
});

// Sign out
await supabase.auth.signOut();

// Get session
const {
  data: { session },
} = await supabase.auth.getSession();

// Get user
const {
  data: { user },
} = await supabase.auth.getUser();

// Refresh session
const { data } = await supabase.auth.refreshSession();
```

---

**Need Help?**

- Supabase Docs: https://supabase.com/docs/guides/auth
- Project Issues: https://github.com/your-repo/issues
- Internal Wiki: [Authentication Guide](link)
