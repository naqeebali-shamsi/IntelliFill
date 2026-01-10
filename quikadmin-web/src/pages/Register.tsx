import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useToggle } from 'usehooks-ts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, UserPlus, AlertCircle, Zap, Shield, Clock } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { ErrorCode } from '@/constants/errorCodes';
import { Boxes } from '@/components/ui/background-boxes';
import { AccentLine, AnimatedLogo } from '@/components';
import { PasswordVisibilityToggle, PasswordStrengthIndicator } from '@/components/auth';
import { usePasswordValidation } from '@/hooks';
import { cn } from '@/lib/utils';
import { logger } from '@/utils/logger';

const INPUT_CLASS = cn(
  'w-full h-11 bg-surface-1/50 border-sleek-line-default',
  'placeholder:text-white/30 text-white',
  'focus:border-primary focus:ring-1 focus:ring-primary/30',
  'transition-colors'
);

const CHECKBOX_CLASS =
  'mt-0.5 border-sleek-line-default data-[state=checked]:bg-primary data-[state=checked]:border-primary';

export default function Register(): React.ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showPassword, toggleShowPassword] = useToggle(false);
  const [agreedToTerms, , setAgreedToTerms] = useToggle(false);
  const [marketingConsent, , setMarketingConsent] = useToggle(false);

  const { register, clearError } = useAuthStore();
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const { strength, checkStrength, isValid, strengthColor } = usePasswordValidation();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'password') {
      checkStrength(value);
    }

    if (error) {
      clearError();
    }
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    clearError();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!isValid) {
      toast.error('Password does not meet all requirements');
      return;
    }

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

      const authState = useAuthStore.getState();
      const redirectParam = searchParams.get('redirect');

      if (!authState.tokens) {
        toast.success('Registration successful! Please check your email for verification code.');
        const verifyUrl = `/verify-email?email=${encodeURIComponent(formData.email)}${redirectParam ? `&redirect=${encodeURIComponent(redirectParam)}` : ''}`;
        navigate(verifyUrl);
      } else {
        toast.success('Registration successful! Welcome aboard!');
        navigate(redirectParam || '/dashboard');
      }
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      logger.error('Registration error:', error);

      if (error.code === ErrorCode.EMAIL_EXISTS) {
        toast.error('An account with this email already exists');
      } else if (error.code === ErrorCode.RATE_LIMIT) {
        toast.error('Too many registration attempts. Please try again later.');
      } else {
        toast.error(error.message || 'Registration failed. Please try again.');
      }
    }
  }

  const canSubmit = agreedToTerms && isValid && !isLoading;

  return (
    <div className="h-screen flex bg-slate-900 overflow-hidden relative">
      {/* Animated background boxes - interactive layer */}
      <div className="absolute inset-0 overflow-hidden z-0">
        <Boxes />
      </div>

      {/* Hero Section - Left side (Desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 p-12 flex-col justify-between relative z-10 overflow-y-auto pointer-events-none [&_*]:pointer-events-auto">
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
            <FeatureHighlight icon={Zap} text="Set up in under 5 minutes" />
            <FeatureHighlight icon={Clock} text="14-day free trial with full features" />
            <FeatureHighlight icon={Shield} text="Your data stays in the UAE region" />
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

            <form onSubmit={handleSubmit} className="space-y-4" data-testid="register-form">
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
                  data-testid="register-first-name-input"
                  className={INPUT_CLASS}
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
                  data-testid="register-email-input"
                  className={INPUT_CLASS}
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
                    data-testid="register-password-input"
                    className={cn(INPUT_CLASS, 'pr-11')}
                  />
                  <PasswordVisibilityToggle
                    showPassword={showPassword}
                    onToggle={toggleShowPassword}
                    testId="register-toggle-password-visibility"
                    disabled={isLoading}
                  />
                </div>

                {formData.password && (
                  <PasswordStrengthIndicator
                    score={strength.score}
                    requirements={strength.requirements}
                    strengthColor={strengthColor}
                  />
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
                  data-testid="register-confirm-password-input"
                  className={INPUT_CLASS}
                />
              </div>

              {/* Terms checkbox */}
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                  disabled={isLoading}
                  data-testid="terms-checkbox"
                  className={CHECKBOX_CLASS}
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
                  data-testid="marketing-checkbox"
                  className={CHECKBOX_CLASS}
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
                disabled={!canSubmit}
                data-testid="register-submit-button"
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
                  data-testid="login-link"
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
              <MobileFeature icon={Zap} text="5 min setup" />
              <MobileFeature icon={Clock} text="14-day trial" />
              <MobileFeature icon={Shield} text="UAE hosted" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FeatureHighlightProps {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}

function FeatureHighlight({ icon: Icon, text }: FeatureHighlightProps): React.ReactElement {
  return (
    <div className="flex items-center gap-3 text-white/80">
      <div className="h-9 w-9 rounded-full border border-white/20 flex items-center justify-center">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-[15px]">{text}</span>
    </div>
  );
}

interface MobileFeatureProps {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}

function MobileFeature({ icon: Icon, text }: MobileFeatureProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="h-8 w-8 rounded-full border border-primary/30 bg-primary/10 flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <span className="text-xs text-white/60">{text}</span>
    </div>
  );
}
