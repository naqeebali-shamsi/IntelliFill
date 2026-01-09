/**
 * AttemptsWarning Component
 *
 * Displays a color-coded warning about remaining login attempts.
 * Uses different variants based on urgency level.
 *
 * @example
 * ```tsx
 * <AttemptsWarning attemptsRemaining={2} />
 * ```
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Shield } from 'lucide-react';

export interface AttemptsWarningProps {
  /** Number of attempts remaining before lockout */
  attemptsRemaining: number;
  /** Optional data-testid for E2E testing */
  testId?: string;
}

function getWarningConfig(attemptsRemaining: number): {
  variant: 'destructive' | 'warning' | 'info';
  icon: typeof Shield | typeof AlertCircle;
  message: React.ReactNode;
} {
  if (attemptsRemaining === 1) {
    return {
      variant: 'destructive',
      icon: Shield,
      message: (
        <span className="font-medium">
          Last attempt! Your account will be locked after one more failed login.
        </span>
      ),
    };
  }

  if (attemptsRemaining === 2) {
    return {
      variant: 'warning',
      icon: AlertCircle,
      message: (
        <>
          <span className="font-medium">Warning:</span> Only {attemptsRemaining} login attempts
          remaining.
        </>
      ),
    };
  }

  return {
    variant: 'info',
    icon: AlertCircle,
    message: <>{attemptsRemaining} login attempts remaining before account lockout.</>,
  };
}

export function AttemptsWarning({
  attemptsRemaining,
  testId = 'attempts-warning',
}: AttemptsWarningProps): JSX.Element | null {
  // Only show warning when attempts are running low (< 5) and not yet locked (> 0)
  if (attemptsRemaining <= 0 || attemptsRemaining >= 5) {
    return null;
  }

  const { variant, icon: Icon, message } = getWarningConfig(attemptsRemaining);

  return (
    <Alert variant={variant} data-testid={testId}>
      <Icon className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export default AttemptsWarning;
