/**
 * Admin Service
 *
 * API service functions for admin-only features.
 * Includes accuracy dashboard, agent performance, and user feedback endpoints.
 */

import api from './api';

// ============================================================================
// Types
// ============================================================================

export interface AccuracyOverview {
  overallAccuracy: number;
  averageConfidence: number;
  totalFeedbackCount: number;
  feedbackByRating: Record<number, number>;
  accuracyTrend: Array<{ date: string; accuracy: number }>;
  documentsByCategory: Array<{ category: string; count: number; avgConfidence: number }>;
}

export interface AgentPerformanceData {
  agentName: string;
  totalProcessed: number;
  successRate: number;
  avgProcessingTimeMs: number;
  avgConfidenceScore: number;
  avgQualityScore: number;
}

export interface AgentPerformance {
  agents: AgentPerformanceData[];
}

export interface FeedbackItem {
  id: string;
  userId: string;
  documentId: string;
  accuracyRating: number;
  isCorrect: boolean;
  comments: string | null;
  createdAt: string;
}

export interface FeedbackResponse {
  feedback: FeedbackItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface FeedbackParams {
  limit?: number;
  offset?: number;
}

// ============================================================================
// API Response Types
// ============================================================================

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get accuracy metrics overview for admin dashboard.
 *
 * @returns Overview statistics including accuracy trends and category breakdown
 * @throws Error with 403 status if user is not admin
 */
export async function getAccuracyOverview(): Promise<AccuracyOverview> {
  const response = await api.get<ApiResponse<AccuracyOverview>>('/admin/accuracy/overview');

  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to fetch accuracy overview');
  }

  return response.data.data;
}

/**
 * Get AI agent performance comparison data.
 *
 * @returns Agent performance metrics including success rates and processing times
 * @throws Error with 403 status if user is not admin
 */
export async function getAgentPerformance(): Promise<AgentPerformance> {
  const response = await api.get<ApiResponse<AgentPerformance>>('/admin/accuracy/agents');

  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to fetch agent performance');
  }

  return response.data.data;
}

/**
 * Get paginated user feedback for review.
 *
 * @param params - Pagination parameters (limit, offset)
 * @returns Paginated feedback items with total count
 * @throws Error with 403 status if user is not admin
 */
export async function getFeedback(params: FeedbackParams = {}): Promise<FeedbackResponse> {
  const { limit = 20, offset = 0 } = params;

  const response = await api.get<ApiResponse<FeedbackResponse>>('/admin/accuracy/feedback', {
    params: { limit, offset },
  });

  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to fetch feedback');
  }

  return response.data.data;
}

/**
 * Check if an API error is a 403 Forbidden error (non-admin access)
 */
export function isAccessDeniedError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { status: number } };
    return axiosError.response?.status === 403;
  }
  return false;
}

// ============================================================================
// Export
// ============================================================================

export const adminService = {
  getAccuracyOverview,
  getAgentPerformance,
  getFeedback,
  isAccessDeniedError,
};

export default adminService;
