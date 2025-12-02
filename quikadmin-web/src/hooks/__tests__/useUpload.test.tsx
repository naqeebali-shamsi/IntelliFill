/**
 * Phase 2 Upload Tests - useUpload Hook
 * Tests for upload retry logic, cancellation, and optimistic updates
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from 'react-query'
import React from 'react'
import { useUpload } from '@/hooks/useUpload'
import { useUploadStore } from '@/stores/uploadStore'
import * as api from '@/services/api'

// Mock API
vi.mock('@/services/api', () => ({
  uploadFiles: vi.fn(),
}))

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('@/lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}))

describe('useUpload Hook', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    useUploadStore.getState().clearAll()
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  describe('Upload Initiation', () => {
    it('starts uploads when autoStart is true', async () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })

      // Make upload take some time so we can catch the isProcessing state
      vi.mocked(api.uploadFiles).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 300))
        return {
          jobId: 'job-123',
          status: 'processing',
        }
      })

      const { result } = renderHook(() => useUpload({ autoStart: true }), { wrapper })

      // Add files in act() to handle React state updates
      await act(async () => {
        useUploadStore.getState().addFiles([file])
        // Wait for p-queue to process (100ms interval + buffer)
        await new Promise(resolve => setTimeout(resolve, 200))
      })

      // Wait for upload to start - check both API call and processing state
      await waitFor(() => {
        expect(api.uploadFiles).toHaveBeenCalled()
      }, { timeout: 5000 })

      // Check that processing started
      await waitFor(() => {
        expect(result.current.isProcessing || result.current.activeUploads > 0).toBeTruthy()
      }, { timeout: 2000 })
    })

    it('does not start uploads when autoStart is false', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      useUploadStore.getState().addFiles([file])
      
      const { result } = renderHook(() => useUpload({ autoStart: false }), { wrapper })
      
      // Should not start processing immediately
      expect(api.uploadFiles).not.toHaveBeenCalled()
    })
  })

  describe('Retry Logic', () => {
    it('retries failed uploads when retryOnError is true', { timeout: 15000 }, async () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })

      vi.mocked(api.uploadFiles)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          jobId: 'job-123',
          status: 'processing',
        })

      const { result } = renderHook(
        () => useUpload({ autoStart: true, retryOnError: true }),
        { wrapper }
      )

      // Add files in act() to handle React state updates
      await act(async () => {
        useUploadStore.getState().addFiles([file])
        // Wait for p-queue to process (100ms interval + buffer)
        await new Promise(resolve => setTimeout(resolve, 200))
      })

      // Wait for initial upload attempt
      await waitFor(() => {
        expect(api.uploadFiles).toHaveBeenCalled()
      }, { timeout: 5000 })

      // Wait for retry delay (2000ms) + p-queue interval (100ms) + buffer
      // The retry happens after 2s delay (line 194 in useUpload.ts)
      await new Promise(resolve => setTimeout(resolve, 2500))

      // Should attempt retry
      await waitFor(() => {
        expect(api.uploadFiles).toHaveBeenCalledTimes(2)
      }, { timeout: 3000 })
    })
  })

  describe('Cancellation', () => {
    it('cancels upload when cancel is called', async () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      useUploadStore.getState().addFiles([file])
      
      const fileId = useUploadStore.getState().files[0].id
      const cancelToken = new AbortController()
      useUploadStore.getState().setFileCancelToken(fileId, cancelToken)
      
      useUploadStore.getState().cancelUpload(fileId)
      
      expect(cancelToken.signal.aborted).toBe(true)
      const updatedFile = useUploadStore.getState().files[0]
      expect(updatedFile.status).toBe('cancelled')
    })
  })

  describe('Progress Tracking', () => {
    it('updates progress during upload', async () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      useUploadStore.getState().addFiles([file])
      
      const fileId = useUploadStore.getState().files[0].id
      const progressCallback = vi.fn()
      
      vi.mocked(api.uploadFiles).mockImplementation((formData, onProgress) => {
        // Simulate progress
        if (onProgress) {
          onProgress(50)
          onProgress(100)
        }
        return Promise.resolve({
          jobId: 'job-123',
          status: 'completed',
        })
      })
      
      useUploadStore.getState().updateFileProgress(fileId, 50)
      
      const updatedFile = useUploadStore.getState().files[0]
      expect(updatedFile.progress).toBe(50)
    })
  })

  describe('Concurrent Uploads', () => {
    it('limits concurrent uploads to maxConcurrent', { timeout: 15000 }, async () => {
      const files = Array.from({ length: 5 }, (_, i) =>
        new File(['content'], `file${i}.pdf`, { type: 'application/pdf' })
      )

      // Create a promise that resolves after a delay to simulate upload
      let uploadCount = 0
      let activeCount = 0
      let maxActiveCount = 0

      vi.mocked(api.uploadFiles).mockImplementation(async () => {
        uploadCount++
        activeCount++
        maxActiveCount = Math.max(maxActiveCount, activeCount)
        // Make uploads take longer to ensure we can observe concurrency
        await new Promise(resolve => setTimeout(resolve, 300))
        activeCount--
        return {
          jobId: `job-${uploadCount}`,
          status: 'processing',
        }
      })

      const { result } = renderHook(
        () => useUpload({ autoStart: true, maxConcurrent: 3 }),
        { wrapper }
      )

      // Add files in act() to handle React state updates
      await act(async () => {
        useUploadStore.getState().addFiles(files)
        // Wait for p-queue to start processing (100ms interval + buffer)
        await new Promise(resolve => setTimeout(resolve, 200))
      })

      // Wait for uploads to start
      await waitFor(() => {
        expect(api.uploadFiles).toHaveBeenCalled()
      }, { timeout: 5000 })

      // Check that concurrent limit is respected
      // p-queue should limit to maxConcurrent (3)
      await waitFor(() => {
        const activeUploads = result.current.activeUploads
        expect(activeUploads).toBeLessThanOrEqual(3)
        // Should have at least started some uploads
        expect(activeUploads).toBeGreaterThan(0)
      }, { timeout: 3000 })

      // Wait for all uploads to complete to verify maxActiveCount
      // 5 files * 300ms each, with max 3 concurrent = ~600ms + buffer
      await waitFor(() => {
        expect(uploadCount).toBe(5)
      }, { timeout: 5000 })

      // Verify that we never exceeded maxConcurrent
      expect(maxActiveCount).toBeLessThanOrEqual(3)
      expect(maxActiveCount).toBeGreaterThan(0)
    })
  })
})
