// Accessible Form Components with Proper ARIA Labels
import React, { useState, useId } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  Calendar,
  CalendarDays,
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  EyeOff,
  Info,
  HelpCircle,
  User,
  Mail,
  Phone,
  Building
} from 'lucide-react'

interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  description?: string
  children: React.ReactNode
  className?: string
}

interface ValidationRule {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  custom?: (value: string) => string | null
}

interface FormField {
  id: string
  label: string
  type: 'text' | 'email' | 'tel' | 'password' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date'
  required?: boolean
  placeholder?: string
  description?: string
  options?: { value: string; label: string }[]
  validation?: ValidationRule
}

const FormFieldWrapper: React.FC<FormFieldProps> = ({
  label,
  required = false,
  error,
  description,
  children,
  className = ''
}) => {
  const errorId = useId()
  const descriptionId = useId()
  
  return (
    <div className={`space-y-2 ${className}`}>
      <Label className={`text-sm font-medium ${required ? "after:content-['*'] after:text-red-500 after:ml-1" : ""}`}>
        {label}
      </Label>
      {description && (
        <p id={descriptionId} className="text-xs text-muted-foreground flex items-start gap-2">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          {description}
        </p>
      )}
      <div className="relative">
        {React.cloneElement(children as React.ReactElement, {
          'aria-describedby': `${description ? descriptionId : ''} ${error ? errorId : ''}`.trim() || undefined,
          'aria-invalid': error ? 'true' : 'false',
          'aria-required': required ? 'true' : 'false',
          className: `${(children as React.ReactElement).props.className || ''} ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`
        })}
      </div>
      {error && (
        <div id={errorId} role="alert" className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  )
}

const PasswordField: React.FC<{
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
  required?: boolean
}> = ({ id, value, onChange, placeholder, error, required }) => {
  const [showPassword, setShowPassword] = useState(false)
  
  return (
    <div className="relative">
      <Input
        id={id}
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`pr-10 ${error ? 'border-red-500' : ''}`}
        aria-required={required}
        aria-invalid={error ? 'true' : 'false'}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
        onClick={() => setShowPassword(!showPassword)}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {showPassword ? (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Eye className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
    </div>
  )
}

const FormProgress: React.FC<{ currentStep: number; totalSteps: number; stepTitles: string[] }> = ({
  currentStep,
  totalSteps,
  stepTitles
}) => {
  const progress = ((currentStep - 1) / (totalSteps - 1)) * 100

  return (
    <div className="space-y-4" role="region" aria-label="Form progress">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          Step {currentStep} of {totalSteps}
        </h2>
        <span className="text-sm text-muted-foreground">
          {Math.round(progress)}% Complete
        </span>
      </div>
      
      <Progress value={progress} className="h-2" aria-label="Form completion progress" />
      
      <nav aria-label="Form steps">
        <ol className="flex items-center space-x-2 text-sm">
          {stepTitles.map((title, index) => (
            <li key={index} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  index + 1 < currentStep
                    ? 'bg-primary border-primary text-primary-foreground'
                    : index + 1 === currentStep
                    ? 'border-primary text-primary'
                    : 'border-muted-foreground/30 text-muted-foreground'
                }`}
                aria-current={index + 1 === currentStep ? 'step' : undefined}
              >
                {index + 1 < currentStep ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              {index < stepTitles.length - 1 && (
                <div className="w-12 h-px bg-muted-foreground/30 mx-2" />
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  )
}

export const AccessibleForm: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const stepTitles = ['Personal Info', 'Contact Details', 'Preferences', 'Review']

  const formFields: Record<number, FormField[]> = {
    1: [
      {
        id: 'firstName',
        label: 'First Name',
        type: 'text',
        required: true,
        placeholder: 'Enter your first name',
        validation: { required: true, minLength: 2 }
      },
      {
        id: 'lastName',
        label: 'Last Name',
        type: 'text',
        required: true,
        placeholder: 'Enter your last name',
        validation: { required: true, minLength: 2 }
      },
      {
        id: 'birthDate',
        label: 'Date of Birth',
        type: 'date',
        required: true,
        description: 'Used for age verification and personalization'
      }
    ],
    2: [
      {
        id: 'email',
        label: 'Email Address',
        type: 'email',
        required: true,
        placeholder: 'your.email@example.com',
        description: 'We\'ll use this to send you important updates',
        validation: { 
          required: true, 
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ 
        }
      },
      {
        id: 'phone',
        label: 'Phone Number',
        type: 'tel',
        placeholder: '+1 (555) 123-4567',
        description: 'Optional - for urgent notifications only'
      },
      {
        id: 'address',
        label: 'Address',
        type: 'textarea',
        placeholder: 'Enter your full address',
        description: 'Used for document delivery and verification'
      }
    ],
    3: [
      {
        id: 'notifications',
        label: 'Email Notifications',
        type: 'checkbox',
        description: 'Receive updates about your PDF processing status'
      },
      {
        id: 'theme',
        label: 'Preferred Theme',
        type: 'radio',
        options: [
          { value: 'light', label: 'Light Theme' },
          { value: 'dark', label: 'Dark Theme' },
          { value: 'system', label: 'System Default' }
        ],
        description: 'Choose your preferred color scheme'
      },
      {
        id: 'language',
        label: 'Language',
        type: 'select',
        options: [
          { value: 'en', label: 'English' },
          { value: 'es', label: 'Español' },
          { value: 'fr', label: 'Français' },
          { value: 'de', label: 'Deutsch' }
        ],
        required: true
      }
    ]
  }

  const validateField = (field: FormField, value: any): string | null => {
    if (!field.validation) return null

    if (field.validation.required && (!value || value.toString().trim() === '')) {
      return `${field.label} is required`
    }

    if (field.validation.minLength && value && value.toString().length < field.validation.minLength) {
      return `${field.label} must be at least ${field.validation.minLength} characters`
    }

    if (field.validation.maxLength && value && value.toString().length > field.validation.maxLength) {
      return `${field.label} must not exceed ${field.validation.maxLength} characters`
    }

    if (field.validation.pattern && value && !field.validation.pattern.test(value.toString())) {
      return `Please enter a valid ${field.label.toLowerCase()}`
    }

    if (field.validation.custom && value) {
      return field.validation.custom(value.toString())
    }

    return null
  }

  const validateCurrentStep = (): boolean => {
    const currentFields = formFields[currentStep] || []
    const newErrors: Record<string, string> = {}

    currentFields.forEach(field => {
      const error = validateField(field, formData[field.id])
      if (error) {
        newErrors[field.id] = error
      }
    })

    setErrors(prev => ({ ...prev, ...newErrors }))
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, stepTitles.length))
    }
  }

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return

    setIsSubmitting(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      alert('Form submitted successfully!')
    } catch (error) {
      alert('Error submitting form')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderField = (field: FormField) => {
    const fieldId = field.id
    const value = formData[fieldId] || ''
    const error = errors[fieldId]

    const updateValue = (newValue: any) => {
      setFormData(prev => ({ ...prev, [fieldId]: newValue }))
      if (error) {
        setErrors(prev => ({ ...prev, [fieldId]: '' }))
      }
    }

    const commonProps = {
      id: fieldId,
      value,
      onChange: updateValue,
      placeholder: field.placeholder,
      error,
      required: field.required
    }

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'date':
        return (
          <FormFieldWrapper 
            label={field.label}
            required={field.required}
            error={error}
            description={field.description}
          >
            <Input
              {...commonProps}
              type={field.type}
              onChange={(e) => updateValue(e.target.value)}
            />
          </FormFieldWrapper>
        )

      case 'password':
        return (
          <FormFieldWrapper 
            label={field.label}
            required={field.required}
            error={error}
            description={field.description}
          >
            <PasswordField {...commonProps} />
          </FormFieldWrapper>
        )

      case 'textarea':
        return (
          <FormFieldWrapper 
            label={field.label}
            required={field.required}
            error={error}
            description={field.description}
          >
            <Textarea
              {...commonProps}
              onChange={(e) => updateValue(e.target.value)}
              rows={4}
            />
          </FormFieldWrapper>
        )

      case 'select':
        return (
          <FormFieldWrapper 
            label={field.label}
            required={field.required}
            error={error}
            description={field.description}
          >
            <Select value={value} onValueChange={updateValue}>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormFieldWrapper>
        )

      case 'checkbox':
        return (
          <FormFieldWrapper 
            label=""
            error={error}
            description={field.description}
          >
            <div className="flex items-center space-x-2">
              <Checkbox
                id={fieldId}
                checked={value || false}
                onCheckedChange={updateValue}
                aria-describedby={field.description ? `${fieldId}-description` : undefined}
              />
              <Label htmlFor={fieldId} className="text-sm font-normal cursor-pointer">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
            </div>
          </FormFieldWrapper>
        )

      case 'radio':
        return (
          <FormFieldWrapper 
            label={field.label}
            required={field.required}
            error={error}
            description={field.description}
          >
            <RadioGroup value={value} onValueChange={updateValue}>
              {field.options?.map(option => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={`${fieldId}-${option.value}`} />
                  <Label htmlFor={`${fieldId}-${option.value}`} className="text-sm font-normal cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </FormFieldWrapper>
        )

      default:
        return null
    }
  }

  const renderReviewStep = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Review Your Information</h3>
      <div className="grid gap-4">
        {Object.entries(formData).map(([key, value]) => {
          const allFields = Object.values(formFields).flat()
          const field = allFields.find(f => f.id === key)
          if (!field || !value) return null

          return (
            <div key={key} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <span className="font-medium">{field.label}:</span>
              <span className="text-muted-foreground">
                {field.type === 'checkbox' ? (value ? 'Yes' : 'No') : value.toString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>PDF Filler Registration</CardTitle>
        <CardDescription>
          Create your account to start processing PDF forms efficiently
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <FormProgress 
          currentStep={currentStep}
          totalSteps={stepTitles.length}
          stepTitles={stepTitles}
        />

        <form onSubmit={(e) => e.preventDefault()}>
          {currentStep === 4 ? renderReviewStep() : (
            <div className="space-y-6">
              {formFields[currentStep]?.map((field) => (
                <div key={field.id}>
                  {renderField(field)}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 1}
            >
              Previous
            </Button>
            
            <div className="space-x-2">
              {currentStep < stepTitles.length ? (
                <Button type="button" onClick={handleNext}>
                  Next
                </Button>
              ) : (
                <Button 
                  type="button" 
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Submitting...
                    </>
                  ) : (
                    'Submit'
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default AccessibleForm