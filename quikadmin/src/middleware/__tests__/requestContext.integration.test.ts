/**
 * Request Context Integration Test
 *
 * Verifies that requestContext middleware is globally mounted
 * and that all API responses include X-Request-ID header.
 *
 * This test creates a minimal Express app to verify middleware mounting.
 */

import express, { Application, Request, Response } from 'express';
import request from 'supertest';
import { requestContext } from '../security';

describe('requestContext middleware integration', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
  });

  // ==========================================================================
  // Test 1: Without middleware - should NOT have X-Request-ID
  // ==========================================================================
  it('should NOT have X-Request-ID header without middleware', async () => {
    app.get('/test', (_req: Request, res: Response) => {
      res.json({ message: 'test' });
    });

    const response = await request(app).get('/test');

    expect(response.headers['x-request-id']).toBeUndefined();
  });

  // ==========================================================================
  // Test 2: With middleware - should have X-Request-ID
  // ==========================================================================
  it('should have X-Request-ID header when middleware is mounted', async () => {
    // Mount requestContext as first middleware
    app.use(requestContext);

    app.get('/test', (_req: Request, res: Response) => {
      res.json({ message: 'test' });
    });

    const response = await request(app).get('/test');

    expect(response.headers['x-request-id']).toBeDefined();
    expect(typeof response.headers['x-request-id']).toBe('string');
  });

  // ==========================================================================
  // Test 3: All routes should have X-Request-ID
  // ==========================================================================
  it('should add X-Request-ID to all routes when globally mounted', async () => {
    // Mount requestContext as first middleware (global)
    app.use(requestContext);

    app.get('/route1', (_req: Request, res: Response) => {
      res.json({ route: 1 });
    });

    app.post('/route2', (_req: Request, res: Response) => {
      res.json({ route: 2 });
    });

    app.get('/api/route3', (_req: Request, res: Response) => {
      res.json({ route: 3 });
    });

    const response1 = await request(app).get('/route1');
    const response2 = await request(app).post('/route2');
    const response3 = await request(app).get('/api/route3');

    expect(response1.headers['x-request-id']).toBeDefined();
    expect(response2.headers['x-request-id']).toBeDefined();
    expect(response3.headers['x-request-id']).toBeDefined();

    // Each request should have a unique ID
    expect(response1.headers['x-request-id']).not.toBe(response2.headers['x-request-id']);
    expect(response2.headers['x-request-id']).not.toBe(response3.headers['x-request-id']);
  });

  // ==========================================================================
  // Test 4: X-Response-Time header should be present
  // ==========================================================================
  it('should add X-Response-Time header to all responses', async () => {
    app.use(requestContext);

    app.get('/test', (_req: Request, res: Response) => {
      res.json({ message: 'test' });
    });

    const response = await request(app).get('/test');

    expect(response.headers['x-response-time']).toBeDefined();
    expect(response.headers['x-response-time']).toMatch(/^\d+ms$/);
  });

  // ==========================================================================
  // Test 5: req.id should be accessible in route handlers
  // ==========================================================================
  it('should make req.id accessible to route handlers', async () => {
    app.use(requestContext);

    let capturedRequestId: string | undefined;

    app.get('/test', (req: Request & { id?: string }, res: Response) => {
      capturedRequestId = req.id;
      res.json({ requestId: req.id });
    });

    const response = await request(app).get('/test');

    expect(capturedRequestId).toBeDefined();
    expect(response.body.requestId).toBeDefined();
    expect(response.body.requestId).toBe(capturedRequestId);
    expect(response.headers['x-request-id']).toBe(capturedRequestId);
  });

  // ==========================================================================
  // Test 6: UUID format validation
  // ==========================================================================
  it('should generate valid UUID v4 format for X-Request-ID', async () => {
    app.use(requestContext);

    app.get('/test', (_req: Request, res: Response) => {
      res.json({ message: 'test' });
    });

    const response = await request(app).get('/test');
    const requestId = response.headers['x-request-id'];

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(requestId).toMatch(uuidRegex);
  });

  // ==========================================================================
  // Test 7: Middleware order - should work as first middleware
  // ==========================================================================
  it('should work correctly when mounted before other middleware', async () => {
    // Mount requestContext FIRST
    app.use(requestContext);

    // Then other middleware
    app.use(express.json());
    app.use((_req: Request, res: Response, next) => {
      res.setHeader('X-Custom-Header', 'test');
      next();
    });

    app.get('/test', (_req: Request, res: Response) => {
      res.json({ message: 'test' });
    });

    const response = await request(app).get('/test');

    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.headers['x-custom-header']).toBe('test');
  });

  // ==========================================================================
  // Test 8: Error handling should still include X-Request-ID
  // ==========================================================================
  it('should include X-Request-ID even when route throws error', async () => {
    app.use(requestContext);

    app.get('/error', (_req: Request, _res: Response) => {
      throw new Error('Test error');
    });

    // Error handler
    app.use((err: Error, _req: Request, res: Response, _next: any) => {
      res.status(500).json({ error: err.message });
    });

    const response = await request(app).get('/error');

    expect(response.status).toBe(500);
    expect(response.headers['x-request-id']).toBeDefined();
  });
});
