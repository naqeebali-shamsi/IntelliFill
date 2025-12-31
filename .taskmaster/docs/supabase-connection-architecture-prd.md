# Supabase Connection Architecture Improvements PRD

## Executive Summary

Address critical architectural issues in the IntelliFill Supabase connection layer to eliminate connection pool exhaustion, ensure consistent security enforcement, improve resilience, and establish proper middleware registration. These improvements will prevent production outages, enhance security posture, and reduce technical debt.

---

## Problem Statement

### Current Situation

The IntelliFill backend has a well-designed Supabase authentication architecture with dual clients, keepalive mechanisms, and comprehensive middleware. However, a specialist review identified **15 issues** across connection management, security enforcement, and resilience that pose production risks.

### User Impact

- **Developers**: Intermittent connection failures during high-load testing
- **End Users**: Potential authentication failures during Supabase outages
- **Security Teams**: Inconsistent audit logging and RLS enforcement gaps

### Business Impact

- **Reliability Risk**: Connection pool exhaustion can cause complete API unavailability
- **Compliance Risk**: Audit middleware not globally applied; gaps in PIPEDA compliance
- **Security Risk**: Silent RLS failures could allow cross-tenant data access
- **Operational Risk**: 100% dependency on Supabase with no fallback

### Why Solve This Now

- Production deployment imminent
- Issues identified during architecture review before they cause incidents
- Fixes are architectural - easier to implement before production traffic

---

## Goals & Success Metrics

| Goal                                 | Metric                          | Baseline              | Target       | Timeframe |
| ------------------------------------ | ------------------------------- | --------------------- | ------------ | --------- |
| Eliminate connection pool exhaustion | Connection errors per day       | Unknown (unmonitored) | 0            | Immediate |
| Ensure 100% audit coverage           | Endpoints with audit middleware | ~30%                  | 100%         | 1 week    |
| Improve Supabase resilience          | Mean time to detect outage      | N/A                   | < 30 seconds | 1 week    |
| Enforce consistent RLS               | RLS context failures logged     | 0 (silent)            | 100% logged  | 3 days    |
| Standardize Prisma usage             | Files with per-request clients  | 3+ files              | 0 files      | 3 days    |

---

## User Stories

### US-1: As a backend developer, I want consistent Prisma client usage across all routes

**Acceptance Criteria:**

- All routes import Prisma from `utils/prisma.ts` singleton
- No `new PrismaClient()` instantiation in route files
- Connection pool metrics visible in health endpoint
- Clear documentation on correct Prisma usage

### US-2: As an operations engineer, I want all API requests to be audit logged

**Acceptance Criteria:**

- Audit middleware registered globally in `index.ts`
- Configurable path exclusions for health/metrics endpoints
- Audit logs capture: userId, action, timestamp, request metadata
- Anomaly detection active for all authenticated requests

### US-3: As a security engineer, I want RLS context failures to be visible and actionable

**Acceptance Criteria:**

- RLS `set_user_context()` failures logged with ERROR level
- Failed RLS setup returns 500 in production (not silent continue)
- Metrics endpoint exposes RLS failure count
- Alert triggers when RLS failures exceed threshold

### US-4: As a platform engineer, I want graceful degradation when Supabase is unavailable

**Acceptance Criteria:**

- Circuit breaker implemented for Supabase token verification
- Cached token validation available during Supabase outage (configurable TTL)
- Health endpoint reports Supabase connectivity status
- Clear error messages distinguish Supabase unavailability from auth failures

### US-5: As a developer, I want organization isolation enforced consistently

**Acceptance Criteria:**

- Middleware extracts and validates organizationId from user profile
- All org-scoped endpoints verify user belongs to requested org
- Cross-tenant access attempts logged as security events
- Rate limiting keys normalized to use consistent org identification

---

## Functional Requirements

### REQ-001: Prisma Singleton Enforcement (Must Have)

Replace all per-request `new PrismaClient()` instantiation with singleton import.

**Implementation Hints:**

- Search for `new PrismaClient()` across codebase
- Replace with `import { prisma } from '../utils/prisma'`
- Files to check: `knowledge.routes.ts`, `IntelliFillService.ts`, route files
- Add ESLint rule to prevent future violations

### REQ-002: Global Audit Middleware Registration (Must Have)

Register audit middleware globally in Express application setup.

**Implementation Hints:**

- Add `app.use(createAuditMiddleware({...}))` in `index.ts`
- Configure: `excludePaths: ['/health', '/metrics', '/api/docs']`
- Enable: `includeRequestBody: true` for write operations
- Position: After body parser, before route handlers

### REQ-003: RLS Context Error Handling (Must Have)

Make RLS context setting failures visible and actionable.

**Implementation Hints:**

- In `supabaseAuth.ts`, change `console.warn` to `console.error` for RLS failures
- Add metrics counter for RLS failures
- In production: return 500 status on RLS failure (configurable)
- Add `req.rlsContextSet: boolean` flag for downstream verification

### REQ-004: Circuit Breaker for Supabase (Should Have)

Implement circuit breaker pattern for Supabase authentication calls.

**Implementation Hints:**

- Use `opossum` npm package for circuit breaker
- Wrap `supabaseAdmin.auth.getUser()` call
- Configure: timeout 5s, errorThreshold 50%, resetTimeout 30s
- Fallback: Return cached user data or specific error code

### REQ-005: Token Caching Layer (Should Have)

Cache validated tokens to reduce Supabase calls and enable graceful degradation.

**Implementation Hints:**

- Cache key: SHA256 hash of JWT (not full token)
- Cache value: verified user object + timestamp
- TTL: 5 minutes (configurable via env)
- Storage: Redis (with in-memory fallback)
- Invalidate on logout

### REQ-006: Organization Context Middleware (Should Have)

Create dedicated middleware for organization context extraction and validation.

**Implementation Hints:**

- Extract `organizationId` from `req.user.organizationId`
- Validate user membership in requested organization
- Set `req.organizationId` for downstream use
- Log cross-tenant access attempts as security events

### REQ-007: Health Endpoint Enhancements (Should Have)

Expose connection health metrics for monitoring.

**Implementation Hints:**

- Add `/health/detailed` endpoint with:
  - `supabase.connected: boolean`
  - `prisma.poolStats: { active, idle, waiting }`
  - `redis.connected: boolean`
  - `rlsFailures.last5min: number`
- Protected by admin authentication

### REQ-008: Rate Limiter Key Normalization (Could Have)

Standardize rate limiter key generation across all limiters.

**Implementation Hints:**

- Create shared `generateRateLimitKey(req, scope)` function
- Scopes: 'user', 'org', 'ip'
- Validate required fields exist before key generation
- Log when falling back to IP-based limiting

---

## Non-Functional Requirements

### Performance

- Token cache lookup: < 1ms p99
- Circuit breaker overhead: < 5ms per request
- Audit logging: Async, non-blocking (< 1ms added latency)

### Security

- Token cache: Store only hash of JWT, not full token
- Audit logs: Sanitize PII before persistence
- Circuit breaker: Never bypass authentication entirely

### Reliability

- Circuit breaker: 99.9% availability during Supabase partial outages
- Cache: Graceful fallback to live verification if cache unavailable
- Prisma: Connection pool never exhausted under 1000 concurrent requests

### Observability

- Metrics: Connection pool size, cache hit rate, circuit breaker state
- Alerts: RLS failures, circuit breaker open, pool exhaustion
- Logs: Structured JSON for all security-relevant events

---

## Technical Considerations

### Architecture Changes

```
Current Flow:
Request → Rate Limit → Auth Middleware → Route Handler → Database

Proposed Flow:
Request → Rate Limit → Audit MW → Auth MW → Org Context MW → Route Handler → Database
                          ↓            ↓
                    Audit Log     Circuit Breaker
                                       ↓
                                 Token Cache → Supabase
```

### Dependencies

- `opossum@8.x` - Circuit breaker library (new)
- Existing: Redis (for token cache)
- Existing: Prisma singleton

### Database Changes

None required. Uses existing audit log table.

### Migration Strategy

1. Add new middleware without removing existing code
2. Deploy with feature flags for circuit breaker
3. Monitor for 48 hours
4. Enable circuit breaker in production
5. Remove legacy code paths

### Testing Strategy

- Unit tests: Circuit breaker state transitions
- Integration tests: Token cache hit/miss scenarios
- Load tests: Verify no pool exhaustion at 1000 concurrent
- Chaos tests: Simulate Supabase unavailability

---

## Implementation Roadmap

### Phase 1: Critical Fixes (Days 1-2)

- REQ-001: Prisma singleton enforcement
- REQ-003: RLS context error handling
- REQ-002: Global audit middleware

### Phase 2: Resilience (Days 3-4)

- REQ-004: Circuit breaker implementation
- REQ-005: Token caching layer

### Phase 3: Consistency (Days 5-6)

- REQ-006: Organization context middleware
- REQ-007: Health endpoint enhancements
- REQ-008: Rate limiter normalization

---

## Out of Scope

- **Supabase migration**: Not replacing Supabase, only improving resilience
- **Multi-region**: Geographic redundancy is future work
- **Token rotation**: Refresh token rotation strategy is separate initiative
- **Frontend changes**: All changes are backend-only
- **New authentication methods**: OAuth, SSO additions are separate

---

## Open Questions & Risks

### Open Questions

1. **Cache TTL**: Should token cache TTL be 5 minutes or configurable per environment?
   - **Recommendation**: Configurable via `TOKEN_CACHE_TTL_SECONDS` env var

2. **Circuit breaker fallback**: Should we allow cached auth during Supabase outage or fail closed?
   - **Recommendation**: Configurable - fail closed by default, allow cached in emergencies

3. **Audit retention**: How long to retain detailed audit logs?
   - **Recommendation**: Follow existing data classification (5-7 years for auth events)

### Risks

| Risk                                   | Likelihood | Impact | Mitigation                                       |
| -------------------------------------- | ---------- | ------ | ------------------------------------------------ |
| Token cache introduces auth bypass     | Low        | High   | Cache hash only, short TTL, invalidate on logout |
| Circuit breaker opens too aggressively | Medium     | Medium | Tune thresholds, monitor in staging first        |
| Audit middleware adds latency          | Low        | Low    | Async logging, batch writes                      |
| Prisma singleton changes break tests   | Medium     | Low    | Update test fixtures, use transaction isolation  |

---

## Validation Checkpoints

### Checkpoint 1: After Phase 1

- [ ] All Prisma singleton violations fixed
- [ ] RLS failures visible in logs
- [ ] Audit middleware capturing all endpoints

### Checkpoint 2: After Phase 2

- [ ] Circuit breaker tested with Supabase unavailability simulation
- [ ] Token cache reducing Supabase calls by >50%
- [ ] No authentication bypasses possible

### Checkpoint 3: After Phase 3

- [ ] Organization isolation enforced on all org-scoped routes
- [ ] Health endpoint exposing all connection metrics
- [ ] Rate limiters using consistent key generation

---

## Appendix: Files to Modify

| File                                           | Changes                            |
| ---------------------------------------------- | ---------------------------------- |
| `quikadmin/src/utils/prisma.ts`                | Add pool stats export              |
| `quikadmin/src/utils/supabase.ts`              | Add circuit breaker, token cache   |
| `quikadmin/src/middleware/supabaseAuth.ts`     | RLS error handling, org context    |
| `quikadmin/src/middleware/rateLimiter.ts`      | Normalize key generation           |
| `quikadmin/src/middleware/auditLogger.ts`      | Ensure global registration         |
| `quikadmin/src/index.ts`                       | Register audit middleware globally |
| `quikadmin/src/api/knowledge.routes.ts`        | Fix Prisma singleton usage         |
| `quikadmin/src/api/health.routes.ts`           | Add detailed health metrics        |
| `quikadmin/src/services/IntelliFillService.ts` | Fix Prisma singleton usage         |

---

## References

- [Supabase Auth Best Practices](https://supabase.com/docs/guides/auth/server-side)
- [Node.js Circuit Breaker Pattern](https://github.com/nodeshift/opossum)
- [Prisma Connection Pooling](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
