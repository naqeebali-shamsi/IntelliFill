/**
 * Global error handlers hook
 * Sets up window event listeners for unhandled promise rejections
 */

import { useEffect } from 'react';

/**
 * Hook to register global error handlers for the application
 *
 * @example
 * function App() {
 *   useGlobalErrorHandlers();
 *   return <div>App content</div>;
 * }
 */
export function useGlobalErrorHandlers() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      // TODO: Report to Sentry in production
      // if (import.meta.env.PROD) {
      //   Sentry.captureException(event.reason);
      // }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
}
