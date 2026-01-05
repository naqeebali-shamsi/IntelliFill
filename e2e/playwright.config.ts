import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Determine environment: local, production, or docker (default)
const E2E_ENV = process.env.E2E_ENV || 'docker';

// Load environment-specific config
const envFile = E2E_ENV === 'docker'
  ? '.env.e2e'
  : `.env.e2e.${E2E_ENV}`;

dotenv.config({ path: path.resolve(__dirname, envFile) });

console.log(`[Playwright] Environment: ${E2E_ENV}, Config: ${envFile}`);

// Environment variables with defaults
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const API_URL = process.env.API_URL || 'http://localhost:3002/api';
const WORKERS = parseInt(process.env.WORKERS || '4', 10);
const TEST_TIMEOUT = parseInt(process.env.TEST_TIMEOUT || '30000', 10);
const EXPECT_TIMEOUT = parseInt(process.env.EXPECT_TIMEOUT || '5000', 10);

// Test user credentials
export const TEST_USERS = {
  user: {
    email: process.env.TEST_USER_EMAIL || 'test@intellifill.local',
    password: process.env.TEST_USER_PASSWORD || 'Test123!@#',
  },
  user2: {
    email: process.env.TEST_USER2_EMAIL || 'test2@intellifill.local',
    password: process.env.TEST_USER2_PASSWORD || 'Test123!@#',
  },
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@intellifill.local',
    password: process.env.TEST_ADMIN_PASSWORD || 'Admin123!@#',
  },
};

/**
 * Playwright Test Configuration for IntelliFill E2E Tests
 *
 * This configuration is optimized for Docker containerized testing with:
 * - Parallel execution across multiple workers
 * - Comprehensive browser coverage (Chromium, Firefox, WebKit)
 * - Automatic retries on failure
 * - Screenshots and videos on failure
 * - Trace collection for debugging
 */
export default defineConfig({
  // Test directory
  testDir: './tests',

  // Maximum time one test can run
  timeout: TEST_TIMEOUT,

  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: WORKERS,

  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  // Shared settings for all projects
  use: {
    // Base URL for all tests
    baseURL: BASE_URL,

    // Collect trace on failure
    trace: process.env.TRACE_ON_FAILURE === 'true' ? 'on-first-retry' : 'off',

    // Screenshot on failure
    screenshot: process.env.SCREENSHOT_ON_FAILURE === 'true' ? 'only-on-failure' : 'off',

    // Video on failure
    video: process.env.VIDEO_ON_FAILURE === 'true' ? 'retain-on-failure' : 'off',

    // Timeouts
    actionTimeout: 10000,
    navigationTimeout: 30000,

    // Expect timeout
    expect: {
      timeout: EXPECT_TIMEOUT,
    },

    // Context options
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,

    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
  },

  // Configure projects for major browsers
  // CI Mode: Only run Chromium tests when CI=true to avoid Docker networking issues with Firefox/WebKit
  // Local Dev: Run all browsers for comprehensive testing
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Note: --disable-web-security was removed as it breaks httpOnly cookie handling
        // after page.reload(), causing session persistence test failures.
        // If CORS issues arise, fix them properly in backend configuration.

        // Capture console logs for debugging
        launchOptions: {
          args: ['--auto-open-devtools-for-tabs'],
        },
      },
    },

    // Firefox and WebKit are disabled in CI due to Docker networking issues
    // They can still be run locally for comprehensive browser testing
    ...(process.env.CI
      ? []
      : [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
          },
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
          },
        ]),

    // Mobile viewports - run with: npx playwright test --project="Mobile Chrome"
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: /.*mobile.*\.spec\.ts/,
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
      testMatch: /.*mobile.*\.spec\.ts/,
    },
  ],

  // Web server configuration (not used in Docker, but useful for local dev)
  // webServer: {
  //   command: 'npm run start',
  //   url: BASE_URL,
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120000,
  // },

  // Global setup and teardown
  // globalSetup: require.resolve('./utils/global-setup.ts'),
  // globalTeardown: require.resolve('./utils/global-teardown.ts'),
});
