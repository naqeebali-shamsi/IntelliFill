# QuikAdmin - Current Architecture (Reality Check)

**Last Updated:** 2025-01-10
**Status:** Early Development / Pre-MVP
**Purpose:** Document actual implementation, not aspirational vision

---

## Executive Summary

QuikAdmin (formerly IntelliFill) is a document processing platform currently in early development. This document describes the **actual current architecture** as implemented, not future plans.

**What We Have:**
- Monolithic Node.js/Express API
- React SPA frontend
- PostgreSQL database with Prisma ORM
- Redis-backed job queues (Bull 4.11.5)
- Custom JWT authentication
- Windows development environment
- Basic Docker deployment support
- TensorFlow.js-based field mapping model

**What We Don't Have (Yet):**
- Kubernetes/container orchestration
- Microservices architecture
- API gateway (using nginx reverse proxy only)
- Distributed tracing
- ELK stack logging (using Winston console logs)
- Auto-scaling infrastructure
- Service mesh
- Kong Gateway / HAProxy
- Elasticsearch
- Message queue clustering

---

## Technology Stack (Actual)

### Backend
- **Runtime:** Node.js 18+ (targeting 20.x)
- **Framework:** Express.js 4.18
- **Language:** TypeScript 5.3
- **ORM:** Prisma 6.14.0
- **Database:** PostgreSQL 15-16 (local or Neon cloud)
- **Cache/Queue:** Redis 4.x with Bull 4.11.5 (legacy version)
- **Authentication:** Custom JWT (HS256) with bcrypt password hashing

### Frontend
- **Framework:** React 18.2
- **Build Tool:** Vite 4.5
- **State Management:** Zustand 5.0.7
- **Routing:** React Router 6.18
- **UI Components:** Radix UI primitives
- **Styling:** Tailwind CSS 4.0-beta
- **HTTP Client:** Axios 1.6.2
- **Runtime (Dev):** Bun (alternative to npm)

### Document Processing
- **PDF Manipulation:** pdf-lib 1.17.1
- **PDF Parsing:** pdfjs-dist 3.11.174
- **OCR:** Tesseract.js 6.0.1
- **DOCX Processing:** mammoth 1.6.0
- **Image Processing:** sharp 0.33.5
- **CSV Parsing:** csv-parse 5.5.3

### ML/AI
- **Current:** Custom TensorFlow.js (@tensorflow/tfjs-node 4.22.0) model for field mapping
- **Accuracy:** ~85-90% (insufficient for production)
- **Planned Migration:** OpenAI GPT-4o-mini for intelligent field extraction (99%+ accuracy)

### Security & Middleware
- **Security Headers:** Helmet.js 8.1.0
- **CORS:** cors 2.8.5
- **Rate Limiting:** express-rate-limit 7.1.5
- **Cookie Parsing:** cookie-parser 1.4.7
- **Password Hashing:** bcrypt 6.0.0

### Infrastructure
- **Development:** Windows native (no Docker by default)
- **Reverse Proxy:** nginx for Windows (port 80)
- **CI/CD:** GitHub Actions
- **Deployment:** TBD (VPS or cloud platform)
- **Process Management:** ts-node-dev (dev), PM2 or Docker (production planned)

### Testing
- **Unit/Integration:** Jest 29.7.0 + ts-jest 29.4.1
- **API Testing:** Supertest 6.3.4
- **E2E Testing:** Puppeteer 24.16.0
- **UI Testing:** Cypress 15.2.0 (frontend)

---

## Architecture Diagram (Current State)

### Development Architecture (Windows Native)

```
[User Browser]
      ↓
[nginx :80] ← Reverse proxy (Windows native)
      ↓
      ├─→ [React SPA :5173] ← Vite dev server (Bun)
      └─→ [Express API :3002] ← ts-node-dev (hot reload)
            ↓
            ├─→ [PostgreSQL :5432] ← Prisma ORM
            ├─→ [Redis :6379] ← Bull queues + session cache
            ├─→ [File System] ← Temp file storage (./uploads, ./outputs)
            └─→ [TensorFlow.js] ← Field mapping model (./models)
```

### Docker Deployment (Optional)

```
[nginx reverse proxy :80]
      ↓
      ├─→ [React SPA :5173] ← Vite container
      └─→ [Express API :3001]
            ↓
            ├─→ [PostgreSQL :5432] ← postgres:15-alpine
            ├─→ [Redis :6379] ← redis:7-alpine
            └─→ [Worker Process] ← Bull queue processor
```

**Production Deployment (Planned):**
```
[CDN/Static Host] ← React build (Vercel/Netlify)
         ↓
[API Server] ← Express + PM2/Docker (Render/Railway/VPS)
    ↓
    ├─→ [PostgreSQL] ← Managed DB (Neon/Supabase)
    ├─→ [Redis] ← Managed cache (Upstash)
    └─→ [Object Storage] ← S3-compatible storage (planned)
```

---

## Core Services (Monolithic API)

### 1. Authentication Service
**File:** `src/services/PrismaAuthService.ts` (429 LOC)
**Status:** ⚠️ Security vulnerabilities patched (Phase 0 complete), but high maintenance burden

**Current Implementation:**
- Email/password authentication
- JWT access tokens (15min expiry)
- Refresh tokens stored in PostgreSQL (7-day expiry)
- bcrypt password hashing (12 rounds)
- Manual session management
- Explicit HS256 algorithm enforcement (CVE prevention)

**Features:**
- `register()` - User registration with full name parsing
- `login()` - Credential verification with account status check
- `verifyToken()` - JWT verification with algorithm confusion prevention
- `refreshToken()` - Token refresh with stored token validation
- `logout()` - Single device logout
- `logoutAllDevices()` - Revoke all refresh tokens
- `getUserProfile()` - Retrieve user information
- `changePassword()` - Password change with validation

**Security Hardening (Completed):**
- Removed hardcoded secrets
- Fixed JWT algorithm confusion vulnerability (CVE-2015-9235)
- Eliminated authentication bypass (OWASP A07:2021)
- Environment validation on startup (fail-fast)
- JWT expiry reduced from 1h to 15min
- Explicit algorithm specification in verification
- Token structure validation (3-part JWT)
- Header algorithm validation (reject 'none' and non-HS256)
- Payload integrity checks
- Clock drift tolerance (30s, industry standard)

**Limitations:**
- No 2FA/MFA support
- No OAuth/SSO integration
- No password reset flow (email service placeholder)
- No session IP/device tracking
- No brute-force protection (basic rate limiting only)
- High maintenance burden (429 LOC of security-critical code)

**Planned Migration:** → Supabase Auth (Phase 4)
- Eliminates 429 LOC of custom code
- Provides 2FA, OAuth, magic links out-of-box
- SOC2 certified, professionally maintained
- $0/month for MVP scale
- 2-3 day migration timeline

### 2. Document Processing Pipeline
**Files:**
- `src/services/IntelliFillService.ts` (274 LOC) - Main orchestration service
- `src/services/DocumentParser.ts` - Document format detection and parsing
- `src/services/OCRService.ts` (240 LOC) - OCR processing with Tesseract.js
- `src/extractors/DataExtractor.ts` - Data extraction from parsed documents
- `src/fillers/FormFiller.ts` - PDF form filling with pdf-lib
- `src/validators/ValidationService.ts` - Data validation

**Processing Flow:**
1. User uploads source document + target form via API
2. `DocumentParser` detects format (PDF, DOCX, TXT, CSV) and parses
3. `DataExtractor` extracts structured data, entities, key-value pairs
4. `OCRService` processes images if text extraction fails (Tesseract.js)
5. `FieldMapper` matches source → target fields using ML model
6. `ValidationService` validates data types and business rules
7. `FormFiller` populates PDF form fields using pdf-lib
8. User downloads filled document

**IntelliFillService API:**
- `processSingle(documentPath, formPath, outputPath)` - Process single document
- `processMultiple(documentPaths, formPath, outputPath)` - Merge multiple sources
- `batchProcess(jobs[])` - Batch processing for multiple jobs
- `validateDocument(documentPath)` - Validate document before processing
- `fillPDF(formPath, data, outputPath)` - Direct PDF filling
- `extractFormFields(formPath)` - Extract PDF form field names
- `mergeDocuments(documents[])` - Merge multiple PDFs

**Supported Formats:**
- **PDF**: Text extraction, form fields, OCR fallback for images
- **DOCX**: Structured content via mammoth.js
- **TXT**: Pattern recognition and key-value extraction
- **CSV**: Column mapping and data typing

**Current Limitations:**
- ⚠️ **OCR Service Placeholder:** PDF-to-image conversion (line 162-173) not production-ready
- No multi-page batch processing
- No progress tracking for long-running jobs
- Limited semantic understanding (relies on manual feature engineering)
- Single-threaded processing (no parallel document handling)
- No job prioritization or scheduling

**Job Queue Integration:**
- Documents pushed to Bull queue for async processing
- `src/services/documentQueue.ts` (226 LOC)
- Exponential backoff retry on failure
- Job progress tracking via Redis

### 3. ML Field Mapping Model
**File:** `src/ml/FieldMappingModel.ts` (334 LOC)
**Status:** ⚠️ Functional but insufficient accuracy for production (85-90%)

**Architecture:**
- Custom TensorFlow.js neural network
- Input: 8 manual features
- Hidden layers: 64 → 32 → 16 neurons
- Output: Binary classification (match/no match)
- Optimizer: Adam (learning rate 0.001)
- Loss: Binary cross-entropy
- Metrics: Accuracy, precision, recall

**Feature Engineering (Manual):**
1. **Text Similarity** - Levenshtein distance normalized
2. **Semantic Similarity** - Jaccard similarity on word sets
3. **Type Similarity** - Field type matching (email, phone, date, etc.)
4. **Length Similarity** - String length comparison
5. **Positional Similarity** - Numeric indicator matching
6. **Common Tokens** - Binary flag for shared words
7. **Exact Match** - Binary flag for exact match (normalized)
8. **Pre-calculated Similarity** - External similarity score

**Training:**
- Requires labeled training data (source-target field pairs)
- 100 epochs with 80/20 train-validation split
- Batch size: 32
- Dropout: 20% (regularization)
- L2 regularization: 0.001
- Model saved to `./models/field-mapping/`

**API:**
- `initialize()` - Load or create model
- `train(trainingData[])` - Train on labeled data
- `predict(formField, documentField, similarity)` - Predict match confidence
- `evaluateModel(testData[])` - Calculate accuracy, precision, recall, F1
- `saveModel()` / `loadModel()` - Persistence

**Performance:**
- Accuracy: ~85-90% (acceptable for prototype)
- Latency: ~10-50ms per prediction
- Model size: ~500KB

**Limitations:**
- Manual feature engineering (no transfer learning)
- Requires training data collection and labeling
- Limited semantic understanding (word overlap only)
- No context awareness (isolated field matching)
- Complex deployment (native TensorFlow bindings on Windows)
- Maintenance burden (334 LOC)

**Planned Migration:** → OpenAI GPT-4o-mini (Phase 4)
- Eliminates 334 LOC of custom ML code
- 99%+ accuracy (semantic understanding)
- Zero training data required
- Semantic field matching with context
- $3-30/month cost (negligible for B2B SaaS)
- 1-2 day migration timeline

### 4. Job Queue System
**File:** `src/services/documentQueue.ts` (226 LOC)
**Status:** ⚠️ Using legacy Bull 4.11.5 (should upgrade to BullMQ)

**Architecture:**
- Redis-backed job queue (Bull 4.11.5)
- Worker process: `npm run dev:worker`
- Separate worker container in Docker deployment

**Queues:**
- `documentProcessingQueue` - Main document processing
- `batchProcessingQueue` - Batch job processing
- `emailQueue` - Email notifications (placeholder)

**Features:**
- Exponential backoff retry (3 attempts)
- Job progress tracking (0-100%)
- Job status: waiting, active, completed, failed, delayed
- Job events: completed, failed, progress
- Redis persistence (job data survives restarts)

**Configuration:**
- Max retry attempts: 3
- Backoff delay: exponential (1s, 2s, 4s)
- Concurrency: 5 jobs per worker
- Job timeout: 5 minutes

**Limitations:**
- Using legacy Bull 4.11.5 (not BullMQ)
- Single worker instance (no horizontal scaling)
- No job prioritization
- No scheduled jobs (cron support)
- Basic observability (no UI dashboard)

**Planned Upgrade:** → BullMQ (Phase 4)
- TypeScript-first API
- 2-3x faster performance
- Better observability (Bull Board UI)
- Built-in job prioritization
- Cron scheduling support
- Same Redis backend (zero migration cost)
- 1-day migration timeline

---

## Database Schema (Prisma)

**File:** `prisma/schema.prisma` (122 lines)

**Models:**

### User
- `id` - UUID primary key
- `email` - Unique, required
- `password` - bcrypt hash, required
- `firstName`, `lastName` - Optional
- `role` - Enum: ADMIN, USER, VIEWER (default: USER)
- `isActive` - Boolean (default: true)
- `emailVerified` - Boolean (default: false)
- `createdAt`, `updatedAt`, `lastLogin` - Timestamps
- **Relations:** RefreshToken[], Document[], Session[], Template[], FieldMapping[]

### RefreshToken
- `id` - UUID primary key
- `token` - Unique, JWT string
- `userId` - Foreign key to User
- `expiresAt` - Expiration timestamp
- `createdAt` - Creation timestamp
- **Relations:** User (CASCADE delete)

### Session
- `id` - UUID primary key
- `userId` - Foreign key to User
- `token` - Unique session token
- `ipAddress`, `userAgent` - Optional tracking (not currently used)
- `expiresAt` - Expiration timestamp
- `createdAt` - Creation timestamp
- **Relations:** User (CASCADE delete)

### Document
- `id` - UUID primary key
- `userId` - Foreign key to User
- `fileName`, `fileType`, `fileSize` - File metadata
- `storageUrl` - File location (local path or S3 URL)
- `status` - Enum: PENDING, PROCESSING, COMPLETED, FAILED, ARCHIVED
- `extractedText` - Extracted document text (nullable)
- `extractedData` - JSON field for structured data
- `confidence` - Float (0-1) for extraction confidence
- `templateId` - Optional foreign key to Template
- `processedAt` - Processing completion timestamp
- `createdAt`, `updatedAt` - Timestamps
- **Relations:** User, Template (CASCADE delete)

### Template
- `id` - UUID primary key
- `name`, `description` - Template metadata
- `userId` - Foreign key to User
- `fieldMappings` - JSON field for saved mappings
- `documentType` - String classifier (e.g., "W-9", "I-9", "Invoice")
- `isActive` - Boolean (default: true)
- `createdAt`, `updatedAt` - Timestamps
- **Relations:** User, Document[] (CASCADE delete)

### FieldMapping
- `id` - UUID primary key
- `userId` - Foreign key to User
- `sourceField`, `targetField` - Field names
- `transformRules` - JSON field for transformation logic
- `confidence` - Float (0-1) for mapping confidence (default: 1.0)
- `isActive` - Boolean (default: true)
- `createdAt`, `updatedAt` - Timestamps
- **Relations:** User (CASCADE delete)

**Enums:**
- `UserRole`: ADMIN, USER, VIEWER
- `DocumentStatus`: PENDING, PROCESSING, COMPLETED, FAILED, ARCHIVED

**Database Provider:**
- Development: Local PostgreSQL 16 or Neon cloud
- Production: TBD (likely Neon, Supabase, or managed PostgreSQL)

**Migrations:**
- Managed via Prisma Migrate: `npx prisma migrate dev`
- Migration files stored in `prisma/migrations/`

---

## API Structure

**Base URL:** `http://localhost:3002/api` (development)

**Entry Point:** `src/index.ts` (250 LOC)
**Routes Setup:** `src/api/routes.ts`

### Core Routes

#### Authentication (`src/api/auth.routes.ts`)
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login (returns access + refresh tokens)
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Single device logout
- `POST /api/auth/logout-all` - All devices logout
- `GET /api/auth/profile` - Get user profile (protected)
- `POST /api/auth/change-password` - Change password (protected)

#### Documents (`src/api/documents.routes.ts`)
- `POST /api/documents/upload` - Upload document
- `GET /api/documents/:id` - Get document metadata
- `GET /api/documents/:id/download` - Download processed document
- `POST /api/documents/process` - Process document with form
- `DELETE /api/documents/:id` - Delete document

#### Statistics (`src/api/stats.routes.ts`)
- `GET /api/stats/overview` - System statistics (protected)
- `GET /api/stats/user/:userId` - User-specific stats (protected)

#### Health & Monitoring
- `GET /health` - Health check (public)
  ```json
  {
    "status": "ok",
    "timestamp": "2025-01-10T12:00:00.000Z",
    "version": "1.0.0",
    "environment": "development"
  }
  ```

**Authentication:** Bearer JWT in `Authorization` header
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Rate Limiting:**
- Standard API routes: 100 req/15min (per IP)
- Auth endpoints: 5 req/15min (per IP)
- Upload endpoints: 10 req/15min (per IP)

**Error Handling:**
- JWT errors: 401 Unauthorized
- Validation errors: 400 Bad Request
- Not found: 404 Not Found
- Server errors: 500 Internal Server Error (message hidden in production)

**CORS Configuration:**
- Allowed origins: `http://localhost:3000`, `http://localhost:3001`, `http://localhost:5173`
- Credentials: Enabled (cookies, authorization headers)

---

## Testing Strategy

### Current Test Structure
```
tests/
├── unit/                    # Service unit tests
│   ├── AuthService.test.ts  # Authentication logic tests
│   └── FieldMapper.test.ts  # Field mapping tests
├── integration/             # API integration tests
│   ├── api.test.ts          # General API tests
│   ├── auth.test.ts         # Auth endpoint tests
│   └── queue.test.ts        # Job queue tests
├── e2e/                     # Puppeteer E2E tests
│   └── workflow.test.ts     # Full document processing workflow
├── security/                # Security-specific tests
│   ├── rate-limit.test.ts   # Rate limiting tests
│   └── csrf.test.ts         # CSRF protection tests
└── swarm/                   # Multi-agent test orchestration (experimental)
    ├── run-swarm.js         # Swarm test runner
    └── agents/              # Specialized test agents
        ├── api-tester.js    # API testing agent
        └── security-tester.js # Security testing agent
```

**Frontend Tests:**
```
web/cypress/
├── e2e/                     # End-to-end UI tests
│   ├── login.cy.ts          # Login flow tests
│   ├── dashboard.cy.ts      # Dashboard tests
│   └── document-upload.cy.ts # Upload flow tests
└── support/                 # Cypress helpers
```

**Test Tools:**
- **Jest 29.7.0** - Unit and integration tests
- **Supertest 6.3.4** - API endpoint testing
- **Puppeteer 24.16.0** - Backend E2E tests
- **Cypress 15.2.0** - Frontend E2E tests
- **ts-jest 29.4.1** - TypeScript support for Jest

**Test Scripts:**
- `npm test` - Run all Jest tests
- `npm run test:watch` - Jest watch mode
- `npm run test:e2e` - Puppeteer E2E tests (⚠️ currently skipped in CI)
- `npm run test:swarm` - Multi-agent test orchestration
- `cd web && npm run test:e2e` - Cypress tests

**Coverage:**
- Target: >95% (aspirational, not measured yet)
- Current: Unknown (no coverage reporting configured)

**CI/CD:**
- GitHub Actions workflow
- Currently skipping Puppeteer tests in CI (non-headless browser issues)
- Some tests temporarily skipped to unblock pipeline (technical debt)

---

## Security Posture

### Phase 0: Emergency Fixes (✅ COMPLETED)

**Critical Vulnerabilities Fixed:**
1. ✅ Removed ALL hardcoded secrets from codebase
2. ✅ Fixed JWT algorithm confusion vulnerability (CVE-2015-9235)
   - Explicitly enforce HS256 algorithm
   - Reject 'none' algorithm
   - Validate token header before verification
3. ✅ Eliminated authentication bypass vulnerability
   - Proper token validation
   - Payload integrity checks
4. ✅ Implemented startup environment validation
   - Fail-fast on missing critical env vars
   - Enforce minimum secret length (64 chars)
   - Production-specific validation
5. ✅ Reduced JWT expiry from 1h to 15 minutes
   - Minimizes impact of token theft
   - Forces frequent refresh (standard industry practice)

**Security Middleware Implemented:**
- Helmet.js 8.1.0 - Security headers
  - Content Security Policy (CSP)
  - HSTS (max-age: 31536000, includeSubDomains, preload)
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
- express-rate-limit 7.1.5 - Rate limiting
  - Standard: 100 req/15min per IP
  - Auth: 5 req/15min per IP
  - Upload: 10 req/15min per IP
- CORS 2.8.5 - Cross-origin protection
- Cookie-parser 1.4.7 - Secure cookie handling

**CSRF Protection:**
- Implemented in `src/middleware/csrf.ts`
- Currently disabled for testing (⚠️ re-enable for production)

### Pending Security Improvements

**High Priority:**
- ⏳ Re-enable CSRF protection for state-changing operations
- ⏳ Implement 2FA/MFA (via Supabase Auth migration)
- ⏳ Add OAuth/SSO support (Google, GitHub, Microsoft)
- ⏳ Implement password reset flow (email service integration)
- ⏳ Add session IP/device tracking for security audit
- ⏳ Implement brute-force protection (account lockout after N failed attempts)
- ⏳ Add input validation with Zod schemas (planned: `src/validators/schemas/`)
- ⏳ Implement file upload security scanning (malware detection)

**Medium Priority:**
- ⏳ Add audit logging for sensitive operations
- ⏳ Implement data encryption at rest (sensitive fields)
- ⏳ Add request signing for critical operations
- ⏳ Implement API key authentication for machine-to-machine
- ⏳ Add rate limiting per user (currently only per IP)

**OWASP Top 10 Compliance:**
- ✅ A02:2021 - Cryptographic Failures (JWT hardening)
- ✅ A07:2021 - Identification & Authentication (JWT fixes)
- 🔄 A01:2021 - Broken Access Control (in progress)
- 🔄 A03:2021 - Injection (Prisma ORM helps, but need Zod validation)
- 🔄 A05:2021 - Security Misconfiguration (Helmet helps, but needs audit)
- 🔄 A08:2021 - Software & Data Integrity (need dependency scanning)
- ❌ A04:2021 - Insecure Design (requires architecture review)
- ❌ A06:2021 - Vulnerable Components (need automated scanning)
- ❌ A09:2021 - Security Logging (need comprehensive audit logging)
- ❌ A10:2021 - SSRF (need input validation for URLs)

---

## Known Issues & Technical Debt

### Critical (P0) - Blocks Production

1. **Custom Auth Maintenance Burden**
   - 429 LOC of security-critical code to maintain
   - No 2FA/OAuth support
   - Risk of future vulnerabilities
   - **Solution:** Migrate to Supabase Auth (Phase 4, 2-3 days)

2. **ML Model Accuracy Insufficient**
   - 85-90% field mapping accuracy
   - Requires manual training data collection
   - Complex deployment (native TensorFlow bindings)
   - **Solution:** Migrate to OpenAI GPT-4o-mini (Phase 4, 1-2 days)

3. **OCR Service Placeholder**
   - PDF-to-image conversion not production-ready (line 162-173 in OCRService.ts)
   - No multi-page PDF support
   - **Solution:** Implement pdf2pic or pdf-poppler integration

### High Priority (P1) - Impacts Quality

4. **Legacy Queue System**
   - Using Bull 4.11.5 instead of modern BullMQ
   - Missing TypeScript-first API
   - Limited observability
   - **Solution:** Upgrade to BullMQ (Phase 4, 1 day)

5. **No Observability Stack**
   - Basic Winston console logging only
   - No centralized log aggregation
   - No metrics collection (prom-client installed but not configured)
   - No distributed tracing
   - **Solution:** Implement basic Prometheus + Grafana (already in docker-compose with profile: monitoring)

6. **Test Coverage Unknown**
   - No coverage reporting configured
   - E2E tests skipped in CI
   - Some tests temporarily disabled
   - **Solution:** Configure Jest coverage, fix E2E tests

### Medium Priority (P2) - Improves Developer Experience

7. **API Documentation Missing**
   - No OpenAPI/Swagger spec
   - No API documentation UI
   - Endpoints documented only in this file
   - **Solution:** Add @nestjs/swagger or similar

8. **Error Handling Inconsistency**
   - Mix of throw Error and return error patterns
   - Inconsistent error message formats
   - Limited error context for debugging
   - **Solution:** Implement standardized error handling middleware

9. **No Production Deployment Strategy**
   - Deployment target undecided (VPS vs PaaS vs containers)
   - No CI/CD pipeline for production
   - No rollback strategy
   - **Solution:** Define deployment architecture (Phase 5)

10. **Environment Configuration Sprawl**
    - `.env`, `.env.example`, `.env.neon` files
    - Docker-specific env vars in `docker-compose.yml`
    - Some hardcoded defaults in code
    - **Solution:** Consolidate configuration management

---

## Development Environment

### Windows Native Setup (Primary)

**Prerequisites:**
- Node.js 20.x (minimum 18+)
- PostgreSQL 16.x (local or cloud)
- Redis 6.x+ (Windows version or WSL)
- nginx for Windows (reverse proxy)
- Bun (optional, alternative to npm for frontend)

**Startup Sequence:**

```bash
# Backend (terminal 1)
npm install
npx prisma migrate dev  # Run database migrations
npm run dev  # Express API on port 3002, hot reload via ts-node-dev

# Frontend (terminal 2)
cd web
bun install  # or npm install
bun run dev  # Vite dev server on port 5173

# nginx (terminal 3 or Windows service)
# nginx.conf configured to proxy:
#   / -> http://localhost:5173 (frontend)
#   /api -> http://localhost:3002 (backend)
# Accessible at http://localhost:80
```

**Windows Batch Scripts:**
- `start-windows.bat` - Start backend + frontend
- `start-all.bat` - Start backend + frontend + nginx
- `start-nginx-only.bat` - Start nginx only
- `stop-all-windows.bat` - Stop all services

**Why Windows Native (Not Docker):**
- **Better file watching performance** - No Docker volume overhead
- **No WSL2 memory overhead** - Direct Windows process
- **Faster iteration cycles** - Instant hot reload
- **Direct debugging access** - Native Node.js debugging
- **Aligns with developer's primary environment** - No context switching

### Docker Development (Alternative)

```bash
# Start all services (PostgreSQL, Redis, API, Worker, Web)
docker-compose up

# Start with monitoring (Prometheus + Grafana)
docker-compose --profile monitoring up

# Start for testing
docker-compose -f docker-compose.test.yml up

# Production-like deployment
docker-compose --profile production up
```

**Docker Compose Services:**
- `postgres` - PostgreSQL 15-alpine
- `redis` - Redis 7-alpine
- `app` - Express API (port 3001)
- `worker` - Bull queue processor
- `web` - React SPA (port 5173)
- `prometheus` - Metrics collection (profile: monitoring)
- `grafana` - Metrics visualization (profile: monitoring)
- `postgres-backup` - Daily backups (profile: production)

**Docker Images:**
- Backend: Custom Dockerfile (`Dockerfile.dev` or `Dockerfile.test`)
- Frontend: Custom Dockerfile (`web/Dockerfile.dev`)
- Database/Redis: Official Alpine images

---

## API Routes & Endpoints

### Authentication Endpoints

**Base:** `/api/auth`

```typescript
// Register new user
POST /api/auth/register
Content-Type: application/json
Body: {
  email: string,
  password: string,
  fullName: string,
  role?: "admin" | "user" | "viewer"
}
Response: {
  user: { id, email, firstName, lastName, role, ... },
  tokens: { accessToken, refreshToken, expiresIn, tokenType }
}

// Login
POST /api/auth/login
Content-Type: application/json
Body: { email: string, password: string }
Response: {
  user: { id, email, firstName, lastName, role, ... },
  tokens: { accessToken, refreshToken, expiresIn, tokenType }
}

// Refresh access token
POST /api/auth/refresh
Content-Type: application/json
Body: { refreshToken: string }
Response: {
  accessToken, refreshToken, expiresIn, tokenType
}

// Logout current device
POST /api/auth/logout
Authorization: Bearer <accessToken>
Body: { refreshToken: string }
Response: { message: "Logged out successfully" }

// Logout all devices
POST /api/auth/logout-all
Authorization: Bearer <accessToken>
Response: { message: "Logged out from all devices" }

// Get user profile
GET /api/auth/profile
Authorization: Bearer <accessToken>
Response: {
  id, email, full_name, role, is_active,
  email_verified, created_at, updated_at, last_login
}

// Change password
POST /api/auth/change-password
Authorization: Bearer <accessToken>
Body: {
  currentPassword: string,
  newPassword: string
}
Response: { message: "Password changed successfully" }
```

### Document Endpoints

**Base:** `/api/documents`

```typescript
// Upload document
POST /api/documents/upload
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
Body: file (binary), metadata (JSON)
Response: {
  document_id: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  status: "PENDING" | "PROCESSING" | "COMPLETED",
  created_at: timestamp
}

// Get document metadata
GET /api/documents/:id
Authorization: Bearer <accessToken>
Response: {
  id, fileName, fileType, fileSize, status,
  extractedText?, extractedData?, confidence?,
  created_at, updated_at, processed_at?
}

// Download processed document
GET /api/documents/:id/download
Authorization: Bearer <accessToken>
Response: Binary file (application/pdf)

// Process document with form
POST /api/documents/process
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
Body: sourceDocument (file), targetForm (file)
Response: {
  job_id: string,
  status: "queued" | "processing" | "completed",
  estimated_time: number (seconds)
}

// Delete document
DELETE /api/documents/:id
Authorization: Bearer <accessToken>
Response: { message: "Document deleted successfully" }
```

### Statistics Endpoints

**Base:** `/api/stats`

```typescript
// System overview
GET /api/stats/overview
Authorization: Bearer <accessToken>
Response: {
  totalDocuments: number,
  totalUsers: number,
  processingJobs: number,
  completedToday: number,
  averageProcessingTime: number (ms),
  successRate: number (0-1)
}

// User-specific stats
GET /api/stats/user/:userId
Authorization: Bearer <accessToken>
Response: {
  userId: string,
  documentsProcessed: number,
  totalProcessingTime: number (ms),
  averageConfidence: number (0-1),
  lastActivity: timestamp
}
```

### Health Check

```typescript
// Health check (public)
GET /health
Response: {
  status: "ok",
  timestamp: "2025-01-10T12:00:00.000Z",
  version: "1.0.0",
  environment: "development" | "production"
}
```

---

## Performance Characteristics

### Current Metrics: NOT MEASURED

**Target Metrics (Aspirational, Unvalidated):**
- API response time: <100ms P99
- Document processing: <5s for typical PDF
- Queue throughput: >1000 jobs/minute
- Concurrent users: >100 simultaneous
- Database queries: <50ms P95
- Memory usage: <2GB per service

**Reality Check:** These are unvalidated targets. Actual performance unknown until load testing performed.

**Known Performance Bottlenecks:**
- Single-threaded document processing (no parallelization)
- TensorFlow.js model inference (~10-50ms per prediction)
- OCR processing (Tesseract.js can be slow on large images)
- No database query optimization or indexing strategy
- No CDN for static assets
- No HTTP/2 or connection pooling

**Performance Testing TODO:**
- Implement load testing with Artillery or k6
- Measure baseline performance metrics
- Identify bottlenecks with profiling
- Optimize critical paths
- Document actual performance characteristics

---

## Deployment Strategy (TBD)

### Option 1: VPS Deployment (Simple)

**Stack:**
- Single VPS (2-4 cores, 4-8GB RAM)
- Ubuntu 22.04 LTS
- nginx reverse proxy
- PM2 process manager (backend)
- Node.js 20.x
- PostgreSQL 16 (managed or local)
- Redis 7 (managed or local)

**Pros:**
- Simple, predictable architecture
- Full control over infrastructure
- Cost-effective ($10-40/month)
- Easy to debug and troubleshoot

**Cons:**
- Manual scaling (vertical only)
- Single point of failure
- Manual backup management
- No automatic failover

**Providers:** DigitalOcean, Linode, Vultr, Hetzner

### Option 2: Platform-as-a-Service (Managed)

**Stack:**
- API: Render, Railway, Fly.io ($7-20/month)
- Frontend: Vercel, Netlify ($0-20/month)
- Database: Neon PostgreSQL (free tier or $19/month)
- Cache: Upstash Redis (free tier or $10/month)
- Storage: AWS S3 or Cloudflare R2 ($0.01/GB)

**Pros:**
- Zero DevOps overhead
- Automatic scaling and deployment
- Built-in monitoring and logging
- Free tiers for MVP scale
- CDN included

**Cons:**
- Less control over infrastructure
- Vendor lock-in risk
- Can be more expensive at scale
- Cold start latency on free tiers

**Recommended for MVP**

### Option 3: Container Deployment (Future)

**Stack:**
- Docker images (Dockerfiles already exist)
- Docker Compose (single-server, development-like)
- Kubernetes (future scaling when needed)
- Managed Kubernetes: GKE, EKS, AKS

**Pros:**
- Reproducible builds
- Easy local development
- Gradual path to Kubernetes
- Infrastructure-as-code

**Cons:**
- Overkill for current scale
- Requires container expertise
- Higher operational overhead
- More expensive

**Decision:** Deferred until MVP feature-complete and product-market fit validated

---

## Future Vision vs. Current Reality

| Capability | Vision (docs/architecture/) | Reality (Current) | Migration Path |
|------------|---------------------------|-------------------|----------------|
| **Architecture** | Microservices (6+ services) | Monolithic Express API | Stay monolithic until >10k users |
| **Orchestration** | Kubernetes cluster | None (manual scaling) | Docker Compose → Kubernetes (if needed) |
| **API Gateway** | Kong/Envoy | nginx reverse proxy | Kong when multi-service |
| **Logging** | ELK Stack | Winston console logs | Prometheus + Loki (Phase 3) |
| **Tracing** | Jaeger/Zipkin | None | OpenTelemetry (Phase 3) |
| **Monitoring** | Prometheus + Grafana | None (basic health check) | Enable docker-compose monitoring profile |
| **Deployment** | Multi-region HA | Single instance | Multi-region if >100k users |
| **Scaling** | Auto-scaling HPA | Manual (vertical) | Horizontal scaling when needed |
| **Load Balancing** | HAProxy/nginx | None | Add when >1 backend instance |
| **Service Mesh** | Istio | None | Only if microservices + Kubernetes |
| **ML/AI** | Custom TensorFlow models | Custom TF.js (85-90%) | → OpenAI API (99%+, Phase 4) |
| **Auth** | Custom JWT | Custom JWT (429 LOC) | → Supabase Auth (Phase 4) |
| **Queue** | Bull 4.11.5 | Bull 4.11.5 | → BullMQ (Phase 4) |
| **Search** | Elasticsearch | None (PostgreSQL queries) | PostgreSQL full-text search first |
| **Storage** | AWS S3 | Local filesystem | S3/R2 when production-ready |
| **CDN** | CloudFront/CloudFlare | None | Add when frontend optimized |

**Important:** The vision in `docs/architecture/system-architecture.md` represents future enterprise goals at 100k+ users scale, not current implementation. Always refer to this document (`docs/CURRENT_ARCHITECTURE.md`) for actual architecture.

---

## Getting Started (For Claude Code)

When working on QuikAdmin, follow these guidelines:

### Environment Assumptions
1. **Platform:** Assume Windows native development unless Docker is explicitly mentioned
2. **Package Manager:** Use `npm` for backend, `bun` for frontend (fallback to `npm`)
3. **Paths:** Use forward slashes in code (`src/services/auth.ts`), backslashes in Windows batch scripts (`start-windows.bat`)
4. **Ports:** Backend 3002, Frontend 5173, nginx 80, PostgreSQL 5432, Redis 6379

### Key Commands
```bash
# Backend development
npm install
npx prisma migrate dev  # Run migrations
npm run dev  # Start API with hot reload

# Frontend development
cd web
bun install
bun run dev  # Start Vite dev server

# Database operations
npx prisma studio  # Database UI
npx prisma generate  # Regenerate Prisma client
npx prisma migrate dev --name <name>  # Create migration

# Testing
npm test  # Unit + integration tests
npm run test:watch  # Watch mode
npm run test:e2e  # E2E tests (Puppeteer)
cd web && npm run test:e2e  # Frontend E2E (Cypress)

# Code quality
npm run lint  # ESLint
npm run typecheck  # TypeScript type checking
npm run format  # Prettier formatting
```

### Critical Files to Reference
- **`CLAUDE.md`** - AI assistant configuration, project context, memory system
- **`package.json`** - Real dependencies, scripts (single source of truth)
- **`prisma/schema.prisma`** - Database schema (single source of truth)
- **`src/index.ts`** - Application entry point, middleware setup
- **`docker-compose.yml`** - Docker deployment configuration
- **`.env.example`** - Environment variable template

### Project Structure Quick Reference
```
quikadmin/
├── src/
│   ├── index.ts              # Entry point
│   ├── api/                  # Route handlers
│   │   ├── routes.ts         # Main route setup
│   │   ├── auth.routes.ts    # Auth endpoints
│   │   ├── documents.routes.ts # Document endpoints
│   │   └── stats.routes.ts   # Statistics endpoints
│   ├── services/             # Business logic
│   │   ├── PrismaAuthService.ts (429 LOC)
│   │   ├── IntelliFillService.ts (274 LOC)
│   │   ├── OCRService.ts (240 LOC)
│   │   └── documentQueue.ts (226 LOC)
│   ├── ml/                   # Machine learning
│   │   └── FieldMappingModel.ts (334 LOC)
│   ├── parsers/              # Document parsers
│   ├── extractors/           # Data extractors
│   ├── mappers/              # Field mappers
│   ├── fillers/              # Form fillers
│   ├── validators/           # Validation services
│   ├── middleware/           # Express middleware
│   │   ├── auth.ts           # JWT authentication
│   │   ├── rateLimiter.ts    # Rate limiting
│   │   ├── csrf.ts           # CSRF protection
│   │   └── security.ts       # Security headers
│   ├── database/             # Database service
│   └── utils/                # Utilities
│       ├── logger.ts         # Winston logger
│       └── claude-memory.ts  # Memory system
├── web/                      # React frontend
│   ├── src/
│   │   ├── pages/            # Page components
│   │   ├── components/       # Reusable components
│   │   ├── stores/           # Zustand state management
│   │   └── services/         # API client
│   └── vite.config.ts        # Vite configuration
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Migration files
├── tests/                    # Test suites
├── docs/                     # Documentation
│   ├── CURRENT_ARCHITECTURE.md (this file)
│   ├── architecture/         # Future vision (aspirational)
│   └── MIDDLEWARE_*.md       # Middleware planning docs
└── memory/                   # Claude Code memory storage
    └── claude-sessions/      # Session persistence
```

### Development Workflow
1. **Always read `CLAUDE.md` first** - Contains current project context and decisions
2. **Check Prisma schema** for data model truth
3. **Reference `package.json`** for actual dependencies (not assumptions)
4. **Use TypeScript** for type safety (don't skip type definitions)
5. **Run tests** before committing changes
6. **Update documentation** when architecture changes (this file, not `docs/architecture/`)

### Common Pitfalls to Avoid
- ❌ **Don't assume enterprise infrastructure exists** (Kubernetes, Kong, ELK, etc.)
- ❌ **Don't reference microservices** - it's a monolith
- ❌ **Don't assume 100% test coverage** - it's unknown
- ❌ **Don't assume production deployment is defined** - it's TBD
- ❌ **Don't assume OCR service is production-ready** - it has placeholders
- ❌ **Don't assume 99% ML accuracy** - it's 85-90%
- ✅ **Do check actual files** before making assumptions
- ✅ **Do reference this document** for architecture truth
- ✅ **Do ask about deployment target** before suggesting infrastructure

---

## References

- **Project Context:** [CLAUDE.md](../CLAUDE.md) - AI assistant configuration
- **Setup Guide:** [SETUP_GUIDE_WINDOWS.md](../SETUP_GUIDE_WINDOWS.md) - Windows setup instructions
- **Future Vision:** [docs/architecture/](./architecture/) - Aspirational enterprise architecture
- **Middleware Planning:** [MIDDLEWARE_IMPLEMENTATION_PLAN_v2.md](./MIDDLEWARE_IMPLEMENTATION_PLAN_v2.md)
- **Security Review:** [MIDDLEWARE_REVIEW.md](./MIDDLEWARE_REVIEW.md)
- **Auth Service Review:** [AUTH_SERVICE_REVIEW.md](../AUTH_SERVICE_REVIEW.md)
- **Package Dependencies:** [package.json](../package.json) - Actual installed packages
- **Database Schema:** [prisma/schema.prisma](../prisma/schema.prisma) - Data model truth

---

## Document Maintenance

**Status:** ✅ Accurate as of 2025-01-10
**Maintainer:** Update this document when **actual architecture changes**, not when plans change
**Purpose:** Single source of truth for QuikAdmin's real implementation

**Update Triggers:**
- ✅ New service added or removed
- ✅ Database schema changes
- ✅ Technology stack changes (new dependencies, framework upgrades)
- ✅ Deployment architecture changes
- ✅ Security vulnerabilities fixed
- ✅ Major refactoring completed
- ❌ Planning documents updated (keep planning separate from reality)
- ❌ Feature ideas discussed (ideas ≠ implementation)

**Version History:**
- **v1.0.0** (2025-01-10) - Initial comprehensive documentation of current state

---

**End of Document**
