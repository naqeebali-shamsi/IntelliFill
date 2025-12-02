/**
 * Phase 3 Library Tests - Document Actions Hook
 * Tests for CRUD operations and optimistic updates
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, cleanup, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from 'react-query'
import { useDocumentActions } from '@/hooks/useDocumentActions'
import * as api from '@/services/api'

// Mock API
vi.mock('@/services/api', () => ({
  deleteDocument: vi.fn(),
  downloadDocument: vi.fn(),
}))

describe('useDocumentActions Hook', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up after each test
    cleanup()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  describe('Delete Document', () => {
    it('deletes document successfully', async () => {
      vi.mocked(api.deleteDocument).mockResolvedValue(undefined)

      const { result } = renderHook(() => useDocumentActions(), { wrapper })

      await act(async () => {
        await result.current.deleteDocument('doc-123')
      })

      expect(api.deleteDocument).toHaveBeenCalledWith('doc-123')
    })

    it('handles delete error', async () => {
      vi.mocked(api.deleteDocument).mockRejectedValue(new Error('Delete failed'))

      const { result } = renderHook(() => useDocumentActions(), { wrapper })

      await expect(
        act(async () => {
          await result.current.deleteDocument('doc-123')
        })
      ).rejects.toThrow()
    })
  })

  describe('Download Document', () => {
    it('downloads document successfully', async () => {
      const blob = new Blob(['content'], { type: 'application/pdf' })
      vi.mocked(api.downloadDocument).mockResolvedValue(blob)

      // Render hook FIRST before setting up DOM mocks
      const { result } = renderHook(() => useDocumentActions(), { wrapper })

      // NOW set up DOM mocks after React has created its root
      const createObjectURLSpy = vi.spyOn(global.URL, 'createObjectURL').mockReturnValue('blob:url')
      const revokeObjectURLSpy = vi.spyOn(global.URL, 'revokeObjectURL').mockImplementation(() => {})

      const mockLink = {
        href: '',
        setAttribute: vi.fn(),
        click: vi.fn(),
        remove: vi.fn(),
      } as any

      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink)
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink)

      // Call the mutation and wait for it to complete
      await act(async () => {
        await result.current.downloadDocument({ id: 'doc-123', fileName: 'test.pdf' })
      })

      // Verify API was called
      expect(api.downloadDocument).toHaveBeenCalledWith('doc-123')
      expect(createObjectURLSpy).toHaveBeenCalledWith(blob)

      // Cleanup
      createObjectURLSpy.mockRestore()
      revokeObjectURLSpy.mockRestore()
      createElementSpy.mockRestore()
      appendChildSpy.mockRestore()
    })
  })

  describe('Bulk Delete', () => {
    it('deletes multiple documents', async () => {
      vi.mocked(api.deleteDocument).mockResolvedValue(undefined)

      const { result } = renderHook(() => useDocumentActions(), { wrapper })

      await act(async () => {
        await result.current.bulkDelete(['doc-1', 'doc-2', 'doc-3'])
      })

      // Verify all documents were deleted
      expect(api.deleteDocument).toHaveBeenCalledTimes(3)
      expect(api.deleteDocument).toHaveBeenCalledWith('doc-1')
      expect(api.deleteDocument).toHaveBeenCalledWith('doc-2')
      expect(api.deleteDocument).toHaveBeenCalledWith('doc-3')
    })

    it('handles partial failures in bulk delete', async () => {
      vi.mocked(api.deleteDocument)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useDocumentActions(), { wrapper })

      let bulkResult
      await act(async () => {
        bulkResult = await result.current.bulkDelete(['doc-1', 'doc-2', 'doc-3'])
      })

      expect(bulkResult.success).toBe(false)
      expect(bulkResult.successCount).toBe(2)
      expect(bulkResult.failedCount).toBe(1)
    })
  })

  describe('Bulk Download', () => {
    it('downloads multiple documents', async () => {
      const blob = new Blob(['content'], { type: 'application/pdf' })
      vi.mocked(api.downloadDocument).mockResolvedValue(blob)

      // Render hook FIRST before setting up any mocks
      const { result } = renderHook(() => useDocumentActions(), { wrapper })

      // NOW set up DOM mocks after React has created its root
      const createObjectURLSpy = vi.spyOn(global.URL, 'createObjectURL').mockReturnValue('blob:url')
      const revokeObjectURLSpy = vi.spyOn(global.URL, 'revokeObjectURL').mockImplementation(() => {})

      const mockLink = {
        href: '',
        setAttribute: vi.fn(),
        click: vi.fn(),
        remove: vi.fn(),
      } as any

      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink)
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink)

      // Mock setTimeout to avoid delays - but do it AFTER renderHook
      vi.useFakeTimers()

      let downloadPromise
      act(() => {
        downloadPromise = result.current.bulkDownload([
          { id: 'doc-1', fileName: 'file1.pdf' },
          { id: 'doc-2', fileName: 'file2.pdf' },
        ])
      })

      // Fast-forward all timers
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      // Wait for the download promise to resolve
      await act(async () => {
        await downloadPromise
      })

      // Verify API was called
      expect(api.downloadDocument).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
      createObjectURLSpy.mockRestore()
      revokeObjectURLSpy.mockRestore()
      createElementSpy.mockRestore()
      appendChildSpy.mockRestore()
    })
  })

  describe('Optimistic Updates', () => {
    it('invalidates queries after delete', async () => {
      vi.mocked(api.deleteDocument).mockResolvedValue(undefined)

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useDocumentActions(), { wrapper })

      await act(async () => {
        await result.current.deleteDocument('doc-123')
      })

      // Query invalidation happens in onSuccess callback synchronously
      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalled()
      }, { timeout: 1000 })

      invalidateQueriesSpy.mockRestore()
    })
  })
})
