/**
 * Enhanced Zustand Middleware Collection
 * Production-ready middleware for state management
 */

import { StateCreator, StoreMutatorIdentifier } from 'zustand';

/**
 * Error Boundary Middleware
 * Catches and handles errors in store operations
 */
export const errorBoundary = <T extends object>(
  config: StateCreator<T, [], [], T>
): StateCreator<T, [], [], T> => {
  return (set, get, api) => {
    const wrappedSet: typeof set = (fn) => {
      try {
        set((state) => {
          try {
            const newState = typeof fn === 'function' ? fn(state) : fn;
            return newState;
          } catch (error) {
            console.error('[Store Error] Update failed:', error);
            // Return current state unchanged on error
            return state;
          }
        });
      } catch (error) {
        console.error('[Middleware Error]:', error);
      }
    };

    return config(wrappedSet, get, api);
  };
};

/**
 * Performance Monitoring Middleware
 * Tracks store update performance and warns about slow operations
 */
export const performanceMonitor = <T extends object>(
  config: StateCreator<T, [], [], T>,
  options: { threshold?: number; logSlow?: boolean } = {}
): StateCreator<T, [], [], T> => {
  const { threshold = 16, logSlow = true } = options; // 16ms = 1 frame at 60fps

  return (set, get, api) => {
    const monitoredSet: typeof set = (fn) => {
      const start = performance.now();
      
      set(fn);
      
      const duration = performance.now() - start;
      
      if (duration > threshold && logSlow) {
        console.warn(`[Performance] Slow store update: ${duration.toFixed(2)}ms`);
        
        // Log the state change for debugging
        if (process.env.NODE_ENV === 'development') {
          console.trace('Slow update trace');
        }
      }
      
      // Emit performance metrics (integrate with your analytics)
      if (window.analytics?.track) {
        window.analytics.track('store_update_performance', {
          duration,
          isSlow: duration > threshold,
          timestamp: Date.now()
        });
      }
    };

    return config(monitoredSet, get, api);
  };
};

/**
 * Action Logger Middleware
 * Logs all state changes with action names and payloads
 */
export const actionLogger = <T extends object>(
  config: StateCreator<T, [], [], T>,
  options: { collapsed?: boolean; diff?: boolean } = {}
): StateCreator<T, [], [], T> => {
  const { collapsed = true, diff = false } = options;

  return (set, get, api) => {
    const loggedSet: typeof set = (fn) => {
      const prevState = get();
      const groupMethod = collapsed ? console.groupCollapsed : console.group;
      
      groupMethod(`[Store Update] ${new Date().toISOString()}`);
      console.log('Previous State:', prevState);
      
      set(fn);
      
      const nextState = get();
      console.log('Next State:', nextState);
      
      if (diff) {
        const changes = getStateChanges(prevState, nextState);
        if (changes.length > 0) {
          console.log('Changes:', changes);
        }
      }
      
      console.groupEnd();
    };

    return config(loggedSet, get, api);
  };
};

/**
 * Validation Middleware
 * Validates state changes against a schema
 */
export const validator = <T extends object>(
  config: StateCreator<T, [], [], T>,
  schema: (state: T) => boolean | { valid: boolean; errors?: string[] }
): StateCreator<T, [], [], T> => {
  return (set, get, api) => {
    const validatedSet: typeof set = (fn) => {
      set((state) => {
        const newState = typeof fn === 'function' ? fn(state) : fn;
        const validation = schema(newState as T);
        
        if (typeof validation === 'boolean' && !validation) {
          console.error('[Validation Error] State update rejected');
          return state; // Reject update
        }
        
        if (typeof validation === 'object' && !validation.valid) {
          console.error('[Validation Errors]:', validation.errors);
          return state; // Reject update
        }
        
        return newState;
      });
    };

    return config(validatedSet, get, api);
  };
};

/**
 * Undo/Redo Middleware
 * Adds time-travel debugging capabilities
 */
interface UndoRedoState {
  __history: any[];
  __future: any[];
  __tempState: any;
}

export const undoRedo = <T extends object>(
  config: StateCreator<T, [], [], T>,
  options: { limit?: number } = {}
): StateCreator<T & {
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
}, [], [], T> => {
  const { limit = 100 } = options;

  return (set, get, api) => {
    let history: T[] = [];
    let future: T[] = [];
    let isTimeTravel = false;

    const wrappedSet: typeof set = (fn) => {
      set((state) => {
        if (isTimeTravel) {
          return typeof fn === 'function' ? fn(state) : fn;
        }

        const prevState = { ...state };
        const newState = typeof fn === 'function' ? fn(state) : fn;

        // Add to history
        history.push(prevState as T);
        if (history.length > limit) {
          history.shift();
        }

        // Clear future on new action
        future = [];

        return newState;
      });
    };

    const store = config(wrappedSet, get, api);

    return {
      ...store,
      
      undo: () => {
        if (history.length === 0) return;

        isTimeTravel = true;
        const currentState = get();
        const previousState = history.pop()!;
        future.push(currentState as T);
        set(previousState);
        isTimeTravel = false;
      },

      redo: () => {
        if (future.length === 0) return;

        isTimeTravel = true;
        const currentState = get();
        const nextState = future.pop()!;
        history.push(currentState as T);
        set(nextState);
        isTimeTravel = false;
      },

      canUndo: () => history.length > 0,
      canRedo: () => future.length > 0,
      clearHistory: () => {
        history = [];
        future = [];
      }
    } as any;
  };
};

/**
 * Debounced Updates Middleware
 * Batches rapid state updates to improve performance
 */
export const debounce = <T extends object>(
  config: StateCreator<T, [], [], T>,
  delay: number = 300
): StateCreator<T, [], [], T> => {
  return (set, get, api) => {
    let timeoutId: NodeJS.Timeout | null = null;
    let pendingUpdates: Array<(state: T) => T> = [];

    const debouncedSet: typeof set = (fn) => {
      if (typeof fn === 'function') {
        pendingUpdates.push(fn as any);
      } else {
        pendingUpdates.push(() => fn);
      }

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        set((state) => {
          let newState = state;
          for (const update of pendingUpdates) {
            newState = update(newState);
          }
          pendingUpdates = [];
          return newState;
        });
      }, delay);
    };

    return config(debouncedSet, get, api);
  };
};

/**
 * Computed Properties Middleware
 * Automatically calculates derived state
 */
export const computed = <T extends object, C extends object>(
  config: StateCreator<T, [], [], T>,
  computedConfig: (state: T) => C
): StateCreator<T & C, [], [], T> => {
  return (set, get, api) => {
    const computedSet: typeof set = (fn) => {
      set((state) => {
        const baseState = typeof fn === 'function' ? fn(state) : fn;
        const computedState = computedConfig(baseState as T);
        return { ...baseState, ...computedState };
      });
    };

    const store = config(computedSet, get, api);
    const computedState = computedConfig(store);
    
    return { ...store, ...computedState } as any;
  };
};

/**
 * Encryption Middleware
 * Encrypts sensitive data before persistence
 */
export const encrypted = <T extends object>(
  config: StateCreator<T, [], [], T>,
  options: {
    encryptFields: (keyof T)[];
    encryptFn: (value: any) => string;
    decryptFn: (value: string) => any;
  }
): StateCreator<T, [], [], T> => {
  const { encryptFields, encryptFn, decryptFn } = options;

  return (set, get, api) => {
    const encryptedSet: typeof set = (fn) => {
      set((state) => {
        const newState = typeof fn === 'function' ? fn(state) : fn;
        const encrypted = { ...newState };

        for (const field of encryptFields) {
          if (field in encrypted) {
            encrypted[field] = encryptFn(encrypted[field]) as any;
          }
        }

        return encrypted;
      });
    };

    const store = config(encryptedSet, get, api);
    
    // Decrypt on read
    const decrypted = { ...store };
    for (const field of encryptFields) {
      if (field in decrypted && typeof decrypted[field] === 'string') {
        try {
          decrypted[field] = decryptFn(decrypted[field] as any);
        } catch (error) {
          console.error(`Failed to decrypt field ${String(field)}:`, error);
        }
      }
    }

    return decrypted;
  };
};

// Utility Functions

/**
 * Get changes between two states
 */
function getStateChanges(prevState: any, nextState: any): Array<{ path: string; prev: any; next: any }> {
  const changes: Array<{ path: string; prev: any; next: any }> = [];

  function compare(prev: any, next: any, path: string = '') {
    if (prev === next) return;

    if (typeof prev !== 'object' || typeof next !== 'object') {
      changes.push({ path: path || 'root', prev, next });
      return;
    }

    const allKeys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
    
    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key;
      if (prev?.[key] !== next?.[key]) {
        compare(prev?.[key], next?.[key], newPath);
      }
    }
  }

  compare(prevState, nextState);
  return changes;
}

/**
 * Compose multiple middleware
 */
export function composeMiddleware<T extends object>(
  ...middlewares: Array<(config: StateCreator<T, [], [], T>) => StateCreator<T, [], [], T>>
): (config: StateCreator<T, [], [], T>) => StateCreator<T, [], [], T> {
  return (config) => {
    return middlewares.reduceRight((acc, middleware) => {
      return middleware(acc);
    }, config);
  };
}

// Type declarations for window.analytics
declare global {
  interface Window {
    analytics?: {
      track: (event: string, properties: Record<string, any>) => void;
    };
  }
}

export default {
  errorBoundary,
  performanceMonitor,
  actionLogger,
  validator,
  undoRedo,
  debounce,
  computed,
  encrypted,
  composeMiddleware
};