/**
 * KnowledgeBase page - Document knowledge management and semantic search
 * Features: Upload documents, search knowledge base, view document sources
 * @module pages/KnowledgeBase
 */

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/features/stat-card';
import { ResponsiveGrid } from '@/components/layout/responsive-grid';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Upload,
  Search,
  FileText,
  Trash2,
  RefreshCw,
  Database,
  BookOpen,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronRight,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import {
  useKnowledgeStore,
  useKnowledgeSources,
  useKnowledgeSourcesLoading,
  useKnowledgeSourcesError,
  useKnowledgeStats,
  useKnowledgeStatsLoading,
  useUploadProgress,
  useUploadLoading,
} from '@/stores/knowledgeStore';
import { SearchInterface } from '@/components/knowledge/SearchInterface';
import { formatFileSize } from '@/utils/fileValidation';
import { format } from 'date-fns';

// ============================================================================
// Helper Components
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    PENDING: {
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      icon: <Clock className="h-3 w-3" />,
      label: 'Pending',
    },
    PROCESSING: {
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: 'Processing',
    },
    COMPLETED: {
      color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      icon: <CheckCircle className="h-3 w-3" />,
      label: 'Completed',
    },
    FAILED: {
      color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      icon: <XCircle className="h-3 w-3" />,
      label: 'Failed',
    },
  };

  const variant = variants[status] || variants.PENDING;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${variant.color}`}
    >
      {variant.icon}
      {variant.label}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function KnowledgeBase() {
  const navigate = useNavigate();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Store state
  const sources = useKnowledgeSources();
  const sourcesLoading = useKnowledgeSourcesLoading();
  const sourcesError = useKnowledgeSourcesError();
  const stats = useKnowledgeStats();
  const statsLoading = useKnowledgeStatsLoading();
  const uploadProgress = useUploadProgress();
  const uploadLoading = useUploadLoading();

  // Store actions
  const { fetchSources, fetchStats, uploadSource, deleteSource, refreshSourcesBatch } =
    useKnowledgeStore();

  // Local state
  const [activeTab, setActiveTab] = React.useState('sources');
  const [searchFilter, setSearchFilter] = React.useState('');
  const debouncedFilter = useDebouncedValue(searchFilter, 300); // 300ms debounce for filtering
  const [deleteSourceId, setDeleteSourceId] = React.useState<string | null>(null);

  // Fetch data on mount
  React.useEffect(() => {
    fetchSources();
    fetchStats();
  }, [fetchSources, fetchStats]);

  // Filtered sources (uses debounced filter to reduce computations during typing)
  const filteredSources = React.useMemo(() => {
    if (!debouncedFilter) return sources;
    const lower = debouncedFilter.toLowerCase();
    return sources.filter(
      (s) => s.title.toLowerCase().includes(lower) || s.filename.toLowerCase().includes(lower)
    );
  }, [sources, debouncedFilter]);

  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Generate title from filename (without extension)
    const title = file.name.replace(/\.[^/.]+$/, '');

    const result = await uploadSource(file, title);
    if (result) {
      toast.success('Document uploaded successfully', {
        description: 'Processing will begin shortly.',
      });
    } else {
      toast.error('Upload failed', {
        description: 'Please try again.',
      });
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteSourceId) return;

    const success = await deleteSource(deleteSourceId);
    if (success) {
      toast.success('Document deleted');
    } else {
      toast.error('Failed to delete document');
    }
    setDeleteSourceId(null);
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchSources();
    fetchStats();
    toast.success('Knowledge base refreshed');
  };

  // Memoize processing IDs to avoid recalculating on every render
  const processingIds = React.useMemo(
    () =>
      sources.filter((s) => s.status === 'PROCESSING' || s.status === 'PENDING').map((s) => s.id),
    [sources]
  );

  // Poll for processing status with batch refresh and jitter
  // Jitter prevents thundering herd when multiple tabs are open
  React.useEffect(() => {
    if (processingIds.length === 0) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = () => {
      refreshSourcesBatch(processingIds);
      // Add ±20% jitter to base 5s interval (4-6 seconds)
      const jitter = 5000 * 0.2 * (Math.random() * 2 - 1);
      const delay = Math.round(5000 + jitter);
      timeoutId = setTimeout(poll, delay);
    };

    // Start polling
    poll();

    return () => clearTimeout(timeoutId);
  }, [processingIds, refreshSourcesBatch]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Knowledge Base"
        description="Upload documents to build your searchable knowledge base for intelligent form filling"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Knowledge Base' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={sourcesLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${sourcesLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploadLoading}>
              {uploadLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading... {uploadProgress}%
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.doc,.txt,.csv"
              onChange={handleFileChange}
            />
          </div>
        }
      />

      {/* Statistics */}
      <ResponsiveGrid preset="stats">
        <StatCard
          title="Total Documents"
          value={stats?.totalSources || 0}
          icon={FileText}
          description="Uploaded to knowledge base"
          loading={statsLoading}
          data-testid="stat-card-knowledge-1"
        />
        <StatCard
          title="Total Chunks"
          value={stats?.totalChunks?.toLocaleString() || 0}
          icon={Database}
          description="Searchable text segments"
          loading={statsLoading}
          data-testid="stat-card-knowledge-2"
        />
        <StatCard
          title="Completed"
          value={stats?.statusBreakdown?.COMPLETED || 0}
          icon={CheckCircle}
          description="Ready for search"
          loading={statsLoading}
          variant="success"
          data-testid="stat-card-knowledge-3"
        />
        <StatCard
          title="Embedding Quota"
          value={stats?.embeddingQuota?.toLocaleString() || 0}
          icon={Sparkles}
          description="Remaining today"
          loading={statsLoading}
          data-testid="stat-card-knowledge-4"
        />
      </ResponsiveGrid>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sources" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Document Sources
          </TabsTrigger>
          <TabsTrigger value="search" className="gap-2">
            <Search className="h-4 w-4" />
            Search
          </TabsTrigger>
        </TabsList>

        {/* Document Sources Tab */}
        <TabsContent value="sources" className="space-y-4">
          {/* Search Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter documents..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Document List */}
          {sourcesError ? (
            <EmptyState
              title="Failed to load documents"
              description={sourcesError}
              action={{
                label: 'Try Again',
                onClick: () => fetchSources(),
              }}
            />
          ) : filteredSources.length === 0 && !sourcesLoading ? (
            <EmptyState
              title={searchFilter ? 'No documents match your filter' : 'No documents yet'}
              description={
                searchFilter
                  ? 'Try adjusting your search'
                  : 'Upload documents to build your knowledge base'
              }
              action={
                searchFilter
                  ? {
                      label: 'Clear Filter',
                      onClick: () => setSearchFilter(''),
                    }
                  : {
                      label: 'Upload Document',
                      onClick: () => fileInputRef.current?.click(),
                      icon: Upload,
                    }
              }
            />
          ) : (
            <div className="space-y-3">
              {sourcesLoading && sources.length === 0
                ? // Loading skeletons
                  Array.from({ length: 5 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Skeleton className="h-10 w-10 rounded" />
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-48" />
                              <Skeleton className="h-3 w-32" />
                            </div>
                          </div>
                          <Skeleton className="h-6 w-20" />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                : filteredSources.map((source) => (
                    <Card key={source.id} className="hover:bg-muted/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-primary/10">
                              <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-medium">{source.title}</h3>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span>{source.filename}</span>
                                <span>|</span>
                                <span>{formatFileSize(source.fileSize)}</span>
                                <span>|</span>
                                <span>{format(new Date(source.createdAt), 'MMM d, yyyy')}</span>
                                {source.chunkCount > 0 && (
                                  <>
                                    <span>|</span>
                                    <span>{source.chunkCount} chunks</span>
                                  </>
                                )}
                              </div>
                              {source.status === 'PROCESSING' && (
                                <Progress className="h-1 w-48 mt-2" value={undefined} />
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <StatusBadge status={source.status} />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteSourceId(source.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Document</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{source.title}"? This will
                                    remove all associated chunks and embeddings. This action cannot
                                    be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setDeleteSourceId(null)}>
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={handleDelete}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
            </div>
          )}
        </TabsContent>

        {/* Search Tab */}
        <TabsContent value="search">
          <SearchInterface />
        </TabsContent>
      </Tabs>
    </div>
  );
}
