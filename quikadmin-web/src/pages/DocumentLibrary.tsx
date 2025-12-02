/**
 * DocumentLibrary page - Comprehensive document management
 * Features: Search, filters, sorting, bulk actions, grid/table view, pagination
 * @module pages/DocumentLibrary
 */

import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { DocumentCard } from '@/components/features/document-card'
import { DataTable, Column } from '@/components/features/data-table'
import { StatusBadge } from '@/components/features/status-badge'
import { DocumentStatistics } from '@/components/features/document-statistics'
import { DocumentFilters } from '@/components/features/document-filters'
import { BulkActionsToolbar } from '@/components/features/bulk-actions-toolbar'
import { DocumentDetail } from '@/components/features/document-detail'
import { toast } from 'sonner'
import {
  Upload,
  Search,
  Grid3X3,
  List,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import { useDocuments, applyClientSideFilters, applyClientSideSorting, applyClientSidePagination } from '@/hooks/useDocuments'
import { useDocumentActions } from '@/hooks/useDocumentActions'
import { getDocumentStats } from '@/hooks/useDocumentStats'
import {
  useDocumentStore,
  useDocumentSelection,
  useDocumentViewMode,
  useDocumentFilters,
  useDocumentSort,
  useDocumentPagination,
} from '@/stores/documentStore'
import { Document, DocumentStatus, getFriendlyFileType, formatFileSize } from '@/types/document'
import { format } from 'date-fns'
import { useDebouncedValue } from '@/hooks/useDebounce'

export default function DocumentLibrary() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // State from stores
  const {
    selectedIds,
    selectionCount,
    selectDocument,
    deselectDocument,
    toggleDocument,
    selectAll,
    clearSelection,
    isSelected,
  } = useDocumentSelection()

  const { viewMode, setViewMode, toggleViewMode } = useDocumentViewMode()
  const { filter, setFilter, clearFilter, hasActiveFilters, dateRangePreset, applyDateRangePreset } = useDocumentFilters()
  const { sort, setSort } = useDocumentSort()
  const { page, pageSize, setPage, setPageSize, resetPage } = useDocumentPagination()

  // Local UI state
  const [selectedDocumentId, setSelectedDocumentId] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState(filter.searchQuery || '')

  // Debounce search query (300ms)
  const debouncedSearch = useDebouncedValue(searchQuery, 300)

  // Update filter when debounced search changes
  React.useEffect(() => {
    setFilter({ searchQuery: debouncedSearch })
  }, [debouncedSearch, setFilter])

  // Fetch documents with React Query
  const { data, isLoading, error, refetch } = useDocuments({
    filter,
    sort,
    page,
    pageSize,
  })

  // Document actions
  const { downloadDocument, bulkDelete, bulkDownload, isBulkDeleting, isBulkDownloading } = useDocumentActions()

  // Apply client-side filtering for filters not supported by backend
  const clientFilteredDocs = React.useMemo(() => {
    if (!data?.documents) return []
    return applyClientSideFilters(data.documents, filter)
  }, [data?.documents, filter])

  // Apply client-side sorting (backend doesn't support all sort fields yet)
  const sortedDocs = React.useMemo(() => {
    return applyClientSideSorting(clientFilteredDocs, sort)
  }, [clientFilteredDocs, sort])

  // Apply client-side pagination
  const paginatedResult = React.useMemo(() => {
    return applyClientSidePagination(sortedDocs, page, pageSize)
  }, [sortedDocs, page, pageSize])

  const documents = paginatedResult.data
  const totalDocuments = paginatedResult.total
  const totalPages = paginatedResult.totalPages

  // Calculate statistics
  const statistics = React.useMemo(() => {
    return getDocumentStats(clientFilteredDocs)
  }, [clientFilteredDocs])

  // Handle document actions
  const handleDocumentClick = (id: string) => {
    setSelectedDocumentId(id)
  }

  const handleDocumentSelect = (id: string) => {
    toggleDocument(id)
  }

  const handleSelectAll = () => {
    if (selectionCount === documents.length) {
      clearSelection()
    } else {
      selectAll(documents.map((doc) => doc.id))
    }
  }

  const handleDownload = async (doc: Document) => {
    await downloadDocument({ id: doc.id, fileName: doc.fileName })
  }

  const handleBulkDelete = async () => {
    await bulkDelete(selectedIds)
    clearSelection()
  }

  const handleBulkDownload = async () => {
    const docsToDownload = documents
      .filter((doc) => selectedIds.includes(doc.id))
      .map((doc) => ({ id: doc.id, fileName: doc.fileName }))

    await bulkDownload(docsToDownload)
  }

  const handleSortChange = (field: string) => {
    if (sort.field === field) {
      // Toggle direction
      setSort({ field: sort.field, direction: sort.direction === 'asc' ? 'desc' : 'asc' })
    } else {
      setSort({ field: field as any, direction: 'asc' })
    }
  }

  const handleRefresh = () => {
    refetch()
    toast.success('Documents refreshed')
  }

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + A: Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && documents.length > 0) {
        e.preventDefault()
        handleSelectAll()
      }

      // Escape: Clear selection or close modal
      if (e.key === 'Escape') {
        if (selectedDocumentId) {
          setSelectedDocumentId(null)
        } else if (selectionCount > 0) {
          clearSelection()
        }
      }

      // Delete: Delete selected (with confirmation)
      if (e.key === 'Delete' && selectionCount > 0) {
        handleBulkDelete()
      }

      // Ctrl/Cmd + F: Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        document.getElementById('document-search')?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [documents, selectionCount, selectedDocumentId])

  // DataTable columns
  const columns: Column<Document>[] = [
    {
      key: 'fileName',
      header: 'Name',
      sortable: true,
      render: (value, doc) => (
        <div className="flex items-center gap-2">
          <span className="font-medium truncate max-w-md" title={doc.fileName}>
            {doc.fileName}
          </span>
        </div>
      ),
    },
    {
      key: 'fileType',
      header: 'Type',
      sortable: true,
      render: (value) => getFriendlyFileType(value as string),
    },
    {
      key: 'fileSize',
      header: 'Size',
      sortable: true,
      render: (value) => formatFileSize(value as number),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (value) => <StatusBadge status={value as DocumentStatus} showIcon size="sm" />,
    },
    {
      key: 'createdAt',
      header: 'Uploaded',
      sortable: true,
      render: (value) => format(new Date(value as string), 'MMM d, yyyy'),
    },
  ]

  return (
    <div className="space-y-6 pb-20">
      {/* Page Header */}
      <PageHeader
        title="Document Library"
        description="View, download, and manage your processed documents"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Documents' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => navigate('/upload')}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Documents
            </Button>
          </div>
        }
      />

      {/* Statistics Dashboard */}
      <DocumentStatistics statistics={statistics} loading={isLoading} />

      {/* Toolbar: Search, Filters, View Mode Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-initial sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="document-search"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters */}
          <DocumentFilters
            filter={filter}
            onFilterChange={setFilter}
            onClearFilter={clearFilter}
            dateRangePreset={dateRangePreset}
            onDateRangePresetChange={(preset) => applyDateRangePreset(preset)}
          />
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
            aria-label="Table view"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Selection Actions */}
      {selectionCount > 0 && viewMode === 'grid' && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectionCount} selected
          </span>
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      )}

      {/* Documents Grid or Table */}
      {error ? (
        <EmptyState
          title="Failed to load documents"
          description={error.message}
          action={{
            label: 'Try Again',
            onClick: () => refetch(),
          }}
        />
      ) : documents.length === 0 && !isLoading ? (
        <EmptyState
          title={hasActiveFilters ? 'No documents match your filters' : 'No documents yet'}
          description={
            hasActiveFilters
              ? 'Try adjusting your search or filters'
              : 'Upload your first document to get started'
          }
          action={
            hasActiveFilters
              ? {
                  label: 'Clear Filters',
                  onClick: clearFilter,
                }
              : {
                  label: 'Upload Documents',
                  onClick: () => navigate('/upload'),
                  icon: Upload,
                }
          }
        />
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading
            ? Array.from({ length: pageSize }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-48 bg-muted rounded-lg" />
                </div>
              ))
            : documents.map((doc) => (
                <div key={doc.id} className="relative">
                  {/* Selection Checkbox */}
                  <div className="absolute top-3 left-3 z-10">
                    <input
                      type="checkbox"
                      checked={isSelected(doc.id)}
                      onChange={() => handleDocumentSelect(doc.id)}
                      className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  <DocumentCard
                    id={doc.id}
                    name={doc.fileName}
                    fileType={doc.fileType as any}
                    status={doc.status}
                    uploadDate={doc.createdAt}
                    fileSize={doc.fileSize}
                    pageCount={doc.pageCount || undefined}
                    onView={() => handleDocumentClick(doc.id)}
                    onDownload={() => handleDownload(doc)}
                    onClick={() => handleDocumentClick(doc.id)}
                  />
                </div>
              ))}
        </div>
      ) : (
        /* Table View */
        <DataTable
          data={documents}
          columns={columns}
          loading={isLoading}
          onRowClick={(doc) => handleDocumentClick(doc.id)}
          emptyState={
            <EmptyState
              title="No documents"
              description="No documents found"
            />
          }
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalDocuments)} of {totalDocuments} documents
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm font-medium px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectionCount}
        onDelete={handleBulkDelete}
        onDownload={handleBulkDownload}
        onClearSelection={clearSelection}
        isDeleting={isBulkDeleting}
        isDownloading={isBulkDownloading}
      />

      {/* Document Detail Modal */}
      <DocumentDetail
        documentId={selectedDocumentId}
        open={!!selectedDocumentId}
        onClose={() => setSelectedDocumentId(null)}
      />
    </div>
  )
}
