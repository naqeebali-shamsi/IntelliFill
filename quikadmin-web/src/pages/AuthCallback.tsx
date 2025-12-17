import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';

/**
 * Auth Callback Page
 *
 * Handles redirects from Supabase email confirmation links.
 * When users click the confirmation link in their email, Supabase verifies
 * their email and redirects here with query params indicating the result.
 *
 * Query params from Supabase:
 * - type: 'signup' | 'recovery' | 'invite' | 'magiclink'
 * - access_token, refresh_token (for magic links)
 * - error, error_description (if something went wrong)
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing...');

  useEffect(() => {
    const type = searchParams.get('type');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle errors
    if (error) {
      setStatus('error');
      setMessage(errorDescription || 'Something went wrong. Please try again.');
      return;
    }

    // Handle different callback types
    switch (type) {
      case 'signup':
        setStatus('success');
        setMessage('Your email has been verified successfully!');
        // Auto-redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login', {
            state: { message: 'Email verified! You can now log in.' },
          });
        }, 3000);
        break;

      case 'recovery':
        // Password recovery - redirect to reset password page
        setStatus('success');
        setMessage('Redirecting to password reset...');
        setTimeout(() => {
          navigate('/reset-password');
        }, 1500);
        break;

      case 'magiclink':
      case 'invite':
        // Handle magic link login or invite
        setStatus('success');
        setMessage('Authentication successful! Redirecting...');
        setTimeout(() => {
          navigate('/');
        }, 1500);
        break;

      default:
        // Unknown or no type - assume email verification
        setStatus('success');
        setMessage('Email verified successfully!');
        setTimeout(() => {
          navigate('/login', {
            state: { message: 'Email verified! You can now log in.' },
          });
        }, 3000);
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-2">
            <div
              className={`rounded-full p-3 ${
                status === 'success'
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : status === 'error'
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : 'bg-primary/10'
              }`}
            >
              {status === 'loading' && <Loader2 className="h-6 w-6 text-primary animate-spin" />}
              {status === 'success' && (
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              )}
              {status === 'error' && (
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              )}
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
