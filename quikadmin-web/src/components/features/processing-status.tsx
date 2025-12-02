/**
 * ProcessingStatus component for displaying real-time document processing status
 * @module components/features/processing-status
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { StatusBadge } from "@/components/features/status-badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  X,
  Clock,
  Loader2,
  type LucideIcon,
} from "lucide-react"

export type ProcessingStatusType = "pending" | "processing" | "completed" | "failed" | "cancelled"

export interface ProcessingStatusProps {
  /**
   * Current status
   */
  status: ProcessingStatusType
  /**
   * Progress percentage (0-100)
   */
  progress?: number
  /**
   * Job ID for tracking
   */
  jobId?: string
  /**
   * Error message (if failed)
   */
  error?: string
  /**
   * Success message (if completed)
   */
  successMessage?: string
  /**
   * Retry handler
   */
  onRetry?: () => void
  /**
   * Cancel handler
   */
  onCancel?: () => void
  /**
   * File name being processed
   */
  fileName?: string
  /**
   * Processing metadata
   */
  metadata?: {
    confidence?: number
    processingTime?: number
    pageCount?: number
    extractedFields?: number
  }
  /**
   * Show detailed information
   */
  showDetails?: boolean
  /**
   * Custom className
   */
  className?: string
}

const statusConfig: Record<
  ProcessingStatusType,
  { icon: LucideIcon; label: string; color: string }
> = {
  pending: { icon: Clock, label: "Pending", color: "text-gray-600" },
  processing: { icon: Loader2, label: "Processing", color: "text-blue-600" },
  completed: { icon: CheckCircle2, label: "Completed", color: "text-green-600" },
  failed: { icon: AlertCircle, label: "Failed", color: "text-red-600" },
  cancelled: { icon: X, label: "Cancelled", color: "text-gray-600" },
}

/**
 * ProcessingStatus component for displaying document processing status with real-time updates.
 *
 * @example
 * // Basic usage
 * <ProcessingStatus
 *   status="processing"
 *   progress={45}
 *   fileName="invoice.pdf"
 * />
 *
 * @example
 * // With retry and error handling
 * <ProcessingStatus
 *   status="failed"
 *   error="Processing timeout"
 *   onRetry={handleRetry}
 *   fileName="document.pdf"
 * />
 *
 * @example
 * // With metadata
 * <ProcessingStatus
 *   status="completed"
 *   progress={100}
 *   fileName="form.pdf"
 *   metadata={{
 *     confidence: 0.95,
 *     processingTime: 2.3,
 *     extractedFields: 12
 *   }}
 *   showDetails
 * />
 */
export function ProcessingStatus({
  status,
  progress,
  jobId,
  error,
  successMessage,
  onRetry,
  onCancel,
  fileName,
  metadata,
  showDetails = false,
  className,
}: ProcessingStatusProps) {
  const config = statusConfig[status]
  const Icon = config.icon
  const isProcessing = status === "processing"
  const isPending = status === "pending"
  const isFailed = status === "failed"
  const isCompleted = status === "completed"

  return (
    <div
      data-slot="processing-status"
      className={cn("space-y-3", className)}
    >
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "rounded-full p-2",
              isProcessing && "bg-blue-100 dark:bg-blue-950",
              isCompleted && "bg-green-100 dark:bg-green-950",
              isFailed && "bg-red-100 dark:bg-red-950",
              isPending && "bg-gray-100 dark:bg-gray-900"
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5",
                config.color,
                isProcessing && "animate-spin"
              )}
              aria-hidden="true"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <StatusBadge status={status === 'cancelled' ? 'failed' : status} showIcon={false} size="sm" />
              {fileName && (
                <span className="text-sm font-medium text-foreground">
                  {fileName}
                </span>
              )}
            </div>
            {jobId && showDetails && (
              <p className="text-xs text-muted-foreground mt-1">
                Job ID: {jobId}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isFailed && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              aria-label="Retry processing"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          )}
          {(isProcessing || isPending) && onCancel && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              aria-label="Cancel processing"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {(isProcessing || isPending) && progress !== undefined && (
        <Progress
          value={progress}
          showPercentage
          label={isProcessing ? "Processing..." : "Waiting..."}
          variant="default"
          indeterminate={isPending}
        />
      )}

      {/* Error Alert */}
      {isFailed && error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Processing Failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Success Message */}
      {isCompleted && successMessage && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Processing Complete</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Metadata Details */}
      {isCompleted && showDetails && metadata && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          {metadata.confidence !== undefined && (
            <div>
              <p className="text-xs text-muted-foreground">Confidence</p>
              <p className="text-sm font-medium">
                {Math.round(metadata.confidence * 100)}%
              </p>
            </div>
          )}
          {metadata.processingTime !== undefined && (
            <div>
              <p className="text-xs text-muted-foreground">Processing Time</p>
              <p className="text-sm font-medium">
                {metadata.processingTime.toFixed(1)}s
              </p>
            </div>
          )}
          {metadata.pageCount !== undefined && (
            <div>
              <p className="text-xs text-muted-foreground">Pages</p>
              <p className="text-sm font-medium">{metadata.pageCount}</p>
            </div>
          )}
          {metadata.extractedFields !== undefined && (
            <div>
              <p className="text-xs text-muted-foreground">Fields Extracted</p>
              <p className="text-sm font-medium">{metadata.extractedFields}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * ProcessingStatusList component for displaying multiple processing statuses
 */
export interface ProcessingStatusListProps {
  /**
   * Array of processing status items
   */
  items: Array<ProcessingStatusProps & { id: string }>
  /**
   * Custom className
   */
  className?: string
}

/**
 * ProcessingStatusList component for displaying multiple processing statuses.
 *
 * @example
 * <ProcessingStatusList
 *   items={[
 *     { id: "1", status: "processing", progress: 50, fileName: "doc1.pdf" },
 *     { id: "2", status: "completed", progress: 100, fileName: "doc2.pdf" },
 *   ]}
 * />
 */
export function ProcessingStatusList({
  items,
  className,
}: ProcessingStatusListProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <div
      data-slot="processing-status-list"
      className={cn("space-y-4", className)}
    >
      {items.map((item) => {
        const { id, ...props } = item
        return (
          <div
            key={id}
            className="rounded-lg border bg-card p-4"
          >
            <ProcessingStatus {...props} />
          </div>
        )
      })}
    </div>
  )
}

export default ProcessingStatus
