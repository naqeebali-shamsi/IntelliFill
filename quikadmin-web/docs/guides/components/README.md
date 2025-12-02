# Component Development Guide

Guidelines for building components in QuikAdmin Web.

## Component Structure

```typescript
// MyComponent.tsx
import { FC } from 'react'

interface MyComponentProps {
  title: string
  onAction?: () => void
}

export const MyComponent: FC<MyComponentProps> = ({ title, onAction }) => {
  return (
    <div className="p-4">
      <h2>{title}</h2>
      {onAction && <button onClick={onAction}>Action</button>}
    </div>
  )
}
```

## Best Practices

### TypeScript
- Use `interface` for props
- Export component with `FC` type
- Make props optional when sensible

### Styling
- Use TailwindCSS utilities
- Follow design system
- Use `className` for customization

### State
- Use hooks for local state
- Use Zustand for global state
- Keep components pure when possible

### Testing
- Write tests for all components
- Test user interactions
- Test edge cases

## Component Categories

- **UI Components**: `src/components/ui/`
- **Form Components**: `src/components/forms/`
- **Layout Components**: `src/components/layout/`
- **Feature Components**: `src/components/features/`

See: [Project Structure](../../getting-started/project-structure.md)

[Back to Guides](../README.md)
