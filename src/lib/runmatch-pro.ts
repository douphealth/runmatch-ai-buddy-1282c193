import jsPDF from 'jspdf';
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

function newPurchaseToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  throw new Error('This browser cannot create a secure purchase token. Please update your browser.');
}

export function getPurchaseToken(): string {
  const existing = localStorage.getItem(TOKEN_KEY);
  if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) {
    return existing;
  }
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

export async function startRunMatchProCheckout(resultSlug?: string): Promise<void> {
  const returnUrl = new URL(window.location.href);
  returnUrl.searchParams.delete('checkout');
  returnUrl.searchParams.delete('session_id');

  const { data, error } = await supabase.functions.invoke('stripe-create-checkout', {
    body: {
      purchaseToken: getPurchaseToken(),
      resultSlug,
      returnUrl: returnUrl.toString(),
    },
  });

  if (error || !(data as any)?.url) {
    throw new Error(getFunctionError(data, error?.message || 'Unable to start secure checkout'));
  }
  window.location.assign((data as any).url);
}

export async function verifyRunMatchPro(sessionId?: string | null): Promise<RunMatchProEntitlement> {
  const { data, error } = await supabase.functions.invoke('stripe-verify-session', {
    body: { purchaseToken: getPurchaseToken(), sessionId: sessionId || undefined },
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

function wrap(doc: jsPDF, text: string, width = 178): string[] {
  return doc.splitTextToSize(text, width) as string[];
}

function pageHeader(doc: jsPDF, title: string, page: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('GEAR UP TO FIT · RUNMATCH PRO', 16, 12);
  doc.setFontSize(18);
  doc.text(title, 16, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Personalized decision pack · Page ${page}`, 16, 30);
  doc.line(16, 34, 194, 34);
}

export function downloadRunMatchProPack(params: {
  slug: string;
  distance: string;
  terrain: string;
  weeklyMileage: number;
  pronation: string;
  footType: string;
  topShoes: ProShoe[];
  rotation: { primary?: ProShoe | null; speed?: ProShoe | null; longRun?: ProShoe | null } | null;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  pageHeader(doc, 'Advanced Shoe Decision Matrix', 1);
  let y = 44;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Runner profile', 16, y);
  y += 7;

  const profile = [
    ['Distance', params.distance.replace(/-/g, ' ')],
    ['Terrain', params.terrain],
    ['Weekly mileage', `${params.weeklyMileage} km/week`],
    ['Foot type', params.footType],
    ['Pronation', params.pronation],
  ];

  doc.setFontSize(8);
  for (const [label, value] of profile) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, 16, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), 54, y);
    y += 5.5;
  }

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Top 5 ranked matches', 16, y);
  y += 7;

  params.topShoes.slice(0, 5).forEach((entry, index) => {
    const shoe = entry.shoe;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`#${index + 1}  ${shoe.brand} ${shoe.model} — ${entry.matchPercent}% match`, 16, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const specs = wrap(doc, `Role: ${shoe.category} · Cushioning: ${shoe.cushioning}/10 · Drop: ${shoe.dropMM} mm · Weight: ${shoe.weightGrams} g · Reference MSRP: $${shoe.priceUSD}`);
    doc.text(specs, 16, y);
    y += specs.length * 4;
    const reasons = wrap(doc, entry.reasons.length ? entry.reasons.slice(0, 3).join(' • ') : 'High overall fit across the weighted RunMatch factors.');
    doc.text(reasons, 16, y);
    y += reasons.length * 4 + 5;
  });

  doc.addPage();
  pageHeader(doc, 'Rotation & Trade-Offs', 2);
  y = 44;

  const roles: Array<[string, ProShoe | null | undefined]> = [
    ['Daily trainer', params.rotation?.primary],
    ['Speed / quality', params.rotation?.speed],
    ['Long run', params.rotation?.longRun],
  ];

  for (const [role, entry] of roles) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(role, 16, y);
    y += 6;

    if (!entry) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Not required by this profile. Do not buy an extra shoe just to fill a rotation slot.', 16, y);
      y += 11;
      continue;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${entry.shoe.brand} ${entry.shoe.model} · ${entry.matchPercent}% match`, 16, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const lines = wrap(doc, entry.reasons.length ? entry.reasons.join(' • ') : 'Selected from the weighted RunMatch scoring model.');
    doc.text(lines, 16, y);
    y += lines.length * 4 + 8;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Decision rules', 16, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  const rules = [
    'Prefer immediate comfort and secure fit over a small difference in match score.',
    'If two shoes score similarly, choose the one that fits your real foot width and heel shape better.',
    'Do not change footwear solely to address pain or injury; persistent symptoms warrant qualified clinical advice.',
    'Verify current retailer pricing before purchase; database prices are reference data and can change.',
    'A rotation is optional. Add a second or third shoe only when it serves a distinct training purpose.',
  ];

  for (const rule of rules) {
    const lines = wrap(doc, `• ${rule}`, 174);
    doc.text(lines, 18, y);
    y += lines.length * 4 + 2;
  }

  doc.addPage();
  pageHeader(doc, 'Store Try-On Checklist', 3);
  y = 44;

  const checklist = [
    'Try shoes late in the day or after an easy run when feet are slightly expanded.',
    'Use the socks and orthotics you normally run in.',
    'Aim for roughly a thumb-width of room in front of the longest toe.',
    'Confirm the heel is secure without Achilles pressure or rubbing.',
    'Confirm the midfoot is held without numbness, tingling, or lace pressure.',
    'Walk, jog, corner, and perform a few short accelerations if permitted.',
    'Compare the top two RunMatch options back-to-back rather than in isolation.',
    'Reject forefoot pinching; do not rely on a shoe “breaking in.”',
    'For trails, verify grip and lockdown. For roads, prioritize smooth transition and comfort.',
    'Check the retailer return policy before using a new pair outdoors.',
  ];

  doc.setFontSize(9);
  checklist.forEach((item, index) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${index + 1}.`, 16, y);
    doc.setFont('helvetica', 'normal');
    const lines = wrap(doc, item, 168);
    doc.text(lines, 24, y);
    y += Math.max(7, lines.length * 4 + 3);
  });

  y += 5;
  doc.setFontSize(7);
  doc.text(
    wrap(doc, 'RunMatch Pro is footwear decision support, not medical advice. Product specifications and prices can change; verify current details before purchase.'),
    16,
    y,
  );

  doc.save(`GearUpToFit-RunMatch-Pro-${params.slug}.pdf`);
}
