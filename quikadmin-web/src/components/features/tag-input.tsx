import { useState, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface TagInputProps {
  /** Current array of tags */
  tags: string[];
  /** Callback when tags change */
  onChange: (tags: string[]) => void;
  /** Optional suggestions for autocomplete */
  suggestions?: string[];
  /** Placeholder text for input */
  placeholder?: string;
  /** Maximum number of tags allowed */
  maxTags?: number;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** ID for the input element */
  id?: string;
  /** Aria label for accessibility */
  'aria-label'?: string;
}

/**
 * TagInput component for adding and removing tags
 *
 * Features:
 * - Add tags via Enter or comma key
 * - Remove tags via X button or Backspace key
 * - Optional autocomplete suggestions
 * - Max tags limit
 * - Keyboard accessible
 */
export function TagInput({
  tags,
  onChange,
  suggestions = [],
  placeholder = 'Add tag...',
  maxTags = 10,
  disabled = false,
  className,
  id,
  'aria-label': ariaLabel,
}: TagInputProps) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input and exclude already selected tags
  const filteredSuggestions = suggestions.filter(
    (suggestion) =>
      suggestion.toLowerCase().includes(input.toLowerCase()) &&
      !tags.includes(suggestion.toLowerCase())
  );

  const addTag = useCallback(
    (tag: string) => {
      const normalized = tag.trim().toLowerCase();
      if (normalized && !tags.includes(normalized) && tags.length < maxTags) {
        onChange([...tags, normalized]);
        setInput('');
        setShowSuggestions(false);
        setHighlightedIndex(-1);
      }
    },
    [tags, maxTags, onChange]
  );

  const removeTag = useCallback(
    (tag: string) => {
      onChange(tags.filter((t) => t !== tag));
    },
    [tags, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;

      switch (e.key) {
        case 'Enter':
        case ',':
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
            addTag(filteredSuggestions[highlightedIndex]);
          } else if (input) {
            addTag(input);
          }
          break;

        case 'Backspace':
          if (!input && tags.length > 0) {
            removeTag(tags[tags.length - 1]);
          }
          break;

        case 'ArrowDown':
          if (showSuggestions && filteredSuggestions.length > 0) {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
          }
          break;

        case 'ArrowUp':
          if (showSuggestions && filteredSuggestions.length > 0) {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
          }
          break;

        case 'Escape':
          setShowSuggestions(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [
      disabled,
      highlightedIndex,
      filteredSuggestions,
      input,
      tags,
      addTag,
      removeTag,
      showSuggestions,
    ]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      // Auto-add tag if comma is typed
      if (value.includes(',')) {
        const parts = value.split(',');
        parts.forEach((part, index) => {
          if (index < parts.length - 1) {
            addTag(part);
          } else {
            setInput(part);
          }
        });
      } else {
        setInput(value);
        setShowSuggestions(value.length > 0 && filteredSuggestions.length > 0);
        setHighlightedIndex(-1);
      }
    },
    [addTag, filteredSuggestions.length]
  );

  const handleFocus = useCallback(() => {
    if (input && filteredSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [input, filteredSuggestions.length]);

  const handleBlur = useCallback(() => {
    // Delay hiding suggestions to allow click events to fire
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false);
        setHighlightedIndex(-1);
      }
    }, 150);
  }, []);

  const handleContainerClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      addTag(suggestion);
      inputRef.current?.focus();
    },
    [addTag]
  );

  const isMaxReached = tags.length >= maxTags;

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      {/* Main input container */}
      <div
        className={cn(
          'flex flex-wrap gap-2 p-2 border rounded-lg bg-background',
          'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          'transition-colors cursor-text',
          disabled && 'opacity-50 cursor-not-allowed bg-muted'
        )}
        onClick={handleContainerClick}
      >
        {/* Existing tags */}
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1 select-none">
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(tag);
                }}
                className="ml-0.5 rounded-full hover:bg-secondary-foreground/20 p-0.5 transition-colors"
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}

        {/* Input field */}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={isMaxReached ? '' : placeholder}
          disabled={disabled || isMaxReached}
          className={cn(
            'flex-1 min-w-[120px] outline-none bg-transparent text-sm',
            'placeholder:text-muted-foreground',
            (disabled || isMaxReached) && 'cursor-not-allowed'
          )}
          aria-label={ariaLabel || 'Add tags'}
          aria-describedby={isMaxReached ? 'max-tags-reached' : undefined}
          autoComplete="off"
        />
      </div>

      {/* Max tags message */}
      {isMaxReached && (
        <p id="max-tags-reached" className="text-xs text-muted-foreground mt-1">
          Maximum of {maxTags} tags reached
        </p>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <ul
          className={cn(
            'absolute z-50 w-full mt-1 py-1',
            'bg-popover border rounded-lg shadow-lg',
            'max-h-48 overflow-auto'
          )}
          role="listbox"
        >
          {filteredSuggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              role="option"
              aria-selected={index === highlightedIndex}
              className={cn(
                'px-3 py-2 text-sm cursor-pointer',
                'hover:bg-accent hover:text-accent-foreground',
                index === highlightedIndex && 'bg-accent text-accent-foreground'
              )}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default TagInput;
