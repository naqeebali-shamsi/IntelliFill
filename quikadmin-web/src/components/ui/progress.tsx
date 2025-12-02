import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const progressVariants = cva(
  "relative w-full overflow-hidden rounded-full",
  {
    variants: {
      size: {
        sm: "h-1",
        md: "h-2",
        lg: "h-3",
      },
      variant: {
        default: "bg-primary/20",
        success: "bg-green-500/20",
        warning: "bg-yellow-500/20",
        error: "bg-red-500/20",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "default",
    },
  }
)

const progressIndicatorVariants = cva(
  "h-full w-full flex-1 transition-all duration-300 ease-in-out",
  {
    variants: {
      variant: {
        default: "bg-primary",
        success: "bg-green-500",
        warning: "bg-yellow-500",
        error: "bg-red-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface ProgressProps
  extends React.ComponentProps<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressVariants> {
  /**
   * Progress value (0-100). If undefined, shows indeterminate progress.
   */
  value?: number
  /**
   * Show percentage text
   */
  showPercentage?: boolean
  /**
   * Optional label for the progress bar
   */
  label?: string
  /**
   * Custom percentage formatter
   */
  formatPercentage?: (value: number) => string
  /**
   * Indeterminate progress (animated, no specific value)
   */
  indeterminate?: boolean
}

/**
 * @example
 * // Indeterminate progress (loading without specific progress)
 * <Progress indeterminate label="Processing..." />
 */
function Progress({
  className,
  value = 0,
  size,
  variant,
  showPercentage = false,
  label,
  formatPercentage = (val) => `${Math.round(val)}%`,
  indeterminate = false,
  ...props
}: ProgressProps) {
  const clampedValue = indeterminate ? undefined : Math.min(100, Math.max(0, value ?? 0))

  return (
    <div data-slot="progress-wrapper" className="w-full">
      {(label || (showPercentage && !indeterminate)) && (
        <div className="mb-2 flex items-center justify-between text-sm">
          {label && (
            <span className="font-medium text-foreground">{label}</span>
          )}
          {showPercentage && !indeterminate && clampedValue !== undefined && (
            <span className="text-muted-foreground">
              {formatPercentage(clampedValue)}
            </span>
          )}
        </div>
      )}
      <ProgressPrimitive.Root
        data-slot="progress"
        className={cn(progressVariants({ size, variant }), className)}
        value={clampedValue}
        aria-label={label || (indeterminate ? "Loading..." : `${clampedValue}% complete`)}
        aria-valuenow={indeterminate ? undefined : clampedValue}
        aria-valuemin={indeterminate ? undefined : 0}
        aria-valuemax={indeterminate ? undefined : 100}
        {...props}
      >
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className={cn(
            progressIndicatorVariants({ variant }),
            indeterminate && "w-1/3 animate-progress-indeterminate"
          )}
          style={
            indeterminate
              ? undefined
              : { transform: `translateX(-${100 - (clampedValue ?? 0)}%)` }
          }
        />
      </ProgressPrimitive.Root>
    </div>
  )
}

/**
 * ProgressCircular component for circular progress indicators.
 */
export interface ProgressCircularProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Progress value (0-100)
   */
  value: number
  /**
   * Size of the circular progress
   */
  size?: "sm" | "md" | "lg"
  /**
   * Stroke width
   */
  strokeWidth?: number
  /**
   * Show percentage in center
   */
  showPercentage?: boolean
  /**
   * Color variant
   */
  variant?: "default" | "success" | "warning" | "error"
}

/**
 * ProgressCircular component for circular progress displays.
 *
 * @example
 * <ProgressCircular value={75} showPercentage />
 */
function ProgressCircular({
  value = 0,
  size = "md",
  strokeWidth = 4,
  showPercentage = false,
  variant = "default",
  className,
  ...props
}: ProgressCircularProps) {
  const clampedValue = Math.min(100, Math.max(0, value))

  const sizeMap = {
    sm: 40,
    md: 64,
    lg: 96,
  }

  const dimensions = sizeMap[size]
  const radius = (dimensions - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (clampedValue / 100) * circumference

  const colorMap = {
    default: "text-primary",
    success: "text-green-500",
    warning: "text-yellow-500",
    error: "text-red-500",
  }

  return (
    <div
      data-slot="progress-circular"
      className={cn("relative inline-flex items-center justify-center", className)}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      {...props}
    >
      <svg width={dimensions} height={dimensions} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={dimensions / 2}
          cy={dimensions / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted opacity-20"
        />
        {/* Progress circle */}
        <circle
          cx={dimensions / 2}
          cy={dimensions / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn("transition-all duration-300 ease-in-out", colorMap[variant])}
        />
      </svg>
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold">{Math.round(clampedValue)}%</span>
        </div>
      )}
    </div>
  )
}

export { Progress, ProgressCircular, progressVariants, progressIndicatorVariants }

