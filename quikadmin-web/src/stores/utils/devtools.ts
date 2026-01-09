import { devtools } from 'zustand/middleware';

/**
 * Conditionally apply devtools middleware only in development mode.
 * This prevents devtools overhead in production builds.
 */
export function applyDevtools<T>(middleware: T, name: string): T {
  if (import.meta.env.DEV) {
    return devtools(middleware as unknown as Parameters<typeof devtools>[0], {
      name,
    }) as T;
  }
  return middleware;
}
