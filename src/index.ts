/**
 * IntelliFill - Main Entry Point
 * Intelligent document processing and form automation platform
 */

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { IntelliFillService } from './services/IntelliFillService';
import { DocumentParser } from './parsers/DocumentParser';
import { DataExtractor } from './extractors/DataExtractor';
import { FieldMapper } from './mappers/FieldMapper';
import { FormFiller } from './fillers/FormFiller';
import { ValidationService } from './validators/ValidationService';
import { DatabaseService } from './database/DatabaseService';
import { setupRoutes } from './api/routes';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

async function initializeApp() {
  try {
    // Initialize database
    const db = new DatabaseService();
    await db.connect();
    logger.info('Database connected successfully');

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
      validationService
    });

    // Security middleware
    app.use(cors({
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
      credentials: true
    }));

    // Body parsing middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(cookieParser());

    // Health check endpoint (public)
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // Setup routes with authentication
    setupRoutes(app, intelliFillService, db);

    return { app, db };
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

// Error handling middleware
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
  if (err.code === '23505') { // Unique constraint violation
    return res.status(409).json({ error: 'Resource already exists' });
  }
  
  if (err.code === '23503') { // Foreign key violation
    return res.status(400).json({ error: 'Invalid reference' });
  }

  // Rate limit errors
  if (err.status === 429) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  // Default error response
  res.status(err.status || 500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
});

// 404 handler
app.use('*', (req: express.Request, res: express.Response) => {
  res.status(404).json({ 
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found` 
  });
});

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
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, closing HTTP server');
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

export { startServer, initializeApp };