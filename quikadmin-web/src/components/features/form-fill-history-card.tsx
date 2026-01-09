/**
 * FormFillHistoryCard - Component to display form fill history for a profile
 * B2C-focused: Shows history of forms filled using profile data
 *
 * Task 490: Updated to use real API data from filled-forms endpoint
 *
 * @module components/features/form-fill-history-card
 */

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Clock,
  FileText,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  Building2,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyStateSimple } from '@/components/ui/empty-state';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { cn } from '@/lib/utils';
import { filledFormService, type FilledForm } from '@/services/filledFormService';

// =================== TYPES ===================

export interface FormFillHistoryEntry {
  id: string;
  formName: string;
  formFileName?: string;
  profileId: string;
  profileName: string;
  profileType: 'PERSONAL' | 'BUSINESS';
  filledAt: string;
  fieldsUsed: number;
  totalFields: number;
  confidence: number;
  status: 'completed' | 'failed' | 'partial';
  downloadUrl?: string;
  warnings?: string[];
}

export interface FormFillHistoryCardProps {
  /**
   * Profile ID to show history for (optional - if not provided, shows all user's history)
   */
  profileId?: string;
  /**
   * Maximum number of entries to show
   */
  limit?: number;
  /**
   * Whether the component is in loading state
   */
  isLoading?: boolean;
  /**
   * History entries (for controlled component)
   */
  entries?: FormFillHistoryEntry[];
  /**
   * Show compact version
   */
  compact?: boolean;
  /**
   * Optional className
   */
  className?: string;
}

// =================== HELPERS ===================

/**
 * Transform API FilledForm to FormFillHistoryEntry
 */
function transformFilledFormToHistoryEntry(form: FilledForm): FormFillHistoryEntry {
  // Extract metadata from dataSnapshot for ad-hoc forms
  const dataSnapshot = form.dataSnapshot as Record<string, unknown> | undefined;
  const isAdhoc = form.templateName === '__ADHOC_FORMS__';

  // Get form name - for ad-hoc forms, it's stored in dataSnapshot
  const formName = isAdhoc
    ? (dataSnapshot?.formName as string) || 'Filled Form'
    : form.templateName;

  // Get field counts from dataSnapshot (for ad-hoc) or estimate from template
  const filledFields = (dataSnapshot?.filledFields as number) || 0;
  const totalFields = (dataSnapshot?.totalFields as number) || 0;
  const confidence = (dataSnapshot?.confidence as number) || 0.9;

  // Determine status based on confidence
  let status: 'completed' | 'failed' | 'partial' = 'completed';
  if (confidence < 0.5) {
    status = 'failed';
  } else if (confidence < 0.8 || (totalFields > 0 && filledFields / totalFields < 0.8)) {
    status = 'partial';
  }

  // Map client type to profile type
  const profileType: 'PERSONAL' | 'BUSINESS' =
    form.clientType === 'COMPANY' ? 'BUSINESS' : 'PERSONAL';

  return {
    id: form.id,
    formName,
    formFileName: formName.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf',
    profileId: form.clientId,
    profileName: form.clientName,
    profileType,
    filledAt: form.createdAt,
    fieldsUsed: filledFields,
    totalFields,
    confidence,
    status,
    downloadUrl: form.downloadUrl,
    warnings: (dataSnapshot?.warnings as string[]) || undefined,
  };
}

// =================== HISTORY ENTRY ROW ===================

interface HistoryEntryRowProps {
  entry: FormFillHistoryEntry;
  showProfile?: boolean;
}

function HistoryEntryRow({ entry, showProfile = false }: HistoryEntryRowProps) {
  const completionRate = Math.round((entry.fieldsUsed / entry.totalFields) * 100);
  const confidencePercent = Math.round(entry.confidence * 100);

  const getStatusInfo = () => {
    switch (entry.status) {
      case 'completed':
        return {
          icon: CheckCircle,
          color: 'text-status-success-foreground',
          bgColor: 'bg-status-success/10',
          label: 'Completed',
        };
      case 'partial':
        return {
          icon: Clock,
          color: 'text-status-warning-foreground',
          bgColor: 'bg-status-warning/10',
          label: 'Partial',
        };
      case 'failed':
        return {
          icon: XCircle,
          color: 'text-status-error-foreground',
          bgColor: 'bg-status-error/10',
          label: 'Failed',
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group">
      {/* Form Icon */}
      <div
        className={cn('flex h-10 w-10 items-center justify-center rounded-lg', statusInfo.bgColor)}
      >
        <FileText className={cn('h-5 w-5', statusInfo.color)} />
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{entry.formName}</span>
          <Badge variant="outline" className="text-xs shrink-0">
            {statusInfo.label}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>{formatDistanceToNow(new Date(entry.filledAt), { addSuffix: true })}</span>
              </TooltipTrigger>
              <TooltipContent>{format(new Date(entry.filledAt), 'PPpp')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <span className="text-muted-foreground/50">|</span>
          <span>
            {entry.fieldsUsed}/{entry.totalFields} fields
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span>{confidencePercent}% confidence</span>

          {showProfile && (
            <>
              <span className="text-muted-foreground/50">|</span>
              <span className="flex items-center gap-1">
                {entry.profileType === 'BUSINESS' ? (
                  <Building2 className="h-3.5 w-3.5" />
                ) : (
                  <User className="h-3.5 w-3.5" />
                )}
                {entry.profileName}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {entry.downloadUrl && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                  <a href={entry.downloadUrl} download>
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download filled form</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View details</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

// =================== COMPACT ENTRY ===================

function CompactHistoryEntry({ entry }: { entry: FormFillHistoryEntry }) {
  const getStatusColor = () => {
    switch (entry.status) {
      case 'completed':
        return 'text-status-success-foreground';
      case 'partial':
        return 'text-status-warning-foreground';
      case 'failed':
        return 'text-status-error-foreground';
    }
  };

  return (
    <div className="flex items-center gap-2 py-2 px-1">
      <FileText className={cn('h-4 w-4 shrink-0', getStatusColor())} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{entry.formName}</div>
        <div className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(entry.filledAt), { addSuffix: true })}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );
}

// =================== LOADING SKELETON ===================

function HistorySkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2 py-2">
            <Skeleton className="h-4 w-4" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
      ))}
    </div>
  );
}

// =================== MAIN COMPONENT ===================

export function FormFillHistoryCard({
  profileId,
  limit = 5,
  isLoading: externalLoading = false,
  entries: externalEntries,
  compact = false,
  className,
}: FormFillHistoryCardProps) {
  // Fetch filled forms from API
  const {
    data: apiResponse,
    isLoading: apiLoading,
    error: apiError,
    refetch,
  } = useQuery({
    queryKey: ['filled-forms-history', profileId, limit],
    queryFn: async () => {
      const response = await filledFormService.list({
        clientId: profileId,
        limit,
        offset: 0,
      });
      return response;
    },
    staleTime: 30000, // 30 seconds
    enabled: !externalEntries, // Only fetch if no external entries provided
  });

  // Transform API data to history entries
  const filteredEntries = React.useMemo(() => {
    // If external entries provided, use those
    if (externalEntries) {
      const filtered = profileId
        ? externalEntries.filter((e) => e.profileId === profileId)
        : externalEntries;
      return filtered.slice(0, limit);
    }

    // Otherwise use API data
    if (apiResponse?.data?.filledForms) {
      return apiResponse.data.filledForms.map(transformFilledFormToHistoryEntry);
    }

    return [];
  }, [externalEntries, apiResponse, profileId, limit]);

  const isLoading = externalLoading || apiLoading;

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Form Fill History
          </CardTitle>
          <CardDescription>Loading history...</CardDescription>
        </CardHeader>
        <CardContent>
          <HistorySkeleton compact={compact} />
        </CardContent>
      </Card>
    );
  }

  // Handle error state
  if (apiError && !externalEntries) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Form Fill History
          </CardTitle>
          <CardDescription className="text-status-error-foreground">
            Failed to load history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Form Fill History
            </CardTitle>
            <CardDescription>
              {profileId ? "Forms filled using this profile's data" : 'Recent forms you have filled'}
            </CardDescription>
          </div>
          {!externalEntries && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => refetch()}
                    disabled={isLoading}
                  >
                    <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {filteredEntries.length === 0 ? (
          <EmptyStateSimple
            icon={FileText}
            message={
              profileId
                ? 'No forms have been filled with this profile yet.'
                : 'No form fill history yet. Fill a form to see it here.'
            }
          />
        ) : compact ? (
          <div className="divide-y">
            {filteredEntries.map((entry) => (
              <CompactHistoryEntry key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredEntries.map((entry) => (
              <HistoryEntryRow key={entry.id} entry={entry} showProfile={!profileId} />
            ))}
          </div>
        )}

        {filteredEntries.length > 0 && (apiResponse?.data?.pagination?.hasMore || filteredEntries.length >= limit) && (
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" className="w-full" size="sm">
              View All History
              {apiResponse?.data?.pagination?.total && (
                <Badge variant="secondary" className="ml-2">
                  {apiResponse.data.pagination.total}
                </Badge>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default FormFillHistoryCard;
