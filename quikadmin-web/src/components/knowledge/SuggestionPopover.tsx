/**
 * SuggestionPopover component for form field auto-fill suggestions
 * Features: Show suggestions from knowledge base, apply suggestions to form fields
 * @module components/knowledge/SuggestionPopover
 */

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sparkles,
  FileText,
  Check,
  ChevronDown,
  Lightbulb,
  Info,
  Loader2,
} from 'lucide-react'
import { useKnowledgeStore, useFieldSuggestions, useSuggestionsLoading } from '@/stores/knowledgeStore'
import { FieldSuggestion } from '@/services/knowledgeService'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export interface SuggestionPopoverProps {
  /**
   * Field name to get suggestions for
   */
  fieldName: string
  /**
   * Field type hint for better suggestions
   */
  fieldType?: 'text' | 'date' | 'email' | 'phone' | 'number' | 'address' | 'name'
  /**
   * Current field value (for contextual suggestions)
   */
  currentValue?: string
  /**
   * Other filled field values (for contextual suggestions)
   */
  filledFields?: Record<string, string>
  /**
   * Callback when a suggestion is selected
   */
  onSelect: (value: string) => void
  /**
   * Custom trigger element (defaults to sparkle icon button)
   */
  trigger?: React.ReactNode
  /**
   * Whether the popover is disabled
   */
  disabled?: boolean
  /**
   * Additional class names for the trigger
   */
  className?: string
  /**
   * Popover alignment
   */
  align?: 'start' | 'center' | 'end'
  /**
   * Popover side
   */
  side?: 'top' | 'right' | 'bottom' | 'left'
}

// ============================================================================
// Helper Components
// ============================================================================

function SuggestionItem({
  suggestion,
  onSelect,
  isSelected,
}: {
  suggestion: FieldSuggestion
  onSelect: () => void
  isSelected: boolean
}) {
  const confidence = Math.round(suggestion.confidence * 100)

  // Determine confidence badge color
  const confidenceColor =
    confidence >= 80
      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
      : confidence >= 60
        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
        : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'

  // Extraction method badge
  const methodBadge = {
    regex: { label: 'Pattern', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    semantic: { label: 'Semantic', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
    context: { label: 'Context', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  }[suggestion.extractionMethod] || { label: suggestion.extractionMethod, color: 'bg-gray-100 text-gray-700' }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left px-3 py-2 rounded-md transition-colors',
        'hover:bg-muted focus:bg-muted focus:outline-none',
        isSelected && 'bg-muted'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{suggestion.value}</p>
          <div className="flex items-center gap-2 mt-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                    <FileText className="h-3 w-3 shrink-0" />
                    {suggestion.sourceTitle}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">Source: {suggestion.sourceTitle}</p>
                  {suggestion.matchedText && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                      "{suggestion.matchedText}"
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={cn('text-xs px-1.5 py-0.5 rounded', confidenceColor)}>
            {confidence}%
          </span>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded', methodBadge.color)}>
            {methodBadge.label}
          </span>
        </div>
      </div>
    </button>
  )
}

function LoadingSuggestions() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="px-3 py-2">
          <Skeleton className="h-4 w-3/4" />
          <div className="flex items-center gap-2 mt-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptySuggestions() {
  return (
    <div className="p-4 text-center text-muted-foreground">
      <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
      <p className="text-sm font-medium">No suggestions found</p>
      <p className="text-xs mt-1">
        Upload more documents to improve suggestions
      </p>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function SuggestionPopover({
  fieldName,
  fieldType,
  currentValue,
  filledFields,
  onSelect,
  trigger,
  disabled = false,
  className,
  align = 'start',
  side = 'bottom',
}: SuggestionPopoverProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedIndex, setSelectedIndex] = React.useState(-1)

  // Store state and actions
  const suggestions = useFieldSuggestions(fieldName)
  const suggestionsLoading = useSuggestionsLoading()
  const { fetchFieldSuggestions, fetchContextualSuggestions, clearSuggestions } = useKnowledgeStore()

  // Fetch suggestions when popover opens
  React.useEffect(() => {
    if (!open) return

    // Use contextual suggestions if we have filled fields
    if (filledFields && Object.keys(filledFields).length > 0) {
      fetchContextualSuggestions({
        fieldName,
        filledFields,
        maxSuggestions: 5,
      })
    } else {
      fetchFieldSuggestions({
        fieldName,
        fieldType,
        context: currentValue,
        maxSuggestions: 5,
      })
    }
  }, [open, fieldName, fieldType, currentValue, filledFields, fetchFieldSuggestions, fetchContextualSuggestions])

  // Handle suggestion selection
  const handleSelect = (suggestion: FieldSuggestion) => {
    onSelect(suggestion.value)
    setOpen(false)
    setSelectedIndex(-1)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        setSelectedIndex(-1)
        break
    }
  }

  // Clean up on unmount
  React.useEffect(() => {
    return () => {
      clearSuggestions(fieldName)
    }
  }, [fieldName, clearSuggestions])

  // Default trigger
  const defaultTrigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('h-8 w-8 shrink-0', className)}
      disabled={disabled}
    >
      <Sparkles className="h-4 w-4" />
      <span className="sr-only">Get suggestions for {fieldName}</span>
    </Button>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || defaultTrigger}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className="w-80 p-0"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-3 py-2 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Suggestions</span>
            {suggestionsLoading && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            From your knowledge base
          </p>
        </div>

        {/* Content */}
        <ScrollArea className="max-h-64">
          {suggestionsLoading ? (
            <LoadingSuggestions />
          ) : suggestions.length === 0 ? (
            <EmptySuggestions />
          ) : (
            <div className="p-1 space-y-0.5">
              {suggestions.map((suggestion, index) => (
                <SuggestionItem
                  key={`${suggestion.sourceChunkId}-${index}`}
                  suggestion={suggestion}
                  onSelect={() => handleSelect(suggestion)}
                  isSelected={index === selectedIndex}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {suggestions.length > 0 && (
          <div className="px-3 py-2 border-t bg-muted/50">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              <span>Use arrow keys to navigate, Enter to select</span>
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ============================================================================
// Convenience Components
// ============================================================================

/**
 * SuggestionInput - Input with integrated suggestion button
 */
export interface SuggestionInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onSelect'> {
  fieldName: string
  fieldType?: SuggestionPopoverProps['fieldType']
  filledFields?: Record<string, string>
  onValueChange?: (value: string) => void
}

export function SuggestionInput({
  fieldName,
  fieldType,
  filledFields,
  onValueChange,
  className,
  value,
  onChange,
  ...props
}: SuggestionInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleSuggestionSelect = (suggestionValue: string) => {
    // Update via callback
    onValueChange?.(suggestionValue)

    // Also update via native event for form libraries
    if (inputRef.current) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set
      nativeInputValueSetter?.call(inputRef.current, suggestionValue)

      const event = new Event('input', { bubbles: true })
      inputRef.current.dispatchEvent(event)
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={onChange}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'pr-10',
          className
        )}
        {...props}
      />
      <div className="absolute right-1 top-1/2 -translate-y-1/2">
        <SuggestionPopover
          fieldName={fieldName}
          fieldType={fieldType}
          currentValue={value as string}
          filledFields={filledFields}
          onSelect={handleSuggestionSelect}
        />
      </div>
    </div>
  )
}

export default SuggestionPopover
