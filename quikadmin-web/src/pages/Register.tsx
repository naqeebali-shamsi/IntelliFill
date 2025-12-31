import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { Loader2, UserPlus, Eye, EyeOff, AlertCircle, Check, X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

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
    {met ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-gray-400" />}
    <span className={met ? 'text-green-600' : 'text-gray-500'}>{text}</span>
  </div>
);

export default function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

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
      if (err.code === 'EMAIL_EXISTS') {
        toast.error('An account with this email already exists');
      } else if (err.code === 'RATE_LIMIT') {
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
    if (passwordStrength.score <= 2) return 'bg-red-500';
    if (passwordStrength.score <= 3) return 'bg-yellow-500';
    if (passwordStrength.score <= 4) return 'bg-green-500';
    return 'bg-green-600';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4">
      <Card className="w-full max-w-md">
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
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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
                          i < passwordStrength.score
                            ? getPasswordStrengthColor()
                            : 'bg-gray-200 dark:bg-gray-700'
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

            <div className="flex items-center space-x-2">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                disabled={isLoading}
              />
              <label
                htmlFor="terms"
                className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer"
              >
                I agree to the{' '}
                <Link to="/terms" className="text-primary hover:underline">
                  Terms and Conditions
                </Link>
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="marketing"
                checked={marketingConsent}
                onCheckedChange={(checked) => setMarketingConsent(checked as boolean)}
                disabled={isLoading}
              />
              <label
                htmlFor="marketing"
                className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer"
              >
                I'd like to receive updates and marketing emails
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

            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
