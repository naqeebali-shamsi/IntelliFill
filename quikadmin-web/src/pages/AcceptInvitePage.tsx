import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Building2, UserPlus } from 'lucide-react';
import { useBackendAuthStore } from '@/stores/backendAuthStore';
import {
  validateInvitation,
  acceptInvitation,
  type InvitationValidation,
} from '@/services/organizationService';
import { cn } from '@/lib/utils';
import { Boxes } from '@/components/ui/background-boxes';
import { AnimatedLogo } from '@/components';

/**
 * AcceptInvitePage - handles organization invitation acceptance flow
 *
 * Flow:
 * 1. Read token from URL query param
 * 2. Validate invitation via API
 * 3. If not authenticated, show login/register options with redirect back
 * 4. If authenticated, show accept button
 * 5. On accept, create membership and redirect to dashboard
 */
export default function AcceptInvitePage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Get auth state
  const isAuthenticated = useBackendAuthStore((state) => state.isAuthenticated);
  const isInitialized = useBackendAuthStore((state) => state.isInitialized);
  const user = useBackendAuthStore((state) => state.user);

  // Validate invitation token
  const {
    data: invitation,
    isLoading,
    error,
    isError,
  } = useQuery<InvitationValidation, Error>({
    queryKey: ['invitation', token],
    queryFn: async () => {
      if (!token) {
        throw new Error('No invitation token provided');
      }
      return validateInvitation(token);
    },
    enabled: !!token,
    retry: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Accept invitation mutation
  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!token) {
        throw new Error('No invitation token');
      }
      return acceptInvitation(token);
    },
    onSuccess: (data) => {
      // Invalidate organization-related queries
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      queryClient.invalidateQueries({ queryKey: ['myOrganization'] });

      toast.success(`You've joined ${data.organization.name}!`);
      navigate('/dashboard', { replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to accept invitation');
    },
  });

  // Build redirect URL for login/register
  const buildRedirectUrl = (path: string) => {
    const redirectPath = `/accept-invite?token=${encodeURIComponent(token || '')}`;
    return `${path}?redirect=${encodeURIComponent(redirectPath)}`;
  };

  // Show loading while auth is initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex bg-slate-900 overflow-hidden relative">
        <div className="absolute inset-0 overflow-hidden z-0">
          <Boxes />
        </div>
        <div className="flex-1 flex items-center justify-center z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // No token provided
  if (!token) {
    return (
      <div className="min-h-screen flex bg-slate-900 overflow-hidden relative">
        <div className="absolute inset-0 overflow-hidden z-0">
          <Boxes />
        </div>
        <div className="flex-1 flex items-center justify-center p-4 z-10 pointer-events-none [&_*]:pointer-events-auto">
          <div className="w-full max-w-md">
            <div className="flex justify-center mb-6">
              <AnimatedLogo variant="light" height={36} />
            </div>
            <Card className="bg-surface-2/80 backdrop-blur-xl border-sleek-line-default">
              <CardHeader className="text-center">
                <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
                <CardTitle className="text-white">Invalid Link</CardTitle>
                <CardDescription className="text-white/60">
                  No invitation token was provided. Please check your invitation link.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
                  Go to Login
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Loading invitation validation
  if (isLoading) {
    return (
      <div className="min-h-screen flex bg-slate-900 overflow-hidden relative">
        <div className="absolute inset-0 overflow-hidden z-0">
          <Boxes />
        </div>
        <div className="flex-1 flex items-center justify-center p-4 z-10 pointer-events-none [&_*]:pointer-events-auto">
          <div className="w-full max-w-md">
            <div className="flex justify-center mb-6">
              <AnimatedLogo variant="light" height={36} />
            </div>
            <Card className="bg-surface-2/80 backdrop-blur-xl border-sleek-line-default">
              <CardHeader className="text-center">
                <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
                <CardTitle className="text-white">Validating Invitation</CardTitle>
                <CardDescription className="text-white/60">
                  Please wait while we verify your invitation...
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Error - invitation invalid or expired
  if (isError) {
    return (
      <div className="min-h-screen flex bg-slate-900 overflow-hidden relative">
        <div className="absolute inset-0 overflow-hidden z-0">
          <Boxes />
        </div>
        <div className="flex-1 flex items-center justify-center p-4 z-10 pointer-events-none [&_*]:pointer-events-auto">
          <div className="w-full max-w-md">
            <div className="flex justify-center mb-6">
              <AnimatedLogo variant="light" height={36} />
            </div>
            <Card className="bg-surface-2/80 backdrop-blur-xl border-sleek-line-default">
              <CardHeader className="text-center">
                <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
                <CardTitle className="text-white">Invalid Invitation</CardTitle>
                <CardDescription className="text-white/60">
                  {error?.message || 'This invitation link is invalid or has expired.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-white/50 text-center">
                  Please contact the organization administrator for a new invitation.
                </p>
                <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
                  Go to Login
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Invitation is valid but user is not authenticated
  if (!isAuthenticated && invitation) {
    return (
      <div className="min-h-screen flex bg-slate-900 overflow-hidden relative">
        <div className="absolute inset-0 overflow-hidden z-0">
          <Boxes />
        </div>
        <div className="flex-1 flex items-center justify-center p-4 z-10 pointer-events-none [&_*]:pointer-events-auto">
          <div className="w-full max-w-md">
            <div className="flex justify-center mb-6">
              <AnimatedLogo variant="light" height={36} />
            </div>
            <Card className="bg-surface-2/80 backdrop-blur-xl border-sleek-line-default">
              <CardHeader className="text-center">
                <Building2 className="h-12 w-12 mx-auto text-primary mb-4" />
                <CardTitle className="text-white">Join {invitation.organization.name}</CardTitle>
                <CardDescription className="text-white/60">
                  You've been invited to join this organization as a{' '}
                  <span className="font-medium text-white/80">{invitation.role.toLowerCase()}</span>
                  . Please log in or create an account to accept.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" onClick={() => navigate(buildRedirectUrl('/login'))}>
                  Log In to Accept
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(buildRedirectUrl('/register'))}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Account
                </Button>
                <p className="text-xs text-white/40 text-center pt-2">
                  Invitation sent to: {invitation.email}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // User is authenticated and invitation is valid - show accept button
  if (isAuthenticated && invitation) {
    return (
      <div className="min-h-screen flex bg-slate-900 overflow-hidden relative">
        <div className="absolute inset-0 overflow-hidden z-0">
          <Boxes />
        </div>
        <div className="flex-1 flex items-center justify-center p-4 z-10 pointer-events-none [&_*]:pointer-events-auto">
          <div className="w-full max-w-md">
            <div className="flex justify-center mb-6">
              <AnimatedLogo variant="light" height={36} />
            </div>
            <Card className="bg-surface-2/80 backdrop-blur-xl border-sleek-line-default">
              <CardHeader className="text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-status-success mb-4" />
                <CardTitle className="text-white">Join {invitation.organization.name}</CardTitle>
                <CardDescription className="text-white/60">
                  You've been invited to join as a{' '}
                  <span className="font-medium text-white/80">{invitation.role.toLowerCase()}</span>
                  .
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {user?.email && user.email !== invitation.email && (
                  <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-warning text-sm">
                    <p>
                      This invitation was sent to <strong>{invitation.email}</strong>, but you're
                      logged in as <strong>{user.email}</strong>.
                    </p>
                  </div>
                )}
                <Button
                  className="w-full"
                  onClick={() => acceptMutation.mutate()}
                  disabled={acceptMutation.isPending}
                  data-testid="accept-invite-button"
                >
                  {acceptMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Accept Invitation
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-white/50 hover:text-white/80"
                  onClick={() => navigate('/dashboard')}
                  disabled={acceptMutation.isPending}
                  data-testid="decline-invite-button"
                >
                  Decline and go to Dashboard
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Fallback loading state
  return (
    <div className="min-h-screen flex bg-slate-900 overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden z-0">
        <Boxes />
      </div>
      <div className="flex-1 flex items-center justify-center z-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </div>
  );
}
