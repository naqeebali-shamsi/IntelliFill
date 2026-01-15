/**
 * PersonGrouper Component
 *
 * Main component for organizing documents by person using drag-drop.
 * Orchestrates DndContext with PersonCard containers and DragOverlay.
 *
 * @module components/smart-profile/PersonGrouper
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { Plus, Combine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { PersonCard, type PersonGroup } from './PersonCard';
import { DocumentItem, type DocumentItemDocument } from './DocumentItem';
import { MergeSuggestion } from './MergeSuggestion';

// ============================================================================
// Types
// ============================================================================

export interface SuggestedMerge {
  /** IDs of the two groups suggested to merge */
  groupIds: [string, string];
  /** Confidence score for the suggestion (0-1) */
  confidence: number;
  /** Reason for the suggestion */
  reason: string;
}

export interface PersonGrouperProps {
  /** Person groups with their document IDs */
  groups: PersonGroup[];
  /** All documents available for grouping */
  documents: DocumentItemDocument[];
  /** Merge suggestions from backend entity resolution */
  suggestedMerges?: SuggestedMerge[];
  /** Callback when grouping changes (documents moved between groups) */
  onGroupingChange: (
    groups: Array<{ id: string; name: string | null; documentIds: string[] }>
  ) => void;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique ID for new groups
 */
function generateGroupId(): string {
  return `person-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Find which group contains a document or is the drop target
 */
function findGroupContaining(groups: PersonGroup[], itemId: string): string | null {
  // Check if itemId is a group ID
  const isGroup = groups.some((g) => g.id === itemId);
  if (isGroup) return itemId;

  // Find group containing this document
  for (const group of groups) {
    if (group.documentIds.includes(itemId)) {
      return group.id;
    }
  }
  return null;
}

/**
 * Move a document from one group to another
 */
function moveDocumentBetweenGroups(
  groups: PersonGroup[],
  documentId: string,
  sourceGroupId: string,
  targetGroupId: string
): PersonGroup[] {
  return groups.map((group) => {
    if (group.id === sourceGroupId) {
      // Remove from source
      return {
        ...group,
        documentIds: group.documentIds.filter((id) => id !== documentId),
      };
    }
    if (group.id === targetGroupId) {
      // Add to target (avoid duplicates)
      if (!group.documentIds.includes(documentId)) {
        return {
          ...group,
          documentIds: [...group.documentIds, documentId],
        };
      }
    }
    return group;
  });
}

/**
 * Merge all groups into a single group
 */
function mergeAllGroups(groups: PersonGroup[]): PersonGroup {
  const allDocumentIds = groups.flatMap((g) => g.documentIds);
  // Use the first group's name if available, or the first non-null name
  const firstName = groups.find((g) => g.name)?.name || null;
  // Calculate average confidence
  const avgConfidence = groups.reduce((sum, g) => sum + g.confidence, 0) / groups.length;

  return {
    id: groups[0]?.id || generateGroupId(),
    name: firstName,
    confidence: avgConfidence,
    documentIds: [...new Set(allDocumentIds)], // Dedupe
  };
}

/**
 * Merge two specific groups
 */
function mergeTwoGroups(groups: PersonGroup[], groupId1: string, groupId2: string): PersonGroup[] {
  const group1 = groups.find((g) => g.id === groupId1);
  const group2 = groups.find((g) => g.id === groupId2);

  if (!group1 || !group2) return groups;

  const mergedGroup: PersonGroup = {
    id: group1.id,
    name: group1.name || group2.name,
    confidence: (group1.confidence + group2.confidence) / 2,
    documentIds: [...new Set([...group1.documentIds, ...group2.documentIds])],
  };

  return groups.filter((g) => g.id !== groupId1 && g.id !== groupId2).concat(mergedGroup);
}

// ============================================================================
// Component
// ============================================================================

/**
 * PersonGrouper allows drag-drop organization of documents between person groups.
 *
 * Features:
 * - Drag documents between person cards
 * - DragOverlay shows dragged document
 * - Merge suggestions from backend entity resolution
 * - "Merge All" to combine all groups into one
 * - "Create New Person" to add an empty group for splitting
 * - Responsive grid layout (1/2/3 columns)
 *
 * @example
 * ```tsx
 * <PersonGrouper
 *   groups={[
 *     { id: 'p1', name: 'John Doe', confidence: 0.95, documentIds: ['d1', 'd2'] },
 *     { id: 'p2', name: 'Jane Doe', confidence: 0.88, documentIds: ['d3'] }
 *   ]}
 *   documents={[
 *     { id: 'd1', fileName: 'passport.pdf', ... },
 *     { id: 'd2', fileName: 'license.pdf', ... },
 *     { id: 'd3', fileName: 'id_card.pdf', ... }
 *   ]}
 *   suggestedMerges={[]}
 *   onGroupingChange={(groups) => console.log('Groups updated:', groups)}
 * />
 * ```
 */
export function PersonGrouper({
  groups: initialGroups,
  documents,
  suggestedMerges = [],
  onGroupingChange,
  className,
}: PersonGrouperProps) {
  // Local state for groups (clone from props for local manipulation)
  const [groups, setGroups] = React.useState<PersonGroup[]>(initialGroups);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [dismissedMerges, setDismissedMerges] = React.useState<Set<string>>(new Set());

  // Sync with props when they change
  React.useEffect(() => {
    setGroups(initialGroups);
  }, [initialGroups]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px drag before activating
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Find the active document being dragged
  const activeDocument = activeId ? documents.find((d) => d.id === activeId) : null;

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag over (for visual feedback)
  const handleDragOver = (_event: DragOverEvent) => {
    // Visual feedback is handled by useDroppable in PersonCard
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const activeDocId = active.id as string;
    const overId = over.id as string;

    // Find source and target groups
    const sourceGroupId = findGroupContaining(groups, activeDocId);
    const targetGroupId = findGroupContaining(groups, overId) || overId;

    if (sourceGroupId && targetGroupId && sourceGroupId !== targetGroupId) {
      const updatedGroups = moveDocumentBetweenGroups(
        groups,
        activeDocId,
        sourceGroupId,
        targetGroupId
      );
      setGroups(updatedGroups);
      onGroupingChange(
        updatedGroups.map(({ id, name, documentIds }) => ({
          id,
          name,
          documentIds,
        }))
      );
    }

    setActiveId(null);
  };

  // Handle group rename
  const handleRename = (groupId: string, newName: string) => {
    const updatedGroups = groups.map((g) => (g.id === groupId ? { ...g, name: newName } : g));
    setGroups(updatedGroups);
    onGroupingChange(
      updatedGroups.map(({ id, name, documentIds }) => ({
        id,
        name,
        documentIds,
      }))
    );
  };

  // Handle merge all
  const handleMergeAll = () => {
    if (groups.length <= 1) return;
    const merged = mergeAllGroups(groups);
    setGroups([merged]);
    onGroupingChange([{ id: merged.id, name: merged.name, documentIds: merged.documentIds }]);
  };

  // Handle create new person
  const handleCreateNewPerson = () => {
    const newGroup: PersonGroup = {
      id: generateGroupId(),
      name: null,
      confidence: 1.0, // User-created, so 100% confidence
      documentIds: [],
    };
    const updatedGroups = [...groups, newGroup];
    setGroups(updatedGroups);
    onGroupingChange(
      updatedGroups.map(({ id, name, documentIds }) => ({
        id,
        name,
        documentIds,
      }))
    );
  };

  // Handle merge suggestion accept
  const handleMergeSuggestion = (groupId1: string, groupId2: string) => {
    const updatedGroups = mergeTwoGroups(groups, groupId1, groupId2);
    setGroups(updatedGroups);
    onGroupingChange(
      updatedGroups.map(({ id, name, documentIds }) => ({
        id,
        name,
        documentIds,
      }))
    );
    // Dismiss the suggestion
    setDismissedMerges((prev) => new Set(prev).add(`${groupId1}-${groupId2}`));
  };

  // Handle merge suggestion dismiss
  const handleDismissSuggestion = (groupId1: string, groupId2: string) => {
    setDismissedMerges((prev) => new Set(prev).add(`${groupId1}-${groupId2}`));
  };

  // Filter active merge suggestions (not dismissed, both groups still exist)
  const activeMerges = suggestedMerges.filter((merge) => {
    const [id1, id2] = merge.groupIds;
    const key = `${id1}-${id2}`;
    const reverseKey = `${id2}-${id1}`;
    if (dismissedMerges.has(key) || dismissedMerges.has(reverseKey)) {
      return false;
    }
    // Both groups must still exist
    return groups.some((g) => g.id === id1) && groups.some((g) => g.id === id2);
  });

  // Get documents for each group
  const getGroupDocuments = (group: PersonGroup): DocumentItemDocument[] => {
    return documents.filter((d) => group.documentIds.includes(d.id));
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Merge suggestions */}
      {activeMerges.length > 0 && (
        <div className="space-y-2">
          {activeMerges.map((merge) => {
            const [id1, id2] = merge.groupIds;
            const group1 = groups.find((g) => g.id === id1);
            const group2 = groups.find((g) => g.id === id2);
            if (!group1 || !group2) return null;

            return (
              <MergeSuggestion
                key={`${id1}-${id2}`}
                groups={[
                  { id: group1.id, name: group1.name },
                  { id: group2.id, name: group2.name },
                ]}
                confidence={merge.confidence}
                reason={merge.reason}
                onMerge={() => handleMergeSuggestion(id1, id2)}
                onDismiss={() => handleDismissSuggestion(id1, id2)}
              />
            );
          })}
        </div>
      )}

      {/* DnD Context with Person Cards */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Responsive grid of PersonCards with staggered animation */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {groups.map((group) => (
            <motion.div key={group.id} variants={fadeInUp}>
              <PersonCard
                group={group}
                documents={getGroupDocuments(group)}
                onRename={handleRename}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Drag overlay - shows document being dragged */}
        <DragOverlay>
          {activeDocument ? <DocumentItem document={activeDocument} isDragging /> : null}
        </DragOverlay>
      </DndContext>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <Button variant="outline" size="sm" onClick={handleMergeAll} disabled={groups.length <= 1}>
          <Combine className="h-4 w-4 mr-2" />
          Merge All (Same Person)
        </Button>
        <Button variant="outline" size="sm" onClick={handleCreateNewPerson}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Person
        </Button>
      </div>
    </div>
  );
}

// Re-export types and subcomponents
export { DocumentItem, type DocumentItemDocument } from './DocumentItem';
export { PersonCard, type PersonGroup } from './PersonCard';
export { MergeSuggestion, type MergeSuggestionGroup } from './MergeSuggestion';

export default PersonGrouper;
