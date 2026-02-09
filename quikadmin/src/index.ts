/**
 * IntelliFill - Main Entry Point
 * Intelligent document processing and form automation platform
 */

import dotenv from 'dotenv';
dotenv.config();

// ============================================================================
// Global Process Error Handlers (must be registered early)
// ============================================================================
// These handlers provide a last-resort safety net for unhandled errors.
// All errors should be caught in their respective modules, but these prevent
// silent failures and ensure proper logging.

process.on('unhandledRejection', (reason, promise) => {
  // Use console at this stage since logger may not be initialized yet
  console.error('Unhandled Promise Rejection:', { reason, promise });
  // Don't exit - let the application continue and handle the failure gracefully
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Log the full stack trace
  if (error.stack) {
    console.error('Stack trace:', error.stack);
  }
  // Exit with failure code - let pm2/docker restart the process
  // This is the recommended behavior for uncaught exceptions
  process.exit(1);
});

// Import config module and validation function FIRST
import { config, validateConfig } from './config';

import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { IntelliFillService } from './services/IntelliFillService';
import { DocumentParser } from './parsers/DocumentParser';
import { DataExtractor } from './extractors/DataExtractor';
import { FieldMapper } from './mappers/FieldMapper';
import { FormFiller } from './fillers/FormFiller';
import { ValidationService } from './validators/ValidationService';
import { setupRoutes } from './api/routes';
import { logger } from './utils/logger';
import {
  standardLimiter,
  authLimiter,
  uploadLimiter,
  cspReportLimiter,
} from './middleware/rateLimiter';
import { csrfProtection } from './middleware/csrf';
import { realtimeService } from './services/RealtimeService';
import { createAuditMiddleware } from './middleware/auditLogger';
import { cspMiddleware, cspReportHandler } from './middleware/csp';
import { requestContext, sanitizeRequest } from './middleware/security';
import {
  getAuthCircuitBreakerMetrics,
  isAuthCircuitOpen,
  getTokenCacheMetrics,
  shutdownTokenCache,
} from './utils/supabase';
import { getBasicHealth, getDetailedHealth } from './services/health.service';
import {
  SecurityEventService,
  SecurityEventType,
  SecuritySeverity,
} from './services/SecurityEventService';
import { ErrorCode, HttpStatus } from './constants/errorCodes';
import { startStaleJobReconciliation } from './services/staleJobReconciler';

// Validate configuration explicitly at startup (will throw and exit if invalid)
try {
  validateConfig();
  console.log(`✅ Configuration validated successfully`);
} catch (error) {
  console.error('❌ Configuration validation failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

console.log(`✅ Configuration loaded (${config.server.nodeEnv} mode)`);
console.log(`   Server: http://localhost:${config.server.port}`);
console.log(`   Database: ${config.database.url.split('@')[1]?.split('/')[0] || 'configured'}`);
console.log(`   Redis: ${config.redis.url.replace(/:[^:@]+@/, ':****@')}`);

// Optional environment variable warnings
const RECOMMENDED_ENV_VARS = ['DB_POOL_MAX', 'DB_POOL_MIN'];

for (const varName of RECOMMENDED_ENV_VARS) {
  if (!process.env[varName]) {
    console.warn(`⚠️  ${varName} not set - using default value`);
  }
}

const app: Application = express();
const PORT = process.env.PORT || 3002;

// Trust proxy for deployments behind reverse proxies (Render, Heroku, etc.)
// Using 1 = trust only the immediate proxy hop (safer than 'true')
// This enables correct client IP detection for rate limiting and logging
if (config.server.nodeEnv === 'production') {
  app.set('trust proxy', 1);
  logger.info('   Trust proxy: enabled (production mode)');
}

async function initializeApp(): Promise<{ app: Application }> {
  try {
    // Verify Prisma connection with retry logic
    const { ensureDbConnection, startKeepalive } = await import('./utils/prisma');
    const prismaConnected = await ensureDbConnection();
    if (!prismaConnected) {
      throw new Error('Failed to establish Prisma database connection after retries');
    }

    // Start database keepalive to prevent Neon idle disconnection
    startKeepalive();

    logger.info('Database connected successfully (keepalive enabled)');

    // Verify Redis is available (required in production for queue operations)
    const { requireRedisAtStartup } = await import('./utils/redisHealth');
    await requireRedisAtStartup();

    // Initialize services
    const documentParser = new DocumentParser();
    const dataExtractor = new DataExtractor();
    const fieldMapper = new FieldMapper();
    const formFiller = new FormFiller();
    const validationService = new ValidationService();

    const intelliFillService = new IntelliFillService({
      documentParser,
      dataExtractor,
      fieldMapper,
      formFiller,
      validationService,
    });

    // Request context middleware - MUST be first for request ID tracking
    app.use(requestContext);

    // Security middleware
    // Helmet handles most security headers; CSP is handled by our custom middleware
    app.use(
      helmet({
        contentSecurityPolicy: false, // Disabled - handled by cspMiddleware for nonce support
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
      })
    );

    // Custom CSP middleware with nonce support and environment-aware configuration
    app.use(cspMiddleware());

    // CORS configuration with strict origin validation
    // Task 301: Tightened patterns to prevent subdomain hijacking
    const allowedOrigins =
      process.env.CORS_ORIGINS?.split(',')
        .map((o) => o.trim())
        .filter(Boolean) || [];

    // Explicit allowed production domains (highest priority)
    const productionOrigins = [
      'https://intellifill.vercel.app',
      'https://intellifill-web.vercel.app', // Vercel free tier deployment
      'https://www.intellifill.com',
      'https://intellifill.com',
    ];

    // Restrictive patterns for Vercel preview deployments
    // Vercel preview URLs follow format: {project}-{deployment-hash}.vercel.app
    // or: {project}-git-{branch}-{team}.vercel.app
    const allowedPatterns = [
      // Match: intellifill-<deployment-hash>.vercel.app (exactly 9 alphanumeric chars)
      /^https:\/\/intellifill-[a-z0-9]{6,20}\.vercel\.app$/,
      // Match: intellifill-git-<branch>-<team>.vercel.app (git branch previews)
      /^https:\/\/intellifill-git-[a-z0-9-]+-[a-z0-9-]+\.vercel\.app$/,
      // Local development (only localhost, not 0.0.0.0 or other IPs)
      /^http:\/\/localhost:\d{4,5}$/,
    ];

    // Validate origin with strict security
    const isOriginAllowed = (origin: string): boolean => {
      // Check production origins first (explicit allowlist)
      if (productionOrigins.includes(origin)) return true;

      // Check environment-specified origins
      if (allowedOrigins.includes(origin)) return true;

      // Check preview URL patterns (strictly anchored)
      if (allowedPatterns.some((pattern) => pattern.test(origin))) return true;

      return false;
    };

    app.use(
      cors({
        origin: (origin, callback) => {
          // Allow requests with no origin (mobile apps, Postman, server-to-server)
          if (!origin) return callback(null, true);

          // Validate origin against strict rules
          if (isOriginAllowed(origin)) {
            return callback(null, true);
          }

          // Log rejected origin with detailed context for security monitoring
          logger.warn('CORS origin rejected', {
            origin,
            reason: 'Origin not in allowlist or does not match secure patterns',
            allowedOriginsCount: productionOrigins.length + allowedOrigins.length,
            method: 'CORS validation',
          });

          // Return error with CORS_REJECTED code for proper 403 handling
          const corsError = new Error(`Origin ${origin} not allowed by CORS`);
          (corsError as any).code = 'CORS_REJECTED';
          callback(corsError);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Requested-With',
          'Accept',
          'Origin',
          'X-Request-ID',
        ],
        exposedHeaders: [
          'X-Request-ID',
          'RateLimit-Limit',
          'RateLimit-Remaining',
          'RateLimit-Reset',
        ],
      })
    );

    // Stripe webhook - MUST be defined BEFORE body parsing middleware
    // Following Stripe's official pattern: https://docs.stripe.com/webhooks/quickstart
    // The route handler is defined here with express.raw() inline, not in a separate router
    app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
      const { stripeService } = await import('./services/stripe.service');

      const signature = req.headers['stripe-signature'];
      if (!signature || typeof signature !== 'string') {
        logger.warn('Webhook received without signature');
        return res.status(400).json({ error: 'Missing signature' });
      }

      try {
        const event = stripeService.constructWebhookEvent(req.body, signature);
        logger.info('Webhook event received', { type: event.type, id: event.id });
        await stripeService.handleWebhookEvent(event);
        res.json({ received: true });
      } catch (error) {
        logger.error('Webhook error', { error });
        res.status(400).json({
          error: error instanceof Error ? error.message : 'Webhook error',
        });
      }
    });

    // Body parsing middleware - applied AFTER webhook route
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(cookieParser());

    // Request sanitization - strips null bytes and control characters
    // Security: prevents injection attacks via malformed characters
    app.use(sanitizeRequest);
    logger.info('Request sanitization middleware enabled');

    // Global audit logging middleware - AFTER body parser, BEFORE routes
    // Logs all API requests for compliance and security monitoring
    // Task 304: Configurable exclusion paths via environment variable
    const defaultAuditExcludePaths = [
      '/api/health',
      '/api/metrics',
      '/api/docs',
      '/api/csp-report', // High-volume, low-value for audit purposes
    ];
    const envExcludePaths = process.env.AUDIT_EXCLUDE_PATHS
      ? process.env.AUDIT_EXCLUDE_PATHS.split(',').map((p) => p.trim())
      : [];
    const auditExcludePaths = [...defaultAuditExcludePaths, ...envExcludePaths];

    app.use(
      '/api/',
      createAuditMiddleware({
        excludePaths: auditExcludePaths,
        includeRequestBody: true,
        includeResponseBody: false, // Avoid logging sensitive response data
      })
    );
    logger.info('Global audit middleware registered', {
      excludedPaths: auditExcludePaths,
    });

    // Apply rate limiting - BEFORE routes
    // Skip health endpoints to prevent Docker health checks from being rate limited
    app.use('/api/', (req, res, next) => {
      if (req.path === '/health' || req.path.startsWith('/health/')) {
        return next();
      }
      return standardLimiter(req, res, next);
    });
    app.use('/api/auth/login', authLimiter); // Strict limit for login
    app.use('/api/auth/register', authLimiter); // Strict limit for registration
    app.use('/api/documents/upload', uploadLimiter); // Upload rate limit

    // CSRF protection for state-changing operations
    // Secure by default: enabled unless explicitly disabled via DISABLE_CSRF=true
    if (process.env.DISABLE_CSRF !== 'true') {
      app.use(csrfProtection);
      logger.info('CSRF protection enabled');
    } else {
      logger.warn('⚠️ SECURITY WARNING: CSRF protection disabled via DISABLE_CSRF=true');
    }

    // CSP violation report endpoint (must be before routes, no auth required)
    // Browsers send CSP violations here for monitoring
    app.post(
      '/api/csp-report',
      cspReportLimiter, // Rate limit: 100 reports/min per IP (Task #274)
      express.json({ type: 'application/csp-report' }),
      cspReportHandler
    );

    // Health check endpoint (public) - basic status
    app.get('/health', (_req, res) => {
      const health = getBasicHealth();

      // Include minimal auth info for quick checks
      const authCircuitBreaker = getAuthCircuitBreakerMetrics();
      const tokenCache = getTokenCacheMetrics();

      res.json({
        ...health,
        auth: {
          circuitBreaker: authCircuitBreaker,
          tokenCache: tokenCache || { enabled: false },
        },
      });
    });

    // Detailed health check endpoint (for monitoring systems)
    app.get('/health/detailed', async (_req, res) => {
      try {
        const detailed = await getDetailedHealth();
        const statusCode =
          detailed.status === 'healthy' ? 200 : detailed.status === 'degraded' ? 200 : 503;
        res.status(statusCode).json(detailed);
      } catch (error) {
        logger.error('Health check failed', { error });
        res.status(503).json({
          status: 'unhealthy',
          error: 'Health check failed',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Setup routes with authentication
    setupRoutes(app, intelliFillService);

    // Error handling middleware (must be after routes)
    // Task 300: Include requestId in all error responses for client-side correlation
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      // Extract request ID from middleware context or header
      const requestId = (req as any).id || req.headers['x-request-id'] || 'unknown';

      // Log error with request ID for correlation
      logger.error('Unhandled error:', {
        requestId,
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
      });

      // CORS rejection errors (Task #275)
      if (err.code === ErrorCode.CORS_REJECTED || err.message?.includes('not allowed by CORS')) {
        // Log security event for CORS rejection
        SecurityEventService.logCORSRejected(req, req.headers.origin || 'unknown');
        return res.status(HttpStatus.FORBIDDEN).json({
          error: 'Forbidden',
          message: 'Origin not allowed',
          code: ErrorCode.CORS_REJECTED,
          requestId,
        });
      }

      // JWT errors
      if (err.name === 'JsonWebTokenError') {
        SecurityEventService.logTokenInvalid(req, 'Invalid JWT signature');
        return res.status(HttpStatus.UNAUTHORIZED).json({
          error: 'Invalid token',
          code: ErrorCode.TOKEN_INVALID,
          requestId,
        });
      }

      if (err.name === 'TokenExpiredError') {
        SecurityEventService.logEvent({
          type: SecurityEventType.TOKEN_EXPIRED,
          severity: SecuritySeverity.LOW,
          req,
          details: { reason: 'JWT token expired' },
        });
        return res.status(HttpStatus.UNAUTHORIZED).json({
          error: 'Token expired',
          code: ErrorCode.TOKEN_EXPIRED,
          requestId,
        });
      }

      // Multer errors (file upload)
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
          error: 'File too large',
          code: ErrorCode.FILE_SIZE_EXCEEDED,
          requestId,
        });
      }

      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: 'Invalid file field',
          code: ErrorCode.INVALID_FILE_FIELD,
          requestId,
        });
      }

      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: 'Too many files',
          code: ErrorCode.FILE_COUNT_EXCEEDED,
          requestId,
        });
      }

      // File validation errors with specific codes (from FileValidationError)
      if (err.name === 'FileValidationError' || err.code === ErrorCode.DOUBLE_EXTENSION) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: err.message,
          code: err.code || ErrorCode.FILE_VALIDATION_FAILED,
          requestId,
        });
      }

      if (err.code === ErrorCode.MIME_TYPE_MISMATCH) {
        return res.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).json({
          error: err.message,
          code: ErrorCode.MIME_TYPE_MISMATCH,
          requestId,
        });
      }

      // Multer file filter errors (thrown from fileFilter callbacks)
      // These errors occur when file type/extension validation fails
      if (
        err.message &&
        (err.message.includes('Unsupported file type') ||
          err.message.includes('File type') ||
          err.message.includes('not supported') ||
          err.message.includes('Only PDF') ||
          err.message.includes('Allowed:'))
      ) {
        return res.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).json({
          error: err.message,
          code: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
          requestId,
        });
      }

      // File validation errors (double extensions, MIME type spoofing, etc.)
      if (
        err.message &&
        (err.message.includes('File validation failed') ||
          err.message.includes('MIME type mismatch') ||
          err.message.includes('magic number') ||
          err.message.includes('double extension') ||
          err.message.includes('suspicious'))
      ) {
        return res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
          error: err.message,
          code: ErrorCode.FILE_VALIDATION_FAILED,
          requestId,
        });
      }

      // Database errors
      if (err.code === '23505') {
        // Unique constraint violation
        return res.status(HttpStatus.CONFLICT).json({
          error: 'Resource already exists',
          code: ErrorCode.RESOURCE_EXISTS,
          requestId,
        });
      }

      if (err.code === '23503') {
        // Foreign key violation
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: 'Invalid reference',
          code: ErrorCode.INVALID_REFERENCE,
          requestId,
        });
      }

      // Rate limit errors
      if (err.status === 429) {
        return res.status(HttpStatus.TOO_MANY_REQUESTS).json({
          error: 'Too many requests',
          code: ErrorCode.RATE_LIMIT,
          requestId,
        });
      }

      // Default error response
      res.status(err.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
        code: ErrorCode.INTERNAL_ERROR,
        requestId,
      });
    });

    // 404 handler (must be last)
    // Task 300: Include requestId for client-side correlation
    app.use('*', (req: express.Request, res: express.Response) => {
      const requestId = (req as any).id || req.headers['x-request-id'] || 'unknown';
      res.status(HttpStatus.NOT_FOUND).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        code: ErrorCode.NOT_FOUND,
        requestId,
      });
    });

    return { app };
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

// Graceful shutdown handlers (will be augmented in startServer)
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
});

// Start server
async function startServer() {
  try {
    const { app } = await initializeApp();

    const server = app.listen(PORT, async () => {
      logger.info(`🚀 IntelliFill API server running on port ${PORT}`);
      logger.info(`📚 IntelliFill API documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`❤️  Health check: http://localhost:${PORT}/health`);
      logger.info(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth/*`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

      // Start Redis health monitoring after server is up
      const { startRedisHealthMonitoring } = await import('./utils/redisHealth');
      startRedisHealthMonitoring(30000); // Check every 30 seconds

      // Start RealtimeService heartbeat for SSE connection health
      realtimeService.startHeartbeat(30000); // Send heartbeat every 30 seconds

      // Start stale job reconciliation (resets stuck PROCESSING docs every 15 min)
      const reconciler = startStaleJobReconciliation();
      (server as any)._staleJobReconciler = reconciler;
    });

    // Handle server shutdown
    const shutdownHandler = async () => {
      logger.info('Shutdown signal received, closing HTTP server');

      // Stop stale job reconciliation
      if ((server as any)._staleJobReconciler) {
        clearInterval((server as any)._staleJobReconciler);
      }

      // Shutdown RealtimeService (notify clients and close SSE connections)
      realtimeService.shutdown();

      // Stop Redis health monitoring
      const { stopRedisHealthMonitoring } = await import('./utils/redisHealth');
      stopRedisHealthMonitoring();

      // Stop keepalive before shutdown
      const { stopKeepalive } = await import('./utils/prisma');
      stopKeepalive();

      // Shutdown token cache (close Redis connection)
      await shutdownTokenCache();
      logger.info('Token cache shutdown complete');

      server.close(async () => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force exit after 10 seconds if graceful shutdown fails
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Replace previous handlers with new ones that include cleanup
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.on('SIGTERM', shutdownHandler);
    process.on('SIGINT', shutdownHandler);

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Only start server if this file is run directly
if (require.main === module) {
  startServer();
}

export { startServer, initializeApp, app };
