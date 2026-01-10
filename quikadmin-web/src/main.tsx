import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';

// Initialize Sentry error reporting (production only)
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: `intellifill@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    // Performance monitoring sample rate
    tracesSampleRate: 0.1,
    // Session replay sample rate
    replaysSessionSampleRate: 0.1,
    // Sample rate for replays on errors
    replaysOnErrorSampleRate: 1.0,
  });
}

// Run one-time localStorage migration before app starts
import { migrateAuthStorage } from './utils/migrationUtils';
migrateAuthStorage();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
