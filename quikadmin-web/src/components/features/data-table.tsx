import * as React from 'react';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/useDebounce';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export interface Column<T> {
  /**
   * Column key (must match data object key)
   */
  key: keyof T;
  /**
   * Column header label
   */
  header: string;
  /**
   * Enable sorting for this column
   */
  sortable?: boolean;
  /**
   * Custom render function
   */
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  /**
   * Custom className for column cells
   */
  className?: string;
  /**
   * Custom className for header cell
   */
  headerClassName?: string;
}

export interface DataTableProps<T> {
  /**
   * Table data
   */
  data: T[];
  /**
   * Column definitions
   */
  columns: Column<T>[];
  /**
   * Enable search functionality
   */
  searchable?: boolean;
  /**
   * Search placeholder text
   */
  searchPlaceholder?: string;
  /**
   * Search callback (controlled)
   */
  onSearch?: (query: string) => void;
  /**
   * Enable row selection
   */
  selectable?: boolean;
  /**
   * Selected row IDs (controlled)
   */
  selectedRows?: string[];
  /**
   * Selection change callback
   */
  onSelectionChange?: (selectedIds: string[]) => void;
  /**
   * Get unique ID from row data
   */
  getRowId?: (row: T) => string;
  /**
   * Pagination configuration
   */
  pagination?: {
    pageSize?: number;
    currentPage?: number;
    totalItems?: number;
    onPageChange?: (page: number) => void;
  };
  /**
   * Empty state component
   */
  emptyState?: React.ReactNode;
  /**
   * Loading state
   */
  loading?: boolean;
  /**
   * Row click handler
   */
  onRowClick?: (row: T) => void;
  /**
   * Custom className for table container
   */
  className?: string;
  /**
   * Custom className for table
   */
  tableClassName?: string;
}

type SortDirection = 'asc' | 'desc' | null;

/**
 * DataTable component for displaying tabular data with sorting, search, and pagination.
 *
 * @example
 * const columns: Column<Document>[] = [
 *   { key: "name", header: "Name", sortable: true },
 *   { key: "status", header: "Status", render: (value) => <StatusBadge status={value} /> },
 *   { key: "createdAt", header: "Date", sortable: true },
 * ]
 *
 * <DataTable
 *   data={documents}
 *   columns={columns}
 *   searchable
 *   pagination={{ pageSize: 10 }}
 *   onRowClick={handleRowClick}
 * />
 */
function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  searchable = false,
  searchPlaceholder = 'Search...',
  onSearch,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  getRowId = (row) => String((row as any).id || JSON.stringify(row)),
  pagination,
  emptyState,
  loading = false,
  onRowClick,
  className,
  tableClassName,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300); // 300ms debounce for filtering
  const [sortColumn, setSortColumn] = React.useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = React.useState(pagination?.currentPage || 1);
  const [internalSelectedRows, setInternalSelectedRows] = React.useState<string[]>(selectedRows);

  // Use controlled or internal state for selection
  const isControlled = selectedRows !== undefined && onSelectionChange !== undefined;
  const selected = isControlled ? selectedRows : internalSelectedRows;

  const handleSelectionChange = React.useCallback(
    (newSelection: string[]) => {
      if (!isControlled) {
        setInternalSelectedRows(newSelection);
      }
      onSelectionChange?.(newSelection);
    },
    [isControlled, onSelectionChange]
  );

  // Handle row selection
  const handleRowSelect = (rowId: string, checked: boolean) => {
    if (checked) {
      handleSelectionChange([...selected, rowId]);
    } else {
      handleSelectionChange(selected.filter((id) => id !== rowId));
    }
  };

  // Filter data based on search query (uses debounced query to reduce computations)
  const filteredData = React.useMemo(() => {
    if (!debouncedSearchQuery) return data;

    return data.filter((row) =>
      columns.some((column) => {
        const value = row[column.key];
        return value?.toString().toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      })
    );
  }, [data, debouncedSearchQuery, columns]);

  // Sort data
  const sortedData = React.useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortColumn, sortDirection]);

  // Paginate data
  const pageSize = pagination?.pageSize || sortedData.length;
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = paginatedData.map((row) => getRowId(row));
      handleSelectionChange([...selected, ...allIds.filter((id) => !selected.includes(id))]);
    } else {
      const currentPageIds = paginatedData.map((row) => getRowId(row));
      handleSelectionChange(selected.filter((id) => !currentPageIds.includes(id)));
    }
  };

  const allRowsSelected =
    paginatedData.length > 0 && paginatedData.every((row) => selected.includes(getRowId(row)));
  const someRowsSelected = paginatedData.some((row) => selected.includes(getRowId(row)));

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page on search
    if (onSearch) {
      onSearch(query);
    }
  };

  // Handle sorting
  const handleSort = (column: keyof T) => {
    if (sortColumn === column) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortColumn(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    if (pagination?.onPageChange) {
      pagination.onPageChange(page);
    }
  };

  const getSortIcon = (columnKey: keyof T) => {
    if (sortColumn !== columnKey) {
      return <ChevronsUpDown className="h-4 w-4" />;
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="h-4 w-4" />;
    }
    return <ChevronDown className="h-4 w-4" />;
  };

  return (
    <div data-slot="data-table" className={cn('space-y-4', className)}>
      {/* Search */}
      {searchable && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
              aria-label="Search table"
            />
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : paginatedData.length === 0 ? (
        // Empty State
        emptyState || (
          <EmptyState
            title="No results found"
            description={searchQuery ? 'Try adjusting your search' : 'No data available'}
          />
        )
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <Table className={cn(tableClassName)}>
              <TableHeader>
                <TableRow>
                  {selectable && (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allRowsSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all rows"
                      />
                    </TableHead>
                  )}
                  {columns.map((column) => (
                    <TableHead key={String(column.key)} className={cn(column.headerClassName)}>
                      {column.sortable ? (
                        <Button
                          variant="ghost"
                          onClick={() => handleSort(column.key)}
                          className="h-auto p-0 font-semibold hover:bg-transparent"
                        >
                          {column.header}
                          {getSortIcon(column.key)}
                        </Button>
                      ) : (
                        <span className="font-semibold">{column.header}</span>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((row, rowIndex) => {
                  const rowId = getRowId(row);
                  const isSelected = selected.includes(rowId);
                  return (
                    <TableRow
                      key={rowIndex}
                      onClick={() => onRowClick?.(row)}
                      className={cn(onRowClick && 'cursor-pointer', isSelected && 'bg-accent/50')}
                    >
                      {selectable && (
                        <TableCell onClick={(e) => e.stopPropagation()} className="w-12">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleRowSelect(rowId, checked === true)}
                            aria-label={`Select row ${rowIndex + 1}`}
                          />
                        </TableCell>
                      )}
                      {columns.map((column) => (
                        <TableCell key={String(column.key)} className={cn(column.className)}>
                          {column.render
                            ? column.render(row[column.key], row)
                            : String(row[column.key] ?? '')}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {paginatedData.map((row, rowIndex) => {
              const rowId = getRowId(row);
              const isSelected = selected.includes(rowId);
              return (
                <div
                  key={rowIndex}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'rounded-lg border bg-card p-4 space-y-2',
                    onRowClick && 'cursor-pointer hover:bg-accent/50 transition-colors',
                    isSelected && 'border-primary bg-accent/50'
                  )}
                >
                  {selectable && (
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleRowSelect(rowId, checked === true)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select row ${rowIndex + 1}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {isSelected ? 'Selected' : 'Select'}
                      </span>
                    </div>
                  )}
                  {columns.map((column) => (
                    <div
                      key={String(column.key)}
                      className="flex justify-between items-start gap-2"
                    >
                      <span className="text-sm font-medium text-muted-foreground shrink-0">
                        {column.header}:
                      </span>
                      <span className="text-sm text-right">
                        {column.render
                          ? column.render(row[column.key], row)
                          : String(row[column.key] ?? '')}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination && totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} results
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export { DataTable };
