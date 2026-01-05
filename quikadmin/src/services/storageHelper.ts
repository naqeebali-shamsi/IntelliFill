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
import { S3Client, PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';
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
      logger.error('R2 upload failed, falling back to local storage', {
        error: error instanceof Error ? error.message : 'Unknown error',
        localPath,
      });
      // Fall through to local storage
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
