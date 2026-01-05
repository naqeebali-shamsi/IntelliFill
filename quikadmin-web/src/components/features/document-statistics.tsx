/**
 * DocumentStatistics component - Displays document library statistics
 * Shows total documents, completed, processing, failed counts
 * @module components/features/document-statistics
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Files,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  HardDrive,
  Target,
  TrendingUp,
} from 'lucide-react';
import { DocumentStatistics as DocumentStatsType, formatFileSize } from '@/types/document';

export interface DocumentStatisticsProps {
  /**
   * Statistics data
   */
  statistics: DocumentStatsType;

  /**
   * Loading state
   */
  loading?: boolean;

  /**
   * Compact mode (smaller cards)
   */
  compact?: boolean;

  /**
   * Custom className
   */
  className?: string;
}

interface StatCard {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  variant: 'default' | 'success' | 'warning' | 'error' | 'info';
}

/**
 * DocumentStatistics component
 *
 * @example
 * ```tsx
 * const stats = getDocumentStats(documents);
 *
 * <DocumentStatistics
 *   statistics={stats}
 *   loading={isLoading}
 * />
 * ```
 */
export function DocumentStatistics({
  statistics,
  loading = false,
  compact = false,
  className,
}: DocumentStatisticsProps) {
  const statCards: StatCard[] = [
    {
      title: 'Total Documents',
      value: statistics.total,
      description: `${statistics.totalSize > 0 ? formatFileSize(statistics.totalSize) : '0 Bytes'} total`,
      icon: <Files className="h-4 w-4" />,
      variant: 'default',
    },
    {
      title: 'Completed',
      value: statistics.completed,
      description:
        statistics.successRate !== undefined
          ? `${statistics.successRate}% success rate`
          : undefined,
      icon: <CheckCircle className="h-4 w-4" />,
      variant: 'success',
    },
    {
      title: 'Processing',
      value: statistics.processing,
      description: statistics.processing > 0 ? 'Currently active' : 'No active jobs',
      icon: <Clock className="h-4 w-4" />,
      variant: 'info',
    },
    {
      title: 'Failed',
      value: statistics.failed,
      description: statistics.failed > 0 ? 'Needs attention' : 'All good',
      icon: <XCircle className="h-4 w-4" />,
      variant: 'error',
    },
  ];

  // Add additional stats if available
  if (statistics.pending > 0) {
    statCards.push({
      title: 'Pending',
      value: statistics.pending,
      description: 'Waiting to process',
      icon: <AlertCircle className="h-4 w-4" />,
      variant: 'warning',
    });
  }

  if (statistics.averageConfidence !== undefined && statistics.averageConfidence > 0) {
    statCards.push({
      title: 'Avg. Confidence',
      value: `${Math.round(statistics.averageConfidence * 100)}%`,
      description: 'Extraction accuracy',
      icon: <Target className="h-4 w-4" />,
      variant: 'info',
    });
  }

  return (
    <div
      className={cn(
        'grid gap-4',
        compact ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6',
        className
      )}
    >
      {loading
        ? // Loading skeletons
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
          ))
        : // Actual stat cards
          statCards.map((stat, index) => (
            <StatCardComponent
              key={index}
              {...stat}
              compact={compact}
              testId={`stat-card-documents-${index + 1}`}
            />
          ))}
    </div>
  );
}

/**
 * Individual stat card component
 */
interface StatCardComponentProps extends StatCard {
  compact?: boolean;
  testId?: string;
}

function StatCardComponent({
  title,
  value,
  description,
  icon,
  variant,
  compact = false,
  testId,
}: StatCardComponentProps) {
  const variantClasses = {
    default: 'text-muted-foreground',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400',
    info: 'text-blue-600 dark:text-blue-400',
  };

  return (
    <Card data-testid={testId}>
      <CardHeader
        className={cn(
          'flex flex-row items-center justify-between space-y-0',
          compact ? 'pb-1' : 'pb-2'
        )}
      >
        <CardTitle className={cn('font-medium', compact ? 'text-xs' : 'text-sm')}>
          {title}
        </CardTitle>
        <div className={cn(variantClasses[variant])}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={cn('font-bold', compact ? 'text-xl' : 'text-2xl')}>{value}</div>
        {description && (
          <p className={cn('text-muted-foreground', compact ? 'text-xs mt-0.5' : 'text-xs mt-1')}>
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * DocumentStatisticsSkeleton for loading states
 */
export function DocumentStatisticsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4 rounded" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
