/**
 * Unified data fetching hook with standardized error handling, caching, and retry logic
 * @module hooks/useFetch
 *
 * Provides a consistent pattern for data fetching across the application,
 * wrapping @tanstack/react-query with:
 * - Centralized error handling
 * - Retry logic with exponential backoff
 * - Request caching with sensible defaults
 * - Unified loading/error states
 * - Automatic AbortController cleanup
 */

import * as React from 'react';
import {
  useQuery,
  useMutation,
  UseQueryOptions,
  UseMutationOptions,
  QueryKey,
} from '@tanstack/react-query';
import api from '@/services/api';
import { getUserErrorMessage, isRetryableError } from '@/utils/errorMessages';

// =============================================================================
// RETRY CONFIGURATION
// =============================================================================

/** Default retry configuration with exponential backoff */
const DEFAULT_RETRY_CONFIG = {
  retries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

/**
 * Calculate delay with exponential backoff and jitter
 * Jitter prevents thundering herd when multiple requests fail simultaneously
 */
function calculateRetryDelay(
  attemptIndex: number,
  config = DEFAULT_RETRY_CONFIG
): number {
  const delay = Math.min(
    config.baseDelay * Math.pow(config.backoffMultiplier, attemptIndex),
    config.maxDelay
  );
  // Add jitter (±25%) to prevent thundering herd
  const jitter = delay * 0.25 * (Math.random() - 0.5);
  return Math.round(delay + jitter);
}

// =============================================================================
// TYPES
// =============================================================================

export interface UseFetchOptions<TData = unknown, TError = Error>
  extends Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'> {
  /** URL path (relative to API base) */
  url: string;
  /** Query parameters */
  params?: Record<string, unknown>;
  /** Cache time in milliseconds (default: 5 minutes) */
  cacheTime?: number;
  /** Stale time in milliseconds (default: 30 seconds) */
  staleTime?: number;
  /** Enable retry with exponential backoff (default: true) */
  enableRetry?: boolean;
  /** Custom retry configuration */
  retryConfig?: Partial<typeof DEFAULT_RETRY_CONFIG>;
  /** Transform response data */
  transform?: (data: unknown) => TData;
  /** Custom error handler */
  onError?: (error: TError) => void;
}

export interface UseFetchResult<TData, TError = Error> {
  data: TData | undefined;
  error: TError | null;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  refetch: () => Promise<unknown>;
  /** User-friendly error message */
  errorMessage: string | null;
  /** Whether the error is retryable */
  isRetryable: boolean;
}

export interface UseMutateOptions<
  TData = unknown,
  TError = Error,
  TVariables = unknown,
> extends Omit<UseMutationOptions<TData, TError, TVariables>, 'mutationFn'> {
  /** HTTP method */
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** URL path (relative to API base) or function that returns URL */
  url: string | ((variables: TVariables) => string);
  /** Transform response data */
  transform?: (data: unknown) => TData;
  /** Enable retry for mutations (default: false for safety) */
  enableRetry?: boolean;
}

// =============================================================================
// MAIN HOOKS
// =============================================================================

/**
 * Unified data fetching hook with standardized patterns
 *
 * @example
 * ```tsx
 * const { data, isLoading, errorMessage } = useFetch({
 *   url: '/users/me/data',
 *   staleTime: 60000,
 *   transform: (res) => res.data,
 * })
 * ```
 */
export function useFetch<TData = unknown, TError = Error>(
  options: UseFetchOptions<TData, TError>
): UseFetchResult<TData, TError> {
  const {
    url,
    params,
    cacheTime = 5 * 60 * 1000, // 5 minutes
    staleTime = 30 * 1000, // 30 seconds
    enableRetry = true,
    retryConfig = {},
    transform,
    onError,
    ...queryOptions
  } = options;

  const mergedRetryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

  // Create stable query key
  const queryKey: QueryKey = React.useMemo(
    () => ['fetch', url, params].filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url, JSON.stringify(params)]
  );

  // AbortController for cleanup
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      // Create new AbortController linked to React Query's signal
      abortControllerRef.current = new AbortController();

      // Link to React Query's abort signal
      signal?.addEventListener('abort', () => {
        abortControllerRef.current?.abort();
      });

      const response = await api.get(url, {
        params,
        signal: abortControllerRef.current.signal,
      });

      const data = response.data;
      return transform ? transform(data) : data;
    },
    staleTime,
    gcTime: cacheTime,
    retry: enableRetry ? mergedRetryConfig.retries : false,
    retryDelay: (attemptIndex) =>
      calculateRetryDelay(attemptIndex, mergedRetryConfig),
    ...queryOptions,
  });

  // Handle error callback
  React.useEffect(() => {
    if (query.error && onError) {
      onError(query.error as TError);
    }
  }, [query.error, onError]);

  // Derive user-friendly error info
  const errorInfo = React.useMemo(() => {
    if (!query.error) {
      return { message: null, isRetryable: false };
    }
    return {
      message: getUserErrorMessage(query.error),
      isRetryable: isRetryableError(query.error),
    };
  }, [query.error]);

  return {
    data: query.data as TData | undefined,
    error: (query.error as TError) || null,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    refetch: query.refetch,
    errorMessage: errorInfo.message,
    isRetryable: errorInfo.isRetryable,
  };
}

/**
 * Mutation hook for POST/PUT/PATCH/DELETE operations
 *
 * @example
 * ```tsx
 * const mutation = useMutate({
 *   url: '/items',
 *   method: 'POST',
 * })
 *
 * // Usage
 * mutation.mutate({ name: 'New Item' })
 * ```
 */
export function useMutate<
  TData = unknown,
  TError = Error,
  TVariables = unknown,
>(options: UseMutateOptions<TData, TError, TVariables>) {
  const {
    method = 'POST',
    url,
    transform,
    enableRetry = false,
    ...mutationOptions
  } = options;

  const abortControllerRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return useMutation({
    mutationFn: async (variables: TVariables) => {
      abortControllerRef.current = new AbortController();

      const resolvedUrl = typeof url === 'function' ? url(variables) : url;

      const response = await api.request({
        method,
        url: resolvedUrl,
        data: method !== 'DELETE' ? variables : undefined,
        signal: abortControllerRef.current.signal,
      });

      const data = response.data;
      return transform ? transform(data) : data;
    },
    retry: enableRetry ? 1 : false,
    ...mutationOptions,
  });
}

// =============================================================================
// SPECIALIZED HOOKS
// =============================================================================

/**
 * Fetch hook with polling support for real-time data
 *
 * @example
 * ```tsx
 * const { data } = useFetchWithPolling({
 *   url: '/statistics',
 *   pollingInterval: 120000, // 2 minutes
 *   staleTime: 60000,
 * })
 * ```
 */
export function useFetchWithPolling<TData = unknown, TError = Error>(
  options: UseFetchOptions<TData, TError> & {
    pollingInterval?: number;
    enablePolling?: boolean;
  }
) {
  const { pollingInterval = 5000, enablePolling = true, ...fetchOptions } = options;

  return useFetch({
    ...fetchOptions,
    refetchInterval: enablePolling ? pollingInterval : false,
    refetchIntervalInBackground: false,
  });
}

/**
 * Fetch hook for data that should only be fetched once
 *
 * @example
 * ```tsx
 * const { data } = useFetchOnce({
 *   url: '/config',
 * })
 * ```
 */
export function useFetchOnce<TData = unknown, TError = Error>(
  options: UseFetchOptions<TData, TError>
) {
  return useFetch({
    ...options,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Lazy fetch hook for on-demand fetching (e.g., after user action)
 *
 * @example
 * ```tsx
 * const { data, trigger, reset, isLoading } = useLazyFetch({
 *   url: '/search',
 *   params: { query: searchTerm },
 * })
 *
 * // Trigger fetch on button click
 * <Button onClick={trigger}>Search</Button>
 * ```
 */
export function useLazyFetch<TData = unknown, TError = Error>(
  options: Omit<UseFetchOptions<TData, TError>, 'enabled'>
) {
  const [shouldFetch, setShouldFetch] = React.useState(false);

  const result = useFetch({
    ...options,
    enabled: shouldFetch,
  });

  const trigger = React.useCallback(() => {
    setShouldFetch(true);
  }, []);

  const reset = React.useCallback(() => {
    setShouldFetch(false);
  }, []);

  return { ...result, trigger, reset };
}

export default useFetch;
