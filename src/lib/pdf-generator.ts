/**
 * RunMatch personal report (PDF).
 *
 * Built with jsPDF on a small layout engine so every page has the same grid,
 * type scale and margins, text can never run off a card, and content flows to a
 * new page instead of being clipped.
 *
 * What the report contains:
 *   1  Cover + runner profile + result (+ a safety box when pain was reported)
 *   -  #1 match: real photo, specs, why it scored, what to watch out for, buy button
 *   -  Rotation: one card per shoe (daily / speed / long run) with photo and buttons
 *   -  Top 5 side by side with thumbnails and a buy button on every row
 *   -  Fit and try-on guide, runner-profile radar, training emphasis, shoe lifespan
 *   -  Reading list, how the scoring works, disclosures, link to the live result
 *
 * Accuracy rules (these are deliberate, do not "simplify" them away):
 *   - A "BUY ON AMAZON" button exists only when scripts/audit-asin-cache.mjs has a
 *     verified listing for that exact shoe. Otherwise the shoe gets a precise
 *     fallback (its GearUpToFit review, or the brand's own site), never a guess.
 *   - A photo is embedded only when it is known to show that exact model: our own
 *     verified photo, else the photo on the verified Amazon listing (resolveShoePhoto);
 *     otherwise a clearly labelled placeholder is drawn.
 *   - Women's-only Amazon listings are labelled as such on the button.
 *   - Only characters in the PDF standard font encoding are written.
 */
import jsPDF from 'jspdf';
import { encodeAnswers, generateSlug, type QuizAnswers } from './quiz-data';
import type { ShoeRecommendation } from './recommendation-engine';
import {
  FACTOR_LABELS,
  INJURY_RACE_PENALTY,
  INJURY_SPEED_PENALTY,
  PREVIOUS_GENERATION_PENALTY,
  SCORING_FAMILIARITY_WEIGHT,
  SCORING_WEIGHTS,
  scoreShoes,
  type ScoredShoe,
} from './scoring-engine';
import { getInjuryArticles, getKitLinks, getRecommendedArticles, getToolLinks } from './article-links';
import { shoeImageSlug } from './shoe-images';
import { resolveShoePhoto } from './amazon-images';
import { assetPath } from './asset-path';
import { REPLACEMENT_STATEMENT, ROTATION_STATEMENT, ROTATION_STATEMENT_SHORT } from './evidence';
import { getAmazonLinkForShoe, getAmazonListingNote } from './amazon-link';
import { getBrandBuyLink } from './shoe-sources';
import { getPriceTier, SHOE_DATABASE_LAST_UPDATED_LABEL } from './price-tier';
import { getSafetyNotice, INJURY_LABELS } from './safety';
import { getFitPriorities } from './fit-priorities';
import { APP_ORIGIN, SITE_ORIGIN } from './site-config';
import { describeRunnerProfile } from './seo';
import { shoeDatabase, type Shoe } from './shoe-database';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PDFData {
  answers: QuizAnswers;
  recommendation: ShoeRecommendation;
  rotation: {
    primary: ScoredShoe;
    speed?: ScoredShoe | null;
    longRun?: ScoredShoe | null;
  };
  radarData: { axis: string; value: number }[];
  /** Top matches, best first. Computed from the answers when omitted. */
  topShoes?: ScoredShoe[];
  slug?: string;
}

export interface BuildOptions {
  /** Compress content streams (smaller file). Tests turn this off to read the text. */
  compress?: boolean;
  /** Override how a photo is fetched (tests read from disk). */
  fetchImage?: (url: string) => Promise<Blob | null>;
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

type RGB = readonly [number, number, number];

const C = {
  red: [201, 32, 38] as RGB,
  redDark: [160, 22, 28] as RGB,
  redSoft: [253, 237, 237] as RGB,
  ink: [22, 25, 32] as RGB,
  band: [17, 20, 26] as RGB,
  text: [45, 50, 60] as RGB,
  muted: [110, 116, 128] as RGB,
  faint: [150, 156, 168] as RGB,
  line: [224, 227, 233] as RGB,
  panel: [246, 247, 250] as RGB,
  white: [255, 255, 255] as RGB,
  green: [22, 138, 84] as RGB,
  greenSoft: [232, 247, 240] as RGB,
  amber: [176, 112, 8] as RGB,
  amberSoft: [255, 246, 226] as RGB,
  blue: [31, 94, 190] as RGB,
  blueSoft: [233, 241, 253] as RGB,
  purple: [104, 64, 176] as RGB,
  purpleSoft: [243, 238, 252] as RGB,
};

const PW = 210;
const PH = 297;
const M = 14; // side margin
const CW = PW - M * 2; // content width = 182
const TOP = 22; // first content y on pages after the cover
const FOOT = 17; // footer block height
const BOTTOM = PH - FOOT - 3; // last usable y
const PT = 0.3528; // 1 pt in mm
const BUL = '\u2022';

/** First sentence of a note, so a clipped line never ends mid-thought. */
const firstSentence = (s?: string): string | undefined => (s ? (s.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? s) : undefined);

interface Img {
  data: string;
  format: 'JPEG' | 'PNG';
}

// ---------------------------------------------------------------------------
// Text safety (standard PDF fonts only cover WinAnsi)
// ---------------------------------------------------------------------------

const REPLACEMENTS: [RegExp, string][] = [
  [/[\u2018\u2019\u201B]/g, "'"],
  [/[\u201C\u201D]/g, '"'],
  [/\u2192/g, '>'],
  [/\u2265/g, '>='],
  [/\u2264/g, '<='],
  [/\u2248/g, '~'],
  [/[\u2713\u2714]/g, ''],
  [/\u00A0/g, ' '],
];

/** Keep Latin-1 plus the few typographic marks WinAnsi has; replace the rest. */
export function pdfSafe(input: unknown): string {
  let s = String(input ?? '');
  for (const [re, to] of REPLACEMENTS) s = s.replace(re, to);
  return s.replace(/[^\x20-\x7E\u00A1-\u00FF\u2013\u2014\u2022\u2026\u00B7]/g, '');
}
// ---------------------------------------------------------------------------
// Drawing primitives
// ---------------------------------------------------------------------------

type Doc = jsPDF;

const fill = (d: Doc, c: RGB) => d.setFillColor(c[0], c[1], c[2]);
const stroke = (d: Doc, c: RGB, w = 0.3) => {
  d.setDrawColor(c[0], c[1], c[2]);
  d.setLineWidth(w);
};
const ink = (d: Doc, c: RGB) => d.setTextColor(c[0], c[1], c[2]);

function box(d: Doc, x: number, y: number, w: number, h: number, r: number, bg: RGB, border?: RGB) {
  fill(d, bg);
  if (border) stroke(d, border, 0.35);
  d.roundedRect(x, y, w, h, r, r, border ? 'FD' : 'F');
}

interface TextOpts {
  size?: number;
  bold?: boolean;
  italic?: boolean;
  color?: RGB;
  align?: 'left' | 'center' | 'right';
  maxW?: number;
  maxLines?: number;
  /** line height multiplier */
  lh?: number;
  url?: string;
}

function setFont(d: Doc, o: TextOpts) {
  d.setFont('helvetica', o.bold && o.italic ? 'bolditalic' : o.bold ? 'bold' : o.italic ? 'italic' : 'normal');
  d.setFontSize(o.size ?? 9);
  ink(d, o.color ?? C.text);
}

/** Shorten to one line that fits `maxW`. */
function fitLine(d: Doc, s: string, maxW: number): string {
  let out = pdfSafe(s);
  if (d.getTextWidth(out) <= maxW) return out;
  while (out.length > 1 && d.getTextWidth(`${out}...`) > maxW) out = out.slice(0, -1);
  return `${out.trimEnd()}...`;
}

/**
 * Draws wrapped text starting at (x, y) where y is the TOP of the first line.
 * Returns the height consumed. Never exceeds maxLines (adds "..." instead).
 */
function text(d: Doc, s: string, x: number, y: number, o: TextOpts = {}): number {
  const size = o.size ?? 9;
  setFont(d, o);
  const lineH = size * PT * (o.lh ?? 1.35);
  const maxW = o.maxW ?? CW;
  let lines: string[] = d.splitTextToSize(pdfSafe(s), maxW);
  if (o.maxLines && lines.length > o.maxLines) {
    lines = lines.slice(0, o.maxLines);
    lines[o.maxLines - 1] = fitLine(d, `${lines[o.maxLines - 1]}...`, maxW);
  }
  const ax = o.align === 'center' ? x + maxW / 2 : o.align === 'right' ? x + maxW : x;
  lines.forEach((line, i) => {
    const by = y + size * PT * 0.82 + i * lineH;
    if (o.url) d.textWithLink(line, ax, by, { url: o.url, align: o.align });
    else d.text(line, ax, by, { align: o.align });
  });
  return lines.length * lineH;
}

/** Height `text()` would use, without drawing. */
function textHeight(d: Doc, s: string, o: TextOpts = {}): number {
  const size = o.size ?? 9;
  setFont(d, o);
  const lineH = size * PT * (o.lh ?? 1.35);
  const n = (d.splitTextToSize(pdfSafe(s), o.maxW ?? CW) as string[]).length;
  return Math.min(n, o.maxLines ?? n) * lineH;
}

function pill(d: Doc, x: number, y: number, label: string, bg: RGB, fg: RGB, size = 6.8, h = 5.2): number {
  setFont(d, { size, bold: true, color: fg });
  const w = d.getTextWidth(pdfSafe(label)) + 5;
  box(d, x, y, w, h, h / 2, bg);
  d.text(pdfSafe(label), x + w / 2, y + h / 2 + size * PT * 0.34, { align: 'center' });
  return w;
}

function sectionHeading(d: Doc, y: number, title: string, sub?: string): number {
  fill(d, C.red);
  d.roundedRect(M, y, 2.2, sub ? 11 : 7, 1, 1, 'F');
  text(d, title, M + 5, y - 0.4, { size: 13, bold: true, color: C.ink, maxW: CW - 5 });
  let h = 7.5;
  if (sub) {
    h += text(d, sub, M + 5, y + 6.4, { size: 8, color: C.muted, maxW: CW - 5 }) + 0.5;
  }
  return y + h + 3;
}

function bar(d: Doc, x: number, y: number, w: number, h: number, pct: number, color: RGB = C.red) {
  box(d, x, y, w, h, h / 2, C.line);
  const fw = Math.max(h, (w * Math.max(0, Math.min(100, pct))) / 100);
  if (pct > 0) box(d, x, y, fw, h, h / 2, color);
}

function scoreColor(pct: number): RGB {
  return pct >= 85 ? C.green : pct >= 70 ? C.amber : C.muted;
}

function matchBadge(d: Doc, cx: number, cy: number, r: number, pct: number) {
  const col = scoreColor(pct);
  fill(d, C.white);
  stroke(d, col, 1.1);
  d.circle(cx, cy, r, 'FD');
  setFont(d, { size: r > 8 ? 12.5 : 10, bold: true, color: col });
  d.text(`${pct}%`, cx, cy + (r > 8 ? 1.2 : 0.9), { align: 'center' });
  setFont(d, { size: 5.8, bold: true, color: C.muted });
  d.text('MATCH', cx, cy + (r > 8 ? 5.2 : 4.2), { align: 'center' });
}

// ---------------------------------------------------------------------------
// Buttons (always clickable) and the accuracy rules for them
// ---------------------------------------------------------------------------

type ButtonKind = 'primary' | 'secondary' | 'muted';

function button(d: Doc, x: number, y: number, w: number, h: number, label: string, url: string, kind: ButtonKind) {
  if (kind === 'primary') box(d, x, y, w, h, 1.6, C.red);
  else if (kind === 'secondary') box(d, x, y, w, h, 1.6, C.white, C.red);
  else box(d, x, y, w, h, 1.6, C.panel, C.line);
  const fg = kind === 'primary' ? C.white : kind === 'secondary' ? C.red : C.text;
  const size = h >= 8 ? 7.4 : 6.4;
  setFont(d, { size, bold: true, color: fg });
  const label2 = fitLine(d, label, w - 4);
  d.text(label2, x + w / 2, y + h / 2 + size * PT * 0.34, { align: 'center' });
  d.link(x, y, w, h, { url });
}

export interface ShoeActions {
  buy: { url: string; label: string } | null;
  review: { url: string; label: string };
  /** The maker's own page, or null when we only have a generic web search (we do not link those). */
  brandSite: { url: string; label: string } | null;
}

const isGenericReview = (u: string) => /\/review\/best-running-shoes\/?$/.test(u);

function brandSiteAction(shoe: Shoe): { url: string; label: string } | null {
  const b = getBrandBuyLink(shoe);
  return b ? { url: b.url, label: b.label.toUpperCase() } : null;
}

/** Which buttons a shoe gets. Exported so tests can pin the accuracy rules. */
export function getShoeActions(shoe: Shoe): ShoeActions {
  const url = getAmazonLinkForShoe(shoe.id, shoe.brand, shoe.model, shoe.amazonASIN);
  const note = getAmazonListingNote(shoe.id);
  return {
    buy: url ? { url, label: note ? `BUY ON AMAZON (${note.toUpperCase()})` : 'BUY ON AMAZON' } : null,
    review: isGenericReview(shoe.reviewURL)
      ? { url: shoe.reviewURL, label: 'OUR BEST SHOES GUIDE' }
      : { url: shoe.reviewURL, label: 'READ OUR REVIEW' },
    brandSite: brandSiteAction(shoe),
  };
}

/** Draws the best two buttons for a shoe in a row; returns nothing. */
function shoeButtons(d: Doc, x: number, y: number, w: number, h: number, shoe: Shoe) {
  const a = getShoeActions(shoe);
  const gap = 2.5;
  if (a.buy) {
    const bw = Math.round(w * 0.58);
    button(d, x, y, bw, h, a.buy.label, a.buy.url, 'primary');
    button(d, x + bw + gap, y, w - bw - gap, h, a.review.label, a.review.url, 'secondary');
  } else {
    // No verified Amazon listing: say so, never guess.
    if (a.brandSite) {
      const bw = Math.round(w * 0.5);
      button(d, x, y, bw, h, a.review.label, a.review.url, 'secondary');
      button(d, x + bw + gap, y, w - bw - gap, h, a.brandSite.label, a.brandSite.url, 'muted');
    } else {
      button(d, x, y, w, h, a.review.label, a.review.url, 'secondary');
    }
  }
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

async function blobToImg(blob: Blob): Promise<Img | null> {
  if (!blob || blob.size < 1500) return null;
  const data = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onloadend = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
  return { data, format: blob.type.includes('png') ? 'PNG' : 'JPEG' };
}

async function defaultFetch(url: string): Promise<Blob | null> {
  try {
    const r = await fetch(url);
    return r.ok ? await r.blob() : null;
  } catch {
    return null;
  }
}

/**
 * Loads the product photo for a shoe: our own verified photo, else the photo on the Amazon listing
 * we link to, else null (no photo we can trust). Amazon's image CDN allows cross-origin reads.
 */
async function loadShoePhoto(shoe: Shoe, get: (u: string) => Promise<Blob | null>): Promise<Img | null> {
  const photo = resolveShoePhoto(shoe);
  if (!photo) return null;
  try {
    const blob = await get(photo.source === 'local' ? assetPath(`/images/shoes/${shoeImageSlug(shoe.brand, shoe.model)}.jpg`) : photo.url);
    return blob ? await blobToImg(blob) : null;
  } catch {
    return null;
  }
}

/** Photo in a clean studio frame, contain-fitted. Draws a labelled placeholder when there is none. */
function photoFrame(d: Doc, x: number, y: number, w: number, h: number, img: Img | null, shoe: Shoe) {
  box(d, x, y, w, h, 2.5, [250, 251, 253], C.line);
  if (img) {
    try {
      const p = d.getImageProperties(img.data);
      const pad = 2;
      const bw = w - pad * 2;
      const bh = h - pad * 2;
      const s = Math.min(bw / p.width, bh / p.height);
      const dw = p.width * s;
      const dh = p.height * s;
      d.addImage(img.data, img.format, x + pad + (bw - dw) / 2, y + pad + (bh - dh) / 2, dw, dh, undefined, 'FAST');
      return;
    } catch {
      /* fall through to the placeholder */
    }
  }
  // Placeholder: a plain sneaker outline and an honest caption. We would rather show
  // this than a photo of a different shoe. Brand and model are always printed next to it.
  const roomy = h >= 32;
  const sw = Math.min(w * 0.6, h * 1.5);
  const sh = sw * 0.5;
  const sx = x + (w - sw) / 2;
  const sy = y + (roomy ? h * 0.2 : (h - sh) / 2 - 2);
  const pts: [number, number][] = [[0.08, 0.2], [0.3, 0.1], [0.46, 0.3], [0.78, 0.5], [0.97, 0.72], [0.97, 0.9], [0.05, 0.9], [0.03, 0.55]];
  fill(d, [232, 235, 241]);
  stroke(d, C.faint, 0.35);
  const rel = pts.slice(1).map((p, i) => [(p[0] - pts[i][0]) * sw, (p[1] - pts[i][1]) * sh] as [number, number]);
  d.lines(rel, sx + pts[0][0] * sw, sy + pts[0][1] * sh, [1, 1], 'FD', true);
  stroke(d, C.faint, 0.6);
  d.line(sx + 0.05 * sw, sy + 0.9 * sh, sx + 0.97 * sw, sy + 0.9 * sh);
  if (roomy) {
    text(d, shoe.brand.toUpperCase(), x, y + h * 0.58, { size: 6.6, bold: true, color: C.red, align: 'center', maxW: w });
    text(d, shoe.model, x + 3, y + h * 0.58 + 4, { size: 9, bold: true, color: C.ink, align: 'center', maxW: w - 6, maxLines: 1 });
  }
  text(d, 'Photo not available', x, y + h - 5.4, { size: 6.2, color: C.faint, align: 'center', maxW: w });
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const FOOT_LABEL: Record<string, string> = { neutral: 'Neutral arch', flat: 'Low arch / flat', 'high-arch': 'High arch', wide: 'Wide forefoot' };
const GAIT_LABEL: Record<string, string> = { neutral: 'Neutral', overpronation: 'Overpronation', underpronation: 'Underpronation', unsure: 'Not sure' };
const DIST_LABEL: Record<string, string> = { '5k': '5K', '10k': '10K', 'half-marathon': 'Half marathon', marathon: 'Marathon', ultra: 'Ultra', mixed: 'Mixed distances' };
const TERRAIN_LABEL: Record<string, string> = { road: 'Road', trail: 'Trail', track: 'Track', mixed: 'Mixed / treadmill' };
const PACE_LABEL: Record<string, string> = { easy: 'Easy / recovery', moderate: 'Moderate', tempo: 'Tempo', race: 'Race / intervals' };
const BUDGET_LABEL: Record<string, string> = { 'under-100': 'Under $100', '100-150': '$100-150', '150-200': '$150-200', '200-plus': '$200+' };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const nameOf = (s: Shoe) => `${s.brand} ${s.model}`;

/** Months a pair lasts at this weekly distance, using the 500-800 km rule of thumb. */
export function replacementWindow(weeklyKm: number): string {
  if (!Number.isFinite(weeklyKm) || weeklyKm < 5) return 'at around 500-800 km (300-500 miles)';
  const lo = Math.max(1, Math.round(500 / (weeklyKm * 4.345)));
  const hi = Math.max(lo, Math.round(800 / (weeklyKm * 4.345)));
  const span = lo === hi ? `about ${lo} month${lo === 1 ? '' : 's'}` : `roughly ${lo}-${hi} months`;
  return `at around 500-800 km (300-500 miles), which is ${span} at ${Math.round(weeklyKm)} km a week`;
}

// ---------------------------------------------------------------------------
// Page chrome
// ---------------------------------------------------------------------------

function pageHeader(d: Doc, logo: Img | null, who: string) {
  fill(d, C.red);
  d.rect(0, 0, PW, 1.6, 'F');
  if (logo) {
    try {
      d.addImage(logo.data, logo.format, M, 4.6, 7, 7, undefined, 'FAST');
    } catch {
      /* no logo */
    }
  }
  text(d, 'RunMatch AI', M + 9.5, 4.9, { size: 9, bold: true, color: C.ink, maxW: 60 });
  text(d, 'Your personal running shoe report', M + 9.5, 8.7, { size: 6.8, color: C.muted, maxW: 80 });
  text(d, who, M + CW - 90, 6.2, { size: 7.5, bold: true, color: C.red, align: 'right', maxW: 90 });
  stroke(d, C.line, 0.3);
  d.line(M, 14.5, M + CW, 14.5);
}

function pageFooter(d: Doc, page: number, total: number, slug: string) {
  stroke(d, C.line, 0.3);
  d.line(M, PH - FOOT, M + CW, PH - FOOT);
  text(d, 'gearuptofit.com/shoe-finder', M, PH - FOOT + 2.2, { size: 7, bold: true, color: C.red, maxW: 70, url: `${APP_ORIGIN}/` });
  text(d, `Page ${page} of ${total}`, M + CW - 40, PH - FOOT + 2.2, { size: 7, color: C.muted, align: 'right', maxW: 40 });
  text(
    d,
    "Educational content, not medical advice. See a qualified professional about pain or injury. As an Amazon Associate, GearUpToFit earns from qualifying purchases; 'Buy on Amazon' links are affiliate links at no extra cost to you.",
    M,
    PH - FOOT + 6.2,
    { size: 6.6, color: C.faint, maxW: CW, maxLines: 2, lh: 1.3 },
  );
  void slug;
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

export async function buildResultsPDF(data: PDFData, options: BuildOptions = {}): Promise<{ doc: jsPDF; stats: { pages: number; photos: number; buyButtons: number } }> {
  const get = options.fetchImage ?? defaultFetch;
  const { answers, recommendation: rec, rotation, radarData } = data;
  const slug = data.slug ?? generateSlug(answers);
  const top = (data.topShoes && data.topShoes.length > 0 ? data.topShoes : scoreShoes(answers)).slice(0, 5);
  const primary = rotation.primary ?? top[0];
  const profile = describeRunnerProfile(answers);
  const who = `${profile.who} | ${profile.distance} | ${profile.terrain}`;
  const safety = getSafetyNotice(answers);
  const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const d = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: options.compress ?? true });
  d.setProperties({
    title: `RunMatch report: ${nameOf(primary.shoe)}`,
    subject: 'Personal running shoe report',
    author: 'GearUpToFit',
    keywords: 'running shoes, RunMatch AI, GearUpToFit',
    creator: 'RunMatch AI',
  });

  // ---- load everything the report needs up front (in parallel) ----
  const wanted = new Map<string, Shoe>();
  for (const s of [primary, rotation.speed, rotation.longRun, ...top]) if (s) wanted.set(s.shoe.id, s.shoe);
  const [logo, ...photoList] = await Promise.all([
    get(assetPath('/images/gearuptofit-logo.png')).then((b) => (b ? blobToImg(b) : null)).catch(() => null),
    ...[...wanted.values()].map((shoe) => loadShoePhoto(shoe, get)),
  ]);
  const photos = new Map<string, Img | null>([...wanted.keys()].map((id, i) => [id, photoList[i] ?? null]));
  const photoOf = (s: Shoe) => photos.get(s.id) ?? null;

  let y = 0;
  const newPage = () => {
    d.addPage();
    pageHeader(d, logo, who);
    y = TOP;
  };
  const ensure = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };

  let buyButtons = 0;
  const countBuy = (shoe: Shoe) => {
    if (getShoeActions(shoe).buy) buyButtons++;
  };

  // =========================================================================
  // PAGE 1: cover band, profile, result
  // =========================================================================
  fill(d, C.band);
  d.rect(0, 0, PW, 46, 'F');
  fill(d, C.red);
  d.rect(0, 0, 4, 46, 'F');
  box(d, M, 12, 22, 22, 3, C.white);
  if (logo) {
    try {
      d.addImage(logo.data, logo.format, M + 2, 14, 18, 18, undefined, 'FAST');
    } catch {
      /* no logo */
    }
  }
  text(d, 'PERSONAL REPORT', M + 28, 12, { size: 7.5, bold: true, color: [240, 110, 115] as RGB, maxW: 90 });
  text(d, 'Your Running Shoe Match', M + 28, 17, { size: 22, bold: true, color: C.white, maxW: CW - 28 });
  text(d, `Made for: ${who}`, M + 28, 28.5, { size: 9, color: [205, 210, 220] as RGB, maxW: CW - 28 });
  text(d, `${reportDate}  |  RunMatch AI by GearUpToFit`, M + 28, 34.5, { size: 7.5, color: [150, 158, 172] as RGB, maxW: CW - 28 });
  y = 53;

  y = sectionHeading(d, y, 'Your runner profile');
  const chips: [string, string][] = [
    ['FOOT TYPE', FOOT_LABEL[answers.footType] ?? answers.footType],
    ['GAIT', GAIT_LABEL[answers.pronation] ?? answers.pronation],
    ['WEEKLY VOLUME', `${answers.weeklyMileage} km (${Math.round(answers.weeklyMileage * 0.621)} mi)`],
    ['RACE DISTANCE', DIST_LABEL[answers.distance] ?? answers.distance],
    ['TERRAIN', TERRAIN_LABEL[answers.terrain] ?? answers.terrain],
    ['PACE GOAL', PACE_LABEL[answers.paceGoal] ?? answers.paceGoal],
    ['BUDGET', answers.budget.length ? answers.budget.map((b) => BUDGET_LABEL[b] ?? b).join(', ') : 'Any'],
    ['PAIN / INJURY', safety ? safety.reported.map(cap).join(', ') : 'None reported'],
  ];
  const cw = (CW - 3 * 3) / 4;
  chips.forEach(([label, value], i) => {
    const cx = M + (i % 4) * (cw + 3);
    const cy = y + Math.floor(i / 4) * 17.5;
    box(d, cx, cy, cw, 15, 2, C.panel);
    text(d, label, cx + 3, cy + 2.6, { size: 6.5, bold: true, color: C.muted, maxW: cw - 6 });
    text(d, value, cx + 3, cy + 7.2, { size: 9, bold: true, color: C.ink, maxW: cw - 6, maxLines: 2, lh: 1.15 });
  });
  y += 38;

  y = sectionHeading(d, y, 'Your result');
  text(d, rec.shoeProfile.category, M, y, { size: 15, bold: true, color: C.red, maxW: CW });
  y += 8;
  y += text(d, rec.shoeProfile.summary, M, y, { size: 9.5, color: C.text, maxW: CW, lh: 1.45 }) + 3;
  const statW = (CW - 9) / 4;
  [
    ['CUSHIONING', rec.shoeProfile.cushioning],
    ['HEEL DROP', rec.shoeProfile.dropRange],
    ['SUPPORT', rec.shoeProfile.supportType],
    ['ROTATION', rotation.longRun ? '3 shoes' : rotation.speed ? '2 shoes' : '1 daily shoe'],
  ].forEach(([label, value], i) => {
    const sx = M + i * (statW + 3);
    box(d, sx, y, statW, 13, 2, C.white, C.line);
    text(d, label, sx + 3, y + 2.2, { size: 6.4, bold: true, color: C.muted, maxW: statW - 6 });
    text(d, value, sx + 3, y + 6.6, { size: 9, bold: true, color: C.ink, maxW: statW - 6, maxLines: 1 });
  });
  y += 18;

  if (safety) {
    const bodyW = CW - 14;
    const bullets = safety.bullets.map((b) => `${BUL}  ${b}`);
    const hBody = bullets.reduce((s, b) => s + textHeight(d, b, { size: 8, maxW: bodyW, lh: 1.35 }) + 1, 0);
    const bh = 14 + textHeight(d, safety.summary, { size: 8.4, maxW: bodyW }) + hBody + 2;
    ensure(bh + 3);
    box(d, M, y, CW, bh, 3, C.amberSoft, [228, 190, 110] as RGB);
    fill(d, C.amber);
    d.roundedRect(M, y, 2.4, bh, 1.2, 1.2, 'F');
    text(d, safety.title, M + 7, y + 4, { size: 10.5, bold: true, color: C.ink, maxW: bodyW });
    let sy = y + 11;
    sy += text(d, safety.summary, M + 7, sy, { size: 8.4, color: C.text, maxW: bodyW }) + 1.5;
    bullets.forEach((b) => {
      sy += text(d, b, M + 7, sy, { size: 8, color: C.text, maxW: bodyW, lh: 1.35 }) + 1;
    });
    y += bh + 5;
  }

  // =========================================================================
  // #1 MATCH hero card
  // =========================================================================
  const heroH = 121;
  ensure(heroH + 4);
  {
    const s = primary.shoe;
    const x0 = M;
    const label = safety ? safety.topPickLabel.toUpperCase() : '#1 MATCH FOR YOUR ANSWERS';
    box(d, x0, y, CW, heroH, 3.5, C.white, C.line);
    fill(d, C.red);
    d.roundedRect(x0, y, 3, heroH, 1.5, 1.5, 'F');
    text(d, label, x0 + 8, y + 5, { size: 7.4, bold: true, color: C.red, maxW: CW - 16 });
    text(d, nameOf(s), x0 + 8, y + 10.2, { size: 16, bold: true, color: C.ink, maxW: CW - 16, maxLines: 1 });

    photoFrame(d, x0 + 8, y + 22, 70, 52, photoOf(s), s);
    matchBadge(d, x0 + 8 + 70 - 2, y + 22 + 6, 8.2, primary.matchPercent);

    // specs 2x2 + price tier on the right
    const rx = x0 + 84;
    const rw = CW - 84 - 6;
    const tier = getPriceTier(s.priceUSD);
    let px = rx;
    px += pill(d, px, y + 22, tier.label.toUpperCase(), C.redSoft, C.redDark) + 2;
    px += pill(d, px, y + 22, `${s.year} MODEL`, C.panel, C.muted) + 2;
    if (primary.newerVersion) pill(d, px, y + 22, 'NEWER VERSION EXISTS', C.amberSoft, C.amber);
    const specs: [string, string][] = [
      ['CUSHIONING', `${s.cushioning} / 10`],
      ['HEEL DROP', `${s.dropMM} mm`],
      ['WEIGHT', `${s.weightGrams} g`],
      ['WIDE SIZES', s.widthOptions ? 'Listed' : 'Not listed'],
    ];
    const sw = (rw - 3) / 2;
    specs.forEach(([l, v], i) => {
      const sx = rx + (i % 2) * (sw + 3);
      const sy = y + 30 + Math.floor(i / 2) * 14;
      box(d, sx, sy, sw, 12, 2, C.panel);
      text(d, l, sx + 3, sy + 2, { size: 6.4, bold: true, color: C.muted, maxW: sw - 6 });
      text(d, v, sx + 3, sy + 5.8, { size: 9.5, bold: true, color: C.ink, maxW: sw - 6 });
    });
    text(d, `${tier.range}. Launch price band, not a live price.`, rx, y + 59, { size: 6.8, color: C.muted, maxW: rw, maxLines: 2 });

    // why it scored (left) + watch out (right)
    const colY = y + 80;
    const colW = (CW - 16 - 8) / 2;
    text(d, `WHY IT SCORED ${primary.matchPercent}%`, x0 + 8, colY, { size: 7, bold: true, color: C.muted, maxW: colW });
    // The three strongest contributions plus the weakest factor, so the breakdown is honest, not just flattering.
    const strongest = primary.factors.slice(0, 3);
    const weakest = primary.factors.filter((f) => !strongest.includes(f)).sort((a, b) => a.value - b.value)[0];
    [...strongest, ...(weakest && weakest.value < 0.85 ? [weakest] : primary.factors.slice(3, 4))].forEach((f, i) => {
      const fy = colY + 5 + i * 5.2;
      text(d, f.label, x0 + 8, fy, { size: 7.4, color: C.text, maxW: 40, maxLines: 1 });
      bar(d, x0 + 8 + 41, fy + 1.6, colW - 41 - 10, 1.9, Math.round(f.value * 100), scoreColor(Math.round(f.value * 100)));
      text(d, `${Math.round(f.value * 100)}%`, x0 + 8 + colW - 9, fy, { size: 7.4, bold: true, color: C.ink, align: 'right', maxW: 9 });
    });
    const wx = x0 + 8 + colW + 8;
    text(d, 'CHECK BEFORE YOU BUY', wx, colY, { size: 7, bold: true, color: C.muted, maxW: colW });
    let wy = colY + 5;
    const watch = primary.watchOuts.length ? primary.watchOuts.slice(0, 3) : ['Nothing stands out in the specs we track. Fit is personal, so try it on.'];
    for (const w of watch) {
      const hh = text(d, `${BUL}  ${w}`, wx, wy, { size: 7.6, color: C.text, maxW: colW, maxLines: 3, lh: 1.3 });
      wy += hh + 1.2;
    }
    shoeButtons(d, x0 + 8, y + heroH - 13.5, CW - 16, 9, s);
    countBuy(s);
    y += heroH + 8;
  }

  // =========================================================================
  // ROTATION (one card per job; a runner on one shoe gets a short note instead of a repeat of the #1 card)
  // =========================================================================
  const multi = !!(rotation.speed || rotation.longRun);
  ensure(multi ? 90 : 52);
  y = sectionHeading(
    d,
    y,
    'Your shoe rotation',
    multi
      ? 'Alternating shoes varies how your legs are loaded and helps each pair last. Here is one pair for each job.'
      : 'At your current training, one comfortable daily shoe is enough. Add a second pair when your mileage or goals grow.',
  );
  const slots: { role: string; blurb: string; s: ScoredShoe | null | undefined; color: RGB; soft: RGB }[] = [
    { role: 'DAILY TRAINER', blurb: 'Easy runs, recovery and everyday miles', s: multi ? rotation.primary : null, color: C.red, soft: C.redSoft },
    { role: 'SPEED WORK', blurb: 'Tempo runs, intervals and race day', s: rotation.speed, color: C.blue, soft: C.blueSoft },
    { role: 'LONG RUN', blurb: 'Your longest weekly run, extra cushioning', s: rotation.longRun, color: C.purple, soft: C.purpleSoft },
  ];
  for (const slot of slots) {
    if (!slot.s) continue;
    const s = slot.s;
    const ch = 64;
    ensure(ch + 4);
    box(d, M, y, CW, ch, 3, C.white, C.line);
    fill(d, slot.color);
    d.roundedRect(M, y, 3, ch, 1.5, 1.5, 'F');
    photoFrame(d, M + 8, y + 6, 56, 42, photoOf(s.shoe), s.shoe);
    matchBadge(d, M + 8 + 56 - 1, y + 6 + 5, 7, s.matchPercent);
    const rx = M + 70;
    const rw = CW - 70 - 6;
    pill(d, rx, y + 5, slot.role, slot.soft, slot.color);
    text(d, slot.blurb, rx + 40, y + 5.6, { size: 7.4, color: C.muted, maxW: rw - 40, maxLines: 1 });
    text(d, nameOf(s.shoe), rx, y + 12.5, { size: 12.5, bold: true, color: C.ink, maxW: rw, maxLines: 1 });
    const t = getPriceTier(s.shoe.priceUSD);
    text(d, `${s.shoe.cushioning}/10 cushion  |  ${s.shoe.dropMM} mm drop  |  ${s.shoe.weightGrams} g  |  ${t.label} (${t.range})`, rx, y + 19, { size: 7.6, color: C.muted, maxW: rw, maxLines: 1 });
    let ty = y + 25;
    text(d, 'WHY IT FITS', rx, ty, { size: 6.6, bold: true, color: C.muted, maxW: 30 });
    ty += 4;
    for (const r of s.reasons.slice(0, 2)) ty += text(d, `${BUL}  ${r}`, rx, ty, { size: 7.8, color: C.text, maxW: rw, maxLines: 1 }) + 0.8;
    if (s.watchOuts[0]) {
      text(d, `Watch out: ${s.watchOuts[0]}`, rx, ty + 0.6, { size: 7.4, italic: true, color: C.amber, maxW: rw, maxLines: 2, lh: 1.25 });
    }
    shoeButtons(d, M + 8, y + ch - 11.5, CW - 16, 8, s.shoe);
    countBuy(s.shoe);
    y += ch + 5;
  }
  ensure(26);
  box(d, M, y, CW, 20, 2.5, C.panel);
  text(d, 'RESEARCH NOTE', M + 4, y + 3, { size: 6.6, bold: true, color: C.muted, maxW: 60 });
  text(d, ROTATION_STATEMENT, M + 4, y + 7, { size: 7.4, color: C.text, maxW: CW - 8, maxLines: 3, lh: 1.3 });
  y += 27;

  // =========================================================================
  // TOP 5 TABLE (kept on one page so the header row is never orphaned)
  // =========================================================================
  ensure(18 + 9 + top.length * 28.2 + 42);
  y = sectionHeading(d, y, 'Your top 5, side by side', 'Ranked by match score. Every row has a thumbnail, the key specs and where to buy or read more.');
  const col = { n: 8, photo: 26, name: 50, match: 22, cush: 14, drop: 13, wt: 13, buy: 36 };
  const headH = 8;
  let cx = M;
  box(d, M, y, CW, headH, 2, C.band);
  const heads: [string, number, 'left' | 'center'][] = [
    ['#', col.n, 'center'],
    ['', col.photo, 'left'],
    ['SHOE', col.name, 'left'],
    ['MATCH', col.match, 'center'],
    ['CUSH.', col.cush, 'center'],
    ['DROP', col.drop, 'center'],
    ['G', col.wt, 'center'],
    ['WHERE TO BUY', col.buy, 'center'],
  ];
  heads.forEach(([h, w, al]) => {
    if (h) text(d, h, cx, y + 2.4, { size: 6.8, bold: true, color: C.white, align: al, maxW: w });
    cx += w;
  });
  y += headH + 1;
  const rowH = 27;
  top.forEach((sc, i) => {
    ensure(rowH + 2);
    const s = sc.shoe;
    if (i % 2 === 0) box(d, M, y, CW, rowH, 2, C.panel);
    let x = M;
    text(d, String(i + 1), x, y + rowH / 2 - 3, { size: 12, bold: true, color: i === 0 ? C.red : C.muted, align: 'center', maxW: col.n });
    x += col.n;
    photoFrame(d, x, y + 3, col.photo - 2, rowH - 6, photoOf(s), s);
    x += col.photo;
    text(d, s.brand.toUpperCase(), x, y + 3.2, { size: 6.4, bold: true, color: C.red, maxW: col.name - 3, maxLines: 1 });
    text(d, s.model, x, y + 7, { size: 9.2, bold: true, color: C.ink, maxW: col.name - 3, maxLines: 2, lh: 1.12 });
    const watch = sc.newerVersion ? `A newer version exists: ${nameOf(sc.newerVersion)}.` : firstSentence(sc.watchOuts[0]);
    if (watch) text(d, watch, x, y + 16, { size: 6.8, italic: true, color: C.amber, maxW: col.name - 3, maxLines: 3, lh: 1.2 });
    x += col.name;
    text(d, `${sc.matchPercent}%`, x, y + 5.2, { size: 11.5, bold: true, color: scoreColor(sc.matchPercent), align: 'center', maxW: col.match });
    bar(d, x + 3, y + 13, col.match - 6, 2, sc.matchPercent, scoreColor(sc.matchPercent));
    text(d, getPriceTier(s.priceUSD).label, x, y + 17, { size: 6.8, color: C.muted, align: 'center', maxW: col.match });
    x += col.match;
    [`${s.cushioning}/10`, `${s.dropMM}`, `${s.weightGrams}`].forEach((v, k) => {
      const w = [col.cush, col.drop, col.wt][k];
      text(d, v, x, y + rowH / 2 - 2.4, { size: 8.6, bold: true, color: C.ink, align: 'center', maxW: w });
      x += w;
    });
    // buy column: two stacked buttons
    const a = getShoeActions(s);
    const bx = x + 2;
    const bw = col.buy - 4;
    if (a.buy) {
      button(d, bx, y + 3.5, bw, 8.4, a.buy.label.includes('(') ? 'BUY (WOMEN\'S)' : 'BUY ON AMAZON', a.buy.url, 'primary');
      button(d, bx, y + 14, bw, 8.4, 'REVIEW', a.review.url, 'secondary');
      countBuy(s);
    } else {
      if (a.brandSite) {
        button(d, bx, y + 3.5, bw, 8.4, 'REVIEW', a.review.url, 'secondary');
        button(d, bx, y + 14, bw, 8.4, a.brandSite.label, a.brandSite.url, 'muted');
      } else {
        button(d, bx, y + 8.8, bw, 8.4, 'REVIEW', a.review.url, 'secondary');
      }
    }
    y += rowH + 1.2;
  });
  y += 3;
  const notes = [
    'Match: how well the shoe fits your answers across nine weighted factors. It is not a quality score for the shoe.',
    "Cush.: our own 1-10 cushioning scale, not a lab measurement. Drop: heel height minus forefoot height, in mm. G: weight in grams (men's sample size).",
    'Price band: the launch price tier. Amazon shows the live price. We never print prices that can go out of date.',
    'A Buy on Amazon button appears only when we have checked that the listing is this exact model. Where we have not, you get a link to our review and to the maker instead of a guess.',
  ].map((n) => `${BUL}  ${n}`);
  const noteOpts = { size: 7.4, color: C.text, maxW: CW - 8, lh: 1.3 } as const;
  const notesH = 9 + notes.reduce((s, n) => s + textHeight(d, n, noteOpts) + 1.6, 0);
  ensure(notesH + 4);
  box(d, M, y, CW, notesH, 2.5, C.white, C.line);
  text(d, 'HOW TO READ THIS TABLE', M + 4, y + 3, { size: 6.8, bold: true, color: C.muted, maxW: 80 });
  let ny = y + 8;
  for (const n of notes) ny += text(d, n, M + 4, ny, noteOpts) + 1.6;
  y += notesH + 6;

  // =========================================================================
  // FIT, PROFILE, TRAINING
  // =========================================================================
  ensure(124);
  y = sectionHeading(d, y, 'Trying them on', 'What to check in the shop, based on your answers.');
  const fp = getFitPriorities(answers);
  const fw = (CW - 4) / 2;
  fp.forEach((f, i) => {
    const fx = M + (i % 2) * (fw + 4);
    const fy = y + Math.floor(i / 2) * 22;
    box(d, fx, fy, fw, 19, 2.5, C.panel);
    fill(d, C.red);
    d.roundedRect(fx, fy, 2, 19, 1, 1, 'F');
    text(d, f.label.toUpperCase(), fx + 6, fy + 3, { size: 6.8, bold: true, color: C.red, maxW: fw - 10 });
    text(d, f.detail, fx + 6, fy + 7.4, { size: 8.4, color: C.text, maxW: fw - 10, maxLines: 3, lh: 1.3 });
  });
  const lastCardY = y + Math.floor((fp.length - 1) / 2) * 22;
  // sixth tile: lifespan
  if (fp.length % 2 === 1) {
    const fx = M + fw + 4;
    box(d, fx, lastCardY, fw, 19, 2.5, C.greenSoft);
    text(d, 'WHEN TO REPLACE THEM', fx + 6, lastCardY + 3, { size: 6.8, bold: true, color: C.green, maxW: fw - 10 });
    text(d, `Many runners replace shoes ${replacementWindow(answers.weeklyMileage)}.`, fx + 6, lastCardY + 7.4, { size: 8.2, color: C.text, maxW: fw - 10, maxLines: 3, lh: 1.3 });
  }
  y = lastCardY + 24;

  box(d, M, y, CW, 33, 2.5, C.white, C.line);
  text(d, 'TRY-ON AND BREAK-IN CHECKLIST', M + 4, y + 3, { size: 6.8, bold: true, color: C.muted, maxW: 80 });
  const checks = [
    'Try shoes on late in the day, when feet are at their largest, wearing the socks you run in.',
    'Walk and jog a few steps. Your heel should not slip, and nothing should rub or pinch.',
    'Buy from a seller with a fair return window, and run indoors in them first.',
    'Start with short, easy runs in a new pair and alternate it with your old pair for the first weeks.',
  ];
  checks.forEach((c, i) => text(d, `${BUL}  ${c}`, M + 4, y + 8 + i * 5.8, { size: 7.8, color: C.text, maxW: CW - 8, maxLines: 1 }));
  y += 40;

  // radar + legend
  ensure(78);
  y = sectionHeading(d, y, 'What your running demands', 'How much each part of your running asks of a shoe, from 0 to 10.');
  drawRadar(d, M + 52, y + 33, 24, radarData);
  const lx = M + 108;
  let ly = y + 4;
  radarData.forEach((r) => {
    text(d, r.axis, lx, ly, { size: 8.2, bold: true, color: C.ink, maxW: 34 });
    bar(d, lx + 34, ly + 1.7, 30, 2.2, r.value * 10);
    text(d, `${r.value}/10`, lx + 66, ly, { size: 8, bold: true, color: C.red, maxW: 12 });
    ly += 8.4;
  });
  y += 72;

  // training emphasis
  const tips = rec.trainingEmphasis;
  if (tips.length) {
    const th = 12 + tips.reduce((s, t) => s + textHeight(d, t, { size: 8.4, maxW: CW - 16, lh: 1.35 }) + 3, 0);
    ensure(th + 12);
    y = sectionHeading(d, y, 'Training emphasis');
    tips.forEach((t, i) => {
      const hh = textHeight(d, t, { size: 8.4, maxW: CW - 16, lh: 1.35 });
      ensure(hh + 4);
      fill(d, C.redSoft);
      d.circle(M + 4, y + 3, 3.4, 'F');
      text(d, String(i + 1), M + 0.6, y + 1.2, { size: 8.4, bold: true, color: C.red, align: 'center', maxW: 6.8 });
      text(d, t, M + 12, y, { size: 8.4, color: C.text, maxW: CW - 16, lh: 1.35 });
      y += Math.max(hh, 7) + 2.5;
    });
    y += 6;
  }

  // =========================================================================
  // READING + HOW IT WAS SCORED + DISCLOSURES
  // =========================================================================
  ensure(34);
  y = sectionHeading(d, y, 'Keep reading', 'Guides and tools picked for your profile. Every title is a link.');
  const links: { title: string; url: string; tag: string }[] = [
    ...getRecommendedArticles(answers).map((a) => ({ title: a.title, url: a.url, tag: a.category })),
    ...getInjuryArticles(answers.injuries).map((a) => ({ title: a.title, url: a.url, tag: a.category })),
    ...getToolLinks(answers).map((a) => ({ title: a.title, url: a.url, tag: 'Tool' })),
    ...getKitLinks().map((a) => ({ title: a.title, url: a.url, tag: a.category })),
  ];
  const seen = new Set<string>();
  const unique = links.filter((l) => (seen.has(l.url) ? false : (seen.add(l.url), true))).slice(0, 10);
  const lw = (CW - 4) / 2;
  unique.forEach((l, i) => {
    const lx2 = M + (i % 2) * (lw + 4);
    const ly2 = y + Math.floor(i / 2) * 13.5;
    box(d, lx2, ly2, lw, 11.5, 2, C.panel);
    pill(d, lx2 + 3, ly2 + 3.4, l.tag.toUpperCase(), C.white, C.red, 6, 4.6);
    text(d, l.title, lx2 + 31, ly2 + 2.9, { size: 8, bold: true, color: C.ink, maxW: lw - 34, maxLines: 2, lh: 1.15, url: l.url });
    d.link(lx2, ly2, lw, 11.5, { url: l.url });
  });
  y += Math.ceil(unique.length / 2) * 13.5 + 6;

  ensure(88);
  y = sectionHeading(d, y, 'How your matches were scored', 'The same answers always give the same ranking. Weights are fixed and published.');
  const wts = (Object.keys(SCORING_WEIGHTS) as (keyof typeof SCORING_WEIGHTS)[]).sort((a, b) => SCORING_WEIGHTS[b] - SCORING_WEIGHTS[a]);
  const half = Math.ceil(wts.length / 2);
  wts.forEach((k, i) => {
    const wx = M + (i < half ? 0 : lw + 4);
    const wy = y + (i % half) * 7.6;
    text(d, FACTOR_LABELS[k], wx, wy, { size: 8, color: C.text, maxW: 40, maxLines: 1 });
    bar(d, wx + 42, wy + 1.4, lw - 42 - 14, 2.2, Math.round(SCORING_WEIGHTS[k] * 100 * 4), C.red);
    text(d, `${Math.round(SCORING_WEIGHTS[k] * 100)}%`, wx + lw - 12, wy, { size: 8, bold: true, color: C.ink, align: 'right', maxW: 12 });
  });
  y += half * 7.6 + 3;
  y += text(
    d,
    `If you name a shoe you already run in, a tenth factor (the feel of that shoe) is added at about ${Math.round((SCORING_FAMILIARITY_WEIGHT / (1 + SCORING_FAMILIARITY_WEIGHT)) * 100)}% and the others scale down. A shoe with a newer version in our database loses ${Math.round(PREVIOUS_GENERATION_PENALTY * 100)} points. If pain or injury is reported, race shoes lose ${Math.round(INJURY_RACE_PENALTY * 100)} and speed shoes ${Math.round(INJURY_SPEED_PENALTY * 100)} points. Commission never changes a ranking.`,
    M,
    y,
    { size: 7.8, color: C.text, maxW: CW, lh: 1.35 },
  ) + 2;
  y += text(d, `Shoe data last reviewed ${SHOE_DATABASE_LAST_UPDATED_LABEL}. ${shoeDatabase.length} shoes scored.  Full methodology: ${SITE_ORIGIN}/shoe-finder/methodology/`, M, y, { size: 7.4, color: C.muted, maxW: CW, url: `${APP_ORIGIN}/methodology/` }) + 5;

  ensure(34);
  const liveUrl = `${APP_ORIGIN}/results/${slug}/?d=${encodeAnswers(answers)}`;
  box(d, M, y, CW, 20, 3, C.band);
  text(d, 'Come back to your live results any time', M + 6, y + 4, { size: 10, bold: true, color: C.white, maxW: CW - 80 });
  text(d, 'Opens the interactive version with the score breakdown for every shoe.', M + 6, y + 10.5, { size: 7.8, color: [190, 196, 208] as RGB, maxW: CW - 80, maxLines: 2 });
  button(d, M + CW - 66, y + 5.5, 60, 9, 'OPEN MY LIVE RESULTS', liveUrl, 'primary');
  y += 26;

  ensure(40);
  box(d, M, y, CW, 15, 2.5, C.panel);
  text(d, 'AFFILIATE DISCLOSURE', M + 4, y + 2.4, { size: 6.6, bold: true, color: C.muted, maxW: 60 });
  text(d, 'As an Amazon Associate, GearUpToFit earns from qualifying purchases. Links on "Buy on Amazon" buttons are affiliate links; they cost you nothing extra and do not change any ranking.', M + 4, y + 6.4, { size: 7.2, color: C.text, maxW: CW - 8, maxLines: 2, lh: 1.3 });
  y += 18;
  box(d, M, y, CW, 15, 2.5, C.amberSoft);
  text(d, 'NOT MEDICAL ADVICE', M + 4, y + 2.4, { size: 6.6, bold: true, color: C.amber, maxW: 60 });
  text(d, 'This report is educational. It cannot diagnose or treat an injury. If you have current pain, see a physiotherapist, sports-medicine doctor or podiatrist before changing shoes or training.', M + 4, y + 6.4, { size: 7.2, color: C.text, maxW: CW - 8, maxLines: 2, lh: 1.3 });
  y += 18;
  void REPLACEMENT_STATEMENT;
  void ROTATION_STATEMENT_SHORT;

  // footers (page count known only now)
  const total = d.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    d.setPage(p);
    pageFooter(d, p, total, slug);
  }

  return { doc: d, stats: { pages: total, photos: [...photos.values()].filter(Boolean).length, buyButtons } };
}

/** Builds the report and downloads it. */
export async function generateResultsPDF(data: PDFData): Promise<void> {
  const { doc } = await buildResultsPDF(data);
  doc.save(`GearUpToFit-RunMatch-Report-${data.slug ?? generateSlug(data.answers)}.pdf`);
}

// ---------------------------------------------------------------------------
// Radar chart (runner profile)
// ---------------------------------------------------------------------------

function drawRadar(d: Doc, cx: number, cy: number, radius: number, data: { axis: string; value: number }[]) {
  const n = data.length;
  if (n < 3) return;
  const step = (2 * Math.PI) / n;
  const start = -Math.PI / 2;
  const at = (i: number, r: number): [number, number] => [cx + r * Math.cos(start + i * step), cy + r * Math.sin(start + i * step)];

  for (let ring = 1; ring <= 5; ring++) {
    const r = (radius * ring) / 5;
    stroke(d, C.line, 0.2);
    for (let i = 0; i < n; i++) {
      const a = at(i, r);
      const b = at((i + 1) % n, r);
      d.line(a[0], a[1], b[0], b[1]);
    }
  }
  for (let i = 0; i < n; i++) {
    const p = at(i, radius);
    stroke(d, C.line, 0.2);
    d.line(cx, cy, p[0], p[1]);
  }
  const pts = data.map((v, i) => at(i, (radius * v.value) / 10));
  // soft fill: triangles from the centre
  fill(d, [248, 214, 215] as RGB);
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    d.triangle(cx, cy, a[0], a[1], b[0], b[1], 'F');
  }
  stroke(d, C.red, 0.8);
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    d.line(a[0], a[1], b[0], b[1]);
  }
  pts.forEach((p) => {
    fill(d, C.red);
    d.circle(p[0], p[1], 1.1, 'F');
  });
  data.forEach((v, i) => {
    const [lx, ly] = at(i, radius + 6);
    const cos = Math.cos(start + i * step);
    const align = Math.abs(cos) < 0.3 ? 'center' : cos > 0 ? 'left' : 'right';
    setFont(d, { size: 7.4, bold: true, color: C.ink });
    d.text(pdfSafe(v.axis), lx, ly + 1, { align });
  });
}
