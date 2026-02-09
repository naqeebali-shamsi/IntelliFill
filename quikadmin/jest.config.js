module.exports = {
  // Using transform instead of preset for pnpm compatibility
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
    // Integration tests that import initializeApp (requires real DB/Redis)
    '/tests/integration/',
    // Security tests that require running app
    '/tests/security/',
    'intellifill.test.js',
    'docker-test.js',
    'simple-docker-test.js',
    'run-auth-tests.js',
    'run-ocr-tests.js',
    'auth-e2e-test.ts',
    'ocr-e2e-test.ts',
  ],
  // Force exit after tests complete to avoid hanging
  forceExit: true,
  // Max workers for parallel execution
  maxWorkers: 1,
  // Memory limit per worker to prevent OOM crashes
  workerIdleMemoryLimit: '1GB'
};
