// Modern Dashboard Component with Data Visualization
import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  BarChart3, 
  FileText, 
  Upload, 
  Download, 
  TrendingUp, 
  Users, 
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react'

interface DashboardProps {
  className?: string
}

interface MetricCardProps {
  title: string
  value: string | number
  change: number
  changeLabel: string
  icon: React.ReactNode
  trend: 'up' | 'down' | 'neutral'
}

interface ActivityItemProps {
  id: string
  action: string
  filename: string
  timestamp: string
  status: 'completed' | 'processing' | 'failed'
  user: {
    name: string
    avatar?: string
  }
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  change, 
  changeLabel, 
  icon, 
  trend 
}) => {
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'
  const bgColor = trend === 'up' ? 'bg-green-50 dark:bg-green-900/20' : trend === 'down' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-900/20'

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-full ${bgColor}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-1">{value}</div>
        <div className={`text-sm ${trendColor} flex items-center gap-1`}>
          <TrendingUp className="h-3 w-3" />
          <span>{change > 0 ? '+' : ''}{change}% {changeLabel}</span>
        </div>
      </CardContent>
    </Card>
  )
}

const ActivityFeed: React.FC<{ activities: ActivityItemProps[] }> = ({ activities }) => {
  const getStatusIcon = (status: ActivityItemProps['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: ActivityItemProps['status']) => {
    const variants = {
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      processing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
    }

    return (
      <Badge variant="outline" className={variants[status]}>
        {status}
      </Badge>
    )
  }

  return (
    <Card className="col-span-full lg:col-span-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </CardTitle>
        <CardDescription>
          Latest PDF processing activities and form submissions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div 
              key={activity.id}
              className="flex items-start space-x-4 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
              role="article"
              aria-labelledby={`activity-${activity.id}-title`}
              aria-describedby={`activity-${activity.id}-meta`}
            >
              <Avatar className="h-9 w-9 border">
                <AvatarImage src={activity.user.avatar} alt={activity.user.name} />
                <AvatarFallback className="text-xs">
                  {activity.user.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div id={`activity-${activity.id}-title`} className="flex items-center gap-2 mb-1">
                  {getStatusIcon(activity.status)}
                  <span className="text-sm font-medium truncate">
                    {activity.user.name} {activity.action}
                  </span>
                  {getStatusBadge(activity.status)}
                </div>
                
                <div id={`activity-${activity.id}-meta`} className="text-xs text-muted-foreground">
                  <div className="truncate mb-1">File: {activity.filename}</div>
                  <time dateTime={activity.timestamp} className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(activity.timestamp).toLocaleString()}
                  </time>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

const QuickActions: React.FC = () => {
  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>
          Common tasks and shortcuts for efficient workflow
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button 
          variant="default" 
          className="w-full justify-start gap-3 h-12"
          aria-describedby="upload-action-desc"
        >
          <Upload className="h-4 w-4" />
          Upload New PDF
        </Button>
        <div id="upload-action-desc" className="sr-only">
          Upload a new PDF file to fill with form data
        </div>
        
        <Button 
          variant="outline" 
          className="w-full justify-start gap-3 h-12"
          aria-describedby="template-action-desc"
        >
          <FileText className="h-4 w-4" />
          Create Template
        </Button>
        <div id="template-action-desc" className="sr-only">
          Create a reusable template for common forms
        </div>
        
        <Button 
          variant="outline" 
          className="w-full justify-start gap-3 h-12"
          aria-describedby="download-action-desc"
        >
          <Download className="h-4 w-4" />
          Download Reports
        </Button>
        <div id="download-action-desc" className="sr-only">
          Download processing reports and analytics
        </div>
      </CardContent>
    </Card>
  )
}

const ProcessingProgress: React.FC = () => {
  const progressItems = [
    { label: 'Forms Processed Today', value: 87, total: 100, color: 'bg-blue-500' },
    { label: 'Template Accuracy', value: 94, total: 100, color: 'bg-green-500' },
    { label: 'Storage Used', value: 68, total: 100, color: 'bg-yellow-500' }
  ]

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle>Processing Overview</CardTitle>
        <CardDescription>
          Current system performance and utilization metrics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {progressItems.map((item, index) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">{item.label}</span>
              <span className="text-muted-foreground">
                {item.value}/{item.total}
              </span>
            </div>
            <Progress 
              value={item.value} 
              className="h-2"
              aria-label={`${item.label}: ${item.value} out of ${item.total}`}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export const Dashboard: React.FC<DashboardProps> = ({ className = '' }) => {
  // Mock data - in real app, this would come from API/context
  const metrics = [
    {
      title: 'Total Forms Processed',
      value: '2,847',
      change: 12.5,
      changeLabel: 'from last month',
      icon: <FileText className="h-4 w-4 text-blue-600" />,
      trend: 'up' as const
    },
    {
      title: 'Active Templates',
      value: 156,
      change: 8.2,
      changeLabel: 'from last month',
      icon: <BarChart3 className="h-4 w-4 text-green-600" />,
      trend: 'up' as const
    },
    {
      title: 'Processing Time Avg',
      value: '2.4s',
      change: -15.3,
      changeLabel: 'improvement',
      icon: <Activity className="h-4 w-4 text-purple-600" />,
      trend: 'up' as const
    },
    {
      title: 'Active Users',
      value: 89,
      change: 3.1,
      changeLabel: 'from yesterday',
      icon: <Users className="h-4 w-4 text-orange-600" />,
      trend: 'up' as const
    }
  ]

  const recentActivities: ActivityItemProps[] = [
    {
      id: '1',
      action: 'processed form',
      filename: 'employee_handbook_v2.pdf',
      timestamp: '2024-01-15T14:30:00Z',
      status: 'completed',
      user: { name: 'Sarah Johnson', avatar: '/avatars/sarah.jpg' }
    },
    {
      id: '2',
      action: 'uploaded template',
      filename: 'contract_template.pdf',
      timestamp: '2024-01-15T13:45:00Z',
      status: 'processing',
      user: { name: 'Mike Chen', avatar: '/avatars/mike.jpg' }
    },
    {
      id: '3',
      action: 'filled form',
      filename: 'tax_document_2024.pdf',
      timestamp: '2024-01-15T12:15:00Z',
      status: 'completed',
      user: { name: 'Emily Davis', avatar: '/avatars/emily.jpg' }
    },
    {
      id: '4',
      action: 'processed batch',
      filename: 'quarterly_reports.zip',
      timestamp: '2024-01-15T11:20:00Z',
      status: 'failed',
      user: { name: 'Alex Rivera', avatar: '/avatars/alex.jpg' }
    }
  ]

  return (
    <div className={`space-y-6 p-6 ${className}`}>
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's what's happening with your PDF processing.
          </p>
        </div>
        <Button size="lg" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload PDF
        </Button>
      </div>

      {/* Metrics Grid */}
      <div 
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        role="region"
        aria-label="Key performance metrics"
      >
        {metrics.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
        <ActivityFeed activities={recentActivities} />
        <div className="space-y-6 lg:col-span-2">
          <QuickActions />
          <ProcessingProgress />
        </div>
      </div>
    </div>
  )
}

export default Dashboard