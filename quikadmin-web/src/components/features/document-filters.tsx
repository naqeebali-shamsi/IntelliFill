/**
 * DocumentFilters component - Filter controls for document library
 * Provides status, file type, and date range filtering
 * @module components/features/document-filters
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { TagInput } from '@/components/features/tag-input';
import { Filter, X, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocumentFilter, DocumentStatus, DateRangePreset } from '@/types/document';

export interface DocumentFiltersProps {
  /**
   * Current filter state
   */
  filter: DocumentFilter;

  /**
   * Filter change callback
   */
  onFilterChange: (filter: Partial<DocumentFilter>) => void;

  /**
   * Clear all filters callback
   */
  onClearFilter: () => void;

  /**
   * Current date range preset
   */
  dateRangePreset?: DateRangePreset;

  /**
   * Date range preset change callback
   */
  onDateRangePresetChange?: (preset: DateRangePreset) => void;

  /**
   * Available tag suggestions for autocomplete
   */
  tagSuggestions?: string[];

  /**
   * Custom className
   */
  className?: string;
}

const STATUS_OPTIONS: Array<{ value: DocumentStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

const FILE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'application/pdf', label: 'PDF' },
  {
    value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'DOCX',
  },
  { value: 'text/csv', label: 'CSV' },
  { value: 'image/jpeg', label: 'JPG' },
  { value: 'image/png', label: 'PNG' },
];

const DATE_RANGE_PRESETS: Array<{ value: DateRangePreset; label: string }> = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
  { value: 'year', label: 'Last Year' },
];

/** Dismissible badge for active filter indicators */
function FilterBadge({
  label,
  icon,
  onClear,
}: {
  label: string;
  icon?: React.ReactNode;
  onClear: () => void;
}): React.ReactElement {
  return (
    <Badge variant="secondary" className="gap-1">
      {icon}
      {label}
      <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={onClear} />
    </Badge>
  );
}

/**
 * DocumentFilters component
 *
 * @example
 * ```tsx
 * <DocumentFilters
 *   filter={filter}
 *   onFilterChange={setFilter}
 *   onClearFilter={clearFilter}
 *   dateRangePreset={dateRangePreset}
 *   onDateRangePresetChange={setDateRangePreset}
 * />
 * ```
 */
export function DocumentFilters({
  filter,
  onFilterChange,
  onClearFilter,
  dateRangePreset = 'all',
  onDateRangePresetChange,
  tagSuggestions = [],
  className,
}: DocumentFiltersProps) {
  const [open, setOpen] = React.useState(false);

  // Count active filters
  const hasStatusFilter = filter.status && filter.status.length > 0;
  const hasFileTypeFilter = filter.fileType && filter.fileType.length > 0;
  const hasDateRangeFilter = dateRangePreset !== 'all';
  const hasConfidenceFilter = filter.minConfidence && filter.minConfidence > 0;
  const hasTagsFilter = filter.tags && filter.tags.length > 0;

  const activeFilterCount = [
    hasStatusFilter,
    hasFileTypeFilter,
    hasDateRangeFilter,
    hasConfidenceFilter,
    hasTagsFilter,
  ].filter(Boolean).length;

  const handleStatusToggle = (status: DocumentStatus) => {
    const currentStatuses = filter.status || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter((s) => s !== status)
      : [...currentStatuses, status];

    onFilterChange({ status: newStatuses.length > 0 ? newStatuses : undefined });
  };

  const handleFileTypeToggle = (fileType: string) => {
    const currentTypes = filter.fileType || [];
    const newTypes = currentTypes.includes(fileType)
      ? currentTypes.filter((t) => t !== fileType)
      : [...currentTypes, fileType];

    onFilterChange({ fileType: newTypes.length > 0 ? newTypes : undefined });
  };

  const handleClearAll = () => {
    onClearFilter();
    setOpen(false);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filters</h4>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </Button>
              )}
            </div>

            {/* Status Filter */}
            <div className="space-y-2" data-testid="document-filter-status">
              <Label className="text-xs font-medium">Status</Label>
              <div className="space-y-2">
                {STATUS_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${option.value}`}
                      checked={filter.status?.includes(option.value) || false}
                      onCheckedChange={() => handleStatusToggle(option.value)}
                    />
                    <label
                      htmlFor={`status-${option.value}`}
                      className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* File Type Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">File Type</Label>
              <div className="space-y-2">
                {FILE_TYPE_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`filetype-${option.value}`}
                      checked={filter.fileType?.includes(option.value) || false}
                      onCheckedChange={() => handleFileTypeToggle(option.value)}
                    />
                    <label
                      htmlFor={`filetype-${option.value}`}
                      className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Date Range Preset */}
            {onDateRangePresetChange && (
              <div className="space-y-2">
                <Label htmlFor="date-range" className="text-xs font-medium">
                  Date Range
                </Label>
                <Select value={dateRangePreset} onValueChange={onDateRangePresetChange}>
                  <SelectTrigger id="date-range">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_RANGE_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Tags Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Tags</Label>
              <TagInput
                tags={filter.tags || []}
                onChange={(tags) => onFilterChange({ tags: tags.length > 0 ? tags : undefined })}
                suggestions={tagSuggestions}
                placeholder="Filter by tags..."
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filter Badges */}
      {hasStatusFilter && (
        <FilterBadge
          label={`Status: ${filter.status!.length}`}
          onClear={() => onFilterChange({ status: undefined })}
        />
      )}

      {hasFileTypeFilter && (
        <FilterBadge
          label={`Type: ${filter.fileType!.length}`}
          onClear={() => onFilterChange({ fileType: undefined })}
        />
      )}

      {hasDateRangeFilter && (
        <FilterBadge
          label={
            DATE_RANGE_PRESETS.find((p) => p.value === dateRangePreset)?.label ?? dateRangePreset
          }
          onClear={() => onDateRangePresetChange?.('all')}
        />
      )}

      {hasTagsFilter && (
        <FilterBadge
          icon={<Tag className="h-3 w-3" />}
          label={`Tags: ${filter.tags!.length}`}
          onClear={() => onFilterChange({ tags: undefined })}
        />
      )}
    </div>
  );
}
