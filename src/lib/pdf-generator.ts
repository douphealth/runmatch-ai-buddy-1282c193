import jsPDF from 'jspdf';
import { QuizAnswers } from './quiz-data';
import { ShoeRecommendation } from './recommendation-engine';
import { ScoredShoe } from './scoring-engine';
import { getRecommendedArticles, getInjuryArticles, getToolLinks } from './article-links';

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
  doc.setFontSize(5.5);
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.setFont('helvetica', 'normal');
  doc.text(label, x, y);
  doc.setFontSize(7.5);
  doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.setFont('helvetica', 'bold');
  const val = value.length > 22 ? value.slice(0, 22) + '...' : value;
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
  doc.text('Some links on this page are affiliate links. GearUpToFit may earn a commission at no extra cost to you.', M, PH - 7);

  // Bottom red line
  doc.setFillColor(C.red[0], C.red[1], C.red[2]);
  doc.rect(0, PH - 2.5, PW, 2.5, 'F');
}

function amazonLink(brand: string, model: string): string {
  return `https://www.amazon.com/s?k=${encodeURIComponent(`${brand} ${model} running shoes`)}&tag=papalex-20`;
}

// ─── Main generator ───

export async function generateResultsPDF(data: PDFData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { answers, recommendation: rec, rotation, radarData } = data;
  const totalPages = 4;

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

  // ═══════════════════════════════════════
  // PAGE 1: Profile + Primary Match
  // ═══════════════════════════════════════
  addHeader(doc);
  let y = 24;

  // Logo + Title block
  if (logoData) {
    try { doc.addImage(logoData, 'PNG', M, y, 18, 18); } catch {}
  }

  doc.setFontSize(22);
  doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('YOUR RUNNING SHOE', M + 22, y + 8);
  doc.setTextColor(C.red[0], C.red[1], C.red[2]);
  doc.text('MATCH REPORT', M + 22, y + 16);
  y += 22;

  // Date
  doc.setFontSize(6);
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, M, y + 2);
  y += 6;

  // Summary
  doc.setFontSize(7.5);
  doc.setTextColor(C.text[0], C.text[1], C.text[2]);
  doc.setFont('helvetica', 'normal');
  const sumLines = doc.splitTextToSize(rec.shoeProfile.summary, CW);
  doc.text(sumLines, M, y);
  y += sumLines.length * 3.5 + 5;

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

    rr(doc, M, y, CW, 56, 3, C.cardBg, C.border);

    // Left red accent
    doc.setFillColor(C.red[0], C.red[1], C.red[2]);
    doc.rect(M, y, 3, 56, 'F');

    // #1 badge
    rr(doc, M + 6, y + 4, 14, 14, 7, C.red);
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('#1', M + 13, y + 13, { align: 'center' });

    // Match % badge
    rr(doc, PW - M - 22, y + 4, 18, 10, 3, C.greenBg);
    doc.setFontSize(10);
    doc.setTextColor(C.green[0], C.green[1], C.green[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`${pct}%`, PW - M - 13, y + 11.5, { align: 'center' });

    doc.setFontSize(5);
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.setFont('helvetica', 'normal');
    doc.text('YOUR BEST MATCH', M + 23, y + 9);

    doc.setFontSize(15);
    doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`${shoe.brand} ${shoe.model}`, M + 23, y + 17);

    doc.setFontSize(10);
    doc.setTextColor(C.red[0], C.red[1], C.red[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`$${shoe.priceUSD}`, M + 23, y + 24);

    doc.setFontSize(6);
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.setFont('helvetica', 'normal');
    doc.text(`${shoe.weightGrams}g  |  ${shoe.dropMM}mm drop  |  Cushioning: ${shoe.cushioning}/10`, M + 42, y + 24);

    // Highlights
    const hlY = y + 30;
    shoe.highlights.forEach((h, i) => {
      doc.setFillColor(C.green[0], C.green[1], C.green[2]);
      doc.circle(M + 10, hlY + i * 5.5, 1, 'F');
      doc.setFontSize(6.5);
      doc.setTextColor(C.text[0], C.text[1], C.text[2]);
      doc.setFont('helvetica', 'normal');
      doc.text(h, M + 14, hlY + i * 5.5 + 1);
    });

    // Match reasons
    const reasonsX = M + CW / 2 + 5;
    rotation.primary.reasons.slice(0, 4).forEach((r, i) => {
      doc.setFillColor(C.red[0], C.red[1], C.red[2]);
      doc.circle(reasonsX, hlY + i * 5.5, 1, 'F');
      doc.setFontSize(6.5);
      doc.setTextColor(C.text[0], C.text[1], C.text[2]);
      doc.setFont('helvetica', 'normal');
      doc.text(r, reasonsX + 4, hlY + i * 5.5 + 1);
    });

    // Amazon button
    rr(doc, PW - M - 44, y + 44, 40, 9, 3, C.red);
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('BUY ON AMAZON', PW - M - 24, y + 50, { align: 'center' });
    doc.link(PW - M - 44, y + 44, 40, 9, { url: amazonLink(shoe.brand, shoe.model) });

    // Review link
    link(doc, M + 8, y + 53, 'Read Full Review on GearUpToFit', shoe.reviewURL, 6);

    y += 62;
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
  y += 4;

  rr(doc, M, y, CW, 8, 2, C.greenBg);
  doc.setFontSize(6.5);
  doc.setTextColor(C.green[0], C.green[1], C.green[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('Research shows multi-shoe rotation reduces injury risk by up to 39% (British Journal of Sports Medicine)', M + 4, y + 5.5);
  y += 14;

  const shoes = [
    { role: 'DAILY TRAINER', color: C.red, colorBg: C.redBg, shoe: rotation?.primary, desc: 'Easy runs, recovery, and general training' },
    rotation?.speed ? { role: 'SPEED WORK', color: C.blue, colorBg: C.blueBg, shoe: rotation.speed, desc: 'Tempo runs, intervals, and race day' } : null,
    rotation?.longRun ? { role: 'LONG RUN', color: C.purple, colorBg: C.purpleBg, shoe: rotation.longRun, desc: 'Weekly long run (15K+) with max cushion' } : null,
  ].filter(Boolean) as { role: string; color: RGB; colorBg: RGB; shoe: ScoredShoe; desc: string }[];

  const cardH = 48;
  shoes.forEach((item, i) => {
    const cy = y + i * (cardH + 5);
    rr(doc, M, cy, CW, cardH, 3, C.cardBg, C.border);

    // Left accent
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.rect(M, cy, 3, cardH, 'F');

    // Role badge
    pill(doc, M + 8, cy + 5, item.role, item.colorBg, item.color);

    // Match %
    doc.setFontSize(9);
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`${item.shoe.matchPercent}% match`, PW - M - 6, cy + 10, { align: 'right' });

    // Shoe name + price
    doc.setFontSize(13);
    doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`${item.shoe.shoe.brand} ${item.shoe.shoe.model}`, M + 8, cy + 20);

    doc.setFontSize(9);
    doc.setTextColor(C.red[0], C.red[1], C.red[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`$${item.shoe.shoe.priceUSD}`, M + 8, cy + 27);

    doc.setFontSize(6);
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.setFont('helvetica', 'normal');
    doc.text(`${item.shoe.shoe.weightGrams}g  |  ${item.shoe.shoe.dropMM}mm drop  |  ${item.desc}`, M + 28, cy + 27);

    // Highlights
    item.shoe.shoe.highlights.forEach((h, hi) => {
      const hx = M + 8 + hi * 55;
      if (hx + 50 > PW - M) return;
      doc.setFillColor(C.green[0], C.green[1], C.green[2]);
      doc.circle(hx, cy + 34, 0.8, 'F');
      doc.setFontSize(6);
      doc.setTextColor(C.text[0], C.text[1], C.text[2]);
      doc.setFont('helvetica', 'normal');
      doc.text(h, hx + 3, cy + 35);
    });

    // Amazon button
    rr(doc, PW - M - 38, cy + 38, 34, 8, 3, C.red);
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('BUY ON AMAZON', PW - M - 21, cy + 43.5, { align: 'center' });
    doc.link(PW - M - 38, cy + 38, 34, 8, { url: amazonLink(item.shoe.shoe.brand, item.shoe.shoe.model) });

    // Review
    link(doc, M + 8, cy + 44, 'Read Review on GearUpToFit', item.shoe.shoe.reviewURL, 5.5);
  });

  y += shoes.length * (cardH + 5) + 6;

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
  y += 4;

  doc.setFontSize(6.5);
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.setFont('helvetica', 'normal');
  doc.text('Curated articles and tools from GearUpToFit based on your runner profile', M, y + 3);
  y += 12;

  // ── Read Before You Buy ──
  rr(doc, M, y, CW, 34, 3, C.accentBg, C.border);
  y = sectionTitle(doc, y + 3, 'READ BEFORE YOU BUY', C.accent);

  const mustReads = [
    { title: 'How to Choose the Right Running Shoes', url: 'https://gearuptofit.com/running/how-to-choose-the-right-running-shoes/' },
    { title: 'Running Shoes Reviews 2026', url: 'https://gearuptofit.com/review/running-shoes/' },
    { title: 'Best Running Shoes for Different Distances 2026', url: 'https://gearuptofit.com/review/best-running-shoes-for-different-distances/' },
    { title: 'Best Running Shoes 2026', url: 'https://gearuptofit.com/review/best-running-shoes/' },
  ];

  mustReads.forEach((item, i) => {
    doc.setFillColor(C.accent[0], C.accent[1], C.accent[2]);
    doc.circle(M + 8, y + i * 5.5, 1, 'F');
    link(doc, M + 12, y + i * 5.5 + 1.5, item.title, item.url, 6.5);
  });
  y += mustReads.length * 5.5 + 6;

  // ── Personalized Articles ──
  const articles = getRecommendedArticles(answers);
  y = sectionTitle(doc, y, 'PERSONALIZED ARTICLES FOR YOU');

  articles.forEach((article) => {
    if (y > PH - 55) return;
    rr(doc, M, y, CW, 11, 2, C.bg);

    doc.setFontSize(5.5);
    doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(article.category.toUpperCase(), M + 4, y + 4);

    doc.setFontSize(7);
    doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
    doc.setFont('helvetica', 'bold');
    doc.textWithLink(article.title, M + 4, y + 8.5, { url: article.url });
    doc.link(M, y, CW, 11, { url: article.url });

    y += 14;
  });

  // ── Injury Prevention ──
  const injuryArticles = getInjuryArticles(answers.injuries);
  if (injuryArticles.length > 0 && y < PH - 55) {
    y += 2;
    y = sectionTitle(doc, y, 'INJURY PREVENTION RESOURCES', C.redLight);

    injuryArticles.forEach(article => {
      if (y > PH - 40) return;
      rr(doc, M, y, CW, 11, 2, C.redBg);

      doc.setFontSize(5.5);
      doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(article.category.toUpperCase(), M + 4, y + 4);

      doc.setFontSize(7);
      doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
      doc.setFont('helvetica', 'bold');
      doc.textWithLink(article.title, M + 4, y + 8.5, { url: article.url });
      doc.link(M, y, CW, 11, { url: article.url });

      y += 14;
    });
  }

  // ── Free Tools ──
  if (y < PH - 50) {
    y += 2;
    y = sectionTitle(doc, y, 'FREE TOOLS AND CALCULATORS', C.blue);

    const tools = getToolLinks(answers);
    const toolColW = CW / 2 - 3;
    tools.forEach((tool, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const tx = M + col * (toolColW + 6);
      const ty = y + row * 16;

      rr(doc, tx, ty, toolColW, 13, 2, C.blueBg);
      doc.setFontSize(7);
      doc.setTextColor(C.blue[0], C.blue[1], C.blue[2]);
      doc.setFont('helvetica', 'bold');
      doc.textWithLink(tool.title, tx + 4, ty + 5, { url: tool.url });

      doc.setFontSize(5.5);
      doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
      doc.setFont('helvetica', 'normal');
      doc.text(tool.description, tx + 4, ty + 10);

      doc.link(tx, ty, toolColW, 13, { url: tool.url });
    });
    y += Math.ceil(tools.length / 2) * 16 + 4;
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
  y += 4;

  doc.setFontSize(6.5);
  doc.setTextColor(C.textMuted[0], C.textMuted[1], C.textMuted[2]);
  doc.setFont('helvetica', 'normal');
  doc.text('Expert-picked gear to complement your shoe rotation', M, y + 3);
  y += 12;

  // Kit items
  const kitItems = [
    { title: 'Best Running Socks for Blister Prevention', url: 'https://gearuptofit.com/review/best-running-socks-for-blister-prevention/', cat: 'SOCKS', color: C.green, bg: C.greenBg },
    { title: 'Best Smartwatches for Runners', url: 'https://gearuptofit.com/review/best-smartwatches-for-runners/', cat: 'TECH', color: C.blue, bg: C.blueBg },
    { title: 'Best Running Headlamps', url: 'https://gearuptofit.com/review/low-light-running-headlamps/', cat: 'SAFETY', color: C.accent, bg: C.accentBg },
    { title: 'Best Foam Rollers for Muscle Recovery', url: 'https://gearuptofit.com/best-foam-rollers-for-muscle-recovery/', cat: 'RECOVERY', color: C.purple, bg: C.purpleBg },
    { title: 'Best Daily Running Shoes', url: 'https://gearuptofit.com/review/best-daily-running-shoes/', cat: 'SHOES', color: C.red, bg: C.redBg },
    { title: 'Running Gear for Beginners', url: 'https://gearuptofit.com/running/running-gear-for-beginners/', cat: 'BEGINNER', color: C.blue, bg: C.blueBg },
  ];

  kitItems.forEach((item, i) => {
    rr(doc, M, y, CW, 13, 2, item.bg, C.border);

    // Category pill
    pill(doc, M + 4, y + 2, item.cat, item.bg, item.color);

    doc.setFontSize(7.5);
    doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
    doc.setFont('helvetica', 'bold');
    doc.textWithLink(item.title, M + 4, y + 10.5, { url: item.url });
    doc.link(M, y, CW, 13, { url: item.url });

    y += 16;
  });

  y += 6;

  // ── Your Profile Summary Card ──
  rr(doc, M, y, CW, 50, 3, C.bg, C.border);
  y = sectionTitle(doc, y + 3, 'YOUR PROFILE AT A GLANCE');

  const profileItems = [
    `Foot Type: ${answers.footType.charAt(0).toUpperCase() + answers.footType.slice(1)}`,
    `Pronation: ${answers.pronation.charAt(0).toUpperCase() + answers.pronation.slice(1)}`,
    `Weekly Volume: ${answers.weeklyMileage} km/week`,
    `Target Distance: ${answers.distance.replace(/-/g, ' ')}`,
    `Primary Terrain: ${answers.terrain.charAt(0).toUpperCase() + answers.terrain.slice(1)}`,
    `Pace Goal: ${answers.paceGoal.charAt(0).toUpperCase() + answers.paceGoal.slice(1)}`,
    `Budget: ${answers.budget.map(b => b === 'under-100' ? 'Under $100' : b === '200-plus' ? '$200+' : '$' + b.replace('-', '-$')).join(', ') || 'Flexible'}`,
    `Preferred Brands: ${answers.brand.length > 0 ? answers.brand.map(b => b.charAt(0).toUpperCase() + b.slice(1)).join(', ') : 'Open to all'}`,
  ];

  profileItems.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    doc.setFontSize(6.5);
    doc.setTextColor(C.text[0], C.text[1], C.text[2]);
    doc.setFont('helvetica', 'normal');
    doc.text(item, M + 7 + col * (CW / 2), y + row * 7);
  });
  y += Math.ceil(profileItems.length / 2) * 7 + 6;

  // ── Premium CTA Block ──
  y += 6;
  const ctaH = 60;

  // Outer subtle frame (creates depth/shadow illusion)
  rr(doc, M - 0.4, y - 0.4, CW + 0.8, ctaH + 0.8, 5, [60, 8, 8] as RGB);

  // Main dark card
  const dark1: RGB = [22, 14, 16];
  rr(doc, M, y, CW, ctaH, 5, dark1);

  // Layered red gradient bands (faux gradient via stacked rects)
  const bands = 18;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const r = Math.round(40 + (200 - 40) * t * 0.55);
    const g = Math.round(14 + (30 - 14) * t * 0.4);
    const b = Math.round(16 + (30 - 16) * t * 0.4);
    doc.setFillColor(r, g, b);
    const bandW = (CW * 0.55) / bands;
    doc.rect(M + CW * 0.45 + i * bandW, y, bandW + 0.3, ctaH, 'F');
  }

  // Re-apply rounded mask edges (top-right + bottom-right corners)
  rr(doc, M, y, CW, ctaH, 5, dark1);
  // Now overlay gradient inside rounded clip using a slightly inset rect approach:
  // draw an inset gradient that won't escape rounded corners visually
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const r = Math.round(60 + (210 - 60) * Math.pow(t, 1.2));
    const g = Math.round(18 + (40 - 18) * t);
    const b = Math.round(20 + (40 - 20) * t);
    doc.setFillColor(r, g, b);
    const bandW = (CW * 0.6) / bands;
    const bx = M + CW * 0.42 + i * bandW;
    // Skip drawing past right edge curve
    if (bx + bandW < M + CW - 2) {
      doc.rect(bx, y + 2, bandW + 0.4, ctaH - 4, 'F');
    } else {
      doc.rect(bx, y + 4, Math.max(0, M + CW - 4 - bx), ctaH - 8, 'F');
    }
  }

  // Decorative thin gold rule (top accent)
  doc.setFillColor(212, 175, 90);
  doc.rect(M + 14, y + 8, 28, 0.4, 'F');
  doc.rect(PW - M - 14 - 28, y + 8, 28, 0.4, 'F');

  // Eyebrow / kicker
  doc.setFontSize(6);
  doc.setTextColor(212, 175, 90);
  doc.setFont('helvetica', 'bold');
  doc.text('— THE GEARUPTOFIT MANIFESTO —', PW / 2, y + 13, { align: 'center', charSpace: 0.6 } as any);

  // Headline
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('GEAR UP.  SHOW UP.  LEVEL UP.', PW / 2, y + 23, { align: 'center', charSpace: 0.4 } as any);

  // Subhead divider dots
  doc.setFillColor(212, 175, 90);
  doc.circle(PW / 2 - 22, y + 28, 0.5, 'F');
  doc.circle(PW / 2, y + 28, 0.5, 'F');
  doc.circle(PW / 2 + 22, y + 28, 0.5, 'F');

  // Tagline
  doc.setFontSize(7);
  doc.setTextColor(220, 215, 210);
  doc.setFont('helvetica', 'normal');
  doc.text('Expert running gear reviews · personalized training plans · pro-grade guides', PW / 2, y + 34, { align: 'center' });

  // Premium pill button (white) with gold accent border feel
  const btnW = 64, btnH = 11, btnX = PW / 2 - btnW / 2, btnY = y + 40;
  // Gold underglow
  rr(doc, btnX - 0.6, btnY - 0.6, btnW + 1.2, btnH + 1.2, 5.5, [212, 175, 90] as RGB);
  // White button
  rr(doc, btnX, btnY, btnW, btnH, 5, C.white);

  // Arrow marker
  doc.setFillColor(C.red[0], C.red[1], C.red[2]);
  doc.circle(btnX + 8, btnY + btnH / 2, 1.6, 'F');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('>', btnX + 8, btnY + btnH / 2 + 1, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('VISIT  GEARUPTOFIT.COM', btnX + btnW / 2 + 4, btnY + btnH / 2 + 1.2, { align: 'center', charSpace: 0.5 } as any);
  doc.link(btnX, btnY, btnW, btnH, { url: 'https://gearuptofit.com/' });

  // Footer micro-line inside CTA
  doc.setFontSize(5);
  doc.setTextColor(150, 145, 140);
  doc.setFont('helvetica', 'normal');
  doc.text('TRUSTED BY RUNNERS WORLDWIDE  ·  EST. GEARUPTOFIT  ·  RUNMATCH AI', PW / 2, y + 56, { align: 'center', charSpace: 0.8 } as any);

  // Logo: small monogram top-left of card
  if (logoData) {
    try {
      // White rounded chip behind logo
      rr(doc, M + 6, y + 6, 12, 12, 6, C.white);
      doc.addImage(logoData, 'PNG', M + 7, y + 7, 10, 10);
    } catch {}
  }

  // Right-side seal
  rr(doc, PW - M - 18, y + 6, 12, 12, 6, [212, 175, 90] as RGB);
  doc.setFontSize(5);
  doc.setTextColor(22, 14, 16);
  doc.setFont('helvetica', 'bold');
  doc.text('PRO', PW - M - 12, y + 10.5, { align: 'center' });
  doc.text('2026', PW - M - 12, y + 14, { align: 'center' });

  addFooter(doc, 4, totalPages);

  // Save
  const slug = `runmatch-${answers.terrain}-${answers.distance}-${answers.pronation}`;
  doc.save(`GearUpToFit-RunMatch-Report-${slug}.pdf`);
}
