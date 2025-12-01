---
title: "Form Components"
description: "Accessible form components with validation and error handling"
category: components
tags: [forms, accessibility, validation, inputs]
lastUpdated: 2025-01-11
relatedDocs:
  - design/design-system.md
---

# Form Components

Comprehensive guide to accessible form components with validation, error handling, and best practices.

## Overview

Form components are built with accessibility as the primary concern, following WCAG 2.1 AA standards and best practices for form design.

## Core Components

### Input Fields

```tsx
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

<div className="space-y-2">
  <Label htmlFor="email">Email Address</Label>
  <Input
    id="email"
    type="email"
    placeholder="you@example.com"
    aria-describedby="email-error"
    aria-invalid={hasError ? 'true' : 'false'}
  />
  {hasError && (
    <p id="email-error" role="alert" className="text-sm text-destructive">
      Invalid email address
    </p>
  )}
</div>
```

### Select Dropdowns

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

<Select>
  <SelectTrigger aria-label="Choose an option">
    <SelectValue placeholder="Choose an option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="1">Option 1</SelectItem>
    <SelectItem value="2">Option 2</SelectItem>
    <SelectItem value="3">Option 3</SelectItem>
  </SelectContent>
</Select>
```

### Checkboxes

```tsx
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

<div className="flex items-center space-x-2">
  <Checkbox id="terms" />
  <Label htmlFor="terms">Accept terms and conditions</Label>
</div>
```

### Radio Groups

```tsx
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

<RadioGroup defaultValue="option1">
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option1" id="option1" />
    <Label htmlFor="option1">Option 1</Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option2" id="option2" />
    <Label htmlFor="option2">Option 2</Label>
  </div>
</RadioGroup>
```

## Form Validation

### React Hook Form Integration

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

const formSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormData = z.infer<typeof formSchema>

export function SignupForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormData>({
    resolver: zodResolver(formSchema)
  })

  const onSubmit = async (data: FormData) => {
    // Handle form submission
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Form fields */}
    </form>
  )
}
```

### Error Handling

```tsx
<FormField
  label="Email Address"
  required
  error={errors.email?.message}
>
  <Input
    {...register('email')}
    type="email"
    placeholder="your.email@example.com"
    aria-invalid={errors.email ? 'true' : 'false'}
    aria-describedby={errors.email ? 'email-error' : undefined}
  />
</FormField>

{errors.email && (
  <div id="email-error" role="alert" className="text-sm text-destructive">
    {errors.email.message}
  </div>
)}
```

## Multi-Step Forms

```tsx
import { useState } from 'react'

export function MultiStepForm() {
  const [step, setStep] = useState(1)

  return (
    <div>
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          <span className={step >= 1 ? 'text-primary' : 'text-muted-foreground'}>
            Step 1
          </span>
          <span className={step >= 2 ? 'text-primary' : 'text-muted-foreground'}>
            Step 2
          </span>
          <span className={step >= 3 ? 'text-primary' : 'text-muted-foreground'}>
            Step 3
          </span>
        </div>
        <div className="h-2 bg-secondary rounded-full">
          <div
            className="h-2 bg-primary rounded-full transition-all"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Form steps */}
      {step === 1 && <Step1 onNext={() => setStep(2)} />}
      {step === 2 && <Step2 onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <Step3 onBack={() => setStep(2)} />}
    </div>
  )
}
```

## File Upload

```tsx
import { useState } from 'react'
import { Upload } from 'lucide-react'

export function FileUpload() {
  const [files, setFiles] = useState<File[]>([])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files)
    setFiles(prev => [...prev, ...droppedFiles])
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
    >
      <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">
        Drag and drop files here, or click to select
      </p>
      <input
        type="file"
        multiple
        onChange={(e) => {
          const selectedFiles = Array.from(e.target.files || [])
          setFiles(prev => [...prev, ...selectedFiles])
        }}
        className="hidden"
        id="file-upload"
      />
      <label
        htmlFor="file-upload"
        className="mt-4 inline-block cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Select Files
      </label>
    </div>
  )
}
```

## Accessibility Checklist

- [ ] All inputs have associated labels
- [ ] Error messages are linked with `aria-describedby`
- [ ] Invalid states are marked with `aria-invalid`
- [ ] Required fields are marked with `required` attribute
- [ ] Form submission provides feedback
- [ ] Loading states are communicated to screen readers
- [ ] Keyboard navigation works throughout the form
- [ ] Focus management is handled properly
- [ ] Color is not the only means of conveying validation state

## Best Practices

1. **Label Every Input**: Every form control must have a visible label
2. **Validate on Blur**: Provide immediate feedback when user leaves field
3. **Clear Error Messages**: Be specific about what went wrong and how to fix it
4. **Preserve Data**: Don't clear the form on submission error
5. **Disable Submit on Loading**: Prevent double submission
6. **Use Appropriate Input Types**: email, tel, url, etc. for better mobile experience
7. **Required Field Indication**: Mark required fields clearly
8. **Group Related Fields**: Use fieldsets for related form controls

---

**Source Documents:**
- `ui-design/docs/accessible-forms.tsx`
- `ui-design/docs/implementation-guide.md`
- `ui-design/docs/component-showcase.md`
