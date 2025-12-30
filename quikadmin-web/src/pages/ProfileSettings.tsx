import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  User,
  Mail,
  Phone,
  MapPin,
  RefreshCw,
  Plus,
  Search,
  Calendar,
  CreditCard,
  AlertCircle,
  Loader2,
  Download,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

import { ProfileFieldEditor } from '@/components/features/profile-field-editor';
import {
  getProfile,
  updateProfileField,
  deleteProfileField,
  refreshProfile,
  deleteProfile,
  UserProfile,
  ProfileFieldValue,
} from '@/services/userProfileService';
import { addCustomFieldSchema, AddCustomFieldInput } from '@/lib/validations/profile';

export default function ProfileSettings() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddFieldOpen, setIsAddFieldOpen] = useState(false);
  const [updatingField, setUpdatingField] = useState<string | null>(null);
  const [deletingField, setDeletingField] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Fetch profile data
  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useQuery<UserProfile>({
    queryKey: ['userProfile'],
    queryFn: getProfile,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Refresh profile mutation
  const refreshMutation = useMutation({
    mutationFn: refreshProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      toast.success('Profile Refreshed', {
        description: 'Your profile has been refreshed with the latest data.',
      });
    },
    onError: (error: any) => {
      toast.error('Refresh Failed', {
        description: error.message || 'Failed to refresh profile',
      });
    },
  });

  // Delete profile mutation
  const deleteProfileMutation = useMutation({
    mutationFn: deleteProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      toast.success('Profile Deleted', {
        description: 'Your profile has been deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast.error('Delete Failed', {
        description: error.message || 'Failed to delete profile',
      });
    },
  });

  // Update field mutation
  const updateFieldMutation = useMutation({
    mutationFn: ({ fieldKey, value }: { fieldKey: string; value: string }) =>
      updateProfileField(fieldKey, value),
    onMutate: ({ fieldKey }) => {
      setUpdatingField(fieldKey);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
    onError: (error: any) => {
      // Error is handled in ProfileFieldEditor
      console.error('Update field error:', error);
    },
    onSettled: () => {
      setUpdatingField(null);
    },
  });

  // Delete field mutation
  const deleteFieldMutation = useMutation({
    mutationFn: (fieldKey: string) => deleteProfileField(fieldKey),
    onMutate: (fieldKey) => {
      setDeletingField(fieldKey);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
    onError: (error: any) => {
      // Error is handled in ProfileFieldEditor
      console.error('Delete field error:', error);
    },
    onSettled: () => {
      setDeletingField(null);
    },
  });

  // Add custom field form
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AddCustomFieldInput>({
    resolver: zodResolver(addCustomFieldSchema),
  });

  // Handle add custom field
  const onAddCustomField = async (data: AddCustomFieldInput) => {
    try {
      await updateFieldMutation.mutateAsync({
        fieldKey: data.fieldName.toLowerCase().replace(/\s+/g, '_'),
        value: data.fieldValue,
      });
      setIsAddFieldOpen(false);
      reset();
      toast.success('Field Added', {
        description: `${data.fieldName} has been added to your profile.`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add field';
      toast.error('Add Field Failed', {
        description: errorMessage,
      });
    }
  };
  // Categorize fields
  // Extract profileFields to a stable variable for React Compiler memoization compatibility
  const profileFields = profile?.fields;
  const categorizedFields = useMemo(() => {
    if (!profileFields) return { personal: [], contact: [], address: [], custom: [] };

    const personal: ProfileFieldValue[] = [];
    const contact: ProfileFieldValue[] = [];
    const address: ProfileFieldValue[] = [];
    const custom: ProfileFieldValue[] = [];

    const personalKeys = [
      'firstname',
      'first_name',
      'lastname',
      'last_name',
      'middlename',
      'middle_name',
      'dateofbirth',
      'date_of_birth',
      'dob',
      'ssn',
      'social_security',
    ];
    const contactKeys = ['email', 'phone', 'mobile', 'telephone', 'tel', 'fax'];
    const addressKeys = [
      'street',
      'street2',
      'address',
      'city',
      'state',
      'zip',
      'zipcode',
      'postal',
      'country',
    ];

    profileFields.forEach((field) => {
      const normalizedKey = field.key.toLowerCase();

      if (personalKeys.some((k) => normalizedKey.includes(k))) {
        personal.push(field);
      } else if (contactKeys.some((k) => normalizedKey.includes(k))) {
        contact.push(field);
      } else if (addressKeys.some((k) => normalizedKey.includes(k))) {
        address.push(field);
      } else {
        custom.push(field);
      }
    });

    return { personal, contact, address, custom };
  }, [profileFields]);

  // Filter fields based on search
  const filterFields = (fields: ProfileFieldValue[]) => {
    if (!searchQuery) return fields;
    const query = searchQuery.toLowerCase();
    return fields.filter(
      (field) =>
        field.key.toLowerCase().includes(query) ||
        field.values.some((v) => v.toLowerCase().includes(query))
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full max-w-md" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
          <p className="text-muted-foreground">
            Manage your stored profile data extracted from documents
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Profile</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Failed to load profile data'}
          </AlertDescription>
        </Alert>
        <Button onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  // Empty state
  if (!profile || profile.fields.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
          <p className="text-muted-foreground">
            Manage your stored profile data extracted from documents
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Profile Data</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              Your profile is empty. Upload and process documents to automatically extract profile
              information, or add fields manually.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => refreshMutation.mutate()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Profile
              </Button>
              <Button variant="outline" onClick={() => setIsAddFieldOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Field
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your stored profile data extracted from documents
        </p>
      </div>

      {/* Profile Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fields</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.fields.length}</div>
            <p className="text-xs text-muted-foreground">
              Extracted from {profile.documentCount} document
              {profile.documentCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Date(profile.lastAggregated).toLocaleDateString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(profile.lastAggregated).toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Confidence</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(
                profile.fields.reduce((sum, f) => sum + f.confidence, 0) / profile.fields.length
              ).toFixed(1)}
              %
            </div>
            <p className="text-xs text-muted-foreground">Data accuracy score</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            {refreshMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Dialog open={isAddFieldOpen} onOpenChange={setIsAddFieldOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Field
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Custom Field</DialogTitle>
                <DialogDescription>Add a new field to your profile manually</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onAddCustomField)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fieldName">Field Name</Label>
                  <Input
                    id="fieldName"
                    placeholder="e.g., Driver License"
                    {...register('fieldName')}
                  />
                  {errors.fieldName && (
                    <p className="text-sm text-destructive">{errors.fieldName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fieldValue">Field Value</Label>
                  <Input id="fieldValue" placeholder="Enter value" {...register('fieldValue')} />
                  {errors.fieldValue && (
                    <p className="text-sm text-destructive">{errors.fieldValue.message}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddFieldOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateFieldMutation.isPending}>
                    {updateFieldMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Add Field'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Profile Fields - Categorized Tabs */}
      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="personal">
            <User className="mr-2 h-4 w-4" />
            Personal ({categorizedFields.personal.length})
          </TabsTrigger>
          <TabsTrigger value="contact">
            <Mail className="mr-2 h-4 w-4" />
            Contact ({categorizedFields.contact.length})
          </TabsTrigger>
          <TabsTrigger value="address">
            <MapPin className="mr-2 h-4 w-4" />
            Address ({categorizedFields.address.length})
          </TabsTrigger>
          <TabsTrigger value="custom">
            <CreditCard className="mr-2 h-4 w-4" />
            Custom ({categorizedFields.custom.length})
          </TabsTrigger>
        </TabsList>

        {/* Personal Information */}
        <TabsContent value="personal">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Basic personal details extracted from your documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {filterFields(categorizedFields.personal).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No personal information fields found
                </p>
              ) : (
                filterFields(categorizedFields.personal).map((field) => (
                  <ProfileFieldEditor
                    key={field.key}
                    field={field}
                    onUpdate={async (key, value) => {
                      await updateFieldMutation.mutateAsync({ fieldKey: key, value });
                    }}
                    onDelete={async (key) => {
                      await deleteFieldMutation.mutateAsync(key);
                    }}
                    isUpdating={updatingField === field.key}
                    isDeleting={deletingField === field.key}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Information */}
        <TabsContent value="contact">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>
                Email addresses, phone numbers, and other contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {filterFields(categorizedFields.contact).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No contact information fields found
                </p>
              ) : (
                filterFields(categorizedFields.contact).map((field) => (
                  <ProfileFieldEditor
                    key={field.key}
                    field={field}
                    onUpdate={async (key, value) => {
                      await updateFieldMutation.mutateAsync({ fieldKey: key, value });
                    }}
                    onDelete={async (key) => {
                      await deleteFieldMutation.mutateAsync(key);
                    }}
                    isUpdating={updatingField === field.key}
                    isDeleting={deletingField === field.key}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Address Information */}
        <TabsContent value="address">
          <Card>
            <CardHeader>
              <CardTitle>Address Information</CardTitle>
              <CardDescription>
                Residential and mailing addresses from your documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {filterFields(categorizedFields.address).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No address information fields found
                </p>
              ) : (
                filterFields(categorizedFields.address).map((field) => (
                  <ProfileFieldEditor
                    key={field.key}
                    field={field}
                    onUpdate={async (key, value) => {
                      await updateFieldMutation.mutateAsync({ fieldKey: key, value });
                    }}
                    onDelete={async (key) => {
                      await deleteFieldMutation.mutateAsync(key);
                    }}
                    isUpdating={updatingField === field.key}
                    isDeleting={deletingField === field.key}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Fields */}
        <TabsContent value="custom">
          <Card>
            <CardHeader>
              <CardTitle>Custom Fields</CardTitle>
              <CardDescription>
                Additional fields and custom data not in standard categories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {filterFields(categorizedFields.custom).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No custom fields found
                </p>
              ) : (
                filterFields(categorizedFields.custom).map((field) => (
                  <ProfileFieldEditor
                    key={field.key}
                    field={field}
                    onUpdate={async (key, value) => {
                      await updateFieldMutation.mutateAsync({ fieldKey: key, value });
                    }}
                    onDelete={async (key) => {
                      await deleteFieldMutation.mutateAsync(key);
                    }}
                    isUpdating={updatingField === field.key}
                    isDeleting={deletingField === field.key}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions that affect your entire profile</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Entire Profile
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your aggregated profile
                  data. Your documents will remain intact and can be used to regenerate your profile
                  later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteProfileMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, Delete Profile
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
