---
title: Development Guide
category: development
status: active
last_updated: 2025-11-11
---

# Development Guide

Everything you need to know to develop QuikAdmin.

## Quick Navigation

### Getting Started
- **[CONTRIBUTING](./CONTRIBUTING.md)** - How to contribute
- **[Local Setup](./setup/local-environment.md)** - Development environment
- **[Docker Setup](./setup/docker.md)** - Docker development

### Workflow
- **[Git Workflow](./workflow/git-workflow.md)** - Branching and commits
- **[Testing Guide](./workflow/testing.md)** - Writing tests
- **[Code Review](./workflow/code-review.md)** - Review process

### Standards
- **[TypeScript Standards](./standards/typescript.md)** - TypeScript conventions
- **[React Standards](./standards/react.md)** - React best practices
- **[API Standards](./standards/api-design.md)** - API design patterns

## Essential Reading

1. **[CONTRIBUTING](./CONTRIBUTING.md)** - Start here
2. **[Architecture Overview](../01-current-state/architecture/system-overview.md)** - Understand the system
3. **[Local Setup](./setup/local-environment.md)** - Set up your environment

## Quick Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm test             # Run tests
npm run lint         # Check code style

# Database
npx prisma studio    # Open database GUI
npx prisma migrate dev  # Run migrations
npx prisma generate  # Generate Prisma client

# Git
git checkout -b feature/my-feature  # New branch
npm run lint && npm test  # Pre-commit check
```

## Related Documentation

- [Getting Started](../getting-started/README.md)
- [Architecture](../architecture/README.md)
- [API Reference](../api/reference/README.md)

---

**Last Updated:** 2025-11-11

