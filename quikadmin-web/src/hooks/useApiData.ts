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
        setError(null);
        const stats = await getStatistics();
        setData(stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
        setData(null);
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
        setError(null);
        const data = await getJobs();
        // Handle both array response and { jobs: [...] } response
        const jobsArray = Array.isArray(data) ? data : data.jobs || [];
        setJobs(jobsArray.slice(0, limit));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
        setJobs([]);
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

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getQueueMetrics();
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch queue metrics');
        setMetrics(null);
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
