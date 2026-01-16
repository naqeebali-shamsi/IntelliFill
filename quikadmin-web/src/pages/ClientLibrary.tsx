/**
 * ClientLibrary Page
 *
 * Displays a searchable, filterable list of clients with
 * actions for viewing details, archiving, and restoring.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Users,
  Building2,
  User,
  Search,
  Plus,
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  X,
  Calendar,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { staggerContainer, fadeInUp } from '@/lib/animations';

import {
  useClientsStore,
  useClientsFilters,
  useClientsPagination,
  type ClientTypeFilter,
  type ClientStatusFilter,
} from '@/stores/clientsStore';
import type { Client, ClientType, ClientStatus } from '@/services/clientsService';

// =================== CONSTANTS ===================

const typeOptions: { value: ClientTypeFilter; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'INDIVIDUAL', label: 'Individual' },
];

const statusOptions: { value: ClientStatusFilter; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
];

// =================== HELPER FUNCTIONS ===================

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getTypeIcon(type: ClientType) {
  return type === 'COMPANY' ? Building2 : User;
}

function getTypeBadgeVariant(type: ClientType): 'default' | 'secondary' {
  return type === 'COMPANY' ? 'default' : 'secondary';
}

function getStatusBadgeVariant(status: ClientStatus): 'success-muted' | 'warning-muted' {
  return status === 'ACTIVE' ? 'success-muted' : 'warning-muted';
}

// =================== COMPONENTS ===================

interface ClientCardProps {
  client: Client;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  isArchiving: boolean;
}

function ClientCard({ client, onArchive, onRestore, isArchiving }: ClientCardProps) {
  const TypeIcon = getTypeIcon(client.type);

  return (
    <motion.div variants={fadeInUp}>
      <Card
        className="cursor-pointer transition-all hover:shadow-md"
        data-testid={`client-card-${client.id}`}
      >
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'p-2.5 rounded-lg',
                  client.type === 'COMPANY'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-secondary text-secondary-foreground'
                )}
              >
                <TypeIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">{client.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={getTypeBadgeVariant(client.type)}>
                    {client.type === 'COMPANY' ? 'Company' : 'Individual'}
                  </Badge>
                  <Badge variant={getStatusBadgeVariant(client.status)}>
                    {client.status === 'ACTIVE' ? 'Active' : 'Archived'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center">
              {client.status === 'ACTIVE' ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive(client.id);
                  }}
                  disabled={isArchiving}
                  title="Archive client"
                  data-testid={`archive-client-${client.id}`}
                >
                  {isArchiving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestore(client.id);
                  }}
                  disabled={isArchiving}
                  title="Restore client"
                  data-testid={`restore-client-${client.id}`}
                >
                  {isArchiving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArchiveRestore className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>

          {client.notes && (
            <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{client.notes}</p>
          )}

          <div className="flex items-center gap-1 mt-4 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Updated {formatDate(client.updatedAt)}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ClientCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-14" />
            </div>
          </div>
        </div>
        <Skeleton className="h-4 w-full mt-3" />
        <Skeleton className="h-3 w-24 mt-4" />
      </CardContent>
    </Card>
  );
}

// =================== MAIN COMPONENT ===================

export default function ClientLibrary() {
  // Store hooks
  const clients = useClientsStore((state) => state.clients);
  const loading = useClientsStore((state) => state.loading);
  const error = useClientsStore((state) => state.error);
  const fetchClients = useClientsStore((state) => state.fetchClients);
  const archiveClient = useClientsStore((state) => state.archiveClient);
  const restoreClient = useClientsStore((state) => state.restoreClient);
  const reset = useClientsStore((state) => state.reset);

  const { search, type, status, setSearch, setTypeFilter, setStatusFilter, hasActiveFilters } =
    useClientsFilters();
  const { offset, limit, total, hasNext, hasPrev, currentPage, totalPages, nextPage, prevPage } =
    useClientsPagination();

  // Local state
  const [searchInput, setSearchInput] = useState(search);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, search, setSearch]);

  // Fetch clients when filters change
  useEffect(() => {
    fetchClients();
  }, [fetchClients, search, type, status, offset, limit]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  // Handlers
  const handleClearFilters = useCallback(() => {
    setSearchInput('');
    setSearch('');
    setTypeFilter('all');
    setStatusFilter('all');
  }, [setSearch, setTypeFilter, setStatusFilter]);

  const handleArchive = useCallback(
    async (id: string) => {
      setArchivingId(id);
      try {
        await archiveClient(id);
        toast.success('Client archived successfully');
      } catch {
        toast.error('Failed to archive client');
      } finally {
        setArchivingId(null);
      }
    },
    [archiveClient]
  );

  const handleRestore = useCallback(
    async (id: string) => {
      setArchivingId(id);
      try {
        await restoreClient(id);
        toast.success('Client restored successfully');
      } catch {
        toast.error('Failed to restore client');
      } finally {
        setArchivingId(null);
      }
    },
    [restoreClient]
  );

  // Memoized loading skeletons
  const loadingSkeletons = useMemo(
    () => Array.from({ length: 6 }).map((_, i) => <ClientCardSkeleton key={`skeleton-${i}`} />),
    []
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto" data-testid="client-library">
      {/* Page Header */}
      <PageHeader
        title="Clients"
        description="Manage your client database with search, filtering, and status management."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Clients' }]}
        actions={
          <Button data-testid="new-client-button">
            <Plus className="h-4 w-4 mr-2" />
            New Client
          </Button>
        }
      />

      {/* Filter Bar */}
      <div className="glass-panel p-4 rounded-xl flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div className="flex flex-1 items-center gap-3 w-full sm:w-auto flex-wrap">
          {/* Search Input */}
          <div className="relative flex-1 sm:flex-initial sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
            <Input
              placeholder="Search clients..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 bg-background/50 border-white/10 focus:bg-background transition-all"
              data-testid="client-search"
            />
          </div>

          {/* Type Filter */}
          <Select value={type} onValueChange={(value) => setTypeFilter(value as ClientTypeFilter)}>
            <SelectTrigger className="w-32" data-testid="type-filter">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select
            value={status}
            onValueChange={(value) => setStatusFilter(value as ClientStatusFilter)}
          >
            <SelectTrigger className="w-32" data-testid="status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-muted-foreground"
              data-testid="clear-filters"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Results Count */}
        {!loading && (
          <div className="text-sm text-muted-foreground">
            {total} client{total !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {loading && clients.length === 0 ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            data-testid="loading-state"
          >
            {loadingSkeletons}
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-10"
            data-testid="error-state"
          >
            <EmptyState
              icon={Users}
              title="Failed to load clients"
              description="There was an error loading your clients. Please try again."
              action={{
                label: 'Retry',
                onClick: () => fetchClients(),
              }}
            />
          </motion.div>
        ) : clients.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="py-10"
            data-testid="empty-state"
          >
            <EmptyState
              icon={hasActiveFilters ? Search : Users}
              title={hasActiveFilters ? 'No clients match your filters' : 'No clients yet'}
              description={
                hasActiveFilters
                  ? 'Try adjusting your search or filter criteria'
                  : 'Add your first client to get started organizing your document processing.'
              }
              action={
                hasActiveFilters
                  ? {
                      label: 'Clear Filters',
                      onClick: handleClearFilters,
                      variant: 'outline',
                    }
                  : {
                      label: 'Add Client',
                      onClick: () => {
                        /* TODO: Open new client modal */
                      },
                      icon: Plus,
                    }
              }
            />
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            data-testid="clients-grid"
          >
            {clients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onArchive={handleArchive}
                onRestore={handleRestore}
                isArchiving={archivingId === client.id}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      {!loading && total > limit && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted-foreground">
            Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={prevPage}
              disabled={!hasPrev}
              data-testid="prev-page"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={nextPage}
              disabled={!hasNext}
              data-testid="next-page"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
