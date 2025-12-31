---
title: System Overview
description: High-level architecture of the IntelliFill system
category: reference
tags: [architecture, system, design]
lastUpdated: 2025-12-31
---

# System Overview

This document describes the high-level architecture of IntelliFill, including its components, services, and how they interact.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  React Application                       │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │    │
│  │  │  Pages   │  │Components│  │  Stores  │  │Services │ │    │
│  │  │  (React) │  │ (Radix)  │  │(Zustand) │  │ (API)   │ │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼ HTTP/REST                         │
└─────────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────────┐
│                          BACKEND                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Express API Server                     │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │    │
│  │  │  Routes  │  │Middleware│  │Validators│  │ Services│ │    │
│  │  │ (API)    │  │(Auth/etc)│  │ (Zod)    │  │(Business│ │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │
│  │   Prisma    │      │    OCR      │      │    PDF      │     │
│  │    ORM      │      │  Service    │      │   Service   │     │
│  └─────────────┘      └─────────────┘      └─────────────┘     │
│         │                    │                    │             │
└─────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   PostgreSQL    │  │  Tesseract.js   │  │    pdf-lib      │
│    (Neon)       │  │     (OCR)       │  │    (Forms)      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
          │
          ▼
┌─────────────────┐
│  Supabase Auth  │
└─────────────────┘
```

---

## Technology Stack

### Frontend (`quikadmin-web/`)

| Layer | Technology | Purpose |
|-------|------------|---------|
| UI Framework | React 18 | Component-based UI |
| Build Tool | Vite | Fast development/builds |
| Language | TypeScript 5 | Type safety |
| Styling | TailwindCSS 4 | Utility-first CSS |
| Components | Radix UI | Accessible primitives |
| State | Zustand | Global state management |
| Data Fetching | React Query | Server state caching |
| Routing | React Router | Client-side routing |
| Forms | React Hook Form | Form management |
| Validation | Zod | Schema validation |

### Backend (`quikadmin/`)

| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Node.js 18 | JavaScript runtime |
| Framework | Express 4.18 | HTTP server |
| Language | TypeScript 5 | Type safety |
| ORM | Prisma 6 | Database access |
| Database | PostgreSQL 14 | Data persistence |
| Auth | Supabase Auth | User authentication |
| OCR | Tesseract.js 6 | Text extraction |
| PDF | pdf-lib 1.17 | Form filling |
| Queue | Bull | Job processing |
| Cache | Redis | Caching/rate limiting |

---

## Core Components

### Frontend Components

```
src/
├── pages/              # Route components
│   ├── Dashboard.tsx
│   ├── DocumentLibrary.tsx
│   ├── Login.tsx
│   └── ...
├── components/
│   ├── ui/             # Primitive UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── features/       # Feature-specific components
│   │   ├── file-upload-zone.tsx
│   │   ├── document-card.tsx
│   │   └── ...
│   └── layout/         # Layout components
├── stores/             # Zustand stores
│   ├── useAuthStore.ts
│   ├── documentStore.ts
│   └── ...
├── services/           # API services
│   ├── api.ts
│   ├── documentService.ts
│   └── ...
└── hooks/              # Custom React hooks
```

### Backend Components

```
src/
├── api/                # Route handlers
│   ├── routes.ts
│   ├── documents.routes.ts
│   ├── supabase-auth.routes.ts
│   └── ...
├── services/           # Business logic
│   ├── DocumentService.ts
│   ├── OCRService.ts
│   ├── IntelliFillService.ts
│   └── ...
├── middleware/         # Express middleware
│   ├── supabaseAuth.ts
│   ├── rateLimiter.ts
│   └── ...
├── database/           # Database access
│   └── DatabaseService.ts
├── extractors/         # Data extraction
│   └── DataExtractor.ts
├── mappers/            # Field mapping
│   └── FieldMapper.ts
├── fillers/            # Form filling
│   └── FormFiller.ts
└── validators/         # Input validation
    └── schemas/
```

---

## Data Flow

### Document Processing Flow

```
1. Upload          2. Store           3. Queue           4. Process
   ────────────────────────────────────────────────────────────────▶

   ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
   │ Client  │────▶│ API     │────▶│ Storage │────▶│ Queue   │
   │ Upload  │     │ Server  │     │ (File)  │     │ (Bull)  │
   └─────────┘     └─────────┘     └─────────┘     └─────────┘
                                                         │
   ┌─────────┐     ┌─────────┐     ┌─────────┐          │
   │ Client  │◀────│ API     │◀────│Database │◀─────────┘
   │ Receive │     │ Server  │     │ (Update)│
   └─────────┘     └─────────┘     └─────────┘

5. Return          6. Retrieve        7. Complete
   ◀─────────────────────────────────────────────
```

### Authentication Flow

```
1. Login Request
   Client ──────────────────────────▶ Backend API
                                          │
2. Verify with Supabase                   ▼
                                     Supabase Auth
                                          │
3. Return JWT                             │
   Client ◀──────────────────────────────┘

4. Subsequent Requests
   Client ──────[JWT Token]────────▶ Backend API
                                          │
5. Validate Token                         ▼
                                     Supabase Auth
                                          │
6. Return Data                            │
   Client ◀──────────────────────────────┘
```

---

## Key Services

### OCRService

Handles text extraction from images and PDFs using Tesseract.js.

**Responsibilities**:
- Image preprocessing (grayscale, sharpen, threshold)
- OCR text extraction
- Confidence scoring
- Multi-language support

### DataExtractor

Extracts structured data from raw OCR text.

**Responsibilities**:
- Pattern matching (regex)
- Entity recognition
- Data normalization
- Confidence calculation

### FieldMapper

Maps extracted data to PDF form fields.

**Responsibilities**:
- Field analysis
- Semantic matching
- ML-based mapping
- Mapping validation

### FormFiller

Fills PDF forms with mapped data.

**Responsibilities**:
- PDF parsing
- Field population
- Type handling (text, checkbox, etc.)
- PDF generation

---

## Security Architecture

### Authentication

- **Method**: JWT tokens via Supabase Auth
- **Storage**: httpOnly cookies
- **Refresh**: Automatic token refresh

### Authorization

- **Model**: Role-based (admin, user)
- **Enforcement**: Middleware on all protected routes
- **Ownership**: Users can only access their documents

### Data Protection

- **Transport**: HTTPS in production
- **Storage**: Encrypted at rest (database)
- **Secrets**: Environment variables only

---

## Database Connection Architecture

### Prisma Singleton Pattern

All services use a centralized Prisma singleton (`getPrismaClient()`) to prevent connection pool exhaustion:

```typescript
// utils/supabase.ts exports the singleton
import { getPrismaClient } from '../utils/supabase';

const prisma = getPrismaClient();
```

**Benefits**:
- Prevents duplicate connections on serverless (Neon)
- Enables connection keepalive for idle timeout prevention
- Consistent connection handling across all services

**Services using singleton**:
- `DocumentService.ts`
- `ProfileService.ts`
- `TemplateService.ts`
- `documents.routes.ts`
- `knowledge.routes.ts`
- `users.routes.ts`
- `ocrQueue.ts`

---

## Scalability Considerations

### Current Architecture

- **Single server**: Backend runs on one instance
- **Connection pooling**: Prisma singleton manages database connections
- **Job queue**: Bull handles async processing

### Scaling Options

1. **Horizontal scaling**: Multiple backend instances behind load balancer
2. **Database scaling**: Neon auto-scaling or read replicas
3. **CDN**: Static assets via CDN
4. **Queue workers**: Separate worker processes

---

## Related Documentation

- [API Endpoints](../api/endpoints.md)
- [Environment Variables](../configuration/environment.md)
- [Data Flow](../../explanation/data-flow.md)
- [Security Model](../../explanation/security-model.md)

