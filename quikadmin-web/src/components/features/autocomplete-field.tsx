/**
 * AutocompleteField Component
 *
 * An intelligent form field with autocomplete suggestions from user profile.
 * Features:
 * - Dropdown with ranked suggestions
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Click-to-fill functionality
 * - Confidence indicators
 * - Support for multiple field types
 *
 * @module components/features/autocomplete-field
 */

import * as React from 'react';
import { ChevronDown, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { getSuggestionEngine, Suggestion, FieldType } from '@/services/suggestionEngine';

export interface AutocompleteFieldProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  /**
   * Field name (used for suggestion matching)
   */
  name: string;

  /**
   * Field type for better suggestion filtering
   */
  fieldType?: FieldType;

  /**
   * Label for the field
   */
  label?: string;

  /**
   * Show confidence badges on suggestions
   */
  showConfidence?: boolean;

  /**
   * Maximum number of suggestions to show
   */
  maxSuggestions?: number;

  /**
   * Callback when a suggestion is selected
   */
  onSuggestionSelect?: (value: string) => void;

  /**
   * Custom error message
   */
  error?: string;

  /**
   * Show required indicator
   */
  required?: boolean;

  /**
   * Custom container className
   */
  containerClassName?: string;
}

/**
 * AutocompleteField Component
 */
export const AutocompleteField = React.forwardRef<HTMLInputElement, AutocompleteFieldProps>(
  (
    {
      name,
      fieldType,
      label,
      showConfidence = true,
      maxSuggestions = 5,
      onSuggestionSelect,
      error,
      required = false,
      containerClassName,
      className,
      value,
      onChange,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState<string>((value as string) || '');
    const [isOpen, setIsOpen] = React.useState(false);
    const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
    const [selectedIndex, setSelectedIndex] = React.useState(-1);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isFocused, setIsFocused] = React.useState(false);

    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Combine refs
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    // Debounce the input value for suggestion fetching
    const debouncedValue = useDebouncedValue(internalValue, 300);

    // Get suggestion engine instance
    const suggestionEngine = React.useMemo(() => getSuggestionEngine(), []);

    // Controlled vs uncontrolled
    const isControlled = value !== undefined;
    const currentValue = isControlled ? (value as string) : internalValue;

    /**
     * Fetch suggestions based on current field state
     */
    const fetchSuggestions = React.useCallback(
      async (inputValue: string) => {
        setIsLoading(true);
        try {
          const results = await suggestionEngine.getSuggestions(
            name,
            fieldType,
            inputValue,
            maxSuggestions
          );
          setSuggestions(results);
          setIsOpen(results.length > 0 && isFocused);
        } catch (error) {
          console.error('Failed to fetch suggestions:', error);
          setSuggestions([]);
        } finally {
          setIsLoading(false);
        }
      },
      [name, fieldType, maxSuggestions, suggestionEngine, isFocused]
    );

    /**
     * Fetch suggestions when debounced value changes
     */
    React.useEffect(() => {
      if (isFocused) {
        fetchSuggestions(debouncedValue);
      }
    }, [debouncedValue, fetchSuggestions, isFocused]);

    /**
     * Handle input change
     */
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      if (!isControlled) {
        setInternalValue(newValue);
      }
      setSelectedIndex(-1);
      onChange?.(e);
    };

    /**
     * Handle input focus
     */
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      if (suggestions.length > 0) {
        setIsOpen(true);
      }
      onFocus?.(e);
    };

    /**
     * Handle input blur (with delay for click events)
     */
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Delay to allow click events on suggestions
      setTimeout(() => {
        setIsFocused(false);
        setIsOpen(false);
        setSelectedIndex(-1);
      }, 200);
      onBlur?.(e);
    };

    /**
     * Select a suggestion
     */
    const selectSuggestion = (suggestion: Suggestion) => {
      const newValue = suggestion.value;

      if (!isControlled) {
        setInternalValue(newValue);
      }

      // Create synthetic event for onChange
      const syntheticEvent = {
        target: { value: newValue, name },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange?.(syntheticEvent);

      onSuggestionSelect?.(newValue);
      setIsOpen(false);
      setSelectedIndex(-1);
      inputRef.current?.focus();
    };

    /**
     * Handle keyboard navigation
     */
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || suggestions.length === 0) {
        // If dropdown is closed and arrow down is pressed, open it
        if (e.key === 'ArrowDown' && suggestions.length > 0) {
          setIsOpen(true);
          setSelectedIndex(0);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;

        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            selectSuggestion(suggestions[selectedIndex]);
          }
          break;

        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setSelectedIndex(-1);
          break;

        case 'Tab':
          // Allow tab to close dropdown without selecting
          setIsOpen(false);
          setSelectedIndex(-1);
          break;
      }
    };

    /**
     * Scroll selected item into view
     */
    React.useEffect(() => {
      if (selectedIndex >= 0 && dropdownRef.current) {
        const selectedElement = dropdownRef.current.querySelector(
          `[data-index="${selectedIndex}"]`
        );
        selectedElement?.scrollIntoView({ block: 'nearest' });
      }
    }, [selectedIndex]);

    /**
     * Get confidence badge variant
     */
    const getConfidenceBadge = (confidence: number) => {
      const level = suggestionEngine.getConfidenceLevel(confidence);
      const variants = {
        high: { variant: 'default' as const, label: 'High' },
        medium: { variant: 'secondary' as const, label: 'Medium' },
        low: { variant: 'outline' as const, label: 'Low' },
      };
      return variants[level];
    };

    return (
      <div className={cn('relative w-full', containerClassName)}>
        {/* Label */}
        {label && (
          <label
            htmlFor={name}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2 block"
          >
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </label>
        )}

        {/* Input Field */}
        <div className="relative">
          <Input
            ref={inputRef}
            id={name}
            name={name}
            value={currentValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={cn(
              'pr-10',
              error && 'border-destructive',
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${name}-error` : undefined}
            aria-autocomplete="list"
            aria-controls={`${name}-suggestions`}
            aria-expanded={isOpen}
            autoComplete="off"
            {...props}
          />

          {/* Dropdown indicator */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
            {isLoading && (
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            )}
            {suggestions.length > 0 && (
              <Sparkles className="h-4 w-4 text-primary" />
            )}
            {!isLoading && (
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform',
                  isOpen && 'rotate-180'
                )}
              />
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <p id={`${name}-error`} className="text-sm text-destructive mt-1">
            {error}
          </p>
        )}

        {/* Suggestions dropdown */}
        {isOpen && suggestions.length > 0 && (
          <div
            id={`${name}-suggestions`}
            ref={dropdownRef}
            role="listbox"
            className={cn(
              'absolute z-50 w-full mt-1',
              'bg-popover text-popover-foreground',
              'border rounded-md shadow-lg',
              'max-h-60 overflow-auto',
              'animate-in fade-in-0 zoom-in-95'
            )}
          >
            {suggestions.map((suggestion, index) => {
              const isSelected = index === selectedIndex;
              const confidenceBadge = getConfidenceBadge(suggestion.confidence);

              return (
                <div
                  key={`${suggestion.fieldKey}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => selectSuggestion(suggestion)}
                  className={cn(
                    'px-3 py-2.5 cursor-pointer',
                    'flex items-center justify-between gap-2',
                    'transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    isSelected && 'bg-accent text-accent-foreground'
                  )}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isSelected && <Check className="h-4 w-4 shrink-0" />}
                    <span className="truncate text-sm">{suggestion.value}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {showConfidence && (
                      <Badge variant={confidenceBadge.variant} className="text-xs">
                        {confidenceBadge.label}
                      </Badge>
                    )}
                    {suggestion.sourceCount > 1 && (
                      <span className="text-xs text-muted-foreground">
                        {suggestion.sourceCount} sources
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* No suggestions message (when loading is complete) */}
        {isFocused && !isLoading && currentValue.length > 0 && suggestions.length === 0 && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3">
            <p className="text-sm text-muted-foreground text-center">
              No suggestions available
            </p>
          </div>
        )}
      </div>
    );
  }
);

AutocompleteField.displayName = 'AutocompleteField';

export default AutocompleteField;
