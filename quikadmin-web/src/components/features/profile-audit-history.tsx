/**
 * ProfileAuditHistory - Displays timeline of profile field changes
 * @module components/features/profile-audit-history
 */

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { History, Plus, Pencil, Trash2, AlertCircle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { getAuditHistory, AuditLogEntry } from '@/services/userProfileService';

interface ProfileAuditHistoryProps {
  limit?: number;
  className?: string;
}

/**
 * Get icon for audit action
 */
function getActionIcon(action: AuditLogEntry['action']) {
  switch (action) {
    case 'CREATE':
      return <Plus className="h-3.5 w-3.5" />;
    case 'UPDATE':
      return <Pencil className="h-3.5 w-3.5" />;
    case 'DELETE':
      return <Trash2 className="h-3.5 w-3.5" />;
  }
}

/**
 * Get badge variant for audit action
 */
function getActionBadgeClass(action: AuditLogEntry['action']) {
  switch (action) {
    case 'CREATE':
      return 'bg-status-success/10 text-status-success-foreground border-status-success/30';
    case 'UPDATE':
      return 'bg-status-warning/10 text-status-warning-foreground border-status-warning/30';
    case 'DELETE':
      return 'bg-status-error/10 text-status-error-foreground border-status-error/30';
  }
}

/**
 * Format values for display
 */
function formatValues(values: string[] | null): string {
  if (!values || values.length === 0) return '(empty)';
  if (values.length === 1) return values[0];
  return values.join(', ');
}

/**
 * Audit log entry component
 */
function AuditLogItem({ log }: { log: AuditLogEntry }) {
  return (
    <div className="flex gap-4 pb-6 last:pb-0">
      {/* Timeline dot */}
      <div className="relative flex flex-col items-center">
        <div
          className={cn(
            'h-8 w-8 rounded-full flex items-center justify-center border',
            getActionBadgeClass(log.action)
          )}
        >
          {getActionIcon(log.action)}
        </div>
        <div className="absolute top-8 bottom-0 w-px bg-border" />
      </div>

      {/* Content */}
      <div className="flex-1 space-y-1.5 pt-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn('text-xs', getActionBadgeClass(log.action))}>
            {log.action}
          </Badge>
          <span className="font-medium">{log.fieldName}</span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(log.createdAt), 'MMM d, yyyy h:mm a')}
          </span>
        </div>

        {/* Value changes */}
        <div className="text-sm space-y-1">
          {log.action === 'CREATE' && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Added:</span>
              <span className="font-mono text-xs bg-status-success/10 px-2 py-0.5 rounded">
                {formatValues(log.newValue)}
              </span>
            </div>
          )}
          {log.action === 'UPDATE' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">From:</span>
                <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded line-through opacity-60">
                  {formatValues(log.oldValue)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">To:</span>
                <span className="font-mono text-xs bg-status-success/10 px-2 py-0.5 rounded">
                  {formatValues(log.newValue)}
                </span>
              </div>
            </>
          )}
          {log.action === 'DELETE' && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Removed:</span>
              <span className="font-mono text-xs bg-status-error/10 px-2 py-0.5 rounded line-through">
                {formatValues(log.oldValue)}
              </span>
            </div>
          )}
        </div>

        {/* IP Address (optional) */}
        {log.ipAddress && <p className="text-xs text-muted-foreground">IP: {log.ipAddress}</p>}
      </div>
    </div>
  );
}

/**
 * ProfileAuditHistory component
 *
 * Displays a timeline of profile field changes with pagination
 */
export function ProfileAuditHistory({ limit = 20, className }: ProfileAuditHistoryProps) {
  const [offset, setOffset] = React.useState(0);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['profileAuditHistory', limit, offset],
    queryFn: () => getAuditHistory({ limit, offset }),
    retry: 1,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-full max-w-sm" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Audit History</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Failed to load audit history'}
        </AlertDescription>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
          Try Again
        </Button>
      </Alert>
    );
  }

  // Empty state
  if (!data || data.logs.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
        <History className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No History Yet</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Profile changes will be recorded here. Edit your profile fields to see the audit trail.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Timeline */}
      <div className="relative">
        {data.logs.map((log) => (
          <AuditLogItem key={log.id} log={log} />
        ))}
      </div>

      {/* Pagination */}
      {data.pagination.hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => setOffset((prev) => prev + limit)}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Load More
          </Button>
        </div>
      )}

      {/* Summary */}
      <p className="text-xs text-muted-foreground text-center">
        Showing {Math.min(offset + data.logs.length, data.pagination.total)} of{' '}
        {data.pagination.total} changes
      </p>
    </div>
  );
}
