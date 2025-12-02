---
title: Database Schema
description: Reference for the IntelliFill database schema
category: reference
tags: [database, schema, prisma, postgresql]
lastUpdated: 2025-11-25
---

# Database Schema

Reference documentation for the IntelliFill PostgreSQL database schema, managed by Prisma ORM.

---

## Schema Location

```
quikadmin/prisma/schema.prisma
```

---

## Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐
│     User     │       │   Profile    │
├──────────────┤       ├──────────────┤
│ id (PK)      │◀──┐   │ id (PK)      │
│ email        │   │   │ userId (FK)  │───┐
│ name         │   │   │ data (JSON)  │   │
│ createdAt    │   │   │ updatedAt    │   │
└──────────────┘   │   └──────────────┘   │
       │           │                       │
       │           └───────────────────────┘
       │ 1:N
       ▼
┌──────────────┐       ┌──────────────┐
│   Document   │       │   Template   │
├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │
│ userId (FK)  │       │ userId (FK)  │
│ filename     │       │ name         │
│ status       │       │ fields (JSON)│
│ ocrText      │       │ isPublic     │
│ extracted    │       │ createdAt    │
└──────────────┘       └──────────────┘
```

---

## Tables

### User

Stores user account information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Unique identifier |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User email address |
| name | VARCHAR(255) | | Display name |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updatedAt | TIMESTAMP | | Last update timestamp |

**Indexes**:
- `users_email_key` UNIQUE on `email`

**Prisma Schema**:
```prisma
model User {
  id        String     @id @default(uuid())
  email     String     @unique
  name      String?
  createdAt DateTime   @default(now())
  updatedAt DateTime?  @updatedAt
  
  documents Document[]
  profile   Profile?
  templates Template[]
}
```

---

### Profile

Stores user profile data for form filling.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| userId | UUID | FK, UNIQUE | Reference to User |
| data | JSONB | NOT NULL | Profile data (name, address, etc.) |
| updatedAt | TIMESTAMP | | Last update timestamp |

**Indexes**:
- `profiles_userId_key` UNIQUE on `userId`

**Prisma Schema**:
```prisma
model Profile {
  id        String   @id @default(uuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  data      Json
  updatedAt DateTime @updatedAt
}
```

**Example data field**:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "(555) 123-4567",
  "address": {
    "street": "123 Main St",
    "city": "Anytown",
    "state": "CA",
    "zip": "12345"
  },
  "ssn": "123-45-6789",
  "dateOfBirth": "1990-01-15"
}
```

---

### Document

Stores uploaded documents and OCR results.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| userId | UUID | FK | Reference to User |
| filename | VARCHAR(255) | NOT NULL | Original filename |
| mimeType | VARCHAR(100) | NOT NULL | File MIME type |
| fileSize | INTEGER | | File size in bytes |
| storagePath | VARCHAR(500) | | Server file path |
| status | VARCHAR(50) | DEFAULT 'pending' | Processing status |
| ocrText | TEXT | | Raw OCR output |
| extracted | JSONB | | Extracted structured data |
| confidence | FLOAT | | OCR confidence score |
| metadata | JSONB | | Additional metadata |
| createdAt | TIMESTAMP | DEFAULT NOW() | Upload timestamp |
| processedAt | TIMESTAMP | | Processing completion time |

**Indexes**:
- `documents_userId_idx` on `userId`
- `documents_status_idx` on `status`

**Status Values**:
- `pending` - Waiting to process
- `processing` - Currently processing
- `completed` - Successfully processed
- `failed` - Processing failed
- `reviewed` - Manually reviewed

**Prisma Schema**:
```prisma
model Document {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  filename    String
  mimeType    String
  fileSize    Int?
  storagePath String?
  status      String    @default("pending")
  ocrText     String?   @db.Text
  extracted   Json?
  confidence  Float?
  metadata    Json?
  createdAt   DateTime  @default(now())
  processedAt DateTime?

  @@index([userId])
  @@index([status])
}
```

---

### Template

Stores PDF form templates and field mappings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| userId | UUID | FK | Template owner |
| name | VARCHAR(255) | NOT NULL | Template name |
| description | TEXT | | Template description |
| fields | JSONB | NOT NULL | Field definitions |
| mappings | JSONB | | Field-to-data mappings |
| isPublic | BOOLEAN | DEFAULT false | Publicly accessible |
| fileData | BYTEA | | Original PDF file |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updatedAt | TIMESTAMP | | Last update timestamp |

**Indexes**:
- `templates_userId_idx` on `userId`
- `templates_isPublic_idx` on `isPublic`

**Prisma Schema**:
```prisma
model Template {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  description String?  @db.Text
  fields      Json
  mappings    Json?
  isPublic    Boolean  @default(false)
  fileData    Bytes?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
  @@index([isPublic])
}
```

---

### Job

Stores async processing job information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| userId | UUID | FK | Job owner |
| type | VARCHAR(50) | NOT NULL | Job type |
| status | VARCHAR(50) | DEFAULT 'queued' | Job status |
| input | JSONB | | Job input data |
| result | JSONB | | Job result data |
| error | TEXT | | Error message if failed |
| progress | INTEGER | DEFAULT 0 | Completion percentage |
| createdAt | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| startedAt | TIMESTAMP | | Processing start time |
| completedAt | TIMESTAMP | | Processing completion time |

**Status Values**:
- `queued` - Waiting in queue
- `processing` - Currently processing
- `completed` - Successfully completed
- `failed` - Processing failed
- `cancelled` - Cancelled by user

---

## Migrations

### Running Migrations

```bash
cd quikadmin

# Create a new migration
npx prisma migrate dev --name "migration_name"

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

### Migration Files

Location: `quikadmin/prisma/migrations/`

Each migration has:
- Timestamp folder (e.g., `20251125100000_add_templates`)
- `migration.sql` - SQL statements

---

## Queries

### Common Prisma Queries

```typescript
// Get user with documents
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: { documents: true, profile: true }
});

// Get paginated documents
const documents = await prisma.document.findMany({
  where: { userId, status: 'completed' },
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: 'desc' }
});

// Update document status
await prisma.document.update({
  where: { id: documentId },
  data: { status: 'completed', processedAt: new Date() }
});

// Upsert profile
await prisma.profile.upsert({
  where: { userId },
  update: { data: profileData },
  create: { userId, data: profileData }
});
```

---

## Performance Tips

1. **Use indexes** for frequently queried columns
2. **Select only needed fields** with `select`
3. **Use pagination** for large result sets
4. **Batch operations** with `createMany`, `updateMany`
5. **Connection pooling** configured in DATABASE_URL

---

## Related Documentation

- [Database Setup](../../how-to/development/database-setup.md)
- [Environment Variables](../configuration/environment.md)
- [API Endpoints](../api/endpoints.md)

