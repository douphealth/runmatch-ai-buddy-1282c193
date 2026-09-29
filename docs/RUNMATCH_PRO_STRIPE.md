# RunMatch Pro / Stripe deployment contract

RunMatch Pro is deliberately additive. The quiz, personalized recommendation, Top-5 comparison, shoe rotation, affiliate CTAs, and standard PDF remain free. The paid entitlement unlocks a separate buyer-focused decision pack.

## Architecture

- Browser: React app calls Supabase Edge Functions through the existing Supabase client.
- Checkout: `stripe-create-checkout` creates a Stripe-hosted Checkout Session using one configured Stripe Price.
- Entitlement: an opaque browser purchase token is stored in localStorage and bound to the Checkout Session through `client_reference_id` + Stripe metadata.
- Payment truth: `stripe-webhook` verifies Stripe's raw-body HMAC signature before changing entitlements.
- Return-path fallback: after Stripe redirects back with `{CHECKOUT_SESSION_ID}`, `stripe-verify-session` retrieves that Session server-side and verifies the browser token matches it.
- Database: `public.runmatch_entitlements` has RLS enabled and no public policies. Only Edge Functions using the service-role key read/write it.
- Failure mode: if Stripe is not configured or the Edge Functions are unavailable, the Pro card disappears and the free app continues to work.

## Required Supabase secrets

Set these in the Supabase project's Edge Function Secrets. Never add the values to Git.

```text
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
RUNMATCH_ALLOWED_ORIGINS=https://gearuptofit.com,https://www.gearuptofit.com
```

For test-mode validation, use the matching `sk_test_...`, test Price, and webhook secret from the test-mode webhook endpoint. Do not mix test and live objects.

Supabase provides `SUPABASE_URL` and the legacy `SUPABASE_SERVICE_ROLE_KEY` to hosted Edge Functions; this implementation uses them only server-side.

## Stripe product/price

Create one Stripe Product for RunMatch Pro and attach one active Price.

- A one-time Price makes Checkout use `mode=payment`.
- A recurring Price makes Checkout use `mode=subscription`.
- The app reads the Price dynamically, so the amount and currency displayed in the UI come from Stripe rather than hard-coded frontend text.
- Set `STRIPE_PRICE_ID` to that Price ID.

## Webhook

Create a Stripe webhook endpoint pointing to:

```text
https://setcqniidanludicrdye.supabase.co/functions/v1/stripe-webhook
```

Subscribe to:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.expired
customer.subscription.updated
customer.subscription.deleted
charge.refunded
```

Copy that endpoint's signing secret to `STRIPE_WEBHOOK_SECRET`.

## Deploy

Use the current Supabase CLI and verify command syntax with `--help` before execution.

```bash
supabase --version
supabase link --project-ref setcqniidanludicrdye
supabase db push --dry-run
supabase db push
supabase functions deploy
```

Function JWT configuration is committed in `supabase/config.toml`. The Stripe webhook must be public at the gateway because Stripe cannot send a Supabase user JWT; the function performs Stripe signature verification itself.

## Required end-to-end test

Use Stripe test mode first.

1. Open a real RunMatch result.
2. Confirm the full free result, Top-5 comparison, rotation, and free PDF work before purchase.
3. Confirm the Pro card shows the Product name and Price returned from Stripe.
4. Start checkout and confirm the browser reaches a Stripe-hosted `checkout.stripe.com` Session.
5. Complete checkout with a Stripe test card.
6. Confirm Stripe redirects back to the same result URL with `checkout=success&session_id=...`.
7. Confirm the page shows `RunMatch Pro Unlocked`.
8. Download the Pro Decision Pack and verify it contains the current result's Top-5 shoes and rotation.
9. Refresh the result page and confirm Pro remains unlocked on that browser via the server entitlement.
10. In Stripe, verify the Checkout Session is paid/active and the webhook delivery returned HTTP 200.
11. For a subscription Price, cancel/update the subscription and verify the entitlement follows the Stripe subscription status.
12. For a one-time Price, refund the charge and verify the entitlement becomes `refunded` and Pro no longer unlocks.

Do not switch `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET` to live-mode values until this entire sequence passes.

## Rollback

No existing free feature depends on the Pro table or Stripe functions.

Application rollback:
- revert the RunMatch Pro commits or redeploy the previous frontend build.

Stripe rollback:
- deactivate the RunMatch Pro Price or remove `STRIPE_PRICE_ID`; the Pro CTA fails closed and the free app remains available.

Supabase rollback:
- undeploy the four `stripe-*` Edge Functions.
- keep the entitlement table for audit history. Only drop it after confirming no payment records are needed.
