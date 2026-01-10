import React, { useState, useEffect } from 'react';
import { useToggle, useTimeout } from 'usehooks-ts';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
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
import { Loader2, Lock, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import {
  AuthPageLayout,
  PasswordRequirements,
  PasswordVisibilityToggle,
  SuccessState,
} from '@/components/auth';
import { validatePassword, validatePasswordsMatch } from '@/lib/validations/password';

function InvalidTokenView({ error }: { error: string | null }): React.ReactElement {
  return (
    <AuthPageLayout>
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center text-destructive">
          Invalid Reset Link
        </CardTitle>
        <CardDescription className="text-center">
          {error || 'This password reset link is invalid or has expired.'}
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex flex-col space-y-3">
        <Link to="/forgot-password" className="w-full">
          <Button variant="default" className="w-full">
            Request new reset link
          </Button>
        </Link>
        <Link to="/login" className="w-full">
          <Button variant="ghost" className="w-full">
            Back to login
          </Button>
        </Link>
      </CardFooter>
    </AuthPageLayout>
  );
}

function SuccessView(): React.ReactElement {
  return (
    <AuthPageLayout>
      <CardContent className="pt-6">
        <SuccessState
          title="Password Reset Successful!"
          message="Your password has been successfully reset."
          submessage="Redirecting to login page..."
          linkTo="/login"
          linkText="Continue to login"
        />
      </CardContent>
    </AuthPageLayout>
  );
}

export default function ResetPassword(): React.ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, toggleShowPassword] = useToggle(false);
  const [showConfirmPassword, toggleShowConfirmPassword] = useToggle(false);
  const [isLoading, , setIsLoading] = useToggle(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isTokenValid, setIsTokenValid] = useState(true);
  const [resetSuccess, , setResetSuccess] = useToggle(false);

  const { resetPassword, verifyResetToken } = useAuthStore();

  useTimeout(
    () => {
      navigate('/login', {
        state: { message: 'Password reset successful. Please log in with your new password.' },
      });
    },
    resetSuccess ? 3000 : null
  );

  useEffect(() => {
    async function validateToken(): Promise<void> {
      if (!token) {
        setIsTokenValid(false);
        setError('Invalid or missing reset token');
        return;
      }

      try {
        await verifyResetToken(token);
        setIsTokenValid(true);
      } catch (err: unknown) {
        setIsTokenValid(false);
        const message = err instanceof Error ? err.message : 'Invalid or expired reset link';
        setError(message);
      }
    }

    validateToken();
  }, [token, verifyResetToken]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);

    if (name === 'password') {
      const result = validatePassword(value);
      setValidationErrors(result.errors);
    }
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    if (!validatePasswordsMatch(formData.password, formData.confirmPassword)) {
      setError('Passwords do not match');
      return;
    }

    const validation = validatePassword(formData.password);
    if (!validation.isValid) {
      setError('Password does not meet requirements');
      return;
    }

    if (!token) {
      setError('Invalid reset token');
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword(token, formData.password);
      setResetSuccess(true);
      toast.success('Password reset successful!');
    } catch (err: unknown) {
      logger.error('Password reset error:', err);
      const message =
        err instanceof Error ? err.message : 'Failed to reset password. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  if (!isTokenValid) {
    return <InvalidTokenView error={error} />;
  }

  if (resetSuccess) {
    return <SuccessView />;
  }

  const passwordsMatch = validatePasswordsMatch(formData.password, formData.confirmPassword);
  const isSubmitDisabled = isLoading || validationErrors.length > 0 || !passwordsMatch;

  return (
    <AuthPageLayout>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Reset your password</CardTitle>
        <CardDescription>
          {email ? `Resetting password for ${email}` : 'Enter your new password below'}
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit} data-testid="reset-password-form">
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={isLoading}
                autoComplete="new-password"
                className="w-full pr-10"
                data-testid="reset-password-input"
              />
              <PasswordVisibilityToggle
                showPassword={showPassword}
                onToggle={toggleShowPassword}
                testId="reset-toggle-password-visibility"
              />
            </div>

            {formData.password && (
              <PasswordRequirements
                errors={validationErrors}
                testId="password-strength-indicator"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={isLoading}
                autoComplete="new-password"
                className="w-full pr-10"
                data-testid="reset-password-confirm-input"
              />
              <PasswordVisibilityToggle
                showPassword={showConfirmPassword}
                onToggle={toggleShowConfirmPassword}
                testId="reset-toggle-confirm-password-visibility"
              />
            </div>
            {formData.confirmPassword && !passwordsMatch && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitDisabled}
            data-testid="reset-password-submit-button"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting password...
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Reset password
              </>
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Remember your password?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Back to login
            </Link>
          </div>
        </CardFooter>
      </form>
    </AuthPageLayout>
  );
}
