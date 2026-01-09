/**
 * SuccessState Component
 *
 * Displays a success state with icon, message, and optional action button.
 * Used for password reset success, email verification success, etc.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SuccessStateProps {
  title: string;
  message: string;
  submessage?: string;
  linkTo?: string;
  linkText?: string;
}

export function SuccessState({
  title,
  message,
  submessage,
  linkTo,
  linkText,
}: SuccessStateProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <div className="rounded-full bg-success-light p-3">
        <CheckCircle2 className="h-12 w-12 text-status-success" />
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        {submessage && <p className="text-sm text-muted-foreground">{submessage}</p>}
      </div>

      {linkTo && linkText && (
        <Link to={linkTo} className="w-full pt-4">
          <Button className="w-full">{linkText}</Button>
        </Link>
      )}
    </div>
  );
}
