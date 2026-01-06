import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  type LucideIcon,
} from 'lucide-react';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors',
  {
    variants: {
      status: {
        pending:
          'bg-[var(--status-pending-bg)] text-[var(--status-pending-text)] border-[var(--status-pending-border)]',
        processing:
          'bg-[var(--status-processing-bg)] text-[var(--status-processing-text)] border-[var(--status-processing-border)]',
        completed:
          'bg-[var(--status-done-bg)] text-[var(--status-done-text)] border-[var(--status-done-border)]',
        success:
          'bg-[var(--status-done-bg)] text-[var(--status-done-text)] border-[var(--status-done-border)]',
        failed:
          'bg-[var(--status-failed-bg)] text-[var(--status-failed-text)] border-[var(--status-failed-border)]',
        error:
          'bg-[var(--status-failed-bg)] text-[var(--status-failed-text)] border-[var(--status-failed-border)]',
        warning:
          'bg-[var(--feedback-warning-light)] text-[var(--feedback-warning-text)] border-[var(--feedback-warning-border)]',
        info: 'bg-[var(--feedback-info-light)] text-[var(--feedback-info-text)] border-[var(--feedback-info-border)]',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-sm',
        lg: 'px-3 py-1.5 text-base',
      },
    },
    defaultVariants: {
      status: 'pending',
      size: 'md',
    },
  }
);

const statusIconMap: Record<string, LucideIcon> = {
  pending: Clock,
  processing: Loader2,
  completed: CheckCircle2,
  success: CheckCircle2,
  failed: XCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof statusBadgeVariants> {
  /**
   * Whether to show the status icon
   */
  showIcon?: boolean;
  /**
   * Custom icon to override the default
   */
  icon?: LucideIcon;
  /**
   * Custom label (if not provided, uses status as label)
   */
  label?: string;
}

/**
 * StatusBadge component for displaying status indicators.
 *
 * @example
 * // Basic status badge
 * <StatusBadge status="completed" />
 *
 * @example
 * // With custom label and icon
 * <StatusBadge status="processing" label="Uploading" showIcon />
 *
 * @example
 * // Different sizes
 * <StatusBadge status="error" size="sm" showIcon />
 * <StatusBadge status="success" size="lg" showIcon />
 */
function StatusBadge({
  status,
  size,
  showIcon = true,
  icon,
  label,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  const Icon = icon || statusIconMap[status || 'pending'];
  const displayLabel = label || children || (status ? capitalizeFirst(status) : '');
  const isProcessing = status === 'processing';

  return (
    <div
      data-slot="status-badge"
      className={cn(statusBadgeVariants({ status, size }), className)}
      role="status"
      aria-label={`Status: ${displayLabel}`}
      {...props}
    >
      {showIcon && Icon && (
        <Icon
          className={cn(
            'shrink-0',
            size === 'sm' && 'h-3 w-3',
            size === 'md' && 'h-3.5 w-3.5',
            size === 'lg' && 'h-4 w-4',
            isProcessing && 'animate-spin'
          )}
          aria-hidden="true"
        />
      )}
      {displayLabel && <span>{displayLabel}</span>}
    </div>
  );
}

/**
 * StatusDot component for minimal status indicators.
 */
export interface StatusDotProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Status variant
   */
  status:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'success'
    | 'failed'
    | 'error'
    | 'warning'
    | 'info';
  /**
   * Size of the dot
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Whether the dot should pulse (for processing/active states)
   */
  pulse?: boolean;
}

/**
 * StatusDot component for minimal status displays.
 *
 * @example
 * <div className="flex items-center gap-2">
 *   <StatusDot status="success" />
 *   <span>Online</span>
 * </div>
 */
function StatusDot({ status, size = 'md', pulse = false, className, ...props }: StatusDotProps) {
  const colorMap = {
    pending: 'bg-[var(--status-pending-dot)]',
    processing: 'bg-[var(--status-processing-dot)]',
    completed: 'bg-[var(--status-done-dot)]',
    success: 'bg-[var(--status-done-dot)]',
    failed: 'bg-[var(--status-failed-dot)]',
    error: 'bg-[var(--status-failed-dot)]',
    warning: 'bg-[var(--feedback-warning)]',
    info: 'bg-[var(--feedback-info)]',
  };

  const sizeMap = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  };

  const isProcessing = status === 'processing';

  return (
    <div
      data-slot="status-dot"
      className={cn(
        'rounded-full shrink-0',
        colorMap[status],
        sizeMap[size],
        pulse && 'animate-pulse',
        isProcessing && !pulse && 'animate-pulse',
        className
      )}
      role="status"
      aria-label={`Status: ${status}`}
      {...props}
    />
  );
}

// Helper function to capitalize first letter
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export { StatusBadge, StatusDot, statusBadgeVariants };
