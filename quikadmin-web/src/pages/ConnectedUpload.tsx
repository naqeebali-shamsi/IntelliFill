/**
 * Enhanced document upload page with queue management and job polling
 * Phase 2: Document Upload & Processing
 */

import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertCircle,
  CheckCircle2,
  Upload as UploadIcon,
  X,
  RotateCcw,
  Trash2,
  FileText,
} from 'lucide-react';

// Phase 1 components
import { FileUploadZone } from '@/components/features/file-upload-zone';
import { DocumentCard } from '@/components/features/document-card';
import { StatusBadge } from '@/components/features/status-badge';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';

// Phase 2 upload system
import { useUploadQueue, useUploadStats } from '@/stores/uploadStore';
import { useUpload } from '@/hooks/useUpload';
import { useQueueJobPolling } from '@/hooks/useJobPolling';
import {
  validateFiles,
  ACCEPTED_FILE_TYPES,
  FILE_SIZE_LIMITS,
  getAcceptedExtensions,
} from '@/utils/fileValidation';
import { UploadFile } from '@/types/upload';

export default function ConnectedUpload() {
  const navigate = useNavigate();

  // Upload queue state
  const { files, addFiles, removeFile, cancelUpload, retryUpload, clearCompleted, clearAll } =
    useUploadQueue();
  const stats = useUploadStats();

  // Upload management
  const { startUploads, isProcessing, activeUploads, pendingUploads } = useUpload({
    autoStart: true,
    maxConcurrent: 3,
    onSuccess: (file, result) => {
      console.log('Upload successful:', file.file.name, result);
    },
    onError: (file, error) => {
      console.error('Upload failed:', file.file.name, error);
    },
  });

  // Poll processing jobs
  useQueueJobPolling({
    interval: 2000,
    onComplete: (result) => {
      console.log('Processing complete:', result);
    },
    onError: (error) => {
      console.error('Processing error:', error);
    },
  });

  // Get file status groups - use useMemo to prevent infinite loops from filter creating new arrays
  const uploadingFiles = useMemo(() => files.filter((f) => f.status === 'uploading'), [files]);
  const processingFiles = useMemo(() => files.filter((f) => f.status === 'processing'), [files]);
  const completedFiles = useMemo(() => files.filter((f) => f.status === 'completed'), [files]);
  const failedFiles = useMemo(() => files.filter((f) => f.status === 'failed'), [files]);
  const hasActiveUploads = useMemo(
    () => files.some((f) => f.status === 'uploading' || f.status === 'processing'),
    [files]
  );

  /**
   * Handle files dropped or selected
   */
  const handleFilesAccepted = useCallback(
    (newFiles: File[]) => {
      // Validate files
      const existingFiles = files.map((f) => f.file);
      const { valid, invalid } = validateFiles(newFiles, existingFiles);

      // Show errors for invalid files
      invalid.forEach((error) => {
        toast.error(`${error.file.name}: ${error.message}`);
      });

      // Add valid files to queue
      if (valid.length > 0) {
        addFiles(valid);
        toast.success(`${valid.length} file${valid.length > 1 ? 's' : ''} added to queue`);
      }
    },
    [files, addFiles]
  );

  /**
   * Handle file rejection from dropzone
   */
  const handleFilesRejected = useCallback((rejections: any[]) => {
    rejections.forEach((rejection) => {
      const errors = rejection.errors.map((e: any) => e.message).join(', ');
      toast.error(`${rejection.file.name}: ${errors}`);
    });
  }, []);

  /**
   * Get file icon based on status
   */
  const getFileStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'uploading':
      case 'processing':
        return <Spinner size="sm" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  /**
   * Get file type for DocumentCard
   */
  const getFileType = (mimeType: string) => {
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('word')) return 'docx';
    if (mimeType === 'text/csv') return 'csv';
    if (mimeType.startsWith('image/')) return 'image';
    return 'other';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Documents</h1>
        <p className="text-muted-foreground mt-2">
          Upload documents for AI-powered processing and form filling. Supports PDF, Word, CSV, and images.
        </p>
      </div>

      {/* Upload Stats */}
      {files.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Files</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Uploading</CardDescription>
              <CardTitle className="text-3xl text-blue-600">
                {stats.uploading + stats.processing}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-3xl text-green-600">{stats.completed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Failed</CardDescription>
              <CardTitle className="text-3xl text-red-600">{stats.failed}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Overall Progress */}
      {hasActiveUploads && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overall Progress</CardTitle>
            <CardDescription>
              {activeUploads} active • {pendingUploads} pending
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={stats.overallProgress} showPercentage className="h-3" />
          </CardContent>
        </Card>
      )}

      {/* File Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
          <CardDescription>
            Drag and drop files here or click to browse. {getAcceptedExtensions()} •
            Max {FILE_SIZE_LIMITS.MAX_FILE_SIZE / (1024 * 1024)}MB per file •
            Max {FILE_SIZE_LIMITS.MAX_FILES} files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploadZone
            onFilesAccepted={handleFilesAccepted}
            onFilesRejected={handleFilesRejected}
            accept={ACCEPTED_FILE_TYPES}
            maxSize={FILE_SIZE_LIMITS.MAX_FILE_SIZE}
            maxFiles={FILE_SIZE_LIMITS.MAX_FILES}
            multiple
            showFileList={false}
          />
        </CardContent>
      </Card>

      {/* Upload Queue */}
      {files.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Upload Queue</CardTitle>
                <CardDescription>
                  {files.length} file{files.length !== 1 ? 's' : ''} in queue
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {completedFiles.length > 0 && (
                  <Button variant="outline" size="sm" onClick={clearCompleted}>
                    Clear Completed
                  </Button>
                )}
                {!hasActiveUploads && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAll}
                    disabled={hasActiveUploads}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {files.map((uploadFile) => (
                <div
                  key={uploadFile.id}
                  className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  {/* File Icon */}
                  <div className="mt-1">{getFileStatusIcon(uploadFile.status)}</div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium truncate">{uploadFile.file.name}</p>
                      <StatusBadge
                        status={
                          uploadFile.status === 'uploading' ||
                          uploadFile.status === 'processing' ||
                          uploadFile.status === 'validating'
                            ? 'processing'
                            : uploadFile.status === 'completed'
                            ? 'completed'
                            : uploadFile.status === 'failed'
                            ? 'failed'
                            : 'pending'
                        }
                        size="sm"
                      />
                    </div>

                    <p className="text-xs text-muted-foreground mb-2">
                      {(uploadFile.file.size / (1024 * 1024)).toFixed(2)} MB
                      {uploadFile.startedAt && uploadFile.completedAt && (
                        <> • {((uploadFile.completedAt - uploadFile.startedAt) / 1000).toFixed(1)}s</>
                      )}
                    </p>

                    {/* Progress Bar */}
                    {(uploadFile.status === 'uploading' || uploadFile.status === 'processing') && (
                      <Progress
                        value={uploadFile.progress}
                        showPercentage
                        className="h-2"
                        variant={uploadFile.status === 'processing' ? 'default' : 'default'}
                      />
                    )}

                    {/* Error Message */}
                    {uploadFile.error && (
                      <Alert variant="destructive" className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription className="text-xs">{uploadFile.error}</AlertDescription>
                      </Alert>
                    )}

                    {/* Success Message */}
                    {uploadFile.status === 'completed' && uploadFile.result && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 inline mr-1 text-green-600" />
                        Processing complete
                        {uploadFile.result.metadata?.confidence && (
                          <> • {Math.round(uploadFile.result.metadata.confidence * 100)}% confidence</>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1">
                    {/* Cancel button for uploading files */}
                    {(uploadFile.status === 'uploading' || uploadFile.status === 'pending') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => cancelUpload(uploadFile.id)}
                        title="Cancel upload"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Retry button for failed files */}
                    {uploadFile.status === 'failed' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => retryUpload(uploadFile.id)}
                        title="Retry upload"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Remove button for completed/failed/cancelled */}
                    {(uploadFile.status === 'completed' ||
                      uploadFile.status === 'failed' ||
                      uploadFile.status === 'cancelled') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(uploadFile.id)}
                        title="Remove from queue"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={UploadIcon}
          title="No files in queue"
          description="Drag and drop files above or click to browse"
        />
      )}

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>How it works</AlertTitle>
        <AlertDescription>
          <ol className="list-decimal list-inside space-y-1 mt-2">
            <li>Upload one or more documents (PDF, Word, CSV, images)</li>
            <li>Files are automatically processed with AI-powered data extraction</li>
            <li>Track progress in real-time with detailed status updates</li>
            <li>Download processed results or use data to fill forms</li>
          </ol>
        </AlertDescription>
      </Alert>
    </div>
  );
}
