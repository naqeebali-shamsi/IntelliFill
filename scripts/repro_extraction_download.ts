/**
 * Playwright Reproduction Script for Extraction + Download Flow
 *
 * This script automates the IntelliFill form filling and download workflow
 * to reproduce and debug extraction/download issues.
 *
 * Usage:
 *   npx playwright test scripts/repro_extraction_download.ts --headed
 *   # or
 *   npx ts-node scripts/repro_extraction_download.ts
 */

import { chromium, Browser, Page, BrowserContext, Download } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const CONFIG = {
  baseUrl: process.env.BASE_URL || 'https://intellifill-b6g1na1gq-skywalk3rnns-projects.vercel.app',
  email: process.env.TEST_EMAIL || '',
  password: process.env.TEST_PASSWORD || '',
  artifactsDir: path.resolve(__dirname, '../artifacts/repro'),
  downloadsDir: path.resolve(__dirname, '../artifacts/repro/downloads'),
  evidenceFile: path.resolve(__dirname, '../docs/debug/evidence_bundle.md'),
  timeout: 60000,
  headless: process.env.HEADLESS !== 'false',
};

// Evidence collector
interface NetworkRequest {
  url: string;
  method: string;
  status: number | null;
  contentType: string | null;
  timestamp: string;
}

interface Step {
  name: string;
  timestamp: string;
  screenshot: string | null;
  success: boolean;
  error?: string;
}

interface Evidence {
  startTime: string;
  endTime: string | null;
  steps: Step[];
  networkRequests: NetworkRequest[];
  consoleLogs: string[];
  download: {
    filename: string | null;
    size: number | null;
    contentType: string | null;
    success: boolean;
    error?: string;
  };
}

const evidence: Evidence = {
  startTime: new Date().toISOString(),
  endTime: null,
  steps: [],
  networkRequests: [],
  consoleLogs: [],
  download: {
    filename: null,
    size: null,
    contentType: null,
    success: false,
  },
};

// Utility functions
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}`;
  console.log(logLine);
  evidence.consoleLogs.push(logLine);
}

async function takeScreenshot(page: Page, name: string): Promise<string> {
  const filename = `${Date.now()}_${name.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
  const filepath = path.join(CONFIG.artifactsDir, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  log(`Screenshot saved: ${filename}`);
  return filename;
}

async function recordStep(
  page: Page,
  name: string,
  action: () => Promise<void>
): Promise<void> {
  const step: Step = {
    name,
    timestamp: new Date().toISOString(),
    screenshot: null,
    success: false,
  };

  try {
    log(`Starting step: ${name}`);
    await action();
    step.screenshot = await takeScreenshot(page, name);
    step.success = true;
    log(`Step completed: ${name}`);
  } catch (error: any) {
    step.error = error.message;
    step.screenshot = await takeScreenshot(page, `${name}_error`);
    log(`Step failed: ${name} - ${error.message}`);
    throw error;
  } finally {
    evidence.steps.push(step);
  }
}

function generateEvidenceReport(): string {
  evidence.endTime = new Date().toISOString();

  let report = `# Extraction & Download Evidence Bundle

**Generated**: ${evidence.endTime}
**Base URL**: ${CONFIG.baseUrl}
**Test Duration**: ${new Date(evidence.endTime).getTime() - new Date(evidence.startTime).getTime()}ms

## Summary

| Metric | Value |
|--------|-------|
| Total Steps | ${evidence.steps.length} |
| Successful Steps | ${evidence.steps.filter(s => s.success).length} |
| Failed Steps | ${evidence.steps.filter(s => !s.success).length} |
| Network Requests | ${evidence.networkRequests.length} |
| Download Success | ${evidence.download.success ? 'Yes' : 'No'} |

## Steps Executed

| # | Step | Status | Screenshot | Error |
|---|------|--------|------------|-------|
`;

  evidence.steps.forEach((step, i) => {
    report += `| ${i + 1} | ${step.name} | ${step.success ? '✅' : '❌'} | ${step.screenshot || 'N/A'} | ${step.error || '-'} |\n`;
  });

  report += `
## Network Requests (API Endpoints)

| Timestamp | Method | URL | Status | Content-Type |
|-----------|--------|-----|--------|--------------|
`;

  evidence.networkRequests
    .filter(r => r.url.includes('/api/'))
    .forEach(req => {
      report += `| ${req.timestamp} | ${req.method} | ${req.url.replace(CONFIG.baseUrl, '')} | ${req.status || 'pending'} | ${req.contentType || '-'} |\n`;
    });

  report += `
## Download Result

| Property | Value |
|----------|-------|
| Filename | ${evidence.download.filename || 'N/A'} |
| Size | ${evidence.download.size ? `${evidence.download.size} bytes` : 'N/A'} |
| Content-Type | ${evidence.download.contentType || 'N/A'} |
| Success | ${evidence.download.success ? 'Yes' : 'No'} |
| Error | ${evidence.download.error || 'None'} |

## Console Log

\`\`\`
${evidence.consoleLogs.join('\n')}
\`\`\`

## All Network Requests

\`\`\`json
${JSON.stringify(evidence.networkRequests, null, 2)}
\`\`\`
`;

  return report;
}

async function main(): Promise<void> {
  // Validate credentials
  if (!CONFIG.email || !CONFIG.password) {
    console.error('ERROR: TEST_EMAIL and TEST_PASSWORD environment variables are required.');
    console.error('Usage: TEST_EMAIL=user@example.com TEST_PASSWORD=secret npx ts-node scripts/repro_extraction_download.ts');
    process.exit(1);
  }

  // Ensure directories exist
  ensureDir(CONFIG.artifactsDir);
  ensureDir(CONFIG.downloadsDir);
  ensureDir(path.dirname(CONFIG.evidenceFile));

  log(`Starting reproduction script`);
  log(`Base URL: ${CONFIG.baseUrl}`);
  log(`Headless: ${CONFIG.headless}`);

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let exitCode = 0;

  try {
    // Launch browser
    log('Launching Chromium...');
    browser = await chromium.launch({
      headless: CONFIG.headless,
      args: [
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      acceptDownloads: true,
    });

    page = await context.newPage();

    // Set up network request logging
    page.on('request', (request) => {
      evidence.networkRequests.push({
        url: request.url(),
        method: request.method(),
        status: null,
        contentType: null,
        timestamp: new Date().toISOString(),
      });
    });

    page.on('response', (response) => {
      const req = evidence.networkRequests.find(
        r => r.url === response.url() && r.status === null
      );
      if (req) {
        req.status = response.status();
        req.contentType = response.headers()['content-type'] || null;
      }
    });

    // Set up console logging
    page.on('console', (msg) => {
      const logLine = `[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`;
      evidence.consoleLogs.push(logLine);
      if (msg.type() === 'error') {
        console.error(logLine);
      }
    });

    // Set up download handler
    let downloadPromise: Promise<Download> | null = null;

    page.on('download', (download) => {
      log(`Download started: ${download.suggestedFilename()}`);
      downloadPromise = Promise.resolve(download);
    });

    // Step 1: Navigate to the app
    await recordStep(page, '01_navigate_to_app', async () => {
      await page!.goto(CONFIG.baseUrl, { waitUntil: 'networkidle', timeout: CONFIG.timeout });
    });

    // Check if we need to log in
    const currentUrl = page.url();
    log(`Current URL after navigation: ${currentUrl}`);

    // Step 2: Login if needed
    if (currentUrl.includes('/login') || !(await page.getByRole('heading', { name: 'Dashboard', level: 1 }).isVisible().catch(() => false))) {
      await recordStep(page, '02_navigate_to_login', async () => {
        await page!.goto(`${CONFIG.baseUrl}/login`, { waitUntil: 'networkidle' });
      });

      await recordStep(page, '03_fill_email', async () => {
        const emailInput = page!.getByLabel(/email/i);
        await emailInput.waitFor({ state: 'visible', timeout: 10000 });
        await emailInput.fill(CONFIG.email);
      });

      await recordStep(page, '04_fill_password', async () => {
        const passwordInput = page!.getByLabel(/password/i);
        await passwordInput.fill(CONFIG.password);
      });

      await recordStep(page, '05_click_signin', async () => {
        const signInButton = page!.getByRole('button', { name: /sign in/i });
        await signInButton.click();
      });

      await recordStep(page, '06_wait_for_dashboard', async () => {
        await page!.waitForURL('**/dashboard', { timeout: 15000 });
        // Wait for dashboard content to load
        await page!.getByRole('heading', { name: 'Dashboard', level: 1 }).waitFor({ state: 'visible', timeout: 10000 });
      });
    }

    // Step 3: Navigate to Form Fill page
    await recordStep(page, '07_navigate_to_fill_form', async () => {
      // Try clicking the navigation link first
      const fillFormLink = page!.getByRole('link', { name: /fill.*form|smart.*fill|intelligent.*form/i });
      if (await fillFormLink.isVisible().catch(() => false)) {
        await fillFormLink.click();
        await page!.waitForLoadState('networkidle');
      } else {
        // Direct navigation as fallback
        await page!.goto(`${CONFIG.baseUrl}/fill`, { waitUntil: 'networkidle' });
      }
    });

    // Step 4: Check if we're on the right page
    await recordStep(page, '08_verify_fill_form_page', async () => {
      const heading = page!.getByRole('heading', { name: /intelligent.*form.*filling|form.*fill/i });
      await heading.waitFor({ state: 'visible', timeout: 10000 });
    });

    // Step 5: Check for profile selector and user data status
    await recordStep(page, '09_check_profile_selector', async () => {
      // Look for profile selector or alert about data
      const profileSelector = page!.locator('[data-testid="profile-selector"]').or(page!.getByText(/select.*profile/i));
      const noDataAlert = page!.getByText(/no documents found/i);
      const readyAlert = page!.getByText(/ready to fill forms/i);

      // Wait for any of these to appear
      await Promise.race([
        profileSelector.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
        noDataAlert.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
        readyAlert.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
      ]);

      // If no documents, we need to note this
      if (await noDataAlert.isVisible().catch(() => false)) {
        log('WARNING: No documents found for this user. Form filling may not work.');
      }
    });

    // Step 6: Select a profile if available
    await recordStep(page, '10_select_profile', async () => {
      // Look for profile dropdown or selector
      const profileTrigger = page!.locator('button').filter({ hasText: /select.*profile/i }).first();

      if (await profileTrigger.isVisible().catch(() => false)) {
        await profileTrigger.click();
        await page!.waitForTimeout(500);

        // Select first available profile
        const profileOption = page!.locator('[role="option"]').first();
        if (await profileOption.isVisible().catch(() => false)) {
          await profileOption.click();
        }
      } else {
        log('Profile selector not found - may already have default profile');
      }
    });

    // Step 7: Upload a test PDF form
    await recordStep(page, '11_upload_form', async () => {
      // Find file input
      const fileInput = page!.locator('input[type="file"]').first();
      await fileInput.waitFor({ state: 'attached', timeout: 10000 });

      // Create a simple test PDF if none exists
      const testPdfPath = path.join(CONFIG.artifactsDir, 'test_form.pdf');
      if (!fs.existsSync(testPdfPath)) {
        // Create minimal PDF content
        const minimalPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 100 700 Td (Test Form) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000358 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
431
%%EOF`;
        fs.writeFileSync(testPdfPath, minimalPdf);
        log(`Created test PDF at ${testPdfPath}`);
      }

      await fileInput.setInputFiles(testPdfPath);
      log('Test PDF uploaded');

      // Wait for processing
      await page!.waitForTimeout(2000);
    });

    // Step 8: Wait for form analysis
    await recordStep(page, '12_wait_for_form_analysis', async () => {
      // Look for analysis completion indicators
      const analyzingIndicator = page!.getByText(/analyzing|processing|detecting/i);
      const fieldsDetected = page!.getByText(/fields? detected/i);
      const errorMessage = page!.getByText(/failed|error/i);

      // Wait for analyzing to complete
      if (await analyzingIndicator.isVisible().catch(() => false)) {
        log('Form is being analyzed...');
        await page!.waitForTimeout(3000);
      }

      // Check for success or error
      const hasFields = await fieldsDetected.isVisible().catch(() => false);
      const hasError = await errorMessage.isVisible().catch(() => false);

      if (hasError) {
        log('Form analysis may have encountered an error');
      } else if (hasFields) {
        log('Form analysis completed successfully');
      }
    });

    // Step 9: Review mappings (if available)
    await recordStep(page, '13_review_mappings', async () => {
      // Check if we're on the mapping step
      const mappingTab = page!.getByRole('tab', { name: /review|map/i });
      if (await mappingTab.isVisible().catch(() => false)) {
        const isSelected = await mappingTab.getAttribute('aria-selected');
        if (isSelected === 'true') {
          log('On mapping review step');
        }
      }
    });

    // Step 10: Click Fill Form button
    await recordStep(page, '14_click_fill_form', async () => {
      const fillButton = page!.getByRole('button', { name: /fill.*form|continue|next/i }).first();
      if (await fillButton.isVisible().catch(() => false)) {
        await fillButton.click();
        log('Clicked Fill Form button');
        await page!.waitForTimeout(2000);
      } else {
        log('Fill Form button not found - may need documents uploaded first');
      }
    });

    // Step 11: Wait for form filling to complete
    await recordStep(page, '15_wait_for_fill_complete', async () => {
      // Wait for success message or download button
      const successMessage = page!.getByText(/filled.*successfully|success/i);
      const downloadButton = page!.getByRole('button', { name: /download/i }).or(page!.getByRole('link', { name: /download/i }));
      const errorMessage = page!.getByText(/failed|error/i);

      await Promise.race([
        successMessage.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null),
        downloadButton.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null),
        errorMessage.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null),
      ]);

      if (await successMessage.isVisible().catch(() => false)) {
        log('Form filled successfully!');
      } else if (await errorMessage.isVisible().catch(() => false)) {
        const errorText = await errorMessage.textContent();
        log(`Form filling error: ${errorText}`);
      }
    });

    // Step 12: Click download and capture file
    await recordStep(page, '16_download_filled_form', async () => {
      const downloadButton = page!.getByRole('button', { name: /download/i }).or(page!.getByRole('link', { name: /download/i }));

      if (await downloadButton.isVisible().catch(() => false)) {
        // Set up download listener
        const [download] = await Promise.all([
          page!.waitForEvent('download', { timeout: 10000 }).catch(() => null),
          downloadButton.click(),
        ]);

        if (download) {
          const filename = download.suggestedFilename();
          const downloadPath = path.join(CONFIG.downloadsDir, filename);

          await download.saveAs(downloadPath);

          // Get file info
          const stats = fs.statSync(downloadPath);

          evidence.download.filename = filename;
          evidence.download.size = stats.size;
          evidence.download.contentType = 'application/pdf';
          evidence.download.success = stats.size > 0;

          if (stats.size === 0) {
            evidence.download.error = 'Downloaded file is empty';
            throw new Error('Downloaded file is empty');
          }

          log(`Download completed: ${filename} (${stats.size} bytes)`);
        } else {
          log('No download event received');
          evidence.download.error = 'No download event received';
        }
      } else {
        log('Download button not visible - may need to complete form filling first');
        evidence.download.error = 'Download button not visible';
      }
    });

    // Final step - verify download
    if (!evidence.download.success) {
      exitCode = 1;
      log('FAILED: Download was not successful');
    } else {
      log('SUCCESS: Download completed successfully');
    }

  } catch (error: any) {
    log(`FATAL ERROR: ${error.message}`);
    console.error(error);
    exitCode = 1;

    // Take error screenshot if page is available
    if (page) {
      try {
        await takeScreenshot(page, 'fatal_error');
      } catch (e) {
        // Ignore screenshot errors
      }
    }
  } finally {
    // Generate and save evidence report
    const report = generateEvidenceReport();
    fs.writeFileSync(CONFIG.evidenceFile, report);
    log(`Evidence report saved to: ${CONFIG.evidenceFile}`);

    // Save console log
    const consoleLogPath = path.join(CONFIG.artifactsDir, 'console.log');
    fs.writeFileSync(consoleLogPath, evidence.consoleLogs.join('\n'));
    log(`Console log saved to: ${consoleLogPath}`);

    // Cleanup
    if (browser) {
      await browser.close();
    }

    log(`Script completed with exit code: ${exitCode}`);
    process.exit(exitCode);
  }
}

// Run the script
main();
