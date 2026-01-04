# Security Tests

Integration tests for security middleware: rate limiting, CSRF protection, and authentication.

## Prerequisites

- Docker (for Redis)

## Quick Start

```bash
# 1. Start Redis (first time or after reboot)
npm run test:security:setup

# 2. Run security tests
npm run test:security:local

# 3. (Optional) Stop Redis when done
npm run test:security:down
```

## What's Tested

### Rate Limiting (`rate-limit.test.ts`)

| Endpoint       | Limit        | Window     |
| -------------- | ------------ | ---------- |
| General API    | 100 requests | 1 minute   |
| Auth endpoints | 5 attempts   | 15 minutes |
| File uploads   | 10 uploads   | 1 hour     |

### CSRF Protection (`csrf.test.ts`)

- Token generation and validation
- Double-submit cookie pattern
- Header vs body token submission
- JWT authentication bypass
- Safe method (GET/HEAD/OPTIONS) exemptions

## Redis Requirement

These tests require Redis on port **6380** (not 6379) to avoid conflicts with development Redis.

The `docker-compose.test.yml` provides an isolated Redis instance:

```yaml
redis-test:
  image: redis:7-alpine
  ports:
    - '6380:6379'
```

## Troubleshooting

### "Redis not running on port 6380"

```bash
npm run test:security:setup
```

### Docker not available

Install Docker Desktop: https://docker.com/get-started

### Tests hang or timeout

Check Redis is healthy:

```bash
docker-compose -f docker-compose.test.yml logs redis-test
```

Restart Redis:

```bash
npm run test:security:down
npm run test:security:setup
```

## Adding New Security Tests

1. Create test file in `tests/security/`
2. Use `beforeAll` to connect to Redis
3. Use `afterEach` to call `flushAll()` for isolation
4. See existing tests for patterns
