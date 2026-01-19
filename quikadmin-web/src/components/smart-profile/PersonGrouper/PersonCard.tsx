/**
 * PersonCard Component
 *
 * Droppable person container that holds draggable documents.
 * Displays person name, confidence, and document list with drag-drop reordering.
 *
 * @module components/smart-profile/PersonGrouper/PersonCard
 */

import * as React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Users, Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfidenceBadge } from '@/components/ui/confidence-badge';
import { DocumentItem, type DocumentItemDocument } from './DocumentItem';

// ============================================================================
// Types
// ============================================================================

export interface PersonGroup {
  id: string;
  name: string | null;
  confidence: number;
  documentIds: string[];
}

export interface PersonCardProps {
  /** Person group data */
  group: PersonGroup;
  /** Documents belonging to this person */
  documents: DocumentItemDocument[];
  /** Callback when person name is changed */
  onRename?: (groupId: string, newName: string) => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * PersonCard is a droppable container for documents belonging to a person.
 *
 * Features:
 * - Inline editable person name
 * - Confidence badge for grouping confidence
 * - Sortable document list with drag-drop
 * - Empty state when no documents
 * - Visual feedback when dragging over
 *
 * @example
 * ```tsx
 * <PersonCard
 *   group={{
 *     id: 'person-1',
 *     name: 'John Doe',
 *     confidence: 0.95,
 *     documentIds: ['doc-1', 'doc-2']
 *   }}
 *   documents={[
 *     { id: 'doc-1', fileName: 'passport.pdf', ... },
 *     { id: 'doc-2', fileName: 'license.pdf', ... }
 *   ]}
 *   onRename={(id, name) => console.log(`Renamed ${id} to ${name}`)}
 * />
 * ```
 */
export function PersonCard({ group, documents, onRename }: PersonCardProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editName, setEditName] = React.useState(group.name || '');
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Droppable setup for accepting dragged documents
  const { setNodeRef, isOver } = useDroppable({
    id: group.id,
  });

  // Focus input when editing starts
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Handle save name
  const handleSaveName = () => {
    const trimmedName = editName.trim();
    if (trimmedName && onRename) {
      onRename(group.id, trimmedName);
    }
    setIsEditing(false);
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditName(group.name || '');
    setIsEditing(false);
  };

  // Handle key press in input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const displayName = group.name || 'Unknown Person';
  const documentCount = documents.length;

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        'transition-all duration-200',
        isOver && 'ring-2 ring-primary ring-offset-2 bg-primary/5'
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          {/* Person name - editable */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Users className="h-5 w-5 text-muted-foreground shrink-0" />

            {isEditing ? (
              <div className="flex items-center gap-1 flex-1">
                <Input
                  ref={inputRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-7 text-sm"
                  placeholder="Enter person name"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={handleSaveName}
                  aria-label="Save name"
                >
                  <Check className="h-4 w-4 text-status-success-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={handleCancelEdit}
                  aria-label="Cancel edit"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="font-medium truncate">{displayName}</span>
                {onRename && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                    onClick={() => {
                      setEditName(group.name || '');
                      setIsEditing(true);
                    }}
                    aria-label="Edit person name"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Confidence badge */}
          <ConfidenceBadge confidence={group.confidence} size="sm" />
        </div>

        {/* Document count */}
        <p className="text-xs text-muted-foreground mt-1">
          {documentCount} document{documentCount !== 1 ? 's' : ''}
        </p>
      </CardHeader>

      <CardContent>
        <SortableContext items={group.documentIds} strategy={verticalListSortingStrategy}>
          {documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map((doc) => (
                <DocumentItem key={doc.id} document={doc} />
              ))}
            </div>
          ) : (
            <div
              className={cn(
                'flex flex-col items-center justify-center py-8 rounded-md border border-dashed',
                'text-muted-foreground',
                isOver && 'border-primary bg-primary/5'
              )}
            >
              <Users className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Drag documents here</p>
            </div>
          )}
        </SortableContext>
      </CardContent>
    </Card>
  );
}

export default PersonCard;
