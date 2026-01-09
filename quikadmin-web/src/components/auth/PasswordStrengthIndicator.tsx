/**
 * PasswordStrengthIndicator Component
 *
 * Displays password strength bar and requirement checklist.
 * Used in registration and password reset flows.
 */

import React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PasswordRequirements } from '@/hooks/usePasswordValidation';

interface RequirementItemProps {
  met: boolean;
  text: string;
  testId?: string;
}

function RequirementItem({ met, text, testId }: RequirementItemProps): React.ReactElement {
  const Icon = met ? Check : X;
  const iconClass = met ? 'text-status-success' : 'text-muted-foreground/60';
  const textClass = met ? 'text-success-foreground' : 'text-muted-foreground';

  return (
    <div className="flex items-center gap-1 text-xs" data-testid={testId}>
      <Icon className={cn('h-3 w-3', iconClass)} />
      <span className={textClass}>{text}</span>
    </div>
  );
}

const REQUIREMENT_LABELS: Array<{ key: keyof PasswordRequirements; label: string }> = [
  { key: 'length', label: '8+ characters' },
  { key: 'uppercase', label: 'Uppercase' },
  { key: 'lowercase', label: 'Lowercase' },
  { key: 'number', label: 'Number' },
  { key: 'special', label: 'Special char' },
];

export interface PasswordStrengthIndicatorProps {
  /** Current password strength score (0-5) */
  score: number;
  /** Password requirements status */
  requirements: PasswordRequirements;
  /** CSS class for strength bar color */
  strengthColor: string;
  /** Optional data-testid prefix for E2E testing */
  testIdPrefix?: string;
}

export function PasswordStrengthIndicator({
  score,
  requirements,
  strengthColor,
  testIdPrefix = 'password-requirement',
}: PasswordStrengthIndicatorProps): React.ReactElement {
  return (
    <div className="space-y-2 mt-2" data-testid="password-requirements">
      {/* Strength bar */}
      <div className="flex gap-1">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className={cn('h-1 flex-1 rounded-full', index < score ? strengthColor : 'bg-white/10')}
          />
        ))}
      </div>

      {/* Requirements checklist */}
      <div className="grid grid-cols-2 gap-1">
        {REQUIREMENT_LABELS.map(({ key, label }) => (
          <RequirementItem
            key={key}
            met={requirements[key]}
            text={label}
            testId={`${testIdPrefix}-${key}`}
          />
        ))}
      </div>
    </div>
  );
}

export default PasswordStrengthIndicator;
