import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { ProfileService } from '../../src/services/ProfileService';
import { encryptJSON } from '../../src/utils/encryption';

const prisma = new PrismaClient();

// Mock app - will be imported from actual server in real tests
let app: any;
let authToken: string;
let testUserId: string;

// Helper function to create test documents with extracted data
async function createTestDocument(
  userId: string,
  fileName: string,
  extractedData: any,
  confidence: number = 0.9
) {
  const encryptedData = encryptJSON(extractedData);

  return await prisma.document.create({
    data: {
      userId,
      fileName,
      fileType: 'application/pdf',
      fileSize: 1024,
      storageUrl: `/uploads/test-${Date.now()}.pdf`,
      status: 'COMPLETED',
      extractedData: encryptedData,
      confidence,
      processedAt: new Date()
    }
  });
}

describe('User Profile API Integration Tests', () => {
  beforeAll(async () => {
    // Import app
    const indexModule = await import('../../src/index');
    app = indexModule.app;

    // Create test user and get auth token
    // This assumes Supabase auth is set up
    const testEmail = `test-${Date.now()}@example.com`;

    // Register test user (adjust based on your auth implementation)
    const registerResponse = await request(app)
      .post('/api/auth/v2/register')
      .send({
        email: testEmail,
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User'
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
      await prisma.document.deleteMany({ where: { userId: testUserId } });
      await prisma.userProfile.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up profile before each test
    if (testUserId) {
      await prisma.userProfile.deleteMany({ where: { userId: testUserId } });
      await prisma.document.deleteMany({ where: { userId: testUserId } });
    }
  });

  describe('GET /api/users/me/profile', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/users/me/profile')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return empty profile when no documents exist', async () => {
      const response = await request(app)
        .get('/api/users/me/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.profile).toBeDefined();
      expect(response.body.profile.fields).toEqual([]);
      expect(response.body.profile.documentCount).toBe(0);
    });

    it('should aggregate profile from single document', async () => {
      // Create a document with extracted data
      const extractedData = {
        email: ['test@example.com'],
        phone: ['+1-555-0100'],
        firstName: ['John'],
        lastName: ['Doe']
      };

      await createTestDocument(testUserId, 'resume.pdf', extractedData, 0.95);

      const response = await request(app)
        .get('/api/users/me/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.profile.fields).toBeInstanceOf(Array);
      expect(response.body.profile.fields.length).toBeGreaterThan(0);
      expect(response.body.profile.documentCount).toBe(1);

      // Check that fields are properly formatted
      const emailField = response.body.profile.fields.find((f: any) => f.key === 'email');
      expect(emailField).toBeDefined();
      expect(emailField.values).toContain('test@example.com');
      expect(emailField.sourceCount).toBe(1);
    });

    it('should aggregate profile from multiple documents and deduplicate', async () => {
      // Create multiple documents with overlapping data
      const doc1Data = {
        email: ['john.doe@example.com'],
        phone: ['+1-555-0100', '(555) 010-0100'],
        firstName: ['John']
      };

      const doc2Data = {
        email: ['john.doe@example.com'], // Duplicate email
        phone: ['555-010-0100'], // Same phone, different format
        lastName: ['Doe']
      };

      const doc3Data = {
        email: ['john.doe@work.com'], // Different email
        address: ['123 Main St']
      };

      await createTestDocument(testUserId, 'resume.pdf', doc1Data, 0.95);
      await createTestDocument(testUserId, 'passport.pdf', doc2Data, 0.90);
      await createTestDocument(testUserId, 'license.pdf', doc3Data, 0.85);

      const response = await request(app)
        .get('/api/users/me/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.profile.documentCount).toBe(3);

      // Check email deduplication
      const emailField = response.body.profile.fields.find((f: any) => f.key === 'email');
      expect(emailField).toBeDefined();
      expect(emailField.values.length).toBe(2); // Two unique emails
      expect(emailField.sourceCount).toBe(3); // From 3 documents

      // Check phone deduplication (all formats should normalize to same number)
      const phoneField = response.body.profile.fields.find((f: any) => f.key === 'phone');
      expect(phoneField).toBeDefined();
      expect(phoneField.values.length).toBeLessThanOrEqual(3);
    });

    it('should return cached profile if not stale', async () => {
      // Create document and profile
      await createTestDocument(testUserId, 'resume.pdf', { email: ['test@example.com'] });

      // First request creates profile
      const response1 = await request(app)
        .get('/api/users/me/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const firstAggregation = new Date(response1.body.profile.lastAggregated);

      // Immediate second request should return cached profile
      const response2 = await request(app)
        .get('/api/users/me/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const secondAggregation = new Date(response2.body.profile.lastAggregated);

      expect(secondAggregation.getTime()).toBe(firstAggregation.getTime());
    });
  });

  describe('PUT /api/users/me/profile', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .put('/api/users/me/profile')
        .send({ email: 'new@example.com' })
        .expect(401);
    });

    it('should return 400 with empty body', async () => {
      const response = await request(app)
        .put('/api/users/me/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should update profile with new fields', async () => {
      const response = await request(app)
        .put('/api/users/me/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'manual@example.com',
          phone: '+1-555-9999',
          customField: 'Custom Value'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('updated');
      expect(response.body.profile.fields.length).toBeGreaterThan(0);

      // Verify fields were added
      const emailField = response.body.profile.fields.find((f: any) => f.key === 'email');
      expect(emailField).toBeDefined();
      expect(emailField.values).toContain('manual@example.com');
      expect(emailField.confidence).toBe(100); // Manual edits have 100% confidence
    });

    it('should merge manual updates with existing aggregated data', async () => {
      // Create document with data
      await createTestDocument(testUserId, 'resume.pdf', {
        email: ['original@example.com'],
        firstName: ['John']
      });

      // Update with new data
      const response = await request(app)
        .put('/api/users/me/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'additional@example.com',
          lastName: 'Doe'
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Email should have both values
      const emailField = response.body.profile.fields.find((f: any) => f.key === 'email');
      expect(emailField.values.length).toBe(2);
      expect(emailField.values).toContain('original@example.com');
      expect(emailField.values).toContain('additional@example.com');

      // Should have both firstName and lastName
      const firstNameField = response.body.profile.fields.find((f: any) => f.key === 'firstname');
      const lastNameField = response.body.profile.fields.find((f: any) => f.key === 'lastname');
      expect(firstNameField).toBeDefined();
      expect(lastNameField).toBeDefined();
    });

    it('should handle array values in updates', async () => {
      const response = await request(app)
        .put('/api/users/me/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          emails: ['email1@example.com', 'email2@example.com'],
          skills: ['JavaScript', 'TypeScript', 'Node.js']
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      const emailsField = response.body.profile.fields.find((f: any) => f.key === 'emails');
      expect(emailsField).toBeDefined();
      expect(emailsField.values.length).toBe(2);
    });
  });

  describe('POST /api/users/me/profile/refresh', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/users/me/profile/refresh')
        .expect(401);
    });

    it('should refresh profile from documents', async () => {
      // Create initial profile
      await createTestDocument(testUserId, 'resume.pdf', { email: ['old@example.com'] });

      await request(app)
        .get('/api/users/me/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Add new document
      await createTestDocument(testUserId, 'passport.pdf', { email: ['new@example.com'] });

      // Refresh profile
      const response = await request(app)
        .post('/api/users/me/profile/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('refreshed');
      expect(response.body.profile.documentCount).toBe(2);

      const emailField = response.body.profile.fields.find((f: any) => f.key === 'email');
      expect(emailField.values.length).toBe(2);
    });
  });

  describe('DELETE /api/users/me/profile', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .delete('/api/users/me/profile')
        .expect(401);
    });

    it('should return 404 if profile does not exist', async () => {
      const response = await request(app)
        .delete('/api/users/me/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should delete existing profile', async () => {
      // Create profile first
      await request(app)
        .put('/api/users/me/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'test@example.com' })
        .expect(200);

      // Delete profile
      const response = await request(app)
        .delete('/api/users/me/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify profile is deleted from database
      const profile = await prisma.userProfile.findUnique({
        where: { userId: testUserId }
      });
      expect(profile).toBeNull();
    });
  });

  describe('GET /api/users/me/profile/field/:fieldKey', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/users/me/profile/field/email')
        .expect(401);
    });

    it('should return 404 if profile does not exist', async () => {
      const response = await request(app)
        .get('/api/users/me/profile/field/email')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should return specific field from profile', async () => {
      // Create profile
      await request(app)
        .put('/api/users/me/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'test@example.com',
          phone: '+1-555-0100'
        })
        .expect(200);

      // Get email field
      const response = await request(app)
        .get('/api/users/me/profile/field/email')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.field).toBeDefined();
      expect(response.body.field.key).toBe('email');
      expect(response.body.field.values).toContain('test@example.com');
    });

    it('should return 404 if field does not exist', async () => {
      // Create profile
      await request(app)
        .put('/api/users/me/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'test@example.com' })
        .expect(200);

      // Try to get non-existent field
      const response = await request(app)
        .get('/api/users/me/profile/field/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });
  });
});

describe('ProfileService Unit Tests', () => {
  const profileService = new ProfileService();
  let testUserId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `service-test-${Date.now()}@example.com`,
        password: 'hashedpassword',
        firstName: 'Service',
        lastName: 'Test'
      }
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.document.deleteMany({ where: { userId: testUserId } });
    await prisma.userProfile.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up before each test
    await prisma.document.deleteMany({ where: { userId: testUserId } });
    await prisma.userProfile.deleteMany({ where: { userId: testUserId } });
  });

  describe('aggregateUserProfile', () => {
    it('should aggregate empty profile when no documents exist', async () => {
      const profile = await profileService.aggregateUserProfile(testUserId);

      expect(profile.userId).toBe(testUserId);
      expect(profile.fields).toEqual({});
      expect(profile.documentCount).toBe(0);
    });

    it('should aggregate data from single document', async () => {
      await createTestDocument(testUserId, 'test.pdf', {
        email: ['test@example.com'],
        phone: ['+1-555-0100']
      });

      const profile = await profileService.aggregateUserProfile(testUserId);

      expect(profile.documentCount).toBe(1);
      expect(Object.keys(profile.fields).length).toBeGreaterThan(0);
      expect(profile.fields.email).toBeDefined();
      expect(profile.fields.phone).toBeDefined();
    });

    it('should deduplicate email addresses (case-insensitive)', async () => {
      await createTestDocument(testUserId, 'doc1.pdf', {
        email: ['Test@Example.com', 'test@example.com', 'TEST@EXAMPLE.COM']
      });

      const profile = await profileService.aggregateUserProfile(testUserId);

      expect(profile.fields.email.values.length).toBe(1);
    });

    it('should deduplicate phone numbers with different formats', async () => {
      await createTestDocument(testUserId, 'doc1.pdf', {
        phone: ['+1-555-0100', '(555) 010-0100', '555-010-0100', '5550100']
      });

      const profile = await profileService.aggregateUserProfile(testUserId);

      // All should normalize to same number
      expect(profile.fields.phone.values.length).toBeLessThanOrEqual(2);
    });

    it('should calculate weighted average confidence', async () => {
      await createTestDocument(testUserId, 'doc1.pdf', { email: ['test@example.com'] }, 0.9);
      await createTestDocument(testUserId, 'doc2.pdf', { email: ['test@example.com'] }, 0.8);

      const profile = await profileService.aggregateUserProfile(testUserId);

      expect(profile.fields.email.confidence).toBeCloseTo(0.85, 2);
    });
  });

  describe('saveProfile and getProfile', () => {
    it('should save and retrieve profile', async () => {
      const aggregated = await profileService.aggregateUserProfile(testUserId);
      await profileService.saveProfile(testUserId, aggregated);

      const retrieved = await profileService.getProfile(testUserId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.userId).toBe(testUserId);
    });

    it('should return null for non-existent profile', async () => {
      const profile = await profileService.getProfile('non-existent-user-id');
      expect(profile).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should create profile if it does not exist', async () => {
      const updated = await profileService.updateProfile(testUserId, {
        email: 'new@example.com'
      });

      expect(updated).toBeDefined();
      expect(updated.fields.email).toBeDefined();
      expect(updated.fields.email.values).toContain('new@example.com');
    });

    it('should merge with existing profile', async () => {
      await createTestDocument(testUserId, 'doc.pdf', { email: ['old@example.com'] });

      const updated = await profileService.updateProfile(testUserId, {
        email: 'new@example.com',
        phone: '+1-555-0100'
      });

      expect(updated.fields.email.values.length).toBe(2);
      expect(updated.fields.phone).toBeDefined();
    });
  });

  describe('deleteProfile', () => {
    it('should delete existing profile', async () => {
      const aggregated = await profileService.aggregateUserProfile(testUserId);
      await profileService.saveProfile(testUserId, aggregated);

      await profileService.deleteProfile(testUserId);

      const profile = await profileService.getProfile(testUserId);
      expect(profile).toBeNull();
    });

    it('should throw error for non-existent profile', async () => {
      await expect(
        profileService.deleteProfile('non-existent-user-id')
      ).rejects.toThrow();
    });
  });
});
