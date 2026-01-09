/**
 * PasswordRequirements Component
 *
 * Displays password validation errors as a list of requirements.
 */

import React from 'react';

interface PasswordRequirementsProps {
  errors: string[];
  testId?: string;
}

export function PasswordRequirements({
  errors,
  testId,
}: PasswordRequirementsProps): React.ReactElement | null {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1 text-xs" data-testid={testId}>
      <p className="text-muted-foreground font-medium">Password must contain:</p>
      <ul className="space-y-1">
        {errors.map((err, idx) => (
          <li key={idx} className="text-destructive flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-destructive" />
            {err}
          </li>
        ))}
      </ul>
    </div>
  );
}
