module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.(ts|js)', '**/?(*.)+(spec|test).(ts|js)'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transform: {
    '^.+\.ts$': ['ts-jest', { isolatedModules: true }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  // Ignore tests that require running infrastructure (database, Redis, server)
  testPathIgnorePatterns: [
    '/node_modules/',
    // E2E tests requiring running server
    '/tests/e2e/',
    '/tests/backend/',
    'intellifill.test.js',
    'docker-test.js',
    'simple-docker-test.js',
    'run-auth-tests.js',
    'run-ocr-tests.js',
    'auth-e2e-test.ts',
    'ocr-e2e-test.ts',
    // Integration tests that import initializeApp (requires real DB/Redis)
    '/tests/integration/auth.test.ts',
    '/tests/integration/api.test.ts',
    '/tests/integration/profile.test.ts',
    '/tests/integration/protected-routes.test.ts',
    '/tests/integration/template.test.ts',
    '/tests/integration/reprocess.test.ts',
    '/tests/integration/ocr.test.ts',
    // Security tests that require running app
    '/tests/security/'
  ],
  // Force exit after tests complete to avoid hanging
  forceExit: true,
  // Max workers for parallel execution
  maxWorkers: 1,
  // Memory limit per worker to prevent OOM crashes
  workerIdleMemoryLimit: '1GB'
};
