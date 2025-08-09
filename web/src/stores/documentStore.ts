/**
 * Document Store - Manages file uploads, processing jobs, real-time updates, and queue management
 */

import { create } from 'zustand';
import { DocumentFile, ProcessingJob, ProcessingResult, QueueMetrics, RealtimeEvent, WebSocketState } from './types';
import { createMiddleware } from './middleware';
import api, { uploadFiles, getJobs, getJob, getJobStatus, processDocuments, extractData, validateForm, connectWebSocket, getQueueMetrics } from '@/services/api';

// =================== STORE INTERFACES ===================

interface DocumentState {
  // File management
  files: DocumentFile[];
  selectedFiles: string[];
  
  // Processing jobs
  jobs: ProcessingJob[];
  activeJobs: ProcessingJob[];
  completedJobs: ProcessingJob[];
  failedJobs: ProcessingJob[];
  
  // Current processing
  currentJob: ProcessingJob | null;
  processingProgress: number;
  processingStatus: string;
  
  // Upload state
  isUploading: boolean;
  uploadProgress: number;
  uploadQueue: File[];
  
  // Queue management
  queueMetrics: QueueMetrics | null;
  queuePaused: boolean;
  
  // Real-time updates
  websocket: WebSocketState;
  realtimeEvents: RealtimeEvent[];
  
  // Filters and search
  filters: {
    status: ProcessingJob['status'] | 'all';
    dateRange: { start: Date | null; end: Date | null };
    templateId: string | null;
    searchQuery: string;
  };
  
  // Pagination and sorting
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  
  sorting: {
    field: string;
    direction: 'asc' | 'desc';
  };
  
  // Error handling
  errors: string[];
  lastError: string | null;
  
  // Performance
  processingStats: {
    totalProcessed: number;
    totalFailed: number;
    averageTime: number;
    successRate: number;
  };
}

interface DocumentActions {
  // File management
  addFiles: (files: File[]) => Promise<void>;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  selectFile: (fileId: string) => void;
  selectMultipleFiles: (fileIds: string[]) => void;
  deselectFile: (fileId: string) => void;
  clearSelection: () => void;
  
  // Job management
  createJob: (documents: File[], templateId?: string) => Promise<string>;
  cancelJob: (jobId: string) => Promise<void>;
  retryJob: (jobId: string) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  refreshJobs: () => Promise<void>;
  refreshJob: (jobId: string) => Promise<void>;
  
  // Processing actions
  processDocuments: (documents: File[], form: File, options?: ProcessingOptions) => Promise<ProcessingResult>;
  extractDataFromDocument: (document: File) => Promise<any>;
  validateFormStructure: (form: File) => Promise<{ fields: string[]; fieldTypes: Record<string, string> }>;
  
  // Queue management
  pauseQueue: () => Promise<void>;
  resumeQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
  refreshQueueMetrics: () => Promise<void>;
  
  // Real-time updates
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
  handleRealtimeEvent: (event: RealtimeEvent) => void;
  
  // Filters and search
  setStatusFilter: (status: ProcessingJob['status'] | 'all') => void;
  setDateRangeFilter: (start: Date | null, end: Date | null) => void;
  setTemplateFilter: (templateId: string | null) => void;
  setSearchQuery: (query: string) => void;
  clearFilters: () => void;
  
  // Pagination and sorting
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSorting: (field: string, direction: 'asc' | 'desc') => void;
  
  // Error handling
  addError: (error: string) => void;
  clearErrors: () => void;
  clearLastError: () => void;
  
  // Utility actions
  refreshAll: () => Promise<void>;
  cleanup: () => void;
}

// =================== PROCESSING OPTIONS ===================

interface ProcessingOptions {
  priority?: ProcessingJob['priority'];
  templateId?: string;
  quality?: 'draft' | 'standard' | 'high' | 'premium';
  enableOCR?: boolean;
  enableAI?: boolean;
  confidenceThreshold?: number;
  retryAttempts?: number;
  timeout?: number;
  webhookUrl?: string;
  metadata?: Record<string, any>;
}

// =================== INITIAL STATE ===================

const initialState: DocumentState = {
  files: [],
  selectedFiles: [],
  jobs: [],
  activeJobs: [],
  completedJobs: [],
  failedJobs: [],
  currentJob: null,
  processingProgress: 0,
  processingStatus: '',
  isUploading: false,
  uploadProgress: 0,
  uploadQueue: [],
  queueMetrics: null,
  queuePaused: false,
  websocket: {
    connected: false,
    connecting: false,
    reconnecting: false,
    subscriptions: [],
  },
  realtimeEvents: [],
  filters: {
    status: 'all',
    dateRange: { start: null, end: null },
    templateId: null,
    searchQuery: '',
  },
  pagination: {
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
  },
  sorting: {
    field: 'createdAt',
    direction: 'desc',
  },
  errors: [],
  lastError: null,
  processingStats: {
    totalProcessed: 0,
    totalFailed: 0,
    averageTime: 0,
    successRate: 0,
  },
};

// =================== STORE IMPLEMENTATION ===================

type DocumentStore = DocumentState & DocumentActions;

export const useDocumentStore = create<DocumentStore>()(
  createMiddleware(
    {
      persist: true,
      persistName: 'intellifill-documents',
      persistOptions: {
        partialize: (state) => ({
          files: state.files,
          filters: state.filters,
          pagination: state.pagination,
          sorting: state.sorting,
          queuePaused: state.queuePaused,
        }),
        version: 1,
      },
      devtools: true,
      devtoolsName: 'IntelliFill Document Store',
      logger: process.env.NODE_ENV === 'development',
      performance: true,
      performanceId: 'document-store',
      errorBoundary: true,
      immer: true,
      subscribeWithSelector: true,
    },
    (set, get) => ({
      ...initialState,

      // =================== FILE MANAGEMENT ===================

      addFiles: async (files: File[]) => {
        const newFiles: DocumentFile[] = files.map(file => ({
          id: generateFileId(),
          name: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString(),
          status: 'uploading',
          progress: 0,
        }));

        set((draft) => {
          draft.files.push(...newFiles);
          draft.isUploading = true;
        });

        try {
          const formData = new FormData();
          files.forEach(file => formData.append('files', file));

          const response = await uploadFiles(formData, (progress) => {
            set((draft) => {
              draft.uploadProgress = progress;
              newFiles.forEach(file => {
                const existingFile = draft.files.find(f => f.id === file.id);
                if (existingFile) {
                  existingFile.progress = progress;
                  existingFile.status = progress === 100 ? 'uploaded' : 'uploading';
                }
              });
            });
          });

          // Update files with response data
          set((draft) => {
            response.files?.forEach((uploadedFile: any, index: number) => {
              const file = draft.files.find(f => f.id === newFiles[index].id);
              if (file) {
                file.url = uploadedFile.url;
                file.thumbnail = uploadedFile.thumbnail;
                file.status = 'uploaded';
                file.progress = 100;
              }
            });
            draft.isUploading = false;
            draft.uploadProgress = 0;
          });
        } catch (error: any) {
          set((draft) => {
            newFiles.forEach(file => {
              const existingFile = draft.files.find(f => f.id === file.id);
              if (existingFile) {
                existingFile.status = 'error';
                existingFile.error = error.message;
              }
            });
            draft.isUploading = false;
            draft.uploadProgress = 0;
            draft.lastError = error.message;
          });
          throw error;
        }
      },

      removeFile: (fileId: string) => {
        set((draft) => {
          draft.files = draft.files.filter(f => f.id !== fileId);
          draft.selectedFiles = draft.selectedFiles.filter(id => id !== fileId);
        });
      },

      clearFiles: () => {
        set((draft) => {
          draft.files = [];
          draft.selectedFiles = [];
        });
      },

      selectFile: (fileId: string) => {
        set((draft) => {
          if (!draft.selectedFiles.includes(fileId)) {
            draft.selectedFiles.push(fileId);
          }
        });
      },

      selectMultipleFiles: (fileIds: string[]) => {
        set((draft) => {
          fileIds.forEach(id => {
            if (!draft.selectedFiles.includes(id)) {
              draft.selectedFiles.push(id);
            }
          });
        });
      },

      deselectFile: (fileId: string) => {
        set((draft) => {
          draft.selectedFiles = draft.selectedFiles.filter(id => id !== fileId);
        });
      },

      clearSelection: () => {
        set((draft) => {
          draft.selectedFiles = [];
        });
      },

      // =================== JOB MANAGEMENT ===================

      createJob: async (documents: File[], templateId?: string) => {
        const jobId = generateJobId();
        const newJob: ProcessingJob = {
          id: jobId,
          name: `Processing ${documents.length} documents`,
          templateId,
          documents: documents.map(doc => ({
            id: generateFileId(),
            name: doc.name,
            size: doc.size,
            type: doc.type,
            uploadedAt: new Date().toISOString(),
            status: 'uploading',
            progress: 0,
          })),
          status: 'queued',
          progress: 0,
          priority: 'normal',
          userId: 'current-user', // Get from auth store
        };

        set((draft) => {
          draft.jobs.unshift(newJob);
          draft.currentJob = newJob;
        });

        try {
          const formData = new FormData();
          documents.forEach(doc => formData.append('documents', doc));
          if (templateId) formData.append('templateId', templateId);

          const response = await api.post('/jobs', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          const serverJob = response.data.data;
          
          set((draft) => {
            const job = draft.jobs.find(j => j.id === jobId);
            if (job) {
              Object.assign(job, serverJob);
            }
          });

          // Start polling for job status
          get().pollJobStatus(jobId);

          return jobId;
        } catch (error: any) {
          set((draft) => {
            const job = draft.jobs.find(j => j.id === jobId);
            if (job) {
              job.status = 'failed';
              job.error = error.message;
            }
            draft.lastError = error.message;
          });
          throw error;
        }
      },

      cancelJob: async (jobId: string) => {
        try {
          await api.post(`/jobs/${jobId}/cancel`);
          
          set((draft) => {
            const job = draft.jobs.find(j => j.id === jobId);
            if (job) {
              job.status = 'cancelled';
            }
          });
        } catch (error: any) {
          get().addError(error.message);
          throw error;
        }
      },

      retryJob: async (jobId: string) => {
        try {
          await api.post(`/jobs/${jobId}/retry`);
          
          set((draft) => {
            const job = draft.jobs.find(j => j.id === jobId);
            if (job) {
              job.status = 'queued';
              job.progress = 0;
              job.error = undefined;
            }
          });
        } catch (error: any) {
          get().addError(error.message);
          throw error;
        }
      },

      deleteJob: async (jobId: string) => {
        try {
          await api.delete(`/jobs/${jobId}`);
          
          set((draft) => {
            draft.jobs = draft.jobs.filter(j => j.id !== jobId);
            if (draft.currentJob?.id === jobId) {
              draft.currentJob = null;
            }
          });
        } catch (error: any) {
          get().addError(error.message);
          throw error;
        }
      },

      refreshJobs: async () => {
        try {
          const jobs = await getJobs();
          
          set((draft) => {
            draft.jobs = jobs;
            draft.activeJobs = jobs.filter(j => ['queued', 'processing'].includes(j.status));
            draft.completedJobs = jobs.filter(j => j.status === 'completed');
            draft.failedJobs = jobs.filter(j => j.status === 'failed');
            
            // Update pagination
            draft.pagination.totalItems = jobs.length;
            draft.pagination.totalPages = Math.ceil(jobs.length / draft.pagination.pageSize);
          });
        } catch (error: any) {
          get().addError(error.message);
        }
      },

      refreshJob: async (jobId: string) => {
        try {
          const job = await getJob(jobId);
          
          set((draft) => {
            const index = draft.jobs.findIndex(j => j.id === jobId);
            if (index >= 0) {
              draft.jobs[index] = job;
            }
            
            if (draft.currentJob?.id === jobId) {
              draft.currentJob = job;
            }
          });
        } catch (error: any) {
          get().addError(error.message);
        }
      },

      // =================== PROCESSING ACTIONS ===================

      processDocuments: async (documents: File[], form: File, options?: ProcessingOptions) => {
        set((draft) => {
          draft.processingStatus = 'Starting processing...';
          draft.processingProgress = 0;
        });

        try {
          const result = await processDocuments(documents, form, (progress) => {
            set((draft) => {
              draft.processingProgress = progress;
              draft.processingStatus = `Processing... ${progress}%`;
            });
          });

          set((draft) => {
            draft.processingStatus = 'Completed';
            draft.processingProgress = 100;
            draft.processingStats.totalProcessed++;
          });

          return result;
        } catch (error: any) {
          set((draft) => {
            draft.processingStatus = 'Failed';
            draft.processingProgress = 0;
            draft.lastError = error.message;
            draft.processingStats.totalFailed++;
          });
          throw error;
        }
      },

      extractDataFromDocument: async (document: File) => {
        try {
          return await extractData(document);
        } catch (error: any) {
          get().addError(error.message);
          throw error;
        }
      },

      validateFormStructure: async (form: File) => {
        try {
          return await validateForm(form);
        } catch (error: any) {
          get().addError(error.message);
          throw error;
        }
      },

      // =================== QUEUE MANAGEMENT ===================

      pauseQueue: async () => {
        try {
          await api.post('/queue/pause');
          set((draft) => {
            draft.queuePaused = true;
          });
        } catch (error: any) {
          get().addError(error.message);
          throw error;
        }
      },

      resumeQueue: async () => {
        try {
          await api.post('/queue/resume');
          set((draft) => {
            draft.queuePaused = false;
          });
        } catch (error: any) {
          get().addError(error.message);
          throw error;
        }
      },

      clearQueue: async () => {
        try {
          await api.post('/queue/clear');
          set((draft) => {
            draft.jobs = draft.jobs.filter(j => !['queued', 'processing'].includes(j.status));
          });
        } catch (error: any) {
          get().addError(error.message);
          throw error;
        }
      },

      refreshQueueMetrics: async () => {
        try {
          const metrics = await getQueueMetrics();
          set((draft) => {
            draft.queueMetrics = metrics;
          });
        } catch (error: any) {
          get().addError(error.message);
        }
      },

      // =================== REAL-TIME UPDATES ===================

      connectWebSocket: () => {
        const state = get();
        if (state.websocket.connected || state.websocket.connecting) return;

        set((draft) => {
          draft.websocket.connecting = true;
        });

        try {
          const ws = connectWebSocket((data) => {
            get().handleRealtimeEvent(data);
          });

          ws.onopen = () => {
            set((draft) => {
              draft.websocket.connected = true;
              draft.websocket.connecting = false;
              draft.websocket.lastConnected = Date.now();
              draft.websocket.connectionId = generateConnectionId();
            });
          };

          ws.onclose = () => {
            set((draft) => {
              draft.websocket.connected = false;
              draft.websocket.connecting = false;
            });
            
            // Auto-reconnect after 5 seconds
            setTimeout(() => {
              get().connectWebSocket();
            }, 5000);
          };

          ws.onerror = (error) => {
            set((draft) => {
              draft.websocket.error = 'WebSocket connection error';
              draft.websocket.connecting = false;
            });
          };
        } catch (error: any) {
          set((draft) => {
            draft.websocket.error = error.message;
            draft.websocket.connecting = false;
          });
        }
      },

      disconnectWebSocket: () => {
        // WebSocket cleanup would happen here
        set((draft) => {
          draft.websocket.connected = false;
          draft.websocket.connecting = false;
          draft.websocket.error = undefined;
        });
      },

      handleRealtimeEvent: (event: RealtimeEvent) => {
        set((draft) => {
          draft.realtimeEvents.unshift(event);
          
          // Keep only last 100 events
          if (draft.realtimeEvents.length > 100) {
            draft.realtimeEvents = draft.realtimeEvents.slice(0, 100);
          }
          
          // Handle specific event types
          switch (event.type) {
            case 'job_update':
              const job = draft.jobs.find(j => j.id === event.data.jobId);
              if (job) {
                Object.assign(job, event.data);
              }
              break;
            
            case 'job_complete':
              const completedJob = draft.jobs.find(j => j.id === event.data.jobId);
              if (completedJob) {
                completedJob.status = 'completed';
                completedJob.progress = 100;
                completedJob.completedAt = event.data.completedAt;
                completedJob.result = event.data.result;
              }
              break;
            
            case 'job_error':
              const failedJob = draft.jobs.find(j => j.id === event.data.jobId);
              if (failedJob) {
                failedJob.status = 'failed';
                failedJob.error = event.data.error;
              }
              break;
          }
        });
      },

      // =================== FILTERS AND SEARCH ===================

      setStatusFilter: (status: ProcessingJob['status'] | 'all') => {
        set((draft) => {
          draft.filters.status = status;
          draft.pagination.page = 1; // Reset to first page
        });
      },

      setDateRangeFilter: (start: Date | null, end: Date | null) => {
        set((draft) => {
          draft.filters.dateRange = { start, end };
          draft.pagination.page = 1;
        });
      },

      setTemplateFilter: (templateId: string | null) => {
        set((draft) => {
          draft.filters.templateId = templateId;
          draft.pagination.page = 1;
        });
      },

      setSearchQuery: (query: string) => {
        set((draft) => {
          draft.filters.searchQuery = query;
          draft.pagination.page = 1;
        });
      },

      clearFilters: () => {
        set((draft) => {
          draft.filters = {
            status: 'all',
            dateRange: { start: null, end: null },
            templateId: null,
            searchQuery: '',
          };
          draft.pagination.page = 1;
        });
      },

      // =================== PAGINATION AND SORTING ===================

      setPage: (page: number) => {
        set((draft) => {
          draft.pagination.page = page;
        });
      },

      setPageSize: (pageSize: number) => {
        set((draft) => {
          draft.pagination.pageSize = pageSize;
          draft.pagination.page = 1;
          draft.pagination.totalPages = Math.ceil(draft.pagination.totalItems / pageSize);
        });
      },

      setSorting: (field: string, direction: 'asc' | 'desc') => {
        set((draft) => {
          draft.sorting = { field, direction };
        });
      },

      // =================== ERROR HANDLING ===================

      addError: (error: string) => {
        set((draft) => {
          draft.errors.push(error);
          draft.lastError = error;
          
          // Keep only last 10 errors
          if (draft.errors.length > 10) {
            draft.errors = draft.errors.slice(-10);
          }
        });
      },

      clearErrors: () => {
        set((draft) => {
          draft.errors = [];
          draft.lastError = null;
        });
      },

      clearLastError: () => {
        set((draft) => {
          draft.lastError = null;
        });
      },

      // =================== UTILITY ACTIONS ===================

      refreshAll: async () => {
        await Promise.all([
          get().refreshJobs(),
          get().refreshQueueMetrics(),
        ]);
      },

      cleanup: () => {
        get().disconnectWebSocket();
        set((draft) => {
          draft.realtimeEvents = [];
          draft.errors = [];
        });
      },

      // =================== INTERNAL METHODS ===================

      pollJobStatus: (jobId: string) => {
        const poll = async () => {
          try {
            const status = await getJobStatus(jobId);
            
            set((draft) => {
              const job = draft.jobs.find(j => j.id === jobId);
              if (job) {
                job.status = status.status as ProcessingJob['status'];
                job.progress = status.progress;
                if (status.result) job.result = status.result;
                if (status.error) job.error = status.error;
              }
            });
            
            // Continue polling if job is still active
            if (['queued', 'processing'].includes(status.status)) {
              setTimeout(poll, 2000); // Poll every 2 seconds
            }
          } catch (error) {
            console.error('Job polling error:', error);
          }
        };
        
        poll();
      },
    })
  )
);

// =================== HELPER FUNCTIONS ===================

function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateConnectionId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// =================== SELECTORS ===================

export const documentSelectors = {
  allFiles: (state: DocumentStore) => state.files,
  selectedFiles: (state: DocumentStore) => state.files.filter(f => state.selectedFiles.includes(f.id)),
  uploadingFiles: (state: DocumentStore) => state.files.filter(f => f.status === 'uploading'),
  allJobs: (state: DocumentStore) => state.jobs,
  filteredJobs: (state: DocumentStore) => {
    let filtered = state.jobs;
    
    // Status filter
    if (state.filters.status !== 'all') {
      filtered = filtered.filter(job => job.status === state.filters.status);
    }
    
    // Date range filter
    if (state.filters.dateRange.start || state.filters.dateRange.end) {
      filtered = filtered.filter(job => {
        const jobDate = new Date(job.startedAt || '');
        const start = state.filters.dateRange.start;
        const end = state.filters.dateRange.end;
        
        if (start && jobDate < start) return false;
        if (end && jobDate > end) return false;
        return true;
      });
    }
    
    // Template filter
    if (state.filters.templateId) {
      filtered = filtered.filter(job => job.templateId === state.filters.templateId);
    }
    
    // Search query
    if (state.filters.searchQuery) {
      const query = state.filters.searchQuery.toLowerCase();
      filtered = filtered.filter(job => 
        job.name.toLowerCase().includes(query) ||
        job.templateName?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  },
  paginatedJobs: (state: DocumentStore) => {
    const filtered = documentSelectors.filteredJobs(state);
    const { page, pageSize } = state.pagination;
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  },
  activeJobs: (state: DocumentStore) => state.jobs.filter(j => ['queued', 'processing'].includes(j.status)),
  completedJobs: (state: DocumentStore) => state.jobs.filter(j => j.status === 'completed'),
  failedJobs: (state: DocumentStore) => state.jobs.filter(j => j.status === 'failed'),
  isProcessing: (state: DocumentStore) => state.jobs.some(j => j.status === 'processing'),
  hasActiveJobs: (state: DocumentStore) => state.jobs.some(j => ['queued', 'processing'].includes(j.status)),
  processingProgress: (state: DocumentStore) => state.processingProgress,
  queueMetrics: (state: DocumentStore) => state.queueMetrics,
  isWebSocketConnected: (state: DocumentStore) => state.websocket.connected,
  recentEvents: (state: DocumentStore) => state.realtimeEvents.slice(0, 10),
};

// =================== HOOKS FOR SPECIFIC USE CASES ===================

export const useFiles = () => useDocumentStore((state) => ({
  files: state.files,
  selectedFiles: documentSelectors.selectedFiles(state),
  isUploading: state.isUploading,
  uploadProgress: state.uploadProgress,
  addFiles: state.addFiles,
  removeFile: state.removeFile,
  selectFile: state.selectFile,
  clearSelection: state.clearSelection,
}));

export const useJobs = () => useDocumentStore((state) => ({
  jobs: documentSelectors.filteredJobs(state),
  paginatedJobs: documentSelectors.paginatedJobs(state),
  activeJobs: documentSelectors.activeJobs(state),
  currentJob: state.currentJob,
  isProcessing: documentSelectors.isProcessing(state),
  createJob: state.createJob,
  cancelJob: state.cancelJob,
  retryJob: state.retryJob,
  refreshJobs: state.refreshJobs,
}));

export const useProcessing = () => useDocumentStore((state) => ({
  progress: state.processingProgress,
  status: state.processingStatus,
  isProcessing: documentSelectors.isProcessing(state),
  processDocuments: state.processDocuments,
  extractData: state.extractDataFromDocument,
  validateForm: state.validateFormStructure,
}));

export const useQueue = () => useDocumentStore((state) => ({
  metrics: state.queueMetrics,
  isPaused: state.queuePaused,
  pause: state.pauseQueue,
  resume: state.resumeQueue,
  clear: state.clearQueue,
  refresh: state.refreshQueueMetrics,
}));

export const useRealtime = () => useDocumentStore((state) => ({
  connected: state.websocket.connected,
  events: documentSelectors.recentEvents(state),
  connect: state.connectWebSocket,
  disconnect: state.disconnectWebSocket,
}));

// =================== AUTO-CONNECT WEBSOCKET ===================

// Auto-connect WebSocket when store is created
if (typeof window !== 'undefined') {
  setTimeout(() => {
    useDocumentStore.getState().connectWebSocket();
  }, 1000);
}

// =================== EXPORT TYPES ===================

export type { DocumentState, DocumentActions, ProcessingOptions };