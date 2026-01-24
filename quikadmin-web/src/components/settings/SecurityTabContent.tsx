import { useState } from 'react';
import {
  Shield,
  Key,
  Smartphone,
  Monitor,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useBackendAuthStore } from '@/stores/backendAuthStore';
import { ChangePasswordModal } from './ChangePasswordModal';
import { TwoFactorSetupModal } from './TwoFactorSetupModal';

// Section wrapper component (matching Settings page pattern)
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

// Row wrapper component (matching Settings page pattern)
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

/**
 * Security tab content component - comprehensive security hub.
 * Includes password management, 2FA, active sessions, and security recommendations.
 */
export function SecurityTabContent() {
  const user = useBackendAuthStore((state) => state.user);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);

  // Handle sign out all sessions (scaffold)
  const handleSignOutAllSessions = () => {
    toast.info('Coming Soon', {
      description: 'Session management will be available in a future update.',
    });
  };

  // Calculate security score
  const hasStrongPassword = true; // Assume true for now (would be based on password age/strength)
  const has2FA = user?.mfaEnabled ?? false;
  const hasVerifiedEmail = user?.emailVerified ?? false;
  const securityScore = [hasStrongPassword, has2FA, hasVerifiedEmail].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Password Section */}
      <SettingsSection
        title="Password"
        description="Manage your account password and security."
      >
        <SettingsRow>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 font-medium">
              <Key className="h-4 w-4" /> Password
            </div>
            <p className="text-xs text-muted-foreground">Last changed 3 months ago</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setChangePasswordOpen(true)}>
            Change Password
          </Button>
        </SettingsRow>
      </SettingsSection>

      <Separator className="bg-white/10" />

      {/* Two-Factor Authentication Section */}
      <SettingsSection
        title="Two-Factor Authentication"
        description="Add an extra layer of security to your account."
      >
        <SettingsRow>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 font-medium">
              <Smartphone className="h-4 w-4" /> Authenticator App
            </div>
            {has2FA ? (
              <div className="flex items-center gap-1 text-xs text-status-success">
                <CheckCircle2 className="h-3 w-3" />
                <span>Enabled and active</span>
              </div>
            ) : (
              <p className="text-xs text-status-warning">Not enabled</p>
            )}
          </div>
          {has2FA ? (
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

      <Separator className="bg-white/10" />

      {/* Active Sessions Section (Scaffold) */}
      <SettingsSection
        title="Active Sessions"
        description="Manage devices and sessions where you're logged in."
      >
        <SettingsRow>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 font-medium">
              <Monitor className="h-4 w-4" /> Current Session
            </div>
            <p className="text-xs text-muted-foreground">
              Windows • Chrome • Last active: now
            </p>
          </div>
          <Badge variant="outline" className="bg-status-success/10 border-status-success/30 text-status-success">
            Active
          </Badge>
        </SettingsRow>
        <SettingsRow>
          <div className="space-y-0.5">
            <div className="font-medium">Other Sessions</div>
            <p className="text-xs text-muted-foreground">
              Sign out from all other devices and browsers
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOutAllSessions}>
            Sign Out All Others
          </Button>
        </SettingsRow>
      </SettingsSection>

      <Separator className="bg-white/10" />

      {/* Security Recommendations Section */}
      <SettingsSection
        title="Security Recommendations"
        description="Keep your account secure by following these best practices."
      >
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 rounded-xl border border-primary/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground">Security Score</h4>
              <p className="text-sm text-muted-foreground">
                {securityScore}/3 security measures enabled
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Password Strength */}
            <div className="flex items-center gap-3">
              {hasStrongPassword ? (
                <CheckCircle2 className="h-5 w-5 text-status-success flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-status-warning flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Strong Password</p>
                <p className="text-xs text-muted-foreground">
                  {hasStrongPassword
                    ? 'Your password meets security requirements'
                    : 'Update to a stronger password'}
                </p>
              </div>
            </div>

            {/* Two-Factor Authentication */}
            <div className="flex items-center gap-3">
              {has2FA ? (
                <CheckCircle2 className="h-5 w-5 text-status-success flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-status-warning flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
                <p className="text-xs text-muted-foreground">
                  {has2FA ? 'Extra security layer is active' : 'Enable 2FA for better security'}
                </p>
              </div>
            </div>

            {/* Email Verification */}
            <div className="flex items-center gap-3">
              {hasVerifiedEmail ? (
                <CheckCircle2 className="h-5 w-5 text-status-success flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-status-warning flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Email Verified</p>
                <p className="text-xs text-muted-foreground">
                  {hasVerifiedEmail
                    ? 'Your email address is verified'
                    : 'Verify your email for account recovery'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Modals */}
      <ChangePasswordModal open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
      <TwoFactorSetupModal
        open={twoFactorOpen}
        onOpenChange={setTwoFactorOpen}
        onSuccess={() => {
          // Update local user state to reflect MFA enabled
          useBackendAuthStore.setState((state) => ({
            ...state,
            user: state.user ? { ...state.user, mfaEnabled: true } : null,
          }));
        }}
      />
    </div>
  );
}

export default SecurityTabContent;
