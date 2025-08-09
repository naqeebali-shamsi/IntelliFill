/**
 * Zustand middleware for persistence, logging, devtools, and performance monitoring
 */

import { StateCreator, StoreMutatorIdentifier, Mutate, StoreApi } from 'zustand';
import { WritableDraft } from 'immer';
import { persist, createJSONStorage, PersistOptions } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { StoreMetrics, PerformanceMark } from './types';

// =================== PERFORMANCE MIDDLEWARE ===================

interface PerformanceMiddleware {
  __performance: {
    metrics: StoreMetrics;
    startMark: (name: string, data?: any) => void;
    endMark: (name: string) => void;
    getMetrics: () => StoreMetrics;
    clearMetrics: () => void;
  };
}

type PerformanceImpl = <T>(
  storeId: string,
  config: StateCreator<T & PerformanceMiddleware, [], [], T & PerformanceMiddleware>,
) => StateCreator<T & PerformanceMiddleware, [], [], T & PerformanceMiddleware>;

export const performance: PerformanceImpl = (storeId, config) => (set, get, api) => {
  const metrics: StoreMetrics = {
    storeId,
    updateCount: 0,
    lastUpdate: Date.now(),
    subscriberCount: 0,
    performanceMarks: [],
  };

  const startMark = (name: string, data?: any) => {
    const mark: PerformanceMark = {
      name,
      timestamp: performance.now(),
      data,
    };
    metrics.performanceMarks.push(mark);
  };

  const endMark = (name: string) => {
    const markIndex = metrics.performanceMarks.findIndex(
      (mark) => mark.name === name && mark.duration === undefined
    );
    if (markIndex >= 0) {
      metrics.performanceMarks[markIndex].duration = 
        performance.now() - metrics.performanceMarks[markIndex].timestamp;
    }
  };

  const getMetrics = () => ({ ...metrics });

  const clearMetrics = () => {
    metrics.performanceMarks = [];
    metrics.updateCount = 0;
  };

  const enhancedSet: typeof set = (...args) => {
    startMark('state_update');
    metrics.updateCount++;
    metrics.lastUpdate = Date.now();
    
    const result = set(...args);
    endMark('state_update');
    return result;
  };

  return config(
    enhancedSet,
    get,
    {
      ...api,
      subscribe: (listener) => {
        metrics.subscriberCount++;
        const unsubscribe = api.subscribe(listener);
        return () => {
          metrics.subscriberCount--;
          unsubscribe();
        };
      },
    }
  ) as T & PerformanceMiddleware & {
    __performance: {
      metrics: StoreMetrics;
      startMark: typeof startMark;
      endMark: typeof endMark;
      getMetrics: typeof getMetrics;
      clearMetrics: typeof clearMetrics;
    };
  };
};

// =================== LOGGER MIDDLEWARE ===================

interface LoggerOptions {
  enabled?: boolean;
  collapsed?: boolean;
  filter?: (mutationType: string, mutation: any, state: any) => boolean;
  transformer?: (state: any) => any;
  mutationTransformer?: (mutation: any) => any;
  logger?: Console;
}

export const logger = <T>(
  options: LoggerOptions = {}
) => 
(config: StateCreator<T, [], [], T>): StateCreator<T, [], [], T> => 
(set, get, api) => {
  const {
    enabled = true,
    collapsed = false,
    filter,
    transformer = (state) => state,
    mutationTransformer = (mutation) => mutation,
    logger = console,
  } = options;

  if (!enabled) return config(set, get, api);

  const enhancedSet: typeof set = (...args) => {
    const prevState = get();
    const result = set(...args);
    const nextState = get();

    if (prevState !== nextState) {
      const mutation = args[0];
      const mutationType = typeof mutation === 'function' ? mutation.name : 'anonymous';

      if (!filter || filter(mutationType, mutation, nextState)) {
        const groupName = `🐻 ${mutationType} @ ${new Date().toLocaleTimeString()}`;
        
        if (collapsed) {
          logger.groupCollapsed(groupName);
        } else {
          logger.group(groupName);
        }

        logger.log('%c prev state', 'color: #9E9E9E; font-weight: bold', transformer(prevState));
        logger.log('%c mutation', 'color: #03A9F4; font-weight: bold', mutationTransformer(mutation));
        logger.log('%c next state', 'color: #4CAF50; font-weight: bold', transformer(nextState));
        
        logger.groupEnd();
      }
    }

    return result;
  };

  return config(enhancedSet, get, api);
};

// =================== ERROR BOUNDARY MIDDLEWARE ===================

interface ErrorBoundaryOptions {
  onError?: (error: Error, state: any) => void;
  fallbackState?: any;
  resetOnError?: boolean;
}

export const errorBoundary = <T>(
  options: ErrorBoundaryOptions = {}
) =>
(config: StateCreator<T, [], [], T>): StateCreator<T, [], [], T> =>
(set, get, api) => {
  const {
    onError,
    fallbackState,
    resetOnError = false,
  } = options;

  const enhancedSet: typeof set = (...args) => {
    try {
      return set(...args);
    } catch (error) {
      const currentState = get();
      
      if (onError) {
        onError(error as Error, currentState);
      } else {
        console.error('Store error:', error);
      }

      if (resetOnError && fallbackState) {
        set(fallbackState);
      }

      throw error;
    }
  };

  return config(enhancedSet, get, api);
};

// =================== COMPUTED VALUES MIDDLEWARE ===================

interface ComputedConfig<T> {
  [key: string]: (state: T) => any;
}

export const computed = <T, C extends ComputedConfig<T>>(
  computedConfig: C
) =>
(config: StateCreator<T, [], [], T>): StateCreator<T & { __computed: { [K in keyof C]: ReturnType<C[K]> } }, [], [], T & { __computed: { [K in keyof C]: ReturnType<C[K]> } }> =>
(set, get, api) => {
  const baseStore = config(set, get, api);
  
  const getComputedValues = () => {
    const state = get() as T;
    const computed: any = {};
    
    for (const [key, computeFn] of Object.entries(computedConfig)) {
      computed[key] = computeFn(state);
    }
    
    return computed;
  };

  return {
    ...baseStore,
    __computed: new Proxy({} as { [K in keyof C]: ReturnType<C[K]> }, {
      get: (target, prop) => {
        const computed = getComputedValues();
        return computed[prop as string];
      },
    }),
  };
};

// =================== VALIDATION MIDDLEWARE ===================

interface ValidationSchema<T> {
  [key: string]: (value: any, state: T) => string | null;
}

interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export const validation = <T>(
  schema: ValidationSchema<T>
) =>
(config: StateCreator<T, [], [], T>): StateCreator<T & { __validation: { validate: () => ValidationResult; isValid: boolean } }, [], [], T & { __validation: { validate: () => ValidationResult; isValid: boolean } }> =>
(set, get, api) => {
  const baseStore = config(set, get, api);
  
  const validate = (): ValidationResult => {
    const state = get() as T;
    const errors: Record<string, string> = {};
    
    for (const [field, validator] of Object.entries(schema)) {
      const value = (state as any)[field];
      const error = validator(value, state);
      if (error) {
        errors[field] = error;
      }
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  };

  return {
    ...baseStore,
    __validation: {
      validate,
      get isValid() {
        return validate().isValid;
      },
    },
  };
};

// =================== UNDO/REDO MIDDLEWARE ===================

interface HistoryEntry<T> {
  state: T;
  timestamp: number;
  action?: string;
}

interface UndoRedoActions {
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  canUndo: boolean;
  canRedo: boolean;
  historySize: number;
}

export const undoRedo = <T>(
  maxHistorySize: number = 50
) =>
(config: StateCreator<T, [], [], T>): StateCreator<T & UndoRedoActions, [], [], T & UndoRedoActions> =>
(set, get, api) => {
  let history: HistoryEntry<T>[] = [];
  let currentIndex = -1;
  let isUndoRedoing = false;

  const saveToHistory = (state: T, action?: string) => {
    if (isUndoRedoing) return;
    
    const entry: HistoryEntry<T> = {
      state: JSON.parse(JSON.stringify(state)),
      timestamp: Date.now(),
      action,
    };

    // Remove future entries when new state is added
    if (currentIndex < history.length - 1) {
      history = history.slice(0, currentIndex + 1);
    }

    history.push(entry);
    currentIndex = history.length - 1;

    // Limit history size
    if (history.length > maxHistorySize) {
      history = history.slice(-maxHistorySize);
      currentIndex = history.length - 1;
    }
  };

  const enhancedSet: typeof set = (...args) => {
    const prevState = get();
    const result = set(...args);
    const nextState = get();

    if (prevState !== nextState && !isUndoRedoing) {
      const action = typeof args[0] === 'function' ? args[0].name : 'update';
      saveToHistory(nextState, action);
    }

    return result;
  };

  const baseStore = config(enhancedSet, get, api);

  // Save initial state
  saveToHistory(baseStore);

  const undo = () => {
    if (currentIndex > 0) {
      currentIndex--;
      isUndoRedoing = true;
      set(history[currentIndex].state as any);
      isUndoRedoing = false;
    }
  };

  const redo = () => {
    if (currentIndex < history.length - 1) {
      currentIndex++;
      isUndoRedoing = true;
      set(history[currentIndex].state as any);
      isUndoRedoing = false;
    }
  };

  const clearHistory = () => {
    history = [{ state: get() as T, timestamp: Date.now() }];
    currentIndex = 0;
  };

  return {
    ...baseStore,
    undo,
    redo,
    clearHistory,
    get canUndo() {
      return currentIndex > 0;
    },
    get canRedo() {
      return currentIndex < history.length - 1;
    },
    get historySize() {
      return history.length;
    },
  };
};

// =================== PERSISTENCE CONFIGURATIONS ===================

export const createPersistConfig = <T>(
  name: string,
  options: Partial<PersistOptions<T>> = {}
): PersistOptions<T> => ({
  name,
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => state,
  version: 1,
  migrate: (persistedState: any, version: number) => {
    // Add migration logic here if needed
    return persistedState;
  },
  skipHydration: false,
  ...options,
});

// =================== COMBINED MIDDLEWARE FACTORY ===================

export interface MiddlewareConfig {
  persist?: boolean;
  persistName?: string;
  persistOptions?: Partial<PersistOptions<any>>;
  devtools?: boolean;
  devtoolsName?: string;
  logger?: boolean;
  loggerOptions?: LoggerOptions;
  performance?: boolean;
  performanceId?: string;
  errorBoundary?: boolean;
  errorBoundaryOptions?: ErrorBoundaryOptions;
  immer?: boolean;
  subscribeWithSelector?: boolean;
  undoRedo?: boolean;
  undoRedoSize?: number;
}

export const createMiddleware = <T>(
  config: MiddlewareConfig,
  storeConfig: StateCreator<T, Mutate<StoreApi<T>, [['zustand/immer', never]]>, [], T>
) => {
  let enhancedConfig = storeConfig;

  // Apply middleware in reverse order (innermost first)
  if (config.immer) {
    enhancedConfig = immer(enhancedConfig);
  }

  if (config.subscribeWithSelector) {
    enhancedConfig = subscribeWithSelector(enhancedConfig);
  }

  if (config.undoRedo) {
    enhancedConfig = undoRedo(config.undoRedoSize)(enhancedConfig);
  }

  if (config.errorBoundary) {
    enhancedConfig = errorBoundary(config.errorBoundaryOptions)(enhancedConfig);
  }

  if (config.logger) {
    enhancedConfig = logger(config.loggerOptions)(enhancedConfig);
  }

  if (config.performance) {
    enhancedConfig = performance(config.performanceId || 'store', enhancedConfig);
  }

  if (config.devtools) {
    enhancedConfig = devtools(enhancedConfig, {
      name: config.devtoolsName || 'IntelliFill Store',
      serialize: true,
    });
  }

  if (config.persist) {
    const persistConfig = createPersistConfig(
      config.persistName || 'intellifill-store',
      config.persistOptions
    );
    enhancedConfig = persist(enhancedConfig, persistConfig);
  }

  return enhancedConfig;
};