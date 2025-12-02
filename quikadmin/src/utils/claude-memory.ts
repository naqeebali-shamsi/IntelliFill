/**
 * Claude Code Memory Manager
 * 
 * A hybrid memory system that uses MCP tools for primary storage
 * with file-based backup for reliability. Designed specifically
 * for Claude Code to maintain context across sessions.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import crypto from 'crypto';

// Memory configuration
const MEMORY_CONFIG = {
  baseDir: path.join(process.cwd(), 'memory', 'claude-sessions'),
  defaultTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
  defaultNamespace: 'quikadmin-project',
  maxMemorySize: 50 * 1024 * 1024, // 50MB max per namespace
};

// Memory entry interface
interface MemoryEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl?: number;
  namespace: string;
  metadata?: {
    type: string;
    tags?: string[];
    accessCount?: number;
    lastAccessed?: number;
  };
}

// Memory statistics
interface MemoryStats {
  totalEntries: number;
  totalSize: number;
  namespaces: string[];
  oldestEntry: number;
  newestEntry: number;
}

/**
 * Claude Memory Manager Class
 * Provides a robust memory system with MCP integration and file backup
 */
export class ClaudeMemory {
  private initialized: boolean = false;
  private memoryCache: Map<string, MemoryEntry> = new Map();

  constructor(private namespace: string = MEMORY_CONFIG.defaultNamespace) {}

  /**
   * Initialize memory system
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure memory directory exists
    await fs.mkdir(MEMORY_CONFIG.baseDir, { recursive: true });
    
    // Load existing memory from files
    await this.loadFromDisk();
    
    this.initialized = true;
  }

  /**
   * Store data in memory with optional TTL
   */
  async remember<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.initialize();

    const entry: MemoryEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || MEMORY_CONFIG.defaultTTL,
      namespace: this.namespace,
      metadata: {
        type: typeof value,
        accessCount: 0,
        lastAccessed: Date.now(),
      },
    };

    // Store in cache
    const fullKey = `${this.namespace}:${key}`;
    this.memoryCache.set(fullKey, entry);

    // Persist to disk
    await this.saveToDisk(fullKey, entry);

    // Try to store in MCP (non-blocking)
    this.storeMCP(key, value, ttl).catch(err => 
      console.warn('MCP storage failed, using file backup:', err.message)
    );
  }

  /**
   * Retrieve data from memory
   */
  async recall<T>(key: string): Promise<T | null> {
    await this.initialize();

    const fullKey = `${this.namespace}:${key}`;
    
    // Check cache first
    let entry = this.memoryCache.get(fullKey);
    
    if (!entry) {
      // Try loading from disk
      entry = await this.loadFromDisk(fullKey);
    }

    if (!entry) {
      // Try MCP as last resort
      entry = await this.retrieveMCP(key);
    }

    if (!entry) return null;

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      await this.forget(key);
      return null;
    }

    // Update access metadata
    if (entry.metadata) {
      entry.metadata.accessCount = (entry.metadata.accessCount || 0) + 1;
      entry.metadata.lastAccessed = Date.now();
    }

    return entry.value as T;
  }

  /**
   * Delete data from memory
   */
  async forget(key: string): Promise<void> {
    const fullKey = `${this.namespace}:${key}`;
    
    // Remove from cache
    this.memoryCache.delete(fullKey);
    
    // Remove from disk
    const filePath = this.getFilePath(fullKey);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // File might not exist
    }

    // Try to remove from MCP
    this.deleteMCP(key).catch(() => {
      // Ignore MCP errors
    });
  }

  /**
   * List all keys in namespace
   */
  async list(pattern?: string): Promise<string[]> {
    await this.initialize();

    const keys: string[] = [];
    
    // Get from cache
    for (const [fullKey, entry] of this.memoryCache.entries()) {
      if (fullKey.startsWith(`${this.namespace}:`)) {
        const key = fullKey.substring(this.namespace.length + 1);
        if (!pattern || key.includes(pattern)) {
          keys.push(key);
        }
      }
    }

    return keys;
  }

  /**
   * Get memory statistics
   */
  async stats(): Promise<MemoryStats> {
    await this.initialize();

    const namespaces = new Set<string>();
    let totalSize = 0;
    let oldestEntry = Date.now();
    let newestEntry = 0;

    for (const entry of this.memoryCache.values()) {
      namespaces.add(entry.namespace);
      totalSize += JSON.stringify(entry).length;
      if (entry.timestamp < oldestEntry) oldestEntry = entry.timestamp;
      if (entry.timestamp > newestEntry) newestEntry = entry.timestamp;
    }

    return {
      totalEntries: this.memoryCache.size,
      totalSize,
      namespaces: Array.from(namespaces),
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Clear all memory in namespace
   */
  async clear(): Promise<void> {
    const keys = await this.list();
    for (const key of keys) {
      await this.forget(key);
    }
  }

  // Private helper methods

  private getFilePath(fullKey: string): string {
    const safeKey = fullKey.replace(/[^a-zA-Z0-9-_]/g, '-');
    return path.join(MEMORY_CONFIG.baseDir, `${safeKey}.json`);
  }

  private async saveToDisk(fullKey: string, entry: MemoryEntry): Promise<void> {
    const filePath = this.getFilePath(fullKey);
    await fs.writeFile(filePath, JSON.stringify(entry, null, 2));
  }

  private async loadFromDisk(fullKey?: string): Promise<MemoryEntry | null> {
    if (fullKey) {
      // Load specific entry
      const filePath = this.getFilePath(fullKey);
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        const entry = JSON.parse(data) as MemoryEntry;
        this.memoryCache.set(fullKey, entry);
        return entry;
      } catch (err) {
        return null;
      }
    } else {
      // Load all entries
      try {
        const files = await fs.readdir(MEMORY_CONFIG.baseDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(MEMORY_CONFIG.baseDir, file);
            const data = await fs.readFile(filePath, 'utf-8');
            const entry = JSON.parse(data) as MemoryEntry;
            const fullKey = `${entry.namespace}:${entry.key}`;
            this.memoryCache.set(fullKey, entry);
          }
        }
      } catch (err) {
        // Directory might not exist yet
      }
      return null;
    }
  }

  // MCP Integration (placeholder - would use actual MCP tools in practice)
  private async storeMCP(key: string, value: any, ttl?: number): Promise<void> {
    // In real implementation, this would call:
    // mcp__claude-flow__memory_usage with action: 'store'
    console.log(`[MCP] Storing ${key} in namespace ${this.namespace}`);
  }

  private async retrieveMCP(key: string): Promise<MemoryEntry | null> {
    // In real implementation, this would call:
    // mcp__claude-flow__memory_usage with action: 'retrieve'
    console.log(`[MCP] Retrieving ${key} from namespace ${this.namespace}`);
    return null;
  }

  private async deleteMCP(key: string): Promise<void> {
    // In real implementation, this would call:
    // mcp__claude-flow__memory_usage with action: 'delete'
    console.log(`[MCP] Deleting ${key} from namespace ${this.namespace}`);
  }
}

// Singleton instance for default namespace
const defaultMemory = new ClaudeMemory();

/**
 * Convenience functions for quick access
 */

export async function rememberProjectContext(key: string, value: any, ttl?: number): Promise<void> {
  return defaultMemory.remember(key, value, ttl);
}

export async function recallProjectContext<T>(key: string): Promise<T | null> {
  return defaultMemory.recall<T>(key);
}

export async function forgetProjectContext(key: string): Promise<void> {
  return defaultMemory.forget(key);
}

export async function listProjectContext(pattern?: string): Promise<string[]> {
  return defaultMemory.list(pattern);
}

export async function getMemoryStats(): Promise<MemoryStats> {
  return defaultMemory.stats();
}

export async function clearProjectMemory(): Promise<void> {
  return defaultMemory.clear();
}

// Export types
export type { MemoryEntry, MemoryStats };

// Initialize on import
defaultMemory.initialize().catch(err => 
  console.error('Failed to initialize Claude Memory:', err)
);