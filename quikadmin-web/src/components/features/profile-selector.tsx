/**
 * ProfileSelector - Component for selecting a profile during form fill workflow
 * B2C-focused: Allows users to choose which profile's data to use for auto-filling
 * @module components/features/profile-selector
 */

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2, User, Plus, ChevronDown, Check, RefreshCw, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

import { profilesService } from '@/services/profilesService';
import type { Profile } from '@/types/profile';
import { getProfileTypeLabel } from '@/types/profile';
import { cn } from '@/lib/utils';

// =================== TYPES ===================

export interface ProfileSelectorProps {
  /**
   * Currently selected profile
   */
  selectedProfile: Profile | null;
  /**
   * Callback when profile selection changes
   */
  onProfileChange: (profile: Profile | null) => void;
  /**
   * Whether the selector is disabled
   */
  disabled?: boolean;
  /**
   * Optional className for styling
   */
  className?: string;
  /**
   * Show compact variant
   */
  compact?: boolean;
}

// =================== PROFILE OPTION ITEM ===================

interface ProfileOptionProps {
  profile: Profile;
  isSelected: boolean;
  onSelect: () => void;
}

function ProfileOption({ profile, isSelected, onSelect }: ProfileOptionProps) {
  return (
    <DropdownMenuItem
      onClick={onSelect}
      className={cn('flex items-center gap-3 p-3 cursor-pointer', isSelected && 'bg-accent')}
    >
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0',
          profile.type === 'BUSINESS'
            ? 'bg-primary/10 text-primary'
            : 'bg-status-success/10 text-status-success-foreground'
        )}
      >
        {profile.type === 'BUSINESS' ? (
          <Building2 className="h-4 w-4" />
        ) : (
          <User className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{profile.name}</div>
        <div className="text-xs text-muted-foreground">{getProfileTypeLabel(profile.type)}</div>
      </div>
      {isSelected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
    </DropdownMenuItem>
  );
}

// =================== MAIN COMPONENT ===================

export function ProfileSelector({
  selectedProfile,
  onProfileChange,
  disabled = false,
  className,
  compact = false,
}: ProfileSelectorProps) {
  const navigate = useNavigate();
  const [showNoProfilesDialog, setShowNoProfilesDialog] = React.useState(false);

  // Fetch active profiles
  const {
    data: profilesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['profiles-for-selector'],
    queryFn: () =>
      profilesService.list({
        filter: { status: 'ACTIVE' },
        limit: 50,
      }),
    staleTime: 60000, // Cache for 1 minute
  });

  const profiles = profilesData?.data?.profiles ?? [];

  // Handle auto-select and no profiles dialog (v5: onSuccess moved to useEffect)
  React.useEffect(() => {
    if (profilesData) {
      // Auto-select first profile if none selected and profiles exist
      if (!selectedProfile && profilesData.data.profiles.length > 0) {
        onProfileChange(profilesData.data.profiles[0]);
      }
      // Show dialog if no profiles
      if (profilesData.data.profiles.length === 0) {
        setShowNoProfilesDialog(true);
      }
    }
  }, [profilesData, selectedProfile, onProfileChange]);

  const handleCreateProfile = () => {
    setShowNoProfilesDialog(false);
    navigate('/profiles');
  };

  const handleSelectProfile = (profile: Profile) => {
    onProfileChange(profile);
  };

  const handleChangeProfile = () => {
    // Open dropdown by triggering its open state
    // This is handled by the dropdown itself
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="text-destructive">
          <RefreshCw className="mr-2 h-4 w-4" />
          Failed to load profiles. Retry
        </Button>
      </div>
    );
  }

  // No profiles state
  if (profiles.length === 0) {
    return (
      <>
        <Card className={cn('border-dashed', className)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="font-medium">No Profiles</div>
                <div className="text-sm text-muted-foreground">Create a profile to get started</div>
              </div>
              <Button size="sm" onClick={handleCreateProfile}>
                <Plus className="mr-2 h-4 w-4" />
                Create Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showNoProfilesDialog} onOpenChange={setShowNoProfilesDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>No Profiles Found</DialogTitle>
              <DialogDescription>
                You need to create a profile before you can fill forms. Profiles store your personal
                or business information that will be used to auto-fill forms.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNoProfilesDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateProfile}>
                <Plus className="mr-2 h-4 w-4" />
                Create Profile
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Compact variant - just a dropdown button
  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <Button variant="outline" className={cn('justify-between', className)}>
            <span className="flex items-center gap-2">
              {selectedProfile ? (
                <>
                  {selectedProfile.type === 'BUSINESS' ? (
                    <Building2 className="h-4 w-4" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                  {selectedProfile.name}
                </>
              ) : (
                'Select Profile'
              )}
            </span>
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Select Profile</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {profiles.map((profile) => (
            <ProfileOption
              key={profile.id}
              profile={profile}
              isSelected={selectedProfile?.id === profile.id}
              onSelect={() => handleSelectProfile(profile)}
            />
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCreateProfile}>
            <Plus className="mr-2 h-4 w-4" />
            Create New Profile
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Full variant - card with selected profile info and change button
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {selectedProfile ? (
            <>
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full flex-shrink-0',
                  selectedProfile.type === 'BUSINESS'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-status-success/10 text-status-success-foreground'
                )}
              >
                {selectedProfile.type === 'BUSINESS' ? (
                  <Building2 className="h-6 w-6" />
                ) : (
                  <User className="h-6 w-6" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-muted-foreground">Using profile</div>
                <div className="font-semibold truncate">{selectedProfile.name}</div>
                <div className="text-xs text-muted-foreground">
                  {getProfileTypeLabel(selectedProfile.type)}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted flex-shrink-0">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-muted-foreground">No profile selected</div>
                <div className="font-medium">Select a profile</div>
              </div>
            </>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={disabled}>
              <Button variant="outline" size="sm">
                {selectedProfile ? 'Change' : 'Select'}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Select Profile</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {profiles.map((profile) => (
                <ProfileOption
                  key={profile.id}
                  profile={profile}
                  isSelected={selectedProfile?.id === profile.id}
                  onSelect={() => handleSelectProfile(profile)}
                />
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCreateProfile}>
                <Plus className="mr-2 h-4 w-4" />
                Create New Profile
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

export default ProfileSelector;
