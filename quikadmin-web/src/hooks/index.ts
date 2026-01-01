/**
 * React Hooks Library
 * @module hooks
 *
 * Central export for all React hooks used in the application.
 * Foundation hooks are re-exported from usehooks-ts for battle-tested implementations.
 */

// =============================================================================
// APPLICATION-SPECIFIC HOOKS
// =============================================================================

// Debounce hooks (custom - predates usehooks-ts adoption)
export * from './useDebounce';

// API & Data hooks
export * from './useApiData';
export * from './useDocuments';
export * from './useDocumentActions';
export * from './useDocumentDetail';
export * from './useDocumentStats';
export * from './useJobPolling';
export * from './useUpload';

// =============================================================================
// FOUNDATION HOOKS (from usehooks-ts)
// Re-exported for consistent import paths across codebase
// See: https://usehooks-ts.com/
// =============================================================================

// State management
export { useToggle, useBoolean, useCounter, useMap } from 'usehooks-ts';

// Storage
export { useLocalStorage, useSessionStorage, useReadLocalStorage } from 'usehooks-ts';

// Timing
export { useTimeout, useInterval, useCountdown } from 'usehooks-ts';

// DOM & Events
export {
  useEventListener,
  useOnClickOutside,
  useHover,
  useIntersectionObserver,
  useResizeObserver,
} from 'usehooks-ts';

// Browser state
export {
  useMediaQuery,
  useWindowSize,
  useCopyToClipboard,
  useDocumentTitle,
  useIsClient,
  useIsMounted,
} from 'usehooks-ts';

// Utilities
export { useDebounceValue, useDebounceCallback, useUnmount } from 'usehooks-ts';
