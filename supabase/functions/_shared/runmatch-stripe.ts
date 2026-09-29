const DEFAULT_ALLOWED_ORIGINS = [
  'https://gearuptofit.com',
  'https://www.gearuptofit.com',
  'https://runmatch-ai-buddy.lovable.app',
  'https://runmatch-ai-buddy-1282c193.pages.dev',
  'https://runmatch.gearup-flow-master.pages.dev',
];

export type EntitlementRow = {
  purchase_token: string;
  stripe_customer_id?: string | null;
  stripe_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id: string;
  mode: 'payment' | 'subscription';
  status: string;
  email?: string | null;
  result_slug?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  current_period_end?: string | null;
  paid_at?: string | null;
};

export function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function allowedOrigins(): string[] {
  const configured = Deno.env.get('RUNMATCH_ALLOWED_ORIGINS')
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return configured?.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  return allowedOrigins().includes(origin);
}

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin');
  const allowOrigin = origin && isAllowedOrigin(origin) ? origin : DEFAULT_ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function handlePreflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export function assertRequestOrigin(req: Request): void {
  if (!isAllowedOrigin(req.headers.get('origin'))) {
    throw new Error('Origin not allowed');
  }
}

export function assertAllowedReturnUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Invalid return URL');
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('Invalid return URL protocol');
  if (!isAllowedOrigin(url.origin) && url.hostname !== 'localhost') throw new Error('Return URL origin not allowed');
  url.searchParams.delete('checkout');
  url.searchParams.delete('session_id');
  return url.toString();
}

export function withCheckoutState(returnUrl: string, state: 'success' | 'cancelled', includeSession = false): string {
  const url = new URL(returnUrl);
  url.searchParams.set('checkout', state);
  if (includeSession) url.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
  return url.toString();
}

export function isPurchaseToken(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function sanitizeSlug(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error('Invalid result slug');
  const slug = value.trim();
  if (!/^[a-z0-9-]{1,180}$/i.test(slug)) throw new Error('Invalid result slug');
  return slug;
}

export async function stripeRequest(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: URLSearchParams } = {},
): Promise<any> {
  const secretKey = requireEnv('STRIPE_SECRET_KEY');
  const method = init.method ?? 'GET';
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: init.body?.toString(),
  });

  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const message = payload?.error?.message || `Stripe request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

function serviceHeaders(extra: Record<string, string> = {}): HeadersInit {
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    'content-type': 'application/json',
    ...extra,
  };
}

export async function getEntitlement(purchaseToken: string): Promise<EntitlementRow | null> {
  const baseUrl = requireEnv('SUPABASE_URL');
  const url = `${baseUrl}/rest/v1/runmatch_entitlements?purchase_token=eq.${encodeURIComponent(purchaseToken)}&select=*&limit=1`;
  const response = await fetch(url, { headers: serviceHeaders() });
  if (!response.ok) throw new Error(`Entitlement lookup failed (${response.status})`);
  const rows = await response.json();
  return Array.isArray(rows) && rows[0] ? rows[0] as EntitlementRow : null;
}

export async function upsertEntitlement(row: EntitlementRow): Promise<void> {
  const baseUrl = requireEnv('SUPABASE_URL');
  const response = await fetch(`${baseUrl}/rest/v1/runmatch_entitlements?on_conflict=purchase_token`, {
    method: 'POST',
    headers: serviceHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Entitlement upsert failed (${response.status}): ${text.slice(0, 300)}`);
  }
}

export async function updateEntitlementsBy(
  field: 'stripe_subscription_id' | 'stripe_payment_intent_id' | 'stripe_session_id',
  value: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const baseUrl = requireEnv('SUPABASE_URL');
  const response = await fetch(
    `${baseUrl}/rest/v1/runmatch_entitlements?${field}=eq.${encodeURIComponent(value)}`,
    {
      method: 'PATCH',
      headers: serviceHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(patch),
    },
  );
  if (!response.ok) throw new Error(`Entitlement update failed (${response.status})`);
}

export function isActiveEntitlement(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing' || status === 'paid';
}

export function sessionToEntitlement(session: any, purchaseToken: string, priceId: string): EntitlementRow {
  const mode: 'payment' | 'subscription' = session.mode === 'subscription' ? 'subscription' : 'payment';
  const subscription = typeof session.subscription === 'object' ? session.subscription : null;
  const subscriptionStatus = subscription?.status;
  const paid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
  const status = mode === 'subscription'
    ? (subscriptionStatus || (paid ? 'active' : 'pending'))
    : (paid ? 'paid' : 'pending');

  return {
    purchase_token: purchaseToken,
    stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
    stripe_session_id: session.id ?? null,
    stripe_payment_intent_id:
      typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
    stripe_subscription_id:
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null,
    stripe_price_id: priceId,
    mode,
    status,
    email: session.customer_details?.email ?? session.customer_email ?? null,
    result_slug: session.metadata?.result_slug ?? null,
    amount_total: typeof session.amount_total === 'number' ? session.amount_total : null,
    currency: session.currency ?? null,
    current_period_end: subscription?.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    paid_at: paid ? new Date().toISOString() : null,
  };
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function verifyStripeSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader) return false;
  const secret = requireEnv('STRIPE_WEBHOOK_SECRET');
  const parts = signatureHeader.split(',').map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith('t='));
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!timestampPart || signatures.length === 0) return false;

  const timestamp = Number(timestampPart.slice(2));
  if (!Number.isFinite(timestamp) || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
  const expected = hex(digest);
  return signatures.some((signature) => constantTimeEqual(signature, expected));
}

export function publicEntitlement(row: EntitlementRow | null) {
  if (!row) return { active: false, status: 'free', mode: null, currentPeriodEnd: null };
  return {
    active: isActiveEntitlement(row.status),
    status: row.status,
    mode: row.mode,
    currentPeriodEnd: row.current_period_end ?? null,
  };
}
