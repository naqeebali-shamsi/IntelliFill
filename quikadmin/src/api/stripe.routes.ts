/**
 * Stripe Routes
 *
 * Phase 5 - Stripe Integration
 * API endpoints for:
 * - Creating checkout sessions
 * - Creating customer portal sessions
 * - Getting subscription status
 * - Handling Stripe webhooks
 */

import { Router, Request, Response, NextFunction } from 'express';
import { stripeService } from '../services/stripe.service';
import { authenticateSupabase } from '../middleware/supabaseAuth';
import { logger } from '../utils/logger';
import Joi from 'joi';

const router = Router();

// Validation schemas
const checkoutSchema = Joi.object({
  successUrl: Joi.string().uri().required(),
  cancelUrl: Joi.string().uri().required(),
});

const portalSchema = Joi.object({
  returnUrl: Joi.string().uri().required(),
});

/**
 * POST /api/stripe/create-checkout-session
 * Create a Stripe Checkout session for PRO subscription
 * Protected - requires authentication
 */
router.post(
  '/create-checkout-session',
  authenticateSupabase,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { error, value } = checkoutSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
        });
      }

      const user = (req as any).user;
      const { successUrl, cancelUrl } = value;

      const session = await stripeService.createCheckoutSession(
        user.id,
        user.email,
        successUrl,
        cancelUrl
      );

      res.json({
        success: true,
        data: { sessionId: session.id, url: session.url },
      });
    } catch (error) {
      logger.error('Failed to create checkout session', { error });
      next(error);
    }
  }
);

/**
 * POST /api/stripe/create-portal-session
 * Create a Stripe Customer Portal session for billing management
 * Protected - requires authentication
 */
router.post(
  '/create-portal-session',
  authenticateSupabase,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { error, value } = portalSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
        });
      }

      const user = (req as any).user;
      const { returnUrl } = value;

      const session = await stripeService.createPortalSession(user.id, returnUrl);

      res.json({
        success: true,
        data: { url: session.url },
      });
    } catch (error) {
      logger.error('Failed to create portal session', { error });
      next(error);
    }
  }
);

/**
 * GET /api/stripe/subscription-status
 * Get current user's subscription status
 * Protected - requires authentication
 */
router.get(
  '/subscription-status',
  authenticateSupabase,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const status = await stripeService.getSubscriptionStatus(user.id);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Failed to get subscription status', { error });
      next(error);
    }
  }
);

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhook events
 * IMPORTANT: Must use raw body parser, NOT json parser
 * This endpoint is called by Stripe, not by the frontend
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'];

  if (!signature || typeof signature !== 'string') {
    logger.warn('Webhook received without signature');
    return res.status(400).json({ error: 'Missing signature' });
  }

  try {
    const event = stripeService.constructWebhookEvent(req.body, signature);

    logger.info('Webhook event received', { type: event.type, id: event.id });

    await stripeService.handleWebhookEvent(event);

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook error', { error });
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Webhook error',
    });
  }
});

export function createStripeRoutes(): Router {
  return router;
}
