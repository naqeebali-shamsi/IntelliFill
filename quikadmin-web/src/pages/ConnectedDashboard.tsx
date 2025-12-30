/**
 * ConnectedDashboard - Main overview for PRO agencies
 * Redesigned with "Deep Ocean" aesthetic
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  Download,
  Eye,
  Trash2,
  FolderOpen,
  RefreshCw,
  Inbox,
  Sparkles,
  Zap,
  Activity
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useStatistics, useJobs, useTemplates, useQueueMetrics } from '@/hooks/useApiData';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/features/status-badge';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

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
  }

  const stats = statistics
    ? [
        {
          title: 'Total Documents',
          value: statistics.trends?.documents?.value || 0,
          change: `${statistics.trends?.documents?.change > 0 ? '+' : ''}${statistics.trends?.documents?.change || 0}%`,
          trend: statistics.trends?.documents?.trend || 'up',
          icon: FileText,
          color: 'text-primary',
          bg: 'bg-primary/10',
        },
        {
          title: 'Processed Today',
          value: statistics.trends?.processedToday?.value || 0,
          change: `${statistics.trends?.processedToday?.change > 0 ? '+' : ''}${statistics.trends?.processedToday?.change || 0}%`,
          trend: statistics.trends?.processedToday?.trend || 'up',
          icon: CheckCircle,
          color: 'text-green-500',
          bg: 'bg-green-500/10',
        },
        {
          title: 'In Progress',
          value: statistics.trends?.inProgress?.value || 0,
          change: `${statistics.trends?.inProgress?.change > 0 ? '+' : ''}${statistics.trends?.inProgress?.change || 0}%`,
          trend: statistics.trends?.inProgress?.trend || 'down',
          icon: Sparkles,
          color: 'text-amber-500',
          bg: 'bg-amber-500/10',
        },
        {
          title: 'Failed',
          value: statistics.trends?.failed?.value || 0,
          change: `${statistics.trends?.failed?.change > 0 ? '+' : ''}${statistics.trends?.failed?.change || 0}%`,
          trend: statistics.trends?.failed?.trend || 'down',
          icon: AlertCircle,
          color: 'text-red-500',
          bg: 'bg-red-500/10',
        },
      ]
    : [];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl font-heading font-semibold tracking-tight text-foreground">
              {getGreeting()}, <span className="text-primary">Team</span>
           </h1>
           <p className="text-muted-foreground mt-1">Here's what's happening with your documents today.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.location.reload()} disabled={statsLoading} className="border-border/50 hover:bg-secondary/20">
               <RefreshCw className={cn("mr-2 h-4 w-4", statsLoading && "animate-spin")} />
               Refresh
            </Button>
            <Button onClick={() => navigate('/upload')} className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                <Upload className="mr-2 h-4 w-4" /> Upload New
            </Button>
        </div>
      </div>

      <motion.div 
         variants={containerVariants}
         initial="hidden"
         animate="show"
         className="space-y-6"
      >
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statsLoading ? (
               Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-32 rounded-xl bg-muted/20 animate-pulse" />
               ))
            ) : (
                stats.map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                        <motion.div key={i} variants={itemVariants} className="glass-panel p-6 rounded-xl relative overflow-hidden group hover:border-primary/20 transition-colors">
                            <div className="relative z-10 flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                                    <h3 className="text-2xl font-bold font-heading mt-2">{stat.value}</h3>
                                </div>
                                <div className={cn("p-2 rounded-lg", stat.bg)}>
                                    <Icon className={cn("h-5 w-5", stat.color)} />
                                </div>
                            </div>
                            
                            <div className="relative z-10 flex items-center mt-4 text-xs font-medium">
                                {stat.trend === 'up' ? (
                                    <div className="flex items-center text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded mr-2">
                                        <ArrowUpRight className="h-3 w-3 mr-1" /> {stat.change}
                                    </div>
                                ) : (
                                    <div className="flex items-center text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded mr-2">
                                        <ArrowDownRight className="h-3 w-3 mr-1" /> {stat.change}
                                    </div>
                                )}
                                <span className="text-muted-foreground/60">processed vs last week</span>
                            </div>
                             
                            {/* Decorative gradient blob */}
                            <div className={cn("absolute -bottom-4 -right-4 h-24 w-24 rounded-full blur-2xl opacity-20 pointer-events-none group-hover:opacity-30 transition-opacity", stat.bg.replace('/10', ''))} />
                        </motion.div>
                    );
                })
            )}
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
            {/* Recent Documents */}
            <motion.div variants={itemVariants} className="lg:col-span-2 glass-panel rounded-xl overflow-hidden flex flex-col h-full border border-white/10">
                <div className="p-6 border-b border-border/50 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">Recent Documents</CardTitle>
                        <CardDescription>Latest processing activity</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/history')} className="text-xs text-primary hover:text-primary/80">
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
                                <div key={job.id} className="flex items-center gap-4 p-4 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors group">
                                     <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-background border border-white/10 shrink-0">
                                         <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                     </div>
                                     <div className="flex-1 min-w-0">
                                         <div className="flex items-center gap-2">
                                             <span className="font-medium truncate text-foreground">{job.type?.replace(/_/g, ' ') || 'Processing'}</span>
                                             <StatusBadge status={job.status as any} size="sm" />
                                         </div>
                                         <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                             <span className="font-mono">{job.id.slice(0, 8)}</span>
                                             <span>•</span>
                                             <span>{formatDate(job.createdAt)}</span>
                                         </div>
                                     </div>
                                     <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => navigate(`/job/${job.id}`)}>
                                         <Eye className="h-4 w-4" />
                                     </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Right Column: Processing & Quick Actions */}
            <motion.div variants={itemVariants} className="space-y-6">
                {/* Processing Queue Widget */}
                <div className="glass-card p-6 rounded-xl border border-white/10 relative overflow-hidden">
                     <div className="relative z-10">
                        <h3 className="font-medium flex items-center gap-2 mb-4">
                            <Activity className="h-4 w-4 text-primary" /> Processing Queue
                        </h3>
                        
                        {queueLoading ? (
                             <div className="h-20 bg-muted/20 animate-pulse rounded" />
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-xs mb-2">
                                        <span className="text-muted-foreground">Active Jobs</span>
                                        <span className="font-medium">{queueMetrics?.active || 0} / {(queueMetrics?.waiting || 0) + (queueMetrics?.active || 0)}</span>
                                    </div>
                                    <Progress value={progress} className="h-2" />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-0.5">Avg Time</p>
                                        <p className="font-medium text-lg font-mono">{statistics?.averageProcessingTime || '0'}m</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-0.5">Success Rate</p>
                                        <p className="font-medium text-lg font-mono text-green-500">{statistics?.successRate || '0'}%</p>
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
                        <Zap className="h-4 w-4 text-amber-500" /> Quick Actions
                    </h3>
                    <div className="grid gap-3">
                        <Button variant="outline" className="justify-start h-auto py-3 bg-background/50 border-white/5 hover:bg-background hover:border-primary/20 group" onClick={() => navigate('/upload')}>
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mr-3 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <Upload className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                                <div className="font-medium text-sm">Upload Document</div>
                                <div className="text-[10px] text-muted-foreground">Start new processing job</div>
                            </div>
                        </Button>
                        
                        <Button variant="outline" className="justify-start h-auto py-3 bg-background/50 border-white/5 hover:bg-background hover:border-primary/20 group" onClick={() => navigate('/templates')}>
                            <div className="h-8 w-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mr-3 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                <FileText className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                                <div className="font-medium text-sm">Create Template</div>
                                <div className="text-[10px] text-muted-foreground">Setup reusable form mapping</div>
                            </div>
                        </Button>

                         <Button variant="outline" className="justify-start h-auto py-3 bg-background/50 border-white/5 hover:bg-background hover:border-primary/20 group" onClick={() => navigate('/documents')}>
                            <div className="h-8 w-8 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center mr-3 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                <FolderOpen className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                                <div className="font-medium text-sm">Browse Library</div>
                                <div className="text-[10px] text-muted-foreground">Access all processed files</div>
                            </div>
                        </Button>
                    </div>
                </div>
                
            </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
