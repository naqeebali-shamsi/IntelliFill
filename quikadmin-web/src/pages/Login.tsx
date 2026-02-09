import { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, LogIn, AlertCircle, Shield, Zap } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { ErrorCode } from '@/constants/errorCodes';
import { Boxes } from '@/components/ui/background-boxes';
import { AccentLine, AnimatedLogo, PasswordVisibilityToggle, AttemptsWarning } from '@/components';
import { GoogleAuthButton } from '@/components/auth';
import { cn } from '@/lib/utils';
import { logger } from '@/utils/logger';
import { useBoolean, useLockoutCountdown } from '@/hooks';

/** Validate that a redirect URL is a safe relative path (prevents open redirect) */
function isSafeRedirect(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//') && !url.includes('://');
}

// Shared input styling for auth forms
const authInputClassName = cn(
  'w-full h-11 bg-surface-1/50 border-sleek-line-default',
  'placeholder:text-white/30 text-white',
  'focus:border-primary focus:ring-1 focus:ring-primary/30',
  'transition-colors'
);

export default function Login(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { value: showPassword, toggle: togglePassword } = useBoolean(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    companySlug: '',
    rememberMe: false,
  });

  // Auth store state and actions
  const { login, demoLogin, clearError } = useAuthStore();
  const isDemoEnabled = import.meta.env.VITE_ENABLE_DEMO === 'true';
  const isMultiTenant = import.meta.env.VITE_MULTI_TENANT === 'true';
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const isLocked = useAuthStore((state) => state.isLocked);
  const loginAttempts = useAuthStore((state) => state.loginAttempts);
  const lockExpiry = useAuthStore((state) => state.lockExpiry);
  const serverLockout = useAuthStore((state) => state.serverLockout);

  // Use server lockout info when available, fallback to client-side
  const effectiveLockout = serverLockout?.isLocked || isLocked;
  const effectiveLockExpiry = serverLockout?.lockoutExpiresAt?.getTime() || lockExpiry;
  const effectiveAttemptsRemaining = serverLockout?.attemptsRemaining ?? 5 - loginAttempts;

  // Lockout countdown using custom hook
  const lockCountdown = useLockoutCountdown({
    isLocked: effectiveLockout,
    lockExpiry: effectiveLockExpiry,
  });

  const wasExpired = location.state?.expired;
  const isFormDisabled = isLoading || effectiveLockout;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    clearError();

    // Check if account is locked
    if (effectiveLockout && effectiveLockExpiry && Date.now() < effectiveLockExpiry) {
      const remainingTime = Math.ceil((effectiveLockExpiry - Date.now()) / 60000);
      toast.error(`Account is locked. Try again in ${remainingTime} minutes.`);
      return;
    }

    try {
      await login({
        email: formData.email,
        password: formData.password,
        companySlug: formData.companySlug || undefined,
        rememberMe: formData.rememberMe,
      });

      toast.success('Login successful!');

      // Navigate to intended route or dashboard
      const redirectParam = searchParams.get('redirect');
      const redirectTo =
        redirectParam && isSafeRedirect(redirectParam)
          ? redirectParam
          : location.state?.from?.pathname || '/dashboard';
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      logger.error('Login error:', error);

      if (error.code === ErrorCode.ACCOUNT_LOCKED) {
        toast.error('Account locked due to multiple failed attempts');
      } else if (error.code === ErrorCode.INVALID_CREDENTIALS) {
        toast.error('Invalid email or password');
      } else {
        toast.error(error.message || 'Login failed. Please try again.');
      }
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (error) clearError();
  }

  async function handleDemoLogin(): Promise<void> {
    clearError();
    try {
      await demoLogin();
      toast.success('Demo login successful!');
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Demo login failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 overflow-hidden relative p-4">
      {/* Animated background boxes */}
      <div className="absolute inset-0 overflow-hidden z-0">
        <Boxes />
      </div>

      {/* Login Form - Centered */}
      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <AnimatedLogo variant="light" height={40} />
        </div>

        {/* Login Card */}
        <div
          className={cn(
            'rounded-2xl p-8',
            'bg-surface-2/80 backdrop-blur-xl',
            'border border-sleek-line-default',
            'shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_50px_-12px_rgba(0,0,0,0.5)]'
          )}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <AccentLine variant="active" size="sm" />
              <h2 className="text-2xl font-semibold text-white font-heading tracking-tight">
                Welcome back
              </h2>
              <AccentLine variant="active" size="sm" />
            </div>
            <p className="text-sm text-white/60">Enter your credentials to access your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
            {/* Session expired alert */}
            {wasExpired && (
              <Alert className="bg-warning/10 border-warning/30 text-warning">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Your session has expired. Please log in again.</AlertDescription>
              </Alert>
            )}

            {/* Lockout alert with countdown */}
            {effectiveLockout && effectiveLockExpiry && (
              <Alert
                variant="destructive"
                data-testid="lockout-alert"
                className="bg-destructive/20 border-destructive"
              >
                <Shield className="h-4 w-4" />
                <AlertTitle className="font-semibold">Account Locked</AlertTitle>
                <AlertDescription>
                  Too many failed login attempts. Please try again in{' '}
                  <span className="font-medium">{lockCountdown || 'a few minutes'}</span>.
                  <br />
                  <span className="text-xs opacity-75 mt-1 block">
                    For security, your account has been temporarily locked.
                  </span>
                </AlertDescription>
              </Alert>
            )}

            {/* Error alert */}
            {error && !effectiveLockout && (
              <Alert variant="destructive" className="bg-error/10 border-error/30">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )}

            {/* Attempts warning */}
            {!effectiveLockout && (
              <AttemptsWarning attemptsRemaining={effectiveAttemptsRemaining} />
            )}

            {/* Company field - only shown in multi-tenant (B2B) mode */}
            {isMultiTenant && (
              <div className="space-y-2">
                <Label htmlFor="companySlug" className="text-sm font-medium text-white/80">
                  Company (Optional)
                </Label>
                <Input
                  id="companySlug"
                  name="companySlug"
                  type="text"
                  placeholder="your-company-slug"
                  value={formData.companySlug}
                  onChange={handleChange}
                  disabled={isFormDisabled}
                  className={authInputClassName}
                />
              </div>
            )}

            {/* Email field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-white/80">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={isFormDisabled}
                autoComplete="email"
                data-testid="login-email-input"
                className={authInputClassName}
              />
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-white/80">
                  Password
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                  tabIndex={-1}
                  data-testid="forgot-password-link"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={isFormDisabled}
                  autoComplete="current-password"
                  data-testid="login-password-input"
                  className={cn(authInputClassName, 'pr-11')}
                />
                <PasswordVisibilityToggle
                  showPassword={showPassword}
                  onToggle={togglePassword}
                  disabled={isFormDisabled}
                  testId="toggle-password-visibility"
                />
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rememberMe"
                name="rememberMe"
                checked={formData.rememberMe}
                onCheckedChange={(checked) => {
                  setFormData((prev) => ({ ...prev, rememberMe: checked as boolean }));
                }}
                disabled={isFormDisabled}
                className="border-sleek-line-default data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                data-testid="remember-me-checkbox"
              />
              <label
                htmlFor="rememberMe"
                className="text-sm text-white/60 cursor-pointer hover:text-white/80 transition-colors"
              >
                Remember me
              </label>
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              className="w-full h-11 text-[15px] font-medium"
              disabled={isFormDisabled}
              data-testid="login-submit-button"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign in
                </>
              )}
            </Button>

            {/* OAuth Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-sleek-line-subtle" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-surface-2/80 px-2 text-white/40">or continue with</span>
              </div>
            </div>

            {/* Google OAuth Button */}
            <GoogleAuthButton
              mode="login"
              disabled={isFormDisabled}
              className="w-full h-11 bg-surface-1/50 border-sleek-line-default hover:bg-surface-1 hover:border-primary/30"
            />

            {/* Sign up link */}
            <p className="text-center text-sm text-white/50 pt-2">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Sign up
              </Link>
            </p>

            {/* Demo login button */}
            {isDemoEnabled && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-sleek-line-subtle" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-surface-2/80 px-2 text-white/40">or</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleDemoLogin}
                  disabled={isLoading}
                  data-testid="demo-login-button"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Try Demo Account
                </Button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
