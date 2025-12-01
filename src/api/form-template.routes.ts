/**
 * Form Template API Routes
 *
 * Manages reusable PDF form templates with field mappings to client profile fields
 * Form templates are uploaded PDFs with detected fields mapped to standard profile fields
 *
 * Task 10: API: Form Template Endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateSupabase, optionalAuthSupabase } from '../middleware/supabaseAuth';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { FormCategory } from '@prisma/client';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { PDFDocument } from 'pdf-lib';

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: 'uploads/templates/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `template-${uniqueSuffix}.pdf`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit for templates
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Validation schemas
const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(255),
  description: z.string().max(1000).optional(),
  category: z.enum(['VISA', 'COMPANY_FORMATION', 'LABOR', 'IMMIGRATION', 'BANKING', 'GOVERNMENT', 'OTHER']).optional()
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  category: z.enum(['VISA', 'COMPANY_FORMATION', 'LABOR', 'IMMIGRATION', 'BANKING', 'GOVERNMENT', 'OTHER']).optional().nullable(),
  isActive: z.boolean().optional()
});

const updateMappingsSchema = z.object({
  fieldMappings: z.record(z.string()) // { formFieldName: profileFieldName }
});

const listTemplatesSchema = z.object({
  category: z.enum(['VISA', 'COMPANY_FORMATION', 'LABOR', 'IMMIGRATION', 'BANKING', 'GOVERNMENT', 'OTHER']).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0)
});

/**
 * Extract form field names from a PDF file
 */
async function extractPdfFormFields(filePath: string): Promise<string[]> {
  try {
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    return fields.map(field => field.getName());
  } catch (error) {
    logger.error('Error extracting PDF form fields:', error);
    return [];
  }
}

export function createFormTemplateRoutes(): Router {
  const router = Router();

  // Ensure uploads/templates directory exists
  fs.mkdir('uploads/templates', { recursive: true }).catch(() => {});

  /**
   * POST /api/form-templates - Upload and create a new form template
   */
  router.post('/', authenticateSupabase, upload.single('template'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'PDF template file is required' });
      }

      // Validate metadata from body
      const validation = createTemplateSchema.safeParse(req.body);
      if (!validation.success) {
        // Clean up uploaded file
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors
        });
      }

      const { name, description, category } = validation.data;

      // Extract form fields from PDF
      const detectedFields = await extractPdfFormFields(req.file.path);

      // Create template record
      const template = await prisma.formTemplate.create({
        data: {
          userId,
          name: name.trim(),
          description: description?.trim() || null,
          category: category as FormCategory || null,
          fileUrl: req.file.path,
          detectedFields: detectedFields,
          fieldMappings: {}
        }
      });

      logger.info(`Form template created: ${template.id} by user: ${userId}`);

      res.status(201).json({
        success: true,
        message: 'Form template created successfully',
        data: {
          template: {
            id: template.id,
            name: template.name,
            description: template.description,
            category: template.category,
            fileUrl: template.fileUrl,
            detectedFields,
            fieldCount: detectedFields.length,
            createdAt: template.createdAt.toISOString()
          }
        }
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      logger.error('Error creating form template:', error);
      next(error);
    }
  });

  /**
   * GET /api/form-templates - List all form templates for the user
   */
  router.get('/', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validate query params
      const validation = listTemplatesSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: validation.error.flatten().fieldErrors
        });
      }

      const { category, search, limit, offset } = validation.data;

      // Build where clause
      const whereClause: any = {
        userId,
        isActive: true
      };

      if (category) {
        whereClause.category = category;
      }

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [templates, total] = await Promise.all([
        prisma.formTemplate.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          include: {
            _count: {
              select: { filledForms: true }
            }
          }
        }),
        prisma.formTemplate.count({ where: whereClause })
      ]);

      const formattedTemplates = templates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        fieldCount: (t.detectedFields as string[])?.length || 0,
        mappedFieldCount: Object.keys(t.fieldMappings as object || {}).length,
        usageCount: t._count.filledForms,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString()
      }));

      res.json({
        success: true,
        data: {
          templates: formattedTemplates,
          pagination: {
            total,
            limit,
            offset,
            hasMore: (offset + limit) < total
          }
        }
      });
    } catch (error) {
      logger.error('Error listing form templates:', error);
      next(error);
    }
  });

  /**
   * GET /api/form-templates/:id - Get a single form template
   */
  router.get('/:id', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const template = await prisma.formTemplate.findFirst({
        where: { id, userId },
        include: {
          _count: {
            select: { filledForms: true }
          }
        }
      });

      if (!template) {
        return res.status(404).json({ error: 'Form template not found' });
      }

      res.json({
        success: true,
        data: {
          template: {
            id: template.id,
            name: template.name,
            description: template.description,
            category: template.category,
            fileUrl: template.fileUrl,
            detectedFields: template.detectedFields,
            fieldMappings: template.fieldMappings,
            fieldCount: (template.detectedFields as string[])?.length || 0,
            mappedFieldCount: Object.keys(template.fieldMappings as object || {}).length,
            usageCount: template._count.filledForms,
            isActive: template.isActive,
            createdAt: template.createdAt.toISOString(),
            updatedAt: template.updatedAt.toISOString()
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching form template:', error);
      next(error);
    }
  });

  /**
   * PUT /api/form-templates/:id - Update a form template
   */
  router.put('/:id', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validate request body
      const validation = updateTemplateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors
        });
      }

      // Check template exists
      const existing = await prisma.formTemplate.findFirst({
        where: { id, userId }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Form template not found' });
      }

      const { name, description, category, isActive } = validation.data;

      // Build update data
      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description?.trim() || null;
      if (category !== undefined) updateData.category = category;
      if (isActive !== undefined) updateData.isActive = isActive;

      const template = await prisma.formTemplate.update({
        where: { id },
        data: updateData
      });

      logger.info(`Form template updated: ${id} by user: ${userId}`);

      res.json({
        success: true,
        message: 'Form template updated successfully',
        data: {
          template: {
            id: template.id,
            name: template.name,
            description: template.description,
            category: template.category,
            isActive: template.isActive,
            updatedAt: template.updatedAt.toISOString()
          }
        }
      });
    } catch (error) {
      logger.error('Error updating form template:', error);
      next(error);
    }
  });

  /**
   * PUT /api/form-templates/:id/mappings - Update field mappings for a template
   */
  router.put('/:id/mappings', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validate request body
      const validation = updateMappingsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors
        });
      }

      // Check template exists
      const existing = await prisma.formTemplate.findFirst({
        where: { id, userId }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Form template not found' });
      }

      const { fieldMappings } = validation.data;

      // Validate that mapped form fields exist in detected fields
      const detectedFields = existing.detectedFields as string[] || [];
      const invalidFields = Object.keys(fieldMappings).filter(f => !detectedFields.includes(f));

      if (invalidFields.length > 0) {
        return res.status(400).json({
          error: 'Invalid field mappings',
          message: `The following form fields do not exist in the template: ${invalidFields.join(', ')}`,
          invalidFields
        });
      }

      const template = await prisma.formTemplate.update({
        where: { id },
        data: { fieldMappings }
      });

      logger.info(`Form template mappings updated: ${id} by user: ${userId}`);

      res.json({
        success: true,
        message: 'Field mappings updated successfully',
        data: {
          templateId: template.id,
          fieldMappings: template.fieldMappings,
          mappedFieldCount: Object.keys(template.fieldMappings as object).length,
          totalFieldCount: detectedFields.length
        }
      });
    } catch (error) {
      logger.error('Error updating form template mappings:', error);
      next(error);
    }
  });

  /**
   * DELETE /api/form-templates/:id - Delete a form template
   */
  router.delete('/:id', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check template exists
      const existing = await prisma.formTemplate.findFirst({
        where: { id, userId }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Form template not found' });
      }

      // Delete template file
      if (existing.fileUrl) {
        await fs.unlink(existing.fileUrl).catch((err) => {
          logger.warn(`Failed to delete template file: ${existing.fileUrl}`, err);
        });
      }

      // Delete template record (cascade will handle filled forms)
      await prisma.formTemplate.delete({
        where: { id }
      });

      logger.info(`Form template deleted: ${id} by user: ${userId}`);

      res.json({
        success: true,
        message: 'Form template deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting form template:', error);
      next(error);
    }
  });

  /**
   * GET /api/form-templates/:id/fields - Get detected fields and current mappings
   */
  router.get('/:id/fields', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const template = await prisma.formTemplate.findFirst({
        where: { id, userId },
        select: {
          id: true,
          name: true,
          detectedFields: true,
          fieldMappings: true
        }
      });

      if (!template) {
        return res.status(404).json({ error: 'Form template not found' });
      }

      const detectedFields = template.detectedFields as string[] || [];
      const mappings = template.fieldMappings as Record<string, string> || {};

      // Build field list with mapping status
      const fields = detectedFields.map(fieldName => ({
        formFieldName: fieldName,
        mappedTo: mappings[fieldName] || null,
        isMapped: !!mappings[fieldName]
      }));

      res.json({
        success: true,
        data: {
          templateId: template.id,
          templateName: template.name,
          fields,
          totalFields: detectedFields.length,
          mappedFields: Object.keys(mappings).length,
          unmappedFields: detectedFields.length - Object.keys(mappings).length
        }
      });
    } catch (error) {
      logger.error('Error fetching form template fields:', error);
      next(error);
    }
  });

  /**
   * POST /api/form-templates/:id/auto-map - Auto-map form fields to profile fields
   */
  router.post('/:id/auto-map', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const template = await prisma.formTemplate.findFirst({
        where: { id, userId }
      });

      if (!template) {
        return res.status(404).json({ error: 'Form template not found' });
      }

      const detectedFields = template.detectedFields as string[] || [];

      // Auto-mapping logic based on common field name patterns
      const autoMappings: Record<string, string> = {};
      const profileFieldPatterns: Record<string, RegExp[]> = {
        fullName: [/^(full[_\s]?name|name|applicant[_\s]?name)$/i],
        fullNameArabic: [/^(name[_\s]?arabic|arabic[_\s]?name)$/i],
        nationality: [/^(nationality|citizen)$/i],
        dateOfBirth: [/^(dob|date[_\s]?of[_\s]?birth|birth[_\s]?date)$/i],
        gender: [/^(gender|sex)$/i],
        passportNumber: [/^(passport[_\s]?(no|number|num))$/i],
        passportIssueDate: [/^(passport[_\s]?issue[_\s]?date)$/i],
        passportExpiryDate: [/^(passport[_\s]?expiry|passport[_\s]?exp)$/i],
        emiratesId: [/^(emirates[_\s]?id|eid|uid[_\s]?number)$/i],
        emiratesIdExpiry: [/^(eid[_\s]?expiry|emirates[_\s]?id[_\s]?exp)$/i],
        email: [/^(email|e[_\s]?mail)$/i],
        phone: [/^(phone|telephone|tel|mobile)$/i],
        address: [/^(address|street[_\s]?address)$/i],
        companyNameEn: [/^(company[_\s]?name|business[_\s]?name|employer)$/i],
        tradeLicenseNumber: [/^(license[_\s]?(no|number)|trade[_\s]?license)$/i],
        sponsorName: [/^(sponsor[_\s]?name|sponsor)$/i],
        occupation: [/^(occupation|job[_\s]?title|profession)$/i]
      };

      for (const formField of detectedFields) {
        for (const [profileField, patterns] of Object.entries(profileFieldPatterns)) {
          if (patterns.some(pattern => pattern.test(formField))) {
            autoMappings[formField] = profileField;
            break;
          }
        }
      }

      // Update template with auto-mappings (merge with existing)
      const existingMappings = template.fieldMappings as Record<string, string> || {};
      const mergedMappings = { ...autoMappings, ...existingMappings };

      await prisma.formTemplate.update({
        where: { id },
        data: { fieldMappings: mergedMappings }
      });

      logger.info(`Auto-mapped ${Object.keys(autoMappings).length} fields for template: ${id}`);

      res.json({
        success: true,
        message: 'Auto-mapping completed',
        data: {
          autoMapped: autoMappings,
          autoMappedCount: Object.keys(autoMappings).length,
          totalMappings: mergedMappings,
          totalMappedCount: Object.keys(mergedMappings).length,
          unmappedCount: detectedFields.length - Object.keys(mergedMappings).length
        }
      });
    } catch (error) {
      logger.error('Error auto-mapping form template:', error);
      next(error);
    }
  });

  /**
   * GET /api/form-templates/:id/preview - Preview form with sample data
   */
  router.get('/:id/preview', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;
      const { clientId } = req.query;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const template = await prisma.formTemplate.findFirst({
        where: { id, userId }
      });

      if (!template) {
        return res.status(404).json({ error: 'Form template not found' });
      }

      // Get client profile data if clientId provided
      let profileData: Record<string, any> = {};
      if (clientId) {
        const client = await prisma.client.findFirst({
          where: { id: clientId as string, userId },
          include: { profile: true }
        });

        if (client?.profile) {
          profileData = client.profile.data as Record<string, any> || {};
        }
      }

      // Build preview data
      const detectedFields = template.detectedFields as string[] || [];
      const mappings = template.fieldMappings as Record<string, string> || {};

      const previewData = detectedFields.map(formField => {
        const profileField = mappings[formField];
        return {
          formField,
          profileField: profileField || null,
          value: profileField ? profileData[profileField] || null : null,
          hasValue: profileField ? !!profileData[profileField] : false
        };
      });

      const filledCount = previewData.filter(d => d.hasValue).length;

      res.json({
        success: true,
        data: {
          templateId: template.id,
          templateName: template.name,
          clientId: clientId || null,
          fields: previewData,
          summary: {
            totalFields: detectedFields.length,
            mappedFields: Object.keys(mappings).length,
            filledFields: filledCount,
            missingFields: detectedFields.length - filledCount
          }
        }
      });
    } catch (error) {
      logger.error('Error previewing form template:', error);
      next(error);
    }
  });

  return router;
}
