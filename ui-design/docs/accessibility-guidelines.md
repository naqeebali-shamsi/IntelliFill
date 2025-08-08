# Accessibility Guidelines for PDF Filler Application

## Overview
This document outlines comprehensive accessibility standards and implementation guidelines for the PDF Filler application, ensuring WCAG 2.1 AA compliance and inclusive user experiences.

## Core Accessibility Principles

### 1. Perceivable
Information and user interface components must be presentable to users in ways they can perceive.

### 2. Operable
User interface components and navigation must be operable by all users.

### 3. Understandable
Information and the operation of the user interface must be understandable.

### 4. Robust
Content must be robust enough that it can be interpreted by a wide variety of user agents, including assistive technologies.

## WCAG 2.1 AA Requirements

### Color and Contrast
- **Minimum contrast ratio**: 4.5:1 for normal text
- **Large text contrast**: 3:1 for text 18pt+ or 14pt+ bold
- **Non-text elements**: 3:1 for UI components and graphics
- **Color independence**: Never use color alone to convey information

```css
/* Example: Good contrast ratios */
.primary-text {
  color: #1a365d; /* 7.1:1 contrast on white */
  background: #ffffff;
}

.secondary-text {
  color: #2d3748; /* 4.6:1 contrast on white */
  background: #ffffff;
}

.error-text {
  color: #c53030; /* 4.5:1 contrast on white */
  background: #ffffff;
}
```

### Focus Management

#### Visible Focus Indicators
```css
.focus-visible {
  outline: 2px solid #3182ce;
  outline-offset: 2px;
  border-radius: 2px;
}

/* Remove default outline and add custom focus */
button:focus {
  outline: none;
}

button:focus-visible {
  outline: 2px solid #3182ce;
  outline-offset: 2px;
}
```

#### Focus Order
- Logical tab sequence following content flow
- Skip links for main content areas
- Focus traps in modals and dialogs

```tsx
// Example: Focus management in modal
const Modal = ({ isOpen, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const firstFocusableRef = useRef<HTMLButtonElement>(null)
  
  useEffect(() => {
    if (isOpen) {
      firstFocusableRef.current?.focus()
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }
      
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])
  
  if (!isOpen) return null
  
  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 bg-black/50"
    >
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white p-6 rounded-lg max-w-md w-full">
          <h2 id="modal-title" className="text-lg font-semibold mb-4">
            Confirm Action
          </h2>
          <p className="mb-4">Are you sure you want to delete this file?</p>
          <div className="flex gap-2">
            <button
              ref={firstFocusableRef}
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded"
            >
              Cancel
            </button>
            <button className="px-4 py-2 bg-red-600 text-white rounded">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### Keyboard Navigation
All interactive elements must be keyboard accessible:

```tsx
// Example: Keyboard accessible dropdown
const Dropdown = ({ options, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (selectedIndex >= 0) {
          onSelect(options[selectedIndex])
        }
        setIsOpen(!isOpen)
        break
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < options.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : options.length - 1
        )
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }
  
  return (
    <div className="relative">
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onKeyDown={handleKeyDown}
        onClick={() => setIsOpen(!isOpen)}
      >
        Select Option
      </button>
      {isOpen && (
        <ul role="listbox" className="absolute top-full left-0 bg-white border">
          {options.map((option, index) => (
            <li
              key={option.id}
              role="option"
              aria-selected={selectedIndex === index}
              className={selectedIndex === index ? 'bg-blue-100' : ''}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

## Semantic HTML and ARIA

### Proper Heading Structure
```html
<h1>PDF Filler Dashboard</h1>
  <h2>Recent Files</h2>
    <h3>Today's Uploads</h3>
    <h3>Processing Queue</h3>
  <h2>Analytics</h2>
    <h3>Performance Metrics</h3>
    <h3>Usage Statistics</h3>
```

### Form Accessibility
```tsx
const AccessibleForm = () => {
  const [errors, setErrors] = useState({})
  
  return (
    <form>
      <div className="form-group">
        <label htmlFor="filename" className="required">
          File Name
          <span className="sr-only">required</span>
        </label>
        <input
          id="filename"
          type="text"
          required
          aria-describedby="filename-help filename-error"
          aria-invalid={errors.filename ? 'true' : 'false'}
          className={errors.filename ? 'error' : ''}
        />
        <div id="filename-help" className="help-text">
          Enter a descriptive name for your PDF file
        </div>
        {errors.filename && (
          <div id="filename-error" role="alert" className="error-text">
            {errors.filename}
          </div>
        )}
      </div>
    </form>
  )
}
```

### ARIA Labels and Descriptions
```tsx
// Data table with proper ARIA
<table role="table" aria-label="PDF Files">
  <thead>
    <tr>
      <th scope="col">
        <button
          onClick={() => sort('filename')}
          aria-describedby="sort-help"
        >
          File Name
          <span aria-hidden="true">↕</span>
        </button>
      </th>
      <th scope="col">Status</th>
      <th scope="col">Size</th>
    </tr>
  </thead>
  <tbody>
    {files.map((file) => (
      <tr key={file.id}>
        <td>{file.name}</td>
        <td>
          <span
            className={`status-badge ${file.status}`}
            aria-label={`Status: ${file.status}`}
          >
            {file.status}
          </span>
        </td>
        <td>{formatFileSize(file.size)}</td>
      </tr>
    ))}
  </tbody>
</table>

<div id="sort-help" className="sr-only">
  Click to sort by this column
</div>
```

## Screen Reader Support

### Screen Reader Only Content
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### Dynamic Content Announcements
```tsx
const useAnnouncement = () => {
  const [announcement, setAnnouncement] = useState('')
  
  const announce = (message: string) => {
    setAnnouncement(message)
    // Clear after announcement
    setTimeout(() => setAnnouncement(''), 1000)
  }
  
  return { announcement, announce }
}

const FileUpload = () => {
  const { announcement, announce } = useAnnouncement()
  
  const handleUploadComplete = (filename: string) => {
    announce(`File ${filename} uploaded successfully`)
  }
  
  return (
    <div>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
      {/* Upload component */}
    </div>
  )
}
```

## Mobile and Touch Accessibility

### Touch Target Size
- Minimum 44x44px touch targets
- Adequate spacing between interactive elements

```css
.touch-target {
  min-height: 44px;
  min-width: 44px;
  padding: 8px 16px;
  margin: 4px;
}

@media (pointer: coarse) {
  .touch-target {
    min-height: 48px;
    min-width: 48px;
  }
}
```

### Responsive Text Size
```css
/* Base font size scales with user preferences */
html {
  font-size: 16px;
}

@media (max-width: 768px) {
  html {
    font-size: 14px;
  }
}

/* Respect user's font size preferences */
@media (prefers-reduced-motion: reduce) {
  html {
    font-size: max(16px, 1rem);
  }
}
```

## Motion and Animation

### Respect Reduced Motion Preferences
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  
  .parallax {
    transform: none !important;
  }
}
```

### Safe Animation Patterns
```tsx
const AnimatedComponent = ({ children }) => {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  
  return (
    <div
      className={cn(
        'transition-all duration-200',
        !prefersReducedMotion && 'hover:scale-105'
      )}
    >
      {children}
    </div>
  )
}
```

## Error Handling and Messages

### Accessible Error Messages
```tsx
const FormField = ({ error, ...props }) => {
  return (
    <div className="form-field">
      <input
        {...props}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${props.id}-error` : undefined}
      />
      {error && (
        <div
          id={`${props.id}-error`}
          role="alert"
          className="error-message"
        >
          <span className="sr-only">Error: </span>
          {error}
        </div>
      )}
    </div>
  )
}
```

### Loading States
```tsx
const LoadingButton = ({ loading, children, ...props }) => {
  return (
    <button
      {...props}
      disabled={loading}
      aria-describedby={loading ? 'loading-status' : undefined}
    >
      {loading && (
        <span className="sr-only" id="loading-status">
          Loading, please wait
        </span>
      )}
      <span aria-hidden={loading}>{children}</span>
      {loading && <Spinner aria-hidden="true" />}
    </button>
  )
}
```

## Testing Checklist

### Automated Testing
- [ ] Run axe-core accessibility tests
- [ ] Lighthouse accessibility audit scores 100
- [ ] ESLint jsx-a11y rules pass
- [ ] Color contrast meets WCAG AA standards

### Manual Testing
- [ ] Navigate entire app using only keyboard
- [ ] Test with screen reader (NVDA, JAWS, VoiceOver)
- [ ] Verify focus management in interactive components
- [ ] Test with 200% zoom
- [ ] Verify with high contrast mode
- [ ] Test with reduced motion preferences

### Screen Reader Testing Scripts
```bash
# Install screen reader testing tools
npm install --save-dev @axe-core/react
npm install --save-dev jest-axe

# Test with different screen readers
# Windows: NVDA (free), JAWS
# macOS: VoiceOver (built-in)
# Linux: Orca (built-in)
```

### Accessibility Test Component
```tsx
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

describe('FileUpload Accessibility', () => {
  test('should not have any accessibility violations', async () => {
    const { container } = render(<FileUpload />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
  
  test('should be keyboard navigable', () => {
    render(<FileUpload />)
    const uploadButton = screen.getByRole('button', { name: /upload/i })
    
    // Test keyboard navigation
    userEvent.tab()
    expect(uploadButton).toHaveFocus()
    
    userEvent.keyboard('{Enter}')
    // Assert expected behavior
  })
})
```

## Implementation Guidelines

### Component Development
1. **Start with semantic HTML**: Use appropriate HTML elements
2. **Add ARIA when needed**: Enhance with ARIA attributes for complex interactions
3. **Test early and often**: Include accessibility tests in development workflow
4. **Consider all users**: Design for diverse abilities and preferences

### Code Review Checklist
- [ ] Semantic HTML structure
- [ ] Proper heading hierarchy
- [ ] Form labels and error handling
- [ ] Keyboard navigation support
- [ ] Focus management
- [ ] Color contrast compliance
- [ ] Screen reader compatibility
- [ ] Mobile accessibility
- [ ] Motion preferences respected

### Documentation Requirements
- Document accessibility features in component stories
- Include keyboard navigation instructions
- Provide screen reader usage examples
- Document ARIA patterns used

## Resources and Tools

### Testing Tools
- **axe-core**: Automated accessibility testing
- **WAVE**: Web accessibility evaluation
- **Lighthouse**: Built-in Chrome accessibility audit
- **Color Oracle**: Color blindness simulator
- **Stark**: Figma/Sketch accessibility plugin

### Screen Readers
- **NVDA**: Free Windows screen reader
- **JAWS**: Professional Windows screen reader
- **VoiceOver**: Built-in macOS/iOS screen reader
- **TalkBack**: Built-in Android screen reader
- **Orca**: Built-in Linux screen reader

### Guidelines and Standards
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Resources](https://webaim.org/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

## Continuous Improvement

### Monitoring
- Regular accessibility audits
- User feedback collection
- Performance monitoring with assistive technologies
- Compliance tracking

### Training
- Team accessibility training sessions
- Regular updates on best practices
- User testing with disabled users
- Accessibility conference attendance

This accessibility guide ensures that the PDF Filler application provides an inclusive experience for all users, meeting and exceeding WCAG 2.1 AA standards while maintaining excellent usability.