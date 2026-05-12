// Finalization: fetch Brevo DNS records for gearuptofit.com + activate WP Brevo plugin folder.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const out: any = {};

  const apiKey = Deno.env.get('BREVO_API_KEY')!;
  const bh = { 'api-key': apiKey, 'accept': 'application/json', 'content-type': 'application/json' };

  // 1. List domains (GET single is not in API, list returns full record set)
  const ld = await fetch('https://api.brevo.com/v3/senders/domains', { headers: bh });
  out.domains_list = await ld.json().catch(() => null);

  // 2. Trigger authentication (this often populates dns_records on the domain object)
  const auth = await fetch('https://api.brevo.com/v3/senders/domains/gearuptofit.com/authenticate', {
    method: 'PUT', headers: bh,
  });
  out.authenticate_status = auth.status;
  out.authenticate_body = await auth.text();

  // 3. Re-list to get updated records
  const ld2 = await fetch('https://api.brevo.com/v3/senders/domains', { headers: bh });
  const ld2Json = await ld2.json().catch(() => null);
  out.gearuptofit_record = (ld2Json?.domains || []).find((d: any) => d.domain_name === 'gearuptofit.com');

  // 4. Re-trigger sender validation (try POST email validation v3 senders/{id}/validate)
  const sList = await fetch('https://api.brevo.com/v3/senders', { headers: bh }).then(r => r.json());
  const sender = (sList.senders || []).find((s: any) => s.email === 'info@gearuptofit.com');
  if (sender) {
    const vr = await fetch(`https://api.brevo.com/v3/senders/${sender.id}/validate`, { method: 'PUT', headers: bh });
    out.sender_validate = { id: sender.id, status: vr.status, body: await vr.text() };
  }

  // 5. WordPress: activate Brevo plugin (folder already exists)
  const wpUser = Deno.env.get('WP_USERNAME')!;
  const wpPass = Deno.env.get('WP_APP_PASSWORD')!.replace(/\s+/g, '');
  const wpAuth = 'Basic ' + btoa(`${wpUser}:${wpPass}`);
  const wpBase = Deno.env.get('WP_SITE_URL')!.replace(/\/$/, '');

  // Common plugin paths to try
  const candidates = ['mailin/mailin.php', 'mailin/sendinblue.php', 'mailin/index.php'];
  let activated: any = null;
  for (const p of candidates) {
    const r = await fetch(`${wpBase}/wp-json/wp/v2/plugins/${encodeURIComponent(p)}`, {
      method: 'POST',
      headers: { Authorization: wpAuth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    const t = await r.text();
    if (r.ok) { activated = { path: p, status: r.status }; break; }
    activated = { path: p, status: r.status, body: t.slice(0, 200) };
  }
  out.wp_brevo_activate = activated;

  // List all plugins to find the actual brevo plugin path
  const pl = await fetch(`${wpBase}/wp-json/wp/v2/plugins`, { headers: { Authorization: wpAuth } });
  const plJson = await pl.json().catch(() => []);
  out.wp_all_brevo_like = (Array.isArray(plJson) ? plJson : []).filter((p: any) =>
    /brevo|sendinblue|mailin/i.test(p.plugin + ' ' + (p.name || ''))
  );

  return new Response(JSON.stringify(out, null, 2), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
