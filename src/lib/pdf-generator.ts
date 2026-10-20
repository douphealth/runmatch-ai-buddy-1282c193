/**
 * RunMatch personal report (PDF).
 *
 * Built with jsPDF on a small layout engine so every page has the same grid,
 * type scale and margins, text can never run off a card, and content flows to a
 * new page instead of being clipped.
 *
 * What the report contains:
 *   1  Cover + result (+ a safety box when pain was reported) + the top 3 at a glance
 *   2  Your answers, then the #1 match in depth: photo, specs, why it scored, what to check,
 *      who it suits and who should look elsewhere, buy button
 *   -  "If one thing matters most": softest / lightest / best-value / wide-size alternatives
 *   -  Top 3 side by side with the leader marked on each row, and how to choose between them
 *   -  Rotation: one card per shoe (daily / speed / long run) with photo and buttons
 *   -  Ranks 4 to 10 with thumbnails and a buy button on every row
 *   -  Try-on guide, a printable shoe log, and verified gear ("Complete your kit")
 *   -  Runner-profile radar, training emphasis, reading list, how the scoring works, disclosures
 *
 * Accuracy rules (these are deliberate, do not "simplify" them away):
 *   - A "BUY ON AMAZON" button exists only when scripts/audit-asin-cache.mjs has a
 *     verified listing for that exact shoe. Otherwise the shoe gets a precise
 *     fallback (its GearUpToFit review, or the brand's own site), never a guess.
 *   - A photo is embedded only when it is known to show that exact model: the photo on the
 *     verified Amazon listing the Buy button opens, else our own verified photo
 *     (resolveShoePhoto); otherwise a clearly labelled placeholder is drawn.
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
import { selectGear, toGearCard } from './gear-catalog';
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

/**
 * Crops the empty white margin off a product photo (Amazon photos float the shoe in a large white canvas, at
 * very different scales), so every shoe fills its frame. Returns null when the image cannot be analysed
 * (no canvas, a photo with a coloured background, or nothing to trim) and the original is used instead.
 */
async function trimWhitespace(blob: Blob): Promise<string | null> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return null;
  try {
    const bmp = await createImageBitmap(blob);
    const w = bmp.width;
    const h = bmp.height;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0);
    const { data } = ctx.getImageData(0, 0, w, h);
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (data[i] < 244 || data[i + 1] < 244 || data[i + 2] < 244) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    const padX = Math.round((x1 - x0) * 0.05);
    const padY = Math.round((y1 - y0) * 0.1);
    x0 = Math.max(0, x0 - padX);
    y0 = Math.max(0, y0 - padY);
    x1 = Math.min(w - 1, x1 + padX);
    y1 = Math.min(h - 1, y1 + padY);
    const cw = x1 - x0 + 1;
    const ch = y1 - y0 + 1;
    if (cw >= w * 0.9 && ch >= h * 0.9) return null; // little to trim (or a coloured background)
    const out = document.createElement('canvas');
    out.width = cw;
    out.height = ch;
    const octx = out.getContext('2d');
    if (!octx) return null;
    octx.fillStyle = '#fff';
    octx.fillRect(0, 0, cw, ch);
    octx.drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
    return out.toDataURL('image/jpeg', 0.9);
  } catch {
    return null;
  }
}

async function blobToImg(blob: Blob): Promise<Img | null> {
  if (!blob || blob.size < 1500) return null;
  const trimmed = await trimWhitespace(blob);
  if (trimmed) return { data: trimmed, format: 'JPEG' };
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
function photoFrame(d: Doc, x: number, y: number, w: number, h: number, img: Img | null, shoe: Pick<Shoe, 'brand' | 'model'>) {
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

/** Every band accepted (or none picked) is "Any budget", not a list of all four ranges. */
export function budgetText(budget: string[] | undefined): string {
  const picked = (budget ?? []).filter(Boolean);
  if (picked.length === 0 || Object.keys(BUDGET_LABEL).every((k) => picked.includes(k))) return 'Any budget';
  return picked.map((b) => BUDGET_LABEL[b] ?? b).join(', ');
}

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
// Guidance derived from a shoe's own data (nothing in here is invented)
// ---------------------------------------------------------------------------

const CATEGORY_LABEL: Record<Shoe['category'], string> = {
  daily: 'Daily trainer',
  speed: 'Speed trainer',
  race: 'Race shoe',
  trail: 'Trail shoe',
  'max-cushion': 'Max cushion',
  stability: 'Stability',
  hybrid: 'Road-to-trail',
};
const supportLabel = (s: Shoe) => (s.pronation.includes('overpronation') ? (s.pronation.includes('neutral') ? 'Neutral + stability' : 'Stability') : 'Neutral');
const terrainLabel = (s: Shoe) => (s.terrain.includes('trail') ? (s.terrain.includes('road') ? 'Road + trail' : 'Trail') : 'Road');
const prettyTag = (t: string) => cap(t.replace(/-/g, ' '));

/** Who a shoe suits and who should look elsewhere, in plain words, from its category and specs. */
export function fitSummary(shoe: Shoe, answers: Pick<QuizAnswers, 'footType'>): { suits: string[]; elsewhere: string[] } {
  const suits: string[] = [];
  const elsewhere: string[] = [];
  switch (shoe.category) {
    case 'daily':
      suits.push('Easy and steady runs: the shoe you reach for most days');
      elsewhere.push('Race day or hard intervals, where a lighter, faster shoe is the better tool');
      break;
    case 'max-cushion':
      suits.push('Long, easy miles and recovery days when your legs are tired');
      elsewhere.push(`A light, quick feel: max-cushion shoes are heavier (about ${shoe.weightGrams} g here)`);
      break;
    case 'stability':
      suits.push('Runners whose feet roll inward (overpronation) or who want extra guidance');
      elsewhere.push('A neutral gait that needs no guidance: a neutral shoe may feel more natural');
      break;
    case 'speed':
      suits.push('Tempo runs, intervals and fast days when you want a quick-feeling shoe');
      elsewhere.push('Every easy run: keep a softer daily trainer for most of your weekly mileage');
      break;
    case 'race':
      suits.push('Race day and your hardest workouts');
      elsewhere.push('Easy daily miles: it is built for speed, so pair it with a daily trainer');
      break;
    case 'trail':
      suits.push('Dirt, gravel and uneven ground');
      elsewhere.push('Pavement-only running, where a road shoe is the better tool');
      break;
    case 'hybrid':
      suits.push('Routes that mix road and trail');
      elsewhere.push('Technical trail or all-out road racing, where a specialist shoe does more');
      break;
  }
  if (shoe.widthOptions) suits.push('Wide sizes are listed, useful if your forefoot is broad');
  else if (answers.footType === 'wide') elsewhere.unshift('A wide forefoot: only a standard width is listed for this shoe');
  if (shoe.dropMM <= 4) {
    suits.push(shoe.dropMM === 0 ? 'A flat, zero-drop platform' : `A low ${shoe.dropMM} mm drop and a flatter feel`);
    elsewhere.push('A sudden switch from a higher-drop shoe: move across gradually, since low drop loads the calves and Achilles more');
  } else if (shoe.dropMM >= 10) {
    suits.push(`A traditional ${shoe.dropMM} mm drop that is gentle on the calves`);
  }
  if (shoe.weightGrams <= 240 && shoe.category !== 'race') suits.push(`A light feel underfoot (about ${shoe.weightGrams} g)`);
  if (shoe.weightGrams >= 300 && shoe.category !== 'max-cushion') elsewhere.push(`A light, quick feel (about ${shoe.weightGrams} g)`);
  return { suits: suits.slice(0, 3), elsewhere: elsewhere.slice(0, 3) };
}

export interface PriorityPick {
  label: string;
  why: string;
  sc: ScoredShoe;
}

/**
 * Alternatives to the #1 match for a runner who cares most about one thing, chosen from the best matches only
 * (within 20 points of the top score, current models only). Each shoe appears once.
 */
export function pickByPriority(pool: ScoredShoe[], primary: ScoredShoe, wantsWide: boolean): PriorityPick[] {
  const floor = Math.max(40, primary.matchPercent - 20);
  const cands = pool.filter((s) => s.shoe.id !== primary.shoe.id && !s.newerVersion && s.matchPercent >= floor).slice(0, 14);
  const used = new Set<string>();
  const out: PriorityPick[] = [];
  const take = (label: string, ok: (s: ScoredShoe) => boolean, rank: (a: ScoredShoe, b: ScoredShoe) => number, why: (s: ScoredShoe) => string) => {
    const hit = cands.filter((s) => !used.has(s.shoe.id) && ok(s)).sort((a, b) => rank(a, b) || b.score - a.score)[0];
    if (!hit) return;
    used.add(hit.shoe.id);
    out.push({ label, why: why(hit), sc: hit });
  };
  const p = primary.shoe;
  take('SOFTEST RIDE', (s) => s.shoe.cushioning > p.cushioning, (a, b) => b.shoe.cushioning - a.shoe.cushioning, (s) => `Softer: ${s.shoe.cushioning}/10 vs ${p.cushioning}/10`);
  take('LIGHTEST', (s) => s.shoe.weightGrams <= p.weightGrams - 15, (a, b) => a.shoe.weightGrams - b.shoe.weightGrams, (s) => `Lighter: ${s.shoe.weightGrams} g vs ${p.weightGrams} g`);
  take('BEST VALUE', (s) => getPriceTier(s.shoe.priceUSD).tier !== getPriceTier(p.priceUSD).tier && s.shoe.priceUSD < p.priceUSD, (a, b) => a.shoe.priceUSD - b.shoe.priceUSD, (s) => `${getPriceTier(s.shoe.priceUSD).label} band vs ${getPriceTier(p.priceUSD).label}`);
  if (wantsWide || !p.widthOptions) take('WIDE SIZES LISTED', (s) => s.shoe.widthOptions, () => 0, () => 'Wide sizes are listed for this shoe');
  return out;
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

/** One button for a shoe card: Amazon when verified, otherwise the honest fallback. */
function oneButton(d: Doc, x: number, y: number, w: number, h: number, shoe: Shoe, short = false) {
  const a = getShoeActions(shoe);
  if (a.buy) button(d, x, y, w, h, short ? (a.buy.label.includes('(') ? "BUY (WOMEN'S)" : 'BUY ON AMAZON') : a.buy.label, a.buy.url, 'primary');
  else if (a.brandSite) button(d, x, y, w, h, a.brandSite.label, a.brandSite.url, 'muted');
  else button(d, x, y, w, h, a.review.label, a.review.url, 'secondary');
}

export async function buildResultsPDF(
  data: PDFData,
  options: BuildOptions = {},
): Promise<{ doc: jsPDF; stats: { pages: number; photos: number; buyButtons: number; shownShoeIds: string[] } }> {
  const get = options.fetchImage ?? defaultFetch;
  const { answers, recommendation: rec, rotation, radarData } = data;
  const slug = data.slug ?? generateSlug(answers);
  const pool = scoreShoes(answers);
  const lead = data.topShoes && data.topShoes.length > 0 ? data.topShoes : pool;
  // Best first: the matches the page showed, then the rest of the ranking in the same order.
  const ordered = [...lead, ...pool.filter((p) => !lead.some((t) => t.shoe.id === p.shoe.id))];
  const top3 = ordered.slice(0, 3);
  const top5 = ordered.slice(0, 5);
  const more = ordered.slice(3, 10);
  const primary = rotation.primary ?? ordered[0];
  const profile = describeRunnerProfile(answers);
  const who = `${profile.who} | ${profile.distance} | ${profile.terrain}`;
  const safety = getSafetyNotice(answers);
  const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const wantsWide = answers.footType === 'wide';
  const priorities = pickByPriority(ordered, ordered[0], wantsWide).slice(0, 4);
  const gear = selectGear(answers, 6).map(toGearCard);

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
  for (const s of [primary, rotation.speed, rotation.longRun, ...top5, ...more, ...priorities.map((p) => p.sc)]) if (s) wanted.set(s.shoe.id, s.shoe);
  const [logo, ...loaded] = await Promise.all([
    get(assetPath('/images/gearuptofit-logo.png')).then((b) => (b ? blobToImg(b) : null)).catch(() => null),
    ...[...wanted.values()].map((shoe) => loadShoePhoto(shoe, get)),
    ...gear.map((g) => (g.image ? get(g.image).then((b) => (b ? blobToImg(b) : null)).catch(() => null) : Promise.resolve(null))),
  ]);
  const shoeIds = [...wanted.keys()];
  const photos = new Map<string, Img | null>(shoeIds.map((id, i) => [id, loaded[i] ?? null]));
  const gearPhotos = gear.map((_, i) => loaded[shoeIds.length + i] ?? null);
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

  const buyShown = new Set<string>();
  const countBuy = (shoe: Shoe) => {
    if (getShoeActions(shoe).buy) buyShown.add(shoe.id);
  };

  // =========================================================================
  // PAGE 1: cover band, result, top 3 at a glance
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
  text(d, `${reportDate}  |  RunMatch AI by GearUpToFit  |  ${shoeDatabase.length} shoes scored`, M + 28, 34.5, { size: 7.5, color: [150, 158, 172] as RGB, maxW: CW - 28 });
  y = 53;

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

  // ---- top 3 at a glance ----
  const cardH = 92;
  ensure(14 + cardH + 4);
  y = sectionHeading(d, y, 'Your top 3 at a glance', 'Ranked by match score. Every photo and Buy button comes from the same Amazon listing.');
  {
    const gap = 4;
    const cwid = (CW - gap * 2) / 3;
    top3.forEach((sc, i) => {
      const s = sc.shoe;
      const x0 = M + i * (cwid + gap);
      box(d, x0, y, cwid, cardH, 3, C.white, i === 0 ? C.red : C.line);
      if (i === 0) {
        fill(d, C.red);
        d.roundedRect(x0, y, cwid, 2.4, 1.2, 1.2, 'F');
      }
      pill(d, x0 + 3, y + 4.6, i === 0 ? '#1 BEST MATCH' : `#${i + 1}`, i === 0 ? C.redSoft : C.panel, i === 0 ? C.redDark : C.muted, 6.2, 4.8);
      photoFrame(d, x0 + 3, y + 12, cwid - 6, 44, photoOf(s), s);
      matchBadge(d, x0 + cwid - 10, y + 18.5, 6.4, sc.matchPercent);
      text(d, s.brand.toUpperCase(), x0 + 4, y + 58.6, { size: 6.4, bold: true, color: C.red, maxW: cwid - 8, maxLines: 1 });
      text(d, s.model, x0 + 4, y + 62.2, { size: 9.6, bold: true, color: C.ink, maxW: cwid - 8, maxLines: 2, lh: 1.1 });
      text(d, `${CATEGORY_LABEL[s.category]}  |  ${getPriceTier(s.priceUSD).label}`, x0 + 4, y + 71.6, { size: 6.8, color: C.muted, maxW: cwid - 8, maxLines: 1 });
      text(d, `${s.cushioning}/10 cushion  |  ${s.dropMM} mm  |  ${s.weightGrams} g`, x0 + 4, y + 75.6, { size: 6.8, bold: true, color: C.text, maxW: cwid - 8, maxLines: 1 });
      oneButton(d, x0 + 3, y + cardH - 10, cwid - 6, 7.4, s, true);
      countBuy(s);
    });
    y += cardH + 6;
  }
  text(d, 'Photos are from the Amazon listing each button opens; the colour you order may differ. Launch price bands, not live prices: Amazon shows today\'s price.', M, y, { size: 6.8, italic: true, color: C.muted, maxW: CW, maxLines: 2 });

  // =========================================================================
  // Your answers, then the #1 match in depth
  // =========================================================================
  y += 11;
  ensure(50);
  y = sectionHeading(d, y, 'Based on your answers');
  const chips: [string, string][] = [
    ['FOOT TYPE', FOOT_LABEL[answers.footType] ?? answers.footType],
    ['GAIT', GAIT_LABEL[answers.pronation] ?? answers.pronation],
    ['WEEKLY VOLUME', `${answers.weeklyMileage} km (${Math.round(answers.weeklyMileage * 0.621)} mi)`],
    ['RACE DISTANCE', DIST_LABEL[answers.distance] ?? answers.distance],
    ['TERRAIN', TERRAIN_LABEL[answers.terrain] ?? answers.terrain],
    ['PACE GOAL', PACE_LABEL[answers.paceGoal] ?? answers.paceGoal],
    ['BUDGET', budgetText(answers.budget)],
    ['PAIN / INJURY', safety ? safety.reported.map(cap).join(', ') : 'None reported'],
  ];
  const cw = (CW - 3 * 3) / 4;
  chips.forEach(([label, value], i) => {
    const cx = M + (i % 4) * (cw + 3);
    const cy = y + Math.floor(i / 4) * 16;
    box(d, cx, cy, cw, 14, 2, C.panel);
    text(d, label, cx + 3, cy + 2.4, { size: 6.4, bold: true, color: C.muted, maxW: cw - 6 });
    text(d, value, cx + 3, cy + 6.8, { size: 8.6, bold: true, color: C.ink, maxW: cw - 6, maxLines: 2, lh: 1.15 });
  });
  y += 36;

  // #1 MATCH hero card
  const heroH = 156;
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
    const kindBits = [CATEGORY_LABEL[s.category], supportLabel(s), terrainLabel(s)].filter((b, i, all) => all.findIndex((o) => o.toLowerCase() === b.toLowerCase()) === i);
    text(d, kindBits.join('  |  '), rx, y + 59, { size: 7.4, bold: true, color: C.text, maxW: rw, maxLines: 1 });
    text(d, `${tier.range}. Launch price band, not a live price.`, rx, y + 64, { size: 6.8, color: C.muted, maxW: rw, maxLines: 2 });
    if (photoOf(s) && resolveShoePhoto(s)?.source === 'amazon') text(d, 'Photo: Amazon listing. Colours vary.', x0 + 8, y + 75.4, { size: 6, italic: true, color: C.faint, maxW: 70 });

    // why it scored (left) + check before you buy (right)
    const colY = y + 82;
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

    // who it suits / who should look elsewhere
    const fitY = y + 112;
    stroke(d, C.line, 0.25);
    d.line(x0 + 8, fitY - 3, x0 + CW - 8, fitY - 3);
    const fs = fitSummary(s, answers);
    text(d, 'WHO IT SUITS', x0 + 8, fitY, { size: 7, bold: true, color: C.green, maxW: colW });
    text(d, 'WHO SHOULD LOOK ELSEWHERE', wx, fitY, { size: 7, bold: true, color: C.amber, maxW: colW });
    let ly = fitY + 5;
    for (const t of fs.suits) ly += text(d, `${BUL}  ${t}`, x0 + 8, ly, { size: 7.4, color: C.text, maxW: colW, maxLines: 2, lh: 1.25 }) + 0.8;
    let ry = fitY + 5;
    for (const t of fs.elsewhere) ry += text(d, `${BUL}  ${t}`, wx, ry, { size: 7.4, color: C.text, maxW: colW, maxLines: 2, lh: 1.25 }) + 0.8;

    shoeButtons(d, x0 + 8, y + heroH - 13.5, CW - 16, 9, s);
    countBuy(s);
    y += heroH + 8;
  }

  // =========================================================================
  // PICK BY PRIORITY
  // =========================================================================
  // Drawn right after the hero when it fits on that page; otherwise after the comparison table (so it never sits alone on a page).
  let picksDone = false;
  const drawPriorities = () => {
    picksDone = true;
    ensure(14 + 62);
    y = sectionHeading(d, y, 'If one thing matters most', 'Strong matches that beat your #1 on a single point. Each is within 20 points of the top score.');
    const gap = 3;
    const n = priorities.length;
    const pw = Math.min((CW - gap * (n - 1)) / n, 58);
    if (n < 3) {
      const nx = M + n * (pw + gap) + 3;
      text(d, 'Your #1 stays the best overall fit. These are for runners who would trade a little match score for one thing: a softer ride, a lighter shoe, a lower price band or wide sizes.', nx, y + 4, { size: 7.4, italic: true, color: C.muted, maxW: CW - (nx - M), maxLines: 6, lh: 1.35 });
    }
    priorities.forEach((p, i) => {
      const s = p.sc.shoe;
      const x0 = M + i * (pw + gap);
      box(d, x0, y, pw, 58, 2.5, C.white, C.line);
      pill(d, x0 + 2.5, y + 3, p.label, C.greenSoft, C.green, 5.6, 4.4);
      photoFrame(d, x0 + 2.5, y + 9.5, pw - 5, 24, photoOf(s), s);
      text(d, `${s.brand} ${s.model}`, x0 + 3, y + 35.6, { size: 7.6, bold: true, color: C.ink, maxW: pw - 6, maxLines: 2, lh: 1.1 });
      text(d, `${p.sc.matchPercent}% match`, x0 + 3, y + 43.2, { size: 6.8, bold: true, color: scoreColor(p.sc.matchPercent), maxW: pw - 6, maxLines: 1 });
      text(d, p.why, x0 + 3, y + 46.6, { size: 6.4, color: C.muted, maxW: pw - 6, maxLines: 1 });
      oneButton(d, x0 + 2.5, y + 51, pw - 5, 5.6, s, true);
      countBuy(s);
    });
    y += 58 + 7;
  };
  if (priorities.length && y + 14 + 62 <= BOTTOM) drawPriorities();

  // =========================================================================
  // COMPARE THE TOP 3
  // =========================================================================
  {
    const cols = top3;
    const labelW = 30;
    const colW = (CW - labelW) / cols.length;
    const rowH = 8.2;
    const rowsN = 10;
    ensure(14 + 44 + rowsN * rowH + 36);
    y = sectionHeading(d, y, 'Your top 3, side by side', 'Winners are marked where one shoe clearly leads. The specs are the maker\'s own and how we scored fit.');
    // header: photo, name, match
    cols.forEach((sc, i) => {
      const x0 = M + labelW + i * colW;
      photoFrame(d, x0 + 2, y, colW - 4, 30, photoOf(sc.shoe), sc.shoe);
      matchBadge(d, x0 + colW - 9, y + 6, 6, sc.matchPercent);
      text(d, sc.shoe.brand.toUpperCase(), x0 + 3, y + 31.6, { size: 6.2, bold: true, color: C.red, maxW: colW - 6, maxLines: 1 });
      text(d, sc.shoe.model, x0 + 3, y + 35, { size: 8.8, bold: true, color: C.ink, maxW: colW - 6, maxLines: 1 });
    });
    y += 42;
    const edge = (f: (s: Shoe) => number, dir: 'max' | 'min'): boolean[] => {
      const vals = cols.map((c) => f(c.shoe));
      const target = dir === 'max' ? Math.max(...vals) : Math.min(...vals);
      return vals.every((v) => v === target) ? vals.map(() => false) : vals.map((v) => v === target);
    };
    interface Row {
      label: string;
      value: (sc: ScoredShoe) => string;
      win?: boolean[];
      winLabel?: string;
    }
    const matchWin = (() => {
      const v = cols.map((c) => c.matchPercent);
      const t = Math.max(...v);
      return v.every((x) => x === t) ? v.map(() => false) : v.map((x) => x === t);
    })();
    const rows: Row[] = [
      { label: 'MATCH', value: (sc) => `${sc.matchPercent}%`, win: matchWin, winLabel: 'TOP' },
      { label: 'TYPE', value: (sc) => CATEGORY_LABEL[sc.shoe.category] },
      { label: 'CUSHIONING', value: (sc) => `${sc.shoe.cushioning} / 10`, win: edge((s) => s.cushioning, 'max'), winLabel: 'SOFTEST' },
      { label: 'HEEL DROP', value: (sc) => `${sc.shoe.dropMM} mm` },
      { label: 'WEIGHT', value: (sc) => `${sc.shoe.weightGrams} g`, win: edge((s) => s.weightGrams, 'min'), winLabel: 'LIGHTEST' },
      { label: 'TERRAIN', value: (sc) => terrainLabel(sc.shoe) },
      { label: 'MODEL YEAR', value: (sc) => (sc.newerVersion ? `${sc.shoe.year} (newer exists)` : String(sc.shoe.year)) },
      { label: 'PRICE BAND', value: (sc) => getPriceTier(sc.shoe.priceUSD).label, win: edge((s) => s.priceUSD, 'min'), winLabel: 'LOWEST' },
      { label: 'WIDE SIZES', value: (sc) => (sc.shoe.widthOptions ? 'Listed' : 'Not listed') },
      { label: 'BEST FOR', value: (sc) => sc.shoe.bestFor.slice(0, 2).map(prettyTag).join(', ') },
    ];
    rows.forEach((r, ri) => {
      if (ri % 2 === 0) box(d, M, y, CW, rowH, 1.6, C.panel);
      text(d, r.label, M + 3, y + 2.6, { size: 6.6, bold: true, color: C.muted, maxW: labelW - 4 });
      cols.forEach((sc, i) => {
        const x0 = M + labelW + i * colW;
        const isWin = r.win?.[i] ?? false;
        const val = r.value(sc);
        text(d, val, x0 + 3, y + 2.2, { size: 8.4, bold: true, color: isWin ? C.green : C.ink, maxW: colW - (isWin ? 24 : 6), maxLines: 1 });
        if (isWin && r.winLabel) pill(d, x0 + colW - 21, y + 1.4, r.winLabel, C.greenSoft, C.green, 5.4, 4.6);
      });
      y += rowH;
    });
    y += 5;

    // how to choose between them
    const [a] = cols;
    const names = (flags: boolean[]) => cols.filter((_, i) => flags[i]).map((x) => nameOf(x.shoe));
    const advice: string[] = [];
    const softW = names(edge((s) => s.cushioning, 'max'));
    if (softW.length === 1) advice.push(`Choose the ${softW[0]} for the softest ride.`);
    const lightW = names(edge((s) => s.weightGrams, 'min'));
    if (lightW.length === 1) advice.push(`Choose the ${lightW[0]} for the lightest, quickest feel.`);
    const cheapW = names(edge((s) => s.priceUSD, 'min'));
    if (cheapW.length === 1) advice.push(`Choose the ${cheapW[0]} to keep the cost down.`);
    const wideSome = cols.filter((x) => x.shoe.widthOptions);
    if (wideSome.length > 0 && wideSome.length < cols.length) advice.push(`Wide sizes are listed only for the ${wideSome.map((x) => nameOf(x.shoe)).join(' and ')}.`);
    if (advice.length === 0) advice.push(`These three are very close on the specs we track. Try them on and keep the one that feels best; the ${nameOf(a.shoe)} is the safest starting point.`);
    const adviceOpts = { size: 8, color: C.text, maxW: CW - 10, lh: 1.35 } as const;
    const adviceH = 10 + advice.reduce((s, t) => s + textHeight(d, `${BUL}  ${t}`, adviceOpts) + 1.4, 0);
    ensure(adviceH + 4);
    box(d, M, y, CW, adviceH, 2.5, C.white, C.line);
    text(d, 'HOW TO CHOOSE BETWEEN THEM', M + 4, y + 3, { size: 6.8, bold: true, color: C.muted, maxW: 100 });
    let ay = y + 8.5;
    for (const t of advice) ay += text(d, `${BUL}  ${t}`, M + 4, ay, adviceOpts) + 1.4;
    y += adviceH + 7;
  }
  if (priorities.length && !picksDone) drawPriorities();

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
  // MORE STRONG MATCHES (ranks 4 to 10)
  // =========================================================================
  if (more.length) {
    const rowH = 22;
    ensure(14 + 9 + rowH * Math.min(3, more.length) + 4);
    y = sectionHeading(d, y, `More strong matches (ranks 4 to ${3 + more.length})`, 'The same scoring, further down the list. Each row has the key specs and where to buy or read more.');
    const col = { n: 8, photo: 22, name: 56, match: 20, cush: 14, drop: 13, wt: 13, buy: 36 };
    const headH = 7;
    ensure(headH + rowH + 2);
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
      if (h) text(d, h, cx, y + 2, { size: 6.6, bold: true, color: C.white, align: al, maxW: w });
      cx += w;
    });
    y += headH + 1;
    more.forEach((sc, i) => {
      ensure(rowH + 2);
      const s = sc.shoe;
      if (i % 2 === 0) box(d, M, y, CW, rowH, 2, C.panel);
      let x = M;
      text(d, String(i + 4), x, y + rowH / 2 - 2.6, { size: 10.5, bold: true, color: C.muted, align: 'center', maxW: col.n });
      x += col.n;
      photoFrame(d, x, y + 2.5, col.photo - 2, rowH - 5, photoOf(s), s);
      x += col.photo;
      text(d, s.brand.toUpperCase(), x, y + 2.8, { size: 6.2, bold: true, color: C.red, maxW: col.name - 3, maxLines: 1 });
      text(d, s.model, x, y + 6.4, { size: 8.8, bold: true, color: C.ink, maxW: col.name - 3, maxLines: 2, lh: 1.1 });
      const watch = sc.newerVersion ? `A newer version exists: ${nameOf(sc.newerVersion)}.` : `${CATEGORY_LABEL[s.category]}  |  ${getPriceTier(s.priceUSD).label}`;
      text(d, watch, x, y + 14.8, { size: 6.6, italic: !!sc.newerVersion, color: sc.newerVersion ? C.amber : C.muted, maxW: col.name - 3, maxLines: 2, lh: 1.15 });
      x += col.name;
      text(d, `${sc.matchPercent}%`, x, y + 4.4, { size: 10.5, bold: true, color: scoreColor(sc.matchPercent), align: 'center', maxW: col.match });
      bar(d, x + 3, y + 11.4, col.match - 6, 1.8, sc.matchPercent, scoreColor(sc.matchPercent));
      x += col.match;
      [`${s.cushioning}/10`, `${s.dropMM}`, `${s.weightGrams}`].forEach((v, k) => {
        const w = [col.cush, col.drop, col.wt][k];
        text(d, v, x, y + rowH / 2 - 2.2, { size: 8.2, bold: true, color: C.ink, align: 'center', maxW: w });
        x += w;
      });
      const a = getShoeActions(s);
      const bx = x + 2;
      const bw = col.buy - 4;
      if (a.buy) {
        button(d, bx, y + 3, bw, 7.4, a.buy.label.includes('(') ? "BUY (WOMEN'S)" : 'BUY ON AMAZON', a.buy.url, 'primary');
        button(d, bx, y + 11.6, bw, 7.4, 'REVIEW', a.review.url, 'secondary');
        countBuy(s);
      } else if (a.brandSite) {
        button(d, bx, y + 3, bw, 7.4, 'REVIEW', a.review.url, 'secondary');
        button(d, bx, y + 11.6, bw, 7.4, a.brandSite.label, a.brandSite.url, 'muted');
      } else {
        button(d, bx, y + 7.3, bw, 7.4, 'REVIEW', a.review.url, 'secondary');
      }
      y += rowH + 1.2;
    });
    y += 3;
    const notes = [
      'Match: how well the shoe fits your answers across nine weighted factors. It is not a quality score for the shoe.',
      "Cush.: our own 1-10 cushioning scale, not a lab measurement. Drop: heel height minus forefoot height, in mm. G: weight in grams (men's sample size).",
      'A Buy on Amazon button appears only when we have checked that the listing is this exact model. Where we have not, you get a link to our review and to the maker instead of a guess.',
    ].map((n) => `${BUL}  ${n}`);
    const noteOpts = { size: 7.2, color: C.text, maxW: CW - 8, lh: 1.3 } as const;
    const notesH = 9 + notes.reduce((s, n) => s + textHeight(d, n, noteOpts) + 1.4, 0);
    ensure(notesH + 4);
    box(d, M, y, CW, notesH, 2.5, C.white, C.line);
    text(d, 'HOW TO READ THIS TABLE', M + 4, y + 3, { size: 6.8, bold: true, color: C.muted, maxW: 80 });
    let ny = y + 8;
    for (const n of notes) ny += text(d, n, M + 4, ny, noteOpts) + 1.4;
    y += notesH + 6;
  }

  // =========================================================================
  // FIT, TRY-ON, SHOE LOG
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

  // printable shoe log
  {
    const logRows = 6;
    const rowH = 9;
    ensure(14 + 8 + logRows * rowH + 12);
    y = sectionHeading(d, y, 'Your shoe log', `Write down when you start each pair and how far it has gone. Many runners replace shoes ${replacementWindow(answers.weeklyMileage)}.`);
    const cols = [
      { h: 'PAIR', w: 66 },
      { h: 'DATE STARTED', w: 28 },
      { h: 'PLAN TO REPLACE AT', w: 36 },
      { h: 'KM SO FAR', w: 22 },
      { h: 'NOTES', w: 30 },
    ];
    box(d, M, y, CW, 7.4, 2, C.band);
    let x = M;
    cols.forEach((c) => {
      text(d, c.h, x + 3, y + 2.2, { size: 6.4, bold: true, color: C.white, maxW: c.w - 4 });
      x += c.w;
    });
    y += 8.4;
    const named = [...new Map([primary, rotation.speed, rotation.longRun, ...top3].filter((s): s is ScoredShoe => !!s).map((s) => [s.shoe.id, s])).values()].slice(0, 3);
    for (let r = 0; r < logRows; r++) {
      if (r % 2 === 0) box(d, M, y, CW, rowH, 1.6, C.panel);
      const sc = named[r];
      if (sc) text(d, nameOf(sc.shoe), M + 3, y + 3, { size: 8.2, bold: true, color: C.ink, maxW: cols[0].w - 5, maxLines: 1 });
      if (sc) text(d, '500-800 km', M + cols[0].w + cols[1].w + 3, y + 3, { size: 8, color: C.muted, maxW: cols[2].w - 5 });
      stroke(d, C.line, 0.25);
      let lx = M;
      cols.forEach((c) => {
        lx += c.w;
        if (lx < M + CW - 1) d.line(lx, y + 1, lx, y + rowH - 1);
      });
      y += rowH;
    }
    y += 6;
  }

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
  // COMPLETE YOUR KIT (verified gear, same listing for photo and link)
  // =========================================================================
  if (gear.length) {
    const gh = 70;
    ensure(14 + gh + 6);
    y = sectionHeading(d, y, 'Complete your kit', 'Gear picked for your distance and terrain. Each photo and link comes from the same Amazon listing. None of it changes a shoe ranking.');
    const gap = 4;
    const gw = (CW - gap * 2) / 3;
    gear.slice(0, 6).forEach((g, i) => {
      if (i > 0 && i % 3 === 0) y += gh + 4;
      if (i % 3 === 0) ensure(gh + 4);
      const x0 = M + (i % 3) * (gw + gap);
      box(d, x0, y, gw, gh, 2.5, C.white, C.line);
      photoFrame(d, x0 + 3, y + 3, gw - 6, 32, gearPhotos[i], { brand: g.brand, model: g.name });
      text(d, g.name, x0 + 4, y + 37.5, { size: 8.2, bold: true, color: C.ink, maxW: gw - 8, maxLines: 2, lh: 1.1 });
      text(d, g.why, x0 + 4, y + 46, { size: 6.8, color: C.text, maxW: gw - 8, maxLines: 3, lh: 1.2 });
      button(d, x0 + 3, y + gh - 10, gw - 6, 7, 'VIEW ON AMAZON', g.url, 'primary');
    });
    y += gh + 8;
  }

  // =========================================================================
  // PROFILE RADAR, TRAINING
  // =========================================================================
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
  text(d, 'As an Amazon Associate, GearUpToFit earns from qualifying purchases. Links on "Buy on Amazon" and "View on Amazon" buttons are affiliate links; they cost you nothing extra and do not change any ranking.', M + 4, y + 6.4, { size: 7.2, color: C.text, maxW: CW - 8, maxLines: 2, lh: 1.3 });
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

  const shown = new Set<string>(wanted.keys());
  return {
    doc: d,
    stats: {
      pages: total,
      photos: [...shown].filter((id) => photos.get(id)).length,
      buyButtons: buyShown.size,
      shownShoeIds: [...shown],
    },
  };
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
