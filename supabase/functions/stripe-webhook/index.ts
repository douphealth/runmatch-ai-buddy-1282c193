import {
  handlePreflight,
  isPurchaseToken,
  json,
  requireEnv,
  sessionToEntitlement,
  updateEntitlementsBy,
  upsertEntitlement,
  verifyStripeSignature,
} from '../_shared/runmatch-stripe.ts';

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const rawBody = await req.text();

  try {
    const valid = await verifyStripeSignature(rawBody, req.headers.get('stripe-signature'));
    if (!valid) return json(req, { error: 'Invalid Stripe signature' }, 400);

    const event = JSON.parse(rawBody);
    const object = event?.data?.object;

    switch (event?.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const token = object?.client_reference_id || object?.metadata?.purchase_token;
        if (!isPurchaseToken(token)) break;

        let session = object;
        if (object?.mode === 'subscription' && typeof object?.subscription === 'string') {
          try {
            const subscription = await (await import('../_shared/runmatch-stripe.ts')).stripeRequest(
              `/subscriptions/${encodeURIComponent(object.subscription)}`,
            );
            session = { ...object, subscription };
          } catch (error) {
            console.error('stripe-webhook subscription expansion failed', error);
          }
        }

        const row = sessionToEntitlement(session, token, requireEnv('STRIPE_PRICE_ID'));
        await upsertEntitlement(row);
        break;
      }

      case 'checkout.session.expired': {
        const sessionId = object?.id;
        if (typeof sessionId === 'string') {
          await updateEntitlementsBy('stripe_session_id', sessionId, { status: 'expired' });
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscriptionId = object?.id;
        if (typeof subscriptionId !== 'string') break;
        const patch: Record<string, unknown> = {
          status: event.type === 'customer.subscription.deleted' ? 'canceled' : object?.status || 'unknown',
          current_period_end: object?.current_period_end
            ? new Date(object.current_period_end * 1000).toISOString()
            : null,
        };
        await updateEntitlementsBy('stripe_subscription_id', subscriptionId, patch);
        break;
      }

      case 'charge.refunded': {
        const paymentIntentId = object?.payment_intent;
        if (typeof paymentIntentId === 'string') {
          await updateEntitlementsBy('stripe_payment_intent_id', paymentIntentId, { status: 'refunded' });
        }
        break;
      }

      default:
        break;
    }

    return json(req, { received: true });
  } catch (error) {
    console.error('stripe-webhook', error);
    return json(req, { error: 'Webhook processing failed' }, 500);
  }
});
