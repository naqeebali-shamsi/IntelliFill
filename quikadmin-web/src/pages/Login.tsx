import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, LogIn, Eye, EyeOff, AlertCircle, Zap, Shield, Clock } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { ErrorCode } from '@/constants/errorCodes';
import { Testimonial } from '@/components/ui/design-testimonial';
import { Boxes } from '@/components/ui/background-boxes';
import { SleekIconButton, AccentLine, AnimatedLogo } from '@/components';
import { cn } from '@/lib/utils';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    companySlug: '',
    rememberMe: false,
  });

  // Get auth store state and actions
  const { login, clearError } = useAuthStore();
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const isLocked = useAuthStore((state) => state.isLocked);
  const loginAttempts = useAuthStore((state) => state.loginAttempts);
  const lockExpiry = useAuthStore((state) => state.lockExpiry);

  // Countdown timer for lockout display
  const [lockCountdown, setLockCountdown] = useState<string | null>(null);

  useEffect(() => {
    if (!isLocked || !lockExpiry) {
      setLockCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const remaining = lockExpiry - Date.now();
      if (remaining <= 0) {
        setLockCountdown(null);
        return;
      }
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setLockCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isLocked, lockExpiry]);

  // Check if coming from expired session
  const wasExpired = location.state?.expired;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    // Check if account is locked
    if (isLocked && lockExpiry && Date.now() < lockExpiry) {
      const remainingTime = Math.ceil((lockExpiry - Date.now()) / 60000);
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
      // Priority: 1) redirect query param, 2) location state, 3) dashboard
      const redirectParam = searchParams.get('redirect');
      const redirectTo = redirectParam || location.state?.from?.pathname || '/dashboard';
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      console.error('Login error:', err);
      // Error is already set in the store by the login action
      // Show toast for better UX
      if (err.code === ErrorCode.ACCOUNT_LOCKED) {
        toast.error('Account locked due to multiple failed attempts');
      } else if (err.code === ErrorCode.INVALID_CREDENTIALS) {
        toast.error('Invalid email or password');
      } else {
        toast.error(err.message || 'Login failed. Please try again.');
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    // Clear error when user starts typing
    if (error) clearError();
  };

  return (
    <div className="h-screen flex bg-slate-900 overflow-hidden relative">
      {/* Animated background boxes - interactive layer */}
      <div className="absolute inset-0 overflow-hidden z-0">
        <Boxes />
      </div>

      {/* Hero Section - Left side (Desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 p-12 flex-col justify-between relative z-10 overflow-y-auto pointer-events-none [&_*]:pointer-events-auto">
        {/* Content */}
        <div className="relative">
          <div className="mb-6">
            <AnimatedLogo variant="light" height={40} />
          </div>

          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6 font-heading tracking-tight">
            Stop filling forms manually.
            <span className="block mt-2 text-white/90">Let AI do it.</span>
          </h2>

          <p className="text-xl text-white/70 max-w-lg mb-8 leading-relaxed">
            Intelligent document processing for UAE PRO agencies. Upload client documents, extract
            data automatically, and fill government forms in seconds.
          </p>

          {/* Feature highlights */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3 text-white/80">
              <div className="h-9 w-9 rounded-full border border-white/20 flex items-center justify-center">
                <Zap className="h-4 w-4" />
              </div>
              <span className="text-[15px]">93% OCR accuracy with AI-powered extraction</span>
            </div>
            <div className="flex items-center gap-3 text-white/80">
              <div className="h-9 w-9 rounded-full border border-white/20 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
              <span className="text-[15px]">Process documents in under 2 seconds</span>
            </div>
            <div className="flex items-center gap-3 text-white/80">
              <div className="h-9 w-9 rounded-full border border-white/20 flex items-center justify-center">
                <Shield className="h-4 w-4" />
              </div>
              <span className="text-[15px]">Bank-grade encryption for all client data</span>
            </div>
          </div>
        </div>

        {/* Animated Testimonial Carousel */}
        <div className="relative mt-auto">
          <Testimonial />
        </div>
      </div>

      {/* Login Form - Right side */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 relative z-10 overflow-y-auto pointer-events-none [&_*]:pointer-events-auto">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <AnimatedLogo variant="light" height={36} />
          </div>

          {/* Sleek Card */}
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

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Alerts */}
              {wasExpired && (
                <Alert className="bg-warning/10 border-warning/30 text-warning">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your session has expired. Please log in again.
                  </AlertDescription>
                </Alert>
              )}

              {/* Prominent lockout alert with countdown */}
              {isLocked && lockExpiry && (
                <Alert variant="destructive" data-testid="lockout-alert">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Account Locked</AlertTitle>
                  <AlertDescription>
                    Too many failed login attempts. Try again in {lockCountdown || 'a few minutes'}.
                  </AlertDescription>
                </Alert>
              )}

              {error && !isLocked && (
                <Alert variant="destructive" className="bg-error/10 border-error/30">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {error.message}
                  </AlertDescription>
                </Alert>
              )}

              {loginAttempts > 0 && loginAttempts < 5 && !isLocked && (
                <Alert variant="warning" data-testid="attempts-warning">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {5 - loginAttempts} login attempts remaining before account lockout.
                  </AlertDescription>
                </Alert>
              )}

              {/* Company field */}
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
                  disabled={isLoading || isLocked}
                  className={cn(
                    'w-full h-11 bg-surface-1/50 border-sleek-line-default',
                    'placeholder:text-white/30 text-white',
                    'focus:border-primary focus:ring-1 focus:ring-primary/30',
                    'transition-colors'
                  )}
                />
              </div>

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
                  disabled={isLoading || isLocked}
                  autoComplete="email"
                  className={cn(
                    'w-full h-11 bg-surface-1/50 border-sleek-line-default',
                    'placeholder:text-white/30 text-white',
                    'focus:border-primary focus:ring-1 focus:ring-primary/30',
                    'transition-colors'
                  )}
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
                    disabled={isLoading || isLocked}
                    autoComplete="current-password"
                    className={cn(
                      'w-full h-11 bg-surface-1/50 border-sleek-line-default pr-11',
                      'placeholder:text-white/30 text-white',
                      'focus:border-primary focus:ring-1 focus:ring-primary/30',
                      'transition-colors'
                    )}
                  />
                  <SleekIconButton
                    variant="ghost"
                    size="sm"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-white/50" />
                    ) : (
                      <Eye className="h-4 w-4 text-white/50" />
                    )}
                  </SleekIconButton>
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
                  disabled={isLoading || isLocked}
                  className="border-sleek-line-default data-[state=checked]:bg-primary data-[state=checked]:border-primary"
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
                disabled={isLoading || isLocked}
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

              {/* Sign up link */}
              <p className="text-center text-sm text-white/50">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Sign up
                </Link>
              </p>
            </form>
          </div>

          {/* Mobile features banner */}
          <div
            className={cn(
              'lg:hidden p-4 rounded-xl',
              'bg-surface-2/60 backdrop-blur-md',
              'border border-sleek-line-subtle'
            )}
          >
            <h3 className="font-medium text-sm mb-3 text-center text-white/80">Why IntelliFill?</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="flex flex-col items-center gap-1.5">
                <div className="h-8 w-8 rounded-full border border-primary/30 bg-primary/10 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs text-white/60">93% Accuracy</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <div className="h-8 w-8 rounded-full border border-primary/30 bg-primary/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs text-white/60">&lt;2s Process</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <div className="h-8 w-8 rounded-full border border-primary/30 bg-primary/10 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs text-white/60">Secure</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
