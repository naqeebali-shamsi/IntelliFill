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

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateSupabase } from '../middleware/supabaseAuth';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from 'pdf-lib';

// Validation schemas
const generateFormSchema = z.object({
  templateId: z.string().uuid('Invalid template ID'),
  clientId: z.string().uuid('Invalid client ID'),
  overrideData: z.record(z.any()).optional() // Optional data to override profile values
});

const listFilledFormsSchema = z.object({
  clientId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0)
});

/**
 * Fill a PDF form with profile data using field mappings
 */
async function fillPdfForm(
  templatePath: string,
  fieldMappings: Record<string, string>,
  profileData: Record<string, any>,
  outputPath: string
): Promise<{
  success: boolean;
  filledFields: string[];
  unmappedFields: string[];
  warnings: string[];
}> {
  const filledFields: string[] = [];
  const unmappedFields: string[] = [];
  const warnings: string[] = [];

  try {
    // Load the template PDF
    const pdfBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    logger.info(`Filling form with ${fields.length} fields`);

    // Fill each mapped field
    for (const field of fields) {
      const formFieldName = field.getName();
      const profileFieldName = fieldMappings[formFieldName];

      if (!profileFieldName) {
        unmappedFields.push(formFieldName);
        continue;
      }

      const value = profileData[profileFieldName];

      if (value === undefined || value === null || value === '') {
        warnings.push(`No data for profile field '${profileFieldName}' (form field: ${formFieldName})`);
        continue;
      }

      try {
        // Fill based on field type
        if (field instanceof PDFTextField) {
          field.setText(String(value));
          filledFields.push(formFieldName);
        } else if (field instanceof PDFCheckBox) {
          const boolValue = parseBoolean(value);
          if (boolValue) {
            field.check();
          } else {
            field.uncheck();
          }
          filledFields.push(formFieldName);
        } else if (field instanceof PDFDropdown) {
          const options = field.getOptions();
          const valueStr = String(value);
          if (options.includes(valueStr)) {
            field.select(valueStr);
            filledFields.push(formFieldName);
          } else {
            // Try case-insensitive match
            const match = options.find(opt => opt.toLowerCase() === valueStr.toLowerCase());
            if (match) {
              field.select(match);
              filledFields.push(formFieldName);
            } else {
              warnings.push(`Value '${valueStr}' not in dropdown options for '${formFieldName}'`);
            }
          }
        } else if (field instanceof PDFRadioGroup) {
          const options = field.getOptions();
          const valueStr = String(value);
          if (options.includes(valueStr)) {
            field.select(valueStr);
            filledFields.push(formFieldName);
          } else {
            warnings.push(`Value '${valueStr}' not in radio options for '${formFieldName}'`);
          }
        } else {
          warnings.push(`Unknown field type for '${formFieldName}'`);
        }
      } catch (fieldError) {
        warnings.push(`Failed to fill field '${formFieldName}': ${fieldError instanceof Error ? fieldError.message : 'Unknown error'}`);
      }
    }

    // Save the filled PDF
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const filledPdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPath, filledPdfBytes);

    return {
      success: true,
      filledFields,
      unmappedFields,
      warnings
    };
  } catch (error) {
    logger.error('Error filling PDF form:', error);
    throw new Error(`Failed to fill PDF form: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'checked' || lower === 'x';
  }
  return Boolean(value);
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
  router.post('/generate', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validate request body
      const validation = generateFormSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors
        });
      }

      const { templateId, clientId, overrideData } = validation.data;

      // Get the form template
      const template = await prisma.formTemplate.findFirst({
        where: { id: templateId, userId, isActive: true }
      });

      if (!template) {
        return res.status(404).json({ error: 'Form template not found or not accessible' });
      }

      // Get the client and their profile
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId },
        include: { profile: true }
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
          message: 'Please configure field mappings for this template before generating forms'
        });
      }

      // Generate unique output filename
      const timestamp = Date.now();
      const safeTemplateName = template.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const safeClientName = client.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const outputFileName = `${safeClientName}_${safeTemplateName}_${timestamp}.pdf`;
      const outputPath = `outputs/filled-forms/${outputFileName}`;

      // Fill the form
      const fillResult = await fillPdfForm(
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
          dataSnapshot: mergedData
        }
      });

      logger.info(`Generated filled form: ${filledForm.id}`, {
        templateId,
        clientId,
        filledFields: fillResult.filledFields.length,
        unmappedFields: fillResult.unmappedFields.length
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
            createdAt: filledForm.createdAt.toISOString()
          }
        }
      });
    } catch (error) {
      logger.error('Error generating filled form:', error);
      next(error);
    }
  });

  /**
   * POST /api/filled-forms/preview - Preview form filling without saving
   *
   * Shows what data would be filled into which fields without actually
   * generating the PDF.
   */
  router.post('/preview', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validate request body
      const validation = generateFormSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors
        });
      }

      const { templateId, clientId, overrideData } = validation.data;

      // Get the form template
      const template = await prisma.formTemplate.findFirst({
        where: { id: templateId, userId, isActive: true }
      });

      if (!template) {
        return res.status(404).json({ error: 'Form template not found' });
      }

      // Get the client and their profile
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId },
        include: { profile: true }
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
          status
        });
      }

      const filledCount = preview.filter(p => p.status === 'filled').length;
      const unmappedCount = preview.filter(p => p.status === 'unmapped').length;
      const missingDataCount = preview.filter(p => p.status === 'missing_data').length;

      res.json({
        success: true,
        data: {
          template: {
            id: template.id,
            name: template.name,
            totalFields: detectedFields.length
          },
          client: {
            id: client.id,
            name: client.name
          },
          preview,
          summary: {
            filledCount,
            unmappedCount,
            missingDataCount,
            completionPercentage: detectedFields.length > 0
              ? Math.round((filledCount / detectedFields.length) * 100)
              : 0
          }
        }
      });
    } catch (error) {
      logger.error('Error previewing form:', error);
      next(error);
    }
  });

  /**
   * GET /api/filled-forms - List all filled forms
   */
  router.get('/', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validate query params
      const validation = listFilledFormsSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: validation.error.flatten().fieldErrors
        });
      }

      const { clientId, templateId, limit, offset } = validation.data;

      // Build where clause
      const whereClause: any = { userId };
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
            template: { select: { id: true, name: true, category: true } }
          }
        }),
        prisma.filledForm.count({ where: whereClause })
      ]);

      const formattedForms = filledForms.map(form => ({
        id: form.id,
        clientId: form.clientId,
        clientName: form.client.name,
        templateId: form.templateId,
        templateName: form.template.name,
        templateCategory: form.template.category,
        fileUrl: form.fileUrl,
        downloadUrl: `/api/filled-forms/${form.id}/download`,
        createdAt: form.createdAt.toISOString()
      }));

      res.json({
        success: true,
        data: {
          filledForms: formattedForms,
          pagination: {
            total,
            limit,
            offset,
            hasMore: (offset + limit) < total
          }
        }
      });
    } catch (error) {
      logger.error('Error listing filled forms:', error);
      next(error);
    }
  });

  /**
   * GET /api/filled-forms/:id - Get a single filled form
   */
  router.get('/:id', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const filledForm = await prisma.filledForm.findFirst({
        where: { id, userId },
        include: {
          client: { select: { id: true, name: true, type: true } },
          template: { select: { id: true, name: true, category: true, fieldMappings: true } }
        }
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
            createdAt: filledForm.createdAt.toISOString()
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching filled form:', error);
      next(error);
    }
  });

  /**
   * GET /api/filled-forms/:id/download - Download a filled form PDF
   */
  router.get('/:id/download', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const filledForm = await prisma.filledForm.findFirst({
        where: { id, userId },
        include: {
          client: { select: { name: true } },
          template: { select: { name: true } }
        }
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
      const downloadName = `${filledForm.client.name}_${filledForm.template.name}.pdf`
        .replace(/[^a-zA-Z0-9._-]/g, '_');

      res.download(filledForm.fileUrl, downloadName);
    } catch (error) {
      logger.error('Error downloading filled form:', error);
      next(error);
    }
  });

  /**
   * DELETE /api/filled-forms/:id - Delete a filled form
   */
  router.delete('/:id', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const filledForm = await prisma.filledForm.findFirst({
        where: { id, userId }
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
        where: { id }
      });

      logger.info(`Filled form deleted: ${id}`);

      res.json({
        success: true,
        message: 'Filled form deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting filled form:', error);
      next(error);
    }
  });

  /**
   * POST /api/filled-forms/:id/regenerate - Regenerate a filled form with current profile data
   */
  router.post('/:id/regenerate', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const existingForm = await prisma.filledForm.findFirst({
        where: { id, userId },
        include: {
          template: true,
          client: { include: { profile: true } }
        }
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
      const safeTemplateName = existingForm.template.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const safeClientName = existingForm.client.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const outputFileName = `${safeClientName}_${safeTemplateName}_${timestamp}.pdf`;
      const outputPath = `outputs/filled-forms/${outputFileName}`;

      // Fill the form
      const fillResult = await fillPdfForm(
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
          dataSnapshot: profileData
        }
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
            createdAt: updatedForm.createdAt.toISOString()
          }
        }
      });
    } catch (error) {
      logger.error('Error regenerating filled form:', error);
      next(error);
    }
  });

  return router;
}
