import * as React from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/utils/fileValidation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from '@/components/ui/card';
import { StatusBadge } from './status-badge';
import { ConfidenceBadge } from '@/components/ui/confidence-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  File as FileIcon,
  Image as ImageIcon,
  FileSpreadsheet,
  MoreVertical,
  Download,
  Trash2,
  Eye,
  Edit,
  Share2,
  type LucideIcon,
} from 'lucide-react';

export type DocumentFileType = 'pdf' | 'docx' | 'csv' | 'xlsx' | 'txt' | 'image' | 'other';
export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

const fileTypeIconMap: Record<DocumentFileType, LucideIcon> = {
  pdf: FileText,
  docx: FileText,
  csv: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  txt: FileIcon,
  image: ImageIcon,
  other: FileIcon,
};

/** Displays a list of tags with overflow indicator */
function TagList({ tags, maxVisible }: { tags: string[]; maxVisible: number }): React.ReactElement {
  const visibleTags = tags.slice(0, maxVisible);
  const overflowCount = tags.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {visibleTags.map((tag) => (
        <Badge key={tag} variant="outline" className="text-xs py-0 h-5">
          {tag}
        </Badge>
      ))}
      {overflowCount > 0 && (
        <Badge variant="outline" className="text-xs py-0 h-5 text-muted-foreground">
          +{overflowCount}
        </Badge>
      )}
    </div>
  );
}

export interface DocumentCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'> {
  /**
   * Document ID
   */
  id: string;
  /**
   * Document name
   */
  name: string;
  /**
   * File type
   */
  fileType: DocumentFileType;
  /**
   * Document status
   */
  status: DocumentStatus;
  /**
   * Upload date
   */
  uploadDate: string | Date;
  /**
   * File size in bytes
   */
  fileSize?: number;
  /**
   * Number of pages (for documents)
   */
  pageCount?: number;
  /**
   * Additional metadata
   */
  metadata?: Record<string, string | number>;
  /**
   * OCR confidence score (0-1)
   */
  confidence?: number | null;
  /**
   * Document tags
   */
  tags?: string[];
  /**
   * Download handler
   */
  onDownload?: (id: string) => void;
  /**
   * Delete handler
   */
  onDelete?: (id: string) => void;
  /**
   * View handler
   */
  onView?: (id: string) => void;
  /**
   * Edit handler
   */
  onEdit?: (id: string) => void;
  /**
   * Share handler
   */
  onShare?: (id: string) => void;
  /**
   * Card click handler
   */
  onClick?: (id: string) => void;
  /**
   * Show actions menu
   */
  showActions?: boolean;
  /**
   * Compact variant
   */
  compact?: boolean;
}

/**
 * DocumentCard component for displaying document information.
 *
 * @example
 * <DocumentCard
 *   id="doc-1"
 *   name="Invoice_2024.pdf"
 *   fileType="pdf"
 *   status="completed"
 *   uploadDate={new Date()}
 *   fileSize={1024 * 1024}
 *   pageCount={3}
 *   onView={handleView}
 *   onDownload={handleDownload}
 *   onDelete={handleDelete}
 * />
 */
function DocumentCard({
  id,
  name,
  fileType,
  status,
  uploadDate,
  fileSize,
  pageCount,
  metadata,
  confidence,
  tags,
  onDownload,
  onDelete,
  onView,
  onEdit,
  onShare,
  onClick,
  showActions = true,
  compact = false,
  className,
  ...props
}: DocumentCardProps) {
  const FileTypeIcon = fileTypeIconMap[fileType] || FileIcon;
  const formattedDate =
    typeof uploadDate === 'string' ? uploadDate : format(uploadDate, 'MMM d, yyyy');

  const handleCardClick = () => {
    if (onClick) {
      onClick(id);
    }
  };

  const handleAction = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card onClick
    action();
  };

  return (
    <Card
      data-slot="document-card"
      data-testid="document-card"
      className={cn('transition-shadow hover:shadow-md', onClick && 'cursor-pointer', className)}
      onClick={handleCardClick}
      {...props}
    >
      <CardHeader className={cn(compact && 'py-4')}>
        <div className="flex items-start gap-3">
          {/* File Type Icon */}
          <div className={cn('rounded-lg bg-primary/10 p-2.5 shrink-0', compact && 'p-2')}>
            <FileTypeIcon
              className={cn('text-primary', compact ? 'h-5 w-5' : 'h-6 w-6')}
              aria-hidden="true"
            />
          </div>

          {/* Document Info */}
          <div className="flex-1 min-w-0">
            <CardTitle
              className={cn('truncate', compact ? 'text-base' : 'text-lg')}
              data-testid="document-card-title"
            >
              {name}
            </CardTitle>
            <CardDescription className={cn('flex items-center gap-2 mt-1', compact && 'text-xs')}>
              <span>{formattedDate}</span>
              {fileSize && (
                <>
                  <span>•</span>
                  <span>{formatFileSize(fileSize)}</span>
                </>
              )}
              {pageCount && (
                <>
                  <span>•</span>
                  <span>
                    {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                  </span>
                </>
              )}
            </CardDescription>

            {/* Tags */}
            {tags && tags.length > 0 && <TagList tags={tags} maxVisible={3} />}
          </div>

          {/* Status and Confidence Badges */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Show confidence badge for completed docs with low/medium confidence */}
            {status === 'completed' &&
              confidence !== null &&
              confidence !== undefined &&
              confidence < 0.85 && <ConfidenceBadge confidence={confidence} />}
            <StatusBadge
              status={status}
              showIcon
              size={compact ? 'sm' : 'md'}
              data-testid="document-card-status"
            />
          </div>
        </div>

        {/* Actions Menu */}
        {showActions && (onView || onDownload || onEdit || onShare || onDelete) && (
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Document actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onView && (
                  <DropdownMenuItem onClick={handleAction(() => onView(id))}>
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </DropdownMenuItem>
                )}
                {onDownload && (
                  <DropdownMenuItem
                    onClick={handleAction(() => onDownload(id))}
                    data-testid="document-card-download"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </DropdownMenuItem>
                )}
                {onEdit && (
                  <DropdownMenuItem onClick={handleAction(() => onEdit(id))}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onShare && (
                  <DropdownMenuItem
                    onClick={handleAction(() => onShare(id))}
                    data-testid="document-card-share"
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <>
                    {(onView || onDownload || onEdit || onShare) && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={handleAction(() => onDelete(id))}
                      className="text-destructive focus:text-destructive"
                      data-testid="document-card-delete"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        )}
      </CardHeader>

      {/* Metadata */}
      {metadata && Object.keys(metadata).length > 0 && !compact && (
        <CardContent className="pt-0">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(metadata).map(([key, value]) => (
              <div key={key} className="space-y-0.5">
                <dt className="text-muted-foreground text-xs capitalize">
                  {key.replace(/_/g, ' ')}
                </dt>
                <dd className="font-medium truncate">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * DocumentCardSkeleton component for loading states.
 */
export interface DocumentCardSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Compact variant
   */
  compact?: boolean;
}

/**
 * DocumentCardSkeleton component for document card loading states.
 *
 * @example
 * {loading ? (
 *   <DocumentCardSkeleton />
 * ) : (
 *   <DocumentCard {...props} />
 * )}
 */
function DocumentCardSkeleton({ compact = false, className, ...props }: DocumentCardSkeletonProps) {
  return (
    <Card data-slot="document-card-skeleton" className={cn('animate-pulse', className)} {...props}>
      <CardHeader className={cn(compact && 'py-4')}>
        <div className="flex items-start gap-3">
          <div className={cn('rounded-lg bg-muted shrink-0', compact ? 'h-9 w-9' : 'h-11 w-11')} />
          <div className="flex-1 space-y-2">
            <div className={cn('h-5 w-3/4 bg-muted rounded', compact && 'h-4')} />
            <div className="h-4 w-1/2 bg-muted rounded" />
          </div>
          <div className="h-6 w-20 bg-muted rounded-full" />
        </div>
      </CardHeader>
    </Card>
  );
}

export { DocumentCard, DocumentCardSkeleton };
