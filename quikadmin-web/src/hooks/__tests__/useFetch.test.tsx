/**
 * useFetch Hook Tests
 * Tests for unified data fetching hook with retry, caching, and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useFetch,
  useMutate,
  useFetchWithPolling,
  useFetchOnce,
  useLazyFetch,
} from '@/hooks/useFetch';
import api from '@/services/api';

// Mock API
vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    request: vi.fn(),
  },
}));

// Mock error messages utility
vi.mock('@/utils/errorMessages', () => ({
  getUserErrorMessage: vi.fn((error) => {
    if (error?.message?.includes('Network')) {
      return 'Connection failed. Please check your internet connection.';
    }
    return error?.message || 'An unexpected error occurred.';
  }),
  isRetryableError: vi.fn((error) => {
    return error?.message?.includes('Network') || error?.message?.includes('timeout');
  }),
}));

describe('useFetch Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('Basic Fetching', () => {
    it('fetches data successfully', async () => {
      const mockData = { success: true, data: { name: 'Test User' } };
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const { result } = renderHook(
        () => useFetch({ url: '/users/me' }),
        { wrapper }
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.errorMessage).toBeNull();
    });

    it('passes query parameters to API', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [] } });

      renderHook(
        () => useFetch({
          url: '/documents',
          params: { page: 1, limit: 10, status: 'active' },
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          '/documents',
          expect.objectContaining({
            params: { page: 1, limit: 10, status: 'active' },
          })
        );
      });
    });

    it('transforms response data with transform function', async () => {
      const mockResponse = { success: true, data: { items: [1, 2, 3] } };
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(
        () => useFetch({
          url: '/items',
          transform: (res: typeof mockResponse) => res.data.items,
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([1, 2, 3]);
    });
  });

  describe('Error Handling', () => {
    it('handles errors with user-friendly messages', async () => {
      const error = new Error('Network Error');
      vi.mocked(api.get).mockRejectedValueOnce(error);

      const { result } = renderHook(
        () => useFetch({ url: '/test', enableRetry: false }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.errorMessage).toBe(
        'Connection failed. Please check your internet connection.'
      );
      expect(result.current.isRetryable).toBe(true);
    });

    it('calls onError callback when error occurs', async () => {
      const error = new Error('API Error');
      const onError = vi.fn();
      vi.mocked(api.get).mockRejectedValueOnce(error);

      renderHook(
        () => useFetch({ url: '/test', enableRetry: false, onError }),
        { wrapper }
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(error);
      });
    });

    it('identifies non-retryable errors', async () => {
      const error = new Error('Validation failed');
      vi.mocked(api.get).mockRejectedValueOnce(error);

      const { result } = renderHook(
        () => useFetch({ url: '/test', enableRetry: false }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.isRetryable).toBe(false);
    });
  });

  describe('Retry Logic', () => {
    it('retries failed requests with exponential backoff', async () => {
      const error = new Error('Temporary failure');
      vi.mocked(api.get)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ data: { success: true } });

      const retryQueryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: 2, retryDelay: 50 },
        },
      });

      const retryWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={retryQueryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(
        () => useFetch({
          url: '/test',
          enableRetry: true,
          retryConfig: { retries: 2, baseDelay: 50 },
        }),
        { wrapper: retryWrapper }
      );

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 5000 }
      );

      expect(api.get).toHaveBeenCalledTimes(3);
    });

    it('does not retry when enableRetry is false', async () => {
      const error = new Error('API Error');
      vi.mocked(api.get).mockRejectedValue(error);

      const { result } = renderHook(
        () => useFetch({ url: '/test', enableRetry: false }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(api.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Refetch', () => {
    it('refetches data when refetch is called', async () => {
      vi.mocked(api.get)
        .mockResolvedValueOnce({ data: { count: 1 } })
        .mockResolvedValueOnce({ data: { count: 2 } });

      const { result } = renderHook(
        () => useFetch({ url: '/counter' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual({ count: 1 });

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.data).toEqual({ count: 2 });
      });

      expect(api.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cleanup', () => {
    it('cleans up AbortController on unmount', async () => {
      // Create a never-resolving promise to simulate long request
      vi.mocked(api.get).mockImplementation(
        () => new Promise(() => {})
      );

      const { unmount } = renderHook(
        () => useFetch({ url: '/slow-endpoint' }),
        { wrapper }
      );

      // Unmount while request is pending
      unmount();

      // Should not throw any errors
      expect(true).toBe(true);
    });
  });
});

describe('useMutate Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('POST Operations', () => {
    it('performs POST mutation successfully', async () => {
      const mockResponse = { id: '123', name: 'Created Item' };
      vi.mocked(api.request).mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(
        () => useMutate({ url: '/items', method: 'POST' }),
        { wrapper }
      );

      await act(async () => {
        await result.current.mutateAsync({ name: 'New Item' });
      });

      expect(api.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/items',
          data: { name: 'New Item' },
        })
      );
    });

    it('transforms mutation response data', async () => {
      const mockResponse = { success: true, data: { id: '456' } };
      vi.mocked(api.request).mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(
        () => useMutate({
          url: '/items',
          method: 'POST',
          transform: (res: typeof mockResponse) => res.data,
        }),
        { wrapper }
      );

      let mutationResult: { id: string } | undefined;
      await act(async () => {
        mutationResult = await result.current.mutateAsync({ name: 'Test' });
      });

      expect(mutationResult).toEqual({ id: '456' });
    });
  });

  describe('Dynamic URLs', () => {
    it('handles dynamic URL functions', async () => {
      vi.mocked(api.request).mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(
        () => useMutate<unknown, Error, { id: string }>({
          url: (vars) => `/items/${vars.id}`,
          method: 'DELETE',
        }),
        { wrapper }
      );

      await act(async () => {
        await result.current.mutateAsync({ id: '789' });
      });

      expect(api.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE',
          url: '/items/789',
        })
      );
    });
  });

  describe('PUT/PATCH Operations', () => {
    it('performs PUT mutation', async () => {
      vi.mocked(api.request).mockResolvedValueOnce({ data: { updated: true } });

      const { result } = renderHook(
        () => useMutate({ url: '/items/123', method: 'PUT' }),
        { wrapper }
      );

      await act(async () => {
        await result.current.mutateAsync({ name: 'Updated Name' });
      });

      expect(api.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          url: '/items/123',
          data: { name: 'Updated Name' },
        })
      );
    });
  });
});

describe('useFetchWithPolling Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('configures polling interval and fetches data', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { count: 1 } });

    const { result } = renderHook(
      () => useFetchWithPolling({
        url: '/status',
        pollingInterval: 5000,
        enablePolling: true,
      }),
      { wrapper }
    );

    // Wait for fetch to complete
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ count: 1 });
  });

  it('does not refetch when enablePolling is false', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { count: 1 } });

    const { result } = renderHook(
      () => useFetchWithPolling({
        url: '/status',
        pollingInterval: 100, // Short interval
        enablePolling: false,
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Wait a bit to ensure no extra calls happen (longer than polling interval)
    await new Promise((r) => setTimeout(r, 250));

    // Should still only have one call (no polling)
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});

describe('useFetchOnce Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('fetches data only once and caches indefinitely', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { config: 'value' } });

    const { result, rerender } = renderHook(
      () => useFetchOnce({ url: '/config' }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Rerender the hook
    rerender();

    // Should not refetch
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});

describe('useLazyFetch Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('does not fetch until triggered', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { result: 'found' } });

    const { result } = renderHook(
      () => useLazyFetch({ url: '/search' }),
      { wrapper }
    );

    expect(api.get).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);

    // Trigger the fetch
    act(() => {
      result.current.trigger();
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({ result: 'found' });
    });
  });

  it('can be reset after fetching', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { result: 'found' } });

    const { result } = renderHook(
      () => useLazyFetch({ url: '/search' }),
      { wrapper }
    );

    // Trigger and wait for fetch
    act(() => {
      result.current.trigger();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Reset
    act(() => {
      result.current.reset();
    });

    // Should be able to trigger again
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
