# Plan 05-02 Summary: Stripe SDK Setup & Service Layer

## Completed: 2026-01-17

## Objective

Implement Stripe backend integration with webhook handling, checkout session creation, and customer portal access. This enables the backend to process payments, handle subscription lifecycle events, and provide checkout/portal endpoints for the frontend.

## Tasks Completed

| #   | Task                                               | Files                                                   | Commit    |
| --- | -------------------------------------------------- | ------------------------------------------------------- | --------- |
| 1   | Install Stripe SDK                                 | `quikadmin/package.json`, `pnpm-lock.yaml`              | `0d3071d` |
| 2   | Create Stripe service with subscription management | `quikadmin/src/services/stripe.service.ts`              | `4b62e0f` |
| 3   | Create Stripe routes with webhook endpoint         | `quikadmin/src/api/stripe.routes.ts`                    | `43de544` |
| 4   | Mount Stripe routes with raw body middleware       | `quikadmin/src/api/routes.ts`, `quikadmin/src/index.ts` | `dfa3911` |

## Implementation Details

### Stripe SDK Installation

- Installed `stripe@17.7.0` via pnpm
- Latest API version: `2025-02-24.acacia`

### Stripe Service (`stripe.service.ts`)

The service layer encapsulates all Stripe API interactions:

**Customer Management:**

- `getOrCreateCustomer(userId, email)` - Creates Stripe customer and stores `stripeCustomerId` in User model

**Checkout & Portal:**

- `createCheckoutSession(userId, email, successUrl, cancelUrl)` - Creates subscription checkout session
- `createPortalSession(userId, returnUrl)` - Creates billing management portal session

**Subscription Status:**

- `getSubscriptionStatus(userId)` - Returns `{ isPro, status, currentPeriodEnd }`
- PRO tier is active when status is `active` or `trialing`

**Webhook Processing:**

- `handleWebhookEvent(event)` - Routes events to handlers
- `constructWebhookEvent(payload, signature)` - Verifies webhook signatures

**Handled Events:**

- `checkout.session.completed` - Instant unlock on successful checkout
- `customer.subscription.created/updated` - Status sync
- `customer.subscription.deleted` - Cancellation handling
- `invoice.paid` - Renewal confirmation
- `invoice.payment_failed` - Payment failure logging

### Stripe Routes (`stripe.routes.ts`)

| Endpoint                              | Method | Auth                    | Description                      |
| ------------------------------------- | ------ | ----------------------- | -------------------------------- |
| `/api/stripe/create-checkout-session` | POST   | Required                | Create PRO subscription checkout |
| `/api/stripe/create-portal-session`   | POST   | Required                | Create billing portal session    |
| `/api/stripe/subscription-status`     | GET    | Required                | Get current subscription status  |
| `/api/stripe/webhook`                 | POST   | None (Stripe signature) | Handle Stripe events             |

**Request Validation:**

- Checkout: `{ successUrl: uri, cancelUrl: uri }` (Joi)
- Portal: `{ returnUrl: uri }` (Joi)

### Middleware Configuration

**Critical:** Stripe webhook requires raw body for signature verification.

```typescript
// In index.ts - BEFORE global JSON parser
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// Then global JSON parser
app.use(express.json({ limit: '10mb' }));
```

This ensures:

1. Webhook receives raw Buffer for signature verification
2. Other Stripe endpoints receive parsed JSON

## Verification

- [x] Stripe SDK installed (v17.7.0)
- [x] TypeScript compiles (no Stripe-related errors)
- [x] Server initializes with all middleware
- [x] Routes mounted at `/api/stripe/*`
- [x] Webhook raw body middleware applied before JSON parser

## Patterns Followed

- Service layer pattern for Stripe API encapsulation
- Consistent error response format: `{ success, error: { code, message } }`
- Supabase auth middleware for protected endpoints
- Joi validation for request body schemas
- Logger for webhook event tracking

## Key Decisions

| Decision                          | Rationale                                      |
| --------------------------------- | ---------------------------------------------- |
| Raw body middleware in `index.ts` | Ensures it's applied before global JSON parser |
| userId in subscription metadata   | Enables instant unlock without customer lookup |
| Status as string (not enum)       | Accommodates all Stripe subscription statuses  |
| API version `2025-02-24.acacia`   | Latest stable version compatible with SDK v17  |

## Security Considerations

- Webhook signature verification prevents forged events
- All authenticated endpoints use `authenticateSupabase` middleware
- No secrets exposed in responses
- Stripe secret key only used server-side

## Dependencies

- Stripe SDK v17.7.0
- Environment variables (configured in 05-01):
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRO_PRICE_ID`

## Next Plan

05-03: Checkout & Webhook Implementation - Test end-to-end payment flow

## Notes

- Pre-existing TypeScript errors in other files (documents.routes.ts, ocrQueue.ts) are unrelated to Stripe integration
- For local webhook testing, use: `stripe listen --forward-to localhost:3002/api/stripe/webhook`
