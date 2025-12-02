---
title: Local Development Setup
description: Set up your local development environment for IntelliFill
category: how-to
tags: [development, setup, local]
lastUpdated: 2025-11-25
---

# Local Development Setup

This guide covers setting up a complete local development environment for IntelliFill, including all services and debugging tools.

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18+ | Backend runtime |
| Bun | 1.x | Frontend package manager |
| Git | Any | Version control |
| PostgreSQL | 14+ | Database (or use Neon) |

### Optional Software

| Software | Version | Purpose |
|----------|---------|---------|
| Docker | 24+ | Containerization |
| Redis | 7+ | Caching/queues |
| VS Code | Latest | Recommended editor |

---

## Backend Setup

### 1. Install Dependencies

```bash
cd quikadmin
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
NODE_ENV=development
PORT=3002

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/intellifill"
DIRECT_URL="postgresql://user:password@localhost:5432/intellifill"

# Supabase
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# JWT
JWT_SECRET="your-32-character-secret-key-here"

# Redis (optional)
REDIS_URL="redis://localhost:6379"
```

### 3. Set Up Database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# (Optional) Seed data
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
```

The backend runs on http://localhost:3002

---

## Frontend Setup

### 1. Install Dependencies

```bash
cd quikadmin-web
bun install    # MUST use bun, not npm
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_API_URL=http://localhost:3002/api
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
```

### 3. Start Development Server

```bash
bun run dev
```

The frontend runs on http://localhost:8080

---

## Database Options

### Option A: Local PostgreSQL

```bash
# Install PostgreSQL (Windows)
choco install postgresql

# Create database
createdb intellifill

# Update DATABASE_URL in .env
DATABASE_URL="postgresql://postgres:password@localhost:5432/intellifill"
```

### Option B: Neon Serverless

1. Create account at [Neon](https://neon.tech)
2. Create a new project
3. Copy connection strings to `.env`

### Option C: Docker PostgreSQL

```bash
docker run -d \
  --name intellifill-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=intellifill \
  -p 5432:5432 \
  postgres:14
```

---

## Redis Setup (Optional)

Redis is used for caching and job queues. The application works without it using in-memory fallbacks.

### Local Installation

```bash
# Windows (using WSL or Memurai)
# Download from https://www.memurai.com/

# macOS
brew install redis
brew services start redis

# Linux
sudo apt install redis-server
sudo systemctl start redis
```

### Docker

```bash
docker run -d \
  --name intellifill-redis \
  -p 6379:6379 \
  redis:7
```

---

## Running All Services

### Using Multiple Terminals

```bash
# Terminal 1: Backend
cd quikadmin && npm run dev

# Terminal 2: Frontend
cd quikadmin-web && bun run dev

# Terminal 3: Prisma Studio (optional)
cd quikadmin && npx prisma studio
```

### Using Docker Compose

```bash
docker-compose up -d
```

This starts all services including PostgreSQL and Redis.

---

## IDE Configuration

### VS Code Extensions

Recommended extensions:
- ESLint
- Prettier
- Prisma
- Tailwind CSS IntelliSense
- TypeScript Vue Plugin (Volar)

### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

### Cursor Configuration

The project includes `.cursorrules` for Cursor IDE integration.

---

## Debugging

### Backend Debugging

```bash
# Start with debugger
npm run dev:debug

# Attach VS Code debugger
# Use "Attach to Node" configuration
```

### Frontend Debugging

Use browser DevTools:
- React DevTools extension
- Redux DevTools (for Zustand)
- Network tab for API calls

---

## Common Development Tasks

### Adding a New API Endpoint

1. Create route in `quikadmin/src/api/`
2. Add validation schema in `quikadmin/src/validators/`
3. Register in `quikadmin/src/api/routes.ts`
4. Write tests
5. Update documentation

### Adding a New Frontend Page

1. Create page in `quikadmin-web/src/pages/`
2. Add route in `App.tsx`
3. Create components as needed
4. Add store if needed
5. Write tests

### Database Changes

```bash
# Create migration
npx prisma migrate dev --name "description"

# Reset database (WARNING: deletes data)
npx prisma migrate reset

# View data
npx prisma studio
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port (Windows)
netstat -ano | findstr :3002

# Kill process
taskkill /PID <pid> /F
```

### Database Connection Failed

1. Check DATABASE_URL in `.env`
2. Verify PostgreSQL is running
3. Test with `npx prisma db pull`

### Prisma Client Out of Date

```bash
npx prisma generate
```

### Frontend Build Errors

```bash
# Clear cache and reinstall
rm -rf node_modules bun.lockb
bun install
```

---

## Next Steps

- [Database Setup](./database-setup.md) - Advanced database configuration
- [Testing](./testing.md) - Run and write tests
- [Docker Deployment](../deployment/docker-deployment.md) - Deploy with containers

---

## Related Documentation

- [Getting Started Tutorial](../../tutorials/getting-started.md)
- [Environment Variables](../../reference/configuration/environment.md)
- [Architecture Overview](../../reference/architecture/system-overview.md)

