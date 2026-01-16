/**
 * Admin Accuracy Dashboard API Routes
 *
 * Phase 4 PRO Features: Admin visibility into OCR accuracy, AI agent performance,
 * and user feedback for quality improvement.
 *
 * Endpoints:
 * - GET /api/admin/accuracy/overview - Accuracy metrics summary
 * - GET /api/admin/accuracy/agents - Agent performance comparison
 * - GET /api/admin/accuracy/feedback - Paginated user feedback
 *
 * @module api/admin-accuracy.routes
 */

import { Router, Response, IRouter } from 'express';
import { prisma } from '../utils/prisma';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import { authenticateSupabase, AuthenticatedRequest } from '../middleware/supabaseAuth';

const router: IRouter = Router();

// ============================================================================
// Middleware: Admin-only access
// ============================================================================

/**
 * Require admin role for all accuracy dashboard endpoints
 */
const requireAdmin = (req: AuthenticatedRequest, res: Response, next: () => void) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'ADMIN') {
    logger.warn('[AdminAccuracy] Unauthorized access attempt', {
      userId: req.user?.id,
      role: req.user?.role,
      path: req.path,
    });
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
  }
  next();
};

// ============================================================================
// Types
// ============================================================================

interface AccuracyOverview {
  overallAccuracy: number;
  averageConfidence: number;
  totalFeedbackCount: number;
  feedbackByRating: Record<number, number>;
  accuracyTrend: Array<{ date: string; accuracy: number }>;
  documentsByCategory: Array<{ category: string; count: number; avgConfidence: number }>;
}

interface AgentPerformance {
  agents: Array<{
    agentName: string;
    totalProcessed: number;
    successRate: number;
    avgProcessingTimeMs: number;
    avgConfidenceScore: number;
    avgQualityScore: number;
  }>;
}

interface FeedbackItem {
  id: string;
  userId: string;
  documentId: string;
  accuracyRating: number;
  isCorrect: boolean;
  comments: string | null;
  createdAt: string;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/admin/accuracy/overview
 * Get accuracy metrics overview for dashboard
 */
router.get(
  '/overview',
  authenticateSupabase,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get all feedback for statistics
      const [totalFeedback, correctFeedback, ratingCounts, last30DaysFeedback, documentCategories] =
        await Promise.all([
          // Total feedback count
          prisma.userFeedback.count(),
          // Correct feedback count
          prisma.userFeedback.count({ where: { isCorrect: true } }),
          // Feedback by rating (1-5)
          prisma.userFeedback.groupBy({
            by: ['accuracyRating'],
            _count: { id: true },
          }),
          // Last 30 days feedback for trend
          prisma.userFeedback.findMany({
            where: { createdAt: { gte: thirtyDaysAgo } },
            select: { createdAt: true, isCorrect: true },
            orderBy: { createdAt: 'asc' },
          }),
          // Documents by category with confidence
          prisma.document.groupBy({
            by: ['fileType'],
            _count: { id: true },
            _avg: { confidence: true },
            where: { confidence: { not: null } },
          }),
        ]);

      // Calculate overall accuracy
      const overallAccuracy = totalFeedback > 0 ? (correctFeedback / totalFeedback) * 100 : 0;

      // Calculate average confidence from documents
      const avgConfidenceResult = await prisma.document.aggregate({
        _avg: { confidence: true },
        where: { confidence: { not: null } },
      });
      const averageConfidence = avgConfidenceResult._avg.confidence ?? 0;

      // Build feedback by rating map
      const feedbackByRating: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const rating of ratingCounts) {
        feedbackByRating[rating.accuracyRating] = rating._count.id;
      }

      // Calculate accuracy trend by day
      const accuracyByDay = new Map<string, { correct: number; total: number }>();
      for (const feedback of last30DaysFeedback) {
        const dateKey = feedback.createdAt.toISOString().split('T')[0];
        const existing = accuracyByDay.get(dateKey) || { correct: 0, total: 0 };
        existing.total++;
        if (feedback.isCorrect) existing.correct++;
        accuracyByDay.set(dateKey, existing);
      }

      const accuracyTrend = Array.from(accuracyByDay.entries()).map(([date, data]) => ({
        date,
        accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
      }));

      // Map document categories
      const documentsByCategory = documentCategories.map((cat) => ({
        category: cat.fileType || 'unknown',
        count: cat._count.id,
        avgConfidence: cat._avg.confidence ?? 0,
      }));

      const overview: AccuracyOverview = {
        overallAccuracy: Math.round(overallAccuracy * 100) / 100,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        totalFeedbackCount: totalFeedback,
        feedbackByRating,
        accuracyTrend,
        documentsByCategory,
      };

      res.json({ success: true, data: overview });
    } catch (error) {
      logger.error('[AdminAccuracy] Failed to get overview', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve accuracy overview',
      });
    }
  }
);

/**
 * GET /api/admin/accuracy/agents
 * Get agent performance comparison
 */
router.get(
  '/agents',
  authenticateSupabase,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Aggregate agent metrics by agent name
      const agentStats = await prisma.agentMetrics.groupBy({
        by: ['agentName'],
        _count: { id: true },
        _avg: {
          processingTimeMs: true,
          confidenceScore: true,
          qualityScore: true,
        },
      });

      // Get success counts per agent
      const successCounts = await prisma.agentMetrics.groupBy({
        by: ['agentName'],
        _count: { id: true },
        where: { success: true },
      });

      const successMap = new Map(successCounts.map((s) => [s.agentName, s._count.id]));

      const agents = agentStats.map((agent) => {
        const totalProcessed = agent._count.id;
        const successCount = successMap.get(agent.agentName) || 0;
        const successRate = totalProcessed > 0 ? (successCount / totalProcessed) * 100 : 0;

        return {
          agentName: agent.agentName,
          totalProcessed,
          successRate: Math.round(successRate * 100) / 100,
          avgProcessingTimeMs: Math.round(agent._avg.processingTimeMs ?? 0),
          avgConfidenceScore: Math.round((agent._avg.confidenceScore ?? 0) * 100) / 100,
          avgQualityScore: Math.round((agent._avg.qualityScore ?? 0) * 100) / 100,
        };
      });

      // Sort by total processed (most active first)
      agents.sort((a, b) => b.totalProcessed - a.totalProcessed);

      const performance: AgentPerformance = { agents };

      res.json({ success: true, data: performance });
    } catch (error) {
      logger.error('[AdminAccuracy] Failed to get agent performance', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve agent performance',
      });
    }
  }
);

/**
 * GET /api/admin/accuracy/feedback
 * Get paginated user feedback for review
 */
router.get(
  '/feedback',
  authenticateSupabase,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const [feedback, total] = await Promise.all([
        prisma.userFeedback.findMany({
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            userId: true,
            documentId: true,
            accuracyRating: true,
            isCorrect: true,
            comments: true,
            createdAt: true,
          },
        }),
        prisma.userFeedback.count(),
      ]);

      const feedbackItems: FeedbackItem[] = feedback.map((f) => ({
        id: f.id,
        userId: f.userId,
        documentId: f.documentId,
        accuracyRating: f.accuracyRating,
        isCorrect: f.isCorrect,
        comments: f.comments,
        createdAt: f.createdAt.toISOString(),
      }));

      res.json({
        success: true,
        data: {
          feedback: feedbackItems,
          total,
          limit,
          offset,
        },
      });
    } catch (error) {
      logger.error('[AdminAccuracy] Failed to get feedback', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve user feedback',
      });
    }
  }
);

/**
 * Create and export the admin accuracy routes
 */
export function createAdminAccuracyRoutes(): IRouter {
  return router;
}

export default router;
