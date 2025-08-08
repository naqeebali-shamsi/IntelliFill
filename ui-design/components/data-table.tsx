// Modern Data Table with Sorting and Filtering
import React, { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem
} from '@/components/ui/dropdown-menu'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Search,
  Filter,
  Download,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  ArrowUpDown,
  SlidersHorizontal
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DataTableColumn<T> {
  key: keyof T
  label: string
  sortable?: boolean
  filterable?: boolean
  render?: (item: T) => React.ReactNode
  width?: string
  align?: 'left' | 'center' | 'right'
}

interface DataTableProps<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  searchable?: boolean
  selectable?: boolean
  actions?: Array<{
    label: string
    icon?: React.ReactNode
    onClick: (item: T) => void
    variant?: 'default' | 'destructive'
  }>
  onSelectionChange?: (selectedItems: T[]) => void
  className?: string
  pageSize?: number
  emptyState?: React.ReactNode
}

type SortDirection = 'asc' | 'desc' | null

interface SortState {
  column: string | null
  direction: SortDirection
}

// Sample PDF data for demonstration
interface PDFRecord {
  id: string
  filename: string
  status: 'completed' | 'processing' | 'failed' | 'pending'
  uploadDate: string
  fileSize: number
  processedBy: string
  forms: number
  lastModified: string
}

const sampleData: PDFRecord[] = [
  {
    id: '1',
    filename: 'employee_handbook_2024.pdf',
    status: 'completed',
    uploadDate: '2024-01-15T10:30:00Z',
    fileSize: 2048576,
    processedBy: 'Sarah Johnson',
    forms: 5,
    lastModified: '2024-01-15T14:30:00Z'
  },
  {
    id: '2',
    filename: 'contract_template.pdf',
    status: 'processing',
    uploadDate: '2024-01-15T09:15:00Z',
    fileSize: 1024000,
    processedBy: 'Mike Chen',
    forms: 8,
    lastModified: '2024-01-15T13:45:00Z'
  },
  {
    id: '3',
    filename: 'quarterly_report_q4.pdf',
    status: 'failed',
    uploadDate: '2024-01-14T16:20:00Z',
    fileSize: 5242880,
    processedBy: 'Emily Davis',
    forms: 3,
    lastModified: '2024-01-14T16:45:00Z'
  },
  {
    id: '4',
    filename: 'tax_forms_2024.pdf',
    status: 'pending',
    uploadDate: '2024-01-14T14:10:00Z',
    fileSize: 3145728,
    processedBy: 'Alex Rivera',
    forms: 12,
    lastModified: '2024-01-14T14:10:00Z'
  },
  {
    id: '5',
    filename: 'user_manual_v3.pdf',
    status: 'completed',
    uploadDate: '2024-01-13T11:45:00Z',
    fileSize: 7340032,
    processedBy: 'David Kim',
    forms: 2,
    lastModified: '2024-01-13T15:20:00Z'
  }
]

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const StatusBadge: React.FC<{ status: PDFRecord['status'] }> = ({ status }) => {
  const variants = {
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
    processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
  }

  return (
    <Badge variant="outline" className={variants[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

function DataTable<T>({
  data,
  columns,
  searchable = true,
  selectable = true,
  actions,
  onSelectionChange,
  className = '',
  pageSize = 10,
  emptyState
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: null })
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(columns.map(col => String(col.key)))
  )
  const [currentPage, setCurrentPage] = useState(1)

  // Filter and search data
  const filteredData = useMemo(() => {
    let filtered = [...data]

    // Apply search filter
    if (searchTerm && searchable) {
      filtered = filtered.filter((item) => {
        return columns.some((column) => {
          const value = item[column.key]
          return value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        })
      })
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([columnKey, filterValue]) => {
      if (filterValue) {
        filtered = filtered.filter((item) => {
          const value = item[columnKey as keyof T]
          return value?.toString().toLowerCase().includes(filterValue.toLowerCase())
        })
      }
    })

    return filtered
  }, [data, searchTerm, columnFilters, columns, searchable])

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortState.column || !sortState.direction) {
      return filteredData
    }

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortState.column as keyof T]
      const bValue = b[sortState.column as keyof T]

      if (aValue === bValue) return 0

      const comparison = aValue! < bValue! ? -1 : 1
      return sortState.direction === 'asc' ? comparison : -comparison
    })
  }, [filteredData, sortState])

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return sortedData.slice(startIndex, startIndex + pageSize)
  }, [sortedData, currentPage, pageSize])

  const totalPages = Math.ceil(sortedData.length / pageSize)

  const handleSort = (columnKey: string) => {
    const column = columns.find(col => String(col.key) === columnKey)
    if (!column?.sortable) return

    setSortState(prev => {
      if (prev.column === columnKey) {
        // Cycle through: null -> asc -> desc -> null
        const direction = prev.direction === null ? 'asc' : prev.direction === 'asc' ? 'desc' : null
        return { column: direction ? columnKey : null, direction }
      }
      return { column: columnKey, direction: 'asc' }
    })
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = paginatedData.map((item) => String((item as any).id))
      setSelectedItems(new Set(allIds))
    } else {
      setSelectedItems(new Set())
    }
  }

  const handleSelectItem = (itemId: string, checked: boolean) => {
    const newSelected = new Set(selectedItems)
    if (checked) {
      newSelected.add(itemId)
    } else {
      newSelected.delete(itemId)
    }
    setSelectedItems(newSelected)
  }

  const getSortIcon = (columnKey: string) => {
    if (sortState.column !== columnKey) {
      return <ChevronsUpDown className="h-4 w-4" />
    }
    return sortState.direction === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    )
  }

  React.useEffect(() => {
    if (onSelectionChange) {
      const selectedData = paginatedData.filter(item => selectedItems.has(String((item as any).id)))
      onSelectionChange(selectedData)
    }
  }, [selectedItems, paginatedData, onSelectionChange])

  const isAllSelected = paginatedData.length > 0 && paginatedData.every(item => selectedItems.has(String((item as any).id)))
  const isIndeterminate = selectedItems.size > 0 && !isAllSelected

  return (
    <div className={cn("space-y-4", className)}>
      {/* Table Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          {searchable && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search all columns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                aria-label="Search table data"
              />
            </div>
          )}

          {/* Column Filters */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {Object.values(columnFilters).filter(Boolean).length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1">
                    {Object.values(columnFilters).filter(Boolean).length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-80">
              <DropdownMenuLabel>Filter Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns
                .filter(col => col.filterable)
                .map((column) => (
                  <div key={String(column.key)} className="p-2">
                    <label className="text-sm font-medium mb-2 block">
                      {column.label}
                    </label>
                    <Input
                      placeholder={`Filter by ${column.label.toLowerCase()}...`}
                      value={columnFilters[String(column.key)] || ''}
                      onChange={(e) =>
                        setColumnFilters(prev => ({
                          ...prev,
                          [String(column.key)]: e.target.value
                        }))
                      }
                      className="h-8"
                    />
                  </div>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Column Visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={String(column.key)}
                  checked={visibleColumns.has(String(column.key))}
                  onCheckedChange={(checked) => {
                    const newVisible = new Set(visibleColumns)
                    if (checked) {
                      newVisible.add(String(column.key))
                    } else {
                      newVisible.delete(String(column.key))
                    }
                    setVisibleColumns(newVisible)
                  }}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center space-x-2">
          {selectedItems.size > 0 && (
            <Badge variant="secondary" className="px-2">
              {selectedItems.size} selected
            </Badge>
          )}
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <div className="relative overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {selectable && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={isAllSelected}
                      ref={(ref) => {
                        if (ref) ref.indeterminate = isIndeterminate
                      }}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all rows"
                    />
                  </TableHead>
                )}
                {columns
                  .filter(col => visibleColumns.has(String(col.key)))
                  .map((column) => (
                    <TableHead
                      key={String(column.key)}
                      className={cn(
                        column.sortable && "cursor-pointer select-none hover:bg-muted/50",
                        column.align === 'center' && "text-center",
                        column.align === 'right' && "text-right"
                      )}
                      style={{ width: column.width }}
                      onClick={() => column.sortable && handleSort(String(column.key))}
                    >
                      <div className="flex items-center gap-2">
                        {column.label}
                        {column.sortable && getSortIcon(String(column.key))}
                      </div>
                    </TableHead>
                  ))}
                {actions && <TableHead className="w-12">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.filter(col => visibleColumns.has(String(col.key))).length + (selectable ? 1 : 0) + (actions ? 1 : 0)}
                    className="text-center py-8"
                  >
                    {emptyState || (
                      <div className="text-muted-foreground">
                        <Search className="h-8 w-8 mx-auto mb-4 opacity-50" />
                        <p>No results found</p>
                        <p className="text-sm">Try adjusting your search or filter criteria</p>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((item, index) => (
                  <TableRow
                    key={String((item as any).id) || index}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    {selectable && (
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.has(String((item as any).id))}
                          onCheckedChange={(checked) => 
                            handleSelectItem(String((item as any).id), !!checked)
                          }
                          aria-label={`Select row ${index + 1}`}
                        />
                      </TableCell>
                    )}
                    {columns
                      .filter(col => visibleColumns.has(String(col.key)))
                      .map((column) => (
                        <TableCell
                          key={String(column.key)}
                          className={cn(
                            column.align === 'center' && "text-center",
                            column.align === 'right' && "text-right"
                          )}
                        >
                          {column.render ? column.render(item) : String(item[column.key] || '')}
                        </TableCell>
                      ))}
                    {actions && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {actions.map((action, actionIndex) => (
                              <DropdownMenuItem
                                key={actionIndex}
                                onClick={() => action.onClick(item)}
                                className={cn(
                                  action.variant === 'destructive' && 
                                  "text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                                )}
                              >
                                {action.icon && <span className="mr-2">{action.icon}</span>}
                                {action.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} results
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  const isNearCurrent = Math.abs(page - currentPage) <= 1
                  const isFirst = page === 1
                  const isLast = page === totalPages
                  return isNearCurrent || isFirst || isLast
                })
                .map((page, index, array) => {
                  const prevPage = array[index - 1]
                  const showEllipsis = prevPage && page - prevPage > 1
                  
                  return (
                    <React.Fragment key={page}>
                      {showEllipsis && <span className="px-2 text-muted-foreground">...</span>}
                      <Button
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    </React.Fragment>
                  )
                })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Example usage component
export const PDFDataTable: React.FC = () => {
  const columns: DataTableColumn<PDFRecord>[] = [
    {
      key: 'filename',
      label: 'File Name',
      sortable: true,
      filterable: true,
      render: (item) => (
        <div className="font-medium truncate max-w-xs" title={item.filename}>
          {item.filename}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      filterable: true,
      render: (item) => <StatusBadge status={item.status} />
    },
    {
      key: 'fileSize',
      label: 'Size',
      sortable: true,
      align: 'right',
      render: (item) => formatFileSize(item.fileSize)
    },
    {
      key: 'forms',
      label: 'Forms',
      sortable: true,
      align: 'center',
      render: (item) => (
        <Badge variant="outline" className="font-mono">
          {item.forms}
        </Badge>
      )
    },
    {
      key: 'processedBy',
      label: 'Processed By',
      sortable: true,
      filterable: true
    },
    {
      key: 'uploadDate',
      label: 'Upload Date',
      sortable: true,
      render: (item) => formatDate(item.uploadDate)
    },
    {
      key: 'lastModified',
      label: 'Last Modified',
      sortable: true,
      render: (item) => formatDate(item.lastModified)
    }
  ]

  const actions = [
    {
      label: 'View',
      icon: <Eye className="h-4 w-4" />,
      onClick: (item: PDFRecord) => alert(`View ${item.filename}`)
    },
    {
      label: 'Edit',
      icon: <Edit className="h-4 w-4" />,
      onClick: (item: PDFRecord) => alert(`Edit ${item.filename}`)
    },
    {
      label: 'Delete',
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (item: PDFRecord) => alert(`Delete ${item.filename}`),
      variant: 'destructive' as const
    }
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">PDF Files</h1>
        <p className="text-muted-foreground">
          Manage and monitor your PDF processing workflow
        </p>
      </div>
      
      <DataTable
        data={sampleData}
        columns={columns}
        actions={actions}
        searchable={true}
        selectable={true}
        pageSize={5}
        onSelectionChange={(selected) => {
          console.log('Selected items:', selected)
        }}
      />
    </div>
  )
}

export { DataTable }
export default PDFDataTable