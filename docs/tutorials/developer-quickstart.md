---
title: 'Developer Quickstart'
description: 'Get IntelliFill running locally in 15 minutes'
category: 'tutorial'
audience: 'developers'
lastUpdated: '2026-01-25'
status: 'active'
---

# Developer Quickstart

Get IntelliFill running on your local machine in 15 minutes.

---

## Prerequisites

Before you begin, ensure you have:

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| **Node.js** | 18+ | `node --version` |
| **npm** | 9+ | `npm --version` |
| **bun** | 1.0+ | `bun --version` |
| **PostgreSQL** | 14+ | `psql --version` (or use Neon) |
| **Git** | 2.30+ | `git --version` |

### Optional (for full features)

| Tool | Purpose |
|------|---------|
| **Docker** | Redis for queues |
| **Redis** | Background job processing |

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/your-org/intellifill.git
cd intellifill
```

---

## Step 2: Install Dependencies

IntelliFill uses **npm for backend** and **bun for frontend**:

```bash
# Backend dependencies
cd quikadmin
npm install

# Frontend dependencies
cd ../quikadmin-web
bun install
```

---

## Step 3: Configure Environment Variables

### Backend (.env)

Create `quikadmin/.env`:

```bash
# Copy the example file
cp .env.example .env
```

Edit with your values:

```env
# Database (Neon recommended for development)
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"

# Supabase Auth
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
JWT_SECRET="your-jwt-secret"

# Redis (optional for local dev - queues fall back to in-memory)
REDIS_URL="redis://localhost:6379"

# Logging
LOG_LEVEL="debug"
```

### Frontend (.env)

Create `quikadmin-web/.env`:

```env
# API Connection
VITE_API_URL="http://localhost:3002/api"
VITE_USE_BACKEND_AUTH=true

# Supabase (for direct auth - optional if using backend auth)
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
```

---

## Step 4: Set Up the Database

### Option A: Neon (Recommended)

1. Create a free account at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string to `DATABASE_URL` and `DIRECT_URL`

### Option B: Local PostgreSQL

```bash
# Create database
createdb intellifill_dev

# Update DATABASE_URL in .env
DATABASE_URL="postgresql://localhost/intellifill_dev"
```

### Run Migrations

```bash
cd quikadmin

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev
```

---

## Step 5: Start the Services

Open two terminal windows:

### Terminal 1: Backend API

```bash
cd quikadmin
npm run dev
```

Expected output:
```
🚀 Server running on http://localhost:3002
📊 Environment: development
✅ Database connected
```

### Terminal 2: Frontend UI

```bash
cd quikadmin-web
bun run dev
```

Expected output:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:8080/
  ➜  Network: use --host to expose
```

---

## Step 6: Verify the Installation

### Health Check

```bash
curl http://localhost:3002/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-25T...",
  "version": "1.0.0",
  "environment": "development"
}
```

### Access the UI

Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## Step 7: Create a Test User

### Option A: Through the UI

1. Navigate to http://localhost:8080/register
2. Fill in email, password, and name
3. Submit the form

### Option B: Through the API

```bash
curl -X POST http://localhost:3002/api/auth/v2/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!",
    "name": "Test User"
  }'
```

---

## Step 8: Upload Your First Document

1. Log in to the application
2. Navigate to **Documents** in the sidebar
3. Click **Upload Document**
4. Select a PDF, image, or document file
5. Wait for OCR processing (~2 seconds)
6. View extracted data

### Test Document

For testing, create a simple text file with:

```
Name: John Smith
Email: john@example.com
Phone: +1 555-123-4567
Date of Birth: 15/03/1985
```

Save as `test-document.txt` and upload.

---

## What's Next?

### Explore the Features

| Feature | Path | Description |
|---------|------|-------------|
| **Documents** | `/documents` | Upload and manage documents |
| **Clients** | `/clients` | Organize by client |
| **Templates** | `/templates` | Form template library |
| **Fill Forms** | `/fill-form` | Generate filled PDFs |

### Read the Documentation

| Topic | Link |
|-------|------|
| **API Reference** | [docs/reference/api/endpoints.md](../reference/api/endpoints.md) |
| **Architecture** | [docs/reference/architecture/system-overview.md](../reference/architecture/system-overview.md) |
| **Database Schema** | [docs/reference/database/schema.md](../reference/database/schema.md) |

### Development Tools

```bash
# Open Prisma Studio (Database GUI)
cd quikadmin && npx prisma studio

# Run backend tests
cd quikadmin && npm test

# Run frontend tests
cd quikadmin-web && bun test

# Type checking
cd quikadmin && npm run typecheck
```

---

## Common Issues

### Port Already in Use

```bash
# Find process using port 3002
lsof -i :3002 | grep LISTEN

# Or use a different port
PORT=3003 npm run dev
```

### Database Connection Failed

1. Check `DATABASE_URL` is correct
2. Ensure PostgreSQL/Neon is running
3. Verify network connectivity

```bash
# Test connection
npx prisma db pull
```

### Prisma Client Not Found

```bash
# Regenerate Prisma client
cd quikadmin && npx prisma generate
```

### bun Not Found (Frontend)

```bash
# Install bun
curl -fsSL https://bun.sh/install | bash

# Or use npm (slower)
cd quikadmin-web && npm install && npm run dev
```

---

## Optional: Redis for Queues

For background job processing (OCR queue):

```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine

# Verify
redis-cli ping
# Should return: PONG
```

Update `quikadmin/.env`:
```env
REDIS_URL="redis://localhost:6379"
```

---

## Project Structure

```
IntelliFill/
├── quikadmin/              # Backend API
│   ├── src/
│   │   ├── api/            # Route handlers
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth, validation
│   │   ├── extractors/     # OCR/data extraction
│   │   ├── fillers/        # PDF form filling
│   │   └── mappers/        # Field mapping
│   ├── prisma/             # Database schema
│   └── tests/              # Jest tests
│
├── quikadmin-web/          # Frontend UI
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── stores/         # Zustand stores
│   │   └── hooks/          # Custom hooks
│   └── tests/              # Vitest tests
│
└── docs/                   # Documentation
```

---

## Getting Help

| Resource | Link |
|----------|------|
| **Documentation Hub** | [docs/README.md](../README.md) |
| **Troubleshooting** | [docs/how-to/troubleshooting/](../how-to/troubleshooting/) |
| **API Reference** | [docs/reference/api/endpoints.md](../reference/api/endpoints.md) |

---

**Estimated setup time: 15 minutes**

*Happy coding!*
