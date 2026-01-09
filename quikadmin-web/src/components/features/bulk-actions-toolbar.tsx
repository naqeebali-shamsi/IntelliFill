/**
 * BulkActionsToolbar component - Toolbar for bulk document operations
 * Appears when documents are selected, provides bulk delete/download
 * @module components/features/bulk-actions-toolbar
 */

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { Download, Trash2, X } from "lucide-react"

export interface BulkActionsToolbarProps {
  /**
   * Number of selected documents
   */
  selectedCount: number

  /**
   * Delete callback
   */
  onDelete: () => void | Promise<void>

  /**
   * Download callback
   */
  onDownload: () => void | Promise<void>

  /**
   * Clear selection callback
   */
  onClearSelection: () => void

  /**
   * Loading state for delete operation
   */
  isDeleting?: boolean

  /**
   * Loading state for download operation
   */
  isDownloading?: boolean

  /**
   * Custom className
   */
  className?: string
}

/**
 * BulkActionsToolbar component
 *
 * Sticky toolbar that appears when documents are selected
 * Provides bulk delete and download actions
 *
 * @example
 * ```tsx
 * {selectedCount > 0 && (
 *   <BulkActionsToolbar
 *     selectedCount={selectedCount}
 *     onDelete={handleBulkDelete}
 *     onDownload={handleBulkDownload}
 *     onClearSelection={clearSelection}
 *     isDeleting={isBulkDeleting}
 *     isDownloading={isBulkDownloading}
 *   />
 * )}
 * ```
 */
export function BulkActionsToolbar({
  selectedCount,
  onDelete,
  onDownload,
  onClearSelection,
  isDeleting = false,
  isDownloading = false,
  className,
}: BulkActionsToolbarProps) {
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)

  if (selectedCount === 0) return null

  const handleDelete = async () => {
    setShowDeleteDialog(false)
    await onDelete()
  }

  const handleDownload = async () => {
    await onDownload()
  }

  return (
    <>
      <div
        className={cn(
          "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
          "flex items-center gap-3 px-4 py-3 rounded-lg",
          "bg-primary text-primary-foreground shadow-lg border",
          "animate-in fade-in slide-in-from-bottom-2 duration-300",
          className
        )}
        data-testid="bulk-actions-toolbar"
      >
        {/* Selection count */}
        <div className="flex items-center gap-2 px-3 py-1 bg-primary-foreground/10 rounded">
          <span className="font-semibold text-sm">
            {selectedCount} {selectedCount === 1 ? "document" : "documents"} selected
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading || isDeleting}
            className="h-8"
            data-testid="bulk-download"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
            {isDownloading && (
              <span className="ml-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDownloading || isDeleting}
            className="h-8"
            data-testid="bulk-delete"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
            {isDeleting && (
              <span className="ml-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
          </Button>
        </div>

        {/* Clear selection */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          disabled={isDownloading || isDeleting}
          className="h-8 hover:bg-primary-foreground/10"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} document{selectedCount !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{' '}
              {selectedCount === 1 ? 'this document' : `these ${selectedCount} documents`}{' '}
              from your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/**
 * Mobile-optimized version of BulkActionsToolbar
 * Fixed to bottom of screen with full width
 */
export function BulkActionsToolbarMobile({
  selectedCount,
  onDelete,
  onDownload,
  onClearSelection,
  isDeleting = false,
  isDownloading = false,
  className,
}: BulkActionsToolbarProps) {
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)

  if (selectedCount === 0) return null

  const handleDelete = async () => {
    setShowDeleteDialog(false)
    await onDelete()
  }

  return (
    <>
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50",
          "flex flex-col gap-2 p-4",
          "bg-primary text-primary-foreground shadow-lg border-t",
          "animate-in slide-in-from-bottom duration-300",
          "sm:hidden", // Only show on mobile
          className
        )}
      >
        {/* Selection count */}
        <div className="text-center text-sm font-medium">
          {selectedCount} {selectedCount === 1 ? "document" : "documents"} selected
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onDownload}
            disabled={isDownloading || isDeleting}
            className="w-full"
          >
            <Download className="h-4 w-4" />
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDownloading || isDeleting}
            className="w-full"
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={isDownloading || isDeleting}
            className="w-full hover:bg-primary-foreground/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} document{selectedCount !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{' '}
              {selectedCount === 1 ? 'this document' : `these ${selectedCount} documents`}{' '}
              from your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
