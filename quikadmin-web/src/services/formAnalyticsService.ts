/**
 * Form Analytics Service
 *
 * API service functions for form usage analytics.
 * PRO agents need visibility into form usage patterns and completion rates.
 */

import api from './api';

// Types matching backend response structures

export interface TopTemplate {
  templateId: string;
  templateName: string;
  count: number;
  lastUsed: string;
}

export interface FormAnalyticsOverview {
  totalFormsGenerated: number;
  formsThisMonth: number;
  formsThisWeek: number;
  topTemplates: TopTemplate[];
  statusBreakdown: {
    draft: number;
    completed: number;
    submitted: number;
  };
}

export interface UsageByMonth {
  month: string;
  count: number;
}

export interface TemplateAnalytics {
  templateId: string;
  templateName: string;
  totalUsage: number;
  usageByMonth: UsageByMonth[];
  averageCompletionTime: number | null;
  clientsUsing: number;
}

export interface DailyUsage {
  date: string;
  count: number;
}

export interface UsageTrends {
  daily: DailyUsage[];
  weeklyAverage: number;
  trend: 'up' | 'down' | 'stable';
}

/**
 * Get form analytics overview for the current user.
 *
 * @returns Overview statistics including total forms, top templates, and status breakdown
 */
export async function getOverview(): Promise<FormAnalyticsOverview> {
  const response = await api.get<FormAnalyticsOverview>('/form-analytics/overview');
  return response.data;
}

/**
 * Get analytics for a specific template.
 *
 * @param templateId - The ID of the template to get analytics for
 * @returns Template-specific analytics including usage by month and client count
 */
export async function getTemplateAnalytics(templateId: string): Promise<TemplateAnalytics> {
  const response = await api.get<TemplateAnalytics>(`/form-analytics/templates/${templateId}`);
  return response.data;
}

/**
 * Get usage trends for the last 30 days.
 *
 * @returns Daily usage data, weekly average, and trend direction
 */
export async function getTrends(): Promise<UsageTrends> {
  const response = await api.get<UsageTrends>('/form-analytics/trends');
  return response.data;
}

export const formAnalyticsService = {
  getOverview,
  getTemplateAnalytics,
  getTrends,
};

export default formAnalyticsService;
