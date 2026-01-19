/**
 * OCRConfidenceAlert - Alerts users about OCR extraction quality
 * Surfaces confidence warnings with actionable suggestions
 * @module components/features/ocr-confidence-alert
 */

import * as React from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, XCircle, RefreshCw, Info, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Confidence level thresholds
 */
const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85,
  MEDIUM: 0.7,
  LOW: 0.5,
} as const;

/**
 * Quality presets for OCR reprocessing
 */
export type QualityPreset = 'draft' | 'standard' | 'high';

export const QUALITY_PRESETS: Record<
  QualityPreset,
  { label: string; description: string; estimatedTime: string }
> = {
  draft: {
    label: 'Draft',
    description: 'Fast processing, lower accuracy',
    estimatedTime: '~30s',
  },
  standard: {
    label: 'Standard',
    description: 'Balanced speed and accuracy',
    estimatedTime: '~1 min',
  },
  high: {
    label: 'High Quality',
    description: 'Best accuracy, slower processing',
    estimatedTime: '~3 min',
  },
};

/**
 * Supported OCR languages
 */
export type SupportedLanguage =
  | 'eng'
  | 'ara'
  | 'fra'
  | 'deu'
  | 'spa'
  | 'ita'
  | 'por'
  | 'rus'
  | 'chi_sim'
  | 'jpn';

export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, string> = {
  eng: 'English',
  ara: 'Arabic',
  fra: 'French',
  deu: 'German',
  spa: 'Spanish',
  ita: 'Italian',
  por: 'Portuguese',
  rus: 'Russian',
  chi_sim: 'Chinese (Simplified)',
  jpn: 'Japanese',
};

/**
 * Reprocess options passed to callback
 */
export interface ReprocessOptions {
  quality: QualityPreset;
  language: SupportedLanguage;
}

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
   * Callback for reprocess action with quality options
   */
  onReprocess?: (options: ReprocessOptions) => void;

  /**
   * Whether reprocessing is in progress
   */
  isReprocessing?: boolean;

  /**
   * Show quality/language options (default: true for low confidence)
   */
  showOptions?: boolean;

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
        color: 'text-status-success-foreground',
        bgColor: 'bg-status-success/10 border-status-success/30',
        iconBg: 'bg-status-success/20',
        suggestion: null,
      };
    case 'medium':
      return {
        icon: Info,
        title: 'Medium Confidence',
        description: 'Some data may need manual verification. Please review before use.',
        color: 'text-status-warning-foreground',
        bgColor: 'bg-status-warning/10 border-status-warning/30',
        iconBg: 'bg-status-warning/20',
        suggestion: 'Review extracted fields for accuracy.',
      };
    case 'low':
      return {
        icon: AlertTriangle,
        title: 'Low Confidence',
        description: 'The document may be blurry or poor quality. Data may be inaccurate.',
        color: 'text-status-warning-foreground',
        bgColor: 'bg-status-warning/10 border-status-warning/30',
        iconBg: 'bg-status-warning/20',
        suggestion: 'Consider reprocessing or uploading a clearer scan.',
      };
    case 'very_low':
      return {
        icon: XCircle,
        title: 'Very Low Confidence',
        description:
          'OCR could not reliably extract text. The document may be illegible or damaged.',
        color: 'text-status-error-foreground',
        bgColor: 'bg-status-error/10 border-status-error/30',
        iconBg: 'bg-status-error/20',
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
 *   onReprocess={({ quality, language }) => handleReprocess(quality, language)}
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
  showOptions,
  className,
}: OCRConfidenceAlertProps) {
  const [quality, setQuality] = React.useState<QualityPreset>('standard');
  const [language, setLanguage] = React.useState<SupportedLanguage>('eng');
  const [showAdvanced, setShowAdvanced] = React.useState(false);

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

  // Determine if we should show options (default to true for low/very_low confidence)
  const shouldShowOptions = showOptions ?? (level === 'low' || level === 'very_low');

  const handleReprocess = () => {
    onReprocess?.({ quality, language });
  };

  function getReprocessButtonText(): string {
    if (isReprocessing) return 'Reprocessing...';
    if (showAdvanced) return `Reprocess (${QUALITY_PRESETS[quality].label})`;
    return 'Reprocess with Enhanced Settings';
  }

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
        <span className={cn('font-medium', info.color)}>{confidencePercent}% confidence</span>
        {level !== 'high' && (
          <span className="text-muted-foreground">
            - {level === 'medium' ? 'verify data' : 'review recommended'}
          </span>
        )}
      </div>
    );
  }

  return (
    <Alert className={cn('border', info.bgColor, className)}>
      <div className={cn('p-1.5 rounded-md', info.iconBg)}>
        <Icon className={cn('h-4 w-4', info.color)} />
      </div>
      <AlertTitle className={cn('flex items-center gap-2', info.color)}>
        {info.title}
        <span className="text-sm font-normal text-muted-foreground">({confidencePercent}%)</span>
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{info.description}</p>
        {info.suggestion && <p className="text-sm font-medium">{info.suggestion}</p>}

        {onReprocess && (level === 'low' || level === 'very_low') && (
          <div className="space-y-3 pt-2">
            {/* Quality options toggle */}
            {shouldShowOptions && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-muted-foreground hover:text-foreground p-0 h-auto"
              >
                <Settings2 className="h-3 w-3 mr-1" />
                {showAdvanced ? 'Hide' : 'Show'} quality options
              </Button>
            )}

            {/* Quality and language selectors */}
            {shouldShowOptions && showAdvanced && (
              <div className="flex flex-wrap gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Quality</label>
                  <Select value={quality} onValueChange={(v) => setQuality(v as QualityPreset)}>
                    <SelectTrigger className="w-[160px] h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.entries(QUALITY_PRESETS) as [
                          QualityPreset,
                          typeof QUALITY_PRESETS.draft,
                        ][]
                      ).map(([key, preset]) => (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center justify-between gap-2">
                            <span>{preset.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {preset.estimatedTime}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Language</label>
                  <Select
                    value={language}
                    onValueChange={(v) => setLanguage(v as SupportedLanguage)}
                  >
                    <SelectTrigger className="w-[160px] h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(SUPPORTED_LANGUAGES) as [SupportedLanguage, string][]).map(
                        ([code, name]) => (
                          <SelectItem key={code} value={code}>
                            {name}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Estimated time hint */}
            {shouldShowOptions && showAdvanced && (
              <p className="text-xs text-muted-foreground">
                Estimated processing time: {QUALITY_PRESETS[quality].estimatedTime}
              </p>
            )}

            {/* Reprocess button */}
            <Button variant="outline" size="sm" onClick={handleReprocess} disabled={isReprocessing}>
              <RefreshCw className={cn('h-3 w-3 mr-2', isReprocessing && 'animate-spin')} />
              {getReprocessButtonText()}
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

