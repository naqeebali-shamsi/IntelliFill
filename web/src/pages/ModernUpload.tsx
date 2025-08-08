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
// import api from '@/services/api' // Uncomment when implementing actual API calls

interface UploadedFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'
  progress: number
  error?: string
  result?: any
}

const templates = [
  { id: 'invoice', name: 'Invoice Template', description: 'For invoice processing' },
  { id: 'tax', name: 'Tax Form', description: 'For tax documents' },
  { id: 'contract', name: 'Contract Template', description: 'For legal contracts' },
  { id: 'medical', name: 'Medical Form', description: 'For medical documents' },
  { id: 'application', name: 'Application Form', description: 'For applications' },
  { id: 'custom', name: 'Custom Template', description: 'Auto-detect fields' }
]

export default function ModernUpload() {
  const navigate = useNavigate()
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('custom')
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending' as const,
      progress: 0
    }))
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 10 * 1024 * 1024 // 10MB
  })

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const uploadFiles = async () => {
    setIsUploading(true)
    
    for (const uploadedFile of files.filter(f => f.status === 'pending')) {
      try {
        // Update status to uploading
        setFiles(prev => prev.map(f => 
          f.id === uploadedFile.id 
            ? { ...f, status: 'uploading' as const, progress: 30 }
            : f
        ))

        // Simulate upload
        const formData = new FormData()
        formData.append('file', uploadedFile.file)
        formData.append('template', selectedTemplate)

        // Update progress
        setFiles(prev => prev.map(f => 
          f.id === uploadedFile.id 
            ? { ...f, progress: 60 }
            : f
        ))

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Mark as completed
        setFiles(prev => prev.map(f => 
          f.id === uploadedFile.id 
            ? { ...f, status: 'completed' as const, progress: 100 }
            : f
        ))

        toast.success(`${uploadedFile.file.name} processed successfully`)
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === uploadedFile.id 
            ? { ...f, status: 'error' as const, error: 'Upload failed' }
            : f
        ))
        toast.error(`Failed to process ${uploadedFile.file.name}`)
      }
    }

    setIsUploading(false)
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
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Upload Documents</h1>
        <p className="text-muted-foreground">
          Upload PDF documents to automatically fill forms using intelligent field mapping.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upload Area - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Template Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Template</CardTitle>
              <CardDescription>
                Choose a template for better field mapping accuracy
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template">Template Type</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger id="template">
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{template.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {template.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Drop Zone */}
          <Card>
            <CardContent className="p-0">
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
                  transition-colors duration-200 ease-in-out
                  ${isDragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50 hover:bg-accent/5'
                  }
                `}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                {isDragActive ? (
                  <p className="text-lg font-medium">Drop the files here...</p>
                ) : (
                  <div>
                    <p className="text-lg font-medium">
                      Drag & drop files here, or click to select
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Supports PDF, DOC, DOCX (Max 10MB)
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* File List */}
          {files.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Files to Process</CardTitle>
                <CardDescription>
                  {files.length} file{files.length !== 1 ? 's' : ''} ready for processing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {files.map((uploadedFile) => (
                    <div
                      key={uploadedFile.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {getFileIcon(uploadedFile.status)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {uploadedFile.file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        {getStatusBadge(uploadedFile.status)}
                      </div>
                      <div className="flex items-center gap-2">
                        {uploadedFile.status === 'uploading' && (
                          <Progress value={uploadedFile.progress} className="w-24 h-2" />
                        )}
                        {uploadedFile.status === 'completed' && (
                          <Button size="icon" variant="ghost">
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeFile(uploadedFile.id)}
                          disabled={uploadedFile.status === 'uploading'}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={uploadFiles}
                    disabled={isUploading || files.filter(f => f.status === 'pending').length === 0}
                    className="flex-1"
                  >
                    {isUploading ? (
                      <>
                        <Clock className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Process Files
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setFiles([])}
                    disabled={isUploading}
                  >
                    Clear All
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                  1
                </div>
                <div>
                  <p className="font-medium">Select Template</p>
                  <p className="text-sm text-muted-foreground">
                    Choose the appropriate template for your document
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                  2
                </div>
                <div>
                  <p className="font-medium">Upload Documents</p>
                  <p className="text-sm text-muted-foreground">
                    Drag & drop or click to select PDF files
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                  3
                </div>
                <div>
                  <p className="font-medium">Process & Download</p>
                  <p className="text-sm text-muted-foreground">
                    AI extracts data and fills forms automatically
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Uploads */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Uploads</CardTitle>
              <CardDescription>Your last processed documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Invoice_2024.pdf</span>
                  </div>
                  <span className="text-xs text-muted-foreground">2h ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Contract_Final.pdf</span>
                  </div>
                  <span className="text-xs text-muted-foreground">5h ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Tax_Form_1040.pdf</span>
                  </div>
                  <span className="text-xs text-muted-foreground">1d ago</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tips */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Pro Tips</AlertTitle>
            <AlertDescription className="space-y-2 mt-2">
              <p>• Ensure PDFs are not password protected</p>
              <p>• For best results, use high-quality scans</p>
              <p>• Select the correct template for accurate mapping</p>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  )
}