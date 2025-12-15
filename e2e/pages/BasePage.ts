/**
 * BasePage - Base class for all Page Objects
 *
 * Provides common functionality shared across all pages:
 * - Navigation helpers
 * - Wait utilities
 * - Screenshot capture
 * - Common assertions
 */

import { Page, Locator, expect } from '@playwright/test';

export abstract class BasePage {
  protected readonly page: Page;
  protected readonly baseURL: string;

  constructor(page: Page) {
    this.page = page;
    this.baseURL = process.env.BASE_URL || 'http://frontend-test:8080';
  }

  // ============================================================================
  // Abstract methods - must be implemented by subclasses
  // ============================================================================

  /**
   * Returns the URL path for this page (e.g., '/login', '/dashboard')
   */
  abstract get path(): string;

  /**
   * Returns a locator that uniquely identifies this page is loaded
   */
  abstract get pageLoadedIndicator(): Locator;

  // ============================================================================
  // Navigation
  // ============================================================================

  /**
   * Navigate to this page
   */
  async goto(): Promise<void> {
    await this.page.goto(`${this.baseURL}${this.path}`);
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForPageLoad(): Promise<void> {
    await this.pageLoadedIndicator.waitFor({ state: 'visible', timeout: 30000 });
  }

  /**
   * Check if currently on this page
   */
  async isOnPage(): Promise<boolean> {
    try {
      await this.pageLoadedIndicator.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current URL
   */
  getCurrentURL(): string {
    return this.page.url();
  }

  // ============================================================================
  // Wait Utilities
  // ============================================================================

  /**
   * Wait for network to be idle
   */
  async waitForNetworkIdle(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for a specific API response
   */
  async waitForAPIResponse(urlPattern: string | RegExp): Promise<void> {
    await this.page.waitForResponse(urlPattern);
  }

  /**
   * Wait for element to be visible
   */
  async waitForElement(locator: Locator, timeout = 10000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * Wait for element to be hidden
   */
  async waitForElementHidden(locator: Locator, timeout = 10000): Promise<void> {
    await locator.waitFor({ state: 'hidden', timeout });
  }

  // ============================================================================
  // Common Actions
  // ============================================================================

  /**
   * Click element and wait for navigation
   */
  async clickAndNavigate(locator: Locator): Promise<void> {
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'networkidle' }),
      locator.click(),
    ]);
  }

  /**
   * Fill form field with clear first
   */
  async fillField(locator: Locator, value: string): Promise<void> {
    await locator.clear();
    await locator.fill(value);
  }

  /**
   * Upload file to input
   */
  async uploadFile(locator: Locator, filePath: string): Promise<void> {
    await locator.setInputFiles(filePath);
  }

  /**
   * Select option from dropdown
   */
  async selectOption(locator: Locator, value: string): Promise<void> {
    await locator.selectOption(value);
  }

  // ============================================================================
  // Assertions
  // ============================================================================

  /**
   * Assert element is visible
   */
  async assertVisible(locator: Locator): Promise<void> {
    await expect(locator).toBeVisible();
  }

  /**
   * Assert element has text
   */
  async assertText(locator: Locator, text: string): Promise<void> {
    await expect(locator).toHaveText(text);
  }

  /**
   * Assert element contains text
   */
  async assertContainsText(locator: Locator, text: string): Promise<void> {
    await expect(locator).toContainText(text);
  }

  /**
   * Assert URL contains path
   */
  async assertURLContains(path: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(path));
  }

  /**
   * Assert toast/notification message
   */
  async assertToast(message: string): Promise<void> {
    const toast = this.page.locator('[role="alert"], .toast, [data-sonner-toast]');
    await expect(toast).toContainText(message);
  }

  // ============================================================================
  // Debug & Screenshot
  // ============================================================================

  /**
   * Take screenshot
   */
  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `./screenshots/${name}.png`, fullPage: true });
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return this.page.title();
  }

  /**
   * Get text content of element
   */
  async getTextContent(locator: Locator): Promise<string | null> {
    return locator.textContent();
  }

  /**
   * Check if element exists in DOM (may be hidden)
   */
  async elementExists(locator: Locator): Promise<boolean> {
    const count = await locator.count();
    return count > 0;
  }
}
