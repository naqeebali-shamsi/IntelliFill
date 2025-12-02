# IntelliFill - Local Development Context

This file provides local development context and overrides for AI agents working on the IntelliFill project. It complements the main configuration files in each subproject.

---

## Project Overview

**IntelliFill** (also known as QuikAdmin) is an intelligent PDF form automation platform that uses OCR, AI, and machine learning to automatically extract data from documents and fill PDF forms.

### Repository Structure

```
IntelliFill/
├── quikadmin/              # Backend API (Express + TypeScript)
├── quikadmin-web/          # Frontend UI (React + Vite + TypeScript)
├── extension/              # Browser extension
├── docs/                   # Unified Diátaxis documentation
├── CLAUDE.local.md         # This file - local dev context
├── AGENTS.md               # Unified agent integration guide
└── .cursorrules            # Project-wide Cursor IDE rules
```

---

## Development Environment

### Current Configuration

| Service | Port | Status | URL |
|---------|------|--------|-----|
| Backend API | 3002 | Running | http://localhost:3002 |
| Frontend UI | 8080 | Running | http://localhost:8080 |
| Prisma Studio | 5555 | Running | http://localhost:5555 |

### Quick Start Commands

```bash
# Start all services (Windows)
cd quikadmin && npm run dev          # Terminal 1: Backend on :3002
cd quikadmin-web && bun run dev      # Terminal 2: Frontend on :8080
npx prisma studio                     # Terminal 3: Prisma Studio on :5555

# Or use the batch scripts
start-dev.bat                         # Windows all-in-one
```

### Package Managers

- **Backend (quikadmin)**: Use `npm`
- **Frontend (quikadmin-web)**: Use `bun` exclusively (NOT npm or yarn)

---

## Known Issues & Workarounds

### ✅ FIXED: Database Connection Stability

**Previous Issue**: Neon PostgreSQL connection drops after ~8 minutes of idle time.

**Solution Implemented**: Added keepalive mechanism to Prisma client.

**Files Modified**:
- `quikadmin/src/utils/prisma.ts` - Added `startKeepalive()` and `stopKeepalive()` functions
- `quikadmin/src/index.ts` - Integrated keepalive with server startup

**How It Works**: A lightweight `SELECT 1` query is sent every 4 minutes to keep the connection alive. The keepalive automatically starts when the backend server runs and stops gracefully on shutdown.

**Status**: ✅ Fixed

### ✅ FIXED: Frontend Authentication Configuration

**Previous Issue**: Frontend connected directly to Supabase, causing "Failed to fetch" errors when Supabase was unreachable.

**Solution Implemented**: Added backend auth mode that routes all authentication through the backend API.

**Files Added/Modified**:
- `quikadmin-web/src/services/authService.ts` - New backend auth service
- `quikadmin-web/src/stores/backendAuthStore.ts` - New backend-only auth store
- `quikadmin-web/src/services/api.ts` - Updated to support both auth modes
- `quikadmin-web/src/lib/supabase.ts` - Made Supabase optional

**To Enable Backend Auth Mode**, add to `quikadmin-web/.env`:
```env
VITE_USE_BACKEND_AUTH=true
VITE_API_URL=http://localhost:3002/api
```

With this configuration:
- All auth goes through `http://localhost:3002/api/auth/v2/*`
- No Supabase URL/key required in frontend
- Works without Supabase SDK errors

**Status**: ✅ Fixed

### ✅ FIXED: Supabase Authentication

**Previous Issue**: Supabase project was paused, causing authentication to fail.

**Solution Applied**:
1. Restored Supabase project
2. Unified frontend auth stores to use backend API
3. Fixed `ProtectedRoute.tsx` to use unified auth store
4. Fixed `api.ts` interceptors to use backend auth tokens

**Files Modified**:
- `quikadmin-web/src/stores/auth.ts` - Unified auth export
- `quikadmin-web/src/stores/backendAuthStore.ts` - Added `authSelectors`
- `quikadmin-web/src/services/api.ts` - Simplified to use backend auth
- `quikadmin-web/src/components/ProtectedRoute.tsx` - Uses unified auth store
- `quikadmin-web/src/pages/*.tsx` - Login, Register, Dashboard, etc. use unified auth

**Status**: ✅ Fixed

### Redis Connection (Low Priority)

**Issue**: Redis connection fails on localhost:6379.

**Impact**: Rate limiting falls back to in-memory (acceptable for development).

**Status**: Working as designed with fallback mechanism. No fix needed.

---

## API Endpoints Quick Reference

### Authentication (`/api/auth/v2`)
- `POST /register` - User registration
- `POST /login` - User authentication
- `POST /logout` - User logout
- `POST /refresh` - Token refresh
- `POST /change-password` - Password change
- `POST /forgot-password` - Password reset request
- `POST /reset-password` - Password reset

### Documents (`/api/documents`)
- `GET /` - List documents
- `GET /:id` - Get document
- `POST /upload` - Upload document
- `DELETE /:id` - Delete document
- `PATCH /:id` - Update document

### Processing
- `POST /api/process/single` - Process single document
- `POST /api/process/multiple` - Process multiple documents
- `GET /api/jobs/:id/status` - Job status

### User Profile (`/api/users`)
- `GET /me/profile` - Get profile
- `PUT /me/profile` - Update profile
- `POST /me/fill-form` - Fill form with profile data

### Templates (`/api/templates`)
- `GET /` - List templates
- `POST /` - Create template
- `GET /public` - Public templates
- `PUT /:id` - Update template
- `DELETE /:id` - Delete template

---

## Technology Stack

### Backend (`quikadmin/`)
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.18
- **Language**: TypeScript 5.3
- **ORM**: Prisma 6.14
- **Database**: PostgreSQL (Neon Serverless)
- **Auth**: Supabase Auth + JWT
- **OCR**: Tesseract.js 6.0
- **PDF**: pdf-lib 1.17
- **Queue**: Bull + Redis
- **Caching**: Redis 4.6

### Frontend (`quikadmin-web/`)
- **Runtime**: Bun
- **Framework**: React 18.2
- **Build**: Vite 4.5
- **Language**: TypeScript 5.2
- **Styling**: TailwindCSS 4.0 (beta)
- **State**: Zustand 5.0
- **Data Fetching**: React Query 3.39
- **UI Components**: Radix UI
- **Testing**: Vitest + Cypress

---

## File Patterns & Conventions

### Backend Patterns

```typescript
// API Route Pattern (quikadmin/src/api/*.routes.ts)
import { Router } from 'express';
import { validateRequest } from '../middleware/validation';
import { authMiddleware } from '../middleware/supabaseAuth';

const router = Router();

router.post('/endpoint', authMiddleware, validateRequest(schema), async (req, res) => {
  // Implementation
});

export default router;
```

### Frontend Patterns

```typescript
// Zustand Store Pattern (quikadmin-web/src/stores/*.ts)
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface StoreState {
  data: DataType[];
  loading: boolean;
  fetch: () => Promise<void>;
}

export const useStore = create<StoreState>()(
  immer((set) => ({
    data: [],
    loading: false,
    fetch: async () => {
      set({ loading: true });
      // Implementation
    },
  }))
);
```

---

## Testing

### Backend Tests
```bash
cd quikadmin
npm test                    # Run Jest tests
npm run test:watch          # Watch mode
npm run test:api            # API endpoint tests
npm run test:security       # Security tests
```

### Frontend Tests
```bash
cd quikadmin-web
bun run test                # Run Vitest tests
bun run test:watch          # Watch mode
bun run test:coverage       # Coverage report
bun run cypress:open        # E2E tests (interactive)
bun run cypress:run         # E2E tests (headless)
```

---

## Common Development Tasks

### Adding a New API Endpoint

1. Create route handler in `quikadmin/src/api/[domain].routes.ts`
2. Add validation schema in `quikadmin/src/validators/schemas/`
3. Register route in `quikadmin/src/api/routes.ts`
4. Update API documentation
5. Add tests

### Adding a New Frontend Page

1. Create page component in `quikadmin-web/src/pages/`
2. Add route in `quikadmin-web/src/App.tsx`
3. Create any needed stores in `quikadmin-web/src/stores/`
4. Add services in `quikadmin-web/src/services/`
5. Add tests

### Database Changes

```bash
cd quikadmin
npx prisma migrate dev --name "description"  # Create migration
npx prisma generate                           # Regenerate client
npx prisma studio                             # View data
```

---

## Environment Variables

### Backend (`quikadmin/.env`)
```env
NODE_ENV=development
PORT=3002
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=your-secret
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
REDIS_URL=redis://localhost:6379
```

### Frontend (`quikadmin-web/.env`)
```env
VITE_API_URL=http://localhost:3002/api

# Option 1: Supabase Direct Auth (default)
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...

# Option 2: Backend Auth Mode (recommended for local dev)
# Set this to route all auth through the backend API
# This removes the need for VITE_SUPABASE_* variables
VITE_USE_BACKEND_AUTH=true
```

---

## AI Agent Instructions

### Before Making Changes

1. Read this file for local context
2. Read `quikadmin/CLAUDE.md` for backend-specific context
3. Read `quikadmin-web/CLAUDE.md` for frontend-specific context
4. Check the relevant `docs/` section for detailed information

### Documentation Updates (MANDATORY)

**This is a living documentation system.** When making code changes, you MUST update:

| Change Type | Update Location |
|-------------|-----------------|
| API endpoint | `docs/reference/api/endpoints.md` |
| Environment variable | `docs/reference/configuration/environment.md` |
| Database schema | `docs/reference/database/schema.md` |
| New feature | Appropriate tutorial/how-to |
| Fixed known issue | Remove from this file's Known Issues |
| New known issue | Add to this file's Known Issues |

See `docs/MAINTENANCE.md` for complete documentation maintenance guidelines.

### Documentation Locations

- `docs/` - Root-level Diátaxis docs for cross-cutting concerns
- `quikadmin/docs/` - Backend-specific docs
- `quikadmin-web/docs/` - Frontend-specific docs

### Commit Message Format

```
type(scope): description

Types: feat, fix, docs, refactor, test, chore
Scopes: api, web, docs, db, auth, ocr, pdf
```

---

## Related Documentation

- [Backend CLAUDE.md](./quikadmin/CLAUDE.md) - Backend AI context
- [Backend AGENTS.md](./quikadmin/AGENTS.md) - Task Master integration
- [Frontend CLAUDE.md](./quikadmin-web/CLAUDE.md) - Frontend AI context
- [Root AGENTS.md](./AGENTS.md) - Unified agent guide
- [Documentation Hub](./docs/README.md) - Diátaxis documentation

---

**Last Updated**: 2025-11-25
**Environment**: Windows 10, Node.js 18+, Bun

