# IntelliFill - Unified AI Agent Integration Guide

This document provides a comprehensive guide for AI agents working on the IntelliFill monorepo, covering both backend and frontend development workflows.

---

## Quick Start for AI Agents

### Session Initialization Checklist

1. **Read Context Files** (in order):
   - `CLAUDE.local.md` - Local development context and known issues
   - `quikadmin/CLAUDE.md` - Backend-specific AI context
   - `quikadmin-web/CLAUDE.md` - Frontend-specific AI context
   - `docs/README.md` - Documentation hub

2. **Verify Environment**:
   - Backend API: http://localhost:3002/health
   - Frontend UI: http://localhost:8080
   - Prisma Studio: http://localhost:5555

3. **Check Current State**:
   ```bash
   # Check running services
   curl http://localhost:3002/health
   
   # Check database connection
   cd quikadmin && npx prisma studio
   ```

---

## Project Architecture

### Monorepo Structure

```
IntelliFill/
├── quikadmin/              # Backend API
│   ├── src/
│   │   ├── api/            # Route handlers
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   ├── database/       # Database services
│   │   ├── utils/          # Utilities
│   │   └── validators/     # Input validation
│   ├── prisma/             # Database schema
│   ├── docs/               # Backend documentation
│   └── tests/              # Backend tests
│
├── quikadmin-web/          # Frontend UI
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── stores/         # Zustand stores
│   │   ├── services/       # API services
│   │   ├── hooks/          # Custom hooks
│   │   └── types/          # TypeScript types
│   ├── docs/               # Frontend documentation
│   └── cypress/            # E2E tests
│
├── extension/              # Browser extension
├── docs/                   # Unified documentation
└── logs/                   # Application logs
```

### Service Dependencies

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend UI   │────▶│   Backend API   │────▶│   PostgreSQL    │
│  (React/Vite)   │     │   (Express)     │     │   (Neon)        │
│   Port: 8080    │     │   Port: 3002    │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Supabase Auth     │
                    │   + Redis Cache     │
                    └─────────────────────┘
```

---

## Development Workflows

### Backend Development (quikadmin/)

#### Starting Development

```bash
cd quikadmin
npm install
npm run dev                 # Start with hot reload on :3002
```

#### Common Tasks

| Task | Command |
|------|---------|
| Run tests | `npm test` |
| Type check | `npm run typecheck` |
| Lint code | `npm run lint` |
| Database migration | `npx prisma migrate dev` |
| Generate Prisma client | `npx prisma generate` |
| View database | `npx prisma studio` |

#### Adding New Features

1. **Create Route** in `src/api/[domain].routes.ts`
2. **Add Service** in `src/services/[Domain]Service.ts`
3. **Add Validation** in `src/validators/schemas/`
4. **Register Route** in `src/api/routes.ts`
5. **Write Tests** in `tests/`
6. **Update Docs** in `docs/`

### Frontend Development (quikadmin-web/)

#### Starting Development

```bash
cd quikadmin-web
bun install                 # MUST use bun, not npm
bun run dev                 # Start on :8080
```

#### Common Tasks

| Task | Command |
|------|---------|
| Run unit tests | `bun run test` |
| Run E2E tests | `bun run cypress:open` |
| Type check | `bun run typecheck` |
| Build | `bun run build` |

#### Adding New Features

1. **Create Page** in `src/pages/`
2. **Create Components** in `src/components/`
3. **Add Store** in `src/stores/` (if needed)
4. **Add Services** in `src/services/` (if API calls)
5. **Add Route** in `src/App.tsx`
6. **Write Tests** in `src/__tests__/`

---

## Cross-Project Coordination

### API Integration Pattern

When working on features that span backend and frontend:

1. **Backend First**: Implement API endpoint with validation
2. **Document API**: Update `docs/reference/api/endpoints.md`
3. **Frontend Service**: Add API call in `quikadmin-web/src/services/`
4. **Frontend Store**: Update Zustand store if needed
5. **Frontend UI**: Implement components and pages
6. **E2E Tests**: Add Cypress tests for full flow

### Shared Types

Currently, types are duplicated. When modifying shared types:

1. Update backend types in `quikadmin/src/types/`
2. Update frontend types in `quikadmin-web/src/types/`
3. Ensure consistency between both

### Authentication Flow

```
Frontend                    Backend                     Supabase
   │                          │                            │
   │──── Login Request ──────▶│                            │
   │                          │──── Verify Credentials ───▶│
   │                          │◀─── JWT Token ─────────────│
   │◀─── Set Cookie + Token ──│                            │
   │                          │                            │
   │──── API Request ────────▶│                            │
   │     (with token)         │──── Validate Token ───────▶│
   │                          │◀─── User Info ─────────────│
   │◀─── Response ────────────│                            │
```

---

## Task Master Integration

This project uses Task Master for task-driven development. See `quikadmin/AGENTS.md` for detailed Task Master commands.

### Essential Commands

```bash
# View tasks
task-master list
task-master next

# Task management
task-master show <id>
task-master set-status --id=<id> --status=done
task-master add-task --prompt="description"

# Analysis
task-master analyze-complexity --research
task-master expand --id=<id> --research
```

### MCP Integration

Task Master provides MCP tools for AI agents:

```javascript
// Project setup
initialize_project;
parse_prd;

// Task workflow
get_tasks;
next_task;
get_task;
set_task_status;

// Task management
add_task;
expand_task;
update_task;
```

---

## Testing Strategy

### Unit Testing

| Project | Framework | Location |
|---------|-----------|----------|
| Backend | Jest | `quikadmin/tests/` |
| Frontend | Vitest | `quikadmin-web/src/__tests__/` |

### E2E Testing

Frontend E2E tests use Cypress:

```bash
cd quikadmin-web
bun run cypress:open        # Interactive mode
bun run cypress:run         # Headless mode
```

### Test Coverage Targets

- Backend: 80% minimum
- Frontend: 70% minimum
- E2E: Critical user flows

---

## Deployment Coordination

### Docker Deployment

```bash
# Start all services
docker-compose up -d

# Backend only
docker-compose up -d backend

# Frontend only
docker-compose up -d frontend
```

### Environment Configuration

Each environment requires:

1. **Backend `.env`**: Database, Supabase, Redis, JWT secrets
2. **Frontend `.env`**: API URL, Supabase public credentials

---

## Debugging & Troubleshooting

### Common Issues

#### Backend Won't Start

```bash
# Check port availability
netstat -an | findstr 3002

# Check environment
cd quikadmin && cat .env

# Check database
npx prisma db pull
```

#### Frontend Won't Connect to Backend

```bash
# Verify backend is running
curl http://localhost:3002/health

# Check CORS settings in backend
# Check VITE_API_URL in frontend .env
```

#### Database Connection Issues

```bash
# Test connection
cd quikadmin
npx ts-node scripts/test-neon-serverless.ts

# Reset connection pool
# Restart the backend server
```

### Log Locations

| Log | Location |
|-----|----------|
| Backend | `logs/backend.log` |
| Frontend | `logs/frontend.log` |
| Prisma | `logs/prisma.log` |

---

## Code Quality Standards

### TypeScript Standards

- **Strict mode**: Enabled in both projects
- **No `any`**: Use proper types or `unknown`
- **Explicit returns**: Type function returns explicitly
- **Interface over type**: Prefer interfaces for object shapes

### React Standards (Frontend)

- **Functional components**: No class components
- **Custom hooks**: Extract reusable logic
- **Zustand**: For global state
- **React Query**: For server state

### API Standards (Backend)

- **Input validation**: Use Zod/Joi schemas
- **Error handling**: Consistent error responses
- **Authentication**: Use middleware
- **Rate limiting**: Applied to all endpoints

---

## Documentation Standards

### Living Documentation Policy

**Documentation must be updated with every code change.** This is not optional.

See `docs/MAINTENANCE.md` for complete maintenance guidelines.

### When to Update Documentation

| Code Change | Required Documentation Update |
|-------------|------------------------------|
| New API endpoint | `docs/reference/api/endpoints.md` |
| Modified API response | `docs/reference/api/endpoints.md` |
| New env variable | `docs/reference/configuration/environment.md` |
| Schema change | `docs/reference/database/schema.md` |
| New feature | Appropriate tutorial or how-to |
| Fixed known issue | Remove from `CLAUDE.local.md` |
| New known issue | Add to `CLAUDE.local.md` |
| Architecture change | `docs/explanation/` |

### Documentation Locations

| Content Type | Location |
|--------------|----------|
| API Reference | `docs/reference/api/` |
| Tutorials | `docs/tutorials/` |
| How-to Guides | `docs/how-to/` |
| Architecture | `docs/explanation/` |
| Backend-specific | `quikadmin/docs/` |
| Frontend-specific | `quikadmin-web/docs/` |
| Maintenance Guide | `docs/MAINTENANCE.md` |

---

## Security Considerations

### Backend Security

- JWT token validation on all protected routes
- Rate limiting per IP/user
- Input validation and sanitization
- SQL injection prevention via Prisma
- XSS protection via sanitization
- CORS configuration

### Frontend Security

- No sensitive data in localStorage
- Token stored in httpOnly cookies
- Environment variables for secrets
- Input validation before submission

### Security Checklist Before Deployment

- [ ] No secrets in code or git history
- [ ] All inputs validated
- [ ] Authentication on protected routes
- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] Dependencies updated

---

## Agent Best Practices

### Before Making Changes

1. Understand the full context by reading relevant docs
2. Check for existing implementations
3. Follow established patterns in the codebase
4. Consider impact on both backend and frontend

### During Implementation

1. Write tests alongside code
2. Update documentation
3. Follow TypeScript best practices
4. Use consistent naming conventions

### After Implementation

1. Run all tests
2. Verify lint passes
3. Check type errors
4. Update relevant documentation
5. Consider cross-project impacts

---

## Related Documentation

- [CLAUDE.local.md](./CLAUDE.local.md) - Local development context
- [Backend CLAUDE.md](./quikadmin/CLAUDE.md) - Backend AI context
- [Frontend CLAUDE.md](./quikadmin-web/CLAUDE.md) - Frontend AI context
- [Documentation Hub](./docs/README.md) - Diátaxis documentation
- [Task Master Guide](./quikadmin/AGENTS.md) - Task Master integration

---

**Last Updated**: 2025-11-25
**Maintained By**: AI Development Team

