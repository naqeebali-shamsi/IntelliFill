# IntelliFill E2E Test Suite

End-to-end tests for IntelliFill using Playwright in Docker containers.

## Overview

This E2E test infrastructure provides:

- **Complete isolation**: Separate PostgreSQL, Redis, backend, and frontend containers
- **Automatic setup**: Database initialization with test data
- **Parallel execution**: Run tests across multiple workers and browsers
- **Full browser coverage**: Chromium, Firefox, and WebKit
- **Zero persistence**: Everything resets between test runs

## Quick Start

### 🚀 Automated Testing (ZERO Manual Steps)

**The easiest way** - Single command does everything:

```bash
cd e2e
npm run test:e2e:auto
```

**What it does automatically:**

1. ✅ Seeds test database with E2E users
2. ✅ Starts backend service (port 3002)
3. ✅ Starts frontend service (port 8080)
4. ✅ Waits for both services to be ready
5. ✅ Runs all Playwright E2E tests
6. ✅ Cleans up (kills processes)

**Requirements:**

- Backend dependencies installed (`cd quikadmin && npm install`)
- Frontend dependencies installed (`cd quikadmin-web && bun install`)
- Playwright browsers installed (`cd e2e && npx playwright install chromium`)

**Debug mode:**

```bash
DEBUG=true npm run test:e2e:auto
```

---

### Run Tests in Docker

```bash
# From project root
docker-compose -f docker-compose.e2e.yml up --build --abort-on-container-exit

# Clean up after tests
docker-compose -f docker-compose.e2e.yml down -v
```

---

### Manual Local Testing (Advanced)

If you prefer manual control:

```bash
# 1. Seed test users
cd e2e
npm run seed:db

# 2. Start backend and frontend manually
cd quikadmin && npm run dev      # Terminal 1
cd quikadmin-web && bun run dev  # Terminal 2

# 3. Run E2E tests
cd e2e
npm run test:local

# Run specific test suites
npm run test:smoke   # Smoke tests only
npm run test:auth    # Auth tests only
npm run test:ui      # Interactive mode
```

### Run Tests in Docker

```bash
# Start test infrastructure (without Playwright)
docker-compose -f docker-compose.e2e.yml up postgres-test redis-test backend-test frontend-test -d

# In e2e directory
cd e2e
npm install
npx playwright install

# Run tests (uses Docker hostnames)
npm test

# Run with UI
npm run test:ui

# Run specific browser
npm run test:chrome
```

### Run Tests Against Production

```bash
# WARNING: Requires test users in production database
cd e2e
npm run test:production
```

## Architecture

### Services

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ postgres-test│  │  redis-test  │  │ backend-test │      │
│  │   (pgvector) │  │   (cache)    │  │  (API:3002)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                             │                                │
│                    ┌────────▼───────┐                       │
│                    │ frontend-test  │                       │
│                    │   (UI:8080)    │                       │
│                    └────────┬───────┘                       │
│                             │                                │
│                    ┌────────▼───────┐                       │
│                    │   playwright   │                       │
│                    │  (test runner) │                       │
│                    └────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

### Database Initialization

The `init-test-db.sql` script:

1. Enables pgvector extension
2. Creates all tables matching Prisma schema
3. Seeds test users, clients, and templates
4. Sets up proper indexes and constraints

### Test User Credentials

```javascript
// Regular user
email: test@intellifill.local
password: Test123!@#

// Admin user
email: admin@intellifill.local
password: Admin123!@#
```

## Project Structure

```
e2e/
├── tests/                      # Test files
│   ├── smoke.spec.ts           # Basic health checks
│   ├── auth.spec.ts            # Authentication flows
│   ├── document-upload.spec.ts # Document operations
│   └── mobile.spec.ts          # Mobile responsiveness
├── utils/                      # Helper utilities
│   ├── auth-helpers.ts         # Authentication helpers
│   └── test-helpers.ts         # General test utilities
├── fixtures/                   # Test data files
│   └── .gitkeep
├── docker/                     # Docker-specific files
│   └── init-test-db.sql        # Database initialization
├── Dockerfile                  # Playwright container
├── docker-compose.e2e.yml      # Full test infrastructure
├── playwright.config.ts        # Playwright configuration
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript config
└── .env.e2e                    # Environment variables
```

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { loginAsUser } from '../utils/auth-helpers';
import { TEST_USERS } from '../playwright.config';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await loginAsUser(page, TEST_USERS.user);
  });

  test('should do something', async ({ page }) => {
    // Arrange
    await page.goto('/feature');

    // Act
    await page.getByRole('button', { name: /action/i }).click();

    // Assert
    await expect(page.getByText(/success/i)).toBeVisible();
  });
});
```

### Using Helper Functions

```typescript
import { loginAsUser, logout } from '../utils/auth-helpers';
import { waitForApiResponse, fillForm } from '../utils/test-helpers';

test('complex workflow', async ({ page }) => {
  // Login
  await loginAsUser(page, TEST_USERS.user);

  // Fill form
  await fillForm(page, {
    name: 'John Doe',
    email: 'john@example.com',
  });

  // Wait for API
  await waitForApiResponse(page, /\/api\/documents/);

  // Logout
  await logout(page);
});
```

## Test Categories

### Smoke Tests

Basic health checks that verify:

- Services are running
- Pages load correctly
- API responds
- Authentication redirects work

### Authentication Tests

Comprehensive auth flow testing:

- Login with valid/invalid credentials
- Logout
- Session persistence
- Protected route access
- Registration

### Feature Tests

End-to-end feature testing:

- Document upload
- OCR processing
- Form filling
- Template management
- User profile

### Mobile Tests

Mobile responsiveness testing:

- Touch-friendly layouts
- Navigation on small screens
- No horizontal scroll
- Proper touch targets

Run mobile tests with:
\

## Configuration

### Environment Variables

Edit `e2e/.env.e2e` to customize:

```bash
# Service URLs
BASE_URL=http://frontend-test:8080
API_URL=http://backend-test:3002/api

# Test credentials
TEST_USER_EMAIL=test@intellifill.local
TEST_USER_PASSWORD=Test123!@#

# Execution settings
WORKERS=4
TEST_TIMEOUT=30000

# Artifacts
SCREENSHOT_ON_FAILURE=true
VIDEO_ON_FAILURE=true
TRACE_ON_FAILURE=true
```

### Playwright Config

Edit `e2e/playwright.config.ts` for:

- Browser configurations
- Timeouts
- Reporters
- Parallelization
- Viewport sizes

## Debugging

### View Test Report

```bash
# After tests complete
cd e2e
npm run report
```

### Run Tests in Headed Mode

```bash
# See browser UI during tests
npm run test:headed
```

### Debug Specific Test

```bash
# Interactive debugging
npm run test:debug -- tests/auth.spec.ts
```

### View Playwright UI

```bash
# Interactive test runner
npm run test:ui
```

### Access Test Artifacts

```bash
# Screenshots
ls e2e/screenshots/

# Videos
ls e2e/videos/

# HTML Report
open e2e/playwright-report/index.html
```

### Check Container Logs

```bash
# Backend logs
docker logs intellifill-backend-test

# Frontend logs
docker logs intellifill-frontend-test

# Playwright logs
docker logs intellifill-playwright

# Database logs
docker logs intellifill-postgres-test
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run E2E tests
        run: |
          docker-compose -f docker-compose.e2e.yml up --build --abort-on-container-exit

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: e2e/playwright-report/
```

## Troubleshooting

### Tests Fail to Start

```bash
# Check if services are healthy
docker-compose -f docker-compose.e2e.yml ps

# Check backend logs
docker logs intellifill-backend-test

# Restart services
docker-compose -f docker-compose.e2e.yml down -v
docker-compose -f docker-compose.e2e.yml up --build
```

### Database Connection Issues

```bash
# Verify database is ready
docker exec intellifill-postgres-test pg_isready -U intellifill_test

# Check if tables were created
docker exec -it intellifill-postgres-test psql -U intellifill_test -d intellifill_test -c "\dt"
```

### Frontend Not Accessible

```bash
# Check if frontend is running
curl http://localhost:8080

# Check frontend logs
docker logs intellifill-frontend-test

# Verify backend connection
docker exec intellifill-frontend-test wget -O- http://backend-test:3002/health
```

### Tests Time Out

- Increase timeouts in `playwright.config.ts`
- Check service health checks in `docker-compose.e2e.yml`
- Verify network connectivity between containers

## Performance Optimization

### Fast Feedback

```bash
# Run only smoke tests first
npm test -- tests/smoke.spec.ts

# Run with fewer workers
WORKERS=2 npm test
```

### Parallel Execution

```bash
# Max parallelization (4 workers per browser)
npm run test:parallel
```

### Browser Selection

```bash
# Test only in Chromium (fastest)
npm run test:chrome

# Skip WebKit (slowest)
npx playwright test --project=chromium --project=firefox
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Idempotency**: Tests should produce the same result on every run
3. **Speed**: Use parallel execution and optimize selectors
4. **Stability**: Use `waitFor` and proper assertions instead of fixed timeouts
5. **Readability**: Use descriptive test names and comments
6. **Maintainability**: Extract common patterns into helpers
7. **Clean Up**: Always clean up resources (use `test.afterEach`)

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)

## Support

For issues or questions:

1. Check container logs
2. Review test output
3. Consult this README
4. Open an issue with logs and reproduction steps
