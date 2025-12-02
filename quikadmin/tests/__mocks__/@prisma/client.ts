/**
 * Prisma Client Mock for Jest Tests
 *
 * This mock provides an in-memory implementation of PrismaClient
 * to enable tests to run without database connection.
 */

import { EventEmitter } from 'events';

// In-memory data stores
const dataStores: Record<string, Map<string, any>> = {
  user: new Map(),
  document: new Map(),
  template: new Map(),
  profile: new Map(),
  profileData: new Map(),
  formFillHistory: new Map(),
  dataField: new Map(),
  job: new Map(),
  auditLog: new Map()
};

let idCounter = 1;

function generateId(): string {
  return `mock-id-${idCounter++}`;
}

function matchWhere(record: any, where: any): boolean {
  if (!where) return true;

  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;

    if (typeof value === 'object' && value !== null) {
      // Handle operators
      if ('equals' in value) {
        if (record[key] !== value.equals) return false;
      } else if ('contains' in value) {
        if (!String(record[key]).includes(value.contains)) return false;
      } else if ('in' in value) {
        if (!value.in.includes(record[key])) return false;
      } else if ('notIn' in value) {
        if (value.notIn.includes(record[key])) return false;
      } else if ('lt' in value) {
        if (record[key] >= value.lt) return false;
      } else if ('lte' in value) {
        if (record[key] > value.lte) return false;
      } else if ('gt' in value) {
        if (record[key] <= value.gt) return false;
      } else if ('gte' in value) {
        if (record[key] < value.gte) return false;
      } else if ('startsWith' in value) {
        if (!String(record[key]).startsWith(value.startsWith)) return false;
      } else if ('endsWith' in value) {
        if (!String(record[key]).endsWith(value.endsWith)) return false;
      } else if ('not' in value) {
        if (record[key] === value.not) return false;
      }
    } else {
      // Direct value comparison
      if (record[key] !== value) return false;
    }
  }
  return true;
}

function createModelDelegate(modelName: string) {
  const store = dataStores[modelName];

  return {
    async findUnique(args: { where: any; include?: any; select?: any }) {
      const records = Array.from(store.values());
      const record = records.find(r => matchWhere(r, args.where));
      return record || null;
    },

    async findFirst(args?: { where?: any; include?: any; select?: any; orderBy?: any }) {
      const records = Array.from(store.values());
      const filtered = args?.where ? records.filter(r => matchWhere(r, args.where)) : records;
      return filtered[0] || null;
    },

    async findMany(args?: { where?: any; include?: any; select?: any; orderBy?: any; take?: number; skip?: number }) {
      let records = Array.from(store.values());

      if (args?.where) {
        records = records.filter(r => matchWhere(r, args.where));
      }

      if (args?.orderBy) {
        const orderKey = Object.keys(args.orderBy)[0];
        const orderDir = args.orderBy[orderKey];
        records.sort((a, b) => {
          if (orderDir === 'asc') return a[orderKey] > b[orderKey] ? 1 : -1;
          return a[orderKey] < b[orderKey] ? 1 : -1;
        });
      }

      if (args?.skip) {
        records = records.slice(args.skip);
      }

      if (args?.take) {
        records = records.slice(0, args.take);
      }

      return records;
    },

    async create(args: { data: any; include?: any; select?: any }) {
      const id = args.data.id || generateId();
      const record = {
        id,
        ...args.data,
        createdAt: args.data.createdAt || new Date(),
        updatedAt: args.data.updatedAt || new Date()
      };
      store.set(id, record);
      return record;
    },

    async createMany(args: { data: any[]; skipDuplicates?: boolean }) {
      let count = 0;
      for (const item of args.data) {
        const id = item.id || generateId();
        if (args.skipDuplicates && store.has(id)) continue;
        store.set(id, {
          id,
          ...item,
          createdAt: item.createdAt || new Date(),
          updatedAt: item.updatedAt || new Date()
        });
        count++;
      }
      return { count };
    },

    async update(args: { where: any; data: any; include?: any; select?: any }) {
      const records = Array.from(store.values());
      const record = records.find(r => matchWhere(r, args.where));

      if (!record) {
        throw new Error(`Record not found in ${modelName}`);
      }

      const updated = {
        ...record,
        ...args.data,
        updatedAt: new Date()
      };
      store.set(record.id, updated);
      return updated;
    },

    async updateMany(args: { where: any; data: any }) {
      let count = 0;
      const records = Array.from(store.values());

      for (const record of records) {
        if (matchWhere(record, args.where)) {
          const updated = {
            ...record,
            ...args.data,
            updatedAt: new Date()
          };
          store.set(record.id, updated);
          count++;
        }
      }

      return { count };
    },

    async upsert(args: { where: any; create: any; update: any; include?: any; select?: any }) {
      const records = Array.from(store.values());
      const existing = records.find(r => matchWhere(r, args.where));

      if (existing) {
        const updated = {
          ...existing,
          ...args.update,
          updatedAt: new Date()
        };
        store.set(existing.id, updated);
        return updated;
      } else {
        const id = args.create.id || generateId();
        const record = {
          id,
          ...args.create,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        store.set(id, record);
        return record;
      }
    },

    async delete(args: { where: any }) {
      const records = Array.from(store.values());
      const record = records.find(r => matchWhere(r, args.where));

      if (!record) {
        throw new Error(`Record not found in ${modelName}`);
      }

      store.delete(record.id);
      return record;
    },

    async deleteMany(args?: { where?: any }) {
      let count = 0;

      if (!args?.where) {
        count = store.size;
        store.clear();
        return { count };
      }

      const records = Array.from(store.values());
      for (const record of records) {
        if (matchWhere(record, args.where)) {
          store.delete(record.id);
          count++;
        }
      }

      return { count };
    },

    async count(args?: { where?: any }) {
      if (!args?.where) return store.size;
      const records = Array.from(store.values());
      return records.filter(r => matchWhere(r, args.where)).length;
    },

    async aggregate(args: { where?: any; _count?: any; _sum?: any; _avg?: any; _min?: any; _max?: any }) {
      const records = args.where
        ? Array.from(store.values()).filter(r => matchWhere(r, args.where))
        : Array.from(store.values());

      const result: any = {};

      if (args._count) {
        result._count = { _all: records.length };
      }

      return result;
    },

    async groupBy(args: { by: string[]; where?: any; _count?: any; _sum?: any }) {
      return [];
    }
  };
}

export class PrismaClient extends EventEmitter {
  // Model delegates
  user = createModelDelegate('user');
  document = createModelDelegate('document');
  template = createModelDelegate('template');
  profile = createModelDelegate('profile');
  profileData = createModelDelegate('profileData');
  formFillHistory = createModelDelegate('formFillHistory');
  dataField = createModelDelegate('dataField');
  job = createModelDelegate('job');
  auditLog = createModelDelegate('auditLog');

  private _connected: boolean = false;

  constructor(options?: any) {
    super();
  }

  async $connect(): Promise<void> {
    this._connected = true;
  }

  async $disconnect(): Promise<void> {
    this._connected = false;
  }

  async $executeRaw(query: any, ...values: any[]): Promise<number> {
    return 0;
  }

  async $executeRawUnsafe(query: string, ...values: any[]): Promise<number> {
    return 0;
  }

  async $queryRaw(query: any, ...values: any[]): Promise<any[]> {
    return [];
  }

  async $queryRawUnsafe(query: string, ...values: any[]): Promise<any[]> {
    return [];
  }

  async $transaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T>;
  async $transaction<T>(operations: Promise<T>[]): Promise<T[]>;
  async $transaction<T>(arg: ((prisma: PrismaClient) => Promise<T>) | Promise<T>[]): Promise<T | T[]> {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return arg(this);
  }

  $on(event: string, callback: Function): void {
    this.on(event, callback as any);
  }

  $use(middleware: (params: any, next: any) => any): void {
    // Middleware support - no-op for tests
  }

  // Helper methods for testing
  static _resetAllStores(): void {
    Object.values(dataStores).forEach(store => store.clear());
    idCounter = 1;
  }

  static _getStore(modelName: string): Map<string, any> {
    return dataStores[modelName];
  }
}

// Export Prisma error types for tests
export class PrismaClientKnownRequestError extends Error {
  code: string;
  meta?: Record<string, any>;
  clientVersion: string;

  constructor(message: string, { code, meta, clientVersion }: { code: string; meta?: Record<string, any>; clientVersion: string }) {
    super(message);
    this.code = code;
    this.meta = meta;
    this.clientVersion = clientVersion;
    this.name = 'PrismaClientKnownRequestError';
  }
}

export class PrismaClientUnknownRequestError extends Error {
  clientVersion: string;

  constructor(message: string, { clientVersion }: { clientVersion: string }) {
    super(message);
    this.clientVersion = clientVersion;
    this.name = 'PrismaClientUnknownRequestError';
  }
}

export class PrismaClientInitializationError extends Error {
  clientVersion: string;

  constructor(message: string, clientVersion: string) {
    super(message);
    this.clientVersion = clientVersion;
    this.name = 'PrismaClientInitializationError';
  }
}

export class PrismaClientValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrismaClientValidationError';
  }
}

// Export Prisma namespace for enums
export namespace Prisma {
  export const TransactionIsolationLevel = {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export const SortOrder = {
    asc: 'asc',
    desc: 'desc'
  };

  export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
  export type JsonObject = { [key: string]: JsonValue };
  export type JsonArray = JsonValue[];
}

export default { PrismaClient, Prisma };
