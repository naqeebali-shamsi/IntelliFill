# IntelliFill Backend - AI Agent Context

> **Purpose:** Essential context for AI agents working on the backend.
> **Last Updated:** 2025-12-31

---

## Quick Reference

| Item                | Value                                   |
| ------------------- | --------------------------------------- |
| **Package Manager** | npm (NOT bun)                           |
| **Dev Server**      | `npm run dev` (port 3002)               |
| **Database**        | PostgreSQL (Neon Serverless) via Prisma |
| **Auth**            | Supabase Auth + JWT                     |
| **Queues**          | Bull + Redis                            |
| **Docs Root**       | `../docs/`                              |

---

## Project Structure

```
quikadmin/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ index.ts           # Express server entry point
â”‚   â”œâ”€â”€ api/               # Route handlers
â”‚   â”‚   â”œâ”€â”€ auth/          # Auth endpoints (register, login, logout)
â”‚   â”‚   â”œâ”€â”€ documents/     # Document CRUD
â”‚   â”‚   â”œâ”€â”€ process/       # OCR processing endpoints
â”‚   â”‚   â”œâ”€â”€ profiles/      # User profile management
â”‚   â”‚   â””â”€â”€ users/         # User endpoints
â”‚   â”œâ”€â”€ services/          # Business logic
â”‚   â”‚   â”œâ”€â”€ auth.service.ts
â”‚   â”‚   â”œâ”€â”€ document.service.ts
â”‚   â”‚   â”œâ”€â”€ ocr.service.ts
â”‚   â”‚   â””â”€â”€ profile.service.ts
â”‚   â”œâ”€â”€ middleware/        # Express middleware
â”‚   â”‚   â”œâ”€â”€ auth.ts        # JWT validation
â”‚   â”‚   â”œâ”€â”€ rate-limit.ts  # Rate limiting
â”‚   â”‚   â””â”€â”€ validate.ts    # Request validation (Joi)
â”‚   â”œâ”€â”€ queues/            # Bull queue definitions
â”‚   â”œâ”€â”€ workers/           # Queue processors
â”‚   â”œâ”€â”€ database/          # Prisma client & utilities
â”‚   â”œâ”€â”€ extractors/        # OCR/data extraction
â”‚   â”œâ”€â”€ fillers/           # PDF form filling
â”‚   â”œâ”€â”€ mappers/           # Field mapping logic
â”‚   â”œâ”€â”€ parsers/           # Document parsers
â”‚   â””â”€â”€ utils/             # Shared utilities
â”œâ”€â”€ prisma/
â”‚   â””â”€â”€ schema.prisma      # Database schema (source of truth)
â”œâ”€â”€ tests/                 # Jest tests
â””â”€â”€ .env                   # Environment variables (never commit)
```

---

## Tech Stack

| Layer          | Technology           | Notes              |
| -------------- | -------------------- | ------------------ |
| **Runtime**    | Node.js 18+          | Required           |
| **Framework**  | Express 4.18         | REST API           |
| **Language**   | TypeScript 5.x       | Strict mode        |
| **Database**   | PostgreSQL (Neon)    | Serverless         |
| **ORM**        | Prisma 6.14          | Type-safe queries  |
| **Auth**       | Supabase Auth        | JWT tokens         |
| **Queues**     | Bull + Redis         | Background jobs    |
| **Validation** | Joi                  | Request schemas    |
| **PDF**        | pdf-lib, pdf-parse   | Generation/parsing |
| **OCR**        | Tesseract.js, Gemini | Text extraction    |
| **Storage**    | AWS S3               | Document storage   |
| **Testing**    | Jest                 | Unit/integration   |

---

## Common Commands

```bash
# Development
npm run dev              # Start dev server (port 3002)
npm run dev:worker       # Start queue worker
npm run build            # Build for production
npm start                # Run production build

# Database
npx prisma generate      # Generate Prisma client
npx prisma migrate dev   # Run migrations
npx prisma studio        # Open DB GUI (port 5555)

# E2E Testing
npx tsx scripts/seed-e2e-users.ts  # Seed test users for E2E tests

# Testing
npm test                 # Run all tests
npm test -- --watch      # Watch mode
npm test -- path/to/test # Single file

# Linting
npm run lint             # ESLint check
npm run typecheck        # TypeScript check
npm run format           # Prettier format
```

---

## E2E Test Users

To run E2E tests, you must first seed test users in the database:

```bash
npx tsx scripts/seed-e2e-users.ts
```

**Seed script location:** `quikadmin/scripts/seed-e2e-users.ts`

**What it does:**

- Creates 5 test users in Supabase Auth (if not already created)
- Syncs users to Prisma with bcrypt-hashed passwords
- Creates E2E test organization and memberships
- Validates seed with bcrypt.compare verification

**Test users created:**

- `test-admin@intellifill.local` (ADMIN role)
- `test-owner@intellifill.local` (OWNER role)
- `test-member@intellifill.local` (MEMBER role)
- `test-viewer@intellifill.local` (VIEWER role)
- `test-password-reset@intellifill.local` (MEMBER role)

**Running E2E tests:**

```bash
cd quikadmin-web && bun run test:e2e:auto
```

See `docs/how-to/troubleshooting/e2e-auth.md` for troubleshooting login failures, password mismatches, or auth errors.

---

## API Patterns

### Route Structure

All routes follow: `/api/{version}/{resource}`

```typescript
// Example: src/api/documents/routes.ts
router.get('/', authenticate, listDocuments);
router.post('/', authenticate, validateBody(schema), createDocument);
router.get('/:id', authenticate, getDocument);
router.delete('/:id', authenticate, deleteDocument);
```

### Authentication

```typescript
// Protected route pattern
import { authenticate } from '../middleware/auth';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string };
}

router.get('/protected', authenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user.id;
  // ...
});
```

### Validation (Joi)

```typescript
// src/validators/document.validator.ts
import Joi from 'joi';

export const createDocumentSchema = Joi.object({
  name: Joi.string().required().max(255),
  type: Joi.string().valid('passport', 'license', 'id').required(),
  file: Joi.binary().required(),
});

// Usage in route
router.post('/', validateBody(createDocumentSchema), handler);
```

### Error Handling

```typescript
// Consistent error response format
res.status(400).json({
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input',
    details: errors,
  },
});

// Success response format
res.status(200).json({
  success: true,
  data: result,
});
```

---

## Database (Prisma)

### Prisma Singleton Pattern

**IMPORTANT:** Always use the `prisma` singleton - never instantiate `new PrismaClient()` directly.

```typescript
// CORRECT - Use singleton from utils/prisma.ts
import { prisma } from '../utils/prisma';

const user = await prisma.user.findUnique({ where: { id } });

// INCORRECT - Never do this
// import { PrismaClient } from '@prisma/client';
// const prisma = new PrismaClient();  // Creates duplicate connections!
```

**Why singleton matters:**

- Prevents connection pool exhaustion on serverless (Neon)
- Ensures consistent connection handling across services
- Enables connection keepalive for idle timeout prevention

### Key Models

```prisma
model User {
  id          String   @id @default(uuid())
  email       String   @unique
  supabaseId  String?  @unique
  profile     Profile?
  documents   Document[]
}

model Document {
  id          String   @id @default(uuid())
  userId      String
  name        String
  type        String
  status      DocumentStatus
  extractedData Json?
  user        User     @relation(fields: [userId])
}

model Profile {
  id          String   @id @default(uuid())
  userId      String   @unique
  firstName   String?
  lastName    String?
  piiData     Json?    // Encrypted
  user        User     @relation(fields: [userId])
}
```

### Query Patterns

```typescript
// Use Prisma singleton
import { prisma } from '../utils/prisma';

// Include relations
const user = await prisma.user.findUnique({
  where: { id },
  include: { profile: true, documents: true },
});

// Transaction
await prisma.$transaction([
  prisma.document.create({ data }),
  prisma.auditLog.create({ data: logData }),
]);
```

---

## Queue Processing (Bull)

### Queue Setup

```typescript
// src/queues/ocr.queue.ts
import Bull from 'bull';

export const ocrQueue = new Bull('ocr-processing', {
  redis: process.env.REDIS_URL,
});

// Add job
await ocrQueue.add(
  'process-document',
  { documentId },
  {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  }
);
```

### Worker Pattern

```typescript
// src/workers/ocr.worker.ts
ocrQueue.process('process-document', async (job) => {
  const { documentId } = job.data;

  job.progress(10);
  const document = await getDocument(documentId);

  job.progress(50);
  const extracted = await extractText(document);

  job.progress(100);
  return { success: true, data: extracted };
});
```

---

## Environment Variables

Required in `.env`:

```bash
# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...      # For Prisma migrations

# Auth
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...

# Redis (for queues)
REDIS_URL=redis://...

# Storage
AWS_REGION=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=...

# AI (for OCR)
GEMINI_API_KEY=...
```

See `docs/reference/configuration/environment.md` for full list.

---

## Security Guidelines

1. **Authentication:** All protected routes use `authenticate` middleware
2. **Validation:** All inputs validated with Joi schemas
3. **SQL Injection:** Use Prisma ORM (parameterized queries)
4. **Secrets:** Never commit `.env`, use environment variables
5. **PII:** Encrypt sensitive data in `piiData` fields
6. **Rate Limiting:** Applied to auth and processing endpoints
7. **Audit Logging:** Global audit middleware logs all `/api/` requests
8. **RLS Hardening:** Supabase RLS errors logged at ERROR level with `RLS_FAIL_CLOSED` support

### Audit Middleware

Global audit logging is registered in `index.ts` for all `/api/` routes:

- Request body logging enabled
- Excluded endpoints: `/health`, `/metrics`, `/docs`

### RLS Error Handling

The `supabaseAuth.ts` middleware includes production-hardening features:

- `req.rlsContextSet` flag tracks RLS context state
- `RLS_FAIL_CLOSED=true` rejects requests on RLS setup failure (production)

---

## Key Files Reference

| What              | Where                    |
| ----------------- | ------------------------ |
| Server entry      | `src/index.ts`           |
| Route definitions | `src/api/*/routes.ts`    |
| Auth middleware   | `src/middleware/auth.ts` |
| Prisma schema     | `prisma/schema.prisma`   |
| Queue definitions | `src/queues/*.ts`        |
| Worker processors | `src/workers/*.ts`       |
| Type definitions  | `src/types/*.ts`         |
| Validators        | `src/validators/*.ts`    |

---

## Documentation Links

| Topic               | Location                                         |
| ------------------- | ------------------------------------------------ |
| API Endpoints       | `docs/reference/api/endpoints.md`                |
| System Architecture | `docs/reference/architecture/system-overview.md` |
| Database Schema     | `docs/reference/database/schema.md`              |
| Local Setup         | `docs/how-to/development/local-setup.md`         |
| Testing Guide       | `docs/how-to/development/testing.md`             |
| Auth Issues         | `docs/how-to/troubleshooting/auth-issues.md`     |
| Deployment          | `docs/how-to/deployment/`                        |
| Environment Config  | `docs/reference/configuration/environment.md`    |

---

## Git Conventions

### Branch Naming

```
feature/short-description
fix/short-description
refactor/short-description
```

### Commit Format

```
type(scope): description

# Types: feat, fix, docs, refactor, test, chore
# Examples:
feat(auth): add password reset endpoint
fix(ocr): handle multi-page PDF extraction
refactor(queue): optimize job retry logic
```

---

## Task Master Integration

Task Master is used for project management. Key commands:

```bash
task-master list                    # Show all tasks
task-master next                    # Get next task
task-master show <id>               # View task details
task-master set-status --id=<id> --status=done
```

See `.taskmaster/CLAUDE.md` for full Task Master documentation.

---

## Common Gotchas

1. **Redis Required:** Queue processing needs Redis. For local dev:

   ```bash
   docker run -d -p 6379:6379 redis:alpine
   ```

2. **Prisma Generate:** After schema changes, run:

   ```bash
   npx prisma generate
   ```

3. **Frontend Expects Port 3002:** The frontend is configured for `localhost:3002`

4. **Neon Idle Timeout:** Database auto-disconnects after ~8min idle. Connection keepalive is enabled.

5. **S3 for Production:** Local dev can use filesystem, production needs S3.

---

**End of CLAUDE.md** (Optimized from 1518 to ~350 lines)
