/**
 * Virtual Table Hook
 *
 * Provides virtualization for large table datasets using @tanstack/react-virtual.
 * Only renders visible rows plus a buffer zone for optimal performance.
 *
 * @module hooks/useVirtualTable
 */

import * as React from 'react';
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual';

export interface UseVirtualTableOptions<T> {
  /** Data rows to virtualize */
  data: T[];
  /** Estimated row height in pixels (default: 52) */
  estimatedRowHeight?: number;
  /** Number of rows to render outside viewport (default: 5) */
  overscan?: number;
  /** Enable virtualization only when row count exceeds threshold (default: 30) */
  virtualizeThreshold?: number;
}

export interface UseVirtualTableReturn<T> {
  /** Container ref to attach to scrollable element */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Virtual items to render */
  virtualItems: VirtualItem[];
  /** Total height for the virtualized container */
  totalHeight: number;
  /** Whether virtualization is active */
  isVirtualized: boolean;
  /** Get row data for a virtual item */
  getRowData: (virtualItem: VirtualItem) => T;
  /** Visible rows (for non-virtualized rendering) */
  visibleData: T[];
  /** Measure element callback for dynamic row heights */
  measureElement: (el: HTMLElement | null) => void;
}

/**
 * Hook for virtualizing large table datasets
 *
 * @example
 * ```tsx
 * const { containerRef, virtualItems, totalHeight, isVirtualized, getRowData } = useVirtualTable({
 *   data: documents,
 *   estimatedRowHeight: 52,
 *   virtualizeThreshold: 30,
 * });
 *
 * if (isVirtualized) {
 *   return (
 *     <div ref={containerRef} style={{ height: 400, overflow: 'auto' }}>
 *       <div style={{ height: totalHeight, position: 'relative' }}>
 *         {virtualItems.map((virtualItem) => {
 *           const row = getRowData(virtualItem);
 *           return <TableRow key={virtualItem.key} style={{ transform: `translateY(${virtualItem.start}px)` }} />;
 *         })}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useVirtualTable<T>({
  data,
  estimatedRowHeight = 52,
  overscan = 5,
  virtualizeThreshold = 30,
}: UseVirtualTableOptions<T>): UseVirtualTableReturn<T> {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Only virtualize when data exceeds threshold
  const isVirtualized = data.length > virtualizeThreshold;

  const virtualizer = useVirtualizer({
    count: isVirtualized ? data.length : 0,
    getScrollElement: () => containerRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan,
    enabled: isVirtualized,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();

  const getRowData = React.useCallback(
    (virtualItem: VirtualItem): T => data[virtualItem.index],
    [data]
  );

  const measureElement = React.useCallback(
    (el: HTMLElement | null) => {
      if (el) {
        virtualizer.measureElement(el);
      }
    },
    [virtualizer]
  );

  return {
    containerRef,
    virtualItems,
    totalHeight,
    isVirtualized,
    getRowData,
    visibleData: isVirtualized ? [] : data,
    measureElement,
  };
}
