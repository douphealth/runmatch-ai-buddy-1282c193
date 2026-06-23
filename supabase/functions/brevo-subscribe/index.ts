// Edge function: subscribe a lead to Brevo with rich attributes & tags,
// then trigger the appropriate automation workflow via list assignment.
// Keeps BREVO_API_KEY server-side. Public endpoint (verify_jwt = false).

function normalizeBrevoValue(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/-/g, '_').slice(0, 100);
}

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
      payload.redirectionUrl = body.redirectionUrl || 'https://gearuptofit.com/shoe-finder/?confirmed=1';
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
      // Fire the Day-0 Welcome email IMMEDIATELY (template 2) so the runner
      // gets their report straight away. The hourly drip dispatcher continues
      // with Day 2-21 and is idempotent via email_drip_log.
      let welcomeSent = false;
      let welcomeSkipped = false;
      if (!useDoi) {
        try {
          // Server-side dedupe: if Day-0 (template 2) has already been logged
          // for this email, skip the resend. Protects against duplicate
          // welcome emails if the user re-subscribes from a different browser
          // or after clearing localStorage.
          const supaUrlPre = Deno.env.get('SUPABASE_URL');
          const supaKeyPre = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
          if (supaUrlPre && supaKeyPre) {
            try {
              const dedupeRes = await fetch(
                `${supaUrlPre}/rest/v1/email_drip_log?select=id&contact_email=eq.${encodeURIComponent(body.email.toLowerCase().trim())}&template_id=eq.2&limit=1`,
                { headers: { apikey: supaKeyPre, authorization: `Bearer ${supaKeyPre}` } }
              );
              if (dedupeRes.ok) {
                const rows = await dedupeRes.json().catch(() => []);
                if (Array.isArray(rows) && rows.length > 0) welcomeSkipped = true;
              }
            } catch (_) { /* fail-open: still send */ }
          }

          if (welcomeSkipped) {
            // Already onboarded — don't double-send. List membership / attribute
            // updates above are still applied so the contact stays in sync.
          } else {
          const sendRes = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': apiKey, 'content-type': 'application/json', 'accept': 'application/json' },
            body: JSON.stringify({
              sender: { name: 'GearUpToFit · RunMatch AI', email: 'info@gearuptofit.com' },
              to: [{ email: body.email.toLowerCase().trim(), name: body.firstName || undefined }],
              templateId: 2,
              params: {
                FIRSTNAME: body.firstName || 'runner',
                PRIMARY_SHOE: body.primaryShoe || '',
                SHOE_CATEGORY: body.shoeCategory || '',
              },
              tags: ['drip-day-0', 'runmatch-welcome', `source-${body.source}`],
              headers: { 'X-Mailin-Custom': 'drip:0:2' },
            }),
          });
          welcomeSent = sendRes.ok;
          if (sendRes.ok) {
            const sendJson: any = await sendRes.json().catch(() => ({}));
            // Log to email_drip_log so the hourly dispatcher won't re-send template 2.
            const supaUrl = Deno.env.get('SUPABASE_URL');
            const supaKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
            if (supaUrl && supaKey) {
              await fetch(`${supaUrl}/rest/v1/email_drip_log`, {
                method: 'POST',
                headers: {
                  'apikey': supaKey,
                  'authorization': `Bearer ${supaKey}`,
                  'content-type': 'application/json',
                  'prefer': 'return=minimal',
                },
                body: JSON.stringify({
                  contact_email: body.email.toLowerCase().trim(),
                  template_id: 2,
                  day_offset: 0,
                  brevo_message_id: sendJson?.messageId || null,
                  status: 'sent',
                }),
              }).catch(() => {});
            }
          } else {
            const errTxt = await sendRes.text();
            console.error('Welcome send failed', sendRes.status, errTxt);
          }
          } // end if (welcomeSkipped) else
        } catch (e) {
          console.error('Welcome send exception', e);
        }
      }

      return new Response(JSON.stringify({ success: true, doubleOptIn: useDoi, welcomeSent, welcomeSkipped }),
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
