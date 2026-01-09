import { useMemo } from 'react';
import { getStatistics, getJobs, getTemplates, getQueueMetrics } from '@/services/api';
import { useApiResource, type RealtimeEventType } from './useApiResource';

const REALTIME_QUEUE_EVENTS: RealtimeEventType[] = [
  'queue_completed',
  'queue_failed',
  'queue_progress',
];

export function useStatistics() {
  return useApiResource(getStatistics, {
    pollingInterval: 120000,
  });
}

export function useJobs(limit = 5) {
  const fetcher = useMemo(
    () => async () => {
      const data = await getJobs();
      const jobsArray = Array.isArray(data) ? data : data.jobs || [];
      return jobsArray.slice(0, limit);
    },
    [limit]
  );

  const result = useApiResource(fetcher, {
    pollingInterval: 60000,
    realtimeEvents: REALTIME_QUEUE_EVENTS,
    initialData: [],
    showLoadingOnRefetch: false,
  });

  return {
    jobs: result.data ?? [],
    loading: result.loading,
    error: result.error,
    refresh: result.refresh,
  };
}

export function useTemplates() {
  const result = useApiResource(getTemplates, {
    initialData: [],
  });

  return {
    templates: result.data ?? [],
    loading: result.loading,
    error: result.error,
  };
}

export function useQueueMetrics() {
  const result = useApiResource(getQueueMetrics, {
    pollingInterval: 60000,
    realtimeEvents: REALTIME_QUEUE_EVENTS,
    showLoadingOnRefetch: false,
  });

  return {
    metrics: result.data,
    loading: result.loading,
    error: result.error,
    refresh: result.refresh,
  };
}
