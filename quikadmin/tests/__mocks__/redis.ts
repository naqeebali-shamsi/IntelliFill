/**
 * Redis Client Mock for Jest Tests
 *
 * This mock provides an in-memory implementation of the redis client
 * to enable tests to run without Redis connection.
 */

import { EventEmitter } from 'events';

// In-memory storage
const dataStore = new Map<string, any>();
const expirations = new Map<string, number>();

class MockRedisClient extends EventEmitter {
  private _connected: boolean = false;
  private _data: Map<string, any> = new Map();
  private _expirations: Map<string, number> = new Map();

  constructor(options?: any) {
    super();
  }

  async connect(): Promise<MockRedisClient> {
    this._connected = true;
    setImmediate(() => {
      this.emit('ready');
    });
    return this;
  }

  async disconnect(): Promise<void> {
    this._connected = false;
    this.emit('end');
  }

  async quit(): Promise<string> {
    this._connected = false;
    this.emit('end');
    return 'OK';
  }

  get isOpen(): boolean {
    return this._connected;
  }

  get isReady(): boolean {
    return this._connected;
  }

  // String operations
  async get(key: string): Promise<string | null> {
    this._checkExpiration(key);
    return this._data.get(key) ?? null;
  }

  async set(key: string, value: string, options?: any): Promise<string> {
    this._data.set(key, value);
    if (options?.EX) {
      this._expirations.set(key, Date.now() + options.EX * 1000);
    } else if (options?.PX) {
      this._expirations.set(key, Date.now() + options.PX);
    }
    return 'OK';
  }

  async setEx(key: string, seconds: number, value: string): Promise<string> {
    this._data.set(key, value);
    this._expirations.set(key, Date.now() + seconds * 1000);
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    keys.forEach(key => {
      if (this._data.has(key)) {
        this._data.delete(key);
        this._expirations.delete(key);
        deleted++;
      }
    });
    return deleted;
  }

  async exists(...keys: string[]): Promise<number> {
    let count = 0;
    keys.forEach(key => {
      this._checkExpiration(key);
      if (this._data.has(key)) count++;
    });
    return count;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (this._data.has(key)) {
      this._expirations.set(key, Date.now() + seconds * 1000);
      return 1;
    }
    return 0;
  }

  async ttl(key: string): Promise<number> {
    const expiration = this._expirations.get(key);
    if (!expiration) return -1;
    const remaining = Math.ceil((expiration - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  // Number operations
  async incr(key: string): Promise<number> {
    const value = parseInt(this._data.get(key) || '0') + 1;
    this._data.set(key, String(value));
    return value;
  }

  async decr(key: string): Promise<number> {
    const value = parseInt(this._data.get(key) || '0') - 1;
    this._data.set(key, String(value));
    return value;
  }

  async incrBy(key: string, increment: number): Promise<number> {
    const value = parseInt(this._data.get(key) || '0') + increment;
    this._data.set(key, String(value));
    return value;
  }

  // Hash operations
  async hGet(key: string, field: string): Promise<string | undefined> {
    const hash = this._data.get(key) as Map<string, string> | undefined;
    return hash?.get(field);
  }

  async hSet(key: string, field: string, value: string): Promise<number> {
    let hash = this._data.get(key) as Map<string, string>;
    if (!hash) {
      hash = new Map();
      this._data.set(key, hash);
    }
    const isNew = !hash.has(field);
    hash.set(field, value);
    return isNew ? 1 : 0;
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    const hash = this._data.get(key) as Map<string, string> | undefined;
    if (!hash) return {};
    const result: Record<string, string> = {};
    hash.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  async hDel(key: string, ...fields: string[]): Promise<number> {
    const hash = this._data.get(key) as Map<string, string> | undefined;
    if (!hash) return 0;
    let deleted = 0;
    fields.forEach(field => {
      if (hash.delete(field)) deleted++;
    });
    return deleted;
  }

  // List operations
  async lPush(key: string, ...values: string[]): Promise<number> {
    let list = this._data.get(key) as string[];
    if (!list) {
      list = [];
      this._data.set(key, list);
    }
    list.unshift(...values.reverse());
    return list.length;
  }

  async rPush(key: string, ...values: string[]): Promise<number> {
    let list = this._data.get(key) as string[];
    if (!list) {
      list = [];
      this._data.set(key, list);
    }
    list.push(...values);
    return list.length;
  }

  async lPop(key: string): Promise<string | null> {
    const list = this._data.get(key) as string[];
    return list?.shift() ?? null;
  }

  async rPop(key: string): Promise<string | null> {
    const list = this._data.get(key) as string[];
    return list?.pop() ?? null;
  }

  async lRange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this._data.get(key) as string[];
    if (!list) return [];
    const end = stop === -1 ? undefined : stop + 1;
    return list.slice(start, end);
  }

  async lLen(key: string): Promise<number> {
    const list = this._data.get(key) as string[];
    return list?.length ?? 0;
  }

  // Set operations
  async sAdd(key: string, ...members: string[]): Promise<number> {
    let set = this._data.get(key) as Set<string>;
    if (!set) {
      set = new Set();
      this._data.set(key, set);
    }
    let added = 0;
    members.forEach(member => {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    });
    return added;
  }

  async sMembers(key: string): Promise<string[]> {
    const set = this._data.get(key) as Set<string>;
    return set ? Array.from(set) : [];
  }

  async sIsMember(key: string, member: string): Promise<number> {
    const set = this._data.get(key) as Set<string>;
    return set?.has(member) ? 1 : 0;
  }

  async sRem(key: string, ...members: string[]): Promise<number> {
    const set = this._data.get(key) as Set<string>;
    if (!set) return 0;
    let removed = 0;
    members.forEach(member => {
      if (set.delete(member)) removed++;
    });
    return removed;
  }

  // Key operations
  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this._data.keys()).filter(key => regex.test(key));
  }

  async flushDb(): Promise<string> {
    this._data.clear();
    this._expirations.clear();
    return 'OK';
  }

  async flushAll(): Promise<string> {
    this._data.clear();
    this._expirations.clear();
    return 'OK';
  }

  // Transaction support
  multi(): MockMulti {
    return new MockMulti(this);
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  // Internal helper
  private _checkExpiration(key: string): void {
    const expiration = this._expirations.get(key);
    if (expiration && Date.now() > expiration) {
      this._data.delete(key);
      this._expirations.delete(key);
    }
  }

  // Duplicate client (for Bull compatibility)
  duplicate(): MockRedisClient {
    const client = new MockRedisClient();
    client._data = this._data;
    client._expirations = this._expirations;
    return client;
  }
}

class MockMulti {
  private client: MockRedisClient;
  private commands: Array<{ method: string; args: any[] }> = [];

  constructor(client: MockRedisClient) {
    this.client = client;
  }

  incr(key: string): MockMulti {
    this.commands.push({ method: 'incr', args: [key] });
    return this;
  }

  expire(key: string, seconds: number): MockMulti {
    this.commands.push({ method: 'expire', args: [key, seconds] });
    return this;
  }

  set(key: string, value: string, options?: any): MockMulti {
    this.commands.push({ method: 'set', args: [key, value, options] });
    return this;
  }

  get(key: string): MockMulti {
    this.commands.push({ method: 'get', args: [key] });
    return this;
  }

  del(...keys: string[]): MockMulti {
    this.commands.push({ method: 'del', args: keys });
    return this;
  }

  async exec(): Promise<any[]> {
    const results: any[] = [];
    for (const cmd of this.commands) {
      const result = await (this.client as any)[cmd.method](...cmd.args);
      results.push(result);
    }
    this.commands = [];
    return results;
  }
}

// Factory function matching redis package API
export function createClient(options?: any): MockRedisClient {
  return new MockRedisClient(options);
}

export { MockRedisClient, MockMulti };
