# IntelliFill Frontend - AI Development Context

This file provides context for AI agents working on the IntelliFill frontend application (quikadmin-web).

---

## Project Overview

**IntelliFill Frontend** is a React-based web application for intelligent PDF form automation. It provides the UI for document upload, OCR viewing, profile management, and form filling.

---

## Quick Reference

### Package Manager

**IMPORTANT**: Use `bun` exclusively - NEVER use npm or yarn.

```bash
# Install dependencies
bun install

# Start development
bun run dev

# Run tests
bun run test

# Build
bun run build
```

### Development URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:8080 |
| Backend API | http://localhost:3002/api |

---

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2 | UI Framework |
| TypeScript | 5.2 | Type Safety |
| Vite | 4.5 | Build Tool |
| TailwindCSS | 4.0 beta | Styling |
| Zustand | 5.0 | State Management |
| React Query | 3.39 | Server State |
| React Router | 6.18 | Routing |
| Radix UI | latest | UI Primitives |
| React Hook Form | 7.x | Form Handling |
| Zod | 4.x | Validation |

---

## Project Structure

```
quikadmin-web/
├── src/
│   ├── components/
│   │   ├── ui/           # Primitive components (Button, Card, etc.)
│   │   ├── features/     # Feature components (FileUpload, DocumentCard)
│   │   └── layout/       # Layout components (PageHeader, Grid)
│   ├── pages/            # Route page components
│   ├── stores/           # Zustand state stores
│   ├── services/         # API service functions
│   ├── hooks/            # Custom React hooks
│   ├── types/            # TypeScript type definitions
│   ├── lib/              # Utilities and helpers
│   └── styles/           # Global styles
├── cypress/              # E2E tests
├── docs/                 # Frontend-specific docs
└── public/               # Static assets
```

---

## Key Patterns

### Component Pattern

```typescript
// src/components/features/ExampleComponent.tsx
import { cn } from '@/lib/utils';

interface ExampleComponentProps {
  title: string;
  variant?: 'default' | 'compact';
  onAction?: () => void;
  children?: React.ReactNode;
}

export function ExampleComponent({
  title,
  variant = 'default',
  onAction,
  children,
}: ExampleComponentProps) {
  return (
    <div className={cn(
      'rounded-lg border p-4',
      variant === 'compact' && 'p-2'
    )}>
      <h3 className="font-semibold">{title}</h3>
      {children}
      {onAction && (
        <Button onClick={onAction}>Action</Button>
      )}
    </div>
  );
}
```

### Zustand Store Pattern

```typescript
// src/stores/exampleStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface ExampleState {
  items: Item[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchItems: () => Promise<void>;
  addItem: (item: Item) => void;
  removeItem: (id: string) => void;
  reset: () => void;
}

const initialState = {
  items: [],
  loading: false,
  error: null,
};

export const useExampleStore = create<ExampleState>()(
  immer((set, get) => ({
    ...initialState,
    
    fetchItems: async () => {
      set({ loading: true, error: null });
      try {
        const items = await exampleService.getAll();
        set({ items, loading: false });
      } catch (error) {
        set({ error: 'Failed to fetch', loading: false });
      }
    },
    
    addItem: (item) => {
      set((state) => {
        state.items.push(item);
      });
    },
    
    removeItem: (id) => {
      set((state) => {
        state.items = state.items.filter(i => i.id !== id);
      });
    },
    
    reset: () => set(initialState),
  }))
);
```

### API Service Pattern

```typescript
// src/services/exampleService.ts
import { api } from './api';
import type { Item, CreateItemDto } from '@/types';

export const exampleService = {
  getAll: async (): Promise<Item[]> => {
    const response = await api.get<{ items: Item[] }>('/items');
    return response.data.items;
  },
  
  getById: async (id: string): Promise<Item> => {
    const response = await api.get<{ item: Item }>(`/items/${id}`);
    return response.data.item;
  },
  
  create: async (data: CreateItemDto): Promise<Item> => {
    const response = await api.post<{ item: Item }>('/items', data);
    return response.data.item;
  },
  
  delete: async (id: string): Promise<void> => {
    await api.delete(`/items/${id}`);
  },
};
```

### Custom Hook Pattern

```typescript
// src/hooks/useExample.ts
import { useEffect, useState } from 'react';
import { exampleService } from '@/services/exampleService';

export function useExample(id: string) {
  const [data, setData] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    let cancelled = false;
    
    async function fetch() {
      try {
        setLoading(true);
        const result = await exampleService.getById(id);
        if (!cancelled) {
          setData(result);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    
    fetch();
    
    return () => {
      cancelled = true;
    };
  }, [id]);
  
  return { data, loading, error };
}
```

---

## State Management

### Store Organization

| Store | Purpose | Location |
|-------|---------|----------|
| `useAuthStore` | Authentication state | `stores/useAuthStore.ts` |
| `useDocumentStore` | Document list & selection | `stores/documentStore.ts` |
| `useUploadStore` | File upload state | `stores/uploadStore.ts` |
| `useTemplateStore` | Form templates | `stores/templateStore.ts` |
| `useUIStore` | UI state (modals, etc.) | `stores/uiStore.ts` |

### State Access

```typescript
// In components
function MyComponent() {
  // Select only needed state to prevent unnecessary re-renders
  const documents = useDocumentStore(state => state.documents);
  const loading = useDocumentStore(state => state.loading);
  
  // Get actions
  const { fetchDocuments, deleteDocument } = useDocumentStore();
  
  useEffect(() => {
    fetchDocuments();
  }, []);
  
  return <DocumentList documents={documents} loading={loading} />;
}
```

---

## UI Components

### Component Library

We use a combination of:
- **Radix UI** - Accessible primitives
- **shadcn/ui patterns** - Pre-built component styles
- **Custom components** - Application-specific

### Component Locations

```
src/components/
├── ui/                    # Primitive components
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   └── ...
├── features/              # Feature components
│   ├── file-upload-zone.tsx
│   ├── document-card.tsx
│   ├── processing-status.tsx
│   └── ...
└── layout/                # Layout components
    ├── page-header.tsx
    ├── content-container.tsx
    └── ...
```

### Using UI Components

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { FileUploadZone } from '@/components/features/file-upload-zone';

function MyPage() {
  return (
    <Card>
      <CardHeader>
        <h2>Upload Document</h2>
      </CardHeader>
      <CardContent>
        <FileUploadZone onUpload={handleUpload} />
        <Button variant="primary">Submit</Button>
      </CardContent>
    </Card>
  );
}
```

---

## Styling

### TailwindCSS

We use Tailwind for all styling:

```typescript
// Use cn() utility for conditional classes
import { cn } from '@/lib/utils';

<div className={cn(
  'rounded-lg border p-4',
  isActive && 'border-primary bg-primary/10',
  disabled && 'opacity-50 cursor-not-allowed'
)} />
```

### Design Tokens

Use semantic tokens from Tailwind config:

```typescript
// Colors
className="bg-background text-foreground"
className="bg-primary text-primary-foreground"
className="bg-destructive text-destructive-foreground"

// Spacing
className="p-4 m-2 gap-4"

// Typography
className="text-sm font-medium"
className="text-lg font-semibold"
```

---

## Routing

### Route Structure

```typescript
// src/App.tsx
import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/documents" element={<DocumentLibrary />} />
        <Route path="/documents/:id" element={<DocumentDetail />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
```

### Protected Route

```typescript
// src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <Outlet />;
}
```

---

## Testing

### Test Commands

```bash
# Run unit tests
bun run test

# Watch mode
bun run test:watch

# With UI
bun run test:ui

# Coverage
bun run test:coverage

# E2E tests
bun run cypress:open    # Interactive
bun run cypress:run     # Headless
```

### Test Patterns

```typescript
// Component test
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    
    fireEvent.click(screen.getByText('Click'));
    
    expect(handleClick).toHaveBeenCalled();
  });
});

// Store test
import { useExampleStore } from './exampleStore';

describe('exampleStore', () => {
  beforeEach(() => {
    useExampleStore.setState({ items: [] });
  });
  
  it('adds item correctly', () => {
    const { addItem } = useExampleStore.getState();
    addItem({ id: '1', name: 'Test' });
    
    const { items } = useExampleStore.getState();
    expect(items).toHaveLength(1);
  });
});
```

---

## Environment Variables

All frontend environment variables must be prefixed with `VITE_`:

```env
# .env
VITE_API_URL=http://localhost:3002/api
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_ENABLE_DEMO=true
```

### Accessing Variables

```typescript
const apiUrl = import.meta.env.VITE_API_URL;
const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;
```

---

## Common Tasks

### Adding a New Page

1. Create page component in `src/pages/`
2. Add route in `App.tsx`
3. Create stores/hooks if needed
4. Add to navigation

### Adding a New Component

1. Create in appropriate directory:
   - `ui/` for primitives
   - `features/` for feature-specific
   - `layout/` for layout
2. Export from `components/index.ts`
3. Add tests

### Adding API Endpoint

1. Add service function in `src/services/`
2. Add types in `src/types/`
3. Update stores if caching needed
4. Add hooks for data fetching

---

## File Naming

| Type | Convention | Example |
|------|------------|---------|
| Components | kebab-case.tsx | `file-upload-zone.tsx` |
| Pages | PascalCase.tsx | `DocumentLibrary.tsx` |
| Stores | camelCaseStore.ts | `documentStore.ts` |
| Services | camelCaseService.ts | `documentService.ts` |
| Hooks | useCamelCase.ts | `useDocuments.ts` |
| Types | camelCase.ts | `document.ts` |
| Tests | *.test.tsx | `button.test.tsx` |

---

## Related Documentation

- [Root CLAUDE.local.md](../CLAUDE.local.md) - Project-wide context
- [Root AGENTS.md](../AGENTS.md) - Agent integration
- [Backend CLAUDE.md](../quikadmin/CLAUDE.md) - Backend context
- [Frontend Docs](./docs/) - Detailed frontend documentation

---

**Last Updated**: 2025-11-25

