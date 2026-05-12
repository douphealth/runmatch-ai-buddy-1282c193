import jsPDF from 'jspdf';
import { QuizAnswers } from './quiz-data';
import { ShoeRecommendation } from './recommendation-engine';
import { ScoredShoe } from './scoring-engine';
import { getRecommendedArticles, getInjuryArticles, getToolLinks } from './article-links';
import { shoeImageSlug } from './shoe-images';

interface PDFData {
  answers: QuizAnswers;
  recommendation: ShoeRecommendation;
  rotation: {
    primary: ScoredShoe;
    speed?: ScoredShoe;
    longRun?: ScoredShoe;
  };
  radarData: { axis: string; value: number }[];
}

// ─── Clean white + red accent palette ───
const C = {
  red: [200, 30, 30] as const,
  redLight: [220, 50, 50] as const,
  redBg: [255, 240, 240] as const,
  dark: [30, 30, 35] as const,
  text: [40, 40, 50] as const,
  textLight: [100, 105, 115] as const,
  textMuted: [140, 145, 155] as const,
  white: [255, 255, 255] as const,
  bg: [250, 250, 252] as const,
  cardBg: [255, 255, 255] as const,
  border: [220, 222, 228] as const,
  green: [25, 160, 80] as const,
  greenBg: [235, 250, 240] as const,
  blue: [30, 100, 200] as const,
  blueBg: [235, 245, 255] as const,
  purple: [100, 60, 180] as const,
  purpleBg: [245, 240, 255] as const,
  accent: [230, 160, 30] as const,
  accentBg: [255, 248, 230] as const,
};

type RGB = readonly [number, number, number];

const PW = 210;
const PH = 297;
const M = 16;
const CW = PW - M * 2;

// ─── Helpers ───

function rr(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, fill: RGB, stroke?: RGB) {
  doc.setFillColor(fill[0], fill[1], fill[2]);
  if (stroke) {
    doc.setDrawColor(stroke[0], stroke[1], stroke[2]);
    doc.setLineWidth(0.4);
  }
  if (typeof (doc as any).roundedRect === 'function') {
    (doc as any).roundedRect(x, y, w, h, r, r, stroke ? 'FD' : 'F');
  } else {
    doc.rect(x, y, w, h, stroke ? 'FD' : 'F');
  }
}

function pill(doc: jsPDF, x: number, y: number, text: string, bg: RGB, fg: RGB) {
  const tw = doc.getTextWidth(text) + 6;
  rr(doc, x, y, tw, 6, 3, bg);
  doc.setFontSize(5.5);
  doc.setTextColor(fg[0], fg[1], fg[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(text, x + 3, y + 4.2);
  return tw;
}

function sectionTitle(doc: jsPDF, y: number, title: string, color: RGB = C.red): number {
  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(M, y, 3, 8, 'F');
  doc.setFontSize(11);
  doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(title, M + 7, y + 6);
  return y + 12;
}

function labelValue(doc: jsPDF, x: number, y: number, label: string, value: string, maxW: number = 35) {
  doc.setFontSize(5);
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(label, x, y, { charSpace: 0.4 } as any);
  doc.setFontSize(7.5);
  doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.setFont('helvetica', 'bold');
  // Auto-truncate based on actual width
  let val = value;
  while (doc.getTextWidth(val) > maxW && val.length > 4) val = val.slice(0, -1);
  if (val !== value) val = val.slice(0, -1) + '…';
  doc.text(val, x, y + 4.5);
}

function link(doc: jsPDF, x: number, y: number, text: string, url: string, size: number = 6.5) {
  doc.setFontSize(size);
  doc.setTextColor(C.red[0], C.red[1], C.red[2]);
  doc.setFont('helvetica', 'bold');
  doc.textWithLink(text, x, y, { url });
}

function drawRadar(doc: jsPDF, cx: number, cy: number, radius: number, data: { axis: string; value: number }[]) {
  const n = data.length;
  const step = (2 * Math.PI) / n;
  const start = -Math.PI / 2;

  // Grid rings
  for (let ring = 1; ring <= 5; ring++) {
    const r = (radius * ring) / 5;
    doc.setDrawColor(C.border[0], C.border[1], C.border[2]);
    doc.setLineWidth(0.15);
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const a = start + (i % n) * step;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      doc.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    }
  }

  // Axes
  for (let i = 0; i < n; i++) {
    const a = start + i * step;
    doc.setDrawColor(C.border[0], C.border[1], C.border[2]);
    doc.setLineWidth(0.15);
    doc.line(cx, cy, cx + radius * Math.cos(a), cy + radius * Math.sin(a));
  }

  // Data polygon
  const dp: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = start + i * step;
    const r = (radius * data[i].value) / 10;
    dp.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }

  // Outline
  doc.setDrawColor(C.red[0], C.red[1], C.red[2]);
  doc.setLineWidth(0.7);
  for (let i = 0; i < dp.length; i++) {
    const next = (i + 1) % dp.length;
    doc.line(dp[i][0], dp[i][1], dp[next][0], dp[next][1]);
  }

  // Points
  for (const p of dp) {
    doc.setFillColor(C.red[0], C.red[1], C.red[2]);
    doc.circle(p[0], p[1], 1.3, 'F');
    doc.setFillColor(255, 255, 255);
    doc.circle(p[0], p[1], 0.6, 'F');
  }

  // Labels
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  for (let i = 0; i < n; i++) {
    const a = start + i * step;
    const lr = radius + 7;
    const lx = cx + lr * Math.cos(a);
    const ly = cy + lr * Math.sin(a);
    const align = Math.abs(Math.cos(a)) < 0.3 ? 'center' : Math.cos(a) > 0 ? 'left' : 'right';
    doc.setTextColor(C.text[0], C.text[1], C.text[2]);
    doc.text(data[i].axis, lx, ly + 1, { align: align as any });
    // Value
    doc.setFontSize(5);
    doc.setTextColor(C.red[0], C.red[1], C.red[2]);
    doc.text(`${data[i].value}/10`, lx, ly + 4.5, { align: align as any });
    doc.setFontSize(6.5);
  }
}

// ─── Page chrome ───

async function addLogo(doc: jsPDF, y: number): Promise<number> {
  try {
    const response = await fetch('/images/gearuptofit-logo.png');
    const blob = await response.blob();
    const reader = new FileReader();
    return new Promise((resolve) => {
      reader.onloadend = () => {
        try {
          doc.addImage(reader.result as string, 'PNG', M, y, 28, 28);
          resolve(y);
        } catch {
          resolve(y);
        }
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    return y;
  }
}

function addHeader(doc: jsPDF) {
  // Top red line
  doc.setFillColor(C.red[0], C.red[1], C.red[2]);
  doc.rect(0, 0, PW, 2.5, 'F');

  // Brand text (logo loaded async separately)
  doc.setFontSize(8);
  doc.setTextColor(C.red[0], C.red[1], C.red[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('GEAR UP TO FIT', M, 11);

  doc.setFontSize(5.5);
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.setFont('helvetica', 'normal');
  doc.textWithLink('gearuptofit.com', M, 15, { url: 'https://gearuptofit.com/' });

  // Right side
  doc.setFontSize(7);
  doc.setTextColor(C.red[0], C.red[1], C.red[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('RUNMATCH AI', PW - M, 11, { align: 'right' });

  doc.setFontSize(5.5);
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.setFont('helvetica', 'normal');
  doc.text('Personalized Running Shoe Report', PW - M, 15, { align: 'right' });

  // Separator
  doc.setDrawColor(C.border[0], C.border[1], C.border[2]);
  doc.setLineWidth(0.4);
  doc.line(M, 19, PW - M, 19);
}

function addFooter(doc: jsPDF, page: number, total: number) {
  doc.setDrawColor(C.border[0], C.border[1], C.border[2]);
  doc.setLineWidth(0.3);
  doc.line(M, PH - 16, PW - M, PH - 16);

  doc.setFontSize(5);
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.setFont('helvetica', 'normal');
  doc.text('Generated by RunMatch AI  |  gearuptofit.com  |  Gear Up. Show Up. Level Up.', M, PH - 11);
  doc.text(`Page ${page} of ${total}`, PW - M, PH - 11, { align: 'right' });

  doc.setFontSize(4.5);
  doc.text('Educational content — not medical advice. Consult a qualified clinician before changing footwear if injured. As an Amazon Associate, GearUpToFit earns from qualifying purchases.', M, PH - 7);

  // Bottom red line
  doc.setFillColor(C.red[0], C.red[1], C.red[2]);
  doc.rect(0, PH - 2.5, PW, 2.5, 'F');
}

import { getAmazonLinkForShoe } from './amazon-link';

function amazonLink(id: string, brand: string, model: string, asin?: string): string {
  return getAmazonLinkForShoe(id, brand, model, asin);
}

// Loads a shoe product image as a base64 PNG/JPG so jsPDF can embed it.
// Returns null if the file does not exist (caller falls back to a styled placeholder).
async function loadShoeImage(brand: string, model: string): Promise<{ data: string; format: 'JPEG' | 'PNG' } | null> {
  const slug = shoeImageSlug(brand, model);
  const url = `/images/shoes/${slug}.jpg`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    if (blob.size < 2000) return null; // tiny / placeholder
    const data = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const format: 'JPEG' | 'PNG' = blob.type.includes('png') ? 'PNG' : 'JPEG';
    return { data, format };
  } catch {
    return null;
  }
}

// Draws a premium framed product image with soft shadow + brand-tinted background.
// Falls back to a clean labelled placeholder when no image is available.
function drawShoeFrame(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  img: { data: string; format: 'JPEG' | 'PNG' } | null,
  brand: string,
  model: string,
) {
  // Soft drop shadow
  doc.setFillColor(0, 0, 0);
  (doc as any).setGState && (doc as any).setGState(new (doc as any).GState({ opacity: 0.06 }));
  if (typeof (doc as any).roundedRect === 'function') {
    (doc as any).roundedRect(x + 0.6, y + 0.8, w, h, 2, 2, 'F');
  } else {
    doc.rect(x + 0.6, y + 0.8, w, h, 'F');
  }
  (doc as any).setGState && (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));

  // Frame background (subtle off-white studio)
  rr(doc, x, y, w, h, 2, [248, 249, 251], C.border);

  // Floor shadow strip
  doc.setFillColor(0, 0, 0);
  (doc as any).setGState && (doc as any).setGState(new (doc as any).GState({ opacity: 0.08 }));
  doc.ellipse(x + w / 2, y + h - 2.5, w * 0.32, 1.1, 'F');
  (doc as any).setGState && (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));

  if (img) {
    const pad = 2.2;
    const boxW = w - pad * 2;
    const boxH = h - pad * 2 - 1.8; // leave room for floor shadow
    try {
      // Preserve aspect ratio: contain-fit the image within the inner box and center it.
      const props: any = (doc as any).getImageProperties ? (doc as any).getImageProperties(img.data) : null;
      const iw = props?.width ?? boxW;
      const ih = props?.height ?? boxH;
      const scale = Math.min(boxW / iw, boxH / ih);
      const drawW = iw * scale;
      const drawH = ih * scale;
      const drawX = x + pad + (boxW - drawW) / 2;
      const drawY = y + pad + (boxH - drawH) / 2;
      doc.addImage(img.data, img.format, drawX, drawY, drawW, drawH, undefined, 'FAST');
    } catch {
      // ignore — placeholder text will be drawn below
    }
  } else {
    // Clean labelled placeholder
    doc.setFontSize(5.5);
    doc.setTextColor(C.red[0], C.red[1], C.red[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(brand.toUpperCase(), x + w / 2, y + h / 2 - 1, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
    const lines = doc.splitTextToSize(model, w - 4);
    doc.text(lines.slice(0, 2), x + w / 2, y + h / 2 + 3, { align: 'center' });
  }
}

// ─── Main generator ───

export async function generateResultsPDF(data: PDFData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { answers, recommendation: rec, rotation, radarData } = data;
  const totalPages = 5;

  // Load logo as base64
  let logoData: string | null = null;
  try {
    const resp = await fetch('/images/gearuptofit-logo.png');
    const blob = await resp.blob();
    logoData = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.readAsDataURL(blob);
    });
  } catch { /* no logo fallback */ }

  // Pre-load real product photos in parallel for the rotation shoes
  const [primaryImg, speedImg, longImg] = await Promise.all([
    rotation?.primary ? loadShoeImage(rotation.primary.shoe.brand, rotation.primary.shoe.model) : Promise.resolve(null),
    rotation?.speed ? loadShoeImage(rotation.speed.shoe.brand, rotation.speed.shoe.model) : Promise.resolve(null),
    rotation?.longRun ? loadShoeImage(rotation.longRun.shoe.brand, rotation.longRun.shoe.model) : Promise.resolve(null),
  ]);
  const shoeImageMap = new Map<string, { data: string; format: 'JPEG' | 'PNG' } | null>();
  if (rotation?.primary) shoeImageMap.set(rotation.primary.shoe.id, primaryImg);
  if (rotation?.speed) shoeImageMap.set(rotation.speed.shoe.id, speedImg);
  if (rotation?.longRun) shoeImageMap.set(rotation.longRun.shoe.id, longImg);

  // ═══════════════════════════════════════
  // PAGE 1: Profile + Primary Match
  // ═══════════════════════════════════════
  addHeader(doc);
  let y = 24;

  // Logo + Title block
  if (logoData) {
    try { doc.addImage(logoData, 'PNG', M, y, 18, 18); } catch {}
  }

  // Eyebrow tag above the title
  doc.setFontSize(6);
  doc.setTextColor(C.red[0], C.red[1], C.red[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('PERSONALIZED REPORT  ·  RUNMATCH AI', M + 22, y + 4, { charSpace: 0.6 } as any);

  doc.setFontSize(20);
  doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('YOUR RUNNING SHOE', M + 22, y + 11);
  doc.setTextColor(C.red[0], C.red[1], C.red[2]);
  doc.text('MATCH REPORT', M + 22, y + 19);

  // Red underline accent
  doc.setFillColor(C.red[0], C.red[1], C.red[2]);
  doc.rect(M + 22, y + 21.5, 32, 0.7, 'F');
  y += 26;

  // Date + report meta on a single line
  doc.setFontSize(6);
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.setFont('helvetica', 'normal');
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(`GENERATED ${dateStr.toUpperCase()}   ·   ID ${answers.terrain.toUpperCase()}-${answers.distance.toUpperCase()}-${answers.pronation.toUpperCase()}`, M, y, { charSpace: 0.4 } as any);
  y += 5;

  // Summary in a soft callout box for emphasis
  const sumLines = doc.splitTextToSize(rec.shoeProfile.summary, CW - 8);
  const sumH = sumLines.length * 3.6 + 5;
  rr(doc, M, y, CW, sumH, 2, C.bg);
  doc.setFillColor(C.red[0], C.red[1], C.red[2]);
  doc.rect(M, y, 1.5, sumH, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(C.text[0], C.text[1], C.text[2]);
  doc.setFont('helvetica', 'italic');
  doc.text(sumLines, M + 5, y + 4);
  y += sumH + 5;

  // ── Runner Profile Card ──
  rr(doc, M, y, CW, 72, 3, C.cardBg, C.border);
  y = sectionTitle(doc, y + 4, 'YOUR RUNNER PROFILE');

  // Stats grid (left 2 columns)
  const stats = [
    { l: 'SHOE CATEGORY', v: rec.shoeProfile.category },
    { l: 'CUSHIONING', v: rec.shoeProfile.cushioning },
    { l: 'HEEL DROP', v: rec.shoeProfile.dropRange },
    { l: 'SUPPORT TYPE', v: rec.shoeProfile.supportType },
    { l: 'WEEKLY VOLUME', v: `${answers.weeklyMileage} km/week` },
    { l: 'TERRAIN', v: answers.terrain.charAt(0).toUpperCase() + answers.terrain.slice(1) },
    { l: 'TARGET DISTANCE', v: answers.distance.replace(/-/g, ' ').toUpperCase() },
    { l: 'PACE GOAL', v: answers.paceGoal.charAt(0).toUpperCase() + answers.paceGoal.slice(1) },
  ];

  const colW = 42;
  stats.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const sx = M + 4 + col * colW;
    const sy = y + row * 13;
    rr(doc, sx, sy, colW - 4, 11, 2, C.bg);
    labelValue(doc, sx + 3, sy + 3, s.l, s.v);
  });

  // Radar chart (right side)
  try {
    drawRadar(doc, M + CW - 36, y + 24, 22, radarData);
  } catch { /* fallback */ }

  y += 56;

  // Injury + Brand pills
  if (answers.injuries.length > 0 && !answers.injuries.includes('none')) {
    doc.setFontSize(5.5);
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.setFont('helvetica', 'normal');
    doc.text('INJURY HISTORY:', M + 4, y);
    let px = M + 30;
    answers.injuries.forEach(inj => {
      const label = inj.replace(/-/g, ' ').toUpperCase();
      const tw = pill(doc, px, y - 3.5, label, C.redBg, C.red);
      px += tw + 2;
    });
    y += 6;
  }

  if (answers.brand.length > 0) {
    doc.setFontSize(5.5);
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.setFont('helvetica', 'normal');
    doc.text('PREFERRED BRANDS:', M + 4, y);
    let px = M + 34;
    answers.brand.forEach(b => {
      const tw = pill(doc, px, y - 3.5, b.toUpperCase(), C.blueBg, C.blue);
      px += tw + 2;
    });
    y += 8;
  }

  // ── #1 Match Card ──
  if (rotation?.primary) {
    const shoe = rotation.primary.shoe;
    const pct = rotation.primary.matchPercent;

    const cardH = 70;
    rr(doc, M, y, CW, cardH, 3, C.cardBg, C.border);

    // Left red accent
    doc.setFillColor(C.red[0], C.red[1], C.red[2]);
    doc.rect(M, y, 3, cardH, 'F');

    // Layout: left text column, right image column
    const imgW = 54;
    const imgH = cardH - 12;
    const imgX = PW - M - imgW - 4;
    const imgY = y + 6;
    const leftRight = imgX - 4; // right edge of text area

    // Product image (premium framed)
    drawShoeFrame(doc, imgX, imgY, imgW, imgH, shoeImageMap.get(shoe.id) ?? null, shoe.brand, shoe.model);

    // #1 badge
    rr(doc, M + 6, y + 4, 14, 14, 7, C.red);
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('#1', M + 13, y + 13, { align: 'center' });

    // Match % badge — top of image area
    rr(doc, imgX + imgW - 20, imgY + 1.5, 18, 9, 2, C.greenBg);
    doc.setFontSize(9);
    doc.setTextColor(C.green[0], C.green[1], C.green[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`${pct}%`, imgX + imgW - 11, imgY + 8, { align: 'center' });

    doc.setFontSize(5);
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.setFont('helvetica', 'normal');
    doc.text('YOUR BEST MATCH', M + 23, y + 9);

    doc.setFontSize(13);
    doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
    doc.setFont('helvetica', 'bold');
    const nameLines = doc.splitTextToSize(`${shoe.brand} ${shoe.model}`, leftRight - (M + 23));
    doc.text(nameLines.slice(0, 2), M + 23, y + 16);

    // Compliance: show MSRP tier, never a hard-coded price.
    const tierLabel = (p: number) => p < 110 ? 'BUDGET' : p < 160 ? 'MID-RANGE' : p < 220 ? 'PREMIUM' : 'SUPER-PREMIUM';
    doc.setFontSize(10);
    doc.setTextColor(C.red[0], C.red[1], C.red[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(tierLabel(shoe.priceUSD), M + 23, y + 24);

    // Meta chips: weight | drop | cushion — small uppercase divider style
    doc.setFontSize(6);
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.setFont('helvetica', 'normal');
    const metaTxt = `${shoe.weightGrams}G   ·   ${shoe.dropMM}MM DROP   ·   CUSHION ${shoe.cushioning}/10`;
    doc.text(metaTxt, M + 23, y + 28.5, { charSpace: 0.4 } as any);

    // Highlights (left column only)
    const hlY = y + 30;
    const hlMax = leftRight - (M + 14) - 2;
    shoe.highlights.slice(0, 3).forEach((h, i) => {
      doc.setFillColor(C.green[0], C.green[1], C.green[2]);
      doc.circle(M + 10, hlY + i * 5, 1, 'F');
      doc.setFontSize(6.5);
      doc.setTextColor(C.text[0], C.text[1], C.text[2]);
      doc.setFont('helvetica', 'normal');
      const hLines = doc.splitTextToSize(h, hlMax);
      doc.text(hLines[0], M + 14, hlY + i * 5 + 1);
    });

    // Top match reasons (compact, below highlights)
    const reasonsY = hlY + 3 * 5 + 2;
    doc.setFontSize(5);
    doc.setTextColor(C.red[0], C.red[1], C.red[2]);
    doc.setFont('helvetica', 'bold');
    doc.text('WHY IT MATCHES YOU', M + 8, reasonsY);
    rotation.primary.reasons.slice(0, 2).forEach((r, i) => {
      doc.setFillColor(C.red[0], C.red[1], C.red[2]);
      doc.circle(M + 10, reasonsY + 4 + i * 4.5, 0.9, 'F');
      doc.setFontSize(6);
      doc.setTextColor(C.text[0], C.text[1], C.text[2]);
      doc.setFont('helvetica', 'normal');
      const rLines = doc.splitTextToSize(r, hlMax);
      doc.text(rLines[0], M + 14, reasonsY + 4 + i * 4.5 + 1);
    });

    // Amazon button — sits below image
    const btnW = 40;
    const btnX = imgX + (imgW - btnW) / 2;
    const btnY = y + cardH - 7.5;
    rr(doc, btnX, btnY, btnW, 6.5, 2, C.red);
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('BUY ON AMAZON', btnX + btnW / 2, btnY + 4.4, { align: 'center' });
    doc.link(btnX, btnY, btnW, 6.5, { url: amazonLink(shoe.id, shoe.brand, shoe.model, shoe.amazonASIN) });

    // Review link bottom-left
    link(doc, M + 8, y + cardH - 3, 'Read Full Review on GearUpToFit', shoe.reviewURL, 5.5);

    y += cardH + 6;
  }

  // ── Why This Match Works ──
  if (y + 35 < PH - 22) {
    rr(doc, M, y, CW, 32, 3, C.accentBg, C.border);
    y = sectionTitle(doc, y + 3, 'WHY THIS MATCH WORKS', C.accent);
    doc.setFontSize(6.5);
    doc.setTextColor(C.text[0], C.text[1], C.text[2]);
    doc.setFont('helvetica', 'normal');
    const whyLines = doc.splitTextToSize(rec.whyItWorks, CW - 14);
    doc.text(whyLines.slice(0, 7), M + 7, y);
    y += whyLines.length * 3.2 + 4;

    link(doc, M + 7, y, 'How to Choose the Right Running Shoes -- gearuptofit.com', 'https://gearuptofit.com/running/how-to-choose-the-right-running-shoes/', 5.5);
    y += 8;
  }

  addFooter(doc, 1, totalPages);

  // ═══════════════════════════════════════
  // PAGE 2: Shoe Rotation Strategy
  // ═══════════════════════════════════════
  doc.addPage();
  addHeader(doc);
  y = 24;

  doc.setFontSize(18);
  doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('SHOE ROTATION STRATEGY', M, y);

  // Red underline accent
  doc.setFillColor(C.red[0], C.red[1], C.red[2]);
  doc.rect(M, y + 2, 28, 0.7, 'F');
  y += 7;

  doc.setFontSize(7);
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.setFont('helvetica', 'italic');
  doc.text('Rotate three purpose-built shoes to reduce injury risk and extend the life of every pair.', M, y);
  y += 5;

  rr(doc, M, y, CW, 9, 2, C.greenBg);
  doc.setFontSize(6.5);
  doc.setTextColor(C.green[0], C.green[1], C.green[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('Research shows multi-shoe rotation reduces injury risk by up to 39% (British Journal of Sports Medicine)', M + 4, y + 6);
  y += 13;

  const shoes = [
    { role: 'DAILY TRAINER', color: C.red, colorBg: C.redBg, shoe: rotation?.primary, desc: 'Easy runs, recovery, and general training' },
    rotation?.speed ? { role: 'SPEED WORK', color: C.blue, colorBg: C.blueBg, shoe: rotation.speed, desc: 'Tempo runs, intervals, and race day' } : null,
    rotation?.longRun ? { role: 'LONG RUN', color: C.purple, colorBg: C.purpleBg, shoe: rotation.longRun, desc: 'Weekly long run (15K+) with max cushion' } : null,
  ].filter(Boolean) as { role: string; color: RGB; colorBg: RGB; shoe: ScoredShoe; desc: string }[];

  const cardH = 58;
  shoes.forEach((item, i) => {
    const cy = y + i * (cardH + 6);
    rr(doc, M, cy, CW, cardH, 3, C.cardBg, C.border);

    // Left accent
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.rect(M, cy, 3, cardH, 'F');

    // Image column on the right (taller, no clash with button)
    const imgW = 46;
    const imgH = cardH - 8;
    const imgX = PW - M - imgW - 4;
    const imgY = cy + 4;
    const textRight = imgX - 6;

    drawShoeFrame(doc, imgX, imgY, imgW, imgH, shoeImageMap.get(item.shoe.shoe.id) ?? null, item.shoe.shoe.brand, item.shoe.shoe.model);

    // Role badge (left)
    pill(doc, M + 8, cy + 5, item.role, item.colorBg, item.color);

    // Match % chip — sits next to the role pill, no overlap with anything
    const pctText = `${item.shoe.matchPercent}% MATCH`;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    const pctW = doc.getTextWidth(pctText) + 6;
    rr(doc, M + 8 + 30, cy + 5, pctW, 6, 3, C.greenBg);
    doc.setTextColor(C.green[0], C.green[1], C.green[2]);
    doc.text(pctText, M + 8 + 30 + pctW / 2, cy + 9.2, { align: 'center' });

    // Shoe name (left column, wrapped)
    doc.setFontSize(13);
    doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
    doc.setFont('helvetica', 'bold');
    const nameLines = doc.splitTextToSize(`${item.shoe.shoe.brand} ${item.shoe.shoe.model}`, textRight - (M + 8));
    doc.text(nameLines.slice(0, 2), M + 8, cy + 18);

    // Price + meta block — show MSRP tier instead of stale hard-coded price
    const tierLabel2 = (p: number) => p < 110 ? 'BUDGET' : p < 160 ? 'MID' : p < 220 ? 'PREMIUM' : 'SUPER-PREMIUM';
    doc.setFontSize(9);
    doc.setTextColor(C.red[0], C.red[1], C.red[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(tierLabel2(item.shoe.shoe.priceUSD), M + 8, cy + 28);

    doc.setFontSize(5.8);
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.setFont('helvetica', 'normal');
    doc.text(`${item.shoe.shoe.weightGrams}G   ·   ${item.shoe.shoe.dropMM}MM DROP`, M + 22, cy + 28, { charSpace: 0.4 } as any);

    // Use-case description on its own line
    doc.setFontSize(6.2);
    doc.setTextColor(C.text[0], C.text[1], C.text[2]);
    doc.setFont('helvetica', 'italic');
    const descLines = doc.splitTextToSize(item.desc, textRight - (M + 8));
    doc.text(descLines[0], M + 8, cy + 33);

    // Highlights — stacked vertically
    item.shoe.shoe.highlights.slice(0, 2).forEach((h, hi) => {
      const hy = cy + 39 + hi * 4.8;
      doc.setFillColor(item.color[0], item.color[1], item.color[2]);
      doc.circle(M + 10, hy, 0.8, 'F');
      doc.setFontSize(6);
      doc.setTextColor(C.text[0], C.text[1], C.text[2]);
      doc.setFont('helvetica', 'normal');
      const hLines = doc.splitTextToSize(h, textRight - (M + 14));
      doc.text(hLines[0], M + 14, hy + 1);
    });

    // Amazon button — under image (lower so the match% chip up-top is fully visible)
    const btnW = imgW;
    const btnX = imgX;
    const btnY = cy + cardH - 6.5;
    rr(doc, btnX, btnY, btnW, 5.5, 1.8, C.red);
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('BUY ON AMAZON  ›', btnX + btnW / 2, btnY + 3.7, { align: 'center', charSpace: 0.4 } as any);
    doc.link(btnX, btnY, btnW, 5.5, { url: amazonLink(item.shoe.shoe.id, item.shoe.shoe.brand, item.shoe.shoe.model, item.shoe.shoe.amazonASIN) });

    // Review link bottom-left
    link(doc, M + 8, cy + cardH - 3, 'Read Full Review on GearUpToFit ›', item.shoe.shoe.reviewURL, 5.5);
  });

  y += shoes.length * (cardH + 6) + 6;

  // ── Training Emphasis ──
  if (y + 40 < PH - 22) {
    y = sectionTitle(doc, y, 'TRAINING EMPHASIS');

    rec.trainingEmphasis.forEach((tip, i) => {
      if (y > PH - 28) return;
      rr(doc, M + 3, y - 2, CW - 6, 9, 2, i % 2 === 0 ? C.bg : C.cardBg);

      // Number
      rr(doc, M + 5, y - 1, 6, 6, 3, C.red);
      doc.setFontSize(5.5);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(String(i + 1), M + 8, y + 3, { align: 'center' });

      doc.setFontSize(6.5);
      doc.setTextColor(C.text[0], C.text[1], C.text[2]);
      doc.setFont('helvetica', 'normal');
      const tl = doc.splitTextToSize(tip, CW - 22);
      doc.text(tl[0], M + 14, y + 3);
      y += 10;
    });

    link(doc, M, y, 'Get a Free Custom Running Plan on GearUpToFit', 'https://gearuptofit.com/running/custom-running-plan-free/', 6);
  }

  addFooter(doc, 2, totalPages);

  // ═══════════════════════════════════════
  // PAGE 3: Resources + Articles
  // ═══════════════════════════════════════
  doc.addPage();
  addHeader(doc);
  y = 24;

  doc.setFontSize(18);
  doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('RECOMMENDED RESOURCES', M, y);

  // Red underline accent
  doc.setFillColor(C.red[0], C.red[1], C.red[2]);
  doc.rect(M, y + 2, 28, 0.7, 'F');
  y += 7;

  doc.setFontSize(7);
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.setFont('helvetica', 'italic');
  doc.text('Curated articles, calculators and free tools from GearUpToFit, hand-picked for your runner profile.', M, y);
  y += 8;

  // ── Read Before You Buy (compact 2-column) ──
  const mustReads = [
    { title: 'How to Choose the Right Running Shoes', url: 'https://gearuptofit.com/running/how-to-choose-the-right-running-shoes/' },
    { title: 'Running Shoes Reviews 2026', url: 'https://gearuptofit.com/review/running-shoes/' },
    { title: 'Best Shoes for Different Distances 2026', url: 'https://gearuptofit.com/review/best-running-shoes-for-different-distances/' },
    { title: 'Best Running Shoes 2026', url: 'https://gearuptofit.com/review/best-running-shoes/' },
  ];
  const mrH = 6 + Math.ceil(mustReads.length / 2) * 6 + 4;
  rr(doc, M, y, CW, mrH, 3, C.accentBg, C.border);
  y = sectionTitle(doc, y + 3, 'READ BEFORE YOU BUY', C.accent);

  mustReads.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = M + 7 + col * (CW / 2);
    const cy = y + row * 6;
    doc.setFillColor(C.accent[0], C.accent[1], C.accent[2]);
    doc.circle(cx, cy, 0.9, 'F');
    link(doc, cx + 3, cy + 1.4, item.title, item.url, 6.5);
  });
  y += Math.ceil(mustReads.length / 2) * 6 + 6;

  // ── Personalized Articles (2-column compact grid) ──
  const articles = getRecommendedArticles(answers);
  y = sectionTitle(doc, y, 'PERSONALIZED ARTICLES FOR YOU');

  const artColW = CW / 2 - 2;
  const artH = 13;
  articles.slice(0, 6).forEach((article, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const ax = M + col * (artColW + 4);
    const ay = y + row * (artH + 3);
    if (ay + artH > PH - 60) return;
    rr(doc, ax, ay, artColW, artH, 2, C.bg, C.border);

    // Category pill
    doc.setFontSize(5);
    doc.setTextColor(C.red[0], C.red[1], C.red[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(article.category.toUpperCase(), ax + 4, ay + 4, { charSpace: 0.5 } as any);

    doc.setFontSize(7);
    doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
    doc.setFont('helvetica', 'bold');
    const tLines = doc.splitTextToSize(article.title, artColW - 8);
    doc.text(tLines.slice(0, 2), ax + 4, ay + 8.5);
    doc.link(ax, ay, artColW, artH, { url: article.url });

    // Tiny chevron at right
    doc.setFontSize(7);
    doc.setTextColor(C.red[0], C.red[1], C.red[2]);
    doc.text('›', ax + artColW - 4, ay + 8.5, { align: 'right' });
  });
  y += Math.ceil(Math.min(articles.length, 6) / 2) * (artH + 3) + 4;

  // ── Injury Prevention (compact, only if relevant) ──
  const injuryArticles = getInjuryArticles(answers.injuries);
  if (injuryArticles.length > 0 && y < PH - 60) {
    y = sectionTitle(doc, y, 'INJURY PREVENTION RESOURCES', C.redLight);
    const injH = 11;
    injuryArticles.slice(0, 4).forEach((article, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ax = M + col * (artColW + 4);
      const ay = y + row * (injH + 3);
      if (ay + injH > PH - 50) return;
      rr(doc, ax, ay, artColW, injH, 2, C.redBg);

      doc.setFontSize(5);
      doc.setTextColor(C.red[0], C.red[1], C.red[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(article.category.toUpperCase(), ax + 4, ay + 4, { charSpace: 0.5 } as any);

      doc.setFontSize(6.5);
      doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
      doc.setFont('helvetica', 'bold');
      const tLines = doc.splitTextToSize(article.title, artColW - 8);
      doc.text(tLines[0], ax + 4, ay + 8.5);
      doc.link(ax, ay, artColW, injH, { url: article.url });
    });
    y += Math.ceil(Math.min(injuryArticles.length, 4) / 2) * (injH + 3) + 4;
  }

  // ── Free Tools (always shown, 2-column) ──
  if (y < PH - 35) {
    y = sectionTitle(doc, y, 'FREE TOOLS & CALCULATORS', C.blue);
    const tools = getToolLinks(answers);
    const toolColW = CW / 2 - 2;
    const toolH = 13;
    tools.slice(0, 4).forEach((tool, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const tx = M + col * (toolColW + 4);
      const ty = y + row * (toolH + 3);
      if (ty + toolH > PH - 22) return;

      rr(doc, tx, ty, toolColW, toolH, 2, C.blueBg, C.border);
      doc.setFontSize(7);
      doc.setTextColor(C.blue[0], C.blue[1], C.blue[2]);
      doc.setFont('helvetica', 'bold');
      doc.textWithLink(tool.title, tx + 4, ty + 5.5, { url: tool.url });

      doc.setFontSize(5.5);
      doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
      doc.setFont('helvetica', 'normal');
      const dLines = doc.splitTextToSize(tool.description, toolColW - 8);
      doc.text(dLines[0], tx + 4, ty + 10);

      doc.link(tx, ty, toolColW, toolH, { url: tool.url });
    });
    y += Math.ceil(Math.min(tools.length, 4) / 2) * (toolH + 3) + 4;
  }

  addFooter(doc, 3, totalPages);

  // ═══════════════════════════════════════
  // PAGE 4: Complete Kit + CTA
  // ═══════════════════════════════════════
  doc.addPage();
  addHeader(doc);
  y = 24;

  doc.setFontSize(18);
  doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPLETE YOUR RUNNING KIT', M, y);

  // Red underline accent
  doc.setFillColor(C.red[0], C.red[1], C.red[2]);
  doc.rect(M, y + 2, 28, 0.7, 'F');
  y += 7;

  doc.setFontSize(7);
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.setFont('helvetica', 'italic');
  doc.text('Expert-picked gear and reviews to complement your shoe rotation.', M, y);
  y += 8;

  // Kit items — 2-column denser grid
  const kitItems = [
    { title: 'Best Running Socks for Blister Prevention', url: 'https://gearuptofit.com/review/best-running-socks-for-blister-prevention/', cat: 'SOCKS', color: C.green, bg: C.greenBg },
    { title: 'Best Smartwatches for Runners', url: 'https://gearuptofit.com/review/best-smartwatches-for-runners/', cat: 'TECH', color: C.blue, bg: C.blueBg },
    { title: 'Best Running Headlamps', url: 'https://gearuptofit.com/review/low-light-running-headlamps/', cat: 'SAFETY', color: C.accent, bg: C.accentBg },
    { title: 'Best Foam Rollers for Muscle Recovery', url: 'https://gearuptofit.com/best-foam-rollers-for-muscle-recovery/', cat: 'RECOVERY', color: C.purple, bg: C.purpleBg },
    { title: 'Best Daily Running Shoes', url: 'https://gearuptofit.com/review/best-daily-running-shoes/', cat: 'SHOES', color: C.red, bg: C.redBg },
    { title: 'Running Gear for Beginners', url: 'https://gearuptofit.com/running/running-gear-for-beginners/', cat: 'BEGINNER', color: C.blue, bg: C.blueBg },
  ];

  const kitColW = CW / 2 - 2;
  const kitH = 14;
  kitItems.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const kx = M + col * (kitColW + 4);
    const ky = y + row * (kitH + 3);
    rr(doc, kx, ky, kitColW, kitH, 2, item.bg, C.border);

    // Left color bar
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.rect(kx, ky, 1.6, kitH, 'F');

    // Category microlabel
    doc.setFontSize(5);
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(item.cat, kx + 4, ky + 4.5, { charSpace: 0.5 } as any);

    doc.setFontSize(7);
    doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
    doc.setFont('helvetica', 'bold');
    const tLines = doc.splitTextToSize(item.title, kitColW - 12);
    doc.text(tLines[0], kx + 4, ky + 9.5);

    // Chevron
    doc.setFontSize(8);
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text('›', kx + kitColW - 4, ky + 9.5, { align: 'right' });

    doc.link(kx, ky, kitColW, kitH, { url: item.url });
  });
  y += Math.ceil(kitItems.length / 2) * (kitH + 3) + 8;

  // ── Your Profile Summary Card — proper label/value treatment ──
  const profileItems = [
    { l: 'FOOT TYPE', v: answers.footType.charAt(0).toUpperCase() + answers.footType.slice(1) },
    { l: 'PRONATION', v: answers.pronation.charAt(0).toUpperCase() + answers.pronation.slice(1) },
    { l: 'WEEKLY VOLUME', v: `${answers.weeklyMileage} km / week` },
    { l: 'TARGET DISTANCE', v: answers.distance.replace(/-/g, ' ').toUpperCase() },
    { l: 'PRIMARY TERRAIN', v: answers.terrain.charAt(0).toUpperCase() + answers.terrain.slice(1) },
    { l: 'PACE GOAL', v: answers.paceGoal.charAt(0).toUpperCase() + answers.paceGoal.slice(1) },
    { l: 'BUDGET', v: answers.budget.map((b: string) => b === 'under-100' ? 'Under $100' : b === '200-plus' ? '$200+' : '$' + b.replace('-', '-$')).join(', ') || 'Flexible' },
    { l: 'PREFERRED BRANDS', v: answers.brand.length > 0 ? answers.brand.map((b: string) => b.charAt(0).toUpperCase() + b.slice(1)).join(', ') : 'Open to all' },
  ];

  const profileH = 12 + Math.ceil(profileItems.length / 2) * 12 + 4;
  rr(doc, M, y, CW, profileH, 3, C.bg, C.border);
  y = sectionTitle(doc, y + 3, 'YOUR PROFILE AT A GLANCE');

  const piColW = (CW - 14) / 2;
  profileItems.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const px = M + 7 + col * piColW;
    const py = y + row * 10;
    labelValue(doc, px, py, item.l, item.v, piColW - 4);
  });
  y += Math.ceil(profileItems.length / 2) * 10 + 4;

  // ── Premium CTA Block ──
  y += 6;
  const ctaH = 66;
  const gold: RGB = [198, 161, 86];
  const goldSoft: RGB = [232, 200, 130];
  const ink: RGB = [18, 12, 14];

  // Outer hairline shadow
  rr(doc, M - 0.5, y - 0.5, CW + 1, ctaH + 1, 5.4, [0, 0, 0] as RGB);

  // Main solid deep-ink card
  rr(doc, M, y, CW, ctaH, 5, ink);

  // Inner gold hairline frame
  doc.setDrawColor(gold[0], gold[1], gold[2]);
  doc.setLineWidth(0.25);
  if (typeof (doc as any).roundedRect === 'function') {
    (doc as any).roundedRect(M + 2.5, y + 2.5, CW - 5, ctaH - 5, 3.5, 3.5, 'S');
  }

  // Define a "safe inner zone" — keep all text away from corner ornaments (logo chip + seal)
  // Logo chip occupies M+6..M+19, seal occupies PW-M-19..PW-M-6
  const safeLeft = M + 24;
  const safeRight = PW - M - 24;
  const safeCenter = (safeLeft + safeRight) / 2;
  const safeWidth = safeRight - safeLeft;

  // Eyebrow / kicker — manually centered (jsPDF's align:'center' ignores charSpace, causing drift)
  const kickerY = y + 12;
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  const kickerText = 'THE GEARUPTOFIT MANIFESTO';
  const kickerCharSpace = 1.2;
  const kickerW = doc.getTextWidth(kickerText) + kickerCharSpace * (kickerText.length - 1);
  const kickerX = safeCenter - kickerW / 2;
  doc.setTextColor(goldSoft[0], goldSoft[1], goldSoft[2]);
  doc.text(kickerText, kickerX, kickerY, { align: 'left', charSpace: kickerCharSpace } as any);

  // Gold hairlines flanking kicker — fit within safe zone with 4mm gap from text
  const ruleGap = 4;
  const ruleStartL = safeLeft;
  const ruleEndL = kickerX - ruleGap;
  const ruleStartR = kickerX + kickerW + ruleGap;
  const ruleEndR = safeRight;
  doc.setFillColor(gold[0], gold[1], gold[2]);
  if (ruleEndL > ruleStartL) doc.rect(ruleStartL, kickerY - 1.4, ruleEndL - ruleStartL, 0.3, 'F');
  if (ruleEndR > ruleStartR) doc.rect(ruleStartR, kickerY - 1.4, ruleEndR - ruleStartR, 0.3, 'F');

  // Headline — single line, generous tracking, manually centered (charSpace-aware)
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  const headlineText = 'GEAR UP.   SHOW UP.   LEVEL UP.';
  const headlineCharSpace = 0.6;
  const headlineW = doc.getTextWidth(headlineText) + headlineCharSpace * (headlineText.length - 1);
  doc.text(headlineText, safeCenter - headlineW / 2, y + 25, { align: 'left', charSpace: headlineCharSpace } as any);

  // Ornamental divider with center diamond
  const divY = y + 31;
  doc.setFillColor(gold[0], gold[1], gold[2]);
  doc.rect(safeCenter - 38, divY, 30, 0.25, 'F');
  doc.rect(safeCenter + 8, divY, 30, 0.25, 'F');
  doc.setFillColor(goldSoft[0], goldSoft[1], goldSoft[2]);
  const dx = safeCenter, dy = divY;
  doc.triangle(dx - 1.6, dy, dx, dy - 1.4, dx + 1.6, dy, 'F');
  doc.triangle(dx - 1.6, dy, dx, dy + 1.4, dx + 1.6, dy, 'F');

  // Tagline
  doc.setFontSize(7.5);
  doc.setTextColor(220, 215, 210);
  doc.setFont('helvetica', 'normal');
  doc.text('Expert gear reviews  ·  Personalized training plans  ·  Pro-grade running guides', safeCenter, y + 37, { align: 'center' });

  // Premium pill button — centered in safe zone
  const btnW = 70, btnH = 12, btnX = safeCenter - btnW / 2, btnY = y + 43;
  rr(doc, btnX - 0.7, btnY - 0.7, btnW + 1.4, btnH + 1.4, 6.2, gold);
  rr(doc, btnX, btnY, btnW, btnH, 5.5, C.white);

  // CTA text — measured to keep it perfectly centered with arrow
  doc.setFontSize(9);
  doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.setFont('helvetica', 'bold');
  const ctaText = 'VISIT  GEARUPTOFIT.COM';
  const ctaCharSpace = 0.7;
  const ctaTextW = doc.getTextWidth(ctaText) + ctaCharSpace * (ctaText.length - 1);
  const arrowW = 3.2; // triangle width + gap
  const groupW = ctaTextW + arrowW;
  const textStartX = btnX + (btnW - groupW) / 2;
  doc.text(ctaText, textStartX, btnY + btnH / 2 + 1.3, { align: 'left', charSpace: ctaCharSpace } as any);

  // Red arrow immediately after text
  doc.setFillColor(C.red[0], C.red[1], C.red[2]);
  const arrX = textStartX + ctaTextW + 1.2, arrY = btnY + btnH / 2;
  doc.triangle(arrX, arrY - 1.6, arrX + 2.2, arrY, arrX, arrY + 1.6, 'F');

  doc.link(btnX, btnY, btnW, btnH, { url: 'https://gearuptofit.com/' });

  // Trust micro-line — manually centered (charSpace-aware), auto-shrinks if too wide.
  // Sits on a subtle gold hairline base rule for premium "footer" feel.
  doc.setFont('helvetica', 'normal');
  const trustText = 'TRUSTED BY RUNNERS WORLDWIDE   ·   EST. GEARUPTOFIT   ·   POWERED BY RUNMATCH AI';
  const trustCharSpace = 0.9;
  let trustSize = 5;
  doc.setFontSize(trustSize);
  let trustW = doc.getTextWidth(trustText) + trustCharSpace * (trustText.length - 1);
  while (trustW > safeWidth - 6 && trustSize > 3.6) {
    trustSize -= 0.2;
    doc.setFontSize(trustSize);
    trustW = doc.getTextWidth(trustText) + trustCharSpace * (trustText.length - 1);
  }
  const trustY = y + ctaH - 4.5;
  // Faint gold base rule that the trust line sits on — blends footer into card
  doc.setFillColor(gold[0], gold[1], gold[2]);
  doc.rect(safeLeft + 2, trustY - 3.2, safeWidth - 4, 0.15, 'F');
  doc.setTextColor(170, 158, 150);
  doc.text(trustText, safeCenter - trustW / 2, trustY, { align: 'left', charSpace: trustCharSpace } as any);

  // Left monogram (logo in white circle chip)
  if (logoData) {
    try {
      rr(doc, M + 6, y + 6, 13, 13, 6.5, C.white);
      doc.addImage(logoData, 'PNG', M + 7, y + 7, 11, 11);
    } catch {}
  }

  // Right gold seal
  rr(doc, PW - M - 19, y + 6, 13, 13, 6.5, gold);
  doc.setFontSize(5);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('PRO', PW - M - 12.5, y + 10.5, { align: 'center', charSpace: 0.4 } as any);
  doc.setFillColor(ink[0], ink[1], ink[2]);
  doc.rect(PW - M - 16, y + 12, 7, 0.2, 'F');
  doc.text('2026', PW - M - 12.5, y + 14.7, { align: 'center', charSpace: 0.4 } as any);


  addFooter(doc, 4, totalPages);

  // Save
  const slug = `runmatch-${answers.terrain}-${answers.distance}-${answers.pronation}`;
  doc.save(`GearUpToFit-RunMatch-Report-${slug}.pdf`);
}
