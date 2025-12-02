import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';

export interface MCPCredential {
  id: string;
  name: string;
  type: 'bearer' | 'basic' | 'oauth2' | 'apikey' | 'certificate';
  data: Record<string, any>;
  encrypted: boolean;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface OAuth2Token {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn?: number;
  scope?: string;
  obtainedAt: Date;
}

export interface TokenRefreshConfig {
  clientId: string;
  clientSecret: string;
  tokenEndpoint: string;
  scope?: string;
}

export class MCPAuthManager extends EventEmitter {
  private credentials: Map<string, MCPCredential> = new Map();
  private encryptionKey: Buffer;
  private logger: Logger;
  private tokenRefreshTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(encryptionKey?: string) {
    super();
    this.logger = createLogger('MCPAuthManager');
    
    // Use provided key or generate from environment
    this.encryptionKey = encryptionKey 
      ? Buffer.from(encryptionKey, 'hex')
      : this.generateEncryptionKey();
  }

  private generateEncryptionKey(): Buffer {
    const envKey = process.env.MCP_ENCRYPTION_KEY;
    if (envKey) {
      return Buffer.from(envKey, 'hex');
    }
    
    // Generate a new key if none exists
    const key = crypto.randomBytes(32);
    this.logger.warn('Generated new encryption key. Set MCP_ENCRYPTION_KEY environment variable for persistence.');
    return key;
  }

  async storeCredential(credential: MCPCredential): Promise<void> {
    this.logger.info(`Storing credential: ${credential.name}`, {
      type: credential.type,
      encrypted: credential.encrypted
    });

    // Encrypt sensitive data if not already encrypted
    if (!credential.encrypted) {
      credential.data = await this.encryptData(credential.data);
      credential.encrypted = true;
    }

    this.credentials.set(credential.id, credential);

    // Set up automatic refresh for OAuth2 tokens
    if (credential.type === 'oauth2' && credential.expiresAt) {
      this.scheduleTokenRefresh(credential);
    }

    this.emit('credential:stored', { id: credential.id, name: credential.name });
  }

  async getCredential(id: string): Promise<MCPCredential | null> {
    const credential = this.credentials.get(id);
    
    if (!credential) {
      this.logger.warn(`Credential not found: ${id}`);
      return null;
    }

    // Check expiration
    if (credential.expiresAt && new Date() > credential.expiresAt) {
      this.logger.warn(`Credential expired: ${id}`);
      
      if (credential.type === 'oauth2') {
        await this.refreshOAuth2Token(credential);
      } else {
        this.emit('credential:expired', { id: credential.id, name: credential.name });
        return null;
      }
    }

    // Return decrypted credential
    const decrypted = { ...credential };
    if (credential.encrypted) {
      decrypted.data = await this.decryptData(credential.data);
      decrypted.encrypted = false;
    }

    return decrypted;
  }

  private async encryptData(data: Record<string, any>): Promise<Record<string, any>> {
    const encrypted: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && this.isSensitiveField(key)) {
        encrypted[key] = await this.encrypt(value);
      } else {
        encrypted[key] = value;
      }
    }
    
    return encrypted;
  }

  private async decryptData(data: Record<string, any>): Promise<Record<string, any>> {
    const decrypted: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && this.isSensitiveField(key)) {
        try {
          decrypted[key] = await this.decrypt(value);
        } catch (error) {
          this.logger.error(`Failed to decrypt field: ${key}`, error);
          decrypted[key] = value; // Return encrypted value if decryption fails
        }
      } else {
        decrypted[key] = value;
      }
    }
    
    return decrypted;
  }

  private isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = [
      'password', 'secret', 'token', 'key', 'apikey', 
      'client_secret', 'private_key', 'access_token', 'refresh_token'
    ];
    
    return sensitiveFields.some(field => 
      fieldName.toLowerCase().includes(field)
    );
  }

  private async encrypt(text: string): Promise<string> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  private async decrypt(encryptedData: string): Promise<string> {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private scheduleTokenRefresh(credential: MCPCredential): void {
    if (!credential.expiresAt) return;
    
    // Cancel existing timer if any
    const existingTimer = this.tokenRefreshTimers.get(credential.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Schedule refresh 5 minutes before expiration
    const refreshTime = credential.expiresAt.getTime() - Date.now() - (5 * 60 * 1000);
    
    if (refreshTime > 0) {
      const timer = setTimeout(() => {
        this.refreshOAuth2Token(credential);
      }, refreshTime);
      
      this.tokenRefreshTimers.set(credential.id, timer);
      
      this.logger.info(`Scheduled token refresh for ${credential.name}`, {
        refreshIn: Math.round(refreshTime / 1000) + ' seconds'
      });
    }
  }

  private async refreshOAuth2Token(credential: MCPCredential): Promise<void> {
    this.logger.info(`Refreshing OAuth2 token for ${credential.name}`);
    
    try {
      const decryptedData = await this.decryptData(credential.data);
      
      if (!decryptedData.refresh_token || !decryptedData.token_endpoint) {
        throw new Error('Missing refresh token or token endpoint');
      }
      
      // Implement actual OAuth2 refresh logic here
      // This is a placeholder implementation
      const newToken: OAuth2Token = {
        accessToken: 'new_access_token',
        refreshToken: decryptedData.refresh_token,
        tokenType: 'Bearer',
        expiresIn: 3600,
        obtainedAt: new Date()
      };
      
      // Update credential with new token
      credential.data = await this.encryptData({
        ...decryptedData,
        access_token: newToken.accessToken,
        refresh_token: newToken.refreshToken
      });
      
      credential.expiresAt = new Date(
        newToken.obtainedAt.getTime() + (newToken.expiresIn || 3600) * 1000
      );
      
      this.credentials.set(credential.id, credential);
      
      // Reschedule next refresh
      this.scheduleTokenRefresh(credential);
      
      this.emit('token:refreshed', { 
        id: credential.id, 
        name: credential.name,
        expiresAt: credential.expiresAt
      });
      
      this.logger.info(`OAuth2 token refreshed successfully for ${credential.name}`);
    } catch (error) {
      this.logger.error(`Failed to refresh OAuth2 token for ${credential.name}`, error);
      this.emit('token:refresh:failed', { 
        id: credential.id, 
        name: credential.name,
        error
      });
    }
  }

  async validateCredential(id: string): Promise<boolean> {
    const credential = await this.getCredential(id);
    
    if (!credential) {
      return false;
    }
    
    // Check expiration
    if (credential.expiresAt && new Date() > credential.expiresAt) {
      return false;
    }
    
    // Additional validation based on credential type
    switch (credential.type) {
      case 'apikey':
        return !!credential.data.api_key;
      case 'bearer':
        return !!credential.data.token;
      case 'basic':
        return !!credential.data.username && !!credential.data.password;
      case 'oauth2':
        return !!credential.data.access_token;
      case 'certificate':
        return !!credential.data.cert && !!credential.data.key;
      default:
        return false;
    }
  }

  async removeCredential(id: string): Promise<void> {
    const credential = this.credentials.get(id);
    
    if (credential) {
      // Cancel any scheduled token refresh
      const timer = this.tokenRefreshTimers.get(id);
      if (timer) {
        clearTimeout(timer);
        this.tokenRefreshTimers.delete(id);
      }
      
      this.credentials.delete(id);
      
      this.logger.info(`Removed credential: ${credential.name}`);
      this.emit('credential:removed', { id, name: credential.name });
    }
  }

  getAllCredentials(): Array<{ id: string; name: string; type: string; expiresAt?: Date }> {
    return Array.from(this.credentials.values()).map(cred => ({
      id: cred.id,
      name: cred.name,
      type: cred.type,
      expiresAt: cred.expiresAt
    }));
  }

  async exportCredentials(password: string): Promise<string> {
    const exportData = {
      version: '1.0',
      exported: new Date().toISOString(),
      credentials: Array.from(this.credentials.values())
    };
    
    const jsonData = JSON.stringify(exportData);
    
    // Encrypt the entire export with the provided password
    const salt = crypto.randomBytes(32);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(jsonData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    const exportBundle = {
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted
    };
    
    return Buffer.from(JSON.stringify(exportBundle)).toString('base64');
  }

  async importCredentials(exportedData: string, password: string): Promise<void> {
    try {
      const exportBundle = JSON.parse(
        Buffer.from(exportedData, 'base64').toString('utf8')
      );
      
      const salt = Buffer.from(exportBundle.salt, 'hex');
      const iv = Buffer.from(exportBundle.iv, 'hex');
      const authTag = Buffer.from(exportBundle.authTag, 'hex');
      
      const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(exportBundle.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      const importData = JSON.parse(decrypted);
      
      // Import each credential
      for (const credential of importData.credentials) {
        await this.storeCredential(credential);
      }
      
      this.logger.info(`Imported ${importData.credentials.length} credentials`);
      this.emit('credentials:imported', { count: importData.credentials.length });
    } catch (error) {
      this.logger.error('Failed to import credentials', error);
      throw new Error('Invalid password or corrupted export data');
    }
  }

  shutdown(): void {
    // Clear all refresh timers
    for (const timer of this.tokenRefreshTimers.values()) {
      clearTimeout(timer);
    }
    
    this.tokenRefreshTimers.clear();
    this.credentials.clear();
    
    this.logger.info('MCPAuthManager shut down');
  }
}