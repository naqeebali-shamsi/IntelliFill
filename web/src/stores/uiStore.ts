/**
 * UI Store - Manages theme, modals, notifications, loading states, and UI preferences
 */

import { create } from 'zustand';
import { NotificationState, ModalState, LoadingState, UIPreferences } from './types';
import { createMiddleware } from './middleware';

// =================== STORE INTERFACES ===================

interface UIState {
  // Theme
  theme: 'light' | 'dark' | 'system';
  resolvedTheme: 'light' | 'dark';
  
  // Layout
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  headerHeight: number;
  footerHeight: number;
  
  // Modals
  modals: ModalState[];
  modalStack: string[];
  
  // Notifications
  notifications: NotificationState[];
  notificationSettings: {
    maxVisible: number;
    defaultDuration: number;
    position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
    enableSounds: boolean;
    enableAnimations: boolean;
  };
  
  // Loading states
  loadingStates: Record<string, LoadingState>;
  globalLoading: boolean;
  
  // UI Preferences
  preferences: UIPreferences;
  
  // Responsive
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  
  // Focus management
  focusedElement: string | null;
  tabTrapStack: string[];
  
  // Accessibility
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
  
  // Performance
  renderOptimizations: {
    virtualScrolling: boolean;
    lazyLoading: boolean;
    memoryLimit: number;
  };
}

interface UIActions {
  // Theme actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleTheme: () => void;
  setResolvedTheme: (theme: 'light' | 'dark') => void;
  
  // Layout actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setHeaderHeight: (height: number) => void;
  setFooterHeight: (height: number) => void;
  
  // Modal actions
  openModal: (modal: Omit<ModalState, 'id'>) => string;
  closeModal: (id: string) => void;
  closeTopModal: () => void;
  closeAllModals: () => void;
  updateModal: (id: string, updates: Partial<ModalState>) => void;
  
  // Notification actions
  addNotification: (notification: Omit<NotificationState, 'id' | 'timestamp'>) => string;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  updateNotificationSettings: (settings: Partial<UIState['notificationSettings']>) => void;
  
  // Loading actions
  setLoading: (id: string, state: Omit<LoadingState, 'id'>) => void;
  clearLoading: (id: string) => void;
  setGlobalLoading: (loading: boolean) => void;
  
  // Preferences actions
  updatePreferences: (preferences: Partial<UIPreferences>) => void;
  resetPreferences: () => void;
  
  // Responsive actions
  setBreakpoint: (breakpoint: UIState['breakpoint']) => void;
  updateViewportInfo: (width: number, height: number) => void;
  
  // Focus management
  setFocusedElement: (elementId: string | null) => void;
  pushTabTrap: (trapId: string) => void;
  popTabTrap: () => void;
  
  // Accessibility actions
  setReducedMotion: (enabled: boolean) => void;
  setHighContrast: (enabled: boolean) => void;
  setFontSize: (size: UIState['fontSize']) => void;
  
  // Performance actions
  updateRenderOptimizations: (optimizations: Partial<UIState['renderOptimizations']>) => void;
}

// =================== HELPERS ===================

const generateId = () => `ui_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const getBreakpoint = (width: number): UIState['breakpoint'] => {
  if (width < 480) return 'xs';
  if (width < 768) return 'sm';
  if (width < 1024) return 'md';
  if (width < 1280) return 'lg';
  if (width < 1536) return 'xl';
  return '2xl';
};

const defaultPreferences: UIPreferences = {
  sidebarCollapsed: false,
  sidebarWidth: 256,
  tablePageSize: 10,
  defaultView: 'list',
  compactMode: false,
  animations: true,
  soundEffects: false,
};

const defaultNotificationSettings: UIState['notificationSettings'] = {
  maxVisible: 5,
  defaultDuration: 5000,
  position: 'top-right',
  enableSounds: false,
  enableAnimations: true,
};

const defaultRenderOptimizations: UIState['renderOptimizations'] = {
  virtualScrolling: true,
  lazyLoading: true,
  memoryLimit: 100, // MB
};

// =================== INITIAL STATE ===================

const initialState: UIState = {
  theme: 'system',
  resolvedTheme: 'light',
  sidebarCollapsed: false,
  sidebarWidth: 256,
  headerHeight: 64,
  footerHeight: 48,
  modals: [],
  modalStack: [],
  notifications: [],
  notificationSettings: defaultNotificationSettings,
  loadingStates: {},
  globalLoading: false,
  preferences: defaultPreferences,
  breakpoint: 'lg',
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  focusedElement: null,
  tabTrapStack: [],
  reducedMotion: false,
  highContrast: false,
  fontSize: 'base',
  renderOptimizations: defaultRenderOptimizations,
};

// =================== STORE IMPLEMENTATION ===================

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()(
  createMiddleware(
    {
      persist: true,
      persistName: 'intellifill-ui',
      persistOptions: {
        partialize: (state) => ({
          theme: state.theme,
          sidebarCollapsed: state.sidebarCollapsed,
          sidebarWidth: state.sidebarWidth,
          preferences: state.preferences,
          notificationSettings: state.notificationSettings,
          reducedMotion: state.reducedMotion,
          highContrast: state.highContrast,
          fontSize: state.fontSize,
          renderOptimizations: state.renderOptimizations,
        }),
        version: 1,
      },
      devtools: true,
      devtoolsName: 'IntelliFill UI Store',
      logger: process.env.NODE_ENV === 'development',
      performance: true,
      performanceId: 'ui-store',
      immer: true,
      subscribeWithSelector: true,
    },
    (set, get) => ({
      ...initialState,

      // =================== THEME ACTIONS ===================

      setTheme: (theme: 'light' | 'dark' | 'system') => {
        set((draft) => {
          draft.theme = theme;
          
          // Update resolved theme
          if (theme === 'system') {
            draft.resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          } else {
            draft.resolvedTheme = theme;
          }
        });
        
        // Apply theme to document
        const { resolvedTheme } = get();
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(resolvedTheme);
      },

      toggleTheme: () => {
        const currentTheme = get().theme;
        if (currentTheme === 'system') {
          get().setTheme('light');
        } else if (currentTheme === 'light') {
          get().setTheme('dark');
        } else {
          get().setTheme('light');
        }
      },

      setResolvedTheme: (theme: 'light' | 'dark') => {
        set((draft) => {
          draft.resolvedTheme = theme;
        });
      },

      // =================== LAYOUT ACTIONS ===================

      toggleSidebar: () => {
        set((draft) => {
          draft.sidebarCollapsed = !draft.sidebarCollapsed;
          draft.preferences.sidebarCollapsed = draft.sidebarCollapsed;
        });
      },

      setSidebarCollapsed: (collapsed: boolean) => {
        set((draft) => {
          draft.sidebarCollapsed = collapsed;
          draft.preferences.sidebarCollapsed = collapsed;
        });
      },

      setSidebarWidth: (width: number) => {
        set((draft) => {
          draft.sidebarWidth = Math.max(200, Math.min(400, width));
          draft.preferences.sidebarWidth = draft.sidebarWidth;
        });
      },

      setHeaderHeight: (height: number) => {
        set((draft) => {
          draft.headerHeight = height;
        });
      },

      setFooterHeight: (height: number) => {
        set((draft) => {
          draft.footerHeight = height;
        });
      },

      // =================== MODAL ACTIONS ===================

      openModal: (modal: Omit<ModalState, 'id'>) => {
        const id = generateId();
        
        set((draft) => {
          const newModal: ModalState = {
            id,
            size: 'md',
            closable: true,
            persistent: false,
            zIndex: 1000 + draft.modals.length,
            ...modal,
          };
          
          draft.modals.push(newModal);
          draft.modalStack.push(id);
        });
        
        return id;
      },

      closeModal: (id: string) => {
        set((draft) => {
          draft.modals = draft.modals.filter(modal => modal.id !== id);
          draft.modalStack = draft.modalStack.filter(modalId => modalId !== id);
        });
      },

      closeTopModal: () => {
        const { modalStack } = get();
        if (modalStack.length > 0) {
          const topModalId = modalStack[modalStack.length - 1];
          get().closeModal(topModalId);
        }
      },

      closeAllModals: () => {
        set((draft) => {
          draft.modals = [];
          draft.modalStack = [];
        });
      },

      updateModal: (id: string, updates: Partial<ModalState>) => {
        set((draft) => {
          const modal = draft.modals.find(m => m.id === id);
          if (modal) {
            Object.assign(modal, updates);
          }
        });
      },

      // =================== NOTIFICATION ACTIONS ===================

      addNotification: (notification: Omit<NotificationState, 'id' | 'timestamp'>) => {
        const id = generateId();
        
        set((draft) => {
          const newNotification: NotificationState = {
            id,
            timestamp: Date.now(),
            duration: notification.duration ?? draft.notificationSettings.defaultDuration,
            read: false,
            persistent: false,
            ...notification,
          };
          
          draft.notifications.unshift(newNotification);
          
          // Limit visible notifications
          if (draft.notifications.length > draft.notificationSettings.maxVisible) {
            draft.notifications = draft.notifications.slice(0, draft.notificationSettings.maxVisible);
          }
        });
        
        // Auto-remove non-persistent notifications
        if (!notification.persistent) {
          const duration = notification.duration ?? get().notificationSettings.defaultDuration;
          if (duration > 0) {
            setTimeout(() => {
              get().removeNotification(id);
            }, duration);
          }
        }
        
        return id;
      },

      removeNotification: (id: string) => {
        set((draft) => {
          draft.notifications = draft.notifications.filter(n => n.id !== id);
        });
      },

      clearNotifications: () => {
        set((draft) => {
          draft.notifications = [];
        });
      },

      markNotificationRead: (id: string) => {
        set((draft) => {
          const notification = draft.notifications.find(n => n.id === id);
          if (notification) {
            notification.read = true;
          }
        });
      },

      markAllNotificationsRead: () => {
        set((draft) => {
          draft.notifications.forEach(notification => {
            notification.read = true;
          });
        });
      },

      updateNotificationSettings: (settings: Partial<UIState['notificationSettings']>) => {
        set((draft) => {
          Object.assign(draft.notificationSettings, settings);
        });
      },

      // =================== LOADING ACTIONS ===================

      setLoading: (id: string, state: Omit<LoadingState, 'id'>) => {
        set((draft) => {
          draft.loadingStates[id] = { id, ...state };
        });
      },

      clearLoading: (id: string) => {
        set((draft) => {
          delete draft.loadingStates[id];
        });
      },

      setGlobalLoading: (loading: boolean) => {
        set((draft) => {
          draft.globalLoading = loading;
        });
      },

      // =================== PREFERENCES ACTIONS ===================

      updatePreferences: (preferences: Partial<UIPreferences>) => {
        set((draft) => {
          Object.assign(draft.preferences, preferences);
          
          // Sync certain preferences to main state
          if ('sidebarCollapsed' in preferences) {
            draft.sidebarCollapsed = preferences.sidebarCollapsed!;
          }
          if ('sidebarWidth' in preferences) {
            draft.sidebarWidth = preferences.sidebarWidth!;
          }
        });
      },

      resetPreferences: () => {
        set((draft) => {
          draft.preferences = { ...defaultPreferences };
          draft.sidebarCollapsed = defaultPreferences.sidebarCollapsed;
          draft.sidebarWidth = defaultPreferences.sidebarWidth;
        });
      },

      // =================== RESPONSIVE ACTIONS ===================

      setBreakpoint: (breakpoint: UIState['breakpoint']) => {
        set((draft) => {
          draft.breakpoint = breakpoint;
          draft.isMobile = breakpoint === 'xs' || breakpoint === 'sm';
          draft.isTablet = breakpoint === 'md';
          draft.isDesktop = breakpoint === 'lg' || breakpoint === 'xl' || breakpoint === '2xl';
          
          // Auto-collapse sidebar on mobile
          if (draft.isMobile && !draft.sidebarCollapsed) {
            draft.sidebarCollapsed = true;
          }
        });
      },

      updateViewportInfo: (width: number, height: number) => {
        const breakpoint = getBreakpoint(width);
        get().setBreakpoint(breakpoint);
      },

      // =================== FOCUS MANAGEMENT ===================

      setFocusedElement: (elementId: string | null) => {
        set((draft) => {
          draft.focusedElement = elementId;
        });
      },

      pushTabTrap: (trapId: string) => {
        set((draft) => {
          draft.tabTrapStack.push(trapId);
        });
      },

      popTabTrap: () => {
        set((draft) => {
          draft.tabTrapStack.pop();
        });
      },

      // =================== ACCESSIBILITY ACTIONS ===================

      setReducedMotion: (enabled: boolean) => {
        set((draft) => {
          draft.reducedMotion = enabled;
          draft.preferences.animations = !enabled;
        });
      },

      setHighContrast: (enabled: boolean) => {
        set((draft) => {
          draft.highContrast = enabled;
        });
        
        // Apply high contrast to document
        document.documentElement.classList.toggle('high-contrast', enabled);
      },

      setFontSize: (size: UIState['fontSize']) => {
        set((draft) => {
          draft.fontSize = size;
        });
        
        // Apply font size to document
        document.documentElement.setAttribute('data-font-size', size);
      },

      // =================== PERFORMANCE ACTIONS ===================

      updateRenderOptimizations: (optimizations: Partial<UIState['renderOptimizations']>) => {
        set((draft) => {
          Object.assign(draft.renderOptimizations, optimizations);
        });
      },
    })
  )
);

// =================== SELECTORS ===================

export const uiSelectors = {
  theme: (state: UIStore) => state.theme,
  resolvedTheme: (state: UIStore) => state.resolvedTheme,
  isDarkMode: (state: UIStore) => state.resolvedTheme === 'dark',
  isSidebarCollapsed: (state: UIStore) => state.sidebarCollapsed,
  sidebarWidth: (state: UIStore) => state.sidebarWidth,
  activeModals: (state: UIStore) => state.modals,
  hasModals: (state: UIStore) => state.modals.length > 0,
  topModal: (state: UIStore) => {
    const stack = state.modalStack;
    if (stack.length === 0) return null;
    const topId = stack[stack.length - 1];
    return state.modals.find(m => m.id === topId) || null;
  },
  notifications: (state: UIStore) => state.notifications,
  unreadNotifications: (state: UIStore) => state.notifications.filter(n => !n.read),
  unreadCount: (state: UIStore) => state.notifications.filter(n => !n.read).length,
  isLoading: (id: string) => (state: UIStore) => Boolean(state.loadingStates[id]),
  loadingState: (id: string) => (state: UIStore) => state.loadingStates[id] || null,
  isGlobalLoading: (state: UIStore) => state.globalLoading,
  hasAnyLoading: (state: UIStore) => state.globalLoading || Object.keys(state.loadingStates).length > 0,
  isMobile: (state: UIStore) => state.isMobile,
  isTablet: (state: UIStore) => state.isTablet,
  isDesktop: (state: UIStore) => state.isDesktop,
  breakpoint: (state: UIStore) => state.breakpoint,
  preferences: (state: UIStore) => state.preferences,
  activeTabTrap: (state: UIStore) => {
    const stack = state.tabTrapStack;
    return stack.length > 0 ? stack[stack.length - 1] : null;
  },
};

// =================== HOOKS FOR SPECIFIC USE CASES ===================

export const useTheme = () => useUIStore(uiSelectors.resolvedTheme);
export const useIsDarkMode = () => useUIStore(uiSelectors.isDarkMode);
export const useSidebar = () => useUIStore((state) => ({
  collapsed: state.sidebarCollapsed,
  width: state.sidebarWidth,
  toggle: state.toggleSidebar,
  setCollapsed: state.setSidebarCollapsed,
  setWidth: state.setSidebarWidth,
}));
export const useModals = () => useUIStore((state) => ({
  modals: state.modals,
  topModal: uiSelectors.topModal(state),
  hasModals: uiSelectors.hasModals(state),
  open: state.openModal,
  close: state.closeModal,
  closeTop: state.closeTopModal,
  closeAll: state.closeAllModals,
}));
export const useNotifications = () => useUIStore((state) => ({
  notifications: state.notifications,
  unreadCount: uiSelectors.unreadCount(state),
  add: state.addNotification,
  remove: state.removeNotification,
  clear: state.clearNotifications,
  markRead: state.markNotificationRead,
  markAllRead: state.markAllNotificationsRead,
}));
export const useLoading = (id?: string) => useUIStore((state) => ({
  isLoading: id ? Boolean(state.loadingStates[id]) : state.globalLoading,
  loadingState: id ? state.loadingStates[id] : null,
  hasAnyLoading: uiSelectors.hasAnyLoading(state),
  setLoading: state.setLoading,
  clearLoading: state.clearLoading,
  setGlobalLoading: state.setGlobalLoading,
}));
export const useResponsive = () => useUIStore((state) => ({
  breakpoint: state.breakpoint,
  isMobile: state.isMobile,
  isTablet: state.isTablet,
  isDesktop: state.isDesktop,
  updateViewport: state.updateViewportInfo,
}));

// =================== UTILITY FUNCTIONS ===================

// Initialize responsive handling
if (typeof window !== 'undefined') {
  const handleResize = () => {
    const { updateViewportInfo } = useUIStore.getState();
    updateViewportInfo(window.innerWidth, window.innerHeight);
  };

  // Initial setup
  handleResize();
  
  // Listen for resize events
  window.addEventListener('resize', handleResize);
  
  // Listen for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleThemeChange = (e: MediaQueryListEvent) => {
    const { theme, setResolvedTheme } = useUIStore.getState();
    if (theme === 'system') {
      setResolvedTheme(e.matches ? 'dark' : 'light');
    }
  };
  
  mediaQuery.addEventListener('change', handleThemeChange);
  
  // Listen for reduced motion preference
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handleMotionChange = (e: MediaQueryListEvent) => {
    const { setReducedMotion } = useUIStore.getState();
    setReducedMotion(e.matches);
  };
  
  motionQuery.addEventListener('change', handleMotionChange);
  handleMotionChange(motionQuery as any);
}

// =================== EXPORT TYPES ===================

export type { UIState, UIActions };