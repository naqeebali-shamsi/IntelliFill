import * as React from "react"
import { useDropzone, type FileRejection, type DropzoneOptions } from "react-dropzone"
import { cn } from "@/lib/utils"
import { Upload, File, X, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

export interface FileUploadZoneProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onDrop"> {
  /**
   * Callback when files are accepted
   */
  onFilesAccepted: (files: File[]) => void
  /**
   * Callback when files are rejected (validation failed)
   */
  onFilesRejected?: (rejections: FileRejection[]) => void
  /**
   * Accepted file types (MIME types)
   * @example { 'image/*': ['.png', '.jpg'], 'application/pdf': ['.pdf'] }
   */
  accept?: DropzoneOptions["accept"]
  /**
   * Maximum file size in bytes
   */
  maxSize?: number
  /**
   * Maximum number of files
   */
  maxFiles?: number
  /**
   * Allow multiple files
   */
  multiple?: boolean
  /**
   * Disable the upload zone
   */
  disabled?: boolean
  /**
   * Show accepted file list
   */
  showFileList?: boolean
  /**
   * Upload progress (0-100) for showing progress bar
   */
  uploadProgress?: number
  /**
   * Custom content to display in the drop zone
   */
  children?: React.ReactNode
}

/**
 * FileUploadZone component for drag-and-drop file uploads.
 *
 * @example
 * // Basic file upload
 * <FileUploadZone
 *   onFilesAccepted={(files) => handleUpload(files)}
 *   accept={{ 'application/pdf': ['.pdf'] }}
 *   maxSize={10 * 1024 * 1024} // 10MB
 * />
 *
 * @example
 * // Multiple files with progress
 * <FileUploadZone
 *   multiple
 *   onFilesAccepted={handleFiles}
 *   onFilesRejected={handleErrors}
 *   uploadProgress={uploadProgress}
 *   maxFiles={5}
 * />
 */
function FileUploadZone({
  onFilesAccepted,
  onFilesRejected,
  accept,
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 1,
  multiple = false,
  disabled = false,
  showFileList = true,
  uploadProgress,
  children,
  className,
  ...props
}: FileUploadZoneProps) {
  const [acceptedFiles, setAcceptedFiles] = React.useState<File[]>([])
  const [rejectedFiles, setRejectedFiles] = React.useState<FileRejection[]>([])

  const onDrop = React.useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      setAcceptedFiles(accepted)
      setRejectedFiles(rejected)

      if (accepted.length > 0) {
        onFilesAccepted(accepted)
      }

      if (rejected.length > 0 && onFilesRejected) {
        onFilesRejected(rejected)
      }
    },
    [onFilesAccepted, onFilesRejected]
  )

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
  } = useDropzone({
    onDrop,
    accept,
    maxSize,
    maxFiles,
    multiple,
    disabled,
  })

  const removeFile = (index: number) => {
    setAcceptedFiles((files) => files.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i]
  }

  return (
    <div
      data-slot="file-upload-zone"
      className={cn("space-y-4", className)}
      {...props}
    >
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer",
          "hover:border-primary hover:bg-accent/50",
          isDragActive && "border-primary bg-accent/50",
          isDragAccept && "border-green-500 bg-green-50 dark:bg-green-950",
          isDragReject && "border-red-500 bg-red-50 dark:bg-red-950",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          !isDragActive && "border-border bg-background"
        )}
        role="button"
        aria-label="File upload drop zone"
        tabIndex={0}
      >
        <input {...getInputProps()} aria-label="File upload input" />

        {children || (
          <>
            <div className="rounded-full bg-primary/10 p-4">
              <Upload
                className={cn(
                  "h-8 w-8 text-primary transition-transform",
                  isDragActive && "scale-110"
                )}
                aria-hidden="true"
              />
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm font-medium">
                {isDragActive
                  ? "Drop files here"
                  : "Drag and drop files here, or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground">
                {accept
                  ? `Accepted: ${Object.values(accept).flat().join(", ")}`
                  : "All file types accepted"}
                {" "}• Max size: {formatFileSize(maxSize)}
                {multiple && ` • Max files: ${maxFiles}`}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Upload Progress */}
      {uploadProgress !== undefined && uploadProgress > 0 && uploadProgress < 100 && (
        <Progress
          value={uploadProgress}
          showPercentage
          label="Uploading..."
          variant="default"
        />
      )}

      {/* Accepted Files List */}
      {showFileList && acceptedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Uploaded Files</h4>
          <div className="space-y-2">
            {acceptedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 rounded-lg border bg-card p-3"
              >
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejected Files List */}
      {rejectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-destructive">Rejected Files</h4>
          <div className="space-y-2">
            {rejectedFiles.map(({ file, errors }, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-start gap-3 rounded-lg border border-destructive bg-destructive/5 p-3"
              >
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <ul className="text-xs text-destructive space-y-1 mt-1">
                    {errors.map((error) => (
                      <li key={error.code}>
                        {error.code === "file-too-large"
                          ? `File is too large. Max size: ${formatFileSize(maxSize)}`
                          : error.code === "file-invalid-type"
                          ? "Invalid file type"
                          : error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * FileUploadButton component for a simple upload button (no drag-drop).
 */
export interface FileUploadButtonProps {
  /**
   * Callback when files are selected
   */
  onFilesSelected: (files: File[]) => void
  /**
   * Button label
   */
  label?: string
  /**
   * Button variant
   */
  variant?: "default" | "secondary" | "outline" | "ghost"
  /**
   * Accepted file types
   */
  accept?: string
  /**
   * Allow multiple files
   */
  multiple?: boolean
  /**
   * Disable the button
   */
  disabled?: boolean
}

/**
 * FileUploadButton component for simple file uploads.
 *
 * @example
 * <FileUploadButton
 *   label="Upload PDF"
 *   accept=".pdf"
 *   onFilesSelected={handleFiles}
 * />
 */
function FileUploadButton({
  onFilesSelected,
  label = "Upload Files",
  variant = "default",
  accept,
  multiple = false,
  disabled = false,
}: FileUploadButtonProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length > 0) {
      onFilesSelected(files)
    }
    // Reset input to allow uploading the same file again
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="sr-only"
        aria-label="File input"
      />
      <Button
        variant={variant}
        onClick={handleClick}
        disabled={disabled}
        aria-label={label}
      >
        <Upload className="mr-2 h-4 w-4" />
        {label}
      </Button>
    </>
  )
}

export { FileUploadZone, FileUploadButton }
