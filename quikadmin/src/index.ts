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
import { DatabaseService } from './database/DatabaseService';
import { setupRoutes } from './api/routes';
import { logger } from './utils/logger';
import { standardLimiter, authLimiter, uploadLimiter } from './middleware/rateLimiter';
import { csrfProtection } from './middleware/csrf';
import { realtimeService } from './services/RealtimeService';
import { createAuditMiddleware } from './middleware/auditLogger';
import { cspMiddleware, cspReportHandler } from './middleware/csp';
import {
  getAuthCircuitBreakerMetrics,
  isAuthCircuitOpen,
  getTokenCacheMetrics,
  shutdownTokenCache,
} from './utils/supabase';
import { getBasicHealth, getDetailedHealth } from './services/health.service';

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

async function initializeApp(): Promise<{ app: Application; db: DatabaseService }> {
  try {
    // Initialize database
    const db = new DatabaseService();
    // Enhanced connection with retry logic
    await db.connect();

    // Verify Prisma connection as well
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

    // CORS configuration with pattern matching for Vercel preview URLs
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) || [];
    const allowedPatterns = [
      /^https:\/\/intellifill.*\.vercel\.app$/, // All Vercel preview/production URLs for this project
      /^http:\/\/localhost:\d+$/, // Local development
    ];

    app.use(
      cors({
        origin: (origin, callback) => {
          // Allow requests with no origin (mobile apps, Postman, server-to-server)
          if (!origin) return callback(null, true);

          // Check exact matches first
          if (allowedOrigins.includes(origin)) {
            return callback(null, true);
          }

          // Check pattern matches (Vercel preview URLs)
          if (allowedPatterns.some((pattern) => pattern.test(origin))) {
            return callback(null, true);
          }

          callback(new Error(`Origin ${origin} not allowed by CORS`));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
      })
    );

    // Body parsing middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(cookieParser());

    // Global audit logging middleware - AFTER body parser, BEFORE routes
    // Logs all API requests for compliance and security monitoring
    app.use(
      '/api/',
      createAuditMiddleware({
        excludePaths: ['/api/health', '/api/metrics', '/api/docs'],
        includeRequestBody: true,
        includeResponseBody: false, // Avoid logging sensitive response data
      })
    );
    logger.info('Global audit middleware registered');

    // Apply rate limiting - BEFORE routes
    app.use('/api/', standardLimiter); // Standard rate limit for all API routes
    app.use('/api/auth/login', authLimiter); // Strict limit for login
    app.use('/api/auth/register', authLimiter); // Strict limit for registration
    app.use('/api/documents/upload', uploadLimiter); // Upload rate limit

    // CSRF protection for state-changing operations
    // Environment-aware: enabled in production, can be enabled in dev/test via ENABLE_CSRF=true
    if (config.server.nodeEnv === 'production' || process.env.ENABLE_CSRF === 'true') {
      app.use(csrfProtection);
      logger.info('CSRF protection enabled');
    } else {
      logger.warn('⚠️ CSRF protection disabled in development mode');
    }

    // CSP violation report endpoint (must be before routes, no auth required)
    // Browsers send CSP violations here for monitoring
    app.post('/api/csp-report', express.json({ type: 'application/csp-report' }), cspReportHandler);

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
    setupRoutes(app, intelliFillService, db);

    // Error handling middleware (must be after routes)
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', err);

      // JWT errors
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }

      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }

      // Multer errors (file upload)
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large', code: 'FILE_SIZE_EXCEEDED' });
      }

      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Invalid file field', code: 'INVALID_FILE_FIELD' });
      }

      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Too many files', code: 'FILE_COUNT_EXCEEDED' });
      }

      // File validation errors with specific codes (from FileValidationError)
      if (err.name === 'FileValidationError' || err.code === 'DOUBLE_EXTENSION') {
        return res.status(400).json({
          error: err.message,
          code: err.code || 'FILE_VALIDATION_FAILED',
        });
      }

      if (err.code === 'MIME_TYPE_MISMATCH') {
        return res.status(415).json({
          error: err.message,
          code: 'MIME_TYPE_MISMATCH',
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
        return res.status(415).json({
          error: err.message,
          code: 'UNSUPPORTED_MEDIA_TYPE',
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
        return res.status(422).json({
          error: err.message,
          code: 'FILE_VALIDATION_FAILED',
        });
      }

      // Database errors
      if (err.code === '23505') {
        // Unique constraint violation
        return res.status(409).json({ error: 'Resource already exists' });
      }

      if (err.code === '23503') {
        // Foreign key violation
        return res.status(400).json({ error: 'Invalid reference' });
      }

      // Rate limit errors
      if (err.status === 429) {
        return res.status(429).json({ error: 'Too many requests' });
      }

      // Default error response
      res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      });
    });

    // 404 handler (must be last)
    app.use('*', (req: express.Request, res: express.Response) => {
      res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
      });
    });

    return { app, db };
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
    const { app, db } = await initializeApp();

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
    });

    // Handle server shutdown
    const shutdownHandler = async () => {
      logger.info('Shutdown signal received, closing HTTP server');

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
        await db.disconnect();
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
