/**
 * Jest configuration for security tests
 *
 * Usage: npm run test:security:local
 *
 * Requires Redis running on port 6380:
 *   npm run test:security:setup
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/security'],
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { isolatedModules: true }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Run sequentially to avoid Redis race conditions
  maxWorkers: 1,
  // Run tests in band for proper Redis cleanup between tests
  runInBand: true,
  // Force exit after tests complete
  forceExit: true,
  // Timeout for security tests (rate limiting can take time)
  testTimeout: 30000,
};
