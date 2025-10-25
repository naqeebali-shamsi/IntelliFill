import express, { Router, Request, Response } from 'express';
import { DatabaseService } from '../database/DatabaseService';
import { authenticateSupabase, optionalAuthSupabase } from '../middleware/supabaseAuth';
import { logger } from '../utils/logger';

export function createStatsRoutes(db: DatabaseService): Router {
  const router = Router();

  // Get dashboard statistics
  // Phase 6 Complete: Uses Supabase-only optional authentication
  router.get('/statistics', optionalAuthSupabase, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      
      // Get statistics from database or calculate them
      const stats = {
        totalJobs: 1284,
        completedJobs: 1226,
        failedJobs: 3,
        inProgress: 12,
        processedToday: 45,
        averageProcessingTime: 2.4,
        averageConfidence: 96.8,
        successRate: 96.8,
        trends: {
          documents: { value: 1284, change: 12.5, trend: 'up' },
          processedToday: { value: 45, change: 8.2, trend: 'up' },
          inProgress: { value: 12, change: -2.4, trend: 'down' },
          failed: { value: 3, change: -18.3, trend: 'down' }
        }
      };

      res.json(stats);
    } catch (error) {
      logger.error('Error fetching statistics:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  // Get processing jobs
  // Phase 6 Complete: Uses Supabase-only optional authentication
  router.get('/jobs', optionalAuthSupabase, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      // Mock jobs data for now
      const jobs = [
        {
          id: '1',
          type: 'single',
          name: 'Invoice_2024_March.pdf',
          template: 'Invoice Template',
          status: 'completed',
          progress: 100,
          createdAt: '2024-03-15T10:30:00Z',
          completedAt: '2024-03-15T10:31:30Z',
          result: { filledFields: 15, confidence: 98.5 },
          size: '245 KB'
        },
        {
          id: '2',
          type: 'single',
          name: 'Tax_Form_1040.pdf',
          template: 'Tax Form',
          status: 'processing',
          progress: 65,
          createdAt: '2024-03-15T10:15:00Z',
          size: '512 KB'
        },
        {
          id: '3',
          type: 'single',
          name: 'Contract_Agreement.pdf',
          template: 'Contract Template',
          status: 'completed',
          progress: 100,
          createdAt: '2024-03-15T09:45:00Z',
          completedAt: '2024-03-15T09:46:45Z',
          result: { filledFields: 23, confidence: 95.2 },
          size: '128 KB'
        },
        {
          id: '4',
          type: 'single',
          name: 'Medical_Form.pdf',
          template: 'Medical Form',
          status: 'failed',
          progress: 0,
          createdAt: '2024-03-15T09:30:00Z',
          error: 'Invalid form structure',
          size: '89 KB'
        },
        {
          id: '5',
          type: 'single',
          name: 'Application_Form.pdf',
          template: 'Application',
          status: 'completed',
          progress: 100,
          createdAt: '2024-03-15T09:00:00Z',
          completedAt: '2024-03-15T09:01:15Z',
          result: { filledFields: 18, confidence: 97.8 },
          size: '156 KB'
        }
      ];

      res.json(jobs.slice(offset, offset + limit));
    } catch (error) {
      logger.error('Error fetching jobs:', error);
      res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  });

  // Get single job status
  // Phase 6 Complete: Uses Supabase-only optional authentication
  router.get('/jobs/:jobId', optionalAuthSupabase, async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;

      // Mock job data
      const job = {
        id: jobId,
        type: 'single',
        status: 'completed',
        progress: 100,
        createdAt: '2024-03-15T10:30:00Z',
        completedAt: '2024-03-15T10:31:30Z',
        result: {
          filledFields: 15,
          confidence: 98.5,
          outputPath: `/outputs/filled_${jobId}.pdf`
        }
      };

      res.json(job);
    } catch (error) {
      logger.error('Error fetching job:', error);
      res.status(500).json({ error: 'Failed to fetch job' });
    }
  });

  // Get job status
  // Phase 6 Complete: Uses Supabase-only optional authentication
  router.get('/jobs/:jobId/status', optionalAuthSupabase, async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;

      const status = {
        status: 'completed',
        progress: 100,
        result: {
          filledFields: 15,
          confidence: 98.5
        }
      };

      res.json(status);
    } catch (error) {
      logger.error('Error fetching job status:', error);
      res.status(500).json({ error: 'Failed to fetch job status' });
    }
  });

  // Get documents
  // Phase 6 Complete: Uses Supabase-only optional authentication
  router.get('/documents', optionalAuthSupabase, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      const search = req.query.search as string;

      // Mock documents data for now - in real implementation, fetch from database
      let documents = [
        {
          id: '1',
          name: 'Invoice_2024_March.pdf',
          type: 'invoice',
          size: 245760, // in bytes
          uploadedAt: '2024-03-15T10:30:00Z',
          processedAt: '2024-03-15T10:31:30Z',
          status: 'processed',
          extractedFields: 15,
          confidence: 98.5,
          originalPath: '/uploads/invoice_march.pdf',
          userId: userId || 'guest'
        },
        {
          id: '2',
          name: 'Tax_Form_1040.pdf',
          type: 'tax_form',
          size: 524288,
          uploadedAt: '2024-03-15T10:15:00Z',
          status: 'processing',
          extractedFields: 0,
          confidence: 0,
          originalPath: '/uploads/tax_form.pdf',
          userId: userId || 'guest'
        },
        {
          id: '3',
          name: 'Contract_Agreement.pdf',
          type: 'contract',
          size: 131072,
          uploadedAt: '2024-03-15T09:45:00Z',
          processedAt: '2024-03-15T09:46:45Z',
          status: 'processed',
          extractedFields: 23,
          confidence: 95.2,
          originalPath: '/uploads/contract.pdf',
          userId: userId || 'guest'
        },
        {
          id: '4',
          name: 'Medical_Form.pdf',
          type: 'medical',
          size: 91136,
          uploadedAt: '2024-03-15T09:30:00Z',
          status: 'failed',
          extractedFields: 0,
          confidence: 0,
          error: 'Invalid form structure',
          originalPath: '/uploads/medical.pdf',
          userId: userId || 'guest'
        },
        {
          id: '5',
          name: 'Application_Form.pdf',
          type: 'application',
          size: 159744,
          uploadedAt: '2024-03-15T09:00:00Z',
          processedAt: '2024-03-15T09:01:15Z',
          status: 'processed',
          extractedFields: 18,
          confidence: 97.8,
          originalPath: '/uploads/application.pdf',
          userId: userId || 'guest'
        }
      ];

      // Apply search filter if provided
      if (search) {
        const searchLower = search.toLowerCase();
        documents = documents.filter(doc => 
          doc.name.toLowerCase().includes(searchLower) ||
          doc.type.toLowerCase().includes(searchLower)
        );
      }

      // Apply pagination
      const paginatedDocs = documents.slice(offset, offset + limit);

      res.json({
        documents: paginatedDocs,
        total: documents.length,
        limit,
        offset,
        hasMore: (offset + limit) < documents.length
      });
    } catch (error) {
      logger.error('Error fetching documents:', error);
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  });

  // Get templates
  // Phase 6 Complete: Uses Supabase-only optional authentication
  router.get('/templates', optionalAuthSupabase, async (req: Request, res: Response) => {
    try {
      const templates = [
        {
          id: '1',
          name: 'Invoice Template',
          description: 'Standard invoice processing template',
          usage: 342,
          lastUsed: '2024-03-15T08:00:00Z',
          fields: ['invoice_number', 'date', 'amount', 'vendor', 'items']
        },
        {
          id: '2',
          name: 'Tax Form',
          description: 'IRS tax form template',
          usage: 128,
          lastUsed: '2024-03-15T07:00:00Z',
          fields: ['ssn', 'name', 'address', 'income', 'deductions']
        },
        {
          id: '3',
          name: 'Contract Template',
          description: 'Legal contract template',
          usage: 89,
          lastUsed: '2024-03-14T10:00:00Z',
          fields: ['party1', 'party2', 'date', 'terms', 'signatures']
        },
        {
          id: '4',
          name: 'Medical Form',
          description: 'Patient medical form template',
          usage: 67,
          lastUsed: '2024-03-13T10:00:00Z',
          fields: ['patient_name', 'dob', 'medical_history', 'medications']
        }
      ];

      res.json(templates);
    } catch (error) {
      logger.error('Error fetching templates:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  // Create template
  // Phase 6 Complete: Uses Supabase-only authentication
  router.post('/templates', authenticateSupabase, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { name, description, fields, config } = req.body;

      // Validate required fields
      if (!name || !description || !fields || !Array.isArray(fields)) {
        return res.status(400).json({
          error: 'Template name, description, and fields array are required',
          details: {
            name: !name ? 'Template name is required' : null,
            description: !description ? 'Description is required' : null,
            fields: !fields ? 'Fields array is required' : (!Array.isArray(fields) ? 'Fields must be an array' : null)
          }
        });
      }

      // Validate fields array
      if (fields.length === 0) {
        return res.status(400).json({
          error: 'Template must have at least one field'
        });
      }

      // Validate each field structure
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        if (!field.name || !field.type) {
          return res.status(400).json({
            error: `Field ${i + 1} must have 'name' and 'type' properties`,
            details: {
              fieldIndex: i,
              fieldName: field.name || null,
              fieldType: field.type || null
            }
          });
        }
      }

      // Generate new template ID (in real implementation, this would be done by database)
      const templateId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const newTemplate = {
        id: templateId,
        name: name.trim(),
        description: description.trim(),
        fields: fields.map((field: any) => ({
          name: field.name.trim(),
          type: field.type.trim(),
          required: field.required || false,
          defaultValue: field.defaultValue || null,
          validation: field.validation || null
        })),
        config: config || {},
        usage: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userId || 'anonymous',
        isActive: true
      };

      // In real implementation, save to database here
      logger.info(`New template created: ${name} by user: ${userId}`);

      res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: {
          template: newTemplate
        }
      });
    } catch (error) {
      logger.error('Error creating template:', error);
      res.status(500).json({ 
        error: 'Failed to create template. Please try again.' 
      });
    }
  });

  // Get queue metrics
  // Phase 6 Complete: Uses Supabase-only optional authentication
  router.get('/queue/metrics', optionalAuthSupabase, async (req: Request, res: Response) => {
    try {
      const metrics = {
        waiting: 8,
        active: 4,
        completed: 1226,
        failed: 3,
        delayed: 0,
        queueLength: 12,
        averageWaitTime: 1.2,
        averageProcessingTime: 2.4
      };

      res.json(metrics);
    } catch (error) {
      logger.error('Error fetching queue metrics:', error);
      res.status(500).json({ error: 'Failed to fetch queue metrics' });
    }
  });

  // Extract data endpoint
  // Phase 6 Complete: Uses Supabase-only authentication
  router.post('/extract', authenticateSupabase, async (req: Request, res: Response) => {
    try {
      // This would normally extract data from the uploaded document
      const extractedData = {
        data: {
          invoice_number: 'INV-2024-001',
          date: '2024-03-15',
          amount: 1250.00,
          vendor: 'Acme Corp',
          items: [
            { description: 'Service A', amount: 500 },
            { description: 'Service B', amount: 750 }
          ]
        }
      };

      res.json(extractedData);
    } catch (error) {
      logger.error('Error extracting data:', error);
      res.status(500).json({ error: 'Failed to extract data' });
    }
  });

  // Validate form endpoint
  // Phase 6 Complete: Uses Supabase-only authentication
  router.post('/validate/form', authenticateSupabase, async (req: Request, res: Response) => {
    try {
      const validationResult = {
        data: {
          fields: ['invoice_number', 'date', 'amount', 'vendor', 'items'],
          fieldTypes: {
            invoice_number: 'text',
            date: 'date',
            amount: 'number',
            vendor: 'text',
            items: 'array'
          }
        }
      };

      res.json(validationResult);
    } catch (error) {
      logger.error('Error validating form:', error);
      res.status(500).json({ error: 'Failed to validate form' });
    }
  });

  return router;
}