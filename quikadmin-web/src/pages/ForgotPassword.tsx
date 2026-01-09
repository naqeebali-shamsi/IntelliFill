import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { requestPasswordReset } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await requestPasswordReset(email);
      setEmailSent(true);
      toast.success('Password reset email sent!');
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to send reset email. Please try again.');
      toast.error(err.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setIsLoading(true);

    try {
      await requestPasswordReset(email);
      toast.success('Reset email resent!');
    } catch (err: any) {
      console.error('Password reset resend error:', err);
      toast.error('Failed to resend email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted dark:from-background dark:to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <CardTitle className="text-2xl font-bold">
              {emailSent ? 'Check your email' : 'Forgot password?'}
            </CardTitle>
          </div>
          <CardDescription>
            {emailSent
              ? `We've sent a password reset link to ${email}`
              : "Enter your email address and we'll send you a link to reset your password."}
          </CardDescription>
        </CardHeader>

        {!emailSent ? (
          <form onSubmit={handleSubmit} data-testid="forgot-password-form">
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                  autoFocus
                  className="w-full"
                  data-testid="forgot-password-email-input"
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={isLoading || !email} data-testid="forgot-password-submit-button">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send reset link
                  </>
                )}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                Remember your password?{' '}
                <Link to="/login" className="font-medium text-primary hover:underline" data-testid="forgot-password-back-link">
                  Back to login
                </Link>
              </div>
            </CardFooter>
          </form>
        ) : (
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="rounded-full bg-success-light p-3">
                <CheckCircle2 className="h-8 w-8 text-status-success" />
              </div>

              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  If an account exists for <strong>{email}</strong>, you will receive a password
                  reset link shortly.
                </p>
                <p className="text-sm text-muted-foreground">The link will expire in 1 hour.</p>
              </div>

              <div className="flex flex-col gap-3 w-full pt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleResend}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resending...
                    </>
                  ) : (
                    'Resend email'
                  )}
                </Button>

                <Link to="/login" className="w-full">
                  <Button variant="ghost" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to login
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
