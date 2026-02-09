/**
 * Jest Test Setup
 *
 * Sets up environment variables, mocks, and global test configuration
 * before any tests run.
 *
 * This file is specified in jest.config.js as setupFilesAfterEnv.
 */

// ========================================
// 1. Environment Variables for Tests
// ========================================

// Set Supabase environment variables for tests
process.env.SUPABASE_URL = 'https://test-project.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key-1234567890';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-1234567890';

// Set other required environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET =
  'test-jwt-secret-key-with-sufficient-length-for-security-requirements-and-more';
process.env.JWT_REFRESH_SECRET =
  'test-jwt-refresh-secret-key-with-sufficient-length-for-security-requirements';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_ISSUER = 'test-issuer';
process.env.JWT_AUDIENCE = 'test-audience';

// Disable Redis Sentinel for tests
process.env.REDIS_SENTINEL_ENABLED = 'false';

// ========================================
// 2. Core Module Mocks
// ========================================

// Mock express-rate-limit to bypass rate limiting in tests
jest.mock('express-rate-limit', () => {
  return jest.fn(() => (req: any, res: any, next: any) => next());
});

// Mock Bull queue to avoid Redis connection
jest.mock('bull', () => {
  const { EventEmitter } = require('events');

  const jobStorage = new Map();
  let jobIdCounter = 1;

  class MockJob extends EventEmitter {
    id: any;
    data: any;
    opts: any;
    timestamp: number;
    processedOn?: number;
    finishedOn?: number;
    returnvalue?: any;
    failedReason?: string;
    attemptsMade: number = 0;
    private _state: string = 'waiting';
    private _progress: number = 0;

    constructor(data: any, opts: any = {}) {
      super();
      this.id = jobIdCounter++;
      this.data = data;
      this.opts = { attempts: 3, ...opts };
      this.timestamp = Date.now();
      jobStorage.set(String(this.id), this);
    }

    async progress(value?: number) {
      if (value !== undefined) this._progress = value;
      return this._progress;
    }

    async getState() {
      return this._state;
    }
    async remove() {
      jobStorage.delete(String(this.id));
    }
    async retry() {
      this._state = 'waiting';
      this.attemptsMade++;
    }
    async finished() {
      return this.returnvalue;
    }
    async waitUntilFinished() {
      this._state = 'completed';
      this.finishedOn = Date.now();
      return this.returnvalue;
    }
  }

  class MockQueue extends EventEmitter {
    name: string;
    private jobs = new Map();
    private processor?: (...args: unknown[]) => unknown;

    constructor(name: string) {
      super();
      this.name = name;
      setImmediate(() => this.emit('ready'));
    }

    async add(data: any, opts?: any) {
      const job = new MockJob(data, opts);
      this.jobs.set(String(job.id), job);
      this.emit('waiting', job);
      return job;
    }

    process(concurrency: any, processor?: (...args: unknown[]) => unknown) {
      this.processor = typeof concurrency === 'function' ? concurrency : processor;
    }

    async getJob(jobId: any) {
      return this.jobs.get(String(jobId)) || jobStorage.get(String(jobId)) || null;
    }

    async empty() {
      this.jobs.clear();
    }
    async close() {
      this.jobs.clear();
      this.emit('closed');
    }
    async pause() {
      this.emit('paused');
    }
    async resume() {
      this.emit('resumed');
    }
    async getWaitingCount() {
      return 0;
    }
    async getActiveCount() {
      return 0;
    }
    async getCompletedCount() {
      return 0;
    }
    async getFailedCount() {
      return 0;
    }
    async getDelayedCount() {
      return 0;
    }
    async clean() {
      return [];
    }
  }

  return MockQueue;
});

// Mock ioredis (used internally by Bull)
jest.mock('ioredis', () => {
  const { EventEmitter } = require('events');
  const dataStore = new Map();

  class MockIORedis extends EventEmitter {
    status = 'ready';
    options: any;

    constructor(options?: any) {
      super();
      this.options = options;
      setImmediate(() => {
        this.emit('ready');
        this.emit('connect');
      });
    }

    async connect() {
      this.status = 'ready';
      this.emit('ready');
    }
    async disconnect() {
      this.status = 'end';
      this.emit('end');
    }
    async quit() {
      this.status = 'end';
      this.emit('end');
      return 'OK';
    }
    duplicate() {
      return new MockIORedis(this.options);
    }

    async get(key: string) {
      return dataStore.get(key) ?? null;
    }
    async set(key: string, value: string) {
      dataStore.set(key, value);
      return 'OK';
    }
    async del(...keys: string[]) {
      let deleted = 0;
      keys.forEach((key) => {
        if (dataStore.delete(key)) deleted++;
      });
      return deleted;
    }
    async incr(key: string) {
      const value = parseInt(dataStore.get(key) || '0') + 1;
      dataStore.set(key, String(value));
      return value;
    }
    async decr(key: string) {
      const value = parseInt(dataStore.get(key) || '0') - 1;
      dataStore.set(key, String(value));
      return value;
    }
    async incrBy(key: string, amount: number) {
      const value = parseInt(dataStore.get(key) || '0') + amount;
      dataStore.set(key, String(value));
      return value;
    }
    async decrBy(key: string, amount: number) {
      const value = parseInt(dataStore.get(key) || '0') - amount;
      dataStore.set(key, String(value));
      return value;
    }

    async expire() {
      return 1;
    }
    async pexpire() {
      return 1;
    }
    async ttl() {
      return -1;
    }
    async ping() {
      return 'PONG';
    }
    async hset() {
      return 1;
    }
    async hget() {
      return null;
    }
    async hgetall() {
      return {};
    }
    async lpush() {
      return 1;
    }
    async rpush() {
      return 1;
    }
    async lrange() {
      return [];
    }
    async zadd() {
      return 1;
    }
    async zrangebyscore() {
      return [];
    }
    async zrem() {
      return 0;
    }
    async zcard() {
      return 0;
    }
    async keys() {
      return [];
    }
    async flushdb() {
      dataStore.clear();
      return 'OK';
    }
    async client() {
      return 'OK';
    }
    async info() {
      return 'redis_version:7.0.0';
    }

    multi() {
      return new MockPipeline();
    }
    pipeline() {
      return new MockPipeline();
    }
    defineCommand() {}
  }

  class MockPipeline {
    get() {
      return this;
    }
    set() {
      return this;
    }
    del() {
      return this;
    }
    incr() {
      return this;
    }
    expire() {
      return this;
    }
    pexpire() {
      return this;
    }
    hset() {
      return this;
    }
    hget() {
      return this;
    }
    lpush() {
      return this;
    }
    rpush() {
      return this;
    }
    lrange() {
      return this;
    }
    zadd() {
      return this;
    }
    zrem() {
      return this;
    }
    zrangebyscore() {
      return this;
    }
    lrem() {
      return this;
    }
    hincrby() {
      return this;
    }
    async exec() {
      return [[null, 'OK']];
    }
  }

  return MockIORedis;
});

// Mock redis client (used by rate limiter)
jest.mock('redis', () => {
  const { EventEmitter } = require('events');
  const dataStore = new Map();

  class MockRedisClient extends EventEmitter {
    private _connected = false;

    async connect() {
      this._connected = true;
      setImmediate(() => this.emit('ready'));
      return this;
    }

    async disconnect() {
      this._connected = false;
      this.emit('end');
    }
    async quit() {
      this._connected = false;
      this.emit('end');
      return 'OK';
    }

    get isOpen() {
      return this._connected;
    }
    get isReady() {
      return this._connected;
    }

    async get(key: string) {
      return dataStore.get(key) ?? null;
    }
    async set(key: string, value: string) {
      dataStore.set(key, value);
      return 'OK';
    }
    async del(...keys: string[]) {
      let deleted = 0;
      keys.forEach((key) => {
        if (dataStore.delete(key)) deleted++;
      });
      return deleted;
    }
    async incr(key: string) {
      const value = parseInt(dataStore.get(key) || '0') + 1;
      dataStore.set(key, String(value));
      return value;
    }
    async decr(key: string) {
      const value = parseInt(dataStore.get(key) || '0') - 1;
      dataStore.set(key, String(value));
      return value;
    }
    async incrBy(key: string, increment: number) {
      const value = parseInt(dataStore.get(key) || '0') + increment;
      dataStore.set(key, String(value));
      return value;
    }
    async decrBy(key: string, decrement: number) {
      const value = parseInt(dataStore.get(key) || '0') - decrement;
      dataStore.set(key, String(value));
      return value;
    }
    async expire() {
      return 1;
    }

    multi() {
      return {
        incr: () => ({ expire: () => ({ exec: async () => [[null, 1]] }) }),
        exec: async () => [[null, 1]],
      };
    }

    duplicate() {
      return new MockRedisClient();
    }
  }

  return { createClient: () => new MockRedisClient() };
});

// ========================================
// 3. Prisma Mock
// ========================================

// Create shared data stores for Prisma mock
const prismaDataStores: Record<string, Map<string, any>> = {
  user: new Map(),
  document: new Map(),
  template: new Map(),
  profile: new Map(),
  profileData: new Map(),
  userProfile: new Map(),
  formFillHistory: new Map(),
  dataField: new Map(),
  job: new Map(),
  auditLog: new Map(),
  documentSource: new Map(),
  documentChunk: new Map(),
  processingCheckpoint: new Map(),
  profileAuditLog: new Map(),
  organization: new Map(),
  organizationMembership: new Map(),
  organizationInvitation: new Map(),
  documentShare: new Map(),
  client: new Map(),
  clientProfile: new Map(),
  refreshTokenFamily: new Map(),
};

let prismaIdCounter = 1;
const generatePrismaId = () => 'mock-id-' + prismaIdCounter++;

const matchPrismaWhere = (record: any, where: any): boolean => {
  if (!where) return true;
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;
    if (typeof value === 'object' && value !== null) {
      const v = value as any;
      if ('equals' in v && record[key] !== v.equals) return false;
      if ('contains' in v && !String(record[key]).includes(v.contains)) return false;
      if ('in' in v && !v.in.includes(record[key])) return false;
      if ('not' in v && record[key] === v.not) return false;
    } else if (record[key] !== value) {
      return false;
    }
  }
  return true;
};

const createPrismaModelDelegate = (modelName: string) => {
  const store = prismaDataStores[modelName] || new Map();
  if (!prismaDataStores[modelName]) {
    prismaDataStores[modelName] = store;
  }
  return {
    findUnique: jest.fn(async (args: any) => {
      return Array.from(store.values()).find((r) => matchPrismaWhere(r, args?.where)) || null;
    }),
    findFirst: jest.fn(async (args?: any) => {
      const records = Array.from(store.values());
      const filtered = args?.where
        ? records.filter((r) => matchPrismaWhere(r, args.where))
        : records;
      return filtered[0] || null;
    }),
    findMany: jest.fn(async (args?: any) => {
      let records = Array.from(store.values());
      if (args?.where) records = records.filter((r) => matchPrismaWhere(r, args.where));
      if (args?.skip) records = records.slice(args.skip);
      if (args?.take) records = records.slice(0, args.take);
      return records;
    }),
    create: jest.fn(async (args: any) => {
      const id = args.data.id || generatePrismaId();
      const record = { id, ...args.data, createdAt: new Date(), updatedAt: new Date() };
      store.set(id, record);
      return record;
    }),
    createMany: jest.fn(async (args: any) => {
      let count = 0;
      for (const item of args.data) {
        const id = item.id || generatePrismaId();
        store.set(id, { id, ...item, createdAt: new Date(), updatedAt: new Date() });
        count++;
      }
      return { count };
    }),
    update: jest.fn(async (args: any) => {
      const record = Array.from(store.values()).find((r) => matchPrismaWhere(r, args.where));
      if (!record) throw new Error('Record not found in ' + modelName);
      const processedData: Record<string, any> = {};
      for (const [key, value] of Object.entries(args.data || {})) {
        if (typeof value === 'object' && value !== null && 'increment' in (value as any)) {
          processedData[key] = (record[key] || 0) + (value as any).increment;
        } else if (typeof value === 'object' && value !== null && 'decrement' in (value as any)) {
          processedData[key] = (record[key] || 0) - (value as any).decrement;
        } else {
          processedData[key] = value;
        }
      }
      const updated = { ...record, ...processedData, updatedAt: new Date() };
      store.set(record.id, updated);
      return updated;
    }),
    updateMany: jest.fn(async (args: any) => {
      let count = 0;
      for (const record of store.values()) {
        if (matchPrismaWhere(record, args.where)) {
          store.set(record.id, { ...record, ...args.data, updatedAt: new Date() });
          count++;
        }
      }
      return { count };
    }),
    upsert: jest.fn(async (args: any) => {
      const existing = Array.from(store.values()).find((r) => matchPrismaWhere(r, args.where));
      if (existing) {
        const updated = { ...existing, ...args.update, updatedAt: new Date() };
        store.set(existing.id, updated);
        return updated;
      }
      const id = args.create.id || generatePrismaId();
      const record = { id, ...args.create, createdAt: new Date(), updatedAt: new Date() };
      store.set(id, record);
      return record;
    }),
    delete: jest.fn(async (args: any) => {
      const record = Array.from(store.values()).find((r) => matchPrismaWhere(r, args.where));
      if (!record) throw new Error('Record not found in ' + modelName);
      store.delete(record.id);
      return record;
    }),
    deleteMany: jest.fn(async (args?: any) => {
      let count = 0;
      if (!args?.where) {
        count = store.size;
        store.clear();
        return { count };
      }
      for (const record of store.values()) {
        if (matchPrismaWhere(record, args.where)) {
          store.delete(record.id);
          count++;
        }
      }
      return { count };
    }),
    count: jest.fn(async (args?: any) => {
      if (!args?.where) return store.size;
      return Array.from(store.values()).filter((r) => matchPrismaWhere(r, args.where)).length;
    }),
    aggregate: jest.fn(async () => ({ _count: { _all: 0 } })),
    groupBy: jest.fn(async () => []),
  };
};

// Create a shared mock prisma instance used by src/utils/prisma.ts mock
const mockPrismaInstance = {
  user: createPrismaModelDelegate('user'),
  document: createPrismaModelDelegate('document'),
  template: createPrismaModelDelegate('template'),
  profile: createPrismaModelDelegate('profile'),
  profileData: createPrismaModelDelegate('profileData'),
  userProfile: createPrismaModelDelegate('userProfile'),
  formFillHistory: createPrismaModelDelegate('formFillHistory'),
  dataField: createPrismaModelDelegate('dataField'),
  job: createPrismaModelDelegate('job'),
  auditLog: createPrismaModelDelegate('auditLog'),
  documentSource: createPrismaModelDelegate('documentSource'),
  documentChunk: createPrismaModelDelegate('documentChunk'),
  processingCheckpoint: createPrismaModelDelegate('processingCheckpoint'),
  profileAuditLog: createPrismaModelDelegate('profileAuditLog'),
  organization: createPrismaModelDelegate('organization'),
  organizationMembership: createPrismaModelDelegate('organizationMembership'),
  organizationInvitation: createPrismaModelDelegate('organizationInvitation'),
  documentShare: createPrismaModelDelegate('documentShare'),
  client: createPrismaModelDelegate('client'),
  clientProfile: createPrismaModelDelegate('clientProfile'),
  refreshTokenFamily: createPrismaModelDelegate('refreshTokenFamily'),
  $connect: jest.fn(async () => {}),
  $disconnect: jest.fn(async () => {}),
  $executeRaw: jest.fn(async () => 0),
  $executeRawUnsafe: jest.fn(async () => 0),
  $queryRaw: jest.fn(async () => []),
  $queryRawUnsafe: jest.fn(async () => []),
  $transaction: jest.fn(async (arg: any) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    return arg(mockPrismaInstance);
  }),
  $on: jest.fn(),
  $use: jest.fn(),
};

// Mock src/utils/prisma to prevent $on error and provide shared mock instance
// This MUST come before @prisma/client mock to be registered first
jest.mock('../src/utils/prisma', () => ({
  prisma: mockPrismaInstance,
  ensureDbConnection: jest.fn(async () => true),
  startKeepalive: jest.fn(),
  stopKeepalive: jest.fn(),
}));

jest.mock('@prisma/client', () => {
  const dataStores: Record<string, Map<string, any>> = {
    user: new Map(),
    document: new Map(),
    template: new Map(),
    profile: new Map(),
    profileData: new Map(),
    formFillHistory: new Map(),
    dataField: new Map(),
    job: new Map(),
    auditLog: new Map(),
  };

  let idCounter = 1;
  const generateId = () => 'mock-id-' + idCounter++;

  const matchWhere = (record: any, where: any): boolean => {
    if (!where) return true;
    for (const [key, value] of Object.entries(where)) {
      if (value === undefined) continue;
      if (typeof value === 'object' && value !== null) {
        const v = value as any;
        if ('equals' in v && record[key] !== v.equals) return false;
        if ('contains' in v && !String(record[key]).includes(v.contains)) return false;
        if ('in' in v && !v.in.includes(record[key])) return false;
      } else if (record[key] !== value) {
        return false;
      }
    }
    return true;
  };

  const createModelDelegate = (modelName: string) => {
    const store = dataStores[modelName];
    return {
      findUnique: async (args: any) => {
        return Array.from(store.values()).find((r) => matchWhere(r, args.where)) || null;
      },
      findFirst: async (args?: any) => {
        const records = Array.from(store.values());
        const filtered = args?.where ? records.filter((r) => matchWhere(r, args.where)) : records;
        return filtered[0] || null;
      },
      findMany: async (args?: any) => {
        let records = Array.from(store.values());
        if (args?.where) records = records.filter((r) => matchWhere(r, args.where));
        if (args?.skip) records = records.slice(args.skip);
        if (args?.take) records = records.slice(0, args.take);
        return records;
      },
      create: async (args: any) => {
        const id = args.data.id || generateId();
        const record = { id, ...args.data, createdAt: new Date(), updatedAt: new Date() };
        store.set(id, record);
        return record;
      },
      createMany: async (args: any) => {
        let count = 0;
        for (const item of args.data) {
          const id = item.id || generateId();
          store.set(id, { id, ...item, createdAt: new Date(), updatedAt: new Date() });
          count++;
        }
        return { count };
      },
      update: async (args: any) => {
        const record = Array.from(store.values()).find((r) => matchWhere(r, args.where));
        if (!record) throw new Error('Record not found in ' + modelName);
        const updated = { ...record, ...args.data, updatedAt: new Date() };
        store.set(record.id, updated);
        return updated;
      },
      updateMany: async (args: any) => {
        let count = 0;
        for (const record of store.values()) {
          if (matchWhere(record, args.where)) {
            store.set(record.id, { ...record, ...args.data, updatedAt: new Date() });
            count++;
          }
        }
        return { count };
      },
      upsert: async (args: any) => {
        const existing = Array.from(store.values()).find((r) => matchWhere(r, args.where));
        if (existing) {
          const updated = { ...existing, ...args.update, updatedAt: new Date() };
          store.set(existing.id, updated);
          return updated;
        }
        const id = args.create.id || generateId();
        const record = { id, ...args.create, createdAt: new Date(), updatedAt: new Date() };
        store.set(id, record);
        return record;
      },
      delete: async (args: any) => {
        const record = Array.from(store.values()).find((r) => matchWhere(r, args.where));
        if (!record) throw new Error('Record not found in ' + modelName);
        store.delete(record.id);
        return record;
      },
      deleteMany: async (args?: any) => {
        let count = 0;
        if (!args?.where) {
          count = store.size;
          store.clear();
          return { count };
        }
        for (const record of store.values()) {
          if (matchWhere(record, args.where)) {
            store.delete(record.id);
            count++;
          }
        }
        return { count };
      },
      count: async (args?: any) => {
        if (!args?.where) return store.size;
        return Array.from(store.values()).filter((r) => matchWhere(r, args.where)).length;
      },
      aggregate: async () => ({ _count: { _all: 0 } }),
      groupBy: async () => [],
    };
  };

  class PrismaClient {
    user = createModelDelegate('user');
    document = createModelDelegate('document');
    template = createModelDelegate('template');
    profile = createModelDelegate('profile');
    profileData = createModelDelegate('profileData');
    formFillHistory = createModelDelegate('formFillHistory');
    dataField = createModelDelegate('dataField');
    job = createModelDelegate('job');
    auditLog = createModelDelegate('auditLog');

    async $connect() {}
    async $disconnect() {}
    async $executeRaw() {
      return 0;
    }
    async $executeRawUnsafe() {
      return 0;
    }
    async $queryRaw() {
      return [];
    }
    async $queryRawUnsafe() {
      return [];
    }
    async $transaction(arg: any) {
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg(this);
    }
    $on() {}
    $use() {}

    static _resetAllStores() {
      Object.values(dataStores).forEach((store) => store.clear());
      idCounter = 1;
    }
  }

  return {
    PrismaClient,
    Prisma: {
      TransactionIsolationLevel: {
        ReadUncommitted: 'ReadUncommitted',
        ReadCommitted: 'ReadCommitted',
        RepeatableRead: 'RepeatableRead',
        Serializable: 'Serializable',
      },
      SortOrder: { asc: 'asc', desc: 'desc' },
    },
    SharePermission: { VIEW: 'VIEW', COMMENT: 'COMMENT', EDIT: 'EDIT' },
    PrismaClientKnownRequestError: class extends Error {
      code: string;
      constructor(msg: string, opts: any) {
        super(msg);
        this.code = opts.code;
      }
    },
    PrismaClientUnknownRequestError: class extends Error {},
    PrismaClientInitializationError: class extends Error {},
    PrismaClientValidationError: class extends Error {},
  };
});

// ========================================
// 4. Global Test Configuration
// ========================================

jest.setTimeout(30000);

// ========================================
// 5. Global Cleanup
// ========================================

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
});

export {};
