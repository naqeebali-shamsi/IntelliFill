/**
 * Client Ownership Verification Middleware
 *
 * Verifies that the authenticated user owns the client specified in the route params.
 * Attaches the verified client to the request for use in route handlers.
 *
 * Usage:
 *   router.get('/:clientId', authenticateSupabase, verifyClientOwnership, handler);
 *   // Access client in handler via req.client
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './supabaseAuth';
import { prisma } from '../utils/prisma';
import { Client, ClientProfile } from '@prisma/client';
import { logger } from '../utils/logger';

/**
 * Extended request interface with verified client
 */
export interface ClientVerifiedRequest extends AuthenticatedRequest {
  client: Client;
  clientProfile?: ClientProfile | null;
}

/**
 * Extended request with client and profile included
 */
export interface ClientWithProfileRequest extends AuthenticatedRequest {
  client: Client & { profile: ClientProfile | null };
}

/**
 * Options for client ownership verification
 */
export interface VerifyClientOwnershipOptions {
  /** Include client profile in the request */
  includeProfile?: boolean;
  /** Custom param name for client ID (default: 'clientId') */
  clientIdParam?: string;
}

/**
 * Middleware factory to verify client ownership
 *
 * @param options - Configuration options
 * @returns Express middleware function
 *
 * @example
 * // Basic usage
 * router.get('/:clientId', authenticateSupabase, verifyClientOwnership(), handler);
 *
 * @example
 * // With profile included
 * router.get('/:clientId', authenticateSupabase, verifyClientOwnership({ includeProfile: true }), handler);
 *
 * @example
 * // Custom param name
 * router.get('/:id', authenticateSupabase, verifyClientOwnership({ clientIdParam: 'id' }), handler);
 */
export function verifyClientOwnership(options: VerifyClientOwnershipOptions = {}) {
  const { includeProfile = false, clientIdParam = 'clientId' } = options;

  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> => {
    try {
      const userId = req.user?.id;
      const clientId = req.params[clientIdParam];

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!clientId) {
        return res.status(400).json({ error: `Missing ${clientIdParam} parameter` });
      }

      // Verify client belongs to user
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId },
        include: includeProfile ? { profile: true } : undefined,
      });

      if (!client) {
        logger.debug('Client not found or does not belong to user', {
          clientId,
          userId,
        });
        return res.status(404).json({ error: 'Client not found' });
      }

      // Attach client to request for use in handlers
      (req as ClientVerifiedRequest).client = client;
      if (includeProfile && 'profile' in client) {
        (req as ClientWithProfileRequest).client = client as Client & {
          profile: ClientProfile | null;
        };
      }

      next();
    } catch (error) {
      logger.error('Error verifying client ownership:', error);
      next(error);
    }
  };
}

/**
 * Pre-configured middleware for basic client verification
 * Use when you only need to verify ownership without profile
 */
export const verifyClientOwnershipBasic = verifyClientOwnership();

/**
 * Pre-configured middleware that includes client profile
 * Use when route handler needs access to client profile data
 */
export const verifyClientOwnershipWithProfile = verifyClientOwnership({ includeProfile: true });

export default verifyClientOwnership;
