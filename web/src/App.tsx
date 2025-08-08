import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { ModernLayout } from '@/components/modern-layout';
import ModernDashboard from '@/pages/ModernDashboard';
import ModernUpload from '@/pages/ModernUpload';
import History from './pages/History';
import Templates from './pages/Templates';
import Settings from './pages/Settings';
import JobDetails from './pages/JobDetails';

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
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <Router>
          <ModernLayout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<ModernDashboard />} />
              <Route path="/upload" element={<ModernUpload />} />
              <Route path="/history" element={<History />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/job/:jobId" element={<JobDetails />} />
            </Routes>
          </ModernLayout>
        </Router>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;