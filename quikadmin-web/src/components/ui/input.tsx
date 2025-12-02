import * as React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "./button"

export interface InputProps extends React.ComponentProps<"input"> {
  /**
   * Show clear button when input has value
   */
  showClearButton?: boolean
  /**
   * Icon to display on the left side
   */
  leftIcon?: React.ReactNode
  /**
   * Icon to display on the right side (before clear button if enabled)
   */
  rightIcon?: React.ReactNode
  /**
   * Callback when clear button is clicked
   */
  onClear?: () => void
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      showClearButton = false,
      leftIcon,
      rightIcon,
      onClear,
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue ?? value ?? "")
    const isControlled = value !== undefined
    const currentValue = isControlled ? value : internalValue
    const hasValue = currentValue !== "" && currentValue !== null && currentValue !== undefined

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) {
        setInternalValue(e.target.value)
      }
      onChange?.(e)
    }

    const handleClear = () => {
      if (!isControlled) {
        setInternalValue("")
      }
      // Create a synthetic event for the onChange handler
      const syntheticEvent = {
        target: { value: "" },
      } as React.ChangeEvent<HTMLInputElement>
      onChange?.(syntheticEvent)
      onClear?.()
    }

    const showClear = showClearButton && hasValue && !props.disabled

    return (
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          type={type}
          data-slot="input"
          value={currentValue}
          onChange={handleChange}
          className={cn(
            "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
            leftIcon && "pl-9",
            (showClear || rightIcon) && "pr-9",
            className
          )}
          {...props}
        />
        {(showClear || rightIcon) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {rightIcon && (
              <span className="text-muted-foreground pointer-events-none">
                {rightIcon}
              </span>
            )}
            {showClear && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 rounded-sm opacity-70 hover:opacity-100"
                onClick={handleClear}
                aria-label="Clear input"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }
)

Input.displayName = "Input"

export { Input }
