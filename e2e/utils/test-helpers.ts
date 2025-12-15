import { Page } from '@playwright/test';

/**
 * General Test Helper Utilities
 *
 * Reusable functions for common test operations.
 */

/**
 * Wait for API response
 *
 * @param page Playwright page object
 * @param urlPattern URL pattern to match
 * @param timeout Timeout in milliseconds
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout: number = 10000
): Promise<void> {
  await page.waitForResponse(urlPattern, { timeout });
}

/**
 * Take screenshot with timestamp
 *
 * @param page Playwright page object
 * @param name Screenshot name
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `screenshots/${name}-${timestamp}.png`,
    fullPage: true,
  });
}

/**
 * Wait for loading indicator to disappear
 *
 * @param page Playwright page object
 * @param timeout Timeout in milliseconds
 */
export async function waitForLoadingComplete(
  page: Page,
  timeout: number = 30000
): Promise<void> {
  // Wait for common loading indicators to disappear
  const loadingSelectors = [
    '[data-loading="true"]',
    '.loading',
    '.spinner',
    '[role="progressbar"]',
  ];

  for (const selector of loadingSelectors) {
    const loader = page.locator(selector);
    if (await loader.isVisible({ timeout: 1000 }).catch(() => false)) {
      await loader.waitFor({ state: 'hidden', timeout });
    }
  }
}

/**
 * Fill form with data
 *
 * @param page Playwright page object
 * @param formData Object with field labels/names as keys and values
 */
export async function fillForm(
  page: Page,
  formData: Record<string, string>
): Promise<void> {
  for (const [field, value] of Object.entries(formData)) {
    const input = page.getByLabel(new RegExp(field, 'i'));
    await input.fill(value);
  }
}

/**
 * Wait for element to be stable (no animations)
 *
 * @param page Playwright page object
 * @param selector Element selector
 */
export async function waitForStable(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible' });

  // Wait for animations to complete
  await page.waitForTimeout(500);
}

/**
 * Retry action with exponential backoff
 *
 * @param action Action to retry
 * @param maxRetries Maximum number of retries
 * @param initialDelay Initial delay in milliseconds
 */
export async function retryWithBackoff<T>(
  action: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      const delay = initialDelay * Math.pow(2, i);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Get current timestamp in ISO format
 */
export function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Generate random string
 *
 * @param length Length of string
 */
export function randomString(length: number = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate unique email
 */
export function generateUniqueEmail(): string {
  return `test-${randomString(8)}@intellifill.local`;
}
