import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { setCSRFToken, verifyCSRFToken, csrfProtection } from '../../src/middleware/csrf';

describe('CSRF Protection Middleware', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());

    // Test endpoints
    app.get('/api/token', setCSRFToken, (req, res) => {
      res.json({ csrfToken: (req as any).csrfToken });
    });

    app.post('/api/protected', csrfProtection, (req, res) => {
      res.json({ message: 'Success' });
    });

    app.get('/api/safe', csrfProtection, (req, res) => {
      res.json({ message: 'GET allowed without token' });
    });

    // JWT authenticated endpoint (should bypass CSRF)
    app.post('/api/jwt-protected', csrfProtection, (req, res) => {
      res.json({ message: 'JWT endpoint' });
    });
  });

  describe('CSRF Token Generation', () => {
    it('should generate CSRF token on POST request', async () => {
      const response = await request(app)
        .post('/api/protected')
        .expect(403);

      expect(response.body.error).toBe('CSRF token missing');
    });

    it('should not require token for GET requests', async () => {
      const response = await request(app)
        .get('/api/safe')
        .expect(200);

      expect(response.body.message).toBe('GET allowed without token');
    });
  });

  describe('Double-Submit Cookie Pattern', () => {
    it('should accept valid CSRF token in header', async () => {
      // Get token first
      const agent = request.agent(app);
      
      // This would normally be a form page that sets the cookie
      const mockToken = 'test-csrf-token-1234567890';
      
      const response = await agent
        .post('/api/protected')
        .set('Cookie', `csrf_token=${mockToken}`)
        .set('X-CSRF-Token', mockToken)
        .expect(200);

      expect(response.body.message).toBe('Success');
    });

    it('should accept valid CSRF token in body', async () => {
      const mockToken = 'test-csrf-token-1234567890';
      
      const response = await request(app)
        .post('/api/protected')
        .set('Cookie', `csrf_token=${mockToken}`)
        .send({ _csrf: mockToken, data: 'test' })
        .expect(200);

      expect(response.body.message).toBe('Success');
    });

    it('should reject mismatched tokens', async () => {
      const response = await request(app)
        .post('/api/protected')
        .set('Cookie', 'csrf_token=cookie-token')
        .set('X-CSRF-Token', 'different-token')
        .expect(403);

      expect(response.body.error).toBe('Invalid CSRF token');
    });

    it('should reject missing cookie token', async () => {
      const response = await request(app)
        .post('/api/protected')
        .set('X-CSRF-Token', 'header-token')
        .expect(403);

      expect(response.body.error).toBe('CSRF token missing');
    });

    it('should reject missing header/body token', async () => {
      const response = await request(app)
        .post('/api/protected')
        .set('Cookie', 'csrf_token=cookie-token')
        .expect(403);

      expect(response.body.error).toBe('CSRF token missing');
    });
  });

  describe('JWT Authentication Bypass', () => {
    it('should skip CSRF for JWT authenticated requests', async () => {
      const response = await request(app)
        .post('/api/jwt-protected')
        .set('Authorization', 'Bearer fake-jwt-token')
        .expect(200);

      expect(response.body.message).toBe('JWT endpoint');
    });
  });

  describe('Safe Methods', () => {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

    safeMethods.forEach(method => {
      it(`should skip CSRF for ${method} requests`, async () => {
        // Create test endpoint for each method
        app[method.toLowerCase()]('/api/test-' + method.toLowerCase(), csrfProtection, (req, res) => {
          res.json({ method });
        });

        const response = await request(app)[method.toLowerCase()]('/api/test-' + method.toLowerCase())
          .expect(200);

        expect(response.body.method).toBe(method);
      });
    });
  });
});