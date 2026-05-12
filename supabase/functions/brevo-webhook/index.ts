// ============================================================
// BREVO WEBHOOK — receives engagement events (open, click, bounce,
// soft_bounce, spam, unsubscribe, blocked, deferred, hard_bounce)
// and persists to public.email_engagement_events.
// On hard_bounce / spam / unsubscribe → blacklist contact in Brevo.
// Configure in Brevo: Settings → Webhooks → URL of this function.
// Public endpoint (verify_jwt = false in supabase/config.toml).
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPPRESS_EVENTS = new Set(['hard_bounce', 'spam', 'unsubscribed', 'blocked']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json();
    const events = Array.isArray(body) ? body : [body];

    for (const e of events) {
      const email = (e.email || '').toLowerCase().trim();
      if (!email) continue;
      const evt = e.event || 'unknown';

      await supabase.from('email_engagement_events').insert({
        contact_email: email,
        event: evt,
        template_id: e['template-id'] || e.templateId || null,
        link: e.link || null,
        occurred_at: e.ts ? new Date(e.ts * 1000).toISOString() : new Date().toISOString(),
        raw: e,
      });

      if (SUPPRESS_EVENTS.has(evt)) {
        await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
          method: 'PUT',
          headers: { 'api-key': Deno.env.get('BREVO_API_KEY')!, 'content-type': 'application/json' },
          body: JSON.stringify({ emailBlacklisted: true, attributes: { BLACKLIST: 1 } }),
        }).catch(() => {});
      }
    }

    return new Response(JSON.stringify({ ok: true, received: events.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
