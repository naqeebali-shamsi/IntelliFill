import React, { useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { initializeStores } from '@/stores/index';
import { useIsMounted, useTimeout } from '@/hooks';
import { toast } from 'sonner';

// Lazy load page components for code splitting
// Auth pages - loaded immediately on respective routes
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const VerifyEmail = lazy(() => import('@/pages/VerifyEmail'));
const AuthCallback = lazy(() => import('@/pages/AuthCallback'));

// Dashboard and main pages - lazy loaded
const ConnectedDashboard = lazy(() => import('@/pages/ConnectedDashboard'));
const ConnectedUpload = lazy(() => import('@/pages/ConnectedUpload'));
const History = lazy(() => import('./pages/History'));
const Templates = lazy(() => import('./pages/Templates'));
const Settings = lazy(() => import('./pages/Settings'));
const JobDetails = lazy(() => import('./pages/JobDetails'));
const DocumentLibrary = lazy(() => import('./pages/DocumentLibrary'));

// Form fill pages - lazy loaded
const SimpleFillForm = lazy(() => import('./pages/SimpleFillForm'));
const FormFillDemo = lazy(() => import('./pages/FormFillDemo'));

// Profile pages - lazy loaded
const ProfileList = lazy(() => import('./pages/ProfileList'));
const ProfileDetail = lazy(() => import('./pages/ProfileDetail'));

// Loading spinner component for suspense fallback
function PageLoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    </div>
  );
}

// Layout wrapper for protected routes with authentication check
function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <Suspense fallback={<PageLoadingSpinner />}>
          <Outlet />
        </Suspense>
      </AppLayout>
    </ProtectedRoute>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

function App() {
  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useIsMounted();

  // Prevent duplicate initialization with ref flag
  const initRef = useRef(false);

  // 10-second timeout guard for initialization
  useTimeout(
    10000,
    () => {
      // Show error toast if initialization times out
      toast.error('Session initialization timed out. Please check your connection and try again.', {
        action: {
          label: 'Retry',
          onClick: () => window.location.reload(),
        },
      });
    },
    { enabled: false } // Will be manually controlled
  );

  // Memoized initialization function with race condition prevention
  const initialize = useCallback(async () => {
    // Check if already initializing or initialized
    if (initRef.current) {
      console.warn('[App] Duplicate initialization attempt blocked');
      return;
    }

    // Set flag to prevent concurrent calls
    initRef.current = true;

    try {
      // Only initialize if component is still mounted
      if (isMounted()) {
        await initializeStores();
      }
    } catch (error) {
      console.error('[App] Store initialization error:', error);
    } finally {
      // Reset flag after completion to allow future re-initialization if needed
      initRef.current = false;
    }
  }, [isMounted]);

  // Initialize all stores on app startup
  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <Router>
          <Suspense fallback={<PageLoadingSpinner />}>
            <Routes>
              {/* Public routes - no layout */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Protected routes - with layout */}
              <Route path="/" element={<ProtectedLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<ConnectedDashboard />} />
                <Route path="upload" element={<ConnectedUpload />} />
                <Route path="history" element={<History />} />
                <Route path="documents" element={<DocumentLibrary />} />
                <Route path="fill-form" element={<SimpleFillForm />} />
                <Route path="demo/autocomplete" element={<FormFillDemo />} />
                <Route path="profiles" element={<ProfileList />} />
                <Route path="profiles/:id" element={<ProfileDetail />} />
                <Route path="templates" element={<Templates />} />
                <Route path="settings" element={<Settings />} />
                <Route path="job/:jobId" element={<JobDetails />} />
              </Route>
            </Routes>
          </Suspense>
        </Router>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
