/**
 * Form Analytics Routes
 *
 * Provides analytics endpoints for form usage tracking.
 * PRO agents need visibility into form usage patterns and completion rates.
 */

import { Router, Response } from 'express';
import { authenticateSupabase, AuthenticatedRequest } from '../middleware/supabaseAuth';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';

// Types for response data
interface TopTemplate {
  templateId: string;
  templateName: string;
  count: number;
  lastUsed: string;
}

interface FormAnalyticsOverview {
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

interface UsageByMonth {
  month: string;
  count: number;
}

interface TemplateAnalytics {
  templateId: string;
  templateName: string;
  totalUsage: number;
  usageByMonth: UsageByMonth[];
  averageCompletionTime: number | null;
  clientsUsing: number;
}

interface DailyUsage {
  date: string;
  count: number;
}

interface UsageTrends {
  daily: DailyUsage[];
  weeklyAverage: number;
  trend: 'up' | 'down' | 'stable';
}

export function createFormAnalyticsRoutes(): Router {
  const router = Router();

  /**
   * GET /api/form-analytics/overview
   * Returns aggregate form usage stats for authenticated user
   */
  router.get('/overview', authenticateSupabase, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Calculate date ranges
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Get total forms generated
      const totalFormsGenerated = await prisma.filledForm.count({
        where: { userId },
      });

      // Get forms this month
      const formsThisMonth = await prisma.filledForm.count({
        where: {
          userId,
          createdAt: { gte: startOfMonth },
        },
      });

      // Get forms this week
      const formsThisWeek = await prisma.filledForm.count({
        where: {
          userId,
          createdAt: { gte: startOfWeek },
        },
      });

      // Get top templates with usage counts
      const topTemplatesRaw = await prisma.filledForm.groupBy({
        by: ['templateId'],
        where: { userId },
        _count: { id: true },
        _max: { createdAt: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      });

      // Fetch template names for top templates
      const templateIds = topTemplatesRaw.map((t) => t.templateId);
      const templates = await prisma.formTemplate.findMany({
        where: { id: { in: templateIds } },
        select: { id: true, name: true },
      });

      const templateNameMap = new Map(templates.map((t) => [t.id, t.name]));

      const topTemplates: TopTemplate[] = topTemplatesRaw.map((t) => ({
        templateId: t.templateId,
        templateName: templateNameMap.get(t.templateId) || 'Unknown Template',
        count: t._count.id,
        lastUsed: t._max.createdAt?.toISOString() || new Date().toISOString(),
      }));

      // Status breakdown - FilledForm doesn't have status field, so we use dataSnapshot
      // For now, count all as completed since they are generated forms
      const statusBreakdown = {
        draft: 0,
        completed: totalFormsGenerated,
        submitted: 0,
      };

      const overview: FormAnalyticsOverview = {
        totalFormsGenerated,
        formsThisMonth,
        formsThisWeek,
        topTemplates,
        statusBreakdown,
      };

      res.json(overview);
    } catch (error) {
      logger.error('Error fetching form analytics overview:', error);
      res.status(500).json({ error: 'Failed to fetch form analytics overview' });
    }
  });

  /**
   * GET /api/form-analytics/templates/:templateId
   * Returns analytics for a specific template
   */
  router.get(
    '/templates/:templateId',
    authenticateSupabase,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user?.id;
        const { templateId } = req.params;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get template info
        const template = await prisma.formTemplate.findUnique({
          where: { id: templateId },
          select: { id: true, name: true, userId: true },
        });

        if (!template) {
          return res.status(404).json({ error: 'Template not found' });
        }

        // Verify user has access to this template
        if (template.userId !== userId) {
          return res.status(403).json({ error: 'Access denied to this template' });
        }

        // Get total usage
        const totalUsage = await prisma.filledForm.count({
          where: { templateId, userId },
        });

        // Get usage by month (last 12 months)
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const forms = await prisma.filledForm.findMany({
          where: {
            templateId,
            userId,
            createdAt: { gte: twelveMonthsAgo },
          },
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
        });

        // Group by month
        const usageByMonthMap = new Map<string, number>();
        forms.forEach((form) => {
          const monthKey = `${form.createdAt.getFullYear()}-${String(form.createdAt.getMonth() + 1).padStart(2, '0')}`;
          usageByMonthMap.set(monthKey, (usageByMonthMap.get(monthKey) || 0) + 1);
        });

        const usageByMonth: UsageByMonth[] = Array.from(usageByMonthMap.entries())
          .map(([month, count]) => ({ month, count }))
          .sort((a, b) => a.month.localeCompare(b.month));

        // Get unique clients using this template
        const clientsUsing = await prisma.filledForm.groupBy({
          by: ['clientId'],
          where: { templateId, userId },
          _count: { id: true },
        });

        // Average completion time - not tracked currently, return null
        const averageCompletionTime: number | null = null;

        const analytics: TemplateAnalytics = {
          templateId: template.id,
          templateName: template.name,
          totalUsage,
          usageByMonth,
          averageCompletionTime,
          clientsUsing: clientsUsing.length,
        };

        res.json(analytics);
      } catch (error) {
        logger.error('Error fetching template analytics:', error);
        res.status(500).json({ error: 'Failed to fetch template analytics' });
      }
    }
  );

  /**
   * GET /api/form-analytics/trends
   * Returns usage trends for the last 30 days
   */
  router.get('/trends', authenticateSupabase, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get forms from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      const forms = await prisma.filledForm.findMany({
        where: {
          userId,
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      });

      // Group by day
      const dailyMap = new Map<string, number>();
      forms.forEach((form) => {
        const dateKey = form.createdAt.toISOString().split('T')[0];
        dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + 1);
      });

      // Fill in missing days with 0
      const daily: DailyUsage[] = [];
      const currentDate = new Date(thirtyDaysAgo);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      while (currentDate <= today) {
        const dateKey = currentDate.toISOString().split('T')[0];
        daily.push({
          date: dateKey,
          count: dailyMap.get(dateKey) || 0,
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Calculate weekly average
      const totalCount = daily.reduce((sum, d) => sum + d.count, 0);
      const weeklyAverage = Math.round((totalCount / 30) * 7 * 10) / 10;

      // Calculate trend (compare last 7 days to previous 7 days)
      const lastWeek = daily.slice(-7);
      const previousWeek = daily.slice(-14, -7);

      const lastWeekTotal = lastWeek.reduce((sum, d) => sum + d.count, 0);
      const previousWeekTotal = previousWeek.reduce((sum, d) => sum + d.count, 0);

      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (previousWeekTotal > 0) {
        const percentChange = ((lastWeekTotal - previousWeekTotal) / previousWeekTotal) * 100;
        if (percentChange > 10) {
          trend = 'up';
        } else if (percentChange < -10) {
          trend = 'down';
        }
      } else if (lastWeekTotal > 0) {
        trend = 'up';
      }

      const trends: UsageTrends = {
        daily,
        weeklyAverage,
        trend,
      };

      res.json(trends);
    } catch (error) {
      logger.error('Error fetching usage trends:', error);
      res.status(500).json({ error: 'Failed to fetch usage trends' });
    }
  });

  return router;
}
