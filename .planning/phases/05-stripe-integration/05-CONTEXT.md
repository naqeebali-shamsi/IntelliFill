# Phase 5: Stripe Integration - Context

**Gathered:** 2026-01-17
**Status:** Ready for research

<vision>
## How This Should Work

Users on the free tier can explore IntelliFill, but when they hit a PRO feature, they get redirected to a clean pricing page. The page shows one simple option: PRO subscription.

When they subscribe, payment goes through Stripe Checkout. The moment payment succeeds, PRO features unlock instantly — no waiting, no refresh, no manual activation. They're immediately a PRO user.

For managing their subscription (updating payment, viewing invoices, canceling), there's a "Manage Subscription" link in settings that opens Stripe's Customer Portal. We don't build billing UI ourselves.

</vision>

<essential>
## What Must Be Nailed

- **Instant unlock** — Pay → features work immediately. This is the non-negotiable. No "please wait while we process" or "check back in a few minutes."
- **Simple pricing** — One PRO tier, one price, clear features list. No confusion, no "which plan is right for me" paralysis.

</essential>

<specifics>
## Specific Ideas

- Single PRO tier (like Notion Personal Pro) — not tiered plans
- Clean, minimal pricing page — single plan card, price, features list, CTA
- Stripe Customer Portal for all billing management (invoices, payment methods, cancellation)
- When free users hit PRO features → redirect to pricing page (not modal checkout)
- Pricing page accessible from navigation + in-context upgrade prompts

</specifics>

<notes>
## Additional Context

PRO features are already scaffolded in v1.0. The permission checks exist, they just need real subscription status instead of hardcoded values.

This integration focuses on the happy path: subscribe, use PRO, manage billing. Edge cases (failed payments, subscription lapses) handled by Stripe's defaults initially.

</notes>

---

_Phase: 05-stripe-integration_
_Context gathered: 2026-01-17_
