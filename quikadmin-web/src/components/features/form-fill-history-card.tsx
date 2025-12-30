/**
 * FormFillHistoryCard - Component to display form fill history for a profile
 * B2C-focused: Shows history of forms filled using profile data
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
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyStateSimple } from '@/components/ui/empty-state';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { cn } from '@/lib/utils';

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

// =================== MOCK DATA ===================

// Note: In production, this would be fetched from the backend
const mockHistoryEntries: FormFillHistoryEntry[] = [
  {
    id: '1',
    formName: 'DS-160 Visa Application',
    formFileName: 'ds160_filled.pdf',
    profileId: 'profile-1',
    profileName: 'Personal',
    profileType: 'PERSONAL',
    filledAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    fieldsUsed: 45,
    totalFields: 52,
    confidence: 0.94,
    status: 'completed',
    downloadUrl: '#',
  },
  {
    id: '2',
    formName: 'I-94 Arrival Record',
    formFileName: 'i94_filled.pdf',
    profileId: 'profile-1',
    profileName: 'Personal',
    profileType: 'PERSONAL',
    filledAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    fieldsUsed: 18,
    totalFields: 20,
    confidence: 0.98,
    status: 'completed',
    downloadUrl: '#',
  },
  {
    id: '3',
    formName: 'Business License Application',
    formFileName: 'business_license.pdf',
    profileId: 'profile-2',
    profileName: 'ACME Corp',
    profileType: 'BUSINESS',
    filledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    fieldsUsed: 30,
    totalFields: 35,
    confidence: 0.87,
    status: 'partial',
    downloadUrl: '#',
    warnings: ['Company EIN not found', 'Business address incomplete'],
  },
];

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
          color: 'text-green-600',
          bgColor: 'bg-green-100 dark:bg-green-900',
          label: 'Completed',
        };
      case 'partial':
        return {
          icon: Clock,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100 dark:bg-yellow-900',
          label: 'Partial',
        };
      case 'failed':
        return {
          icon: XCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-100 dark:bg-red-900',
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
        return 'text-green-600';
      case 'partial':
        return 'text-yellow-600';
      case 'failed':
        return 'text-red-600';
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
  isLoading = false,
  entries,
  compact = false,
  className,
}: FormFillHistoryCardProps) {
  // Filter entries by profileId if provided
  const filteredEntries = React.useMemo(() => {
    const data = entries || mockHistoryEntries;
    const filtered = profileId ? data.filter((e) => e.profileId === profileId) : data;
    return filtered.slice(0, limit);
  }, [entries, profileId, limit]);

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

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Form Fill History
        </CardTitle>
        <CardDescription>
          {profileId ? "Forms filled using this profile's data" : 'Recent forms you have filled'}
        </CardDescription>
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

        {filteredEntries.length > 0 && filteredEntries.length >= limit && (
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" className="w-full" size="sm">
              View All History
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default FormFillHistoryCard;
