/**
 * Cloudflare R2 Storage Service
 *
 * Provides S3-compatible storage operations for Cloudflare R2.
 * Uses AWS SDK v3 for S3-compatible API operations.
 *
 * @module r2Storage.service
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommandInput,
  GetObjectCommandInput,
  DeleteObjectCommandInput,
  ListObjectsV2CommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Environment variables required for R2 storage
 */
interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

/**
 * Upload file result
 */
interface UploadResult {
  key: string;
  url: string;
  bucket: string;
  etag?: string;
}

/**
 * File metadata from list operation
 */
interface FileMetadata {
  key: string;
  size: number;
  lastModified: Date;
  etag?: string;
}

/**
 * List files result
 */
interface ListFilesResult {
  files: FileMetadata[];
  isTruncated: boolean;
  nextContinuationToken?: string;
}

/**
 * R2 Storage Service Class
 */
class R2StorageService {
  private client: S3Client;
  private config: R2Config;

  constructor() {
    // Load configuration from environment variables
    this.config = this.loadConfig();

    // Initialize S3 client with R2 endpoint
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
  }

  /**
   * Load R2 configuration from environment variables
   * @throws {Error} If required environment variables are missing
   */
  private loadConfig(): R2Config {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error(
        'Missing required R2 environment variables. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.'
      );
    }

    return {
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
    };
  }

  /**
   * Upload a file to R2 storage
   *
   * @param key - The object key (path) in the bucket
   * @param body - The file content (Buffer, Uint8Array, or string)
   * @param contentType - MIME type of the file
   * @returns Upload result with URL and metadata
   *
   * @example
   * ```typescript
   * const result = await uploadFile(
   *   'documents/report.pdf',
   *   fileBuffer,
   *   'application/pdf'
   * );
   * console.log('File uploaded:', result.url);
   * ```
   */
  async uploadFile(
    key: string,
    body: Buffer | Uint8Array | string,
    contentType: string
  ): Promise<UploadResult> {
    try {
      const params: PutObjectCommandInput = {
        Bucket: this.config.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      };

      const command = new PutObjectCommand(params);
      const response = await this.client.send(command);

      // Construct public URL (if bucket has public access configured)
      const url = `https://${this.config.accountId}.r2.cloudflarestorage.com/${this.config.bucketName}/${key}`;

      return {
        key,
        url,
        bucket: this.config.bucketName,
        etag: response.ETag,
      };
    } catch (error) {
      throw new Error(
        `Failed to upload file to R2: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a presigned download URL for a file
   *
   * @param key - The object key (path) in the bucket
   * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
   * @returns Presigned URL string
   *
   * @example
   * ```typescript
   * const url = await getSignedDownloadUrl('documents/report.pdf', 3600);
   * // URL is valid for 1 hour
   * ```
   */
  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const params: GetObjectCommandInput = {
        Bucket: this.config.bucketName,
        Key: key,
      };

      const command = new GetObjectCommand(params);
      const url = await getSignedUrl(this.client, command, { expiresIn });

      return url;
    } catch (error) {
      throw new Error(
        `Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a file from R2 storage
   *
   * @param key - The object key (path) in the bucket
   * @returns True if deletion was successful
   *
   * @example
   * ```typescript
   * await deleteFile('documents/old-report.pdf');
   * ```
   */
  async deleteFile(key: string): Promise<boolean> {
    try {
      const params: DeleteObjectCommandInput = {
        Bucket: this.config.bucketName,
        Key: key,
      };

      const command = new DeleteObjectCommand(params);
      await this.client.send(command);

      return true;
    } catch (error) {
      throw new Error(
        `Failed to delete file from R2: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * List files in R2 storage with optional prefix filter
   *
   * @param prefix - Optional prefix to filter files (e.g., 'documents/')
   * @param maxKeys - Maximum number of keys to return (default: 1000)
   * @param continuationToken - Token for pagination
   * @returns List of files with metadata
   *
   * @example
   * ```typescript
   * // List all PDF files in documents folder
   * const result = await listFiles('documents/', 100);
   * result.files.forEach(file => {
   *   console.log(`${file.key}: ${file.size} bytes`);
   * });
   *
   * // Paginate through results
   * if (result.isTruncated && result.nextContinuationToken) {
   *   const nextPage = await listFiles('documents/', 100, result.nextContinuationToken);
   * }
   * ```
   */
  async listFiles(
    prefix?: string,
    maxKeys: number = 1000,
    continuationToken?: string
  ): Promise<ListFilesResult> {
    try {
      const params: ListObjectsV2CommandInput = {
        Bucket: this.config.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys,
        ContinuationToken: continuationToken,
      };

      const command = new ListObjectsV2Command(params);
      const response = await this.client.send(command);

      const files: FileMetadata[] = (response.Contents || []).map((item) => ({
        key: item.Key || '',
        size: item.Size || 0,
        lastModified: item.LastModified || new Date(),
        etag: item.ETag,
      }));

      return {
        files,
        isTruncated: response.IsTruncated || false,
        nextContinuationToken: response.NextContinuationToken,
      };
    } catch (error) {
      throw new Error(
        `Failed to list files from R2: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if a file exists in R2 storage
   *
   * @param key - The object key (path) to check
   * @returns True if file exists, false otherwise
   *
   * @example
   * ```typescript
   * const exists = await fileExists('documents/report.pdf');
   * if (exists) {
   *   console.log('File found');
   * }
   * ```
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const params: GetObjectCommandInput = {
        Bucket: this.config.bucketName,
        Key: key,
      };

      const command = new GetObjectCommand(params);
      await this.client.send(command);

      return true;
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw new Error(
        `Failed to check file existence: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get file metadata without downloading the file
   *
   * @param key - The object key (path) in the bucket
   * @returns File metadata
   *
   * @example
   * ```typescript
   * const metadata = await getFileMetadata('documents/report.pdf');
   * console.log(`File size: ${metadata.ContentLength} bytes`);
   * console.log(`Content type: ${metadata.ContentType}`);
   * ```
   */
  async getFileMetadata(key: string): Promise<{
    ContentLength?: number;
    ContentType?: string;
    LastModified?: Date;
    ETag?: string;
  }> {
    try {
      const params: GetObjectCommandInput = {
        Bucket: this.config.bucketName,
        Key: key,
      };

      const command = new GetObjectCommand(params);
      const response = await this.client.send(command);

      return {
        ContentLength: response.ContentLength,
        ContentType: response.ContentType,
        LastModified: response.LastModified,
        ETag: response.ETag,
      };
    } catch (error) {
      throw new Error(
        `Failed to get file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Create singleton instance
const r2StorageService = new R2StorageService();

// Export service instance and class
export default r2StorageService;
export { R2StorageService };

// Export individual functions for convenience
export const uploadFile = (key: string, body: Buffer | Uint8Array | string, contentType: string) =>
  r2StorageService.uploadFile(key, body, contentType);

export const getSignedDownloadUrl = (key: string, expiresIn?: number) =>
  r2StorageService.getSignedDownloadUrl(key, expiresIn);

export const deleteFile = (key: string) => r2StorageService.deleteFile(key);

export const listFiles = (prefix?: string, maxKeys?: number, continuationToken?: string) =>
  r2StorageService.listFiles(prefix, maxKeys, continuationToken);

export const fileExists = (key: string) => r2StorageService.fileExists(key);

export const getFileMetadata = (key: string) => r2StorageService.getFileMetadata(key);

// Export types
export type { R2Config, UploadResult, FileMetadata, ListFilesResult };
