/**
 * StatCard - Unified statistics card component
 *
 * A reusable card component for displaying statistics with:
 * - Variant-based color theming (default, success, warning, error)
 * - Loading skeleton state
 * - Framer Motion entrance animations
 * - Decorative background icon
 *
 * Unifies patterns from:
 * - Templates.tsx (glass-panel, background icon, motion)
 * - History.tsx (circular icon container, loading state)
 * - document-statistics.tsx (variants, compact mode)
 *
 * @module components/features/stat-card
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/lib/animations';

/**
 * StatCard component props
 */
export interface StatCardProps {
  /** Title label for the statistic */
  title: string;

  /** The main value to display */
  value: string | number;

  /** Optional description or subtitle text */
  description?: string;

  /** Lucide icon component to display */
  icon: LucideIcon;

  /** Color variant for theming */
  variant?: 'default' | 'success' | 'warning' | 'error';

  /** Show loading skeleton state */
  loading?: boolean;

  /** Animation delay in seconds for staggered entrance */
  animationDelay?: number;

  /** Additional CSS classes */
  className?: string;

  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Variant color configurations
 */
const variantStyles = {
  default: {
    icon: 'text-primary',
    iconBg: 'bg-primary/10 border-primary/20',
    decorative: 'text-muted-foreground/5',
  },
  success: {
    icon: 'text-emerald-500 dark:text-emerald-400',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    decorative: 'text-emerald-500/5',
  },
  warning: {
    icon: 'text-amber-500 dark:text-amber-400',
    iconBg: 'bg-amber-500/10 border-amber-500/20',
    decorative: 'text-amber-500/5',
  },
  error: {
    icon: 'text-red-500 dark:text-red-400',
    iconBg: 'bg-red-500/10 border-red-500/20',
    decorative: 'text-red-500/5',
  },
} as const;

/**
 * Loading skeleton component for StatCard
 */
function StatCardSkeleton({
  className,
  'data-testid': testId,
}: Pick<StatCardProps, 'className' | 'data-testid'>) {
  return (
    <div
      className={cn('glass-panel p-6 rounded-xl relative overflow-hidden', className)}
      data-testid={testId}
      role="status"
      aria-label="Loading statistic..."
    >
      {/* Decorative background skeleton */}
      <div className="absolute top-0 right-0 p-4">
        <div className="h-16 w-16 rounded-full bg-muted/20 animate-pulse" />
      </div>

      <div className="relative z-10 space-y-3">
        {/* Title skeleton */}
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-muted/30 animate-pulse" />
          <div className="h-4 w-24 rounded bg-muted/30 animate-pulse" />
        </div>

        {/* Value skeleton */}
        <div className="h-8 w-20 rounded bg-muted/20 animate-pulse" />

        {/* Description skeleton */}
        <div className="h-3 w-32 rounded bg-muted/10 animate-pulse" />
      </div>

      <span className="sr-only">Loading...</span>
    </div>
  );
}

/**
 * StatCard Component
 *
 * A unified statistics card with entrance animation, variant theming,
 * and loading state support.
 *
 * @example
 * ```tsx
 * import { StatCard } from '@/components/features/stat-card';
 * import { FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';
 *
 * // Basic usage
 * <StatCard
 *   title="Total Documents"
 *   value={42}
 *   description="Uploaded this month"
 *   icon={FileText}
 * />
 *
 * // With variant
 * <StatCard
 *   title="Completed"
 *   value={38}
 *   description="95% success rate"
 *   icon={CheckCircle}
 *   variant="success"
 * />
 *
 * // With animation delay (for staggered grid)
 * <StatCard
 *   title="Processing"
 *   value={3}
 *   icon={Clock}
 *   variant="warning"
 *   animationDelay={0.2}
 * />
 *
 * // Loading state
 * <StatCard
 *   title="Failed"
 *   value={1}
 *   icon={AlertCircle}
 *   variant="error"
 *   loading={isLoading}
 * />
 * ```
 */
export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  variant = 'default',
  loading = false,
  animationDelay = 0,
  className,
  'data-testid': testId,
}: StatCardProps) {
  // Show skeleton during loading
  if (loading) {
    return <StatCardSkeleton className={className} data-testid={testId} />;
  }

  const styles = variantStyles[variant];

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={fadeInUp}
      transition={{ delay: animationDelay, duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'glass-panel p-6 rounded-xl relative overflow-hidden group',
        'hover:border-primary/20 transition-colors',
        className
      )}
      data-testid={testId}
    >
      {/* Decorative background icon */}
      <div
        className={cn(
          'absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity',
          styles.decorative
        )}
        aria-hidden="true"
      >
        <Icon className="h-16 w-16 -rotate-12" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header with icon and title */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center border',
              styles.iconBg
            )}
          >
            <Icon className={cn('h-4 w-4', styles.icon)} />
          </div>
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
        </div>

        {/* Value */}
        <div className="text-3xl font-heading font-bold text-foreground mb-1">{value}</div>

        {/* Description */}
        {description && <p className="text-xs text-muted-foreground/80">{description}</p>}
      </div>
    </motion.div>
  );
}

// Default export for convenience
export default StatCard;
