import {
  assertRequestOrigin,
  handlePreflight,
  json,
  requireEnv,
  stripeRequest,
} from '../_shared/runmatch-stripe.ts';

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  try {
    assertRequestOrigin(req);
    const priceId = requireEnv('STRIPE_PRICE_ID');
    const price = await stripeRequest(`/prices/${encodeURIComponent(priceId)}?expand[]=product`);
    if (!price?.active) return json(req, { configured: false, error: 'RunMatch Pro price is inactive' }, 503);

    const product = typeof price.product === 'object' ? price.product : null;
    const amount = typeof price.unit_amount === 'number' ? price.unit_amount : null;
    const currency = typeof price.currency === 'string' ? price.currency.toUpperCase() : null;
    const recurring = price.type === 'recurring' ? price.recurring : null;

    let priceLabel: string | null = null;
    if (amount != null && currency) {
      try {
        priceLabel = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          currencyDisplay: 'narrowSymbol',
        }).format(amount / 100);
      } catch {
        priceLabel = `${(amount / 100).toFixed(2)} ${currency}`;
      }
    }

    return json(req, {
      configured: true,
      product: {
        name: product?.name || 'RunMatch Pro',
        description: product?.description || 'Advanced personalized running-shoe decision pack',
        priceLabel,
        currency,
        amount,
        mode: recurring ? 'subscription' : 'payment',
        interval: recurring?.interval ?? null,
      },
    });
  } catch (error) {
    console.error('stripe-product', error);
    const message = error instanceof Error ? error.message : 'Unable to load RunMatch Pro';
    const status = message.includes('not configured') ? 503 : 500;
    return json(req, { configured: false, error: message }, status);
  }
});
