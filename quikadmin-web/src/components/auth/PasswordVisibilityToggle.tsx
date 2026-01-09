/**
 * PasswordVisibilityToggle Component
 *
 * A reusable toggle button for showing/hiding password fields.
 * Provides consistent styling and behavior across auth pages.
 *
 * @example
 * ```tsx
 * <div className="relative">
 *   <Input type={showPassword ? 'text' : 'password'} />
 *   <PasswordVisibilityToggle
 *     showPassword={showPassword}
 *     onToggle={() => setShowPassword(!showPassword)}
 *     testId="login-toggle-password-visibility"
 *   />
 * </div>
 * ```
 */

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { SleekIconButton } from '@/components/ui/sleek-icon-button';
import { cn } from '@/lib/utils';

export interface PasswordVisibilityToggleProps {
  /** Whether the password is currently visible */
  showPassword: boolean;
  /** Callback when toggle is clicked */
  onToggle: () => void;
  /** Optional data-testid for E2E testing */
  testId?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Icon size variant */
  iconSize?: 'sm' | 'md' | 'lg';
}

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export const PasswordVisibilityToggle = React.forwardRef<
  HTMLButtonElement,
  PasswordVisibilityToggleProps
>(({ showPassword, onToggle, testId, className, disabled = false, iconSize = 'md' }, ref) => {
  return (
    <SleekIconButton
      ref={ref}
      variant="ghost"
      size="sm"
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      onClick={onToggle}
      disabled={disabled}
      data-testid={testId}
      className={cn('absolute right-1 top-1/2 -translate-y-1/2', className)}
    >
      {showPassword ? (
        <EyeOff className={cn(iconSizes[iconSize], 'text-white/50')} />
      ) : (
        <Eye className={cn(iconSizes[iconSize], 'text-white/50')} />
      )}
    </SleekIconButton>
  );
});

PasswordVisibilityToggle.displayName = 'PasswordVisibilityToggle';

export default PasswordVisibilityToggle;
