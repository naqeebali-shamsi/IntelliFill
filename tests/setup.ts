/**
 * Jest Test Setup
 *
 * Sets up environment variables and global test configuration
 * before any tests run.
 */

// Set Supabase environment variables for tests
process.env.SUPABASE_URL = 'https://test-project.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key-1234567890';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-1234567890';

// Set other required environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-with-sufficient-length-for-security-requirements';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-with-sufficient-length-for-security';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock express-rate-limit to bypass rate limiting in tests
jest.mock('express-rate-limit', () => {
  return jest.fn(() => (req: any, res: any, next: any) => next());
});
