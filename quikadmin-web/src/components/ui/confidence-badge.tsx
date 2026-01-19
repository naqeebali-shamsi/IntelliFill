/**
 * ConfidenceBadge Component
 *
 * Displays confidence level with honest semantic labels (not misleading "Verified").
 * Uses color-coded badges based on thresholds with tooltip showing actual percentage.
 *
 * Labels are intentionally transparent about AI uncertainty:
 * - "High confidence" (95%+) - Very likely correct but still AI-extracted
 * - "Good confidence" (85-94%) - Probably correct, worth a quick check
 * - "Review suggested" (70-84%) - Check this field before submission
 * - "Low confidence" (<70%) - Definitely needs manual verification
 *
 * @module components/ui/confidence-badge
 */

import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

/**
 * Confidence thresholds with honest semantic meaning.
 * Never use "Verified" - implies human verification which didn't happen.
 */
const CONFIDENCE_THRESHOLDS = {
  VERY_HIGH: 0.95, // >= 95% - High confidence (very likely correct)
  HIGH: 0.85, // >= 85% - Good confidence (probably correct)
  MEDIUM: 0.7, // >= 70% - Review suggested (check before submission)
  // < 70% - Low confidence (definitely verify)
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

/**
 * Get confidence display with honest, non-misleading labels.
 *
 * NEVER use: "Verified", "Confirmed", "Accurate" - these overstate certainty
 * and cause users to skip review, leading to form errors.
 */
function getConfidenceDisplay(confidence: number): ConfidenceDisplay {
  // 95%+ - High confidence (very likely correct, but still AI-extracted)
  if (confidence >= CONFIDENCE_THRESHOLDS.VERY_HIGH) {
    return {
      level: 'high',
      label: 'High confidence',
      icon: CheckCircle2,
      colors: {
        bg: 'bg-status-success/20',
        text: 'text-status-success-foreground',
        border: 'border-status-success/50',
      },
    };
  }

  // 85-94% - Good confidence (probably correct, worth a quick check)
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return {
      level: 'high',
      label: 'Good confidence',
      icon: CheckCircle2,
      colors: {
        bg: 'bg-status-success/20',
        text: 'text-status-success-foreground',
        border: 'border-status-success/50',
      },
    };
  }

  // 70-84% - Review suggested (check this field before submission)
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return {
      level: 'medium',
      label: 'Review suggested',
      icon: AlertTriangle,
      colors: {
        bg: 'bg-status-warning/20',
        text: 'text-status-warning-foreground',
        border: 'border-status-warning/50',
      },
    };
  }

  // <70% - Low confidence (definitely needs manual verification)
  return {
    level: 'low',
    label: 'Low confidence',
    icon: AlertCircle,
    colors: {
      bg: 'bg-status-error/20',
      text: 'text-status-error-foreground',
      border: 'border-status-error/50',
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
 * ConfidenceBadge displays AI extraction confidence with honest semantic labels.
 * Includes tooltip showing actual percentage for transparency.
 */
export function ConfidenceBadge({
  confidence,
  size = 'md',
  showIcon = true,
  className,
}: ConfidenceBadgeProps) {
  const display = getConfidenceDisplay(confidence);
  const Icon = display.icon;
  const percentageText = `${Math.round(confidence * 100)}% extraction confidence`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex max-w-full min-w-0 items-center rounded-full border font-medium cursor-help',
              sizeClasses[size],
              display.colors.bg,
              display.colors.text,
              display.colors.border,
              className
            )}
          >
            {showIcon && <Icon size={iconSizes[size]} className="shrink-0" />}
            <span className="truncate whitespace-nowrap leading-none">{display.label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{percentageText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Exports
// ============================================================================

export { getConfidenceDisplay, CONFIDENCE_THRESHOLDS };
export default ConfidenceBadge;
