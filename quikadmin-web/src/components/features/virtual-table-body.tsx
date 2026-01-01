/**
 * Virtual Table Body Component
 *
 * Renders virtualized table rows for large datasets.
 * Uses absolute positioning for efficient scrolling.
 *
 * @module components/features/virtual-table-body
 */

import * as React from 'react';
import { VirtualItem } from '@tanstack/react-virtual';
import { TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { Column } from './data-table';

interface VirtualTableBodyProps<T extends Record<string, unknown>> {
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
 * VirtualTableBody - Renders only visible table rows for performance
 *
 * @example
 * ```tsx
 * <VirtualTableBody
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
export function VirtualTableBody<T extends Record<string, unknown>>({
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
}: VirtualTableBodyProps<T>) {
  return (
    <TableBody style={{ height: `${totalHeight}px`, position: 'relative' }}>
      {virtualItems.map((virtualItem) => {
        const row = getRowData(virtualItem);
        const rowId = getRowId(row);
        const isSelected = selected.includes(rowId);

        return (
          <TableRow
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={measureElement}
            onClick={() => onRowClick?.(row)}
            className={cn(onRowClick && 'cursor-pointer', isSelected && 'bg-accent/50')}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {selectable && (
              <TableCell onClick={(e) => e.stopPropagation()} className="w-12">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onRowSelect(rowId, checked === true)}
                  aria-label={`Select row ${virtualItem.index + 1}`}
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
  );
}

export default VirtualTableBody;
