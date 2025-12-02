/**
 * Document service for managing document operations
 * Provides a clean interface for document upload, processing, status, and download
 * @module services/documentService
 */

import {
  uploadFiles,
  getJobStatus,
  getJob,
  getJobs,
  processDocuments,
  extractData,
} from "./api";
import type { UploadResult, JobStatus } from "@/types/upload";

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
  formData.append("documents", file);

  const result = await uploadFiles(formData, options.onProgress);

  const jobIds = result.jobs
    ? result.jobs.map((j) => j.id)
    : result.jobId
    ? [result.jobId]
    : [];

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
    formData.append("documents", file);
  });

  const result = await uploadFiles(formData, options.onProgress);

  const jobIds = result.jobs
    ? result.jobs.map((j) => j.id)
    : result.jobId
    ? [result.jobId]
    : [];

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
export async function getDocumentStatus(
  jobId: string
): Promise<JobStatus> {
  const result = await getJobStatus(jobId);
  
  return {
    id: jobId,
    status: result.status as JobStatus["status"],
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
 * @param documentId - Document ID
 * @returns Download URL or blob
 */
export async function downloadDocument(documentId: string): Promise<Blob> {
  // This would typically call an API endpoint like /api/documents/:id/download
  // For now, we'll return a placeholder
  const response = await fetch(`/api/documents/${documentId}/download`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download document: ${response.statusText}`);
  }

  return response.blob();
}

/**
 * Delete a document
 * @param documentId - Document ID
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const response = await fetch(`/api/documents/${documentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete document: ${response.statusText}`);
  }
}

/**
 * Reprocess a document
 * @param documentId - Document ID
 * @param options - Reprocessing options
 * @returns New job ID
 */
export async function reprocessDocument(
  documentId: string,
  options: DocumentUploadOptions = {}
): Promise<string> {
  const response = await fetch(`/api/documents/${documentId}/reprocess`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to reprocess document: ${response.statusText}`);
  }

  const data = await response.json();
  return data.jobId;
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
};

export default documentService;
