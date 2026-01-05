/**
 * Navigation Helper Tests (Task 295)
 *
 * Tests for the navigation utility module that enables
 * React Router navigation from outside React components.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setNavigator,
  clearNavigator,
  navigateTo,
  navigateToLogin,
  hasNavigator,
} from '../navigation';

describe('Navigation Helper (Task 295)', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    clearNavigator();

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/dashboard',
        href: '',
        replace: vi.fn(),
      },
      writable: true,
    });
  });

  describe('setNavigator', () => {
    it('should set the navigator function', () => {
      expect(hasNavigator()).toBe(false);

      setNavigator(mockNavigate);

      expect(hasNavigator()).toBe(true);
    });
  });

  describe('clearNavigator', () => {
    it('should clear the navigator function', () => {
      setNavigator(mockNavigate);
      expect(hasNavigator()).toBe(true);

      clearNavigator();

      expect(hasNavigator()).toBe(false);
    });
  });

  describe('navigateTo', () => {
    it('should use navigator when available', () => {
      setNavigator(mockNavigate);

      navigateTo('/test-path');

      expect(mockNavigate).toHaveBeenCalledWith('/test-path', undefined);
    });

    it('should pass options to navigator', () => {
      setNavigator(mockNavigate);

      navigateTo('/test-path', { state: { returnTo: '/dashboard' }, replace: true });

      expect(mockNavigate).toHaveBeenCalledWith('/test-path', {
        state: { returnTo: '/dashboard' },
        replace: true,
      });
    });

    it('should fallback to window.location when navigator not set', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      navigateTo('/fallback-path');

      expect(window.location.href).toBe('/fallback-path');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Navigation] Navigator not set, using window.location'
      );

      consoleSpy.mockRestore();
    });

    it('should use window.location.replace when replace option is true and navigator not set', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      navigateTo('/replace-path', { replace: true });

      expect(window.location.replace).toHaveBeenCalledWith('/replace-path');

      consoleSpy.mockRestore();
    });
  });

  describe('navigateToLogin', () => {
    it('should navigate to login with returnTo state', () => {
      setNavigator(mockNavigate);
      window.location.pathname = '/some-deep-path';

      navigateToLogin();

      expect(mockNavigate).toHaveBeenCalledWith('/login', {
        state: { returnTo: '/some-deep-path' },
        replace: true,
      });
    });

    it('should not set returnTo when already on login page', () => {
      setNavigator(mockNavigate);
      window.location.pathname = '/login';

      navigateToLogin();

      expect(mockNavigate).toHaveBeenCalledWith('/login', {
        state: undefined,
        replace: true,
      });
    });

    it('should not set returnTo when on register page', () => {
      setNavigator(mockNavigate);
      window.location.pathname = '/register';

      navigateToLogin();

      expect(mockNavigate).toHaveBeenCalledWith('/login', {
        state: undefined,
        replace: true,
      });
    });

    it('should accept explicit returnTo path', () => {
      setNavigator(mockNavigate);
      window.location.pathname = '/current-path';

      navigateToLogin('/explicit-return');

      expect(mockNavigate).toHaveBeenCalledWith('/login', {
        state: { returnTo: '/explicit-return' },
        replace: true,
      });
    });
  });

  describe('hasNavigator', () => {
    it('should return false initially', () => {
      expect(hasNavigator()).toBe(false);
    });

    it('should return true after setNavigator', () => {
      setNavigator(mockNavigate);
      expect(hasNavigator()).toBe(true);
    });

    it('should return false after clearNavigator', () => {
      setNavigator(mockNavigate);
      clearNavigator();
      expect(hasNavigator()).toBe(false);
    });
  });
});
