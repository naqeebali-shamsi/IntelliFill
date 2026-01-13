import { Router, Request, Response, NextFunction } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import multer from 'multer';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { authenticateSupabase } from '../middleware/supabaseAuth';
import { decryptExtractedData } from '../middleware/encryptionMiddleware';
import { encryptFile } from '../utils/encryption';
import { logger } from '../utils/logger';
import { createProfileRoutes } from './profile.routes';
import { ExtractedData } from '../extractors/DataExtractor';
import { prisma } from '../utils/prisma';
import { validate } from '../middleware/validation';
import { updateProfileSchema, updateSettingsSchema } from '../validators/schemas';
import { supabaseAdmin } from '../utils/supabase';

// Validation schema for fill-form endpoint
const fillFormBodySchema = z.object({
  mappings: z.string().optional(),
  userData: z.string().optional(),
  overrideValues: z.string().optional(), // JSON string of field value overrides
  templateId: z.string().uuid().optional(), // Form template ID (alternative to file upload)
});

// Task 516: Validation schema for delete account endpoint
const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

/** Error response for JSON parsing failure */
interface JsonParseError {
  error: string;
  details: string;
}

/**
 * Safely parse a JSON string field from the request body.
 * Returns the parsed object or throws a JsonParseError.
 */
function parseJsonField<T extends object>(jsonString: string | undefined, fieldName: string): T {
  if (!jsonString) {
    return {} as T;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    const error: JsonParseError = {
      error: `Invalid JSON format in ${fieldName} field`,
      details: err instanceof Error ? err.message : 'Parse error',
    };
    throw error;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    const error: JsonParseError = {
      error: 'Invalid JSON format',
      details: `${fieldName} must be a valid JSON object`,
    };
    throw error;
  }

  return parsed as T;
}

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
   * GET /api/users/me/profile - Get user profile
   * Returns full profile data including phone, jobTitle, and bio.
   */
  router.get(
    '/me/profile',
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
            avatarUrl: true,
            phone: true,
            jobTitle: true,
            bio: true,
            updatedAt: true,
          },
        });

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json({
          success: true,
          data: { user },
        });
      } catch (error) {
        logger.error('Error fetching user profile:', error);
        next(error);
      }
    }
  );

  /**
   * PATCH /api/users/me/profile - Update user profile
   * Task 385: Update user profile fields (firstName, lastName, avatarUrl, phone, jobTitle, bio)
   */
  router.patch(
    '/me/profile',
    authenticateSupabase,
    validate(updateProfileSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Update user profile
        const user = await prisma.user.update({
          where: { id: userId },
          data: req.body,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            phone: true,
            jobTitle: true,
            bio: true,
            updatedAt: true,
          },
        });

        res.json({
          success: true,
          data: { user },
        });
      } catch (error) {
        logger.error('Error updating user profile:', error);
        next(error);
      }
    }
  );

  /**
   * GET /api/users/me/settings - Get user settings
   * Task 385: Retrieve current user settings
   */
  router.get(
    '/me/settings',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const settings = await prisma.userSettings.findUnique({
          where: { userId },
        });

        // Return empty object if no settings exist yet
        res.json({
          success: true,
          data: { settings: settings || {} },
        });
      } catch (error) {
        logger.error('Error fetching user settings:', error);
        next(error);
      }
    }
  );

  /**
   * PATCH /api/users/me/settings - Update user settings
   * Task 385: Update user settings with upsert (create if not exists)
   */
  router.patch(
    '/me/settings',
    authenticateSupabase,
    validate(updateSettingsSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Upsert settings (create if not exists, update if exists)
        const settings = await prisma.userSettings.upsert({
          where: { userId },
          update: req.body,
          create: {
            userId,
            ...req.body,
          },
        });

        res.json({
          success: true,
          data: { settings },
        });
      } catch (error) {
        logger.error('Error updating user settings:', error);
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

        // Validate request body
        const validation = fillFormBodySchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            error: 'Validation failed',
            details: validation.error.flatten().fieldErrors,
          });
        }

        // Support either file upload OR templateId
        let formPath: string;
        let tempFormFile: string | null = null;

        if (req.file) {
          formPath = req.file.path;
        } else if (validation.data.templateId) {
          // Fetch template and download its PDF
          const template = await prisma.formTemplate.findFirst({
            where: {
              id: validation.data.templateId,
              userId,
            },
          });

          if (!template || !template.fileUrl) {
            return res.status(404).json({ error: 'Form template not found or has no file' });
          }

          // Download template file to temp location
          const tempDir = path.join('uploads', 'temp');
          await fs.mkdir(tempDir, { recursive: true });
          tempFormFile = path.join(tempDir, `template-${Date.now()}.pdf`);

          // If fileUrl is a relative path, use local file system
          if (!template.fileUrl.startsWith('http')) {
            await fs.copyFile(template.fileUrl, tempFormFile);
          } else {
            // TODO: Download from remote URL (S3, etc.) if needed
            return res.status(400).json({ error: 'Remote template files not yet supported' });
          }
          formPath = tempFormFile;
        } else {
          return res.status(400).json({ error: 'Form file or templateId is required' });
        }

        // Parse JSON fields from request body
        let mappings: Record<string, string>;
        let overrideValues: Record<string, string>;
        let userData: ExtractedData | undefined;

        try {
          mappings = parseJsonField<Record<string, string>>(validation.data.mappings, 'mappings');
          overrideValues = parseJsonField<Record<string, string>>(
            validation.data.overrideValues,
            'overrideValues'
          );
          if (validation.data.userData) {
            userData = parseJsonField<ExtractedData>(validation.data.userData, 'userData');
          }
        } catch (parseError) {
          const err = parseError as JsonParseError;
          return res.status(400).json({ error: err.error, details: err.details });
        }

        if (!userData) {
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

        // Ensure outputs directory exists
        await fs.mkdir('outputs', { recursive: true });
        const originalFilename =
          req.file?.originalname || `template-${validation.data.templateId}.pdf`;
        const outputPath = path.join('outputs', `filled-${Date.now()}-${originalFilename}`);

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
            warnings: [],
          };
        } else {
          // Use ML auto-mapping
          mappingResult = await fieldMapper.mapFields(userData, formFieldsInfo.fields);
        }

        // Apply override values (user-edited field values take precedence)
        if (Object.keys(overrideValues).length > 0) {
          mappingResult.mappings = mappingResult.mappings.map(
            (mapping: {
              formField: string;
              dataField: string;
              value: unknown;
              confidence: number;
            }) => {
              if (mapping.formField in overrideValues) {
                return {
                  ...mapping,
                  value: overrideValues[mapping.formField],
                  confidence: 1.0, // User-provided value has max confidence
                };
              }
              return mapping;
            }
          );
        }

        // Fill form
        const fillResult = await formFiller.fillPDFForm(formPath, mappingResult, outputPath);

        // Encrypt the filled PDF for secure storage
        const filledPdfBuffer = await fs.readFile(outputPath);
        const encryptedBuffer = encryptFile(filledPdfBuffer);
        await fs.writeFile(outputPath, encryptedBuffer);

        // Get file size (of encrypted file)
        const stats = await fs.stat(outputPath);

        // Save filled document
        const filledDoc = await prisma.document.create({
          data: {
            userId,
            fileName: `filled-${originalFilename}`,
            fileType: 'application/pdf',
            fileSize: stats.size,
            storageUrl: outputPath,
            status: 'COMPLETED',
            confidence: mappingResult.overallConfidence,
          },
        });

        // Cleanup temp form file if we created one for template
        if (tempFormFile) {
          await fs.unlink(tempFormFile).catch(() => {});
        }
        // Also cleanup the uploaded file if present
        if (req.file) {
          await fs.unlink(req.file.path).catch(() => {});
        }

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

  /**
   * DELETE /api/users/me - Delete user account
   * Task 516: Securely delete user account with password verification
   */
  router.delete(
    '/me',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      try {
        // Validate request body
        const validation = deleteAccountSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            error: 'Validation failed',
            details: validation.error.flatten().fieldErrors,
          });
        }

        const { password } = validation.data;

        // Fetch user with password hash
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            password: true,
            supabaseUserId: true,
          },
        });

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Verify password
        const passwordValid = await bcrypt.compare(password, user.password);
        if (!passwordValid) {
          logger.warn('Delete account: invalid password attempt', { userId, email: user.email });
          return res.status(401).json({ error: 'Invalid password' });
        }

        // Create audit log entry BEFORE deletion (so we have userId reference)
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'USER_DELETED',
            entityType: 'User',
            entityId: user.id,
            metadata: {
              email: user.email,
              deletedAt: new Date().toISOString(),
              ipAddress: req.ip,
              userAgent: req.get('user-agent'),
            },
          },
        });

        // Delete all user data in transaction (order matters for FK constraints)
        await prisma.$transaction(async (tx) => {
          // Get client IDs for cascading deletes
          const clients = await tx.client.findMany({
            where: { userId },
            select: { id: true },
          });
          const clientIds = clients.map((c) => c.id);

          // Delete records that reference clients
          await tx.filledForm.deleteMany({ where: { clientId: { in: clientIds } } });
          await tx.clientProfile.deleteMany({ where: { clientId: { in: clientIds } } });

          // Delete user-owned records
          await tx.clientDocument.deleteMany({ where: { userId } });
          await tx.client.deleteMany({ where: { userId } });
          await tx.document.deleteMany({ where: { userId } });
          await tx.organizationMembership.deleteMany({ where: { userId } });
          await tx.organizationInvitation.deleteMany({ where: { invitedBy: userId } });
          await tx.userSettings.deleteMany({ where: { userId } });
          await tx.userProfile.deleteMany({ where: { userId } });
          await tx.refreshToken.deleteMany({ where: { userId } });
          await tx.session.deleteMany({ where: { userId } });
          await tx.formTemplate.deleteMany({ where: { userId } });
          await tx.documentSource.deleteMany({ where: { userId } });
          await tx.userFeedback.deleteMany({ where: { userId } });

          // Finally delete the user
          await tx.user.delete({ where: { id: userId } });
        });

        // Delete Supabase auth user if exists
        if (user.supabaseUserId) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(user.supabaseUserId);
          } catch (supabaseError) {
            // Log but don't fail - Prisma user is already deleted
            logger.error('Failed to delete Supabase auth user', {
              userId,
              supabaseUserId: user.supabaseUserId,
              error: supabaseError,
            });
          }
        }

        // Clear refresh token cookie
        const isTestMode = process.env.NODE_ENV === 'test';
        const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
        res.clearCookie('refreshToken', {
          httpOnly: true,
          secure: !isTestMode,
          // SameSite=None required for cross-origin cookie clearing (frontend on different subdomain)
          sameSite: isTestMode ? 'lax' : 'none',
          path: '/api', // Must match cookie path from supabase-auth.routes.ts
          ...(cookieDomain && { domain: cookieDomain }),
        });

        logger.info('User account deleted successfully', { userId, email: user.email });

        return res.json({
          success: true,
          message: 'Account deleted successfully',
        });
      } catch (error) {
        logger.error('Delete account error:', error);
        next(error);
      }
    }
  );

  /**
   * GET /api/users/me/export - Export all user data as JSON
   * Task 526: Data export for GDPR compliance and user data portability
   * Excludes: passwords, tokens, internal IDs, storage URLs
   */
  router.get(
    '/me/export',
    authenticateSupabase,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = (req as any).user?.id;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        logger.info('Starting data export', { userId });

        // Fetch user profile (exclude sensitive fields)
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            emailVerified: true,
            mfaEnabled: true,
            createdAt: true,
            updatedAt: true,
            lastLogin: true,
            avatarUrl: true,
            bio: true,
            jobTitle: true,
            phone: true,
            // Exclude: password, mfaBackupCodes, supabaseUserId, organizationId
          },
        });

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Fetch user profile
        const profile = await prisma.userProfile.findUnique({
          where: { userId },
          select: {
            profileData: true,
            createdAt: true,
            updatedAt: true,
            // Exclude: id, userId
          },
        });

        // Fetch user settings
        const settings = await prisma.userSettings.findUnique({
          where: { userId },
          select: {
            preferredLanguage: true,
            timezone: true,
            emailNotifications: true,
            notifyOnProcessComplete: true,
            notifyOnErrors: true,
            digestFrequency: true,
            defaultExtractionProfile: true,
            autoOcr: true,
            ocrLanguage: true,
            retainOriginalFiles: true,
            autoMlEnhancement: true,
            createdAt: true,
            updatedAt: true,
            // Exclude: id, userId
          },
        });

        // Fetch documents (sanitized)
        const documents = await prisma.document.findMany({
          where: { userId },
          select: {
            fileName: true,
            fileType: true,
            fileSize: true,
            status: true,
            extractedData: true,
            confidence: true,
            tags: true,
            processedAt: true,
            createdAt: true,
            updatedAt: true,
            // Exclude: id, userId, storageUrl, templateId, extractedText, reprocessingHistory
          },
          orderBy: { createdAt: 'desc' },
        });

        // Fetch clients with profiles
        const clients = await prisma.client.findMany({
          where: { userId },
          select: {
            name: true,
            type: true,
            status: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
            profile: {
              select: {
                data: true,
                fieldSources: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            // Exclude: id, userId
          },
          orderBy: { createdAt: 'desc' },
        });

        // Fetch templates (sanitized)
        const templates = await prisma.template.findMany({
          where: { userId },
          select: {
            name: true,
            description: true,
            formType: true,
            fieldMappings: true,
            isActive: true,
            isPublic: true,
            usageCount: true,
            createdAt: true,
            updatedAt: true,
            // Exclude: id, userId
          },
          orderBy: { createdAt: 'desc' },
        });

        // Assemble export data
        const exportData = {
          exportedAt: new Date().toISOString(),
          exportVersion: '1.0',
          user,
          profile: profile || null,
          settings: settings || null,
          documents,
          clients,
          templates,
          summary: {
            totalDocuments: documents.length,
            totalClients: clients.length,
            totalTemplates: templates.length,
          },
        };

        // Set headers for file download
        const timestamp = Date.now();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="intellifill-export-${timestamp}.json"`
        );

        logger.info('Data export completed', {
          userId,
          documentCount: documents.length,
          clientCount: clients.length,
          templateCount: templates.length,
        });

        return res.json(exportData);
      } catch (error) {
        logger.error('Data export error:', error);
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
