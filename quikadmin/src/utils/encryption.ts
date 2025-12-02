import crypto from 'crypto';

// MVP SOLUTION: Simple AES-256-GCM encryption for files and data
// Uses existing JWT_SECRET from environment (no new key management needed)

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Get encryption key from environment (derived from JWT_SECRET)
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 64) {
    throw new Error('JWT_SECRET must be at least 64 characters for secure encryption');
  }
  // Derive 32-byte key from JWT_SECRET using SHA-256
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt file buffer (for document storage)
 * Returns: Buffer with format [IV(16) + AuthTag(16) + EncryptedData]
 */
export function encryptFile(fileBuffer: Buffer): Buffer {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(fileBuffer),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  // Combine: IV + AuthTag + Encrypted data
  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypt file buffer
 */
export function decryptFile(encryptedBuffer: Buffer): Buffer {
  const key = getEncryptionKey();

  // Extract components
  const iv = encryptedBuffer.subarray(0, IV_LENGTH);
  const authTag = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = encryptedBuffer.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
}

/**
 * Encrypt JSON data (for extractedData field in database)
 * Returns: Encrypted string in format "iv:authTag:encryptedData" (base64)
 */
export function encryptJSON(data: any): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const jsonString = JSON.stringify(data);
  const encrypted = Buffer.concat([
    cipher.update(jsonString, 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  // Return as base64 string: iv:authTag:encrypted
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt JSON data
 */
export function decryptJSON(encryptedString: string): any {
  const key = getEncryptionKey();
  const parts = encryptedString.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const encrypted = Buffer.from(parts[2], 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]).toString('utf8');

  return JSON.parse(decrypted);
}

/**
 * Validate file path to prevent traversal attacks
 */
export function validateFilePath(filePath: string): void {
  if (filePath.includes('..')) {
    throw new Error('Path traversal detected');
  }

  if (filePath.includes('\0')) {
    throw new Error('Null byte in path detected');
  }

  // Ensure path doesn't escape uploads directory
  const normalizedPath = filePath.replace(/\\/g, '/');
  if (normalizedPath.startsWith('/') || normalizedPath.includes('://')) {
    throw new Error('Absolute paths not allowed');
  }
}
