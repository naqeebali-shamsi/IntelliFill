import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { LucideIcon } from "lucide-react"

const emptyStateVariants = cva(
  "flex flex-col items-center justify-center text-center",
  {
    variants: {
      size: {
        sm: "p-4 gap-2",
        md: "p-8 gap-4",
        lg: "p-12 gap-6",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

export interface EmptyStateProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof emptyStateVariants> {
  /**
   * Icon component to display (from lucide-react)
   */
  icon?: LucideIcon
  /**
   * Icon className for custom styling
   */
  iconClassName?: string
  /**
   * Main heading text
   */
  title: string
  /**
   * Optional description text
   */
  description?: string
  /**
   * Optional action button configuration
   */
  action?: {
    label: string
    onClick: () => void
    variant?: "default" | "secondary" | "outline" | "ghost" | "link"
    icon?: LucideIcon
  }
  /**
   * Optional secondary action
   */
  secondaryAction?: {
    label: string
    onClick: () => void
    variant?: "default" | "secondary" | "outline" | "ghost" | "link"
  }
  /**
   * Optional test ID for E2E testing
   */
  "data-testid"?: string
}

/**
 * EmptyState component for displaying empty data states.
 *
 * @example
 * // Basic empty state
 * <EmptyState
 *   icon={FileText}
 *   title="No documents found"
 *   description="Upload your first document to get started"
 * />
 *
 * @example
 * // With action button
 * <EmptyState
 *   icon={Upload}
 *   title="No documents uploaded"
 *   description="Start by uploading a document"
 *   action={{
 *     label: "Upload Document",
 *     onClick: () => navigate('/upload'),
 *     variant: "default"
 *   }}
 * />
 *
 * @example
 * // With primary and secondary actions
 * <EmptyState
 *   icon={Search}
 *   title="No results found"
 *   description="Try adjusting your search criteria"
 *   action={{
 *     label: "Clear Filters",
 *     onClick: handleClearFilters
 *   }}
 *   secondaryAction={{
 *     label: "View All",
 *     onClick: handleViewAll,
 *     variant: "outline"
 *   }}
 * />
 */
function EmptyState({
  icon: Icon,
  iconClassName,
  title,
  description,
  action,
  secondaryAction,
  size,
  className,
  "data-testid": testId,
  ...props
}: EmptyStateProps) {
  const ActionIcon = action?.icon

  return (
    <div
      data-slot="empty-state"
      data-testid={testId}
      className={cn(emptyStateVariants({ size }), className)}
      role="status"
      aria-label={title}
      {...props}
    >
      {Icon && (
        <div
          className={cn(
            "rounded-full bg-muted p-4",
            size === "sm" && "p-3",
            size === "lg" && "p-6"
          )}
          aria-hidden="true"
        >
          <Icon
            className={cn(
              "text-muted-foreground",
              size === "sm" && "h-6 w-6",
              size === "md" && "h-10 w-10",
              size === "lg" && "h-12 w-12",
              iconClassName
            )}
          />
        </div>
      )}

      <div className="space-y-2">
        <h3
          className={cn(
            "font-semibold text-foreground",
            size === "sm" && "text-base",
            size === "md" && "text-lg",
            size === "lg" && "text-xl"
          )}
        >
          {title}
        </h3>

        {description && (
          <p
            className={cn(
              "text-muted-foreground max-w-md mx-auto",
              size === "sm" && "text-xs",
              size === "md" && "text-sm",
              size === "lg" && "text-base"
            )}
          >
            {description}
          </p>
        )}
      </div>

      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant || "default"}
              size={size === "sm" ? "sm" : "default"}
            >
              {ActionIcon && <ActionIcon className="mr-2 h-4 w-4" />}
              {action.label}
            </Button>
          )}

          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant={secondaryAction.variant || "outline"}
              size={size === "sm" ? "sm" : "default"}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * EmptyStateSimple component for a minimal empty state display.
 */
export interface EmptyStateSimpleProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Message to display
   */
  message: string
  /**
   * Optional icon
   */
  icon?: LucideIcon
  /**
   * Optional test ID for E2E testing
   */
  "data-testid"?: string
}

/**
 * EmptyStateSimple component for minimal empty states.
 *
 * @example
 * <EmptyStateSimple message="No items to display" />
 */
function EmptyStateSimple({
  message,
  icon: Icon,
  className,
  "data-testid": testId,
  ...props
}: EmptyStateSimpleProps) {
  return (
    <div
      data-slot="empty-state-simple"
      data-testid={testId}
      className={cn(
        "flex flex-col items-center justify-center p-6 text-center",
        className
      )}
      role="status"
      aria-label={message}
      {...props}
    >
      {Icon && (
        <Icon className="h-8 w-8 text-muted-foreground mb-2" aria-hidden="true" />
      )}
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

export { EmptyState, EmptyStateSimple, emptyStateVariants }
