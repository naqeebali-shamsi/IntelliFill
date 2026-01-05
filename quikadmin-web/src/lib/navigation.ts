/**
 * Navigation Helper Module (Task 295)
 *
 * Provides programmatic navigation for use outside React components.
 * This allows the API interceptor to redirect to /login using React Router
 * instead of window.location.href, preserving application state.
 *
 * Usage:
 * 1. In App.tsx: Call setNavigator(navigate) inside a component
 * 2. Anywhere else: Call navigateTo('/path') or navigateToLogin()
 */

import type { NavigateFunction } from 'react-router-dom';

// Store the navigate function reference
let navigateRef: NavigateFunction | null = null;

/**
 * Set the navigate function reference (call from App.tsx)
 * This must be called from within a React Router context
 */
export function setNavigator(navigate: NavigateFunction): void {
  navigateRef = navigate;
}

/**
 * Clear the navigator reference (for cleanup)
 */
export function clearNavigator(): void {
  navigateRef = null;
}

/**
 * Navigate to a path using React Router
 * Falls back to window.location if navigator not set
 *
 * @param path - The path to navigate to
 * @param options - Navigation options (state, replace)
 */
export function navigateTo(path: string, options?: { state?: unknown; replace?: boolean }): void {
  if (navigateRef) {
    navigateRef(path, options);
  } else {
    // Fallback for edge cases where navigator isn't set
    console.warn('[Navigation] Navigator not set, using window.location');
    if (options?.replace) {
      window.location.replace(path);
    } else {
      window.location.href = path;
    }
  }
}

/**
 * Navigate to login page with returnTo state
 * Captures the current path so user can be redirected back after login
 *
 * @param returnTo - Optional explicit return path (defaults to current pathname)
 */
export function navigateToLogin(returnTo?: string): void {
  const currentPath = returnTo || window.location.pathname;

  // Don't set returnTo if already on login page
  const shouldSetReturnTo = currentPath !== '/login' && currentPath !== '/register';

  navigateTo('/login', {
    state: shouldSetReturnTo ? { returnTo: currentPath } : undefined,
    replace: true,
  });
}

/**
 * Check if navigator is available
 */
export function hasNavigator(): boolean {
  return navigateRef !== null;
}
