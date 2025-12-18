/**
 * Client Management API Routes
 *
 * Implements CRUD operations for clients (companies or individuals)
 * Each client belongs to a user (PRO agent) and can have documents, profiles, and filled forms
 *
 * Task 6: API: Client CRUD Endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateSupabase } from '../middleware/supabaseAuth';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { prisma } from '../utils/prisma';
import { ClientType, ClientStatus } from '@prisma/client';
import { z } from 'zod';
import { createClientProfileRoutes } from './client-profile.routes';
import { createClientDocumentRoutes } from './client-documents.routes';

// Validation schemas
const createClientSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(255),
  type: z.enum(['COMPANY', 'INDIVIDUAL']).default('INDIVIDUAL'),
  notes: z.string().max(1000).optional()
});

const updateClientSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(['COMPANY', 'INDIVIDUAL']).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  notes: z.string().max(1000).optional().nullable()
});

const listClientsSchema = z.object({
  search: z.string().optional(),
  type: z.enum(['COMPANY', 'INDIVIDUAL']).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export function createClientRoutes(): Router {
  const router = Router();

  // Mount profile routes under /api/clients/:clientId/profile
  const profileRoutes = createClientProfileRoutes();
  router.use('/:clientId/profile', profileRoutes);

  // Mount document routes under /api/clients/:clientId/documents
  const documentRoutes = createClientDocumentRoutes();
  router.use('/:clientId/documents', documentRoutes);

  /**
   * POST /api/clients - Create a new client
   */
  router.post('/', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validate request body
      const validation = createClientSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors
        });
      }

      const { name, type, notes } = validation.data;

      // Create client
      const client = await prisma.client.create({
        data: {
          userId,
          name: name.trim(),
          type: type as ClientType,
          notes: notes?.trim() || null
        }
      });

      // Create an empty profile for the client
      await prisma.clientProfile.create({
        data: {
          clientId: client.id,
          data: {},
          fieldSources: {}
        }
      });

      logger.info(`Client created: ${client.id} by user: ${userId}`);

      res.status(201).json({
        success: true,
        message: 'Client created successfully',
        data: {
          client: {
            id: client.id,
            name: client.name,
            type: client.type,
            status: client.status,
            notes: client.notes,
            createdAt: client.createdAt.toISOString(),
            updatedAt: client.updatedAt.toISOString()
          }
        }
      });
    } catch (error) {
      logger.error('Error creating client:', error);
      next(error);
    }
  });

  /**
   * GET /api/clients - List all clients for the authenticated user
   * Supports search, filtering, pagination, and sorting
   */
  router.get('/', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validate query params
      const validation = listClientsSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: validation.error.flatten().fieldErrors
        });
      }

      const { search, type, status, limit, offset, sortBy, sortOrder } = validation.data;

      // Build where clause
      const whereClause: any = { userId };

      if (search) {
        whereClause.name = {
          contains: search,
          mode: 'insensitive'
        };
      }

      if (type) {
        whereClause.type = type;
      }

      if (status) {
        whereClause.status = status;
      }

      // Get clients with counts
      const [clients, total] = await Promise.all([
        prisma.client.findMany({
          where: whereClause,
          orderBy: { [sortBy]: sortOrder },
          take: limit,
          skip: offset,
          include: {
            _count: {
              select: {
                documents: true,
                filledForms: true
              }
            }
          }
        }),
        prisma.client.count({ where: whereClause })
      ]);

      // Format response
      const formattedClients = clients.map(client => ({
        id: client.id,
        name: client.name,
        type: client.type,
        status: client.status,
        notes: client.notes,
        documentCount: client._count.documents,
        formCount: client._count.filledForms,
        createdAt: client.createdAt.toISOString(),
        updatedAt: client.updatedAt.toISOString()
      }));

      res.json({
        success: true,
        data: {
          clients: formattedClients,
          pagination: {
            total,
            limit,
            offset,
            hasMore: (offset + limit) < total
          }
        }
      });
    } catch (error) {
      logger.error('Error listing clients:', error);
      next(error);
    }
  });

  /**
   * GET /api/clients/:id - Get a single client by ID
   */
  router.get('/:id', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const client = await prisma.client.findFirst({
        where: {
          id,
          userId // Ensure user can only access their own clients
        },
        include: {
          profile: true,
          _count: {
            select: {
              documents: true,
              filledForms: true,
              extractedData: true
            }
          }
        }
      });

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      res.json({
        success: true,
        data: {
          client: {
            id: client.id,
            name: client.name,
            type: client.type,
            status: client.status,
            notes: client.notes,
            documentCount: client._count.documents,
            formCount: client._count.filledForms,
            extractedDataCount: client._count.extractedData,
            hasProfile: !!client.profile,
            profileData: client.profile?.data || {},
            createdAt: client.createdAt.toISOString(),
            updatedAt: client.updatedAt.toISOString()
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching client:', error);
      next(error);
    }
  });

  /**
   * PUT /api/clients/:id - Update a client
   */
  router.put('/:id', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Validate request body
      const validation = updateClientSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors
        });
      }

      // Check if client exists and belongs to user
      const existingClient = await prisma.client.findFirst({
        where: { id, userId }
      });

      if (!existingClient) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const { name, type, status, notes } = validation.data;

      // Build update data
      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (type !== undefined) updateData.type = type;
      if (status !== undefined) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes?.trim() || null;

      // Update client
      const client = await prisma.client.update({
        where: { id },
        data: updateData
      });

      logger.info(`Client updated: ${id} by user: ${userId}`);

      res.json({
        success: true,
        message: 'Client updated successfully',
        data: {
          client: {
            id: client.id,
            name: client.name,
            type: client.type,
            status: client.status,
            notes: client.notes,
            createdAt: client.createdAt.toISOString(),
            updatedAt: client.updatedAt.toISOString()
          }
        }
      });
    } catch (error) {
      logger.error('Error updating client:', error);
      next(error);
    }
  });

  /**
   * DELETE /api/clients/:id - Delete a client and all associated data
   */
  router.delete('/:id', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if client exists and belongs to user
      const existingClient = await prisma.client.findFirst({
        where: { id, userId }
      });

      if (!existingClient) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // Delete client (cascade will handle related records)
      await prisma.client.delete({
        where: { id }
      });

      logger.info(`Client deleted: ${id} by user: ${userId}`);

      res.json({
        success: true,
        message: 'Client deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting client:', error);
      next(error);
    }
  });

  /**
   * POST /api/clients/:id/archive - Archive a client
   */
  router.post('/:id/archive', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if client exists and belongs to user
      const existingClient = await prisma.client.findFirst({
        where: { id, userId }
      });

      if (!existingClient) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // Archive client
      const client = await prisma.client.update({
        where: { id },
        data: { status: 'ARCHIVED' }
      });

      logger.info(`Client archived: ${id} by user: ${userId}`);

      res.json({
        success: true,
        message: 'Client archived successfully',
        data: {
          client: {
            id: client.id,
            name: client.name,
            status: client.status
          }
        }
      });
    } catch (error) {
      logger.error('Error archiving client:', error);
      next(error);
    }
  });

  /**
   * POST /api/clients/:id/restore - Restore an archived client
   */
  router.post('/:id/restore', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if client exists and belongs to user
      const existingClient = await prisma.client.findFirst({
        where: { id, userId }
      });

      if (!existingClient) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // Restore client
      const client = await prisma.client.update({
        where: { id },
        data: { status: 'ACTIVE' }
      });

      logger.info(`Client restored: ${id} by user: ${userId}`);

      res.json({
        success: true,
        message: 'Client restored successfully',
        data: {
          client: {
            id: client.id,
            name: client.name,
            status: client.status
          }
        }
      });
    } catch (error) {
      logger.error('Error restoring client:', error);
      next(error);
    }
  });

  /**
   * GET /api/clients/:id/summary - Get client summary with document and form counts
   */
  router.get('/:id/summary', authenticateSupabase, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const client = await prisma.client.findFirst({
        where: { id, userId },
        include: {
          profile: {
            select: {
              data: true,
              updatedAt: true
            }
          },
          documents: {
            select: {
              id: true,
              fileName: true,
              category: true,
              status: true,
              createdAt: true
            },
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          filledForms: {
            select: {
              id: true,
              fileUrl: true,
              createdAt: true,
              template: {
                select: {
                  name: true
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          _count: {
            select: {
              documents: true,
              filledForms: true,
              extractedData: true
            }
          }
        }
      });

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // Count profile fields that have values
      const profileData = (client.profile?.data || {}) as Record<string, any>;
      const filledFieldsCount = Object.values(profileData).filter(v => v !== null && v !== undefined && v !== '').length;

      res.json({
        success: true,
        data: {
          id: client.id,
          name: client.name,
          type: client.type,
          status: client.status,
          stats: {
            documentCount: client._count.documents,
            formCount: client._count.filledForms,
            extractedDataCount: client._count.extractedData,
            profileFieldsCount: filledFieldsCount
          },
          recentDocuments: client.documents.map(doc => ({
            id: doc.id,
            fileName: doc.fileName,
            category: doc.category,
            status: doc.status,
            createdAt: doc.createdAt.toISOString()
          })),
          recentForms: client.filledForms.map(form => ({
            id: form.id,
            templateName: form.template.name,
            fileUrl: form.fileUrl,
            createdAt: form.createdAt.toISOString()
          })),
          profileLastUpdated: client.profile?.updatedAt?.toISOString() || null,
          createdAt: client.createdAt.toISOString(),
          updatedAt: client.updatedAt.toISOString()
        }
      });
    } catch (error) {
      logger.error('Error fetching client summary:', error);
      next(error);
    }
  });

  return router;
}
