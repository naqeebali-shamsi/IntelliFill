/**
 * ProfileFormModal - Unified modal for creating and editing profiles
 * B2C-focused: Profiles represent different identities a user fills forms for
 * Uses React Hook Form with Zod validation
 * @module components/features/profile-form-modal
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from 'react-query';
import { toast } from 'sonner';
import { Building2, User } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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

import { profilesService } from '@/services/profilesService';
import type { Profile, ProfileFormData } from '@/types/profile';
import { profileFormSchema } from '@/types/profile';

export interface ProfileFormModalProps {
  /**
   * Whether the modal is open
   */
  open: boolean;
  /**
   * Callback when modal open state changes
   */
  onOpenChange: (open: boolean) => void;
  /**
   * Profile to edit (if editing mode)
   */
  profile?: Profile | null;
  /**
   * Callback when form is successfully submitted
   */
  onSuccess?: () => void;
}

/**
 * ProfileFormModal component for creating and editing profiles.
 *
 * @example
 * // Create mode
 * <ProfileFormModal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   onSuccess={() => refetch()}
 * />
 *
 * @example
 * // Edit mode
 * <ProfileFormModal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   profile={selectedProfile}
 *   onSuccess={() => refetch()}
 * />
 */
export function ProfileFormModal({
  open,
  onOpenChange,
  profile,
  onSuccess,
}: ProfileFormModalProps) {
  const queryClient = useQueryClient();
  const isEditMode = !!profile;

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      type: 'PERSONAL',
      notes: null,
    },
  });

  // Reset form when modal opens/closes or profile changes
  React.useEffect(() => {
    if (open) {
      if (profile) {
        form.reset({
          name: profile.name,
          type: profile.type,
          notes: profile.notes,
        });
      } else {
        form.reset({
          name: '',
          type: 'PERSONAL',
          notes: null,
        });
      }
    }
  }, [open, profile, form]);

  // Create mutation
  const createMutation = useMutation(
    (data: ProfileFormData) => profilesService.create(data),
    {
      onSuccess: () => {
        toast.success('Profile created successfully');
        queryClient.invalidateQueries(['profiles']);
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Failed to create profile');
      },
    }
  );

  // Update mutation
  const updateMutation = useMutation(
    (data: ProfileFormData) => profilesService.update(profile!.id, data),
    {
      onSuccess: () => {
        toast.success('Profile updated successfully');
        queryClient.invalidateQueries(['profiles']);
        queryClient.invalidateQueries(['profile', profile!.id]);
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Failed to update profile');
      },
    }
  );

  const isLoading = createMutation.isLoading || updateMutation.isLoading;

  const onSubmit = (data: ProfileFormData) => {
    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Profile' : 'New Profile'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the profile information below.'
              : 'Create a new profile to store information for form filling. Profiles can represent yourself, family members, or business entities.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Personal, Spouse, Business LLC"
                      autoFocus
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
                    Personal profiles are for individuals. Business profiles are for companies or organizations.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    Add any additional information about this profile.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? isEditMode
                    ? 'Saving...'
                    : 'Creating...'
                  : isEditMode
                  ? 'Save Changes'
                  : 'Create Profile'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default ProfileFormModal;
