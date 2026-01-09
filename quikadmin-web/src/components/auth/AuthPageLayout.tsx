/**
 * AuthPageLayout Component
 *
 * Provides consistent layout for authentication pages (ForgotPassword, ResetPassword, VerifyEmail).
 * Uses the same gradient background and card styling.
 */

import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface AuthPageLayoutProps {
  children: React.ReactNode;
}

export function AuthPageLayout({ children }: AuthPageLayoutProps): React.ReactElement {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted dark:from-background dark:to-background p-4">
      <Card className="w-full max-w-md">{children}</Card>
    </div>
  );
}

interface AuthCardHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export function AuthCardHeader({
  title,
  description,
  icon,
  children,
}: AuthCardHeaderProps): React.ReactElement {
  return (
    <CardHeader className="space-y-1">
      {icon && <div className="flex justify-center mb-2">{icon}</div>}
      {children}
      {!children && (
        <>
          <CardTitle className="text-2xl font-bold text-center">{title}</CardTitle>
          {description && <CardDescription className="text-center">{description}</CardDescription>}
        </>
      )}
    </CardHeader>
  );
}

export { CardContent as AuthCardContent, CardFooter as AuthCardFooter };
