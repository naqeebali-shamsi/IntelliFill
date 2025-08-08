import axios, { AxiosProgressEvent } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
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