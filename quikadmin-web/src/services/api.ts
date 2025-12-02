import axios, { AxiosProgressEvent } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Shared refresh promise to prevent multiple simultaneous refresh attempts
let refreshPromise: Promise<string | null> | null = null;

// Use backend auth store for token management
import { useBackendAuthStore } from '@/stores/backendAuthStore';

// Get auth store state
function getAuthStore() {
  return useBackendAuthStore.getState();
}

// Add auth token and company context to requests
api.interceptors.request.use(async (config) => {
  const authState = getAuthStore();
  
  // Get token from Zustand store
  if (authState.tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${authState.tokens.accessToken}`;
  }

  // Add company context for multi-tenant requests
  if (authState.company?.id) {
    config.headers['X-Company-ID'] = authState.company.id;
  }

  return config;
});

// Handle auth errors and token refresh
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
              const authStore = getAuthStore();

              if (!authStore.tokens?.refreshToken) {
                return null;
              }
              await authStore.refreshToken();

              const newState = getAuthStore();
              return newState.tokens?.accessToken || null;
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
      const authStore = getAuthStore();
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
): Promise<{
  jobId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data?: any;
  jobs?: Array<{ id: string; status: string }>;
}> => {
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
  
  const data = response.data;
  
  // Handle different response formats
  // If single job ID is returned
  if (data.jobId) {
    return {
      jobId: data.jobId,
      status: data.status || 'processing',
      data: data.data,
    };
  }
  
  // If multiple jobs are returned (array)
  if (Array.isArray(data.jobs) && data.jobs.length > 0) {
    return {
      jobId: data.jobs[0].id, // Use first job ID for tracking
      status: data.jobs[0].status || 'processing',
      data: data.data,
      jobs: data.jobs,
    };
  }
  
  // If data is directly available (synchronous processing)
  if (data.data) {
    return {
      jobId: data.id || `job_${Date.now()}`,
      status: 'completed',
      data: data.data,
    };
  }
  
  // Default response
  return {
    jobId: data.id,
    status: data.status || 'processing',
    data: data.data,
  };
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

// Document management
export const getDocuments = async (params?: {
  type?: string;
  search?: string;
  limit?: number;
  page?: number;
  sort?: string;
}): Promise<{
  success: boolean;
  documents: any[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}> => {
  const response = await api.get('/documents', { params });
  return response.data;
};

export const getDocument = async (documentId: string): Promise<{
  success: boolean;
  document: any;
}> => {
  const response = await api.get(`/documents/${documentId}`);
  return response.data;
};

export const deleteDocument = async (documentId: string): Promise<void> => {
  await api.delete(`/documents/${documentId}`);
};

export const downloadDocument = async (documentId: string): Promise<Blob> => {
  const response = await api.get(`/documents/${documentId}/download`, {
    responseType: 'blob',
  });
  return response.data;
};

export const reprocessDocument = async (documentId: string): Promise<{
  jobId: string;
}> => {
  const response = await api.post(`/documents/${documentId}/reprocess`);
  return response.data;
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
export const batchReprocessDocuments = async (documentIds: string[]): Promise<{
  success: boolean;
  jobs: Array<{ jobId: string; documentId: string }>;
  totalQueued: number;
}> => {
  const response = await api.post('/documents/reprocess/batch', { documentIds });
  return response.data;
};

export const getLowConfidenceDocuments = async (threshold: number = 0.7): Promise<{
  success: boolean;
  documents: any[];
  count: number;
}> => {
  const response = await api.get('/documents/low-confidence', {
    params: { threshold }
  });
  return response.data;
};

export const getReprocessingHistory = async (documentId: string): Promise<{
  success: boolean;
  reprocessCount: number;
  lastReprocessedAt: string | null;
  reprocessingHistory: any[];
}> => {
  const response = await api.get(`/documents/${documentId}/reprocessing-history`);
  return response.data;
};
