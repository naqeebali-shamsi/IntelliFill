/**
 * AdminAccuracyDashboard Page
 *
 * Admin-only dashboard for OCR accuracy metrics, AI agent performance comparison,
 * and user feedback review. Provides visibility for quality improvement.
 */

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  FileCheck,
  Star,
  Clock,
  BarChart3,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { staggerContainer, fadeInUpSubtle } from '@/lib/animations';

import { useBackendAuthStore } from '@/stores/backendAuthStore';
import {
  adminService,
  type AccuracyOverview,
  type AgentPerformance,
  type FeedbackItem,
  type FeedbackResponse,
} from '@/services/adminService';

// =================== HELPER FUNCTIONS ===================

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getTrendIcon(value: number, threshold = 0) {
  if (value > threshold + 5) {
    return <TrendingUp className="h-4 w-4 text-status-success" />;
  }
  if (value < threshold - 5) {
    return <TrendingDown className="h-4 w-4 text-status-error" />;
  }
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'text-status-success';
  if (confidence >= 0.75) return 'text-status-warning';
  return 'text-status-error';
}

function getPerformanceColor(successRate: number): string {
  if (successRate >= 95) return 'bg-status-success/20 text-status-success';
  if (successRate >= 80) return 'bg-status-warning/20 text-status-warning';
  return 'bg-status-error/20 text-status-error';
}

// =================== SKELETON COMPONENTS ===================

function OverviewCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-2">
        <div className="h-4 w-24 bg-muted rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-16 bg-muted rounded mb-2" />
        <div className="h-3 w-32 bg-muted rounded" />
      </CardContent>
    </Card>
  );
}

function AgentTableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-4 p-3 animate-pulse">
          <div className="h-8 w-32 bg-muted rounded" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 bg-muted rounded" />
          </div>
          <div className="h-6 w-16 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

function TrendChartSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 w-32 bg-muted rounded" />
      <div className="h-32 bg-muted rounded" />
    </div>
  );
}

// =================== OVERVIEW CARDS ===================

interface OverviewCardsProps {
  overview: AccuracyOverview;
}

function OverviewCards({ overview }: OverviewCardsProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="grid gap-4 md:grid-cols-3"
    >
      {/* Overall Accuracy Card */}
      <motion.div variants={fadeInUpSubtle}>
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Accuracy</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">{overview.overallAccuracy.toFixed(1)}%</span>
              {getTrendIcon(overview.overallAccuracy, 80)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on {overview.totalFeedbackCount} user feedback entries
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Average Confidence Card */}
      <motion.div variants={fadeInUpSubtle}>
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Confidence</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-3xl font-bold',
                  getConfidenceColor(overview.averageConfidence / 100)
                )}
              >
                {(overview.averageConfidence * 100).toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">OCR extraction confidence score</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Feedback Count Card */}
      <motion.div variants={fadeInUpSubtle}>
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Feedback</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overview.totalFeedbackCount.toLocaleString()}</div>
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(overview.feedbackByRating)
                .sort(([a], [b]) => Number(b) - Number(a))
                .map(([rating, count]) => (
                  <Badge key={rating} variant="secondary" className="text-xs">
                    {rating}
                    <Star className="h-3 w-3 ml-0.5 inline" /> ({count})
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// =================== ACCURACY TREND CHART ===================

interface AccuracyTrendChartProps {
  trend: Array<{ date: string; accuracy: number }>;
}

function AccuracyTrendChart({ trend }: AccuracyTrendChartProps) {
  const maxAccuracy = useMemo(() => Math.max(...trend.map((d) => d.accuracy), 1), [trend]);

  if (trend.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No trend data yet"
        description="Accuracy trends will appear here after users submit feedback."
        size="sm"
      />
    );
  }

  const chartData = trend.slice(-30);
  const startDate = chartData[0]?.date;
  const endDate = chartData[chartData.length - 1]?.date;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Last 30 days</span>
        <span>Max: {maxAccuracy.toFixed(0)}%</span>
      </div>

      <div className="relative h-32 flex items-end gap-0.5">
        {chartData.map((day) => {
          const heightPercent = (day.accuracy / 100) * 100;
          const isLowAccuracy = day.accuracy < 70;
          return (
            <div
              key={day.date}
              className="flex-1 group relative"
              title={`${formatDate(day.date)}: ${day.accuracy.toFixed(1)}%`}
            >
              <div
                className={cn(
                  'w-full rounded-t transition-all duration-200',
                  isLowAccuracy
                    ? 'bg-status-error/60 hover:bg-status-error'
                    : 'bg-primary/60 hover:bg-primary'
                )}
                style={{ height: `${Math.max(heightPercent, 2)}%` }}
              />
              <div
                className={cn(
                  'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1',
                  'bg-popover text-popover-foreground text-xs rounded shadow-lg',
                  'opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none',
                  'whitespace-nowrap z-10'
                )}
              >
                {formatDate(day.date)}: {day.accuracy.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span>{startDate ? formatDate(startDate) : ''}</span>
        <span>{endDate ? formatDate(endDate) : ''}</span>
      </div>
    </div>
  );
}

// =================== AGENT PERFORMANCE TABLE ===================

interface AgentPerformanceTableProps {
  performance: AgentPerformance;
}

function AgentPerformanceTable({ performance }: AgentPerformanceTableProps) {
  const [sortKey, setSortKey] = useState<keyof AgentPerformance['agents'][0]>('totalProcessed');
  const [sortAsc, setSortAsc] = useState(false);

  const sortedAgents = useMemo(() => {
    return [...performance.agents].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return sortAsc
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [performance.agents, sortKey, sortAsc]);

  const handleSort = (key: keyof AgentPerformance['agents'][0]) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: keyof AgentPerformance['agents'][0] }) => {
    if (sortKey !== columnKey) return null;
    return sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  if (performance.agents.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No agent data yet"
        description="Agent performance metrics will appear here after documents are processed."
        size="sm"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th
              className="text-left py-2 px-2 font-medium cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('agentName')}
            >
              <span className="flex items-center gap-1">
                Agent <SortIcon columnKey="agentName" />
              </span>
            </th>
            <th
              className="text-right py-2 px-2 font-medium cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('totalProcessed')}
            >
              <span className="flex items-center justify-end gap-1">
                Processed <SortIcon columnKey="totalProcessed" />
              </span>
            </th>
            <th
              className="text-right py-2 px-2 font-medium cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('successRate')}
            >
              <span className="flex items-center justify-end gap-1">
                Success <SortIcon columnKey="successRate" />
              </span>
            </th>
            <th
              className="text-right py-2 px-2 font-medium cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('avgProcessingTimeMs')}
            >
              <span className="flex items-center justify-end gap-1">
                Avg Time <SortIcon columnKey="avgProcessingTimeMs" />
              </span>
            </th>
            <th
              className="text-right py-2 px-2 font-medium cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('avgConfidenceScore')}
            >
              <span className="flex items-center justify-end gap-1">
                Confidence <SortIcon columnKey="avgConfidenceScore" />
              </span>
            </th>
            <th
              className="text-right py-2 px-2 font-medium cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('avgQualityScore')}
            >
              <span className="flex items-center justify-end gap-1">
                Quality <SortIcon columnKey="avgQualityScore" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedAgents.map((agent, index) => (
            <tr
              key={agent.agentName}
              className={cn('border-b last:border-0', index === 0 && 'bg-primary/5')}
            >
              <td className="py-2 px-2 font-medium">{agent.agentName}</td>
              <td className="py-2 px-2 text-right">{agent.totalProcessed.toLocaleString()}</td>
              <td className="py-2 px-2 text-right">
                <Badge className={cn('text-xs', getPerformanceColor(agent.successRate))}>
                  {agent.successRate.toFixed(1)}%
                </Badge>
              </td>
              <td className="py-2 px-2 text-right text-muted-foreground">
                <span className="flex items-center justify-end gap-1">
                  <Clock className="h-3 w-3" />
                  {(agent.avgProcessingTimeMs / 1000).toFixed(1)}s
                </span>
              </td>
              <td
                className={cn('py-2 px-2 text-right', getConfidenceColor(agent.avgConfidenceScore))}
              >
                {(agent.avgConfidenceScore * 100).toFixed(0)}%
              </td>
              <td className={cn('py-2 px-2 text-right', getConfidenceColor(agent.avgQualityScore))}>
                {(agent.avgQualityScore * 100).toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =================== DOCUMENT CATEGORY BREAKDOWN ===================

interface CategoryBreakdownProps {
  categories: Array<{ category: string; count: number; avgConfidence: number }>;
}

function CategoryBreakdown({ categories }: CategoryBreakdownProps) {
  if (categories.length === 0) {
    return (
      <EmptyState
        icon={FileCheck}
        title="No category data"
        description="Document categories will appear here after processing."
        size="sm"
      />
    );
  }

  const maxCount = Math.max(...categories.map((c) => c.count), 1);

  return (
    <div className="space-y-3">
      {categories.map((cat) => (
        <div key={cat.category} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium capitalize">{cat.category}</span>
            <span className="text-muted-foreground">
              {cat.count} docs ({(cat.avgConfidence * 100).toFixed(0)}% conf)
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(cat.count / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// =================== FEEDBACK TABLE ===================

interface FeedbackTableProps {
  feedbackData: FeedbackResponse;
  onLoadMore: () => void;
  loadingMore: boolean;
}

function FeedbackTable({ feedbackData, onLoadMore, loadingMore }: FeedbackTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const hasMore = feedbackData.offset + feedbackData.feedback.length < feedbackData.total;

  if (feedbackData.feedback.length === 0) {
    return (
      <EmptyState
        icon={Star}
        title="No feedback yet"
        description="User feedback will appear here as they rate extraction results."
        size="sm"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {feedbackData.feedback.map((item) => (
          <div
            key={item.id}
            className={cn(
              'border rounded-lg p-3 transition-colors',
              expandedId === item.id && 'bg-muted/50'
            )}
          >
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
            >
              <div className="flex items-center gap-3">
                {/* Rating Stars */}
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        'h-4 w-4',
                        star <= item.accuracyRating ? 'text-amber-400 fill-amber-400' : 'text-muted'
                      )}
                    />
                  ))}
                </div>
                {/* Correct Badge */}
                <Badge variant={item.isCorrect ? 'success' : 'destructive'} className="gap-1">
                  {item.isCorrect ? (
                    <>
                      <CheckCircle className="h-3 w-3" /> Correct
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" /> Incorrect
                    </>
                  )}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{formatDateTime(item.createdAt)}</span>
                {expandedId === item.id ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </div>

            {expandedId === item.id && (
              <div className="mt-3 pt-3 border-t text-sm space-y-2">
                <div className="flex gap-4">
                  <span className="text-muted-foreground">User:</span>
                  <span className="font-mono text-xs">{item.userId.slice(0, 8)}...</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-muted-foreground">Document:</span>
                  <span className="font-mono text-xs">{item.documentId.slice(0, 8)}...</span>
                </div>
                {item.comments && (
                  <div className="flex gap-4">
                    <span className="text-muted-foreground">Comments:</span>
                    <span className="text-foreground">{item.comments}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Load More ({feedbackData.total -
              feedbackData.offset -
              feedbackData.feedback.length}{' '}
            remaining)
          </Button>
        </div>
      )}
    </div>
  );
}

// =================== ACCESS DENIED COMPONENT ===================

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <div className="p-4 rounded-full bg-status-error/10 mb-4">
        <Shield className="h-12 w-12 text-status-error" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
      <p className="text-muted-foreground max-w-md">
        This dashboard is only available to administrators. Please contact your administrator if you
        believe you should have access.
      </p>
    </div>
  );
}

// =================== MAIN COMPONENT ===================

export default function AdminAccuracyDashboard() {
  // Auth state
  const user = useBackendAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'admin';

  // Data state
  const [overview, setOverview] = useState<AccuracyOverview | null>(null);
  const [performance, setPerformance] = useState<AgentPerformance | null>(null);
  const [feedbackData, setFeedbackData] = useState<FeedbackResponse | null>(null);

  // Loading state
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [overviewRes, performanceRes, feedbackRes] = await Promise.all([
        adminService.getAccuracyOverview(),
        adminService.getAgentPerformance(),
        adminService.getFeedback({ limit: 20, offset: 0 }),
      ]);

      setOverview(overviewRes);
      setPerformance(performanceRes);
      setFeedbackData(feedbackRes);
    } catch (err) {
      if (adminService.isAccessDeniedError(err)) {
        setError('Access denied. Admin privileges required.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMoreFeedback = async () => {
    if (!feedbackData) return;

    setLoadingMore(true);
    try {
      const newOffset = feedbackData.offset + feedbackData.limit;
      const more = await adminService.getFeedback({ limit: 20, offset: newOffset });

      setFeedbackData({
        ...more,
        feedback: [...feedbackData.feedback, ...more.feedback],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more feedback');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  // Access control check
  if (!isAdmin) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto" data-testid="admin-accuracy-dashboard">
        <PageHeader
          title="Accuracy Dashboard"
          description="Admin-only OCR accuracy and AI performance metrics"
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Admin' },
            { label: 'Accuracy Dashboard' },
          ]}
        />
        <AccessDenied />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto" data-testid="admin-accuracy-dashboard">
      {/* Page Header */}
      <PageHeader
        title="Accuracy Dashboard"
        description="Monitor OCR accuracy, AI agent performance, and user feedback."
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Admin' },
          { label: 'Accuracy Dashboard' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3 w-3" />
              Admin
            </Badge>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-status-error/50 bg-status-error/10 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-status-error flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-status-error">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            Try Again
          </Button>
        </div>
      )}

      {/* Overview Cards */}
      <section aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="sr-only">
          Overview Statistics
        </h2>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            <OverviewCardSkeleton />
            <OverviewCardSkeleton />
            <OverviewCardSkeleton />
          </div>
        ) : overview ? (
          <OverviewCards overview={overview} />
        ) : (
          <EmptyState
            icon={BarChart3}
            title="No overview data"
            description="Accuracy metrics will appear here after documents are processed."
          />
        )}
      </section>

      {/* Two Column Layout: Trend + Categories */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Accuracy Trend Section */}
        <section aria-labelledby="trend-heading">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Accuracy Trend (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TrendChartSkeleton />
              ) : overview?.accuracyTrend ? (
                <AccuracyTrendChart trend={overview.accuracyTrend} />
              ) : (
                <EmptyState
                  icon={TrendingUp}
                  title="No trend data"
                  description="Accuracy trends will appear after user feedback."
                  size="sm"
                />
              )}
            </CardContent>
          </Card>
        </section>

        {/* Document Categories Section */}
        <section aria-labelledby="categories-heading">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Document Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TrendChartSkeleton />
              ) : overview?.documentsByCategory ? (
                <CategoryBreakdown categories={overview.documentsByCategory} />
              ) : (
                <EmptyState
                  icon={FileCheck}
                  title="No category data"
                  description="Categories will appear after processing."
                  size="sm"
                />
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Agent Performance Section */}
      <section aria-labelledby="agents-heading">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              AI Agent Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <AgentTableSkeleton />
            ) : performance ? (
              <AgentPerformanceTable performance={performance} />
            ) : (
              <EmptyState
                icon={Users}
                title="No agent data"
                description="Agent metrics will appear after processing."
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Recent Feedback Section */}
      <section aria-labelledby="feedback-heading">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Recent User Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <AgentTableSkeleton />
            ) : feedbackData ? (
              <FeedbackTable
                feedbackData={feedbackData}
                onLoadMore={handleLoadMoreFeedback}
                loadingMore={loadingMore}
              />
            ) : (
              <EmptyState
                icon={Star}
                title="No feedback yet"
                description="User feedback will appear as they rate results."
              />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
