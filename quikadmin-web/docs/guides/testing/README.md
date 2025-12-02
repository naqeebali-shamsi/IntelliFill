# Testing Guide

Comprehensive testing strategy for QuikAdmin Web.

## Testing Stack

- **Unit Tests**: Vitest + Testing Library
- **E2E Tests**: Cypress
- **Component Tests**: Vitest + React Testing Library

## Quick Start

```bash
# Run all tests
bun run test

# Watch mode
bun run test:watch

# E2E tests
bun run test:e2e

# Coverage
bun run test:coverage
```

## Test Files

- [E2E Testing](./e2e-testing.md) - Cypress end-to-end tests
- [Test Summary](./test-summary.md) - Current test coverage

## Writing Tests

### Component Tests

```typescript
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

test('renders button', () => {
  render(<Button>Click me</Button>)
  expect(screen.getByText('Click me')).toBeInTheDocument()
})
```

### E2E Tests

```typescript
describe('Login', () => {
  it('should login successfully', () => {
    cy.visit('/login')
    cy.get('[data-cy=email]').type('user@example.com')
    cy.get('[data-cy=password]').type('password')
    cy.get('[data-cy=submit]').click()
    cy.url().should('include', '/dashboard')
  })
})
```

[Back to Guides](../README.md)
