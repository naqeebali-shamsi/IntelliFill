import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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
import { Loader2, LogIn, Eye, EyeOff, AlertCircle, Zap, Shield, Clock } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { ErrorCode } from '@/constants/errorCodes';
import { Testimonial } from '@/components/ui/design-testimonial';
import { Boxes } from '@/components/ui/background-boxes';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
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
      const redirectTo = location.state?.from?.pathname || '/dashboard';
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
    <div className="min-h-screen flex bg-gradient-to-br from-background to-muted dark:from-background dark:to-background">
      {/* Hero Section - Left side */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 bg-slate-900 p-12 flex-col justify-between relative overflow-hidden">
        {/* Animated background boxes */}
        <div className="absolute inset-0 w-full h-full bg-slate-900 z-20 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] pointer-events-none" />
        <Boxes />

        {/* Content */}
        <div className="relative z-30">
          <div className="flex items-center gap-3 mb-6">
            <img src="/logo-light.svg" alt="IntelliFill" className="h-10 w-auto" />
            <h1 className="text-2xl font-bold text-white">IntelliFill</h1>
          </div>

          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
            Stop filling forms manually.
            <span className="block mt-2 text-white/90">Let AI do it.</span>
          </h2>

          <p className="text-xl text-white/80 max-w-lg mb-8">
            Intelligent document processing for UAE PRO agencies. Upload client documents, extract
            data automatically, and fill government forms in seconds.
          </p>

          {/* Feature highlights */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3 text-white/90">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                <Zap className="h-4 w-4" />
              </div>
              <span>93% OCR accuracy with AI-powered extraction</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
              <span>Process documents in under 2 seconds</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                <Shield className="h-4 w-4" />
              </div>
              <span>Bank-grade encryption for all client data</span>
            </div>
          </div>
        </div>

        {/* Animated Testimonial Carousel */}
        <div className="relative z-30 mt-auto">
          <Testimonial />
        </div>
      </div>

      {/* Login Form - Right side */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <img src="/logo-dark.svg" alt="IntelliFill" className="h-10 w-auto" />
            <h1 className="text-2xl font-bold">IntelliFill</h1>
          </div>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">Welcome back</CardTitle>
              <CardDescription className="text-center">
                Enter your credentials to access your account
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {wasExpired && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Your session has expired. Please log in again.
                    </AlertDescription>
                  </Alert>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {error.message}
                      {isLocked && lockExpiry && (
                        <div className="mt-2 text-sm">
                          Account locked until {new Date(lockExpiry).toLocaleTimeString()}
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {loginAttempts > 0 && loginAttempts < 5 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {5 - loginAttempts} login attempts remaining
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="companySlug">Company (Optional)</Label>
                  <Input
                    id="companySlug"
                    name="companySlug"
                    type="text"
                    placeholder="your-company-slug"
                    value={formData.companySlug}
                    onChange={handleChange}
                    disabled={isLoading}
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      to="/forgot-password"
                      className="text-sm text-primary hover:underline"
                      tabIndex={-1}
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
                      disabled={isLoading}
                      autoComplete="current-password"
                      className="w-full pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rememberMe"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onCheckedChange={(checked) => {
                      setFormData((prev) => ({ ...prev, rememberMe: checked as boolean }));
                    }}
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="rememberMe"
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    Remember me
                  </label>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-4">
                <Button type="submit" className="w-full" disabled={isLoading}>
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

                <p className="text-center text-sm text-muted-foreground">
                  Don't have an account?{' '}
                  <Link to="/register" className="font-medium text-primary hover:underline">
                    Sign up
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
                <span className="text-xs text-muted-foreground">93% Accuracy</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Clock className="h-5 w-5 text-primary" />
                <span className="text-xs text-muted-foreground">&lt;2s Process</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Shield className="h-5 w-5 text-primary" />
                <span className="text-xs text-muted-foreground">Secure</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
