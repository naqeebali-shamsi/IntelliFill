import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * Configured for:
 * - Responsive testing across multiple viewport sizes
 * - CI optimization: 2 viewports (mobile + desktop) for faster runs
 * - Local development: 5 viewports for comprehensive testing
 * - Sharding support for CI parallelization
 * - Extended timeouts for OCR processing operations
 * - Comprehensive tracing and video capture
 */

// Environment-specific configuration
const isCI = !!process.env.CI;
const runFullViewportMatrix = !!process.env.FULL_VIEWPORT_MATRIX;

// All viewport sizes for comprehensive local testing
const allViewportSizes = [
  { width: 375, height: 667, name: 'mobile' },        // iPhone SE
  { width: 640, height: 1136, name: 'phablet' },      // Large phone / small tablet
  { width: 768, height: 1024, name: 'tablet' },       // iPad
  { width: 1024, height: 768, name: 'laptop' },       // Small laptop
  { width: 1280, height: 720, name: 'desktop' },      // Desktop monitor
];

// Reduced viewport sizes for CI efficiency (mobile + desktop)
const ciViewportSizes = [
  { width: 375, height: 667, name: 'mobile' },        // Mobile viewport
  { width: 1280, height: 720, name: 'desktop' },      // Desktop viewport
];

// Select viewports based on environment
const viewportSizes = (isCI && !runFullViewportMatrix) ? ciViewportSizes : allViewportSizes;

// Log viewport configuration
console.log(`[Playwright Config] Using ${viewportSizes.length} viewport(s): ${viewportSizes.map(v => v.name).join(', ')}`);
console.log(`[Playwright Config] CI: ${isCI}, Full Matrix: ${runFullViewportMatrix}`);

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080';
const apiURL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3002/api';

export default defineConfig({
  testDir: './e2e/tests',

  // Maximum time one test can run for (extended for OCR processing)
  timeout: 60 * 1000,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: isCI,

  // Retry on CI only
  retries: isCI ? 2 : 0,

  // Sharding configuration for CI parallelization
  // Usage: --shard=1/3 to run first shard of 3
  fullyParallel: true,
  workers: isCI ? 1 : undefined,

  // Reporter to use
  reporter: isCI
    ? [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['junit', { outputFile: 'playwright-results.xml' }],
        ['github'],
      ]
    : [
        ['html', { outputFolder: 'playwright-report' }],
        ['list'],
      ],

  // Note: Global setup/teardown now handled via project dependencies pattern
  // See 'setup' and 'cleanup' projects below

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL,

    // Extra HTTP headers for API requests
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },

    // Action timeout (clicking, filling, etc.) - extended for slow OCR operations
    actionTimeout: 15 * 1000,

    // Navigation timeout
    navigationTimeout: 30 * 1000,

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on first retry (helps debug flaky tests)
    video: 'on-first-retry',

    // Headless mode
    headless: isCI,

    // Ignore HTTPS errors (useful for local dev with self-signed certs)
    ignoreHTTPSErrors: !isCI,

    // Locale settings
    locale: 'en-US',
    timezoneId: 'America/New_York',
  },

  // Expect configuration
  expect: {
    // Global expect timeout - extended for OCR results
    timeout: 10 * 1000,

    // Visual regression testing configuration
    toHaveScreenshot: {
      // Maximum pixel difference threshold (0-1 scale, where 1 is 100% difference)
      maxDiffPixelRatio: 0.05,

      // Threshold for individual pixel comparison (0-1 scale)
      threshold: 0.2,

      // Animations can cause flaky tests, so disable them
      animations: 'disabled' as const,

      // Allow for minor anti-aliasing differences
      scale: 'css' as const,
    },

    // Snapshot testing configuration
    toMatchSnapshot: {
      // Threshold for snapshot comparison
      threshold: 0.2,
    },
  },

  // Configure projects for major browsers with responsive viewports
  // Uses project dependencies pattern for global setup/teardown
  projects: [
    // Setup project - runs first before all browser tests
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
      teardown: 'cleanup',
    },
    // Cleanup project - runs after all tests complete
    {
      name: 'cleanup',
      testMatch: /global\.teardown\.ts/,
    },
    // Desktop viewports with Chromium - depend on setup
    ...viewportSizes.map((viewport) => ({
      name: `chromium-${viewport.name}`,
      use: {
        ...devices['Desktop Chrome'],
        viewport: {
          width: viewport.width,
          height: viewport.height,
        },
      },
      dependencies: ['setup'],
    })),

    // Optional: Firefox for cross-browser testing (can enable in CI)
    // {
    //   name: 'firefox-desktop',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //     viewport: { width: 1280, height: 720 },
    //   },
    //   dependencies: ['setup'],
    // },

    // Optional: WebKit for Safari testing (can enable in CI)
    // {
    //   name: 'webkit-desktop',
    //   use: {
    //     ...devices['Desktop Safari'],
    //     viewport: { width: 1280, height: 720 },
    //   },
    //   dependencies: ['setup'],
    // },
  ],

  // Run local dev servers before starting the tests
  // Playwright starts both servers in parallel and waits for them to be ready
  webServer: [
    {
      // Backend API server (Express)
      command: 'npm run dev',
      cwd: '../quikadmin',
      url: 'http://localhost:3002/health',
      reuseExistingServer: !isCI,
      timeout: 120 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    },
    {
      // Frontend dev server (Vite)
      command: 'bun run dev',
      url: baseURL,
      reuseExistingServer: !isCI,
      timeout: 120 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],

  // Output directory for test artifacts
  outputDir: './e2e/test-results',

  // Preserve output on success (useful for debugging)
  preserveOutput: 'failures-only',

  // Metadata for the test run
  metadata: {
    environment: isCI ? 'ci' : 'local',
    apiURL,
  },
});

// Export constants for use in tests
export const testConfig = {
  baseURL,
  apiURL,
  isCI,
  viewportCount: viewportSizes.length,
  viewportNames: viewportSizes.map(v => v.name),
  timeouts: {
    ocrProcessing: 30 * 1000,  // Extended timeout for OCR operations
    fileUpload: 20 * 1000,     // Timeout for file uploads
    apiRequest: 10 * 1000,     // Timeout for API requests
  },
};
