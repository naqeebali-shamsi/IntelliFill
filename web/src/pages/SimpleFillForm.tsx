import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { FileUp, Download, Loader2, FileText, CheckCircle } from 'lucide-react'
import api from '@/services/api'
import { toast } from 'sonner'

interface Document {
  id: string
  fileName: string
  status: string
  extractedData?: Record<string, any>
  createdAt: string
}

interface FillResult {
  documentId: string
  downloadUrl: string
  confidence: number
  filledFields: number
}

export default function SimpleFillForm() {
  const [blankForm, setBlankForm] = useState<File | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [filling, setFilling] = useState(false)
  const [result, setResult] = useState<FillResult | null>(null)

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const response = await api.get('/documents?status=COMPLETED')
      setDocuments(response.data.documents || [])
    } catch (error) {
      console.error('Failed to load documents:', error)
      toast.error('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const handleFormUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file')
        return
      }
      setBlankForm(file)
      setResult(null)
      toast.success(`Form uploaded: ${file.name}`)
    }
  }

  const handleFillForm = async (docId: string) => {
    if (!blankForm) return

    try {
      setFilling(true)
      const formData = new FormData()
      formData.append('form', blankForm)

      const response = await api.post(`/documents/${docId}/fill`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setResult(response.data)
      toast.success('Form filled successfully!')
    } catch (error: any) {
      console.error('Form filling failed:', error)
      toast.error(error.response?.data?.error || 'Failed to fill form')
    } finally {
      setFilling(false)
    }
  }

  const getDataPreview = (data: Record<string, any> | undefined) => {
    if (!data) return 'No data available'
    const entries = Object.entries(data).slice(0, 3)
    return entries.map(([key, value]) => `${key}: ${value}`).join(', ')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Fill Form</h1>
        <p className="text-muted-foreground">
          Upload a blank form and select a source document to auto-fill
        </p>
      </div>

      {/* Step 1: Upload blank form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Step 1: Upload Blank Form
          </CardTitle>
          <CardDescription>Select a PDF form to fill</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="form-upload">Blank Form (PDF)</Label>
              <Input
                id="form-upload"
                type="file"
                accept=".pdf"
                onChange={handleFormUpload}
              />
            </div>
            {blankForm && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{blankForm.name}</span>
                <Badge variant="outline" className="ml-auto">Ready</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Select source document */}
      {blankForm && !result && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Select Source Document</CardTitle>
            <CardDescription>Choose which document data to use for filling</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading documents...</span>
              </div>
            ) : documents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No completed documents found. Please upload and process documents first.
              </p>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <Card key={doc.id} className="hover:bg-muted/50 transition-colors">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <h3 className="font-medium truncate">{doc.fileName}</h3>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {getDataPreview(doc.extractedData)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleFillForm(doc.id)}
                          disabled={filling}
                          size="sm"
                        >
                          {filling ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Filling...
                            </>
                          ) : (
                            'Use This Data'
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Result: Download link */}
      {result && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              Form Filled Successfully
            </CardTitle>
            <CardDescription>Your filled form is ready to download</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Confidence:</span>
                <span className="ml-2 font-medium">{(result.confidence * 100).toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Fields Filled:</span>
                <span className="ml-2 font-medium">{result.filledFields}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild className="flex-1">
                <a href={result.downloadUrl} download>
                  <Download className="h-4 w-4 mr-2" />
                  Download Filled Form
                </a>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null)
                  setBlankForm(null)
                }}
              >
                Fill Another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
