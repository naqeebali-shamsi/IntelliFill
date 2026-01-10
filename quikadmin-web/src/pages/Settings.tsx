import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  Key,
  Smartphone,
  CreditCard,
  Database,
  Zap,
  Mail,
  Save,
  Download,
  RefreshCw,
  ChevronRight,
  Monitor,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Building2,
} from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useBackendAuthStore } from '@/stores/backendAuthStore';
import { getProfile, updateProfile, type UpdateProfileData } from '@/services/accountService';
import { profileFormSchema, type ProfileFormData } from '@/lib/validations/account';
import { OrganizationTabContent } from '@/components/features/OrganizationTabContent';
import { ChangePasswordModal, DeleteAccountModal } from '@/components/settings';

// Sidebar Navigation Items
const navItems = [
  { id: 'general', label: 'General', icon: Palette },
  { id: 'account', label: 'Account', icon: User },
  { id: 'organization', label: 'Organization', icon: Building2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'advanced', label: 'Advanced', icon: Database },
];

const SettingsSection = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-4 mb-8">
    <div>
      <h3 className="text-lg font-medium tracking-tight text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
    <div className="space-y-4 pl-1">{children}</div>
  </div>
);

const SettingsRow = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      'flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors',
      className
    )}
  >
    {children}
  </div>
);

export default function Settings() {
  const user = useBackendAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState('general');
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch profile data on mount
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // React Hook Form setup for profile editing
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      jobTitle: '',
      bio: '',
    },
  });

  // Sync form with fetched profile data
  useEffect(() => {
    if (profile) {
      reset({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        phone: profile.phone || '',
        jobTitle: profile.jobTitle || '',
        bio: profile.bio || '',
      });
    }
  }, [profile, reset]);

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: UpdateProfileData) => updateProfile(data),
    onSuccess: (updatedUser) => {
      // Update the auth store with the new user data
      useBackendAuthStore.setState((state) => ({
        ...state,
        user: state.user
          ? {
              ...state.user,
              firstName: updatedUser.firstName || state.user.firstName,
              lastName: updatedUser.lastName || state.user.lastName,
            }
          : null,
      }));

      // Invalidate any user-related queries
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });

      toast.success('Profile Updated', {
        description: 'Your profile information has been saved successfully.',
        icon: <CheckCircle2 className="h-4 w-4" />,
      });

      // Reset form with updated values to clear dirty state
      reset({
        firstName: updatedUser.firstName || '',
        lastName: updatedUser.lastName || '',
        phone: updatedUser.phone || '',
        jobTitle: updatedUser.jobTitle || '',
        bio: updatedUser.bio || '',
      });
    },
    onError: (error: Error) => {
      toast.error('Update Failed', {
        description: error.message || 'Failed to update profile. Please try again.',
      });
    },
  });

  // Form submit handler
  const onSubmitProfile = (data: ProfileFormData) => {
    // Convert empty strings to null for optional fields
    const updateData: UpdateProfileData = {
      firstName: data.firstName,
      lastName: data.lastName || null,
      phone: data.phone || null,
      jobTitle: data.jobTitle || null,
      bio: data.bio || null,
    };

    updateProfileMutation.mutate(updateData);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your account preferences and application configuration."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Settings' }]}
      />

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Navigation */}
        <nav className="w-full lg:w-64 flex-shrink-0 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium',
                  isActive
                    ? 'bg-primary/10 text-primary shadow-[0_0_10px_rgba(59,130,246,0.1)] border border-primary/20'
                    : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
                {isActive && <ChevronRight className="ml-auto h-4 w-4 opacity-50" />}
              </button>
            );
          })}
        </nav>

        {/* Main Content Areas */}
        <div className="flex-1 min-w-0">
          <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 min-h-[600px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {activeTab === 'general' && (
                  <>
                    <SettingsSection
                      title="Appearance"
                      description="Customize how the application looks."
                    >
                      <SettingsRow>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 font-medium">
                            <Monitor className="h-4 w-4" /> Theme
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Select your preferred color scheme
                          </p>
                        </div>
                        <Select defaultValue="system">
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select theme" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="dark">Dark</SelectItem>
                            <SelectItem value="system">System</SelectItem>
                          </SelectContent>
                        </Select>
                      </SettingsRow>
                      <SettingsRow>
                        <div className="space-y-0.5">
                          <div className="font-medium">Compact Mode</div>
                          <p className="text-xs text-muted-foreground">
                            Reduce spacing for higher density
                          </p>
                        </div>
                        <Switch id="compact" />
                      </SettingsRow>
                    </SettingsSection>

                    <Separator className="bg-white/10" />

                    <SettingsSection
                      title="Language & Region"
                      description="Set your language and timezone preferences."
                    >
                      <SettingsRow>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 font-medium">
                            <Globe className="h-4 w-4" /> Language
                          </div>
                        </div>
                        <Select defaultValue="en">
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="es">Spanish</SelectItem>
                            <SelectItem value="fr">French</SelectItem>
                          </SelectContent>
                        </Select>
                      </SettingsRow>
                    </SettingsSection>

                    <SettingsSection
                      title="Processing Preferences"
                      description="Configure default behaviors for document processing."
                    >
                      <SettingsRow>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 font-medium">
                            <Zap className="h-4 w-4" /> Auto-process
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Automatically process files upon upload
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </SettingsRow>
                      <SettingsRow>
                        <div className="space-y-0.5">
                          <div className="font-medium">Enable OCR</div>
                          <p className="text-xs text-muted-foreground">
                            Extract text from images/scans
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </SettingsRow>
                    </SettingsSection>
                  </>
                )}

                {activeTab === 'account' && (
                  <>
                    <SettingsSection
                      title="Profile Information"
                      description="Update your personal details."
                    >
                      {profileLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          <span className="ml-2 text-muted-foreground">Loading profile...</span>
                        </div>
                      ) : (
                        <form onSubmit={handleSubmit(onSubmitProfile)} data-testid="profile-form">
                          <div className="grid gap-4 max-w-xl">
                            {/* First Name - Required */}
                            <div className="grid gap-2">
                              <Label htmlFor="firstName">
                                First Name <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                id="firstName"
                                data-testid="profile-first-name-input"
                                {...register('firstName')}
                                aria-invalid={!!errors.firstName}
                                placeholder="Enter your first name"
                              />
                              {errors.firstName && (
                                <p className="text-sm text-destructive">
                                  {errors.firstName.message}
                                </p>
                              )}
                            </div>

                            {/* Last Name - Optional */}
                            <div className="grid gap-2">
                              <Label htmlFor="lastName">Last Name</Label>
                              <Input
                                id="lastName"
                                data-testid="profile-last-name-input"
                                {...register('lastName')}
                                aria-invalid={!!errors.lastName}
                                placeholder="Enter your last name"
                              />
                              {errors.lastName && (
                                <p className="text-sm text-destructive">
                                  {errors.lastName.message}
                                </p>
                              )}
                            </div>

                            {/* Email - Read-only */}
                            <div className="grid gap-2">
                              <Label htmlFor="email">Email Address</Label>
                              <div className="relative">
                                <Input
                                  id="email"
                                  data-testid="profile-email-display"
                                  type="email"
                                  value={user?.email || ''}
                                  readOnly
                                  disabled
                                  className="pr-24 bg-muted/50 cursor-not-allowed"
                                />
                                {user?.emailVerified && (
                                  <Badge
                                    variant="outline"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-status-success/10 border-status-success/30 text-status-success text-xs"
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Verified
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Email cannot be changed. Contact support if needed.
                              </p>
                            </div>

                            {/* Phone - Optional */}
                            <div className="grid gap-2">
                              <Label htmlFor="phone">Phone Number</Label>
                              <Input
                                id="phone"
                                data-testid="profile-phone-input"
                                type="tel"
                                {...register('phone')}
                                aria-invalid={!!errors.phone}
                                placeholder="+1 (555) 000-0000"
                              />
                              {errors.phone && (
                                <p className="text-sm text-destructive">{errors.phone.message}</p>
                              )}
                            </div>

                            {/* Job Title - Optional */}
                            <div className="grid gap-2">
                              <Label htmlFor="jobTitle">Job Title</Label>
                              <Input
                                id="jobTitle"
                                data-testid="profile-job-title-input"
                                {...register('jobTitle')}
                                aria-invalid={!!errors.jobTitle}
                                placeholder="e.g., Software Engineer"
                              />
                              {errors.jobTitle && (
                                <p className="text-sm text-destructive">
                                  {errors.jobTitle.message}
                                </p>
                              )}
                            </div>

                            {/* Bio - Optional, Textarea */}
                            <div className="grid gap-2">
                              <div className="flex items-center justify-between">
                                <Label htmlFor="bio">Bio</Label>
                                <span className="text-xs text-muted-foreground">
                                  Max 500 characters
                                </span>
                              </div>
                              <Textarea
                                id="bio"
                                data-testid="profile-bio-input"
                                {...register('bio')}
                                aria-invalid={!!errors.bio}
                                placeholder="Tell us a little about yourself..."
                                className="min-h-[100px] resize-none"
                                maxLength={500}
                              />
                              {errors.bio && (
                                <p className="text-sm text-destructive">{errors.bio.message}</p>
                              )}
                            </div>
                          </div>

                          {/* Save Button */}
                          <div className="flex gap-3 mt-6">
                            <Button
                              type="submit"
                              data-testid="profile-save-button"
                              disabled={!isDirty || isSubmitting || updateProfileMutation.isPending}
                              className="w-fit shadow-lg shadow-primary/20"
                            >
                              {updateProfileMutation.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Save className="mr-2 h-4 w-4" />
                                  Save Changes
                                </>
                              )}
                            </Button>
                            {isDirty && (
                              <Button
                                type="button"
                                variant="ghost"
                                data-testid="profile-reset-button"
                                onClick={() =>
                                  reset({
                                    firstName: profile?.firstName || '',
                                    lastName: profile?.lastName || '',
                                    phone: profile?.phone || '',
                                    jobTitle: profile?.jobTitle || '',
                                    bio: profile?.bio || '',
                                  })
                                }
                              >
                                Reset
                              </Button>
                            )}
                          </div>
                        </form>
                      )}
                    </SettingsSection>

                    <Separator className="bg-white/10" />

                    <SettingsSection title="Subscription" description="Manage your billing plan.">
                      <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 rounded-xl border border-primary/20 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-lg text-primary">Free Plan</h4>
                            <Badge
                              variant="outline"
                              className="bg-primary/10 border-primary/20 text-primary"
                            >
                              Current
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Basic access (50 docs/month)
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          className="border-primary/20 hover:bg-primary/10 hover:text-primary"
                        >
                          <CreditCard className="mr-2 h-4 w-4" /> Upgrade
                        </Button>
                      </div>
                    </SettingsSection>
                  </>
                )}

                {activeTab === 'organization' && <OrganizationTabContent />}

                {activeTab === 'notifications' && (
                  <>
                    <SettingsSection
                      title="Email Notifications"
                      description="Manage when you receive emails."
                    >
                      <SettingsRow>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 font-medium">
                            <Mail className="h-4 w-4" /> Processing Complete
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Email when a document finishes processing
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </SettingsRow>
                      <SettingsRow>
                        <div className="space-y-0.5">
                          <div className="font-medium">Errors & Alerts</div>
                          <p className="text-xs text-muted-foreground">
                            Email when processing fails
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </SettingsRow>
                      <SettingsRow>
                        <div className="space-y-0.5">
                          <div className="font-medium">Weekly Summary</div>
                          <p className="text-xs text-muted-foreground">Digest of weekly activity</p>
                        </div>
                        <Switch />
                      </SettingsRow>
                    </SettingsSection>

                    <SettingsSection
                      title="Push Notifications"
                      description="Manage browser and mobile alerts."
                    >
                      <SettingsRow>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 font-medium">
                            <Bell className="h-4 w-4" /> Browser Notifications
                          </div>
                        </div>
                        <Switch />
                      </SettingsRow>
                    </SettingsSection>
                  </>
                )}

                {activeTab === 'security' && (
                  <>
                    <SettingsSection title="Login & Security" description="Protect your account.">
                      <SettingsRow>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 font-medium">
                            <Key className="h-4 w-4" /> Password
                          </div>
                          <p className="text-xs text-muted-foreground">Last changed 3 months ago</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setChangePasswordOpen(true)}
                        >
                          Change Password
                        </Button>
                      </SettingsRow>
                      <SettingsRow>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 font-medium">
                            <Smartphone className="h-4 w-4" /> Two-Factor Authentication
                          </div>
                          <p className="text-xs text-warning/80">Not enabled</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-primary hover:text-primary"
                        >
                          Enable 2FA
                        </Button>
                      </SettingsRow>
                    </SettingsSection>
                  </>
                )}

                {activeTab === 'advanced' && (
                  <>
                    <SettingsSection
                      title="Data Management"
                      description="Export or delete your data."
                    >
                      <SettingsRow>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 font-medium">
                            <Download className="h-4 w-4" /> Export Data
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Download all your profile data as JSON
                          </p>
                        </div>
                        <Button variant="outline" size="sm">
                          Export All
                        </Button>
                      </SettingsRow>
                      <SettingsRow>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 font-medium">
                            <RefreshCw className="h-4 w-4" /> Clear Cache
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Clear
                        </Button>
                      </SettingsRow>
                    </SettingsSection>

                    <div className="mt-8 pt-8 border-t border-destructive/20">
                      <h3 className="text-lg font-medium text-destructive mb-4 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" /> Danger Zone
                      </h3>
                      <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-destructive-foreground">
                            Delete Account
                          </div>
                          <p className="text-xs text-destructive-foreground/70">
                            Permanently delete your account and all data
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteAccountOpen(true)}
                        >
                          Delete Account
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <ChangePasswordModal open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
      <DeleteAccountModal open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen} />
    </div>
  );
}
