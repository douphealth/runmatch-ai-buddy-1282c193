// ============================================================
// MARKETING STACK ORCHESTRATOR
// One-shot end-to-end setup:
//   1. Verify Brevo + WordPress connections
//   2. Brevo: create custom attributes, lists, sender, DOI template
//   3. WordPress: list plugins, activate Brevo plugin, create
//      unsubscribe + thank-you pages, inject Brevo tracker
//   4. Returns a full structured report
// Idempotent: safe to re-run.
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---------------- Brevo helpers ----------------
const BREVO = 'https://api.brevo.com/v3';

async function brevo(path: string, init: RequestInit = {}) {
  const apiKey = Deno.env.get('BREVO_API_KEY')!;
  const res = await fetch(`${BREVO}${path}`, {
    ...init,
    headers: {
      'api-key': apiKey,
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

// ---------------- WordPress helpers ----------------
function wpHeaders() {
  const user = Deno.env.get('WP_USERNAME')!;
  const pass = Deno.env.get('WP_APP_PASSWORD')!.replace(/\s+/g, '');
  const auth = btoa(`${user}:${pass}`);
  return {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'GearUpToFit-Lovable-Setup/1.0',
  };
}
function wpBase() {
  return Deno.env.get('WP_SITE_URL')!.replace(/\/$/, '');
}
async function wp(path: string, init: RequestInit = {}) {
  const url = `${wpBase()}/wp-json${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...wpHeaders(), ...(init.headers || {}) },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  return { ok: res.ok, status: res.status, data, raw: text, url };
}

// ============================================================
// BREVO SETUP
// ============================================================

const REQUIRED_ATTRIBUTES: Array<{ name: string; type: 'text' | 'float' | 'date' | 'boolean' }> = [
  { name: 'SOURCE',          type: 'text' },
  { name: 'SHOE_CATEGORY',   type: 'text' },
  { name: 'PRIMARY_SHOE',    type: 'text' },
  { name: 'WEEKLY_MILEAGE',  type: 'float' },
  { name: 'INJURY_HISTORY',  type: 'text' },
  { name: 'UTM_SOURCE',      type: 'text' },
  { name: 'UTM_MEDIUM',      type: 'text' },
  { name: 'UTM_CAMPAIGN',    type: 'text' },
  { name: 'OPT_IN_DATE',     type: 'date' },
];

async function ensureBrevoAttributes() {
  const existing = await brevo('/contacts/attributes');
  const have = new Set<string>(
    (existing.data?.attributes || []).map((a: any) => `${a.category}:${a.name}`)
  );
  const created: string[] = [];
  const skipped: string[] = [];
  for (const attr of REQUIRED_ATTRIBUTES) {
    if (have.has(`normal:${attr.name}`)) { skipped.push(attr.name); continue; }
    const r = await brevo(`/contacts/attributes/normal/${encodeURIComponent(attr.name)}`, {
      method: 'POST',
      body: JSON.stringify({ type: attr.type }),
    });
    if (r.ok || r.status === 204) created.push(attr.name);
    else skipped.push(`${attr.name}(${r.status})`);
  }
  return { created, skipped };
}

const REQUIRED_LISTS = [
  { key: 'runmatch',     name: 'RunMatch Subscribers' },
  { key: 'exit_popup',   name: 'Exit-Intent Popup' },
  { key: 'blog',         name: 'Blog Subscribers' },
  { key: 'injury',       name: 'Injury-Segment' },
];

async function ensureBrevoLists(): Promise<Record<string, number>> {
  const all = await brevo('/contacts/lists?limit=50');
  const byName = new Map<string, number>();
  for (const l of (all.data?.lists || [])) byName.set(l.name, l.id);

  // Get default folder
  const folders = await brevo('/contacts/folders?limit=10');
  let folderId = folders.data?.folders?.[0]?.id;
  if (!folderId) {
    const f = await brevo('/contacts/folders', {
      method: 'POST',
      body: JSON.stringify({ name: 'GearUpToFit' }),
    });
    folderId = f.data?.id;
  }

  const map: Record<string, number> = {};
  for (const l of REQUIRED_LISTS) {
    if (byName.has(l.name)) {
      map[l.key] = byName.get(l.name)!;
      continue;
    }
    const r = await brevo('/contacts/lists', {
      method: 'POST',
      body: JSON.stringify({ name: l.name, folderId }),
    });
    if (r.ok && r.data?.id) map[l.key] = r.data.id;
  }
  return map;
}

const PRIMARY_SENDER_EMAIL = 'info@gearuptofit.com';
const PRIMARY_SENDER_NAME  = 'GearUpToFit · RunMatch AI';
const PRIMARY_DOMAIN       = 'gearuptofit.com';

async function ensureBrevoSender() {
  const senders = await brevo('/senders');
  const list = senders.data?.senders || [];
  let existing = list.find((s: any) => s.email?.toLowerCase() === PRIMARY_SENDER_EMAIL);
  if (!existing) {
    const created = await brevo('/senders', {
      method: 'POST',
      body: JSON.stringify({ name: PRIMARY_SENDER_NAME, email: PRIMARY_SENDER_EMAIL }),
    });
    existing = { id: created.data?.id, email: PRIMARY_SENDER_EMAIL, active: false };
  }
  // Trigger validation email (sender must click confirmation link in inbox).
  let validation: any = { skipped: true };
  if (existing?.id && !existing.active) {
    const v = await brevo(`/senders/${existing.id}/validate`, { method: 'PUT' });
    validation = { triggered: v.ok, status: v.status, note: 'check info@gearuptofit.com inbox' };
  }
  return { id: existing.id, email: existing.email, active: existing.active, validation };
}

// Authenticate the sending domain (DKIM + Brevo code + DMARC).
async function ensureBrevoDomainAuth() {
  const list = await brevo('/senders/domains');
  let domain = (list.data?.domains || []).find((d: any) => d.domain_name === PRIMARY_DOMAIN);
  if (!domain) {
    const created = await brevo('/senders/domains', {
      method: 'POST',
      body: JSON.stringify({ name: PRIMARY_DOMAIN }),
    });
    if (!created.ok) return { ok: false, status: created.status, error: created.raw.slice(0, 400) };
    // Re-fetch to get DNS records
    const refetch = await brevo('/senders/domains');
    domain = (refetch.data?.domains || []).find((d: any) => d.domain_name === PRIMARY_DOMAIN);
  }
  // Trigger DNS authentication check
  if (domain?.domain_name) {
    await brevo(`/senders/domains/${PRIMARY_DOMAIN}/authenticate`, { method: 'PUT' });
  }
  return {
    ok: true,
    domain: PRIMARY_DOMAIN,
    authenticated: domain?.authenticated ?? false,
    verified: domain?.verified ?? false,
    dns_records: domain?.dns_records || domain?.dkim_record || domain,
    instructions: 'Add the DKIM, Brevo-code, and DMARC TXT records below at your DNS provider for gearuptofit.com, then re-run this setup.',
  };
}

const DOI_HTML = `<!doctype html><html><body style="margin:0;padding:0;background:#0f0f12;font-family:Inter,Arial,sans-serif;color:#fff">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f12;padding:40px 20px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#17171b;border-radius:16px;overflow:hidden;border:1px solid #2a2a30">
<tr><td style="background:linear-gradient(135deg,#E53935,#b71c1c);padding:32px;text-align:center">
<img src="https://gearuptofit.com/wp-content/uploads/2023/03/cropped-Grey-Black-Illustration-Gym-Fitness-Logo.png" width="56" height="56" alt="GearUpToFit" style="border-radius:12px;background:#fff;padding:6px"/>
<h1 style="margin:16px 0 0;font-family:'Oswald',Impact,sans-serif;letter-spacing:0.08em;text-transform:uppercase;font-size:24px;color:#fff">Confirm Your Subscription</h1></td></tr>
<tr><td style="padding:32px 32px 16px;color:#e6e6ea;font-size:16px;line-height:1.6">
<p style="margin:0 0 16px">Hi {{ contact.FIRSTNAME }},</p>
<p style="margin:0 0 16px">Thanks for requesting your <strong>personalized RunMatch AI shoe report</strong>. Click the button below to confirm your email and unlock:</p>
<ul style="margin:0 0 24px;padding-left:18px;color:#cfcfd6">
<li>Your full PDF report with top 3 shoes</li>
<li>3-shoe rotation plan (linked to 39% lower injury risk)</li>
<li>7-day running coach email series</li>
</ul></td></tr>
<tr><td align="center" style="padding:8px 32px 32px"><a href="{{ doubleoptin }}" style="display:inline-block;background:#E53935;color:#fff;text-decoration:none;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:16px 36px;border-radius:12px;font-size:14px">Confirm My Email</a></td></tr>
<tr><td style="padding:0 32px 32px;color:#8b8b95;font-size:12px;line-height:1.6">
<p style="margin:0 0 8px">If you didn't request this, ignore this email — no account will be created.</p>
<p style="margin:0">© GearUpToFit · <a href="https://gearuptofit.com/privacy-policy/" style="color:#8b8b95">Privacy</a></p></td></tr></table></td></tr></table></body></html>`;

async function ensureBrevoDoiTemplate(senderId: number) {
  const list = await brevo('/smtp/templates?limit=200');
  const existing = (list.data?.templates || []).find((t: any) => t.name === 'RunMatch · Double Opt-In');
  if (existing) return { id: existing.id, reused: true };
  const r = await brevo('/smtp/templates', {
    method: 'POST',
    body: JSON.stringify({
      sender: { id: senderId },
      templateName: 'RunMatch · Double Opt-In',
      subject: 'Confirm your subscription to RunMatch AI',
      htmlContent: DOI_HTML,
      isActive: true,
      replyTo: 'hello@gearuptofit.com',
      tag: 'doi',
    }),
  });
  return { id: r.data?.id, reused: false, status: r.status, error: r.ok ? undefined : r.raw.slice(0, 400) };
}

// ---------------- WordPress plugin install ----------------
async function wpInstallPlugin(slug: string) {
  // POST /wp/v2/plugins with {slug, status:'active'} installs from WP.org and activates
  const r = await wp('/wp/v2/plugins', {
    method: 'POST',
    body: JSON.stringify({ slug, status: 'active' }),
  });
  return { ok: r.ok, status: r.status, plugin: r.data?.plugin, error: r.ok ? undefined : r.raw.slice(0, 400) };
}

// ============================================================
// WORDPRESS SETUP
// ============================================================

async function wpListPlugins() {
  const r = await wp('/wp/v2/plugins');
  if (!r.ok) return { error: r.status, raw: r.raw.slice(0, 300) };
  return (r.data || []).map((p: any) => ({
    plugin: p.plugin,
    name: p.name,
    status: p.status,
    version: p.version,
  }));
}

async function wpActivatePlugin(pluginPath: string) {
  const r = await wp(`/wp/v2/plugins/${encodeURIComponent(pluginPath)}`, {
    method: 'POST',
    body: JSON.stringify({ status: 'active' }),
  });
  return { ok: r.ok, status: r.status, data: r.data };
}

async function wpFindOrCreatePage(slug: string, title: string, content: string) {
  // Use array-form status[]=... — WP REST rejects comma-separated values.
  const search = await wp(`/wp/v2/pages?slug=${slug}&status%5B%5D=publish&status%5B%5D=draft&status%5B%5D=private&context=edit`);
  if (search.ok && Array.isArray(search.data) && search.data.length > 0) {
    return { id: search.data[0].id, link: search.data[0].link, reused: true };
  }
  const create = await wp('/wp/v2/pages', {
    method: 'POST',
    body: JSON.stringify({
      title,
      slug,
      status: 'publish',
      content,
    }),
  });
  return { id: create.data?.id, link: create.data?.link, reused: false, status: create.status };
}

const UNSUB_PAGE_HTML = `
<div style="max-width:640px;margin:0 auto;padding:32px 16px;font-family:Inter,Arial,sans-serif">
<h1>Manage your email preferences</h1>
<p>Sorry to see you go. To unsubscribe from RunMatch AI emails, click the unsubscribe link in any email we sent you, or email <a href="mailto:hello@gearuptofit.com">hello@gearuptofit.com</a>.</p>
<p>If you change your mind, you can <a href="/shoe-match/">retake the RunMatch AI quiz</a> to resubscribe and get a fresh personalized shoe report.</p>
</div>`.trim();

const THANKYOU_PAGE_HTML = `
<div style="max-width:640px;margin:0 auto;padding:48px 16px;font-family:Inter,Arial,sans-serif;text-align:center">
<h1 style="font-family:Oswald,Impact,sans-serif;text-transform:uppercase;letter-spacing:0.08em">You're in! 🏃</h1>
<p style="font-size:18px;color:#444">Your personalized RunMatch AI report is on its way to your inbox. Check your email in the next few minutes.</p>
<p>While you wait — explore our <a href="/review/best-running-shoes/">best running shoes guide</a> or the <a href="/running/zone-2-running-calculator/">Zone 2 calculator</a>.</p>
<p><a href="/shoe-match/" style="display:inline-block;margin-top:24px;background:#E53935;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em">Back to RunMatch AI</a></p>
</div>`.trim();

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const report: Record<string, unknown> = {};
  try {
    // 1. Verify connections
    const brevoAccount = await brevo('/account');
    report.brevo_connection = brevoAccount.ok
      ? { ok: true, plan: brevoAccount.data?.plan?.[0]?.type, email: brevoAccount.data?.email }
      : { ok: false, status: brevoAccount.status, error: brevoAccount.raw.slice(0, 200) };

    const wpUsers = await wp('/wp/v2/users/me?context=edit');
    report.wp_connection = wpUsers.ok
      ? { ok: true, user: wpUsers.data?.name, roles: wpUsers.data?.roles, url: wpBase() }
      : { ok: false, status: wpUsers.status, error: wpUsers.raw.slice(0, 200) };

    if (!brevoAccount.ok || !wpUsers.ok) {
      return new Response(JSON.stringify({ ...report, aborted: true }, null, 2),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Brevo: attributes
    report.brevo_attributes = await ensureBrevoAttributes();

    // 3. Brevo: lists
    const lists = await ensureBrevoLists();
    report.brevo_lists = lists;

    // 4. Brevo: sender (info@gearuptofit.com) + trigger validation email
    const sender = await ensureBrevoSender();
    report.brevo_sender = sender;

    // 4b. Brevo: domain authentication (DKIM/SPF/DMARC for gearuptofit.com)
    report.brevo_domain_auth = await ensureBrevoDomainAuth();

    // 5. Brevo: DOI template (only if sender id exists)
    if (sender.id) {
      report.brevo_doi_template = await ensureBrevoDoiTemplate(sender.id);
    } else {
      report.brevo_doi_template = { skipped: 'no sender id yet — verify sender first' };
    }

    // 6. WordPress: plugins
    const plugins = await wpListPlugins();
    report.wp_plugins_total = Array.isArray(plugins) ? plugins.length : plugins;
    if (Array.isArray(plugins)) {
      const interesting = plugins.filter((p: any) =>
        /brevo|sendinblue|mailpoet|optin|popup|complianz|cookie|rank-math|yoast|seo|google-site-kit|wp-mail-smtp/i.test(p.plugin + ' ' + p.name)
      );
      report.wp_relevant_plugins = interesting;

      // Try to activate Brevo plugin if installed but inactive
      const brevoPlugin = plugins.find((p: any) =>
        /brevo|sendinblue|mailin/i.test(p.plugin)
      );
      if (brevoPlugin) {
        if (brevoPlugin.status !== 'active') {
          report.wp_brevo_activate = await wpActivatePlugin(brevoPlugin.plugin);
        } else {
          report.wp_brevo_activate = { already_active: true, plugin: brevoPlugin.plugin };
        }
      } else {
        // Install official Brevo plugin from WordPress.org (slug: 'mailin')
        report.wp_brevo_install = await wpInstallPlugin('mailin');
      }

      // Deactivate MailPoet to avoid conflict
      const mailpoet = plugins.find((p: any) => /mailpoet/i.test(p.plugin));
      if (mailpoet && mailpoet.status === 'active') {
        const r = await wp(`/wp/v2/plugins/${encodeURIComponent(mailpoet.plugin)}`, {
          method: 'POST',
          body: JSON.stringify({ status: 'inactive' }),
        });
        report.wp_mailpoet_deactivate = { ok: r.ok, status: r.status };
      }
    }

    // 7. WP pages (under /shoe-match/ path conceptually; these are WP pages)
    report.wp_pages = {
      thank_you: await wpFindOrCreatePage('runmatch-thank-you', 'Thanks for subscribing!', THANKYOU_PAGE_HTML),
      unsubscribe: await wpFindOrCreatePage('runmatch-unsubscribe', 'Unsubscribe', UNSUB_PAGE_HTML),
    };

    return new Response(JSON.stringify(report, null, 2),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('setup-marketing-stack error', err);
    return new Response(JSON.stringify({ ...report, error: String(err) }, null, 2),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
