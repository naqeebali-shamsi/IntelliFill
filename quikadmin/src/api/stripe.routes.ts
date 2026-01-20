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

import { Router, Response, NextFunction } from 'express';
import { stripeService } from '../services/stripe.service';
import { authenticateSupabase, AuthenticatedRequest } from '../middleware/supabaseAuth';
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
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { error, value } = checkoutSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
        });
      }

      const user = req.user!;
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
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { error, value } = portalSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
        });
      }

      const user = req.user!;
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
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
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

// NOTE: Webhook route is handled directly in index.ts BEFORE body parsing middleware
// This is required by Stripe for signature verification with raw body
// See: https://docs.stripe.com/webhooks/quickstart

export function createStripeRoutes(): Router {
  return router;
}
