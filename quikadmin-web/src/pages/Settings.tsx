import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Upload,
  RefreshCw,
  LogOut,
  ChevronRight,
  Monitor,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useBackendAuthStore } from '@/stores/backendAuthStore';

// Sidebar Navigation Items
const navItems = [
  { id: 'general', label: 'General', icon: Palette },
  { id: 'account', label: 'Account', icon: User },
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

  // Initialize form with user data if available, otherwise empty
  const [accountForm, setAccountForm] = useState(() => ({
    name: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : '',
    email: user?.email || '',
    phone: '',
    company: '',
  }));

  // Track the user ID we've synced from to detect user changes
  const syncedUserIdRef = useRef<string | null>(user?.id ?? null);

  // Sync form when user changes (e.g., different user logs in)
  // This is a legitimate use case for syncing external state to local state
  useEffect(() => {
    if (user && user.id !== syncedUserIdRef.current) {
      syncedUserIdRef.current = user.id;
      setAccountForm((prev) => ({
        ...prev,
        name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : '',
        email: user.email || '',
      }));
    }
  }, [user]);

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-heading font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-muted-foreground text-lg">
          Manage your account preferences and application configuration.
        </p>
      </div>

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
                      <div className="grid gap-4 max-w-xl">
                        <div className="grid gap-2">
                          <Label htmlFor="name">Full Name</Label>
                          <Input
                            id="name"
                            value={accountForm.name}
                            onChange={(e) =>
                              setAccountForm({ ...accountForm, name: e.target.value })
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="email">Email Address</Label>
                          <Input
                            id="email"
                            type="email"
                            value={accountForm.email}
                            onChange={(e) =>
                              setAccountForm({ ...accountForm, email: e.target.value })
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="phone">Phone Number</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={accountForm.phone}
                            onChange={(e) =>
                              setAccountForm({ ...accountForm, phone: e.target.value })
                            }
                            placeholder="+1 (555) 000-0000"
                          />
                        </div>
                      </div>
                      <div className="flex gap-3 mt-4">
                        <Button className="w-fit shadow-lg shadow-primary/20">
                          <Save className="mr-2 h-4 w-4" /> Save Changes
                        </Button>
                      </div>
                    </SettingsSection>

                    <Separator className="bg-white/10" />

                    <SettingsSection title="Subscription" description="Manage your billing plan.">
                      <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 p-4 rounded-xl border border-blue-500/20 flex items-center justify-between">
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
                        <Button variant="outline" size="sm">
                          Change Password
                        </Button>
                      </SettingsRow>
                      <SettingsRow>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 font-medium">
                            <Smartphone className="h-4 w-4" /> Two-Factor Authentication
                          </div>
                          <p className="text-xs text-amber-500/80">Not enabled</p>
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
                        <Button variant="destructive" size="sm">
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
    </div>
  );
}
