import { useEffect, useMemo, useState } from 'react';
import { useTimeout } from 'usehooks-ts';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import authService from '@/services/authService';

type CallbackStatus = 'loading' | 'success' | 'error';

/**
 * Auth Callback Page
 *
 * Handles redirects from:
 * 1. Supabase email confirmation links (query params)
 * 2. OAuth provider redirects (hash fragment with tokens)
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [message, setMessage] = useState('Processing authentication...');

  // Handle OAuth callback on mount
  useEffect(() => {
    const handleCallback = async () => {
      // Check for OAuth callback (Supabase redirects with hash fragment)
      const hashParams = new URLSearchParams(location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken && refreshToken) {
        // OAuth flow - sync with backend
        try {
          setMessage('Completing sign in with Google...');

          const response = await authService.handleOAuthCallback({
            accessToken,
            refreshToken,
          });

          if (response.success && response.data) {
            // Update auth store with user data
            const setAuthFromOAuth = useAuthStore.getState().setAuthFromOAuth;
            if (setAuthFromOAuth) {
              setAuthFromOAuth(response.data);
            }

            setStatus('success');
            setMessage('Sign in successful! Redirecting to dashboard...');

            // Clear hash from URL for security
            window.history.replaceState(null, '', location.pathname);

            // Redirect after short delay
            setTimeout(() => {
              navigate('/dashboard', { replace: true });
            }, 1500);
          } else {
            throw new Error(response.error || 'OAuth callback failed');
          }
        } catch (error) {
          console.error('OAuth callback error:', error);
          setStatus('error');
          setMessage('Failed to complete sign in. Please try again.');
        }
        return;
      }

      // Check for regular Supabase email confirmation callback
      const type = searchParams.get('type');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        setStatus('error');
        setMessage(errorDescription || 'Something went wrong. Please try again.');
        return;
      }

      if (type === 'signup') {
        setStatus('success');
        setMessage('Your email has been verified successfully!');
        return;
      }

      if (type === 'recovery') {
        setStatus('success');
        setMessage('Password recovery confirmed. You can now reset your password.');
        return;
      }

      if (type === 'invite' || type === 'magiclink') {
        setStatus('success');
        setMessage('Authentication successful! Redirecting...');
        return;
      }

      // Default case - no recognized callback type
      setStatus('success');
      setMessage('Authentication successful!');
    };

    handleCallback();
  }, [location, navigate, searchParams]);

  // Get type for redirect logic (for non-OAuth flows)
  const type = searchParams.get('type');

  // Redirect after success (auto-cleanup on unmount)
  useTimeout(
    () => {
      // Only auto-redirect for non-OAuth flows (OAuth handles its own redirect)
      const hashParams = new URLSearchParams(location.hash.substring(1));
      const isOAuth = hashParams.has('access_token');

      if (!isOAuth) {
        if (type === 'signup') {
          navigate('/login', {
            state: { message: 'Email verified! You can now log in.' },
          });
        } else if (type === 'recovery') {
          navigate('/reset-password');
        } else {
          navigate('/dashboard');
        }
      }
    },
    status === 'success' ? 3000 : null
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted dark:from-background dark:to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-2">
            <div
              className={`rounded-full p-3 ${
                status === 'success'
                  ? 'bg-success-light'
                  : status === 'error'
                    ? 'bg-error-light'
                    : 'bg-primary/10'
              }`}
            >
              {status === 'loading' && <Loader2 className="h-6 w-6 text-primary animate-spin" />}
              {status === 'success' && <CheckCircle className="h-6 w-6 text-status-success" />}
              {status === 'error' && <AlertCircle className="h-6 w-6 text-status-error" />}
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            {status === 'loading' && 'Processing...'}
            {status === 'success' && 'Success!'}
            {status === 'error' && 'Something went wrong'}
          </CardTitle>
          <CardDescription className="text-center">{message}</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center space-y-4">
          {status === 'loading' && <p className="text-sm text-muted-foreground">Please wait...</p>}

          {status === 'success' && (
            <p className="text-sm text-muted-foreground">Redirecting you automatically...</p>
          )}

          {status === 'error' && (
            <div className="flex flex-col gap-2 w-full">
              <Button onClick={() => navigate('/login')} className="w-full">
                Go to Login
              </Button>
              <Button variant="outline" onClick={() => navigate('/register')} className="w-full">
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
