# IntelliFill E2E Test Plan

**Version:** 1.0.0
**Created:** 2025-12-12
**Last Updated:** 2025-12-12
**Author:** QA Architecture Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Test Environment & Infrastructure](#2-test-environment--infrastructure)
3. [Test Suites Structure](#3-test-suites-structure)
4. [Test Data Strategy](#4-test-data-strategy)
5. [Page Object Model Structure](#5-page-object-model-structure)
6. [Detailed Test Specifications](#6-detailed-test-specifications)
   - [6.1 Authentication Suite](#61-authentication-suite)
   - [6.2 Documents Suite](#62-documents-suite)
   - [6.3 Templates Suite](#63-templates-suite)
   - [6.4 Profiles Suite](#64-profiles-suite)
   - [6.5 Knowledge Base Suite](#65-knowledge-base-suite)
   - [6.6 Form Filling Suite](#66-form-filling-suite)
   - [6.7 Smoke Suite](#67-smoke-suite)
7. [CI/CD Integration](#7-cicd-integration)
8. [Reporting & Metrics](#8-reporting--metrics)
9. [Maintenance Guidelines](#9-maintenance-guidelines)

---

## 1. Executive Summary

### 1.1 Purpose

This document defines the comprehensive End-to-End (E2E) test strategy for the IntelliFill application. It covers all critical user flows from authentication through intelligent form filling, ensuring quality and reliability across the platform.

### 1.2 Scope

| Area | Covered |
|------|---------|
| User Authentication | Registration, Login, Logout, Password Reset, Session Management |
| Document Management | Upload, View, Delete, OCR Processing, Batch Operations |
| Template Management | Create, Edit, Delete, Field Mapping, Public Templates |
| User Profiles | Profile Data Management, Auto-Aggregation |
| Knowledge Base | Document Upload, Semantic Search, Vector Search, Form Suggestions |
| Form Filling | Auto-Fill, Manual Fill, Template-Based Fill, Export |
| Multi-Tenant | Organization Isolation, Company-Specific Workflows |

### 1.3 Technology Stack

- **Test Framework:** Cypress 13.x
- **Language:** TypeScript
- **Assertion Library:** Chai (built into Cypress)
- **Mocking:** Cypress Intercept API
- **Visual Testing:** Percy (optional)
- **Accessibility Testing:** cypress-axe
- **Reporting:** Mochawesome

### 1.4 Test Metrics Targets

| Metric | Target |
|--------|--------|
| Code Coverage (E2E) | 85% of critical paths |
| Test Pass Rate | >= 98% |
| Average Test Duration | < 30 seconds per test |
| Flaky Test Rate | < 2% |
| Critical Path Coverage | 100% |

---

## 2. Test Environment & Infrastructure

### 2.1 Environment Configuration

```
environments/
├── local/              # Local development testing
├── ci/                 # CI/CD pipeline testing
├── staging/            # Pre-production testing
└── production/         # Smoke tests only
```

### 2.2 Environment Variables

```env
# cypress.env.json (per environment)
{
  "apiUrl": "http://localhost:3002/api",
  "appUrl": "http://localhost:8080",
  "testUserEmail": "test@intellifill.com",
  "testUserPassword": "TestPass123!",
  "testCompanySlug": "test-company-2024",
  "adminUserEmail": "admin@intellifill.com",
  "adminUserPassword": "AdminPass123!",
  "dbResetEndpoint": "/api/test/reset"
}
```

### 2.3 Database Management

- **Before Suite:** Reset database to known state using seed data
- **Between Tests:** Cleanup via API endpoints (soft resets)
- **After Suite:** Full cleanup and report generation

---

## 3. Test Suites Structure

```
e2e/
├── tests/
│   ├── auth/
│   │   ├── login.spec.ts
│   │   ├── register.spec.ts
│   │   ├── logout.spec.ts
│   │   ├── password-reset.spec.ts
│   │   ├── session-management.spec.ts
│   │   └── multi-tenant-auth.spec.ts
│   │
│   ├── documents/
│   │   ├── upload.spec.ts
│   │   ├── view-documents.spec.ts
│   │   ├── delete-documents.spec.ts
│   │   ├── ocr-processing.spec.ts
│   │   ├── batch-upload.spec.ts
│   │   ├── document-history.spec.ts
│   │   └── export.spec.ts
│   │
│   ├── templates/
│   │   ├── create-template.spec.ts
│   │   ├── edit-template.spec.ts
│   │   ├── delete-template.spec.ts
│   │   ├── field-mapping.spec.ts
│   │   ├── public-templates.spec.ts
│   │   └── template-categories.spec.ts
│   │
│   ├── profiles/
│   │   ├── view-profile.spec.ts
│   │   ├── edit-profile.spec.ts
│   │   ├── profile-aggregation.spec.ts
│   │   ├── profile-refresh.spec.ts
│   │   └── field-management.spec.ts
│   │
│   ├── knowledge-base/
│   │   ├── upload-source.spec.ts
│   │   ├── semantic-search.spec.ts
│   │   ├── hybrid-search.spec.ts
│   │   ├── form-suggestions.spec.ts
│   │   ├── contextual-suggestions.spec.ts
│   │   └── knowledge-stats.spec.ts
│   │
│   ├── form-filling/
│   │   ├── auto-fill.spec.ts
│   │   ├── manual-fill.spec.ts
│   │   ├── template-fill.spec.ts
│   │   ├── fill-history.spec.ts
│   │   ├── export-filled-form.spec.ts
│   │   └── fill-validation.spec.ts
│   │
│   └── smoke/
│       ├── health-check.spec.ts
│       ├── critical-paths.spec.ts
│       ├── responsiveness.spec.ts
│       └── accessibility.spec.ts
│
├── pages/
│   ├── LoginPage.ts
│   ├── RegisterPage.ts
│   ├── DashboardPage.ts
│   ├── DocumentsPage.ts
│   ├── UploadPage.ts
│   ├── TemplatesPage.ts
│   ├── ProfilePage.ts
│   ├── KnowledgeBasePage.ts
│   ├── FormFillerPage.ts
│   ├── SettingsPage.ts
│   └── components/
│       ├── NavBar.ts
│       ├── FileUploader.ts
│       ├── SearchBar.ts
│       ├── DataTable.ts
│       ├── Modal.ts
│       ├── Toast.ts
│       └── FormFields.ts
│
├── fixtures/
│   ├── users.json
│   ├── documents.json
│   ├── templates.json
│   ├── api-responses.json
│   ├── test-scenarios.json
│   └── files/
│       ├── sample.pdf
│       ├── invoice.pdf
│       ├── passport-scan.pdf
│       ├── trade-license.pdf
│       ├── sample.docx
│       ├── corrupted.pdf
│       └── large-file.pdf
│
├── support/
│   ├── commands.ts
│   ├── e2e.ts
│   └── types.d.ts
│
└── cypress.config.ts
```

---

## 4. Test Data Strategy

### 4.1 Seed Data Requirements

#### 4.1.1 Test Users

```json
{
  "users": {
    "standardUser": {
      "id": "user-std-001",
      "email": "standard@intellifill-test.com",
      "password": "StandardPass123!",
      "firstName": "Standard",
      "lastName": "User",
      "role": "USER",
      "organizationId": "org-test-001"
    },
    "adminUser": {
      "id": "user-admin-001",
      "email": "admin@intellifill-test.com",
      "password": "AdminPass123!",
      "firstName": "Admin",
      "lastName": "User",
      "role": "ADMIN",
      "organizationId": "org-test-001"
    },
    "viewerUser": {
      "id": "user-viewer-001",
      "email": "viewer@intellifill-test.com",
      "password": "ViewerPass123!",
      "firstName": "Viewer",
      "lastName": "User",
      "role": "VIEWER",
      "organizationId": "org-test-001"
    },
    "newUser": {
      "email": "newuser@intellifill-test.com",
      "password": "NewUserPass123!",
      "firstName": "New",
      "lastName": "User"
    },
    "otherOrgUser": {
      "id": "user-other-001",
      "email": "other@intellifill-test.com",
      "password": "OtherPass123!",
      "firstName": "Other",
      "lastName": "Org",
      "role": "USER",
      "organizationId": "org-test-002"
    }
  }
}
```

#### 4.1.2 Test Organizations

```json
{
  "organizations": {
    "primaryOrg": {
      "id": "org-test-001",
      "name": "Test Company Inc",
      "status": "ACTIVE"
    },
    "secondaryOrg": {
      "id": "org-test-002",
      "name": "Other Company LLC",
      "status": "ACTIVE"
    },
    "suspendedOrg": {
      "id": "org-test-003",
      "name": "Suspended Corp",
      "status": "SUSPENDED"
    }
  }
}
```

#### 4.1.3 Test Documents

```json
{
  "documents": {
    "processedPdf": {
      "id": "doc-001",
      "fileName": "processed-invoice.pdf",
      "status": "COMPLETED",
      "extractedData": {
        "companyName": "ABC Corporation",
        "invoiceNumber": "INV-2024-001",
        "date": "2024-01-15",
        "totalAmount": "$5,000.00"
      }
    },
    "pendingDocument": {
      "id": "doc-002",
      "fileName": "pending-form.pdf",
      "status": "PENDING"
    },
    "failedDocument": {
      "id": "doc-003",
      "fileName": "corrupted.pdf",
      "status": "FAILED",
      "errorMessage": "Unable to extract text from document"
    }
  }
}
```

#### 4.1.4 Test Templates

```json
{
  "templates": {
    "visaTemplate": {
      "id": "tmpl-001",
      "name": "UAE Visa Application",
      "category": "VISA",
      "fieldMappings": {
        "fullName": "full_name",
        "passportNumber": "passport_no",
        "dateOfBirth": "dob",
        "nationality": "nationality"
      }
    },
    "companyTemplate": {
      "id": "tmpl-002",
      "name": "Company Formation",
      "category": "COMPANY_FORMATION",
      "isPublic": true
    }
  }
}
```

### 4.2 Test File Repository

| File Name | Type | Size | Purpose |
|-----------|------|------|---------|
| sample.pdf | PDF | 150KB | Standard upload testing |
| invoice.pdf | PDF | 250KB | Invoice extraction testing |
| passport-scan.pdf | PDF | 500KB | ID document OCR testing |
| trade-license.pdf | PDF | 1MB | Business document testing |
| sample.docx | DOCX | 100KB | Word document support |
| corrupted.pdf | PDF | 50KB | Error handling testing |
| large-file.pdf | PDF | 15MB | Size limit testing |
| scanned-doc.pdf | PDF | 2MB | OCR fallback testing |

---

## 5. Page Object Model Structure

### 5.1 Base Page Class

```typescript
// pages/BasePage.ts
export abstract class BasePage {
  abstract readonly pageUrl: string;
  abstract readonly pageTitle: string;

  visit(): Cypress.Chainable {
    return cy.visit(this.pageUrl);
  }

  waitForPageLoad(): void {
    cy.get('[data-cy="page-loaded"]', { timeout: 10000 }).should('exist');
    cy.get('[data-cy="loading-spinner"]').should('not.exist');
  }

  getTitle(): Cypress.Chainable<string> {
    return cy.title();
  }

  verifyUrl(expectedUrl: string): void {
    cy.url().should('include', expectedUrl);
  }
}
```

### 5.2 LoginPage

```typescript
// pages/LoginPage.ts
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  readonly pageUrl = '/login';
  readonly pageTitle = 'Login - IntelliFill';

  // Selectors
  private selectors = {
    emailInput: '[data-cy="email-input"]',
    passwordInput: '[data-cy="password-input"]',
    companyInput: '[data-cy="company-input"]',
    loginButton: '[data-cy="login-button"]',
    errorMessage: '[data-cy="error-message"]',
    forgotPasswordLink: '[data-cy="forgot-password-link"]',
    registerLink: '[data-cy="register-link"]',
    rememberMeCheckbox: '[data-cy="remember-me"]'
  };

  // Actions
  enterEmail(email: string): this {
    cy.get(this.selectors.emailInput).clear().type(email);
    return this;
  }

  enterPassword(password: string): this {
    cy.get(this.selectors.passwordInput).clear().type(password);
    return this;
  }

  enterCompany(company: string): this {
    cy.get(this.selectors.companyInput).clear().type(company);
    return this;
  }

  clickLogin(): void {
    cy.get(this.selectors.loginButton).click();
  }

  login(email: string, password: string, company?: string): void {
    this.enterEmail(email).enterPassword(password);
    if (company) {
      this.enterCompany(company);
    }
    this.clickLogin();
  }

  checkRememberMe(): this {
    cy.get(this.selectors.rememberMeCheckbox).check();
    return this;
  }

  clickForgotPassword(): void {
    cy.get(this.selectors.forgotPasswordLink).click();
  }

  clickRegister(): void {
    cy.get(this.selectors.registerLink).click();
  }

  // Assertions
  verifyErrorMessage(message: string): void {
    cy.get(this.selectors.errorMessage)
      .should('be.visible')
      .and('contain', message);
  }

  verifyLoginButtonEnabled(enabled: boolean): void {
    if (enabled) {
      cy.get(this.selectors.loginButton).should('be.enabled');
    } else {
      cy.get(this.selectors.loginButton).should('be.disabled');
    }
  }

  verifyFormPresent(): void {
    cy.get(this.selectors.emailInput).should('be.visible');
    cy.get(this.selectors.passwordInput).should('be.visible');
    cy.get(this.selectors.loginButton).should('be.visible');
  }
}
```

### 5.3 RegisterPage

```typescript
// pages/RegisterPage.ts
import { BasePage } from './BasePage';

export class RegisterPage extends BasePage {
  readonly pageUrl = '/register';
  readonly pageTitle = 'Register - IntelliFill';

  private selectors = {
    firstNameInput: '[data-cy="first-name-input"]',
    lastNameInput: '[data-cy="last-name-input"]',
    emailInput: '[data-cy="email-input"]',
    passwordInput: '[data-cy="password-input"]',
    confirmPasswordInput: '[data-cy="confirm-password-input"]',
    companyNameInput: '[data-cy="company-name-input"]',
    termsCheckbox: '[data-cy="terms-checkbox"]',
    registerButton: '[data-cy="register-button"]',
    errorMessage: '[data-cy="error-message"]',
    successMessage: '[data-cy="success-message"]',
    loginLink: '[data-cy="login-link"]',
    passwordStrengthIndicator: '[data-cy="password-strength"]'
  };

  fillRegistrationForm(userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword: string;
    companyName?: string;
  }): this {
    cy.get(this.selectors.firstNameInput).clear().type(userData.firstName);
    cy.get(this.selectors.lastNameInput).clear().type(userData.lastName);
    cy.get(this.selectors.emailInput).clear().type(userData.email);
    cy.get(this.selectors.passwordInput).clear().type(userData.password);
    cy.get(this.selectors.confirmPasswordInput).clear().type(userData.confirmPassword);
    if (userData.companyName) {
      cy.get(this.selectors.companyNameInput).clear().type(userData.companyName);
    }
    return this;
  }

  acceptTerms(): this {
    cy.get(this.selectors.termsCheckbox).check();
    return this;
  }

  clickRegister(): void {
    cy.get(this.selectors.registerButton).click();
  }

  verifyPasswordStrength(strength: 'weak' | 'medium' | 'strong'): void {
    cy.get(this.selectors.passwordStrengthIndicator)
      .should('have.attr', 'data-strength', strength);
  }

  verifySuccessMessage(): void {
    cy.get(this.selectors.successMessage).should('be.visible');
  }

  verifyErrorMessage(message: string): void {
    cy.get(this.selectors.errorMessage)
      .should('be.visible')
      .and('contain', message);
  }
}
```

### 5.4 DashboardPage

```typescript
// pages/DashboardPage.ts
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  readonly pageUrl = '/dashboard';
  readonly pageTitle = 'Dashboard - IntelliFill';

  private selectors = {
    welcomeMessage: '[data-cy="welcome-message"]',
    statsProcessed: '[data-cy="stats-processed"]',
    statsSuccessRate: '[data-cy="stats-success-rate"]',
    statsAvgTime: '[data-cy="stats-avg-time"]',
    recentUploads: '[data-cy="recent-uploads"]',
    uploadItem: '[data-cy="upload-item"]',
    quickUploadButton: '[data-cy="quick-upload-button"]',
    navigationMenu: '[data-cy="navigation-menu"]',
    userProfile: '[data-cy="user-profile"]',
    navUpload: '[data-cy="nav-upload"]',
    navDocuments: '[data-cy="nav-documents"]',
    navTemplates: '[data-cy="nav-templates"]',
    navKnowledge: '[data-cy="nav-knowledge"]',
    navSettings: '[data-cy="nav-settings"]'
  };

  verifyWelcomeMessage(userName: string): void {
    cy.get(this.selectors.welcomeMessage)
      .should('be.visible')
      .and('contain', userName);
  }

  verifyStatisticsDisplayed(): void {
    cy.get(this.selectors.statsProcessed).should('be.visible');
    cy.get(this.selectors.statsSuccessRate).should('be.visible');
    cy.get(this.selectors.statsAvgTime).should('be.visible');
  }

  getRecentUploadsCount(): Cypress.Chainable<number> {
    return cy.get(this.selectors.uploadItem).then($items => $items.length);
  }

  clickQuickUpload(): void {
    cy.get(this.selectors.quickUploadButton).click();
  }

  navigateToUpload(): void {
    cy.get(this.selectors.navUpload).click();
  }

  navigateToDocuments(): void {
    cy.get(this.selectors.navDocuments).click();
  }

  navigateToTemplates(): void {
    cy.get(this.selectors.navTemplates).click();
  }

  navigateToKnowledge(): void {
    cy.get(this.selectors.navKnowledge).click();
  }

  navigateToSettings(): void {
    cy.get(this.selectors.navSettings).click();
  }
}
```

### 5.5 DocumentsPage

```typescript
// pages/DocumentsPage.ts
import { BasePage } from './BasePage';

export class DocumentsPage extends BasePage {
  readonly pageUrl = '/documents';
  readonly pageTitle = 'Documents - IntelliFill';

  private selectors = {
    documentTable: '[data-cy="document-table"]',
    documentRow: '[data-cy="document-row"]',
    searchInput: '[data-cy="document-search"]',
    statusFilter: '[data-cy="status-filter"]',
    categoryFilter: '[data-cy="category-filter"]',
    sortDropdown: '[data-cy="sort-dropdown"]',
    viewButton: '[data-cy="view-button"]',
    deleteButton: '[data-cy="delete-button"]',
    processButton: '[data-cy="process-button"]',
    downloadButton: '[data-cy="download-button"]',
    pagination: '[data-cy="pagination"]',
    emptyState: '[data-cy="empty-state"]',
    bulkSelectCheckbox: '[data-cy="bulk-select"]',
    bulkActionsMenu: '[data-cy="bulk-actions"]'
  };

  searchDocuments(query: string): this {
    cy.get(this.selectors.searchInput).clear().type(query);
    return this;
  }

  filterByStatus(status: string): this {
    cy.get(this.selectors.statusFilter).select(status);
    return this;
  }

  filterByCategory(category: string): this {
    cy.get(this.selectors.categoryFilter).select(category);
    return this;
  }

  sortBy(option: string): this {
    cy.get(this.selectors.sortDropdown).select(option);
    return this;
  }

  viewDocument(index: number): void {
    cy.get(this.selectors.documentRow)
      .eq(index)
      .find(this.selectors.viewButton)
      .click();
  }

  deleteDocument(index: number): void {
    cy.get(this.selectors.documentRow)
      .eq(index)
      .find(this.selectors.deleteButton)
      .click();
  }

  processDocument(index: number): void {
    cy.get(this.selectors.documentRow)
      .eq(index)
      .find(this.selectors.processButton)
      .click();
  }

  getDocumentCount(): Cypress.Chainable<number> {
    return cy.get(this.selectors.documentRow).then($rows => $rows.length);
  }

  verifyEmptyState(): void {
    cy.get(this.selectors.emptyState).should('be.visible');
  }

  selectDocument(index: number): this {
    cy.get(this.selectors.documentRow)
      .eq(index)
      .find(this.selectors.bulkSelectCheckbox)
      .check();
    return this;
  }

  performBulkAction(action: string): void {
    cy.get(this.selectors.bulkActionsMenu).click();
    cy.contains(action).click();
  }
}
```

### 5.6 UploadPage

```typescript
// pages/UploadPage.ts
import { BasePage } from './BasePage';

export class UploadPage extends BasePage {
  readonly pageUrl = '/upload';
  readonly pageTitle = 'Upload - IntelliFill';

  private selectors = {
    dropZone: '[data-cy="drop-zone"]',
    fileInput: '[data-cy="file-input"]',
    uploadButton: '[data-cy="upload-button"]',
    processButton: '[data-cy="process-button"]',
    uploadProgress: '[data-cy="upload-progress"]',
    processingStatus: '[data-cy="processing-status"]',
    extractedFields: '[data-cy="extracted-fields"]',
    filePreview: '[data-cy="file-preview"]',
    fileName: '[data-cy="file-name"]',
    fileSize: '[data-cy="file-size"]',
    removeFile: '[data-cy="remove-file"]',
    errorMessage: '[data-cy="error-message"]',
    successMessage: '[data-cy="success-message"]',
    categorySelect: '[data-cy="category-select"]',
    clientSelect: '[data-cy="client-select"]'
  };

  uploadFile(filePath: string, options?: { force?: boolean }): void {
    cy.get(this.selectors.fileInput).selectFile(filePath, {
      force: options?.force ?? true
    });
  }

  uploadMultipleFiles(filePaths: string[]): void {
    cy.get(this.selectors.fileInput).selectFile(filePaths, { force: true });
  }

  clickUpload(): void {
    cy.get(this.selectors.uploadButton).click();
  }

  clickProcess(): void {
    cy.get(this.selectors.processButton).click();
  }

  selectCategory(category: string): this {
    cy.get(this.selectors.categorySelect).select(category);
    return this;
  }

  selectClient(clientId: string): this {
    cy.get(this.selectors.clientSelect).select(clientId);
    return this;
  }

  verifyUploadProgress(): void {
    cy.get(this.selectors.uploadProgress).should('be.visible');
  }

  verifyProcessingStatus(status: string): void {
    cy.get(this.selectors.processingStatus)
      .should('be.visible')
      .and('contain', status);
  }

  verifyExtractedFields(): void {
    cy.get(this.selectors.extractedFields).should('be.visible');
  }

  verifyFileName(name: string): void {
    cy.get(this.selectors.fileName)
      .should('be.visible')
      .and('contain', name);
  }

  removeFile(): void {
    cy.get(this.selectors.removeFile).click();
  }

  verifyErrorMessage(message: string): void {
    cy.get(this.selectors.errorMessage)
      .should('be.visible')
      .and('contain', message);
  }

  verifySuccessMessage(): void {
    cy.get(this.selectors.successMessage).should('be.visible');
  }

  waitForProcessingComplete(timeout: number = 60000): void {
    cy.get(this.selectors.processingStatus, { timeout })
      .should('contain', 'complete');
  }
}
```

### 5.7 TemplatesPage

```typescript
// pages/TemplatesPage.ts
import { BasePage } from './BasePage';

export class TemplatesPage extends BasePage {
  readonly pageUrl = '/templates';
  readonly pageTitle = 'Templates - IntelliFill';

  private selectors = {
    templateList: '[data-cy="template-list"]',
    templateCard: '[data-cy="template-card"]',
    createButton: '[data-cy="create-template"]',
    searchInput: '[data-cy="template-search"]',
    categoryFilter: '[data-cy="category-filter"]',
    publicToggle: '[data-cy="public-toggle"]',
    editButton: '[data-cy="edit-template"]',
    deleteButton: '[data-cy="delete-template"]',
    useButton: '[data-cy="use-template"]',
    templateName: '[data-cy="template-name"]',
    templateDescription: '[data-cy="template-description"]',
    fieldMappingSection: '[data-cy="field-mapping"]',
    addFieldButton: '[data-cy="add-field"]',
    saveButton: '[data-cy="save-template"]',
    cancelButton: '[data-cy="cancel-button"]',
    emptyState: '[data-cy="empty-state"]'
  };

  clickCreateTemplate(): void {
    cy.get(this.selectors.createButton).click();
  }

  searchTemplates(query: string): this {
    cy.get(this.selectors.searchInput).clear().type(query);
    return this;
  }

  filterByCategory(category: string): this {
    cy.get(this.selectors.categoryFilter).select(category);
    return this;
  }

  togglePublicOnly(show: boolean): this {
    const toggle = cy.get(this.selectors.publicToggle);
    if (show) {
      toggle.check();
    } else {
      toggle.uncheck();
    }
    return this;
  }

  editTemplate(index: number): void {
    cy.get(this.selectors.templateCard)
      .eq(index)
      .find(this.selectors.editButton)
      .click();
  }

  deleteTemplate(index: number): void {
    cy.get(this.selectors.templateCard)
      .eq(index)
      .find(this.selectors.deleteButton)
      .click();
  }

  useTemplate(index: number): void {
    cy.get(this.selectors.templateCard)
      .eq(index)
      .find(this.selectors.useButton)
      .click();
  }

  fillTemplateDetails(name: string, description: string): this {
    cy.get(this.selectors.templateName).clear().type(name);
    cy.get(this.selectors.templateDescription).clear().type(description);
    return this;
  }

  addFieldMapping(sourceField: string, targetField: string): this {
    cy.get(this.selectors.addFieldButton).click();
    cy.get('[data-cy="source-field"]:last').type(sourceField);
    cy.get('[data-cy="target-field"]:last').type(targetField);
    return this;
  }

  saveTemplate(): void {
    cy.get(this.selectors.saveButton).click();
  }

  verifyTemplateCount(count: number): void {
    cy.get(this.selectors.templateCard).should('have.length', count);
  }
}
```

### 5.8 ProfilePage

```typescript
// pages/ProfilePage.ts
import { BasePage } from './BasePage';

export class ProfilePage extends BasePage {
  readonly pageUrl = '/profile';
  readonly pageTitle = 'Profile - IntelliFill';

  private selectors = {
    profileContainer: '[data-cy="profile-container"]',
    fieldCard: '[data-cy="field-card"]',
    fieldKey: '[data-cy="field-key"]',
    fieldValue: '[data-cy="field-value"]',
    fieldConfidence: '[data-cy="field-confidence"]',
    editFieldButton: '[data-cy="edit-field"]',
    addFieldButton: '[data-cy="add-field"]',
    refreshButton: '[data-cy="refresh-profile"]',
    deleteProfileButton: '[data-cy="delete-profile"]',
    saveButton: '[data-cy="save-changes"]',
    lastAggregated: '[data-cy="last-aggregated"]',
    documentCount: '[data-cy="document-count"]',
    searchField: '[data-cy="search-field"]',
    emptyState: '[data-cy="empty-profile"]'
  };

  getFieldCount(): Cypress.Chainable<number> {
    return cy.get(this.selectors.fieldCard).then($cards => $cards.length);
  }

  searchFields(query: string): this {
    cy.get(this.selectors.searchField).clear().type(query);
    return this;
  }

  editField(fieldKey: string): void {
    cy.get(this.selectors.fieldCard)
      .contains(fieldKey)
      .parents(this.selectors.fieldCard)
      .find(this.selectors.editFieldButton)
      .click();
  }

  addNewField(key: string, value: string): this {
    cy.get(this.selectors.addFieldButton).click();
    cy.get('[data-cy="new-field-key"]').type(key);
    cy.get('[data-cy="new-field-value"]').type(value);
    return this;
  }

  refreshProfile(): void {
    cy.get(this.selectors.refreshButton).click();
  }

  deleteProfile(): void {
    cy.get(this.selectors.deleteProfileButton).click();
    cy.get('[data-cy="confirm-delete"]').click();
  }

  saveChanges(): void {
    cy.get(this.selectors.saveButton).click();
  }

  verifyFieldValue(key: string, expectedValue: string): void {
    cy.get(this.selectors.fieldCard)
      .contains(key)
      .parents(this.selectors.fieldCard)
      .find(this.selectors.fieldValue)
      .should('contain', expectedValue);
  }

  verifyFieldConfidence(key: string, minConfidence: number): void {
    cy.get(this.selectors.fieldCard)
      .contains(key)
      .parents(this.selectors.fieldCard)
      .find(this.selectors.fieldConfidence)
      .invoke('text')
      .then(text => {
        const confidence = parseFloat(text);
        expect(confidence).to.be.gte(minConfidence);
      });
  }

  verifyLastAggregated(): void {
    cy.get(this.selectors.lastAggregated).should('be.visible');
  }

  verifyDocumentCount(count: number): void {
    cy.get(this.selectors.documentCount).should('contain', count);
  }
}
```

### 5.9 KnowledgeBasePage

```typescript
// pages/KnowledgeBasePage.ts
import { BasePage } from './BasePage';

export class KnowledgeBasePage extends BasePage {
  readonly pageUrl = '/knowledge';
  readonly pageTitle = 'Knowledge Base - IntelliFill';

  private selectors = {
    searchInput: '[data-cy="search-input"]',
    searchButton: '[data-cy="search-button"]',
    searchResults: '[data-cy="search-results"]',
    resultItem: '[data-cy="result-item"]',
    uploadSourceButton: '[data-cy="upload-source"]',
    sourceList: '[data-cy="source-list"]',
    sourceCard: '[data-cy="source-card"]',
    sourceStatus: '[data-cy="source-status"]',
    deleteSourceButton: '[data-cy="delete-source"]',
    searchModeToggle: '[data-cy="search-mode"]',
    statsPanel: '[data-cy="stats-panel"]',
    totalSources: '[data-cy="total-sources"]',
    totalChunks: '[data-cy="total-chunks"]',
    searchTime: '[data-cy="search-time"]',
    relevanceScore: '[data-cy="relevance-score"]',
    sourceFilter: '[data-cy="source-filter"]',
    emptyState: '[data-cy="empty-knowledge"]'
  };

  searchKnowledge(query: string): void {
    cy.get(this.selectors.searchInput).clear().type(query);
    cy.get(this.selectors.searchButton).click();
  }

  setSearchMode(mode: 'semantic' | 'hybrid' | 'keyword'): this {
    cy.get(this.selectors.searchModeToggle).select(mode);
    return this;
  }

  uploadSource(): void {
    cy.get(this.selectors.uploadSourceButton).click();
  }

  deleteSource(index: number): void {
    cy.get(this.selectors.sourceCard)
      .eq(index)
      .find(this.selectors.deleteSourceButton)
      .click();
    cy.get('[data-cy="confirm-delete"]').click();
  }

  filterBySource(sourceId: string): this {
    cy.get(this.selectors.sourceFilter).select(sourceId);
    return this;
  }

  getSearchResultCount(): Cypress.Chainable<number> {
    return cy.get(this.selectors.resultItem).then($items => $items.length);
  }

  verifySearchTime(): void {
    cy.get(this.selectors.searchTime).should('be.visible');
  }

  verifyRelevanceScores(): void {
    cy.get(this.selectors.relevanceScore).each($score => {
      const score = parseFloat($score.text());
      expect(score).to.be.gte(0).and.to.be.lte(1);
    });
  }

  verifyStats(): void {
    cy.get(this.selectors.totalSources).should('be.visible');
    cy.get(this.selectors.totalChunks).should('be.visible');
  }

  verifySourceStatus(index: number, status: string): void {
    cy.get(this.selectors.sourceCard)
      .eq(index)
      .find(this.selectors.sourceStatus)
      .should('contain', status);
  }
}
```

### 5.10 FormFillerPage

```typescript
// pages/FormFillerPage.ts
import { BasePage } from './BasePage';

export class FormFillerPage extends BasePage {
  readonly pageUrl = '/fill';
  readonly pageTitle = 'Form Filler - IntelliFill';

  private selectors = {
    templateSelect: '[data-cy="template-select"]',
    clientSelect: '[data-cy="client-select"]',
    formField: '[data-cy="form-field"]',
    autoFillButton: '[data-cy="auto-fill"]',
    clearButton: '[data-cy="clear-form"]',
    submitButton: '[data-cy="submit-form"]',
    previewButton: '[data-cy="preview-form"]',
    downloadButton: '[data-cy="download-form"]',
    suggestionList: '[data-cy="suggestion-list"]',
    suggestionItem: '[data-cy="suggestion-item"]',
    fieldConfidence: '[data-cy="field-confidence"]',
    validationError: '[data-cy="validation-error"]',
    formPreview: '[data-cy="form-preview"]',
    successMessage: '[data-cy="success-message"]',
    historyButton: '[data-cy="fill-history"]'
  };

  selectTemplate(templateId: string): this {
    cy.get(this.selectors.templateSelect).select(templateId);
    return this;
  }

  selectClient(clientId: string): this {
    cy.get(this.selectors.clientSelect).select(clientId);
    return this;
  }

  fillField(fieldName: string, value: string): this {
    cy.get(`[data-cy="field-${fieldName}"]`).clear().type(value);
    return this;
  }

  autoFillForm(): void {
    cy.get(this.selectors.autoFillButton).click();
  }

  clearForm(): void {
    cy.get(this.selectors.clearButton).click();
  }

  submitForm(): void {
    cy.get(this.selectors.submitButton).click();
  }

  previewForm(): void {
    cy.get(this.selectors.previewButton).click();
  }

  downloadFilledForm(): void {
    cy.get(this.selectors.downloadButton).click();
  }

  selectSuggestion(fieldName: string, index: number): void {
    cy.get(`[data-cy="field-${fieldName}"]`).focus();
    cy.get(this.selectors.suggestionItem).eq(index).click();
  }

  verifyFieldValue(fieldName: string, expectedValue: string): void {
    cy.get(`[data-cy="field-${fieldName}"]`).should('have.value', expectedValue);
  }

  verifyFieldConfidence(fieldName: string): void {
    cy.get(`[data-cy="field-${fieldName}"]`)
      .parents(this.selectors.formField)
      .find(this.selectors.fieldConfidence)
      .should('be.visible');
  }

  verifySuggestionsShown(fieldName: string): void {
    cy.get(`[data-cy="field-${fieldName}"]`).focus();
    cy.get(this.selectors.suggestionList).should('be.visible');
  }

  verifyValidationError(fieldName: string, message: string): void {
    cy.get(`[data-cy="field-${fieldName}"]`)
      .parents(this.selectors.formField)
      .find(this.selectors.validationError)
      .should('contain', message);
  }

  verifyFormPreview(): void {
    cy.get(this.selectors.formPreview).should('be.visible');
  }

  verifySuccessMessage(): void {
    cy.get(this.selectors.successMessage).should('be.visible');
  }

  viewFillHistory(): void {
    cy.get(this.selectors.historyButton).click();
  }
}
```

### 5.11 Component Page Objects

```typescript
// pages/components/NavBar.ts
export class NavBar {
  private selectors = {
    logo: '[data-cy="logo"]',
    userMenu: '[data-cy="user-menu"]',
    logoutButton: '[data-cy="logout-button"]',
    settingsButton: '[data-cy="settings-button"]',
    notificationBell: '[data-cy="notification-bell"]',
    mobileMenuToggle: '[data-cy="mobile-menu-toggle"]',
    navItems: '[data-cy="nav-item"]'
  };

  openUserMenu(): void {
    cy.get(this.selectors.userMenu).click();
  }

  logout(): void {
    this.openUserMenu();
    cy.get(this.selectors.logoutButton).click();
  }

  goToSettings(): void {
    this.openUserMenu();
    cy.get(this.selectors.settingsButton).click();
  }

  toggleMobileMenu(): void {
    cy.get(this.selectors.mobileMenuToggle).click();
  }

  clickLogo(): void {
    cy.get(this.selectors.logo).click();
  }

  verifyNotificationCount(count: number): void {
    cy.get(this.selectors.notificationBell)
      .find('[data-cy="notification-count"]')
      .should('contain', count);
  }
}

// pages/components/FileUploader.ts
export class FileUploader {
  private selectors = {
    dropZone: '[data-cy="drop-zone"]',
    fileInput: '[data-cy="file-input"]',
    fileList: '[data-cy="file-list"]',
    fileItem: '[data-cy="file-item"]',
    removeFileButton: '[data-cy="remove-file"]',
    progressBar: '[data-cy="upload-progress"]'
  };

  uploadFile(filePath: string): void {
    cy.get(this.selectors.fileInput).selectFile(filePath, { force: true });
  }

  uploadMultipleFiles(filePaths: string[]): void {
    cy.get(this.selectors.fileInput).selectFile(filePaths, { force: true });
  }

  dragAndDropFile(filePath: string): void {
    cy.get(this.selectors.dropZone).selectFile(filePath, {
      action: 'drag-drop'
    });
  }

  removeFile(index: number): void {
    cy.get(this.selectors.fileItem)
      .eq(index)
      .find(this.selectors.removeFileButton)
      .click();
  }

  verifyFileInList(fileName: string): void {
    cy.get(this.selectors.fileList).should('contain', fileName);
  }

  verifyUploadProgress(): void {
    cy.get(this.selectors.progressBar).should('be.visible');
  }
}

// pages/components/SearchBar.ts
export class SearchBar {
  private selectors = {
    searchInput: '[data-cy="search-input"]',
    searchButton: '[data-cy="search-button"]',
    clearButton: '[data-cy="clear-search"]',
    suggestions: '[data-cy="search-suggestions"]',
    suggestionItem: '[data-cy="suggestion-item"]'
  };

  search(query: string): void {
    cy.get(this.selectors.searchInput).clear().type(query);
    cy.get(this.selectors.searchButton).click();
  }

  clearSearch(): void {
    cy.get(this.selectors.clearButton).click();
  }

  selectSuggestion(index: number): void {
    cy.get(this.selectors.suggestionItem).eq(index).click();
  }

  verifySuggestionsShown(): void {
    cy.get(this.selectors.suggestions).should('be.visible');
  }
}

// pages/components/Modal.ts
export class Modal {
  private selectors = {
    modal: '[data-cy="modal"]',
    modalTitle: '[data-cy="modal-title"]',
    modalBody: '[data-cy="modal-body"]',
    closeButton: '[data-cy="modal-close"]',
    confirmButton: '[data-cy="modal-confirm"]',
    cancelButton: '[data-cy="modal-cancel"]'
  };

  verifyOpen(): void {
    cy.get(this.selectors.modal).should('be.visible');
  }

  verifyClosed(): void {
    cy.get(this.selectors.modal).should('not.exist');
  }

  verifyTitle(title: string): void {
    cy.get(this.selectors.modalTitle).should('contain', title);
  }

  close(): void {
    cy.get(this.selectors.closeButton).click();
  }

  confirm(): void {
    cy.get(this.selectors.confirmButton).click();
  }

  cancel(): void {
    cy.get(this.selectors.cancelButton).click();
  }
}

// pages/components/Toast.ts
export class Toast {
  private selectors = {
    toast: '[data-cy="toast"]',
    toastSuccess: '[data-cy="toast-success"]',
    toastError: '[data-cy="toast-error"]',
    toastWarning: '[data-cy="toast-warning"]',
    toastInfo: '[data-cy="toast-info"]',
    closeButton: '[data-cy="toast-close"]'
  };

  verifySuccess(message?: string): void {
    cy.get(this.selectors.toastSuccess).should('be.visible');
    if (message) {
      cy.get(this.selectors.toastSuccess).should('contain', message);
    }
  }

  verifyError(message?: string): void {
    cy.get(this.selectors.toastError).should('be.visible');
    if (message) {
      cy.get(this.selectors.toastError).should('contain', message);
    }
  }

  verifyWarning(message?: string): void {
    cy.get(this.selectors.toastWarning).should('be.visible');
    if (message) {
      cy.get(this.selectors.toastWarning).should('contain', message);
    }
  }

  dismiss(): void {
    cy.get(this.selectors.closeButton).click();
  }
}
```

---

## 6. Detailed Test Specifications

### 6.1 Authentication Suite

#### 6.1.1 Login Tests (`auth/login.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| AUTH-001 | Login with valid credentials | P0 | User exists in database | 1. Navigate to /login<br>2. Enter valid email<br>3. Enter valid password<br>4. Click Login | User redirected to /dashboard, auth token stored |
| AUTH-002 | Login with invalid email | P0 | None | 1. Navigate to /login<br>2. Enter non-existent email<br>3. Enter any password<br>4. Click Login | Error message "Invalid credentials" displayed |
| AUTH-003 | Login with invalid password | P0 | User exists | 1. Navigate to /login<br>2. Enter valid email<br>3. Enter wrong password<br>4. Click Login | Error message "Invalid credentials" displayed |
| AUTH-004 | Login with empty fields | P1 | None | 1. Navigate to /login<br>2. Click Login without entering data | Validation errors for required fields |
| AUTH-005 | Login with malformed email | P1 | None | 1. Navigate to /login<br>2. Enter "notanemail"<br>3. Click Login | Validation error for email format |
| AUTH-006 | Login button disabled until form valid | P2 | None | 1. Navigate to /login<br>2. Observe login button state<br>3. Enter partial data<br>4. Observe button state | Button disabled until all required fields valid |
| AUTH-007 | Remember me functionality | P2 | User exists | 1. Navigate to /login<br>2. Enter credentials<br>3. Check "Remember me"<br>4. Login<br>5. Close browser<br>6. Reopen | Session persists after browser close |
| AUTH-008 | Rate limiting on failed attempts | P1 | None | 1. Navigate to /login<br>2. Enter wrong credentials 6 times | Rate limit error after 5 attempts |
| AUTH-009 | XSS prevention in login fields | P1 | None | 1. Navigate to /login<br>2. Enter `<script>alert('xss')</script>` as email | Script not executed, input sanitized |
| AUTH-010 | SQL injection prevention | P1 | None | 1. Navigate to /login<br>2. Enter `' OR '1'='1` as email | No SQL error, proper validation |

**Test Data Requirements:**
- Valid test user: `standard@intellifill-test.com` / `StandardPass123!`
- XSS payloads fixture
- SQL injection payloads fixture

---

#### 6.1.2 Registration Tests (`auth/register.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| AUTH-020 | Register new user successfully | P0 | Email not in database | 1. Navigate to /register<br>2. Fill all required fields<br>3. Accept terms<br>4. Click Register | Success message, redirect to login |
| AUTH-021 | Register with existing email | P0 | User exists | 1. Navigate to /register<br>2. Use existing email<br>3. Fill other fields<br>4. Click Register | Error "Email already registered" |
| AUTH-022 | Password strength indicator | P1 | None | 1. Navigate to /register<br>2. Enter weak password<br>3. Enter medium password<br>4. Enter strong password | Indicator shows weak/medium/strong |
| AUTH-023 | Password mismatch validation | P1 | None | 1. Navigate to /register<br>2. Enter password<br>3. Enter different confirmation | Error "Passwords do not match" |
| AUTH-024 | Terms not accepted | P1 | None | 1. Navigate to /register<br>2. Fill all fields<br>3. Do not accept terms<br>4. Click Register | Error "Must accept terms" |
| AUTH-025 | Email format validation | P1 | None | 1. Navigate to /register<br>2. Enter invalid email format | Validation error shown |
| AUTH-026 | Password complexity requirements | P1 | None | 1. Navigate to /register<br>2. Enter password without uppercase | Error about complexity |
| AUTH-027 | Organization creation during registration | P2 | None | 1. Navigate to /register<br>2. Enter company name<br>3. Complete registration | Organization created with user |

**Test Data Requirements:**
- New user template for each test run
- Password complexity test cases

---

#### 6.1.3 Logout Tests (`auth/logout.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| AUTH-040 | Logout from user menu | P0 | User logged in | 1. Click user menu<br>2. Click Logout | Token removed, redirect to /login |
| AUTH-041 | Cannot access protected routes after logout | P0 | User just logged out | 1. Logout<br>2. Navigate to /dashboard | Redirect to /login |
| AUTH-042 | Logout clears all session data | P1 | User logged in | 1. Logout<br>2. Check localStorage<br>3. Check sessionStorage | All auth data cleared |
| AUTH-043 | Logout from multiple tabs | P2 | User logged in multiple tabs | 1. Open 2 browser tabs<br>2. Logout from one tab | Other tab redirects to login |

---

#### 6.1.4 Password Reset Tests (`auth/password-reset.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| AUTH-050 | Request password reset | P0 | User exists | 1. Click "Forgot Password"<br>2. Enter email<br>3. Submit | Success message "Reset email sent" |
| AUTH-051 | Password reset with non-existent email | P1 | Email not in database | 1. Request reset<br>2. Enter unknown email | Same success message (no enumeration) |
| AUTH-052 | Reset password with valid token | P0 | Reset token generated | 1. Navigate to reset URL<br>2. Enter new password<br>3. Confirm password<br>4. Submit | Password changed, redirect to login |
| AUTH-053 | Reset with expired token | P1 | Token expired | 1. Navigate to old reset URL<br>2. Try to reset | Error "Token expired" |
| AUTH-054 | Reset with invalid token | P1 | None | 1. Navigate to reset with fake token | Error "Invalid token" |

---

#### 6.1.5 Session Management Tests (`auth/session-management.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| AUTH-060 | Session persists on page refresh | P0 | User logged in | 1. Login<br>2. Refresh page | User still logged in |
| AUTH-061 | Token refresh on expiry | P1 | Token near expiry | 1. Wait for token near expiry<br>2. Make authenticated request | Token refreshed automatically |
| AUTH-062 | Session timeout after inactivity | P2 | User logged in | 1. Login<br>2. Wait for timeout period | User logged out with message |
| AUTH-063 | Concurrent session handling | P2 | User logged in | 1. Login from device A<br>2. Login from device B | Both sessions active or policy enforced |

---

#### 6.1.6 Multi-Tenant Auth Tests (`auth/multi-tenant-auth.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| AUTH-070 | Login with company slug | P0 | User in org | 1. Navigate to /login<br>2. Enter company slug<br>3. Enter credentials | Login to correct organization |
| AUTH-071 | User cannot access other org data | P0 | Users in diff orgs | 1. Login as org1 user<br>2. Try to access org2 data | 403 Forbidden |
| AUTH-072 | Suspended organization login | P1 | Org suspended | 1. Try to login as suspended org user | Error "Organization suspended" |
| AUTH-073 | Organization context in API calls | P1 | User logged in | 1. Make API request<br>2. Verify org header | Organization ID in request |

---

### 6.2 Documents Suite

#### 6.2.1 Upload Tests (`documents/upload.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| DOC-001 | Upload PDF document | P0 | User logged in | 1. Navigate to /upload<br>2. Select PDF file<br>3. Click Upload | File uploaded successfully |
| DOC-002 | Upload DOCX document | P1 | User logged in | 1. Navigate to /upload<br>2. Select DOCX file<br>3. Click Upload | File uploaded successfully |
| DOC-003 | Upload image (PNG/JPG) | P1 | User logged in | 1. Navigate to /upload<br>2. Select image file<br>3. Click Upload | File uploaded successfully |
| DOC-004 | Reject unsupported file type | P0 | User logged in | 1. Navigate to /upload<br>2. Select .exe file | Error "Unsupported file type" |
| DOC-005 | File size limit enforcement | P0 | User logged in | 1. Navigate to /upload<br>2. Select file > 10MB | Error "File too large" |
| DOC-006 | Upload progress indicator | P1 | User logged in | 1. Upload large file | Progress bar visible |
| DOC-007 | Cancel upload in progress | P2 | Upload in progress | 1. Start upload<br>2. Click cancel | Upload cancelled, file removed |
| DOC-008 | Drag and drop upload | P1 | User logged in | 1. Drag file to drop zone | File accepted and uploaded |
| DOC-009 | Multiple file selection | P1 | User logged in | 1. Select 3 files<br>2. Click Upload | All files uploaded |
| DOC-010 | Document category assignment | P2 | User logged in | 1. Upload document<br>2. Select category | Category saved with document |
| DOC-011 | Corrupted file handling | P1 | User logged in | 1. Upload corrupted PDF | Error "Invalid file" |
| DOC-012 | Empty file handling | P1 | User logged in | 1. Upload 0-byte file | Error "File is empty" |

**Test Data Requirements:**
- sample.pdf (150KB, valid)
- sample.docx (100KB, valid)
- large-file.pdf (15MB)
- corrupted.pdf (invalid structure)
- sample.png, sample.jpg (images)

---

#### 6.2.2 View Documents Tests (`documents/view-documents.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| DOC-020 | View document list | P0 | Documents exist | 1. Navigate to /documents | List of documents displayed |
| DOC-021 | Search documents by name | P1 | Multiple documents | 1. Enter search query<br>2. Submit search | Filtered results shown |
| DOC-022 | Filter by status | P1 | Documents with diff statuses | 1. Select status filter | Only matching documents shown |
| DOC-023 | Filter by category | P2 | Documents with categories | 1. Select category filter | Only matching documents shown |
| DOC-024 | Sort by date | P2 | Multiple documents | 1. Select sort by date | Documents ordered by date |
| DOC-025 | Pagination | P1 | >10 documents | 1. Navigate to page 2 | Page 2 documents shown |
| DOC-026 | View document details | P0 | Document exists | 1. Click on document | Detail view displayed |
| DOC-027 | Preview document | P1 | Document exists | 1. Click preview button | Document preview shown |
| DOC-028 | Empty state display | P2 | No documents | 1. Navigate to /documents | Empty state message shown |
| DOC-029 | View extracted data | P0 | Processed document | 1. View processed document | Extracted fields displayed |

---

#### 6.2.3 Delete Documents Tests (`documents/delete-documents.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| DOC-040 | Delete single document | P0 | Document exists | 1. Click delete button<br>2. Confirm deletion | Document removed from list |
| DOC-041 | Delete confirmation dialog | P1 | Document exists | 1. Click delete | Confirmation dialog shown |
| DOC-042 | Cancel delete operation | P2 | Document exists | 1. Click delete<br>2. Click cancel | Document not deleted |
| DOC-043 | Bulk delete documents | P1 | Multiple documents | 1. Select 3 documents<br>2. Click bulk delete | All selected documents deleted |
| DOC-044 | Cannot delete processing document | P2 | Document processing | 1. Try to delete | Error "Cannot delete while processing" |

---

#### 6.2.4 OCR Processing Tests (`documents/ocr-processing.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| DOC-060 | Process document with OCR | P0 | Uploaded document | 1. Upload scanned PDF<br>2. Start processing | Text extracted via OCR |
| DOC-061 | OCR confidence scores | P1 | OCR completed | 1. View processed document | Confidence scores shown |
| DOC-062 | Field extraction accuracy | P0 | Document with known fields | 1. Process document<br>2. Verify extracted fields | Fields match expected values |
| DOC-063 | Low confidence field highlighting | P1 | OCR with low confidence | 1. Process document | Low confidence fields marked |
| DOC-064 | Edit extracted fields | P1 | OCR completed | 1. Edit a field value<br>2. Save | Updated value saved |
| DOC-065 | Reprocess document | P2 | Previously processed | 1. Click reprocess | Document processed again |
| DOC-066 | Processing status polling | P1 | Processing in progress | 1. Start processing<br>2. Observe status | Status updates shown |
| DOC-067 | Processing failure handling | P1 | Upload corrupted doc | 1. Process corrupted doc | Error with retry option |

---

#### 6.2.5 Batch Upload Tests (`documents/batch-upload.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| DOC-080 | Upload batch of documents | P1 | User logged in | 1. Select 5 files<br>2. Upload | All files uploaded |
| DOC-081 | Batch upload progress | P1 | Batch in progress | 1. Start batch upload | Individual progress shown |
| DOC-082 | Partial batch failure | P1 | Mixed valid/invalid | 1. Upload mix of files | Valid uploaded, errors for invalid |
| DOC-083 | Batch processing | P1 | Batch uploaded | 1. Process all documents | All documents processed |
| DOC-084 | Batch upload size limit | P2 | User logged in | 1. Select 20 files | Error "Maximum 10 files" |

---

#### 6.2.6 Document History Tests (`documents/document-history.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| DOC-100 | View processing history | P1 | Documents processed | 1. Navigate to /history | Processing history shown |
| DOC-101 | Filter history by status | P2 | Mixed statuses | 1. Filter by completed | Only completed shown |
| DOC-102 | Filter history by date range | P2 | Documents exist | 1. Select date range | Filtered results shown |
| DOC-103 | Download history report | P2 | History exists | 1. Click export | CSV downloaded |

---

#### 6.2.7 Export Tests (`documents/export.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| DOC-120 | Export as CSV | P1 | Processed document | 1. Click export CSV | CSV file downloaded |
| DOC-121 | Export as JSON | P2 | Processed document | 1. Click export JSON | JSON file downloaded |
| DOC-122 | Export as Excel | P2 | Processed document | 1. Click export Excel | Excel file downloaded |
| DOC-123 | Download original document | P1 | Document exists | 1. Click download original | Original file downloaded |

---

### 6.3 Templates Suite

#### 6.3.1 Create Template Tests (`templates/create-template.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| TMPL-001 | Create template successfully | P0 | User logged in | 1. Click Create Template<br>2. Fill name/description<br>3. Upload form PDF<br>4. Save | Template created |
| TMPL-002 | Create template with field mappings | P0 | User logged in | 1. Create template<br>2. Add field mappings | Mappings saved |
| TMPL-003 | Template name required | P1 | None | 1. Create without name | Error "Name required" |
| TMPL-004 | Duplicate template name | P1 | Template exists | 1. Create with same name | Error "Name already exists" |
| TMPL-005 | Template file required | P1 | None | 1. Create without file | Error "File required" |
| TMPL-006 | Template category selection | P2 | None | 1. Create template<br>2. Select category | Category saved |
| TMPL-007 | Auto-detect form fields | P1 | Upload form PDF | 1. Upload PDF with fields | Fields automatically detected |

---

#### 6.3.2 Edit Template Tests (`templates/edit-template.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| TMPL-020 | Edit template name | P1 | Template exists | 1. Edit template<br>2. Change name<br>3. Save | Name updated |
| TMPL-021 | Edit field mappings | P0 | Template with mappings | 1. Edit template<br>2. Modify mapping<br>3. Save | Mapping updated |
| TMPL-022 | Add new field mapping | P1 | Template exists | 1. Edit template<br>2. Add mapping<br>3. Save | New mapping added |
| TMPL-023 | Remove field mapping | P1 | Template with mappings | 1. Edit template<br>2. Remove mapping<br>3. Save | Mapping removed |
| TMPL-024 | Cancel edit changes | P2 | Template exists | 1. Edit template<br>2. Make changes<br>3. Cancel | Changes discarded |

---

#### 6.3.3 Delete Template Tests (`templates/delete-template.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| TMPL-040 | Delete template | P0 | Template exists | 1. Click delete<br>2. Confirm | Template removed |
| TMPL-041 | Delete confirmation | P1 | Template exists | 1. Click delete | Confirmation shown |
| TMPL-042 | Cancel delete | P2 | Template exists | 1. Click delete<br>2. Cancel | Template not deleted |
| TMPL-043 | Delete template with filled forms | P2 | Template in use | 1. Delete template | Warning about filled forms |

---

#### 6.3.4 Field Mapping Tests (`templates/field-mapping.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| TMPL-060 | Map source to target field | P0 | Template exists | 1. Create mapping | Fields linked |
| TMPL-061 | Field transformation rules | P2 | Template exists | 1. Add transformation rule | Rule saved |
| TMPL-062 | Validate mapping configuration | P1 | Template exists | 1. Create invalid mapping | Error shown |
| TMPL-063 | Preview mapping result | P1 | Mapping exists | 1. Enter test data<br>2. Preview | Result shown |

---

#### 6.3.5 Public Templates Tests (`templates/public-templates.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| TMPL-080 | View public templates | P1 | Public templates exist | 1. Navigate to public templates | Public templates shown |
| TMPL-081 | Use public template | P1 | Public template exists | 1. Select public template | Template available to use |
| TMPL-082 | Make template public | P1 | Template exists | 1. Toggle public flag | Template visible to others |
| TMPL-083 | Public template search | P2 | Public templates exist | 1. Search public templates | Filtered results shown |

---

### 6.4 Profiles Suite

#### 6.4.1 View Profile Tests (`profiles/view-profile.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| PROF-001 | View user profile | P0 | Profile exists | 1. Navigate to /profile | Profile data displayed |
| PROF-002 | View field values | P0 | Profile with fields | 1. View profile | Field values shown |
| PROF-003 | View confidence scores | P1 | Profile exists | 1. View profile | Confidence scores shown |
| PROF-004 | View field sources | P1 | Profile exists | 1. View field details | Source documents shown |
| PROF-005 | Empty profile state | P2 | No profile | 1. Navigate to /profile | Empty state with prompt |

---

#### 6.4.2 Edit Profile Tests (`profiles/edit-profile.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| PROF-020 | Edit profile field | P0 | Profile exists | 1. Click edit field<br>2. Change value<br>3. Save | Value updated |
| PROF-021 | Add new profile field | P1 | Profile exists | 1. Click add field<br>2. Enter key/value<br>3. Save | Field added |
| PROF-022 | Delete profile field | P1 | Profile with fields | 1. Delete field<br>2. Confirm | Field removed |
| PROF-023 | Validation on edit | P1 | Profile exists | 1. Enter invalid value | Validation error shown |
| PROF-024 | Cancel edit changes | P2 | Profile exists | 1. Make changes<br>2. Cancel | Changes discarded |

---

#### 6.4.3 Profile Aggregation Tests (`profiles/profile-aggregation.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| PROF-040 | Auto-aggregate from documents | P0 | Documents processed | 1. Process new document | Profile updated |
| PROF-041 | Merge conflicting values | P1 | Multiple docs same field | 1. View field | All values shown |
| PROF-042 | Source tracking | P1 | Aggregated profile | 1. View field source | Document source shown |
| PROF-043 | Confidence calculation | P1 | Multiple sources | 1. View confidence | Based on source count |

---

#### 6.4.4 Profile Refresh Tests (`profiles/profile-refresh.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| PROF-060 | Manual profile refresh | P1 | Profile exists | 1. Click refresh | Profile re-aggregated |
| PROF-061 | Refresh indicator | P2 | Refresh in progress | 1. Start refresh | Loading indicator shown |
| PROF-062 | Last aggregated timestamp | P2 | Profile refreshed | 1. View profile | Updated timestamp shown |

---

### 6.5 Knowledge Base Suite

#### 6.5.1 Upload Source Tests (`knowledge-base/upload-source.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| KB-001 | Upload knowledge source | P0 | User logged in | 1. Click upload<br>2. Select file<br>3. Enter title<br>4. Upload | Source uploaded |
| KB-002 | Processing status polling | P1 | Source uploading | 1. Upload source<br>2. Observe status | Status updates shown |
| KB-003 | Upload progress | P1 | Source uploading | 1. Upload large file | Progress indicator shown |
| KB-004 | Reject unsupported types | P1 | None | 1. Upload .exe file | Error shown |
| KB-005 | Title required | P1 | None | 1. Upload without title | Error "Title required" |
| KB-006 | View uploaded sources | P1 | Sources exist | 1. Navigate to knowledge | Sources listed |
| KB-007 | Delete knowledge source | P1 | Source exists | 1. Click delete<br>2. Confirm | Source removed |

---

#### 6.5.2 Semantic Search Tests (`knowledge-base/semantic-search.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| KB-020 | Basic semantic search | P0 | Sources indexed | 1. Enter query<br>2. Search | Relevant results shown |
| KB-021 | Search with filters | P1 | Sources exist | 1. Filter by source<br>2. Search | Filtered results |
| KB-022 | Relevance scoring | P1 | Search results | 1. Perform search | Results have scores |
| KB-023 | Search result highlighting | P2 | Search results | 1. View results | Query terms highlighted |
| KB-024 | Empty search results | P2 | No matching docs | 1. Search obscure term | "No results" message |
| KB-025 | Search query validation | P1 | None | 1. Search with < 3 chars | Error shown |
| KB-026 | Search performance | P1 | Large knowledge base | 1. Perform search | Results in < 2 seconds |

---

#### 6.5.3 Hybrid Search Tests (`knowledge-base/hybrid-search.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| KB-040 | Hybrid search mode | P1 | Sources indexed | 1. Select hybrid mode<br>2. Search | Combined results |
| KB-041 | Keyword search mode | P1 | Sources indexed | 1. Select keyword mode<br>2. Search | Keyword-based results |
| KB-042 | Search mode comparison | P2 | Sources indexed | 1. Search same query all modes | Different result rankings |

---

#### 6.5.4 Form Suggestions Tests (`knowledge-base/form-suggestions.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| KB-060 | Get field suggestions | P0 | Knowledge indexed | 1. Request suggestions for field | Suggestions returned |
| KB-061 | Contextual suggestions | P1 | Filled fields | 1. Fill some fields<br>2. Request suggestion | Context-aware results |
| KB-062 | Multiple field suggestions | P1 | Form with fields | 1. Request batch suggestions | All fields have suggestions |
| KB-063 | Suggestion confidence | P1 | Suggestions returned | 1. View suggestions | Confidence scores shown |
| KB-064 | Apply suggestion | P1 | Suggestions shown | 1. Click suggestion | Field populated |

---

#### 6.5.5 Knowledge Stats Tests (`knowledge-base/knowledge-stats.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| KB-080 | View knowledge stats | P2 | Sources exist | 1. View stats panel | Stats displayed |
| KB-081 | Total sources count | P2 | Sources exist | 1. View stats | Correct count shown |
| KB-082 | Total chunks count | P2 | Sources indexed | 1. View stats | Chunks counted |
| KB-083 | Recent sources list | P2 | Sources exist | 1. View stats | Recent sources shown |

---

### 6.6 Form Filling Suite

#### 6.6.1 Auto-Fill Tests (`form-filling/auto-fill.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| FF-001 | Auto-fill form from profile | P0 | Profile with data | 1. Select template<br>2. Click auto-fill | Fields populated |
| FF-002 | Auto-fill from client profile | P0 | Client profile exists | 1. Select client<br>2. Select template<br>3. Auto-fill | Client data used |
| FF-003 | Partial auto-fill | P1 | Some fields mappable | 1. Auto-fill | Only mapped fields filled |
| FF-004 | Confidence indicators | P1 | Auto-fill completed | 1. View filled form | Confidence shown per field |
| FF-005 | Auto-fill with knowledge suggestions | P1 | Knowledge indexed | 1. Auto-fill<br>2. View suggestions | AI suggestions available |

---

#### 6.6.2 Manual Fill Tests (`form-filling/manual-fill.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| FF-020 | Manually fill form field | P0 | Template selected | 1. Type in field | Value entered |
| FF-021 | Field validation | P1 | Required fields | 1. Leave required empty | Validation error |
| FF-022 | Date field picker | P2 | Date field in form | 1. Click date field | Date picker shown |
| FF-023 | Dropdown field selection | P2 | Dropdown in form | 1. Click dropdown | Options shown |
| FF-024 | Clear form | P1 | Fields filled | 1. Click clear | All fields cleared |

---

#### 6.6.3 Template Fill Tests (`form-filling/template-fill.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| FF-040 | Select template for filling | P0 | Templates exist | 1. Select template | Form fields shown |
| FF-041 | Field mapping application | P0 | Template with mappings | 1. Auto-fill | Mapped fields populated |
| FF-042 | Switch templates | P1 | Multiple templates | 1. Select template A<br>2. Select template B | Form updates |
| FF-043 | Template field detection | P1 | PDF with fields | 1. Select template | Fields detected |

---

#### 6.6.4 Fill History Tests (`form-filling/fill-history.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| FF-060 | View fill history | P1 | Filled forms exist | 1. Navigate to history | History shown |
| FF-061 | Download filled form | P1 | Filled form exists | 1. Click download | PDF downloaded |
| FF-062 | View fill details | P2 | Filled form exists | 1. Click view | Data snapshot shown |
| FF-063 | Filter by template | P2 | Multiple templates used | 1. Filter by template | Filtered results |

---

#### 6.6.5 Export Filled Form Tests (`form-filling/export-filled-form.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| FF-080 | Export as filled PDF | P0 | Form filled | 1. Click export PDF | PDF with data downloaded |
| FF-081 | Preview before export | P1 | Form filled | 1. Click preview | Preview shown |
| FF-082 | Export multiple pages | P1 | Multi-page form | 1. Export | All pages included |
| FF-083 | Export with signatures | P2 | Form with signature field | 1. Add signature<br>2. Export | Signature in PDF |

---

#### 6.6.6 Fill Validation Tests (`form-filling/fill-validation.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| FF-100 | Required field validation | P0 | Required fields | 1. Try submit empty | Errors shown |
| FF-101 | Email format validation | P1 | Email field | 1. Enter invalid email | Format error shown |
| FF-102 | Phone format validation | P1 | Phone field | 1. Enter invalid phone | Format error shown |
| FF-103 | Date validation | P1 | Date field | 1. Enter invalid date | Error shown |
| FF-104 | Cross-field validation | P2 | Dependent fields | 1. Enter inconsistent data | Warning shown |

---

### 6.7 Smoke Suite

#### 6.7.1 Health Check Tests (`smoke/health-check.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| SMK-001 | Application loads | P0 | Server running | 1. Navigate to / | Page loads successfully |
| SMK-002 | API health endpoint | P0 | Server running | 1. GET /api/health | 200 OK response |
| SMK-003 | Database connectivity | P0 | DB running | 1. Make DB request | Connection successful |
| SMK-004 | Static assets load | P1 | None | 1. Load page | CSS/JS loaded |
| SMK-005 | No console errors | P1 | None | 1. Load page | No JS errors |

---

#### 6.7.2 Critical Paths Tests (`smoke/critical-paths.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| SMK-020 | Login flow | P0 | User exists | 1. Login | Successfully logged in |
| SMK-021 | Document upload flow | P0 | User logged in | 1. Upload document | Document uploaded |
| SMK-022 | Form fill flow | P0 | Template exists | 1. Fill form<br>2. Export | Filled PDF generated |
| SMK-023 | Profile view flow | P0 | Profile exists | 1. View profile | Profile displayed |
| SMK-024 | Search flow | P0 | Knowledge indexed | 1. Perform search | Results returned |

---

#### 6.7.3 Responsiveness Tests (`smoke/responsiveness.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| SMK-040 | Desktop viewport (1920x1080) | P1 | None | 1. Load at 1920x1080 | Layout correct |
| SMK-041 | Laptop viewport (1280x720) | P1 | None | 1. Load at 1280x720 | Layout correct |
| SMK-042 | Tablet viewport (768x1024) | P1 | None | 1. Load at 768x1024 | Layout adapts |
| SMK-043 | Mobile viewport (375x667) | P1 | None | 1. Load at 375x667 | Mobile layout |
| SMK-044 | Mobile navigation | P1 | Mobile viewport | 1. Open mobile menu | Menu works |

---

#### 6.7.4 Accessibility Tests (`smoke/accessibility.spec.ts`)

| Test ID | Test Name | Priority | Preconditions | Steps | Expected Results |
|---------|-----------|----------|---------------|-------|------------------|
| SMK-060 | Login page accessibility | P1 | None | 1. Run axe on login | No critical violations |
| SMK-061 | Dashboard accessibility | P1 | User logged in | 1. Run axe on dashboard | No critical violations |
| SMK-062 | Keyboard navigation | P1 | None | 1. Tab through page | All interactive elements focusable |
| SMK-063 | Screen reader labels | P2 | None | 1. Check ARIA labels | All inputs labeled |
| SMK-064 | Color contrast | P2 | None | 1. Check contrast | WCAG AA compliant |

---

## 7. CI/CD Integration

### 7.1 Pipeline Triggers

| Trigger | Test Suite | Environment | Timeout |
|---------|------------|-------------|---------|
| PR Open/Update | Smoke + Critical Paths | CI | 10 min |
| Merge to main | Full Suite | CI | 45 min |
| Merge to develop | Smoke + Affected Suites | CI | 20 min |
| Nightly (12:00 AM) | Full Suite + Performance | Staging | 60 min |
| Pre-release | Full Suite | Staging | 60 min |
| Post-deploy (Production) | Smoke Only | Production | 5 min |

### 7.2 Parallelization Strategy

```yaml
# cypress.config.ts
export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // Enable parallel execution
    },
    specPattern: 'e2e/tests/**/*.spec.ts',
    supportFile: 'e2e/support/e2e.ts',
  },
  // Split into 4 parallel runners
  parallel: true,
  record: true,
  ciBuildId: process.env.CI_BUILD_ID,
})
```

**Parallelization Groups:**
- **Group 1:** Auth + Smoke (fastest)
- **Group 2:** Documents + Templates
- **Group 3:** Profiles + Knowledge Base
- **Group 4:** Form Filling + Integration

### 7.3 GitHub Actions Workflow

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * *'  # Nightly

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        containers: [1, 2, 3, 4]

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: testpass
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Start backend
        run: npm run dev:backend &
        env:
          DATABASE_URL: postgresql://postgres:testpass@localhost:5432/test

      - name: Start frontend
        run: npm run dev:frontend &

      - name: Wait for services
        run: npx wait-on http://localhost:3002/api/health http://localhost:8080

      - name: Run Cypress tests
        uses: cypress-io/github-action@v6
        with:
          record: true
          parallel: true
          group: 'E2E Tests'
          ci-build-id: ${{ github.run_id }}
        env:
          CYPRESS_RECORD_KEY: ${{ secrets.CYPRESS_RECORD_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: cypress-screenshots-${{ matrix.containers }}
          path: cypress/screenshots
```

### 7.4 Test Environment Setup

```bash
# scripts/setup-test-env.sh
#!/bin/bash

# Reset test database
npm run db:reset:test

# Seed test data
npm run db:seed:test

# Start services
docker-compose -f docker-compose.test.yml up -d

# Wait for services
npx wait-on tcp:5432 tcp:6379

# Run migrations
npm run db:migrate:test

echo "Test environment ready"
```

### 7.5 Test Data Seeding Script

```typescript
// scripts/seed-test-data.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedTestData() {
  // Create test organizations
  const org1 = await prisma.organization.create({
    data: {
      id: 'org-test-001',
      name: 'Test Company Inc',
      status: 'ACTIVE'
    }
  });

  // Create test users
  const hashedPassword = await bcrypt.hash('StandardPass123!', 10);

  await prisma.user.create({
    data: {
      id: 'user-std-001',
      email: 'standard@intellifill-test.com',
      password: hashedPassword,
      firstName: 'Standard',
      lastName: 'User',
      role: 'USER',
      organizationId: org1.id,
      emailVerified: true
    }
  });

  // Create test documents
  await prisma.document.create({
    data: {
      id: 'doc-001',
      userId: 'user-std-001',
      fileName: 'processed-invoice.pdf',
      fileType: 'application/pdf',
      fileSize: 150000,
      storageUrl: '/test-files/processed-invoice.pdf',
      status: 'COMPLETED',
      extractedData: {
        companyName: 'ABC Corporation',
        invoiceNumber: 'INV-2024-001'
      }
    }
  });

  // Create test templates
  await prisma.formTemplate.create({
    data: {
      id: 'tmpl-001',
      userId: 'user-std-001',
      name: 'UAE Visa Application',
      category: 'VISA',
      fileUrl: '/test-files/visa-template.pdf',
      fieldMappings: {
        fullName: 'full_name',
        passportNumber: 'passport_no'
      }
    }
  });

  console.log('Test data seeded successfully');
}

seedTestData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## 8. Reporting & Metrics

### 8.1 Report Configuration

```typescript
// cypress.config.ts
import { defineConfig } from 'cypress';

export default defineConfig({
  reporter: 'mochawesome',
  reporterOptions: {
    reportDir: 'cypress/reports',
    overwrite: false,
    html: true,
    json: true,
    timestamp: 'mmddyyyy_HHMMss',
    charts: true,
    embeddedScreenshots: true,
    inlineAssets: true,
  },
});
```

### 8.2 Custom Dashboard Metrics

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| Pass Rate | % of tests passing | >= 98% | < 95% |
| Duration | Total suite runtime | < 45 min | > 60 min |
| Flaky Tests | Tests with inconsistent results | < 2% | > 5% |
| Coverage | Critical paths covered | 100% | < 90% |
| New Failures | Tests failing for first time | 0 | > 0 |

### 8.3 Slack Notification Integration

```yaml
# In GitHub Actions workflow
- name: Send Slack notification
  if: failure()
  uses: slackapi/slack-github-action@v1.24.0
  with:
    payload: |
      {
        "text": "E2E Tests Failed!",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*E2E Test Failure*\n*Branch:* ${{ github.ref_name }}\n*Commit:* ${{ github.sha }}\n*Author:* ${{ github.actor }}"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## 9. Maintenance Guidelines

### 9.1 Test Review Cadence

| Review Type | Frequency | Owner |
|-------------|-----------|-------|
| Flaky test analysis | Weekly | QA Lead |
| Test coverage review | Bi-weekly | QA Team |
| Test data cleanup | Monthly | DevOps |
| Full suite optimization | Quarterly | QA Architect |

### 9.2 Adding New Tests Checklist

- [ ] Follow naming convention: `{feature}/{action}.spec.ts`
- [ ] Include test ID in format: `{SUITE}-{###}`
- [ ] Set appropriate priority (P0-P3)
- [ ] Define clear preconditions
- [ ] Use page objects for interactions
- [ ] Add test data to fixtures if needed
- [ ] Update TEST_PLAN.md with new test
- [ ] Verify test runs in CI environment

### 9.3 Handling Flaky Tests

1. **Identify:** Monitor test results for inconsistent failures
2. **Isolate:** Run test in isolation to reproduce
3. **Root Cause:** Common causes:
   - Timing issues (add explicit waits)
   - Data dependencies (ensure clean state)
   - Network flakiness (add retry logic)
4. **Fix:** Apply appropriate solution
5. **Monitor:** Watch for 2 weeks after fix

### 9.4 Test Data Management

- **Never use production data** in tests
- **Reset database** before each test suite
- **Use factories** for dynamic test data
- **Version fixtures** alongside test code
- **Clean up** after each test run

### 9.5 Deprecating Tests

1. Mark test with `@deprecated` tag
2. Add comment explaining why
3. Create ticket to remove after N sprints
4. Remove from critical path runs
5. Delete after grace period

---

## Appendix A: Test Data Fixtures

### A.1 User Fixtures (`fixtures/users.json`)

```json
{
  "standardUser": {
    "email": "standard@intellifill-test.com",
    "password": "StandardPass123!",
    "firstName": "Standard",
    "lastName": "User"
  },
  "adminUser": {
    "email": "admin@intellifill-test.com",
    "password": "AdminPass123!",
    "firstName": "Admin",
    "lastName": "User"
  },
  "invalidCredentials": {
    "email": "nonexistent@intellifill-test.com",
    "password": "WrongPassword123!"
  },
  "weakPasswords": [
    "123456",
    "password",
    "abc123"
  ],
  "xssPayloads": [
    "<script>alert('xss')</script>",
    "javascript:alert('xss')",
    "<img src=x onerror=alert('xss')>"
  ],
  "sqlPayloads": [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "1' OR '1' = '1"
  ]
}
```

### A.2 API Response Fixtures (`fixtures/api-responses.json`)

```json
{
  "auth": {
    "loginSuccess": {
      "success": true,
      "data": {
        "token": "mock-jwt-token",
        "user": {
          "id": "user-123",
          "email": "test@example.com",
          "role": "USER"
        }
      }
    },
    "loginFailure": {
      "success": false,
      "error": "Invalid credentials"
    }
  },
  "documents": {
    "uploadSuccess": {
      "success": true,
      "data": {
        "documentId": "doc-123",
        "status": "uploaded"
      }
    },
    "processSuccess": {
      "success": true,
      "data": {
        "jobId": "job-123",
        "status": "completed",
        "extractedFields": {}
      }
    }
  },
  "knowledge": {
    "searchResults": {
      "success": true,
      "results": [],
      "totalResults": 0,
      "searchTime": 150
    }
  }
}
```

---

## Appendix B: Environment Configuration

### B.1 Local Development

```env
# cypress.env.local.json
{
  "apiUrl": "http://localhost:3002/api",
  "appUrl": "http://localhost:8080",
  "testUserEmail": "test@intellifill.com",
  "testUserPassword": "TestPass123!",
  "skipLogin": false,
  "recordVideo": false
}
```

### B.2 CI Environment

```env
# cypress.env.ci.json
{
  "apiUrl": "http://localhost:3002/api",
  "appUrl": "http://localhost:8080",
  "testUserEmail": "ci-test@intellifill.com",
  "testUserPassword": "CITestPass123!",
  "skipLogin": false,
  "recordVideo": true,
  "retries": 2
}
```

### B.3 Staging Environment

```env
# cypress.env.staging.json
{
  "apiUrl": "https://staging-api.intellifill.com/api",
  "appUrl": "https://staging.intellifill.com",
  "testUserEmail": "staging-test@intellifill.com",
  "testUserPassword": "StagingPass123!",
  "skipLogin": false,
  "recordVideo": true,
  "retries": 3
}
```

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-12 | QA Architecture Team | Initial comprehensive test plan |

---

**Document Status:** Active
**Review Schedule:** Quarterly
**Next Review:** 2026-03-12
