import axios, { AxiosProgressEvent } from 'axios';
import { useAuthStore } from '@/stores/simpleAuthStore';
import { supabase } from '@/lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Shared refresh promise to prevent multiple simultaneous refresh attempts
let refreshPromise: Promise<string | null> | null = null;

// Add auth token and company context to requests
api.interceptors.request.use(async (config) => {
  // Get token from Zustand store (synced with Supabase)
  const { tokens, company, session } = useAuthStore.getState();

  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  } else if (session?.access_token) {
    // Fallback: get token from Supabase session if Zustand not synced
    config.headers.Authorization = `Bearer ${session.access_token}`;
  } else {
    // Final fallback: get fresh session from Supabase
    const { data: { session: freshSession } } = await supabase.auth.getSession();
    if (freshSession?.access_token) {
      config.headers.Authorization = `Bearer ${freshSession.access_token}`;
    }
  }

  // Add company context for multi-tenant requests
  if (company?.id) {
    config.headers['X-Company-ID'] = company.id;
  }

  return config;
});

// Handle auth errors and token refresh
// Note: Token refresh is now handled by Supabase automatically,
// but we keep this interceptor for backward compatibility and edge cases
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Use shared refresh promise to prevent stampede
        if (!refreshPromise) {
          refreshPromise = (async () => {
            try {
              const authStore = useAuthStore.getState();

              // Try Supabase session refresh first
              const { data, error: refreshError } = await supabase.auth.refreshSession();

              if (refreshError || !data.session) {
                // Fallback to auth store refresh (which also uses Supabase internally)
                if (!authStore.tokens?.refreshToken && !authStore.session?.refresh_token) {
                  return null;
                }
                await authStore.refreshToken();
              }

              const newToken = useAuthStore.getState().tokens?.accessToken;
              return newToken || null;
            } catch (err) {
              console.error('Token refresh failed:', err);
              return null;
            } finally {
              // Clear promise after completion
              refreshPromise = null;
            }
          })();
        }

        const newToken = await refreshPromise;

        if (newToken) {
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error('Refresh error:', refreshError);
      }

      // Refresh failed, logout user
      const authStore = useAuthStore.getState();
      await authStore.logout();

      // Only redirect if we're not already on the login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export interface ProcessingJob {
  id: string;
  type: string;
  status: string;
  progress: number;
  createdAt: string;
  completedAt?: string;
  result?: any;
  error?: string;
}

export interface Statistics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  averageConfidence: number;
}

// File upload with progress
export const uploadFiles = async (
  formData: FormData,
  onProgress?: (progress: number) => void
): Promise<any> => {
  const response = await api.post('/process/multiple', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
      if (progressEvent.total && onProgress) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    },
  });
  return response.data;
};

// Job management
export const getJobs = async (userId?: string): Promise<ProcessingJob[]> => {
  const response = await api.get('/jobs', { params: { userId } });
  return response.data;
};

export const getJob = async (jobId: string): Promise<ProcessingJob> => {
  const response = await api.get(`/jobs/${jobId}`);
  return response.data;
};

export const getJobStatus = async (jobId: string): Promise<{
  status: string;
  progress: number;
  result?: any;
  error?: string;
}> => {
  const response = await api.get(`/jobs/${jobId}/status`);
  return response.data;
};

// Statistics
export const getStatistics = async (userId?: string): Promise<Statistics> => {
  const response = await api.get('/statistics', { params: { userId } });
  return response.data;
};

// Templates
export const getTemplates = async (): Promise<any[]> => {
  const response = await api.get('/templates');
  return response.data;
};

export const createTemplate = async (template: any): Promise<any> => {
  const response = await api.post('/templates', template);
  return response.data;
};

export const deleteTemplate = async (templateId: string): Promise<void> => {
  await api.delete(`/templates/${templateId}`);
};

// Process documents
export const processDocuments = async (
  documents: File[],
  form: File,
  onProgress?: (progress: number) => void
): Promise<any> => {
  const formData = new FormData();
  documents.forEach((doc) => formData.append('documents', doc));
  formData.append('form', form);
  
  const response = await api.post('/process/multiple', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
      if (progressEvent.total && onProgress) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    },
  });
  return response.data;
};

// Form validation
export const validateForm = async (formFile: File): Promise<{
  fields: string[];
  fieldTypes: Record<string, string>;
}> => {
  const formData = new FormData();
  formData.append('form', formFile);
  
  const response = await api.post('/validate/form', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.data;
};

// Extract data from document
export const extractData = async (documentFile: File): Promise<any> => {
  const formData = new FormData();
  formData.append('document', documentFile);
  
  const response = await api.post('/extract', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.data;
};

// WebSocket connection for real-time updates
export const connectWebSocket = (onMessage: (data: any) => void): WebSocket => {
  const wsUrl = API_BASE_URL.replace('http', 'ws').replace('/api', '/ws');
  const ws = new WebSocket(wsUrl);
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  return ws;
};

// Queue metrics
export const getQueueMetrics = async (): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> => {
  const response = await api.get('/queue/metrics');
  return response.data;
};

// User settings
export const getUserSettings = async (userId: string): Promise<any> => {
  const response = await api.get(`/users/${userId}/settings`);
  return response.data;
};

export const updateUserSettings = async (userId: string, settings: any): Promise<any> => {
  const response = await api.put(`/users/${userId}/settings`, settings);
  return response.data;
};

export default api;