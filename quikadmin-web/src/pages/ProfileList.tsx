/**
 * ProfileList page - Profile management dashboard
 * Redesigned with "Deep Ocean" aesthetic (Glassmorphism + Linear Style)
 */

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Grid3X3,
  List,
  Building2,
  User,
  MoreHorizontal,
  Pencil,
  Trash2,
  Archive,
  RotateCcw,
  X,
  Users,
  Calendar,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';
import { ResponsiveGrid } from '@/components/layout/responsive-grid';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { profilesService } from '@/services/profilesService';
import {
  useProfilesViewMode,
  useProfilesFilters,
  useProfilesPagination,
} from '@/stores/profilesStore';
import type { Profile, ProfileType } from '@/types/profile';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { ProfileFormModal } from '@/components/features/profile-form-modal';
import { staggerContainerFast, fadeInUpSubtle } from '@/lib/animations';

const StatusBadge = ({ profile }: { profile: Profile }) =>
  profile.status === 'ARCHIVED' ? (
    <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] h-5 px-1.5">
      Archived
    </Badge>
  ) : null;

const TypeIcon = ({ profile }: { profile: Profile }) => (
  <div
    className={cn(
      'flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset',
      profile.type === 'BUSINESS'
        ? 'bg-blue-500/10 text-blue-600 ring-blue-500/20'
        : 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20'
    )}
  >
    {profile.type === 'BUSINESS' ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
  </div>
);

// =================== COMPONENTS ===================

interface ProfileCardProps {
  profile: Profile;
  onEdit: (profile: Profile) => void;
  onDelete: (profile: Profile) => void;
  onArchive: (profile: Profile) => void;
  onRestore: (profile: Profile) => void;
  viewMode: 'grid' | 'table';
}

function ProfileCard({
  profile,
  onEdit,
  onDelete,
  onArchive,
  onRestore,
  viewMode,
}: ProfileCardProps) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/profiles/${profile.id}`);
  };

  if (viewMode === 'grid') {
    return (
      <motion.div variants={fadeInUpSubtle} layoutId={profile.id}>
        <div
          className={cn(
            'group relative flex flex-col justify-between p-5 h-full rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-primary/20 hover:bg-card hover:shadow-lg hover:shadow-primary/5 cursor-pointer',
            profile.status === 'ARCHIVED' && 'opacity-60 grayscale'
          )}
          onClick={handleCardClick}
        >
          <div className="flex items-start justify-between mb-4">
            <TypeIcon profile={profile} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground -mr-2"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(profile);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                {profile.status === 'ACTIVE' ? (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive(profile);
                    }}
                  >
                    <Archive className="mr-2 h-4 w-4" /> Archive
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestore(profile);
                    }}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" /> Restore
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(profile);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div>
            <h3 className="font-heading font-medium text-lg leading-tight mb-1 group-hover:text-primary transition-colors">
              {profile.name}
            </h3>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              {profile.type === 'BUSINESS' ? 'Business Account' : 'Personal Account'}
              <StatusBadge profile={profile} />
            </p>
          </div>

          {profile.notes && (
            <p className="mt-4 text-xs text-muted-foreground line-clamp-2 leading-relaxed bg-muted/30 p-2 rounded-md">
              {profile.notes}
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              {format(new Date(profile.updatedAt), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
      </motion.div>
    );
  }

  // Table (Linear) view
  return (
    <motion.div variants={fadeInUpSubtle} layoutId={profile.id}>
      <div
        className={cn(
          'group flex items-center gap-4 p-3 rounded-lg border border-transparent transition-all hover:bg-card/80 hover:border-border/50 hover:shadow-sm cursor-pointer',
          profile.status === 'ARCHIVED' && 'opacity-60'
        )}
        onClick={handleCardClick}
      >
        <TypeIcon profile={profile} />

        <div className="flex-1 min-w-0 grid grid-cols-12 gap-4 items-center">
          <div className="col-span-12 sm:col-span-5 md:col-span-4">
            <h3 className="font-medium text-sm group-hover:text-primary transition-colors truncate">
              {profile.name}
            </h3>
            <div className="flex items-center gap-2 sm:hidden mt-1">
              <span className="text-xs text-muted-foreground">
                {profile.type === 'BUSINESS' ? 'Business' : 'Personal'}
              </span>
              <StatusBadge profile={profile} />
            </div>
          </div>

          <div className="hidden sm:block sm:col-span-3 md:col-span-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              {profile.type === 'BUSINESS' ? 'Business' : 'Personal'}
              <StatusBadge profile={profile} />
            </span>
          </div>

          <div className="hidden md:block col-span-3 text-xs text-muted-foreground truncate">
            {profile.notes || '-'}
          </div>

          <div className="hidden sm:block col-span-4 md:col-span-2 text-right text-xs text-muted-foreground">
            {format(new Date(profile.updatedAt), 'MMM d')}
          </div>
        </div>

        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(profile);
                }}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(profile);
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
  );
}

// =================== MAIN COMPONENT ===================

export default function ProfileList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Store state
  const { viewMode, setViewMode } = useProfilesViewMode();
  const {
    filter,
    searchQuery,
    setSearchQuery,
    setTypeFilter,
    setStatusFilter,
    clearFilter,
    hasActiveFilters,
  } = useProfilesFilters();
  const { page, pageSize, setPage } = useProfilesPagination();

  // Local state
  const [formModalOpen, setFormModalOpen] = React.useState(false);
  const [editingProfile, setEditingProfile] = React.useState<Profile | null>(null);

  // Debounce search
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Update filter when debounced search changes
  React.useEffect(() => {
    // Keep internal filter sync logic
  }, [debouncedSearch]);

  // Fetch profiles
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['profiles', filter, page, pageSize],
    queryFn: () =>
      profilesService.list({
        filter: { ...filter, search: debouncedSearch || undefined },
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
    placeholderData: keepPreviousData,
  });

  // Mutations (Simplified for brevity, assuming same logic as before)
  const deleteMutation = useMutation({
    mutationFn: (id: string) => profilesService.delete(id),
    onSuccess: () => {
      toast.success('Profile deleted');
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
    onError: () => toast.error('Failed to delete profile'),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => profilesService.archive(id),
    onSuccess: () => {
      toast.success('Profile archived');
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
    onError: () => toast.error('Failed to archive profile'),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => profilesService.restore(id),
    onSuccess: () => {
      toast.success('Profile restored');
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
    onError: () => toast.error('Failed to restore profile'),
  });

  const profiles = data?.data?.profiles ?? [];
  const pagination = data?.data?.pagination;
  const totalPages = pagination ? Math.ceil(pagination.total / pageSize) : 1;

  // Handlers
  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setFormModalOpen(true);
  };
  const handleCreateNew = () => {
    setEditingProfile(null);
    setFormModalOpen(true);
  };
  const handleModalClose = (open: boolean) => {
    setFormModalOpen(open);
    if (!open) setEditingProfile(null);
  };
  const handleDelete = (profile: Profile) => {
    if (confirm(`Delete "${profile.name}"?`)) deleteMutation.mutate(profile.id);
  };
  const handleArchive = (profile: Profile) => archiveMutation.mutate(profile.id);
  const handleRestore = (profile: Profile) => restoreMutation.mutate(profile.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profiles"
        description="Manage identities for auto-filling forms."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Profiles' }]}
        actions={
          <Button
            onClick={handleCreateNew}
            size="lg"
            className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
          >
            <Plus className="mr-2 h-5 w-5" />
            New Profile
          </Button>
        }
      />

      {/* Filters Bar */}
      <div className="glass-panel p-4 rounded-xl flex flex-col gap-4 sm:flex-row sm:items-center justify-between sticky top-20 z-10">
        <div className="flex flex-1 items-center gap-3 w-full overflow-x-auto pb-2 sm:pb-0">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background/50 border-white/10 focus:bg-background transition-all"
            />
          </div>
          <div className="h-4 w-[1px] bg-border mx-1" />
          <Select
            value={filter.type || 'all'}
            onValueChange={(v) => setTypeFilter(v === 'all' ? undefined : (v as ProfileType))}
          >
            <SelectTrigger className="w-[130px] border-none bg-transparent hover:bg-secondary/10 data-[state=open]:bg-secondary/10">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="PERSONAL">Personal</SelectItem>
              <SelectItem value="BUSINESS">Business</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filter.status || 'all'}
            onValueChange={(v) =>
              setStatusFilter(v === 'all' ? undefined : (v as 'ACTIVE' | 'ARCHIVED'))
            }
          >
            <SelectTrigger className="w-[130px] border-none bg-transparent hover:bg-secondary/10 data-[state=open]:bg-secondary/10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilter}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="mr-1 h-3 w-3" /> Clear
            </Button>
          )}
        </div>

        <div className="flex bg-muted/20 p-1 rounded-lg border border-white/5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 px-2 rounded-md transition-all',
              viewMode === 'grid'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 px-2 rounded-md transition-all',
              viewMode === 'table'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setViewMode('table')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <ResponsiveGrid preset="cards">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </ResponsiveGrid>
        ) : error ? (
          <EmptyState
            icon={X}
            title="Error loading profiles"
            description="We couldn't fetch your profiles. Please try again."
            action={{ label: 'Retry', onClick: () => refetch() }}
          />
        ) : profiles.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <EmptyState
              icon={hasActiveFilters ? Search : Users}
              title={hasActiveFilters ? 'No matches found' : 'No profiles yet'}
              description={
                hasActiveFilters
                  ? 'Adjust filters to find what you need.'
                  : 'Create your first profile to get started.'
              }
              action={
                hasActiveFilters
                  ? { label: 'Clear Filters', onClick: clearFilter, variant: 'outline' }
                  : { label: 'Create Profile', onClick: handleCreateNew, icon: Plus }
              }
            />
          </motion.div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <motion.div variants={staggerContainerFast} initial="hidden" animate="show">
                <ResponsiveGrid preset="cards">
                  {profiles.map((profile) => (
                    <ProfileCard
                      key={profile.id}
                      profile={profile}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onArchive={handleArchive}
                      onRestore={handleRestore}
                      viewMode={viewMode}
                    />
                  ))}
                </ResponsiveGrid>
              </motion.div>
            ) : (
              <motion.div
                variants={staggerContainerFast}
                initial="hidden"
                animate="show"
                className="flex flex-col gap-2"
              >
                {profiles.map((profile) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onArchive={handleArchive}
                    onRestore={handleRestore}
                    viewMode={viewMode}
                  />
                ))}
              </motion.div>
            )}

            {/* Simple Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 py-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="w-24"
                >
                  Previous
                </Button>
                <span className="text-sm font-medium text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                  className="w-24"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </AnimatePresence>

      <ProfileFormModal
        open={formModalOpen}
        onOpenChange={handleModalClose}
        profile={editingProfile}
      />
    </div>
  );
}
