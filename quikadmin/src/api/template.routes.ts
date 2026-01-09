import { Router, Request, Response, NextFunction } from 'express';
import { TemplateService } from '../services/TemplateService';
import { authenticateSupabase, AuthenticatedRequest } from '../middleware/supabaseAuth';
import { logger } from '../utils/logger';

export function createTemplateRoutes(): Router {
  const router = Router();
  const templateService = new TemplateService();

  /**
   * GET /api/templates - Get all templates for authenticated user
   */
  router.get('/', authenticateSupabase, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User ID not found in request'
        });
      }

      logger.info(`Fetching templates for user: ${userId}`);

      const templates = await templateService.getTemplates(userId);

      // Format response with decrypted field count
      const formattedTemplates = templates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        formType: template.formType,
        isPublic: template.isPublic,
        usageCount: template.usageCount,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      }));

      res.json({
        success: true,
        templates: formattedTemplates,
        count: formattedTemplates.length
      });
    } catch (error) {
      logger.error('Get templates error:', error);
      next(error);
    }
  });

  /**
   * GET /api/templates/public - Get all public templates (marketplace)
   */
  router.get('/public', async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Fetching public templates');

      const templates = await templateService.getPublicTemplates();

      // Format response
      const formattedTemplates = templates.map((template: any) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        formType: template.formType,
        usageCount: template.usageCount,
        createdAt: template.createdAt,
        author: template.user ? {
          firstName: template.user.firstName,
          lastName: template.user.lastName
        } : null
      }));

      res.json({
        success: true,
        templates: formattedTemplates,
        count: formattedTemplates.length
      });
    } catch (error) {
      logger.error('Get public templates error:', error);
      next(error);
    }
  });

  /**
   * GET /api/templates/:id - Get a specific template by ID
   */
  router.get('/:id', authenticateSupabase, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const templateId = req.params.id;

      if (!templateId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Template ID is required'
        });
      }

      logger.info(`Fetching template ${templateId}`);

      const template = await templateService.getTemplateById(templateId, userId);

      if (!template) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Template not found'
        });
      }

      // Get decrypted field mappings
      const fieldMappings = await templateService.getTemplateFieldMappings(templateId, userId);

      res.json({
        success: true,
        template: {
          id: template.id,
          name: template.name,
          description: template.description,
          formType: template.formType,
          fieldMappings: fieldMappings,
          isPublic: template.isPublic,
          usageCount: template.usageCount,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt
        }
      });
    } catch (error) {
      logger.error('Get template error:', error);
      next(error);
    }
  });

  /**
   * POST /api/templates - Create a new template
   */
  router.post('/', authenticateSupabase, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User ID not found in request'
        });
      }

      const { name, description, formType, fieldMappings, isPublic } = req.body;

      // Validation
      if (!name || !formType || !fieldMappings) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Name, formType, and fieldMappings are required'
        });
      }

      if (!Array.isArray(fieldMappings)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'fieldMappings must be an array'
        });
      }

      logger.info(`Creating template for user: ${userId}`);

      const template = await templateService.createTemplate(userId, {
        name,
        description,
        formType,
        fieldMappings,
        isPublic: isPublic || false
      });

      res.status(201).json({
        success: true,
        message: 'Template created successfully',
        template: {
          id: template.id,
          name: template.name,
          description: template.description,
          formType: template.formType,
          isPublic: template.isPublic,
          createdAt: template.createdAt
        }
      });
    } catch (error) {
      logger.error('Create template error:', error);
      next(error);
    }
  });

  /**
   * PUT /api/templates/:id - Update a template
   */
  router.put('/:id', authenticateSupabase, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const templateId = req.params.id;

      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User ID not found in request'
        });
      }

      if (!templateId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Template ID is required'
        });
      }

      const { name, description, formType, fieldMappings, isPublic } = req.body;

      if (!name && !description && !formType && !fieldMappings && isPublic === undefined) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'At least one field to update is required'
        });
      }

      logger.info(`Updating template ${templateId} for user: ${userId}`);

      const updates: any = {};
      if (name) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (formType) updates.formType = formType;
      if (fieldMappings) updates.fieldMappings = fieldMappings;
      if (isPublic !== undefined) updates.isPublic = isPublic;

      const template = await templateService.updateTemplate(templateId, userId, updates);

      res.json({
        success: true,
        message: 'Template updated successfully',
        template: {
          id: template.id,
          name: template.name,
          description: template.description,
          formType: template.formType,
          isPublic: template.isPublic,
          updatedAt: template.updatedAt
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found or access denied')) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Template not found or access denied'
        });
      }
      logger.error('Update template error:', error);
      next(error);
    }
  });

  /**
   * DELETE /api/templates/:id - Delete a template
   */
  router.delete('/:id', authenticateSupabase, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const templateId = req.params.id;

      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User ID not found in request'
        });
      }

      if (!templateId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Template ID is required'
        });
      }

      logger.info(`Deleting template ${templateId} for user: ${userId}`);

      await templateService.deleteTemplate(templateId, userId);

      res.json({
        success: true,
        message: 'Template deleted successfully'
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found or access denied')) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Template not found or access denied'
        });
      }
      logger.error('Delete template error:', error);
      next(error);
    }
  });

  /**
   * POST /api/templates/detect - Detect form type from field names
   */
  router.post('/detect', authenticateSupabase, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { fieldNames } = req.body;

      if (!fieldNames || !Array.isArray(fieldNames)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'fieldNames array is required'
        });
      }

      if (fieldNames.length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'fieldNames array cannot be empty'
        });
      }

      logger.info(`Detecting form type from ${fieldNames.length} fields`);

      const result = await templateService.detectFormType(fieldNames);

      res.json({
        success: true,
        detection: result
      });
    } catch (error) {
      logger.error('Detect form type error:', error);
      next(error);
    }
  });

  /**
   * POST /api/templates/match - Find matching templates based on field names
   */
  router.post('/match', authenticateSupabase, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const { fieldNames } = req.body;

      if (!fieldNames || !Array.isArray(fieldNames)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'fieldNames array is required'
        });
      }

      if (fieldNames.length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'fieldNames array cannot be empty'
        });
      }

      logger.info(`Matching templates for ${fieldNames.length} fields`);

      const matches = await templateService.matchTemplate(fieldNames, userId);

      // Format response
      const formattedMatches = matches.map(match => ({
        template: {
          id: match.template.id,
          name: match.template.name,
          description: match.template.description,
          formType: match.template.formType,
          isPublic: match.template.isPublic,
          usageCount: match.template.usageCount
        },
        similarity: match.similarity,
        matchedFields: match.matchedFields,
        matchedFieldCount: match.matchedFields.length
      }));

      res.json({
        success: true,
        matches: formattedMatches,
        count: formattedMatches.length
      });
    } catch (error) {
      logger.error('Match templates error:', error);
      next(error);
    }
  });

  /**
   * POST /api/templates/:id/use - Increment usage count for a template
   */
  router.post('/:id/use', authenticateSupabase, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const templateId = req.params.id;

      if (!templateId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Template ID is required'
        });
      }

      await templateService.incrementUsageCount(templateId);

      res.json({
        success: true,
        message: 'Template usage recorded'
      });
    } catch (error) {
      logger.error('Increment usage error:', error);
      next(error);
    }
  });

  /**
   * POST /api/templates/:id/duplicate - Duplicate a template
   */
  router.post('/:id/duplicate', authenticateSupabase, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const templateId = req.params.id;

      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User ID not found in request'
        });
      }

      if (!templateId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Template ID is required'
        });
      }

      logger.info(`Duplicating template ${templateId} for user: ${userId}`);

      const duplicatedTemplate = await templateService.duplicateTemplate(templateId, userId);

      // Get decrypted field mappings for response
      const fieldMappings = await templateService.getTemplateFieldMappings(duplicatedTemplate.id, userId);

      res.status(201).json({
        success: true,
        message: 'Template duplicated successfully',
        template: {
          id: duplicatedTemplate.id,
          name: duplicatedTemplate.name,
          description: duplicatedTemplate.description,
          formType: duplicatedTemplate.formType,
          fieldMappings: fieldMappings,
          isPublic: duplicatedTemplate.isPublic,
          usageCount: duplicatedTemplate.usageCount,
          createdAt: duplicatedTemplate.createdAt,
          updatedAt: duplicatedTemplate.updatedAt
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found or access denied')) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Template not found or access denied'
        });
      }
      logger.error('Duplicate template error:', error);
      next(error);
    }
  });

  return router;
}
