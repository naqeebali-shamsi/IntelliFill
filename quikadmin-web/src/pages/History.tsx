/**
 * History page - Processed jobs history
 * Redesigned with "Deep Ocean" aesthetic
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Eye,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Inbox,
  Upload,
  Calendar,
  Filter,
} from 'lucide-react';
import { getJobs, getStatistics, Statistics } from '@/services/api';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { staggerContainerFast, fadeInUpSubtle } from '@/lib/animations';
import { StatCard } from '@/components/features/stat-card';
import { ResponsiveGrid } from '@/components/layout/responsive-grid';

interface HistoryItem {
  id: string;
  type: string;
  status: 'completed' | 'failed' | 'processing' | 'pending';
  createdAt: string;
  completedAt?: string;
  documentsCount?: number;
  progress: number;
}

export default function History() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
    fetchStats();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await getJobs();
      const jobsArray = Array.isArray(data) ? data : data.jobs || [];
      setHistory(jobsArray);
    } catch (err) {
      console.error('Failed to fetch history:', err);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const data = await getStatistics();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch statistics:', err);
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const getStatusConfig = (status: HistoryItem['status']) => {
    switch (status) {
      case 'completed':
        return {
          icon: CheckCircle,
          color: 'text-emerald-500',
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/20',
        };
      case 'failed':
        return {
          icon: XCircle,
          color: 'text-red-500',
          bg: 'bg-red-500/10',
          border: 'border-red-500/20',
        };
      case 'processing':
        return {
          icon: RefreshCw,
          color: 'text-blue-500',
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/20',
          animate: true,
        };
      case 'pending':
        return {
          icon: Clock,
          color: 'text-amber-500',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/20',
        };
      default:
        return {
          icon: Clock,
          color: 'text-muted-foreground',
          bg: 'bg-muted/10',
          border: 'border-border',
        };
    }
  };

  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      item.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Processing History"
        description="Track the status of your document processing jobs"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'History' }]}
        actions={
          <Button
            onClick={() => {
              fetchHistory();
              fetchStats();
            }}
            variant="outline"
            size="sm"
            disabled={loading}
            className="border-border/50 hover:bg-secondary/20"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Refresh Data
          </Button>
        }
      />

      {/* Stats Cards */}
      <ResponsiveGrid preset="stats">
        <StatCard
          title="Total Processed"
          value={stats?.totalJobs || 0}
          icon={FileText}
          description="All time jobs"
          loading={statsLoading}
          data-testid="stat-card-history-1"
        />
        <StatCard
          title="Success Rate"
          value={`${stats?.successRate || 0}%`}
          icon={CheckCircle}
          description={`${stats?.completedJobs || 0} completed`}
          variant="success"
          loading={statsLoading}
          data-testid="stat-card-history-2"
        />
        <StatCard
          title="Failed Jobs"
          value={stats?.failedJobs || 0}
          icon={XCircle}
          description="Action needed"
          variant="error"
          loading={statsLoading}
          data-testid="stat-card-history-3"
        />
        <StatCard
          title="Avg. Time"
          value={
            stats?.averageProcessingTime
              ? stats.averageProcessingTime < 60
                ? `${stats.averageProcessingTime.toFixed(1)}s`
                : `${(stats.averageProcessingTime / 60).toFixed(1)}m`
              : '0s'
          }
          icon={Clock}
          description="Per job"
          variant="warning"
          loading={statsLoading}
          data-testid="stat-card-history-4"
        />
      </ResponsiveGrid>

      {/* Filters */}
      <div className="glass-panel p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-center justify-between sticky top-20 z-10">
        <div className="flex-1 w-full sm:max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
          <Input
            placeholder="Search by Job ID or Type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-background/50 border-white/10 focus:bg-background transition-all"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px] border-none bg-transparent hover:bg-secondary/10">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All statuses" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* History List */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 w-full bg-muted/20 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : filteredHistory.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={history.length === 0 ? 'No processing history' : 'No matches found'}
            description={
              history.length === 0
                ? 'Upload a document to start processing.'
                : 'Try adjusting your search filters.'
            }
            action={
              history.length === 0
                ? { label: 'Upload Document', onClick: () => navigate('/upload'), icon: Upload }
                : undefined
            }
          />
        ) : (
          <motion.div
            variants={staggerContainerFast}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-3"
          >
            {filteredHistory.map((item) => {
              const status = getStatusConfig(item.status);
              const StatusIcon = status.icon;

              return (
                <motion.div
                  key={item.id}
                  variants={fadeInUpSubtle}
                  layoutId={item.id}
                  className="group relative overflow-hidden rounded-xl border border-white/5 bg-card/40 backdrop-blur-sm p-4 hover:bg-card/60 transition-all hover:border-primary/10 hover:shadow-lg hover:shadow-primary/5 cursor-pointer"
                  onClick={() => navigate(`/job/${item.id}`)}
                >
                  <div className="flex items-center gap-4">
                    {/* Status Icon */}
                    <div
                      className={cn(
                        'h-10 w-10 flex items-center justify-center rounded-lg border',
                        status.bg,
                        status.border,
                        status.color
                      )}
                    >
                      <StatusIcon
                        className={cn('h-5 w-5', item.status === 'processing' && 'animate-spin')}
                      />
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      <div className="col-span-1 md:col-span-1">
                        <h3 className="font-medium text-foreground truncate capitalize">
                          {item.type?.replace(/_/g, ' ') || 'Processing Job'}
                        </h3>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          {item.id.substring(0, 8)}
                        </p>
                      </div>

                      <div className="col-span-1 md:col-span-1 flex items-center gap-2">
                        <div
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full border',
                            status.bg,
                            status.border,
                            status.color,
                            'uppercase font-semibold tracking-wider'
                          )}
                        >
                          {item.status}
                        </div>
                      </div>

                      <div className="col-span-1 md:col-span-1 text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(item.createdAt), 'MMM d, h:mm a')}
                      </div>

                      <div className="col-span-1 md:col-span-1 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          View Details <Eye className="ml-2 h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
