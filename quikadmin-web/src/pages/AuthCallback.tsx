import { useMemo } from 'react';
import { useTimeout } from 'usehooks-ts';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle } from 'lucide-react';

/**
 * Auth Callback Page
 *
 * Handles redirects from Supabase email confirmation links.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { status, message } = useMemo(() => {
    const type = searchParams.get('type');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      return {
        status: 'error' as const,
        message: errorDescription || 'Something went wrong. Please try again.',
      };
    }

    if (type === 'signup') {
      return {
        status: 'success' as const,
        message: 'Your email has been verified successfully!',
      };
    }

    if (type === 'recovery') {
      return {
        status: 'success' as const,
        message: 'Password recovery confirmed. You can now reset your password.',
      };
    }

    if (type === 'invite' || type === 'magiclink') {
      return {
        status: 'success' as const,
        message: 'Authentication successful! Redirecting...',
      };
    }

    // Default for case where type might be missing but no error
    return {
      status: 'success' as const,
      message: 'Authentication successful!',
    };
  }, [searchParams]);

  // Get type for redirect logic
  const type = searchParams.get('type');

  // Redirect after success (auto-cleanup on unmount)
  useTimeout(
    () => {
      if (type === 'signup') {
        navigate('/login', {
          state: { message: 'Email verified! You can now log in.' },
        });
      } else if (type === 'recovery') {
        navigate('/reset-password');
      } else {
        navigate('/dashboard');
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
              {status === 'success' && <CheckCircle className="h-6 w-6 text-status-success" />}
              {status === 'error' && <AlertCircle className="h-6 w-6 text-status-error" />}
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            {status === 'success' && 'Success!'}
            {status === 'error' && 'Something went wrong'}
          </CardTitle>
          <CardDescription className="text-center">{message}</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center space-y-4">
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
