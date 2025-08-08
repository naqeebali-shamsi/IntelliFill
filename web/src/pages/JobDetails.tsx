import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  FileText, 
  Download, 
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertCircle,
  FileCheck,
  Copy,
  ExternalLink,
  Calendar,
  User,
  Hash,
  Layers,
  Activity,
  Terminal
} from 'lucide-react'

interface JobField {
  name: string
  value: string
  confidence: number
  type: string
}

const mockJobData = {
  id: 'job_12345',
  fileName: 'Invoice_Q1_2024.pdf',
  template: 'Invoice Template',
  status: 'completed',
  createdAt: '2024-01-20 14:30:00',
  completedAt: '2024-01-20 14:30:45',
  processingTime: '45 seconds',
  pages: 3,
  fileSize: '2.4 MB',
  owner: 'john.doe@example.com',
  extractedFields: [
    { name: 'Invoice Number', value: 'INV-2024-001', confidence: 0.98, type: 'text' },
    { name: 'Date', value: '2024-01-15', confidence: 0.95, type: 'date' },
    { name: 'Due Date', value: '2024-02-15', confidence: 0.94, type: 'date' },
    { name: 'Customer Name', value: 'Acme Corporation', confidence: 0.97, type: 'text' },
    { name: 'Customer Address', value: '123 Business St, City, State 12345', confidence: 0.92, type: 'text' },
    { name: 'Subtotal', value: '$4,250.00', confidence: 0.99, type: 'currency' },
    { name: 'Tax', value: '$382.50', confidence: 0.98, type: 'currency' },
    { name: 'Total', value: '$4,632.50', confidence: 0.99, type: 'currency' },
    { name: 'Payment Terms', value: 'Net 30', confidence: 0.93, type: 'text' },
    { name: 'PO Number', value: 'PO-8765', confidence: 0.91, type: 'text' },
  ],
  processingSteps: [
    { step: 'File Upload', status: 'completed', timestamp: '14:30:00' },
    { step: 'File Validation', status: 'completed', timestamp: '14:30:02' },
    { step: 'OCR Processing', status: 'completed', timestamp: '14:30:05' },
    { step: 'Template Matching', status: 'completed', timestamp: '14:30:10' },
    { step: 'Field Extraction', status: 'completed', timestamp: '14:30:20' },
    { step: 'Data Validation', status: 'completed', timestamp: '14:30:35' },
    { step: 'Output Generation', status: 'completed', timestamp: '14:30:45' },
  ],
  logs: [
    '[14:30:00] Job initiated - File: Invoice_Q1_2024.pdf',
    '[14:30:02] File validation successful - PDF format confirmed',
    '[14:30:05] OCR processing started - 3 pages detected',
    '[14:30:10] Template matched: Invoice Template (confidence: 0.96)',
    '[14:30:20] Field extraction completed - 10 fields extracted',
    '[14:30:35] Data validation passed - All fields meet quality threshold',
    '[14:30:45] Job completed successfully - Output ready for download',
  ]
}

export default function JobDetails() {
  const { jobId } = useParams()
  const navigate = useNavigate()

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'processing':
        return <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
      default:
        return <Clock className="h-5 w-5 text-yellow-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700">Completed</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-700">Processing</Badge>
      default:
        return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
    }
  }

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.95) {
      return <Badge className="bg-green-100 text-green-700">High</Badge>
    } else if (confidence >= 0.85) {
      return <Badge className="bg-yellow-100 text-yellow-700">Medium</Badge>
    } else {
      return <Badge className="bg-red-100 text-red-700">Low</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/history')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Job Details</h1>
            <p className="text-muted-foreground">Job ID: {jobId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon(mockJobData.status)}
          {getStatusBadge(mockJobData.status)}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Document</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">{mockJobData.fileName}</div>
            <p className="text-xs text-muted-foreground">{mockJobData.fileSize} • {mockJobData.pages} pages</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Template</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{mockJobData.template}</div>
            <p className="text-xs text-muted-foreground">Auto-matched</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{mockJobData.processingTime}</div>
            <p className="text-xs text-muted-foreground">Completed at {mockJobData.completedAt.split(' ')[1]}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fields Extracted</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{mockJobData.extractedFields.length} fields</div>
            <p className="text-xs text-muted-foreground">94% avg confidence</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="extracted" className="space-y-4">
        <TabsList>
          <TabsTrigger value="extracted">Extracted Data</TabsTrigger>
          <TabsTrigger value="processing">Processing Steps</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>

        {/* Extracted Data Tab */}
        <TabsContent value="extracted" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Extracted Fields</CardTitle>
                  <CardDescription>
                    Data extracted from the document with confidence scores
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Copy className="mr-2 h-3 w-3" />
                    Copy JSON
                  </Button>
                  <Button size="sm">
                    <Download className="mr-2 h-3 w-3" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockJobData.extractedFields.map((field, index) => (
                  <div key={index} className="flex items-start justify-between p-4 rounded-lg border">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{field.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {field.type}
                        </Badge>
                      </div>
                      <p className="text-sm font-mono">{field.value}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {(field.confidence * 100).toFixed(0)}%
                      </span>
                      {getConfidenceBadge(field.confidence)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Processing Steps Tab */}
        <TabsContent value="processing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Processing Pipeline</CardTitle>
              <CardDescription>
                Step-by-step execution of the document processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockJobData.processingSteps.map((step, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      {step.status === 'completed' ? (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      ) : (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{step.step}</p>
                        <span className="text-sm text-muted-foreground">{step.timestamp}</span>
                      </div>
                      {index < mockJobData.processingSteps.length - 1 && (
                        <div className="ml-5 mt-2 h-8 w-px bg-border" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Processing Logs</CardTitle>
                  <CardDescription>
                    Detailed execution logs for this job
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-3 w-3" />
                  Download Logs
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                <div className="space-y-2 font-mono text-sm">
                  {mockJobData.logs.map((log, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Terminal className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground break-all">{log}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metadata Tab */}
        <TabsContent value="metadata" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Job Metadata</CardTitle>
              <CardDescription>
                Additional information about this processing job
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Job ID:</span>
                      <span className="font-mono">{mockJobData.id}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Owner:</span>
                      <span>{mockJobData.owner}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Created:</span>
                      <span>{mockJobData.createdAt}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Status:</span>
                      {getStatusBadge(mockJobData.status)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">File:</span>
                      <span>{mockJobData.fileName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Template:</span>
                      <span>{mockJobData.template}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Duration:</span>
                      <span>{mockJobData.processingTime}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <FileCheck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Fields:</span>
                      <span>{mockJobData.extractedFields.length} extracted</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Need help?</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>If you encounter any issues with this job, you can:</p>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm">
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Retry Processing
                </Button>
                <Button variant="outline" size="sm">
                  <ExternalLink className="mr-2 h-3 w-3" />
                  Report Issue
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  )
}