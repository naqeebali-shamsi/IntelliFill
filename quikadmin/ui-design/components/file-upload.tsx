// Modern File Upload Component with Drag & Drop
import React, { useCallback, useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Upload, 
  File, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  FileText,
  Image,
  Archive,
  FileX
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileItem {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  preview?: string
}

interface FileUploadProps {
  maxFiles?: number
  maxFileSize?: number // in bytes
  acceptedTypes?: string[]
  onFilesSelected?: (files: File[]) => void
  onFileRemoved?: (fileId: string) => void
  className?: string
  multiple?: boolean
}

const getFileIcon = (file: File) => {
  if (file.type.startsWith('image/')) {
    return <Image className="h-8 w-8 text-blue-500" />
  } else if (file.type === 'application/pdf') {
    return <FileText className="h-8 w-8 text-red-500" />
  } else if (file.type.includes('zip') || file.type.includes('rar')) {
    return <Archive className="h-8 w-8 text-yellow-500" />
  } else {
    return <File className="h-8 w-8 text-gray-500" />
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const FilePreview: React.FC<{ 
  file: FileItem
  onRemove: (id: string) => void 
}> = ({ file, onRemove }) => {
  const getStatusIcon = () => {
    switch (file.status) {
      case 'pending':
        return null
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  const getStatusColor = () => {
    switch (file.status) {
      case 'pending':
        return 'border-gray-200 bg-gray-50/50'
      case 'uploading':
        return 'border-blue-200 bg-blue-50/50'
      case 'success':
        return 'border-green-200 bg-green-50/50'
      case 'error':
        return 'border-red-200 bg-red-50/50'
      default:
        return 'border-gray-200 bg-gray-50/50'
    }
  }

  return (
    <div 
      className={cn(
        "flex items-center justify-between p-4 border rounded-lg transition-all duration-200",
        getStatusColor()
      )}
      role="listitem"
    >
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        {getFileIcon(file.file)}
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium truncate" title={file.file.name}>
              {file.file.name}
            </p>
            {getStatusIcon()}
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.file.size)}
            </p>
            {file.status === 'error' && file.error && (
              <Badge variant="destructive" className="text-xs">
                Error
              </Badge>
            )}
          </div>
          {file.status === 'uploading' && (
            <Progress value={file.progress} className="mt-2 h-1" />
          )}
          {file.status === 'error' && file.error && (
            <p className="text-xs text-red-600 mt-1">{file.error}</p>
          )}
        </div>
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(file.id)}
        className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
        aria-label={`Remove ${file.file.name}`}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

export const FileUpload: React.FC<FileUploadProps> = ({
  maxFiles = 10,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  acceptedTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.gif'],
  onFilesSelected,
  onFileRemoved,
  className = '',
  multiple = true
}) => {
  const [files, setFiles] = useState<FileItem[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File size exceeds ${formatFileSize(maxFileSize)}`
    }
    
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!acceptedTypes.some(type => type.toLowerCase() === fileExtension)) {
      return `File type not supported. Accepted types: ${acceptedTypes.join(', ')}`
    }
    
    return null
  }

  const processFiles = useCallback((newFiles: File[]) => {
    setError('')
    
    if (!multiple && newFiles.length > 1) {
      setError('Only one file can be uploaded at a time')
      return
    }
    
    if (files.length + newFiles.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`)
      return
    }

    const validFiles: FileItem[] = []
    const errors: string[] = []

    newFiles.forEach((file, index) => {
      const validationError = validateFile(file)
      if (validationError) {
        errors.push(`${file.name}: ${validationError}`)
      } else {
        validFiles.push({
          id: Date.now().toString() + index,
          file,
          status: 'pending',
          progress: 0
        })
      }
    })

    if (errors.length > 0) {
      setError(errors.join('; '))
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles])
      onFilesSelected?.(validFiles.map(f => f.file))
      
      // Simulate upload progress
      validFiles.forEach((fileItem, index) => {
        setTimeout(() => {
          setFiles(prev => prev.map(f => 
            f.id === fileItem.id ? { ...f, status: 'uploading' } : f
          ))
          
          // Simulate progress
          const interval = setInterval(() => {
            setFiles(prev => prev.map(f => {
              if (f.id === fileItem.id && f.status === 'uploading') {
                const newProgress = Math.min(f.progress + Math.random() * 30, 100)
                if (newProgress >= 100) {
                  clearInterval(interval)
                  setTimeout(() => {
                    setFiles(prev => prev.map(f => 
                      f.id === fileItem.id 
                        ? { ...f, status: 'success', progress: 100 }
                        : f
                    ))
                  }, 500)
                }
                return { ...f, progress: newProgress }
              }
              return f
            }))
          }, 200)
        }, index * 100)
      })
    }
  }, [files, maxFiles, maxFileSize, acceptedTypes, onFilesSelected, multiple])

  const handleFileRemove = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
    onFileRemoved?.(fileId)
  }, [onFileRemoved])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const droppedFiles = Array.from(e.dataTransfer.files)
    processFiles(droppedFiles)
  }, [processFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      processFiles(selectedFiles)
    }
    // Reset input value to allow selecting the same file again
    e.target.value = ''
  }, [processFiles])

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={cn("space-y-4", className)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Files
          </CardTitle>
          <CardDescription>
            Drag and drop files here or click to browse. 
            Max {maxFiles} files, up to {formatFileSize(maxFileSize)} each.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer",
              isDragOver 
                ? "border-primary bg-primary/5 scale-[1.02]" 
                : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50",
              files.length > 0 && "mb-6"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleButtonClick}
            role="button"
            tabIndex={0}
            aria-label="Upload files by clicking or dragging and dropping"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleButtonClick()
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple={multiple}
              accept={acceptedTypes.join(',')}
              onChange={handleFileInputChange}
              className="sr-only"
              aria-describedby="file-upload-description"
            />
            
            <div className="flex flex-col items-center space-y-4">
              <div className={cn(
                "rounded-full p-4 transition-colors duration-200",
                isDragOver ? "bg-primary/10" : "bg-muted"
              )}>
                <Upload className={cn(
                  "h-8 w-8 transition-colors duration-200",
                  isDragOver ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
              
              <div className="space-y-2">
                <p className="text-lg font-medium">
                  {isDragOver ? 'Drop files here' : 'Choose files or drag and drop'}
                </p>
                <p id="file-upload-description" className="text-sm text-muted-foreground">
                  Supported formats: {acceptedTypes.join(', ')}
                </p>
              </div>
              
              <Button 
                type="button" 
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  handleButtonClick()
                }}
              >
                Browse Files
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {files.length > 0 && (
            <div className="space-y-2" role="list" aria-label="Uploaded files">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">
                  Files ({files.length}/{maxFiles})
                </h3>
                {files.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFiles([])
                      setError('')
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Clear All
                  </Button>
                )}
              </div>
              {files.map((file) => (
                <FilePreview 
                  key={file.id} 
                  file={file} 
                  onRemove={handleFileRemove}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default FileUpload