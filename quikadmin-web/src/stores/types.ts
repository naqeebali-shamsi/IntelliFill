/**
 * Core TypeScript interfaces and types for Zustand stores
 * Defines the shape of all state slices and their relationships
 */

// =================== BASE TYPES ===================

export interface User {
  id: string;
  email: string;
  name: string;
  full_name?: string;
  role: 'admin' | 'user' | 'viewer';
  avatar?: string;
  preferences: UserPreferences;
  subscription?: {
    plan: 'free' | 'pro' | 'enterprise';
    expiresAt?: string;
    features: string[];
  };
  createdAt: string;
  lastLoginAt?: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    desktop: boolean;
    processing: boolean;
    errors: boolean;
  };
  defaultTemplate?: string;
  autoSave: boolean;
  retentionDays: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  expiresIn?: number;
}

// =================== DOCUMENT TYPES ===================

export interface DocumentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  thumbnail?: string;
  uploadedAt: string;
  status: 'uploading' | 'uploaded' | 'processing' | 'processed' | 'error';
  progress: number;
  error?: string;
}

export interface ProcessingJob {
  id: string;
  name: string;
  templateId?: string;
  templateName?: string;
  documents: DocumentFile[];
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startedAt?: string;
  completedAt?: string;
  result?: ProcessingResult;
  error?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  estimatedTime?: number;
  userId: string;
}

export interface ProcessingResult {
  extractedData: Record<string, any>;
  confidence: number;
  validationErrors: ValidationError[];
  suggestions: string[];
  metadata: {
    processingTime: number;
    method: string;
    version: string;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

// =================== TEMPLATE TYPES ===================

export interface Template {
  id: string;
  name: string;
  description?: string;
  category: string;
  fields: TemplateField[];
  rules: ValidationRule[];
  isActive: boolean;
  isDefault: boolean;
  usage: TemplateUsage;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: number;
  tags: string[];
}

export interface TemplateField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'email' | 'url' | 'phone' | 'currency';
  label: string;
  placeholder?: string;
  description?: string;
  required: boolean;
  validation?: FieldValidation;
  defaultValue?: any;
  order: number;
  group?: string;
  conditions?: FieldCondition[];
}

export interface FieldValidation {
  pattern?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  format?: string;
  customValidator?: string;
}

export interface FieldCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
  action: 'show' | 'hide' | 'require' | 'disable';
}

export interface ValidationRule {
  id: string;
  name: string;
  condition: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  autoFix?: boolean;
}

export interface TemplateUsage {
  totalJobs: number;
  successRate: number;
  averageProcessingTime: number;
  lastUsed?: string;
  popularFields: string[];
}

// =================== UI TYPES ===================

export interface NotificationState {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  timestamp: number;
  read: boolean;
  persistent: boolean;
}

export interface ModalState {
  id: string;
  component: string;
  props?: Record<string, any>;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closable?: boolean;
  persistent?: boolean;
  zIndex?: number;
}

export interface LoadingState {
  id: string;
  message?: string;
  progress?: number;
  cancellable?: boolean;
  onCancel?: () => void;
}

export interface UIPreferences {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  tablePageSize: number;
  defaultView: 'grid' | 'list' | 'table';
  compactMode: boolean;
  animations: boolean;
  soundEffects: boolean;
}

// =================== STATISTICS TYPES ===================

export interface Statistics {
  overview: {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    activeJobs: number;
    totalDocuments: number;
    totalTemplates: number;
    storageUsed: number;
    storageLimit: number;
  };
  trends: {
    documents: StatsTrend;
    processedToday: StatsTrend;
    successRate: StatsTrend;
    averageTime: StatsTrend;
  };
  performance: {
    averageProcessingTime: number;
    averageConfidence: number;
    peakHours: number[];
    bottlenecks: string[];
  };
  usage: {
    apiCalls: number;
    apiLimit: number;
    bandwidth: number;
    bandwidthLimit: number;
  };
}

export interface StatsTrend {
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  period: 'hour' | 'day' | 'week' | 'month';
}

export interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  throughput: number;
  averageWaitTime: number;
}

// =================== SETTINGS TYPES ===================

export interface AppSettings {
  general: {
    autoSave: boolean;
    autoRefresh: boolean;
    refreshInterval: number;
    retentionPolicy: number;
    maxConcurrentJobs: number;
    enableNotifications: boolean;
  };
  processing: {
    defaultQuality: 'draft' | 'standard' | 'high' | 'premium';
    enableOCR: boolean;
    enableAI: boolean;
    confidenceThreshold: number;
    timeout: number;
    retryAttempts: number;
  };
  security: {
    sessionTimeout: number;
    requirePasswordChange: boolean;
    enableTwoFactor: boolean;
    allowedFileTypes: string[];
    maxFileSize: number;
    enableAuditLog: boolean;
  };
  integrations: {
    webhooks: WebhookConfig[];
    apiKeys: ApiKeyConfig[];
    connectedServices: ConnectedService[];
  };
}

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret?: string;
  headers?: Record<string, string>;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
  };
}

export interface ApiKeyConfig {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  expiresAt?: string;
  lastUsed?: string;
  enabled: boolean;
}

export interface ConnectedService {
  id: string;
  name: string;
  type: 'storage' | 'crm' | 'email' | 'analytics';
  status: 'connected' | 'disconnected' | 'error';
  config: Record<string, any>;
  lastSync?: string;
}

// =================== REAL-TIME TYPES ===================

export interface RealtimeEvent {
  id: string;
  type: 'job_update' | 'job_complete' | 'job_error' | 'system_message' | 'user_notification';
  data: any;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

export interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  reconnecting: boolean;
  error?: string;
  lastConnected?: number;
  connectionId?: string;
  subscriptions: string[];
}

// =================== ERROR TYPES ===================

export interface AppError {
  id: string;
  code: string;
  message: string;
  details?: string;
  stack?: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  context?: Record<string, any>;
  resolved: boolean;
  resolutionNotes?: string;
}

// =================== STORE ACTION TYPES ===================

export type StoreActions<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : never;
};

export type StoreState<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? never : T[K];
};

// =================== SUBSCRIPTION TYPES ===================

export interface StoreSubscription {
  id: string;
  selector: (state: any) => any;
  callback: (value: any, previousValue: any) => void;
  options?: {
    equalityFn?: (a: any, b: any) => boolean;
    fireImmediately?: boolean;
  };
}

// =================== MIGRATION TYPES ===================

export interface StoreMigration {
  version: number;
  migrate: (state: any) => any;
  validate?: (state: any) => boolean;
}

// =================== PERFORMANCE TYPES ===================

export interface StoreMetrics {
  storeId: string;
  updateCount: number;
  lastUpdate: number;
  subscriberCount: number;
  memoryUsage?: number;
  performanceMarks: PerformanceMark[];
}

export interface PerformanceMark {
  name: string;
  timestamp: number;
  duration?: number;
  data?: any;
}