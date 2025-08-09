import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { ModernLayout } from '@/components/modern-layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { initializeStores } from '@/stores/index';
import ModernDashboard from '@/pages/ModernDashboard';
import ConnectedDashboard from '@/pages/ConnectedDashboard';
import ModernUpload from '@/pages/ModernUpload';
import ConnectedUpload from '@/pages/ConnectedUpload';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import History from './pages/History';
import Templates from './pages/Templates';
import Settings from './pages/Settings';
import JobDetails from './pages/JobDetails';

// Layout wrapper for protected routes with authentication check
function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <ModernLayout>
        <Outlet />
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
          <Routes>
            {/* Public routes - no layout */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Protected routes - with layout */}
            <Route path="/" element={<ProtectedLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<ConnectedDashboard />} />
              <Route path="upload" element={<ConnectedUpload />} />
              <Route path="history" element={<History />} />
              <Route path="templates" element={<Templates />} />
              <Route path="settings" element={<Settings />} />
              <Route path="job/:jobId" element={<JobDetails />} />
            </Route>
          </Routes>
        </Router>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;