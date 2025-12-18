/**
 * DemoLoginButton - One-click demo access
 * Provides instant access to the demo account
 * @module components/features/demo-login-button
 */

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth';
import { Play, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface DemoLoginButtonProps extends Omit<ButtonProps, 'onClick'> {
  /**
   * Redirect path after successful demo login
   */
  redirectTo?: string;

  /**
   * Show loading state with text
   */
  loadingText?: string;

  /**
   * Show icon
   */
  showIcon?: boolean;

  /**
   * Callback after successful demo login
   */
  onSuccess?: () => void;

  /**
   * Callback on demo login error
   */
  onLoginError?: (error: Error) => void;
}

/**
 * DemoLoginButton component
 *
 * One-click button to log in with the demo account.
 * Useful on landing pages, login forms, and anywhere demo access is needed.
 *
 * @example
 * ```tsx
 * // On landing page hero
 * <DemoLoginButton size="lg">
 *   Try Demo
 * </DemoLoginButton>
 *
 * // On login form
 * <DemoLoginButton variant="outline" className="w-full">
 *   Continue with Demo Account
 * </DemoLoginButton>
 * ```
 */
export function DemoLoginButton({
  redirectTo = '/dashboard',
  loadingText = 'Starting demo...',
  showIcon = true,
  onSuccess,
  onLoginError,
  children,
  disabled,
  className,
  ...props
}: DemoLoginButtonProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(false);
  const demoLogin = useAuthStore((state) => state.demoLogin);

  const handleDemoLogin = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      await demoLogin();

      toast.success('Welcome to the demo!', {
        description: 'Feel free to explore all features.',
      });

      onSuccess?.();
      navigate(redirectTo);
    } catch (error: any) {
      console.error('Demo login failed:', error);

      const errorMessage = error?.message || 'Demo login failed. Please try again.';
      toast.error('Demo login failed', {
        description: errorMessage,
      });

      onLoginError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      onClick={handleDemoLogin}
      disabled={disabled || isLoading}
      className={cn(className)}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {loadingText}
        </>
      ) : (
        <>
          {showIcon && <Play className="h-4 w-4 mr-2" />}
          {children || 'Try Demo'}
        </>
      )}
    </Button>
  );
}

export default DemoLoginButton;
