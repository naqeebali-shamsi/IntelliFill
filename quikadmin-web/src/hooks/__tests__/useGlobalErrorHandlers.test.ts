/**
 * Tests for useGlobalErrorHandlers hook
 * Validates global error handling setup for unhandled promise rejections
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGlobalErrorHandlers } from '../useGlobalErrorHandlers';

describe('useGlobalErrorHandlers', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('should add unhandledrejection listener on mount', () => {
    renderHook(() => useGlobalErrorHandlers());

    expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
  });

  it('should remove listener on unmount', () => {
    const { unmount } = renderHook(() => useGlobalErrorHandlers());

    const handler = addEventListenerSpy.mock.calls[0][1];

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', handler);
  });

  it('should handle unhandled promise rejections', () => {
    renderHook(() => useGlobalErrorHandlers());

    // Get the handler that was registered
    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;

    // Create a promise and immediately catch to prevent actual unhandled rejection
    const testPromise = Promise.reject(new Error('Test rejection'));
    testPromise.catch(() => {}); // Prevent actual unhandled rejection

    // Simulate an unhandled rejection event
    const mockEvent = new PromiseRejectionEvent('unhandledrejection', {
      promise: testPromise,
      reason: new Error('Test rejection'),
    });

    handler(mockEvent);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Unhandled promise rejection:',
      expect.objectContaining({ message: 'Test rejection' })
    );
  });

  it('should handle string rejection reasons', () => {
    renderHook(() => useGlobalErrorHandlers());

    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;

    const testPromise = Promise.reject('String error');
    testPromise.catch(() => {}); // Prevent actual unhandled rejection

    const mockEvent = new PromiseRejectionEvent('unhandledrejection', {
      promise: testPromise,
      reason: 'String error',
    });

    handler(mockEvent);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Unhandled promise rejection:', 'String error');
  });
});
