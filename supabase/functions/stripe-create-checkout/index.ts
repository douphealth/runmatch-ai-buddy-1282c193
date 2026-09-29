import {
  assertAllowedReturnUrl,
  assertRequestOrigin,
  handlePreflight,
  isPurchaseToken,
  json,
  requireEnv,
  sanitizeSlug,
  stripeRequest,
  withCheckoutState,
} from '../_shared/runmatch-stripe.ts';

type CheckoutBody = {
  purchaseToken?: string;
  resultSlug?: string;
  returnUrl?: string;
};

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  try {
    assertRequestOrigin(req);
    const body = await req.json() as CheckoutBody;
    if (!isPurchaseToken(body.purchaseToken)) return json(req, { error: 'Invalid purchase token' }, 400);

    const resultSlug = sanitizeSlug(body.resultSlug);
    const returnUrl = assertAllowedReturnUrl(body.returnUrl);
    const priceId = requireEnv('STRIPE_PRICE_ID');
    const price = await stripeRequest(`/prices/${encodeURIComponent(priceId)}?expand[]=product`);
    if (!price?.active) return json(req, { error: 'RunMatch Pro checkout is currently unavailable' }, 503);

    const mode = price.type === 'recurring' ? 'subscription' : 'payment';
    const params = new URLSearchParams();
    params.set('mode', mode);
    params.set('success_url', withCheckoutState(returnUrl, 'success', true));
    params.set('cancel_url', withCheckoutState(returnUrl, 'cancelled', false));
    params.set('client_reference_id', body.purchaseToken);
    params.set('line_items[0][price]', priceId);
    params.set('line_items[0][quantity]', '1');
    params.set('billing_address_collection', 'auto');
    params.set('allow_promotion_codes', 'true');
    params.set('metadata[purchase_token]', body.purchaseToken);
    if (resultSlug) params.set('metadata[result_slug]', resultSlug);

    if (mode === 'subscription') {
      params.set('subscription_data[metadata][purchase_token]', body.purchaseToken);
      if (resultSlug) params.set('subscription_data[metadata][result_slug]', resultSlug);
    } else {
      params.set('customer_creation', 'always');
      params.set('payment_intent_data[metadata][purchase_token]', body.purchaseToken);
      if (resultSlug) params.set('payment_intent_data[metadata][result_slug]', resultSlug);
    }

    const session = await stripeRequest('/checkout/sessions', { method: 'POST', body: params });
    if (!session?.url) throw new Error('Stripe did not return a checkout URL');

    return json(req, { url: session.url, sessionId: session.id, mode });
  } catch (error) {
    console.error('stripe-create-checkout', error);
    const message = error instanceof Error ? error.message : 'Unable to start checkout';
    const status = /Invalid|not allowed/i.test(message) ? 400 : 500;
    return json(req, { error: message }, status);
  }
});
