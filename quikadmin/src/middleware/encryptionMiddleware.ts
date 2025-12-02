import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs/promises';
import { encryptFile, decryptFile, encryptJSON, decryptJSON } from '../utils/encryption';

// Re-export encryption functions for convenience
export { encryptFile, decryptFile, encryptJSON, decryptJSON };

/**
 * Middleware to encrypt uploaded files before saving to disk
 * Replaces file buffer with encrypted version
 */
export async function encryptUploadedFiles(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file && !req.files) {
      return next();
    }

    // Handle single file upload
    if (req.file) {
      const fileBuffer = await fs.readFile(req.file.path);
      const encryptedBuffer = encryptFile(fileBuffer);
      await fs.writeFile(req.file.path, encryptedBuffer);
    }

    // Handle multiple file uploads
    if (req.files) {
      if (Array.isArray(req.files)) {
        for (const file of req.files) {
          const fileBuffer = await fs.readFile(file.path);
          const encryptedBuffer = encryptFile(fileBuffer);
          await fs.writeFile(file.path, encryptedBuffer);
        }
      } else {
        // Handle { fieldname: [files] } format
        for (const fieldname of Object.keys(req.files)) {
          const files = (req.files as any)[fieldname];
          for (const file of files) {
            const fileBuffer = await fs.readFile(file.path);
            const encryptedBuffer = encryptFile(fileBuffer);
            await fs.writeFile(file.path, encryptedBuffer);
          }
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Helper to encrypt extractedData before saving to database
 */
export function encryptExtractedData(data: any): string {
  if (!data) return '';
  return encryptJSON(data);
}

/**
 * Helper to decrypt extractedData when retrieving from database
 */
export function decryptExtractedData(encryptedString: string): any {
  if (!encryptedString) return null;
  try {
    return decryptJSON(encryptedString);
  } catch (error) {
    console.error('Failed to decrypt extracted data:', error);
    return null;
  }
}
