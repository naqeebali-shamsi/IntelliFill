# Neon Serverless Driver

**Quick reference for using the Neon Serverless driver in edge/serverless environments.**

---

## Quick Comparison

| Aspect               | Standard (NeonService)    | Serverless (NeonServerlessService) |
| -------------------- | ------------------------- | ---------------------------------- |
| **Package**          | `pg` v8.11.3              | `@neondatabase/serverless` v1.0.2  |
| **Protocol**         | TCP (PostgreSQL Wire)     | HTTP (Fetch API)                   |
| **Connection Model** | Pooled (2-10 connections) | Stateless (no pooling)             |
| **Cold Start**       | ~500ms                    | ~200ms                             |
| **Request Latency**  | 10-50ms                   | 30-100ms                           |
| **Code Size**        | 280 LOC                   | 48 LOC                             |
| **Best For**         | Traditional servers       | Edge/Serverless functions          |
| **Edge Runtime**     | No                        | Yes                                |

---

## When to Use Serverless Driver

**Use this driver when:**

1. **Deploying to serverless functions:**
   - AWS Lambda
   - Vercel Functions
   - Azure Functions
   - Google Cloud Functions

2. **Running in edge runtimes:**
   - Cloudflare Workers
   - Vercel Edge Functions
   - Deno Deploy
   - Netlify Edge Functions

3. **Optimizing for cold starts:**
   - Infrequent requests (< 10 req/min)
   - Fast initialization is critical
   - No need for connection pooling

4. **Simple database operations:**
   - Basic CRUD queries
   - No RLS requirements
   - No advanced business logic

**Do NOT use when:**

- Running on traditional Node.js servers (use standard driver)
- Need connection pooling benefits (high throughput)
- Require RLS (Row-Level Security) support
- Need business logic methods (e.g., `createCompanyAndOwner()`)

---

## Usage

### Installation

**Already installed** (Phase 4.1):

```bash
npm install @neondatabase/serverless
```

### Basic Usage

```typescript
import { NeonServerlessService } from './services/NeonServerlessService';

// Initialize
const db = new NeonServerlessService();

// Basic query
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
console.log(result.rows);

// Test connection
const isConnected = await db.testConnection();
console.log('Connected:', isConnected);

// Close (no-op for serverless)
await db.close();
```

### Environment Configuration

**Same as standard driver:**

```bash
# .env
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require

# Optional: Flag for documentation purposes
USE_NEON_SERVERLESS=true
```

**Note:** The `USE_NEON_SERVERLESS` flag is not enforced. You switch drivers by changing imports in your code.

---

## API Reference

### Constructor

```typescript
new NeonServerlessService();
```

Initializes the serverless driver using `DATABASE_URL` from environment.

### Methods

#### `query(text: string, params?: any[]): Promise<QueryResult>`

Execute a SQL query with optional parameters.

**Example:**

```typescript
const result = await db.query('SELECT * FROM users WHERE email = $1', ['user@example.com']);
console.log(result.rows);
```

#### `testConnection(): Promise<boolean>`

Test database connection.

**Example:**

```typescript
const isConnected = await db.testConnection();
if (!isConnected) {
  console.error('Database connection failed');
}
```

#### `close(): Promise<void>`

Close connection (no-op for serverless, included for API compatibility).

**Example:**

```typescript
await db.close(); // Does nothing, but safe to call
```

---

## Limitations

**What's NOT implemented:**

1. **No RLS Support**
   - `setTenantContext()` method not available
   - Cannot set Row-Level Security context
   - Workaround: Use query-level filtering

2. **No Business Logic Methods**
   - `createCompanyAndOwner()` not available
   - `getUserByAuthId()` not available
   - Document management methods not available
   - Workaround: Implement in application layer

3. **No Connection Pooling**
   - Each query creates a new HTTP request
   - Higher per-request overhead
   - Workaround: Use for low-frequency operations

4. **No Pool Metrics**
   - `getPoolMetrics()` not available
   - No monitoring of connection health
   - Workaround: Use external monitoring

---

## Performance Characteristics

### Standard Driver Performance

```
Cold Start:         500-800ms  (pool initialization)
First Query:        50-100ms   (connection acquisition)
Subsequent Queries: 10-50ms    (connection reuse)
Throughput:         1000+ RPS  (pooling benefits)
```

### Serverless Driver Performance

```
Cold Start:         200-300ms  (no pool initialization)
First Query:        30-100ms   (HTTP request)
Subsequent Queries: 30-100ms   (HTTP per query)
Throughput:         100-500 RPS (HTTP overhead)
```

**Key Insight:** Serverless driver trades per-request performance for faster cold starts.

---

## Migration Guide

### From Standard to Serverless

**Step 1:** Update imports

```typescript
// Before
import { NeonService } from './services/NeonService';

// After
import { NeonServerlessService } from './services/NeonServerlessService';
```

**Step 2:** Update initialization

```typescript
// Before
const db = new NeonService();
await db.setTenantContext(companyId, userId); // RLS

// After
const db = new NeonServerlessService();
// Note: RLS not supported, use query-level filtering
```

**Step 3:** Update queries (compatible)

```typescript
// Query interface is the same
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
```

**Step 4:** Test

```bash
npm run test:neon-serverless
```

### From Serverless to Standard

Just reverse the process. If you need RLS, re-implement `setTenantContext()` calls.

---

## Testing

### Test Script

**Run the included test:**

```bash
npm run test:neon-serverless
```

**Expected output:**

```
=== Neon Serverless Driver Test ===
1. Initializing Neon Serverless driver...
   ✅ Driver initialized
2. Testing database connection...
   ✅ Connection test successful
3. Testing basic query...
   ✅ Query successful
4. Testing parameterized query...
   ✅ Parameterized query successful
5. Closing connection...
   ✅ Close called
=== All Tests Passed ===
```

### Manual Testing

```typescript
import { NeonServerlessService } from './services/NeonServerlessService';

async function testServerless() {
  const db = new NeonServerlessService();

  // Test query
  const result = await db.query('SELECT NOW() as timestamp');
  console.log('Timestamp:', result.rows[0].timestamp);

  // Test connection
  const connected = await db.testConnection();
  console.log('Connected:', connected);
}

testServerless();
```

---

## Edge Runtime Example

### Cloudflare Workers

```typescript
// worker.ts
import { NeonServerlessService } from './NeonServerlessService';

export default {
  async fetch(request: Request): Promise<Response> {
    const db = new NeonServerlessService();

    const result = await db.query('SELECT * FROM users LIMIT 10');

    return new Response(JSON.stringify(result.rows), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
```

### Vercel Edge Functions

```typescript
// api/users.ts
import { NeonServerlessService } from '@/services/NeonServerlessService';

export const config = { runtime: 'edge' };

export default async function handler(request: Request) {
  const db = new NeonServerlessService();

  const result = await db.query('SELECT * FROM users WHERE active = true');

  return new Response(JSON.stringify(result.rows), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

---

## Troubleshooting

### Error: "DATABASE_URL not found"

**Cause:** Environment variable not set.

**Solution:**

```bash
# .env
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
```

### Error: "Fetch is not defined"

**Cause:** Running in Node.js environment without fetch polyfill.

**Solution:** Use Node.js 18+ (has built-in fetch) or use standard driver for Node.js environments.

### Slow Query Performance

**Cause:** HTTP overhead on every query.

**Solution:**

- For traditional servers: Use standard driver with connection pooling
- For edge: Consider query batching or caching frequently accessed data

---

## Best Practices

1. **Use for Edge/Serverless Only**
   - Don't use on traditional servers (standard driver is better)
   - Designed for environments without TCP support

2. **Keep Queries Simple**
   - Avoid complex joins or long-running queries
   - HTTP timeout may terminate long queries

3. **Implement Caching**
   - Cache frequently accessed data at edge
   - Reduce database roundtrips

4. **Monitor Cold Starts**
   - Track cold start times in production
   - Optimize bundle size to improve startup

---

## References

- **[Neon Serverless Driver Docs](https://neon.tech/docs/serverless/serverless-driver)** - Official documentation
- **[When to Use Guide](https://neon.tech/docs/serverless/serverless-driver#when-to-use)** - Decision matrix
- **[Vercel Integration](https://neon.tech/docs/guides/vercel)** - Vercel Edge setup
- **[Cloudflare Workers](https://neon.tech/docs/guides/cloudflare-workers)** - Cloudflare setup

---

## Change Log

### 2025-11-02 - Documentation Consolidation

- Moved from `docs/NEON_SERVERLESS.md` to `docs/infrastructure/neon-serverless.md`
- Refactored to focus on practical usage
- Removed redundant comparison details (see infrastructure/README.md)
- Added edge runtime examples
- Added best practices section

### 2025-11-02 - Phase 4.1: Initial Implementation

- Installed `@neondatabase/serverless` v1.0.2
- Created `NeonServerlessService.ts` (48 LOC)
- Added test script
- Verified TypeScript compilation

---

**Last Updated:** 2025-11-02
**File:** `src/services/NeonServerlessService.ts` (48 lines)
**Status:** Active - Optional alternative to standard driver
