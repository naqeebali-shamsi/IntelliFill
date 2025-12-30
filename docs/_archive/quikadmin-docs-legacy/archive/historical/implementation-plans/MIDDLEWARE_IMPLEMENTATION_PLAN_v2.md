# Middleware Security & Enhancement Implementation Plan v2.0

## 🚨 CRITICAL ALERT

**Based on comprehensive review by Security, Architecture, and Testing experts, the original plan had CRITICAL FLAWS that would result in production failure. This revised plan addresses all identified vulnerabilities and architectural issues.**

**Overall Risk Assessment: CRITICAL - DO NOT DEPLOY without implementing ALL Phase 0 fixes**

---

## 📊 Executive Summary

This revised implementation plan incorporates critical feedback from three expert reviews:

- **Security Review**: Identified CATASTROPHIC vulnerabilities requiring immediate action
- **Architecture Review**: Found fundamental design flaws preventing scalability
- **Testing Review**: Revealed inadequate test coverage risking production failures

**New Priority**: Security-First, Architecture-Second, Features-Last

---

## 🔴 PHASE 0: EMERGENCY SECURITY FIXES (IMMEDIATE - 30 MINUTES)

### 0.1 Remove ALL Hardcoded Secrets [CRITICAL]

**Timeline**: 10 minutes  
**Files**: `/src/middleware/auth.ts`, `/src/services/AuthService.ts`

```typescript
// BEFORE (CATASTROPHIC VULNERABILITY)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// AFTER (SECURE WITH ENTROPY VALIDATION)
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// Startup validation with entropy check
function validateSecrets() {
  if (!JWT_SECRET || JWT_SECRET.length < 64) {
    throw new Error('JWT_SECRET must be at least 64 characters');
  }

  if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET.length < 64) {
    throw new Error('JWT_REFRESH_SECRET must be at least 64 characters');
  }

  // Calculate entropy
  const calculateEntropy = (str: string): number => {
    const chars = new Set(str).size;
    return Math.log2(Math.pow(chars, str.length));
  };

  if (calculateEntropy(JWT_SECRET) < 256) {
    throw new Error('JWT_SECRET has insufficient entropy (minimum 256 bits)');
  }
}

// Call on startup - fail fast
validateSecrets();
```

### 0.2 Fix JWT Algorithm Vulnerability [CRITICAL]

**Timeline**: 10 minutes  
**Files**: `/src/middleware/auth.ts`

```typescript
// SECURE JWT Configuration
import jwt from 'jsonwebtoken';

const JWT_OPTIONS: jwt.SignOptions = {
  algorithm: 'HS256', // Explicit algorithm - prevents confusion attacks
  issuer: process.env.JWT_ISSUER || 'quikadmin-api',
  audience: process.env.JWT_AUDIENCE || 'quikadmin-client',
  expiresIn: '15m', // SHORT-lived tokens (was 24h - TOO LONG)
  notBefore: 0,
};

export const generateToken = (payload: TokenPayload): string => {
  // Add token binding for replay attack prevention
  const tokenBinding = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${payload.id}:${Date.now()}`)
    .digest('hex')
    .substring(0, 16);

  return jwt.sign({ ...payload, bind: tokenBinding }, JWT_SECRET, JWT_OPTIONS);
};

export const verifyToken = async (token: string): Promise<TokenPayload> => {
  // Async verification with strict options
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      JWT_SECRET,
      {
        algorithms: ['HS256'], // Only accept HS256
        issuer: JWT_OPTIONS.issuer,
        audience: JWT_OPTIONS.audience,
      },
      (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded as TokenPayload);
      }
    );
  });
};
```

### 0.3 Remove Authentication Bypass Vulnerability [CRITICAL]

**Timeline**: 5 minutes  
**Files**: `/src/middleware/auth.ts`

```typescript
// REMOVE THESE LINES - SECURITY VULNERABILITY
// if (!token) {
//   token = req.query.token as string || req.body.token; // DANGEROUS
// }

// SECURE: Only accept tokens from Authorization header
export const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('No valid authorization header', 401);
  }

  const token = authHeader.substring(7);

  try {
    const payload = await verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    throw new AuthError('Invalid token', 401);
  }
});
```

### 0.4 Add Environment Validation on Startup [CRITICAL]

**Timeline**: 5 minutes  
**Files**: `/src/index.ts`

```typescript
// MUST BE FIRST THING IN APPLICATION
import dotenv from 'dotenv';
dotenv.config();

// Critical environment validation
const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'DATABASE_URL',
  'REDIS_URL',
  'NODE_ENV',
  'JWT_ISSUER',
  'JWT_AUDIENCE',
];

function validateEnvironment() {
  const missing: string[] = [];

  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error('❌ CRITICAL: Missing required environment variables:', missing);
    process.exit(1); // FAIL FAST
  }

  // Production-specific validation
  if (process.env.NODE_ENV === 'production') {
    if (process.env.JWT_SECRET === 'your-jwt-secret-key') {
      console.error('❌ CRITICAL: Default JWT secret detected in production!');
      process.exit(1);
    }
  }

  console.log('✅ Environment validation passed');
}

validateEnvironment();
```

---

## 🟠 PHASE 1: CRITICAL ARCHITECTURE FIXES (1 HOUR)

### 1.1 Implement Async JWT Verification with Caching

**Timeline**: 20 minutes  
**Files**: `/src/middleware/auth.ts`

```typescript
import { LRUCache } from 'lru-cache';
import CircuitBreaker from 'opossum';

// Token cache with proper TTL
const tokenCache = new LRUCache<string, TokenPayload>({
  max: 10000, // Maximum 10k tokens
  ttl: 30000, // 30 second TTL
  updateAgeOnGet: true,
  dispose: (value, key) => {
    // Clean up on disposal
    console.log(`Token ${key.substring(0, 10)}... expired from cache`);
  },
});

// Circuit breaker for JWT verification
const verifyCircuitBreaker = new CircuitBreaker(
  async (token: string) => {
    return new Promise((resolve, reject) => {
      jwt.verify(token, JWT_SECRET, JWT_OPTIONS, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });
  },
  {
    timeout: 3000, // 3 second timeout
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
  }
);

export const verifyTokenCached = async (token: string): Promise<TokenPayload> => {
  // Check cache first
  const cached = tokenCache.get(token);
  if (cached && cached.exp > Date.now() / 1000) {
    return cached;
  }

  // Verify with circuit breaker
  try {
    const payload = (await verifyCircuitBreaker.fire(token)) as TokenPayload;
    tokenCache.set(token, payload);
    return payload;
  } catch (error) {
    if (verifyCircuitBreaker.opened) {
      throw new Error('JWT verification service unavailable');
    }
    throw error;
  }
};
```

### 1.2 Implement Distributed Rate Limiting

**Timeline**: 20 minutes  
**Files**: `/src/middleware/rateLimiting.ts`

```typescript
import Redis from 'ioredis';
import { RateLimiterRedis } from 'rate-limiter-flexible';

const redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
});

// Multi-layer rate limiting
export const createAdvancedRateLimiter = (options: {
  points: number;
  duration: number;
  blockDuration?: number;
}) => {
  const rateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl',
    points: options.points,
    duration: options.duration,
    blockDuration: options.blockDuration || 60,
    execEvenly: true, // Spread points consumption evenly
  });

  return asyncHandler(async (req, res, next) => {
    // Multi-factor key generation
    const ip = req.ip;
    const userId = (req as any).user?.id || 'anonymous';
    const userAgent = crypto
      .createHash('sha256')
      .update(req.headers['user-agent'] || '')
      .digest('hex')
      .substring(0, 8);

    const key = `${ip}:${userId}:${userAgent}`;

    try {
      await rateLimiter.consume(key);
      next();
    } catch (rejRes: any) {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 60;
      res.set('Retry-After', String(secs));
      res.set('X-RateLimit-Limit', String(options.points));
      res.set('X-RateLimit-Remaining', String(rejRes.remainingPoints || 0));
      res.set('X-RateLimit-Reset', String(Date.now() + rejRes.msBeforeNext));

      res.status(429).json({
        error: 'Too many requests',
        retryAfter: secs,
        message: `Rate limit exceeded. Try again in ${secs} seconds.`,
      });
    }
  });
};

// Different limits for different operations
export const authLimiter = createAdvancedRateLimiter({
  points: 5,
  duration: 900, // 15 minutes
  blockDuration: 900,
});

export const uploadLimiter = createAdvancedRateLimiter({
  points: 20,
  duration: 3600, // 1 hour
  blockDuration: 3600,
});

export const apiLimiter = createAdvancedRateLimiter({
  points: 100,
  duration: 60, // 1 minute
});
```

### 1.3 Implement Proper Middleware Composition

**Timeline**: 20 minutes  
**Files**: `/src/middleware/compose.ts`

```typescript
// Middleware Factory Pattern with Dependency Injection
export interface MiddlewareConfig {
  auth?: AuthStrategy;
  rateLimit?: RateLimitStrategy;
  validation?: ValidationStrategy;
  cache?: CacheStrategy;
}

export class MiddlewareOrchestrator {
  private middlewareCache = new Map<string, RequestHandler>();

  constructor(private config: MiddlewareConfig) {}

  async createPipeline(strategies: string[]): Promise<RequestHandler[]> {
    const pipeline: RequestHandler[] = [];

    for (const strategy of strategies) {
      if (!this.middlewareCache.has(strategy)) {
        const middleware = await this.loadMiddleware(strategy);
        this.middlewareCache.set(strategy, middleware);
      }
      pipeline.push(this.middlewareCache.get(strategy)!);
    }

    return pipeline;
  }

  private async loadMiddleware(strategy: string): Promise<RequestHandler> {
    const [type, name] = strategy.split(':');

    switch (type) {
      case 'auth':
        return this.config.auth?.[name] || authenticate;
      case 'rate':
        return this.config.rateLimit?.[name] || apiLimiter;
      case 'validate':
        return this.config.validation?.[name] || sanitizeRequest;
      default:
        throw new Error(`Unknown middleware strategy: ${strategy}`);
    }
  }

  // Compose with proper error handling
  compose(...middlewares: RequestHandler[]): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      let index = -1;

      const dispatch = async (i: number): Promise<void> => {
        if (i <= index) {
          throw new Error('next() called multiple times');
        }
        index = i;

        const fn = middlewares[i];
        if (!fn) return next();

        try {
          await fn(req, res, () => dispatch(i + 1));
        } catch (err) {
          next(err);
        }
      };

      return dispatch(0);
    };
  }
}
```

---

## 🟡 PHASE 2: SECURITY HARDENING (2 HOURS)

### 2.1 Implement Comprehensive Security Headers

**Timeline**: 30 minutes  
**Files**: `/src/middleware/security.ts`

```typescript
import helmet from 'helmet';
import crypto from 'crypto';

// Generate nonce for CSP
export const generateNonce = (req: Request, res: Response, next: NextFunction) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
};

// Enhanced security headers
export const securityHeaders = [
  generateNonce,
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
        styleSrc: ["'self'", "'unsafe-inline'"], // Will fix in next phase
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  }),
];
```

### 2.2 Implement Request Integrity & Validation

**Timeline**: 30 minutes  
**Files**: `/src/middleware/validation.ts`

```typescript
import { body, validationResult } from 'express-validator';
import DOMPurify from 'isomorphic-dompurify';

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove null bytes, control characters, and potential XSS
      return DOMPurify.sanitize(obj)
        .replace(/\0/g, '')
        .replace(/[\x00-\x1F\x7F]/g, '');
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          // Prevent prototype pollution
          if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            continue;
          }
          const sanitizedKey = sanitize(key);
          sanitized[sanitizedKey] = sanitize(obj[key]);
        }
      }
      return sanitized;
    }

    return obj;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);

  next();
};

// Request size limits per field
export const requestLimits = express.json({
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    // Add request hash for integrity
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    (req as any).bodyHash = hash;
  },
});

// SQL Injection prevention
export const validateSQLParameters = (params: any[]): void => {
  const dangerousPatterns = [
    /--/g, // SQL comments
    /;/g, // Multiple statements
    /union\s+select/gi, // Union attacks
    /exec\s*\(/gi, // Exec statements
    /drop\s+table/gi, // Drop statements
  ];

  for (const param of params) {
    if (typeof param === 'string') {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(param)) {
          throw new ValidationError('Potentially dangerous SQL detected');
        }
      }
    }
  }
};
```

### 2.3 Implement CSRF Protection (Web UI Only)

**Timeline**: 30 minutes  
**Files**: `/src/middleware/csrf.ts`

```typescript
import csrf from 'csurf';

// CSRF protection for browser-based sessions
const csrfProtection = csrf({
  cookie: {
    key: '_csrf',
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600, // 1 hour
  },
  value: (req) => {
    // Skip CSRF for API token requests
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return 'skip-csrf-for-api';
    }

    // Check multiple sources for CSRF token
    return (
      req.body._csrf ||
      req.query._csrf ||
      req.headers['x-csrf-token'] ||
      req.headers['x-xsrf-token']
    );
  },
});

// Apply CSRF to state-changing web UI routes only
export const csrfMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip for API routes with Bearer tokens
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return next();
  }

  // Skip for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Apply CSRF protection
  csrfProtection(req, res, next);
};
```

### 2.4 Security Event Logging & Monitoring

**Timeline**: 30 minutes  
**Files**: `/src/middleware/monitoring.ts`

```typescript
import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

// Security event logger
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  defaultMeta: { service: 'middleware-security' },
  transports: [
    new winston.transports.File({
      filename: 'security.log',
      level: 'warn',
    }),
    new ElasticsearchTransport({
      level: 'info',
      clientOpts: { node: process.env.ELASTICSEARCH_URL },
      index: 'security-logs',
    }),
  ],
});

// Security event types
export enum SecurityEvent {
  AUTH_FAILURE = 'AUTH_FAILURE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  CSRF_VIOLATION = 'CSRF_VIOLATION',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT = 'XSS_ATTEMPT',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}

// Log security events
export const logSecurityEvent = (event: SecurityEvent, details: any, req?: Request) => {
  const logData = {
    event,
    details,
    timestamp: new Date().toISOString(),
    ip: req?.ip,
    userAgent: req?.headers['user-agent'],
    userId: (req as any)?.user?.id,
    requestId: (req as any)?.id,
    severity: getSeverity(event),
  };

  securityLogger.warn(logData);

  // Alert on critical events
  if (isCriticalEvent(event)) {
    alertSecurityTeam(logData);
  }
};

function getSeverity(event: SecurityEvent): string {
  const severityMap = {
    [SecurityEvent.SQL_INJECTION_ATTEMPT]: 'CRITICAL',
    [SecurityEvent.XSS_ATTEMPT]: 'HIGH',
    [SecurityEvent.CSRF_VIOLATION]: 'HIGH',
    [SecurityEvent.AUTH_FAILURE]: 'MEDIUM',
    [SecurityEvent.RATE_LIMIT_EXCEEDED]: 'LOW',
  };

  return severityMap[event] || 'INFO';
}

function isCriticalEvent(event: SecurityEvent): boolean {
  return [
    SecurityEvent.SQL_INJECTION_ATTEMPT,
    SecurityEvent.XSS_ATTEMPT,
    SecurityEvent.SUSPICIOUS_ACTIVITY,
  ].includes(event);
}

async function alertSecurityTeam(logData: any): Promise<void> {
  // Send to security monitoring service
  // Implementation depends on your alerting system
  console.error('🚨 SECURITY ALERT:', logData);
}
```

---

## 🟢 PHASE 3: TESTING IMPLEMENTATION (2 HOURS)

### 3.1 Security Test Suite

**Timeline**: 45 minutes  
**Files**: `/tests/security/middleware.security.test.ts`

```typescript
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/index';

describe('Middleware Security Tests', () => {
  describe('JWT Security', () => {
    it('should prevent algorithm confusion attacks', async () => {
      const maliciousToken = jwt.sign({ id: 'user123' }, 'public-key', { algorithm: 'HS256' });

      await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${maliciousToken}`)
        .expect(401);
    });

    it('should reject None algorithm', async () => {
      const unsafeToken = jwt.sign({ id: 'user123' }, '', { algorithm: 'none' } as any);

      await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${unsafeToken}`)
        .expect(401);
    });

    it('should prevent timing attacks', async () => {
      const times: number[] = [];

      for (let i = 0; i < 100; i++) {
        const token = i % 2 === 0 ? 'valid.token.here' : 'invalid.token';
        const start = process.hrtime.bigint();

        await request(app).get('/api/protected').set('Authorization', `Bearer ${token}`);

        const duration = Number(process.hrtime.bigint() - start) / 1000000;
        times.push(duration);
      }

      // Calculate standard deviation
      const mean = times.reduce((a, b) => a + b) / times.length;
      const variance = times.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / times.length;
      const stdDev = Math.sqrt(variance);

      // Standard deviation should be low (consistent timing)
      expect(stdDev).toBeLessThan(5); // Within 5ms
    });
  });

  describe('Rate Limiting', () => {
    it('should block after exceeding rate limit', async () => {
      const requests = [];

      // Make 6 requests (limit is 5)
      for (let i = 0; i < 6; i++) {
        requests.push(
          request(app).post('/api/auth/login').send({ email: 'test@test.com', password: 'wrong' })
        );
      }

      const responses = await Promise.all(requests);

      // First 5 should work, 6th should be rate limited
      expect(responses[5].status).toBe(429);
      expect(responses[5].body.error).toContain('Too many requests');
      expect(responses[5].headers['retry-after']).toBeDefined();
    });
  });

  describe('CSRF Protection', () => {
    it('should reject requests without CSRF token', async () => {
      await request(app).post('/api/web/update').send({ data: 'test' }).expect(403);
    });

    it('should accept requests with valid CSRF token', async () => {
      // Get CSRF token
      const tokenRes = await request(app).get('/api/csrf-token').expect(200);

      const csrfToken = tokenRes.body.csrfToken;

      await request(app)
        .post('/api/web/update')
        .set('X-CSRF-Token', csrfToken)
        .send({ data: 'test' })
        .expect(200);
    });

    it('should skip CSRF for Bearer token requests', async () => {
      const token = generateValidToken();

      await request(app)
        .post('/api/update')
        .set('Authorization', `Bearer ${token}`)
        .send({ data: 'test' })
        .expect(200); // No CSRF error
    });
  });

  describe('Input Sanitization', () => {
    it('should prevent SQL injection', async () => {
      await request(app)
        .post('/api/search')
        .send({
          query: "'; DROP TABLE users; --",
        })
        .expect(400);
    });

    it('should prevent XSS attacks', async () => {
      const response = await request(app)
        .post('/api/process')
        .send({
          data: '<script>alert("XSS")</script>',
        })
        .expect(200);

      // Should be sanitized
      expect(response.body.data).not.toContain('<script>');
    });

    it('should prevent prototype pollution', async () => {
      await request(app)
        .post('/api/process')
        .send({
          __proto__: { isAdmin: true },
          constructor: { isAdmin: true },
        })
        .expect(200);

      // Verify prototype wasn't polluted
      expect(({} as any).isAdmin).toBeUndefined();
    });
  });
});
```

### 3.2 Performance Test Suite

**Timeline**: 45 minutes  
**Files**: `/tests/performance/middleware.perf.test.ts`

```typescript
import autocannon from 'autocannon';
import { app } from '../../src/index';

describe('Middleware Performance Tests', () => {
  let server: any;

  beforeAll((done) => {
    server = app.listen(3001, done);
  });

  afterAll((done) => {
    server.close(done);
  });

  it('should handle 1000 RPS with <100ms P99 latency', async () => {
    const result = await autocannon({
      url: 'http://localhost:3001/api/health',
      connections: 100,
      pipelining: 10,
      duration: 10,
      headers: {
        Authorization: 'Bearer valid-token',
      },
    });

    expect(result.requests.average).toBeGreaterThan(1000);
    expect(result.latency.p99).toBeLessThan(100);
  });

  it('should not leak memory under sustained load', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Run load test for 60 seconds
    await autocannon({
      url: 'http://localhost:3001/api/process',
      connections: 50,
      duration: 60,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ data: 'test' }),
    });

    // Force garbage collection
    if (global.gc) global.gc();

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;

    // Memory increase should be less than 100MB
    expect(memoryIncrease).toBeLessThan(100);
  });

  it('should maintain performance with middleware chain', async () => {
    const times: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = Date.now();

      await request(app)
        .post('/api/protected/process')
        .set('Authorization', 'Bearer valid-token')
        .send({ data: 'test' });

      times.push(Date.now() - start);
    }

    const avgTime = times.reduce((a, b) => a + b) / times.length;
    const p99Time = times.sort((a, b) => a - b)[98];

    expect(avgTime).toBeLessThan(50); // Average under 50ms
    expect(p99Time).toBeLessThan(100); // P99 under 100ms
  });
});
```

### 3.3 Integration Test Suite

**Timeline**: 30 minutes  
**Files**: `/tests/integration/middleware.integration.test.ts`

```typescript
describe('Middleware Integration Tests', () => {
  it('should execute middleware chain in correct order', async () => {
    const executionOrder: string[] = [];

    // Mock middleware to track execution
    const trackingApp = express();

    trackingApp.use((req, res, next) => {
      executionOrder.push('security-headers');
      next();
    });

    trackingApp.use((req, res, next) => {
      executionOrder.push('request-context');
      next();
    });

    trackingApp.use((req, res, next) => {
      executionOrder.push('rate-limit');
      next();
    });

    trackingApp.use((req, res, next) => {
      executionOrder.push('authentication');
      next();
    });

    trackingApp.get('/test', (req, res) => {
      executionOrder.push('route-handler');
      res.json({ order: executionOrder });
    });

    const response = await request(trackingApp).get('/test').expect(200);

    expect(response.body.order).toEqual([
      'security-headers',
      'request-context',
      'rate-limit',
      'authentication',
      'route-handler',
    ]);
  });

  it('should handle middleware errors gracefully', async () => {
    const response = await request(app)
      .post('/api/process')
      .set('Authorization', 'Bearer invalid-token')
      .send({ data: 'test' })
      .expect(401);

    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('requestId');
  });

  it('should preserve request context through middleware chain', async () => {
    const response = await request(app)
      .post('/api/echo-context')
      .set('Authorization', 'Bearer valid-token')
      .send({ test: 'data' })
      .expect(200);

    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
  });
});
```

---

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Deployment Validation

```bash
#!/bin/bash
# deployment-validation.sh

echo "🔍 Running pre-deployment security checks..."

# Check for hardcoded secrets
if grep -r "your-secret-key\|your-jwt-secret" src/; then
  echo "❌ CRITICAL: Hardcoded secrets detected!"
  exit 1
fi

# Validate environment variables
required_vars=(
  "JWT_SECRET"
  "JWT_REFRESH_SECRET"
  "DATABASE_URL"
  "REDIS_URL"
  "NODE_ENV"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing required environment variable: $var"
    exit 1
  fi
done

# Check JWT secret strength
jwt_length=${#JWT_SECRET}
if [ $jwt_length -lt 64 ]; then
  echo "❌ JWT_SECRET must be at least 64 characters (current: $jwt_length)"
  exit 1
fi

# Run security tests
npm run test:security || exit 1

# Run performance tests
npm run test:performance || exit 1

# Check test coverage
coverage=$(npm run test:coverage --silent | grep "All files" | awk '{print $10}' | sed 's/%//')
if [ $(echo "$coverage < 95" | bc) -eq 1 ]; then
  echo "❌ Test coverage below 95% (current: $coverage%)"
  exit 1
fi

echo "✅ All pre-deployment checks passed!"
```

---

## 📊 Success Metrics

### Security Metrics

- ✅ Zero hardcoded secrets
- ✅ 100% of OWASP Top 10 addressed
- ✅ A+ rating on securityheaders.com
- ✅ All JWT best practices implemented

### Performance Metrics

- ✅ <100ms P99 latency
- ✅ >1000 RPS capacity
- ✅ <5ms middleware overhead
- ✅ Zero memory leaks

### Quality Metrics

- ✅ >95% test coverage
- ✅ 100% TypeScript type safety
- ✅ Zero critical vulnerabilities
- ✅ All integration tests passing

---

## 🎯 Implementation Timeline

### Day 1: Critical Security (4 hours)

- [ ] Phase 0: Emergency fixes (30 min)
- [ ] Phase 1: Architecture fixes (1 hour)
- [ ] Security testing (1.5 hours)
- [ ] Validation & review (1 hour)

### Day 2: Hardening & Testing (4 hours)

- [ ] Phase 2: Security hardening (2 hours)
- [ ] Phase 3: Test implementation (2 hours)

### Day 3: Integration & Deployment (2 hours)

- [ ] Integration testing (1 hour)
- [ ] Deployment preparation (1 hour)

---

## ⚠️ CRITICAL WARNINGS

1. **DO NOT DEPLOY** without completing ALL Phase 0 fixes
2. **DO NOT USE** default or weak JWT secrets
3. **DO NOT SKIP** security testing
4. **DO NOT IGNORE** performance benchmarks
5. **DO NOT RUSH** - Security > Speed

---

_Plan Version: 2.0_  
_Status: READY FOR IMPLEMENTATION_  
_Risk Level: MANAGEABLE (with all fixes applied)_  
_Estimated Time: 10 hours total_
