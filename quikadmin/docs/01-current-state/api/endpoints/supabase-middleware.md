# Supabase Middleware Guide

**Status:** Phase 4 SDK Migration - Phase 4 COMPLETE ✅
**Last Updated:** 2025-10-25

## Overview

QuikAdmin uses Supabase JWT verification for authentication during Phase 4 SDK migration. This guide explains the middleware architecture and usage patterns.

## Middleware Types

### 1. `authenticateSupabase` - Required Auth

**File:** `src/middleware/supabaseAuth.ts`

**Purpose:** Verify Supabase JWT and load user from database

**Usage:**
```typescript
import { authenticateSupabase } from './middleware/supabaseAuth';

router.get('/protected', authenticateSupabase, (req, res) => {
  // req.user is guaranteed to exist
  res.json({ user: req.user });
});
```

**Behavior:**
- Extracts JWT from `Authorization: Bearer <token>` header
- Verifies token with Supabase (server-side)
- Loads user profile from Prisma database
- Attaches `req.user` with user data
- Returns 401 if authentication fails

**Security Features:**
- Token format validation (length checks)
- Server-side verification using `getUser()` (not `getSession()`)
- User account status check (isActive)
- Database synchronization validation

### 2. `authorizeSupabase` - Role-Based Access

**File:** `src/middleware/supabaseAuth.ts`

**Purpose:** Restrict access to specific user roles

**Usage:**
```typescript
import { authenticateSupabase, authorizeSupabase } from './middleware/supabaseAuth';

router.post('/admin/users',
  authenticateSupabase,
  authorizeSupabase(['admin']),
  (req, res) => {
    // Only admins can access this route
  }
);
```

**Behavior:**
- Checks if `req.user.role` matches allowed roles
- Returns 403 if user doesn't have required role
- Must be used after `authenticateSupabase`
- Case-insensitive role comparison

### 3. `optionalAuthSupabase` - Optional Auth

**File:** `src/middleware/supabaseAuth.ts`

**Purpose:** Attach user if authenticated, but don't require it

**Usage:**
```typescript
import { optionalAuthSupabase } from './middleware/supabaseAuth';

router.get('/public-with-user-context', optionalAuthSupabase, (req, res) => {
  // req.user exists if authenticated, undefined otherwise
  if (req.user) {
    res.json({ personalized: true, user: req.user });
  } else {
    res.json({ personalized: false });
  }
});
```

**Behavior:**
- Tries to authenticate but doesn't fail if no auth
- Silently continues without user if auth fails
- Useful for public routes with user context
- Still validates token security if provided

### 4. `dualAuthenticate` - Migration Support

**File:** `src/middleware/dualAuth.ts`

**Purpose:** Support both Supabase JWT and legacy custom JWT

**Usage:**
```typescript
import { dualAuthenticate } from './middleware/dualAuth';

router.get('/api/users/me', dualAuthenticate, (req, res) => {
  // Works with both Supabase and legacy JWT tokens
  res.json({ user: req.user });
});
```

**Behavior:**
- Tries Supabase authentication first
- Falls back to legacy JWT if Supabase fails
- Logs which auth method succeeded
- Used during migration period only
- Will be removed in Phase 6

**Flow Diagram:**
```
Request with JWT
    ↓
Try Supabase Auth
    ↓
Success? → Continue
    ↓ No
Try Legacy JWT Auth
    ↓
Success? → Continue
    ↓ No
Return 401 Unauthorized
```

### 5. `dualAuthorize` - Dual Auth Role Check

**File:** `src/middleware/dualAuth.ts`

**Purpose:** Role-based authorization for dual auth

**Usage:**
```typescript
import { dualAuthenticate, dualAuthorize } from './middleware/dualAuth';

router.delete('/admin/users/:id',
  dualAuthenticate,
  dualAuthorize(['admin']),
  (req, res) => {
    // Admin-only route, works with both auth systems
  }
);
```

### 6. `optionalDualAuth` - Optional Dual Auth

**File:** `src/middleware/dualAuth.ts`

**Purpose:** Try both auth methods without failing

**Usage:**
```typescript
import { optionalDualAuth } from './middleware/dualAuth';

router.get('/public-stats', optionalDualAuth, (req, res) => {
  // Public endpoint with optional user context
});
```

## Request Object Extensions

### `req.user` Structure

```typescript
req.user = {
  id: string;              // Matches Supabase auth.users.id
  email: string;           // User email
  role: string;            // User role (ADMIN, USER, VIEWER)
  supabaseUserId: string;  // Supabase user ID (for tracking)
  firstName?: string;      // Optional first name
  lastName?: string;       // Optional last name
}
```

### `req.supabaseUser` Structure

Raw Supabase user object for advanced use cases:

```typescript
req.supabaseUser = {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  phone: string | null;
  confirmed_at: string | null;
  last_sign_in_at: string | null;
  app_metadata: {
    provider: string;
    providers: string[];
  };
  user_metadata: {
    firstName?: string;
    lastName?: string;
    role?: string;
  };
  identities: any[];
  created_at: string;
  updated_at: string;
}
```

## Migration Timeline

### ✅ Phase 2 (Complete): Dual Auth Middleware
- Both custom JWT and Supabase JWT work
- Legacy routes use `dualAuthenticate`
- New routes use `authenticateSupabase`
- Migration status logged for monitoring

### ✅ Phase 3 (Complete): Auth Routes Migration
- Supabase auth routes created at `/api/auth/v2`
- Legacy auth routes maintained at `/api/auth`
- 37/37 integration tests passing
- Full backwards compatibility verified

### ✅ Phase 4 (Complete): Protected Routes Migration
- All 16 protected routes now use `dualAuthenticate`
- Security fixes applied to 3 unprotected job routes
- 32 integration tests added for protected routes
- TypeScript compilation: zero errors
- Documentation updated (302-protected-routes.md)

### Phase 5-6: Gradual Supabase Adoption
- Monitor Supabase vs legacy JWT usage metrics
- Encourage new users to sign up via Supabase
- Provide migration guide for existing users
- Track adoption rate

### Phase 7: Supabase Only (Future)
- Remove `dualAuthenticate` middleware
- Remove legacy `authenticate` middleware
- Delete `PrismaAuthService.ts`
- All routes use `authenticateSupabase`

## Error Handling

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

**Causes:**
- Missing Authorization header
- Invalid JWT format
- Expired token
- User not found in database
- Token signature invalid

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

**Causes:**
- User doesn't have required role
- Account is deactivated
- Authorization check failed

**Code-specific:**
```json
{
  "error": "Forbidden",
  "message": "Account is deactivated",
  "code": "ACCOUNT_DEACTIVATED"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "Authentication failed"
}
```

**Causes:**
- Database connection error
- Supabase API error
- Unexpected exception

## Testing

### Test with cURL

**Get access token:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'
```

**Use token:**
```bash
curl -X GET http://localhost:3000/api/users/me \
  -H "Authorization: Bearer <access_token>"
```

### Test with Postman

1. Send POST to `/api/auth/login` with email/password
2. Copy `accessToken` from response
3. Add to Authorization header: `Bearer <token>`
4. Send requests to protected routes

### Test Dual Auth

**Supabase token:**
```bash
# Login with Supabase
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Use Supabase token (prioritized)
curl -X GET http://localhost:3000/api/users/me \
  -H "Authorization: Bearer <supabase_token>"
```

**Legacy token (fallback):**
```bash
# Use legacy JWT token
curl -X GET http://localhost:3000/api/users/me \
  -H "Authorization: Bearer <legacy_jwt_token>"
```

## Best Practices

### 1. Always use `authenticateSupabase` for new routes
- Don't use legacy `authenticate` for new code
- Only use `dualAuthenticate` during migration
- Plan migration path for existing routes

### 2. Use `authorizeSupabase` for role checks
- Don't manually check `req.user.role`
- Centralized authorization logic
- Case-insensitive role matching

### 3. Use `optionalAuthSupabase` for public + user context
- Better than conditional authentication
- Cleaner code
- Still maintains security on provided tokens

### 4. Never use `getSession()` on server
- Always use `getUser()` for verification
- `getSession()` can be spoofed
- Server-side requires full validation

### 5. Handle errors gracefully
- Log authentication failures
- Return appropriate status codes
- Don't expose internal details
- Use error codes for client handling

### 6. Monitor migration progress
- Check logs for auth method usage
- Track Supabase vs legacy JWT ratio
- Identify routes still using legacy auth

## Implementation Examples

### Basic Protected Route

```typescript
import { authenticateSupabase } from '../middleware/supabaseAuth';

router.get('/api/documents/:id',
  authenticateSupabase,
  async (req, res) => {
    const document = await prisma.document.findUnique({
      where: {
        id: req.params.id,
        userId: req.user!.id // Type-safe, user guaranteed
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ success: true, data: { document } });
  }
);
```

### Admin-Only Route

```typescript
import { authenticateSupabase, authorizeSupabase } from '../middleware/supabaseAuth';

router.delete('/api/admin/users/:id',
  authenticateSupabase,
  authorizeSupabase(['admin']),
  async (req, res) => {
    // Only admins reach here
    await prisma.user.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true, message: 'User deleted' });
  }
);
```

### Public Route with User Context

```typescript
import { optionalAuthSupabase } from '../middleware/supabaseAuth';

router.get('/api/stats/dashboard',
  optionalAuthSupabase,
  async (req, res) => {
    const stats = await getPublicStats();

    // Personalize if user authenticated
    if (req.user) {
      stats.userDocumentCount = await prisma.document.count({
        where: { userId: req.user.id }
      });
    }

    res.json({ success: true, data: { stats } });
  }
);
```

### Migration Period Route (Dual Auth)

```typescript
import { dualAuthenticate, dualAuthorize } from '../middleware/dualAuth';

router.get('/api/users/me',
  dualAuthenticate, // Accepts both Supabase and legacy JWT
  async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }
    });

    res.json({ success: true, data: { user } });
  }
);
```

## Troubleshooting

### "Invalid or expired token"

**Causes:**
- Token might be from legacy system (use `dualAuthenticate`)
- Token might be expired (< 1 hour)
- Check Supabase project status

**Solutions:**
1. Try with `dualAuthenticate` if route supports legacy JWT
2. Request new token via refresh endpoint
3. Check Supabase dashboard for service status

### "User not found in database"

**Causes:**
- User exists in Supabase but not Prisma
- Database migration incomplete
- User was manually deleted from Prisma

**Solutions:**
1. Run user migration script
2. Check database connection
3. Verify Supabase user ID matches Prisma user ID

### "Authentication failed"

**Causes:**
- Check Supabase credentials in `.env`
- Verify internet connection
- Check Supabase project not paused

**Solutions:**
1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`
2. Check Supabase dashboard for project status
3. Test Supabase connection: `npm run test:supabase`

### "Account is deactivated"

**Causes:**
- User account marked as inactive in database
- Account was deactivated by admin

**Solutions:**
1. Check `User.isActive` field in database
2. Reactivate account via admin panel
3. Contact support if needed

## Security Considerations

### Server-Side Verification

**Always use `getUser()` for token verification:**
```typescript
// ✅ CORRECT - Server-side validation
const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
```

**Never use `getSession()` on server:**
```typescript
// ❌ WRONG - Can be spoofed, client-only
const { data: { session }, error } = await supabase.auth.getSession();
```

### Token Storage

- **Backend:** Never store tokens, verify on each request
- **Frontend:** Store in httpOnly cookies or secure localStorage
- **Never:** Expose SERVICE_ROLE_KEY to frontend

### Database Synchronization

- Supabase `auth.users.id` must match Prisma `User.id`
- Always load user from Prisma for authorization
- Don't trust user_metadata alone for permissions

### Rate Limiting

Apply rate limiting to auth endpoints:
```typescript
import { authLimiter } from '../middleware/auth';

router.post('/api/auth/login',
  authLimiter, // 5 requests per 15 minutes
  authenticateSupabase,
  // ... handler
);
```

## Performance Considerations

### Token Verification Speed

- Supabase JWT verification: ~50-100ms (network call)
- Legacy JWT verification: ~5-10ms (local)
- Dual auth adds ~100-150ms (tries both)

### Optimization Tips

1. **Cache verification results** (advanced):
   ```typescript
   // Use Redis to cache valid tokens for 5 minutes
   const cachedUser = await redis.get(`token:${token}`);
   if (cachedUser) return cachedUser;
   ```

2. **Monitor performance:**
   ```typescript
   const start = Date.now();
   await authenticateSupabase(req, res, next);
   logger.debug(`Auth took ${Date.now() - start}ms`);
   ```

3. **Migrate away from dual auth ASAP** - reduces latency

## Migration Checklist

- [x] Phase 2: Middleware created ✅
- [x] Phase 3: Update auth routes to use Supabase ✅
- [x] Phase 4: Migrate protected routes to dual auth ✅
- [ ] Phase 5: Monitor adoption and provide user migration guide
- [ ] Phase 6: Frontend full migration to Supabase client
- [ ] Phase 7: Remove legacy auth middleware
- [ ] Phase 8: Delete PrismaAuthService.ts

## Next Steps

- [Phase 3: Auth Routes Migration](../SUPABASE_AUTH_MIGRATION_PLAN.md#phase-3)
- [Full Migration Plan](../SUPABASE_AUTH_MIGRATION_PLAN.md)
- [Authentication API Reference](./301-authentication.md)

---

**Questions?** Check [SUPABASE_AUTH_MIGRATION_PLAN.md](../SUPABASE_AUTH_MIGRATION_PLAN.md) for complete migration strategy.
