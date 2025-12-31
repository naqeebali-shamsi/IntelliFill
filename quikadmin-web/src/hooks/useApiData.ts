import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getStatistics,
  getJobs,
  getTemplates,
  getQueueMetrics,
  API_BASE_URL,
} from '@/services/api';

// SSE Event types
type SSEEvent = {
  type: 'queue_progress' | 'queue_completed' | 'queue_failed' | 'connected' | 'ping';
  data: any;
  timestamp: string;
};

/**
 * Hook for global real-time updates via SSE
 */
function useRealtime(onEvent?: (event: SSEEvent) => void) {
  const eventCallback = useRef(onEvent);

  useEffect(() => {
    eventCallback.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    // API_BASE_URL is /api, we want /api/realtime
    const sseUrl = `${API_BASE_URL}/realtime`.replace('/api/api', '/api');
    const eventSource = new EventSource(sseUrl, { withCredentials: true });

    eventSource.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);
        if (eventCallback.current) {
          eventCallback.current(data);
        }
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE Connection error:', err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);
}

export function useStatistics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const stats = await getStatistics();
      setData(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh every 2 minutes (SSE handles the important stuff)
    const interval = setInterval(fetchData, 120000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}

export function useJobs(limit = 5) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) setLoading(true);
        setError(null);
        const data = await getJobs();
        // Handle both array response and { jobs: [...] } response
        const jobsArray = Array.isArray(data) ? data : data.jobs || [];
        setJobs(jobsArray.slice(0, limit));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
        setJobs([]);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [limit]
  );

  // Listen for real-time updates
  useRealtime(
    useCallback(
      (event) => {
        if (['queue_completed', 'queue_failed', 'queue_progress'].includes(event.type)) {
          fetchJobs(false);
        }
      },
      [fetchJobs]
    )
  );

  useEffect(() => {
    fetchJobs();
    // Fallback refresh every 60 seconds
    const interval = setInterval(() => fetchJobs(false), 60000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  return { jobs, loading, error, refresh: fetchJobs };
}

export function useTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getTemplates();
        setTemplates(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch templates');
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  return { templates, loading, error };
}

export function useQueueMetrics() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const data = await getQueueMetrics();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch queue metrics');
      setMetrics(null);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // Listen for real-time updates
  useRealtime(
    useCallback(
      (event) => {
        if (['queue_completed', 'queue_failed', 'queue_progress'].includes(event.type)) {
          fetchMetrics(false);
        }
      },
      [fetchMetrics]
    )
  );

  useEffect(() => {
    fetchMetrics();
    // Fallback refresh every 60 seconds
    const interval = setInterval(() => fetchMetrics(false), 60000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return { metrics, loading, error, refresh: fetchMetrics };
}
