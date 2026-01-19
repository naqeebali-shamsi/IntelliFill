# Phase 5: AS-IS End-to-End Mapping - Batch 1 (Auth & Security)

**Generated:** 2026-01-09
**Project:** IntelliFill
**Batch:** 1 - Authentication & Security (Critical Priority)

---

## Overview

This document traces each validated auth element from user action through the complete execution path to database operations and back to UI state changes.

---

## Element Mappings

### 1. auth-login-form

**User Action** → **Database**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ USER ACTION                                                                      │
│ User fills email/password, clicks "Sign in" button                              │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND HANDLER                                                                 │
│ File: quikadmin-web/src/pages/Login.tsx:65-103                                  │
│ Function: handleSubmit(e: React.FormEvent)                                      │
│ Actions:                                                                         │
│   1. e.preventDefault()                                                          │
│   2. clearError()                                                               │
│   3. Check isLocked state (lockout validation)                                  │
│   4. Call useAuthStore.login({ email, password, companySlug, rememberMe })      │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ZUSTAND STORE                                                                    │
│ File: quikadmin-web/src/stores/backendAuthStore.ts                              │
│ Function: login(credentials)                                                     │
│ Actions:                                                                         │
│   1. set({ isLoading: true, error: null })                                      │
│   2. Call authService.login(credentials)                                         │
│   3. On success: set({ user, tokens, isAuthenticated: true, isLoading: false }) │
│   4. On error: set({ error, loginAttempts++, isLoading: false })                │
│   5. If loginAttempts >= 5: set({ isLocked: true, lockExpiry: Date.now() + 15min})
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ API SERVICE                                                                      │
│ File: quikadmin-web/src/services/authService.ts                                 │
│ Function: login(credentials): Promise<AuthResponse>                              │
│ HTTP Request: POST /api/auth/v2/login                                           │
│ Request Body: { email, password, deviceInfo?, ipAddress?, userAgent? }          │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ EXPRESS ROUTE                                                                    │
│ File: quikadmin/src/api/supabase-auth.routes.ts:407-642                         │
│ Route: POST /api/auth/v2/login                                                  │
│ Middleware: authLimiter (rate limiting - skipSuccessfulRequests)                │
│ Flow:                                                                            │
│   1. Input validation (email, password required)                                │
│   2. TEST MODE: Authenticate via Prisma/bcrypt                                  │
│   3. PRODUCTION: Authenticate via Supabase signInWithPassword                   │
│   4. Verify user exists in Prisma (match supabaseUserId)                        │
│   5. Check isActive flag (reject deactivated accounts)                          │
│   6. Update lastLogin timestamp                                                 │
│   7. Generate JWT tokens (access + refresh)                                     │
│   8. Set refreshToken as httpOnly cookie                                        │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ DATABASE OPERATIONS                                                              │
│ ORM: Prisma                                                                      │
│ Database: PostgreSQL (Neon Serverless)                                          │
│                                                                                  │
│ READ: prisma.user.findUnique({                                                  │
│   where: { email: email.toLowerCase() } // TEST MODE                            │
│   where: { supabaseUserId: sessionData.user.id } // PRODUCTION                  │
│   select: { id, email, password, firstName, lastName, role, isActive,           │
│             emailVerified, createdAt, lastLogin }                               │
│ })                                                                               │
│                                                                                  │
│ WRITE: prisma.user.update({                                                     │
│   where: { id: user.id },                                                       │
│   data: { lastLogin: new Date() }                                               │
│ })                                                                               │
│                                                                                  │
│ Tables Affected: User (read + update)                                           │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ RESPONSE                                                                         │
│ HTTP 200 OK                                                                      │
│ {                                                                                │
│   success: true,                                                                │
│   message: "Login successful",                                                  │
│   data: {                                                                       │
│     user: { id, email, firstName, lastName, role, emailVerified, lastLogin },  │
│     tokens: { accessToken, expiresIn: 3600, tokenType: "Bearer" }              │
│   }                                                                             │
│ }                                                                                │
│ + Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict              │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ UI STATE UPDATE                                                                  │
│ Zustand store updates:                                                          │
│   - user: { id, email, firstName, lastName, role }                              │
│   - tokens: { accessToken, expiresIn }                                          │
│   - isAuthenticated: true                                                       │
│   - isLoading: false                                                            │
│   - loginAttempts: 0 (reset on success)                                         │
│                                                                                  │
│ Navigation: redirect to searchParams.redirect || location.state?.from || /dashboard
│ Toast: "Login successful!"                                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Error Paths:**
- 400: Validation error (missing email/password)
- 401: Invalid credentials
- 403: Account deactivated (code: ACCOUNT_DEACTIVATED)
- 429: Rate limited

---

### 2. auth-register-form

**User Action** → **Database**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ USER ACTION                                                                      │
│ User fills name/email/password/confirm, accepts terms, clicks "Create account"  │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND HANDLER                                                                 │
│ File: quikadmin-web/src/pages/Register.tsx:104-165                              │
│ Function: handleSubmit(e: React.FormEvent)                                      │
│ Validations:                                                                     │
│   1. Password match (password === confirmPassword)                              │
│   2. Password strength (score >= 4)                                             │
│   3. Terms acceptance (agreedToTerms === true)                                  │
│ Actions:                                                                         │
│   1. Call useAuthStore.register({ email, password, name, acceptTerms,           │
│      marketingConsent })                                                        │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ API SERVICE                                                                      │
│ HTTP Request: POST /api/auth/v2/register                                        │
│ Request Body: { email, password, fullName, role? }                              │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ EXPRESS ROUTE                                                                    │
│ File: quikadmin/src/api/supabase-auth.routes.ts:170-385                         │
│ Route: POST /api/auth/v2/register                                               │
│ Middleware: registerLimiter                                                      │
│ Flow:                                                                            │
│   1. Validate required fields (email, password, fullName)                       │
│   2. Validate email format (regex)                                              │
│   3. Validate password strength (8+ chars, upper, lower, number)                │
│   4. Parse fullName into firstName/lastName                                     │
│   5. Create user in Supabase Auth (supabaseAdmin.auth.admin.createUser)         │
│   6. Create profile in Prisma (User model)                                      │
│   7. Sign in immediately to get session tokens                                  │
│   8. Set refreshToken as httpOnly cookie                                        │
│                                                                                  │
│ ROLLBACK: If Prisma creation fails, delete Supabase user                        │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ DATABASE OPERATIONS                                                              │
│                                                                                  │
│ Supabase Auth:                                                                  │
│   CREATE: supabaseAdmin.auth.admin.createUser({                                 │
│     email: email.toLowerCase(),                                                 │
│     password,                                                                   │
│     email_confirm: true/false (dev vs prod),                                    │
│     user_metadata: { firstName, lastName, role }                                │
│   })                                                                             │
│                                                                                  │
│ Prisma:                                                                          │
│   CREATE: prisma.user.create({                                                  │
│     data: {                                                                     │
│       id: authData.user.id, // Use Supabase ID as primary key                   │
│       email: email.toLowerCase(),                                               │
│       password: '',                                                             │
│       firstName, lastName, role, isActive: true,                                │
│       emailVerified: true/false (dev vs prod),                                  │
│       supabaseUserId: authData.user.id                                          │
│     }                                                                           │
│   })                                                                             │
│                                                                                  │
│ Tables Affected: User (create)                                                  │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ RESPONSE                                                                         │
│ HTTP 201 Created                                                                 │
│ {                                                                                │
│   success: true,                                                                │
│   message: "User registered successfully",                                      │
│   data: {                                                                       │
│     user: { id, email, firstName, lastName, role, emailVerified },             │
│     tokens: { accessToken, expiresIn, tokenType } | null (if verification req) │
│   }                                                                             │
│ }                                                                                │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ UI STATE UPDATE                                                                  │
│ If tokens present:                                                              │
│   - Update auth store with user/tokens                                          │
│   - Navigate to dashboard                                                       │
│ If tokens null (verification required):                                         │
│   - Navigate to /verify-email?email=...                                         │
│ Toast: "Registration successful! Please check your email..."                    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 3. auth-logout

**User Action** → **Database**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ USER ACTION                                                                      │
│ User clicks logout button in sidebar                                            │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND HANDLER                                                                 │
│ File: quikadmin-web/src/components/layout/AppLayout.tsx:167-170                 │
│ Handler: onClick={async () => { await logout(); navigate('/login'); }}          │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ API SERVICE                                                                      │
│ HTTP Request: POST /api/auth/v2/logout                                          │
│ Headers: Authorization: Bearer <accessToken>                                    │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ EXPRESS ROUTE                                                                    │
│ File: quikadmin/src/api/supabase-auth.routes.ts:658-718                         │
│ Route: POST /api/auth/v2/logout                                                 │
│ Middleware: authenticateSupabase                                                │
│ Flow:                                                                            │
│   1. Get userId from req.user                                                   │
│   2. Sign out from Supabase (global scope - invalidates ALL sessions)           │
│   3. Invalidate token cache (fire-and-forget with 500ms timeout)                │
│   4. Clear refreshToken cookie                                                  │
│   5. Return success (idempotent - always returns success)                       │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ EXTERNAL SERVICES                                                                │
│                                                                                  │
│ Supabase Auth:                                                                  │
│   supabaseAdmin.auth.admin.signOut(userId, 'global')                            │
│   - Invalidates all sessions for this user                                      │
│                                                                                  │
│ Token Cache (Redis):                                                            │
│   tokenCache.invalidate(refreshToken)                                           │
│   - Removes token from cache to prevent reuse                                   │
│                                                                                  │
│ Database: No direct operations                                                  │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ RESPONSE                                                                         │
│ HTTP 200 OK                                                                      │
│ { success: true, message: "Logout successful" }                                 │
│ + Clear-Cookie: refreshToken                                                    │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ UI STATE UPDATE                                                                  │
│ Zustand store reset:                                                            │
│   - user: null                                                                  │
│   - tokens: null                                                                │
│   - isAuthenticated: false                                                      │
│                                                                                  │
│ Navigation: redirect to /login                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4. auth-forgot-password-form

**User Action** → **Database**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ USER ACTION                                                                      │
│ User enters email, clicks "Send reset link"                                     │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND HANDLER                                                                 │
│ File: quikadmin-web/src/pages/ForgotPassword.tsx:27-43                          │
│ Function: handleSubmit(e: React.FormEvent)                                      │
│ Actions:                                                                         │
│   1. setError(null), setIsLoading(true)                                         │
│   2. Call useAuthStore.requestPasswordReset(email)                              │
│   3. On success: setEmailSent(true)                                             │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ API SERVICE                                                                      │
│ HTTP Request: POST /api/auth/v2/forgot-password                                 │
│ Request Body: { email, redirectUrl? }                                           │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ EXPRESS ROUTE                                                                    │
│ File: quikadmin/src/api/supabase-auth.routes.ts:1000-1066                       │
│ Route: POST /api/auth/v2/forgot-password                                        │
│ Middleware: authLimiter                                                         │
│ Flow:                                                                            │
│   1. Validate email (required, valid format)                                    │
│   2. Determine redirect URL (param or default)                                  │
│   3. Call Supabase resetPasswordForEmail                                        │
│   4. ALWAYS return success (prevent email enumeration)                          │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ EXTERNAL SERVICES                                                                │
│                                                                                  │
│ Supabase Auth:                                                                  │
│   supabase.auth.resetPasswordForEmail(email, { redirectTo: resetRedirectUrl })  │
│   - Sends email with reset link                                                 │
│   - Creates password reset token (internal to Supabase)                         │
│                                                                                  │
│ Database: No direct operations                                                  │
│ (Supabase manages reset tokens internally)                                      │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ RESPONSE                                                                         │
│ HTTP 200 OK (always - prevents enumeration)                                     │
│ {                                                                                │
│   success: true,                                                                │
│   message: "If an account exists for this email, you will receive a password   │
│            reset link shortly."                                                 │
│ }                                                                                │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ UI STATE UPDATE                                                                  │
│   - emailSent: true                                                             │
│   - Show success state with "Check your email" message                          │
│   - Display resend button                                                       │
│ Toast: "Password reset email sent!"                                             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 5. auth-reset-password-form

**User Action** → **Database**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ USER ACTION                                                                      │
│ User enters new password + confirmation, clicks "Reset password"                │
│ (arrives via email link with token in URL)                                      │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND HANDLER                                                                 │
│ File: quikadmin-web/src/pages/ResetPassword.tsx:105-140                         │
│ Function: handleSubmit(e: React.FormEvent)                                      │
│ Validations:                                                                     │
│   1. Passwords match                                                            │
│   2. Password strength requirements met                                         │
│   3. Token present in URL                                                       │
│ Actions:                                                                         │
│   1. Call useAuthStore.resetPassword(token, newPassword)                        │
│   2. On success: setResetSuccess(true), auto-redirect to login after 3s        │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ API SERVICE                                                                      │
│ HTTP Request: POST /api/auth/v2/reset-password                                  │
│ Request Body: { token, newPassword }                                            │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ EXPRESS ROUTE                                                                    │
│ File: quikadmin/src/api/supabase-auth.routes.ts:1143-1242                       │
│ Route: POST /api/auth/v2/reset-password                                         │
│ Middleware: authLimiter                                                         │
│ Flow:                                                                            │
│   1. Validate token and newPassword (required)                                  │
│   2. Validate password strength                                                 │
│   3. Get current session (user clicked email link)                              │
│   4. Update password via Supabase admin                                         │
│   5. Sign out all sessions (security best practice)                             │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ EXTERNAL SERVICES                                                                │
│                                                                                  │
│ Supabase Auth:                                                                  │
│   1. supabase.auth.getSession() - verify recovery session                       │
│   2. supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword }) │
│   3. supabaseAdmin.auth.admin.signOut(userId, 'global') - invalidate sessions   │
│                                                                                  │
│ Database: No direct Prisma operations                                           │
│ (Password stored in Supabase Auth)                                              │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ RESPONSE                                                                         │
│ HTTP 200 OK                                                                      │
│ {                                                                                │
│   success: true,                                                                │
│   message: "Password reset successfully. Please login with your new password." │
│ }                                                                                │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ UI STATE UPDATE                                                                  │
│   - resetSuccess: true                                                          │
│   - Show success state with checkmark                                           │
│   - Auto-redirect to /login after 3 seconds (useTimeout hook)                   │
│ Toast: "Password reset successful!"                                             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 6. auth-verify-email-form

**User Action** → **Database**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ USER ACTION                                                                      │
│ User enters 6-digit verification code, clicks "Verify Email"                    │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND HANDLER                                                                 │
│ File: quikadmin-web/src/pages/VerifyEmail.tsx:56-106                            │
│ Function: handleSubmit(e: React.FormEvent)                                      │
│ Validations:                                                                     │
│   1. Email present (from URL or input)                                          │
│   2. Code is exactly 6 digits                                                   │
│ Actions:                                                                         │
│   1. Call verifyEmail(email, code) service                                      │
│   2. On success: setSuccess(true), auto-redirect to login after 2s             │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ API SERVICE                                                                      │
│ File: quikadmin-web/src/services/authService.ts                                 │
│ Function: verifyEmail(email, token)                                             │
│ HTTP Request: POST /api/auth/v2/verify-email                                    │
│ Request Body: { email, token }                                                  │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ EXPRESS ROUTE                                                                    │
│ File: quikadmin/src/api/supabase-auth.routes.ts:1384-1476                       │
│ Route: POST /api/auth/v2/verify-email                                           │
│ Middleware: authLimiter                                                         │
│ Flow:                                                                            │
│   1. Validate email and token (required, valid format)                          │
│   2. Validate token format (6 digits)                                           │
│   3. Verify OTP with Supabase                                                   │
│   4. Update emailVerified in Prisma                                             │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ DATABASE OPERATIONS                                                              │
│                                                                                  │
│ Supabase Auth:                                                                  │
│   supabase.auth.verifyOtp({                                                     │
│     email: email.toLowerCase(),                                                 │
│     token: trimmedToken,                                                        │
│     type: 'email'                                                               │
│   })                                                                             │
│                                                                                  │
│ Prisma:                                                                          │
│   UPDATE: prisma.user.update({                                                  │
│     where: { id: verifyData.user.id },                                          │
│     data: { emailVerified: true }                                               │
│   })                                                                             │
│                                                                                  │
│ Tables Affected: User (update)                                                  │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ RESPONSE                                                                         │
│ HTTP 200 OK                                                                      │
│ {                                                                                │
│   success: true,                                                                │
│   message: "Email verified successfully. You can now login."                    │
│ }                                                                                │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ UI STATE UPDATE                                                                  │
│   - success: true                                                               │
│   - Show success alert                                                          │
│   - Auto-redirect to /login after 2 seconds                                     │
│ Toast: "Email verified successfully!"                                           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 7. auth-resend-verification

**User Action** → **Database**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ USER ACTION                                                                      │
│ User clicks "Resend code" button                                                │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND HANDLER                                                                 │
│ File: quikadmin-web/src/pages/VerifyEmail.tsx:123-156                           │
│ Function: handleResend()                                                        │
│ Validations:                                                                     │
│   1. Email must be present                                                      │
│ Actions:                                                                         │
│   1. setIsResending(true)                                                       │
│   2. Call resendVerification(email) service                                     │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ API SERVICE                                                                      │
│ HTTP Request: POST /api/auth/v2/resend-verification                             │
│ Request Body: { email }                                                         │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ EXPRESS ROUTE                                                                    │
│ File: quikadmin/src/api/supabase-auth.routes.ts:1497-1593                       │
│ Route: POST /api/auth/v2/resend-verification                                    │
│ Middleware: authLimiter                                                         │
│ Flow:                                                                            │
│   1. Validate email (required, valid format)                                    │
│   2. Check if user exists in Prisma                                             │
│   3. Check if already verified (return error if so)                             │
│   4. Call Supabase resend                                                       │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ DATABASE OPERATIONS                                                              │
│                                                                                  │
│ Prisma:                                                                          │
│   READ: prisma.user.findUnique({                                                │
│     where: { email: normalizedEmail },                                          │
│     select: { id, email, emailVerified }                                        │
│   })                                                                             │
│                                                                                  │
│ Supabase Auth:                                                                  │
│   supabase.auth.resend({ type: 'signup', email: normalizedEmail })              │
│   - Sends new OTP code via email                                                │
│                                                                                  │
│ Tables Affected: User (read only)                                               │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ RESPONSE                                                                         │
│ HTTP 200 OK                                                                      │
│ {                                                                                │
│   success: true,                                                                │
│   message: "Verification code has been sent to your email..."                   │
│ }                                                                                │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ UI STATE UPDATE                                                                  │
│   - isResending: false                                                          │
│ Toast: "Verification email sent! Please check your inbox."                      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 8. auth-demo-login

**Status:** NOT IMPLEMENTED

The demo login button was not found in the Login.tsx source code. The backend endpoint exists at `POST /api/auth/v2/demo` but there is no corresponding UI element.

**Backend Implementation (for reference):**
```
Route: POST /api/auth/v2/demo
File: quikadmin/src/api/supabase-auth.routes.ts:1612-1755
Flow:
  1. Check ENABLE_DEMO_MODE environment variable
  2. Find demo user (demo@intellifill.com)
  3. Verify password (bcrypt)
  4. Generate demo JWT tokens (4hr expiry)
  5. Return demo user data with special demo flags
```

---

### 9. auth-remember-me-toggle

**User Action** → **Database**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ USER ACTION                                                                      │
│ User toggles "Remember me" checkbox                                             │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND HANDLER                                                                 │
│ File: quikadmin-web/src/pages/Login.tsx:339-341                                 │
│ Handler: onCheckedChange={(checked) => {                                        │
│   setFormData(prev => ({ ...prev, rememberMe: checked as boolean }))           │
│ }}                                                                               │
│                                                                                  │
│ Effect: Updates local formData state only                                       │
│ No API call on toggle - value sent with login request                           │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ IMPACT ON LOGIN                                                                  │
│ The rememberMe value is passed to the login API call                            │
│ Effects:                                                                         │
│   - Token expiry duration (longer for rememberMe)                               │
│   - Refresh token cookie maxAge adjustment                                      │
│                                                                                  │
│ Database: No direct storage of rememberMe preference                            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 10. auth-terms-toggle

**User Action** → **Effect**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ USER ACTION                                                                      │
│ User toggles terms acceptance checkbox                                          │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND HANDLER                                                                 │
│ File: quikadmin-web/src/pages/Register.tsx:449                                  │
│ Handler: onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}   │
│                                                                                  │
│ State: agreedToTerms (useToggle hook)                                           │
│ Effect: Submit button disabled when false                                       │
│ Value passed to register API as acceptTerms                                     │
│                                                                                  │
│ Database: Not stored (legal acceptance timestamp could be added)                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 11. auth-marketing-toggle

**User Action** → **Effect**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ USER ACTION                                                                      │
│ User toggles marketing consent checkbox                                         │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND HANDLER                                                                 │
│ File: quikadmin-web/src/pages/Register.tsx:477                                  │
│ Handler: onCheckedChange={(checked) => setMarketingConsent(checked as boolean)}│
│                                                                                  │
│ State: marketingConsent (useToggle hook)                                        │
│ Value passed to register API                                                    │
│                                                                                  │
│ Database: Could be stored in user_metadata (currently not persisted in Prisma) │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 12. auth-password-visibility-toggle

**User Action** → **Effect**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ USER ACTION                                                                      │
│ User clicks eye icon to show/hide password                                      │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND HANDLER                                                                 │
│ Locations:                                                                       │
│   - Login.tsx:321 - onClick={() => setShowPassword(!showPassword)}             │
│   - Register.tsx:365 - onClick={toggleShowPassword}                             │
│   - ResetPassword.tsx:238 - onClick={toggleShowPassword}                        │
│                                                                                  │
│ State: showPassword (boolean or useToggle hook)                                 │
│ Effect: Toggles input type between "password" and "text"                        │
│                                                                                  │
│ Database: No storage (UI-only state)                                            │
│ API: No network call                                                            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 13. invite-accept-mutation

**User Action** → **Database**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ USER ACTION                                                                      │
│ User clicks "Accept Invitation" button                                          │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND HANDLER                                                                 │
│ File: quikadmin-web/src/pages/AcceptInvitePage.tsx:295                          │
│ Handler: onClick={() => acceptMutation.mutate()}                                │
│                                                                                  │
│ TanStack Query Mutation:                                                        │
│ File: AcceptInvitePage.tsx:64-82                                                │
│ mutationFn: async () => acceptInvitation(token)                                 │
│ onSuccess: invalidate queries, show toast, navigate to /dashboard               │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ API SERVICE                                                                      │
│ File: quikadmin-web/src/services/organizationService.ts                         │
│ Function: acceptInvitation(token)                                               │
│ HTTP Request: POST /api/invites/:token/accept                                   │
│ Headers: Authorization: Bearer <accessToken>                                    │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ EXPRESS ROUTE                                                                    │
│ File: quikadmin/src/api/invitation.routes.ts:105-263                            │
│ Route: POST /api/invites/:token/accept                                          │
│ Middleware: authenticateSupabase, validateParams                                │
│ Flow:                                                                            │
│   1. Get userId/userEmail from auth                                             │
│   2. Find invitation by token (ID)                                              │
│   3. Verify email matches authenticated user                                    │
│   4. Check invitation status (must be PENDING)                                  │
│   5. Check expiration                                                           │
│   6. Check if user already a member                                             │
│   7. Execute transaction to accept                                              │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ DATABASE OPERATIONS (Transaction)                                               │
│                                                                                  │
│ 1. UPDATE invitation status:                                                    │
│    tx.organizationInvitation.update({                                           │
│      where: { id: token },                                                      │
│      data: { status: 'ACCEPTED', acceptedAt: new Date() }                       │
│    })                                                                            │
│                                                                                  │
│ 2. CREATE membership:                                                           │
│    tx.organizationMembership.create({                                           │
│      data: { userId, organizationId, role, status: 'ACTIVE',                    │
│              invitedBy, invitedAt, joinedAt }                                   │
│    })                                                                            │
│                                                                                  │
│ 3. UPDATE user (if no org):                                                     │
│    tx.user.update({                                                             │
│      where: { id: userId },                                                     │
│      data: { organizationId }                                                   │
│    })                                                                            │
│                                                                                  │
│ Tables Affected:                                                                │
│   - OrganizationInvitation (update status)                                      │
│   - OrganizationMembership (create)                                             │
│   - User (conditionally update organizationId)                                  │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ RESPONSE                                                                         │
│ HTTP 200 OK                                                                      │
│ {                                                                                │
│   success: true,                                                                │
│   message: "Invitation accepted successfully",                                  │
│   data: {                                                                       │
│     organization: { id, name, slug },                                           │
│     membership: { role, status, joinedAt }                                      │
│   }                                                                             │
│ }                                                                                │
└────────────────────────────────────┬────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ UI STATE UPDATE                                                                  │
│ TanStack Query:                                                                  │
│   - queryClient.invalidateQueries({ queryKey: ['organization'] })               │
│   - queryClient.invalidateQueries({ queryKey: ['myOrganization'] })             │
│                                                                                  │
│ Navigation: navigate('/dashboard', { replace: true })                           │
│ Toast: "You've joined {organization.name}!"                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary Table

| Element | Frontend File | API Endpoint | DB Tables Affected |
|---------|--------------|--------------|-------------------|
| auth-login-form | Login.tsx:65 | POST /api/auth/v2/login | User (R+U) |
| auth-register-form | Register.tsx:104 | POST /api/auth/v2/register | User (C) |
| auth-logout | AppLayout.tsx:167 | POST /api/auth/v2/logout | None |
| auth-forgot-password-form | ForgotPassword.tsx:27 | POST /api/auth/v2/forgot-password | None |
| auth-reset-password-form | ResetPassword.tsx:105 | POST /api/auth/v2/reset-password | None (Supabase) |
| auth-verify-email-form | VerifyEmail.tsx:56 | POST /api/auth/v2/verify-email | User (U) |
| auth-resend-verification | VerifyEmail.tsx:123 | POST /api/auth/v2/resend-verification | User (R) |
| auth-demo-login | NOT FOUND | POST /api/auth/v2/demo | User (R+U) |
| auth-remember-me-toggle | Login.tsx:339 | N/A (part of login) | None |
| auth-terms-toggle | Register.tsx:449 | N/A (part of register) | None |
| auth-marketing-toggle | Register.tsx:477 | N/A (part of register) | None |
| auth-password-visibility-toggle | Multiple | N/A (UI only) | None |
| invite-accept-mutation | AcceptInvitePage.tsx:295 | POST /api/invites/:token/accept | OrganizationInvitation, OrganizationMembership, User |

---

## External Services Dependency Map

| Service | Auth Elements Using It |
|---------|----------------------|
| Supabase Auth | All auth elements (login, register, logout, password reset, email verify) |
| Redis (Token Cache) | logout (token invalidation) |
| Prisma/PostgreSQL | All elements (user lookup, profile storage) |
| Email Service (via Supabase) | forgot-password, verify-email, resend-verification |

---

**Phase 5 Status:** COMPLETE
**Next Phase:** Phase 6 - TO-BE Design + ADR for Batch 1
