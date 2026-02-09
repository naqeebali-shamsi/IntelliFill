/**
 * Document Sharing Routes Tests
 * Tests for POST /documents/:id/share, GET /documents/:id/shares, DELETE /documents/:id/shares/:shareId
 * and public GET /shared/:token endpoint
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { prisma } from '../../utils/prisma';
import { createDocumentRoutes } from '../documents.routes';
import { createSharedRoutes } from '../shared.routes';
import { SharePermission } from '@prisma/client';

// Mock auth middleware to inject test user
jest.mock('../../middleware/supabaseAuth', () => ({
  authenticateSupabase: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => {
    (req as any).user = { id: testUserId };
    next();
  },
  optionalAuthSupabase: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => {
    next();
  },
}));

// Mock encryption middleware
jest.mock('../../middleware/encryptionMiddleware', () => ({
  decryptFile: (buf: Buffer) => buf,
  decryptExtractedData: (data: string) => {
    try {
      return JSON.parse(data);
    } catch {
      return { name: 'Test' };
    }
  },
  encryptExtractedData: (data: unknown) => JSON.stringify(data),
}));

// Mock storage helper
jest.mock('../../services/storageHelper', () => ({
  fetchFromStorage: jest.fn().mockResolvedValue(Buffer.from('test file content')),
  uploadFile: jest.fn().mockResolvedValue({ url: 'test-url', storageType: 'local' }),
}));

// Mock extracted data types
jest.mock('../../types/extractedData', () => ({
  normalizeExtractedData: (data: unknown) => data,
  flattenExtractedData: (data: unknown) => data,
}));

// Test constants
const testUserId = 'test-user-id-for-sharing';
const testOtherUserId = 'other-user-id-for-sharing';
const testEmail = 'recipient@test.com';

// Express app setup
let app: express.Application;

// Override documentShare.findUnique to resolve include relations (document, sharedBy)
const originalFindUnique = prisma.documentShare.findUnique as jest.Mock;
(prisma.documentShare.findUnique as jest.Mock) = jest.fn(async (args: any) => {
  const share = await originalFindUnique(args);
  if (!share || !args?.include) return share;

  const result = { ...share };

  // Resolve document relation
  if (args.include.document) {
    const doc = await prisma.document.findUnique({ where: { id: share.documentId } });
    result.document = doc || null;
  }

  // Resolve sharedBy (User) relation
  if (args.include.sharedBy) {
    const user = await prisma.user.findUnique({ where: { id: share.sharedByUserId } });
    result.sharedBy = user || null;
  }

  return result;
});

beforeAll(async () => {
  app = express();
  app.use(express.json());

  const documentRoutes = createDocumentRoutes();
  app.use('/api/documents', documentRoutes);

  const sharedRoutes = createSharedRoutes();
  app.use('/api/shared', sharedRoutes);
});

afterAll(async () => {
  // Clean up test data
  await prisma.documentShare.deleteMany({
    where: { sharedByUserId: testUserId },
  });
  await prisma.document.deleteMany({
    where: { userId: testUserId },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [testUserId, testOtherUserId] } },
  });
  await prisma.$disconnect();
});

describe('Document Sharing Routes', () => {
  let testDocumentId: string;
  let testShareId: string;
  let testAccessToken: string;

  beforeEach(async () => {
    // Clean up previous test data
    await prisma.documentShare.deleteMany({
      where: { sharedByUserId: testUserId },
    });
    await prisma.document.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testUserId, testOtherUserId] } },
    });

    // Create test user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: 'owner@test.com',
        password: 'hashed-password',
        firstName: 'Test',
        lastName: 'Owner',
      },
    });

    // Create test document
    const doc = await prisma.document.create({
      data: {
        userId: testUserId,
        fileName: 'test-document.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        storageUrl: 'uploads/test.pdf',
        status: 'COMPLETED',
        extractedData: JSON.stringify({ name: 'Test' }),
      },
    });
    testDocumentId = doc.id;
  });

  describe('POST /api/documents/:id/share', () => {
    it('should create a share with valid email', async () => {
      const response = await request(app)
        .post(`/api/documents/${testDocumentId}/share`)
        .send({ email: testEmail, permission: 'VIEW' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.share).toBeDefined();
      expect(response.body.share.email).toBe(testEmail);
      expect(response.body.share.permission).toBe('VIEW');
      expect(response.body.share.shareUrl).toMatch(/^\/shared\//);

      testShareId = response.body.share.id;
      testAccessToken = response.body.share.shareUrl.split('/shared/')[1];
    });

    it('should create share with EDIT permission', async () => {
      const response = await request(app)
        .post(`/api/documents/${testDocumentId}/share`)
        .send({ email: testEmail, permission: 'EDIT' });

      expect(response.status).toBe(201);
      expect(response.body.share.permission).toBe('EDIT');
    });

    it('should create share with expiration', async () => {
      const response = await request(app)
        .post(`/api/documents/${testDocumentId}/share`)
        .send({ email: testEmail, expiresIn: 24 });

      expect(response.status).toBe(201);
      expect(response.body.share.expiresAt).toBeDefined();

      const expiresAt = new Date(response.body.share.expiresAt);
      const now = new Date();
      const diffHours = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeCloseTo(24, 0);
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post(`/api/documents/${testDocumentId}/share`)
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid email');
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post(`/api/documents/${testDocumentId}/share`)
        .send({ permission: 'VIEW' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Email is required');
    });

    it('should reject invalid permission', async () => {
      const response = await request(app)
        .post(`/api/documents/${testDocumentId}/share`)
        .send({ email: testEmail, permission: 'INVALID' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid permission');
    });

    it('should reject non-existent document', async () => {
      const response = await request(app)
        .post('/api/documents/non-existent-id/share')
        .send({ email: testEmail });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Document not found');
    });

    it('should reject duplicate share to same email', async () => {
      // First share
      await request(app).post(`/api/documents/${testDocumentId}/share`).send({ email: testEmail });

      // Duplicate share
      const response = await request(app)
        .post(`/api/documents/${testDocumentId}/share`)
        .send({ email: testEmail });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already shared');
    });

    it('should link share to existing user by email', async () => {
      // Create recipient user
      await prisma.user.create({
        data: {
          id: testOtherUserId,
          email: testEmail.toLowerCase(),
          password: 'hashed-password',
        },
      });

      const response = await request(app)
        .post(`/api/documents/${testDocumentId}/share`)
        .send({ email: testEmail });

      expect(response.status).toBe(201);

      // Verify sharedWithUserId was set
      const share = await prisma.documentShare.findFirst({
        where: { id: response.body.share.id },
      });
      expect(share?.sharedWithUserId).toBe(testOtherUserId);
    });
  });

  describe('GET /api/documents/:id/shares', () => {
    beforeEach(async () => {
      // Create test share
      const share = await prisma.documentShare.create({
        data: {
          documentId: testDocumentId,
          sharedByUserId: testUserId,
          sharedWithEmail: testEmail,
          permission: 'VIEW',
          accessToken: 'test-token-123',
        },
      });
      testShareId = share.id;
      testAccessToken = share.accessToken!;
    });

    it('should list all shares for a document', async () => {
      const response = await request(app).get(`/api/documents/${testDocumentId}/shares`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.shares).toBeInstanceOf(Array);
      expect(response.body.shares.length).toBeGreaterThan(0);
      expect(response.body.shares[0].email).toBe(testEmail);
    });

    it('should return empty array for document with no shares', async () => {
      // Create new doc without shares
      const doc = await prisma.document.create({
        data: {
          userId: testUserId,
          fileName: 'no-shares.pdf',
          fileType: 'application/pdf',
          fileSize: 512,
          storageUrl: 'uploads/no-shares.pdf',
          status: 'COMPLETED',
        },
      });

      const response = await request(app).get(`/api/documents/${doc.id}/shares`);

      expect(response.status).toBe(200);
      expect(response.body.shares).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    it('should reject non-existent document', async () => {
      const response = await request(app).get('/api/documents/non-existent-id/shares');

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/documents/:id/shares/:shareId', () => {
    beforeEach(async () => {
      // Create test share
      const share = await prisma.documentShare.create({
        data: {
          documentId: testDocumentId,
          sharedByUserId: testUserId,
          sharedWithEmail: testEmail,
          permission: 'VIEW',
          accessToken: 'test-token-delete',
        },
      });
      testShareId = share.id;
    });

    it('should revoke a share', async () => {
      const response = await request(app).delete(
        `/api/documents/${testDocumentId}/shares/${testShareId}`
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('revoked');

      // Verify share was deleted
      const share = await prisma.documentShare.findUnique({
        where: { id: testShareId },
      });
      expect(share).toBeNull();
    });

    it('should reject non-existent share', async () => {
      const response = await request(app).delete(
        `/api/documents/${testDocumentId}/shares/non-existent-id`
      );

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Share not found');
    });

    it('should reject non-existent document', async () => {
      const response = await request(app).delete(
        `/api/documents/non-existent-id/shares/${testShareId}`
      );

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Document not found');
    });
  });

  describe('GET /api/shared/:token (Public Access)', () => {
    beforeEach(async () => {
      // Create test share with token
      const share = await prisma.documentShare.create({
        data: {
          documentId: testDocumentId,
          sharedByUserId: testUserId,
          sharedWithEmail: testEmail,
          permission: 'VIEW',
          accessToken: 'valid-public-token',
        },
      });
      testShareId = share.id;
      testAccessToken = share.accessToken!;
    });

    it('should access shared document with valid token', async () => {
      const response = await request(app).get(`/api/shared/${testAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.document).toBeDefined();
      expect(response.body.document.fileName).toBe('test-document.pdf');
      expect(response.body.share).toBeDefined();
      expect(response.body.share.permission).toBe('VIEW');
    });

    it('should increment access count on access', async () => {
      // Get initial count
      const shareBefore = await prisma.documentShare.findUnique({
        where: { id: testShareId },
      });
      const initialCount = shareBefore?.accessCount || 0;

      // Access the share
      await request(app).get(`/api/shared/${testAccessToken}`);

      // Check count increased
      const shareAfter = await prisma.documentShare.findUnique({
        where: { id: testShareId },
      });
      expect(shareAfter?.accessCount).toBe(initialCount + 1);
      expect(shareAfter?.lastAccessedAt).toBeDefined();
    });

    it('should return 404 for invalid token', async () => {
      const response = await request(app).get('/api/shared/invalid-token');

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('SHARE_NOT_FOUND');
    });

    it('should return 410 for expired share', async () => {
      // Create expired share
      const expiredShare = await prisma.documentShare.create({
        data: {
          documentId: testDocumentId,
          sharedByUserId: testUserId,
          sharedWithEmail: 'expired@test.com',
          permission: 'VIEW',
          accessToken: 'expired-token',
          expiresAt: new Date(Date.now() - 86400000), // 24 hours ago
        },
      });

      const response = await request(app).get(`/api/shared/${expiredShare.accessToken}`);

      expect(response.status).toBe(410);
      expect(response.body.code).toBe('SHARE_EXPIRED');
    });

    it('should not include download URL for VIEW permission', async () => {
      const response = await request(app).get(`/api/shared/${testAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.downloadUrl).toBeUndefined();
    });

    it('should include download URL for EDIT permission', async () => {
      // Create share with EDIT permission
      const editShare = await prisma.documentShare.create({
        data: {
          documentId: testDocumentId,
          sharedByUserId: testUserId,
          sharedWithEmail: 'editor@test.com',
          permission: 'EDIT',
          accessToken: 'edit-token',
        },
      });

      const response = await request(app).get(`/api/shared/${editShare.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.downloadUrl).toBeDefined();
      expect(response.body.downloadUrl).toContain('/download');
    });
  });

  describe('GET /api/shared/:token/download', () => {
    it('should download file with EDIT permission', async () => {
      // Create share with EDIT permission
      const editShare = await prisma.documentShare.create({
        data: {
          documentId: testDocumentId,
          sharedByUserId: testUserId,
          sharedWithEmail: 'downloader@test.com',
          permission: 'EDIT',
          accessToken: 'download-edit-token',
        },
      });

      const response = await request(app).get(`/api/shared/${editShare.accessToken}/download`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('test-document.pdf');
    });

    it('should reject download with VIEW permission', async () => {
      // Create share with VIEW permission
      const viewShare = await prisma.documentShare.create({
        data: {
          documentId: testDocumentId,
          sharedByUserId: testUserId,
          sharedWithEmail: 'viewer@test.com',
          permission: 'VIEW',
          accessToken: 'download-view-token',
        },
      });

      const response = await request(app).get(`/api/shared/${viewShare.accessToken}/download`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('INSUFFICIENT_PERMISSION');
    });

    it('should reject download with expired token', async () => {
      // Create expired share
      const expiredShare = await prisma.documentShare.create({
        data: {
          documentId: testDocumentId,
          sharedByUserId: testUserId,
          sharedWithEmail: 'expired-dl@test.com',
          permission: 'EDIT',
          accessToken: 'expired-download-token',
          expiresAt: new Date(Date.now() - 86400000),
        },
      });

      const response = await request(app).get(`/api/shared/${expiredShare.accessToken}/download`);

      expect(response.status).toBe(410);
      expect(response.body.code).toBe('SHARE_EXPIRED');
    });

    it('should reject download with invalid token', async () => {
      const response = await request(app).get('/api/shared/invalid-token/download');

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('SHARE_NOT_FOUND');
    });
  });
});
