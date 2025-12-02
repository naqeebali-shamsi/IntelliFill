---
title: Testing Guide
description: Run and write tests for IntelliFill
category: how-to
tags: [testing, jest, vitest, cypress]
lastUpdated: 2025-11-25
---

# Testing Guide

This guide covers running and writing tests for both the backend (Jest) and frontend (Vitest, Cypress) of IntelliFill.

---

## Test Overview

| Layer | Framework | Type | Location |
|-------|-----------|------|----------|
| Backend | Jest | Unit, Integration | `quikadmin/tests/` |
| Frontend | Vitest | Unit, Component | `quikadmin-web/src/__tests__/` |
| E2E | Cypress | End-to-end | `quikadmin-web/cypress/` |

---

## Backend Testing (Jest)

### Running Tests

```bash
cd quikadmin

# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage

# Run specific file
npm test -- auth.test.ts

# Run tests matching pattern
npm test -- --grep "UserService"
```

### Writing Unit Tests

```typescript
// tests/unit/services/UserService.test.ts
import { UserService } from '../../../src/services/UserService';
import { prismaMock } from '../../mocks/prisma';

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService(prismaMock);
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById('123');

      expect(result).toEqual(mockUser);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: '123' }
      });
    });

    it('should return null when not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await service.findById('invalid');

      expect(result).toBeNull();
    });
  });
});
```

### Writing Integration Tests

```typescript
// tests/integration/api/auth.test.ts
import request from 'supertest';
import { app } from '../../../src/index';

describe('Auth API', () => {
  describe('POST /api/auth/v2/login', () => {
    it('should return token for valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/v2/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/v2/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
    });
  });
});
```

### Mocking Prisma

```typescript
// tests/mocks/prisma.ts
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset } from 'jest-mock-extended';

export const prismaMock = mockDeep<PrismaClient>();

beforeEach(() => {
  mockReset(prismaMock);
});
```

---

## Frontend Testing (Vitest)

### Running Tests

```bash
cd quikadmin-web

# Run all tests
bun run test

# Run in watch mode
bun run test:watch

# Run with UI
bun run test:ui

# Run with coverage
bun run test:coverage

# Run specific file
bun run test -- Button.test.tsx
```

### Writing Component Tests

```typescript
// src/components/ui/__tests__/button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '../button';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    
    expect(screen.getByText('Click me')).toBeDisabled();
  });

  it('applies variant classes correctly', () => {
    render(<Button variant="destructive">Delete</Button>);
    
    expect(screen.getByText('Delete')).toHaveClass('bg-destructive');
  });
});
```

### Testing Hooks

```typescript
// src/hooks/__tests__/useDebounce.test.tsx
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('test', 500));
    expect(result.current).toBe('test');
  });

  it('updates value after delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });
    
    expect(result.current).toBe('initial');
    
    act(() => {
      vi.advanceTimersByTime(500);
    });
    
    expect(result.current).toBe('updated');
  });
});
```

### Testing Zustand Stores

```typescript
// src/stores/__tests__/documentStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useDocumentStore } from '../documentStore';

describe('documentStore', () => {
  beforeEach(() => {
    useDocumentStore.setState({ documents: [], loading: false });
  });

  it('adds document correctly', () => {
    const { addDocument } = useDocumentStore.getState();
    
    addDocument({ id: '1', filename: 'test.pdf' });
    
    const { documents } = useDocumentStore.getState();
    expect(documents).toHaveLength(1);
    expect(documents[0].filename).toBe('test.pdf');
  });

  it('removes document correctly', () => {
    useDocumentStore.setState({
      documents: [{ id: '1', filename: 'test.pdf' }]
    });

    const { removeDocument } = useDocumentStore.getState();
    removeDocument('1');
    
    const { documents } = useDocumentStore.getState();
    expect(documents).toHaveLength(0);
  });
});
```

---

## E2E Testing (Cypress)

### Running E2E Tests

```bash
cd quikadmin-web

# Open Cypress UI
bun run cypress:open

# Run headless
bun run cypress:run

# Run specific spec
bun run cypress:run --spec "cypress/e2e/auth.cy.ts"
```

### Writing E2E Tests

```typescript
// cypress/e2e/auth.cy.ts
describe('Authentication', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should login with valid credentials', () => {
    cy.get('[data-testid="email-input"]').type('admin@intellifill.com');
    cy.get('[data-testid="password-input"]').type('Admin123!');
    cy.get('[data-testid="login-button"]').click();

    cy.url().should('include', '/dashboard');
    cy.contains('Welcome').should('be.visible');
  });

  it('should show error for invalid credentials', () => {
    cy.get('[data-testid="email-input"]').type('wrong@example.com');
    cy.get('[data-testid="password-input"]').type('wrongpassword');
    cy.get('[data-testid="login-button"]').click();

    cy.contains('Invalid credentials').should('be.visible');
  });

  it('should navigate to registration', () => {
    cy.contains('Create account').click();
    cy.url().should('include', '/register');
  });
});
```

### Cypress Custom Commands

```typescript
// cypress/support/commands.ts
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/login');
  cy.get('[data-testid="email-input"]').type(email);
  cy.get('[data-testid="password-input"]').type(password);
  cy.get('[data-testid="login-button"]').click();
  cy.url().should('include', '/dashboard');
});

// Usage in tests
cy.login('admin@intellifill.com', 'Admin123!');
```

---

## Test Coverage

### Coverage Targets

| Layer | Target | Current |
|-------|--------|---------|
| Backend | 80% | ~72% |
| Frontend | 70% | ~65% |
| E2E | Critical paths | Implemented |

### Generating Coverage Reports

```bash
# Backend
cd quikadmin && npm test -- --coverage

# Frontend
cd quikadmin-web && bun run test:coverage
```

### Coverage Configuration

```javascript
// jest.config.js (backend)
module.exports = {
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

---

## Testing Best Practices

### General

1. **Test behavior, not implementation**
2. **Use descriptive test names**
3. **One assertion per test when possible**
4. **Keep tests independent**
5. **Don't test external dependencies**

### Naming Convention

```typescript
describe('ComponentOrFunction', () => {
  describe('methodOrScenario', () => {
    it('should [expected behavior] when [condition]', () => {
      // ...
    });
  });
});
```

### Test Structure (AAA)

```typescript
it('should update user email', async () => {
  // Arrange
  const user = { id: '1', email: 'old@example.com' };
  
  // Act
  const result = await updateEmail(user.id, 'new@example.com');
  
  // Assert
  expect(result.email).toBe('new@example.com');
});
```

---

## Troubleshooting

### Tests Timing Out

```typescript
// Increase timeout
it('slow test', async () => {
  // ...
}, 10000); // 10 second timeout
```

### Mock Not Working

```typescript
// Ensure mock is reset
beforeEach(() => {
  vi.clearAllMocks();
});
```

### Cypress Not Finding Elements

```typescript
// Add data-testid attributes
<button data-testid="submit-button">Submit</button>

// Use in test
cy.get('[data-testid="submit-button"]').click();
```

---

## Related Documentation

- [Local Setup](./local-setup.md)
- [API Reference](../../reference/api/endpoints.md)
- [Architecture Overview](../../reference/architecture/system-overview.md)

