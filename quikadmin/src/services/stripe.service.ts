/**
 * Stripe Service
 *
 * Phase 5 - Stripe Integration
 * Handles all Stripe API interactions including:
 * - Customer management
 * - Checkout session creation
 * - Customer portal sessions
 * - Webhook event processing
 * - Subscription status tracking
 */

import Stripe from 'stripe';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

// Initialize Stripe with API version
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export const stripeService = {
  /**
   * Get or create a Stripe customer for a user
   */
  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (user?.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email,
      metadata: { userId },
    });

    // Store customer ID
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    logger.info('Created Stripe customer', { userId, customerId: customer.id });

    return customer.id;
  },

  /**
   * Create a checkout session for PRO subscription
   */
  async createCheckoutSession(
    userId: string,
    email: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<Stripe.Checkout.Session> {
    const customerId = await this.getOrCreateCustomer(userId, email);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: process.env.STRIPE_PRO_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId },
      subscription_data: {
        metadata: { userId },
      },
    });

    logger.info('Created checkout session', {
      userId,
      sessionId: session.id,
    });

    return session;
  },

  /**
   * Create a customer portal session for billing management
   */
  async createPortalSession(
    userId: string,
    returnUrl: string
  ): Promise<Stripe.BillingPortal.Session> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      throw new Error('No Stripe customer found for this user');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    logger.info('Created portal session', { userId, sessionUrl: session.url });

    return session;
  },

  /**
   * Get subscription status for a user
   */
  async getSubscriptionStatus(userId: string): Promise<{
    isPro: boolean;
    status: string | null;
    currentPeriodEnd: Date | null;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        currentPeriodEnd: true,
      },
    });

    return {
      isPro: user?.subscriptionStatus === 'active' || user?.subscriptionStatus === 'trialing',
      status: user?.subscriptionStatus ?? null,
      currentPeriodEnd: user?.currentPeriodEnd ?? null,
    };
  },

  /**
   * Handle webhook event - update subscription status
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          await this.updateSubscription(subscription);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.updateSubscription(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.cancelSubscription(subscription);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
          await this.updateSubscription(subscription);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        logger.warn('Payment failed for invoice', { invoiceId: invoice.id });
        // Status will be updated via subscription.updated event
        break;
      }

      default:
        logger.debug('Unhandled webhook event type', { type: event.type });
    }
  },

  /**
   * Update user subscription from Stripe subscription object
   */
  async updateSubscription(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      logger.warn('No userId in subscription metadata', {
        subId: subscription.id,
      });
      return;
    }

    logger.info('Updating subscription for user', {
      userId,
      subscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
    });

    // Verify user exists first
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      logger.error('User not found for subscription update', { userId, subId: subscription.id });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    logger.info('Subscription updated successfully', {
      userId,
      email: user.email,
      subscriptionId: subscription.id,
      status: subscription.status,
    });
  },

  /**
   * Handle subscription cancellation
   */
  async cancelSubscription(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      logger.warn('No userId in subscription metadata', {
        subId: subscription.id,
      });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'canceled',
        // Keep currentPeriodEnd so user retains access until end of period
      },
    });

    logger.info('Subscription canceled', {
      userId,
      subscriptionId: subscription.id,
    });
  },

  /**
   * Verify webhook signature
   */
  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    return stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  },
};
