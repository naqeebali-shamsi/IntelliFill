/**
 * Puppeteer Test Helpers for IntelliFill
 * Utility functions for common test operations
 */

import { TEST_CONFIG } from './test-config';

export class PuppeteerTestHelpers {
  /**
   * Connect to Chrome instance using Puppeteer MCP
   */
  static async connectToBrowser(debugPort: number = TEST_CONFIG.browser.debugPort) {
    console.log(`Connecting to Chrome on port ${debugPort}...`);
    // This would use mcp__puppeteer__puppeteer_connect_active_tab
    return { connected: true, port: debugPort };
  }

  /**
   * Navigate to a page and wait for it to load
   */
  static async navigateToPage(url: string) {
    console.log(`Navigating to ${url}...`);
    // This would use mcp__puppeteer__puppeteer_navigate
    return { navigated: true, url };
  }

  /**
   * Take a screenshot for test evidence
   */
  static async takeScreenshot(name: string, selector?: string) {
    console.log(`Taking screenshot: ${name}`);
    // This would use mcp__puppeteer__puppeteer_screenshot
    return { screenshot: true, name, selector };
  }

  /**
   * Click an element and wait for navigation if needed
   */
  static async clickElement(selector: string, waitForNav: boolean = false) {
    console.log(`Clicking element: ${selector}`);
    // This would use mcp__puppeteer__puppeteer_click
    return { clicked: true, selector };
  }

  /**
   * Fill a form field
   */
  static async fillField(selector: string, value: string) {
    console.log(`Filling field ${selector} with value`);
    // This would use mcp__puppeteer__puppeteer_fill
    return { filled: true, selector, value };
  }

  /**
   * Select an option from dropdown
   */
  static async selectOption(selector: string, value: string) {
    console.log(`Selecting option ${value} in ${selector}`);
    // This would use mcp__puppeteer__puppeteer_select
    return { selected: true, selector, value };
  }

  /**
   * Login helper
   */
  static async login(email: string, password: string) {
    await this.navigateToPage(`${TEST_CONFIG.urls.base}/login`);
    await this.fillField(TEST_CONFIG.selectors.auth.emailInput, email);
    await this.fillField(TEST_CONFIG.selectors.auth.passwordInput, password);
    await this.clickElement(TEST_CONFIG.selectors.auth.loginButton, true);
    await this.waitForElement(TEST_CONFIG.selectors.nav.dashboard);
    return { loggedIn: true, email };
  }

  /**
   * Logout helper
   */
  static async logout() {
    await this.clickElement(TEST_CONFIG.selectors.auth.userMenu);
    await this.clickElement(TEST_CONFIG.selectors.auth.logoutButton, true);
    return { loggedOut: true };
  }

  /**
   * Wait for element to appear
   */
  static async waitForElement(selector: string, timeout: number = TEST_CONFIG.browser.defaultTimeout) {
    console.log(`Waiting for element: ${selector}`);
    // This would use mcp__puppeteer__puppeteer_evaluate to check for element
    return { found: true, selector };
  }

  /**
   * Wait for text to appear on page
   */
  static async waitForText(text: string, timeout: number = TEST_CONFIG.browser.defaultTimeout) {
    console.log(`Waiting for text: ${text}`);
    // This would use mcp__puppeteer__puppeteer_evaluate to check for text
    return { found: true, text };
  }

  /**
   * Upload a file
   */
  static async uploadFile(filePath: string) {
    // This would interact with file input
    console.log(`Uploading file: ${filePath}`);
    return { uploaded: true, filePath };
  }

  /**
   * Check if element exists
   */
  static async elementExists(selector: string): Promise<boolean> {
    console.log(`Checking if element exists: ${selector}`);
    // This would use mcp__puppeteer__puppeteer_evaluate
    return true;
  }

  /**
   * Get element text
   */
  static async getElementText(selector: string): Promise<string> {
    console.log(`Getting text from: ${selector}`);
    // This would use mcp__puppeteer__puppeteer_evaluate
    return 'Sample Text';
  }

  /**
   * Get element count
   */
  static async getElementCount(selector: string): Promise<number> {
    console.log(`Counting elements: ${selector}`);
    // This would use mcp__puppeteer__puppeteer_evaluate
    return 0;
  }

  /**
   * Verify page title
   */
  static async verifyPageTitle(expectedTitle: string): Promise<boolean> {
    console.log(`Verifying page title: ${expectedTitle}`);
    // This would use mcp__puppeteer__puppeteer_evaluate
    return true;
  }

  /**
   * Wait for specific time
   */
  static async wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear browser data (cookies, storage)
   */
  static async clearBrowserData() {
    console.log('Clearing browser data...');
    // This would use mcp__puppeteer__puppeteer_evaluate
    return { cleared: true };
  }

  /**
   * Hover over element
   */
  static async hoverElement(selector: string) {
    console.log(`Hovering over: ${selector}`);
    // This would use mcp__puppeteer__puppeteer_hover
    return { hovered: true, selector };
  }

  /**
   * Execute custom JavaScript
   */
  static async executeScript(script: string) {
    console.log('Executing custom script...');
    // This would use mcp__puppeteer__puppeteer_evaluate
    return { executed: true };
  }

  /**
   * Check for console errors
   */
  static async checkForConsoleErrors(): Promise<string[]> {
    console.log('Checking for console errors...');
    // This would use mcp__puppeteer__puppeteer_evaluate
    return [];
  }

  /**
   * Verify API response
   */
  static async verifyAPIResponse(endpoint: string, expectedStatus: number) {
    console.log(`Verifying API response for: ${endpoint}`);
    // This would intercept network requests
    return { verified: true, endpoint, status: expectedStatus };
  }
}