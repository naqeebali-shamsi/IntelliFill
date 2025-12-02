---
title: Getting Started
description: Set up your IntelliFill development environment from scratch
category: tutorials
tags: [setup, development, quickstart]
lastUpdated: 2025-11-25
---

# Getting Started

This tutorial walks you through setting up IntelliFill for local development. By the end, you'll have both the backend API and frontend UI running.

**Time Required**: 30 minutes

---

## Prerequisites

Before starting, ensure you have:

- **Node.js 18+**: [Download](https://nodejs.org/)
- **Bun**: [Install](https://bun.sh/) - `curl -fsSL https://bun.sh/install | bash`
- **Git**: [Download](https://git-scm.com/)
- **Docker** (optional): [Download](https://www.docker.com/)

### Verify Installation

```bash
node --version    # Should be 18.x or higher
bun --version     # Should be 1.x or higher
git --version     # Any recent version
```

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/IntelliFill.git
cd IntelliFill
```

---

## Step 2: Set Up the Backend

### Install Dependencies

```bash
cd quikadmin
npm install
```

### Configure Environment

Create a `.env` file in the `quikadmin/` directory:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Server
NODE_ENV=development
PORT=3002

# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
DIRECT_URL="postgresql://user:password@host/database?sslmode=require"

# Authentication (Supabase)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# JWT
JWT_SECRET="your-secret-key-at-least-32-chars"

# Redis (optional)
REDIS_URL="redis://localhost:6379"
```

### Set Up Database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (if database is empty)
npx prisma migrate dev
```

### Start Backend

```bash
npm run dev
```

You should see:

```
🚀 Server running on port 3002
✅ Database connected
```

### Verify Backend

Open a new terminal and test:

```bash
curl http://localhost:3002/health
```

Expected response:

```json
{"status":"ok","timestamp":"...","version":"1.0.0","environment":"development"}
```

---

## Step 3: Set Up the Frontend

Open a new terminal:

```bash
cd quikadmin-web
bun install
```

### Configure Environment

Create a `.env` file:

```bash
cp .env.example .env
```

Edit with your settings:

```env
VITE_API_URL=http://localhost:3002/api
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
```

### Start Frontend

```bash
bun run dev
```

You should see:

```
  VITE v4.x.x  ready in xxx ms

  ➜  Local:   http://localhost:8080/
```

---

## Step 4: Verify Everything Works

### Open the Application

Visit http://localhost:8080 in your browser.

You should see the IntelliFill login page with:
- Dark theme UI
- Email and password fields
- "Use demo credentials" button
- Registration link

### Test Login (with Demo Credentials)

Click "Use demo credentials" to auto-fill:
- Email: `admin@intellifill.com`
- Password: `Admin123!`

If authentication is properly configured, you'll be logged in.

---

## Step 5: Optional - Start Prisma Studio

To view and edit database records:

```bash
cd quikadmin
npx prisma studio
```

Opens at http://localhost:5555

---

## Summary

You now have running:

| Service | URL | Status |
|---------|-----|--------|
| Backend API | http://localhost:3002 | ✅ |
| Frontend UI | http://localhost:8080 | ✅ |
| Prisma Studio | http://localhost:5555 | ✅ (optional) |

---

## Next Steps

- [Your First Document](./first-document.md) - Upload and process a document
- [Understanding the Workflow](./understanding-workflow.md) - Learn the processing pipeline
- [Local Setup Guide](../how-to/development/local-setup.md) - Advanced configuration

---

## Troubleshooting

### Backend won't start

```bash
# Check if port is in use
netstat -an | findstr 3002

# Check environment variables
cat .env

# Check database connection
npx prisma db pull
```

### Frontend can't connect to backend

```bash
# Verify backend is running
curl http://localhost:3002/health

# Check VITE_API_URL in .env
cat .env | grep VITE_API_URL
```

### Database connection errors

See [Database Issues](../how-to/troubleshooting/database-issues.md)

---

## Related Documentation

- [Prerequisites](./prerequisites.md)
- [Environment Variables](../reference/configuration/environment.md)
- [System Overview](../reference/architecture/system-overview.md)

