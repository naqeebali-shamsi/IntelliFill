/**
 * R2 Storage Service Unit Tests
 *
 * Comprehensive unit tests for the R2StorageService covering:
 * - File upload to R2/S3
 * - Presigned URL generation
 * - File deletion
 * - File listing with pagination
 * - File existence checks
 * - File metadata retrieval
 * - Error handling for network failures
 * - Buffer and content-type handling
 * - Configuration validation
 *
 * @module services/__tests__/r2Storage.service.test
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Mock environment variables before importing service
const mockEnv = {
  R2_ACCOUNT_ID: 'test-account-id',
  R2_ACCESS_KEY_ID: 'test-access-key',
  R2_SECRET_ACCESS_KEY: 'test-secret-key',
  R2_BUCKET_NAME: 'test-bucket',
};

// Store original env
const originalEnv = process.env;

// Set mock env before imports
process.env = { ...originalEnv, ...mockEnv };

// Mock S3Client
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
  };
});

// Mock the presigner
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

// Import service after mocks are configured
import { R2StorageService } from '../r2Storage.service';

describe('R2StorageService', () => {
  let service: R2StorageService;
  const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

  beforeEach(() => {
    // Reset all mocks before each test
    mockSend.mockReset();
    jest.clearAllMocks();

    // Create fresh service instance
    service = new R2StorageService();
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  // ==========================================================================
  // Configuration Tests
  // ==========================================================================

  describe('Configuration', () => {
    it('should load configuration from environment variables', () => {
      // Service should initialize without errors when env vars are set
      expect(() => new R2StorageService()).not.toThrow();
    });

    it('should throw error when R2_ACCOUNT_ID is missing', () => {
      const originalAccountId = process.env.R2_ACCOUNT_ID;
      delete process.env.R2_ACCOUNT_ID;

      expect(() => new R2StorageService()).toThrow(
        'Missing required R2 environment variables'
      );

      // Restore
      process.env.R2_ACCOUNT_ID = originalAccountId;
    });

    it('should throw error when R2_ACCESS_KEY_ID is missing', () => {
      const originalAccessKey = process.env.R2_ACCESS_KEY_ID;
      delete process.env.R2_ACCESS_KEY_ID;

      expect(() => new R2StorageService()).toThrow(
        'Missing required R2 environment variables'
      );

      // Restore
      process.env.R2_ACCESS_KEY_ID = originalAccessKey;
    });

    it('should throw error when R2_SECRET_ACCESS_KEY is missing', () => {
      const originalSecretKey = process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.R2_SECRET_ACCESS_KEY;

      expect(() => new R2StorageService()).toThrow(
        'Missing required R2 environment variables'
      );

      // Restore
      process.env.R2_SECRET_ACCESS_KEY = originalSecretKey;
    });

    it('should throw error when R2_BUCKET_NAME is missing', () => {
      const originalBucketName = process.env.R2_BUCKET_NAME;
      delete process.env.R2_BUCKET_NAME;

      expect(() => new R2StorageService()).toThrow(
        'Missing required R2 environment variables'
      );

      // Restore
      process.env.R2_BUCKET_NAME = originalBucketName;
    });
  });

  // ==========================================================================
  // Upload File Tests
  // ==========================================================================

  describe('uploadFile', () => {
    it('should successfully upload a file with Buffer', async () => {
      const mockETag = '"abc123def456"';
      mockSend.mockResolvedValue({
        ETag: mockETag,
      });

      const fileBuffer = Buffer.from('test file content');
      const result = await service.uploadFile(
        'documents/test.pdf',
        fileBuffer,
        'application/pdf'
      );

      expect(result).toEqual({
        key: 'documents/test.pdf',
        url: `https://${mockEnv.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${mockEnv.R2_BUCKET_NAME}/documents/test.pdf`,
        bucket: mockEnv.R2_BUCKET_NAME,
        etag: mockETag,
      });

      // Verify S3 command was called with correct parameters
      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toMatchObject({
        Bucket: mockEnv.R2_BUCKET_NAME,
        Key: 'documents/test.pdf',
        Body: fileBuffer,
        ContentType: 'application/pdf',
      });
    });

    it('should successfully upload a file with Uint8Array', async () => {
      mockSend.mockResolvedValue({ ETag: '"test-etag"' });

      const fileData = new Uint8Array([1, 2, 3, 4, 5]);
      const result = await service.uploadFile('data/binary.bin', fileData, 'application/octet-stream');

      expect(result.key).toBe('data/binary.bin');
      expect(result.etag).toBe('"test-etag"');
    });

    it('should successfully upload a file with string content', async () => {
      mockSend.mockResolvedValue({ ETag: '"string-etag"' });

      const textContent = 'Hello, World!';
      const result = await service.uploadFile('text/greeting.txt', textContent, 'text/plain');

      expect(result.key).toBe('text/greeting.txt');
      expect(result.bucket).toBe(mockEnv.R2_BUCKET_NAME);
    });

    it('should handle different content types correctly', async () => {
      mockSend.mockResolvedValue({ ETag: '"content-etag"' });

      const imageBuffer = Buffer.from('fake-image-data');
      await service.uploadFile('images/photo.jpg', imageBuffer, 'image/jpeg');

      const command = mockSend.mock.calls[0][0];
      expect(command.input.ContentType).toBe('image/jpeg');
    });

    it('should throw error when upload fails', async () => {
      mockSend.mockRejectedValue(new Error('Network timeout'));

      const fileBuffer = Buffer.from('test');

      await expect(
        service.uploadFile('documents/fail.pdf', fileBuffer, 'application/pdf')
      ).rejects.toThrow('Failed to upload file to R2: Network timeout');
    });

    it('should throw error for S3 service errors', async () => {
      mockSend.mockRejectedValue({
        name: 'AccessDenied',
        message: 'Access Denied',
        $metadata: { httpStatusCode: 403 },
      });

      await expect(
        service.uploadFile('forbidden/file.pdf', Buffer.from('test'), 'application/pdf')
      ).rejects.toThrow('Failed to upload file to R2');
    });
  });

  // ==========================================================================
  // Get Signed Download URL Tests
  // ==========================================================================

  describe('getSignedDownloadUrl', () => {
    it('should generate a presigned URL with default expiration', async () => {
      const mockUrl = 'https://test-bucket.r2.cloudflarestorage.com/documents/test.pdf?signature=abc123';
      mockGetSignedUrl.mockResolvedValue(mockUrl);

      const url = await service.getSignedDownloadUrl('documents/test.pdf');

      expect(url).toBe(mockUrl);
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(GetObjectCommand),
        { expiresIn: 3600 }
      );

      // Verify GetObjectCommand was created with correct parameters
      const commandArg = mockGetSignedUrl.mock.calls[0][1] as GetObjectCommand;
      expect(commandArg.input).toMatchObject({
        Bucket: mockEnv.R2_BUCKET_NAME,
        Key: 'documents/test.pdf',
      });
    });

    it('should generate a presigned URL with custom expiration', async () => {
      const mockUrl = 'https://test-bucket.r2.cloudflarestorage.com/files/data.json?signature=xyz789';
      mockGetSignedUrl.mockResolvedValue(mockUrl);

      const customExpiry = 7200; // 2 hours
      const url = await service.getSignedDownloadUrl('files/data.json', customExpiry);

      expect(url).toBe(mockUrl);
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(GetObjectCommand),
        { expiresIn: customExpiry }
      );
    });

    it('should throw error when presigned URL generation fails', async () => {
      mockGetSignedUrl.mockRejectedValue(new Error('Signing failed'));

      await expect(service.getSignedDownloadUrl('documents/test.pdf')).rejects.toThrow(
        'Failed to generate signed URL: Signing failed'
      );
    });

    it('should handle network errors during URL generation', async () => {
      mockGetSignedUrl.mockRejectedValue({ code: 'ECONNRESET', message: 'Connection reset' });

      await expect(service.getSignedDownloadUrl('path/file.txt')).rejects.toThrow(
        'Failed to generate signed URL'
      );
    });
  });

  // ==========================================================================
  // Delete File Tests
  // ==========================================================================

  describe('deleteFile', () => {
    it('should successfully delete a file', async () => {
      mockSend.mockResolvedValue({});

      const result = await service.deleteFile('documents/old-file.pdf');

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);

      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect(command.input).toMatchObject({
        Bucket: mockEnv.R2_BUCKET_NAME,
        Key: 'documents/old-file.pdf',
      });
    });

    it('should return true even if file does not exist (S3 behavior)', async () => {
      // S3 DeleteObject returns success even if object doesn't exist
      mockSend.mockResolvedValue({});

      const result = await service.deleteFile('non-existent/file.pdf');

      expect(result).toBe(true);
    });

    it('should throw error when delete operation fails', async () => {
      mockSend.mockRejectedValue(new Error('Permission denied'));

      await expect(service.deleteFile('protected/file.pdf')).rejects.toThrow(
        'Failed to delete file from R2: Permission denied'
      );
    });

    it('should handle network failures during deletion', async () => {
      mockSend.mockRejectedValue({
        code: 'ENOTFOUND',
        message: 'Network unreachable',
      });

      await expect(service.deleteFile('documents/test.pdf')).rejects.toThrow(
        'Failed to delete file from R2'
      );
    });
  });

  // ==========================================================================
  // List Files Tests
  // ==========================================================================

  describe('listFiles', () => {
    it('should list files without prefix', async () => {
      const mockResponse = {
        Contents: [
          {
            Key: 'file1.pdf',
            Size: 1024,
            LastModified: new Date('2024-01-01'),
            ETag: '"etag1"',
          },
          {
            Key: 'file2.pdf',
            Size: 2048,
            LastModified: new Date('2024-01-02'),
            ETag: '"etag2"',
          },
        ],
        IsTruncated: false,
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.listFiles();

      expect(result.files).toHaveLength(2);
      expect(result.files[0]).toEqual({
        key: 'file1.pdf',
        size: 1024,
        lastModified: new Date('2024-01-01'),
        etag: '"etag1"',
      });
      expect(result.isTruncated).toBe(false);
      expect(result.nextContinuationToken).toBeUndefined();
    });

    it('should list files with prefix filter', async () => {
      const mockResponse = {
        Contents: [
          {
            Key: 'documents/report.pdf',
            Size: 5000,
            LastModified: new Date('2024-01-03'),
            ETag: '"etag3"',
          },
        ],
        IsTruncated: false,
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.listFiles('documents/');

      expect(result.files).toHaveLength(1);
      expect(result.files[0].key).toBe('documents/report.pdf');

      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(ListObjectsV2Command);
      expect(command.input).toMatchObject({
        Bucket: mockEnv.R2_BUCKET_NAME,
        Prefix: 'documents/',
        MaxKeys: 1000,
      });
    });

    it('should handle pagination with continuation token', async () => {
      const mockResponse = {
        Contents: [
          {
            Key: 'page2-file.pdf',
            Size: 3000,
            LastModified: new Date('2024-01-04'),
            ETag: '"etag4"',
          },
        ],
        IsTruncated: true,
        NextContinuationToken: 'next-token-abc',
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.listFiles('', 100, 'previous-token');

      expect(result.isTruncated).toBe(true);
      expect(result.nextContinuationToken).toBe('next-token-abc');

      const command = mockSend.mock.calls[0][0];
      expect(command.input).toMatchObject({
        MaxKeys: 100,
        ContinuationToken: 'previous-token',
      });
    });

    it('should handle empty bucket', async () => {
      mockSend.mockResolvedValue({
        Contents: [],
        IsTruncated: false,
      });

      const result = await service.listFiles();

      expect(result.files).toHaveLength(0);
      expect(result.isTruncated).toBe(false);
    });

    it('should handle undefined Contents array', async () => {
      mockSend.mockResolvedValue({
        IsTruncated: false,
      });

      const result = await service.listFiles();

      expect(result.files).toHaveLength(0);
    });

    it('should throw error when listing fails', async () => {
      mockSend.mockRejectedValue(new Error('Access denied'));

      await expect(service.listFiles()).rejects.toThrow(
        'Failed to list files from R2: Access denied'
      );
    });
  });

  // ==========================================================================
  // File Exists Tests
  // ==========================================================================

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      mockSend.mockResolvedValue({
        Body: {} as any,
        ContentLength: 1024,
      });

      const exists = await service.fileExists('documents/existing.pdf');

      expect(exists).toBe(true);

      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input).toMatchObject({
        Bucket: mockEnv.R2_BUCKET_NAME,
        Key: 'documents/existing.pdf',
      });
    });

    it('should return false when file does not exist (NoSuchKey)', async () => {
      mockSend.mockRejectedValue({
        name: 'NoSuchKey',
        message: 'The specified key does not exist',
      });

      const exists = await service.fileExists('documents/missing.pdf');

      expect(exists).toBe(false);
    });

    it('should return false when file does not exist (404 status)', async () => {
      mockSend.mockRejectedValue({
        $metadata: { httpStatusCode: 404 },
        message: 'Not found',
      });

      const exists = await service.fileExists('nonexistent.txt');

      expect(exists).toBe(false);
    });

    it('should throw error for other failures (not 404)', async () => {
      const accessDeniedError = new Error('Access denied');
      (accessDeniedError as any).name = 'AccessDenied';
      (accessDeniedError as any).$metadata = { httpStatusCode: 403 };
      mockSend.mockRejectedValue(accessDeniedError);

      await expect(service.fileExists('protected/file.pdf')).rejects.toThrow(
        'Failed to check file existence: Access denied'
      );
    });

    it('should handle network errors', async () => {
      mockSend.mockRejectedValue({
        code: 'ETIMEDOUT',
        message: 'Connection timed out',
      });

      await expect(service.fileExists('documents/test.pdf')).rejects.toThrow(
        'Failed to check file existence'
      );
    });
  });

  // ==========================================================================
  // Get File Metadata Tests
  // ==========================================================================

  describe('getFileMetadata', () => {
    it('should retrieve file metadata', async () => {
      const mockMetadata = {
        ContentLength: 2048,
        ContentType: 'application/pdf',
        LastModified: new Date('2024-01-05'),
        ETag: '"metadata-etag"',
      };

      mockSend.mockResolvedValue(mockMetadata);

      const metadata = await service.getFileMetadata('documents/report.pdf');

      expect(metadata).toEqual({
        ContentLength: 2048,
        ContentType: 'application/pdf',
        LastModified: new Date('2024-01-05'),
        ETag: '"metadata-etag"',
      });
    });

    it('should handle partial metadata', async () => {
      mockSend.mockResolvedValue({
        ContentLength: 512,
        // Other fields undefined
      });

      const metadata = await service.getFileMetadata('partial/file.txt');

      expect(metadata.ContentLength).toBe(512);
      expect(metadata.ContentType).toBeUndefined();
      expect(metadata.LastModified).toBeUndefined();
      expect(metadata.ETag).toBeUndefined();
    });

    it('should throw error when metadata retrieval fails', async () => {
      const noSuchKeyError = new Error('File not found');
      (noSuchKeyError as any).name = 'NoSuchKey';
      mockSend.mockRejectedValue(noSuchKeyError);

      await expect(service.getFileMetadata('missing/file.pdf')).rejects.toThrow(
        'Failed to get file metadata: File not found'
      );
    });

    it('should handle network errors during metadata retrieval', async () => {
      mockSend.mockRejectedValue({
        code: 'ECONNRESET',
        message: 'Connection reset by peer',
      });

      await expect(service.getFileMetadata('documents/test.pdf')).rejects.toThrow(
        'Failed to get file metadata'
      );
    });
  });

  // ==========================================================================
  // Error Handling and Edge Cases
  // ==========================================================================

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty file keys', async () => {
      mockSend.mockResolvedValue({ ETag: '"empty-key"' });

      const result = await service.uploadFile('', Buffer.from('test'), 'text/plain');

      expect(result.key).toBe('');
    });

    it('should handle special characters in file keys', async () => {
      mockSend.mockResolvedValue({ ETag: '"special-chars"' });

      const specialKey = 'documents/file with spaces & special-chars_2024.pdf';
      const result = await service.uploadFile(specialKey, Buffer.from('test'), 'application/pdf');

      expect(result.key).toBe(specialKey);
    });

    it('should handle very large expiration times for presigned URLs', async () => {
      const mockUrl = 'https://example.com/file?sig=abc';
      mockGetSignedUrl.mockResolvedValue(mockUrl);

      const sevenDays = 7 * 24 * 60 * 60; // 604800 seconds
      await service.getSignedDownloadUrl('file.pdf', sevenDays);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(GetObjectCommand),
        { expiresIn: sevenDays }
      );
    });

    it('should handle deeply nested file paths', async () => {
      mockSend.mockResolvedValue({ ETag: '"nested"' });

      const deepPath = 'level1/level2/level3/level4/level5/file.pdf';
      const result = await service.uploadFile(deepPath, Buffer.from('test'), 'application/pdf');

      expect(result.key).toBe(deepPath);
    });
  });
});
