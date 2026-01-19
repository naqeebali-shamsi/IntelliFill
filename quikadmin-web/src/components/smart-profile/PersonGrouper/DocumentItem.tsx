/**
 * DocumentItem Component
 *
 * Draggable document card for use within PersonGrouper.
 * Uses @dnd-kit/sortable for drag-drop functionality.
 *
 * @module components/smart-profile/PersonGrouper/DocumentItem
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfidenceBadge } from '@/components/ui/confidence-badge';

// ============================================================================
// Types
// ============================================================================

export interface DocumentItemDocument {
  id: string;
  fileName: string;
  detectedType: string | null;
  confidence: number;
}

export interface DocumentItemProps {
  /** Document data to display */
  document: DocumentItemDocument;
  /** Whether this item is being dragged (overlay mode) */
  isDragging?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * DocumentItem is a draggable document card within a person group.
 *
 * Uses @dnd-kit/sortable for drag-drop functionality with:
 * - Drag handle (GripVertical icon)
 * - File icon and name
 * - Confidence badge
 * - Visual feedback during drag (ring, opacity)
 *
 * @example
 * ```tsx
 * <DocumentItem
 *   document={{
 *     id: 'doc-1',
 *     fileName: 'passport.pdf',
 *     detectedType: 'PASSPORT',
 *     confidence: 0.95
 *   }}
 * />
 * ```
 */
export function DocumentItem({ document, isDragging }: DocumentItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: document.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragging = isDragging || isSortableDragging;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-2 bg-background border rounded-md',
        'transition-all duration-150',
        dragging && 'opacity-50 shadow-lg ring-2 ring-primary'
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted transition-colors"
        aria-label={`Drag ${document.fileName}`}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* File icon */}
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />

      {/* File name */}
      <span className="flex-1 truncate text-sm">{document.fileName}</span>

      {/* Confidence badge */}
      <ConfidenceBadge confidence={document.confidence} size="sm" showIcon={false} />
    </div>
  );
}

export default DocumentItem;
