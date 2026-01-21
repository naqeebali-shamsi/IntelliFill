/**
 * FilledFormHistory Page
 *
 * Displays a searchable, filterable history of all filled forms
 * with actions for viewing details, downloading PDFs, and deleting.
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  FileText,
  Search,
  Calendar,
  Download,
  Trash2,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  LayoutTemplate,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { staggerContainer, fadeInUpSubtle } from '@/lib/animations';

import {
  filledFormsService,
  type FilledForm,
  type ExportFormat,
} from '@/services/filledFormsService';
import {
  useFilledFormsStore,
  useFilledFormsFilters,
  useFilledFormsPagination,
} from '@/stores/filledFormsStore';

// =================== CONSTANTS ===================

const sortOptions = [
  { value: 'createdAt', label: 'Date Created' },
  { value: 'templateName', label: 'Template Name' },
  { value: 'clientName', label: 'Client Name' },
];

// =================== HELPER FUNCTIONS ===================

function downloadFile(blob: Blob, form: FilledForm, format: ExportFormat): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  const baseName = `${form.clientName}_${form.templateName}`.replace(/[^a-zA-Z0-9._-]/g, '_');
  link.href = url;
  link.download = `${baseName}.${format}`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// =================== COMPONENTS ===================

interface FilledFormRowProps {
  form: FilledForm;
  onDownload: (form: FilledForm, format: ExportFormat) => void;
  onDelete: (form: FilledForm) => void;
  isDeleting: boolean;
}

function FilledFormRow({ form, onDownload, onDelete, isDeleting }: FilledFormRowProps) {
  const exportFormats: { format: ExportFormat; label: string }[] = [
    { format: 'pdf', label: 'PDF' },
    { format: 'json', label: 'JSON' },
    { format: 'csv', label: 'CSV' },
  ];

  return (
    <motion.tr
      variants={fadeInUpSubtle}
      className="group hover:bg-muted/30 transition-colors"
      data-testid={`filled-form-row-${form.id}`}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium text-foreground">{form.templateName}</p>
            <p className="text-xs text-muted-foreground">
              {form.templateCategory || 'Uncategorized'}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm text-foreground">{form.clientName}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formatDate(form.createdAt)}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Export form"
                data-testid={`download-form-${form.id}`}
              >
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {exportFormats.map(({ format, label }) => (
                <DropdownMenuItem
                  key={format}
                  onClick={() => onDownload(form, format)}
                  data-testid={`export-${format}-${form.id}`}
                >
                  Download {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDelete(form)}
            disabled={isDeleting}
            title="Delete"
            data-testid={`delete-form-${form.id}`}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </TableCell>
    </motion.tr>
  );
}

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  formName?: string;
  isDeleting: boolean;
}

function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  formName,
  isDeleting,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Filled Form</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {formName ? `"${formName}"` : 'this form'}? This action
            cannot be undone and the PDF file will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// =================== MAIN COMPONENT ===================

export default function FilledFormHistory() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Store hooks
  const { filter, setSearchQuery, clearFilter, hasActiveFilters } =
    useFilledFormsFilters();
  const { page, pageSize, setPage, nextPage, previousPage } = useFilledFormsPagination();
  const sort = useFilledFormsStore((state) => state.sort);
  const setSort = useFilledFormsStore((state) => state.setSort);

  // Local state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<FilledForm | null>(null);
  const [searchInput, setSearchInput] = useState(filter.searchQuery);

  // Calculate offset from page and pageSize
  const offset = (page - 1) * pageSize;

  // Fetch filled forms
  const {
    data: response,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['filled-forms', { page, pageSize, ...filter, sort }],
    queryFn: () =>
      filledFormsService.getFilledForms({
        limit: pageSize,
        offset,
        templateId: filter.templateId || undefined,
        clientId: filter.clientId || undefined,
      }),
    staleTime: 30000, // 30 seconds
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => filledFormsService.deleteFilledForm(id),
    onSuccess: () => {
      toast.success('Form deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['filled-forms'] });
      setDeleteDialogOpen(false);
      setFormToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to delete form');
    },
  });

  // Handlers
  const handleSearch = useCallback(() => {
    setSearchQuery(searchInput);
  }, [searchInput, setSearchQuery]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSearch();
      }
    },
    [handleSearch]
  );

  const handleDownload = useCallback(async (form: FilledForm, format: ExportFormat = 'pdf') => {
    try {
      const blob = await filledFormsService.exportFilledForm(form.id, format);
      downloadFile(blob, form, format);
      toast.success(`Download started (${format.toUpperCase()})`);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to download form');
    }
  }, []);

  const handleDeleteClick = useCallback((form: FilledForm) => {
    setFormToDelete(form);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (formToDelete) {
      deleteMutation.mutate(formToDelete.id);
    }
  }, [formToDelete, deleteMutation]);

  const handleSortChange = useCallback(
    (value: string) => {
      setSort({ field: value as any, direction: sort.direction });
    },
    [setSort, sort.direction]
  );

  // Derived data
  const filledForms = response?.data?.filledForms || [];
  const pagination = response?.data?.pagination;
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 0;

  // Filter forms by search query (client-side filtering for immediate feedback)
  const displayedForms = useMemo(() => {
    if (!filter.searchQuery) return filledForms;
    const query = filter.searchQuery.toLowerCase();
    return filledForms.filter(
      (form) =>
        form.templateName.toLowerCase().includes(query) ||
        form.clientName.toLowerCase().includes(query)
    );
  }, [filledForms, filter.searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto" data-testid="filled-form-history">
      {/* Page Header */}
      <PageHeader
        title="Filled Forms History"
        description="View and manage all your generated filled forms."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Filled Forms History' }]}
      />

      {/* Filter Bar */}
      <div className="glass-panel p-4 rounded-xl flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div className="flex flex-1 items-center gap-3 w-full sm:w-auto flex-wrap">
          {/* Search Input */}
          <div className="relative flex-1 sm:flex-initial sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
            <Input
              placeholder="Search forms..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onBlur={handleSearch}
              className="pl-9 bg-background/50 border-white/10 focus:bg-background transition-all"
              data-testid="form-search"
            />
          </div>

          {/* Sort By */}
          <Select value={sort.field} onValueChange={handleSortChange}>
            <SelectTrigger className="w-40" data-testid="sort-by">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearFilter();
                setSearchInput('');
              }}
              className="text-muted-foreground"
              data-testid="clear-filters"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Results Count */}
        {!isLoading && pagination && (
          <div className="text-sm text-muted-foreground">
            {pagination.total} form{pagination.total !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 text-muted-foreground"
            data-testid="loading-state"
          >
            <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary/50" />
            <p>Loading filled forms...</p>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-10"
            data-testid="error-state"
          >
            <EmptyState
              icon={FileText}
              title="Failed to load forms"
              description="There was an error loading your filled forms. Please try again."
              action={{
                label: 'Retry',
                onClick: () => queryClient.invalidateQueries({ queryKey: ['filled-forms'] }),
              }}
            />
          </motion.div>
        ) : displayedForms.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="py-10"
            data-testid="empty-state"
          >
            <EmptyState
              icon={hasActiveFilters ? Search : FileCheck}
              title={hasActiveFilters ? 'No forms match your filters' : 'No filled forms yet'}
              description={
                hasActiveFilters
                  ? 'Try adjusting your search or filter criteria'
                  : 'Process a document to get started generating filled forms.'
              }
              action={
                hasActiveFilters
                  ? {
                      label: 'Clear Filters',
                      onClick: () => {
                        clearFilter();
                        setSearchInput('');
                      },
                      variant: 'outline',
                    }
                  : {
                      label: 'Go to Templates',
                      onClick: () => navigate('/templates'),
                      icon: LayoutTemplate,
                    }
              }
            />
          </motion.div>
        ) : (
          <motion.div
            key="table"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="bg-card/30 backdrop-blur-sm border border-white/5 rounded-xl overflow-hidden"
            data-testid="forms-table"
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/10">
                  <TableHead className="w-[35%]">Form Name</TableHead>
                  <TableHead className="w-[25%]">Client</TableHead>
                  <TableHead className="w-[25%]">Created</TableHead>
                  <TableHead className="w-[15%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedForms.map((form) => (
                  <FilledFormRow
                    key={form.id}
                    form={form}
                    onDownload={handleDownload}
                    onDelete={handleDeleteClick}
                    isDeleting={deleteMutation.isPending && formToDelete?.id === form.id}
                  />
                ))}
              </TableBody>
            </Table>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      {!isLoading && pagination && pagination.total > pageSize && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted-foreground">
            Showing {offset + 1}-{Math.min(offset + pageSize, pagination.total)} of{' '}
            {pagination.total}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={previousPage}
              disabled={page === 1}
              data-testid="prev-page"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={nextPage}
              disabled={!pagination.hasMore}
              data-testid="next-page"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        formName={formToDelete?.templateName}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
