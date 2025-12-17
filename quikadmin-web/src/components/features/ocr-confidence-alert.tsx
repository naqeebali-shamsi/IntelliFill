/**
 * OCRConfidenceAlert - Alerts users about OCR extraction quality
 * Surfaces confidence warnings with actionable suggestions
 * @module components/features/ocr-confidence-alert
 */

import * as React from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Confidence level thresholds
 */
const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85,
  MEDIUM: 0.70,
  LOW: 0.50,
} as const;

export interface OCRConfidenceAlertProps {
  /**
   * Confidence score (0-1)
   */
  confidence: number | null | undefined;

  /**
   * Show alert even for high confidence (default: false)
   */
  showAlways?: boolean;

  /**
   * Compact mode - less details
   */
  compact?: boolean;

  /**
   * Callback for reprocess action
   */
  onReprocess?: () => void;

  /**
   * Whether reprocessing is in progress
   */
  isReprocessing?: boolean;

  /**
   * Custom class name
   */
  className?: string;
}

/**
 * Gets the confidence level category
 */
function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' | 'very_low' {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  if (confidence >= CONFIDENCE_THRESHOLDS.LOW) return 'low';
  return 'very_low';
}

/**
 * Gets display info for confidence level
 */
function getConfidenceInfo(level: 'high' | 'medium' | 'low' | 'very_low') {
  switch (level) {
    case 'high':
      return {
        icon: CheckCircle2,
        title: 'High Confidence',
        description: 'The extracted data appears accurate and reliable.',
        color: 'text-green-600 dark:text-green-500',
        bgColor: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
        iconBg: 'bg-green-100 dark:bg-green-900/30',
        suggestion: null,
      };
    case 'medium':
      return {
        icon: Info,
        title: 'Medium Confidence',
        description: 'Some data may need manual verification. Please review before use.',
        color: 'text-amber-600 dark:text-amber-500',
        bgColor: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
        iconBg: 'bg-amber-100 dark:bg-amber-900/30',
        suggestion: 'Review extracted fields for accuracy.',
      };
    case 'low':
      return {
        icon: AlertTriangle,
        title: 'Low Confidence',
        description: 'The document may be blurry or poor quality. Data may be inaccurate.',
        color: 'text-orange-600 dark:text-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800',
        iconBg: 'bg-orange-100 dark:bg-orange-900/30',
        suggestion: 'Consider reprocessing or uploading a clearer scan.',
      };
    case 'very_low':
      return {
        icon: XCircle,
        title: 'Very Low Confidence',
        description: 'OCR could not reliably extract text. The document may be illegible or damaged.',
        color: 'text-red-600 dark:text-red-500',
        bgColor: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
        iconBg: 'bg-red-100 dark:bg-red-900/30',
        suggestion: 'Reprocess with enhanced settings or upload a higher quality scan.',
      };
  }
}

/**
 * OCRConfidenceAlert component
 *
 * Displays contextual alerts based on OCR confidence level to help users
 * understand data quality and take appropriate action.
 *
 * @example
 * ```tsx
 * <OCRConfidenceAlert
 *   confidence={document.confidence}
 *   onReprocess={handleReprocess}
 *   isReprocessing={isReprocessing}
 * />
 * ```
 */
export function OCRConfidenceAlert({
  confidence,
  showAlways = false,
  compact = false,
  onReprocess,
  isReprocessing = false,
  className,
}: OCRConfidenceAlertProps) {
  // Don't render if no confidence data
  if (confidence === null || confidence === undefined) {
    return null;
  }

  const level = getConfidenceLevel(confidence);
  const info = getConfidenceInfo(level);

  // Don't show alert for high confidence unless explicitly requested
  if (level === 'high' && !showAlways) {
    return null;
  }

  const Icon = info.icon;
  const confidencePercent = Math.round(confidence * 100);

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md text-sm',
          info.bgColor,
          className
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0', info.color)} />
        <span className={cn('font-medium', info.color)}>
          {confidencePercent}% confidence
        </span>
        {level !== 'high' && (
          <span className="text-muted-foreground">
            - {level === 'medium' ? 'verify data' : 'review recommended'}
          </span>
        )}
      </div>
    );
  }

  return (
    <Alert
      className={cn(
        'border',
        info.bgColor,
        className
      )}
    >
      <div className={cn('p-1.5 rounded-md', info.iconBg)}>
        <Icon className={cn('h-4 w-4', info.color)} />
      </div>
      <AlertTitle className={cn('flex items-center gap-2', info.color)}>
        {info.title}
        <span className="text-sm font-normal text-muted-foreground">
          ({confidencePercent}%)
        </span>
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{info.description}</p>
        {info.suggestion && (
          <p className="text-sm font-medium">{info.suggestion}</p>
        )}
        {onReprocess && (level === 'low' || level === 'very_low') && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReprocess}
            disabled={isReprocessing}
            className="mt-2"
          >
            <RefreshCw className={cn('h-3 w-3 mr-2', isReprocessing && 'animate-spin')} />
            {isReprocessing ? 'Reprocessing...' : 'Reprocess with Enhanced Settings'}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Inline confidence badge for compact displays
 */
export interface ConfidenceBadgeProps {
  confidence: number | null | undefined;
  showLabel?: boolean;
  className?: string;
}

export function ConfidenceBadge({
  confidence,
  showLabel = true,
  className,
}: ConfidenceBadgeProps) {
  if (confidence === null || confidence === undefined) {
    return null;
  }

  const level = getConfidenceLevel(confidence);
  const info = getConfidenceInfo(level);
  const Icon = info.icon;
  const confidencePercent = Math.round(confidence * 100);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        info.color,
        className
      )}
      title={`OCR Confidence: ${confidencePercent}% - ${info.title}`}
    >
      <Icon className="h-3 w-3" />
      {showLabel && <span>{confidencePercent}%</span>}
    </span>
  );
}

export { CONFIDENCE_THRESHOLDS };
