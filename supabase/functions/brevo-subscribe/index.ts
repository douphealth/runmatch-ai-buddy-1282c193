// Edge function: subscribe a lead to Brevo with rich attributes & tags,
// then trigger the appropriate automation workflow via list assignment.
// Keeps BREVO_API_KEY server-side. Public endpoint (verify_jwt = false).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SubscribePayload {
  email: string;
  firstName?: string;
  source: 'quiz_gate' | 'exit_popup' | 'inline_hero' | 'footer' | 'blog_inline';
  shoeCategory?: 'daily' | 'speed' | 'long_run' | 'trail' | 'stability' | 'max_cushion';
  primaryShoe?: string;
  weeklyMileage?: number;
  injuries?: string[];
  utm?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string };
  consent?: boolean;
  doubleOptIn?: boolean;
  templateId?: number; // Brevo DOI template id
  redirectionUrl?: string;
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('BREVO_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body: SubscribePayload = await req.json();
    if (!body?.email || !isEmail(body.email) || body.email.length > 255) {
      return new Response(JSON.stringify({ error: 'Invalid email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!body.consent) {
      return new Response(JSON.stringify({ error: 'Consent required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const attributes: Record<string, unknown> = {
      FIRSTNAME: (body.firstName || '').slice(0, 100),
      SOURCE: body.source,
      SHOE_CATEGORY: body.shoeCategory || '',
      PRIMARY_SHOE: (body.primaryShoe || '').slice(0, 200),
      WEEKLY_MILEAGE: body.weeklyMileage ?? null,
      INJURY_HISTORY: (body.injuries || []).join(', ').slice(0, 500),
      UTM_SOURCE: body.utm?.source || '',
      UTM_MEDIUM: body.utm?.medium || '',
      UTM_CAMPAIGN: body.utm?.campaign || '',
      OPT_IN_DATE: new Date().toISOString(),
    };

    // Source → Brevo list mapping (real IDs created in our Brevo account).
    const listIdBySource: Record<string, number> = {
      quiz_gate: 3,    // RunMatch Subscribers
      exit_popup: 4,   // Exit-Intent Popup
      inline_hero: 3,  // RunMatch Subscribers
      footer: 5,       // Blog Subscribers
      blog_inline: 5,  // Blog Subscribers
    };
    const listIds = [listIdBySource[body.source] ?? 3];

    const payload: Record<string, unknown> = {
      email: body.email.toLowerCase().trim(),
      attributes,
      listIds,
      updateEnabled: true, // upsert
    };

    // If a Brevo Double Opt-In template id is provided, use the DOI endpoint
    // (highest deliverability + GDPR best practice). Otherwise use direct create.
    const useDoi = !!(body.doubleOptIn && body.templateId);
    const endpoint = useDoi
      ? 'https://api.brevo.com/v3/contacts/doubleOptinConfirmation'
      : 'https://api.brevo.com/v3/contacts';

    if (useDoi) {
      payload.templateId = body.templateId;
      payload.redirectionUrl = body.redirectionUrl || 'https://gearuptofit.com/shoe-match/?confirmed=1';
      payload.includeListIds = listIds;
      delete payload.listIds;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
        'accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Brevo returns 201 (created) or 204 (updated). 400 with code "duplicate_parameter" means already exists — treat as success.
    const text = await res.text();
    let parsed: any = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* ignore */ }

    if (res.ok || parsed?.code === 'duplicate_parameter') {
      return new Response(JSON.stringify({ success: true, doubleOptIn: useDoi }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.error('Brevo error', res.status, text);
    return new Response(JSON.stringify({ error: 'Subscription failed', detail: parsed?.message || text }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('brevo-subscribe exception', err);
    return new Response(JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
