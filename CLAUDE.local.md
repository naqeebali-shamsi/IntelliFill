# IntelliFill Local Dev Context

Quick reference for AI agents. See detailed docs in `docs/` directory.

## Project Structure

```
IntelliFill/
├── quikadmin/         # Backend (Express + TypeScript) - npm
├── quikadmin-web/     # Frontend (React + Vite) - bun only
├── docs/              # Unified documentation
└── .claude/skills/    # AI agent skills
```

## Running Services

| Service       | Port | Command                           |
| ------------- | ---- | --------------------------------- |
| Backend       | 3002 | `cd quikadmin && npm run dev`     |
| Frontend      | 8080 | `cd quikadmin-web && bun run dev` |
| Prisma Studio | 5555 | `npx prisma studio`               |

## Key API Endpoints

**Auth**: `POST /api/auth/v2/{register,login,logout,refresh}`
**Docs**: `GET/POST/DELETE /api/documents`
**Process**: `POST /api/process/{single,multiple}`
**Profile**: `GET/PUT /api/users/me/profile`

## Tech Stack

**Backend**: Express 4.18, TypeScript, Prisma 6.14, PostgreSQL (Neon), Bull+Redis
**Frontend**: React 18, Vite, TailwindCSS 4.0, Zustand 5.0, Radix UI

## Environment Files (Authority Model)

**Three separate `.env` files** - never duplicate keys across files:

| File                 | Purpose         | Keys                                                          |
| -------------------- | --------------- | ------------------------------------------------------------- |
| `quikadmin/.env`     | Backend config  | DATABASE*URL, SUPABASE*_, JWT\__, REDIS*URL, R2*\*, LOG_LEVEL |
| `quikadmin-web/.env` | Frontend config | VITE*API_URL, VITE_SUPABASE*_, VITE\__ flags                  |
| `.env` (root)        | AI tools only   | PERPLEXITY_API_KEY, GEMINI_API_KEY, GROQ_API_KEY              |

**SECURITY**: `SUPABASE_SERVICE_ROLE_KEY` must ONLY be in `quikadmin/.env` (never root)

See `docs/reference/configuration/environment.md` for full details.

**Frontend auth mode** (recommended for local dev):

```env
# quikadmin-web/.env
VITE_USE_BACKEND_AUTH=true
VITE_API_URL=http://localhost:3002/api
```

## Known Issues

- **Redis**: Required for production. Rate limiting falls back to in-memory (dev only), but queues require Redis.
  - For production: Set up Upstash Redis (see `docs/how-to/deployment/upstash-redis-setup.md`)
  - For local dev: `docker run -d -p 6379:6379 redis:alpine`
- **DB Keepalive**: Auto-enabled to prevent Neon timeout after ~8min idle

## Context Optimization

Run `.\scripts\mcp-toggle.ps1 -Mode minimal` to save ~9k tokens.
See `docs/context-optimization.md` for details.

## Documentation

- Backend: `quikadmin/CLAUDE.md`
- Frontend: `quikadmin-web/CLAUDE.md`
- Skills: `.claude/skills/`
- API Ref: `docs/reference/api/`

## Automatic Memory System

This project has an automatic memory system configured via hooks in `.claude/settings.local.json`:

| Hook               | Trigger          | Action                           |
| ------------------ | ---------------- | -------------------------------- |
| `UserPromptSubmit` | Every prompt     | Reminds to check relevant docs   |
| `PostToolUse`      | After Edit/Write | Reminds to update docs if needed |

**Quick Reference (from `.claude/skills/memory-system/`):**

| Task Type   | Check First                                        | Update After |
| ----------- | -------------------------------------------------- | ------------ |
| Backend API | `quikadmin/CLAUDE.md`, `docs/reference/api/`       | Same         |
| Frontend    | `quikadmin-web/CLAUDE.md`                          | Same         |
| Database    | `prisma/schema.prisma`, `docs/reference/database/` | Same         |
| Auth        | `docs/explanation/security-model.md`               | Same         |
| Deployment  | `docs/how-to/deployment/`                          | Same         |

Last Updated: 2025-12-30
