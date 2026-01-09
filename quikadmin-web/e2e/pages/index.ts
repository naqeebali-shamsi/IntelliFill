/**
 * Page Object Models Index
 *
 * Central export for all page objects.
 */

// Base Page
export { BasePage, COMMON_SELECTORS, type ToastType } from './BasePage';

// Auth Pages
export { LoginPage, type LoginCredentials } from './LoginPage';
export { RegisterPage, type RegistrationData } from './RegisterPage';

// Main Application Pages
export { DashboardPage } from './DashboardPage';
export { DocumentsPage, type DocumentStatus } from './DocumentsPage';

// Settings Pages
export { SettingsPage, type ProfileData } from './SettingsPage';
export { TemplatesPage, type TemplateData, type TemplateField } from './TemplatesPage';
