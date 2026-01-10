/**
 * Shared Document Access Routes
 * Public endpoints for accessing shared documents via access token
 * @module api/shared.routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { decryptExtractedData, decryptFile } from '../middleware/encryptionMiddleware';
import { normalizeExtractedData, flattenExtractedData } from '../types/extractedData';
import { fetchFromStorage } from '../services/storageHelper';
import * as path from 'path';
import * as fs from 'fs/promises';

export function createSharedRoutes(): Router {
  const router = Router();

  /**
   * GET /api/shared/:token - Access a shared document
   *
   * This is a PUBLIC endpoint - no authentication required.
   * Access is controlled by the share token and expiration.
   *
   * Query params:
   * - includeConfidence: boolean (default: false) - Include per-field confidence scores
   *
   * Response includes document metadata and extracted data based on permission level:
   * - VIEW: Can view document metadata and extracted data
   * - COMMENT: Same as VIEW (commenting feature TBD)
   * - EDIT: Same as VIEW + can download original file
   */
  router.get('/:token', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.params;
      const includeConfidence = req.query.includeConfidence === 'true';

      // Find share by access token
      const share = await prisma.documentShare.findUnique({
        where: { accessToken: token },
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
              fileType: true,
              fileSize: true,
              status: true,
              extractedText: true,
              extractedData: true,
              confidence: true,
              processedAt: true,
              createdAt: true,
              tags: true,
            },
          },
          sharedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Check if share exists
      if (!share) {
        return res.status(404).json({
          error: 'Share not found',
          code: 'SHARE_NOT_FOUND',
        });
      }

      // Check if share has expired
      if (share.expiresAt && share.expiresAt < new Date()) {
        return res.status(410).json({
          error: 'This share link has expired',
          code: 'SHARE_EXPIRED',
          expiredAt: share.expiresAt,
        });
      }

      // Check if document still exists
      if (!share.document) {
        return res.status(404).json({
          error: 'The shared document no longer exists',
          code: 'DOCUMENT_DELETED',
        });
      }

      // Update access tracking atomically
      await prisma.documentShare.update({
        where: { id: share.id },
        data: {
          accessCount: { increment: 1 },
          lastAccessedAt: new Date(),
        },
      });

      // Decrypt extracted data if it exists
      let extractedData = null;
      if (share.document.extractedData) {
        const decrypted = decryptExtractedData(share.document.extractedData as string);

        if (includeConfidence) {
          extractedData = normalizeExtractedData(decrypted, 0, 'pattern');
        } else {
          extractedData = flattenExtractedData(decrypted);
        }
      }

      // Build sharedBy name
      const sharedByName = share.sharedBy
        ? `${share.sharedBy.firstName || ''} ${share.sharedBy.lastName || ''}`.trim() || 'Unknown'
        : 'Unknown';

      logger.info('Shared document accessed', {
        shareId: share.id,
        documentId: share.documentId,
        accessCount: share.accessCount + 1,
      });

      res.json({
        success: true,
        document: {
          id: share.document.id,
          fileName: share.document.fileName,
          fileType: share.document.fileType,
          fileSize: share.document.fileSize,
          status: share.document.status,
          confidence: share.document.confidence,
          processedAt: share.document.processedAt,
          createdAt: share.document.createdAt,
          tags: share.document.tags,
          extractedData,
          // Include extracted text only for COMMENT or EDIT permissions
          extractedText: share.permission !== 'VIEW' ? share.document.extractedText : undefined,
        },
        share: {
          permission: share.permission,
          sharedBy: sharedByName,
          createdAt: share.createdAt,
          expiresAt: share.expiresAt,
        },
        // Include download URL only for EDIT permission
        downloadUrl: share.permission === 'EDIT' ? `/api/shared/${token}/download` : undefined,
      });
    } catch (error) {
      logger.error('Shared document access error:', error);
      next(error);
    }
  });

  /**
   * GET /api/shared/:token/download - Download a shared document
   *
   * Only available for shares with EDIT permission.
   * This is a PUBLIC endpoint - no authentication required.
   */
  router.get('/:token/download', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.params;

      // Find share by access token
      const share = await prisma.documentShare.findUnique({
        where: { accessToken: token },
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
              fileType: true,
              storageUrl: true,
            },
          },
        },
      });

      // Check if share exists
      if (!share) {
        return res.status(404).json({
          error: 'Share not found',
          code: 'SHARE_NOT_FOUND',
        });
      }

      // Check if share has expired
      if (share.expiresAt && share.expiresAt < new Date()) {
        return res.status(410).json({
          error: 'This share link has expired',
          code: 'SHARE_EXPIRED',
        });
      }

      // Check permission - only EDIT can download
      if (share.permission !== 'EDIT') {
        return res.status(403).json({
          error: 'Download requires EDIT permission',
          code: 'INSUFFICIENT_PERMISSION',
        });
      }

      // Check if document still exists
      if (!share.document) {
        return res.status(404).json({
          error: 'The shared document no longer exists',
          code: 'DOCUMENT_DELETED',
        });
      }

      // Try to fetch from storage (R2 or local)
      let fileBuffer: Buffer;
      try {
        fileBuffer = await fetchFromStorage(share.document.storageUrl);
      } catch (storageError) {
        // Fallback to local file read with decryption
        try {
          const filePath = path.join(process.cwd(), share.document.storageUrl);
          const encryptedBuffer = await fs.readFile(filePath);
          fileBuffer = decryptFile(encryptedBuffer);
        } catch (localError) {
          logger.error('Failed to fetch document for download', {
            shareId: share.id,
            documentId: share.documentId,
            error: localError,
          });
          return res.status(500).json({
            error: 'Failed to retrieve document file',
            code: 'FILE_NOT_FOUND',
          });
        }
      }

      // Update access tracking
      await prisma.documentShare.update({
        where: { id: share.id },
        data: {
          accessCount: { increment: 1 },
          lastAccessedAt: new Date(),
        },
      });

      logger.info('Shared document downloaded', {
        shareId: share.id,
        documentId: share.documentId,
      });

      // Set headers for download
      res.setHeader('Content-Type', share.document.fileType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${share.document.fileName}"`);
      res.setHeader('Content-Length', fileBuffer.length);

      res.send(fileBuffer);
    } catch (error) {
      logger.error('Shared document download error:', error);
      next(error);
    }
  });

  return router;
}
