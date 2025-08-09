/**
 * PDF Filler Tool - Main Entry Point
 * Simplified version without auth
 */

import express from 'express';
import dotenv from 'dotenv';
import { IntelliFillService } from './services/IntelliFillService';
import { DocumentParser } from './parsers/DocumentParser';
import { DataExtractor } from './extractors/DataExtractor';
import { FieldMapper } from './mappers/FieldMapper';
import { FormFiller } from './fillers/FormFiller';
import { ValidationService } from './validators/ValidationService';
import { setupRoutes } from './api/routes';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup routes
setupRoutes(app, intelliFillService);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`PDF Filler Tool server running on port ${PORT}`);
  logger.info(`API documentation available at http://localhost:${PORT}/api-docs`);
});

export { intelliFillService };