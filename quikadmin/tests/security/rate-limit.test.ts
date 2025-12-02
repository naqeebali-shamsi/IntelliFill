import request from 'supertest';
import express from 'express';
import { standardLimiter, authLimiter, uploadLimiter } from '../../src/middleware/rateLimiter';
import { createClient } from 'redis';

describe('Rate Limiting Middleware', () => {
  let app: express.Application;
  let redisClient: ReturnType<typeof createClient>;

  beforeAll(async () => {
    // Setup test app
    app = express();
    app.use(express.json());

    // Test endpoints
    app.get('/api/test', standardLimiter, (req, res) => {
      res.json({ message: 'success' });
    });

    app.post('/api/auth/login', authLimiter, (req, res) => {
      res.json({ token: 'fake-token' });
    });

    app.post('/api/documents/upload', uploadLimiter, (req, res) => {
      res.json({ documentId: '123' });
    });

    // Connect to test Redis
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6380'
    });
    await redisClient.connect();
  });

  afterAll(async () => {
    // Cleanup
    await redisClient.flushAll();
    await redisClient.quit();
  });

  afterEach(async () => {
    // Clear rate limit data between tests
    await redisClient.flushAll();
  });

  describe('Standard API Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      // Make 10 requests (well within 100 limit)
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .get('/api/test')
          .expect(200);
        
        expect(response.body.message).toBe('success');
      }
    });

    it('should block requests exceeding limit', async () => {
      // Make 101 requests to exceed 100 limit
      for (let i = 0; i < 100; i++) {
        await request(app).get('/api/test');
      }

      // 101st request should be blocked
      const response = await request(app)
        .get('/api/test')
        .expect(429);

      expect(response.text).toContain('Too many requests');
    });
  });

  describe('Auth Rate Limiting', () => {
    it('should allow 5 login attempts', async () => {
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@test.com', password: 'wrong' })
          .expect(200);
        
        expect(response.body.token).toBeDefined();
      }
    });

    it('should block 6th login attempt', async () => {
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@test.com', password: 'wrong' });
      }

      // 6th request should be blocked
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'wrong' })
        .expect(429);

      expect(response.text).toContain('Too many authentication attempts');
    });
  });

  describe('Upload Rate Limiting', () => {
    it('should allow 10 uploads per hour', async () => {
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/api/documents/upload')
          .expect(200);
        
        expect(response.body.documentId).toBeDefined();
      }
    });

    it('should block 11th upload', async () => {
      // Make 10 uploads
      for (let i = 0; i < 10; i++) {
        await request(app).post('/api/documents/upload');
      }

      // 11th upload should be blocked
      const response = await request(app)
        .post('/api/documents/upload')
        .expect(429);

      expect(response.text).toContain('Upload limit reached');
    });
  });

  describe('Redis Persistence', () => {
    it('should persist rate limit data in Redis', async () => {
      // Make some requests
      await request(app).get('/api/test');
      await request(app).get('/api/test');

      // Check Redis for rate limit keys
      const keys = await redisClient.keys('rl:*');
      expect(keys.length).toBeGreaterThan(0);
    });
  });
});