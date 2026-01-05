/**
 * UI Constants
 *
 * Centralized constants for UI components to ensure consistency
 * and make it easier to maintain magic numbers across the application.
 *
 * @module constants/ui
 */

/**
 * Data Table Constants
 */
export const DATA_TABLE = {
  /**
   * Debounce delay for search input in milliseconds
   * Used to prevent excessive filtering while user is typing
   */
  SEARCH_DEBOUNCE_MS: 300,

  /**
   * Default estimated row height in pixels for virtualization
   * Used to calculate virtual scrolling offsets
   */
  ROW_HEIGHT_PX: 52,

  /**
   * Maximum height for virtualized table container in pixels
   * Determines when table becomes scrollable
   */
  MAX_HEIGHT_PX: 400,

  /**
   * Number of rows threshold to enable virtualization
   * Tables with fewer rows will render all rows directly
   */
  VIRTUALIZE_THRESHOLD: 30,
} as const;

/**
 * Animation and Transition Durations (milliseconds)
 */
export const ANIMATION = {
  /**
   * Fast transitions (hover states, tooltips)
   */
  FAST: 150,

  /**
   * Normal transitions (modals, drawers)
   */
  NORMAL: 300,

  /**
   * Slow transitions (page transitions)
   */
  SLOW: 500,
} as const;

/**
 * Z-Index Layers
 * Ensures consistent stacking order across components
 */
export const Z_INDEX = {
  BASE: 0,
  DROPDOWN: 10,
  STICKY: 20,
  HEADER: 30,
  OVERLAY: 40,
  MODAL: 50,
  POPOVER: 60,
  TOAST: 70,
  TOOLTIP: 80,
} as const;
