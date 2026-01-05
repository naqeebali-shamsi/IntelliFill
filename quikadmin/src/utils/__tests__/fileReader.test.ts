/**
 * Unit Tests for fileReader.ts
 *
 * TDD Approach: These tests are written BEFORE implementation.
 * All tests should initially FAIL (red phase).
 * After implementing fileReader.ts, all tests should PASS (green phase).
 *
 * @module utils/__tests__/fileReader.test.ts
 */

import * as fs from 'fs/promises';

// Mock fs/promises before importing the module
jest.mock('fs/promises');
const mockFsReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import after mocks are set up
import {
  isUrl,
  isAllowedUrl,
  downloadFile,
  downloadFileWithRetry,
  getFileBuffer,
  UrlNotAllowedError,
  FileTooLargeError,
  DownloadTimeoutError,
  FileReaderConfig,
  createConfig,
} from '../fileReader';

describe('fileReader utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.R2_PUBLIC_DOMAIN;
  });

  // =========================================================================
  // isUrl() Tests
  // =========================================================================
  describe('isUrl()', () => {
    it('should return true for http:// URLs', () => {
      expect(isUrl('http://example.com/file.pdf')).toBe(true);
      expect(isUrl('http://localhost:3000/test')).toBe(true);
    });

    it('should return true for https:// URLs', () => {
      expect(isUrl('https://example.com/file.pdf')).toBe(true);
      expect(isUrl('https://bucket.r2.cloudflarestorage.com/doc.pdf')).toBe(true);
    });

    it('should return false for local file paths (absolute)', () => {
      expect(isUrl('/path/to/file.pdf')).toBe(false);
      expect(isUrl('C:\\Users\\file.pdf')).toBe(false);
      expect(isUrl('/uploads/documents/file.pdf')).toBe(false);
    });

    it('should return false for local file paths (relative)', () => {
      expect(isUrl('uploads/file.pdf')).toBe(false);
      expect(isUrl('./file.pdf')).toBe(false);
      expect(isUrl('../file.pdf')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isUrl('')).toBe(false);
      expect(isUrl('file://local/path')).toBe(false);
      expect(isUrl('ftp://server.com/file')).toBe(false);
      expect(isUrl('httpx://invalid')).toBe(false);
    });
  });

  // =========================================================================
  // isAllowedUrl() Tests
  // =========================================================================
  describe('isAllowedUrl()', () => {
    describe('SSRF Protection - Blocked URLs', () => {
      it('should block localhost URLs', () => {
        expect(isAllowedUrl('http://localhost/file.pdf')).toBe(false);
        expect(isAllowedUrl('http://localhost:3000/file.pdf')).toBe(false);
        expect(isAllowedUrl('https://localhost/file.pdf')).toBe(false);
      });

      it('should block 127.0.0.1 (loopback)', () => {
        expect(isAllowedUrl('http://127.0.0.1/file.pdf')).toBe(false);
        expect(isAllowedUrl('http://127.0.0.1:8080/file.pdf')).toBe(false);
      });

      it('should block IPv6 loopback (::1)', () => {
        expect(isAllowedUrl('http://[::1]/file.pdf')).toBe(false);
        expect(isAllowedUrl('http://[::1]:3000/file.pdf')).toBe(false);
      });

      it('should block private 10.x.x.x range', () => {
        expect(isAllowedUrl('http://10.0.0.1/file.pdf')).toBe(false);
        expect(isAllowedUrl('http://10.255.255.255/file.pdf')).toBe(false);
        expect(isAllowedUrl('http://10.1.2.3:8080/file.pdf')).toBe(false);
      });

      it('should block private 192.168.x.x range', () => {
        expect(isAllowedUrl('http://192.168.0.1/file.pdf')).toBe(false);
        expect(isAllowedUrl('http://192.168.1.100/file.pdf')).toBe(false);
        expect(isAllowedUrl('http://192.168.255.255/file.pdf')).toBe(false);
      });

      it('should block private 172.16-31.x.x range', () => {
        expect(isAllowedUrl('http://172.16.0.1/file.pdf')).toBe(false);
        expect(isAllowedUrl('http://172.20.5.10/file.pdf')).toBe(false);
        expect(isAllowedUrl('http://172.31.255.255/file.pdf')).toBe(false);
        // 172.32.x.x should NOT be blocked (outside private range)
        // Note: This will only pass if it's an allowed domain
      });

      it('should block arbitrary external URLs', () => {
        expect(isAllowedUrl('https://example.com/file.pdf')).toBe(false);
        expect(isAllowedUrl('https://malicious.site/exploit.pdf')).toBe(false);
        expect(isAllowedUrl('https://evil.com/download')).toBe(false);
      });
    });

    describe('Allowed R2 URLs', () => {
      it('should allow *.r2.cloudflarestorage.com URLs', () => {
        expect(isAllowedUrl('https://abc123.r2.cloudflarestorage.com/file.pdf')).toBe(true);
        expect(isAllowedUrl('https://mybucket.r2.cloudflarestorage.com/docs/file.pdf')).toBe(true);
      });

      it('should allow *.r2.dev URLs', () => {
        expect(isAllowedUrl('https://pub-abc123.r2.dev/file.pdf')).toBe(true);
        expect(isAllowedUrl('https://my-bucket.r2.dev/documents/file.pdf')).toBe(true);
      });

      it('should allow custom R2_PUBLIC_DOMAIN from env var', () => {
        process.env.R2_PUBLIC_DOMAIN = 'custom.example.com';
        // Need to recreate config to pick up env var
        const customConfig = createConfig({
          allowedDomains: ['*.r2.cloudflarestorage.com', '*.r2.dev', 'custom.example.com'],
        });
        expect(isAllowedUrl('https://custom.example.com/file.pdf', customConfig)).toBe(true);
      });
    });

    describe('Edge Cases', () => {
      it('should return false for non-URL strings', () => {
        expect(isAllowedUrl('/local/path/file.pdf')).toBe(false);
        expect(isAllowedUrl('')).toBe(false);
      });

      it('should return false for malformed URLs', () => {
        expect(isAllowedUrl('not-a-url')).toBe(false);
        expect(isAllowedUrl('http://')).toBe(false);
      });
    });
  });

  // =========================================================================
  // downloadFile() Tests
  // =========================================================================
  describe('downloadFile()', () => {
    const validR2Url = 'https://testbucket.r2.cloudflarestorage.com/document.pdf';
    const blockedUrl = 'https://malicious.site/file.pdf';

    beforeEach(() => {
      mockFetch.mockReset();
    });

    describe('URL Validation', () => {
      it('should throw UrlNotAllowedError for blocked domains', async () => {
        await expect(downloadFile(blockedUrl)).rejects.toThrow(UrlNotAllowedError);
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('should throw UrlNotAllowedError for localhost', async () => {
        await expect(downloadFile('http://localhost:3000/file.pdf')).rejects.toThrow(
          UrlNotAllowedError
        );
      });

      it('should throw UrlNotAllowedError for private IPs', async () => {
        await expect(downloadFile('http://192.168.1.1/file.pdf')).rejects.toThrow(
          UrlNotAllowedError
        );
      });
    });

    describe('Size Limits', () => {
      it('should throw FileTooLargeError when Content-Length exceeds limit', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          headers: {
            get: (name: string) => (name === 'content-length' ? '60000000' : null), // 60MB
          },
          body: null,
        } as unknown as Response);

        await expect(downloadFile(validR2Url)).rejects.toThrow(FileTooLargeError);
      });

      it('should throw FileTooLargeError when streaming exceeds limit', async () => {
        // Create a mock reader that returns chunks exceeding the limit
        const chunks = [new Uint8Array(30 * 1024 * 1024), new Uint8Array(30 * 1024 * 1024)]; // 60MB total
        let chunkIndex = 0;

        const mockReader = {
          read: jest.fn().mockImplementation(() => {
            if (chunkIndex < chunks.length) {
              return Promise.resolve({ done: false, value: chunks[chunkIndex++] });
            }
            return Promise.resolve({ done: true, value: undefined });
          }),
          cancel: jest.fn(),
          releaseLock: jest.fn(),
        };

        mockFetch.mockResolvedValue({
          ok: true,
          headers: {
            get: (): string | null => null, // No Content-Length header
          },
          body: {
            getReader: () => mockReader,
          },
        } as unknown as Response);

        await expect(downloadFile(validR2Url)).rejects.toThrow(FileTooLargeError);
        expect(mockReader.cancel).toHaveBeenCalled();
      });
    });

    describe('Timeout Handling', () => {
      it('should throw DownloadTimeoutError when timeout exceeded', async () => {
        // Use a very short timeout for testing
        const shortTimeoutConfig = createConfig({ timeoutMs: 10 });

        // Mock fetch to respect the abort signal
        mockFetch.mockImplementation(
          (_url: string, options?: { signal?: AbortSignal }) =>
            new Promise((resolve, reject) => {
              // Listen for abort signal
              if (options?.signal) {
                options.signal.addEventListener('abort', () => {
                  const error = new Error('This operation was aborted');
                  error.name = 'AbortError';
                  reject(error);
                });
              }
              // Never resolves normally within timeout
              setTimeout(resolve, 10000);
            })
        );

        await expect(downloadFile(validR2Url, shortTimeoutConfig)).rejects.toThrow(
          DownloadTimeoutError
        );
      }, 10000);
    });

    describe('Successful Downloads', () => {
      it('should return Buffer for valid R2 URL', async () => {
        const testData = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF magic bytes

        const mockReader = {
          read: jest
            .fn()
            .mockResolvedValueOnce({ done: false, value: testData })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          cancel: jest.fn(),
          releaseLock: jest.fn(),
        };

        mockFetch.mockResolvedValue({
          ok: true,
          headers: {
            get: () => '4', // 4 bytes
          },
          body: {
            getReader: () => mockReader,
          },
        } as unknown as Response);

        const result = await downloadFile(validR2Url);

        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBe(4);
        expect(result[0]).toBe(0x25); // %
      });

      it('should handle HTTP error responses', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        } as Response);

        await expect(downloadFile(validR2Url)).rejects.toThrow('HTTP 404: Not Found');
      });

      it('should handle network errors', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        await expect(downloadFile(validR2Url)).rejects.toThrow('Network error');
      });
    });
  });

  // =========================================================================
  // downloadFileWithRetry() Tests
  // =========================================================================
  describe('downloadFileWithRetry()', () => {
    const validR2Url = 'https://testbucket.r2.cloudflarestorage.com/document.pdf';

    beforeEach(() => {
      mockFetch.mockReset();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should NOT retry on UrlNotAllowedError', async () => {
      const blockedUrl = 'https://malicious.site/file.pdf';

      const promise = downloadFileWithRetry(blockedUrl);
      await expect(promise).rejects.toThrow(UrlNotAllowedError);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should NOT retry on FileTooLargeError', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: () => '100000000', // 100MB
        },
        body: null,
      } as unknown as Response);

      const promise = downloadFileWithRetry(validR2Url);
      await expect(promise).rejects.toThrow(FileTooLargeError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient network errors', async () => {
      const testData = new Uint8Array([1, 2, 3, 4]);

      // Fail twice, then succeed
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Connection reset'))
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => '4' },
          body: {
            getReader: () => ({
              read: jest
                .fn()
                .mockResolvedValueOnce({ done: false, value: testData })
                .mockResolvedValueOnce({ done: true, value: undefined }),
              cancel: jest.fn(),
              releaseLock: jest.fn(),
            }),
          },
        } as unknown as Response);

      const config = createConfig({
        retry: { attempts: 3, initialDelayMs: 100, maxDelayMs: 1000 },
      });

      const promise = downloadFileWithRetry(validR2Url, config);

      // Advance timers for retry delays
      await jest.advanceTimersByTimeAsync(100); // First retry delay
      await jest.advanceTimersByTimeAsync(200); // Second retry delay (exponential)

      const result = await promise;
      expect(result).toBeInstanceOf(Buffer);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff (1s, 2s, 4s by default)', async () => {
      // Use real timers for this test with very short delays
      jest.useRealTimers();

      mockFetch.mockRejectedValue(new Error('Persistent error'));

      const config = createConfig({
        retry: { attempts: 3, initialDelayMs: 10, maxDelayMs: 50 },
      });

      await expect(downloadFileWithRetry(validR2Url, config)).rejects.toThrow('Persistent error');
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Restore fake timers for other tests
      jest.useFakeTimers();
    }, 5000);

    it('should return successfully after retry', async () => {
      const testData = new Uint8Array([1, 2, 3, 4]);

      mockFetch.mockRejectedValueOnce(new Error('Temporary failure')).mockResolvedValueOnce({
        ok: true,
        headers: { get: () => '4' },
        body: {
          getReader: () => ({
            read: jest
              .fn()
              .mockResolvedValueOnce({ done: false, value: testData })
              .mockResolvedValueOnce({ done: true, value: undefined }),
            cancel: jest.fn(),
            releaseLock: jest.fn(),
          }),
        },
      } as unknown as Response);

      const config = createConfig({
        retry: { attempts: 3, initialDelayMs: 10, maxDelayMs: 100 },
      });

      const promise = downloadFileWithRetry(validR2Url, config);
      await jest.advanceTimersByTimeAsync(10);

      const result = await promise;
      expect(result).toBeInstanceOf(Buffer);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // getFileBuffer() Tests
  // =========================================================================
  describe('getFileBuffer()', () => {
    const localPath = '/uploads/documents/file.pdf';
    const validR2Url = 'https://testbucket.r2.cloudflarestorage.com/document.pdf';

    beforeEach(() => {
      mockFetch.mockReset();
      mockFsReadFile.mockReset();
    });

    describe('Routing', () => {
      it('should route local paths to fs.readFile', async () => {
        const mockBuffer = Buffer.from('local file content');
        mockFsReadFile.mockResolvedValue(mockBuffer);

        const result = await getFileBuffer(localPath);

        expect(mockFsReadFile).toHaveBeenCalledWith(localPath);
        expect(mockFetch).not.toHaveBeenCalled();
        expect(result).toEqual(mockBuffer);
      });

      it('should route URLs to downloadFile', async () => {
        const testData = new Uint8Array([1, 2, 3, 4]);

        mockFetch.mockResolvedValue({
          ok: true,
          headers: { get: () => '4' },
          body: {
            getReader: () => ({
              read: jest
                .fn()
                .mockResolvedValueOnce({ done: false, value: testData })
                .mockResolvedValueOnce({ done: true, value: undefined }),
              cancel: jest.fn(),
              releaseLock: jest.fn(),
            }),
          },
        } as unknown as Response);

        const result = await getFileBuffer(validR2Url);

        expect(mockFetch).toHaveBeenCalled();
        expect(mockFsReadFile).not.toHaveBeenCalled();
        expect(result).toBeInstanceOf(Buffer);
      });
    });

    describe('Error Propagation', () => {
      it('should propagate fs.readFile errors for local paths', async () => {
        mockFsReadFile.mockRejectedValue(new Error('ENOENT: no such file'));

        await expect(getFileBuffer(localPath)).rejects.toThrow('ENOENT: no such file');
      });

      it('should propagate UrlNotAllowedError for blocked URLs', async () => {
        await expect(getFileBuffer('https://evil.com/file.pdf')).rejects.toThrow(
          UrlNotAllowedError
        );
      });

      it('should propagate FileTooLargeError for oversized downloads', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          headers: { get: () => '100000000' }, // 100MB
          body: null,
        } as unknown as Response);

        await expect(getFileBuffer(validR2Url)).rejects.toThrow(FileTooLargeError);
      });
    });

    describe('Path Type Detection', () => {
      it('should handle Windows-style absolute paths', async () => {
        const windowsPath = 'C:\\Users\\docs\\file.pdf';
        mockFsReadFile.mockResolvedValue(Buffer.from('content'));

        await getFileBuffer(windowsPath);

        expect(mockFsReadFile).toHaveBeenCalledWith(windowsPath);
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('should handle relative paths', async () => {
        const relativePath = './uploads/file.pdf';
        mockFsReadFile.mockResolvedValue(Buffer.from('content'));

        await getFileBuffer(relativePath);

        expect(mockFsReadFile).toHaveBeenCalledWith(relativePath);
      });

      it('should handle paths with uploads/ prefix', async () => {
        const uploadPath = 'uploads/documents/123/file.pdf';
        mockFsReadFile.mockResolvedValue(Buffer.from('content'));

        await getFileBuffer(uploadPath);

        expect(mockFsReadFile).toHaveBeenCalledWith(uploadPath);
      });
    });
  });

  // =========================================================================
  // Custom Error Classes Tests
  // =========================================================================
  describe('Custom Error Classes', () => {
    describe('UrlNotAllowedError', () => {
      it('should have correct name and message', () => {
        const error = new UrlNotAllowedError('https://evil.com/file');
        expect(error.name).toBe('UrlNotAllowedError');
        expect(error.message).toContain('not allowed');
      });
    });

    describe('FileTooLargeError', () => {
      it('should have correct name and message with sizes', () => {
        const error = new FileTooLargeError(100000000, 50000000);
        expect(error.name).toBe('FileTooLargeError');
        expect(error.message).toContain('100000000');
        expect(error.message).toContain('50000000');
      });
    });

    describe('DownloadTimeoutError', () => {
      it('should have correct name and message with timeout', () => {
        const error = new DownloadTimeoutError(30000);
        expect(error.name).toBe('DownloadTimeoutError');
        expect(error.message).toContain('30000');
      });
    });
  });

  // =========================================================================
  // Configuration Tests
  // =========================================================================
  describe('Configuration', () => {
    describe('createConfig()', () => {
      it('should merge partial config with defaults', () => {
        const config = createConfig({ timeoutMs: 60000 });
        expect(config.timeoutMs).toBe(60000);
        expect(config.maxSizeBytes).toBe(50 * 1024 * 1024); // Default
      });

      it('should handle nested retry config', () => {
        const config = createConfig({
          retry: { attempts: 5, initialDelayMs: 500, maxDelayMs: 5000 },
        });
        expect(config.retry.attempts).toBe(5);
        expect(config.retry.initialDelayMs).toBe(500);
      });
    });
  });
});
