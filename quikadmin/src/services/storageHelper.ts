/**
 * Storage Helper Service
 *
 * Provides a unified interface for file storage that supports:
 * - R2 cloud storage (production)
 * - Local filesystem storage (development)
 *
 * This helper safely checks if R2 is configured before attempting to use it,
 * falling back to local storage when R2 is not available.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { logger } from '../utils/logger';

/**
 * Check if R2 storage is configured (all required env vars present)
 */
export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

/**
 * Storage result interface
 */
export interface StorageResult {
  url: string;
  storageType: 'r2' | 'local';
  key?: string;
}

// Lazy-initialized R2 client
let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
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
 * Upload a file to R2 storage
 *
 * @param key - The object key (path) in the bucket
 * @param body - File content as Buffer
 * @param contentType - MIME type
 * @returns R2 URL
 */
async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  const client = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME!;

  const params: PutObjectCommandInput = {
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  };

  const command = new PutObjectCommand(params);
  await client.send(command);

  // Construct R2 URL
  const url = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucketName}/${key}`;

  logger.info('File uploaded to R2', { key, contentType, bucketName });
  return url;
}

/**
 * Upload a file from local path to storage (R2 if configured, otherwise keep local)
 *
 * @param localPath - Local filesystem path where multer saved the file
 * @param userId - User ID for organizing files
 * @param originalName - Original filename
 * @param contentType - MIME type of the file
 * @returns Storage result with URL and storage type
 */
export async function uploadFile(
  localPath: string,
  userId: string,
  originalName: string,
  contentType: string
): Promise<StorageResult> {
  // If R2 is configured, upload to R2
  if (isR2Configured()) {
    try {
      // Read file from local path
      const fileBuffer = await fs.readFile(localPath);

      // Generate unique key for R2
      const timestamp = Date.now();
      const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `documents/${userId}/${timestamp}-${sanitizedName}`;

      // Upload to R2
      const url = await uploadToR2(key, fileBuffer, contentType);

      // Delete local file after successful R2 upload
      try {
        await fs.unlink(localPath);
        logger.debug('Deleted local temp file after R2 upload', { localPath });
      } catch (deleteError) {
        logger.warn('Failed to delete local temp file', { localPath, error: deleteError });
      }

      return {
        url,
        storageType: 'r2',
        key,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('R2 upload failed', {
        error: errorMessage,
        localPath,
      });
      // Don't fall back to local storage in production - it won't work with validation
      // and Render's disk is ephemeral anyway
      throw new Error(
        `R2 upload failed: ${errorMessage}. Check R2 credentials and bucket permissions.`
      );
    }
  }

  // Use local storage (development mode or R2 failed)
  logger.info('Using local storage for file', { localPath, userId });

  return {
    url: localPath,
    storageType: 'local',
  };
}

/**
 * Check if a URL is a valid R2 storage URL
 */
export function isR2Url(url: string): boolean {
  return (
    url.startsWith('https://') &&
    (url.includes('.r2.cloudflarestorage.com/') || url.includes('.r2.dev/'))
  );
}

/**
 * Check if storage URL is local filesystem path
 */
export function isLocalPath(url: string): boolean {
  return !url.startsWith('http://') && !url.startsWith('https://');
}

/**
 * Fetch a file from storage (R2 or local filesystem)
 *
 * @param storageUrl - URL or path to the file
 * @returns File content as Buffer
 */
export async function fetchFromStorage(storageUrl: string): Promise<Buffer> {
  if (isR2Url(storageUrl)) {
    // Fetch from R2
    try {
      const client = getR2Client();
      const bucketName = process.env.R2_BUCKET_NAME!;

      // Extract key from URL
      // URL format: https://{accountId}.r2.cloudflarestorage.com/{bucket}/{key}
      const urlObj = new URL(storageUrl);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      // First part is bucket name, rest is the key
      const key = pathParts.slice(1).join('/');

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const response = await client.send(command);

      if (!response.Body) {
        throw new Error('Empty response body from R2');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      logger.debug('File fetched from R2', { key, size: buffer.length });
      return buffer;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to fetch from R2', { storageUrl, error: errorMessage });
      throw new Error(`Failed to fetch file from R2: ${errorMessage}`);
    }
  }

  // Local filesystem
  try {
    const filePath = isLocalPath(storageUrl) ? path.join(process.cwd(), storageUrl) : storageUrl;

    const buffer = await fs.readFile(filePath);
    logger.debug('File fetched from local storage', { filePath, size: buffer.length });
    return buffer;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to fetch from local storage', { storageUrl, error: errorMessage });
    throw new Error(`Failed to fetch file: ${errorMessage}`);
  }
}
