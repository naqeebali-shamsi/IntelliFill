---
title: Authentication Issues
description: Troubleshoot and fix login and authentication problems
category: how-to
tags: [troubleshooting, authentication, supabase, jwt]
lastUpdated: 2026-01-19
---

# Authentication Issues

This guide helps you troubleshoot and resolve common authentication problems in IntelliFill.

---

## Quick Diagnosis

### Check Backend Auth

```bash
# Test login endpoint
curl -X POST http://localhost:3002/api/auth/v2/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@intellifill.com","password":"Admin123!"}'
```

### Check Supabase Connection

```bash
cd quikadmin
npx ts-node scripts/test-supabase-connection.ts
```

---

## Common Issues

### Issue 1: Failed to Fetch (Frontend)

**Symptoms**:
```
Failed to fetch
ERR_NAME_NOT_RESOLVED
```

**Cause**: Frontend trying to connect directly to Supabase instead of backend, or backend not running.

**Solutions**:

1. **Verify backend is running**:
   ```bash
   curl http://localhost:3002/health
   ```

2. **Check frontend environment**:
   ```bash
   # quikadmin-web/.env
   VITE_API_URL=http://localhost:3002/api
   ```

3. **Check Supabase URL** (if using direct connection):
   ```bash
   # Ensure valid Supabase URL
   VITE_SUPABASE_URL=https://your-project.supabase.co
   ```

---

### Issue 2: Invalid Credentials

**Symptoms**:
```
Invalid email or password
401 Unauthorized
```

**Solutions**:

1. **Verify user exists in Supabase**:
   - Go to Supabase Dashboard > Authentication > Users
   - Check if user email is registered

2. **Try demo credentials**:
   - Email: `admin@intellifill.com`
   - Password: `Admin123!`

3. **Reset password via Supabase Dashboard**:
   - Find user in Authentication > Users
   - Click "Send password reset"

---

### Issue 3: Token Expired

**Symptoms**:
```
jwt expired
Token has expired
```

**Solutions**:

1. **Clear browser storage and login again**:
   ```javascript
   // In browser console
   localStorage.clear();
   sessionStorage.clear();
   ```

2. **Check JWT secret matches**:
   ```env
   # quikadmin/.env
   JWT_SECRET=your-secret-key-at-least-32-characters
   ```

3. **Verify token refresh logic** is working in frontend.

---

### Issue 4: Supabase Connection Failed

**Symptoms**:
```
Invalid API key
Failed to fetch user
```

**Solutions**:

1. **Verify Supabase credentials**:
   ```env
   # Backend
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
   
   # Frontend
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
   ```

2. **Get keys from Supabase Dashboard**:
   - Go to Settings > API
   - Copy Project URL and Keys

3. **Check anon key vs service role key**:
   - **Anon key**: For frontend, limited permissions
   - **Service role key**: For backend only, full access

---

### Issue 5: CORS Error

**Symptoms**:
```
Access-Control-Allow-Origin
CORS policy blocked
```

**Solutions**:

1. **Check backend CORS configuration**:
   ```typescript
   // src/index.ts
   app.use(cors({
     origin: ['http://localhost:8080', 'http://localhost:5173'],
     credentials: true
   }));
   ```

2. **Verify frontend URL matches CORS origins**.

3. **Check for preflight request issues**:
   ```bash
   # Test OPTIONS request
   curl -X OPTIONS http://localhost:3002/api/auth/v2/login \
     -H "Origin: http://localhost:8080" \
     -H "Access-Control-Request-Method: POST"
   ```

---

### Issue 6: Cookie Not Set

**Symptoms**:
- Login succeeds but redirects to login again
- Token not persisted

**Solutions**:

1. **Check cookie settings**:
   ```typescript
   res.cookie('token', jwt, {
     httpOnly: true,
     secure: process.env.NODE_ENV === 'production',
     sameSite: 'lax',
     maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
   });
   ```

2. **Verify credentials flag in frontend**:
   ```typescript
   axios.defaults.withCredentials = true;
   ```

3. **Check browser cookie settings**:
   - Third-party cookies not blocked
   - Site not in private/incognito mode with strict settings

4. **Localhost with production env**:
   - If `NODE_ENV=production` locally, cookies may be set as `Secure`/`SameSite=None`
   - Ensure the backend detects localhost for cookie options or set `NODE_ENV=development`

---

### Issue 7: User Not Found in Database

**Symptoms**:
```
User not found
No user with that email
```

**Solutions**:

1. **Check Supabase users**:
   - Dashboard > Authentication > Users

2. **Check local database sync**:
   ```bash
   npx prisma studio
   # Look at User table
   ```

3. **Trigger user sync** (if using local + Supabase):
   ```bash
   npm run migrate:supabase
   ```

---

## Frontend Auth Debugging

### Check Auth Store State

```typescript
// In browser console
import { useAuthStore } from './stores/useAuthStore';
console.log(useAuthStore.getState());
```

### View Network Requests

1. Open DevTools > Network
2. Filter by "auth" or "login"
3. Check request/response headers and body

### Check Local Storage

```javascript
// In browser console
console.log(localStorage.getItem('token'));
console.log(sessionStorage.getItem('supabase.auth.token'));
```

---

## Backend Auth Debugging

### Add Logging

```typescript
// Temporarily add to auth routes
router.post('/login', async (req, res) => {
  console.log('Login attempt:', req.body.email);
  console.log('Headers:', req.headers);
  // ...
});
```

### Test Supabase Directly

```typescript
// scripts/test-supabase-auth.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const { data, error } = await supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'password123'
});

console.log('Result:', data, error);
```

---

## Security Configuration

### Environment Variables Checklist

```env
# Backend (.env)
JWT_SECRET=min-32-chars-random-string
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Frontend (.env)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Supabase Project Settings

1. **Enable email confirmations** (optional for dev):
   - Authentication > Providers > Email > Confirm email: OFF (for dev)

2. **Configure redirect URLs**:
   - Authentication > URL Configuration
   - Add `http://localhost:8080`

---

## Related Documentation

- [Local Setup](../development/local-setup.md)
- [Security Model](../../explanation/security-model.md)
- [API Reference - Auth](../../reference/api/endpoints.md#authentication)

