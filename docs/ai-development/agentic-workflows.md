---
title: Agentic Workflows
description: Working effectively with AI agents on IntelliFill
category: ai-development
tags: [ai, agents, workflow, development]
lastUpdated: 2025-11-25
---

# Agentic Workflows

This guide covers effective workflows for AI agents working on the IntelliFill codebase, including context management, task execution, and best practices.

---

## Session Initialization

### Required Context Files

AI agents should read these files at the start of each session:

| Order | File | Purpose |
|-------|------|---------|
| 1 | `CLAUDE.local.md` | Local development context, known issues |
| 2 | `AGENTS.md` | Unified agent integration guide |
| 3 | `.cursorrules` | Project coding standards |
| 4 | `docs/README.md` | Documentation hub |

### Backend Context

When working on backend code, also read:

- `quikadmin/CLAUDE.md` - Comprehensive backend context
- `quikadmin/AGENTS.md` - Task Master integration

### Frontend Context

When working on frontend code, also read:

- `quikadmin-web/CLAUDE.md` - Frontend-specific context

---

## Development Workflow

### Task-Driven Development

IntelliFill uses Task Master for organized development:

```
┌─────────────┐
│  Get Task   │
│  list/next  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Understand  │
│  show <id>  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Implement  │
│  (code)     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Test &    │
│   Verify    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Complete   │
│ set-status  │
└─────────────┘
```

### Task Master Commands

```bash
# View available tasks
task-master list

# Get next task
task-master next

# View task details
task-master show <id>

# Mark task complete
task-master set-status --id=<id> --status=done

# Add new task
task-master add-task --prompt="description"

# Expand complex task
task-master expand --id=<id> --research
```

---

## Context Management

### Understanding the Codebase

Before making changes:

1. **Read relevant documentation** - Check `docs/` for context
2. **Search for existing code** - Look for similar implementations
3. **Understand patterns** - Follow established conventions
4. **Check dependencies** - Understand what's affected

### Maintaining Context

```bash
# Key directories to understand
quikadmin/
├── src/api/          # Route handlers
├── src/services/     # Business logic
├── src/middleware/   # Express middleware
└── src/validators/   # Input validation

quikadmin-web/
├── src/pages/        # Route components
├── src/components/   # Reusable components
├── src/stores/       # Zustand stores
└── src/services/     # API services
```

### Cross-Project Awareness

When changes affect both projects:

1. Start with backend API changes
2. Update API documentation
3. Implement frontend service
4. Update frontend stores/components
5. Test end-to-end

---

## Code Implementation

### Backend Implementation Pattern

```typescript
// 1. Create/update route
// quikadmin/src/api/example.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/supabaseAuth';
import { validateRequest } from '../middleware/validation';
import { exampleSchema } from '../validators/schemas/exampleSchemas';

const router = Router();

router.post(
  '/endpoint',
  authMiddleware,
  validateRequest(exampleSchema),
  async (req, res) => {
    try {
      // 2. Call service layer
      const result = await exampleService.process(req.body);
      
      // 3. Return response
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ error: 'Internal error' });
    }
  }
);

export default router;
```

### Frontend Implementation Pattern

```typescript
// 1. Create/update store
// quikadmin-web/src/stores/exampleStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { exampleService } from '@/services/exampleService';

export const useExampleStore = create(
  immer((set) => ({
    data: [],
    loading: false,
    
    fetch: async () => {
      set({ loading: true });
      try {
        const result = await exampleService.getData();
        set({ data: result, loading: false });
      } catch {
        set({ loading: false });
      }
    },
  }))
);

// 2. Create component
// quikadmin-web/src/components/features/ExampleComponent.tsx
export function ExampleComponent() {
  const { data, loading, fetch } = useExampleStore();
  
  useEffect(() => {
    fetch();
  }, []);
  
  if (loading) return <Spinner />;
  
  return <div>{/* render data */}</div>;
}
```

---

## Testing Requirements

### When to Write Tests

Tests are required for:
- New API endpoints
- Service layer functions
- React components with logic
- Zustand stores
- Utility functions

### Test Patterns

```typescript
// Backend test
describe('ExampleService', () => {
  it('should process data correctly', async () => {
    const result = await exampleService.process(input);
    expect(result).toMatchObject(expected);
  });
});

// Frontend test
describe('ExampleComponent', () => {
  it('should render data', async () => {
    render(<ExampleComponent />);
    await waitFor(() => {
      expect(screen.getByText('expected')).toBeInTheDocument();
    });
  });
});
```

---

## Documentation Updates (MANDATORY)

### Living Documentation Policy

**Documentation is not optional.** Every code change that affects documented behavior MUST include documentation updates.

See `docs/MAINTENANCE.md` for complete maintenance guidelines.

### Documentation Update Checklist

Before completing any task, verify:

```markdown
- [ ] API changes → `docs/reference/api/endpoints.md`
- [ ] Config changes → `docs/reference/configuration/environment.md`  
- [ ] Schema changes → `docs/reference/database/schema.md`
- [ ] Fixed known issue → Remove from `CLAUDE.local.md`
- [ ] New known issue → Add to `CLAUDE.local.md`
- [ ] lastUpdated timestamps updated in modified docs
- [ ] Cross-references still valid
```

### Documentation Locations

| Change Type | Update Location |
|-------------|-----------------|
| API endpoint | `docs/reference/api/endpoints.md` |
| Config change | `docs/reference/configuration/environment.md` |
| Database schema | `docs/reference/database/schema.md` |
| New feature | Appropriate tutorial or how-to guide |
| Architecture | `docs/explanation/` |
| Backend-specific | `quikadmin/docs/` |
| Frontend-specific | `quikadmin-web/docs/` |
| Known issues | `CLAUDE.local.md` |

---

## Error Handling

### Backend Errors

```typescript
// Consistent error response
interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

function handleError(res: Response, error: unknown) {
  console.error('Error:', error);
  
  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: error.message,
      code: 'VALIDATION_ERROR',
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
}
```

### Frontend Errors

```typescript
// Error boundary for components
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}

// API error handling
try {
  const result = await api.get('/endpoint');
} catch (error) {
  toast.error('Failed to load data');
  console.error('API Error:', error);
}
```

---

## Commit Guidelines

### Message Format

```
type(scope): description

Types: feat, fix, docs, refactor, test, chore
Scopes: api, web, docs, db, auth, ocr, pdf
```

### Examples

```
feat(api): add document reprocessing endpoint
fix(web): resolve login redirect issue
docs(api): update authentication documentation
refactor(db): optimize user query performance
test(web): add unit tests for Button component
```

---

## Common Pitfalls

### Avoid These Mistakes

1. **Not reading context** - Always read relevant docs first
2. **Ignoring patterns** - Follow existing code conventions
3. **Skipping tests** - Write tests for new code
4. **Outdated docs** - Update docs with code changes
5. **Using `any`** - Use proper TypeScript types
6. **Direct Supabase calls** - Route through backend API

### Do These Instead

1. **Read context files** at session start
2. **Search for examples** in existing code
3. **Write tests** alongside implementation
4. **Update documentation** in same commit
5. **Use strict types** everywhere
6. **Follow API patterns** for consistency

---

## Performance Considerations

### Backend

- Use database indexes for queries
- Implement caching where appropriate
- Avoid N+1 query patterns
- Use connection pooling

### Frontend

- Lazy load routes/components
- Memoize expensive computations
- Use React Query for caching
- Optimize bundle size

---

## Security Awareness

### Always

- Validate all inputs
- Check authentication on protected routes
- Use parameterized queries
- Never log sensitive data

### Never

- Commit secrets to code
- Use `any` for security-critical code
- Trust client-side validation alone
- Expose internal error details

---

## Related Documentation

- [CLAUDE.local.md](../../CLAUDE.local.md)
- [AGENTS.md](../../AGENTS.md)
- [MCP Integration](./mcp-integration.md)
- [Task Master Guide](../../quikadmin/AGENTS.md)

