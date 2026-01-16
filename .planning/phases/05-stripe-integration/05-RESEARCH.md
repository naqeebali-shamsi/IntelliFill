# Phase 5: Stripe Integration - Research

**Researched:** 2026-01-17
**Status:** Ready for planning

## Stripe Account Status

- **Account ID:** `acct_1ShpfHEMhTxeOndp`
- **Products:** None (need to create)
- **Prices:** None (need to create)
- **Dashboard:** https://dashboard.stripe.com/acct_1ShpfHEMhTxeOndp/apikeys

## Recommended Architecture

### Payment Flow

```
Free User → PRO Feature → Pricing Page → Stripe Checkout → Webhook → Instant Unlock
```

1. **Pricing Page** (`/pricing`) - Clean, minimal, single PRO tier
2. **Stripe Checkout** - Hosted payment page (handles PCI compliance)
3. **Webhook Endpoint** - Receives payment events, updates user subscription status
4. **PRO Status Check** - Middleware/hook checks user's subscription status

### Stripe Products to Create

| Product         | Type         | Price     |
| --------------- | ------------ | --------- |
| IntelliFill PRO | Subscription | TBD/month |

### Webhook Events to Handle

| Event                           | Trigger                | Action                                     |
| ------------------------------- | ---------------------- | ------------------------------------------ |
| `checkout.session.completed`    | User completes payment | Set `isPro = true`, store `subscriptionId` |
| `invoice.paid`                  | Successful renewal     | Confirm PRO status continues               |
| `invoice.payment_failed`        | Payment fails          | Notify user, grace period                  |
| `customer.subscription.deleted` | Cancellation           | Set `isPro = false`                        |
| `customer.subscription.updated` | Plan changes           | Update subscription status                 |

### Database Schema Changes

```prisma
model User {
  // Existing fields...

  // Stripe integration
  stripeCustomerId    String?   @unique
  subscriptionId      String?   @unique
  subscriptionStatus  String?   // 'active', 'canceled', 'past_due', etc.
  currentPeriodEnd    DateTime? // When current billing period ends
}
```

### Backend Endpoints Needed

| Endpoint                              | Method | Purpose                         |
| ------------------------------------- | ------ | ------------------------------- |
| `/api/stripe/create-checkout-session` | POST   | Create Stripe Checkout session  |
| `/api/stripe/webhook`                 | POST   | Handle Stripe webhook events    |
| `/api/stripe/create-portal-session`   | POST   | Create Customer Portal session  |
| `/api/subscription/status`            | GET    | Get current subscription status |

### Frontend Components Needed

| Component              | Location   | Purpose                                      |
| ---------------------- | ---------- | -------------------------------------------- |
| `PricingPage`          | `/pricing` | Display PRO plan, handle checkout            |
| `UpgradePrompt`        | In-context | Redirect to pricing when hitting PRO feature |
| `SubscriptionSettings` | Settings   | Show status, link to Customer Portal         |

### Environment Variables Needed

**Backend (`quikadmin/.env`):**

```env
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRO_PRICE_ID=price_xxx
```

**Frontend (`quikadmin-web/.env`):**

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

## Implementation Phases

### Phase 5.1: Stripe Setup (No Code)

- Create PRO product in Stripe Dashboard
- Create monthly price
- Configure Customer Portal settings
- Set up webhook endpoint in Dashboard

### Phase 5.2: Backend Integration

- Add Stripe SDK (`stripe` npm package)
- Implement webhook endpoint with signature verification
- Implement checkout session creation
- Implement portal session creation
- Add subscription status to user model
- Protect PRO endpoints with subscription check

### Phase 5.3: Frontend Integration

- Create Pricing page component
- Update PRO feature gates to redirect to pricing
- Add subscription status to auth store
- Add "Manage Subscription" in settings

### Phase 5.4: Testing & Polish

- Test full subscription flow (sandbox)
- Test cancellation flow
- Test failed payment handling
- Verify instant unlock works

## Key Decisions

| Decision             | Choice                   | Rationale                                   |
| -------------------- | ------------------------ | ------------------------------------------- |
| Checkout method      | Stripe Checkout (hosted) | Simplest, PCI compliant, handles edge cases |
| Billing management   | Customer Portal          | No custom billing UI needed                 |
| Webhook handling     | Express endpoint         | Fits existing backend                       |
| Subscription storage | Database                 | Source of truth for PRO status              |

## Security Considerations

- Webhook signature verification required
- Never trust client-side subscription status
- Store `stripeCustomerId` for customer lookup
- Use Stripe's test mode for development

## References

- [Stripe SaaS Subscriptions Guide](https://docs.stripe.com/get-started/use-cases/saas-subscriptions)
- [Stripe Checkout](https://docs.stripe.com/payments/checkout)
- [Stripe Customer Portal](https://docs.stripe.com/customer-management)
- [Subscription Webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)

---

_Phase: 05-stripe-integration_
_Research completed: 2026-01-17_
