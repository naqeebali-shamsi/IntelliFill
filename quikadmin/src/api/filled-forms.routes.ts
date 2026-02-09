/**
 * Filled Forms API Routes
 *
 * Task 11: Form Generation Endpoint
 *
 * Generates filled PDF forms by combining:
 * - A form template (with field mappings)
 * - Client profile data
 *
 * The generated PDFs are stored and can be downloaded/re-generated
 */

import { Router, Response, NextFunction } from 'express';
import { authenticateSupabase, AuthenticatedRequest } from '../middleware/supabaseAuth';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import fs from 'fs/promises';
import { formFiller } from '../fillers/FormFiller';

// Validation schemas
const generateFormSchema = z.object({
  templateId: z.string().uuid('Invalid template ID'),
  clientId: z.string().uuid('Invalid client ID'),
  overrideData: z.record(z.unknown()).optional(), // Optional data to override profile values
});

// Schema for saving ad-hoc form fills (from SimpleFillForm workflow)
const saveAdhocFormSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
  clientId: z.string().uuid('Invalid client ID'),
  formName: z.string().min(1, 'Form name is required').max(255),
  confidence: z.number().min(0).max(1),
  filledFields: z.number().int().min(0),
  totalFields: z.number().int().min(0),
  dataSnapshot: z.record(z.unknown()).optional(),
});

const listFilledFormsSchema = z.object({
  clientId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

// Schema for batch form generation
const batchFormSchema = z.object({
  combinations: z
    .array(
      z.object({
        templateId: z.string().uuid('Invalid template ID'),
        profileId: z.string().uuid('Invalid profile ID'),
      })
    )
    .min(1, 'At least one combination is required')
    .max(50, 'Maximum 50 combinations per batch'),
});

// Result type for batch operations
interface BatchResult {
  templateId: string;
  templateName: string;
  profileId: string;
  profileName: string;
  success: boolean;
  documentId?: string;
  downloadUrl?: string;
  error?: string;
}

function createFailureResult(
  templateId: string,
  templateName: string,
  profileId: string,
  profileName: string,
  error: string
): BatchResult {
  return { templateId, templateName, profileId, profileName, success: false, error };
}

function createSuccessResult(
  templateId: string,
  templateName: string,
  profileId: string,
  profileName: string,
  documentId: string
): BatchResult {
  return {
    templateId,
    templateName,
    profileId,
    profileName,
    success: true,
    documentId,
    downloadUrl: `/api/filled-forms/${documentId}/download`,
  };
}

export function createFilledFormRoutes(): Router {
  const router = Router();

  // Ensure output directory exists
  fs.mkdir('outputs/filled-forms', { recursive: true }).catch(() => {});

  /**
   * POST /api/filled-forms/generate - Generate a filled PDF form
   *
   * Takes a template ID and client ID, applies field mappings to profile data,
   * and generates a filled PDF form.
   */
  router.post(
    '/generate',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Validate request body
        const validation = generateFormSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            error: 'Validation failed',
            details: validation.error.flatten().fieldErrors,
          });
        }

        const { templateId, clientId, overrideData } = validation.data;

        // Get the form template
        const template = await prisma.formTemplate.findFirst({
          where: { id: templateId, userId, isActive: true },
        });

        if (!template) {
          return res.status(404).json({ error: 'Form template not found or not accessible' });
        }

        // Get the client and their profile
        const client = await prisma.client.findFirst({
          where: { id: clientId, userId },
          include: { profile: true },
        });

        if (!client) {
          return res.status(404).json({ error: 'Client not found' });
        }

        // Check template file exists
        try {
          await fs.access(template.fileUrl);
        } catch {
          return res.status(404).json({ error: 'Template file not found on disk' });
        }

        // Get profile data
        const profileData = (client.profile?.data || {}) as Record<string, any>;

        // Merge with override data (override takes precedence)
        const mergedData = { ...profileData, ...overrideData };

        // Get field mappings
        const fieldMappings = (template.fieldMappings || {}) as Record<string, string>;

        if (Object.keys(fieldMappings).length === 0) {
          return res.status(400).json({
            error: 'No field mappings configured',
            message: 'Please configure field mappings for this template before generating forms',
          });
        }

        // Generate unique output filename
        const timestamp = Date.now();
        const safeTemplateName = template.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const safeClientName = client.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const outputFileName = `${safeClientName}_${safeTemplateName}_${timestamp}.pdf`;
        const outputPath = `outputs/filled-forms/${outputFileName}`;

        // Fill the form
        const fillResult = await formFiller.fillPDFFormWithData(
          template.fileUrl,
          fieldMappings,
          mergedData,
          outputPath
        );

        // Create filled form record
        const filledForm = await prisma.filledForm.create({
          data: {
            clientId,
            templateId,
            userId,
            fileUrl: outputPath,
            dataSnapshot: mergedData,
          },
        });

        logger.info(`Generated filled form: ${filledForm.id}`, {
          templateId,
          clientId,
          filledFields: fillResult.filledFields.length,
          unmappedFields: fillResult.unmappedFields.length,
        });

        res.status(201).json({
          success: true,
          message: 'Form generated successfully',
          data: {
            filledForm: {
              id: filledForm.id,
              clientId: filledForm.clientId,
              clientName: client.name,
              templateId: filledForm.templateId,
              templateName: template.name,
              fileUrl: filledForm.fileUrl,
              downloadUrl: `/api/filled-forms/${filledForm.id}/download`,
              filledFieldsCount: fillResult.filledFields.length,
              unmappedFieldsCount: fillResult.unmappedFields.length,
              warnings: fillResult.warnings,
              createdAt: filledForm.createdAt.toISOString(),
            },
          },
        });
      } catch (error) {
        logger.error('Error generating filled form:', error);
        next(error);
      }
    }
  );

  /**
   * POST /api/filled-forms/preview - Preview form filling without saving
   *
   * Shows what data would be filled into which fields without actually
   * generating the PDF.
   */
  router.post(
    '/preview',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Validate request body
        const validation = generateFormSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            error: 'Validation failed',
            details: validation.error.flatten().fieldErrors,
          });
        }

        const { templateId, clientId, overrideData } = validation.data;

        // Get the form template
        const template = await prisma.formTemplate.findFirst({
          where: { id: templateId, userId, isActive: true },
        });

        if (!template) {
          return res.status(404).json({ error: 'Form template not found' });
        }

        // Get the client and their profile
        const client = await prisma.client.findFirst({
          where: { id: clientId, userId },
          include: { profile: true },
        });

        if (!client) {
          return res.status(404).json({ error: 'Client not found' });
        }

        // Get profile data
        const profileData = (client.profile?.data || {}) as Record<string, any>;
        const mergedData = { ...profileData, ...overrideData };

        // Get field mappings and detected fields
        const fieldMappings = (template.fieldMappings || {}) as Record<string, string>;
        const detectedFields = (template.detectedFields || []) as string[];

        // Build preview
        const preview: Array<{
          formField: string;
          profileField: string | null;
          value: any;
          status: 'filled' | 'unmapped' | 'missing_data';
        }> = [];

        for (const formField of detectedFields) {
          const profileField = fieldMappings[formField] || null;
          const value = profileField ? mergedData[profileField] : undefined;

          let status: 'filled' | 'unmapped' | 'missing_data';
          if (!profileField) {
            status = 'unmapped';
          } else if (value === undefined || value === null || value === '') {
            status = 'missing_data';
          } else {
            status = 'filled';
          }

          preview.push({
            formField,
            profileField,
            value: value ?? null,
            status,
          });
        }

        const filledCount = preview.filter((p) => p.status === 'filled').length;
        const unmappedCount = preview.filter((p) => p.status === 'unmapped').length;
        const missingDataCount = preview.filter((p) => p.status === 'missing_data').length;

        res.json({
          success: true,
          data: {
            template: {
              id: template.id,
              name: template.name,
              totalFields: detectedFields.length,
            },
            client: {
              id: client.id,
              name: client.name,
            },
            preview,
            summary: {
              filledCount,
              unmappedCount,
              missingDataCount,
              completionPercentage:
                detectedFields.length > 0
                  ? Math.round((filledCount / detectedFields.length) * 100)
                  : 0,
            },
          },
        });
      } catch (error) {
        logger.error('Error previewing form:', error);
        next(error);
      }
    }
  );

  /**
   * GET /api/filled-forms - List all filled forms
   */
  router.get(
    '/',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Validate query params
        const validation = listFilledFormsSchema.safeParse(req.query);
        if (!validation.success) {
          return res.status(400).json({
            error: 'Invalid query parameters',
            details: validation.error.flatten().fieldErrors,
          });
        }

        const { clientId, templateId, limit, offset } = validation.data;

        // Build where clause
        const whereClause: Prisma.FilledFormWhereInput = { userId };
        if (clientId) whereClause.clientId = clientId;
        if (templateId) whereClause.templateId = templateId;

        const [filledForms, total] = await Promise.all([
          prisma.filledForm.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
            include: {
              client: { select: { id: true, name: true } },
              template: { select: { id: true, name: true, category: true } },
            },
          }),
          prisma.filledForm.count({ where: whereClause }),
        ]);

        const formattedForms = filledForms.map((form) => ({
          id: form.id,
          clientId: form.clientId,
          clientName: form.client.name,
          templateId: form.templateId,
          templateName: form.template.name,
          templateCategory: form.template.category,
          fileUrl: form.fileUrl,
          downloadUrl: `/api/filled-forms/${form.id}/download`,
          createdAt: form.createdAt.toISOString(),
        }));

        res.json({
          success: true,
          data: {
            filledForms: formattedForms,
            pagination: {
              total,
              limit,
              offset,
              hasMore: offset + limit < total,
            },
          },
        });
      } catch (error) {
        logger.error('Error listing filled forms:', error);
        next(error);
      }
    }
  );

  /**
   * GET /api/filled-forms/:id - Get a single filled form
   */
  router.get(
    '/:id',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;
        const { id } = req.params;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const filledForm = await prisma.filledForm.findFirst({
          where: { id, userId },
          include: {
            client: { select: { id: true, name: true, type: true } },
            template: { select: { id: true, name: true, category: true, fieldMappings: true } },
          },
        });

        if (!filledForm) {
          return res.status(404).json({ error: 'Filled form not found' });
        }

        res.json({
          success: true,
          data: {
            filledForm: {
              id: filledForm.id,
              clientId: filledForm.clientId,
              clientName: filledForm.client.name,
              clientType: filledForm.client.type,
              templateId: filledForm.templateId,
              templateName: filledForm.template.name,
              templateCategory: filledForm.template.category,
              fileUrl: filledForm.fileUrl,
              downloadUrl: `/api/filled-forms/${filledForm.id}/download`,
              dataSnapshot: filledForm.dataSnapshot,
              createdAt: filledForm.createdAt.toISOString(),
            },
          },
        });
      } catch (error) {
        logger.error('Error fetching filled form:', error);
        next(error);
      }
    }
  );

  /**
   * GET /api/filled-forms/:id/download - Download a filled form PDF
   */
  router.get(
    '/:id/download',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;
        const { id } = req.params;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const filledForm = await prisma.filledForm.findFirst({
          where: { id, userId },
          include: {
            client: { select: { name: true } },
            template: { select: { name: true } },
          },
        });

        if (!filledForm) {
          return res.status(404).json({ error: 'Filled form not found' });
        }

        // Check file exists
        try {
          await fs.access(filledForm.fileUrl);
        } catch {
          return res.status(404).json({ error: 'PDF file not found on disk' });
        }

        // Generate download filename
        const downloadName = `${filledForm.client.name}_${filledForm.template.name}.pdf`.replace(
          /[^a-zA-Z0-9._-]/g,
          '_'
        );

        res.download(filledForm.fileUrl, downloadName);
      } catch (error) {
        logger.error('Error downloading filled form:', error);
        next(error);
      }
    }
  );

  /**
   * GET /api/filled-forms/:id/export - Export a filled form in various formats
   *
   * Task 550: Multi-Format Export for Filled Forms
   *
   * Query params:
   * - format: 'pdf' (default), 'json', or 'csv'
   */
  router.get(
    '/:id/export',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;
        const { id } = req.params;
        const format = (req.query.format as string)?.toLowerCase() || 'pdf';

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Validate format
        const supportedFormats = ['pdf', 'json', 'csv'];
        if (!supportedFormats.includes(format)) {
          return res.status(400).json({
            error: 'Invalid format',
            message: `Supported formats: ${supportedFormats.join(', ')}`,
          });
        }

        const filledForm = await prisma.filledForm.findFirst({
          where: { id, userId },
          include: {
            client: { select: { name: true } },
            template: { select: { name: true } },
          },
        });

        if (!filledForm) {
          return res.status(404).json({ error: 'Filled form not found' });
        }

        const baseName = `${filledForm.client.name}_${filledForm.template.name}`.replace(
          /[^a-zA-Z0-9._-]/g,
          '_'
        );

        if (format === 'pdf') {
          await exportFormAsPdf(filledForm, baseName, res);
        } else if (format === 'json') {
          exportFormAsJson(filledForm, baseName, res);
        } else if (format === 'csv') {
          exportFormAsCsv(filledForm, baseName, res);
        }

        logger.info(`Exported filled form ${id} as ${format}`, { userId, format });
      } catch (error) {
        logger.error('Error exporting filled form:', error);
        next(error);
      }
    }
  );

  /**
   * Export filled form as PDF
   */
  async function exportFormAsPdf(
    filledForm: { fileUrl: string },
    baseName: string,
    res: Response
  ): Promise<void> {
    try {
      await fs.access(filledForm.fileUrl);
    } catch {
      res.status(404).json({ error: 'PDF file not found on disk' });
      return;
    }
    res.download(filledForm.fileUrl, `${baseName}.pdf`);
  }

  /**
   * Export filled form as JSON
   */
  function exportFormAsJson(
    filledForm: {
      client: { name: string };
      template: { name: string };
      dataSnapshot: unknown;
      createdAt: Date;
    },
    baseName: string,
    res: Response
  ): void {
    const jsonData = {
      formName: filledForm.template.name,
      clientName: filledForm.client.name,
      data: filledForm.dataSnapshot || {},
      createdAt: filledForm.createdAt.toISOString(),
      exportedAt: new Date().toISOString(),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.json"`);
    res.json(jsonData);
  }

  /**
   * Export filled form as CSV
   */
  function exportFormAsCsv(
    filledForm: { client: { name: string }; dataSnapshot: unknown },
    baseName: string,
    res: Response
  ): void {
    const dataSnapshot = (filledForm.dataSnapshot || {}) as Record<string, unknown>;
    const rows: string[] = ['Field,Value'];

    for (const [field, value] of Object.entries(dataSnapshot)) {
      let escapedField = field;
      let escapedValue = String(value ?? '');
      // Prevent CSV formula injection
      if (/^[=+\-@\t\r]/.test(escapedField)) {
        escapedField = "'" + escapedField;
      }
      if (/^[=+\-@\t\r]/.test(escapedValue)) {
        escapedValue = "'" + escapedValue;
      }
      escapedValue = escapedValue.replace(/"/g, '""').replace(/\n/g, ' ');
      rows.push(`"${escapedField.replace(/"/g, '""')}","${escapedValue}"`);
    }

    const csvContent = rows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.csv"`);
    res.send(csvContent);
  }

  /**
   * DELETE /api/filled-forms/:id - Delete a filled form
   */
  router.delete(
    '/:id',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;
        const { id } = req.params;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const filledForm = await prisma.filledForm.findFirst({
          where: { id, userId },
        });

        if (!filledForm) {
          return res.status(404).json({ error: 'Filled form not found' });
        }

        // Delete file from disk
        if (filledForm.fileUrl) {
          await fs.unlink(filledForm.fileUrl).catch((err) => {
            logger.warn(`Failed to delete filled form file: ${filledForm.fileUrl}`, err);
          });
        }

        // Delete record
        await prisma.filledForm.delete({
          where: { id },
        });

        logger.info(`Filled form deleted: ${id}`);

        res.json({
          success: true,
          message: 'Filled form deleted successfully',
        });
      } catch (error) {
        logger.error('Error deleting filled form:', error);
        next(error);
      }
    }
  );

  /**
   * POST /api/filled-forms/:id/regenerate - Regenerate a filled form with current profile data
   */
  router.post(
    '/:id/regenerate',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;
        const { id } = req.params;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const existingForm = await prisma.filledForm.findFirst({
          where: { id, userId },
          include: {
            template: true,
            client: { include: { profile: true } },
          },
        });

        if (!existingForm) {
          return res.status(404).json({ error: 'Filled form not found' });
        }

        // Check template file exists
        try {
          await fs.access(existingForm.template.fileUrl);
        } catch {
          return res.status(404).json({ error: 'Template file no longer available' });
        }

        // Get current profile data
        const profileData = (existingForm.client.profile?.data || {}) as Record<string, any>;
        const fieldMappings = (existingForm.template.fieldMappings || {}) as Record<string, string>;

        // Generate new output file
        const timestamp = Date.now();
        const safeTemplateName = existingForm.template.name
          .replace(/[^a-zA-Z0-9]/g, '-')
          .toLowerCase();
        const safeClientName = existingForm.client.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const outputFileName = `${safeClientName}_${safeTemplateName}_${timestamp}.pdf`;
        const outputPath = `outputs/filled-forms/${outputFileName}`;

        // Fill the form
        const fillResult = await formFiller.fillPDFFormWithData(
          existingForm.template.fileUrl,
          fieldMappings,
          profileData,
          outputPath
        );

        // Delete old file
        if (existingForm.fileUrl) {
          await fs.unlink(existingForm.fileUrl).catch(() => {});
        }

        // Update record
        const updatedForm = await prisma.filledForm.update({
          where: { id },
          data: {
            fileUrl: outputPath,
            dataSnapshot: profileData,
          },
        });

        logger.info(`Regenerated filled form: ${id}`);

        res.json({
          success: true,
          message: 'Form regenerated successfully',
          data: {
            filledForm: {
              id: updatedForm.id,
              fileUrl: updatedForm.fileUrl,
              downloadUrl: `/api/filled-forms/${updatedForm.id}/download`,
              filledFieldsCount: fillResult.filledFields.length,
              warnings: fillResult.warnings,
              createdAt: updatedForm.createdAt.toISOString(),
            },
          },
        });
      } catch (error) {
        logger.error('Error regenerating filled form:', error);
        next(error);
      }
    }
  );

  /**
   * POST /api/filled-forms/save-adhoc - Save an ad-hoc filled form to history
   *
   * Task 490: Integrate Form Filling with Filled Forms API
   *
   * This endpoint saves form fills from the SimpleFillForm workflow (which uses
   * ad-hoc form uploads rather than saved templates). It creates a minimal
   * "ad-hoc template" record and links the filled form to it.
   */
  router.post(
    '/save-adhoc',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Validate request body
        const validation = saveAdhocFormSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            error: 'Validation failed',
            details: validation.error.flatten().fieldErrors,
          });
        }

        const {
          documentId,
          clientId,
          formName,
          confidence,
          filledFields,
          totalFields,
          dataSnapshot,
        } = validation.data;

        // Verify the document exists and belongs to the user
        const document = await prisma.document.findFirst({
          where: { id: documentId, userId },
        });

        if (!document) {
          return res.status(404).json({ error: 'Document not found' });
        }

        // Verify the client exists and belongs to the user
        const client = await prisma.client.findFirst({
          where: { id: clientId, userId },
        });

        if (!client) {
          return res.status(404).json({ error: 'Client/Profile not found' });
        }

        // Create or find an "Ad-hoc Forms" template for this user
        // This is a virtual template that groups all ad-hoc form fills
        let adhocTemplate = await prisma.formTemplate.findFirst({
          where: {
            userId,
            name: '__ADHOC_FORMS__',
          },
        });

        if (!adhocTemplate) {
          adhocTemplate = await prisma.formTemplate.create({
            data: {
              userId,
              name: '__ADHOC_FORMS__',
              description: 'System template for ad-hoc form fills',
              fileUrl: '', // No actual file for ad-hoc template
              fieldMappings: {},
              detectedFields: [],
              isActive: false, // Hidden from template list
            },
          });
        }

        // Create filled form record
        const filledForm = await prisma.filledForm.create({
          data: {
            clientId,
            templateId: adhocTemplate.id,
            userId,
            fileUrl: document.storageUrl,
            dataSnapshot: {
              formName,
              confidence,
              filledFields,
              totalFields,
              originalDocumentId: documentId,
              ...(dataSnapshot || {}),
            },
          },
        });

        logger.info(`Saved ad-hoc filled form: ${filledForm.id}`, {
          documentId,
          clientId,
          formName,
        });

        res.status(201).json({
          success: true,
          message: 'Form saved to history',
          data: {
            id: filledForm.id,
            clientId: filledForm.clientId,
            clientName: client.name,
            formName,
            confidence,
            filledFields,
            totalFields,
            downloadUrl: `/api/documents/${documentId}/download`,
            createdAt: filledForm.createdAt.toISOString(),
          },
        });
      } catch (error) {
        logger.error('Error saving ad-hoc filled form:', error);
        next(error);
      }
    }
  );

  /**
   * POST /api/filled-forms/batch - Generate multiple filled forms in batch
   *
   * Task 549: Batch Form Filling UI
   *
   * Takes an array of template/profile combinations and generates filled
   * forms for each valid combination. Returns results for all combinations.
   */
  router.post(
    '/batch',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Validate request body
        const validation = batchFormSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            error: 'Validation failed',
            details: validation.error.flatten().fieldErrors,
          });
        }

        const { combinations } = validation.data;

        // Get unique template and profile IDs
        const templateIds = [...new Set(combinations.map((c) => c.templateId))];
        const profileIds = [...new Set(combinations.map((c) => c.profileId))];

        // Fetch all templates at once
        const templates = await prisma.formTemplate.findMany({
          where: { id: { in: templateIds }, userId, isActive: true },
        });
        const templateMap = new Map(templates.map((t) => [t.id, t]));

        // Fetch all clients/profiles at once
        const clients = await prisma.client.findMany({
          where: { id: { in: profileIds }, userId },
          include: { profile: true },
        });
        const clientMap = new Map(clients.map((c) => [c.id, c]));

        const results: BatchResult[] = [];

        let totalGenerated = 0;
        let totalFailed = 0;

        // Process each combination
        for (const combination of combinations) {
          const template = templateMap.get(combination.templateId);
          const client = clientMap.get(combination.profileId);

          // Handle missing template
          if (!template) {
            results.push(
              createFailureResult(
                combination.templateId,
                'Unknown',
                combination.profileId,
                client?.name || 'Unknown',
                'Template not found or not accessible'
              )
            );
            totalFailed++;
            continue;
          }

          // Handle missing client/profile
          if (!client) {
            results.push(
              createFailureResult(
                combination.templateId,
                template.name,
                combination.profileId,
                'Unknown',
                'Profile not found'
              )
            );
            totalFailed++;
            continue;
          }

          // Check template file exists
          try {
            await fs.access(template.fileUrl);
          } catch {
            results.push(
              createFailureResult(
                template.id,
                template.name,
                client.id,
                client.name,
                'Template file not found on disk'
              )
            );
            totalFailed++;
            continue;
          }

          // Get field mappings
          const fieldMappings = (template.fieldMappings || {}) as Record<string, string>;
          if (Object.keys(fieldMappings).length === 0) {
            results.push(
              createFailureResult(
                template.id,
                template.name,
                client.id,
                client.name,
                'No field mappings configured for this template'
              )
            );
            totalFailed++;
            continue;
          }

          // Get profile data
          const profileData = (client.profile?.data || {}) as Record<string, unknown>;

          // Generate output filename
          const timestamp = Date.now();
          const safeTemplateName = template.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
          const safeClientName = client.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
          const outputFileName = `${safeClientName}_${safeTemplateName}_${timestamp}.pdf`;
          const outputPath = `outputs/filled-forms/${outputFileName}`;

          try {
            await formFiller.fillPDFFormWithData(
              template.fileUrl,
              fieldMappings,
              profileData,
              outputPath
            );

            const filledForm = await prisma.filledForm.create({
              data: {
                clientId: client.id,
                templateId: template.id,
                userId,
                fileUrl: outputPath,
                dataSnapshot: profileData as Prisma.InputJsonValue,
              },
            });

            results.push(
              createSuccessResult(template.id, template.name, client.id, client.name, filledForm.id)
            );
            totalGenerated++;
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error during form generation';
            results.push(
              createFailureResult(template.id, template.name, client.id, client.name, errorMessage)
            );
            totalFailed++;
          }
        }

        logger.info(`Batch form generation complete`, {
          userId,
          totalCombinations: combinations.length,
          totalGenerated,
          totalFailed,
        });

        res.status(200).json({
          success: true,
          results,
          totalGenerated,
          totalFailed,
        });
      } catch (error) {
        logger.error('Error processing batch form generation:', error);
        next(error);
      }
    }
  );

  return router;
}
