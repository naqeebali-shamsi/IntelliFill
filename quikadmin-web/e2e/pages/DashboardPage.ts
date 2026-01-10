/**
 * Dashboard Page Object Model
 *
 * Encapsulates dashboard interactions:
 * - Stats overview
 * - Quick actions
 * - Recent documents
 * - Navigation
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Dashboard Page Object Model
 */
export class DashboardPage extends BasePage {
  // Page URL
  readonly path = '/dashboard';

  // Selectors - data-testid as primary, fallbacks for compatibility
  readonly selectors = {
    // Page structure - data-testid as primary
    pageTitle: '[data-testid="dashboard-greeting"], h1:has-text("Good"), h1:has-text("Dashboard")',
    mainContent: '[data-testid="dashboard-content"], .max-w-7xl',
    header: '[data-testid="dashboard-header"]',
    refreshBtn: '[data-testid="dashboard-refresh-btn"]',
    headerUploadBtn: '[data-testid="dashboard-upload-btn"]',

    // Stats cards - data-testid as primary
    statsGrid: '[data-testid="dashboard-stats-grid"], .grid:has([data-testid^="stat-card"])',
    statCard: '[data-testid^="stat-card-dashboard-"]',
    totalDocuments: '[data-testid="stat-card-dashboard-1"]',
    processedToday: '[data-testid="stat-card-dashboard-2"]',
    inProgress: '[data-testid="stat-card-dashboard-3"]',
    failed: '[data-testid="stat-card-dashboard-4"]',

    // Quick actions - data-testid as primary
    quickActions: '[data-testid="dashboard-quick-actions"], :has-text("Quick Actions")',
    uploadButton: '[data-testid="quick-action-upload"], button:has-text("Upload Document")',
    createTemplateButton:
      '[data-testid="quick-action-template"], button:has-text("Create Template")',
    browseLibraryButton: '[data-testid="quick-action-library"], button:has-text("Browse Library")',

    // Recent documents - data-testid as primary
    recentDocuments: '[data-testid="dashboard-recent-documents"], :has-text("Recent Documents")',
    recentDocsEmpty: '[data-testid="recent-documents-empty"]',
    recentDocsLoading: '[data-testid="recent-documents-loading"]',
    documentRow: '[data-testid^="document-row-"], [data-testid="document-row"], .document-row',
    documentName: '[data-testid="document-name"], .document-name',
    documentStatus: '[data-testid="document-status"], .document-status',

    // Processing queue - data-testid as primary
    processingQueue: '[data-testid="dashboard-processing-queue"], :has-text("Processing Queue")',
    queueLiveBadge: '[data-testid="queue-live-badge"]',
    queueActiveJobs: '[data-testid="queue-active-jobs"]',
    queueAvgTime: '[data-testid="queue-avg-time"]',
    queueSuccessRate: '[data-testid="queue-success-rate"]',
    queueItem: '[data-testid="queue-item"], .queue-item',

    // Navigation
    sidebar: '[data-testid="sidebar"], nav[aria-label="Sidebar"]',
    navLink: 'nav a, [role="navigation"] a',
  };

  constructor(page: Page) {
    super(page);
  }

  // ========== Element Locators ==========

  get pageTitle(): Locator {
    return this.page.locator(this.selectors.pageTitle).first();
  }

  get header(): Locator {
    return this.page.locator(this.selectors.header);
  }

  get refreshBtn(): Locator {
    return this.page.locator(this.selectors.refreshBtn);
  }

  get headerUploadBtn(): Locator {
    return this.page.locator(this.selectors.headerUploadBtn);
  }

  get statsGrid(): Locator {
    return this.page.locator(this.selectors.statsGrid).first();
  }

  get statCards(): Locator {
    return this.page.locator(this.selectors.statCard);
  }

  get recentDocumentsSection(): Locator {
    return this.page.locator(this.selectors.recentDocuments).first();
  }

  get recentDocsEmpty(): Locator {
    return this.page.locator(this.selectors.recentDocsEmpty);
  }

  get recentDocsLoading(): Locator {
    return this.page.locator(this.selectors.recentDocsLoading);
  }

  get processingQueueSection(): Locator {
    return this.page.locator(this.selectors.processingQueue).first();
  }

  get queueLiveBadge(): Locator {
    return this.page.locator(this.selectors.queueLiveBadge);
  }

  get queueActiveJobs(): Locator {
    return this.page.locator(this.selectors.queueActiveJobs);
  }

  get queueAvgTime(): Locator {
    return this.page.locator(this.selectors.queueAvgTime);
  }

  get queueSuccessRate(): Locator {
    return this.page.locator(this.selectors.queueSuccessRate);
  }

  get quickActionsSection(): Locator {
    return this.page.locator(this.selectors.quickActions).first();
  }

  get uploadButton(): Locator {
    return this.page.locator(this.selectors.uploadButton).first();
  }

  get createTemplateButton(): Locator {
    return this.page.locator(this.selectors.createTemplateButton).first();
  }

  get browseLibraryButton(): Locator {
    return this.page.locator(this.selectors.browseLibraryButton).first();
  }

  // ========== Navigation ==========

  /**
   * Navigate to dashboard
   */
  async navigate(): Promise<void> {
    await this.goto(this.path);
  }

  /**
   * Navigate to a section via sidebar
   */
  async navigateTo(
    section: 'documents' | 'templates' | 'upload' | 'settings' | 'history' | 'knowledge-base'
  ): Promise<void> {
    const sectionMap: Record<string, string> = {
      documents: 'Documents',
      templates: 'Templates',
      upload: 'Upload',
      settings: 'Settings',
      history: 'History',
      'knowledge-base': 'Knowledge',
    };

    const linkText = sectionMap[section] || section;
    await this.page
      .locator(this.selectors.navLink)
      .filter({ hasText: new RegExp(linkText, 'i') })
      .first()
      .click();
    await this.waitForPageLoad();
  }

  /**
   * Click upload document button
   */
  async clickUpload(): Promise<void> {
    await this.uploadButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Click create template button
   */
  async clickCreateTemplate(): Promise<void> {
    await this.createTemplateButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Click browse library button
   */
  async clickBrowseLibrary(): Promise<void> {
    await this.browseLibraryButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Click refresh button
   */
  async clickRefresh(): Promise<void> {
    await this.refreshBtn.click();
    await this.waitForPageLoad();
  }

  // ========== Stats Interactions ==========

  /**
   * Get stat card value by index
   */
  async getStatValue(index: number): Promise<string | null> {
    const card = this.statCards.nth(index);
    const value = card.locator('.text-2xl, .stat-value, h3');
    return await value.textContent();
  }

  /**
   * Get total documents count
   */
  async getTotalDocuments(): Promise<number> {
    const card = this.page.locator(this.selectors.totalDocuments);
    const value = await card.locator('.text-2xl, .stat-value, h3').textContent();
    return parseInt(value || '0', 10);
  }

  /**
   * Get processed today count
   */
  async getProcessedToday(): Promise<number> {
    const card = this.page.locator(this.selectors.processedToday);
    const value = await card.locator('.text-2xl, .stat-value, h3').textContent();
    return parseInt(value || '0', 10);
  }

  /**
   * Get in progress count
   */
  async getInProgressCount(): Promise<number> {
    const card = this.page.locator(this.selectors.inProgress);
    const value = await card.locator('.text-2xl, .stat-value, h3').textContent();
    return parseInt(value || '0', 10);
  }

  /**
   * Get failed count
   */
  async getFailedCount(): Promise<number> {
    const card = this.page.locator(this.selectors.failed);
    const value = await card.locator('.text-2xl, .stat-value, h3').textContent();
    return parseInt(value || '0', 10);
  }

  // ========== Recent Documents ==========

  /**
   * Get recent document names
   */
  async getRecentDocumentNames(): Promise<string[]> {
    const names: string[] = [];
    const rows = this.page.locator(this.selectors.documentRow);
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const name = await rows.nth(i).locator(this.selectors.documentName).textContent();
      if (name) names.push(name.trim());
    }

    return names;
  }

  /**
   * Click on a recent document by name
   */
  async clickDocument(name: string): Promise<void> {
    const row = this.page.locator(this.selectors.documentRow).filter({ hasText: name });
    await row.click();
    await this.waitForPageLoad();
  }

  /**
   * Get document status
   */
  async getDocumentStatus(name: string): Promise<string | null> {
    const row = this.page.locator(this.selectors.documentRow).filter({ hasText: name });
    const status = row.locator(this.selectors.documentStatus);
    return await status.textContent();
  }

  // ========== Processing Queue ==========

  /**
   * Get queue item count
   */
  async getQueueItemCount(): Promise<number> {
    const items = this.page.locator(this.selectors.queueItem);
    return await items.count();
  }

  /**
   * Check if queue is empty
   */
  async isQueueEmpty(): Promise<boolean> {
    const count = await this.getQueueItemCount();
    return count === 0;
  }

  // ========== Assertions ==========

  /**
   * Assert dashboard is loaded
   */
  async assertLoaded(): Promise<void> {
    await expect(this.pageTitle).toBeVisible();
    await expect(this.statsGrid).toBeVisible();
  }

  /**
   * Assert user is on dashboard
   */
  async assertOnDashboard(): Promise<void> {
    await this.assertUrlContains(this.path);
    await this.assertLoaded();
  }

  /**
   * Assert all stat cards are visible
   */
  async assertStatCardsVisible(): Promise<void> {
    const cards = this.statCards;
    await expect(cards).toHaveCount(4);

    for (let i = 0; i < 4; i++) {
      await expect(cards.nth(i)).toBeVisible();
    }
  }

  /**
   * Assert recent documents section is visible
   */
  async assertRecentDocumentsVisible(): Promise<void> {
    await expect(this.recentDocumentsSection).toBeVisible();
  }

  /**
   * Assert quick actions are visible
   */
  async assertQuickActionsVisible(): Promise<void> {
    await expect(this.quickActionsSection).toBeVisible();
    await expect(this.uploadButton).toBeVisible();
  }

  /**
   * Assert processing queue is visible
   */
  async assertProcessingQueueVisible(): Promise<void> {
    await expect(this.processingQueueSection).toBeVisible();
  }

  /**
   * Assert processing queue metrics are visible
   */
  async assertQueueMetricsVisible(): Promise<void> {
    await expect(this.queueActiveJobs).toBeVisible();
    await expect(this.queueAvgTime).toBeVisible();
    await expect(this.queueSuccessRate).toBeVisible();
  }

  /**
   * Assert header elements are visible
   */
  async assertHeaderVisible(): Promise<void> {
    await expect(this.header).toBeVisible();
    await expect(this.pageTitle).toBeVisible();
  }

  /**
   * Assert recent documents empty state
   */
  async assertRecentDocsEmpty(): Promise<void> {
    await expect(this.recentDocsEmpty).toBeVisible();
  }

  /**
   * Assert recent documents loading state
   */
  async assertRecentDocsLoading(): Promise<void> {
    await expect(this.recentDocsLoading).toBeVisible();
  }

  /**
   * Assert no horizontal overflow
   */
  async assertNoHorizontalOverflow(): Promise<void> {
    const bodyWidth = await this.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await this.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  }

  /**
   * Assert greeting message contains time of day
   */
  async assertGreetingMessage(): Promise<void> {
    const greeting = this.pageTitle;
    await expect(greeting).toBeVisible();
    const text = await greeting.textContent();
    expect(text).toMatch(/Good (morning|afternoon|evening)/i);
  }
}
