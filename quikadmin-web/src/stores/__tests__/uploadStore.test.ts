/**
 * Phase 2 Upload Tests - Upload Store
 * Tests for upload queue management, status updates, and error handling
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useUploadStore } from '@/stores/uploadStore'

describe('Upload Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useUploadStore.getState().clearAll()
  })

  describe('File Management', () => {
    it('adds files to queue', () => {
      const file1 = new File(['content'], 'file1.pdf', { type: 'application/pdf' })
      const file2 = new File(['content'], 'file2.pdf', { type: 'application/pdf' })
      
      useUploadStore.getState().addFiles([file1, file2])
      
      const files = useUploadStore.getState().files
      expect(files).toHaveLength(2)
      expect(files[0].file.name).toBe('file1.pdf')
      expect(files[1].file.name).toBe('file2.pdf')
    })

    it('removes file from queue', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      useUploadStore.getState().addFiles([file])
      
      const fileId = useUploadStore.getState().files[0].id
      useUploadStore.getState().removeFile(fileId)
      
      const files = useUploadStore.getState().files
      expect(files).toHaveLength(0)
    })

    it('clears all files', () => {
      const file1 = new File(['content'], 'file1.pdf', { type: 'application/pdf' })
      const file2 = new File(['content'], 'file2.pdf', { type: 'application/pdf' })
      
      useUploadStore.getState().addFiles([file1, file2])
      useUploadStore.getState().clearAll()
      
      const files = useUploadStore.getState().files
      expect(files).toHaveLength(0)
    })

    it('clears completed files', () => {
      const file1 = new File(['content'], 'file1.pdf', { type: 'application/pdf' })
      const file2 = new File(['content'], 'file2.pdf', { type: 'application/pdf' })
      
      useUploadStore.getState().addFiles([file1, file2])
      const file1Id = useUploadStore.getState().files[0].id
      const file2Id = useUploadStore.getState().files[1].id
      
      useUploadStore.getState().updateFileStatus(file1Id, 'completed')
      useUploadStore.getState().clearCompleted()
      
      const files = useUploadStore.getState().files
      expect(files).toHaveLength(1)
      expect(files[0].status).not.toBe('completed')
    })
  })

  describe('Status Updates', () => {
    it('updates file status', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      useUploadStore.getState().addFiles([file])
      
      const fileId = useUploadStore.getState().files[0].id
      useUploadStore.getState().updateFileStatus(fileId, 'uploading')
      
      const updatedFile = useUploadStore.getState().files[0]
      expect(updatedFile.status).toBe('uploading')
    })

    it('sets startedAt timestamp when status changes to uploading', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      useUploadStore.getState().addFiles([file])
      
      const fileId = useUploadStore.getState().files[0].id
      useUploadStore.getState().updateFileStatus(fileId, 'uploading')
      
      const updatedFile = useUploadStore.getState().files[0]
      expect(updatedFile.startedAt).toBeDefined()
    })

    it('sets completedAt timestamp when status changes to completed', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      useUploadStore.getState().addFiles([file])
      
      const fileId = useUploadStore.getState().files[0].id
      useUploadStore.getState().updateFileStatus(fileId, 'completed')
      
      const updatedFile = useUploadStore.getState().files[0]
      expect(updatedFile.completedAt).toBeDefined()
    })
  })

  describe('Progress Updates', () => {
    it('updates file progress', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      useUploadStore.getState().addFiles([file])
      
      const fileId = useUploadStore.getState().files[0].id
      useUploadStore.getState().updateFileProgress(fileId, 50)
      
      const updatedFile = useUploadStore.getState().files[0]
      expect(updatedFile.progress).toBe(50)
    })

    it('clamps progress to 0-100 range', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      useUploadStore.getState().addFiles([file])
      
      const fileId = useUploadStore.getState().files[0].id
      useUploadStore.getState().updateFileProgress(fileId, 150)
      
      const updatedFile = useUploadStore.getState().files[0]
      expect(updatedFile.progress).toBe(100)
    })
  })

  describe('Error Handling', () => {
    it('sets file error', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      useUploadStore.getState().addFiles([file])
      
      const fileId = useUploadStore.getState().files[0].id
      useUploadStore.getState().setFileError(fileId, 'Upload failed')
      
      const updatedFile = useUploadStore.getState().files[0]
      expect(updatedFile.error).toBe('Upload failed')
      expect(updatedFile.status).toBe('failed')
    })
  })

  describe('Statistics', () => {
    it('calculates statistics correctly', () => {
      const file1 = new File(['content'], 'file1.pdf', { type: 'application/pdf' })
      const file2 = new File(['content'], 'file2.pdf', { type: 'application/pdf' })
      
      useUploadStore.getState().addFiles([file1, file2])
      const file1Id = useUploadStore.getState().files[0].id
      const file2Id = useUploadStore.getState().files[1].id
      
      useUploadStore.getState().updateFileStatus(file1Id, 'completed')
      useUploadStore.getState().updateFileStatus(file2Id, 'processing')
      
      const stats = useUploadStore.getState().getStats()
      expect(stats.total).toBe(2)
      expect(stats.completed).toBe(1)
      expect(stats.processing).toBe(1)
    })

    it('calculates overall progress', () => {
      const file1 = new File(['x'.repeat(1000)], 'file1.pdf', { type: 'application/pdf' })
      const file2 = new File(['x'.repeat(1000)], 'file2.pdf', { type: 'application/pdf' })
      
      useUploadStore.getState().addFiles([file1, file2])
      const file1Id = useUploadStore.getState().files[0].id
      const file2Id = useUploadStore.getState().files[1].id
      
      useUploadStore.getState().updateFileProgress(file1Id, 100)
      useUploadStore.getState().updateFileProgress(file2Id, 50)
      
      const stats = useUploadStore.getState().getStats()
      expect(stats.overallProgress).toBe(75)
    })
  })

  describe('Retry Functionality', () => {
    it('resets file status for retry', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      useUploadStore.getState().addFiles([file])
      
      const fileId = useUploadStore.getState().files[0].id
      useUploadStore.getState().setFileError(fileId, 'Failed')
      useUploadStore.getState().retryUpload(fileId)
      
      const updatedFile = useUploadStore.getState().files[0]
      expect(updatedFile.status).toBe('pending')
      expect(updatedFile.error).toBeUndefined()
      expect(updatedFile.progress).toBe(0)
    })
  })

  describe('Cancellation', () => {
    it('cancels upload and aborts cancel token', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      useUploadStore.getState().addFiles([file])
      
      const fileId = useUploadStore.getState().files[0].id
      const cancelToken = new AbortController()
      useUploadStore.getState().setFileCancelToken(fileId, cancelToken)
      
      useUploadStore.getState().cancelUpload(fileId)
      
      const updatedFile = useUploadStore.getState().files[0]
      expect(updatedFile.status).toBe('cancelled')
      expect(cancelToken.signal.aborted).toBe(true)
    })
  })
})
