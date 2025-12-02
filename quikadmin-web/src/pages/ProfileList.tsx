/**
 * ProfileList page - Profile management dashboard
 * B2C-focused: Profiles represent different identities a user fills forms for
 * Features: Search, filters, grid/table view, pagination, new profile modal
 * @module pages/ProfileList
 */

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Plus,
  Search,
  Grid3X3,
  List,
  Building2,
  User,
  MoreVertical,
  Pencil,
  Trash2,
  Archive,
  RotateCcw,
  X,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';
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
  useProfilesStore,
  useProfilesViewMode,
  useProfilesFilters,
  useProfilesPagination,
} from '@/stores/profilesStore';
import type { Profile, ProfileType } from '@/types/profile';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { ProfileFormModal } from '@/components/features/profile-form-modal';

// =================== PROFILE CARD COMPONENT ===================

interface ProfileCardProps {
  profile: Profile;
  onEdit: (profile: Profile) => void;
  onDelete: (profile: Profile) => void;
  onArchive: (profile: Profile) => void;
  onRestore: (profile: Profile) => void;
}

function ProfileCard({ profile, onEdit, onDelete, onArchive, onRestore }: ProfileCardProps) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/profiles/${profile.id}`);
  };

  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all hover:shadow-md',
        profile.status === 'ARCHIVED' && 'opacity-60'
      )}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full',
                profile.type === 'BUSINESS'
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                  : 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300'
              )}
            >
              {profile.type === 'BUSINESS' ? (
                <Building2 className="h-5 w-5" />
              ) : (
                <User className="h-5 w-5" />
              )}
            </div>
            <div>
              <CardTitle className="text-base font-medium">{profile.name}</CardTitle>
              <CardDescription className="text-xs">
                {profile.type === 'BUSINESS' ? 'Business' : 'Personal'}
              </CardDescription>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(profile); }}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              {profile.status === 'ACTIVE' ? (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(profile); }}>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRestore(profile); }}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restore
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(profile); }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            {profile.notes && (
              <span className="text-xs truncate max-w-[150px]">{profile.notes}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {profile.status === 'ARCHIVED' && (
              <Badge variant="secondary" className="text-xs">
                Archived
              </Badge>
            )}
            <span className="text-xs">
              {format(new Date(profile.updatedAt), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =================== MAIN COMPONENT ===================

export default function ProfileList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Store state
  const { viewMode, setViewMode } = useProfilesViewMode();
  const { filter, searchQuery, setSearchQuery, setTypeFilter, setStatusFilter, clearFilter, hasActiveFilters } = useProfilesFilters();
  const { page, pageSize, setPage } = useProfilesPagination();

  // Local state
  const [formModalOpen, setFormModalOpen] = React.useState(false);
  const [editingProfile, setEditingProfile] = React.useState<Profile | null>(null);

  // Debounce search
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Update filter when debounced search changes
  React.useEffect(() => {
    if (debouncedSearch !== filter.search) {
      // Filter is already updated in setSearchQuery
    }
  }, [debouncedSearch]);

  // Fetch profiles
  const { data, isLoading, error, refetch } = useQuery(
    ['profiles', filter, page, pageSize],
    () => profilesService.list({
      filter: { ...filter, search: debouncedSearch || undefined },
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    {
      keepPreviousData: true,
    }
  );

  // Delete mutation
  const deleteMutation = useMutation(
    (id: string) => profilesService.delete(id),
    {
      onSuccess: () => {
        toast.success('Profile deleted');
        queryClient.invalidateQueries(['profiles']);
      },
      onError: () => {
        toast.error('Failed to delete profile');
      },
    }
  );

  // Archive mutation
  const archiveMutation = useMutation(
    (id: string) => profilesService.archive(id),
    {
      onSuccess: () => {
        toast.success('Profile archived');
        queryClient.invalidateQueries(['profiles']);
      },
      onError: () => {
        toast.error('Failed to archive profile');
      },
    }
  );

  // Restore mutation
  const restoreMutation = useMutation(
    (id: string) => profilesService.restore(id),
    {
      onSuccess: () => {
        toast.success('Profile restored');
        queryClient.invalidateQueries(['profiles']);
      },
      onError: () => {
        toast.error('Failed to restore profile');
      },
    }
  );

  const profiles = data?.data?.profiles ?? [];
  const pagination = data?.data?.pagination;
  const totalPages = pagination ? Math.ceil(pagination.total / pageSize) : 1;

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
    if (!open) {
      setEditingProfile(null);
    }
  };

  const handleDelete = (profile: Profile) => {
    if (window.confirm(`Are you sure you want to delete "${profile.name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(profile.id);
    }
  };

  const handleArchive = (profile: Profile) => {
    archiveMutation.mutate(profile.id);
  };

  const handleRestore = (profile: Profile) => {
    restoreMutation.mutate(profile.id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profiles"
        description="Manage profiles for different people or entities you fill forms for"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Profiles' },
        ]}
        actions={
          <Button onClick={handleCreateNew}>
            <Plus className="mr-2 h-4 w-4" />
            New Profile
          </Button>
        }
      />

      {/* Filters and Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search profiles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            value={filter.type || 'all'}
            onValueChange={(v) => setTypeFilter(v === 'all' ? undefined : v as ProfileType)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="PERSONAL">Personal</SelectItem>
              <SelectItem value="BUSINESS">Business</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filter.status || 'all'}
            onValueChange={(v) => setStatusFilter(v === 'all' ? undefined : v as 'ACTIVE' | 'ARCHIVED')}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilter}>
              <X className="mr-1 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setViewMode('table')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={X}
          title="Error loading profiles"
          description="There was a problem loading your profiles. Please try again."
          action={{
            label: "Try Again",
            onClick: () => refetch(),
          }}
        />
      ) : profiles.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon={Users}
            title="No profiles found"
            description="Try adjusting your filters or search query."
            action={{
              label: "Clear Filters",
              onClick: clearFilter,
              variant: "outline",
            }}
          />
        ) : (
          <EmptyState
            icon={Users}
            title="No profiles yet"
            description="Create profiles to store information for yourself, family members, or business entities. This data will be used to auto-fill forms."
            action={{
              label: "Create Profile",
              onClick: handleCreateNew,
              icon: Plus,
            }}
          />
        )
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {profiles.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onArchive={handleArchive}
                  onRestore={handleRestore}
                />
              ))}
            </div>
          ) : (
            <Card>
              <div className="divide-y">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/profiles/${profile.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full',
                          profile.type === 'BUSINESS'
                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                            : 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300'
                        )}
                      >
                        {profile.type === 'BUSINESS' ? (
                          <Building2 className="h-5 w-5" />
                        ) : (
                          <User className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{profile.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {profile.type === 'BUSINESS' ? 'Business' : 'Personal'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {profile.status === 'ARCHIVED' && (
                        <Badge variant="secondary">Archived</Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(profile.updatedAt), 'MMM d, yyyy')}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(profile); }}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          {profile.status === 'ACTIVE' ? (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchive(profile); }}>
                              <Archive className="mr-2 h-4 w-4" />
                              Archive
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRestore(profile); }}>
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Restore
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleDelete(profile); }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, pagination?.total ?? 0)} of {pagination?.total ?? 0} profiles
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Profile Form Modal (Create/Edit) */}
      <ProfileFormModal
        open={formModalOpen}
        onOpenChange={handleModalClose}
        profile={editingProfile}
      />
    </div>
  );
}
