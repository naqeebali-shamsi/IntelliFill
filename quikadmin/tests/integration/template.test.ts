import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { TemplateService } from '../../src/services/TemplateService';
import { encryptJSON, decryptJSON } from '../../src/utils/encryption';

const prisma = new PrismaClient();

// Mock app - will be imported from actual server in real tests
let app: any;
let authToken: string;
let testUserId: string;

describe('Template System Integration Tests', () => {
  beforeAll(async () => {
    // Import app
    const indexModule = await import('../../src/index');
    app = indexModule.app;

    // Create test user and get auth token
    const testEmail = `template-test-${Date.now()}@example.com`;

    // Register test user
    const registerResponse = await request(app)
      .post('/api/auth/v2/register')
      .send({
        email: testEmail,
        password: 'TestPassword123!',
        firstName: 'Template',
        lastName: 'Tester'
      });

    if (registerResponse.status === 200 || registerResponse.status === 201) {
      authToken = registerResponse.body.token || registerResponse.body.accessToken;
      testUserId = registerResponse.body.user?.id;
    } else {
      // Try login if user already exists
      const loginResponse = await request(app)
        .post('/api/auth/v2/login')
        .send({
          email: testEmail,
          password: 'TestPassword123!'
        });

      authToken = loginResponse.body.token || loginResponse.body.accessToken;
      testUserId = loginResponse.body.user?.id;
    }
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUserId) {
      await prisma.template.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up templates before each test
    if (testUserId) {
      await prisma.template.deleteMany({ where: { userId: testUserId } });
    }
  });

  describe('POST /api/templates - Create Template', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/templates')
        .send({
          name: 'Test Template',
          formType: 'CUSTOM',
          fieldMappings: []
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should create a new template successfully', async () => {
      const templateData = {
        name: 'W-2 Tax Form',
        description: 'Standard W-2 form for tax reporting',
        formType: 'W2',
        fieldMappings: [
          { sourceField: 'employer_ein', targetField: 'ein', confidence: 1.0 },
          { sourceField: 'wages', targetField: 'box_1', confidence: 1.0 }
        ]
      };

      const response = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(templateData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.template).toHaveProperty('id');
      expect(response.body.template.name).toBe(templateData.name);
      expect(response.body.template.formType).toBe(templateData.formType);
    });

    it('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          formType: 'CUSTOM',
          fieldMappings: []
        })
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
    });

    it('should return 400 if formType is missing', async () => {
      const response = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Template',
          fieldMappings: []
        })
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
    });

    it('should return 400 if fieldMappings is not an array', async () => {
      const response = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Template',
          formType: 'CUSTOM',
          fieldMappings: 'invalid'
        })
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
    });
  });

  describe('GET /api/templates - Get User Templates', () => {
    beforeEach(async () => {
      // Create test templates
      const templateService = new TemplateService();
      await templateService.createTemplate(testUserId, {
        name: 'Template 1',
        formType: 'W2',
        fieldMappings: []
      });
      await templateService.createTemplate(testUserId, {
        name: 'Template 2',
        formType: 'I9',
        fieldMappings: []
      });
    });

    it('should return all user templates', async () => {
      const response = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.templates).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/templates')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/templates/:id - Get Template by ID', () => {
    let templateId: string;

    beforeEach(async () => {
      const templateService = new TemplateService();
      const template = await templateService.createTemplate(testUserId, {
        name: 'Test Template',
        formType: 'PASSPORT',
        fieldMappings: [
          { sourceField: 'passport_number', targetField: 'passport_no', confidence: 1.0 }
        ]
      });
      templateId = template.id;
    });

    it('should return template with decrypted field mappings', async () => {
      const response = await request(app)
        .get(`/api/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.template.id).toBe(templateId);
      expect(response.body.template.fieldMappings).toHaveLength(1);
      expect(response.body.template.fieldMappings[0].sourceField).toBe('passport_number');
    });

    it('should return 404 for non-existent template', async () => {
      const response = await request(app)
        .get('/api/templates/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('PUT /api/templates/:id - Update Template', () => {
    let templateId: string;

    beforeEach(async () => {
      const templateService = new TemplateService();
      const template = await templateService.createTemplate(testUserId, {
        name: 'Original Name',
        description: 'Original Description',
        formType: 'CUSTOM',
        fieldMappings: []
      });
      templateId = template.id;
    });

    it('should update template name', async () => {
      const response = await request(app)
        .put(`/api/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Name'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.template.name).toBe('Updated Name');
    });

    it('should update template description', async () => {
      const response = await request(app)
        .put(`/api/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Updated Description'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.template.description).toBe('Updated Description');
    });

    it('should update template form type', async () => {
      const response = await request(app)
        .put(`/api/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          formType: 'JOB_APPLICATION'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.template.formType).toBe('JOB_APPLICATION');
    });

    it('should return 404 for non-existent template', async () => {
      const response = await request(app)
        .put('/api/templates/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Name'
        })
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('DELETE /api/templates/:id - Delete Template', () => {
    let templateId: string;

    beforeEach(async () => {
      const templateService = new TemplateService();
      const template = await templateService.createTemplate(testUserId, {
        name: 'Template to Delete',
        formType: 'CUSTOM',
        fieldMappings: []
      });
      templateId = template.id;
    });

    it('should soft delete template', async () => {
      const response = await request(app)
        .delete(`/api/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify template is inactive
      const template = await prisma.template.findUnique({
        where: { id: templateId }
      });
      expect(template?.isActive).toBe(false);
    });

    it('should return 404 for non-existent template', async () => {
      const response = await request(app)
        .delete('/api/templates/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('POST /api/templates/detect - Form Type Detection', () => {
    it('should detect W2 form type', async () => {
      const fieldNames = [
        'employer_ein',
        'employee_ssn',
        'wages',
        'federal_income_tax',
        'social_security_wages',
        'medicare_tax'
      ];

      const response = await request(app)
        .post('/api/templates/detect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ fieldNames })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.detection.formType).toBe('W2');
      expect(response.body.detection.confidence).toBeGreaterThan(20);
    });

    it('should detect I9 form type', async () => {
      const fieldNames = [
        'last_name',
        'first_name',
        'citizenship_status',
        'alien_number',
        'passport_number',
        'i94_number'
      ];

      const response = await request(app)
        .post('/api/templates/detect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ fieldNames })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.detection.formType).toBe('I9');
      expect(response.body.detection.confidence).toBeGreaterThan(20);
    });

    it('should detect PASSPORT form type', async () => {
      const fieldNames = [
        'passport_number',
        'full_name',
        'date_of_birth',
        'place_of_birth',
        'emergency_contact'
      ];

      const response = await request(app)
        .post('/api/templates/detect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ fieldNames })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.detection.formType).toBe('PASSPORT');
      expect(response.body.detection.confidence).toBeGreaterThan(20);
    });

    it('should detect JOB_APPLICATION form type', async () => {
      const fieldNames = [
        'first_name',
        'last_name',
        'email',
        'phone',
        'position',
        'resume',
        'cover_letter'
      ];

      const response = await request(app)
        .post('/api/templates/detect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ fieldNames })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.detection.formType).toBe('JOB_APPLICATION');
      expect(response.body.detection.confidence).toBeGreaterThan(20);
    });

    it('should default to CUSTOM for unknown forms', async () => {
      const fieldNames = [
        'random_field_1',
        'random_field_2',
        'unknown_field'
      ];

      const response = await request(app)
        .post('/api/templates/detect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ fieldNames })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.detection.formType).toBe('CUSTOM');
    });

    it('should return 400 if fieldNames is missing', async () => {
      const response = await request(app)
        .post('/api/templates/detect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
    });

    it('should return 400 if fieldNames is not an array', async () => {
      const response = await request(app)
        .post('/api/templates/detect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ fieldNames: 'invalid' })
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
    });

    it('should return 400 if fieldNames is empty', async () => {
      const response = await request(app)
        .post('/api/templates/detect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ fieldNames: [] })
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
    });
  });

  describe('POST /api/templates/match - Template Matching', () => {
    beforeEach(async () => {
      // Create test templates
      const templateService = new TemplateService();
      await templateService.createTemplate(testUserId, {
        name: 'W-2 Template',
        formType: 'W2',
        fieldMappings: [
          { sourceField: 'employer_ein', targetField: 'ein' },
          { sourceField: 'wages', targetField: 'box_1' },
          { sourceField: 'federal_tax', targetField: 'box_2' }
        ]
      });
    });

    it('should find matching templates', async () => {
      const fieldNames = [
        'employer_ein',
        'wages',
        'federal_tax',
        'employee_ssn'
      ];

      const response = await request(app)
        .post('/api/templates/match')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ fieldNames })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.matches.length).toBeGreaterThan(0);
      expect(response.body.matches[0]).toHaveProperty('template');
      expect(response.body.matches[0]).toHaveProperty('similarity');
      expect(response.body.matches[0]).toHaveProperty('matchedFields');
    });

    it('should return empty array if no matches', async () => {
      const fieldNames = [
        'completely_random_field',
        'no_match_here',
        'unknown_field'
      ];

      const response = await request(app)
        .post('/api/templates/match')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ fieldNames })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.matches).toHaveLength(0);
    });

    it('should return 400 if fieldNames is missing', async () => {
      const response = await request(app)
        .post('/api/templates/match')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
    });
  });

  describe('GET /api/templates/public - Public Templates (Marketplace)', () => {
    it('should return public templates', async () => {
      const response = await request(app)
        .get('/api/templates/public')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.templates)).toBe(true);
      // Should include pre-loaded templates from seed data
    });

    it('should not require authentication', async () => {
      const response = await request(app)
        .get('/api/templates/public')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/templates/:id/use - Increment Usage Count', () => {
    let templateId: string;

    beforeEach(async () => {
      const templateService = new TemplateService();
      const template = await templateService.createTemplate(testUserId, {
        name: 'Usage Test Template',
        formType: 'CUSTOM',
        fieldMappings: []
      });
      templateId = template.id;
    });

    it('should increment usage count', async () => {
      const response = await request(app)
        .post(`/api/templates/${templateId}/use`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify usage count was incremented
      const template = await prisma.template.findUnique({
        where: { id: templateId }
      });
      expect(template?.usageCount).toBe(1);
    });

    it('should increment multiple times', async () => {
      await request(app)
        .post(`/api/templates/${templateId}/use`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(app)
        .post(`/api/templates/${templateId}/use`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const template = await prisma.template.findUnique({
        where: { id: templateId }
      });
      expect(template?.usageCount).toBe(2);
    });
  });

  describe('Template Field Mappings Encryption', () => {
    it('should store field mappings encrypted in database', async () => {
      const templateService = new TemplateService();
      const fieldMappings = [
        { sourceField: 'ssn', targetField: 'social_security_number', confidence: 1.0 },
        { sourceField: 'name', targetField: 'full_name', confidence: 1.0 }
      ];

      const template = await templateService.createTemplate(testUserId, {
        name: 'Encryption Test',
        formType: 'CUSTOM',
        fieldMappings
      });

      // Verify data is encrypted in database
      const dbTemplate = await prisma.template.findUnique({
        where: { id: template.id }
      });

      expect(dbTemplate?.fieldMappings).toBeDefined();
      // Encrypted data should be a string in the format "iv:authTag:encrypted"
      expect(typeof dbTemplate?.fieldMappings).toBe('string');
      expect(dbTemplate?.fieldMappings).toContain(':');

      // Verify decryption works
      const decryptedMappings = await templateService.getTemplateFieldMappings(template.id, testUserId);
      expect(decryptedMappings).toEqual(fieldMappings);
    });
  });
});
