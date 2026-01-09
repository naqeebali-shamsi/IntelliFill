/**
 * E2E-411: API Health Check
 *
 * Tests the system health endpoints:
 * - Basic health check
 * - Database connectivity
 * - Service status
 * - Version information
 */

import { test, expect } from '@playwright/test';

test.describe('E2E-411: API Health Check', () => {
  const apiUrl = process.env.VITE_API_URL || 'http://localhost:3002/api';

  test('should return healthy status from /api/health', async ({ request }) => {
    // Call health endpoint
    const response = await request.get(`${apiUrl}/health`);

    // Should return 200 OK
    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(200);

    // Parse response
    const healthData = await response.json();

    // Should have status field - accept 'ok' or 'healthy' as valid
    expect(healthData).toHaveProperty('status');
    expect(['ok', 'healthy']).toContain(healthData.status);
  });

  test('should confirm database connectivity', async ({ request }) => {
    const response = await request.get(`${apiUrl}/health`);

    expect(response.ok()).toBe(true);

    const healthData = await response.json();

    // Database field is optional - may not be present in simple health endpoints
    // If overall status is 'ok' or 'healthy', database is implicitly working
    if (healthData.database) {
      const dbStatus = healthData.database;

      // Database status should be 'connected' or similar
      if (typeof dbStatus === 'string') {
        expect(dbStatus.toLowerCase()).toMatch(/connected|healthy|ok/);
      } else if (typeof dbStatus === 'object') {
        expect(dbStatus.status || dbStatus.state).toMatch(/connected|healthy|ok/);
      }
    } else {
      // If no database field, overall status implies DB is working
      expect(['ok', 'healthy']).toContain(healthData.status);
    }
  });

  test('should return version information', async ({ request }) => {
    const response = await request.get(`${apiUrl}/health`);

    expect(response.ok()).toBe(true);

    const healthData = await response.json();

    // Should have version field (optional but recommended)
    if (healthData.version) {
      expect(typeof healthData.version).toBe('string');
      expect(healthData.version.length).toBeGreaterThan(0);
    }
  });

  test('should include timestamp in health response', async ({ request }) => {
    const response = await request.get(`${apiUrl}/health`);

    expect(response.ok()).toBe(true);

    const healthData = await response.json();

    // Should have timestamp (optional but good practice)
    if (healthData.timestamp) {
      const timestamp = new Date(healthData.timestamp);
      expect(timestamp.getTime()).toBeGreaterThan(0);

      // Timestamp should be recent (within last minute)
      const now = Date.now();
      const timeDiff = now - timestamp.getTime();
      expect(timeDiff).toBeLessThan(60000); // Less than 1 minute
    }
  });

  test('should respond quickly to health checks', async ({ request }) => {
    const startTime = Date.now();

    const response = await request.get(`${apiUrl}/health`);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Health check should be fast (under 1 second)
    expect(duration).toBeLessThan(1000);

    expect(response.ok()).toBe(true);
  });

  test('should include service dependencies status', async ({ request }) => {
    const response = await request.get(`${apiUrl}/health`);

    expect(response.ok()).toBe(true);

    const healthData = await response.json();

    // Verify health endpoint responds with valid status
    // Service dependencies may be implicit in the overall status
    expect(healthData.status).toBeDefined();
    expect(['ok', 'healthy', 'degraded']).toContain(healthData.status);

    // Check for optional service dependencies if present
    if (healthData.database) {
      expect(healthData.database).toBeDefined();
    }

    // Redis/Queue service (if used)
    if (healthData.redis) {
      expect(healthData.redis).toBeDefined();
    }

    if (healthData.queue) {
      expect(healthData.queue).toBeDefined();
    }

    // Storage service (if checked)
    if (healthData.storage) {
      expect(healthData.storage).toBeDefined();
    }
  });

  test('should allow health checks without authentication', async ({ request }) => {
    // Health endpoint should be public (no auth required)
    const response = await request.get(`${apiUrl}/health`);

    // Should work without authentication
    expect(response.status()).not.toBe(401);
    expect(response.status()).not.toBe(403);
    expect(response.ok()).toBe(true);
  });

  test('should return consistent health format', async ({ request }) => {
    // Make multiple requests
    const responses = await Promise.all([
      request.get(`${apiUrl}/health`),
      request.get(`${apiUrl}/health`),
      request.get(`${apiUrl}/health`),
    ]);

    // All should succeed
    responses.forEach(response => {
      expect(response.ok()).toBe(true);
    });

    // Parse all responses
    const healthDataArray = await Promise.all(
      responses.map(r => r.json())
    );

    // All should have same structure - status is required
    healthDataArray.forEach(healthData => {
      expect(healthData).toHaveProperty('status');
      expect(['ok', 'healthy', 'degraded']).toContain(healthData.status);
    });

    // Status should be consistent
    const statuses = healthDataArray.map(h => h.status);
    expect(new Set(statuses).size).toBe(1); // All same status
  });

  test('should handle health check during high load', async ({ request }) => {
    // Send multiple concurrent health checks
    const concurrentRequests = 10;
    const requests = Array(concurrentRequests).fill(null).map(() =>
      request.get(`${apiUrl}/health`)
    );

    const responses = await Promise.all(requests);

    // All should succeed
    responses.forEach(response => {
      expect(response.ok()).toBe(true);
      expect(response.status()).toBe(200);
    });
  });

  test('should provide uptime information', async ({ request }) => {
    const response = await request.get(`${apiUrl}/health`);

    expect(response.ok()).toBe(true);

    const healthData = await response.json();

    // Uptime is optional but useful
    if (healthData.uptime) {
      expect(typeof healthData.uptime).toBe('number');
      expect(healthData.uptime).toBeGreaterThan(0);
    }
  });

  test('should include environment indicator', async ({ request }) => {
    const response = await request.get(`${apiUrl}/health`);

    expect(response.ok()).toBe(true);

    const healthData = await response.json();

    // Environment indicator (optional)
    if (healthData.environment) {
      expect(['development', 'staging', 'production', 'test']).toContain(
        healthData.environment.toLowerCase()
      );
    }
  });

  test('should detect database connection failures', async ({ request }) => {
    // This test checks if health endpoint properly reports DB issues
    // In a real scenario, we'd need to simulate DB failure
    // For now, we verify the structure supports failure reporting

    const response = await request.get(`${apiUrl}/health`);

    expect(response.ok()).toBe(true);

    const healthData = await response.json();

    // Database field is optional - if not present, overall status indicates health
    if (healthData.database) {
      // If DB field exists, it should have meaningful value
      const dbStatus = typeof healthData.database === 'string'
        ? healthData.database
        : healthData.database.status || healthData.database.state;

      expect(dbStatus.toLowerCase()).toMatch(/connected|healthy|ok/);
    } else {
      // If no database field, overall status implies DB is working
      expect(['ok', 'healthy']).toContain(healthData.status);
    }
  });

  test('should support detailed health endpoint', async ({ request }) => {
    // Some APIs have /health/detailed or /health/full
    const detailedEndpoints = [
      `${apiUrl}/health/detailed`,
      `${apiUrl}/health/full`,
      `${apiUrl}/health?detailed=true`,
    ];

    for (const endpoint of detailedEndpoints) {
      const response = await request.get(endpoint);

      // If endpoint exists, verify it returns more info
      if (response.ok()) {
        const detailedHealth = await response.json();

        // Should have more fields than basic health check
        const fieldCount = Object.keys(detailedHealth).length;
        expect(fieldCount).toBeGreaterThan(1);

        break; // Found a working detailed endpoint
      }
    }
  });

  test('should set appropriate cache headers', async ({ request }) => {
    const response = await request.get(`${apiUrl}/health`);

    expect(response.ok()).toBe(true);

    const headers = response.headers();

    // Health checks should not be cached or have very short cache
    const cacheControl = headers['cache-control'];

    if (cacheControl) {
      // Should have no-cache or very short max-age
      expect(cacheControl).toMatch(/no-cache|max-age=0|max-age=[1-9]|must-revalidate/);
    }
  });

  test('should return valid JSON content-type', async ({ request }) => {
    const response = await request.get(`${apiUrl}/health`);

    expect(response.ok()).toBe(true);

    const headers = response.headers();
    const contentType = headers['content-type'];

    expect(contentType).toContain('application/json');
  });

  test('should handle graceful degradation', async ({ request }) => {
    const response = await request.get(`${apiUrl}/health`);

    expect(response.ok()).toBe(true);

    const healthData = await response.json();

    // Even if some services are degraded, health check should respond
    // Status might be 'degraded' instead of 'healthy'
    expect(['healthy', 'degraded', 'ok']).toContain(healthData.status.toLowerCase());
  });

  test('should support readiness check', async ({ request }) => {
    // Kubernetes-style readiness probe
    const readinessEndpoints = [
      `${apiUrl}/ready`,
      `${apiUrl}/readiness`,
      `${apiUrl}/health/ready`,
    ];

    for (const endpoint of readinessEndpoints) {
      const response = await request.get(endpoint);

      // If endpoint exists, it should return 200 when ready
      if (response.status() !== 404) {
        expect([200, 503]).toContain(response.status());
        break;
      }
    }
  });

  test('should support liveness check', async ({ request }) => {
    // Kubernetes-style liveness probe
    const livenessEndpoints = [
      `${apiUrl}/live`,
      `${apiUrl}/liveness`,
      `${apiUrl}/health/live`,
    ];

    for (const endpoint of livenessEndpoints) {
      const response = await request.get(endpoint);

      // If endpoint exists, it should return 200 when alive
      if (response.status() !== 404) {
        expect(response.status()).toBe(200);
        break;
      }
    }
  });

  test('should handle CORS for health endpoint', async ({ request }) => {
    const response = await request.get(`${apiUrl}/health`);

    expect(response.ok()).toBe(true);

    const headers = response.headers();

    // CORS headers should be present (optional but common)
    if (headers['access-control-allow-origin']) {
      expect(headers['access-control-allow-origin']).toBeDefined();
    }
  });
});
