---
title: "Implementing Authentication Guide"
description: "Step-by-step guide to implementing authentication in QuikAdmin applications, including backend middleware, frontend SDK integration, testing, and troubleshooting"
category: developer-guide
tags: [guide, authentication, implementation, backend, frontend, supabase, middleware]
lastUpdated: 2025-01-11
relatedDocs:
  - ../../architecture/current/auth-flow.md
  - ../../api/reference/authentication.md
  - ../../300-api/302-supabase-setup.md
---

# Implementing Authentication Guide

**Target Audience:** Developers integrating QuikAdmin authentication
**Difficulty:** Intermediate
**Time:** 2-4 hours
**Last Updated:** 2025-01-11

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Backend Implementation](#backend-implementation)
- [Frontend Implementation](#frontend-implementation)
- [Testing Authentication](#testing-authentication)
- [Common Patterns](#common-patterns)
- [Migration Guide](#migration-guide)
- [Troubleshooting](#troubleshooting)
- [Security Checklist](#security-checklist)
- [Best Practices](#best-practices)

---

## Prerequisites

### Required Knowledge
- Node.js fundamentals
- TypeScript basics
- REST API concepts
- JWT authentication basics
- React (for frontend integration)

### System Requirements
- **Node.js:** 20.x or higher
- **npm/bun:** Latest version
- **Supabase Account:** Free tier (for Supabase Auth)
- **PostgreSQL:** 14+ (for database)

### Environment Setup

Create a `.env` file in your project root:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/quikadmin"

# Supabase Configuration (Recommended)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Legacy JWT (Optional - for migration)
JWT_SECRET=your-secret-key-minimum-64-characters-with-high-entropy
JWT_REFRESH_SECRET=your-refresh-secret-key-minimum-64-characters
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
JWT_ISSUER=quikadmin-api
JWT_AUDIENCE=quikadmin-client

# Environment
NODE_ENV=development
PORT=3002
```

**Get Supabase Credentials:**
1. Go to [app.supabase.com](https://app.supabase.com)
2. Create or select your project
3. Go to **Settings → API**
4. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon/public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

---

## Backend Implementation

### Step 1: Install Dependencies

```bash
# Core dependencies
npm install @supabase/supabase-js express bcrypt jsonwebtoken

# TypeScript types
npm install -D @types/express @types/bcrypt @types/jsonwebtoken

# Database
npm install @prisma/client
npm install -D prisma

# Security
npm install helmet cors express-rate-limit
```

### Step 2: Configure Supabase Client

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

// Validate environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

// Create admin client (server-side only)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
```

**⚠️ Security Warning:**
- **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend
- Only use service role key on backend
- Use `SUPABASE_ANON_KEY` for frontend

### Step 3: Create Authentication Middleware

Create `src/middleware/supabaseAuth.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { prisma } from '../lib/prisma';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        supabaseUserId: string;
        firstName?: string;
        lastName?: string;
      };
      supabaseUser?: any;
    }
  }
}

/**
 * Authenticate request using Supabase JWT
 * Requires valid access token in Authorization header
 */
export async function authenticateSupabase(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Extract Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing Authorization header',
      });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid Authorization header format. Expected: Bearer <token>',
      });
      return;
    }

    // 2. Extract token
    const token = authHeader.substring(7);

    // 3. Token format validation
    if (!token || token.length < 20 || token.length > 2048) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token format',
      });
      return;
    }

    // 4. Verify token with Supabase (server-side)
    const { data: { user: supabaseUser }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !supabaseUser) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
      return;
    }

    // 5. Load user from Prisma database
    const user = await prisma.user.findUnique({
      where: { id: supabaseUser.id },
    });

    if (!user) {
      res.status(404).json({
        error: 'User not found',
        message: 'User not found in database',
      });
      return;
    }

    // 6. Check account status
    if (!user.isActive) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED',
      });
      return;
    }

    // 7. Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      supabaseUserId: supabaseUser.id,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    req.supabaseUser = supabaseUser;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
  }
}

/**
 * Authorize user based on role
 * Must be used after authenticateSupabase
 */
export function authorizeSupabase(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const userRole = req.user.role.toLowerCase();
    const allowed = allowedRoles.map(r => r.toLowerCase());

    if (!allowed.includes(userRole)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}

/**
 * Optional authentication - attach user if authenticated, but don't fail
 */
export async function optionalAuthSupabase(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);

    const { data: { user: supabaseUser }, error } = await supabaseAdmin.auth.getUser(token);

    if (!error && supabaseUser) {
      const user = await prisma.user.findUnique({
        where: { id: supabaseUser.id },
      });

      if (user && user.isActive) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          supabaseUserId: supabaseUser.id,
          firstName: user.firstName,
          lastName: user.lastName,
        };

        req.supabaseUser = supabaseUser;
      }
    }

    next();
  } catch (error) {
    // Silently continue without user
    next();
  }
}
```

### Step 4: Create Authentication Routes

Create `src/routes/auth.ts`:

```typescript
import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { prisma } from '../lib/prisma';
import { authenticateSupabase } from '../middleware/supabaseAuth';

const router = Router();

/**
 * POST /api/auth/v2/register
 * Register a new user
 */
router.post('/v2/register', async (req, res) => {
  try {
    const { email, password, fullName, role = 'user' } = req.body;

    // Validation
    if (!email || !password || !fullName) {
      return res.status(400).json({
        error: 'Email, password, and full name are required',
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long',
      });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return res.status(400).json({
        error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      });
    }

    // Parse full name
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create user in Supabase
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: process.env.NODE_ENV === 'development', // Auto-confirm in dev
      user_metadata: {
        firstName,
        lastName,
        role,
      },
    });

    if (error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: 'User with this email already exists',
        });
      }

      console.error('Supabase registration error:', error);
      return res.status(500).json({
        error: 'Failed to create user',
        details: error.message,
      });
    }

    // Create user in Prisma database
    const user = await prisma.user.create({
      data: {
        id: data.user!.id,
        email: email.toLowerCase(),
        firstName,
        lastName,
        role: role.toUpperCase(),
        isActive: true,
        emailVerified: process.env.NODE_ENV === 'development',
      },
    });

    // Sign in to get session tokens
    const { data: sessionData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (signInError) {
      console.error('Auto sign-in error:', signInError);
      return res.status(500).json({
        error: 'User created but sign-in failed',
      });
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          emailVerified: user.emailVerified,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        tokens: {
          accessToken: sessionData.session!.access_token,
          refreshToken: sessionData.session!.refresh_token,
          expiresIn: 3600, // 1 hour
          tokenType: 'Bearer',
        },
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to register user',
    });
  }
});

/**
 * POST /api/auth/v2/login
 * Authenticate user
 */
router.post('/v2/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
      });
    }

    // Sign in with Supabase
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (error) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    // Load user from database
    const user = await prisma.user.findUnique({
      where: { id: data.user!.id },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found in database',
      });
    }

    // Check account status
    if (!user.isActive) {
      return res.status(403).json({
        error: 'Account is deactivated. Please contact support.',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          emailVerified: user.emailVerified,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
        },
        tokens: {
          accessToken: data.session!.access_token,
          refreshToken: data.session!.refresh_token,
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to login',
    });
  }
});

/**
 * POST /api/auth/v2/logout
 * Logout user (invalidate all sessions)
 */
router.post('/v2/logout', authenticateSupabase, async (req, res) => {
  try {
    // Sign out globally (all devices)
    await supabaseAdmin.auth.admin.signOut(req.user!.supabaseUserId);

    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Return success anyway (idempotent operation)
    res.json({
      success: true,
      message: 'Logout successful',
    });
  }
});

/**
 * POST /api/auth/v2/refresh
 * Refresh access token
 */
router.post('/v2/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token is required',
      });
    }

    // Refresh session with Supabase
    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      return res.status(401).json({
        error: 'Invalid or expired refresh token',
      });
    }

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        tokens: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
      },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to refresh token',
    });
  }
});

/**
 * GET /api/auth/v2/me
 * Get current user profile
 */
router.get('/v2/me', authenticateSupabase, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          full_name: `${user.firstName} ${user.lastName}`.trim(),
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          is_active: user.isActive,
          email_verified: user.emailVerified,
          created_at: user.createdAt,
          updated_at: user.updatedAt,
          last_login: user.lastLogin,
          supabase_user_id: req.user!.supabaseUserId,
        },
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get user',
    });
  }
});

/**
 * POST /api/auth/v2/change-password
 * Change user password
 */
router.post('/v2/change-password', authenticateSupabase, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and new password are required',
      });
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long',
      });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({
        error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      });
    }

    // Verify current password by attempting sign-in
    const { error: verifyError } = await supabaseAdmin.auth.signInWithPassword({
      email: req.user!.email,
      password: currentPassword,
    });

    if (verifyError) {
      return res.status(400).json({
        error: 'Current password is incorrect',
      });
    }

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      req.user!.supabaseUserId,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Password update error:', updateError);
      return res.status(500).json({
        error: 'Failed to update password',
      });
    }

    // Sign out all sessions (security best practice)
    await supabaseAdmin.auth.admin.signOut(req.user!.supabaseUserId);

    res.json({
      success: true,
      message: 'Password changed successfully. Please login again with your new password.',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to change password',
    });
  }
});

export default router;
```

### Step 5: Protect Routes

Apply middleware to protected routes:

```typescript
import { Router } from 'express';
import { authenticateSupabase, authorizeSupabase } from '../middleware/supabaseAuth';

const router = Router();

// Public route - no authentication
router.get('/public/stats', (req, res) => {
  res.json({ stats: 'public data' });
});

// Protected route - authentication required
router.get('/documents', authenticateSupabase, async (req, res) => {
  // req.user is guaranteed to exist
  const documents = await prisma.document.findMany({
    where: { userId: req.user!.id },
  });

  res.json({ documents });
});

// Admin-only route - authentication + authorization
router.delete(
  '/admin/users/:id',
  authenticateSupabase,
  authorizeSupabase(['admin']),
  async (req, res) => {
    // Only admins reach here
    await prisma.user.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  }
);

export default router;
```

---

## Frontend Implementation

### Step 1: Install Frontend Dependencies

```bash
cd web

# Core dependencies
npm install @supabase/supabase-js axios zustand

# TypeScript types
npm install -D @types/node
```

### Step 2: Configure Supabase Client

Create `web/src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

// Validate environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create client for frontend use
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,      // Auto-refresh before expiry
    persistSession: true,         // Save to localStorage
    detectSessionInUrl: true,     // For OAuth redirects
    storageKey: 'quikadmin-supabase-auth',
  },
});
```

**Frontend `.env` file:**

```bash
# web/.env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3002/api
```

### Step 3: Create Auth Store

Create `web/src/stores/authStore.ts`:

```typescript
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import axios from 'axios';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AuthState {
  user: User | null;
  tokens: Tokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  initialize: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  fullName: string;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/auth/v2/login`, {
        email,
        password,
      });

      const { user, tokens } = response.data.data;

      set({
        user,
        tokens,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Login failed',
        isLoading: false,
      });
      throw error;
    }
  },

  register: async (data: RegisterData) => {
    set({ isLoading: true, error: null });

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/auth/v2/register`, data);

      const { user, tokens } = response.data.data;

      set({
        user,
        tokens,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Registration failed',
        isLoading: false,
      });
      throw error;
    }
  },

  logout: async () => {
    try {
      const { tokens } = get();

      if (tokens?.accessToken) {
        await axios.post(
          `${import.meta.env.VITE_API_URL}/auth/v2/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
            },
          }
        );
      }

      // Sign out from Supabase
      await supabase.auth.signOut();

      set({
        user: null,
        tokens: null,
        isAuthenticated: false,
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Clear state anyway
      set({
        user: null,
        tokens: null,
        isAuthenticated: false,
      });
    }
  },

  refreshToken: async () => {
    const { tokens } = get();

    if (!tokens?.refreshToken) {
      return;
    }

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/auth/v2/refresh`, {
        refreshToken: tokens.refreshToken,
      });

      const newTokens = response.data.data.tokens;

      set({ tokens: newTokens });
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Logout on refresh failure
      get().logout();
    }
  },

  initialize: async () => {
    set({ isLoading: true });

    try {
      // Check Supabase session
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Verify with backend
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/auth/v2/me`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        set({
          user: response.data.data.user,
          tokens: {
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresIn: 3600,
          },
          isAuthenticated: true,
        });
      }
    } catch (error) {
      console.error('Session restoration failed:', error);
    } finally {
      set({ isLoading: false });
    }
  },
}));
```

### Step 4: Create API Client with Interceptors

Create `web/src/services/api.ts`:

```typescript
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  async (config) => {
    const { tokens } = useAuthStore.getState();

    // Primary: Use Zustand-stored token
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    // Fallback: Get from Supabase directly
    else {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401 and auto-refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh session
        const { data } = await supabase.auth.refreshSession();

        if (data.session) {
          // Update tokens in store
          useAuthStore.setState({
            tokens: {
              accessToken: data.session.access_token,
              refreshToken: data.session.refresh_token,
              expiresIn: 3600,
            },
          });

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${data.session.access_token}`;
          return api(originalRequest);
        } else {
          // Refresh failed, logout user
          await useAuthStore.getState().logout();
          window.location.href = '/login';
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        await useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

### Step 5: Create Login Component

Create `web/src/pages/Login.tsx`:

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      // Error handled by store
      console.error('Login failed:', err);
    }
  };

  return (
    <div className="login-page">
      <h1>Login</h1>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
```

### Step 6: Create Protected Route Component

Create `web/src/components/ProtectedRoute.tsx`:

```typescript
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

### Step 7: Initialize Auth on App Start

Update `web/src/App.tsx`:

```typescript
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

export default function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    // Restore session on app load
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## Testing Authentication

### Manual Testing

#### Test Registration

```bash
curl -X POST http://localhost:3002/api/auth/v2/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "fullName": "Test User"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": { ... },
    "tokens": {
      "accessToken": "...",
      "refreshToken": "..."
    }
  }
}
```

#### Test Login

```bash
curl -X POST http://localhost:3002/api/auth/v2/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'
```

#### Test Protected Route

```bash
# Save access token from login response
ACCESS_TOKEN="your-access-token-here"

curl -X GET http://localhost:3002/api/auth/v2/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Integration Tests

Create `tests/auth.test.ts`:

```typescript
import request from 'supertest';
import { app } from '../src/index';

describe('Authentication', () => {
  let accessToken: string;

  it('should register a new user', async () => {
    const response = await request(app)
      .post('/api/auth/v2/register')
      .send({
        email: 'test@example.com',
        password: 'TestPass123!',
        fullName: 'Test User',
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe('test@example.com');
    expect(response.body.data.tokens.accessToken).toBeTruthy();

    accessToken = response.body.data.tokens.accessToken;
  });

  it('should login existing user', async () => {
    const response = await request(app)
      .post('/api/auth/v2/login')
      .send({
        email: 'test@example.com',
        password: 'TestPass123!',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.tokens.accessToken).toBeTruthy();
  });

  it('should reject invalid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/v2/login')
      .send({
        email: 'test@example.com',
        password: 'WrongPassword',
      })
      .expect(401);

    expect(response.body.error).toBeTruthy();
  });

  it('should access protected route with valid token', async () => {
    const response = await request(app)
      .get('/api/auth/v2/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data.user.email).toBe('test@example.com');
  });

  it('should reject protected route without token', async () => {
    await request(app)
      .get('/api/auth/v2/me')
      .expect(401);
  });
});
```

---

## Common Patterns

### Pattern 1: Automatic Token Refresh

```typescript
// Already implemented in API client interceptor
// Automatically refreshes token on 401 errors
// Retries original request with new token
```

### Pattern 2: Role-Based UI

```typescript
import { useAuthStore } from '../stores/authStore';

export default function AdminPanel() {
  const { user } = useAuthStore();

  if (user?.role !== 'ADMIN') {
    return <div>Access denied</div>;
  }

  return <div>Admin panel content</div>;
}
```

### Pattern 3: Logout on Inactivity

```typescript
import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

export default function App() {
  const { logout, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return;

    let timeout: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        logout();
        alert('Logged out due to inactivity');
      }, 30 * 60 * 1000); // 30 minutes
    };

    // Reset timer on user activity
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keypress', resetTimer);

    resetTimer(); // Initial timer

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keypress', resetTimer);
    };
  }, [isAuthenticated, logout]);

  // ... rest of app
}
```

---

## Migration Guide

### From Legacy JWT to Supabase Auth

#### Step 1: Identify Existing Auth Code

```bash
# Find all files using legacy auth
grep -r "jwt.sign" src/
grep -r "PrismaAuthService" src/
grep -r "/api/auth/login" src/
```

#### Step 2: Update Backend Routes

**Before (Legacy):**
```typescript
import { authenticate } from '../middleware/auth';

router.get('/documents', authenticate, handler);
```

**After (Supabase):**
```typescript
import { authenticateSupabase } from '../middleware/supabaseAuth';

router.get('/documents', authenticateSupabase, handler);
```

#### Step 3: Update Frontend API Calls

**Before (Legacy):**
```typescript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});
```

**After (Supabase):**
```typescript
const response = await fetch('/api/auth/v2/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});
```

#### Step 4: Migrate Users

Create migration script `scripts/migrate-users-to-supabase.ts`:

```typescript
import { prisma } from '../src/lib/prisma';
import { supabaseAdmin } from '../src/lib/supabase';

async function migrateUsers() {
  const users = await prisma.user.findMany({
    where: {
      supabaseUserId: null, // Not yet migrated
    },
  });

  for (const user of users) {
    console.log(`Migrating user: ${user.email}`);

    // Create in Supabase (requires password reset)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: user.email,
      email_confirm: true,
      user_metadata: {
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });

    if (error) {
      console.error(`Failed to migrate ${user.email}:`, error);
      continue;
    }

    // Update Prisma record
    await prisma.user.update({
      where: { id: user.id },
      data: {
        id: data.user!.id, // Update to match Supabase ID
        supabaseUserId: data.user!.id,
      },
    });

    console.log(`✅ Migrated: ${user.email}`);
  }

  console.log('Migration complete!');
}

migrateUsers();
```

**Run migration:**
```bash
npx ts-node scripts/migrate-users-to-supabase.ts
```

---

## Troubleshooting

### Issue: "Missing Supabase environment variables"

**Cause:** Environment variables not set

**Solution:**
1. Copy `.env.example` to `.env`
2. Add Supabase credentials from dashboard
3. Restart server

### Issue: "Invalid or expired token"

**Causes:**
- Token actually expired (> 1 hour old)
- Wrong token type (using refresh token as access token)
- Supabase project misconfigured

**Solutions:**
1. Check token age - refresh if > 1 hour
2. Verify using correct token type
3. Test token at https://jwt.io
4. Check Supabase dashboard for project status

### Issue: "User not found in database"

**Cause:** User exists in Supabase but not Prisma

**Solution:**
1. Check user ID matches between Supabase and Prisma
2. Run database sync script
3. Verify user migration completed

### Issue: "CORS error"

**Cause:** Frontend origin not allowed

**Solution:**

Update CORS configuration in `src/index.ts`:

```typescript
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://your-frontend.com',
  ],
  credentials: true,
}));
```

### Issue: "Rate limit exceeded"

**Cause:** Too many requests in short time

**Solution:**
1. Wait for rate limit window to reset
2. Check `X-RateLimit-Reset` header for reset time
3. Implement exponential backoff in client

---

## Security Checklist

Before deploying to production:

- [ ] **Environment Variables**
  - [ ] All secrets stored in `.env` (not committed to git)
  - [ ] Production secrets are different from development
  - [ ] Minimum 64-character secrets with high entropy
  - [ ] `.env` file in `.gitignore`

- [ ] **HTTPS**
  - [ ] Production API uses HTTPS only
  - [ ] Frontend uses HTTPS only
  - [ ] No mixed content warnings

- [ ] **CORS**
  - [ ] Production origins configured
  - [ ] Wildcard (`*`) not used in production
  - [ ] Credentials enabled only for trusted origins

- [ ] **Rate Limiting**
  - [ ] Rate limits enabled on all auth endpoints
  - [ ] Stricter limits for login/register
  - [ ] Rate limit headers included in responses

- [ ] **Token Security**
  - [ ] Access tokens short-lived (15 min - 1 hour)
  - [ ] Refresh tokens rotated on use
  - [ ] Tokens not exposed in URLs or logs
  - [ ] Service role key never exposed to frontend

- [ ] **Password Security**
  - [ ] Password complexity enforced
  - [ ] Passwords hashed (bcrypt/Supabase)
  - [ ] Password reset flow implemented
  - [ ] No password hints or recovery questions

- [ ] **Session Management**
  - [ ] Sessions invalidated on logout
  - [ ] Sessions invalidated on password change
  - [ ] Session timeout implemented
  - [ ] Multiple device sessions handled

- [ ] **Error Handling**
  - [ ] Generic error messages (no sensitive data leaks)
  - [ ] Errors logged server-side
  - [ ] Stack traces hidden in production
  - [ ] Rate limit errors handled gracefully

- [ ] **Monitoring**
  - [ ] Failed login attempts logged
  - [ ] Unusual activity detected
  - [ ] Security events alerted
  - [ ] Performance metrics tracked

---

## Best Practices

### 1. Token Storage

**✅ Do:**
- Store access token in memory or secure httpOnly cookie
- Use Supabase SDK for automatic token management
- Clear tokens on logout

**❌ Don't:**
- Store tokens in plain localStorage (XSS risk)
- Share tokens between apps
- Log tokens

### 2. Error Handling

**✅ Do:**
```typescript
try {
  await login(email, password);
} catch (error) {
  if (error.response?.status === 401) {
    setError('Invalid credentials');
  } else {
    setError('Something went wrong');
  }
}
```

**❌ Don't:**
```typescript
catch (error) {
  setError(error.message); // Might expose sensitive details
}
```

### 3. Password Validation

**✅ Do:**
- Enforce minimum 8 characters
- Require uppercase, lowercase, number
- Use zxcvbn or similar for strength estimation
- Validate on both frontend and backend

**❌ Don't:**
- Allow weak passwords
- Only validate client-side
- Store passwords in plain text
- Log passwords

### 4. API Client

**✅ Do:**
- Use interceptors for automatic token injection
- Implement automatic token refresh
- Handle 401 errors gracefully
- Use timeout for requests

**❌ Don't:**
- Manually add tokens to every request
- Ignore 401 errors
- Allow infinite retry loops
- Skip error handling

### 5. Session Management

**✅ Do:**
- Validate session on app load
- Implement automatic logout on inactivity
- Clear session data on logout
- Handle multiple tabs/windows

**❌ Don't:**
- Trust client-side session state alone
- Allow indefinite sessions
- Skip server-side validation
- Share sessions between apps

---

## Next Steps

### For Beginners
1. Start with basic login/register flow
2. Add protected routes
3. Implement token refresh
4. Add error handling
5. Test thoroughly

### For Advanced Users
1. Implement 2FA/MFA (Supabase feature)
2. Add OAuth providers (Google, GitHub)
3. Implement session management dashboard
4. Add security event logging
5. Performance optimization

### Resources
- **Architecture:** [Authentication Flow Architecture](../../architecture/current/auth-flow.md)
- **API Reference:** [Authentication API Reference](../../api/reference/authentication.md)
- **Supabase Docs:** https://supabase.com/docs/guides/auth
- **Security Guide:** [Security Architecture](../../architecture/204-security-architecture.md)

---

**Questions?**
- Check [Troubleshooting](#troubleshooting) section
- See [Common Patterns](#common-patterns) for examples
- Review [API Reference](../../api/reference/authentication.md) for endpoint details

---

**Last Updated:** 2025-01-11
**Version:** 2.0
**Status:** Production Ready
