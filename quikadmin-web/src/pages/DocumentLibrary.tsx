/**
 * DocumentLibrary page - Comprehensive document management
 * Redesigned with "Deep Ocean" aesthetic (Glassmorphism + Linear Style)
 */

import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/page-header';
import { ResponsiveGrid } from '@/components/layout/responsive-grid';
import { EmptyState } from '@/components/ui/empty-state';
import { DocumentCard } from '@/components/features/document-card';
import { DataTable, Column } from '@/components/features/data-table';
import { StatusBadge } from '@/components/features/status-badge';
import { DocumentStatistics } from '@/components/features/document-statistics';
import { DocumentFilters } from '@/components/features/document-filters';
import { BulkActionsToolbar } from '@/components/features/bulk-actions-toolbar';
import { DocumentDetail } from '@/components/features/document-detail';
import { toast } from 'sonner';
import {
  Upload,
  Search,
  Grid3X3,
  List,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileText,
  Filter,
  X,
} from 'lucide-react';
import {
  useDocuments,
  applyClientSideFilters,
  applyClientSideSorting,
  applyClientSidePagination,
} from '@/hooks/useDocuments';
import { useDocumentActions } from '@/hooks/useDocumentActions';
import { getDocumentStats } from '@/hooks/useDocumentStats';
import {
  useDocumentStore,
  useDocumentSelection,
  useDocumentViewMode,
  useDocumentFilters,
  useDocumentSort,
  useDocumentPagination,
} from '@/stores/documentStore';
import { Document, DocumentStatus, getFriendlyFileType } from '@/types/document';
import { formatFileSize } from '@/utils/fileValidation';
import { format } from 'date-fns';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { staggerContainerFast, fadeInUpSubtle } from '@/lib/animations';

export default function DocumentLibrary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
  } = useDocumentSelection();

  const { viewMode, setViewMode, toggleViewMode } = useDocumentViewMode();
  const {
    filter,
    setFilter,
    clearFilter,
    hasActiveFilters,
    dateRangePreset,
    applyDateRangePreset,
  } = useDocumentFilters();
  const { sort, setSort } = useDocumentSort();
  const { page, pageSize, setPage, setPageSize, resetPage } = useDocumentPagination();

  // Local UI state
  const [selectedDocumentId, setSelectedDocumentId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState(filter.searchQuery || '');

  // Debounce search query (300ms)
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Update filter when debounced search changes
  React.useEffect(() => {
    setFilter({ searchQuery: debouncedSearch });
  }, [debouncedSearch, setFilter]);

  // Fetch documents with React Query
  const { data, isLoading, error, refetch } = useDocuments({
    filter,
    sort,
    page,
    pageSize,
  });

  // Document actions
  const { downloadDocument, bulkDelete, bulkDownload, isBulkDeleting, isBulkDownloading } =
    useDocumentActions();

  // Apply client-side filtering and sorting logic
  // Extract documents to a stable variable for React Compiler memoization compatibility
  const documents_data = data?.documents;
  const clientFilteredDocs = React.useMemo(() => {
    if (!documents_data) return [];
    return applyClientSideFilters(documents_data, filter);
  }, [documents_data, filter]);

  const sortedDocs = React.useMemo(() => {
    return applyClientSideSorting(clientFilteredDocs, sort);
  }, [clientFilteredDocs, sort]);

  const paginatedResult = React.useMemo(() => {
    return applyClientSidePagination(sortedDocs, page, pageSize);
  }, [sortedDocs, page, pageSize]);

  const documents = paginatedResult.data;
  const totalDocuments = paginatedResult.total;
  const totalPages = paginatedResult.totalPages;

  // Calculate statistics
  const statistics = React.useMemo(() => {
    return getDocumentStats(clientFilteredDocs);
  }, [clientFilteredDocs]);

  // Handlers
  const handleDocumentClick = (id: string) => setSelectedDocumentId(id);
  const handleDocumentSelect = (id: string) => toggleDocument(id);

  const handleSelectAll = () => {
    if (selectionCount === documents.length) {
      clearSelection();
    } else {
      selectAll(documents.map((doc) => doc.id));
    }
  };

  const handleDownload = async (doc: Document) => {
    await downloadDocument({ id: doc.id, fileName: doc.fileName });
  };

  const handleBulkDelete = async () => {
    await bulkDelete(selectedIds);
    clearSelection();
  };

  const handleBulkDownload = async () => {
    const docsToDownload = documents
      .filter((doc) => selectedIds.includes(doc.id))
      .map((doc) => ({ id: doc.id, fileName: doc.fileName }));

    await bulkDownload(docsToDownload);
  };

  const handleSortChange = (field: string) => {
    if (sort.field === field) {
      // Toggle direction
      setSort({ field: sort.field, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setSort({ field: field as any, direction: 'asc' });
    }
  };

  const handleRefresh = () => {
    refetch();
    toast.success('Documents refreshed');
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && documents.length > 0) {
        e.preventDefault();
        handleSelectAll();
      }
      if (e.key === 'Escape') {
        if (selectedDocumentId) setSelectedDocumentId(null);
        else if (selectionCount > 0) clearSelection();
      }
      if (e.key === 'Delete' && selectionCount > 0) handleBulkDelete();
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        document.getElementById('document-search')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    documents,
    selectionCount,
    selectedDocumentId,
    handleSelectAll,
    clearSelection,
    handleBulkDelete,
  ]);

  // DataTable columns
  const columns: Column<Document>[] = [
    {
      key: 'fileName',
      header: 'Name',
      sortable: true,
      render: (value, doc) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <span className="font-medium truncate max-w-md text-foreground" title={doc.fileName}>
            {doc.fileName}
          </span>
        </div>
      ),
    },
    {
      key: 'fileType',
      header: 'Type',
      sortable: true,
      render: (value) => (
        <span className="text-muted-foreground">{getFriendlyFileType(value as string)}</span>
      ),
    },
    {
      key: 'fileSize',
      header: 'Size',
      sortable: true,
      render: (value) => (
        <span className="font-mono text-xs text-muted-foreground">
          {formatFileSize(value as number)}
        </span>
      ),
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
      render: (value) => (
        <span className="text-muted-foreground">
          {format(new Date(value as string), 'MMM d, yyyy')}
        </span>
      ),
    },
  ];

  // Header action buttons
  const headerActions = (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={isLoading}
        className="border-border/50 hover:bg-secondary/20"
      >
        <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
        Refresh
      </Button>
      <Button
        onClick={() => navigate('/upload')}
        className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
      >
        <Upload className="h-4 w-4 mr-2" />
        Upload Documents
      </Button>
    </>
  );

  return (
    <div className="space-y-6" data-testid="document-library">
      {/* Page Header */}
      <PageHeader
        title="Document Library"
        description="Manage and organize your processed documents."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Documents' }]}
        actions={headerActions}
      />

      {/* Statistics Dashboard */}
      <DocumentStatistics statistics={statistics} loading={isLoading} />

      {/* Toolbar: Search, Filters, View Mode Toggle */}
      <div className="glass-panel p-4 rounded-xl flex flex-col gap-4 sm:flex-row sm:items-center justify-between sticky top-20 z-10">
        <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-initial sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
            <Input
              id="document-search"
              data-testid="document-search"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background/50 border-white/10 focus:bg-background transition-all"
            />
          </div>

          <div className="h-8 w-[1px] bg-border mx-2 hidden sm:block" />

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
        <div className="flex bg-muted/20 p-1 rounded-lg border border-white/5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 px-2 rounded-md transition-all',
              viewMode === 'grid'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 px-2 rounded-md transition-all',
              viewMode === 'table'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setViewMode('table')}
            aria-label="Table view"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Selection Actions */}
      <AnimatePresence>
        {selectionCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
                {selectionCount}
              </span>
              <span className="text-sm font-medium text-primary">Selected</span>
            </div>
            <div className="flex items-center gap-2">
              <BulkActionsToolbar
                selectedCount={selectionCount}
                onDelete={handleBulkDelete}
                onDownload={handleBulkDownload}
                onClearSelection={clearSelection}
                isDeleting={isBulkDeleting}
                isDownloading={isBulkDownloading}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Documents Grid or Table */}
      <AnimatePresence mode="wait">
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
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
                      variant: 'outline',
                    }
                  : {
                      label: 'Upload Documents',
                      onClick: () => navigate('/upload'),
                      icon: Upload,
                    }
              }
            />
          </motion.div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <motion.div variants={staggerContainerFast} initial="hidden" animate="show" data-testid="document-grid">
            <ResponsiveGrid preset="cards">
              {isLoading
                ? Array.from({ length: pageSize }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-64 bg-muted/40 rounded-xl" />
                    </div>
                  ))
                : documents.map((doc) => (
                    <motion.div
                      key={doc.id}
                      variants={fadeInUpSubtle}
                      layoutId={doc.id}
                      className="relative group"
                    >
                      {/* Selection Checkbox Overlay */}
                      <div
                        className={cn(
                          'absolute top-3 left-3 z-20 transition-opacity duration-200',
                          isSelected(doc.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected(doc.id)}
                          onChange={() => handleDocumentSelect(doc.id)}
                          className="h-5 w-5 rounded border-input cursor-pointer accent-primary"
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
                    </motion.div>
                  ))}
            </ResponsiveGrid>
          </motion.div>
        ) : (
          /* Table View */
          <motion.div
            variants={staggerContainerFast}
            initial="hidden"
            animate="show"
            className="bg-card/30 backdrop-blur-sm border border-white/5 rounded-xl overflow-hidden"
            data-testid="document-list"
          >
            <DataTable
              data={documents}
              columns={columns}
              loading={isLoading}
              onRowClick={(doc) => handleDocumentClick(doc.id)}
              emptyState={<EmptyState title="No documents" description="No documents found" />}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalDocuments)} of{' '}
            {totalDocuments} documents
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="w-24 border-border/50"
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
              className="w-24 border-border/50"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Actions Toolbar (This component might need its own redesign, but effectively handled by the floating header above) */}
      {/* Keeping explicit toolbar hidden but using logic from before */}

      {/* Document Detail Modal */}
      <DocumentDetail
        documentId={selectedDocumentId}
        open={!!selectedDocumentId}
        onClose={() => setSelectedDocumentId(null)}
      />
    </div>
  );
}
