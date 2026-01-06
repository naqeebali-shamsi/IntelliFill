import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToggle } from 'usehooks-ts';
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
import { DemoLoginButton } from '@/components/features/demo-login-button';
import { Separator } from '@/components/ui/separator';

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
    <div className="min-h-screen flex bg-gradient-to-br from-background to-muted dark:from-background dark:to-background">
      {/* Hero Section - Left side */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 bg-[var(--hero-bg)] p-12 flex-col justify-between relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <img src="/logo.svg" alt="IntelliFill" className="h-10 w-auto" />
            <h1 className="text-2xl font-bold text-white">IntelliFill</h1>
          </div>

          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
            Start automating
            <span className="block mt-2 text-white/90">your document workflow.</span>
          </h2>

          <p className="text-xl text-white/80 max-w-lg mb-8">
            Join UAE PRO agencies already saving hours every day with AI-powered document
            processing. Free trial, no credit card required.
          </p>

          {/* Feature highlights */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3 text-white/90">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                <Zap className="h-4 w-4" />
              </div>
              <span>Set up in under 5 minutes</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
              <span>14-day free trial with full features</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                <Shield className="h-4 w-4" />
              </div>
              <span>Your data stays in the UAE region</span>
            </div>
          </div>

          {/* Demo CTA */}
          <DemoLoginButton
            variant="secondary"
            size="lg"
            className="bg-white text-primary hover:bg-white/90"
          >
            Try Free Demo - No Signup Required
          </DemoLoginButton>
        </div>

        {/* Bottom quote */}
        <div className="relative z-10 mt-auto">
          <blockquote className="text-white/80 italic text-lg">
            "IntelliFill cut our visa processing time by 70%. We went from 15 minutes per
            application to under 5."
          </blockquote>
          <p className="text-white/60 mt-2">— Mohammed Al-Rashid, Al Futtaim PRO Services</p>
        </div>
      </div>

      {/* Registration Form - Right side */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <img src="/logo.svg" alt="IntelliFill" className="h-10 w-auto" />
            <h1 className="text-2xl font-bold">IntelliFill</h1>
          </div>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">Create an account</CardTitle>
              <CardDescription className="text-center">
                Enter your information to get started
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error.message}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
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
                    className="w-full"
                  />
                </div>

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
                  <Label htmlFor="password">Password</Label>
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
                      className="w-full pr-10"
                    />
                    <button
                      type="button"
                      onClick={toggleShowPassword}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {formData.password && (
                    <div className="space-y-2 mt-2">
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full ${
                              i < passwordStrength.score ? getPasswordStrengthColor() : 'bg-muted'
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

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
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
                    className="w-full"
                  />
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                    disabled={isLoading}
                    className="mt-0.5"
                  />
                  <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
                    I agree to the{' '}
                    <Link to="/terms" className="text-primary hover:underline">
                      Terms and Conditions
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy" className="text-primary hover:underline">
                      Privacy Policy
                    </Link>
                  </label>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="marketing"
                    checked={marketingConsent}
                    onCheckedChange={(checked) => setMarketingConsent(checked as boolean)}
                    disabled={isLoading}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor="marketing"
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    I'd like to receive product updates and tips
                  </label>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-4">
                <Button
                  type="submit"
                  className="w-full"
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

                {/* Demo Login - Always visible */}
                <div className="relative w-full">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or try demo</span>
                  </div>
                </div>

                <DemoLoginButton variant="outline" className="w-full" disabled={isLoading}>
                  Try Demo - No Account Needed
                </DemoLoginButton>

                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link to="/login" className="font-medium text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>

          {/* Mobile demo features */}
          <div className="lg:hidden mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <h3 className="font-semibold text-sm mb-3 text-center">Why IntelliFill?</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="flex flex-col items-center gap-1">
                <Zap className="h-5 w-5 text-primary" />
                <span className="text-xs text-muted-foreground">5 min setup</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Clock className="h-5 w-5 text-primary" />
                <span className="text-xs text-muted-foreground">14-day trial</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Shield className="h-5 w-5 text-primary" />
                <span className="text-xs text-muted-foreground">UAE hosted</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
