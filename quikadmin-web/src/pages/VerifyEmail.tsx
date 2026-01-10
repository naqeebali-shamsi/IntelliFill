import React, { useState } from 'react';
import { useTimeout } from 'usehooks-ts';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import {
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
import { AuthPageLayout } from '@/components/auth';

function sanitizeEmail(email: string | null): string {
  if (!email) return '';
  const sanitized = email
    .replace(/<[^>]*>/g, '')
    .trim()
    .toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized) ? sanitized : '';
}

function sanitizeCodeInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

function getErrorMessage(err: unknown, statusCode?: number): string {
  if (statusCode === 429) {
    return 'Too many verification attempts. Please try again later.';
  }
  if (statusCode === 400) {
    return 'Invalid or expired verification code. Please request a new code.';
  }
  return 'Verification failed. Please try again.';
}

export default function VerifyEmail(): React.ReactElement {
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

  useTimeout(
    () => {
      navigate('/login', {
        state: { message: 'Email verified! You can now log in.' },
      });
    },
    success ? 2000 : null
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const { name, value } = e.target;
    const sanitizedValue = name === 'code' ? sanitizeCodeInput(value) : value;
    setFormData((prev) => ({ ...prev, [name]: sanitizedValue }));
    if (error) setError(null);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    if (!formData.email) {
      const msg = 'Email is required';
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!formData.code || formData.code.length !== 6) {
      const msg = 'Please enter a valid 6-digit verification code';
      setError(msg);
      toast.error(msg);
      return;
    }

    setIsLoading(true);

    try {
      const response = await verifyEmail(formData.email, formData.code);
      if (!response.success) {
        throw new Error(response.message || 'Verification failed');
      }
      setSuccess(true);
      toast.success('Email verified successfully! Redirecting to login...');
    } catch (err: unknown) {
      logger.error('Email verification error:', err);
      const statusCode = (err as { response?: { status?: number } })?.response?.status;
      const errorMessage = getErrorMessage(err, statusCode);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend(): Promise<void> {
    if (!formData.email) {
      const msg = 'Please enter your email first';
      setError(msg);
      toast.error(msg);
      return;
    }

    setIsResending(true);
    setError(null);

    try {
      const response = await resendVerification(formData.email);
      if (!response.success) {
        throw new Error(response.message || 'Failed to resend');
      }
      toast.success('Verification email sent! Please check your inbox.');
    } catch (err: unknown) {
      logger.error('Resend verification error:', err);
      const statusCode = (err as { response?: { status?: number; data?: { message?: string } } })
        ?.response?.status;
      const errorMessage =
        statusCode === 429
          ? 'Too many requests. Please wait before trying again.'
          : (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            'Failed to resend verification email';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsResending(false);
    }
  }

  const isCodeValid = formData.code.length === 6;
  const isSubmitDisabled = isLoading || !formData.email || !isCodeValid;

  return (
    <AuthPageLayout>
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

      <form onSubmit={handleSubmit} data-testid="verify-email-form">
        <CardContent className="space-y-4">
          {success ? (
            <Alert className="border-success/20 bg-success-light">
              <CheckCircle className="h-4 w-4 text-success" />
              <AlertDescription className="text-success-foreground">
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
                  data-testid="verify-email-email-input"
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
                  data-testid="verify-email-code-input"
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
                disabled={isSubmitDisabled}
                data-testid="verify-email-submit-button"
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

              <div className="text-center text-sm text-muted-foreground">
                <p>
                  Didn't receive the code?{' '}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResending || !formData.email}
                    className="font-medium text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="resend-verification-button"
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
    </AuthPageLayout>
  );
}
