// Document DTOs - no internal paths or sensitive data

export interface DocumentDTO {
  id: string;
  userId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  uploadedAt: string;
  processedAt?: string;
  metadata?: DocumentMetadata;
}

export interface DocumentMetadata {
  title?: string;
  description?: string;
  tags?: string[];
  pageCount?: number;
  extractedFields?: number;
}

export interface DocumentProcessingResultDTO {
  documentId: string;
  status: 'success' | 'partial' | 'failed';
  extractedData?: Record<string, any>;
  mappedFields?: MappedFieldDTO[];
  confidence: number;
  processingTime: number;
  errors?: string[];
}

export interface MappedFieldDTO {
  sourceField: string;
  targetField: string;
  value: any;
  confidence: number;
  verified: boolean;
}

// Factory functions
export function toDocumentDTO(document: any): DocumentDTO {
  return {
    id: document.id,
    userId: document.user_id || document.userId,
    fileName: document.file_name || document.fileName,
    fileType: document.file_type || document.fileType,
    fileSize: document.file_size || document.fileSize,
    status: document.status,
    uploadedAt: document.uploaded_at?.toISOString() || document.uploadedAt,
    processedAt: document.processed_at?.toISOString() || document.processedAt,
    metadata: document.metadata
  };
}

export function toDocumentProcessingResultDTO(result: any): DocumentProcessingResultDTO {
  return {
    documentId: result.document_id || result.documentId,
    status: result.status,
    extractedData: result.extracted_data || result.extractedData,
    mappedFields: result.mapped_fields?.map((field: any) => toMappedFieldDTO(field)),
    confidence: result.confidence || 0,
    processingTime: result.processing_time || result.processingTime || 0,
    errors: result.errors
  };
}

export function toMappedFieldDTO(field: any): MappedFieldDTO {
  return {
    sourceField: field.source_field || field.sourceField,
    targetField: field.target_field || field.targetField,
    value: field.value,
    confidence: field.confidence || 0,
    verified: field.verified || false
  };
}

// Job status DTO for async processing
export interface JobStatusDTO {
  jobId: string;
  type: 'document_processing' | 'batch_processing' | 'form_filling';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: any;
  error?: string;
}

export function toJobStatusDTO(job: any): JobStatusDTO {
  return {
    jobId: job.id,
    type: job.type,
    status: job.status,
    progress: job.progress || 0,
    createdAt: job.created_at?.toISOString() || job.createdAt,
    startedAt: job.started_at?.toISOString() || job.startedAt,
    completedAt: job.completed_at?.toISOString() || job.completedAt,
    result: job.result,
    error: job.error
  };
}