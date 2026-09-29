import {
  assertRequestOrigin,
  getEntitlement,
  handlePreflight,
  isPurchaseToken,
  json,
  publicEntitlement,
  requireEnv,
  sessionToEntitlement,
  stripeRequest,
  upsertEntitlement,
} from '../_shared/runmatch-stripe.ts';

type VerifyBody = {
  purchaseToken?: string;
  sessionId?: string;
};

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  try {
    assertRequestOrigin(req);
    const body = await req.json() as VerifyBody;
    if (!isPurchaseToken(body.purchaseToken)) return json(req, { error: 'Invalid purchase token' }, 400);

    if (body.sessionId) {
      if (!/^cs_(test_|live_)?[A-Za-z0-9_]+$/.test(body.sessionId) || body.sessionId.length > 255) {
        return json(req, { error: 'Invalid checkout session' }, 400);
      }

      const session = await stripeRequest(
        `/checkout/sessions/${encodeURIComponent(body.sessionId)}?expand[]=subscription`,
      );
      if (session.client_reference_id !== body.purchaseToken) {
        return json(req, { error: 'Checkout session does not belong to this browser' }, 403);
      }

      const row = sessionToEntitlement(session, body.purchaseToken, requireEnv('STRIPE_PRICE_ID'));
      await upsertEntitlement(row);
      return json(req, {
        ...publicEntitlement(row),
        verifiedVia: 'stripe',
      });
    }

    const existing = await getEntitlement(body.purchaseToken);
    return json(req, {
      ...publicEntitlement(existing),
      verifiedVia: 'database',
    });
  } catch (error) {
    console.error('stripe-verify-session', error);
    const message = error instanceof Error ? error.message : 'Unable to verify purchase';
    return json(req, { error: message }, 500);
  }
});
