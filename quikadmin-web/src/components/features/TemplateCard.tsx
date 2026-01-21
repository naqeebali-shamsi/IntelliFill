/**
 * TemplateCard Component
 *
 * Displays a template in either grid or list view mode with actions.
 * Used in the TemplateLibrary page for template management.
 */

import * as React from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  FileText,
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Eye,
  Calendar,
  BarChart3,
  Play,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardHeader, CardContent, CardFooter, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fadeInUp, fadeInUpSubtle } from '@/lib/animations';

/**
 * Template category types
 */
export type TemplateCategory = 'all' | 'legal' | 'financial' | 'hr' | 'medical' | 'custom';

/**
 * Template interface for the TemplateCard component
 */
export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  fieldCount?: number;
}

/**
 * Props for the TemplateCard component
 */
export interface TemplateCardProps {
  /**
   * The template data to display
   */
  template: Template;
  /**
   * View mode - grid shows card layout, list shows row layout
   */
  viewMode: 'grid' | 'list';
  /**
   * Handler for edit action
   */
  onEdit: (id: string) => void;
  /**
   * Handler for duplicate action
   */
  onDuplicate: (id: string) => void;
  /**
   * Handler for delete action
   */
  onDelete: (id: string) => void;
  /**
   * Handler for preview action
   */
  onPreview?: (id: string) => void;
  /**
   * Handler for use template action (primary action)
   */
  onUse?: (id: string) => void;
  /**
   * Handler for card click
   */
  onClick?: (id: string) => void;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Category badge variant mapping
 */
const categoryBadgeVariant: Record<TemplateCategory, BadgeVariant> = {
  all: 'default',
  legal: 'info',
  financial: 'success',
  hr: 'secondary',
  medical: 'warning',
  custom: 'outline',
};

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  try {
    return format(new Date(dateString), 'MMM d, yyyy');
  } catch {
    return dateString;
  }
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * TemplateCard component that displays template information in grid or list mode
 */
export function TemplateCard({
  template,
  viewMode,
  onEdit,
  onDuplicate,
  onDelete,
  onPreview,
  onUse,
  onClick,
  className,
}: TemplateCardProps) {
  const handleAction = (action: (id: string) => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action(template.id);
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(template.id);
    }
  };

  const ActionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => e.stopPropagation()}
          aria-label="Template actions"
          data-testid={`template-actions-${template.id}`}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onPreview && (
          <DropdownMenuItem onClick={handleAction(onPreview)}>
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleAction(onEdit)} data-testid={`template-edit-${template.id}`}>
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleAction(onDuplicate)} data-testid={`template-duplicate-${template.id}`}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleAction(onDelete)}
          className="text-destructive focus:text-destructive"
          data-testid={`template-delete-${template.id}`}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Grid view - Card layout
  if (viewMode === 'grid') {
    return (
      <motion.div variants={fadeInUp} className={className}>
        <Card
          className={cn(
            'cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/30 group h-full',
            onClick && 'cursor-pointer'
          )}
          onClick={handleCardClick}
          data-testid={`template-card-${template.id}`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 group-hover:bg-primary/15 transition-colors">
                <FileText className="w-5 h-5" />
              </div>
              <span className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1 flex-1">
                {template.name}
              </span>
            </div>
            <CardAction>
              {ActionsMenu}
            </CardAction>
          </CardHeader>
          <CardContent className="pb-3">
            <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
              {template.description}
            </p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <Badge variant={categoryBadgeVariant[template.category]}>
                {capitalize(template.category)}
              </Badge>
              {template.fieldCount !== undefined && (
                <Badge variant="outline" className="text-xs">
                  {template.fieldCount} fields
                </Badge>
              )}
            </div>
          </CardContent>
          <CardFooter className="pt-3 border-t border-border/50">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" />
                  <span>{template.usageCount} uses</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(template.updatedAt)}</span>
                </div>
              </div>
              {onUse && (
                <Button
                  size="sm"
                  onClick={handleAction(onUse)}
                  data-testid={`template-use-${template.id}`}
                >
                  <Play className="h-3 w-3 mr-1" />
                  Use
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    );
  }

  // List view - Row layout
  return (
    <motion.div
      variants={fadeInUpSubtle}
      className={cn(
        'flex items-center gap-4 p-4 border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer group',
        className
      )}
      onClick={handleCardClick}
      data-testid={`template-list-item-${template.id}`}
    >
      <div className="p-2 rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 shrink-0">
        <FileText className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
            {template.name}
          </h3>
          <Badge variant={categoryBadgeVariant[template.category]} className="shrink-0">
            {capitalize(template.category)}
          </Badge>
          {template.fieldCount !== undefined && (
            <Badge variant="outline" className="text-xs shrink-0">
              {template.fieldCount} fields
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">{template.description}</p>
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
        <div className="flex items-center gap-1">
          <BarChart3 className="h-4 w-4" />
          <span>{template.usageCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          <span>{formatDate(template.updatedAt)}</span>
        </div>
        {onUse && (
          <Button
            size="sm"
            onClick={handleAction(onUse)}
            data-testid={`template-use-${template.id}`}
          >
            <Play className="h-3 w-3 mr-1" />
            Use
          </Button>
        )}
        <div onClick={(e) => e.stopPropagation()}>
          {ActionsMenu}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * TemplateCardSkeleton component for loading states
 */
export interface TemplateCardSkeletonProps {
  /**
   * View mode - grid shows card skeleton, list shows row skeleton
   */
  viewMode: 'grid' | 'list';
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Skeleton component for TemplateCard loading state
 */
export function TemplateCardSkeleton({ viewMode, className }: TemplateCardSkeletonProps) {
  if (viewMode === 'grid') {
    return (
      <Card className={cn('animate-pulse h-full', className)} data-testid="template-card-skeleton">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted" />
            <div className="flex-1 h-5 bg-muted rounded" />
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-3/4" />
          </div>
          <div className="mt-3">
            <div className="h-5 w-16 bg-muted rounded" />
          </div>
        </CardContent>
        <CardFooter className="pt-3 border-t border-border/50">
          <div className="flex items-center justify-between w-full">
            <div className="h-4 w-16 bg-muted rounded" />
            <div className="h-4 w-20 bg-muted rounded" />
          </div>
        </CardFooter>
      </Card>
    );
  }

  // List skeleton
  return (
    <div
      className={cn(
        'flex items-center gap-4 p-4 border-b border-border/50 animate-pulse',
        className
      )}
      data-testid="template-list-skeleton"
    >
      <div className="w-9 h-9 rounded-lg bg-muted shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-5 w-48 bg-muted rounded" />
          <div className="h-5 w-16 bg-muted rounded" />
        </div>
        <div className="h-4 w-full bg-muted rounded" />
      </div>
      <div className="flex items-center gap-6 shrink-0">
        <div className="h-4 w-12 bg-muted rounded" />
        <div className="h-4 w-20 bg-muted rounded" />
        <div className="h-8 w-8 bg-muted rounded" />
      </div>
    </div>
  );
}

export default TemplateCard;
