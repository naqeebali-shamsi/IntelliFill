/**
 * IntelliFill - Main Entry Point
 * Intelligent document processing and form automation platform
 */

import dotenv from 'dotenv';
dotenv.config();

// Import config module FIRST (auto-validates on import)
import { config } from './config';

import express from 'express';
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

// Config validation happens automatically on import
console.log(`✅ Configuration loaded (${config.server.nodeEnv} mode)`);
console.log(`   Server: http://localhost:${config.server.port}`);
console.log(`   Database: ${config.database.url.split('@')[1]?.split('/')[0] || 'configured'}`);
console.log(`   Redis: ${config.redis.host}:${config.redis.port}`);

// Optional environment variable warnings
const RECOMMENDED_ENV_VARS = ['REDIS_PASSWORD', 'DB_POOL_MAX', 'DB_POOL_MIN'];

for (const varName of RECOMMENDED_ENV_VARS) {
  if (!process.env[varName]) {
    console.warn(`⚠️  ${varName} not set - using default value`);
  }
}

const app = express();
const PORT = process.env.PORT || 3002;

async function initializeApp() {
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
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
      })
    );

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

    // Apply rate limiting - BEFORE routes
    app.use('/api/', standardLimiter); // Standard rate limit for all API routes
    app.use('/api/auth/login', authLimiter); // Strict limit for login
    app.use('/api/auth/register', authLimiter); // Strict limit for registration
    app.use('/api/documents/upload', uploadLimiter); // Upload rate limit

    // CSRF protection for state-changing operations
    // Temporarily disabled for testing
    // app.use(csrfProtection);

    // Health check endpoint (public)
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      });
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
        return res.status(400).json({ error: 'File too large' });
      }

      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Invalid file field' });
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

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    const { app, db } = await initializeApp();

    const server = app.listen(PORT, () => {
      logger.info(`🚀 IntelliFill API server running on port ${PORT}`);
      logger.info(`📚 IntelliFill API documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`❤️  Health check: http://localhost:${PORT}/health`);
      logger.info(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth/*`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Handle server shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, closing HTTP server');

      // Stop keepalive before shutdown
      const { stopKeepalive } = await import('./utils/prisma');
      stopKeepalive();

      server.close(async () => {
        logger.info('HTTP server closed');
        await db.disconnect();
        process.exit(0);
      });
    });

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
