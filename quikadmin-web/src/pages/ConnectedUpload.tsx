/**
 * Enhanced document upload page with queue management and job polling
 * Phase 2: Document Upload & Processing
 * Redesigned with "Deep Ocean" aesthetic
 */

import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
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
  Sparkles,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1 components
import { FileUploadZone } from '@/components/features/file-upload-zone';
import { DocumentCard } from '@/components/features/document-card';
import { StatusBadge } from '@/components/features/status-badge';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { OCRScanning } from '@/components/features/ocr/OCRScanning';

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

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};


const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0 }
};

const StatCard = ({ label, value, colorClass }: { label: string, value: number, colorClass?: string }) => (
  <div className="glass-panel p-4 rounded-xl flex flex-col items-center justify-center text-center">
     <span className={cn("text-2xl font-bold font-heading", colorClass)}>{value}</span>
     <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
  </div>
);

export default function ConnectedUpload() {
  const navigate = useNavigate();

  // Upload queue state
  const { files, addFiles, removeFile, cancelUpload, retryUpload, clearCompleted, clearAll } = useUploadQueue();
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
  
  // Get currently processing file for visualization (take the first one)
  const currentProcessingFile = processingFiles[0] || uploadingFiles[0];

  /**
   * Handle files dropped or selected
   */
  const handleFilesAccepted = useCallback(
    (newFiles: File[]) => {
      const existingFiles = files.map((f) => f.file);
      const { valid, invalid } = validateFiles(newFiles, existingFiles);

      invalid.forEach((error) => {
        toast.error(`${error.file.name}: ${error.message}`);
      });

      if (valid.length > 0) {
        addFiles(valid);
        toast.success(`${valid.length} file${valid.length > 1 ? 's' : ''} added to queue`);
      }
    },
    [files, addFiles]
  );

  const handleFilesRejected = useCallback((rejections: any[]) => {
    rejections.forEach((rejection) => {
      const errors = rejection.errors.map((e: any) => e.message).join(', ');
      toast.error(`${rejection.file.name}: ${errors}`);
    });
  }, []);


  const getFileStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'uploading':
      case 'processing':
        return <Sparkles className="h-5 w-5 text-primary animate-pulse" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-heading font-semibold tracking-tight text-foreground">Upload Documents</h1>
        <p className="text-muted-foreground">
          Upload documents for AI-powered processing. Supports PDF, Word, CSV, and images.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Main Upload Area */}
         <div className="lg:col-span-2 space-y-6">
            {/* File Upload Zone */}
            <div className="glass-panel p-1 rounded-2xl bg-gradient-to-br from-white/5 to-white/0">
                <div className="bg-card/50 backdrop-blur-sm rounded-xl p-6 border border-white/5">
                    <FileUploadZone
                        onFilesAccepted={handleFilesAccepted}
                        onFilesRejected={handleFilesRejected}
                        accept={ACCEPTED_FILE_TYPES}
                        maxSize={FILE_SIZE_LIMITS.MAX_FILE_SIZE}
                        maxFiles={FILE_SIZE_LIMITS.MAX_FILES}
                        multiple
                        showFileList={false}
                    />
                </div>
            </div>

            {/* Upload Queue */}
            {files.length > 0 && (
                <div className="glass-panel rounded-xl overflow-hidden border border-white/10">
                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                        <div>
                            <h3 className="font-medium text-foreground">Upload Queue</h3>
                            <p className="text-xs text-muted-foreground">{files.length} file{files.length !== 1 ? 's' : ''} in queue</p>
                        </div>
                        <div className="flex gap-2">
                            {completedFiles.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearCompleted} className="text-xs h-7">
                                Clear Completed
                            </Button>
                            )}
                            {!hasActiveUploads && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearAll}
                                disabled={hasActiveUploads}
                                className="text-xs h-7 text-red-400 hover:text-red-300 hover:bg-red-950/20"
                            >
                                Clear All
                            </Button>
                            )}
                        </div>
                    </div>

                    <div className="p-4 max-h-[500px] overflow-y-auto">
                         <motion.div 
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                            className="space-y-3"
                         >
                             <AnimatePresence mode="popLayout">
                                {files.map((uploadFile) => (
                                    <motion.div
                                        key={uploadFile.id}
                                        variants={itemVariants}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                                        className={cn(
                                            "group relative flex items-start gap-3 p-4 rounded-xl border transition-all",
                                            uploadFile.status === 'processing' || uploadFile.status === 'uploading' 
                                                ? "bg-primary/5 border-primary/20 shadow-[0_0_15px_-5px_rgba(99,102,241,0.2)]" 
                                                : "bg-card/40 border-white/5 hover:bg-card/60"
                                        )}
                                    >
                                        <div className="mt-1 shrink-0">{getFileStatusIcon(uploadFile.status)}</div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-sm font-medium truncate text-foreground">{uploadFile.file.name}</p>
                                                <StatusBadge
                                                    status={
                                                    ['uploading', 'processing', 'validating'].includes(uploadFile.status)
                                                        ? 'processing'
                                                        : (uploadFile.status as any)
                                                    }
                                                    size="sm"
                                                />
                                            </div>
                                            
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                                 <span>{(uploadFile.file.size / (1024 * 1024)).toFixed(2)} MB</span>
                                                 {uploadFile.startedAt && uploadFile.completedAt && (
                                                    <><span>•</span><span>{((uploadFile.completedAt - uploadFile.startedAt) / 1000).toFixed(1)}s</span></>
                                                )}
                                            </div>

                                            {/* Progress Bar */}
                                            {['uploading', 'processing'].includes(uploadFile.status) && (
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                                        <span>{uploadFile.status === 'uploading' ? 'Uploading...' : 'Analyzing document...'}</span>
                                                        <span>{Math.round(uploadFile.progress)}%</span>
                                                    </div>
                                                    <Progress
                                                        value={uploadFile.progress}
                                                        className="h-1.5 bg-primary/20"
                                                        // indicatorClassName="bg-primary shadow-[0_0_10px_rgba(99,102,241,0.5)]" // Tailwind v4 might need custom class or var
                                                    />
                                                </div>
                                            )}

                                            {/* Error Message */}
                                            {uploadFile.error && (
                                                <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                                                    <AlertCircle className="h-3 w-3" /> {uploadFile.error}
                                                </p>
                                            )}

                                            {/* Success Message */}
                                            {uploadFile.status === 'completed' && uploadFile.result && (
                                                <div className="mt-2 text-xs text-green-400/80 flex items-center gap-1">
                                                     <CheckCircle2 className="h-3 w-3" /> 
                                                     <span>Processing complete</span>
                                                     {uploadFile.result.metadata?.confidence && (
                                                        <span className="text-muted-foreground">• {Math.round(uploadFile.result.metadata.confidence * 100)}% confidence</span>
                                                     )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-3 right-3 bg-card/80 backdrop-blur-sm rounded-lg p-0.5 border border-white/5">
                                            {['uploading', 'pending'].includes(uploadFile.status) && (
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => cancelUpload(uploadFile.id)}>
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            )}
                                            {uploadFile.status === 'failed' && (
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => retryUpload(uploadFile.id)}>
                                                    <RotateCcw className="h-3 w-3" />
                                                </Button>
                                            )}
                                            {['completed', 'failed', 'cancelled'].includes(uploadFile.status) && (
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-950/20" onClick={() => removeFile(uploadFile.id)}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                             </AnimatePresence>
                         </motion.div>
                    </div>
                </div>
            )}
            
            {/* Info Box */}
            <Alert className="bg-primary/5 border-primary/20 text-foreground">
                <Info className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary font-medium">How it works</AlertTitle>
                <AlertDescription className="text-muted-foreground text-xs mt-1">
                    Upload documents (PDF, Word, or Image) to automatically extract data. The AI engine will analyze the content and prepare it for auto-filling government forms.
                </AlertDescription>
            </Alert>
         </div>

         {/* Sidebar: Stats & Active Process */}
         <div className="space-y-6">
             {/* Stats Grid */}
             <div className="grid grid-cols-2 gap-4">
                 <StatCard label="In Queue" value={stats.total} />
                 <StatCard label="Completed" value={stats.completed} colorClass="text-green-500" />
                 <StatCard label="Processing" value={stats.uploading + stats.processing} colorClass="text-blue-500" />
                 <StatCard label="Failed" value={stats.failed} colorClass="text-red-500" />
             </div>

             {/* Dynamic Illustration / Active Process */}
             <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
                  
                  {currentProcessingFile ? (
                      <div className="w-full relative z-10 animate-in fade-in duration-500">
                          <h3 className="text-center text-sm font-medium mb-4 text-primary animate-pulse">
                              {currentProcessingFile.status === 'uploading' ? 'Uploading Document...' : 'AI Analyzing Content...'}
                          </h3>
                          <div className="max-w-[200px] mx-auto shadow-2xl shadow-primary/20 rounded-xl">
                             <OCRScanning isScanning={true} />
                          </div>
                      </div>
                  ) : (
                      <div className="text-center relative z-10 opacity-50">
                          <div className="w-32 h-40 mx-auto border-2 border-dashed border-white/20 rounded-xl mb-4 flex items-center justify-center">
                              <UploadIcon className="h-10 w-10 text-white/20" />
                          </div>
                          <p className="text-sm text-muted-foreground">Ready to process</p>
                      </div>
                  )}
             </div>
         </div>
      </div>
    </div>
  );
}
