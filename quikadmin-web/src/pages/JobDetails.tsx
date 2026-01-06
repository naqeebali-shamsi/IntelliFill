import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Hash,
  Layers,
  Activity,
  Terminal,
  Inbox,
} from 'lucide-react';
import { getJob, ProcessingJob } from '@/services/api';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

interface JobData extends ProcessingJob {
  startedAt?: string;
  failedAt?: string;
  metadata?: any;
  documentsCount?: number;
  processingHistory?: Array<{
    id: string;
    status: string;
    createdAt: string;
    completedAt?: string;
    error?: string;
  }>;
}

export default function JobDetails() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
    }
  }, [jobId]);

  const fetchJobDetails = async () => {
    if (!jobId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getJob(jobId);
      setJob(data);
    } catch (err) {
      console.error('Failed to fetch job details:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch job details');
      setJob(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-status-success" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-status-error" />;
      case 'processing':
        return <RefreshCw className="h-5 w-5 text-status-pending animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-status-warning" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-success-light text-success-foreground border-success-border">
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-error-light text-error-foreground border-error-border">Failed</Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-info-light text-info-foreground border-info-border">
            Processing
          </Badge>
        );
      default:
        return (
          <Badge className="bg-warning-light text-warning-foreground border-warning-border">
            Pending
          </Badge>
        );
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'PPpp');
    } catch {
      return dateString;
    }
  };

  const formatRelativeDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  const calculateDuration = () => {
    if (!job?.startedAt || !job?.completedAt) return 'N/A';
    try {
      const start = new Date(job.startedAt).getTime();
      const end = new Date(job.completedAt).getTime();
      const durationMs = end - start;
      if (durationMs < 1000) return `${durationMs}ms`;
      if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
      return `${(durationMs / 60000).toFixed(1)}m`;
    } catch {
      return 'N/A';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/history')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Job Details</h1>
            <p className="text-muted-foreground">Job ID: {jobId}</p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Inbox className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-lg mb-1">Job not found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {error || 'The job you are looking for does not exist or has been deleted.'}
          </p>
          <Button onClick={() => navigate('/history')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to History
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/history')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Job Details</h1>
            <p className="text-muted-foreground font-mono text-sm">{jobId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon(job.status)}
          {getStatusBadge(job.status)}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Type</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold capitalize">
              {job.type?.replace(/_/g, ' ') || 'Processing'}
            </div>
            <p className="text-xs text-muted-foreground">Job type</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{job.documentsCount || 1}</div>
            <p className="text-xs text-muted-foreground">Document(s) processed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{calculateDuration()}</div>
            <p className="text-xs text-muted-foreground">Processing time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{job.progress}%</div>
            <p className="text-xs text-muted-foreground">Completion</p>
          </CardContent>
        </Card>
      </div>

      {/* Error Alert */}
      {job.status === 'failed' && job.error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Processing Failed</AlertTitle>
          <AlertDescription>{job.error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          {job.result && <TabsTrigger value="result">Result</TabsTrigger>}
          {job.processingHistory && job.processingHistory.length > 0 && (
            <TabsTrigger value="history">Processing History</TabsTrigger>
          )}
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Job Information</CardTitle>
              <CardDescription>Complete details about this processing job</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Job ID:</span>
                    <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
                      {job.id}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(job.id)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Status:</span>
                    {getStatusBadge(job.status)}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Type:</span>
                    <span className="capitalize">
                      {job.type?.replace(/_/g, ' ') || 'Processing'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Documents:</span>
                    <span>{job.documentsCount || 1}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Created:</span>
                    <span>{formatDate(job.createdAt)}</span>
                  </div>
                  {job.startedAt && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Started:</span>
                      <span>{formatDate(job.startedAt)}</span>
                    </div>
                  )}
                  {job.completedAt && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Completed:</span>
                      <span>{formatDate(job.completedAt)}</span>
                    </div>
                  )}
                  {job.failedAt && (
                    <div className="flex items-center gap-2 text-sm">
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Failed:</span>
                      <span>{formatDate(job.failedAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Result Tab */}
        {job.result && (
          <TabsContent value="result" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Processing Result</CardTitle>
                    <CardDescription>Output data from the job</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(JSON.stringify(job.result, null, 2))}
                    >
                      <Copy className="mr-2 h-3 w-3" />
                      Copy JSON
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                  <pre className="font-mono text-sm">{JSON.stringify(job.result, null, 2)}</pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Processing History Tab */}
        {job.processingHistory && job.processingHistory.length > 0 && (
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Processing History</CardTitle>
                <CardDescription>Timeline of processing attempts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {job.processingHistory.map((item, index) => (
                    <div key={item.id || index} className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        {item.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5 text-status-success" />
                        ) : item.status === 'failed' ? (
                          <XCircle className="h-5 w-5 text-status-error" />
                        ) : (
                          <Clock className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium capitalize">{item.status}</p>
                          <span className="text-sm text-muted-foreground">
                            {formatRelativeDate(item.createdAt)}
                          </span>
                        </div>
                        {item.error && (
                          <p className="text-sm text-status-error mt-1">{item.error}</p>
                        )}
                        {index < job.processingHistory!.length - 1 && (
                          <div className="ml-5 mt-2 h-8 w-px bg-border" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Metadata Tab */}
        <TabsContent value="metadata" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Job Metadata</CardTitle>
              <CardDescription>Additional information about this job</CardDescription>
            </CardHeader>
            <CardContent>
              {job.metadata ? (
                <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                  <pre className="font-mono text-sm">{JSON.stringify(job.metadata, null, 2)}</pre>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Terminal className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No metadata available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Actions</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>You can perform the following actions on this job:</p>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={fetchJobDetails} disabled={loading}>
                  <RefreshCw className={`mr-2 h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate('/history')}>
                  <ArrowLeft className="mr-2 h-3 w-3" />
                  Back to History
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}
