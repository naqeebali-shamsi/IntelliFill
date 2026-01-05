/**
 * Security Middleware Tests
 *
 * Unit tests for requestContext middleware covering:
 * - Request ID generation and header setting
 * - Response time tracking
 * - UUID format validation
 * - Per-request uniqueness
 */

import { Request, Response } from 'express';
import { requestContext, sanitizeRequest } from '../security';
import { logger } from '../../utils/logger';

// Mock the logger
jest.mock('../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock response object
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

const createMockResponse = (): Partial<Response> => {
  const headers: Record<string, string> = {};
  const listeners: Record<string, AnyFunction[]> = {};

  return {
    setHeader: jest.fn((key: string, value: string) => {
      headers[key] = value;
    }),
    getHeader: jest.fn((key: string) => headers[key]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    writeHead: jest.fn(function (this: any) {
      return this;
    }),
    on: jest.fn((event: string, callback: AnyFunction) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
    }),
    emit: jest.fn((event: string) => {
      if (listeners[event]) {
        listeners[event].forEach((cb) => cb());
      }
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
};

// Mock request object
const createMockRequest = (): Partial<Request> => {
  return {} as any;
};

describe('requestContext middleware', () => {
  let mockReq: Partial<Request> & { id?: string; timestamp?: number };
  let mockRes: Partial<Response>;
  let nextFn: jest.Mock;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    nextFn = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Test 1: X-Request-ID header is added to response
  // ==========================================================================
  it('should add X-Request-ID header to response', () => {
    requestContext(mockReq as any, mockRes as any, nextFn);

    expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-ID', expect.any(String));
  });

  // ==========================================================================
  // Test 2: Should override writeHead to inject X-Response-Time
  // ==========================================================================
  it('should override res.writeHead to inject X-Response-Time', () => {
    const originalWriteHead = mockRes.writeHead;
    requestContext(mockReq as any, mockRes as any, nextFn);

    // writeHead should be overridden
    expect(mockRes.writeHead).not.toBe(originalWriteHead);
    expect(typeof mockRes.writeHead).toBe('function');
  });

  // ==========================================================================
  // Test 3: X-Request-ID should be valid UUID format
  // ==========================================================================
  it('should generate X-Request-ID in valid UUID format', () => {
    requestContext(mockReq as any, mockRes as any, nextFn);

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(mockReq.id).toBeDefined();
    expect(mockReq.id).toMatch(uuidRegex);
  });

  // ==========================================================================
  // Test 4: req.id should be set for downstream middleware
  // ==========================================================================
  it('should set req.id for downstream middleware', () => {
    requestContext(mockReq as any, mockRes as any, nextFn);

    expect(mockReq.id).toBeDefined();
    expect(typeof mockReq.id).toBe('string');
    expect(mockReq.id!.length).toBeGreaterThan(0);
  });

  // ==========================================================================
  // Test 5: req.timestamp should be set
  // ==========================================================================
  it('should set req.timestamp for downstream middleware', () => {
    const before = Date.now();
    requestContext(mockReq as any, mockRes as any, nextFn);
    const after = Date.now();

    expect(mockReq.timestamp).toBeDefined();
    expect(typeof mockReq.timestamp).toBe('number');
    expect(mockReq.timestamp).toBeGreaterThanOrEqual(before);
    expect(mockReq.timestamp).toBeLessThanOrEqual(after);
  });

  // ==========================================================================
  // Test 6: Different requests should have different request IDs
  // ==========================================================================
  it('should generate unique request IDs for different requests', () => {
    const req1 = createMockRequest();
    const req2 = createMockRequest();
    const res1 = createMockResponse();
    const res2 = createMockResponse();
    const next1 = jest.fn();
    const next2 = jest.fn();

    requestContext(req1 as any, res1 as any, next1);
    requestContext(req2 as any, res2 as any, next2);

    expect((req1 as any).id).toBeDefined();
    expect((req2 as any).id).toBeDefined();
    expect((req1 as any).id).not.toBe((req2 as any).id);
  });

  // ==========================================================================
  // Test 7: Should call next() to continue middleware chain
  // ==========================================================================
  it('should call next() to continue middleware chain', () => {
    requestContext(mockReq as any, mockRes as any, nextFn);

    expect(nextFn).toHaveBeenCalledTimes(1);
    expect(nextFn).toHaveBeenCalledWith();
  });

  // ==========================================================================
  // Test 8: Should set X-Response-Time header when writeHead is called
  // ==========================================================================
  it('should set X-Response-Time when writeHead is called', () => {
    requestContext(mockReq as any, mockRes as any, nextFn);

    // Call the overridden writeHead
    (mockRes.writeHead as any)(200, { 'Content-Type': 'application/json' });

    // Verify X-Response-Time was set before writeHead was called
    const calls = (mockRes.setHeader as jest.Mock).mock.calls;
    const responseTimeCall = calls.find((call) => call[0] === 'X-Response-Time');

    expect(responseTimeCall).toBeDefined();
    expect(responseTimeCall![1]).toMatch(/^\d+ms$/);
  });

  // ==========================================================================
  // Test 9: Response time should reflect actual processing time
  // ==========================================================================
  it('should calculate response time based on when writeHead is called', async () => {
    requestContext(mockReq as any, mockRes as any, nextFn);

    // Simulate some processing time
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Call writeHead after delay
    (mockRes.writeHead as any)(200);

    const calls = (mockRes.setHeader as jest.Mock).mock.calls;
    const responseTimeCall = calls.find((call) => call[0] === 'X-Response-Time');

    expect(responseTimeCall).toBeDefined();
    expect(responseTimeCall![1]).toMatch(/^\d+ms$/);

    // Response time should be at least 10ms (our delay)
    const timeMs = parseInt(responseTimeCall![1]);
    expect(timeMs).toBeGreaterThanOrEqual(10);
  });

  // ==========================================================================
  // Test 10: writeHead should call original implementation
  // ==========================================================================
  it('should call original writeHead implementation', () => {
    const originalWriteHead = jest.fn().mockReturnThis();
    mockRes.writeHead = originalWriteHead;

    requestContext(mockReq as any, mockRes as any, nextFn);

    // Call the overridden writeHead
    const statusCode = 200;
    const headers = { 'Content-Type': 'application/json' };
    (mockRes.writeHead as any)(statusCode, headers);

    // Original writeHead should have been called
    expect(originalWriteHead).toHaveBeenCalledWith(statusCode, headers);
  });
});

// =============================================================================
// Task 299: sanitizeRequest middleware tests
// =============================================================================
describe('sanitizeRequest middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: jest.Mock;

  beforeEach(() => {
    mockRes = createMockResponse();
    nextFn = jest.fn();
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Test 1: Null bytes are removed from request body strings
  // ==========================================================================
  it('should remove null bytes from request body strings', () => {
    mockReq = {
      body: { name: 'test\0value', description: 'hello\0world' },
      query: {},
      params: {},
      path: '/test',
      method: 'POST',
      headers: {},
      ip: '127.0.0.1',
    } as any;

    sanitizeRequest(mockReq as any, mockRes as any, nextFn);

    expect(mockReq.body.name).toBe('testvalue');
    expect(mockReq.body.description).toBe('helloworld');
    expect(nextFn).toHaveBeenCalled();
  });

  // ==========================================================================
  // Test 2: Control characters are removed from request body
  // ==========================================================================
  it('should remove control characters from request body', () => {
    mockReq = {
      body: { text: 'start\x01\x02\x03end', other: 'abc\x7Fdef' },
      query: {},
      params: {},
      path: '/test',
      method: 'POST',
      headers: {},
      ip: '127.0.0.1',
    } as any;

    sanitizeRequest(mockReq as any, mockRes as any, nextFn);

    expect(mockReq.body.text).toBe('startend');
    expect(mockReq.body.other).toBe('abcdef');
  });

  // ==========================================================================
  // Test 3: Valid UTF-8 remains untouched
  // ==========================================================================
  it('should leave valid UTF-8 characters untouched', () => {
    mockReq = {
      body: {
        name: 'José García',
        japanese: 'こんにちは',
        emoji: '🎉🚀',
        chinese: '中文测试',
      },
      query: {},
      params: {},
      path: '/test',
      method: 'POST',
      headers: {},
      ip: '127.0.0.1',
    } as any;

    sanitizeRequest(mockReq as any, mockRes as any, nextFn);

    expect(mockReq.body.name).toBe('José García');
    expect(mockReq.body.japanese).toBe('こんにちは');
    expect(mockReq.body.emoji).toBe('🎉🚀');
    expect(mockReq.body.chinese).toBe('中文测试');
  });

  // ==========================================================================
  // Test 4: Nested objects are sanitized recursively
  // ==========================================================================
  it('should sanitize nested objects recursively', () => {
    mockReq = {
      body: {
        user: {
          name: 'test\0name',
          details: {
            bio: 'hello\x01world',
          },
        },
      },
      query: {},
      params: {},
      path: '/test',
      method: 'POST',
      headers: {},
      ip: '127.0.0.1',
    } as any;

    sanitizeRequest(mockReq as any, mockRes as any, nextFn);

    expect(mockReq.body.user.name).toBe('testname');
    expect(mockReq.body.user.details.bio).toBe('helloworld');
  });

  // ==========================================================================
  // Test 5: Arrays are sanitized
  // ==========================================================================
  it('should sanitize arrays', () => {
    mockReq = {
      body: {
        items: ['clean', 'dirty\0data', 'another\x03one'],
      },
      query: {},
      params: {},
      path: '/test',
      method: 'POST',
      headers: {},
      ip: '127.0.0.1',
    } as any;

    sanitizeRequest(mockReq as any, mockRes as any, nextFn);

    expect(mockReq.body.items[0]).toBe('clean');
    expect(mockReq.body.items[1]).toBe('dirtydata');
    expect(mockReq.body.items[2]).toBe('anotherone');
  });

  // ==========================================================================
  // Test 6: Query parameters are sanitized
  // ==========================================================================
  it('should sanitize query parameters', () => {
    mockReq = {
      body: {},
      query: { search: 'test\0query', filter: 'valid' },
      params: {},
      path: '/test',
      method: 'GET',
      headers: {},
      ip: '127.0.0.1',
    } as any;

    sanitizeRequest(mockReq as any, mockRes as any, nextFn);

    expect(mockReq.query!.search).toBe('testquery');
    expect(mockReq.query!.filter).toBe('valid');
  });

  // ==========================================================================
  // Test 7: Route parameters are sanitized
  // ==========================================================================
  it('should sanitize route parameters', () => {
    mockReq = {
      body: {},
      query: {},
      params: { id: '123\x00456' },
      path: '/test/123',
      method: 'GET',
      headers: {},
      ip: '127.0.0.1',
    } as any;

    sanitizeRequest(mockReq as any, mockRes as any, nextFn);

    expect(mockReq.params!.id).toBe('123456');
  });

  // ==========================================================================
  // Test 8: Logs warning when sanitization modifies data
  // ==========================================================================
  it('should log warning when sanitization modifies data', () => {
    mockReq = {
      body: { name: 'test\0value' },
      query: {},
      params: {},
      path: '/api/test',
      method: 'POST',
      headers: { 'x-request-id': 'test-123' },
      ip: '192.168.1.1',
    } as any;

    sanitizeRequest(mockReq as any, mockRes as any, nextFn);

    expect(logger.warn).toHaveBeenCalledWith(
      'Request sanitization modified input data',
      expect.objectContaining({
        path: '/api/test',
        method: 'POST',
        requestId: 'test-123',
        ip: '192.168.1.1',
      })
    );
  });

  // ==========================================================================
  // Test 9: Does not log when no modifications are made
  // ==========================================================================
  it('should not log when no modifications are made', () => {
    mockReq = {
      body: { name: 'clean data', value: 12345 },
      query: { search: 'normal' },
      params: { id: 'abc123' },
      path: '/api/test',
      method: 'GET',
      headers: {},
      ip: '127.0.0.1',
    } as any;

    sanitizeRequest(mockReq as any, mockRes as any, nextFn);

    expect(logger.warn).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Test 10: Non-string values pass through unchanged
  // ==========================================================================
  it('should pass through non-string values unchanged', () => {
    mockReq = {
      body: {
        count: 42,
        active: true,
        ratio: 3.14,
        empty: null,
      },
      query: {},
      params: {},
      path: '/test',
      method: 'POST',
      headers: {},
      ip: '127.0.0.1',
    } as any;

    sanitizeRequest(mockReq as any, mockRes as any, nextFn);

    expect(mockReq.body.count).toBe(42);
    expect(mockReq.body.active).toBe(true);
    expect(mockReq.body.ratio).toBe(3.14);
    expect(mockReq.body.empty).toBeNull();
  });

  // ==========================================================================
  // Test 11: Object keys are also sanitized
  // ==========================================================================
  it('should sanitize object keys as well as values', () => {
    mockReq = {
      body: { 'key\0name': 'value' },
      query: {},
      params: {},
      path: '/test',
      method: 'POST',
      headers: {},
      ip: '127.0.0.1',
    } as any;

    sanitizeRequest(mockReq as any, mockRes as any, nextFn);

    expect(mockReq.body['keyname']).toBe('value');
    expect(mockReq.body['key\0name']).toBeUndefined();
  });
});
