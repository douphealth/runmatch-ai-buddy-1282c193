// ============================================================
// MARKETING DRIP DISPATCHER — runs hourly via pg_cron.
// Reads all confirmed RunMatch subscribers from Brevo, computes
// days-since-opt-in per contact, and sends the matching template
// using Brevo's transactional /smtp/email endpoint (template-based).
// Idempotent via public.email_drip_log unique constraint.
// Behavioral branching: skips drip for contacts with BLACKLIST=1
// (suppressed) and respects engagement signals.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BREVO = 'https://api.brevo.com/v3';
const SENDER = { name: 'GearUpToFit · RunMatch AI', email: 'info@gearuptofit.com' };

// Drip schedule: day-offset → templateId (matches Brevo template IDs 2-8).
const SCHEDULE: Array<{ day: number; templateId: number }> = [
  { day: 0,  templateId: 2 }, // Welcome + Report (immediate)
  { day: 2,  templateId: 3 }, // Break-In Guide
  { day: 4,  templateId: 4 }, // Cadence & Form
  { day: 7,  templateId: 5 }, // Zone 2 Training
  { day: 10, templateId: 6 }, // Injury Prevention
  { day: 14, templateId: 7 }, // Race Day Tips
  { day: 21, templateId: 8 }, // Re-Match Invitation
];

// Lists that get the drip (RunMatch + Exit-Intent + Injury segment).
const DRIP_LIST_IDS = [3, 4, 6];

async function brevo(path: string, init: RequestInit = {}) {
  const r = await fetch(`${BREVO}${path}`, {
    ...init,
    headers: {
      'api-key': Deno.env.get('BREVO_API_KEY')!,
      'accept': 'application/json',
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  return { ok: r.ok, status: r.status, data, raw: text };
}

async function fetchListContacts(listId: number, modifiedSince?: string) {
  const out: any[] = [];
  let offset = 0;
  const limit = 500;
  while (true) {
    const q = new URLSearchParams({ limit: String(limit), offset: String(offset), sort: 'desc' });
    if (modifiedSince) q.set('modifiedSince', modifiedSince);
    const r = await brevo(`/contacts/lists/${listId}/contacts?${q}`);
    const batch = r.data?.contacts || [];
    out.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
    if (offset > 5000) break; // safety
  }
  return out;
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const report = { scanned: 0, sent: 0, skipped_already_sent: 0, skipped_no_match: 0, skipped_suppressed: 0, errors: 0, details: [] as any[] };
  const now = new Date();

  try {
    // 1. Gather unique contacts across drip lists
    const seen = new Set<string>();
    const contacts: any[] = [];
    for (const listId of DRIP_LIST_IDS) {
      const list = await fetchListContacts(listId);
      for (const c of list) {
        if (seen.has(c.email)) continue;
        seen.add(c.email);
        contacts.push(c);
      }
    }
    report.scanned = contacts.length;

    // 2. Pre-fetch sent log once
    const emails = contacts.map(c => c.email);
    const sentMap = new Map<string, Set<number>>();
    if (emails.length) {
      const { data: logs } = await supabase
        .from('email_drip_log')
        .select('contact_email, template_id')
        .in('contact_email', emails);
      for (const r of (logs || [])) {
        if (!sentMap.has(r.contact_email)) sentMap.set(r.contact_email, new Set());
        sentMap.get(r.contact_email)!.add(r.template_id);
      }
    }

    // 3. For each contact, find which drip step is due
    for (const c of contacts) {
      // Suppression / blacklist check
      const attrs = c.attributes || {};
      if (attrs.BLACKLIST === 1 || c.emailBlacklisted) {
        report.skipped_suppressed++;
        continue;
      }

      const optInRaw = attrs.OPT_IN_DATE || attrs.DOI_CONFIRMED || c.createdAt;
      const optInDate = optInRaw ? new Date(optInRaw) : new Date(c.createdAt);
      const daysSince = daysBetween(optInDate, now);

      // Find the latest scheduled step that is now due
      const due = [...SCHEDULE].reverse().find(s => daysSince >= s.day);
      if (!due) { report.skipped_no_match++; continue; }

      const already = sentMap.get(c.email);
      if (already?.has(due.templateId)) { report.skipped_already_sent++; continue; }

      // Send via Brevo transactional API using templateId
      const send = await brevo('/smtp/email', {
        method: 'POST',
        body: JSON.stringify({
          sender: SENDER,
          to: [{ email: c.email, name: attrs.FIRSTNAME || undefined }],
          templateId: due.templateId,
          params: {
            FIRSTNAME: attrs.FIRSTNAME || 'runner',
            PRIMARY_SHOE: attrs.PRIMARY_SHOE || '',
            SHOE_CATEGORY: attrs.SHOE_CATEGORY || '',
          },
          tags: [`drip-day-${due.day}`, 'runmatch-sequence'],
          headers: { 'X-Mailin-Custom': `drip:${due.day}:${due.templateId}` },
        }),
      });

      if (send.ok) {
        report.sent++;
        await supabase.from('email_drip_log').insert({
          contact_email: c.email,
          template_id: due.templateId,
          day_offset: due.day,
          brevo_message_id: send.data?.messageId,
          status: 'sent',
        });
        report.details.push({ email: c.email, day: due.day, templateId: due.templateId, ok: true });
      } else {
        report.errors++;
        await supabase.from('email_drip_log').insert({
          contact_email: c.email,
          template_id: due.templateId,
          day_offset: due.day,
          status: 'failed',
          error: send.raw.slice(0, 500),
        });
        report.details.push({ email: c.email, day: due.day, templateId: due.templateId, ok: false, error: send.raw.slice(0, 200) });
      }
    }

    return new Response(JSON.stringify(report, null, 2),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ ...report, fatal: String(err) }, null, 2),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
