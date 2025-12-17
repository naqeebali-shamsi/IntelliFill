import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  Key,
  AlertCircle,
  Save,
  Upload,
  Download,
  RefreshCw,
  Mail,
  Smartphone,
  CreditCard,
  Database,
  Zap,
} from 'lucide-react';
import { useBackendAuthStore } from '@/stores/backendAuthStore';

export default function Settings() {
  const user = useBackendAuthStore((state) => state.user);

  // Form state for account settings
  const [accountForm, setAccountForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
  });

  // Load user data into form when available
  useEffect(() => {
    if (user) {
      setAccountForm({
        name:
          user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.firstName || '',
        email: user.email || '',
        phone: '',
        company: '', // Company name not available in current API
      });
    }
  }, [user]);
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and application preferences
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure your application preferences and display settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  <h3 className="font-medium">Appearance</h3>
                </div>
                <div className="grid gap-4 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="theme">Theme</Label>
                    <Select defaultValue="system">
                      <SelectTrigger id="theme">
                        <SelectValue placeholder="Select theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="compact">Compact Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Reduce spacing and padding in the interface
                      </p>
                    </div>
                    <Switch id="compact" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Language Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <h3 className="font-medium">Language & Region</h3>
                </div>
                <div className="grid gap-4 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select defaultValue="en">
                      <SelectTrigger id="language">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="zh">Chinese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select defaultValue="utc">
                      <SelectTrigger id="timezone">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="utc">UTC</SelectItem>
                        <SelectItem value="est">Eastern Time</SelectItem>
                        <SelectItem value="pst">Pacific Time</SelectItem>
                        <SelectItem value="cst">Central Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Processing Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  <h3 className="font-medium">Processing Preferences</h3>
                </div>
                <div className="grid gap-4 pl-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-process">Auto-process uploads</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically start processing when files are uploaded
                      </p>
                    </div>
                    <Switch id="auto-process" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="ocr">Enable OCR</Label>
                      <p className="text-sm text-muted-foreground">
                        Extract text from scanned documents
                      </p>
                    </div>
                    <Switch id="ocr" defaultChecked />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quality">Processing Quality</Label>
                    <Select defaultValue="balanced">
                      <SelectTrigger id="quality">
                        <SelectValue placeholder="Select quality" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fast">Fast (Lower accuracy)</SelectItem>
                        <SelectItem value="balanced">Balanced</SelectItem>
                        <SelectItem value="high">High (Slower)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Settings */}
        <TabsContent value="account" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Update your account details and profile information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={accountForm.name}
                    onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={accountForm.email}
                    onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
                    placeholder="Enter your email"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={accountForm.phone}
                    onChange={(e) => setAccountForm({ ...accountForm, phone: e.target.value })}
                    placeholder="Enter your phone number"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={accountForm.company}
                    onChange={(e) => setAccountForm({ ...accountForm, company: e.target.value })}
                    placeholder="Enter your company name"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
                <Button variant="outline">Cancel</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subscription Plan</CardTitle>
              <CardDescription>Manage your subscription and billing information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">Free Plan</h4>
                    <p className="text-sm text-muted-foreground">Basic access</p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-700">Current</Badge>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    Upgrade to a paid plan for more features and higher limits.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">
                  <CreditCard className="mr-2 h-4 w-4" />
                  View Plans
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how and when you want to receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Notifications */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <h3 className="font-medium">Email Notifications</h3>
                </div>
                <div className="grid gap-4 pl-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-processing">Processing Complete</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when document processing is complete
                      </p>
                    </div>
                    <Switch id="email-processing" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-errors">Processing Errors</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive alerts when processing fails
                      </p>
                    </div>
                    <Switch id="email-errors" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-weekly">Weekly Summary</Label>
                      <p className="text-sm text-muted-foreground">
                        Weekly digest of your processing activity
                      </p>
                    </div>
                    <Switch id="email-weekly" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Push Notifications */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <h3 className="font-medium">Push Notifications</h3>
                </div>
                <div className="grid gap-4 pl-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="push-browser">Browser Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Show desktop notifications in your browser
                      </p>
                    </div>
                    <Switch id="push-browser" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="push-mobile">Mobile Push</Label>
                      <p className="text-sm text-muted-foreground">
                        Send notifications to your mobile device
                      </p>
                    </div>
                    <Switch id="push-mobile" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage your account security and authentication preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  <h3 className="font-medium">Password</h3>
                </div>
                <div className="grid gap-4 pl-6">
                  <div className="grid gap-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input id="current-password" type="password" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input id="new-password" type="password" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input id="confirm-password" type="password" />
                  </div>
                  <Button className="w-fit">Update Password</Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <h3 className="font-medium">Two-Factor Authentication</h3>
                </div>
                <div className="pl-6">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Two-factor authentication is not enabled</AlertTitle>
                    <AlertDescription className="mt-2">
                      Add an extra layer of security to your account by enabling two-factor
                      authentication.
                    </AlertDescription>
                  </Alert>
                  <Button className="mt-4">
                    <Smartphone className="mr-2 h-4 w-4" />
                    Enable 2FA
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium">Active Sessions</h3>
                <div className="space-y-2">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Current Session</p>
                        <p className="text-sm text-muted-foreground">This device • Active now</p>
                      </div>
                      <Badge className="bg-green-100 text-green-700">Current</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">Session management coming soon.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Settings */}
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>Configure advanced options and developer settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  <h3 className="font-medium">Data Management</h3>
                </div>
                <div className="grid gap-4 pl-6">
                  <div className="space-y-2">
                    <Label>Export Data</Label>
                    <p className="text-sm text-muted-foreground">
                      Download all your data in JSON format
                    </p>
                    <Button variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      Export All Data
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Import Data</Label>
                    <p className="text-sm text-muted-foreground">Import data from a backup file</p>
                    <Button variant="outline">
                      <Upload className="mr-2 h-4 w-4" />
                      Import Data
                    </Button>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Clear Cache</Label>
                    <p className="text-sm text-muted-foreground">
                      Clear temporary files and cached data
                    </p>
                    <Button variant="outline">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Clear Cache
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium">API Access</h3>
                <div className="pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="api-key">API Key</Label>
                    <div className="flex gap-2">
                      <Input
                        id="api-key"
                        placeholder="No API key generated"
                        type="password"
                        readOnly
                      />
                      <Button variant="outline">Generate Key</Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Generate an API key to access the API programmatically
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <Alert className="border-destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Danger Zone</AlertTitle>
                <AlertDescription className="space-y-4">
                  <p>Once you delete your account, there is no going back.</p>
                  <Button variant="destructive">Delete Account</Button>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
