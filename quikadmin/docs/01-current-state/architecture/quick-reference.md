---
title: "Architecture Quick Reference"
id: "arch-quick-reference"
version: "1.0.0"
last_updated: "2025-01-XX"
created: "2025-01-XX"
status: "active"
phase: "current"
maintainer: "team"
depends_on: []
related_to:
  - "arch-system-overview"
ai_priority: "high"
ai_context_level: "foundational"
ai_required_reading: true
ai_auto_update: true
category: "architecture"
tags:
  - "architecture"
  - "quick-reference"
  - "current-state"
audience:
  - "developers"
  - "ai-agents"
  - "architects"
verified_against_code: "2025-01-XX"
code_references:
  - "package.json"
  - "prisma/schema.prisma"
---

# QuikAdmin - Architecture Quick Reference

**Status:** [![Status](https://img.shields.io/badge/status-active-green)]()  
**Last Updated:** 2025-01-XX  
**Version:** 1.0.0

**For rapid context:** Read this first, then dive into [System Overview](./system-overview.md) for details.

---

## 30-Second Summary

QuikAdmin is a **monolithic Node.js/Express API** + **React SPA** for intelligent document processing and form filling. Currently in **early MVP development** with Windows-native dev environment.

**Core Value Prop:** Upload source documents + target PDF form → AI-powered field mapping → Auto-filled form download

---

## Tech Stack at a Glance

```
Backend:    Node.js 20 + Express + TypeScript + Prisma ORM
Frontend:   React 18 + Vite + Zustand + Tailwind CSS
Database:   PostgreSQL 16 (Prisma ORM)
Cache/Queue: Redis 4 + Bull 4.11.5
Auth:       Custom JWT (HS256) + bcrypt
ML/AI:      TensorFlow.js (85-90% accuracy) → OpenAI (planned)
OCR:        Tesseract.js
Dev Env:    Windows native (nginx proxy)
Deployment: Docker (optional), Production TBD
```

---

## Key Services (LOC)

| Service | File | Lines | Purpose | Status |
|---------|------|-------|---------|--------|
| **Auth** | `PrismaAuthService.ts` | 429 | JWT auth, registration, login | ⚠️ High maintenance |
| **ML Model** | `FieldMappingModel.ts` | 334 | TensorFlow.js field mapping | ⚠️ 85-90% accuracy |
| **IntelliFill** | `IntelliFillService.ts` | 274 | Document processing orchestration | ✅ Core service |
| **OCR** | `OCRService.ts` | 240 | Tesseract.js OCR processing | ⚠️ Placeholder code |
| **Queue** | `documentQueue.ts` | 226 | Bull job queue management | ⚠️ Legacy Bull 4.x |

---

## API Endpoints (Production-Ready)

```
POST   /api/auth/register          # User registration
POST   /api/auth/login             # Login (returns JWT)
POST   /api/auth/refresh           # Refresh access token
GET    /api/auth/profile           # Get user profile
POST   /api/auth/logout            # Logout
POST   /api/documents/upload       # Upload document
POST   /api/documents/process      # Process document + form
GET    /api/documents/:id          # Get document metadata
GET    /api/documents/:id/download # Download processed document
GET    /api/stats/overview         # System statistics
GET    /health                     # Health check (public)
```

---

## Database Models (Prisma)

```
User          # User accounts, auth, roles (ADMIN/USER/VIEWER)
RefreshToken  # JWT refresh tokens (7-day expiry)
Session       # User sessions (IP, device tracking placeholder)
Document      # Uploaded documents, processing status
Template      # Reusable form templates with field mappings
FieldMapping  # ML training data for field matching
```

---

## Security Status

### ✅ Phase 0 Complete (Emergency Fixes)
- Removed hardcoded secrets
- Fixed JWT algorithm confusion (CVE-2015-9235)
- Eliminated auth bypass vulnerability
- Environment validation (fail-fast on startup)
- JWT expiry reduced to 15 minutes

### ⏳ Pending (High Priority)
- 2FA/MFA (via Supabase Auth migration)
- OAuth/SSO (Google, GitHub, Microsoft)
- Password reset flow
- CSRF protection (implemented but disabled)
- Input validation with Zod schemas
- Rate limiting per user (currently per IP only)

---

## Known Technical Debt (Critical)

| Priority | Issue | Impact | Solution | Timeline |
|----------|-------|--------|----------|----------|
| **P0** | Custom auth (429 LOC) | Security risk, maintenance burden | → Supabase Auth | 2-3 days |
| **P0** | ML accuracy (85-90%) | Poor user experience | → OpenAI GPT-4o-mini | 1-2 days |
| **P0** | OCR placeholder | Blocks production | Implement pdf2pic | 2-3 days |
| **P1** | Bull 4.11.5 (legacy) | Missing features, slow | → BullMQ upgrade | 1 day |
| **P1** | No observability | Hard to debug | Prometheus + Grafana | 2 days |
| **P1** | Test coverage unknown | Quality risk | Configure Jest coverage | 1 day |

---

## Development Quick Start

### Windows Native (Primary)
```bash
# Backend (terminal 1)
npm install
npx prisma migrate dev
npm run dev  # API on port 3002

# Frontend (terminal 2)
cd web
bun install
bun run dev  # Vite on port 5173

# nginx (port 80 proxies to both)
./start-windows.bat
```

### Docker (Alternative)
```bash
docker-compose up  # All services
```

---

## Common Commands

```bash
# Database
npx prisma migrate dev --name <name>  # Create migration
npx prisma studio                     # Database UI

# Testing
npm test                              # Unit + integration
npm run test:e2e                      # Puppeteer E2E
cd web && npm run test:e2e            # Cypress UI tests

# Code Quality
npm run lint                          # ESLint
npm run typecheck                     # TypeScript
npm run format                        # Prettier
```

---

## Directory Structure (Key Paths)

```
quikadmin/
├── src/
│   ├── index.ts              # Entry point (250 LOC)
│   ├── api/                  # Route handlers
│   │   ├── auth.routes.ts
│   │   ├── documents.routes.ts
│   │   └── stats.routes.ts
│   ├── services/             # Core business logic
│   │   ├── PrismaAuthService.ts (429 LOC) ⚠️
│   │   ├── IntelliFillService.ts (274 LOC)
│   │   ├── OCRService.ts (240 LOC) ⚠️
│   │   └── documentQueue.ts (226 LOC)
│   ├── ml/
│   │   └── FieldMappingModel.ts (334 LOC) ⚠️
│   ├── parsers/              # Document parsers (PDF, DOCX, CSV)
│   ├── extractors/           # Data extraction logic
│   ├── mappers/              # Field mapping logic
│   ├── fillers/              # Form filling logic
│   ├── validators/           # Validation services
│   └── middleware/           # Auth, rate limiting, security
├── web/                      # React SPA
│   ├── src/
│   │   ├── pages/            # Dashboard, Login, etc.
│   │   ├── components/       # UI components
│   │   ├── stores/           # Zustand state
│   │   └── services/         # API client
│   └── vite.config.ts
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Migration files
├── tests/                    # Jest + Puppeteer + Cypress
├── docs/
│   ├── system-overview.md (this is truth)
│   ├── ARCHITECTURE_QUICK_REFERENCE.md (you are here)
│   └── architecture/         # Future vision (aspirational)
└── CLAUDE.md                 # AI assistant config
```

---

## Architecture: Reality vs Vision

| Feature | Current Reality | Future Vision (100k+ users) |
|---------|----------------|---------------------------|
| Architecture | Monolithic Express | Microservices |
| Orchestration | None | Kubernetes |
| API Gateway | nginx reverse proxy | Kong/Envoy |
| Logging | Winston console | ELK stack |
| Tracing | None | Jaeger/Zipkin |
| Monitoring | None (health check) | Prometheus + Grafana |
| Scaling | Manual (vertical) | Auto-scaling HPA |
| Deployment | Single instance | Multi-region HA |
| Auth | Custom JWT (429 LOC) | Auth service |
| ML | Custom TF.js (85-90%) | ML service |
| Queue | Bull 4.11.5 | Distributed MQ |

**Important:** Always check `docs/01-current-state/architecture/system-overview.md` for truth, not `docs/04-future-vision/` vision.

---

## Planned Migrations (Phase 4)

### 1. Supabase Auth (P0)
- **Replace:** 429 LOC custom auth
- **Gain:** 2FA, OAuth, zero maintenance
- **Cost:** $0/month (free tier)
- **Time:** 2-3 days

### 2. OpenAI Field Extraction (P1)
- **Replace:** 334 LOC TensorFlow.js model
- **Gain:** 99%+ accuracy, semantic understanding
- **Cost:** $3-30/month
- **Time:** 1-2 days

### 3. BullMQ Upgrade (P1)
- **Replace:** Bull 4.11.5 → BullMQ latest
- **Gain:** TypeScript API, 2-3x faster, better observability
- **Cost:** $0 (same Redis)
- **Time:** 1 day

---

## For Claude Code

**When assisting with QuikAdmin:**

1. ✅ **Always read `01-current-state/architecture/system-overview.md` first** before answering architecture questions
2. ✅ **Verify in code** (check package.json, actual files) before making claims
3. ✅ **Reference actual LOC** when discussing services (`wc -l` output)
4. ❌ **Don't assume** features from `docs/architecture/` exist (that's future vision)
5. ❌ **Don't claim Kubernetes/Kong/ELK** exist (they don't, yet)
6. ❌ **Don't assume microservices** (it's a monolith)

**Example Correct Responses:**

> "QuikAdmin currently uses a monolithic Express API with custom JWT auth (429 LOC in PrismaAuthService.ts). The architecture vision includes migrating to Supabase Auth to eliminate this maintenance burden."

> "The field mapping model is a custom TensorFlow.js implementation with ~85-90% accuracy (334 LOC in FieldMappingModel.ts). We're planning to migrate to OpenAI GPT-4o-mini for 99%+ accuracy."

---

## Critical Files (Read Before Coding)

1. **`CLAUDE.md`** - AI assistant config, project context
2. **`docs/01-current-state/architecture/system-overview.md`** - Architecture truth (41KB, 1205 lines)
3. **`package.json`** - Real dependencies (not assumptions)
4. **`prisma/schema.prisma`** - Database schema (single source of truth)
5. **`src/index.ts`** - Application entry point

---

**Last Updated:** 2025-01-10
**Full Details:** See [System Overview](./system-overview.md) (41KB comprehensive doc)
