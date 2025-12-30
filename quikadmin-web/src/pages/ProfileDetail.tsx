/**
 * ProfileDetail page - View and edit a single profile
 */

import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
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
  History,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import type { ProfileFormData } from '@/types/profile';
import { profileFormSchema, getProfileTypeLabel } from '@/types/profile';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';

// =================== ANIMATIONS ===================
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

// =================== MAIN COMPONENTS ===================

export default function ProfileDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState('overview');
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

  // Fetch profile data
  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['profile', id],
    queryFn: () => profilesService.getWithData(id!),
    enabled: !!id,
  });

  // Reset form when data loads
  React.useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name,
        type: profile.type,
        notes: profile.notes,
      });
    }
  }, [profile, form]);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (data: ProfileFormData) => profilesService.update(id!, data),
    onSuccess: (updatedProfile) => {
      toast.success('Profile updated');
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.setQueryData(['profile', id], updatedProfile);
      setIsEditing(false);
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => profilesService.delete(id!),
    onSuccess: () => {
      toast.success('Profile deleted');
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      navigate('/profiles');
    },
    onError: () => toast.error('Failed to delete'),
  });

  const archiveMutation = useMutation({
    mutationFn: () => profilesService.archive(id!),
    onSuccess: (updatedProfile) => {
      toast.success('Profile archived');
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.setQueryData(['profile', id], updatedProfile);
    },
    onError: () => toast.error('Failed to archive'),
  });

  const restoreMutation = useMutation({
    mutationFn: () => profilesService.restore(id!),
    onSuccess: (updatedProfile) => {
      toast.success('Profile restored');
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.setQueryData(['profile', id], updatedProfile);
    },
    onError: () => toast.error('Failed to restore'),
  });

  const handleSave = (data: ProfileFormData) => updateMutation.mutate(data);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 max-w-lg mx-auto text-center">
        <div className="bg-red-500/10 p-4 rounded-full text-red-500 mb-4">
          <AlertTriangle className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Profile Not Found</h2>
        <p className="text-muted-foreground mb-6">
          The profile you are looking for does not exist or has been deleted.
        </p>
        <Button onClick={() => navigate('/profiles')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Profiles
        </Button>
      </div>
    );
  }

  const fieldCount = Object.keys(profile.profileData?.data || {}).length;

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-8">
      {/* Breadcrumb / Back */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/profiles')}
          className="pl-0 hover:pl-2 transition-all"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Profiles
        </Button>
        <span>/</span>
        <span className="text-foreground font-medium">{profile.name}</span>
      </div>

      {/* Header Card */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          {profile.type === 'BUSINESS' ? (
            <Building2 className="h-40 w-40" />
          ) : (
            <User className="h-40 w-40" />
          )}
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-6">
            <div
              className={cn(
                'h-20 w-20 rounded-2xl flex items-center justify-center shadow-inner',
                profile.type === 'BUSINESS'
                  ? 'bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20'
                  : 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20'
              )}
            >
              {profile.type === 'BUSINESS' ? (
                <Building2 className="h-10 w-10" />
              ) : (
                <User className="h-10 w-10" />
              )}
            </div>

            <div>
              <h1 className="text-3xl font-heading font-bold text-foreground mb-2 flex items-center gap-3">
                {profile.name}
                {profile.status === 'ARCHIVED' && (
                  <Badge
                    variant="outline"
                    className="bg-amber-500/10 text-amber-500 border-amber-500/20"
                  >
                    Archived
                  </Badge>
                )}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  {profile.type === 'BUSINESS' ? (
                    <Building2 className="h-4 w-4" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                  {getProfileTypeLabel(profile.type)}
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  Updated {format(new Date(profile.updatedAt), 'MMM d, yyyy')}
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/5">
                  <Database className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground">{fieldCount}</span> Fields stored
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={form.handleSubmit(handleSave)}
                  disabled={updateMutation.isPending}
                  className="shadow-lg shadow-primary/20"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Profile</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure? This will permanently delete the profile "{profile.name}" and
                        all its stored data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate()}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>

        {/* Edit Form */}
        <AnimatePresence>
          {isEditing && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-6 pt-6 border-t border-white/10"
            >
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleSave)}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profile Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profile Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PERSONAL">Personal</SelectItem>
                            <SelectItem value="BUSINESS">Business</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Add some notes about this profile..."
                              {...field}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </form>
              </Form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tabs Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white/5 border border-white/5 mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="data">Stored Data</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <motion.div
              variants={itemVariants}
              className="glass-panel p-6 rounded-xl border border-white/5"
            >
              <h3 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> Profile Summary
              </h3>
              <dl className="space-y-4">
                <div className="flex justify-between py-2 border-b border-white/5">
                  <dt className="text-muted-foreground text-sm">Created</dt>
                  <dd className="font-medium">
                    {format(new Date(profile.createdAt), 'MMMM d, yyyy')}
                  </dd>
                </div>
                <div className="flex justify-between py-2 border-b border-white/5">
                  <dt className="text-muted-foreground text-sm">Status</dt>
                  <dd>
                    <Badge variant="outline">{profile.status}</Badge>
                  </dd>
                </div>
                <div className="pt-2">
                  <dt className="text-muted-foreground text-sm mb-1">Notes</dt>
                  <dd className="text-sm bg-background/30 p-3 rounded-lg border border-white/5 min-h-[80px]">
                    {profile.notes || 'No notes added.'}
                  </dd>
                </div>
              </dl>
            </motion.div>

            <motion.div variants={itemVariants}>
              <FormFillHistoryCard profileId={id!} limit={3} compact={true} />
            </motion.div>
          </motion.div>
        </TabsContent>

        <TabsContent value="data">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-xl overflow-hidden border border-white/5"
          >
            <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <div>
                <h3 className="font-heading font-semibold text-lg">Stored Field Data</h3>
                <p className="text-sm text-muted-foreground">
                  Extracted from documents and manual entry
                </p>
              </div>
            </div>
            <div className="p-6">
              <ProfileFieldsManager
                profileId={id!}
                fields={profile.profileData?.data || {}}
                fieldSources={profile.profileData?.fieldSources || {}}
                editable={true}
              />
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="history">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <FormFillHistoryCard profileId={id!} limit={20} compact={false} />
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
