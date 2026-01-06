/**
 * ConnectedDashboard - Main overview for PRO agencies
 * Redesigned with "Deep Ocean" aesthetic
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CardDescription, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  FileText,
  Upload,
  CheckCircle,
  AlertCircle,
  ArrowUpRight,
  Eye,
  FolderOpen,
  RefreshCw,
  Inbox,
  Sparkles,
  Zap,
  Activity,
} from 'lucide-react';
import { useStatistics, useJobs, useTemplates, useQueueMetrics } from '@/hooks/useApiData';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/features/status-badge';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { StatCard } from '@/components/features/stat-card';
import { ResponsiveGrid } from '@/components/layout/responsive-grid';
import { SleekIconButton, SleekBadge, AccentLine } from '@/components';

export default function ConnectedDashboard() {
  const navigate = useNavigate();
  const { data: statistics, loading: statsLoading } = useStatistics();
  const { jobs, loading: jobsLoading } = useJobs(5);
  const { templates, loading: templatesLoading } = useTemplates();
  const { metrics: queueMetrics, loading: queueLoading } = useQueueMetrics();

  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (queueMetrics) {
      const total = queueMetrics.waiting + queueMetrics.active;
      const completed = queueMetrics.active;
      const percentage = total > 0 ? (completed / total) * 100 : 0;
      setProgress(percentage);
    }
  }, [queueMetrics]);

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Helper to format trend change text
  const formatTrendDescription = (change: number | undefined, trend: string | undefined) => {
    const changeVal = change || 0;
    const trendDir = trend || 'up';
    const prefix = changeVal > 0 ? '+' : '';
    const trendIcon = trendDir === 'up' ? '\u2191' : '\u2193';
    return `${trendIcon} ${prefix}${changeVal}% vs last week`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-semibold tracking-tight text-foreground">
            {getGreeting()}, <span className="text-primary">Team</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening with your documents today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            disabled={statsLoading}
            className="border-border/50 hover:bg-secondary/20"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', statsLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            onClick={() => navigate('/upload')}
            className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
          >
            <Upload className="mr-2 h-4 w-4" /> Upload New
          </Button>
        </div>
      </div>

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
        {/* Stats Grid */}
        <ResponsiveGrid preset="stats">
          <StatCard
            title="Total Documents"
            value={statistics?.trends?.documents?.value || 0}
            description={formatTrendDescription(
              statistics?.trends?.documents?.change,
              statistics?.trends?.documents?.trend
            )}
            icon={FileText}
            variant="default"
            loading={statsLoading}
            animationDelay={0}
            data-testid="stat-card-dashboard-1"
          />
          <StatCard
            title="Processed Today"
            value={statistics?.trends?.processedToday?.value || 0}
            description={formatTrendDescription(
              statistics?.trends?.processedToday?.change,
              statistics?.trends?.processedToday?.trend
            )}
            icon={CheckCircle}
            variant="success"
            loading={statsLoading}
            animationDelay={0.1}
            data-testid="stat-card-dashboard-2"
          />
          <StatCard
            title="In Progress"
            value={statistics?.trends?.inProgress?.value || 0}
            description={formatTrendDescription(
              statistics?.trends?.inProgress?.change,
              statistics?.trends?.inProgress?.trend
            )}
            icon={Sparkles}
            variant="warning"
            loading={statsLoading}
            animationDelay={0.2}
            data-testid="stat-card-dashboard-3"
          />
          <StatCard
            title="Failed"
            value={statistics?.trends?.failed?.value || 0}
            description={formatTrendDescription(
              statistics?.trends?.failed?.change,
              statistics?.trends?.failed?.trend
            )}
            icon={AlertCircle}
            variant="error"
            loading={statsLoading}
            animationDelay={0.3}
            data-testid="stat-card-dashboard-4"
          />
        </ResponsiveGrid>

        {/* Main Content Grid */}
        <ResponsiveGrid preset="sidebar">
          {/* Recent Documents */}
          <motion.div
            variants={fadeInUp}
            className="glass-panel rounded-xl overflow-hidden flex flex-col h-full border border-white/10"
          >
            <div className="p-6 border-b border-border/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Documents</CardTitle>
                <CardDescription>Latest processing activity</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/history')}
                className="text-xs text-primary hover:text-primary/80"
              >
                View All History <ArrowUpRight className="ml-1 h-3 w-3" />
              </Button>
            </div>

            <div className="p-0 flex-1">
              {jobsLoading ? (
                <div className="space-y-4 p-6">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 w-full bg-muted/20 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : jobs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                  <Inbox className="h-12 w-12 opacity-20 mb-4" />
                  <p>No recent documents</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center gap-4 p-4 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors group"
                    >
                      <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-background border border-white/10 shrink-0">
                        <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate text-foreground">
                            {job.type?.replace(/_/g, ' ') || 'Processing'}
                          </span>
                          <StatusBadge status={job.status as any} size="sm" />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="font-mono">{job.id.slice(0, 8)}</span>
                          <span>•</span>
                          <span>{formatDate(job.createdAt)}</span>
                        </div>
                      </div>
                      <SleekIconButton
                        variant="ghost"
                        size="sm"
                        aria-label={`View job ${job.id}`}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => navigate(`/job/${job.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </SleekIconButton>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Right Column: Processing & Quick Actions */}
          <motion.div variants={fadeInUp} className="space-y-6">
            {/* Processing Queue Widget */}
            <div className="glass-card p-6 rounded-xl border border-white/10 relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <AccentLine variant="active" size="sm" animate delay={0.2} />
                  <h3 className="font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" /> Processing Queue
                  </h3>
                  <SleekBadge variant="subtle" size="sm" showDot dotPulse dotVariant="active">
                    Live
                  </SleekBadge>
                </div>

                {queueLoading ? (
                  <div className="h-20 bg-muted/20 animate-pulse rounded" />
                ) : (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-muted-foreground">Active Jobs</span>
                        <span className="font-medium">
                          {queueMetrics?.active || 0} /{' '}
                          {(queueMetrics?.waiting || 0) + (queueMetrics?.active || 0)}
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Avg Time</p>
                        <p className="font-medium text-lg font-mono">
                          {statistics?.averageProcessingTime || '0'}m
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Success Rate</p>
                        <p className="font-medium text-lg font-mono text-success">
                          {statistics?.successRate || '0'}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="absolute top-0 right-0 h-32 w-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            </div>

            {/* Quick Actions */}
            <div className="glass-panel p-6 rounded-xl border border-white/10">
              <h3 className="font-medium flex items-center gap-2 mb-4">
                <Zap className="h-4 w-4 text-warning" /> Quick Actions
              </h3>
              <div className="grid gap-3">
                <Button
                  variant="outline"
                  className="justify-start h-auto py-3 bg-background/50 border-white/5 hover:bg-background hover:border-primary/20 group"
                  onClick={() => navigate('/upload')}
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mr-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Upload className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">Upload Document</div>
                    <div className="text-[10px] text-muted-foreground">
                      Start new processing job
                    </div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="justify-start h-auto py-3 bg-background/50 border-white/5 hover:bg-background hover:border-primary/20 group"
                  onClick={() => navigate('/templates')}
                >
                  <div className="h-8 w-8 rounded-full bg-info-light text-info flex items-center justify-center mr-3 group-hover:bg-info group-hover:text-info-foreground transition-colors">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">Create Template</div>
                    <div className="text-[10px] text-muted-foreground">
                      Setup reusable form mapping
                    </div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="justify-start h-auto py-3 bg-background/50 border-white/5 hover:bg-background hover:border-primary/20 group"
                  onClick={() => navigate('/documents')}
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mr-3 group-hover:bg-primary group-hover:text-white transition-colors">
                    <FolderOpen className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">Browse Library</div>
                    <div className="text-[10px] text-muted-foreground">
                      Access all processed files
                    </div>
                  </div>
                </Button>
              </div>
            </div>
          </motion.div>
        </ResponsiveGrid>
      </motion.div>
    </div>
  );
}
