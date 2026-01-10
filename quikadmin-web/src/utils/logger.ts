const isDev = import.meta.env.DEV;

/**
 * Development-only logger utility
 *
 * All logging methods are suppressed in production builds.
 * Use toast notifications or error tracking for user-facing errors.
 */
export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log('[LOG]', ...args);
    }
  },
  info: (...args: unknown[]) => {
    if (isDev) {
      console.log('[INFO]', ...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn('[WARN]', ...args);
    }
  },
  error: (...args: unknown[]) => {
    if (isDev) {
      console.error('[ERROR]', ...args);
    }
  },
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug('[DEBUG]', ...args);
    }
  },
};
