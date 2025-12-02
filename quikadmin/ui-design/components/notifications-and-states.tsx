// Toast Notifications, Loading States, and Micro-interactions
import React, { useState, useEffect, createContext, useContext } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  X, 
  Loader2,
  Upload,
  Download,
  RefreshCw,
  Zap,
  Bell,
  Star,
  Heart,
  Bookmark,
  Share2
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Toast System Types
type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextType {
  toasts: Toast[]
  showToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

// Toast Component
const ToastItem: React.FC<{
  toast: Toast
  onDismiss: (id: string) => void
}> = ({ toast, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 10)
    
    // Auto dismiss
    if (toast.duration && toast.duration > 0) {
      const dismissTimer = setTimeout(() => {
        handleDismiss()
      }, toast.duration)
      
      return () => {
        clearTimeout(timer)
        clearTimeout(dismissTimer)
      }
    }

    return () => clearTimeout(timer)
  }, [toast.duration])

  const handleDismiss = () => {
    setIsLeaving(true)
    setTimeout(() => onDismiss(toast.id), 300)
  }

  const getToastStyles = () => {
    const baseStyles = "pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all"
    
    switch (toast.type) {
      case 'success':
        return `${baseStyles} border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100`
      case 'error':
        return `${baseStyles} border-red-500 bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-100`
      case 'warning':
        return `${baseStyles} border-yellow-500 bg-yellow-50 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-100`
      case 'info':
        return `${baseStyles} border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100`
      default:
        return `${baseStyles} border-gray-500 bg-white dark:bg-gray-800`
    }
  }

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5" />
      case 'error':
        return <AlertCircle className="h-5 w-5" />
      case 'warning':
        return <AlertCircle className="h-5 w-5" />
      case 'info':
        return <Info className="h-5 w-5" />
      default:
        return <Info className="h-5 w-5" />
    }
  }

  return (
    <div
      className={cn(
        getToastStyles(),
        "transform transition-all duration-300 ease-out",
        isVisible && !isLeaving 
          ? "translate-x-0 opacity-100 scale-100" 
          : isLeaving
          ? "translate-x-full opacity-0 scale-95"
          : "translate-x-full opacity-0 scale-95"
      )}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="flex">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="ml-3 w-0 flex-1">
          <p className="text-sm font-medium">{toast.title}</p>
          {toast.description && (
            <p className="mt-1 text-sm opacity-90">{toast.description}</p>
          )}
          {toast.action && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toast.action.onClick}
              className="mt-2 h-8 text-xs underline-offset-4 hover:underline"
            >
              {toast.action.label}
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="h-8 w-8 p-0 opacity-60 hover:opacity-100"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      </div>
    </div>
  )
}

// Toast Container
export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToast()

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  )
}

// Toast Provider
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: Toast = {
      id,
      duration: 5000,
      ...toast
    }
    
    setToasts(prev => [...prev, newToast])
  }

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

// Loading States Components
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  }

  return (
    <Loader2 
      className={cn(
        'animate-spin',
        sizeClasses[size],
        className
      )} 
    />
  )
}

export const LoadingButton: React.FC<{
  loading: boolean
  children: React.ReactNode
  onClick?: () => void
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  className?: string
}> = ({ loading, children, onClick, variant = 'default', size = 'default', className }) => {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={loading}
      className={cn("transition-all duration-200", className)}
    >
      {loading && <LoadingSpinner size="sm" className="mr-2" />}
      {children}
    </Button>
  )
}

export const LoadingCard: React.FC<{
  title?: string
  lines?: number
  className?: string
}> = ({ title, lines = 3, className }) => {
  return (
    <Card className={cn("animate-pulse", className)}>
      <CardContent className="p-6 space-y-4">
        {title && (
          <div className="h-6 bg-muted rounded w-1/3"></div>
        )}
        <div className="space-y-3">
          {Array.from({ length: lines }).map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "h-4 bg-muted rounded",
                i === lines - 1 ? "w-2/3" : "w-full"
              )}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Progress States
export const ProgressWithSteps: React.FC<{
  currentStep: number
  totalSteps: number
  steps: string[]
  className?: string
}> = ({ currentStep, totalSteps, steps, className }) => {
  const progress = ((currentStep - 1) / (totalSteps - 1)) * 100

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex justify-between text-sm">
        <span className="font-medium">Step {currentStep} of {totalSteps}</span>
        <span className="text-muted-foreground">{Math.round(progress)}%</span>
      </div>
      
      <Progress value={progress} className="h-2" />
      
      <div className="grid grid-cols-3 gap-2 text-xs">
        {steps.slice(0, 3).map((step, index) => (
          <div
            key={index}
            className={cn(
              "text-center p-2 rounded",
              index < currentStep - 1 
                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                : index === currentStep - 1
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                : "bg-muted text-muted-foreground"
            )}
          >
            {step}
          </div>
        ))}
      </div>
    </div>
  )
}

// Micro-interactions
export const AnimatedCounter: React.FC<{
  value: number
  duration?: number
  className?: string
}> = ({ value, duration = 1000, className }) => {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    let startTime: number
    let animationId: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = timestamp - startTime

      if (progress < duration) {
        const easedProgress = 1 - Math.pow(1 - progress / duration, 3)
        setDisplayValue(Math.floor(easedProgress * value))
        animationId = requestAnimationFrame(animate)
      } else {
        setDisplayValue(value)
      }
    }

    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [value, duration])

  return (
    <span className={cn("tabular-nums", className)}>
      {displayValue.toLocaleString()}
    </span>
  )
}

export const PulsingDot: React.FC<{
  color?: 'green' | 'blue' | 'red' | 'yellow'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}> = ({ color = 'green', size = 'md', className }) => {
  const colorClasses = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500'
  }

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }

  return (
    <div className={cn("relative flex", className)}>
      <span className={cn(
        "animate-ping absolute inline-flex rounded-full opacity-75",
        colorClasses[color],
        sizeClasses[size]
      )} />
      <span className={cn(
        "relative inline-flex rounded-full",
        colorClasses[color],
        sizeClasses[size]
      )} />
    </div>
  )
}

export const InteractiveButton: React.FC<{
  children: React.ReactNode
  icon?: React.ReactNode
  onClick?: () => void
  variant?: 'like' | 'bookmark' | 'share' | 'star'
  active?: boolean
  className?: string
}> = ({ children, icon, onClick, variant, active = false, className }) => {
  const [isPressed, setIsPressed] = useState(false)
  const [showRipple, setShowRipple] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    setIsPressed(true)
    setShowRipple(true)
    
    setTimeout(() => {
      setIsPressed(false)
      setShowRipple(false)
    }, 200)

    onClick?.()
  }

  const getVariantStyles = () => {
    switch (variant) {
      case 'like':
        return active 
          ? "text-red-600 hover:text-red-700" 
          : "text-muted-foreground hover:text-red-600"
      case 'bookmark':
        return active 
          ? "text-yellow-600 hover:text-yellow-700" 
          : "text-muted-foreground hover:text-yellow-600"
      case 'share':
        return "text-muted-foreground hover:text-blue-600"
      case 'star':
        return active 
          ? "text-yellow-500 hover:text-yellow-600" 
          : "text-muted-foreground hover:text-yellow-500"
      default:
        return "text-muted-foreground hover:text-foreground"
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={cn(
        "relative overflow-hidden transition-all duration-200",
        getVariantStyles(),
        isPressed && "scale-95",
        className
      )}
    >
      {showRipple && (
        <span className="absolute inset-0 bg-current opacity-20 rounded scale-0 animate-ping" />
      )}
      <span className="flex items-center gap-2">
        {icon}
        {children}
      </span>
    </Button>
  )
}

// Floating Action Button
export const FloatingActionButton: React.FC<{
  icon: React.ReactNode
  onClick?: () => void
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  className?: string
}> = ({ icon, onClick, position = 'bottom-right', className }) => {
  const [isHovered, setIsHovered] = useState(false)

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6'
  }

  return (
    <Button
      size="lg"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "fixed z-50 h-14 w-14 rounded-full shadow-lg transition-all duration-300",
        "hover:scale-110 hover:shadow-xl",
        "focus:scale-105 focus:outline-none focus:ring-4 focus:ring-primary/20",
        positionClasses[position],
        isHovered && "rotate-12",
        className
      )}
    >
      <span className={cn("transition-transform duration-300", isHovered && "scale-110")}>
        {icon}
      </span>
    </Button>
  )
}

// Status Indicators
export const StatusIndicator: React.FC<{
  status: 'online' | 'offline' | 'busy' | 'away'
  showLabel?: boolean
  className?: string
}> = ({ status, showLabel = false, className }) => {
  const statusConfig = {
    online: { color: 'bg-green-500', label: 'Online' },
    offline: { color: 'bg-gray-400', label: 'Offline' },
    busy: { color: 'bg-red-500', label: 'Busy' },
    away: { color: 'bg-yellow-500', label: 'Away' }
  }

  const config = statusConfig[status]

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <PulsingDot 
        color={config.color.includes('green') ? 'green' : 
              config.color.includes('red') ? 'red' : 
              config.color.includes('yellow') ? 'yellow' : 'blue'} 
        size="sm" 
      />
      {showLabel && (
        <span className="text-sm text-muted-foreground">{config.label}</span>
      )}
    </div>
  )
}

// Demo Component
export const NotificationsDemo: React.FC = () => {
  const { showToast } = useToast()

  const demoToasts = [
    {
      type: 'success' as const,
      title: 'PDF Processed Successfully',
      description: 'Your document has been processed and is ready for download.',
      action: { label: 'View Details', onClick: () => console.log('View details') }
    },
    {
      type: 'error' as const,
      title: 'Upload Failed',
      description: 'The file could not be processed due to corruption.',
      action: { label: 'Retry', onClick: () => console.log('Retry upload') }
    },
    {
      type: 'warning' as const,
      title: 'Storage Almost Full',
      description: 'You have used 90% of your storage quota.',
    },
    {
      type: 'info' as const,
      title: 'New Feature Available',
      description: 'Check out our new batch processing feature.',
    }
  ]

  return (
    <div className="space-y-4 p-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Toast Notifications</h3>
        <div className="flex flex-wrap gap-2">
          {demoToasts.map((toast, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => showToast(toast)}
            >
              Show {toast.type} toast
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Loading States</h3>
        <div className="flex flex-wrap gap-4 items-center">
          <LoadingSpinner size="sm" />
          <LoadingSpinner size="md" />
          <LoadingSpinner size="lg" />
          <LoadingButton loading={true}>Processing...</LoadingButton>
          <LoadingButton loading={false}>Upload File</LoadingButton>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Interactive Elements</h3>
        <div className="flex flex-wrap gap-2">
          <InteractiveButton variant="like" icon={<Heart className="h-4 w-4" />}>
            Like
          </InteractiveButton>
          <InteractiveButton variant="bookmark" icon={<Bookmark className="h-4 w-4" />}>
            Bookmark
          </InteractiveButton>
          <InteractiveButton variant="share" icon={<Share2 className="h-4 w-4" />}>
            Share
          </InteractiveButton>
          <InteractiveButton variant="star" icon={<Star className="h-4 w-4" />} active>
            Starred
          </InteractiveButton>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Status Indicators</h3>
        <div className="flex flex-wrap gap-4">
          <StatusIndicator status="online" showLabel />
          <StatusIndicator status="busy" showLabel />
          <StatusIndicator status="away" showLabel />
          <StatusIndicator status="offline" showLabel />
        </div>
      </div>

      <FloatingActionButton
        icon={<Upload className="h-6 w-6" />}
        onClick={() => showToast({
          type: 'info',
          title: 'Quick Upload',
          description: 'Upload functionality would open here'
        })}
      />
    </div>
  )
}

export default NotificationsDemo