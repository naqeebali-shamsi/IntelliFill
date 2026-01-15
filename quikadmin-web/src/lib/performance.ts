/**
 * Performance Logging Utility
 *
 * Simple dev-mode timing utility for measuring wizard performance.
 * Logs are only shown in development mode to avoid production noise.
 *
 * @module lib/performance
 */

/**
 * Start a performance timing measurement.
 * Returns a function that ends the timing and logs the duration.
 *
 * In production mode, returns a no-op function.
 *
 * @param label - Descriptive label for the timing measurement
 * @returns Function to call when the operation completes
 *
 * @example
 * ```typescript
 * const endTiming = startTiming('Document Detection');
 * await detectTypes(files);
 * endTiming(); // Logs: [Perf] Document Detection: 1234ms
 * ```
 */
export function startTiming(label: string): () => void {
  if (import.meta.env.PROD) return () => {};

  const start = performance.now();
  return () => {
    const duration = performance.now() - start;
    console.log(`[Perf] ${label}: ${duration.toFixed(0)}ms`);
  };
}

/**
 * Performance timer manager for tracking multiple related timings.
 * Useful for measuring multi-step wizard flows.
 */
export class PerformanceTimer {
  private timers: Map<string, number> = new Map();
  private readonly prefix: string;
  private readonly enabled: boolean;

  constructor(prefix: string = 'Wizard') {
    this.prefix = prefix;
    this.enabled = !import.meta.env.PROD;
  }

  /**
   * Start a named timer.
   */
  start(name: string): void {
    if (!this.enabled) return;
    this.timers.set(name, performance.now());
  }

  /**
   * End a named timer and log the duration.
   * @returns Duration in milliseconds, or -1 if timer wasn't started
   */
  end(name: string): number {
    if (!this.enabled) return -1;

    const start = this.timers.get(name);
    if (start === undefined) {
      console.warn(`[${this.prefix}] Timer "${name}" was never started`);
      return -1;
    }

    const duration = performance.now() - start;
    console.log(`[${this.prefix}] ${name}: ${duration.toFixed(0)}ms`);
    this.timers.delete(name);
    return duration;
  }

  /**
   * Clear all active timers.
   */
  clear(): void {
    this.timers.clear();
  }
}

/**
 * Shared wizard performance timer instance.
 * Use for measuring Smart Profile wizard flow performance.
 */
export const wizardTimer = new PerformanceTimer('SmartProfile');
