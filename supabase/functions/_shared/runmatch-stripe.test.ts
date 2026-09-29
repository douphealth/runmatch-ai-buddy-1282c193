import {
  assertAllowedReturnUrl,
  publicEntitlement,
  verifyStripeSignature,
} from './runmatch-stripe.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('Stripe webhook signature validates the raw body and timestamp', async () => {
  Deno.env.set('STRIPE_WEBHOOK_SECRET', 'whsec_runmatch_test');
  const body = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed' });
  const timestamp = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('whsec_runmatch_test'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const signature = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');

  assert(
    await verifyStripeSignature(body, `t=${timestamp},v1=${signature}`),
    'expected a valid signature to pass',
  );
  assert(
    !(await verifyStripeSignature(body + 'x', `t=${timestamp},v1=${signature}`)),
    'body tampering must fail signature verification',
  );
});

Deno.test('Stripe webhook signature rejects stale timestamps', async () => {
  Deno.env.set('STRIPE_WEBHOOK_SECRET', 'whsec_runmatch_test');
  const body = '{}';
  const timestamp = Math.floor(Date.now() / 1000) - 1000;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('whsec_runmatch_test'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const signature = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');

  assert(
    !(await verifyStripeSignature(body, `t=${timestamp},v1=${signature}`)),
    'stale signatures must be rejected',
  );
});

Deno.test('checkout return URLs are constrained to approved HTTPS origins', () => {
  const ok = assertAllowedReturnUrl('https://gearuptofit.com/shoe-finder/results/test?d=abc&checkout=old');
  const parsed = new URL(ok);
  assert(parsed.origin === 'https://gearuptofit.com', 'approved origin should be preserved');
  assert(parsed.searchParams.get('d') === 'abc', 'result state must be preserved');
  assert(!parsed.searchParams.has('checkout'), 'stale checkout state must be removed');

  let rejected = false;
  try {
    assertAllowedReturnUrl('https://evil.example/steal');
  } catch {
    rejected = true;
  }
  assert(rejected, 'unapproved origins must be rejected');
});

Deno.test('only paid or active states unlock Pro', () => {
  assert(publicEntitlement(null).active === false, 'missing entitlement is free');
  assert(publicEntitlement({
    purchase_token: crypto.randomUUID(),
    stripe_price_id: 'price_test',
    mode: 'payment',
    status: 'paid',
  }).active === true, 'paid one-time checkout should unlock');
  assert(publicEntitlement({
    purchase_token: crypto.randomUUID(),
    stripe_price_id: 'price_test',
    mode: 'subscription',
    status: 'past_due',
  }).active === false, 'past-due subscription should not remain unlocked');
});
