/**
 * SearchBar component with debouncing, clear button, and keyboard shortcuts
 * @module components/features/search-bar
 */

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { X, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDebouncedValue } from "@/hooks/useDebounce"

export interface SearchBarProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value" | "results"> {
  /**
   * Search query value (controlled)
   */
  value: string
  /**
   * Search change callback
   */
  onChange: (value: string) => void
  /**
   * Debounce delay in milliseconds
   */
  debounceMs?: number
  /**
   * Show clear button
   */
  showClearButton?: boolean
  /**
   * Placeholder text
   */
  placeholder?: string
  /**
   * Callback when debounced value changes
   */
  onDebouncedChange?: (value: string) => void
  /**
   * Custom className
   */
  className?: string
}

/**
 * SearchBar component with debouncing, clear button, and keyboard shortcuts.
 *
 * Features:
 * - Debounced input (default 300ms)
 * - Clear button when value exists
 * - Keyboard shortcuts (Ctrl/Cmd+K to focus)
 * - Accessible search input
 *
 * @example
 * ```tsx
 * const [searchQuery, setSearchQuery] = useState('')
 *
 * <SearchBar
 *   value={searchQuery}
 *   onChange={setSearchQuery}
 *   placeholder="Search documents..."
 *   onDebouncedChange={(value) => {
 *     // Perform search API call
 *     fetchDocuments(value)
 *   }}
 * />
 * ```
 */
export function SearchBar({
  value,
  onChange,
  debounceMs = 300,
  showClearButton = true,
  placeholder = "Search...",
  onDebouncedChange,
  className,
  ...props
}: SearchBarProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const debouncedValue = useDebouncedValue(value, debounceMs)
  const isInitialMount = React.useRef(true)

  // Call debounced callback when debounced value changes (skip initial mount)
  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    if (onDebouncedChange) {
      onDebouncedChange(debouncedValue)
    }
  }, [debouncedValue, onDebouncedChange])

  // Keyboard shortcut: Ctrl/Cmd + K to focus search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
      }

      // Escape to clear search
      if (e.key === "Escape" && value && document.activeElement === inputRef.current) {
        onChange("")
        inputRef.current?.blur()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [value, onChange])

  const handleClear = () => {
    onChange("")
    inputRef.current?.focus()
  }

  return (
    <div
      data-slot="search-bar"
      className={cn("relative flex items-center", className)}
    >
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "pl-9 pr-9",
          showClearButton && value && "pr-9"
        )}
        aria-label="Search"
        {...props}
      />
      {showClearButton && value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 h-7 w-7 hover:bg-transparent"
          onClick={handleClear}
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      {/* Keyboard shortcut hint */}
      {!value && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:flex items-center gap-1">
          <kbd className="pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      )}
    </div>
  )
}

/**
 * SearchBarWithResults component - SearchBar with result suggestions
 */
export interface SearchBarWithResultsProps extends SearchBarProps {
  /**
   * Search results to display
   */
  results?: Array<{
    id: string
    label: string
    description?: string
  }>
  /**
   * Callback when result is selected
   */
  onResultSelect?: (result: { id: string; label: string }) => void
  /**
   * Maximum results to show
   */
  maxResults?: number
}

/**
 * SearchBarWithResults component with dropdown results.
 *
 * @example
 * ```tsx
 * <SearchBarWithResults
 *   value={searchQuery}
 *   onChange={setSearchQuery}
 *   results={searchResults}
 *   onResultSelect={(result) => navigateToDocument(result.id)}
 * />
 * ```
 */
export function SearchBarWithResults({
  results = [],
  onResultSelect,
  maxResults = 5,
  ...searchBarProps
}: SearchBarWithResultsProps) {
  const [showResults, setShowResults] = React.useState(false)
  const searchBarRef = React.useRef<HTMLDivElement>(null)

  const displayResults = results.slice(0, maxResults)

  // Close results when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchBarRef.current &&
        !searchBarRef.current.contains(event.target as Node)
      ) {
        setShowResults(false)
      }
    }

    if (showResults) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showResults])

  return (
    <div ref={searchBarRef} className="relative w-full">
      <SearchBar
        {...searchBarProps}
        onFocus={() => {
          if (displayResults.length > 0 && searchBarProps.value) {
            setShowResults(true)
          }
        }}
      />
      {showResults && displayResults.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
          {displayResults.map((result) => (
            <button
              key={result.id}
              type="button"
              className="w-full text-left px-4 py-2 hover:bg-accent transition-colors"
              onClick={() => {
                onResultSelect?.(result)
                setShowResults(false)
              }}
            >
              <div className="font-medium text-sm">{result.label}</div>
              {result.description && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {result.description}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default SearchBar
