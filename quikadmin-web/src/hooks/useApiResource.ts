import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '@/services/api';
import { tokenManager } from '@/lib/tokenManager';

/** SSE event types for real-time updates */
export type RealtimeEventType =
  | 'queue_progress'
  | 'queue_completed'
  | 'queue_failed'
  | 'connected'
  | 'ping';

/** Configuration options for useApiResource hook */
export interface UseApiResourceOptions<T> {
  /** Polling interval in ms (0 = no polling) */
  pollingInterval?: number;
  /** SSE events that trigger a refresh */
  realtimeEvents?: RealtimeEventType[];
  /** Transform function to process raw API data */
  transform?: (data: unknown) => T;
  /** Initial data before first fetch */
  initialData?: T;
  /** Show loading state on refetch (default: true) */
  showLoadingOnRefetch?: boolean;
}

/** Return type for useApiResource hook */
export interface UseApiResourceResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: (showLoading?: boolean) => Promise<void>;
}

/**
 * Generic factory hook for data fetching with polling and SSE support.
 *
 * @param fetchFn - Async function that fetches the data
 * @param options - Configuration options
 * @returns Object with data, loading, error, and refresh function
 */
export function useApiResource<T>(
  fetchFn: () => Promise<T>,
  options: UseApiResourceOptions<T> = {}
): UseApiResourceResult<T> {
  const {
    pollingInterval = 0,
    realtimeEvents = [],
    transform,
    initialData = null,
    showLoadingOnRefetch = true,
  } = options;

  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const eventCallbackRef = useRef<((eventType: RealtimeEventType) => void) | null>(null);

  const fetchData = useCallback(
    async (showLoading = true) => {
      if (showLoading && showLoadingOnRefetch) {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await fetchFn();
        const transformedData = transform ? transform(result) : result;
        setData(transformedData);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch data';
        setError(message);
        setData(null);
      } finally {
        if (showLoading && showLoadingOnRefetch) {
          setLoading(false);
        }
      }
    },
    [fetchFn, transform, showLoadingOnRefetch]
  );

  const refresh = useCallback(
    async (showLoading = true) => {
      await fetchData(showLoading);
    },
    [fetchData]
  );

  // Update callback ref to avoid stale closures in SSE handler
  useEffect(() => {
    if (realtimeEvents.length > 0) {
      eventCallbackRef.current = (eventType: RealtimeEventType) => {
        if (realtimeEvents.includes(eventType)) {
          fetchData(false);
        }
      };
    }
  }, [realtimeEvents, fetchData]);

  // Initial fetch and polling interval
  useEffect(() => {
    fetchData();

    if (pollingInterval > 0) {
      const intervalId = setInterval(() => fetchData(false), pollingInterval);
      return () => clearInterval(intervalId);
    }
  }, [fetchData, pollingInterval]);

  // SSE connection for real-time updates
  useEffect(() => {
    if (realtimeEvents.length === 0) {
      return;
    }

    // EventSource cannot send Authorization headers, so pass token via query param
    const accessToken = tokenManager.getToken();
    const baseUrl = `${API_BASE_URL}/realtime`.replace('/api/api', '/api');
    const sseUrl = accessToken ? `${baseUrl}?token=${encodeURIComponent(accessToken)}` : baseUrl;
    const eventSource = new EventSource(sseUrl, { withCredentials: true });

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (eventCallbackRef.current && parsed.type) {
          eventCallbackRef.current(parsed.type);
        }
      } catch {
        // Ignore parse errors for malformed SSE data
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [realtimeEvents.length]);

  return { data, loading, error, refresh };
}
