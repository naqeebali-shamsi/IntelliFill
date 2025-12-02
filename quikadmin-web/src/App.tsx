import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { ModernLayout } from '@/components/modern-layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { initializeStores } from '@/stores/index';

// Lazy load page components for code splitting
// Auth pages - loaded immediately on respective routes
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));

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
      <ModernLayout>
        <Suspense fallback={<PageLoadingSpinner />}>
          <Outlet />
        </Suspense>
      </ModernLayout>
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
  // Initialize all stores on app startup
  useEffect(() => {
    initializeStores();
  }, []);

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
