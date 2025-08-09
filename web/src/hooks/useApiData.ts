import { useState, useEffect } from 'react';
import { getStatistics, getJobs, getTemplates, getQueueMetrics } from '@/services/api';

export function useStatistics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const stats = await getStatistics();
        setData(stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
        // Use fallback data if API fails
        setData({
          trends: {
            documents: { value: 1284, change: 12.5, trend: 'up' },
            processedToday: { value: 45, change: 8.2, trend: 'up' },
            inProgress: { value: 12, change: -2.4, trend: 'down' },
            failed: { value: 3, change: -18.3, trend: 'down' }
          },
          successRate: 96.8,
          averageProcessingTime: 2.4
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
}

export function useJobs(limit = 5) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setLoading(true);
        const data = await getJobs();
        setJobs(data.slice(0, limit));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
        // Use fallback data
        setJobs([
          {
            id: '1',
            name: 'Invoice_2024_March.pdf',
            template: 'Invoice Template',
            status: 'completed',
            createdAt: '2024-03-15T10:30:00Z',
            size: '245 KB'
          },
          {
            id: '2',
            name: 'Tax_Form_1040.pdf',
            template: 'Tax Form',
            status: 'processing',
            createdAt: '2024-03-15T10:15:00Z',
            size: '512 KB'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
    // Refresh every 10 seconds for processing status
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [limit]);

  return { jobs, loading, error };
}

export function useTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        const data = await getTemplates();
        setTemplates(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch templates');
        // Use fallback data
        setTemplates([
          { id: '1', name: 'Invoice Template', usage: 342, lastUsed: '2 hours ago' },
          { id: '2', name: 'Tax Form', usage: 128, lastUsed: '3 hours ago' }
        ]);
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

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const data = await getQueueMetrics();
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch queue metrics');
        // Use fallback data
        setMetrics({
          waiting: 8,
          active: 4,
          completed: 1226,
          failed: 3
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    // Refresh every 5 seconds for real-time updates
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  return { metrics, loading, error };
}