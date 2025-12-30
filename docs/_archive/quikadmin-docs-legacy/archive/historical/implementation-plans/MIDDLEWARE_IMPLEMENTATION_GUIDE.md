# Middleware Implementation Guide

## 🚀 Quick Start

This guide provides practical examples for implementing the enhanced middleware patterns identified in the review.

---

## Backend Implementation

### 1. Update Main Application Entry Point

```typescript
// src/index.ts - Enhanced middleware setup

import express from 'express';
import dotenv from 'dotenv';
import {
  validateEnvironment,
  securityHeaders,
  requestContext,
  performanceMonitor,
  sanitizeRequest,
  compose,
  asyncHandler,
} from './middleware/security';
import { authenticate, authorize } from './middleware/auth';

dotenv.config();

// Validate environment variables on startup
validateEnvironment(['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL', 'REDIS_URL', 'NODE_ENV']);

const app = express();

// Global middleware stack (order matters!)
app.use(securityHeaders); // Security headers first
app.use(requestContext); // Add request tracking
app.use(performanceMonitor(1000)); // Monitor slow requests
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeRequest); // Sanitize input data

// Health check (public)
app.get('/health', cacheControl({ maxAge: 60 }), (req, res) => {
  res.json({ status: 'ok' });
});

// Protected routes with composed middleware
app.use('/api/admin', compose(authenticate, authorize('admin'), adaptiveRateLimiter.middleware));

// API routes with signature verification
app.use(
  '/api/webhook',
  compose(
    verifyRequestSignature(process.env.WEBHOOK_SECRET!),
    express.raw({ type: 'application/json' })
  )
);
```

### 2. Enhanced Route Implementation

```typescript
// src/api/routes.ts - Using async handler

import { Router } from 'express';
import { asyncHandler, compose } from '../middleware/security';
import { authenticate, uploadLimiter } from '../middleware/auth';

const router = Router();

// Process document with multiple middleware
router.post(
  '/process',
  compose(authenticate, uploadLimiter, upload.single('document')),
  asyncHandler(async (req, res) => {
    // No try-catch needed - asyncHandler handles errors
    const result = await processDocument(req.file);
    res.json({ success: true, data: result });
  })
);

// Batch processing with validation
router.post(
  '/batch',
  authenticate,
  asyncHandler(async (req, res) => {
    const { documents } = req.body;

    if (!Array.isArray(documents)) {
      throw new ValidationError('Documents must be an array');
    }

    const results = await Promise.all(documents.map((doc) => processDocument(doc)));

    res.json({ success: true, data: results });
  })
);
```

### 3. Error Handling Implementation

```typescript
// src/middleware/errorHandler.ts

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request & { id?: string },
  res: Response,
  next: NextFunction
) => {
  const requestId = req.id || 'unknown';

  // Log error with context
  logger.error({
    requestId,
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Handle known errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      requestId,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      requestId,
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.message,
      requestId,
    });
  }

  // Default error
  const isDevelopment = process.env.NODE_ENV === 'development';
  res.status(500).json({
    error: isDevelopment ? err.message : 'Internal server error',
    requestId,
    ...(isDevelopment && { stack: err.stack }),
  });
};
```

---

## Frontend Implementation

### 1. Enhanced Auth Store with Middleware

```typescript
// src/stores/authStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  errorBoundary,
  performanceMonitor,
  validator,
  composeMiddleware,
} from './middleware/enhanced';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginData) => Promise<void>;
  logout: () => void;
}

// Validation schema
const authSchema = (state: AuthState) => {
  if (state.isAuthenticated && !state.user) {
    return { valid: false, errors: ['Authenticated but no user data'] };
  }

  if (state.token && !state.isAuthenticated) {
    return { valid: false, errors: ['Token exists but not authenticated'] };
  }

  return { valid: true };
};

// Create store with composed middleware
export const useAuthStore = create<AuthState>()(
  composeMiddleware(
    errorBoundary, // Error handling
    performanceMonitor({ threshold: 10 }), // Performance tracking
    validator(authSchema), // State validation
    persist // Persistence
  )(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (credentials) => {
        try {
          const response = await api.post('/auth/login', credentials);
          const { user, token } = response.data;

          set({
            user,
            token,
            isAuthenticated: true,
          });
        } catch (error) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          });
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
      }),
    }
  )
);
```

### 2. Document Store with Undo/Redo

```typescript
// src/stores/documentStore.ts

import { create } from 'zustand';
import { undoRedo, debounce, computed } from './middleware/enhanced';

interface DocumentState {
  documents: Document[];
  selectedId: string | null;
  searchQuery: string;
  addDocument: (doc: Document) => void;
  removeDocument: (id: string) => void;
  setSearchQuery: (query: string) => void;
}

interface ComputedState {
  selectedDocument: Document | null;
  filteredDocuments: Document[];
  documentCount: number;
}

export const useDocumentStore = create<
  DocumentState &
    ComputedState & {
      undo: () => void;
      redo: () => void;
      canUndo: () => boolean;
      canRedo: () => boolean;
    }
>()(
  undoRedo(
    computed(
      debounce(
        (set, get) => ({
          documents: [],
          selectedId: null,
          searchQuery: '',

          addDocument: (doc) =>
            set((state) => ({
              documents: [...state.documents, doc],
            })),

          removeDocument: (id) =>
            set((state) => ({
              documents: state.documents.filter((d) => d.id !== id),
              selectedId: state.selectedId === id ? null : state.selectedId,
            })),

          setSearchQuery: (query) => set({ searchQuery: query }),
        }),
        300 // Debounce search updates
      ),
      // Computed properties
      (state) => ({
        selectedDocument: state.documents.find((d) => d.id === state.selectedId) || null,
        filteredDocuments: state.documents.filter((d) =>
          d.name.toLowerCase().includes(state.searchQuery.toLowerCase())
        ),
        documentCount: state.documents.length,
      })
    ),
    { limit: 50 } // Keep last 50 states for undo
  )
);
```

### 3. Settings Store with Encryption

```typescript
// src/stores/settingsStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { encrypted, errorBoundary } from './middleware/enhanced';
import CryptoJS from 'crypto-js';

interface SettingsState {
  apiKey: string | null;
  webhookUrl: string | null;
  theme: 'light' | 'dark';
  notifications: boolean;
  updateApiKey: (key: string) => void;
  updateWebhookUrl: (url: string) => void;
}

const SECRET = process.env.REACT_APP_ENCRYPTION_KEY || 'dev-key';

export const useSettingsStore = create<SettingsState>()(
  errorBoundary(
    encrypted(
      persist(
        (set) => ({
          apiKey: null,
          webhookUrl: null,
          theme: 'light',
          notifications: true,

          updateApiKey: (key) => set({ apiKey: key }),
          updateWebhookUrl: (url) => set({ webhookUrl: url }),
        }),
        {
          name: 'settings-storage',
          partialize: (state) => ({
            apiKey: state.apiKey,
            webhookUrl: state.webhookUrl,
            theme: state.theme,
            notifications: state.notifications,
          }),
        }
      ),
      {
        encryptFields: ['apiKey', 'webhookUrl'],
        encryptFn: (value) => CryptoJS.AES.encrypt(value, SECRET).toString(),
        decryptFn: (value) => CryptoJS.AES.decrypt(value, SECRET).toString(CryptoJS.enc.Utf8),
      }
    )
  )
);
```

---

## Testing Middleware

### Backend Middleware Tests

```typescript
// src/middleware/__tests__/security.test.ts

import request from 'supertest';
import express from 'express';
import { asyncHandler, requestContext, compose } from '../security';

describe('Security Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('asyncHandler', () => {
    it('should handle async errors', async () => {
      app.get(
        '/test',
        asyncHandler(async (req, res) => {
          throw new Error('Test error');
        })
      );

      app.use((err, req, res, next) => {
        res.status(500).json({ error: err.message });
      });

      const response = await request(app).get('/test');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Test error');
    });

    it('should pass through successful responses', async () => {
      app.get(
        '/test',
        asyncHandler(async (req, res) => {
          res.json({ success: true });
        })
      );

      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('requestContext', () => {
    it('should add request ID', async () => {
      app.use(requestContext);
      app.get('/test', (req: any, res) => {
        res.json({ requestId: req.id });
      });

      const response = await request(app).get('/test');
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.body.requestId).toBeDefined();
    });
  });

  describe('compose', () => {
    it('should execute middleware in order', async () => {
      const order: number[] = [];

      const middleware1 = (req, res, next) => {
        order.push(1);
        next();
      };

      const middleware2 = (req, res, next) => {
        order.push(2);
        next();
      };

      const middleware3 = (req, res, next) => {
        order.push(3);
        next();
      };

      app.use('/test', compose(middleware1, middleware2, middleware3));
      app.get('/test', (req, res) => {
        res.json({ order });
      });

      const response = await request(app).get('/test');
      expect(response.body.order).toEqual([1, 2, 3]);
    });
  });
});
```

### Frontend Store Tests

```typescript
// src/stores/__tests__/middleware.test.ts

import { renderHook, act } from '@testing-library/react-hooks';
import { create } from 'zustand';
import { errorBoundary, performanceMonitor, undoRedo } from '../middleware/enhanced';

describe('Enhanced Middleware', () => {
  describe('errorBoundary', () => {
    it('should catch errors in state updates', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      const useStore = create(
        errorBoundary((set) => ({
          value: 0,
          throwError: () =>
            set(() => {
              throw new Error('Test error');
            }),
          setValue: (value: number) => set({ value }),
        }))
      );

      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.throwError();
      });

      expect(result.current.value).toBe(0); // State unchanged
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('[Store Error]'),
        expect.any(Error)
      );

      consoleError.mockRestore();
    });
  });

  describe('undoRedo', () => {
    it('should support undo and redo operations', () => {
      const useStore = create(
        undoRedo((set) => ({
          value: 0,
          increment: () => set((state) => ({ value: state.value + 1 })),
        }))
      );

      const { result } = renderHook(() => useStore());

      // Initial state
      expect(result.current.value).toBe(0);
      expect(result.current.canUndo()).toBe(false);

      // Make changes
      act(() => {
        result.current.increment();
        result.current.increment();
      });

      expect(result.current.value).toBe(2);
      expect(result.current.canUndo()).toBe(true);

      // Undo
      act(() => {
        result.current.undo();
      });

      expect(result.current.value).toBe(1);
      expect(result.current.canRedo()).toBe(true);

      // Redo
      act(() => {
        result.current.redo();
      });

      expect(result.current.value).toBe(2);
    });
  });
});
```

---

## Migration Checklist

### Backend Migration

- [ ] Install required packages: `npm install helmet csurf compression`
- [ ] Create `src/middleware/security.ts` with enhanced middleware
- [ ] Update `src/index.ts` to use new middleware stack
- [ ] Add environment variable validation
- [ ] Replace hardcoded secrets with environment variables
- [ ] Add request context middleware for tracking
- [ ] Implement async error wrapper for all routes
- [ ] Add security headers with helmet
- [ ] Set up response compression
- [ ] Configure CSRF protection
- [ ] Add request signature verification for webhooks
- [ ] Implement adaptive rate limiting
- [ ] Add performance monitoring
- [ ] Update error handling middleware
- [ ] Write tests for new middleware

### Frontend Migration

- [ ] Create `src/stores/middleware/enhanced.ts`
- [ ] Add error boundary middleware to stores
- [ ] Implement performance monitoring for stores
- [ ] Add undo/redo capability where needed
- [ ] Implement state validation
- [ ] Add encryption for sensitive data
- [ ] Configure debounced updates for search
- [ ] Add computed properties middleware
- [ ] Update existing stores to use new middleware
- [ ] Write tests for middleware functionality

---

## Performance Metrics

### Expected Improvements

- **Request Processing**: 15-20% faster with async handlers
- **Error Recovery**: 90% reduction in unhandled errors
- **Security Score**: A+ rating on security headers test
- **Store Updates**: 30% reduction in unnecessary re-renders
- **Memory Usage**: 20% reduction with debounced updates

### Monitoring Setup

```typescript
// src/utils/metrics.ts

import { Registry, Counter, Histogram } from 'prom-client';

export const register = new Registry();

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

---

## Troubleshooting

### Common Issues

1. **TypeScript errors with middleware composition**
   - Ensure all middleware functions have proper type annotations
   - Use generic constraints for reusable middleware

2. **Performance degradation with multiple middleware**
   - Profile with Chrome DevTools
   - Use performance monitoring middleware to identify bottlenecks
   - Consider selective middleware application

3. **State persistence conflicts**
   - Clear localStorage when changing store structure
   - Version your persistence schema
   - Use migration utilities for schema changes

---

## Resources

- [Express Middleware Guide](https://expressjs.com/en/guide/using-middleware.html)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

_Last Updated: January 2025_
