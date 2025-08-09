import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Upload, 
  FileText, 
  X, 
  CheckCircle, 
  AlertCircle,
  File,
  FileCheck,
  Clock,
  Download,
  Trash2
} from 'lucide-react'
import { processDocuments } from '@/services/api'

interface UploadedFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'
  progress: number
  error?: string
  result?: any
}

export default function ConnectedUpload() {
  const navigate = useNavigate()
  const [documentFiles, setDocumentFiles] = useState<UploadedFile[]>([])
  const [formFile, setFormFile] = useState<UploadedFile | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState('custom')
  const [isUploading, setIsUploading] = useState(false)

  const onDropDocuments = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending' as const,
      progress: 0
    }))
    setDocumentFiles(prev => [...prev, ...newFiles])
  }, [])

  const onDropForm = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      setFormFile({
        id: Math.random().toString(36).substr(2, 9),
        file,
        status: 'pending' as const,
        progress: 0
      })
    }
  }, [])

  const { getRootProps: getDocRootProps, getInputProps: getDocInputProps, isDragActive: isDocDragActive } = useDropzone({
    onDrop: onDropDocuments,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv']
    },
    maxSize: 10 * 1024 * 1024 // 10MB
  })

  const { getRootProps: getFormRootProps, getInputProps: getFormInputProps, isDragActive: isFormDragActive } = useDropzone({
    onDrop: onDropForm,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 1
  })

  const removeDocument = (id: string) => {
    setDocumentFiles(prev => prev.filter(f => f.id !== id))
  }

  const uploadFiles = async () => {
    if (documentFiles.length === 0 || !formFile) {
      toast.error('Please upload both documents and a form')
      return
    }

    setIsUploading(true)
    
    try {
      // Update status to uploading
      setDocumentFiles(prev => prev.map(f => ({ ...f, status: 'uploading' as const, progress: 30 })))
      setFormFile(prev => prev ? { ...prev, status: 'uploading' as const, progress: 30 } : null)

      // Prepare files for upload
      const documents = documentFiles.map(f => f.file)
      const form = formFile.file

      // Call API with progress tracking
      const result = await processDocuments(
        documents,
        form,
        (progress) => {
          // Update progress for all files
          setDocumentFiles(prev => prev.map(f => ({ ...f, progress })))
          setFormFile(prev => prev ? { ...prev, progress } : null)
        }
      )

      // Mark as completed
      setDocumentFiles(prev => prev.map(f => ({ 
        ...f, 
        status: 'completed' as const, 
        progress: 100,
        result: result.data
      })))
      setFormFile(prev => prev ? { 
        ...prev, 
        status: 'completed' as const, 
        progress: 100 
      } : null)

      toast.success('Documents processed successfully!')
      
      // Navigate to job details or history
      if (result.data?.jobId) {
        navigate(`/job/${result.data.jobId}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      
      setDocumentFiles(prev => prev.map(f => ({ 
        ...f, 
        status: 'error' as const, 
        error: errorMessage 
      })))
      setFormFile(prev => prev ? { 
        ...prev, 
        status: 'error' as const, 
        error: errorMessage 
      } : null)
      
      toast.error(`Failed to process documents: ${errorMessage}`)
    } finally {
      setIsUploading(false)
    }
  }

  const getFileIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'completed':
        return <FileCheck className="h-5 w-5 text-green-600" />
      case 'uploading':
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-600 animate-pulse" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />
      default:
        return <File className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusBadge = (status: UploadedFile['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700">Completed</Badge>
      case 'uploading':
        return <Badge className="bg-blue-100 text-blue-700">Uploading</Badge>
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-700">Processing</Badge>
      case 'error':
        return <Badge className="bg-red-100 text-red-700">Error</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-700">Pending</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Documents</h1>
        <p className="text-muted-foreground mt-2">
          Upload source documents and a target form to automatically fill the form with extracted data.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Documents Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Source Documents</CardTitle>
            <CardDescription>
              Upload documents containing data to extract (PDF, Word, CSV)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              {...getDocRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDocDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary'
              }`}
            >
              <input {...getDocInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-1">
                {isDocDragActive ? 'Drop documents here' : 'Click or drag documents here'}
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, DOC, DOCX, TXT, CSV (max 10MB each)
              </p>
            </div>

            {documentFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {documentFiles.map((uploadedFile) => (
                  <div key={uploadedFile.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    {getFileIcon(uploadedFile.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{uploadedFile.file.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={uploadedFile.progress} className="h-1 flex-1" />
                        {getStatusBadge(uploadedFile.status)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDocument(uploadedFile.id)}
                      disabled={uploadedFile.status === 'uploading' || uploadedFile.status === 'processing'}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Form Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Target Form</CardTitle>
            <CardDescription>
              Upload the PDF form to be filled
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              {...getFormRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isFormDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary'
              }`}
            >
              <input {...getFormInputProps()} />
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-1">
                {isFormDragActive ? 'Drop form here' : 'Click or drag form here'}
              </p>
              <p className="text-xs text-muted-foreground">
                PDF forms only (max 10MB)
              </p>
            </div>

            {formFile && (
              <div className="mt-4">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  {getFileIcon(formFile.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{formFile.file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={formFile.progress} className="h-1 flex-1" />
                      {getStatusBadge(formFile.status)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFormFile(null)}
                    disabled={formFile.status === 'uploading' || formFile.status === 'processing'}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upload Button */}
      <div className="flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={() => {
            setDocumentFiles([])
            setFormFile(null)
          }}
          disabled={isUploading}
        >
          Clear All
        </Button>
        <Button
          onClick={uploadFiles}
          disabled={isUploading || documentFiles.length === 0 || !formFile}
        >
          {isUploading ? (
            <>
              <Clock className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Process Documents
            </>
          )}
        </Button>
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>How it works</AlertTitle>
        <AlertDescription>
          1. Upload one or more source documents containing data to extract<br/>
          2. Upload the PDF form you want to fill<br/>
          3. Our AI will automatically map and fill the form fields<br/>
          4. Download the completed form with all data filled in
        </AlertDescription>
      </Alert>
    </div>
  )
}