# Repo Conventions Snapshot - Phase 0

**Generated:** 2026-01-09
**Project:** IntelliFill - Intelligent document processing and form automation platform

---

## 1. Project Structure

```
IntelliFill/
├── quikadmin/              # Backend (Express + TypeScript)
│   ├── src/
│   │   ├── api/            # Route handlers (*.routes.ts)
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   ├── database/       # Prisma client & utilities
│   │   ├── workers/        # Bull queue processors
│   │   ├── extractors/     # OCR/data extraction
│   │   ├── fillers/        # PDF form filling
│   │   └── utils/          # Shared utilities
│   └── prisma/             # Database schema
├── quikadmin-web/          # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/         # Primitive components (~50 files)
│   │   │   ├── features/   # Feature components (~45 files)
│   │   │   └── layout/     # Layout components
│   │   ├── pages/          # Route page components (~35 files)
│   │   ├── stores/         # Zustand state stores (~15 files)
│   │   ├── services/       # API service functions (~15 files)
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities (cn, navigation)
│   └── e2e/                # Playwright E2E tests
├── e2e/                    # Root E2E infrastructure
└── docs/                   # Unified documentation
```

---

## 2. Framework Detection

### Frontend Stack

| Technology              | Version   | Purpose                                    |
|------------------------|-----------|-------------------------------------------|
| React                  | 18.3.1    | UI Framework                              |
| TypeScript             | 5.9.3     | Type Safety                               |
| Vite                   | 5.4.19    | Build Tool + HMR                          |
| React Router           | 6.30.2    | Client-side routing (BrowserRouter)       |
| TailwindCSS            | 4.1.17    | Utility-first CSS                         |
| Zustand                | 5.0.9     | Client state management                   |
| @tanstack/react-query  | 5.62.8    | Server state / data fetching              |
| React Hook Form        | 7.70.0    | Form handling                             |
| Zod                    | 3.23.8    | Schema validation                         |
| Radix UI               | latest    | Accessible UI primitives                  |
| Framer Motion          | 12.23.25  | Animations                                |
| Sonner                 | 2.0.7     | Toast notifications                       |
| Axios                  | 1.13.2    | HTTP client                               |

### Backend Stack

| Technology              | Version   | Purpose                                    |
|------------------------|-----------|-------------------------------------------|
| Express                | 4.18.2    | REST API framework                        |
| TypeScript             | 5.3.3     | Type Safety                               |
| Prisma                 | 6.14.0    | ORM (PostgreSQL/Neon)                     |
| Supabase               | 2.76.1    | Auth + realtime                           |
| Bull/BullMQ            | 4.11/5.0  | Background job queues                     |
| Redis                  | 4.6.11    | Queue backing store + caching             |
| Joi                    | 17.11.0   | Request validation                        |
| JWT                    | 9.0.2     | Token-based auth                          |
| Multer                 | 2.0.2     | File uploads                              |
| pdf-lib                | 1.17.1    | PDF generation/filling                    |
| Tesseract.js           | 7.0.0     | OCR (local)                               |
| @google/generative-ai  | 0.24.1    | Gemini API for AI processing             |

---

## 3. Routing Conventions

### Frontend Routes (React Router 6)

**File:** `quikadmin-web/src/App.tsx`

**Pattern:** Lazy-loaded pages with ProtectedRoute wrapper

```typescript
// Public routes (no auth)
/login              → Login.tsx
/register           → Register.tsx
/forgot-password    → ForgotPassword.tsx
/reset-password     → ResetPassword.tsx
/verify-email       → VerifyEmail.tsx
/auth/callback      → AuthCallback.tsx
/accept-invite      → AcceptInvitePage.tsx
/forbidden          → ForbiddenPage.tsx

// Protected routes (with AppLayout)
/dashboard          → ConnectedDashboard.tsx
/upload             → ConnectedUpload.tsx
/history            → History.tsx
/documents          → DocumentLibrary.tsx
/fill-form          → SimpleFillForm.tsx
/demo/autocomplete  → FormFillDemo.tsx
/filled-forms       → FilledFormHistory.tsx
/profiles           → ProfileList.tsx
/profiles/:id       → ProfileDetail.tsx
/templates          → TemplateLibrary.tsx
/templates/new      → TemplateEditor.tsx
/templates/:id/edit → TemplateEditor.tsx
/settings           → Settings.tsx
/job/:jobId         → JobDetails.tsx

// Error routes
/*                  → NotFoundPage.tsx
```

### Backend Routes (Express)

**File:** `quikadmin/src/api/routes.ts`

**Pattern:** `app.use('/api/{resource}', createRoutes())`

```
/api/auth/v2/*           → supabase-auth.routes.ts (register, login, logout, refresh)
/api/documents/*         → documents.routes.ts
/api/users/*             → users.routes.ts
/api/templates/*         → template.routes.ts
/api/clients/*           → clients.routes.ts
/api/clients/:id/docs/*  → client-documents.routes.ts
/api/form-templates/*    → form-template.routes.ts
/api/filled-forms/*      → filled-forms.routes.ts
/api/knowledge/*         → knowledge.routes.ts
/api/process/multiagent  → multiagent.routes.ts
/api/admin/security/*    → security-dashboard.routes.ts
/api/organizations/*     → organization.routes.ts
/api/invites/*           → invitation.routes.ts
/api/e2e/*               → e2e.routes.ts (test mode only)
/api/process/single      → File + form processing
/api/process/multiple    → Batch processing
/api/process/batch       → Multi-document batch
/api/form/fields         → Extract form fields
/api/validate            → Document validation
/api/health              → Health check
/api/ready               → Readiness check
/api/realtime            → SSE endpoint
```

---

## 4. UI Entrypoints

### Frontend Entrypoints

| File                              | Purpose                            |
|----------------------------------|-------------------------------------|
| `src/App.tsx`                    | Main router + providers             |
| `src/main.tsx`                   | React DOM render entry              |
| `src/components/layout/AppLayout.tsx` | Authenticated layout wrapper   |
| `src/components/ProtectedRoute.tsx`   | Auth guard component          |

### UI Component Library Structure

**Primitives (`components/ui/`):** ~50 components
- button, card, dialog, dropdown-menu, input, select, tabs, tooltip, etc.
- Based on Radix UI with shadcn/ui patterns
- Uses CVA (class-variance-authority) for variants

**Features (`components/features/`):** ~45 components
- document-card, file-upload-zone, processing-status, search-bar
- autocomplete-field, data-table, profile-selector, template-card
- AvatarUpload, InviteMemberModal, MembersList, OrganizationTabContent

**Layout (`components/layout/`):**
- AppLayout, PageHeader, Sidebar, navigation components

---

## 5. State Management

### Zustand Stores (`src/stores/`)

| Store                  | Purpose                                    |
|-----------------------|--------------------------------------------|
| `backendAuthStore.ts` | Primary auth state (Supabase Auth)        |
| `auth.ts`             | Legacy auth (being migrated)               |
| `documentStore.ts`    | Document list, selection, CRUD             |
| `uploadStore.ts`      | File upload progress, queue                |
| `profilesStore.ts`    | User profiles list                         |
| `templateStore.ts`    | Form templates                             |
| `filledFormsStore.ts` | Filled form history                        |
| `knowledgeStore.ts`   | Knowledge base (vector search)             |
| `accountStore.ts`     | User account settings                      |
| `uiStore.ts`          | UI state (modals, sidebar, theme)          |

**Pattern:** Zustand with immer middleware for immutable updates

```typescript
export const useExampleStore = create<State>()(
  immer((set, get) => ({
    // State
    items: [],
    loading: false,
    // Actions
    fetchItems: async () => { ... },
    addItem: (item) => set(state => { state.items.push(item); }),
  }))
);
```

---

## 6. Data Fetching

### Pattern: TanStack Query + Services

**Services (`src/services/`):**
- `api.ts` - Axios instance with interceptors
- `authService.ts` - Auth API calls
- `documentService.ts` - Document CRUD
- `profilesService.ts` - Profile management
- `formService.ts` - Form filling
- `knowledgeService.ts` - Vector search

**Pattern:**
```typescript
// Service layer
export const documentService = {
  getAll: () => api.get<{documents: Document[]}>('/documents'),
  getById: (id: string) => api.get<{document: Document}>(`/documents/${id}`),
  create: (data: FormData) => api.post('/documents', data),
  delete: (id: string) => api.delete(`/documents/${id}`),
};

// React Query hooks in components
const { data, isLoading } = useQuery({
  queryKey: ['documents'],
  queryFn: documentService.getAll,
});
```

---

## 7. Form Handling

### Pattern: React Hook Form + Zod

**Location:** Complex forms use react-hook-form; simple forms use controlled inputs

```typescript
// Zod schema
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// React Hook Form
const { register, handleSubmit, formState } = useForm({
  resolver: zodResolver(schema),
});
```

**Form Components:**
- `components/ui/form.tsx` - Form primitives with react-hook-form integration
- `components/ui/input.tsx` - Input with error states
- `components/features/autocomplete-field.tsx` - Smart autocomplete

---

## 8. Feature Flags / Config

### Frontend Environment Variables

**Prefix:** All must start with `VITE_`

```env
VITE_API_URL=http://localhost:3002/api
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_USE_BACKEND_AUTH=true    # Backend auth mode (recommended)
VITE_ENABLE_DEMO=false        # Demo mode toggle
```

**Access:**
```typescript
const apiUrl = import.meta.env.VITE_API_URL;
const isDev = import.meta.env.DEV;
```

### Backend Environment Variables

```env
DATABASE_URL=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
REDIS_URL=...
E2E_TEST_MODE=true    # Enable E2E test routes
DISABLE_CSRF=true     # Disable CSRF (dev only)
RLS_FAIL_CLOSED=true  # Production RLS hardening
```

---

## 9. Analytics / Telemetry

**Current State:** Placeholder for Sentry integration

```typescript
// App.tsx ErrorBoundary
onError={(error, errorInfo) => {
  console.error('App error boundary caught:', error, errorInfo);
  // TODO: Report to Sentry in production
  // if (import.meta.env.PROD) {
  //   Sentry.captureException(error, { contexts: { react: errorInfo } });
  // }
}}
```

**Backend:** pino logger + Winston for structured logging

---

## 10. Error Handling Conventions

### Frontend

1. **ErrorBoundary** - Top-level React error boundary
2. **useGlobalErrorHandlers** - Unhandled promise rejections
3. **API interceptors** - 401 redirect to login
4. **Toast notifications** - User-facing errors via sonner

### Backend

**File:** `quikadmin/src/index.ts` (error middleware)

**Pattern:** Centralized error handler with error codes

```typescript
// Error codes from constants/errorCodes.ts
ErrorCode.CORS_REJECTED
ErrorCode.TOKEN_INVALID
ErrorCode.TOKEN_EXPIRED
ErrorCode.RATE_LIMIT
ErrorCode.FILE_SIZE_EXCEEDED
// etc.

// Response format
res.status(status).json({
  error: 'message',
  code: ErrorCode.XXX,
  requestId: string,
});
```

---

## 11. Test Strategy

### Frontend Testing

| Type        | Tool                    | Location                         |
|-------------|-------------------------|----------------------------------|
| Unit        | Vitest                  | `src/**/__tests__/*.test.tsx`   |
| Component   | Vitest + RTL            | `src/**/__tests__/*.test.tsx`   |
| E2E         | Playwright              | `e2e/tests/**/*.spec.ts`        |

**Commands:**
```bash
bun run test          # Unit tests
bun run test:e2e:auto # E2E with seeding
```

### Backend Testing

| Type        | Tool                    | Location                         |
|-------------|-------------------------|----------------------------------|
| Unit        | Jest                    | `src/**/__tests__/*.test.ts`    |
| Integration | Jest + Supertest        | `tests/**/*.test.ts`            |
| Security    | Jest + custom           | `tests/swarm/security-*.js`     |

**Commands:**
```bash
npm test                # All tests
npm run test:security   # Security tests
```

---

## 12. Key File Pointers

### Frontend Critical Files

| Purpose               | Path                                        |
|-----------------------|---------------------------------------------|
| App entry             | `quikadmin-web/src/App.tsx`                |
| Auth store            | `quikadmin-web/src/stores/backendAuthStore.ts` |
| API client            | `quikadmin-web/src/services/api.ts`        |
| Protected route       | `quikadmin-web/src/components/ProtectedRoute.tsx` |
| Button component      | `quikadmin-web/src/components/ui/button.tsx` |
| File upload           | `quikadmin-web/src/components/features/file-upload-zone.tsx` |

### Backend Critical Files

| Purpose               | Path                                        |
|-----------------------|---------------------------------------------|
| Server entry          | `quikadmin/src/index.ts`                   |
| Route setup           | `quikadmin/src/api/routes.ts`              |
| Auth middleware       | `quikadmin/src/middleware/supabaseAuth.ts` |
| Prisma schema         | `quikadmin/prisma/schema.prisma`           |
| Database singleton    | `quikadmin/src/utils/prisma.ts`            |

---

## 13. Conventions Summary

### Code Style
- **TypeScript strict mode** in both frontend and backend
- **Functional components** with hooks (no class components)
- **Named exports** for components, services, stores
- **Kebab-case filenames** for components (`file-upload-zone.tsx`)
- **PascalCase** for pages (`DocumentLibrary.tsx`)

### Import Aliases
- Frontend: `@/` maps to `src/`
- Backend: Relative paths (no alias)

### Security Patterns
- All auth via Supabase JWT tokens
- CSRF protection enabled (can disable for dev)
- Rate limiting on auth/upload endpoints
- CSP with nonce support
- RLS (Row Level Security) enforcement

---

**Phase 0 Complete.** Ready for Phase 1: Full UI Interactive Element Discovery.
