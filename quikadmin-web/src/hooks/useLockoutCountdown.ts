/**
 * Lockout Countdown Hook
 * @module hooks/useLockoutCountdown
 *
 * Provides a countdown timer for account lockout display.
 * Formats remaining time as "M:SS" and auto-updates every second.
 */

import { useState, useEffect } from 'react';

interface UseLockoutCountdownOptions {
  isLocked: boolean;
  lockExpiry: number | null;
}

/**
 * Custom hook for managing lockout countdown display
 *
 * @param options - Lockout state options
 * @returns Formatted countdown string (e.g., "4:32") or null if not locked
 *
 * @example
 * ```tsx
 * const countdown = useLockoutCountdown({
 *   isLocked: effectiveLockout,
 *   lockExpiry: effectiveLockExpiry,
 * });
 *
 * return countdown ? <span>Try again in {countdown}</span> : null;
 * ```
 */
export function useLockoutCountdown({
  isLocked,
  lockExpiry,
}: UseLockoutCountdownOptions): string | null {
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    if (!isLocked || !lockExpiry) {
      setCountdown(null);
      return;
    }

    function updateCountdown(): void {
      const remaining = lockExpiry! - Date.now();
      if (remaining <= 0) {
        setCountdown(null);
        return;
      }
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [isLocked, lockExpiry]);

  return countdown;
}
