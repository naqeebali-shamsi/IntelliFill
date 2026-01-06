import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, type LoadingStage } from '@/stores/auth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// REQ-009: Stage-specific loading messages for better UX feedback
const loadingMessages: Record<LoadingStage, string> = {
  idle: 'Loading...',
  rehydrating: 'Restoring session...',
  validating: 'Validating with server...',
  ready: 'Loading dashboard...',
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();

  // Get auth store state and actions
  // Initialization is handled by App.tsx to prevent race conditions
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const isLoading = useAuthStore((state) => state.isLoading);
  const loadingStage = useAuthStore((state) => state.loadingStage);
  const checkSession = useAuthStore((state) => state.checkSession);

  // Show loading spinner while initializing with stage-specific message
  if (!isInitialized || isLoading) {
    const message = loadingMessages[loadingStage] || 'Loading...';
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  // Check session validity BEFORE reading isAuthenticated
  // This ensures expired tokens are cleared synchronously before render decision
  const isSessionValid = checkSession();

  // If session invalid or not authenticated, redirect to login with return URL
  if (!isSessionValid) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // User is authenticated, render the protected content
  return <>{children}</>;
}
