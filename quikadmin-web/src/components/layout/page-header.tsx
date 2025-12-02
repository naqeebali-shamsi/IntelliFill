import * as React from "react"
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"

export interface PageHeaderBreadcrumb {
  /**
   * Breadcrumb label
   */
  label: string
  /**
   * Optional link href (if not provided, renders as text)
   */
  href?: string
}

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Page title
   */
  title: string
  /**
   * Optional description text
   */
  description?: string
  /**
   * Optional breadcrumbs array
   */
  breadcrumbs?: PageHeaderBreadcrumb[]
  /**
   * Optional action buttons or elements
   */
  actions?: React.ReactNode
}

/**
 * PageHeader component for consistent page headers with breadcrumbs, title, description, and actions.
 *
 * @example
 * // Basic page header
 * <PageHeader title="Documents" description="Manage your uploaded documents" />
 *
 * @example
 * // With breadcrumbs
 * <PageHeader
 *   title="Document Details"
 *   breadcrumbs={[
 *     { label: "Home", href: "/" },
 *     { label: "Documents", href: "/documents" },
 *     { label: "Details" }
 *   ]}
 * />
 *
 * @example
 * // With actions
 * <PageHeader
 *   title="Documents"
 *   description="Manage your uploaded documents"
 *   actions={
 *     <div className="flex gap-2">
 *       <Button variant="outline">Filter</Button>
 *       <Button>Upload Document</Button>
 *     </div>
 *   }
 * />
 */
function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn("space-y-4 pb-6", className)}
      {...props}
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1

              return (
                <React.Fragment key={index}>
                  <BreadcrumbItem>
                    {crumb.href && !isLast ? (
                      <BreadcrumbLink asChild>
                        <Link to={crumb.href}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator />}
                </React.Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground text-base">{description}</p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </div>
  )
}

/**
 * PageHeaderSkeleton component for loading state.
 */
export interface PageHeaderSkeletonProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Whether to show breadcrumbs skeleton
   */
  showBreadcrumbs?: boolean
  /**
   * Whether to show description skeleton
   */
  showDescription?: boolean
  /**
   * Whether to show actions skeleton
   */
  showActions?: boolean
}

/**
 * PageHeaderSkeleton component for page header loading states.
 *
 * @example
 * <PageHeaderSkeleton showBreadcrumbs showDescription showActions />
 */
function PageHeaderSkeleton({
  showBreadcrumbs = false,
  showDescription = false,
  showActions = false,
  className,
  ...props
}: PageHeaderSkeletonProps) {
  return (
    <div
      data-slot="page-header-skeleton"
      className={cn("space-y-4 pb-6 animate-pulse", className)}
      role="status"
      aria-label="Loading page header..."
      {...props}
    >
      {showBreadcrumbs && (
        <div className="h-4 w-48 bg-muted rounded" />
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="h-9 w-64 bg-muted rounded" />
          {showDescription && (
            <div className="h-5 w-96 bg-muted rounded" />
          )}
        </div>

        {showActions && (
          <div className="flex items-center gap-2">
            <div className="h-10 w-24 bg-muted rounded" />
            <div className="h-10 w-32 bg-muted rounded" />
          </div>
        )}
      </div>

      <span className="sr-only">Loading page header...</span>
    </div>
  )
}

export { PageHeader, PageHeaderSkeleton }
