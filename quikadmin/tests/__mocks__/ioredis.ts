/**
 * IORedis Mock for Jest Tests
 *
 * This mock provides an in-memory implementation of ioredis
 * to enable tests to run without Redis connection.
 * Bull uses ioredis internally, so this mock is needed.
 */

import { EventEmitter } from 'events';

// Shared storage across instances for pub/sub
const globalStorage = new Map<string, any>();
const pubsubChannels = new Map<string, Set<MockIORedis>>();

class MockIORedis extends EventEmitter {
  private _data: Map<string, any> = globalStorage;
  private _connected: boolean = true;
  private _subscribedChannels: Set<string> = new Set();
  options: any;
  status: string = 'ready';

  constructor(options?: any) {
    super();
    this.options = options || {};

    // Emit ready event asynchronously
    setImmediate(() => {
      this.emit('ready');
      this.emit('connect');
    });
  }

  // Connection methods
  async connect(): Promise<void> {
    this._connected = true;
    this.status = 'ready';
    this.emit('ready');
    this.emit('connect');
  }

  async disconnect(): Promise<void> {
    this._connected = false;
    this.status = 'end';
    this.emit('close');
    this.emit('end');
  }

  async quit(): Promise<string> {
    this._connected = false;
    this.status = 'end';
    this.emit('close');
    this.emit('end');
    return 'OK';
  }

  duplicate(): MockIORedis {
    const client = new MockIORedis(this.options);
    return client;
  }

  // String operations
  async get(key: string): Promise<string | null> {
    return this._data.get(key) ?? null;
  }

  async set(key: string, value: string, ...args: any[]): Promise<string> {
    this._data.set(key, value);
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    this._data.set(key, value);
    // Simplified: don't actually implement expiration for tests
    return 'OK';
  }

  async setnx(key: string, value: string): Promise<number> {
    if (this._data.has(key)) return 0;
    this._data.set(key, value);
    return 1;
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    keys.forEach(key => {
      if (this._data.delete(key)) deleted++;
    });
    return deleted;
  }

  async exists(...keys: string[]): Promise<number> {
    return keys.filter(key => this._data.has(key)).length;
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this._data.has(key) ? 1 : 0;
  }

  async pexpire(key: string, milliseconds: number): Promise<number> {
    return this._data.has(key) ? 1 : 0;
  }

  async ttl(key: string): Promise<number> {
    return this._data.has(key) ? -1 : -2;
  }

  async pttl(key: string): Promise<number> {
    return this._data.has(key) ? -1 : -2;
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

  async incrby(key: string, increment: number): Promise<number> {
    const value = parseInt(this._data.get(key) || '0') + increment;
    this._data.set(key, String(value));
    return value;
  }

  async decrby(key: string, decrement: number): Promise<number> {
    const value = parseInt(this._data.get(key) || '0') - decrement;
    this._data.set(key, String(value));
    return value;
  }

  // Hash operations
  async hget(key: string, field: string): Promise<string | null> {
    const hash = this._data.get(key) as Map<string, string> | undefined;
    return hash?.get(field) ?? null;
  }

  async hset(key: string, ...args: any[]): Promise<number> {
    let hash = this._data.get(key) as Map<string, string>;
    if (!hash) {
      hash = new Map();
      this._data.set(key, hash);
    }

    // Handle both (key, field, value) and (key, {field: value}) patterns
    if (typeof args[0] === 'object') {
      const obj = args[0];
      Object.entries(obj).forEach(([field, value]) => {
        hash.set(field, String(value));
      });
      return Object.keys(obj).length;
    } else {
      hash.set(args[0], args[1]);
      return 1;
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this._data.get(key) as Map<string, string> | undefined;
    if (!hash) return {};
    const result: Record<string, string> = {};
    hash.forEach((value, field) => {
      result[field] = value;
    });
    return result;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    const hash = this._data.get(key) as Map<string, string> | undefined;
    if (!hash) return 0;
    let deleted = 0;
    fields.forEach(field => {
      if (hash.delete(field)) deleted++;
    });
    return deleted;
  }

  async hmset(key: string, ...args: any[]): Promise<string> {
    await this.hset(key, ...args);
    return 'OK';
  }

  async hmget(key: string, ...fields: string[]): Promise<(string | null)[]> {
    const hash = this._data.get(key) as Map<string, string> | undefined;
    return fields.map(field => hash?.get(field) ?? null);
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    let hash = this._data.get(key) as Map<string, string>;
    if (!hash) {
      hash = new Map();
      this._data.set(key, hash);
    }
    const value = parseInt(hash.get(field) || '0') + increment;
    hash.set(field, String(value));
    return value;
  }

  // List operations
  async lpush(key: string, ...values: string[]): Promise<number> {
    let list = this._data.get(key) as string[];
    if (!list) {
      list = [];
      this._data.set(key, list);
    }
    list.unshift(...values.reverse());
    return list.length;
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    let list = this._data.get(key) as string[];
    if (!list) {
      list = [];
      this._data.set(key, list);
    }
    list.push(...values);
    return list.length;
  }

  async lpop(key: string): Promise<string | null> {
    const list = this._data.get(key) as string[];
    return list?.shift() ?? null;
  }

  async rpop(key: string): Promise<string | null> {
    const list = this._data.get(key) as string[];
    return list?.pop() ?? null;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this._data.get(key) as string[];
    if (!list) return [];
    const end = stop === -1 ? undefined : stop + 1;
    return list.slice(start, end);
  }

  async llen(key: string): Promise<number> {
    const list = this._data.get(key) as string[];
    return list?.length ?? 0;
  }

  async lrem(key: string, count: number, value: string): Promise<number> {
    let list = this._data.get(key) as string[];
    if (!list) return 0;
    let removed = 0;
    const absCount = Math.abs(count);
    const newList = list.filter(item => {
      if (item === value && (count === 0 || removed < absCount)) {
        removed++;
        return false;
      }
      return true;
    });
    this._data.set(key, newList);
    return removed;
  }

  // Set operations
  async sadd(key: string, ...members: string[]): Promise<number> {
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

  async smembers(key: string): Promise<string[]> {
    const set = this._data.get(key) as Set<string>;
    return set ? Array.from(set) : [];
  }

  async sismember(key: string, member: string): Promise<number> {
    const set = this._data.get(key) as Set<string>;
    return set?.has(member) ? 1 : 0;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this._data.get(key) as Set<string>;
    if (!set) return 0;
    let removed = 0;
    members.forEach(member => {
      if (set.delete(member)) removed++;
    });
    return removed;
  }

  async scard(key: string): Promise<number> {
    const set = this._data.get(key) as Set<string>;
    return set?.size ?? 0;
  }

  // Sorted set operations
  async zadd(key: string, ...args: any[]): Promise<number> {
    let zset = this._data.get(key) as Map<string, number>;
    if (!zset) {
      zset = new Map();
      this._data.set(key, zset);
    }
    let added = 0;
    for (let i = 0; i < args.length; i += 2) {
      const score = args[i];
      const member = args[i + 1];
      if (!zset.has(member)) added++;
      zset.set(member, score);
    }
    return added;
  }

  async zrange(key: string, start: number, stop: number, withScores?: string): Promise<string[]> {
    const zset = this._data.get(key) as Map<string, number>;
    if (!zset) return [];
    const sorted = Array.from(zset.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(start, stop === -1 ? undefined : stop + 1);

    if (withScores === 'WITHSCORES') {
      const result: string[] = [];
      sorted.forEach(([member, score]) => {
        result.push(member, String(score));
      });
      return result;
    }
    return sorted.map(([member]) => member);
  }

  async zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]> {
    const zset = this._data.get(key) as Map<string, number>;
    if (!zset) return [];
    const minNum = min === '-inf' ? -Infinity : Number(min);
    const maxNum = max === '+inf' ? Infinity : Number(max);
    return Array.from(zset.entries())
      .filter(([_, score]) => score >= minNum && score <= maxNum)
      .sort((a, b) => a[1] - b[1])
      .map(([member]) => member);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    const zset = this._data.get(key) as Map<string, number>;
    if (!zset) return 0;
    let removed = 0;
    members.forEach(member => {
      if (zset.delete(member)) removed++;
    });
    return removed;
  }

  async zcard(key: string): Promise<number> {
    const zset = this._data.get(key) as Map<string, number>;
    return zset?.size ?? 0;
  }

  // Pub/Sub operations
  async subscribe(...channels: string[]): Promise<number> {
    channels.forEach(channel => {
      this._subscribedChannels.add(channel);
      let subscribers = pubsubChannels.get(channel);
      if (!subscribers) {
        subscribers = new Set();
        pubsubChannels.set(channel, subscribers);
      }
      subscribers.add(this);
    });
    return this._subscribedChannels.size;
  }

  async unsubscribe(...channels: string[]): Promise<number> {
    channels.forEach(channel => {
      this._subscribedChannels.delete(channel);
      const subscribers = pubsubChannels.get(channel);
      if (subscribers) {
        subscribers.delete(this);
      }
    });
    return this._subscribedChannels.size;
  }

  async publish(channel: string, message: string): Promise<number> {
    const subscribers = pubsubChannels.get(channel);
    if (!subscribers) return 0;
    subscribers.forEach(client => {
      client.emit('message', channel, message);
    });
    return subscribers.size;
  }

  // Key operations
  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return Array.from(this._data.keys()).filter(key => regex.test(key));
  }

  async scan(cursor: string, ...args: any[]): Promise<[string, string[]]> {
    let pattern = '*';
    let count = 10;

    for (let i = 0; i < args.length; i += 2) {
      if (args[i].toUpperCase() === 'MATCH') pattern = args[i + 1];
      if (args[i].toUpperCase() === 'COUNT') count = parseInt(args[i + 1]);
    }

    const keys = await this.keys(pattern);
    return ['0', keys.slice(0, count)];
  }

  async flushdb(): Promise<string> {
    this._data.clear();
    return 'OK';
  }

  async flushall(): Promise<string> {
    this._data.clear();
    return 'OK';
  }

  async dbsize(): Promise<number> {
    return this._data.size;
  }

  // Transaction support
  multi(): MockPipeline {
    return new MockPipeline(this);
  }

  pipeline(): MockPipeline {
    return new MockPipeline(this);
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async client(...args: any[]): Promise<any> {
    const cmd = args[0]?.toLowerCase();
    if (cmd === 'setname') return 'OK';
    if (cmd === 'getname') return 'test-client';
    return 'OK';
  }

  async info(section?: string): Promise<string> {
    return 'redis_version:7.0.0\r\nconnected_clients:1';
  }

  // Scripting support (simplified)
  async eval(script: string, numKeys: number, ...args: any[]): Promise<any> {
    // Simplified: just return null for tests
    return null;
  }

  async evalsha(sha: string, numKeys: number, ...args: any[]): Promise<any> {
    return null;
  }

  // Define commands (for Bull compatibility)
  defineCommand(name: string, definition: any): void {
    // No-op for mock
  }
}

class MockPipeline {
  private client: MockIORedis;
  private commands: Array<{ method: string; args: any[] }> = [];

  constructor(client: MockIORedis) {
    this.client = client;
  }

  // Add chainable versions of all commands
  get(key: string): this { this.commands.push({ method: 'get', args: [key] }); return this; }
  set(key: string, value: string, ...args: any[]): this { this.commands.push({ method: 'set', args: [key, value, ...args] }); return this; }
  del(...keys: string[]): this { this.commands.push({ method: 'del', args: keys }); return this; }
  incr(key: string): this { this.commands.push({ method: 'incr', args: [key] }); return this; }
  decr(key: string): this { this.commands.push({ method: 'decr', args: [key] }); return this; }
  expire(key: string, seconds: number): this { this.commands.push({ method: 'expire', args: [key, seconds] }); return this; }
  pexpire(key: string, ms: number): this { this.commands.push({ method: 'pexpire', args: [key, ms] }); return this; }
  hset(key: string, ...args: any[]): this { this.commands.push({ method: 'hset', args: [key, ...args] }); return this; }
  hget(key: string, field: string): this { this.commands.push({ method: 'hget', args: [key, field] }); return this; }
  hgetall(key: string): this { this.commands.push({ method: 'hgetall', args: [key] }); return this; }
  lpush(key: string, ...values: string[]): this { this.commands.push({ method: 'lpush', args: [key, ...values] }); return this; }
  rpush(key: string, ...values: string[]): this { this.commands.push({ method: 'rpush', args: [key, ...values] }); return this; }
  zadd(key: string, ...args: any[]): this { this.commands.push({ method: 'zadd', args: [key, ...args] }); return this; }
  zrem(key: string, ...members: string[]): this { this.commands.push({ method: 'zrem', args: [key, ...members] }); return this; }
  zrangebyscore(key: string, min: any, max: any): this { this.commands.push({ method: 'zrangebyscore', args: [key, min, max] }); return this; }
  lrem(key: string, count: number, value: string): this { this.commands.push({ method: 'lrem', args: [key, count, value] }); return this; }
  lrange(key: string, start: number, stop: number): this { this.commands.push({ method: 'lrange', args: [key, start, stop] }); return this; }
  hincrby(key: string, field: string, increment: number): this { this.commands.push({ method: 'hincrby', args: [key, field, increment] }); return this; }

  async exec(): Promise<[Error | null, any][]> {
    const results: [Error | null, any][] = [];
    for (const cmd of this.commands) {
      try {
        const result = await (this.client as any)[cmd.method](...cmd.args);
        results.push([null, result]);
      } catch (error) {
        results.push([error as Error, null]);
      }
    }
    this.commands = [];
    return results;
  }
}

// Default export for 'new Redis()' pattern
export default MockIORedis;

// Named exports for other patterns
export { MockIORedis as Redis, MockPipeline };
