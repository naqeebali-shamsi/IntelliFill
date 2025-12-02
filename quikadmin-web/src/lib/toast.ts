/**
 * Enhanced toast notification utilities using Sonner
 * Provides custom types, action buttons, and better TypeScript support
 */

import { toast as sonnerToast } from "sonner"

// Define our own ToastOptions type since sonner doesn't export it
type ToastOptions = Parameters<typeof sonnerToast>[1]

export type ToastType = "success" | "error" | "warning" | "info" | "loading"

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface EnhancedToastOptions extends Omit<ToastOptions, "action"> {
  /**
   * Action button configuration
   */
  action?: ToastAction
  /**
   * Secondary action button
   */
  secondaryAction?: ToastAction
  /**
   * Duration in milliseconds (default: 4000)
   */
  duration?: number
  /**
   * Show close button
   */
  closeButton?: boolean
}

/**
 * Enhanced toast function with custom types and actions
 */
export const toast = {
  /**
   * Success toast
   */
  success: (message: string, options?: EnhancedToastOptions) => {
    return sonnerToast.success(message, {
      ...options,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
      duration: options?.duration ?? 4000,
    })
  },

  /**
   * Error toast
   */
  error: (message: string, options?: EnhancedToastOptions) => {
    return sonnerToast.error(message, {
      ...options,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
      duration: options?.duration ?? 5000,
    })
  },

  /**
   * Warning toast
   */
  warning: (message: string, options?: EnhancedToastOptions) => {
    return sonnerToast.warning(message, {
      ...options,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
      duration: options?.duration ?? 4000,
    })
  },

  /**
   * Info toast
   */
  info: (message: string, options?: EnhancedToastOptions) => {
    return sonnerToast.info(message, {
      ...options,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
      duration: options?.duration ?? 4000,
    })
  },

  /**
   * Loading toast (returns promise toast)
   */
  loading: (message: string, options?: EnhancedToastOptions) => {
    return sonnerToast.loading(message, {
      ...options,
      duration: Infinity, // Loading toasts don't auto-dismiss
    })
  },

  /**
   * Promise toast (automatically updates based on promise state)
   */
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((error: any) => string)
    }
  ) => {
    return sonnerToast.promise(promise, messages)
  },

  /**
   * Dismiss a toast by ID
   */
  dismiss: (toastId?: string | number) => {
    sonnerToast.dismiss(toastId)
  },

  /**
   * Dismiss all toasts
   */
  dismissAll: () => {
    sonnerToast.dismiss()
  },
}

export default toast
