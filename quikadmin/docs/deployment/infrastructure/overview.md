# Infrastructure Configuration

**Single source of truth for QuikAdmin infrastructure decisions and configurations.**

---

## Quick Reference

| Component | Technology | Configuration File | Status |
|-----------|-----------|-------------------|---------|
| **Database** | Neon PostgreSQL | `.env` (DATABASE_URL) | Active |
| **Database Driver** | pg (standard) / @neondatabase/serverless | `src/services/NeonService.ts` | Active |
| **Cache/Queue** | Redis | `.env` (REDIS_*) | Active |
| **Connection Pooling** | pg Pool | Environment variables | Active |
| **Authentication** | Custom JWT (migrating to Supabase) | `src/services/PrismaAuthService.ts` | In transition |

---

## Database Configuration

### Connection String

**Location:** `.env` file
```bash
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
```

**Get your connection string:** [Neon Console](https://console.neon.tech/)

### Connection Pool Settings

| Variable | Default | Range | Purpose |
|----------|---------|-------|---------|
| `DB_POOL_MIN` | 2 | 1-10 | Minimum idle connections |
| `DB_POOL_MAX` | 10 | 5-100 | Maximum active connections |
| `DB_IDLE_TIMEOUT_MS` | 30000 | 10000-60000 | Idle connection timeout |
| `DB_CONNECTION_TIMEOUT_MS` | 10000 | 5000-30000 | New connection timeout |

**Tuning Guidelines:**
- **Low traffic (<10 RPS):** MIN=2, MAX=5
- **Medium traffic (10-100 RPS):** MIN=5, MAX=10
- **High traffic (>100 RPS):** MIN=10, MAX=20

**Implementation:** `src/services/NeonService.ts` (lines 30-36)

---

## Database Drivers: Standard vs Serverless

QuikAdmin supports two database drivers for different deployment environments.

### Standard Driver (Default)

**Package:** `pg` v8.11.3
**Protocol:** PostgreSQL Wire (TCP)
**File:** `src/services/NeonService.ts` (280 LOC)

**Use when:**
- Running on traditional Node.js servers
- High-throughput applications (>100 RPS)
- Need connection pooling
- Require RLS (Row-Level Security)
- Need business logic methods

**Benefits:**
- Connection pooling (lower per-request latency: 10-50ms)
- Full feature set (RLS, monitoring, business methods)
- Works with any PostgreSQL provider

**Configuration:**
```bash
# .env (default behavior)
USE_NEON_SERVERLESS=false
```

### Serverless Driver (Optional)

**Package:** `@neondatabase/serverless` v1.0.2
**Protocol:** HTTP/Fetch API
**File:** `src/services/NeonServerlessService.ts` (48 LOC)

**Use when:**
- Deploying to serverless functions (AWS Lambda, Vercel Functions)
- Running in edge runtimes (Cloudflare Workers, Vercel Edge)
- Cold start optimization is critical
- Simple CRUD operations only

**Benefits:**
- Faster cold starts (200ms vs 500ms)
- No connection pool management
- Works in edge runtimes (fetch API)
- Minimal code footprint

**Configuration:**
```bash
# .env (optional)
USE_NEON_SERVERLESS=true
```

**Detailed comparison:** See [neon-serverless.md](./neon-serverless.md)

---

## Redis Configuration

### Standard Redis (Default)

**Location:** `.env` file
```bash
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=                # Optional: set for production
```

**Used for:**
- Job queues (document processing with Bull)
- Rate limiting (request throttling)
- Session caching (JWT token caching planned)

**Implementation:**
- Queue: `src/services/documentQueue.ts`
- Rate limiting: Middleware (planned Phase 4.2)

### Redis Sentinel (High Availability)

**Purpose:** Automatic failover for production environments

**Configuration:**
```bash
REDIS_SENTINEL_ENABLED=true
REDIS_SENTINEL_HOSTS=sentinel1:26379,sentinel2:26379,sentinel3:26379
REDIS_SENTINEL_MASTER_NAME=mymaster
```

**When to enable:**
- Production deployments requiring 99.9%+ uptime
- Multi-region deployments
- High-availability requirements

**Setup:** Sentinel configuration is parsed but not yet enforced in code (TODO: Phase 4.2)

---

## Health Checks

### Database Health Check

**Endpoint:** `GET /api/health/db`

**Implementation:**
```typescript
// src/services/NeonService.ts
async testConnection(): Promise<boolean> {
  const result = await this.query('SELECT 1 as test');
  return result.rows[0].test === 1;
}
```

**Monitoring:** Check this endpoint for database connectivity status.

### Redis Health Check

**Implementation:** TODO (Phase 4.2 - Add Redis health endpoint)

**Planned:** `GET /api/health/redis`

---

## Environment Variables Reference

### Required Variables

**The application will fail to start if these are missing or invalid:**

| Variable | Validation | Example |
|----------|-----------|---------|
| `DATABASE_URL` | Must start with `postgresql://` | `postgresql://user:pass@host/db` |
| `JWT_SECRET` | 64+ characters, 256+ bits entropy | `(64-char base64 string)` |
| `JWT_REFRESH_SECRET` | 64+ characters, 256+ bits entropy | `(64-char base64 string)` |
| `JWT_ISSUER` | Non-empty string | `intellifill` |
| `JWT_AUDIENCE` | Non-empty string | `intellifill-api` |
| `REDIS_URL` | Valid Redis connection string | `redis://localhost:6379` |

**Validation:** `src/middleware/validateEnvironment.ts` (runs on startup)

### Optional Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `USE_NEON_SERVERLESS` | `false` | Switch to serverless driver |
| `REDIS_PASSWORD` | `""` | Redis authentication |
| `REDIS_SENTINEL_ENABLED` | `false` | Enable Redis Sentinel HA |
| `DB_POOL_MIN` | `2` | Minimum DB connections |
| `DB_POOL_MAX` | `10` | Maximum DB connections |

**Generate secure secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

---

## Design Decisions

### 1. Why Two Database Drivers?

**Decision:** Support both standard (`pg`) and serverless (`@neondatabase/serverless`) drivers.

**Rationale:**
- Standard driver optimized for traditional servers (connection pooling)
- Serverless driver optimized for edge/serverless (fast cold starts)
- Coexist side-by-side without breaking existing code

**Trade-off:** Added 48 LOC and one dependency, but enables edge deployment.

**Date:** 2025-11-02 (Phase 4.1)

### 2. Why Connection Pooling Configuration?

**Decision:** Expose `DB_POOL_MIN`, `DB_POOL_MAX`, `DB_IDLE_TIMEOUT_MS`, `DB_CONNECTION_TIMEOUT_MS`.

**Rationale:**
- Different deployment sizes need different pool settings
- Prevents connection exhaustion under load
- Allows tuning for cost optimization (Neon charges per connection)

**Trade-off:** More configuration complexity, but better control.

**Date:** 2025-10-20 (Phase 3)

### 3. Why Redis Sentinel Support?

**Decision:** Add Sentinel configuration (not enforced yet).

**Rationale:**
- Prepare infrastructure for production HA requirements
- Document configuration pattern before implementation
- Enable gradual migration to HA setup

**Trade-off:** Configuration exists but not used yet (TODO: Phase 4.2).

**Date:** 2025-10-25 (Planning)

### 4. Why Custom JWT (for now)?

**Decision:** Keep custom JWT implementation while preparing Supabase migration.

**Rationale:**
- Supabase migration is Phase 4 priority (planned)
- Current JWT hardened with Phase 0 security fixes
- Gradual migration reduces risk

**Trade-off:** Maintaining 428 LOC of auth code temporarily.

**Status:** Transitioning to Supabase Auth (Phase 4)
**Timeline:** 4-6 weeks

---

## Monitoring & Observability

### Database Metrics

**Available via NeonService:**
```typescript
const db = new NeonService();
const metrics = db.getPoolMetrics();

console.log({
  totalConnections: metrics.totalCount,
  idleConnections: metrics.idleCount,
  waitingClients: metrics.waitingCount
});
```

**Planned:** Prometheus metrics endpoint (Phase 4.3)

### Redis Metrics

**TODO:** Implement Redis monitoring (Phase 4.2)
- Connection status
- Queue lengths
- Memory usage

---

## Migration Guides

### Switching to Serverless Driver

**Step 1:** Update `.env`
```bash
USE_NEON_SERVERLESS=true
```

**Step 2:** Update imports (if manual selection)
```typescript
// Before
import { NeonService } from './services/NeonService';

// After
import { NeonServerlessService } from './services/NeonServerlessService';
```

**Step 3:** Test
```bash
npm run test:neon-serverless
```

**Limitations:**
- No RLS support (not implemented)
- No business logic methods (minimal API)
- Higher per-request latency (HTTP overhead)

### Enabling Redis Sentinel

**Step 1:** Update `.env`
```bash
REDIS_SENTINEL_ENABLED=true
REDIS_SENTINEL_HOSTS=sentinel1:26379,sentinel2:26379,sentinel3:26379
REDIS_SENTINEL_MASTER_NAME=mymaster
```

**Step 2:** Verify Sentinel setup
```bash
redis-cli -h sentinel1 -p 26379 SENTINEL masters
```

**Status:** Configuration parsing implemented, enforcement TODO (Phase 4.2)

---

## Troubleshooting

### Database Connection Failures

**Symptom:** Application fails to start with "database connection error"

**Checks:**
1. Verify `DATABASE_URL` is set correctly in `.env`
2. Test connection from command line:
   ```bash
   psql "postgresql://user:pass@host/db"
   ```
3. Check Neon dashboard for database status
4. Verify SSL is enabled: `?sslmode=require` in connection string

**Solution:** Update connection string or check Neon service status.

### Redis Connection Failures

**Symptom:** Queue operations fail with "Redis connection error"

**Checks:**
1. Verify Redis is running: `redis-cli ping` (should return `PONG`)
2. Check `REDIS_URL` in `.env`
3. Verify port 6379 is not blocked by firewall
4. Check Redis password if set

**Solution:** Start Redis service or update connection string.

### Pool Exhaustion

**Symptom:** "TimeoutError: Connection pool exhausted"

**Checks:**
1. Check current pool settings: `DB_POOL_MAX`
2. Monitor active connections: `db.getPoolMetrics()`
3. Check for connection leaks (queries not closed)

**Solution:** Increase `DB_POOL_MAX` or fix connection leaks in code.

---

## Performance Tuning

### Database Query Optimization

**Slow queries:**
1. Add indexes to frequently queried columns
2. Use `EXPLAIN ANALYZE` to identify bottlenecks
3. Consider materialized views for complex queries

**Implementation:** `prisma/schema.prisma` (add `@@index` directives)

### Connection Pool Sizing

**Formula:** `DB_POOL_MAX = (core_count * 2) + effective_spindle_count`

**For Neon (serverless):** Start with MAX=10, increase if seeing pool exhaustion.

**For high traffic:** Use read replicas and split read/write pools.

---

## Security Considerations

### Database Connection Security

- Always use `sslmode=require` in connection string
- Store `DATABASE_URL` in environment variables (never in code)
- Rotate database passwords quarterly
- Use least-privilege database users (not superuser)

**Implementation:** Environment validation enforces SSL requirement.

### Redis Security

- Set `REDIS_PASSWORD` in production
- Use Redis ACLs to restrict command access
- Enable TLS for Redis connections in production
- Isolate Redis from public internet

**Status:** Password optional (TODO: enforce in production)

---

## Related Documentation

- **[Neon Serverless Driver Details](./neon-serverless.md)** - Deep dive on serverless driver
- **[Security Architecture](../200-architecture/204-security-architecture.md)** - Authentication & security
- **[API Documentation](../300-api/README.md)** - API endpoints and usage
- **[Troubleshooting Guide](../400-guides/407-troubleshooting.md)** - Common issues

---

## Change Log

### 2025-11-02 - Infrastructure Consolidation
- Created consolidated infrastructure documentation
- Documented both database drivers (standard and serverless)
- Added Redis and connection pool configuration reference
- Documented design decisions and rationale
- Added troubleshooting and performance tuning sections

### 2025-11-02 - Phase 4.1: Neon Serverless Support
- Installed `@neondatabase/serverless` v1.0.2
- Created `NeonServerlessService.ts` (48 LOC)
- Added `USE_NEON_SERVERLESS` environment variable
- Both drivers coexist side-by-side

### 2025-10-20 - Phase 3: Connection Pooling
- Added configurable connection pool settings
- Exposed DB_POOL_MIN, DB_POOL_MAX, timeouts
- Implemented pool metrics monitoring

---

**Last Updated:** 2025-11-02
**Maintained By:** Development Team
**Status:** Active - Single source of truth for infrastructure
