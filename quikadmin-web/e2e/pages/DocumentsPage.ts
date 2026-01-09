/**
 * Documents Page Object Model
 *
 * Encapsulates document management interactions:
 * - Document upload
 * - Document list management
 * - Document status tracking
 * - Search and filter
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { testConfig } from '../../playwright.config';

/**
 * Document status types
 */
export type DocumentStatus = 'pending' | 'processing' | 'processed' | 'error' | 'failed';

/**
 * Documents Page Object Model
 */
export class DocumentsPage extends BasePage {
  // Page URL
  readonly path = '/documents';

  // Selectors
  readonly selectors = {
    // Page structure
    pageTitle: 'h1:has-text("Documents"), [data-testid="documents-title"]',
    documentList: '[data-testid="document-list"], .document-list, table',

    // Upload
    uploadZone: '[data-testid="upload-zone"], .upload-zone, [role="button"]:has-text("Upload")',
    fileInput: 'input[type="file"]',
    uploadButton: 'button:has-text("Upload"), [data-testid="upload-button"]',
    uploadProgress: '[data-testid="upload-progress"], .upload-progress',

    // Document rows
    documentRow: '[data-testid="document-row"], .document-row, tr[data-document-id], tbody tr',
    documentName: '[data-testid="document-name"], .document-name, td:first-child',
    documentStatus: '[data-testid="document-status"], .document-status, [data-status]',
    documentDate: '[data-testid="document-date"], .document-date',
    documentActions: '[data-testid="document-actions"], .document-actions',

    // Action buttons
    viewButton: 'button:has-text("View"), [data-testid="view-button"]',
    downloadButton: 'button:has-text("Download"), [data-testid="download-button"]',
    deleteButton: 'button:has-text("Delete"), [data-testid="delete-button"]',
    retryButton: 'button:has-text("Retry"), [data-testid="retry-button"]',
    exportButton: 'button:has-text("Export"), [data-testid="export-button"]',

    // Search and filter
    searchInput: '[data-testid="search-input"], input[placeholder*="Search"]',
    statusFilter: '[data-testid="status-filter"], select[name="status"]',
    dateFilter: '[data-testid="date-filter"], select[name="date"]',

    // Empty state
    emptyState: '[data-testid="empty-state"], .empty-state',

    // Loading
    loadingSpinner: '[data-testid="loading"], .loading, [aria-busy="true"]',

    // Modals
    deleteModal: '[data-testid="delete-modal"], [role="dialog"]:has-text("Delete")',
    confirmDeleteButton: 'button:has-text("Confirm"), button:has-text("Yes")',
  };

  constructor(page: Page) {
    super(page);
  }

  // ========== Element Locators ==========

  get pageTitle(): Locator {
    return this.page.locator(this.selectors.pageTitle);
  }

  get documentList(): Locator {
    return this.page.locator(this.selectors.documentList);
  }

  get documentRows(): Locator {
    return this.page.locator(this.selectors.documentRow);
  }

  get uploadZone(): Locator {
    return this.page.locator(this.selectors.uploadZone);
  }

  get fileInput(): Locator {
    return this.page.locator(this.selectors.fileInput);
  }

  get searchInput(): Locator {
    return this.page.locator(this.selectors.searchInput);
  }

  get emptyState(): Locator {
    return this.page.locator(this.selectors.emptyState);
  }

  // ========== Navigation ==========

  /**
   * Navigate to documents page
   */
  async navigate(): Promise<void> {
    await this.goto(this.path);
  }

  // ========== Upload Operations ==========

  /**
   * Upload a document by file path
   */
  async uploadDocument(filePath: string): Promise<void> {
    // Set the file on the input
    await this.fileInput.setInputFiles(filePath);

    // Wait for upload to start
    await this.page.waitForTimeout(500);
  }

  /**
   * Upload multiple documents
   */
  async uploadDocuments(filePaths: string[]): Promise<void> {
    await this.fileInput.setInputFiles(filePaths);
    await this.page.waitForTimeout(500);
  }

  /**
   * Upload and wait for processing to start
   */
  async uploadAndWaitForProcessing(filePath: string): Promise<void> {
    await this.uploadDocument(filePath);

    // Wait for document to appear in list
    await this.page.waitForSelector(this.selectors.documentRow, { timeout: 10000 });
  }

  /**
   * Wait for OCR processing to complete
   */
  async waitForOCR(documentName?: string, timeout: number = testConfig.timeouts.ocrProcessing): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      let status: string | null;

      if (documentName) {
        status = await this.getDocumentStatus(documentName);
      } else {
        // Get status of first document
        const firstRow = this.documentRows.first();
        const statusEl = firstRow.locator(this.selectors.documentStatus);
        status = await statusEl.getAttribute('data-status') || await statusEl.textContent();
      }

      if (status?.toLowerCase().includes('processed') || status?.toLowerCase().includes('completed')) {
        return;
      }

      if (status?.toLowerCase().includes('error') || status?.toLowerCase().includes('failed')) {
        throw new Error(`Document processing failed with status: ${status}`);
      }

      await this.page.waitForTimeout(1000);
    }

    throw new Error(`Timeout waiting for OCR processing after ${timeout}ms`);
  }

  // ========== Document List Operations ==========

  /**
   * Get document count
   */
  async getDocumentCount(): Promise<number> {
    return await this.documentRows.count();
  }

  /**
   * Get document status by name
   */
  async getDocumentStatus(name: string): Promise<string | null> {
    const row = this.documentRows.filter({ hasText: name });
    const statusEl = row.locator(this.selectors.documentStatus);

    // Try data-status attribute first, then text content
    const status = await statusEl.getAttribute('data-status') || await statusEl.textContent();
    return status?.toLowerCase() || null;
  }

  /**
   * Get all document names
   */
  async getDocumentNames(): Promise<string[]> {
    const names: string[] = [];
    const rows = this.documentRows;
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const name = await rows.nth(i).locator(this.selectors.documentName).textContent();
      if (name) names.push(name.trim());
    }

    return names;
  }

  /**
   * Click on a document row
   */
  async clickDocument(name: string): Promise<void> {
    const row = this.documentRows.filter({ hasText: name });
    await row.click();
    await this.waitForPageLoad();
  }

  /**
   * View document details
   */
  async viewDocument(name: string): Promise<void> {
    const row = this.documentRows.filter({ hasText: name });
    await row.locator(this.selectors.viewButton).click();
    await this.waitForPageLoad();
  }

  /**
   * Download original document
   */
  async downloadDocument(name: string): Promise<ReturnType<Page['waitForEvent']>> {
    const downloadPromise = this.page.waitForEvent('download');
    const row = this.documentRows.filter({ hasText: name });
    await row.locator(this.selectors.downloadButton).click();
    return downloadPromise;
  }

  /**
   * Export document as JSON
   */
  async exportDocument(name: string): Promise<ReturnType<Page['waitForEvent']>> {
    const downloadPromise = this.page.waitForEvent('download');
    const row = this.documentRows.filter({ hasText: name });
    await row.locator(this.selectors.exportButton).click();
    return downloadPromise;
  }

  /**
   * Delete a document
   */
  async deleteDocument(name: string): Promise<void> {
    const row = this.documentRows.filter({ hasText: name });
    await row.locator(this.selectors.deleteButton).click();

    // Confirm deletion in modal
    const confirmButton = this.page.locator(this.selectors.confirmDeleteButton);
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    await this.waitForToast(/deleted|removed/i);
  }

  /**
   * Retry failed document processing
   */
  async retryDocument(name: string): Promise<void> {
    const row = this.documentRows.filter({ hasText: name });
    await row.locator(this.selectors.retryButton).click();
    await this.waitForToast(/retry|reprocessing/i);
  }

  // ========== Search and Filter ==========

  /**
   * Search for documents
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500); // Debounce
  }

  /**
   * Clear search
   */
  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    await this.page.waitForTimeout(500);
  }

  /**
   * Filter by status
   */
  async filterByStatus(status: DocumentStatus): Promise<void> {
    const filter = this.page.locator(this.selectors.statusFilter);
    await filter.selectOption(status);
    await this.waitForLoadingToComplete();
  }

  /**
   * Clear all filters
   */
  async clearFilters(): Promise<void> {
    await this.clearSearch();
    const statusFilter = this.page.locator(this.selectors.statusFilter);
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption('all');
    }
  }

  // ========== Assertions ==========

  /**
   * Assert page is loaded
   */
  async assertLoaded(): Promise<void> {
    await expect(this.pageTitle).toBeVisible();
  }

  /**
   * Assert document exists in list
   */
  async assertDocumentExists(name: string): Promise<void> {
    const row = this.documentRows.filter({ hasText: name });
    await expect(row).toBeVisible();
  }

  /**
   * Assert document does not exist in list
   */
  async assertDocumentNotExists(name: string): Promise<void> {
    const row = this.documentRows.filter({ hasText: name });
    await expect(row).not.toBeVisible();
  }

  /**
   * Assert document has status
   */
  async assertDocumentStatus(name: string, expectedStatus: DocumentStatus): Promise<void> {
    const status = await this.getDocumentStatus(name);
    expect(status).toContain(expectedStatus);
  }

  /**
   * Assert document count
   */
  async assertDocumentCount(count: number): Promise<void> {
    await expect(this.documentRows).toHaveCount(count);
  }

  /**
   * Assert empty state is shown
   */
  async assertEmptyState(): Promise<void> {
    await expect(this.emptyState).toBeVisible();
  }

  /**
   * Assert upload zone is visible
   */
  async assertUploadZoneVisible(): Promise<void> {
    await expect(this.uploadZone).toBeVisible();
  }

  /**
   * Assert search results match query
   */
  async assertSearchResults(query: string): Promise<void> {
    const names = await this.getDocumentNames();
    for (const name of names) {
      expect(name.toLowerCase()).toContain(query.toLowerCase());
    }
  }

  /**
   * Assert filter results match status
   */
  async assertFilterResults(status: DocumentStatus): Promise<void> {
    const rows = this.documentRows;
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const statusEl = rows.nth(i).locator(this.selectors.documentStatus);
      const statusText = await statusEl.getAttribute('data-status') || await statusEl.textContent();
      expect(statusText?.toLowerCase()).toContain(status);
    }
  }
}
