/**
 * ProfileDetail page - View and edit a single profile
 * B2C-focused: Profiles represent different identities a user fills forms for
 * Features: Profile info, stored field data (placeholder), form fill history (placeholder), edit mode
 * @module pages/ProfileDetail
 */

import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Building2,
  User,
  Pencil,
  Trash2,
  Archive,
  RotateCcw,
  Save,
  X,
  FileText,
  Clock,
  Database,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState, EmptyStateSimple } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import { profilesService } from '@/services/profilesService';
import { ProfileFieldsManager } from '@/components/features/profile-fields-manager';
import { FormFillHistoryCard } from '@/components/features/form-fill-history-card';
import type { Profile, ProfileFormData, ProfileWithData } from '@/types/profile';
import { profileFormSchema, getProfileTypeLabel } from '@/types/profile';
import { cn } from '@/lib/utils';

// =================== LOADING SKELETON ===================

function ProfileDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Basic Info Card skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>

      {/* Other sections skeleton */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// =================== NOT FOUND STATE ===================

interface ProfileNotFoundProps {
  onBack: () => void;
}

function ProfileNotFound({ onBack }: ProfileNotFoundProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile Not Found"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Profiles', href: '/profiles' },
          { label: 'Not Found' },
        ]}
      />
      <EmptyState
        icon={User}
        title="Profile not found"
        description="The profile you're looking for doesn't exist or you don't have access to it."
        action={{
          label: 'Back to Profiles',
          onClick: onBack,
          icon: ArrowLeft,
        }}
      />
    </div>
  );
}

// =================== STORED FIELDS SECTION ===================

interface StoredFieldsSectionProps {
  profileId: string;
  profileData?: ProfileWithData['profileData'];
  onFieldsUpdate?: (fields: Record<string, any>) => void;
  isLoading?: boolean;
}

function StoredFieldsSection({ profileId, profileData, onFieldsUpdate, isLoading }: StoredFieldsSectionProps) {
  // Extract fields and sources from profileData
  const fields = profileData?.data || {};
  const fieldSources = profileData?.fieldSources || {};

  return (
    <ProfileFieldsManager
      profileId={profileId}
      fields={fields}
      fieldSources={fieldSources}
      isLoading={isLoading}
      onFieldsUpdate={onFieldsUpdate}
      editable={true}
    />
  );
}

// =================== FORM FILL HISTORY SECTION ===================

interface FormFillHistorySectionProps {
  profileId: string;
}

function FormFillHistorySection({ profileId }: FormFillHistorySectionProps) {
  return (
    <FormFillHistoryCard
      profileId={profileId}
      limit={5}
      compact={false}
    />
  );
}

// =================== PROFILE INFO SECTION ===================

interface ProfileInfoSectionProps {
  profile: Profile;
  isEditing: boolean;
  form: ReturnType<typeof useForm<ProfileFormData>>;
  onSave: (data: ProfileFormData) => void;
  isSaving: boolean;
}

function ProfileInfoSection({
  profile,
  isEditing,
  form,
  onSave,
  isSaving,
}: ProfileInfoSectionProps) {
  if (isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Edit Profile Information</CardTitle>
          <CardDescription>
            Update the basic information for this profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Personal, Spouse, Business LLC"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        A descriptive name for this profile
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PERSONAL">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Personal
                            </div>
                          </SelectItem>
                          <SelectItem value="BUSINESS">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              Business
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Personal or business profile type
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional notes about this profile"
                        rows={3}
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Add any additional information about this profile
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>
          Basic information about this profile
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Name</dt>
            <dd className="text-base">{profile.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Type</dt>
            <dd className="text-base flex items-center gap-2">
              {profile.type === 'BUSINESS' ? (
                <Building2 className="h-4 w-4 text-blue-600" />
              ) : (
                <User className="h-4 w-4 text-green-600" />
              )}
              {getProfileTypeLabel(profile.type)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Status</dt>
            <dd>
              <Badge variant={profile.status === 'ACTIVE' ? 'default' : 'secondary'}>
                {profile.status}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Created</dt>
            <dd className="text-base">
              {format(new Date(profile.createdAt), 'PPP')}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Last Updated</dt>
            <dd className="text-base">
              {format(new Date(profile.updatedAt), 'PPP')}
            </dd>
          </div>
          {profile.notes && (
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-muted-foreground">Notes</dt>
              <dd className="text-base whitespace-pre-wrap">{profile.notes}</dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

// =================== MAIN COMPONENT ===================

export default function ProfileDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Edit mode state
  const [isEditing, setIsEditing] = React.useState(false);

  // Form for editing
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      type: 'PERSONAL',
      notes: null,
    },
  });

  // Fetch profile data with profile data (fields)
  const {
    data: profileWithData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['profile', id],
    queryFn: () => profilesService.getWithData(id!),
    enabled: !!id,
  });

  // Handle form reset when data loads (v5: onSuccess moved to useEffect)
  React.useEffect(() => {
    if (profileWithData) {
      form.reset({
        name: profileWithData.name,
        type: profileWithData.type,
        notes: profileWithData.notes,
      });
    }
  }, [profileWithData, form]);

  // Extract profile for easier access
  const profile = profileWithData;

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: ProfileFormData) => profilesService.update(id!, data),
    onSuccess: (updatedProfile) => {
      toast.success('Profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.setQueryData(['profile', id], updatedProfile);
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update profile');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => profilesService.delete(id!),
    onSuccess: () => {
      toast.success('Profile deleted');
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      navigate('/profiles');
    },
    onError: () => {
      toast.error('Failed to delete profile');
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: () => profilesService.archive(id!),
    onSuccess: (updatedProfile) => {
      toast.success('Profile archived');
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.setQueryData(['profile', id], updatedProfile);
    },
    onError: () => {
      toast.error('Failed to archive profile');
    },
  });

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: () => profilesService.restore(id!),
    onSuccess: (updatedProfile) => {
      toast.success('Profile restored');
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.setQueryData(['profile', id], updatedProfile);
    },
    onError: () => {
      toast.error('Failed to restore profile');
    },
  });

  const handleBack = () => {
    navigate('/profiles');
  };

  const handleStartEditing = () => {
    if (profile) {
      form.reset({
        name: profile.name,
        type: profile.type,
        notes: profile.notes,
      });
    }
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    if (profile) {
      form.reset({
        name: profile.name,
        type: profile.type,
        notes: profile.notes,
      });
    }
    setIsEditing(false);
  };

  const handleSave = (data: ProfileFormData) => {
    updateMutation.mutate(data);
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const handleArchive = () => {
    archiveMutation.mutate();
  };

  const handleRestore = () => {
    restoreMutation.mutate();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Loading..."
          breadcrumbs={[
            { label: 'Home', href: '/' },
            { label: 'Profiles', href: '/profiles' },
            { label: 'Loading...' },
          ]}
          actions={
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          }
        />
        <ProfileDetailSkeleton />
      </div>
    );
  }

  // Error state (including not found)
  if (error || !profile) {
    return <ProfileNotFound onBack={handleBack} />;
  }

  // Render profile detail
  return (
    <div className="space-y-6">
      <PageHeader
        title={profile.name}
        description={`${getProfileTypeLabel(profile.type)} profile`}
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Profiles', href: '/profiles' },
          { label: profile.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            {isEditing ? (
              <Button variant="outline" onClick={handleCancelEditing}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleStartEditing}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>

                {profile.status === 'ACTIVE' ? (
                  <Button
                    variant="outline"
                    onClick={handleArchive}
                    disabled={archiveMutation.isPending}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleRestore}
                    disabled={restoreMutation.isPending}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restore
                  </Button>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Profile</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{profile.name}"? This action cannot be undone.
                        All stored field data associated with this profile will also be deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        }
      />

      {/* Profile header with icon */}
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'flex h-16 w-16 items-center justify-center rounded-full',
            profile.type === 'BUSINESS'
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
              : 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300'
          )}
        >
          {profile.type === 'BUSINESS' ? (
            <Building2 className="h-8 w-8" />
          ) : (
            <User className="h-8 w-8" />
          )}
        </div>
        <div>
          <h2 className="text-2xl font-semibold">{profile.name}</h2>
          <p className="text-muted-foreground">
            {getProfileTypeLabel(profile.type)} Profile
            {profile.status === 'ARCHIVED' && (
              <Badge variant="secondary" className="ml-2">
                Archived
              </Badge>
            )}
          </p>
        </div>
      </div>

      {/* Profile Information Section */}
      <ProfileInfoSection
        profile={profile}
        isEditing={isEditing}
        form={form}
        onSave={handleSave}
        isSaving={updateMutation.isPending}
      />

      {/* Two-column layout for additional sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Stored Field Data Section */}
        <StoredFieldsSection
          profileId={id!}
          profileData={profileWithData?.profileData}
        />

        {/* Form Fill History Section (Placeholder) */}
        <FormFillHistorySection profileId={id!} />
      </div>
    </div>
  );
}
