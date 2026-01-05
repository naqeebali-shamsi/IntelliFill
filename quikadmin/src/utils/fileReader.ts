/**
 * Secure File Reader Utility
 *
 * Provides unified file reading from both local filesystem and R2 URLs
 * with comprehensive security controls:
 * - SSRF protection via domain allowlist
 * - File size limits (memory protection)
 * - Download timeouts (slow loris protection)
 * - Retry logic with exponential backoff
 * - R2 SDK authentication for private buckets
 *
 * @module utils/fileReader
 */

import * as fs from 'fs/promises';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { logger } from './logger';

// ============================================================================
// R2 SDK Configuration
// ============================================================================

/**
 * Lazy-initialized R2 client for authenticated downloads
 */
let r2Client: S3Client | null = null;

/**
 * Check if R2 credentials are configured
 */
function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

/**
 * Get or create R2 client (lazy initialization)
 */
function getR2Client(): S3Client {
  if (!r2Client) {
    if (!isR2Configured()) {
      throw new Error('R2 credentials not configured');
    }
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return r2Client;
}

/**
 * Check if URL is an R2 storage URL
 */
export function isR2Url(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes('.r2.cloudflarestorage.com/') || url.includes('.r2.dev/');
}

/**
 * Extract bucket name and key from R2 URL
 *
 * URL format: https://{accountId}.r2.cloudflarestorage.com/{bucket}/{key}
 */
function parseR2Url(url: string): { bucket: string; key: string } | null {
  try {
    const parsedUrl = new URL(url);
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);

    if (pathParts.length < 2) {
      return null;
    }

    const bucket = pathParts[0];
    const key = pathParts.slice(1).join('/');

    return { bucket, key };
  } catch {
    return null;
  }
}

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Error thrown when URL is blocked by SSRF protection
 */
export class UrlNotAllowedError extends Error {
  constructor(url: string) {
    super(`URL not allowed (SSRF protection): ${url.substring(0, 100)}...`);
    this.name = 'UrlNotAllowedError';
  }
}

/**
 * Error thrown when file exceeds size limit
 */
export class FileTooLargeError extends Error {
  constructor(size: number, maxSize: number) {
    super(`File too large: ${size} bytes exceeds maximum ${maxSize} bytes`);
    this.name = 'FileTooLargeError';
  }
}

/**
 * Error thrown when download exceeds timeout
 */
export class DownloadTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Download timed out after ${timeoutMs}ms`);
    this.name = 'DownloadTimeoutError';
  }
}

// ============================================================================
// R2 SDK Download Function
// ============================================================================

/**
 * Download file from R2 using SDK (authenticated)
 *
 * This bypasses the need for presigned URLs by using the S3-compatible SDK
 * with configured credentials.
 *
 * @param url - R2 URL to download
 * @param config - Configuration for size limits
 * @returns File content as Buffer
 */
async function downloadFromR2(
  url: string,
  config: { maxSizeBytes: number; timeoutMs: number }
): Promise<Buffer> {
  const parsed = parseR2Url(url);
  if (!parsed) {
    throw new Error(`Invalid R2 URL format: ${url.substring(0, 100)}`);
  }

  const client = getR2Client();

  logger.debug('Downloading from R2 via SDK', {
    bucket: parsed.bucket,
    key: parsed.key.substring(0, 50),
  });

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const command = new GetObjectCommand({
      Bucket: parsed.bucket,
      Key: parsed.key,
    });

    const response = await client.send(command, {
      abortSignal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Check content length
    if (response.ContentLength && response.ContentLength > config.maxSizeBytes) {
      throw new FileTooLargeError(response.ContentLength, config.maxSizeBytes);
    }

    // Read body to buffer
    if (!response.Body) {
      throw new Error('R2 response has no body');
    }

    // Convert readable stream to buffer
    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    // Handle both Node.js stream and web stream
    const body = response.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of body) {
      totalSize += chunk.length;
      if (totalSize > config.maxSizeBytes) {
        throw new FileTooLargeError(totalSize, config.maxSizeBytes);
      }
      chunks.push(chunk);
    }

    logger.debug('R2 download completed', {
      bucket: parsed.bucket,
      key: parsed.key.substring(0, 50),
      size: totalSize,
    });

    return Buffer.concat(chunks);
  } catch (error) {
    clearTimeout(timeoutId);

    // Convert abort to timeout error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new DownloadTimeoutError(config.timeoutMs);
    }

    throw error;
  }
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration interface for file reader
 */
export interface FileReaderConfig {
  /** Allowed URL domains (SSRF protection) */
  allowedDomains: string[];
  /** Maximum file size in bytes (memory protection) */
  maxSizeBytes: number;
  /** Download timeout in milliseconds */
  timeoutMs: number;
  /** Retry configuration */
  retry: {
    attempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
  };
}

/**
 * Private IP ranges that should always be blocked (SSRF protection)
 */
const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'];

/**
 * Private IP regex patterns
 */
const PRIVATE_IP_PATTERNS = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // 10.x.x.x
  /^192\.168\.\d{1,3}\.\d{1,3}$/, // 192.168.x.x
  /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/, // 172.16-31.x.x
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // 127.x.x.x (loopback)
  /^169\.254\.\d{1,3}\.\d{1,3}$/, // 169.254.x.x (link-local)
];

/**
 * Default configuration
 */
const DEFAULT_CONFIG: FileReaderConfig = {
  allowedDomains: [
    '*.r2.cloudflarestorage.com',
    '*.r2.dev',
    ...(process.env.R2_PUBLIC_DOMAIN ? [process.env.R2_PUBLIC_DOMAIN] : []),
  ].filter(Boolean),
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
  timeoutMs: 30_000, // 30 seconds
  retry: {
    attempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10_000,
  },
};

// ============================================================================
// URL Validation Functions
// ============================================================================

/**
 * Check if a string is an HTTP/HTTPS URL
 *
 * @param pathOrUrl - String to check
 * @returns true if string is an HTTP/HTTPS URL
 */
export function isUrl(pathOrUrl: string): boolean {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') {
    return false;
  }
  return pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://');
}

/**
 * Check if hostname is a private/blocked IP
 *
 * @param hostname - Hostname to check
 * @returns true if hostname is private/blocked
 */
function isPrivateOrBlockedHost(hostname: string): boolean {
  // Check explicit blocked hosts
  const normalizedHost = hostname.toLowerCase();
  if (BLOCKED_HOSTS.includes(normalizedHost)) {
    return true;
  }

  // Check private IP patterns
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname));
}

/**
 * Check if hostname matches an allowed domain pattern
 *
 * Supports wildcard patterns like *.r2.cloudflarestorage.com
 *
 * @param hostname - Hostname to check
 * @param allowedDomains - List of allowed domain patterns
 * @returns true if hostname matches an allowed pattern
 */
function matchesAllowedDomain(hostname: string, allowedDomains: string[]): boolean {
  const normalizedHost = hostname.toLowerCase();

  return allowedDomains.some((pattern) => {
    if (pattern.startsWith('*.')) {
      // Wildcard pattern: *.example.com matches sub.example.com
      const suffix = pattern.slice(1).toLowerCase(); // Remove * but keep .
      return normalizedHost.endsWith(suffix);
    }
    // Exact match
    return normalizedHost === pattern.toLowerCase();
  });
}

/**
 * Validate URL against security allowlist (SSRF protection)
 *
 * @param url - URL to validate
 * @param config - Configuration (optional, uses defaults)
 * @returns true if URL is allowed
 */
export function isAllowedUrl(url: string, config: FileReaderConfig = DEFAULT_CONFIG): boolean {
  // Must be a valid URL
  if (!isUrl(url)) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;

    // Block private/internal hosts (SSRF protection)
    if (isPrivateOrBlockedHost(hostname)) {
      logger.warn('Blocked private/internal URL (SSRF protection)', {
        hostname,
      });
      return false;
    }

    // Check against allowlist
    if (!matchesAllowedDomain(hostname, config.allowedDomains)) {
      logger.debug('URL hostname not in allowed domains', {
        hostname,
        allowedDomains: config.allowedDomains,
      });
      return false;
    }

    return true;
  } catch {
    // Invalid URL
    return false;
  }
}

// ============================================================================
// Download Functions
// ============================================================================

/**
 * Download file from URL with security controls
 *
 * @param url - URL to download from
 * @param config - Configuration (optional, uses defaults)
 * @returns File content as Buffer
 * @throws {UrlNotAllowedError} If URL domain is not in allowlist
 * @throws {FileTooLargeError} If file exceeds size limit
 * @throws {DownloadTimeoutError} If download times out
 */
export async function downloadFile(
  url: string,
  config: FileReaderConfig = DEFAULT_CONFIG
): Promise<Buffer> {
  // SSRF Protection: Validate URL domain
  if (!isAllowedUrl(url, config)) {
    logger.warn('Download blocked - URL not allowed', {
      url: url.substring(0, 100),
    });
    throw new UrlNotAllowedError(url);
  }

  // R2 URLs require SDK authentication (private bucket)
  // Route to SDK download if R2 URL and credentials are configured
  if (isR2Url(url) && isR2Configured()) {
    logger.debug('Routing R2 URL to SDK download (private bucket)', {
      url: url.substring(0, 100),
    });
    return downloadFromR2(url, {
      maxSizeBytes: config.maxSizeBytes,
      timeoutMs: config.timeoutMs,
    });
  }

  // Setup timeout using AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    logger.debug('Starting file download', {
      url: url.substring(0, 100),
      timeout: config.timeoutMs,
      maxSize: config.maxSizeBytes,
    });

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'IntelliFill/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check Content-Length header if available
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > config.maxSizeBytes) {
        throw new FileTooLargeError(size, config.maxSizeBytes);
      }
    }

    // Stream response and check size during download
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalSize += value.length;

        // Check size limit during streaming (for responses without Content-Length)
        if (totalSize > config.maxSizeBytes) {
          await reader.cancel();
          throw new FileTooLargeError(totalSize, config.maxSizeBytes);
        }

        chunks.push(value);
      }
    } finally {
      // Ensure reader is released
      reader.releaseLock();
    }

    logger.debug('File download completed', {
      url: url.substring(0, 100),
      size: totalSize,
    });

    return Buffer.concat(chunks);
  } catch (error) {
    clearTimeout(timeoutId);

    // Convert AbortError to DownloadTimeoutError
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn('Download timed out', {
        url: url.substring(0, 100),
        timeout: config.timeoutMs,
      });
      throw new DownloadTimeoutError(config.timeoutMs);
    }

    throw error;
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Download file with retry logic
 *
 * Retries on transient errors (network issues) but NOT on:
 * - UrlNotAllowedError (security violation)
 * - FileTooLargeError (size limit exceeded)
 *
 * @param url - URL to download from
 * @param config - Configuration (optional, uses defaults)
 * @returns File content as Buffer
 */
export async function downloadFileWithRetry(
  url: string,
  config: FileReaderConfig = DEFAULT_CONFIG
): Promise<Buffer> {
  let lastError: Error | null = null;
  let delay = config.retry.initialDelayMs;

  for (let attempt = 1; attempt <= config.retry.attempts; attempt++) {
    try {
      return await downloadFile(url, config);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on validation/security errors
      if (error instanceof UrlNotAllowedError || error instanceof FileTooLargeError) {
        throw error;
      }

      // Log and retry on transient errors
      if (attempt < config.retry.attempts) {
        logger.warn(`Download attempt ${attempt} failed, retrying in ${delay}ms`, {
          url: url.substring(0, 100),
          error: lastError.message,
          attempt,
          maxAttempts: config.retry.attempts,
        });

        await sleep(delay);

        // Exponential backoff
        delay = Math.min(delay * 2, config.retry.maxDelayMs);
      }
    }
  }

  logger.error('Download failed after all retry attempts', {
    url: url.substring(0, 100),
    attempts: config.retry.attempts,
    error: lastError?.message,
  });

  throw lastError;
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Get file buffer from either a local path or R2 URL
 *
 * This is the primary API for reading files. It handles:
 * - Local filesystem paths (uses fs.readFile)
 * - R2 URLs (uses secure download with retry)
 *
 * @param pathOrUrl - Local file path or R2 URL
 * @param config - Configuration (optional, uses defaults)
 * @returns File content as Buffer
 *
 * @example
 * ```typescript
 * // Local file
 * const buffer = await getFileBuffer('/path/to/file.pdf');
 *
 * // R2 URL
 * const buffer = await getFileBuffer('https://bucket.r2.cloudflarestorage.com/file.pdf');
 * ```
 */
export async function getFileBuffer(
  pathOrUrl: string,
  config: FileReaderConfig = DEFAULT_CONFIG
): Promise<Buffer> {
  if (isUrl(pathOrUrl)) {
    logger.debug('Reading file from URL', {
      url: pathOrUrl.substring(0, 100),
    });
    return downloadFileWithRetry(pathOrUrl, config);
  }

  logger.debug('Reading file from local path', {
    path: pathOrUrl,
  });
  return fs.readFile(pathOrUrl);
}

// ============================================================================
// Configuration Helpers
// ============================================================================

/**
 * Create a custom configuration by merging with defaults
 *
 * @param overrides - Partial configuration to override defaults
 * @returns Complete configuration
 */
export function createConfig(overrides: Partial<FileReaderConfig>): FileReaderConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    retry: {
      ...DEFAULT_CONFIG.retry,
      ...overrides.retry,
    },
    allowedDomains: overrides.allowedDomains || DEFAULT_CONFIG.allowedDomains,
  };
}

/**
 * Get default configuration (for testing/debugging)
 */
export function getDefaultConfig(): FileReaderConfig {
  return { ...DEFAULT_CONFIG };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  isUrl,
  isAllowedUrl,
  downloadFile,
  downloadFileWithRetry,
  getFileBuffer,
  createConfig,
  getDefaultConfig,
  UrlNotAllowedError,
  FileTooLargeError,
  DownloadTimeoutError,
};
