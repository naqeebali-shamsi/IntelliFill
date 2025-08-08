import request from 'supertest';
import { Express } from 'express';
import { initializeApp } from '../../src/index';
import { DatabaseService } from '../../src/database/DatabaseService';

describe('Auth Integration Tests', () => {
  let app: Express;
  let db: DatabaseService;
  
  beforeAll(async () => {
    // Initialize test app
    const appData = await initializeApp();
    app = appData.app;
    db = appData.db;

    // Clean up test data
    await db.query('DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%test%']);
    await db.query('DELETE FROM users WHERE email LIKE $1', ['%test%']);
  });

  afterAll(async () => {
    // Clean up test data
    await db.query('DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%test%']);
    await db.query('DELETE FROM users WHERE email LIKE $1', ['%test%']);
    await db.disconnect();
  });

  describe('POST /api/auth/register', () => {
    const validUserData = {
      email: 'integration.test@example.com',
      password: 'TestPass123!',
      fullName: 'Integration Test User',
      role: 'user'
    };

    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(validUserData.email);
      expect(response.body.data.user.full_name).toBe(validUserData.fullName);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
      expect(response.body.data.user.password_hash).toBeUndefined();
    });

    it('should reject duplicate email registration', async () => {
      await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(409);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body.error).toContain('required');
    });

    it('should validate password strength', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'weak.password.test@example.com',
          password: '123',
          fullName: 'Test User'
        })
        .expect(400);

      expect(response.body.error).toContain('Password must');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'ValidPass123!',
          fullName: 'Test User'
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid email format');
    });
  });

  describe('POST /api/auth/login', () => {
    const testUser = {
      email: 'login.test@example.com',
      password: 'LoginTest123!',
      fullName: 'Login Test User'
    };

    beforeAll(async () => {
      // Create test user
      await request(app)
        .post('/api/auth/register')
        .send(testUser);
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body.error).toContain('Invalid');
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!'
        })
        .expect(401);

      expect(response.body.error).toContain('Invalid');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email })
        .expect(400);

      expect(response.body.error).toContain('required');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;
    let accessToken: string;

    beforeAll(async () => {
      const testUser = {
        email: 'refresh.test@example.com',
        password: 'RefreshTest123!',
        fullName: 'Refresh Test User'
      };

      // Register and login to get tokens
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      refreshToken = loginResponse.body.data.tokens.refreshToken;
      accessToken = loginResponse.body.data.tokens.accessToken;
    });

    it('should refresh tokens successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
      expect(response.body.data.tokens.accessToken).not.toBe(accessToken);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.error).toContain('Invalid');
    });

    it('should require refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('required');
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken: string;
    let userId: string;

    beforeAll(async () => {
      const testUser = {
        email: 'profile.test@example.com',
        password: 'ProfileTest123!',
        fullName: 'Profile Test User'
      };

      // Register and login
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      accessToken = registerResponse.body.data.tokens.accessToken;
      userId = registerResponse.body.data.user.id;
    });

    it('should get user profile successfully', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(userId);
      expect(response.body.data.user.email).toBe('profile.test@example.com');
      expect(response.body.data.user.password_hash).toBeUndefined();
    });

    it('should reject requests without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.error).toContain('Authentication required');
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toContain('Invalid');
    });
  });

  describe('POST /api/auth/change-password', () => {
    let accessToken: string;
    const testUser = {
      email: 'password.test@example.com',
      password: 'OldPassword123!',
      fullName: 'Password Test User'
    };

    beforeAll(async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      accessToken = registerResponse.body.data.tokens.accessToken;
    });

    it('should change password successfully', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: 'NewPassword456!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password changed successfully');
    });

    it('should reject incorrect current password', async () => {
      // Login again to get new token (old tokens are revoked after password change)
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'NewPassword456!' // Use new password
        });

      const newAccessToken = loginResponse.body.data.tokens.accessToken;

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'AnotherPassword789!'
        })
        .expect(400);

      expect(response.body.error).toContain('Current password is incorrect');
    });

    it('should validate new password strength', async () => {
      // Login again to get fresh token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'NewPassword456!'
        });

      const newAccessToken = loginResponse.body.data.tokens.accessToken;

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .send({
          currentPassword: 'NewPassword456!',
          newPassword: 'weak'
        })
        .expect(400);

      expect(response.body.error).toContain('Password must');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword456!'
        })
        .expect(401);

      expect(response.body.error).toContain('Authentication required');
    });
  });

  describe('POST /api/auth/logout', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const testUser = {
        email: `logout.test.${Date.now()}@example.com`,
        password: 'LogoutTest123!',
        fullName: 'Logout Test User'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      accessToken = registerResponse.body.data.tokens.accessToken;
      refreshToken = registerResponse.body.data.tokens.refreshToken;
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Logout successful');

      // Verify refresh token is revoked
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(refreshResponse.body.error).toContain('Invalid');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(401);

      expect(response.body.error).toContain('Authentication required');
    });
  });

  describe('POST /api/auth/verify-token', () => {
    let accessToken: string;

    beforeAll(async () => {
      const testUser = {
        email: 'verify.test@example.com',
        password: 'VerifyTest123!',
        fullName: 'Verify Test User'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      accessToken = registerResponse.body.data.tokens.accessToken;
    });

    it('should verify valid token successfully', async () => {
      const response = await request(app)
        .post('/api/auth/verify-token')
        .send({ token: accessToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payload.email).toBe('verify.test@example.com');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-token')
        .send({ token: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid');
    });

    it('should require token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-token')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('required');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on login endpoint', async () => {
      const testData = {
        email: 'rate.limit.test@example.com',
        password: 'InvalidPassword123!'
      };

      // Make 6 requests (limit is 5)
      const promises = Array(6).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send(testData)
      );

      const responses = await Promise.all(promises);
      
      // At least one should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should enforce rate limits on register endpoint', async () => {
      const promises = Array(4).fill(null).map((_, i) =>
        request(app)
          .post('/api/auth/register')
          .send({
            email: `rate.limit.register.${i}.${Date.now()}@example.com`,
            password: 'ValidPassword123!',
            fullName: 'Rate Limit Test User'
          })
      );

      const responses = await Promise.all(promises);
      
      // At least one should be rate limited (limit is 3 per hour)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});