import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Document Reprocessing Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let testDocumentId: string;

  beforeAll(async () => {
    // Setup test user
    const authResponse = await request('http://localhost:3000')
      .post('/api/auth/register')
      .send({
        email: 'reprocess-test@example.com',
        password: 'TestPassword123!',
        firstName: 'Reprocess',
        lastName: 'Test'
      });

    userId = authResponse.body.user.id;
    authToken = authResponse.body.token;
    testDocumentId = await createTestDocument(userId, 0.45);
  });

  afterAll(async () => {
    await prisma.document.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test('should reprocess a document successfully', async () => {
    const response = await request('http://localhost:3000')
      .post('/api/documents/' + testDocumentId + '/reprocess')
      .set('Authorization', 'Bearer ' + authToken)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.jobId).toBeDefined();
  });

  test('should batch reprocess documents', async () => {
    const docIds = await Promise.all([
      createTestDocument(userId, 0.40),
      createTestDocument(userId, 0.55)
    ]);

    const response = await request('http://localhost:3000')
      .post('/api/documents/reprocess/batch')
      .set('Authorization', 'Bearer ' + authToken)
      .send({ documentIds: docIds })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.totalQueued).toBe(2);
  });

  test('should get low confidence documents', async () => {
    const response = await request('http://localhost:3000')
      .get('/api/documents/low-confidence')
      .query({ threshold: 0.7 })
      .set('Authorization', 'Bearer ' + authToken)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.documents)).toBe(true);
  });
});

async function createTestDocument(
  userId: string,
  confidence: number,
  reprocessCount: number = 0
): Promise<string> {
  const timestamp = Date.now();
  const document = await prisma.document.create({
    data: {
      userId,
      fileName: 'test-doc-' + timestamp + '.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      storageUrl: '/tmp/test.pdf',
      status: 'COMPLETED',
      confidence,
      reprocessCount,
      extractedText: 'Sample text',
      extractedData: { test: 'data' }
    }
  });

  return document.id;
}
