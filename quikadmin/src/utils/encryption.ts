import crypto from 'crypto';

// AES-256-GCM encryption for files and data
// Prefers dedicated ENCRYPTION_KEY (HKDF-derived) over JWT_SECRET fallback
//
// To generate a new ENCRYPTION_KEY:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// Set the output as ENCRYPTION_KEY in your .env file.
// When migrating from JWT_SECRET-based encryption, keep JWT_SECRET set
// and add ENCRYPTION_KEY. New encryptions will use the dedicated key.
// Existing data encrypted with JWT_SECRET will continue to decrypt correctly
// until a re-encryption migration is run.

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Get encryption key from environment
 * Prefers dedicated ENCRYPTION_KEY (base64-encoded 32 bytes) over JWT_SECRET derivation.
 * When ENCRYPTION_KEY is set, uses HKDF for proper key derivation.
 * Falls back to JWT_SECRET with SHA-256 for backwards compatibility.
 */
function getEncryptionKey(): Buffer {
  const dedicatedKey = process.env.ENCRYPTION_KEY;

  if (dedicatedKey) {
    // Dedicated key: use HKDF for proper derivation
    const keyMaterial = Buffer.from(dedicatedKey, 'base64');
    if (keyMaterial.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 bytes (base64-encoded)');
    }
    return Buffer.from(
      crypto.hkdfSync('sha256', keyMaterial, 'intellifill-v1', 'aes-256-gcm-encryption', KEY_LENGTH)
    );
  }

  // Fallback: derive from JWT_SECRET (legacy, for backwards compatibility)
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 64) {
    throw new Error(
      'JWT_SECRET must be at least 64 characters for secure encryption. Set ENCRYPTION_KEY for better security.'
    );
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt file buffer (for document storage)
 * Returns: Buffer with format [IV(16) + AuthTag(16) + EncryptedData]
 * @param aad - Optional Additional Authenticated Data to bind ciphertext to context (e.g. userId:documentId)
 */
export function encryptFile(fileBuffer: Buffer, aad?: string): Buffer {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  if (aad) {
    cipher.setAAD(Buffer.from(aad, 'utf8'));
  }

  const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);

  const authTag = cipher.getAuthTag();

  // Combine: IV + AuthTag + Encrypted data
  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypt file buffer
 * @param aad - Optional Additional Authenticated Data (must match the AAD used during encryption)
 */
export function decryptFile(encryptedBuffer: Buffer, aad?: string): Buffer {
  const key = getEncryptionKey();

  // Extract components
  const iv = encryptedBuffer.subarray(0, IV_LENGTH);
  const authTag = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = encryptedBuffer.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  if (aad) {
    decipher.setAAD(Buffer.from(aad, 'utf8'));
  }

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/**
 * Encrypt JSON data (for extractedData field in database)
 * Returns: Encrypted string in format "iv:authTag:encryptedData" (base64)
 * @param aad - Optional Additional Authenticated Data to bind ciphertext to context (e.g. userId:documentId)
 */
export function encryptJSON(data: any, aad?: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  if (aad) {
    cipher.setAAD(Buffer.from(aad, 'utf8'));
  }

  const jsonString = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(jsonString, 'utf8'), cipher.final()]);

  const authTag = cipher.getAuthTag();

  // Return as base64 string: iv:authTag:encrypted
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt JSON data
 * @param aad - Optional Additional Authenticated Data (must match the AAD used during encryption)
 */
export function decryptJSON(encryptedString: string, aad?: string): any {
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

  if (aad) {
    decipher.setAAD(Buffer.from(aad, 'utf8'));
  }

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');

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
