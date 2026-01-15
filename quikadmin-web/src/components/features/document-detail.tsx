/**
 * DocumentDetail component - Modal showing full document details
 * Displays metadata, extracted data, and document actions
 * @module components/features/document-detail
 */

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from './status-badge';
import { OCRConfidenceAlert } from './ocr-confidence-alert';
import { TagInput } from './tag-input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  FileText,
  Download,
  Trash2,
  RefreshCw,
  Calendar,
  HardDrive,
  Target,
  AlertCircle,
  FileType,
  Clock,
  CheckCircle2,
  Edit,
  Tag,
} from 'lucide-react';
import { useDocumentDetail } from '@/hooks/useDocumentDetail';
import { useDocumentActions } from '@/hooks/useDocumentActions';
import { updateDocument } from '@/services/documentService';
import { Document, getFriendlyFileType, getFileTypeCategory } from '@/types/document';
import { formatFileSize } from '@/utils/fileValidation';
import { format } from 'date-fns';

export interface DocumentDetailProps {
  /**
   * Document ID to display
   */
  documentId: string | null;

  /**
   * Dialog open state
   */
  open: boolean;

  /**
   * Close callback
   */
  onClose: () => void;

  /**
   * Optional document data (to avoid refetch if already available)
   */
  initialDocument?: Document;
}

/**
 * DocumentDetail modal component
 *
 * @example
 * ```tsx
 * const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
 *
 * <DocumentDetail
 *   documentId={selectedDocId}
 *   open={!!selectedDocId}
 *   onClose={() => setSelectedDocId(null)}
 * />
 * ```
 */
export function DocumentDetail({
  documentId,
  open,
  onClose,
  initialDocument,
}: DocumentDetailProps) {
  const {
    data: document,
    isLoading,
    error,
  } = useDocumentDetail(documentId, {
    initialData: initialDocument,
  });
  const { downloadDocument, deleteDocument, isDeleting, reprocessDocument, isReprocessing } =
    useDocumentActions();

  const handleDownload = async () => {
    if (!document) return;
    await downloadDocument({ id: document.id, fileName: document.fileName });
  };

  const handleDelete = async () => {
    if (!document) return;
    await deleteDocument(document.id);
    onClose();
  };

  const handleReprocess = async () => {
    if (!document) return;
    await reprocessDocument(document.id);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <DocumentDetailSkeleton />
        ) : error ? (
          <DocumentDetailError error={error.message} onClose={onClose} />
        ) : document ? (
          <>
            <DialogHeader>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-xl truncate">{document.fileName}</DialogTitle>
                  <DialogDescription className="flex items-center gap-2 mt-1">
                    <StatusBadge status={document.status} showIcon size="sm" />
                    <span>•</span>
                    <span>{getFriendlyFileType(document.fileType)}</span>
                    <span>•</span>
                    <span>{formatFileSize(document.fileSize)}</span>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <Tabs defaultValue="metadata" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
                <TabsTrigger value="extracted">Extracted Data</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              {/* Metadata Tab */}
              <TabsContent value="metadata" className="space-y-4 mt-4">
                <MetadataSection document={document} />
                <Separator />
                <TagsSection document={document} />
              </TabsContent>

              {/* Extracted Data Tab */}
              <TabsContent value="extracted" className="mt-4 space-y-4">
                {/* Confidence Alert */}
                <OCRConfidenceAlert
                  confidence={document.confidence}
                  onReprocess={handleReprocess}
                  isReprocessing={isReprocessing}
                />
                <ExtractedDataSection document={document} />
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="mt-4">
                <HistorySection document={document} />
              </TabsContent>
            </Tabs>

            <Separator className="my-4" />

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="outline"
                onClick={handleDownload}
                disabled={document.status !== 'completed'}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              {document.confidence !== null && document.confidence < 0.7 && (
                <Button
                  variant="secondary"
                  onClick={handleReprocess}
                  disabled={isReprocessing || document.status === 'processing'}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {isReprocessing ? 'Reprocessing...' : 'Reprocess OCR'}
                </Button>
              )}
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Metadata section component
 */
function MetadataSection({ document }: { document: Document }) {
  const metadata = [
    {
      icon: <FileType className="h-4 w-4" />,
      label: 'File Type',
      value: getFriendlyFileType(document.fileType),
    },
    {
      icon: <HardDrive className="h-4 w-4" />,
      label: 'File Size',
      value: formatFileSize(document.fileSize),
    },
    {
      icon: <Calendar className="h-4 w-4" />,
      label: 'Uploaded',
      value: format(new Date(document.createdAt), 'PPp'),
    },
    ...(document.processedAt
      ? [
          {
            icon: <CheckCircle2 className="h-4 w-4" />,
            label: 'Processed',
            value: format(new Date(document.processedAt), 'PPp'),
          },
        ]
      : []),
    ...(document.pageCount
      ? [
          {
            icon: <FileText className="h-4 w-4" />,
            label: 'Pages',
            value: document.pageCount.toString(),
          },
        ]
      : []),
    ...(document.confidence !== null && document.confidence !== undefined
      ? [
          {
            icon: <Target className="h-4 w-4" />,
            label: 'Confidence',
            value: `${Math.round(document.confidence * 100)}%`,
          },
        ]
      : []),
  ];

  return (
    <dl className="grid grid-cols-2 gap-4">
      {metadata.map((item, index) => (
        <div key={index} className="flex items-start gap-3">
          <div className="rounded bg-muted p-2 text-muted-foreground">{item.icon}</div>
          <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">{item.label}</dt>
            <dd className="font-medium">{item.value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

/**
 * Extracted data section component
 */
function ExtractedDataSection({ document }: { document: Document }) {
  if (document.status !== 'completed') {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">
          {document.status === 'processing'
            ? 'Document is still being processed'
            : document.status === 'failed'
              ? 'Document processing failed'
              : 'No extracted data available'}
        </p>
        {document.error && <p className="text-sm text-destructive mt-2">{document.error}</p>}
      </div>
    );
  }

  const extractedFields = getDisplayFields(document.extractedData);

  if (extractedFields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No extracted data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {extractedFields.map((field) => (
        <div
          key={field.key}
          className="flex justify-between items-start gap-4 p-3 rounded-lg border bg-muted/50"
        >
          <span className="text-sm font-medium text-muted-foreground capitalize">
            {field.key.replace(/_/g, ' ')}:
          </span>
          <div className="text-sm text-right max-w-md">
            <div className="truncate" title={field.displayValue}>
              {field.displayValue}
            </div>
            {field.confidence !== undefined && (
              <div className="text-xs text-muted-foreground">{field.confidence}% confidence</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

type DisplayField = {
  key: string;
  displayValue: string;
  confidence?: number;
};

function getDisplayFields(extractedData: Document['extractedData']): DisplayField[] {
  if (!extractedData || typeof extractedData !== 'object') {
    return [];
  }

  const fields: DisplayField[] = [];

  const addField = (key: string, value: unknown) => {
    if (value === null || value === undefined) return;

    if (typeof value === 'object' && value !== null) {
      const maybeField = value as { value?: unknown; confidence?: number };
      if ('value' in maybeField && 'confidence' in maybeField) {
        const confidence =
          typeof maybeField.confidence === 'number'
            ? maybeField.confidence <= 1
              ? Math.round(maybeField.confidence * 100)
              : Math.round(maybeField.confidence)
            : undefined;
        fields.push({
          key,
          displayValue: String(maybeField.value ?? ''),
          confidence,
        });
        return;
      }
    }

    fields.push({
      key,
      displayValue: typeof value === 'string' ? value : JSON.stringify(value),
    });
  };

  const dataEntries = Object.entries(extractedData);
  for (const [key, value] of dataEntries) {
    if (key === '_meta' || key === 'ocrMetadata' || key === 'pages') continue;
    if (key === 'fields' && typeof value === 'object' && value !== null) {
      for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        addField(nestedKey, nestedValue);
      }
      continue;
    }
    addField(key, value);
  }

  return fields;
}

/**
 * History section component
 */
function HistorySection({ document }: { document: Document }) {
  const events = [
    {
      icon: <Calendar className="h-4 w-4" />,
      label: 'Document Uploaded',
      timestamp: document.createdAt,
      variant: 'default' as const,
    },
    ...(document.updatedAt && document.updatedAt !== document.createdAt
      ? [
          {
            icon: <Clock className="h-4 w-4" />,
            label: 'Document Updated',
            timestamp: document.updatedAt,
            variant: 'default' as const,
          },
        ]
      : []),
    ...(document.processedAt
      ? [
          {
            icon: <CheckCircle2 className="h-4 w-4" />,
            label: 'Processing Completed',
            timestamp: document.processedAt,
            variant: 'success' as const,
          },
        ]
      : []),
    ...(document.status === 'failed' && document.error
      ? [
          {
            icon: <AlertCircle className="h-4 w-4" />,
            label: `Processing Failed: ${document.error}`,
            timestamp: document.updatedAt || document.createdAt,
            variant: 'error' as const,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <div key={index} className="flex items-start gap-3">
          <div
            className={cn(
              'rounded p-2',
              event.variant === 'success' && 'bg-status-success/10 text-status-success-foreground',
              event.variant === 'error' && 'bg-status-error/10 text-status-error-foreground',
              event.variant === 'default' && 'bg-muted text-muted-foreground'
            )}
          >
            {event.icon}
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">{event.label}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(event.timestamp), 'PPp')}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Tags section with edit capability
 */
function TagsSection({ document }: { document: Document }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedTags, setEditedTags] = React.useState<string[]>([]);

  const documentTags = document.tags ?? [];

  const updateTagsMutation = useMutation({
    mutationFn: (newTags: string[]) => updateDocument(document.id, { tags: newTags }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', document.id] });
      toast.success('Tags updated');
      setIsEditing(false);
    },
    onError: () => {
      toast.error('Failed to update tags');
    },
  });

  function startEditing(): void {
    setEditedTags(documentTags);
    setIsEditing(true);
  }

  function cancelEditing(): void {
    setIsEditing(false);
  }

  function saveTags(): void {
    updateTagsMutation.mutate(editedTags);
  }

  const isPending = updateTagsMutation.isPending;

  return (
    <div className="space-y-2">
      <Label className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Tags
        </span>
        {!isEditing && (
          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={startEditing}>
            <Edit className="h-3 w-3 mr-1" />
            Edit
          </Button>
        )}
      </Label>

      {isEditing ? (
        <div className="space-y-3">
          <TagInput tags={editedTags} onChange={setEditedTags} placeholder="Add tags..." />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveTags} disabled={isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={isPending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <TagDisplay tags={documentTags} />
      )}
    </div>
  );
}

/**
 * Display component for read-only tag list
 */
function TagDisplay({ tags }: { tags: string[] }): React.ReactElement {
  if (tags.length === 0) {
    return <span className="text-sm text-muted-foreground">No tags</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary">
          {tag}
        </Badge>
      ))}
    </div>
  );
}

/**
 * Loading skeleton
 */
function DocumentDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-12 w-12 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <Separator />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Error state
 */
function DocumentDetailError({ error, onClose }: { error: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="h-12 w-12 text-destructive mb-3" />
      <DialogTitle className="mb-2">Failed to load document</DialogTitle>
      <DialogDescription className="mb-4">{error}</DialogDescription>
      <Button onClick={onClose}>Close</Button>
    </div>
  );
}
