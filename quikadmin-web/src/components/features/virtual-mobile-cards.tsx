/**
 * Virtual Mobile Cards Component
 *
 * Renders virtualized card layout for mobile table views.
 * Uses absolute positioning for efficient scrolling on mobile devices.
 *
 * @module components/features/virtual-mobile-cards
 */

import * as React from 'react';
import { VirtualItem } from '@tanstack/react-virtual';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { Column } from './data-table';

interface VirtualMobileCardsProps<T extends Record<string, unknown>> {
  /** Virtual items from useVirtualTable */
  virtualItems: VirtualItem[];
  /** Total height for container sizing */
  totalHeight: number;
  /** Get row data from virtual item */
  getRowData: (virtualItem: VirtualItem) => T;
  /** Column definitions */
  columns: Column<T>[];
  /** Enable row selection */
  selectable?: boolean;
  /** Selected row IDs */
  selected: string[];
  /** Get unique ID from row */
  getRowId: (row: T) => string;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Row selection handler */
  onRowSelect: (rowId: string, checked: boolean) => void;
  /** Measure element callback for dynamic heights */
  measureElement?: (el: HTMLElement | null) => void;
}

/**
 * VirtualMobileCards - Renders virtualized card layout for mobile
 *
 * @example
 * ```tsx
 * <VirtualMobileCards
 *   virtualItems={virtualItems}
 *   totalHeight={totalHeight}
 *   getRowData={getRowData}
 *   columns={columns}
 *   selected={selectedRows}
 *   getRowId={(row) => row.id}
 *   onRowSelect={handleRowSelect}
 * />
 * ```
 */
export function VirtualMobileCards<T extends Record<string, unknown>>({
  virtualItems,
  totalHeight,
  getRowData,
  columns,
  selectable,
  selected,
  getRowId,
  onRowClick,
  onRowSelect,
  measureElement,
}: VirtualMobileCardsProps<T>) {
  return (
    <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
      {virtualItems.map((virtualItem) => {
        const row = getRowData(virtualItem);
        const rowId = getRowId(row);
        const isSelected = selected.includes(rowId);

        return (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={measureElement}
            onClick={() => onRowClick?.(row)}
            className={cn(
              'rounded-lg border bg-card p-4 space-y-2',
              onRowClick && 'cursor-pointer hover:bg-accent/50 transition-colors',
              isSelected && 'border-primary bg-accent/50'
            )}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {selectable && (
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onRowSelect(rowId, checked === true)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select row ${virtualItem.index + 1}`}
                />
                <span className="text-xs text-muted-foreground">
                  {isSelected ? 'Selected' : 'Select'}
                </span>
              </div>
            )}
            {columns.map((column) => (
              <div key={String(column.key)} className="flex justify-between items-start gap-2">
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
  );
}

export default VirtualMobileCards;
