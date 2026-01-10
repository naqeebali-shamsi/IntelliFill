import api, {
  uploadFiles,
  getJobStatus,
  getJob,
  getJobs,
  processDocuments,
  extractData,
  downloadDocument as apiDownloadDocument,
  deleteDocument as apiDeleteDocument,
  reprocessDocument as apiReprocessDocument,
} from './api';
import type { UploadResult, JobStatus } from '@/types/upload';
import type { Document } from '@/types/document';

export interface DocumentUploadOptions {
  /**
   * Progress callback
   */
  onProgress?: (progress: number) => void;
}

export interface DocumentUploadResponse {
  /**
   * Job ID(s) for tracking
   */
  jobIds: string[];
  /**
   * Upload result
   */
  result: UploadResult;
}

/**
 * Upload a single document
 * @param file - File to upload
 * @param options - Upload options
 * @returns Upload response with job ID
 */
export async function uploadDocument(
  file: File,
  options: DocumentUploadOptions = {}
): Promise<DocumentUploadResponse> {
  const formData = new FormData();
  formData.append('documents', file);

  const result = await uploadFiles(formData, options.onProgress);

  const jobIds = result.jobs ? result.jobs.map((j) => j.id) : result.jobId ? [result.jobId] : [];

  return {
    jobIds,
    result: {
      jobId: result.jobId || jobIds[0] || `job_${Date.now()}`,
      status: result.status,
      data: result.data,
    },
  };
}

/**
 * Upload multiple documents
 * @param files - Files to upload
 * @param options - Upload options
 * @returns Upload response with job IDs
 */
export async function uploadDocuments(
  files: File[],
  options: DocumentUploadOptions = {}
): Promise<DocumentUploadResponse> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('documents', file);
  });

  const result = await uploadFiles(formData, options.onProgress);

  const jobIds = result.jobs ? result.jobs.map((j) => j.id) : result.jobId ? [result.jobId] : [];

  return {
    jobIds,
    result: {
      jobId: result.jobId || jobIds[0] || `job_${Date.now()}`,
      status: result.status,
      data: result.data,
    },
  };
}

/**
 * Get document processing status
 * @param jobId - Job ID to check
 * @returns Job status
 */
export async function getDocumentStatus(jobId: string): Promise<JobStatus> {
  const result = await getJobStatus(jobId);

  return {
    id: jobId,
    status: result.status as JobStatus['status'],
    progress: result.progress,
    result: result.result,
    error: result.error,
  };
}

/**
 * Get document processing job details
 * @param jobId - Job ID
 * @returns Job details
 */
export async function getDocumentJob(jobId: string) {
  return getJob(jobId);
}

/**
 * Get all document jobs for current user
 * @param userId - Optional user ID filter
 * @returns Array of jobs
 */
export async function getAllDocumentJobs(userId?: string) {
  return getJobs(userId);
}

/**
 * Process documents with a form template
 * @param documents - Document files to process
 * @param form - Form template file
 * @param options - Processing options
 * @returns Processing result
 */
export async function processDocumentsWithForm(
  documents: File[],
  form: File,
  options: DocumentUploadOptions = {}
) {
  return processDocuments(documents, form, options.onProgress);
}

/**
 * Extract data from a document
 * @param document - Document file
 * @returns Extracted data
 */
export async function extractDocumentData(document: File) {
  return extractData(document);
}

/**
 * Download processed document
 */
export async function downloadDocument(documentId: string): Promise<Blob> {
  return apiDownloadDocument(documentId);
}

/**
 * Delete a document
 */
export async function deleteDocument(documentId: string): Promise<void> {
  return apiDeleteDocument(documentId);
}

/**
 * Reprocess a document
 */
export async function reprocessDocument(documentId: string): Promise<string> {
  const result = await apiReprocessDocument(documentId);
  return result.jobId;
}

/**
 * Update document metadata (tags, etc.)
 */
export interface UpdateDocumentData {
  tags?: string[];
}

export async function updateDocument(
  documentId: string,
  data: UpdateDocumentData
): Promise<Document> {
  const response = await api.patch<{ success: boolean; document: Document }>(
    `/documents/${documentId}`,
    data
  );
  return response.data.document;
}

const documentService = {
  uploadDocument,
  uploadDocuments,
  getDocumentStatus,
  getDocumentJob,
  getAllDocumentJobs,
  processDocumentsWithForm,
  extractDocumentData,
  downloadDocument,
  deleteDocument,
  reprocessDocument,
  updateDocument,
};

export default documentService;
