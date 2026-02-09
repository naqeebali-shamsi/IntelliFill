import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { stripeService, SubscriptionStatus } from '@/services/stripeService';

interface SubscriptionState {
  // State
  isPro: boolean;
  status: string | null;
  currentPeriodEnd: Date | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;

  // Actions
  fetchStatus: () => Promise<void>;
  redirectToCheckout: () => Promise<void>;
  redirectToPortal: () => Promise<void>;
  reset: () => void;
}

const initialState: Pick<
  SubscriptionState,
  'isPro' | 'status' | 'currentPeriodEnd' | 'loading' | 'error' | 'initialized'
> = {
  isPro: false,
  status: null,
  currentPeriodEnd: null,
  loading: false,
  error: null,
  initialized: false,
};

// Conditionally apply devtools in development only
function applyDevtools<T>(middleware: T): T {
  if (import.meta.env.DEV) {
    return devtools(middleware as any, {
      name: 'IntelliFill Subscription Store',
    }) as T;
  }
  return middleware;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  applyDevtools(
    immer((set, get) => ({
      ...initialState,

      fetchStatus: async () => {
        if (import.meta.env.DEV) console.log('[SubscriptionStore] fetchStatus called');
        set({ loading: true, error: null });
        try {
          if (import.meta.env.DEV)
            console.log('[SubscriptionStore] Calling stripeService.getSubscriptionStatus()');
          const status = await stripeService.getSubscriptionStatus();
          if (import.meta.env.DEV) console.log('[SubscriptionStore] Got status:', status);
          set({
            isPro: status.isPro,
            status: status.status,
            currentPeriodEnd: status.currentPeriodEnd ? new Date(status.currentPeriodEnd) : null,
            loading: false,
            initialized: true,
          });
        } catch (error) {
          console.error('[SubscriptionStore] Error fetching status:', error);
          set({
            error: 'Failed to fetch subscription status',
            loading: false,
            initialized: true,
          });
        }
      },

      redirectToCheckout: async () => {
        set({ loading: true, error: null });
        try {
          const successUrl = `${window.location.origin}/pricing?success=true`;
          const cancelUrl = `${window.location.origin}/pricing?canceled=true`;

          const { url } = await stripeService.createCheckoutSession(successUrl, cancelUrl);

          // Redirect to Stripe Checkout
          window.location.href = url;
        } catch (error) {
          set({
            error: 'Failed to start checkout',
            loading: false,
          });
        }
      },

      redirectToPortal: async () => {
        set({ loading: true, error: null });
        try {
          const returnUrl = `${window.location.origin}/settings`;

          const { url } = await stripeService.createPortalSession(returnUrl);

          // Redirect to Stripe Customer Portal
          window.location.href = url;
        } catch (error) {
          set({
            error: 'Failed to open billing portal',
            loading: false,
          });
        }
      },

      reset: () => set(initialState),
    }))
  )
);

// Hook for checking PRO access
export const useIsPro = () => useSubscriptionStore((state) => state.isPro);

// Hook for subscription actions
export const useSubscriptionActions = () =>
  useSubscriptionStore((state) => ({
    fetchStatus: state.fetchStatus,
    redirectToCheckout: state.redirectToCheckout,
    redirectToPortal: state.redirectToPortal,
  }));
