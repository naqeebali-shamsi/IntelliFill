import api from './api';

export interface SubscriptionStatus {
  isPro: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface PortalSessionResponse {
  url: string;
}

export const stripeService = {
  /**
   * Get current subscription status
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    const response = await api.get<{ data: SubscriptionStatus }>('/stripe/subscription-status');
    return response.data.data;
  },

  /**
   * Create checkout session for PRO subscription
   * Returns the Stripe Checkout URL to redirect to
   */
  async createCheckoutSession(
    successUrl: string,
    cancelUrl: string
  ): Promise<CheckoutSessionResponse> {
    const response = await api.post<{ data: CheckoutSessionResponse }>(
      '/stripe/create-checkout-session',
      { successUrl, cancelUrl }
    );
    return response.data.data;
  },

  /**
   * Create customer portal session for billing management
   * Returns the Stripe Portal URL to redirect to
   */
  async createPortalSession(returnUrl: string): Promise<PortalSessionResponse> {
    const response = await api.post<{ data: PortalSessionResponse }>(
      '/stripe/create-portal-session',
      { returnUrl }
    );
    return response.data.data;
  },
};
