import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToggle } from 'usehooks-ts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2,
  UserPlus,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
  X,
  Zap,
  Shield,
  Clock,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { ErrorCode } from '@/constants/errorCodes';
import { Boxes } from '@/components/ui/background-boxes';
import { SleekIconButton, AccentLine, AnimatedLogo } from '@/components';
import { cn } from '@/lib/utils';

interface PasswordStrength {
  score: number;
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

const RequirementItem = ({ met, text }: { met: boolean; text: string }) => (
  <div className="flex items-center gap-1 text-xs">
    {met ? (
      <Check className="h-3 w-3 text-status-success" />
    ) : (
      <X className="h-3 w-3 text-muted-foreground/60" />
    )}
    <span className={met ? 'text-success-foreground' : 'text-muted-foreground'}>{text}</span>
  </div>
);

export default function Register() {
  const navigate = useNavigate();
  const [showPassword, toggleShowPassword] = useToggle(false);
  const [agreedToTerms, toggleAgreedToTerms, setAgreedToTerms] = useToggle(false);
  const [marketingConsent, toggleMarketingConsent, setMarketingConsent] = useToggle(false);

  // Get auth store state and actions
  const { register, clearError } = useAuthStore();
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    score: 0,
    requirements: {
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      special: false,
    },
  });

  const checkPasswordStrength = (password: string) => {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[@$!%*?&]/.test(password),
    };

    const score = Object.values(requirements).filter(Boolean).length;

    setPasswordStrength({
      score,
      requirements,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Validate password strength
    if (passwordStrength.score < 4) {
      toast.error('Password does not meet all requirements');
      return;
    }

    // Validate terms agreement
    if (!agreedToTerms) {
      toast.error('You must agree to the terms and conditions');
      return;
    }

    try {
      await register({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        acceptTerms: agreedToTerms,
        marketingConsent,
      });

      // Get the auth state to check if tokens are present
      const authState = useAuthStore.getState();

      // Check if email verification is required (tokens will be null)
      if (!authState.tokens) {
        // Email verification required - redirect to verify-email page
        toast.success('Registration successful! Please check your email for verification code.');
        navigate(`/verify-email?email=${encodeURIComponent(formData.email)}`);
      } else {
        // Development mode or verification disabled - direct login
        toast.success('Registration successful! Welcome aboard!');
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      // Error is already set in the store by the register action
      // Show toast for better UX
      if (err.code === ErrorCode.EMAIL_EXISTS) {
        toast.error('An account with this email already exists');
      } else if (err.code === ErrorCode.RATE_LIMIT) {
        toast.error('Too many registration attempts. Please try again later.');
      } else {
        toast.error(err.message || 'Registration failed. Please try again.');
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Check password strength when password changes
    if (name === 'password') {
      checkPasswordStrength(value);
    }

    // Clear error when user starts typing
    if (error) clearError();
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength.score <= 2) return 'bg-error';
    if (passwordStrength.score <= 3) return 'bg-warning';
    if (passwordStrength.score <= 4) return 'bg-success';
    return 'bg-success';
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
            Start automating
            <span className="block mt-2 text-white/90">your document workflow.</span>
          </h2>

          <p className="text-xl text-white/70 max-w-lg mb-8 leading-relaxed">
            Join UAE PRO agencies already saving hours every day with AI-powered document
            processing. Free trial, no credit card required.
          </p>

          {/* Feature highlights */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3 text-white/80">
              <div className="h-9 w-9 rounded-full border border-white/20 flex items-center justify-center">
                <Zap className="h-4 w-4" />
              </div>
              <span className="text-[15px]">Set up in under 5 minutes</span>
            </div>
            <div className="flex items-center gap-3 text-white/80">
              <div className="h-9 w-9 rounded-full border border-white/20 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
              <span className="text-[15px]">14-day free trial with full features</span>
            </div>
            <div className="flex items-center gap-3 text-white/80">
              <div className="h-9 w-9 rounded-full border border-white/20 flex items-center justify-center">
                <Shield className="h-4 w-4" />
              </div>
              <span className="text-[15px]">Your data stays in the UAE region</span>
            </div>
          </div>
        </div>

        {/* Bottom quote */}
        <div className="relative mt-auto">
          <blockquote className="text-white/70 italic text-lg leading-relaxed">
            "IntelliFill cut our visa processing time by 70%. We went from 15 minutes per
            application to under 5."
          </blockquote>
          <p className="text-white/50 mt-3 text-sm">
            — Mohammed Al-Rashid, Al Futtaim PRO Services
          </p>
        </div>
      </div>

      {/* Registration Form - Right side */}
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
                  Create an account
                </h2>
                <AccentLine variant="active" size="sm" />
              </div>
              <p className="text-sm text-white/60">Enter your information to get started</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-error/10 border-error/30">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error.message}</AlertDescription>
                </Alert>
              )}

              {/* Name field */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-white/80">
                  Full Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  autoComplete="name"
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
                  disabled={isLoading}
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
                <Label htmlFor="password" className="text-sm font-medium text-white/80">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    autoComplete="new-password"
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
                    onClick={toggleShowPassword}
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-white/50" />
                    ) : (
                      <Eye className="h-4 w-4 text-white/50" />
                    )}
                  </SleekIconButton>
                </div>

                {formData.password && (
                  <div className="space-y-2 mt-2">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full ${
                            i < passwordStrength.score ? getPasswordStrengthColor() : 'bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <RequirementItem
                        met={passwordStrength.requirements.length}
                        text="8+ characters"
                      />
                      <RequirementItem
                        met={passwordStrength.requirements.uppercase}
                        text="Uppercase"
                      />
                      <RequirementItem
                        met={passwordStrength.requirements.lowercase}
                        text="Lowercase"
                      />
                      <RequirementItem met={passwordStrength.requirements.number} text="Number" />
                      <RequirementItem
                        met={passwordStrength.requirements.special}
                        text="Special char"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password field */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-white/80">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                  className={cn(
                    'w-full h-11 bg-surface-1/50 border-sleek-line-default',
                    'placeholder:text-white/30 text-white',
                    'focus:border-primary focus:ring-1 focus:ring-primary/30',
                    'transition-colors'
                  )}
                />
              </div>

              {/* Terms checkbox */}
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                  disabled={isLoading}
                  className="mt-0.5 border-sleek-line-default data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <label htmlFor="terms" className="text-sm text-white/60 cursor-pointer">
                  I agree to the{' '}
                  <Link
                    to="/terms"
                    className="text-primary hover:text-primary/80 transition-colors"
                  >
                    Terms and Conditions
                  </Link>{' '}
                  and{' '}
                  <Link
                    to="/privacy"
                    className="text-primary hover:text-primary/80 transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </label>
              </div>

              {/* Marketing checkbox */}
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="marketing"
                  checked={marketingConsent}
                  onCheckedChange={(checked) => setMarketingConsent(checked as boolean)}
                  disabled={isLoading}
                  className="mt-0.5 border-sleek-line-default data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <label
                  htmlFor="marketing"
                  className="text-sm text-white/60 cursor-pointer hover:text-white/80 transition-colors"
                >
                  I'd like to receive product updates and tips
                </label>
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                className="w-full h-11 text-[15px] font-medium mt-2"
                disabled={isLoading || !agreedToTerms || passwordStrength.score < 4}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create account
                  </>
                )}
              </Button>

              {/* Sign in link */}
              <p className="text-center text-sm text-white/50 pt-2">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Sign in
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
                <span className="text-xs text-white/60">5 min setup</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <div className="h-8 w-8 rounded-full border border-primary/30 bg-primary/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs text-white/60">14-day trial</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <div className="h-8 w-8 rounded-full border border-primary/30 bg-primary/10 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs text-white/60">UAE hosted</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
