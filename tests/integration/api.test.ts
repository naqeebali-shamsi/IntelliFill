import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('API Integration Tests', () => {
  let authToken: string;
  const testPdfPath = path.join(__dirname, '../fixtures/test-form.pdf');
  const testDocPath = path.join(__dirname, '../fixtures/test-document.pdf');

  beforeAll(async () => {
    // Create test files if they don't exist
    await fs.mkdir(path.dirname(testPdfPath), { recursive: true });
    await fs.writeFile(testPdfPath, Buffer.from('mock pdf content'));
    await fs.writeFile(testDocPath, Buffer.from('mock document content'));

    // Get auth token
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'test123' });
    
    authToken = response.body.token;
  });

  afterAll(async () => {
    // Cleanup test files
    await fs.unlink(testPdfPath).catch(() => {});
    await fs.unlink(testDocPath).catch(() => {});
  });

  describe('Health Check', () => {
    it('should return 200 OK', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Authentication', () => {
    it('should reject requests without auth token', async () => {
      await request(app)
        .get('/api/jobs')
        .expect(401);
    });

    it('should accept requests with valid auth token', async () => {
      await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('should accept requests with valid API key', async () => {
      await request(app)
        .get('/api/jobs')
        .set('X-API-Key', process.env.MASTER_API_KEY || 'test-api-key')
        .expect(200);
    });
  });

  describe('Document Processing', () => {
    it('should process single document and form', async () => {
      const response = await request(app)
        .post('/api/process/single')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('document', testDocPath)
        .attach('form', testPdfPath)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('outputPath');
      expect(response.body.data).toHaveProperty('filledFields');
      expect(response.body.data).toHaveProperty('confidence');
    });

    it('should process multiple documents', async () => {
      const response = await request(app)
        .post('/api/process/multiple')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('documents', testDocPath)
        .attach('documents', testDocPath)
        .attach('form', testPdfPath)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('documentsProcessed', 2);
    });

    it('should validate required files', async () => {
      await request(app)
        .post('/api/process/single')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('Form Validation', () => {
    it('should validate PDF form fields', async () => {
      const response = await request(app)
        .post('/api/validate/form')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('form', testPdfPath)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('fields');
      expect(response.body.data).toHaveProperty('fieldTypes');
    });
  });

  describe('Data Extraction', () => {
    it('should extract data from document', async () => {
      const response = await request(app)
        .post('/api/extract')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('document', testDocPath)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('documentType');
      expect(response.body.data).toHaveProperty('extractedFields');
      expect(response.body.data).toHaveProperty('extractedEntities');
      expect(response.body.data).toHaveProperty('confidence');
    });
  });

  describe('Job Management', () => {
    let jobId: string;

    it('should create a processing job', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'single',
          documents: ['doc1.pdf'],
          form: 'form.pdf',
          output: 'output.pdf'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      jobId = response.body.id;
    });

    it('should get job status', async () => {
      const response = await request(app)
        .get(`/api/jobs/${jobId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('progress');
    });

    it('should list user jobs', async () => {
      const response = await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Templates', () => {
    let templateId: string;

    it('should create a template', async () => {
      const response = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Template',
          description: 'A test template',
          formPath: 'form.pdf',
          fieldMappings: { name: 'full_name' },
          isPublic: false
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      templateId = response.body.id;
    });

    it('should list templates', async () => {
      const response = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should delete a template', async () => {
      await request(app)
        .delete(`/api/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });
  });

  describe('Statistics', () => {
    it('should return user statistics', async () => {
      const response = await request(app)
        .get('/api/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalJobs');
      expect(response.body).toHaveProperty('completedJobs');
      expect(response.body).toHaveProperty('failedJobs');
      expect(response.body).toHaveProperty('averageProcessingTime');
      expect(response.body).toHaveProperty('averageConfidence');
    });
  });

  describe('Queue Metrics', () => {
    it('should return queue metrics', async () => {
      const response = await request(app)
        .get('/api/queue/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('waiting');
      expect(response.body).toHaveProperty('active');
      expect(response.body).toHaveProperty('completed');
      expect(response.body).toHaveProperty('failed');
      expect(response.body).toHaveProperty('delayed');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Make multiple requests quickly
      const requests = Array(101).fill(null).map(() =>
        request(app)
          .get('/api/health')
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);
      
      expect(rateLimited).toBe(true);
    });
  });

  describe('Metrics Endpoint', () => {
    it('should expose Prometheus metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
      expect(response.text).toContain('http_requests_total');
      expect(response.text).toContain('processing_jobs_total');
    });
  });
});