/**
 * ConfidenceBadge Component
 *
 * Displays confidence level with semantic labels instead of raw percentages.
 * Uses color-coded badges based on thresholds.
 *
 * @module components/smart-profile/ConfidenceBadge
 */

import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ConfidenceBadgeProps {
  /** Confidence value between 0 and 1 */
  confidence: number;
  /** Optional size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show icon */
  showIcon?: boolean;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85, // >= 85% - Verified
  MEDIUM: 0.6, // >= 60% - Review suggested
  // < 60% - Please verify
};

interface ConfidenceDisplay {
  level: ConfidenceLevel;
  label: string;
  icon: typeof CheckCircle2;
  colors: {
    bg: string;
    text: string;
    border: string;
  };
}

function getConfidenceDisplay(confidence: number): ConfidenceDisplay {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return {
      level: 'high',
      label: 'Verified',
      icon: CheckCircle2,
      colors: {
        bg: 'bg-status-success/10',
        text: 'text-status-success-foreground',
        border: 'border-status-success/30',
      },
    };
  }

  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return {
      level: 'medium',
      label: 'Review suggested',
      icon: AlertTriangle,
      colors: {
        bg: 'bg-status-warning/10',
        text: 'text-status-warning-foreground',
        border: 'border-status-warning/30',
      },
    };
  }

  return {
    level: 'low',
    label: 'Please verify',
    icon: AlertCircle,
    colors: {
      bg: 'bg-status-error/10',
      text: 'text-status-error-foreground',
      border: 'border-status-error/30',
    },
  };
}

// ============================================================================
// Component
// ============================================================================

const sizeClasses = {
  sm: 'text-xs px-1.5 py-0.5 gap-1',
  md: 'text-sm px-2 py-1 gap-1.5',
  lg: 'text-base px-3 py-1.5 gap-2',
};

const iconSizes = {
  sm: 12,
  md: 14,
  lg: 16,
};

/**
 * ConfidenceBadge displays AI/ML confidence levels with semantic labels.
 *
 * @example
 * ```tsx
 * // High confidence - shows green "Verified"
 * <ConfidenceBadge confidence={0.92} />
 *
 * // Medium confidence - shows yellow "Review suggested"
 * <ConfidenceBadge confidence={0.75} showIcon />
 *
 * // Low confidence - shows red "Please verify"
 * <ConfidenceBadge confidence={0.45} size="lg" />
 * ```
 */
export function ConfidenceBadge({
  confidence,
  size = 'md',
  showIcon = true,
  className,
}: ConfidenceBadgeProps) {
  const display = getConfidenceDisplay(confidence);
  const Icon = display.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        sizeClasses[size],
        display.colors.bg,
        display.colors.text,
        display.colors.border,
        className
      )}
    >
      {showIcon && <Icon size={iconSizes[size]} className="shrink-0" />}
      <span>{display.label}</span>
    </span>
  );
}

// ============================================================================
// Exports
// ============================================================================

export { getConfidenceDisplay, CONFIDENCE_THRESHOLDS };
export default ConfidenceBadge;
