/**
 * FormAnalytics Page
 *
 * Dashboard displaying form usage analytics with overview cards,
 * top templates ranking, and usage trend visualization.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Clock,
  Users,
  Loader2,
  RefreshCw,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { staggerContainer, fadeInUpSubtle } from '@/lib/animations';

import {
  useFormAnalyticsStore,
  selectIsAnyLoading,
  selectHasOverview,
  selectHasTrends,
} from '@/stores/formAnalyticsStore';
import type { TopTemplate, DailyUsage } from '@/services/formAnalyticsService';

// =================== CONSTANTS ===================

const statusBadgeVariant: Record<string, 'success' | 'warning' | 'info' | 'outline'> = {
  draft: 'warning',
  completed: 'success',
  submitted: 'info',
};

// =================== HELPER FUNCTIONS ===================

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(dateString);
}

function getTrendIcon(trend: 'up' | 'down' | 'stable') {
  switch (trend) {
    case 'up':
      return <TrendingUp className="h-4 w-4 text-success" />;
    case 'down':
      return <TrendingDown className="h-4 w-4 text-error" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

function getTrendLabel(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up':
      return 'Increasing';
    case 'down':
      return 'Decreasing';
    default:
      return 'Stable';
  }
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

function TemplateListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-3 animate-pulse">
          <div className="h-8 w-8 bg-muted rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 bg-muted rounded" />
            <div className="h-3 w-24 bg-muted rounded" />
          </div>
          <div className="h-6 w-16 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

function TrendsChartSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex justify-between items-center">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-4 w-24 bg-muted rounded" />
      </div>
      <div className="h-48 bg-muted rounded" />
    </div>
  );
}

// =================== OVERVIEW CARDS ===================

interface OverviewCardsProps {
  totalForms: number;
  formsThisMonth: number;
  formsThisWeek: number;
  statusBreakdown: {
    draft: number;
    completed: number;
    submitted: number;
  };
}

function OverviewCards({
  totalForms,
  formsThisMonth,
  formsThisWeek,
  statusBreakdown,
}: OverviewCardsProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="grid gap-4 md:grid-cols-3"
    >
      {/* Total Forms Card */}
      <motion.div variants={fadeInUpSubtle}>
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Forms Generated</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalForms.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formsThisMonth} this month / {formsThisWeek} this week
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Forms This Month Card */}
      <motion.div variants={fadeInUpSubtle}>
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Forms This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formsThisMonth.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formsThisWeek > 0 ? `${formsThisWeek} this week` : 'No forms this week'}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Status Breakdown Card */}
      <motion.div variants={fadeInUpSubtle}>
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status Breakdown</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant={statusBadgeVariant.draft}>{statusBreakdown.draft} Draft</Badge>
              <Badge variant={statusBadgeVariant.completed}>
                {statusBreakdown.completed} Completed
              </Badge>
              <Badge variant={statusBadgeVariant.submitted}>
                {statusBreakdown.submitted} Submitted
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// =================== TOP TEMPLATES LIST ===================

interface TopTemplatesListProps {
  templates: TopTemplate[];
  onSelectTemplate?: (templateId: string) => void;
}

function TopTemplatesList({ templates, onSelectTemplate }: TopTemplatesListProps) {
  if (templates.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No templates used yet"
        description="Generate forms from templates to see usage statistics here."
        size="sm"
      />
    );
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-2">
      {templates.map((template, index) => (
        <motion.div
          key={template.templateId}
          variants={fadeInUpSubtle}
          className={cn(
            'flex items-center gap-4 p-3 rounded-lg transition-colors',
            'hover:bg-muted/50 cursor-pointer'
          )}
          onClick={() => onSelectTemplate?.(template.templateId)}
        >
          {/* Rank Badge */}
          <div
            className={cn(
              'flex items-center justify-center h-8 w-8 rounded-full text-sm font-semibold',
              index === 0 && 'bg-primary/20 text-primary',
              index === 1 && 'bg-muted text-muted-foreground',
              index === 2 && 'bg-muted text-muted-foreground',
              index > 2 && 'bg-muted/50 text-muted-foreground'
            )}
          >
            {index + 1}
          </div>

          {/* Template Info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{template.templateName}</p>
            <p className="text-xs text-muted-foreground">
              Last used: {formatRelativeDate(template.lastUsed)}
            </p>
          </div>

          {/* Usage Count */}
          <Badge variant="secondary">{template.count} uses</Badge>
        </motion.div>
      ))}
    </motion.div>
  );
}

// =================== USAGE TRENDS CHART ===================

interface UsageTrendsChartProps {
  dailyUsage: DailyUsage[];
  weeklyAverage: number;
  trend: 'up' | 'down' | 'stable';
}

function UsageTrendsChart({ dailyUsage, weeklyAverage, trend }: UsageTrendsChartProps) {
  // Find the max count for scaling
  const maxCount = useMemo(() => {
    return Math.max(...dailyUsage.map((d) => d.count), 1);
  }, [dailyUsage]);

  // Take last 30 days or all available data
  const chartData = useMemo(() => {
    return dailyUsage.slice(-30);
  }, [dailyUsage]);

  if (chartData.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No usage data yet"
        description="Usage trends will appear here once you start generating forms."
        size="sm"
      />
    );
  }

  // Get key date labels (start, middle, end)
  const startDate = chartData[0]?.date;
  const middleDate = chartData[Math.floor(chartData.length / 2)]?.date;
  const endDate = chartData[chartData.length - 1]?.date;

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getTrendIcon(trend)}
          <span className="text-sm text-muted-foreground">{getTrendLabel(trend)} trend</span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Weekly avg: </span>
          <span className="font-medium">{weeklyAverage.toFixed(1)} forms</span>
        </div>
      </div>

      {/* CSS-based bar chart */}
      <div className="relative h-48 flex items-end gap-0.5">
        {chartData.map((day, index) => {
          const heightPercent = (day.count / maxCount) * 100;
          return (
            <div
              key={day.date}
              className="flex-1 group relative"
              title={`${formatDate(day.date)}: ${day.count} forms`}
            >
              <div
                className={cn(
                  'w-full rounded-t transition-all duration-200',
                  'bg-primary/60 hover:bg-primary',
                  day.count === 0 && 'bg-muted hover:bg-muted'
                )}
                style={{ height: `${Math.max(heightPercent, 2)}%` }}
              />
              {/* Tooltip on hover */}
              <div
                className={cn(
                  'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1',
                  'bg-popover text-popover-foreground text-xs rounded shadow-lg',
                  'opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none',
                  'whitespace-nowrap z-10'
                )}
              >
                {formatDate(day.date)}: {day.count} forms
              </div>
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span>{startDate ? formatDate(startDate) : ''}</span>
        <span>{middleDate ? formatDate(middleDate) : ''}</span>
        <span>{endDate ? formatDate(endDate) : ''}</span>
      </div>
    </div>
  );
}

// =================== TEMPLATE DETAILS PANEL ===================

interface TemplateDetailsPanelProps {
  templateId: string;
  onClose: () => void;
}

function TemplateDetailsPanel({ templateId, onClose }: TemplateDetailsPanelProps) {
  const selectedTemplate = useFormAnalyticsStore((state) => state.selectedTemplate);
  const templateLoading = useFormAnalyticsStore((state) => state.templateLoading);
  const selectTemplate = useFormAnalyticsStore((state) => state.selectTemplate);

  useEffect(() => {
    selectTemplate(templateId);
  }, [templateId, selectTemplate]);

  if (templateLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  if (!selectedTemplate) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <Card className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold">{selectedTemplate.templateName}</h3>
            <p className="text-sm text-muted-foreground">Template Analytics</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Usage</p>
              <p className="font-semibold">{selectedTemplate.totalUsage}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Clients Using</p>
              <p className="font-semibold">{selectedTemplate.clientsUsing}</p>
            </div>
          </div>

          {selectedTemplate.averageCompletionTime && (
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg. Completion</p>
                <p className="font-semibold">
                  {Math.round(selectedTemplate.averageCompletionTime / 60)}m
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

// =================== MAIN COMPONENT ===================

export default function FormAnalytics() {
  // Store state
  const overview = useFormAnalyticsStore((state) => state.overview);
  const trends = useFormAnalyticsStore((state) => state.trends);
  const loading = useFormAnalyticsStore((state) => state.loading);
  const trendsLoading = useFormAnalyticsStore((state) => state.trendsLoading);
  const error = useFormAnalyticsStore((state) => state.error);
  const fetchOverview = useFormAnalyticsStore((state) => state.fetchOverview);
  const fetchTrends = useFormAnalyticsStore((state) => state.fetchTrends);
  const clearSelectedTemplate = useFormAnalyticsStore((state) => state.clearSelectedTemplate);

  // Local state for selected template expansion
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Fetch data on mount
  useEffect(() => {
    fetchOverview();
    fetchTrends();
  }, [fetchOverview, fetchTrends]);

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId === selectedTemplateId ? null : templateId);
  };

  const handleCloseTemplateDetails = () => {
    setSelectedTemplateId(null);
    clearSelectedTemplate();
  };

  const handleRefresh = () => {
    fetchOverview();
    fetchTrends();
  };

  const isAnyLoading = loading || trendsLoading;

  return (
    <div className="space-y-6 max-w-7xl mx-auto" data-testid="form-analytics">
      {/* Page Header */}
      <PageHeader
        title="Form Analytics"
        description="Track form usage patterns and identify your most valuable templates."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Form Analytics' }]}
        actions={
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isAnyLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isAnyLoading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-error/50 bg-error/10 p-4 text-error">
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={handleRefresh}>
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
          <OverviewCards
            totalForms={overview.totalFormsGenerated}
            formsThisMonth={overview.formsThisMonth}
            formsThisWeek={overview.formsThisWeek}
            statusBreakdown={overview.statusBreakdown}
          />
        ) : (
          <EmptyState
            icon={BarChart3}
            title="No analytics data"
            description="Start generating forms to see analytics here."
          />
        )}
      </section>

      {/* Two Column Layout: Top Templates + Usage Trends */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Templates Section */}
        <section aria-labelledby="templates-heading">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Top Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TemplateListSkeleton />
              ) : overview?.topTemplates ? (
                <TopTemplatesList
                  templates={overview.topTemplates}
                  onSelectTemplate={handleSelectTemplate}
                />
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No templates used yet"
                  description="Generate forms from templates to see usage statistics."
                  size="sm"
                />
              )}
            </CardContent>
          </Card>
        </section>

        {/* Usage Trends Section */}
        <section aria-labelledby="trends-heading">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Usage Trends (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <TrendsChartSkeleton />
              ) : trends ? (
                <UsageTrendsChart
                  dailyUsage={trends.daily}
                  weeklyAverage={trends.weeklyAverage}
                  trend={trends.trend}
                />
              ) : (
                <EmptyState
                  icon={BarChart3}
                  title="No usage data"
                  description="Usage trends will appear here once you start generating forms."
                  size="sm"
                />
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Template Details Panel (expanded view) */}
      <AnimatePresence>
        {selectedTemplateId && (
          <TemplateDetailsPanel
            templateId={selectedTemplateId}
            onClose={handleCloseTemplateDetails}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
