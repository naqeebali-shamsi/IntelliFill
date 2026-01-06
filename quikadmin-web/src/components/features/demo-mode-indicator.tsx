/**
 * DemoModeIndicator - Shows when user is in demo mode
 * Displays a subtle banner or badge to indicate demo session
 * @module components/features/demo-mode-indicator
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/stores/auth';
import { Play, Info, Sparkles, X } from 'lucide-react';

export interface DemoModeIndicatorProps {
  /**
   * Display variant
   */
  variant?: 'banner' | 'badge' | 'compact';

  /**
   * Allow dismissing the banner
   */
  dismissible?: boolean;

  /**
   * Custom class name
   */
  className?: string;
}

/**
 * DemoModeIndicator component
 *
 * Shows a visual indicator when the user is logged in with a demo account.
 * Helps users understand they're in a demo environment.
 *
 * @example
 * ```tsx
 * // In your layout header
 * <DemoModeIndicator variant="banner" />
 *
 * // As a badge in navigation
 * <DemoModeIndicator variant="badge" />
 * ```
 */
export function DemoModeIndicator({
  variant = 'banner',
  dismissible = true,
  className,
}: DemoModeIndicatorProps) {
  const [dismissed, setDismissed] = React.useState(false);
  const isDemo = useAuthStore((state) => state.isDemo);
  const demoInfo = useAuthStore((state) => state.demoInfo);

  // Don't render if not in demo mode or dismissed
  if (!isDemo || (dismissed && dismissible)) {
    return null;
  }

  if (variant === 'badge') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              className={cn('bg-warning-light text-warning-foreground', 'cursor-help', className)}
            >
              <Play className="h-3 w-3 mr-1" />
              Demo
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{demoInfo?.notice || 'You are using a demo account'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs',
          'bg-warning-light text-warning-foreground',
          className
        )}
      >
        <Play className="h-3 w-3" />
        <span>Demo Mode</span>
      </div>
    );
  }

  // Default: banner variant
  return (
    <div
      className={cn(
        'w-full px-4 py-2',
        'bg-gradient-to-r from-warning-light/50 to-warning-light',
        'border-b border-warning/20',
        className
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-warning/20">
            <Sparkles className="h-3.5 w-3.5 text-warning" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="font-medium text-warning-foreground text-sm">Demo Mode</span>
            <span className="text-warning-foreground/80 text-xs sm:text-sm">
              {demoInfo?.notice || 'This is a demo account. Data may be reset periodically.'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-warning hover:text-warning-foreground"
              >
                <Info className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Learn More</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-warning" />
                  Demo Mode
                </DialogTitle>
                <DialogDescription>
                  You're exploring IntelliFill with a demo account
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <p className="text-muted-foreground">
                  {demoInfo?.notice ||
                    'This is a demo account with pre-loaded sample data. Feel free to explore all features!'}
                </p>
                {demoInfo?.features && demoInfo.features.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Available in Demo:</h4>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      {demoInfo.features.map((feature, index) => (
                        <li key={index}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="bg-muted p-3 rounded-md text-sm">
                  <p className="font-medium mb-1">Ready to get started?</p>
                  <p className="text-muted-foreground">
                    Create your own account to save your work and access all premium features.
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {dismissible && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-warning hover:text-warning-foreground"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check if in demo mode
 */
export function useIsDemo() {
  const isDemo = useAuthStore((state) => state.isDemo);
  const demoInfo = useAuthStore((state) => state.demoInfo);
  return { isDemo, demoInfo };
}

export default DemoModeIndicator;
