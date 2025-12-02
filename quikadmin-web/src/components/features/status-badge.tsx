import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  type LucideIcon,
} from "lucide-react"

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors",
  {
    variants: {
      status: {
        pending: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700",
        processing: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
        completed: "bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
        success: "bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
        failed: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
        error: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
        warning: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800",
        info: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-2.5 py-1 text-sm",
        lg: "px-3 py-1.5 text-base",
      },
    },
    defaultVariants: {
      status: "pending",
      size: "md",
    },
  }
)

const statusIconMap: Record<string, LucideIcon> = {
  pending: Clock,
  processing: Loader2,
  completed: CheckCircle2,
  success: CheckCircle2,
  failed: XCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  /**
   * Whether to show the status icon
   */
  showIcon?: boolean
  /**
   * Custom icon to override the default
   */
  icon?: LucideIcon
  /**
   * Custom label (if not provided, uses status as label)
   */
  label?: string
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
  const Icon = icon || statusIconMap[status || "pending"]
  const displayLabel = label || children || (status ? capitalizeFirst(status) : "")
  const isProcessing = status === "processing"

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
            "shrink-0",
            size === "sm" && "h-3 w-3",
            size === "md" && "h-3.5 w-3.5",
            size === "lg" && "h-4 w-4",
            isProcessing && "animate-spin"
          )}
          aria-hidden="true"
        />
      )}
      {displayLabel && <span>{displayLabel}</span>}
    </div>
  )
}

/**
 * StatusDot component for minimal status indicators.
 */
export interface StatusDotProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Status variant
   */
  status: "pending" | "processing" | "completed" | "success" | "failed" | "error" | "warning" | "info"
  /**
   * Size of the dot
   */
  size?: "sm" | "md" | "lg"
  /**
   * Whether the dot should pulse (for processing/active states)
   */
  pulse?: boolean
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
function StatusDot({
  status,
  size = "md",
  pulse = false,
  className,
  ...props
}: StatusDotProps) {
  const colorMap = {
    pending: "bg-gray-500",
    processing: "bg-blue-500",
    completed: "bg-green-500",
    success: "bg-green-500",
    failed: "bg-red-500",
    error: "bg-red-500",
    warning: "bg-yellow-500",
    info: "bg-blue-500",
  }

  const sizeMap = {
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
    lg: "h-3 w-3",
  }

  return (
    <div
      data-slot="status-dot"
      className={cn(
        "rounded-full shrink-0",
        colorMap[status],
        sizeMap[size],
        pulse && "animate-pulse",
        className
      )}
      role="status"
      aria-label={`Status: ${status}`}
      {...props}
    />
  )
}

// Helper function to capitalize first letter
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export { StatusBadge, StatusDot, statusBadgeVariants }
