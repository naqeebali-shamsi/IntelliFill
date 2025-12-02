# Project Structure

Understanding the QuikAdmin Web codebase organization will help you navigate and contribute effectively.

## Overview

```
quikadmin-web/
├── .github/               # GitHub Actions workflows
├── .vscode/               # VS Code workspace settings
├── cypress/               # End-to-end tests
├── dist/                  # Production build output (generated)
├── docs/                  # Documentation (you are here!)
├── node_modules/          # Dependencies (generated)
├── public/                # Static assets
├── src/                   # Source code
├── tests/                 # Unit tests
├── .env                   # Environment config (create from .env.example)
├── .env.example           # Environment template
├── .gitignore             # Git ignore rules
├── components.json        # shadcn/ui configuration
├── cypress.config.ts      # Cypress configuration
├── index.html             # HTML entry point
├── package.json           # Dependencies and scripts
├── postcss.config.js      # PostCSS configuration
├── README.md              # Project overview
├── tailwind.config.js     # Tailwind configuration
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite build configuration
└── vitest.config.ts       # Vitest test configuration
```

## Source Directory (`src/`)

The heart of the application:

```
src/
├── assets/                # Images, fonts, static files
├── components/            # React components
│   ├── forms/            # Form components
│   ├── layout/           # Layout components
│   ├── ui/               # UI library components
│   └── features/         # Feature-specific components
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
├── pages/                # Page components (routes)
├── services/             # API services
├── stores/               # Zustand state stores
├── styles/               # Global styles
├── types/                # TypeScript type definitions
├── utils/                # Utility functions
├── App.tsx               # Root component
├── main.tsx              # Application entry point
└── vite-env.d.ts         # Vite type declarations
```

### Components (`src/components/`)

Organized by purpose and reusability:

```
components/
├── ui/                   # Base UI components (buttons, inputs, etc.)
│   ├── button.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   ├── card.tsx
│   └── ...
├── forms/                # Form-specific components
│   ├── FormField.tsx
│   ├── FormSelect.tsx
│   └── ...
├── layout/               # Layout components
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   ├── Footer.tsx
│   └── PageLayout.tsx
└── features/             # Feature-specific components
    ├── auth/
    ├── documents/
    ├── templates/
    └── ...
```

**Component Guidelines:**
- `ui/` - Generic, reusable UI primitives
- `forms/` - Form inputs and validation
- `layout/` - Page structure and navigation
- `features/` - Business logic components

### Pages (`src/pages/`)

Route-based page components:

```
pages/
├── auth/
│   ├── Login.tsx
│   ├── Register.tsx
│   └── ForgotPassword.tsx
├── dashboard/
│   └── Dashboard.tsx
├── documents/
│   ├── DocumentLibrary.tsx
│   ├── DocumentDetail.tsx
│   └── DocumentUpload.tsx
├── templates/
│   ├── TemplateList.tsx
│   └── TemplateEditor.tsx
├── settings/
│   └── Settings.tsx
├── Home.tsx
└── NotFound.tsx
```

### Stores (`src/stores/`)

Zustand state management:

```
stores/
├── __tests__/            # Store unit tests
├── middleware/           # Custom middleware
├── authStore.ts          # Authentication state
├── documentStore.ts      # Document management
├── templateStore.ts      # Template management
├── uiStore.ts            # UI state (theme, modals)
├── uploadStore.ts        # File upload state
├── types.ts              # Store type definitions
├── index.ts              # Central export
└── README.md             # Store documentation
```

See: [Zustand Basics](../guides/state-management/zustand-basics.md)

### Services (`src/services/`)

API integration and external services:

```
services/
├── api/
│   ├── auth.ts          # Authentication API
│   ├── documents.ts     # Document API
│   ├── templates.ts     # Template API
│   └── client.ts        # API client setup
├── supabase/
│   └── client.ts        # Supabase client
└── websocket/
    └── client.ts        # WebSocket connection
```

### Hooks (`src/hooks/`)

Custom React hooks:

```
hooks/
├── useAuth.ts           # Authentication hook
├── useDocuments.ts      # Document operations
├── useUpload.ts         # File upload hook
├── useLocalStorage.ts   # Local storage hook
├── useDebounce.ts       # Debounce hook
└── useMediaQuery.ts     # Responsive design hook
```

### Types (`src/types/`)

TypeScript type definitions:

```
types/
├── api.ts               # API response types
├── auth.ts              # Authentication types
├── document.ts          # Document types
├── template.ts          # Template types
├── ui.ts                # UI component types
└── index.ts             # Type exports
```

### Utils (`src/utils/`)

Utility functions:

```
utils/
├── validation.ts        # Form validation
├── formatting.ts        # Data formatting
├── date.ts              # Date utilities
├── api.ts               # API helpers
└── constants.ts         # App constants
```

## Testing (`cypress/` and `tests/`)

### E2E Tests (`cypress/`)

```
cypress/
├── e2e/                 # Test specs
│   ├── auth/
│   ├── documents/
│   └── ...
├── fixtures/            # Test data
├── support/             # Custom commands
└── screenshots/         # Test screenshots (generated)
```

See: [E2E Testing Guide](../guides/testing/e2e-testing.md)

### Unit Tests (`tests/`)

```
tests/
├── components/          # Component tests
├── hooks/              # Hook tests
├── stores/             # Store tests
├── utils/              # Utility tests
└── setup.tsx           # Test setup
```

See: [Testing Guide](../guides/testing/README.md)

## Configuration Files

### Build & Development

**vite.config.ts** - Vite configuration
```typescript
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: 'dist' }
})
```

**tsconfig.json** - TypeScript configuration
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**tailwind.config.js** - Tailwind CSS configuration
```javascript
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: { /* custom theme */ }
  }
}
```

### Testing

**vitest.config.ts** - Unit test configuration
```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom'
  }
})
```

**cypress.config.ts** - E2E test configuration
```typescript
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173'
  }
})
```

### Package Management

**package.json** - Dependencies and scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest"
  }
}
```

## Public Assets (`public/`)

Static files served as-is:

```
public/
├── images/              # Images
├── fonts/               # Web fonts
├── icons/               # Icons
└── favicon.ico          # Favicon
```

**Note:** Files in `public/` are copied to build output root.

## Documentation (`docs/`)

This documentation site:

```
docs/
├── getting-started/     # Getting started guides
├── guides/              # Development guides
├── architecture/        # Architecture docs
├── components/          # Component docs
├── api/                 # API reference
├── reference/           # Configuration reference
├── development/         # Development workflow
├── deployment/          # Deployment guides
└── README.md            # Documentation hub
```

## Import Paths

### Absolute Imports

Using TypeScript path mapping (`@/*`):

```typescript
// Instead of:
import Button from '../../../components/ui/button'

// Use:
import Button from '@/components/ui/button'
import { useAuth } from '@/stores'
import { formatDate } from '@/utils/date'
```

Configuration in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Relative Imports

For nearby files:

```typescript
// In same directory
import { helper } from './utils'

// In subdirectory
import Component from './components/Component'

// Parent directory
import { store } from '../stores/authStore'
```

## File Naming Conventions

### Components
- **PascalCase**: `Button.tsx`, `UserProfile.tsx`
- **Test files**: `Button.test.tsx`, `UserProfile.test.tsx`

### Utilities & Hooks
- **camelCase**: `useAuth.ts`, `formatDate.ts`
- **Test files**: `useAuth.test.ts`

### Stores
- **camelCase**: `authStore.ts`, `documentStore.ts`
- **Test files**: `authStore.test.ts`

### Constants
- **camelCase**: `constants.ts`, `config.ts`

### Types
- **camelCase**: `types.ts`, `api.ts`

## Code Organization Patterns

### Feature-Based Organization

For complex features, use feature folders:

```
features/
├── documents/
│   ├── components/
│   │   ├── DocumentCard.tsx
│   │   └── DocumentList.tsx
│   ├── hooks/
│   │   └── useDocuments.ts
│   ├── services/
│   │   └── api.ts
│   ├── types/
│   │   └── document.ts
│   └── index.ts
```

### Barrel Exports

Use `index.ts` for clean imports:

```typescript
// components/ui/index.ts
export { Button } from './button'
export { Input } from './input'
export { Dialog } from './dialog'

// Usage:
import { Button, Input, Dialog } from '@/components/ui'
```

## Build Output (`dist/`)

Production build structure:

```
dist/
├── assets/              # Bundled JS/CSS
│   ├── index-[hash].js
│   └── index-[hash].css
├── images/              # Optimized images
└── index.html           # Entry HTML
```

**Generated by:** `bun run build`

## Environment-Specific Files

### Development
- `.env.local` - Local overrides (gitignored)
- `.env.development` - Development defaults

### Production
- `.env.production` - Production config

### Example
- `.env.example` - Template (committed to git)

## Key Directories Summary

| Directory | Purpose | Contains |
|-----------|---------|----------|
| `src/components` | React components | UI, forms, layouts |
| `src/pages` | Page components | Route pages |
| `src/stores` | State management | Zustand stores |
| `src/services` | External integrations | API, WebSocket |
| `src/hooks` | Custom hooks | Reusable logic |
| `src/types` | TypeScript types | Type definitions |
| `src/utils` | Utilities | Helper functions |
| `cypress` | E2E tests | Cypress specs |
| `tests` | Unit tests | Vitest tests |
| `docs` | Documentation | Guides & references |
| `public` | Static assets | Images, fonts |

## Navigation Tips

### Finding Components
```bash
# Search for component
grep -r "ComponentName" src/components/

# Or use your editor's search
# Cmd/Ctrl + P in VS Code
```

### Finding Usages
```bash
# Find where component is used
grep -r "import.*ComponentName" src/

# VS Code: Right-click -> Find All References
```

### Finding Types
```bash
# Search for type definition
grep -r "interface TypeName" src/types/
grep -r "type TypeName" src/types/
```

## Best Practices

### File Organization
1. Keep files focused and small
2. Group related functionality
3. Use barrel exports for cleaner imports
4. Colocate tests with source files

### Naming
1. Use descriptive, meaningful names
2. Follow established conventions
3. Be consistent across codebase
4. Use prefixes for clarity (`use-` for hooks)

### Imports
1. Use absolute imports for clarity
2. Group imports (external, internal, relative)
3. Sort imports alphabetically
4. Use barrel exports

### Structure
1. Feature folders for complex features
2. Shared components in `components/ui`
3. Feature-specific in `components/features`
4. Keep nesting shallow (max 3-4 levels)

## Next Steps

- [Component Development Guide](../guides/components/README.md)
- [State Management Guide](../guides/state-management/zustand-basics.md)
- [Testing Guide](../guides/testing/README.md)
- [API Integration Guide](../guides/api-integration/README.md)

## Additional Resources

- [React File Structure](https://react.dev/learn/thinking-in-react#step-1-break-the-ui-into-a-component-hierarchy)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [Vite Directory Structure](https://vitejs.dev/guide/#index-html-and-project-root)

---

[Back to Getting Started](./README.md) | [Previous: Development Server](./development-server.md)
