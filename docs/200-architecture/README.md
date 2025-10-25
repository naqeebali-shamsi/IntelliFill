# Architecture Documentation

**Section Number:** 200
**Purpose:** System design, technical decisions, and architecture documentation
**Last Updated:** 2025-01-10

---

## Overview

This section documents QuikAdmin's actual architecture, design decisions, and technology choices. It distinguishes between current implementation (reality) and future vision (aspirational).

**Important:** Always check [CURRENT_ARCHITECTURE.md](../CURRENT_ARCHITECTURE.md) for the actual implemented system. The `architecture-vision/` folder contains future plans, not current reality.

## Documents in This Section

| Document | Description | Difficulty | Status |
|----------|-------------|------------|--------|
| [CURRENT_ARCHITECTURE.md](../CURRENT_ARCHITECTURE.md) | **START HERE** - Actual system architecture | Intermediate | ✅ Complete |
| [ARCHITECTURE_QUICK_REFERENCE.md](../ARCHITECTURE_QUICK_REFERENCE.md) | Fast 5-minute overview | Beginner | ✅ Complete |
| [204-security-architecture.md](./204-security-architecture.md) | Security design and JWT implementation | Advanced | ✅ Complete |

## Quick Links

**Understanding the System:**
- [Current Architecture](../CURRENT_ARCHITECTURE.md) - **Single source of truth**
- [Quick Reference](../ARCHITECTURE_QUICK_REFERENCE.md) - Fast overview
- [Security Architecture](./204-security-architecture.md) - Security patterns

**Key Insights:**
- **Current:** Monolithic Express API (NOT microservices)
- **Database:** PostgreSQL + Prisma ORM
- **Cache/Queue:** Redis + Bull 4.11.5
- **Auth:** Custom JWT (429 LOC, migration to Supabase planned)
- **ML:** Custom TensorFlow.js (334 LOC, migration to OpenAI planned)

## Technology Stack

**Backend:**
- Node.js 20.x
- Express.js 4.18
- TypeScript 5.3
- Prisma 6.14.0

**Document Processing:**
- pdf-lib 1.17.1
- Tesseract.js 6.0.1
- TensorFlow.js 4.22.0

**Security:**
- Helmet.js 8.1.0
- JWT authentication
- bcrypt password hashing

## Related Sections

- [Getting Started](../100-getting-started/) - Setup and installation
- [API Reference](../300-api/) - API endpoints
- [Development Guide](../600-development/) - Developer workflows

## Architecture Decision Records

Major decisions documented in CURRENT_ARCHITECTURE.md:
1. **Monolithic over Microservices** - Stay simple until >10k users
2. **Custom JWT Auth** - Temporary solution (Supabase migration planned)
3. **Custom ML Model** - Insufficient accuracy (OpenAI migration planned)
4. **Windows Native Dev** - Better performance than Docker on Windows

## Future Vision

The `architecture-vision/` folder contains aspirational designs for:
- Microservices architecture (6+ services)
- Kubernetes deployment
- Kong API Gateway
- ELK Stack logging

**Note:** These are future plans for >100k users scale, not current implementation.

## Contributing

When documenting architecture changes:
1. Update CURRENT_ARCHITECTURE.md for actual changes
2. Add future plans to architecture-vision/ only
3. Maintain clear separation between reality and vision
4. Document the "why" not just the "what"

---

**Start Here:** Read [CURRENT_ARCHITECTURE.md](../CURRENT_ARCHITECTURE.md) for complete system understanding.
