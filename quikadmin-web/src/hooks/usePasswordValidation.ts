/**
 * Password validation hook
 * @module hooks/usePasswordValidation
 *
 * Provides password strength calculation and requirement validation.
 */

import { useState, useCallback, useMemo } from 'react';

export interface PasswordRequirements {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
}

export interface PasswordStrength {
  score: number;
  requirements: PasswordRequirements;
}

const INITIAL_REQUIREMENTS: PasswordRequirements = {
  length: false,
  uppercase: false,
  lowercase: false,
  number: false,
  special: false,
};

const INITIAL_STRENGTH: PasswordStrength = {
  score: 0,
  requirements: INITIAL_REQUIREMENTS,
};

/**
 * Calculates password requirements from a password string
 */
function calculateRequirements(password: string): PasswordRequirements {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[@$!%*?&]/.test(password),
  };
}

/**
 * Hook for password validation and strength calculation
 *
 * @returns Password strength state and validation utilities
 *
 * @example
 * ```tsx
 * const { strength, checkStrength, isValid, strengthColor } = usePasswordValidation();
 *
 * const handlePasswordChange = (password: string) => {
 *   checkStrength(password);
 * };
 * ```
 */
export function usePasswordValidation() {
  const [strength, setStrength] = useState<PasswordStrength>(INITIAL_STRENGTH);

  const checkStrength = useCallback((password: string): void => {
    const requirements = calculateRequirements(password);
    const score = Object.values(requirements).filter(Boolean).length;

    setStrength({ score, requirements });
  }, []);

  const isValid = strength.score >= 4;

  const strengthColor = useMemo((): string => {
    if (strength.score <= 2) return 'bg-error';
    if (strength.score <= 3) return 'bg-warning';
    return 'bg-success';
  }, [strength.score]);

  const reset = useCallback((): void => {
    setStrength(INITIAL_STRENGTH);
  }, []);

  return {
    strength,
    checkStrength,
    isValid,
    strengthColor,
    reset,
  };
}
