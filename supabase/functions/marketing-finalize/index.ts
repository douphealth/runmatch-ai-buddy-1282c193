// Recreate sender to trigger a fresh activation email + final auth attempt.
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

  // Find existing sender
  const sList = await fetch('https://api.brevo.com/v3/senders', { headers: bh }).then(r => r.json());
  const sender = (sList.senders || []).find((s: any) => s.email === 'info@gearuptofit.com');

  // Delete if exists and not active — to allow re-creation which sends a fresh activation email
  if (sender && !sender.active) {
    const del = await fetch(`https://api.brevo.com/v3/senders/${sender.id}`, { method: 'DELETE', headers: bh });
    out.delete_old = { status: del.status };
  }

  // Re-create — Brevo automatically sends activation email to the address
  const cr = await fetch('https://api.brevo.com/v3/senders', {
    method: 'POST', headers: bh,
    body: JSON.stringify({ name: 'GearUpToFit · RunMatch AI', email: 'info@gearuptofit.com' }),
  });
  out.create_new = { status: cr.status, body: await cr.text() };

  // Try authenticate domain again now that DKIM/DMARC are live
  const auth = await fetch('https://api.brevo.com/v3/senders/domains/gearuptofit.com/authenticate', {
    method: 'PUT', headers: bh,
  });
  out.authenticate = { status: auth.status, body: await auth.text() };

  return new Response(JSON.stringify(out, null, 2), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
