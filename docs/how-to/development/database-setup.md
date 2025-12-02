---
title: Database Setup
description: Configure and manage the PostgreSQL database for IntelliFill
category: how-to
tags: [database, postgresql, prisma, neon]
lastUpdated: 2025-11-25
---

# Database Setup

This guide covers setting up and managing the PostgreSQL database for IntelliFill, including local development, Neon serverless, and migrations.

---

## Database Options

IntelliFill supports multiple PostgreSQL hosting options:

| Option | Best For | Pros | Cons |
|--------|----------|------|------|
| Local PostgreSQL | Offline development | Fast, free | Manual setup |
| Neon Serverless | Cloud development | Easy setup, free tier | Connection limits |
| Docker PostgreSQL | Containerized dev | Consistent, portable | Requires Docker |
| Supabase | Full-stack | Auth + DB together | More complex |

---

## Option 1: Neon Serverless (Recommended)

### Setup

1. Create account at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy connection strings

### Configuration

In `quikadmin/.env`:

```env
# Pooled connection (for Prisma client)
DATABASE_URL="postgresql://user:password@ep-xxx.region.neon.tech/neondb?sslmode=require"

# Direct connection (for migrations)
DIRECT_URL="postgresql://user:password@ep-xxx.region.neon.tech/neondb?sslmode=require"
```

### Known Issues

**Connection Drops**: Neon may disconnect after ~5-8 minutes of idle time.

**Workaround**: Restart the backend if you see connection errors after idle periods.

**Recommended Fix**: Use connection pooling endpoint (has `-pooler` in hostname).

---

## Option 2: Local PostgreSQL

### Installation

**Windows**:
```bash
# Using Chocolatey
choco install postgresql

# Or download from postgresql.org
```

**macOS**:
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Linux**:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Create Database

```bash
# Create user and database
sudo -u postgres createuser --interactive
sudo -u postgres createdb intellifill

# Or using psql
psql -U postgres
CREATE DATABASE intellifill;
CREATE USER myuser WITH PASSWORD 'mypassword';
GRANT ALL PRIVILEGES ON DATABASE intellifill TO myuser;
```

### Configuration

```env
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/intellifill"
DIRECT_URL="postgresql://myuser:mypassword@localhost:5432/intellifill"
```

---

## Option 3: Docker PostgreSQL

### Run Container

```bash
docker run -d \
  --name intellifill-postgres \
  -e POSTGRES_USER=intellifill \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=intellifill \
  -p 5432:5432 \
  -v intellifill-pgdata:/var/lib/postgresql/data \
  postgres:14
```

### Configuration

```env
DATABASE_URL="postgresql://intellifill:password@localhost:5432/intellifill"
DIRECT_URL="postgresql://intellifill:password@localhost:5432/intellifill"
```

### Docker Compose

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_USER: intellifill
      POSTGRES_PASSWORD: password
      POSTGRES_DB: intellifill
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

---

## Prisma Setup

### Initialize Prisma

```bash
cd quikadmin

# Generate Prisma client
npx prisma generate

# Push schema to database (development only)
npx prisma db push

# Or run migrations
npx prisma migrate dev
```

### Common Prisma Commands

| Command | Purpose |
|---------|---------|
| `npx prisma generate` | Regenerate Prisma client |
| `npx prisma migrate dev` | Create and run migration |
| `npx prisma migrate deploy` | Deploy migrations (production) |
| `npx prisma db push` | Push schema without migration |
| `npx prisma db pull` | Pull schema from database |
| `npx prisma studio` | Open database GUI |
| `npx prisma migrate reset` | Reset database (deletes data!) |

---

## Schema Overview

The IntelliFill database schema includes:

### Core Tables

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  documents Document[]
  profile   Profile?
}

model Document {
  id          String   @id @default(uuid())
  filename    String
  mimeType    String
  status      String   @default("pending")
  ocrText     String?
  extracted   Json?
  confidence  Float?
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  createdAt   DateTime @default(now())
}

model Profile {
  id        String   @id @default(uuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
  data      Json
  updatedAt DateTime @updatedAt
}
```

### View Full Schema

```bash
cat quikadmin/prisma/schema.prisma
```

---

## Migrations

### Creating a Migration

```bash
# Make changes to prisma/schema.prisma, then:
npx prisma migrate dev --name "add_new_field"
```

### Migration Best Practices

1. **Descriptive names**: `add_user_phone`, `remove_legacy_columns`
2. **One change per migration**: Easier to rollback
3. **Test locally first**: Run on local database before staging
4. **Review SQL**: Check `prisma/migrations/*/migration.sql`

### Deploying Migrations

```bash
# Production deployment
npx prisma migrate deploy
```

---

## Seeding Data

### Seed Script

Create or edit `quikadmin/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create test user
  await prisma.user.upsert({
    where: { email: 'admin@intellifill.com' },
    update: {},
    create: {
      email: 'admin@intellifill.com',
      name: 'Admin User',
    },
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Run Seed

```bash
npm run db:seed
# or
npx prisma db seed
```

---

## Troubleshooting

### Connection Refused

```bash
# Check if PostgreSQL is running
pg_isready

# Check port
netstat -an | grep 5432
```

### Permission Denied

```sql
-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE intellifill TO myuser;
GRANT ALL ON SCHEMA public TO myuser;
```

### Prisma Client Outdated

```bash
# Regenerate client
npx prisma generate
```

### Migration Failed

```bash
# Reset migrations (WARNING: deletes data)
npx prisma migrate reset

# Or fix manually and mark as applied
npx prisma migrate resolve --applied "migration_name"
```

---

## Performance Tips

1. **Use connection pooling**: Set `connection_limit` in connection string
2. **Index frequently queried fields**: Add `@@index` to schema
3. **Use select**: Only fetch needed fields
4. **Avoid N+1**: Use `include` for related data

### Example: Connection Pooling

```env
DATABASE_URL="postgresql://user:pass@host/db?connection_limit=10"
```

### Example: Adding Index

```prisma
model Document {
  // ...fields
  @@index([userId])
  @@index([status])
}
```

---

## Backup and Restore

### Backup

```bash
pg_dump -U postgres intellifill > backup.sql
```

### Restore

```bash
psql -U postgres intellifill < backup.sql
```

---

## Related Documentation

- [Local Setup](./local-setup.md)
- [Environment Variables](../../reference/configuration/environment.md)
- [Schema Reference](../../reference/database/schema.md)

