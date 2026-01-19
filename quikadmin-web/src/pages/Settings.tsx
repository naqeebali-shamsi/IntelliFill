import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  Bell,
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Database,
  Download,
  Globe,
  Key,
  Loader2,
  Mail,
  Monitor,
  Palette,
  RefreshCw,
  Save,
  Shield,
  Smartphone,
  User,
  Zap,
} from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { SubscriptionSettings } from '@/components/features/SubscriptionSettings';
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
import { cn } from '@/lib/utils';
import { useBackendAuthStore } from '@/stores/backendAuthStore';
import { useUIStore } from '@/stores/uiStore';
import {
  getProfile,
  updateProfile,
  getSettings,
  updateSettings,
  type UpdateProfileData,
  type UpdateSettingsData,
  type UserSettings,
} from '@/services/accountService';
import api from '@/services/api';
import { profileFormSchema, type ProfileFormData } from '@/lib/validations/account';
import { OrganizationTabContent } from '@/components/features/OrganizationTabContent';
import {
  ChangePasswordModal,
  DeleteAccountModal,
  TwoFactorSetupModal,
} from '@/components/settings';
import { useTheme } from '@/components/theme-provider';

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

/** Compact mode toggle - DOM class is managed by uiStore */
function CompactModeRow(): React.ReactElement {
  const compactMode = useUIStore((state) => state.compactMode);
  const setCompactMode = useUIStore((state) => state.setCompactMode);

  return (
    <SettingsRow>
      <div className="space-y-0.5">
        <div className="font-medium">Compact Mode</div>
        <p className="text-xs text-muted-foreground">Reduce spacing for higher density</p>
      </div>
      <Switch id="compact" checked={compactMode} onCheckedChange={setCompactMode} />
    </SettingsRow>
  );
}

const SUPPORTED_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'ar', label: 'Arabic' },
] as const;

/** Export data button with download handler */
function ExportDataRow(): React.ReactElement {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport(): Promise<void> {
    setIsExporting(true);
    try {
      const response = await api.get('/users/me/export');
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `intellifill-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch {
      toast.error('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <SettingsRow>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2 font-medium">
          <Download className="h-4 w-4" /> Export Data
        </div>
        <p className="text-xs text-muted-foreground">Download all your profile data as JSON</p>
      </div>
      <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
        {isExporting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Exporting...
          </>
        ) : (
          'Export All'
        )}
      </Button>
    </SettingsRow>
  );
}

/** Keys to preserve when clearing cache */
const PRESERVED_STORAGE_KEYS = [
  'vite-ui-theme', // Theme preference
  'intellifill-ui', // UI store (has theme and sidebar state)
  'preferred_language', // Language preference
];

/** Clear cache button with confirmation dialog */
function ClearCacheRow(): React.ReactElement {
  const queryClient = useQueryClient();
  const [isClearing, setIsClearing] = useState(false);

  function handleClearCache(): void {
    setIsClearing(true);

    // Preserve essential keys before clearing
    const preserved: Record<string, string | null> = {};
    for (const key of PRESERVED_STORAGE_KEYS) {
      preserved[key] = localStorage.getItem(key);
    }

    localStorage.clear();
    sessionStorage.clear();
    queryClient.clear();

    // Restore preserved keys
    for (const [key, value] of Object.entries(preserved)) {
      if (value !== null) {
        localStorage.setItem(key, value);
      }
    }

    toast.success('Cache cleared', {
      description: 'Local storage and query cache have been cleared.',
    });

    setIsClearing(false);
  }

  return (
    <SettingsRow>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2 font-medium">
          <RefreshCw className="h-4 w-4" /> Clear Cache
        </div>
        <p className="text-xs text-muted-foreground">Clear local storage and query cache</p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={isClearing}>
            {isClearing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Clearing...
              </>
            ) : (
              'Clear'
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Cache?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear your local storage and query cache. Your theme, language preference,
              and authentication will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearCache}>Clear Cache</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsRow>
  );
}

/** Language preference row with localStorage + backend sync */
interface LanguageRowProps {
  userSettings: UserSettings | undefined;
  updateSettingsMutation: ReturnType<typeof useMutation<UserSettings, Error, UpdateSettingsData>>;
}

function LanguageRow({
  userSettings,
  updateSettingsMutation,
}: LanguageRowProps): React.ReactElement {
  const storedLanguage = localStorage.getItem('preferred_language');
  const initialLanguage = storedLanguage || userSettings?.preferredLanguage || 'en';
  const [language, setLanguage] = useState(initialLanguage);

  // Sync with userSettings when it loads (only if no localStorage preference)
  useEffect(() => {
    if (!storedLanguage && userSettings?.preferredLanguage) {
      setLanguage(userSettings.preferredLanguage);
    }
  }, [storedLanguage, userSettings?.preferredLanguage]);

  function handleLanguageChange(value: string): void {
    setLanguage(value);
    localStorage.setItem('preferred_language', value);

    updateSettingsMutation.mutate(
      { preferredLanguage: value },
      {
        onSuccess: () => {
          toast.info('Language preference saved', {
            description: 'Full localization coming soon!',
          });
        },
      }
    );
  }

  return (
    <SettingsRow>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2 font-medium">
          <Globe className="h-4 w-4" /> Language
        </div>
      </div>
      <Select value={language} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select language" />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <SelectItem key={lang.value} value={lang.value}>
              {lang.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingsRow>
  );
}

// Browser notification helpers
const isBrowserNotificationSupported = typeof Notification !== 'undefined';
const isBrowserNotificationDenied =
  isBrowserNotificationSupported && Notification.permission === 'denied';

function getBrowserNotificationDescription(): string {
  if (isBrowserNotificationDenied) {
    return 'Notifications blocked - please enable in browser settings';
  }
  return 'Receive push notifications in your browser';
}

function isBrowserNotificationsEnabled(): boolean {
  return typeof window !== 'undefined' && localStorage.getItem('browserNotifications') === 'true';
}

async function handleBrowserNotificationToggle(enabled: boolean): Promise<void> {
  if (enabled) {
    if (!isBrowserNotificationSupported) return;

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      localStorage.setItem('browserNotifications', 'true');
      toast.success('Browser notifications enabled');
    } else {
      toast.error('Browser notification permission denied', {
        description: 'Please enable notifications in your browser settings',
      });
    }
  } else {
    localStorage.setItem('browserNotifications', 'false');
    toast.success('Browser notifications disabled');
  }
}

// Notifications Tab Component
interface NotificationsTabProps {
  userSettings: UserSettings | undefined;
  updateSettingsMutation: ReturnType<typeof useMutation<UserSettings, Error, UpdateSettingsData>>;
}

function NotificationsTab({
  userSettings,
  updateSettingsMutation,
}: NotificationsTabProps): React.ReactNode {
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(
    isBrowserNotificationsEnabled
  );

  async function handleBrowserToggle(checked: boolean): Promise<void> {
    await handleBrowserNotificationToggle(checked);
    setBrowserNotificationsEnabled(isBrowserNotificationsEnabled());
  }

  return (
    <>
      <SettingsSection title="Email Notifications" description="Manage when you receive emails.">
        <SettingsRow>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 font-medium">
              <Mail className="h-4 w-4" /> Processing Complete
            </div>
            <p className="text-xs text-muted-foreground">
              Email when a document finishes processing
            </p>
          </div>
          <Switch
            checked={userSettings?.notifyOnProcessComplete ?? true}
            onCheckedChange={(checked) =>
              updateSettingsMutation.mutate({ notifyOnProcessComplete: checked })
            }
            disabled={updateSettingsMutation.isPending}
          />
        </SettingsRow>
        <SettingsRow>
          <div className="space-y-0.5">
            <div className="font-medium">Errors & Alerts</div>
            <p className="text-xs text-muted-foreground">Email when processing fails</p>
          </div>
          <Switch
            checked={userSettings?.notifyOnErrors ?? true}
            onCheckedChange={(checked) =>
              updateSettingsMutation.mutate({ notifyOnErrors: checked })
            }
            disabled={updateSettingsMutation.isPending}
          />
        </SettingsRow>
        <SettingsRow>
          <div className="space-y-0.5">
            <div className="font-medium">Weekly Summary</div>
            <p className="text-xs text-muted-foreground">Digest of weekly activity</p>
          </div>
          <Switch
            checked={userSettings?.digestFrequency === 'weekly'}
            onCheckedChange={(checked) =>
              updateSettingsMutation.mutate({
                digestFrequency: checked ? 'weekly' : 'never',
              })
            }
            disabled={updateSettingsMutation.isPending}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Push Notifications" description="Manage browser and mobile alerts.">
        <SettingsRow>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 font-medium">
              <Bell className="h-4 w-4" /> Browser Notifications
            </div>
            <p className="text-xs text-muted-foreground">{getBrowserNotificationDescription()}</p>
          </div>
          <Switch
            checked={browserNotificationsEnabled}
            onCheckedChange={handleBrowserToggle}
            disabled={isBrowserNotificationDenied}
          />
        </SettingsRow>
      </SettingsSection>
    </>
  );
}

export default function Settings() {
  const user = useBackendAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState('general');
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  // Fetch profile data on mount
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch user settings on mount
  const { data: userSettings } = useQuery({
    queryKey: ['user-settings'],
    queryFn: getSettings,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Settings update mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (data: UpdateSettingsData) => updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
      toast.success('Settings updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update settings', {
        description: error.message || 'Please try again.',
      });
    },
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
                        <Select
                          value={theme}
                          onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}
                        >
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
                      <CompactModeRow />
                    </SettingsSection>

                    <Separator className="bg-white/10" />

                    <SettingsSection
                      title="Language & Region"
                      description="Set your language and timezone preferences."
                    >
                      <LanguageRow
                        userSettings={userSettings}
                        updateSettingsMutation={updateSettingsMutation}
                      />
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
                        <Switch
                          checked={userSettings?.autoMlEnhancement ?? true}
                          onCheckedChange={(checked) =>
                            updateSettingsMutation.mutate({ autoMlEnhancement: checked })
                          }
                          disabled={updateSettingsMutation.isPending}
                        />
                      </SettingsRow>
                      <SettingsRow>
                        <div className="space-y-0.5">
                          <div className="font-medium">Enable OCR</div>
                          <p className="text-xs text-muted-foreground">
                            Extract text from images/scans
                          </p>
                        </div>
                        <Switch
                          checked={userSettings?.autoOcr ?? false}
                          onCheckedChange={(checked) =>
                            updateSettingsMutation.mutate({ autoOcr: checked })
                          }
                          disabled={updateSettingsMutation.isPending}
                        />
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

                    <SubscriptionSettings />
                  </>
                )}

                {activeTab === 'organization' && <OrganizationTabContent />}

                {activeTab === 'notifications' && (
                  <NotificationsTab
                    userSettings={userSettings}
                    updateSettingsMutation={updateSettingsMutation}
                  />
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
                          {user?.mfaEnabled ? (
                            <p className="text-xs text-status-success flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Enabled
                            </p>
                          ) : (
                            <p className="text-xs text-status-warning">Not enabled</p>
                          )}
                        </div>
                        {user?.mfaEnabled ? (
                          <Button variant="outline" size="sm">
                            Manage 2FA
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-primary hover:text-primary"
                            onClick={() => setTwoFactorOpen(true)}
                          >
                            Enable 2FA
                          </Button>
                        )}
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
                      <ExportDataRow />
                      <ClearCacheRow />
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
      <TwoFactorSetupModal
        open={twoFactorOpen}
        onOpenChange={setTwoFactorOpen}
        onSuccess={() => {
          // Update local user state to reflect MFA enabled
          useBackendAuthStore.setState((state) => ({
            ...state,
            user: state.user ? { ...state.user, mfaEnabled: true } : null,
          }));
          // Refresh user data from server
          queryClient.invalidateQueries({ queryKey: ['user'] });
          queryClient.invalidateQueries({ queryKey: ['profile'] });
        }}
      />
    </div>
  );
}
