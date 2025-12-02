import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const spinnerVariants = cva(
  "inline-block animate-spin rounded-full border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]",
  {
    variants: {
      size: {
        sm: "h-4 w-4 border-2",
        md: "h-6 w-6 border-2",
        lg: "h-8 w-8 border-[3px]",
        xl: "h-12 w-12 border-4",
      },
      variant: {
        default: "text-primary",
        secondary: "text-secondary-foreground",
        muted: "text-muted-foreground",
        destructive: "text-destructive",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "default",
    },
  }
)

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
  /**
   * Accessible label for screen readers
   */
  label?: string
}

/**
 * Spinner component for loading states.
 *
 * @example
 * // Basic spinner
 * <Spinner />
 *
 * @example
 * // Large spinner with custom label
 * <Spinner size="lg" label="Processing document..." />
 *
 * @example
 * // Centered spinner in a container
 * <div className="flex items-center justify-center p-8">
 *   <Spinner size="xl" label="Loading..." />
 * </div>
 *
 * @example
 * // Inline spinner with text
 * <Button disabled>
 *   <Spinner size="sm" className="mr-2" />
 *   Processing...
 * </Button>
 */
function Spinner({
  className,
  size,
  variant,
  label = "Loading...",
  ...props
}: SpinnerProps) {
  return (
    <div
      data-slot="spinner"
      role="status"
      aria-label={label}
      aria-live="polite"
      className={cn("inline-flex items-center justify-center", className)}
      {...props}
    >
      <div className={cn(spinnerVariants({ size, variant }))} />
      <span className="sr-only">{label}</span>
    </div>
  )
}

/**
 * SpinnerOverlay component for full-screen or container loading states.
 *
 * @example
 * <SpinnerOverlay label="Loading documents..." />
 */
export interface SpinnerOverlayProps
  extends Omit<SpinnerProps, "size" | "variant"> {
  /**
   * Whether the overlay is full-screen or absolute to parent
   */
  fullScreen?: boolean
  /**
   * Optional text to display below spinner
   */
  text?: string
}

/**
 * SpinnerOverlay component for full-page or container loading overlays.
 *
 * @example
 * // Full-screen loading
 * <SpinnerOverlay fullScreen text="Loading application..." />
 *
 * @example
 * // Container-relative overlay
 * <div className="relative h-64">
 *   <SpinnerOverlay text="Loading content..." />
 * </div>
 */
function SpinnerOverlay({
  fullScreen = false,
  label = "Loading...",
  text,
  className,
  ...props
}: SpinnerOverlayProps) {
  return (
    <div
      data-slot="spinner-overlay"
      className={cn(
        "flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm",
        fullScreen ? "fixed inset-0 z-50" : "absolute inset-0",
        className
      )}
      role="status"
      aria-label={label}
      aria-live="polite"
      {...props}
    >
      <Spinner size="lg" label={label} />
      {text && (
        <p className="text-sm text-muted-foreground">{text}</p>
      )}
    </div>
  )
}

export { Spinner, SpinnerOverlay, spinnerVariants }
