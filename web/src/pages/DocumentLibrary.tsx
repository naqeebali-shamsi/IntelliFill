import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  FileText,
  Download,
  Trash2,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Files
} from 'lucide-react'
import api from '@/services/api'
import { toast } from 'sonner'

interface Document {
  id: string
  fileName: string
  fileType: string
  status: 'completed' | 'failed' | 'processing' | 'pending'
  createdAt: string
  fileSize?: number
  pageCount?: number
}

export default function DocumentLibrary() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const response = await api.get('/documents')
      setDocuments(response.data.documents || [])
    } catch (error) {
      console.error('Failed to load documents:', error)
      toast.error('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (documentId: string, fileName: string) => {
    try {
      const response = await api.get(`/documents/${documentId}/download`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Document downloaded successfully')
    } catch (error) {
      console.error('Download failed:', error)
      toast.error('Failed to download document')
    }
  }

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      await api.delete(`/documents/${documentId}`)
      setDocuments(documents.filter(doc => doc.id !== documentId))
      toast.success('Document deleted successfully')
    } catch (error) {
      console.error('Delete failed:', error)
      toast.error('Failed to delete document')
    }
  }

  const getStatusIcon = (status: Document['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
    }
  }

  const getStatusBadge = (status: Document['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700">Completed</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-700">Processing</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const filteredDocuments = documents.filter(doc =>
    doc.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Document Library</h1>
        <p className="text-muted-foreground">
          View, download, and manage your processed documents
        </p>
      </div>

      {/* Stats Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
          <Files className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{documents.length}</div>
          <p className="text-xs text-muted-foreground">
            {filteredDocuments.length} {searchTerm ? 'matching search' : 'documents'}
          </p>
        </CardContent>
      </Card>

      {/* Search Bar */}
      <Card>
        <CardHeader>
          <CardTitle>Search Documents</CardTitle>
          <CardDescription>Filter by file name</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by file name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Grid */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading documents...</span>
          </CardContent>
        </Card>
      ) : filteredDocuments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchTerm ? 'No documents match your search' : 'No documents found'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDocuments.map((doc) => (
            <Card key={doc.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base truncate">{doc.fileName}</CardTitle>
                  </div>
                </div>
                <CardDescription className="flex items-center gap-2 mt-2">
                  {getStatusIcon(doc.status)}
                  {getStatusBadge(doc.status)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-medium">{doc.fileType.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span className="font-medium">{formatDate(doc.createdAt)}</span>
                  </div>
                  {doc.pageCount && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pages:</span>
                      <span className="font-medium">{doc.pageCount}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleDownload(doc.id, doc.fileName)}
                    disabled={doc.status !== 'completed'}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(doc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
