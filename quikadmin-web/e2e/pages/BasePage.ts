/**
 * BasePage - Base Page Object Model
 *
 * Common methods and utilities for all page objects:
 * - Navigation
 * - Toast/notification handling
 * - Common element interactions
 * - Waiting utilities
 */

import { Page, Locator, expect } from '@playwright/test';
import { testConfig } from '../../playwright.config';

/**
 * Toast notification types
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Common element selectors
 */
export const COMMON_SELECTORS = {
  // Layout
  mainContent: 'main, [role="main"]',
  sidebar: '[data-testid="sidebar"], nav[aria-label="Sidebar"]',
  header: 'header, [role="banner"]',

  // Navigation
  navLink: 'nav a, [role="navigation"] a',
  breadcrumb: '[aria-label="Breadcrumb"], .breadcrumb',

  // Forms
  form: 'form',
  input: 'input',
  button: 'button',
  submitButton: 'button[type="submit"]',
  cancelButton: 'button[type="button"]:has-text("Cancel")',

  // Feedback
  toast: '[data-testid="toast"], [role="alert"], .toast, .Toastify__toast',
  loadingSpinner: '[data-testid="loading"], .loading, .spinner, [aria-busy="true"]',
  errorMessage: '[data-testid="error"], .error-message, [role="alert"]',

  // Modals
  modal: '[role="dialog"], .modal, [data-testid="modal"]',
  modalClose: '[aria-label="Close"], .modal-close, [data-testid="modal-close"]',

  // Tables
  table: 'table, [role="grid"]',
  tableRow: 'tr, [role="row"]',
  tableCell: 'td, [role="gridcell"]',
};

/**
 * Base Page Object Model class
 */
export class BasePage {
  readonly page: Page;
  readonly baseURL: string;

  constructor(page: Page) {
    this.page = page;
    this.baseURL = testConfig.baseURL;
  }

  // ========== Navigation ==========

  /**
   * Navigate to a path relative to baseURL
   */
  async goto(path: string): Promise<void> {
    const url = path.startsWith('/') ? path : `/${path}`;
    await this.page.goto(url);
    await this.waitForPageLoad();
  }

  /**
   * Navigate to full URL
   */
  async gotoUrl(url: string): Promise<void> {
    await this.page.goto(url);
    await this.waitForPageLoad();
  }

  /**
   * Get current URL path
   */
  getCurrentPath(): string {
    return new URL(this.page.url()).pathname;
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string {
    return this.page.url();
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for page to fully load
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
  }

  // ========== Element Interactions ==========

  /**
   * Click a button by its label text
   */
  async clickButton(label: string): Promise<void> {
    const button = this.page.getByRole('button', { name: label });
    await button.click();
  }

  /**
   * Click a link by its text
   */
  async clickLink(text: string): Promise<void> {
    const link = this.page.getByRole('link', { name: text });
    await link.click();
  }

  /**
   * Fill an input by its label
   */
  async fillInput(label: string, value: string): Promise<void> {
    const input = this.page.getByLabel(label);
    await input.fill(value);
  }

  /**
   * Fill an input by its placeholder
   */
  async fillInputByPlaceholder(placeholder: string, value: string): Promise<void> {
    const input = this.page.getByPlaceholder(placeholder);
    await input.fill(value);
  }

  /**
   * Fill an input by test ID
   */
  async fillInputByTestId(testId: string, value: string): Promise<void> {
    const input = this.page.getByTestId(testId);
    await input.fill(value);
  }

  /**
   * Select an option from a dropdown by label
   */
  async selectOption(label: string, value: string): Promise<void> {
    const select = this.page.getByLabel(label);
    await select.selectOption(value);
  }

  /**
   * Check a checkbox by its label
   */
  async checkCheckbox(label: string): Promise<void> {
    const checkbox = this.page.getByLabel(label);
    await checkbox.check();
  }

  /**
   * Uncheck a checkbox by its label
   */
  async uncheckCheckbox(label: string): Promise<void> {
    const checkbox = this.page.getByLabel(label);
    await checkbox.uncheck();
  }

  // ========== Toast/Notification Handling ==========

  /**
   * Wait for a toast notification with specific text
   */
  async waitForToast(message: string | RegExp, type?: ToastType): Promise<Locator> {
    const toast = this.page.locator(COMMON_SELECTORS.toast).filter({
      hasText: message,
    });

    await expect(toast.first()).toBeVisible({ timeout: testConfig.timeouts.apiRequest });
    return toast.first();
  }

  /**
   * Wait for success toast
   */
  async waitForSuccessToast(message?: string | RegExp): Promise<Locator> {
    const selector = message
      ? `${COMMON_SELECTORS.toast}:has-text("${message}")`
      : COMMON_SELECTORS.toast;

    const toast = this.page.locator(selector).first();
    await expect(toast).toBeVisible();
    return toast;
  }

  /**
   * Wait for error toast
   */
  async waitForErrorToast(message?: string | RegExp): Promise<Locator> {
    return this.waitForToast(message || /error|failed|invalid/i);
  }

  /**
   * Dismiss toast notification
   */
  async dismissToast(): Promise<void> {
    const closeButton = this.page.locator(`${COMMON_SELECTORS.toast} button`).first();
    if (await closeButton.isVisible()) {
      await closeButton.click();
    }
  }

  // ========== Loading States ==========

  /**
   * Wait for loading spinner to disappear
   */
  async waitForLoadingToComplete(): Promise<void> {
    const spinner = this.page.locator(COMMON_SELECTORS.loadingSpinner);
    await expect(spinner).toBeHidden({ timeout: testConfig.timeouts.ocrProcessing });
  }

  /**
   * Wait for loading spinner to appear
   */
  async waitForLoadingToStart(): Promise<void> {
    const spinner = this.page.locator(COMMON_SELECTORS.loadingSpinner);
    await expect(spinner).toBeVisible({ timeout: 5000 });
  }

  /**
   * Check if page is loading
   */
  async isLoading(): Promise<boolean> {
    const spinner = this.page.locator(COMMON_SELECTORS.loadingSpinner);
    return await spinner.isVisible();
  }

  // ========== Modal Handling ==========

  /**
   * Wait for modal to open
   */
  async waitForModal(): Promise<Locator> {
    const modal = this.page.locator(COMMON_SELECTORS.modal);
    await expect(modal).toBeVisible();
    return modal;
  }

  /**
   * Close modal
   */
  async closeModal(): Promise<void> {
    const closeButton = this.page.locator(COMMON_SELECTORS.modalClose).first();
    if (await closeButton.isVisible()) {
      await closeButton.click();
      await expect(this.page.locator(COMMON_SELECTORS.modal)).toBeHidden();
    }
  }

  /**
   * Check if modal is open
   */
  async isModalOpen(): Promise<boolean> {
    const modal = this.page.locator(COMMON_SELECTORS.modal);
    return await modal.isVisible();
  }

  // ========== Assertions ==========

  /**
   * Assert page URL contains path
   */
  async assertUrlContains(path: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(path));
  }

  /**
   * Assert page has title
   */
  async assertTitle(title: string | RegExp): Promise<void> {
    await expect(this.page).toHaveTitle(title);
  }

  /**
   * Assert element is visible
   */
  async assertVisible(selector: string): Promise<void> {
    await expect(this.page.locator(selector)).toBeVisible();
  }

  /**
   * Assert element is hidden
   */
  async assertHidden(selector: string): Promise<void> {
    await expect(this.page.locator(selector)).toBeHidden();
  }

  /**
   * Assert text is visible on page
   */
  async assertTextVisible(text: string | RegExp): Promise<void> {
    await expect(this.page.getByText(text)).toBeVisible();
  }

  /**
   * Assert element has text
   */
  async assertElementText(selector: string, text: string | RegExp): Promise<void> {
    await expect(this.page.locator(selector)).toHaveText(text);
  }

  // ========== Form Handling ==========

  /**
   * Submit the current form
   */
  async submitForm(): Promise<void> {
    const submitButton = this.page.locator(COMMON_SELECTORS.submitButton);
    await submitButton.click();
  }

  /**
   * Get form validation error messages
   */
  async getValidationErrors(): Promise<string[]> {
    const errors = this.page.locator('[aria-invalid="true"] ~ [role="alert"], .error-message, [data-testid="error"]');
    const errorTexts: string[] = [];

    const count = await errors.count();
    for (let i = 0; i < count; i++) {
      const text = await errors.nth(i).textContent();
      if (text) {
        errorTexts.push(text.trim());
      }
    }

    return errorTexts;
  }

  /**
   * Check if form has validation errors
   */
  async hasValidationErrors(): Promise<boolean> {
    const errors = await this.getValidationErrors();
    return errors.length > 0;
  }

  // ========== Utilities ==========

  /**
   * Take a screenshot
   */
  async screenshot(name: string): Promise<Buffer> {
    return await this.page.screenshot({
      path: `./e2e/screenshots/${name}.png`,
      fullPage: true,
    });
  }

  /**
   * Wait for specified milliseconds
   */
  async wait(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  /**
   * Get element by test ID
   */
  getByTestId(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  /**
   * Get element by role
   */
  getByRole(role: string, options?: { name?: string | RegExp }): Locator {
    return this.page.getByRole(role as Parameters<typeof this.page.getByRole>[0], options);
  }

  /**
   * Get element by text
   */
  getByText(text: string | RegExp): Locator {
    return this.page.getByText(text);
  }

  /**
   * Get element by label
   */
  getByLabel(label: string | RegExp): Locator {
    return this.page.getByLabel(label);
  }

  /**
   * Get locator
   */
  locator(selector: string): Locator {
    return this.page.locator(selector);
  }

  /**
   * Evaluate JavaScript in the page context
   */
  async evaluate<T>(fn: () => T): Promise<T> {
    return await this.page.evaluate(fn);
  }

  /**
   * Check if element exists
   */
  async elementExists(selector: string): Promise<boolean> {
    const element = this.page.locator(selector);
    return (await element.count()) > 0;
  }

  /**
   * Get text content of element
   */
  async getTextContent(selector: string): Promise<string | null> {
    return await this.page.locator(selector).textContent();
  }

  /**
   * Get attribute value of element
   */
  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    return await this.page.locator(selector).getAttribute(attribute);
  }

  /**
   * Scroll element into view
   */
  async scrollIntoView(selector: string): Promise<void> {
    await this.page.locator(selector).scrollIntoViewIfNeeded();
  }

  /**
   * Focus element
   */
  async focus(selector: string): Promise<void> {
    await this.page.locator(selector).focus();
  }

  /**
   * Press key
   */
  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  /**
   * Type text
   */
  async type(text: string): Promise<void> {
    await this.page.keyboard.type(text);
  }

  /**
   * Clear and type in input
   */
  async clearAndType(selector: string, text: string): Promise<void> {
    const input = this.page.locator(selector);
    await input.clear();
    await input.fill(text);
  }

  /**
   * Hover over element
   */
  async hover(selector: string): Promise<void> {
    await this.page.locator(selector).hover();
  }

  /**
   * Double click element
   */
  async doubleClick(selector: string): Promise<void> {
    await this.page.locator(selector).dblclick();
  }

  /**
   * Right click element
   */
  async rightClick(selector: string): Promise<void> {
    await this.page.locator(selector).click({ button: 'right' });
  }
}
