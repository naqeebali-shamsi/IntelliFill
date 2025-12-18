import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import multer from 'multer';
import { z } from 'zod';
import { authenticateSupabase } from '../middleware/supabaseAuth';
import { decryptExtractedData } from '../middleware/encryptionMiddleware';
import { logger } from '../utils/logger';
import { createProfileRoutes } from './profile.routes';
import { ExtractedData } from '../extractors/DataExtractor';

const prisma = new PrismaClient();

// Validation schema for fill-form endpoint
const fillFormBodySchema = z.object({
  mappings: z.string().optional(),
  userData: z.string().optional(),
});

export function createUserRoutes(): Router {
  const router = Router();

  // Mount profile routes (replaces basic /me/profile endpoint)
  const profileRoutes = createProfileRoutes();
  router.use('/', profileRoutes);

  /**
   * GET /api/users/me/data - Get all user's extracted data merged
   * Phase 4B: Aggregates data from ALL user's completed documents
   *
   * Use Case: When filling a form, use ALL available user data instead of selecting one document
   * Example: User uploads Visa, Passport, Bank Statement → Form auto-fills from all sources
   */
  router.get(
    '/me/data',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Fetch all completed documents for user
        const documents = await prisma.document.findMany({
          where: {
            userId,
            status: 'COMPLETED',
            extractedData: { not: null },
          },
          select: {
            id: true,
            fileName: true,
            fileType: true,
            extractedData: true,
            confidence: true,
            processedAt: true,
            createdAt: true,
          },
          orderBy: { processedAt: 'desc' },
        });

        if (documents.length === 0) {
          return res.json({
            success: true,
            data: {
              fields: {},
              entities: {
                names: [],
                emails: [],
                phones: [],
                dates: [],
                addresses: [],
              },
              metadata: {
                confidence: 0,
              },
            },
            sources: [],
            documentCount: 0,
            message:
              'No documents with extracted data found. Please upload and process documents first.',
          });
        }

        // Decrypt and collect all data with source attribution
        const allDataWithSources: Array<{
          documentId: string;
          fileName: string;
          fileType: string;
          confidence: number | null;
          data: any;
          fields: string[];
        }> = [];

        for (const doc of documents) {
          try {
            const decryptedData = decryptExtractedData(doc.extractedData as string);
            const fieldKeys = Object.keys(decryptedData.fields || {});

            allDataWithSources.push({
              documentId: doc.id,
              fileName: doc.fileName,
              fileType: doc.fileType,
              confidence: doc.confidence,
              data: decryptedData,
              fields: fieldKeys,
            });
          } catch (error) {
            logger.warn(`Failed to decrypt data for document ${doc.id}:`, error);
          }
        }

        // Merge all extracted data using the same logic as IntelliFillService
        const merged = mergeExtractedData(allDataWithSources.map((d) => d.data));

        // Create field-to-source mapping
        const fieldSources: Record<
          string,
          Array<{ documentId: string; fileName: string; confidence: number | null }>
        > = {};

        for (const source of allDataWithSources) {
          for (const fieldName of source.fields) {
            if (!fieldSources[fieldName]) {
              fieldSources[fieldName] = [];
            }
            fieldSources[fieldName].push({
              documentId: source.documentId,
              fileName: source.fileName,
              confidence: source.confidence,
            });
          }
        }

        // Build sources summary
        const sources = allDataWithSources.map((s) => ({
          documentId: s.documentId,
          fileName: s.fileName,
          fileType: s.fileType,
          fields: s.fields,
          fieldCount: s.fields.length,
          confidence: s.confidence,
        }));

        res.json({
          success: true,
          data: merged,
          fieldSources,
          sources,
          documentCount: documents.length,
          message: `Data aggregated from ${documents.length} document(s)`,
        });
      } catch (error) {
        logger.error('Error aggregating user data:', error);
        next(error);
      }
    }
  );

  /**
   * GET /api/users/me/info - Get basic user info
   * Note: /me/profile now handled by profile.routes.ts for aggregated document data
   */
  router.get(
    '/me/info',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            emailVerified: true,
            createdAt: true,
            lastLogin: true,
          },
        });

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json({
          success: true,
          user,
        });
      } catch (error) {
        logger.error('Error fetching user info:', error);
        next(error);
      }
    }
  );

  /**
   * POST /api/users/me/fill-form - Fill form using ALL user's aggregated data
   * Phase 4B: User-centric form filling (no document selection needed)
   */
  router.post(
    '/me/fill-form',
    authenticateSupabase,
    upload.single('form'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!req.file) {
          return res.status(400).json({ error: 'Form file is required' });
        }

        // Validate request body
        const validation = fillFormBodySchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            error: 'Validation failed',
            details: validation.error.flatten().fieldErrors,
          });
        }

        // Get mappings and userData from request body with safe JSON parsing
        let mappings: Record<string, string> = {};
        let userData: ExtractedData | undefined;

        // Parse mappings with error handling
        if (validation.data.mappings) {
          try {
            mappings = JSON.parse(validation.data.mappings);
            if (typeof mappings !== 'object' || mappings === null) {
              return res.status(400).json({
                error: 'Invalid JSON format',
                details: 'mappings must be a valid JSON object',
              });
            }
          } catch (error) {
            return res.status(400).json({
              error: 'Invalid JSON format in mappings field',
              details: error instanceof Error ? error.message : 'Parse error',
            });
          }
        }

        // Parse userData with error handling
        if (validation.data.userData) {
          try {
            userData = JSON.parse(validation.data.userData);
            if (typeof userData !== 'object' || userData === null) {
              return res.status(400).json({
                error: 'Invalid JSON format',
                details: 'userData must be a valid JSON object',
              });
            }
          } catch (error) {
            return res.status(400).json({
              error: 'Invalid JSON format in userData field',
              details: error instanceof Error ? error.message : 'Parse error',
            });
          }
        } else {
          // Fetch fresh aggregated data
          const documents = await prisma.document.findMany({
            where: {
              userId,
              status: 'COMPLETED',
              extractedData: { not: null },
            },
            select: {
              extractedData: true,
            },
          });

          if (documents.length === 0) {
            return res.status(400).json({
              error: 'No document data available. Please upload and process documents first.',
            });
          }

          const allData = documents.map((doc) => decryptExtractedData(doc.extractedData as string));

          userData = mergeExtractedData(allData);
        }

        // Initialize services
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { FieldMapper } = require('../mappers/FieldMapper');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { FormFiller } = require('../fillers/FormFiller');
        const fieldMapper = new FieldMapper();
        const formFiller = new FormFiller();

        // Process form
        const formPath = req.file.path;
        const outputPath = path.join('outputs', `filled-${Date.now()}-${req.file.originalname}`);

        // Get form fields
        const formFieldsInfo = await formFiller.validateFormFields(formPath);

        // Map data to form fields (use custom mappings if provided)
        let mappingResult;
        if (Object.keys(mappings).length > 0) {
          // Use custom mappings
          mappingResult = {
            mappings: Object.entries(mappings).map(([formField, dataField]) => ({
              formField,
              dataField,
              value: userData.fields[dataField as string],
              confidence: 1.0,
            })),
            overallConfidence: 0.95,
            unmappedFormFields: [],
            unmappedDataFields: [],
          };
        } else {
          // Use ML auto-mapping
          mappingResult = await fieldMapper.mapFields(userData, formFieldsInfo.fields);
        }

        // Fill form
        const fillResult = await formFiller.fillPDFForm(formPath, mappingResult, outputPath);

        // Get file size
        const stats = await fs.stat(outputPath);

        // Save filled document
        const filledDoc = await prisma.document.create({
          data: {
            userId,
            fileName: `filled-${req.file.originalname}`,
            fileType: 'application/pdf',
            fileSize: stats.size,
            storageUrl: outputPath,
            status: 'COMPLETED',
            confidence: mappingResult.overallConfidence,
          },
        });

        // Cleanup temp form file
        await fs.unlink(formPath).catch(() => {});

        res.json({
          success: true,
          documentId: filledDoc.id,
          confidence: mappingResult.overallConfidence,
          filledFields: fillResult.filledFields.length,
          totalFields: formFieldsInfo.fields.length,
          downloadUrl: `/api/documents/${filledDoc.id}/download`,
          warnings: fillResult.warnings,
        });
      } catch (error) {
        logger.error('Fill form error:', error);
        next(error);
      }
    }
  );

  return router;
}

// Multer config for form upload
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF forms are supported'));
    }
  },
});

/**
 * Merge extracted data from multiple documents
 * Same logic as IntelliFillService.mergeExtractedData()
 */
function mergeExtractedData(dataArray: any[]): any {
  const merged: any = {
    fields: {},
    entities: {
      names: [],
      emails: [],
      phones: [],
      dates: [],
      addresses: [],
    },
    metadata: {
      confidence: 0,
      sourceCount: dataArray.length,
    },
  };

  let totalConfidence = 0;
  let confidenceCount = 0;

  for (const data of dataArray) {
    // Merge fields
    if (data.fields) {
      Object.assign(merged.fields, data.fields);
    }

    // Merge entities
    if (data.entities) {
      merged.entities.names.push(...(data.entities.names || []));
      merged.entities.emails.push(...(data.entities.emails || []));
      merged.entities.phones.push(...(data.entities.phones || []));
      merged.entities.dates.push(...(data.entities.dates || []));
      merged.entities.addresses.push(...(data.entities.addresses || []));
    }

    // Average confidence
    if (data.metadata?.confidence !== undefined && data.metadata.confidence !== null) {
      totalConfidence += data.metadata.confidence;
      confidenceCount++;
    }
  }

  // Calculate average confidence
  merged.metadata.confidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

  // Remove duplicates from entities
  merged.entities.names = [...new Set(merged.entities.names)];
  merged.entities.emails = [...new Set(merged.entities.emails)];
  merged.entities.phones = [...new Set(merged.entities.phones)];
  merged.entities.dates = [...new Set(merged.entities.dates)];
  merged.entities.addresses = [...new Set(merged.entities.addresses)];

  return merged;
}
