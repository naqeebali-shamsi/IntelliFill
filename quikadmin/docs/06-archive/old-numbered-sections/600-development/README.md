# Development Guide

**Section Number:** 600
**Purpose:** Developer workflows, testing, and contribution guidelines
**Last Updated:** 2025-01-10

---

## Overview

This section contains documentation for developers working on QuikAdmin, including local development setup, testing strategies, git workflow, and code style guidelines.

## Documents in This Section

| Document | Description | Difficulty | Status |
|----------|-------------|------------|--------|
| Coming soon | Local development setup | Intermediate | 📋 Planned |
| Coming soon | Testing guide (Jest, Puppeteer, Cypress) | Intermediate | 📋 Planned |
| Coming soon | Git workflow and branching | Beginner | 📋 Planned |
| Coming soon | Code style and conventions | Beginner | 📋 Planned |
| Coming soon | CI/CD pipeline | Advanced | 📋 Planned |
| Coming soon | Debugging techniques | Intermediate | 📋 Planned |

## Quick Start

### Development Environment

**Windows Native (Recommended):**

```bash
# Terminal 1: Backend
npm run dev  # Port 3002

# Terminal 2: Frontend
cd web && bun run dev  # Port 5173

# Terminal 3: nginx (optional)
nginx  # Port 80
```

See [SETUP_GUIDE_WINDOWS.md](../../SETUP_GUIDE_WINDOWS.md) for complete Windows setup.

### Common Commands

```bash
# Backend development
npm install              # Install dependencies
npm run dev             # Start with hot reload
npm run build           # Build for production
npm test                # Run tests
npm run lint            # Run ESLint
npm run typecheck       # TypeScript type checking
npm run format          # Prettier formatting

# Database operations
npx prisma studio       # Database UI
npx prisma generate     # Regenerate Prisma client
npx prisma migrate dev  # Create migration

# Frontend development
cd web
bun install             # Install dependencies (or npm install)
bun run dev             # Start Vite dev server
bun run build           # Build for production
npm run test:e2e        # Cypress E2E tests
```

## Testing

### Test Structure

```
tests/
├── unit/                # Service unit tests
├── integration/         # API integration tests
├── e2e/                 # Puppeteer E2E tests
└── security/            # Security-specific tests
```

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# E2E tests (currently skipped in CI)
npm run test:e2e

# Security tests
npm run test:security
```

## Code Style

**Key Conventions:**
- TypeScript for type safety
- ESLint for linting
- Prettier for formatting
- Async/await over callbacks
- Functional components (React)
- JSDoc comments for public APIs

## Git Workflow

**Branch Naming:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring
- `test/` - Test additions

**Commit Messages:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Refactoring
- `test:` - Tests
- `chore:` - Maintenance

## Related Sections

- [Getting Started](../100-getting-started/) - Initial setup
- [Architecture](../200-architecture/) - System design
- [API Reference](../300-api/) - API endpoints
- [Troubleshooting](../400-guides/407-troubleshooting.md) - Common issues

## CI/CD

**GitHub Actions:**
- Runs on push and pull requests
- Linting, type checking, testing
- Currently skips Puppeteer tests (headless browser issues)
- Some tests temporarily disabled (technical debt)

## Contributing

For detailed contribution guidelines, see the development guides in this section (coming soon).

**Quick Checklist:**
- [ ] Code follows style guide
- [ ] Tests pass locally
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] No hardcoded secrets
- [ ] Type checking passes

---

**Note:** Detailed development guides will be added in Phase B/C of the documentation project.
