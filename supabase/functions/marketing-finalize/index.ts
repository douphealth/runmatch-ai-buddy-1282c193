// ============================================================
// MARKETING FINALIZE — SOTA end-to-end automation
// 1. Fetch Brevo DKIM/SPF/DMARC/Brevo-code records for gearuptofit.com
// 2. Auto-provision missing DNS records via Cloudflare API
// 3. Trigger Brevo authentication
// 4. Clean orphan WP /mailin/ plugin folder + reinstall Brevo plugin
// 5. Seed 7 production-grade Brevo email templates
// Idempotent.
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DOMAIN = 'gearuptofit.com';
const SENDER_EMAIL = 'info@gearuptofit.com';
const SENDER_NAME = 'GearUpToFit · RunMatch AI';

// ---------------- Brevo ----------------
async function brevo(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.brevo.com/v3${path}`, {
    ...init,
    headers: {
      'api-key': Deno.env.get('BREVO_API_KEY')!,
      'accept': 'application/json',
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  return { ok: res.ok, status: res.status, data, raw: text };
}

// ---------------- WordPress ----------------
function wpHeaders() {
  const auth = btoa(`${Deno.env.get('WP_USERNAME')}:${Deno.env.get('WP_APP_PASSWORD')!.replace(/\s+/g, '')}`);
  return {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'GearUpToFit-Lovable-Finalize/1.0',
  };
}
async function wp(path: string, init: RequestInit = {}) {
  const res = await fetch(`${Deno.env.get('WP_SITE_URL')!.replace(/\/$/, '')}/wp-json${path}`, {
    ...init,
    headers: { ...wpHeaders(), ...(init.headers || {}) },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  return { ok: res.ok, status: res.status, data, raw: text };
}

// ---------------- Cloudflare ----------------
async function cf(path: string, init: RequestInit = {}) {
  const zone = Deno.env.get('CLOUDFLARE_ZONE_ID');
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${Deno.env.get('CLOUDFLARE_API_TOKEN')}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  return { ok: res.ok, status: res.status, data, raw: text, zone };
}

async function cfListRecords(name?: string) {
  const q = name ? `?name=${encodeURIComponent(name)}&per_page=100` : '?per_page=100';
  return cf(`/zones/${Deno.env.get('CLOUDFLARE_ZONE_ID')}/dns_records${q}`);
}

async function cfUpsertRecord(record: { type: string; name: string; content: string; ttl?: number; proxied?: boolean }) {
  const list = await cfListRecords(record.name);
  const existing = (list.data?.result || []).find((r: any) =>
    r.type === record.type && r.name === record.name && r.content === record.content
  );
  if (existing) return { action: 'exists', id: existing.id, ...record };
  // Check for same type+name with different content (update)
  const sameSlot = (list.data?.result || []).find((r: any) =>
    r.type === record.type && r.name === record.name && (record.type !== 'TXT' || r.content.startsWith(record.content.split('=')[0]))
  );
  const body = { ...record, ttl: record.ttl ?? 1, proxied: record.proxied ?? false };
  if (sameSlot && record.type !== 'TXT') {
    const upd = await cf(`/zones/${Deno.env.get('CLOUDFLARE_ZONE_ID')}/dns_records/${sameSlot.id}`, {
      method: 'PUT', body: JSON.stringify(body),
    });
    return { action: 'updated', id: sameSlot.id, ok: upd.ok, error: upd.ok ? undefined : upd.raw.slice(0, 300), ...record };
  }
  const created = await cf(`/zones/${Deno.env.get('CLOUDFLARE_ZONE_ID')}/dns_records`, {
    method: 'POST', body: JSON.stringify(body),
  });
  return { action: 'created', ok: created.ok, error: created.ok ? undefined : created.raw.slice(0, 300), ...record };
}

// ============================================================
// EMAIL TEMPLATES (7 production-grade HTML emails)
// ============================================================
const BRAND_RED = '#E53935';
const wrap = (preheader: string, inner: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GearUpToFit RunMatch AI</title></head>
<body style="margin:0;padding:0;background:#0f0f12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif">
<div style="display:none;font-size:0;line-height:0;max-height:0;max-width:0;opacity:0;overflow:hidden">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f12;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#17171b;border-radius:16px;overflow:hidden;border:1px solid #2a2a30">
<tr><td style="background:linear-gradient(135deg,${BRAND_RED},#b71c1c);padding:28px 32px;text-align:center">
<img src="https://gearuptofit.com/wp-content/uploads/2023/03/cropped-Grey-Black-Illustration-Gym-Fitness-Logo.png" width="48" height="48" alt="GearUpToFit" style="display:block;margin:0 auto;border-radius:10px;background:#fff;padding:4px"/>
<div style="margin-top:10px;font-family:Oswald,Impact,sans-serif;letter-spacing:0.12em;text-transform:uppercase;font-size:14px;color:#fff;font-weight:600">RunMatch AI</div>
</td></tr>
<tr><td style="padding:36px 32px;color:#e6e6ea;font-size:16px;line-height:1.65">${inner}</td></tr>
<tr><td style="padding:24px 32px;background:#0f0f12;color:#71717a;font-size:11px;line-height:1.6;text-align:center;border-top:1px solid #2a2a30">
You're receiving this because you used <a href="https://gearuptofit.com/shoe-finder/" style="color:#c4c4cc;text-decoration:underline">RunMatch AI</a>.<br/>
© GearUpToFit · <a href="https://gearuptofit.com/privacy-policy/" style="color:#71717a;text-decoration:underline">Privacy</a> · <a href="{{ unsubscribe }}" style="color:#71717a;text-decoration:underline">Unsubscribe</a>
</td></tr></table></td></tr></table></body></html>`;

const btn = (href: string, label: string) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="background:${BRAND_RED};border-radius:12px"><a href="${href}" style="display:inline-block;padding:16px 36px;color:#fff;text-decoration:none;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;font-size:13px">${label}</a></td></tr></table>`;

const TEMPLATES = [
  {
    name: 'RunMatch · 01 Welcome + Report',
    subject: '🏃 Your personalized RunMatch AI report is ready',
    tag: 'welcome',
    html: wrap('Your top 3 shoes, rotation plan, and PDF report — inside.', `
<h1 style="margin:0 0 16px;font-family:Oswald,Impact,sans-serif;font-size:26px;color:#fff;text-transform:uppercase;letter-spacing:0.04em">Welcome, {{ contact.FIRSTNAME | default : "runner" }} 👋</h1>
<p style="margin:0 0 16px">Your <strong>personalized 3-shoe rotation</strong> is built on the answers you gave: gait, weekly mileage, surfaces, injury history and goals.</p>
<p style="margin:0 0 16px">Inside your report:</p>
<ul style="margin:0 0 16px;padding-left:20px;color:#cfcfd6">
<li><strong>Daily Trainer</strong> — your everyday workhorse</li>
<li><strong>Speed Day</strong> — for tempo, intervals & race day</li>
<li><strong>Long Run</strong> — max cushion for weekend miles</li>
</ul>
<p style="margin:0 0 8px;color:#cfcfd6">Research shows runners who rotate 2–3 shoes have <strong>39% lower injury risk</strong> (Malisoux et al., 2015).</p>
${btn('https://gearuptofit.com/shoe-finder/', 'View My Rotation')}
<p style="margin:24px 0 0;color:#8b8b95;font-size:13px">Tomorrow: how to break in your new shoes the right way.</p>`),
  },
  {
    name: 'RunMatch · 02 Break-In Guide (Day 2)',
    subject: 'Day 2: How to break in your new running shoes 👟',
    tag: 'series-day-2',
    html: wrap('The 5-day break-in protocol elite coaches use.', `
<h1 style="margin:0 0 16px;font-family:Oswald,Impact,sans-serif;font-size:24px;color:#fff;text-transform:uppercase;letter-spacing:0.04em">The 5-Day Break-In Protocol</h1>
<p style="margin:0 0 16px">New shoes feel amazing in the box — but the foam needs <strong>30–50 km</strong> to settle into its true ride character. Skipping break-in is the #1 cause of new-shoe blisters and Achilles flare-ups.</p>
<p style="margin:0 0 8px;color:#fff;font-weight:600">Days 1–2: 20 min walk + 2 km easy jog</p>
<p style="margin:0 0 8px;color:#fff;font-weight:600">Days 3–4: 5 km easy on flat tarmac</p>
<p style="margin:0 0 16px;color:#fff;font-weight:600">Day 5+: Full easy runs, then introduce tempo</p>
${btn('https://gearuptofit.com/running/how-to-break-in-running-shoes/', 'Read the Full Guide')}`),
  },
  {
    name: 'RunMatch · 03 Cadence & Form (Day 4)',
    subject: 'The 180 cadence myth (and what actually matters) 📈',
    tag: 'series-day-4',
    html: wrap('Why your cadence number is less important than your stride.', `
<h1 style="margin:0 0 16px;font-family:Oswald,Impact,sans-serif;font-size:24px;color:#fff;text-transform:uppercase;letter-spacing:0.04em">Cadence: The 180 Myth</h1>
<p style="margin:0 0 16px">You've heard "aim for 180 steps per minute". The truth is more nuanced — your optimal cadence depends on your <strong>height, leg length and pace</strong>.</p>
<p style="margin:0 0 16px">What matters: <strong>increasing your current cadence by 5–10%</strong> reduces overstriding and impact loading at the knee by up to 20% (Heiderscheit et al., 2011).</p>
${btn('https://gearuptofit.com/running/running-cadence-calculator/', 'Calculate My Cadence')}`),
  },
  {
    name: 'RunMatch · 04 Zone 2 Training (Day 7)',
    subject: 'The boring run that makes you faster 🐢',
    tag: 'series-day-7',
    html: wrap('Zone 2 is 80% of elite training. Here\'s how to do it right.', `
<h1 style="margin:0 0 16px;font-family:Oswald,Impact,sans-serif;font-size:24px;color:#fff;text-transform:uppercase;letter-spacing:0.04em">Why Slow Runs Make You Faster</h1>
<p style="margin:0 0 16px">Elite marathoners run <strong>80% of their weekly mileage easy</strong>. Not because they can't go faster — because slow runs build the mitochondrial density that lets them <em>sustain</em> faster paces.</p>
<p style="margin:0 0 16px">The test: in Zone 2 you should be able to hold a full conversation. If you're gasping, you're too fast.</p>
${btn('https://gearuptofit.com/running/zone-2-running-calculator/', 'Find My Zone 2')}`),
  },
  {
    name: 'RunMatch · 05 Injury Prevention (Day 10)',
    subject: 'The 3 strength moves every runner needs 💪',
    tag: 'series-day-10',
    html: wrap('Hip strength is the #1 predictor of running injuries.', `
<h1 style="margin:0 0 16px;font-family:Oswald,Impact,sans-serif;font-size:24px;color:#fff;text-transform:uppercase;letter-spacing:0.04em">3 Moves That Bulletproof Your Run</h1>
<p style="margin:0 0 16px">Weak hips = collapsing knees = IT band, runner's knee, plantar fasciitis. Two 15-min strength sessions per week cuts overuse injury risk by <strong>50%</strong> (Lauersen et al., 2014).</p>
<ol style="margin:0 0 16px;padding-left:22px;color:#cfcfd6">
<li><strong>Single-Leg Glute Bridge</strong> — 3×10 each side</li>
<li><strong>Bulgarian Split Squat</strong> — 3×8 each side</li>
<li><strong>Side Plank with Leg Lift</strong> — 3×10 each side</li>
</ol>
${btn('https://gearuptofit.com/running/strength-training-for-runners/', 'See the Full Routine')}`),
  },
  {
    name: 'RunMatch · 06 Race Day Tips (Day 14)',
    subject: '7 days to race day — your taper checklist 🏁',
    tag: 'series-day-14',
    html: wrap('What to do — and not do — in race week.', `
<h1 style="margin:0 0 16px;font-family:Oswald,Impact,sans-serif;font-size:24px;color:#fff;text-transform:uppercase;letter-spacing:0.04em">Race Week, Done Right</h1>
<p style="margin:0 0 16px">The taper is where races are won — or lost to fresh-leg syndrome. Here's the rule: <strong>cut volume by 40%, keep intensity</strong>.</p>
<p style="margin:0 0 16px">Race-day shoes? Use your <strong>Speed Day</strong> pick from your RunMatch rotation. Never race in a shoe with fewer than 30 km on it.</p>
${btn('https://gearuptofit.com/review/best-running-shoes/', 'Review My Speed Shoe')}`),
  },
  {
    name: 'RunMatch · 07 Re-Match Invitation (Day 21)',
    subject: 'Re-match: has your stride changed? 🔄',
    tag: 'series-day-21',
    html: wrap('Your shoe needs evolve as your training does. Re-take the quiz.', `
<h1 style="margin:0 0 16px;font-family:Oswald,Impact,sans-serif;font-size:24px;color:#fff;text-transform:uppercase;letter-spacing:0.04em">Time for a Re-Match?</h1>
<p style="margin:0 0 16px">As your weekly mileage, race goals, or injury status changes, so should your rotation. Most runners outgrow their picks within <strong>4–6 months</strong>.</p>
<p style="margin:0 0 16px">Take 90 seconds to refresh your RunMatch — and we'll send an updated 3-shoe rotation built on your latest stats.</p>
${btn('https://gearuptofit.com/shoe-finder/', 'Re-Take the Quiz')}`),
  },
];

async function ensureBrevoTemplates(senderId: number) {
  const list = await brevo('/smtp/templates?limit=200');
  const existing = new Map<string, any>();
  for (const t of (list.data?.templates || [])) existing.set(t.name, t);
  const results: any[] = [];
  for (const t of TEMPLATES) {
    if (existing.has(t.name)) {
      results.push({ name: t.name, action: 'exists', id: existing.get(t.name).id });
      continue;
    }
    const r = await brevo('/smtp/templates', {
      method: 'POST',
      body: JSON.stringify({
        sender: { id: senderId },
        templateName: t.name,
        subject: t.subject,
        htmlContent: t.html,
        isActive: true,
        replyTo: 'hello@gearuptofit.com',
        tag: t.tag,
      }),
    });
    results.push({ name: t.name, action: 'created', ok: r.ok, status: r.status, id: r.data?.id, error: r.ok ? undefined : r.raw.slice(0, 200) });
  }
  return results;
}

// ============================================================
// MAIN
// ============================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const report: Record<string, unknown> = {};

  try {
    // ---- 1. Brevo: get DKIM/SPF records ----
    // Trigger authenticate to ensure records are generated
    const auth = await brevo(`/senders/domains/${DOMAIN}/authenticate`, { method: 'PUT' });
    const dom = await brevo(`/senders/domains/${DOMAIN}`);
    report.brevo_domain = dom.data;
    report.brevo_authenticate_trigger = { ok: auth.ok, status: auth.status, body: auth.data };

    // Required Brevo records
    const dnsTargets = [
      { type: 'TXT', name: DOMAIN, content: 'brevo-code:c598c12772e4d891d0c647605487a019', purpose: 'Brevo verification' },
      { type: 'CNAME', name: `brevo1._domainkey.${DOMAIN}`, content: 'b1.gearuptofit-com.dkim.brevo.com', purpose: 'DKIM 1' },
      { type: 'CNAME', name: `brevo2._domainkey.${DOMAIN}`, content: 'b2.gearuptofit-com.dkim.brevo.com', purpose: 'DKIM 2' },
    ];

    // ---- 2a. Cloudflare: dedupe DMARC — delete ALL existing _dmarc records, then add Brevo's preferred merged record ----
    const zone = Deno.env.get('CLOUDFLARE_ZONE_ID');
    const dmarcList = await cf(`/zones/${zone}/dns_records?name=_dmarc.${DOMAIN}&type=TXT`);
    const dmarcDeleted: any[] = [];
    for (const rec of (dmarcList.data?.result || [])) {
      const del = await cf(`/zones/${zone}/dns_records/${rec.id}`, { method: 'DELETE' });
      dmarcDeleted.push({ id: rec.id, content: rec.content, ok: del.ok });
    }
    const dmarcCreate = await cf(`/zones/${zone}/dns_records`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'TXT', name: `_dmarc.${DOMAIN}`,
        content: 'v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com',
        ttl: 1,
      }),
    });
    report.dmarc_cleanup = { deleted: dmarcDeleted, created: { ok: dmarcCreate.ok, error: dmarcCreate.ok ? undefined : dmarcCreate.raw.slice(0, 300) } };

    // ---- 2b. Cloudflare: upsert remaining records ----
    const cfResults: any[] = [];
    for (const t of dnsTargets) {
      const r = await cfUpsertRecord({ type: t.type, name: t.name, content: t.content });
      cfResults.push({ purpose: t.purpose, ...r });
    }
    report.cloudflare_dns = cfResults;

    // ---- 2c. Wait for DNS propagation before re-authenticating ----
    await new Promise(r => setTimeout(r, 15000));

    // ---- 3. Re-trigger Brevo authentication after DNS upsert ----
    const reauth = await brevo(`/senders/domains/${DOMAIN}/authenticate`, { method: 'PUT' });
    report.brevo_reauthenticate = { ok: reauth.ok, status: reauth.status, body: reauth.data };

    // ---- 4. WordPress: clean orphan mailin folder + reinstall ----
    // Delete via plugins endpoint (slug 'mailin/mailin' may not exist; try common variants)
    const delAttempts: any[] = [];
    for (const slug of ['mailin/mailin', 'mailin/mailin.php', 'mailin/index']) {
      const d = await wp(`/wp/v2/plugins/${encodeURIComponent(slug)}`, { method: 'DELETE' });
      delAttempts.push({ slug, status: d.status });
    }
    report.wp_orphan_delete = delAttempts;
    // Reinstall
    const install = await wp('/wp/v2/plugins', {
      method: 'POST',
      body: JSON.stringify({ slug: 'mailin', status: 'active' }),
    });
    report.wp_brevo_install = { ok: install.ok, status: install.status, plugin: install.data?.plugin, error: install.ok ? undefined : install.raw.slice(0, 300) };

    // ---- 5. Brevo: seed 7 marketing email templates ----
    const senders = await brevo('/senders');
    const sender = (senders.data?.senders || []).find((s: any) => s.email?.toLowerCase() === SENDER_EMAIL);
    if (sender?.id) {
      report.brevo_templates = await ensureBrevoTemplates(sender.id);
    } else {
      report.brevo_templates = { error: 'sender not found' };
    }

    return new Response(JSON.stringify(report, null, 2),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ ...report, error: String(err) }, null, 2),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
