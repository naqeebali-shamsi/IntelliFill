import React, { useState } from 'react';
import { useTimeout } from 'usehooks-ts';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { verifyEmail, resendVerification } from '@/services/authService';

// Sanitize email from URL to prevent XSS
const sanitizeEmail = (email: string | null): string => {
  if (!email) return '';
  // Remove any HTML/script tags and trim
  const sanitized = email
    .replace(/<[^>]*>/g, '')
    .trim()
    .toLowerCase();
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized) ? sanitized : '';
};

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    email: sanitizeEmail(searchParams.get('email')),
    code: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isResending, setIsResending] = useState(false);
  // Redirect to login after successful verification (auto-cleanup on unmount)
  useTimeout(
    () => {
      navigate('/login', {
        state: {
          message: 'Email verified! You can now log in.',
        },
      });
    },
    success ? 2000 : null
  );


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate email
    if (!formData.email) {
      setError('Email is required');
      toast.error('Email is required');
      return;
    }

    // Validate code
    if (!formData.code || formData.code.length !== 6) {
      setError('Please enter a valid 6-digit verification code');
      toast.error('Please enter a valid 6-digit verification code');
      return;
    }

    setIsLoading(true);

    try {
      const response = await verifyEmail(formData.email, formData.code);

      if (response.success) {
        setSuccess(true);
        toast.success('Email verified successfully! Redirecting to login...');
      } else {
        throw new Error(response.message || 'Verification failed');
      }
    } catch (err: any) {
      console.error('Email verification error:', err);

      // Handle rate limiting specifically
      if (err.response?.status === 429) {
        const errorMessage = 'Too many verification attempts. Please try again later.';
        setError(errorMessage);
        toast.error(errorMessage);
        return;
      }

      // Use generic error message to prevent information leakage
      const errorMessage =
        err.response?.status === 400
          ? 'Invalid or expired verification code. Please request a new code.'
          : 'Verification failed. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // For code, only allow digits and limit to 6 characters
    if (name === 'code') {
      const sanitized = value.replace(/\D/g, '').slice(0, 6);
      setFormData((prev) => ({ ...prev, [name]: sanitized }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    // Clear error when user starts typing
    if (error) setError(null);
  };

  const handleResend = async () => {
    if (!formData.email) {
      setError('Please enter your email first');
      toast.error('Please enter your email first');
      return;
    }

    setIsResending(true);
    setError(null);

    try {
      const response = await resendVerification(formData.email);
      if (response.success) {
        toast.success('Verification email sent! Please check your inbox.');
      } else {
        throw new Error(response.message || 'Failed to resend');
      }
    } catch (err: any) {
      console.error('Resend verification error:', err);

      if (err.response?.status === 429) {
        const errorMessage = 'Too many requests. Please wait before trying again.';
        setError(errorMessage);
        toast.error(errorMessage);
        return;
      }

      const errorMessage = err.response?.data?.message || 'Failed to resend verification email';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-2">
            <div className="rounded-full bg-primary/10 p-3">
              <Mail className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Verify Your Email</CardTitle>
          <CardDescription className="text-center">
            Enter the 6-digit verification code sent to your email
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {success ? (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  Email verified successfully! Redirecting to login...
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    autoComplete="email"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code">Verification Code</Label>
                  <Input
                    id="code"
                    name="code"
                    type="text"
                    placeholder="000000"
                    value={formData.code}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    autoComplete="off"
                    className="w-full text-center text-2xl tracking-widest font-mono"
                    maxLength={6}
                    inputMode="numeric"
                    pattern="\d{6}"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Enter the 6-digit code from your email
                  </p>
                </div>
              </>
            )}
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            {!success && (
              <>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !formData.email || formData.code.length !== 6}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Verify Email
                    </>
                  )}
                </Button>

                <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                  <p>
                    Didn't receive the code?{' '}
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={isResending || !formData.email}
                      className="font-medium text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isResending ? 'Sending...' : 'Resend code'}
                    </button>
                  </p>
                  <p className="mt-2">
                    <Link to="/login" className="font-medium text-primary hover:underline">
                      Back to login
                    </Link>
                  </p>
                </div>
              </>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
