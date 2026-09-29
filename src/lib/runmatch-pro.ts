import { supabase } from '@/integrations/supabase/client';

const TOKEN_KEY = 'runmatch_pro_purchase_token_v1';

export type RunMatchProProduct = {
  name: string;
  description: string;
  priceLabel: string | null;
  currency: string | null;
  amount: number | null;
  mode: 'payment' | 'subscription';
  interval: string | null;
};

export type RunMatchProEntitlement = {
  active: boolean;
  status: string;
  mode: 'payment' | 'subscription' | null;
  currentPeriodEnd: string | null;
  verifiedVia?: 'stripe' | 'database';
};

function newPurchaseToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  throw new Error('This browser cannot create a secure purchase token. Please update your browser.');
}

export function getPurchaseToken(): string {
  const existing = localStorage.getItem(TOKEN_KEY);
  if (existing) return existing;
  const token = newPurchaseToken();
  localStorage.setItem(TOKEN_KEY, token);
  return token;
}

function getFunctionError(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'error' in data && typeof (data as any).error === 'string') {
    return (data as any).error;
  }
  return fallback;
}

export async function getRunMatchProProduct(): Promise<RunMatchProProduct | null> {
  const { data, error } = await supabase.functions.invoke('stripe-product', { body: {} });
  if (error || !(data as any)?.configured || !(data as any)?.product) return null;
  return (data as any).product as RunMatchProProduct;
}

export async function startRunMatchProCheckout(resultSlug?: string): Promise<never> {
  const purchaseToken = getPurchaseToken();
  const returnUrl = window.location.href;
  const { data, error } = await supabase.functions.invoke('stripe-create-checkout', {
    body: { purchaseToken, resultSlug, returnUrl },
  });
  if (error || !(data as any)?.url) {
    throw new Error(getFunctionError(data, error?.message || 'Unable to start secure checkout'));
  }
  window.location.assign((data as any).url);
  throw new Error('Redirecting to checkout');
}

export async function verifyRunMatchPro(sessionId?: string | null): Promise<RunMatchProEntitlement> {
  const purchaseToken = getPurchaseToken();
  const { data, error } = await supabase.functions.invoke('stripe-verify-session', {
    body: { purchaseToken, sessionId: sessionId || undefined },
  });
  if (error) throw new Error(getFunctionError(data, error.message || 'Unable to verify purchase'));
  return data as RunMatchProEntitlement;
}

export function cleanupCheckoutParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.delete('checkout');
  next.delete('session_id');
  return next;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

type ProShoe = {
  shoe: {
    brand: string;
    model: string;
    category: string;
    cushioning: number;
    dropMM: number;
    weightGrams: number;
    priceUSD: number;
  };
  matchPercent: number;
  reasons: string[];
};

export function downloadRunMatchProPack(params: {
  slug: string;
  distance: string;
  terrain: string;
  weeklyMileage: number;
  pronation: string;
  footType: string;
  topShoes: ProShoe[];
  rotation: { primary?: ProShoe; speed?: ProShoe; longRun?: ProShoe } | null;
}) {
  const rows = params.topShoes.map((entry, index) => `
    <tr>
      <td>#${index + 1}</td>
      <td><strong>${escapeHtml(entry.shoe.brand)} ${escapeHtml(entry.shoe.model)}</strong></td>
      <td>${escapeHtml(entry.shoe.category)}</td>
      <td>${entry.matchPercent}%</td>
      <td>${entry.shoe.cushioning}/10</td>
      <td>${entry.shoe.dropMM} mm</td>
      <td>${entry.shoe.weightGrams} g</td>
      <td>$${entry.shoe.priceUSD}</td>
    </tr>`).join('');

  const rotation = [
    ['Daily trainer', params.rotation?.primary],
    ['Speed / quality', params.rotation?.speed],
    ['Long run', params.rotation?.longRun],
  ].filter(([, entry]) => Boolean(entry)).map(([role, entry]) => {
    const shoe = (entry as ProShoe).shoe;
    return `<li><strong>${escapeHtml(role)}:</strong> ${escapeHtml(shoe.brand)} ${escapeHtml(shoe.model)}</li>`;
  }).join('');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RunMatch Pro Decision Pack</title>
<style>
body{font-family:Arial,sans-serif;max-width:980px;margin:40px auto;padding:0 24px;color:#171717;line-height:1.55}
h1{font-size:32px;margin-bottom:4px}h2{margin-top:34px}.muted{color:#666}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.card{border:1px solid #ddd;border-radius:12px;padding:14px}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{border-bottom:1px solid #ddd;padding:9px;text-align:left}
.checklist li{margin:8px 0}.notice{background:#fff4f4;border-left:4px solid #c81e1e;padding:12px 16px}
@media(max-width:700px){.grid{grid-template-columns:1fr}table{display:block;overflow-x:auto}}
@media print{body{margin:0;max-width:none}.no-print{display:none}}
</style>
</head>
<body>
<p class="muted">GearUpToFit · RunMatch Pro</p>
<h1>Running Shoe Decision Pack</h1>
<p class="muted">Result: ${escapeHtml(params.slug)}</p>

<div class="grid">
  <div class="card"><strong>Distance</strong><br>${escapeHtml(params.distance)}</div>
  <div class="card"><strong>Terrain</strong><br>${escapeHtml(params.terrain)}</div>
  <div class="card"><strong>Weekly mileage</strong><br>${params.weeklyMileage} km/week</div>
  <div class="card"><strong>Foot profile</strong><br>${escapeHtml(params.footType)} · ${escapeHtml(params.pronation)}</div>
</div>

<h2>Top 5 decision matrix</h2>
<table>
<thead><tr><th>Rank</th><th>Shoe</th><th>Role</th><th>Match</th><th>Cushion</th><th>Drop</th><th>Weight</th><th>MSRP</th></tr></thead>
<tbody>${rows}</tbody>
</table>

<h2>Recommended rotation</h2>
<ul>${rotation}</ul>

<h2>In-store / at-home try-on protocol</h2>
<ol class="checklist">
<li>Try shoes late in the day or after a short easy run when feet are slightly expanded.</li>
<li>Keep roughly a thumb-width of space in front of the longest toe.</li>
<li>Walk, jog, corner, and do several short accelerations. Reject heel slip, pressure points, or numbness.</li>
<li>Compare the top two shoes back-to-back instead of evaluating each in isolation.</li>
<li>Do not buy a shoe because the match score is high if the real fit feels wrong.</li>
<li>Re-check fit with the socks and orthotics you actually use.</li>
</ol>

<h2>Decision rule</h2>
<div class="notice">
Choose the highest-ranked shoe that also feels immediately comfortable and secure. If two options feel equally good,
prefer the one that better matches your primary training role and budget. This report is educational and is not medical advice.
</div>

<p class="muted">Generated ${new Date().toLocaleString()} · gearuptofit.com</p>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `RunMatch-Pro-${params.slug}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
