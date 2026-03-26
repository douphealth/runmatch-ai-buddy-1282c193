import jsPDF from 'jspdf';
import { QuizAnswers } from './quiz-data';
import { ShoeRecommendation } from './recommendation-engine';
import { ScoredShoe } from './scoring-engine';
import { getRecommendedArticles, getInjuryArticles } from './article-links';

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

const COLORS = {
  brand: [200, 40, 40] as [number, number, number],
  brandLight: [230, 80, 80] as [number, number, number],
  dark: [20, 22, 28] as [number, number, number],
  cardBg: [28, 31, 40] as [number, number, number],
  cardBorder: [45, 48, 58] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  textPrimary: [240, 240, 245] as [number, number, number],
  textSecondary: [140, 145, 165] as [number, number, number],
  textMuted: [100, 105, 125] as [number, number, number],
  accent: [255, 180, 50] as [number, number, number],
  green: [50, 200, 120] as [number, number, number],
};

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;

function roundedRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, fill: [number, number, number], stroke?: [number, number, number]) {
  doc.setFillColor(...fill);
  if (stroke) {
    doc.setDrawColor(...stroke);
    doc.setLineWidth(0.3);
  }
  // @ts-ignore - roundedRect exists in jsPDF
  if (typeof doc.roundedRect === 'function') {
    // @ts-ignore
    doc.roundedRect(x, y, w, h, r, r, stroke ? 'FD' : 'F');
  } else {
    doc.rect(x, y, w, h, stroke ? 'FD' : 'F');
  }
}

function drawRadarChart(doc: jsPDF, cx: number, cy: number, radius: number, data: { axis: string; value: number }[]) {
  const n = data.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  // Draw grid circles
  for (let ring = 1; ring <= 5; ring++) {
    const r = (radius * ring) / 5;
    doc.setDrawColor(55, 58, 68);
    doc.setLineWidth(0.15);
    const points: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const angle = startAngle + (i % n) * angleStep;
      points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
    for (let i = 0; i < points.length - 1; i++) {
      doc.line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
    }
  }

  // Draw axes
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep;
    doc.setDrawColor(55, 58, 68);
    doc.setLineWidth(0.15);
    doc.line(cx, cy, cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  }

  // Draw data polygon fill
  const dataPoints: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep;
    const r = (radius * data[i].value) / 10;
    dataPoints.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }

  // Fill polygon
  doc.setFillColor(200, 40, 40);
  doc.setGState(new (doc as any).GState({ opacity: 0.2 }));
  const pathData = dataPoints.map((p, i) => (i === 0 ? `${p[0]} ${p[1]} m` : `${p[0]} ${p[1]} l`)).join(' ');
  // Fallback: draw filled lines
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  // Draw data polygon outline
  doc.setDrawColor(220, 60, 60);
  doc.setLineWidth(0.6);
  for (let i = 0; i < dataPoints.length; i++) {
    const next = (i + 1) % dataPoints.length;
    doc.line(dataPoints[i][0], dataPoints[i][1], dataPoints[next][0], dataPoints[next][1]);
  }

  // Draw data points
  for (const p of dataPoints) {
    doc.setFillColor(220, 60, 60);
    doc.circle(p[0], p[1], 1.2, 'F');
    doc.setFillColor(255, 255, 255);
    doc.circle(p[0], p[1], 0.5, 'F');
  }

  // Labels
  doc.setFontSize(6.5);
  doc.setTextColor(...COLORS.textSecondary);
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep;
    const labelR = radius + 6;
    const lx = cx + labelR * Math.cos(angle);
    const ly = cy + labelR * Math.sin(angle);
    const align = Math.abs(Math.cos(angle)) < 0.3 ? 'center' : Math.cos(angle) > 0 ? 'left' : 'right';
    doc.text(data[i].axis, lx, ly + 1, { align: align as any });
  }
}

function addPageBackground(doc: jsPDF) {
  doc.setFillColor(...COLORS.dark);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
}

function addHeader(doc: jsPDF) {
  // Top accent bar
  doc.setFillColor(...COLORS.brand);
  doc.rect(0, 0, PAGE_W, 3, 'F');

  // Brand
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.brand);
  doc.setFont('helvetica', 'bold');
  doc.text('GEAR UP TO FIT', MARGIN, 12);

  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  doc.setFont('helvetica', 'normal');
  doc.text('gearuptofit.com', MARGIN, 16);

  // RunMatch AI badge
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.brand);
  doc.setFont('helvetica', 'bold');
  doc.text('RUNMATCH AI', PAGE_W - MARGIN, 12, { align: 'right' });

  doc.setFontSize(5.5);
  doc.setTextColor(...COLORS.textMuted);
  doc.setFont('helvetica', 'normal');
  doc.text('Personalized Running Shoe Report', PAGE_W - MARGIN, 16, { align: 'right' });

  // Separator
  doc.setDrawColor(...COLORS.cardBorder);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, 20, PAGE_W - MARGIN, 20);
}

function addFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  doc.setDrawColor(...COLORS.cardBorder);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);

  doc.setFontSize(5.5);
  doc.setTextColor(...COLORS.textMuted);
  doc.setFont('helvetica', 'normal');
  doc.text('Generated by RunMatch AI — gearuptofit.com', MARGIN, PAGE_H - 9);
  doc.text(`Page ${pageNum} of ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 9, { align: 'right' });

  // Bottom accent bar
  doc.setFillColor(...COLORS.brand);
  doc.rect(0, PAGE_H - 3, PAGE_W, 3, 'F');
}

export function generateResultsPDF(data: PDFData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { answers, recommendation: rec, rotation, radarData } = data;

  const totalPages = 3;

  // ========================
  // PAGE 1: Profile + Match
  // ========================
  addPageBackground(doc);
  addHeader(doc);

  let y = 28;

  // Title
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.text('YOUR RUNNING SHOE', MARGIN, y);
  y += 8;
  doc.setTextColor(...COLORS.brand);
  doc.text('MATCH REPORT', MARGIN, y);
  y += 10;

  // Summary line
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.textSecondary);
  doc.setFont('helvetica', 'normal');
  const summaryLines = doc.splitTextToSize(rec.shoeProfile.summary, CONTENT_W);
  doc.text(summaryLines, MARGIN, y);
  y += summaryLines.length * 3.5 + 6;

  // ---- Runner Profile Card ----
  roundedRect(doc, MARGIN, y, CONTENT_W, 70, 3, COLORS.cardBg, COLORS.cardBorder);

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.brand);
  doc.setFont('helvetica', 'bold');
  doc.text('YOUR RUNNER PROFILE', MARGIN + 6, y + 8);

  // Stats grid (left side)
  const statsData = [
    { label: 'CATEGORY', value: rec.shoeProfile.category },
    { label: 'CUSHIONING', value: rec.shoeProfile.cushioning },
    { label: 'DROP RANGE', value: rec.shoeProfile.dropRange },
    { label: 'SUPPORT', value: rec.shoeProfile.supportType },
    { label: 'WEEKLY KM', value: `${answers.weeklyMileage} km/wk` },
    { label: 'TERRAIN', value: answers.terrain.charAt(0).toUpperCase() + answers.terrain.slice(1) },
  ];

  const statsStartY = y + 14;
  const colW = 42;
  statsData.forEach((stat, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const sx = MARGIN + 6 + col * colW;
    const sy = statsStartY + row * 14;

    roundedRect(doc, sx, sy, colW - 4, 11, 2, [35, 38, 48]);

    doc.setFontSize(5);
    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text(stat.label, sx + 3, sy + 4);

    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textPrimary);
    doc.setFont('helvetica', 'bold');
    const val = String(stat.value);
    doc.text(val.length > 18 ? val.slice(0, 18) + '…' : val, sx + 3, sy + 8.5);
  });

  // Radar chart (right side)
  try {
    drawRadarChart(doc, MARGIN + CONTENT_W - 36, y + 40, 24, radarData);
  } catch {
    // Fallback if GState not supported
  }

  y += 76;

  // ---- #1 Match Card ----
  if (rotation?.primary) {
    const shoe = rotation.primary.shoe;
    const matchPct = rotation.primary.matchPercent;

    roundedRect(doc, MARGIN, y, CONTENT_W, 52, 3, COLORS.cardBg, COLORS.cardBorder);

    // Match badge
    doc.setFillColor(...COLORS.brand);
    doc.roundedRect(PAGE_W - MARGIN - 22, y + 4, 18, 9, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.text(`${matchPct}%`, PAGE_W - MARGIN - 13, y + 10, { align: 'center' });

    // Award icon area
    doc.setFillColor(...COLORS.brand);
    doc.circle(MARGIN + 10, y + 12, 5, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.white);
    doc.text('#1', MARGIN + 10, y + 14, { align: 'center' });

    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text('YOUR BEST MATCH', MARGIN + 18, y + 10);

    doc.setFontSize(14);
    doc.setTextColor(...COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.text(`${shoe.brand} ${shoe.model}`, MARGIN + 18, y + 18);

    doc.setFontSize(10);
    doc.setTextColor(...COLORS.brand);
    doc.setFont('helvetica', 'bold');
    doc.text(`$${shoe.priceUSD}`, MARGIN + 18, y + 25);

    // Highlights
    const highlightY = y + 30;
    shoe.highlights.forEach((h, i) => {
      doc.setFillColor(50, 180, 100);
      doc.circle(MARGIN + 10, highlightY + i * 5.5, 1, 'F');
      doc.setFontSize(6.5);
      doc.setTextColor(...COLORS.textSecondary);
      doc.setFont('helvetica', 'normal');
      doc.text(h, MARGIN + 14, highlightY + i * 5.5 + 1);
    });

    // Amazon link
    doc.setFillColor(...COLORS.brand);
    doc.roundedRect(PAGE_W - MARGIN - 50, y + 38, 46, 9, 2, 2, 'F');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.text('BUY ON AMAZON', PAGE_W - MARGIN - 27, y + 44, { align: 'center' });

    const amazonLink = `https://www.amazon.com/s?k=${encodeURIComponent(`${shoe.brand} ${shoe.model} running shoes`)}&tag=papalex-20`;
    doc.link(PAGE_W - MARGIN - 50, y + 38, 46, 9, { url: amazonLink });

    // Review link
    doc.setFontSize(6);
    doc.setTextColor(...COLORS.brand);
    doc.setFont('helvetica', 'normal');
    doc.textWithLink('Read Full Review on GearUpToFit →', PAGE_W - MARGIN - 50, y + 51, { url: shoe.reviewURL });

    y += 58;
  }

  // ---- Why This Match Works ----
  if (y + 40 < PAGE_H - 20) {
    roundedRect(doc, MARGIN, y, CONTENT_W, 38, 3, COLORS.cardBg, COLORS.cardBorder);

    doc.setFontSize(9);
    doc.setTextColor(...COLORS.brand);
    doc.setFont('helvetica', 'bold');
    doc.text('WHY THIS MATCH WORKS', MARGIN + 6, y + 8);

    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.textSecondary);
    doc.setFont('helvetica', 'normal');
    const whyLines = doc.splitTextToSize(rec.whyItWorks, CONTENT_W - 12);
    doc.text(whyLines.slice(0, 8), MARGIN + 6, y + 14);

    // Link
    doc.setFontSize(6);
    doc.setTextColor(...COLORS.brand);
    doc.textWithLink('How to Choose the Right Running Shoes →', MARGIN + 6, y + 34, { url: 'https://gearuptofit.com/running/how-to-choose-the-right-running-shoes/' });

    y += 44;
  }

  addFooter(doc, 1, totalPages);

  // ========================
  // PAGE 2: Rotation + Training
  // ========================
  doc.addPage();
  addPageBackground(doc);
  addHeader(doc);
  y = 28;

  // ---- Shoe Rotation ----
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.text('SHOE ROTATION STRATEGY', MARGIN, y);
  y += 3;
  doc.setFontSize(6.5);
  doc.setTextColor(...COLORS.textMuted);
  doc.setFont('helvetica', 'normal');
  doc.text('Multi-shoe rotation reduces injury risk by up to 39%', MARGIN, y + 4);
  y += 10;

  const rotationShoes = [
    { role: 'DAILY TRAINER', emoji: '🏃', shoe: rotation?.primary, desc: 'Easy runs & recovery' },
    rotation?.speed ? { role: 'SPEED WORK', emoji: '⚡', shoe: rotation.speed, desc: 'Tempo, intervals & race day' } : null,
    rotation?.longRun ? { role: 'LONG RUN', emoji: '🛣️', shoe: rotation.longRun, desc: 'Weekly long run (15K+)' } : null,
  ].filter(Boolean) as { role: string; emoji: string; shoe: ScoredShoe; desc: string }[];

  const cardH = 42;
  rotationShoes.forEach((item, i) => {
    const cardY = y + i * (cardH + 4);
    roundedRect(doc, MARGIN, cardY, CONTENT_W, cardH, 3, COLORS.cardBg, COLORS.cardBorder);

    // Role badge
    doc.setFillColor(...(i === 0 ? COLORS.brand : i === 1 ? [40, 120, 200] as [number, number, number] : [120, 80, 200] as [number, number, number]));
    doc.roundedRect(MARGIN + 6, cardY + 5, 32, 7, 1.5, 1.5, 'F');
    doc.setFontSize(5.5);
    doc.setTextColor(...COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.text(item.role, MARGIN + 22, cardY + 10, { align: 'center' });

    // Match %
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.brand);
    doc.setFont('helvetica', 'bold');
    doc.text(`${item.shoe.matchPercent}% match`, PAGE_W - MARGIN - 6, cardY + 10, { align: 'right' });

    // Shoe name
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.text(`${item.shoe.shoe.brand} ${item.shoe.shoe.model}`, MARGIN + 6, cardY + 20);

    doc.setFontSize(8);
    doc.setTextColor(...COLORS.brand);
    doc.text(`$${item.shoe.shoe.priceUSD}`, MARGIN + 6, cardY + 26);

    doc.setFontSize(6);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(item.desc, MARGIN + 30, cardY + 26);

    // Highlights
    item.shoe.shoe.highlights.forEach((h, hi) => {
      doc.setFillColor(...COLORS.green);
      doc.circle(MARGIN + 8 + hi * 50, cardY + 32, 0.8, 'F');
      doc.setFontSize(5.5);
      doc.setTextColor(...COLORS.textSecondary);
      doc.text(h, MARGIN + 11 + hi * 50, cardY + 33);
    });

    // Amazon button
    doc.setFillColor(...COLORS.brand);
    doc.roundedRect(PAGE_W - MARGIN - 38, cardY + 28, 34, 8, 2, 2, 'F');
    doc.setFontSize(5.5);
    doc.setTextColor(...COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.text('BUY ON AMAZON', PAGE_W - MARGIN - 21, cardY + 33.5, { align: 'center' });
    const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(`${item.shoe.shoe.brand} ${item.shoe.shoe.model} running shoes`)}&tag=papalex-20`;
    doc.link(PAGE_W - MARGIN - 38, cardY + 28, 34, 8, { url: amazonUrl });

    // Review link
    doc.setFontSize(5);
    doc.setTextColor(...COLORS.brand);
    doc.textWithLink('Read Review →', PAGE_W - MARGIN - 34, cardY + 40, { url: item.shoe.shoe.reviewURL });
  });

  y += rotationShoes.length * (cardH + 4) + 6;

  // ---- Training Emphasis ----
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.text('TRAINING EMPHASIS', MARGIN, y);
  y += 6;

  rec.trainingEmphasis.forEach((tip, i) => {
    if (y > PAGE_H - 25) return;

    // Number badge
    doc.setFillColor(...COLORS.brand);
    doc.circle(MARGIN + 4, y + 1.5, 3, 'F');
    doc.setFontSize(6);
    doc.setTextColor(...COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.text(String(i + 1), MARGIN + 4, y + 3, { align: 'center' });

    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.textSecondary);
    doc.setFont('helvetica', 'normal');
    const tipLines = doc.splitTextToSize(tip, CONTENT_W - 16);
    doc.text(tipLines, MARGIN + 12, y + 2.5);
    y += tipLines.length * 3.5 + 4;
  });

  // Link to running plan
  if (y < PAGE_H - 25) {
    y += 2;
    doc.setFontSize(6);
    doc.setTextColor(...COLORS.brand);
    doc.textWithLink('Get a Free Custom Running Plan →', MARGIN, y, { url: 'https://gearuptofit.com/running/custom-running-plan-free/' });
  }

  addFooter(doc, 2, totalPages);

  // ========================
  // PAGE 3: Resources + Links
  // ========================
  doc.addPage();
  addPageBackground(doc);
  addHeader(doc);
  y = 28;

  doc.setFontSize(14);
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.text('RECOMMENDED RESOURCES', MARGIN, y);
  y += 4;
  doc.setFontSize(6.5);
  doc.setTextColor(...COLORS.textMuted);
  doc.setFont('helvetica', 'normal');
  doc.text('Curated articles & tools from GearUpToFit based on your profile', MARGIN, y + 3);
  y += 12;

  // ---- Read Before You Buy ----
  roundedRect(doc, MARGIN, y, CONTENT_W, 30, 3, COLORS.cardBg, COLORS.cardBorder);

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.accent);
  doc.setFont('helvetica', 'bold');
  doc.text('📖 READ BEFORE YOU BUY', MARGIN + 6, y + 8);

  const mustReadLinks = [
    { title: 'How to Choose the Right Running Shoes', url: 'https://gearuptofit.com/running/how-to-choose-the-right-running-shoes/' },
    { title: 'Running Shoes Reviews 2026', url: 'https://gearuptofit.com/review/running-shoes/' },
    { title: 'Best Running Shoes for Different Distances 2026', url: 'https://gearuptofit.com/review/best-running-shoes-for-different-distances/' },
  ];

  mustReadLinks.forEach((link, i) => {
    const ly = y + 14 + i * 5;
    doc.setFillColor(...COLORS.brand);
    doc.circle(MARGIN + 9, ly, 1, 'F');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.brand);
    doc.setFont('helvetica', 'normal');
    doc.textWithLink(link.title, MARGIN + 14, ly + 1.5, { url: link.url });
  });

  y += 36;

  // ---- Recommended Articles ----
  const articles = getRecommendedArticles(answers);

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.brand);
  doc.setFont('helvetica', 'bold');
  doc.text('PERSONALIZED ARTICLES FOR YOU', MARGIN, y + 4);
  y += 10;

  articles.forEach((article, i) => {
    if (y > PAGE_H - 50) return;
    const itemH = 10;
    roundedRect(doc, MARGIN, y, CONTENT_W, itemH, 2, [35, 38, 48]);

    doc.setFontSize(6);
    doc.setTextColor(...COLORS.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text(article.category.toUpperCase(), MARGIN + 4, y + 4);

    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textPrimary);
    doc.setFont('helvetica', 'bold');
    doc.textWithLink(article.title, MARGIN + 4, y + 8, { url: article.url });

    doc.setFontSize(5.5);
    doc.setTextColor(...COLORS.brand);
    doc.text('→', PAGE_W - MARGIN - 6, y + 6);
    doc.link(MARGIN, y, CONTENT_W, itemH, { url: article.url });

    y += itemH + 3;
  });

  y += 4;

  // ---- Injury Resources ----
  const injuryArticles = getInjuryArticles(answers.injuries);
  if (injuryArticles.length > 0 && y < PAGE_H - 60) {
    doc.setFontSize(9);
    doc.setTextColor(230, 80, 80);
    doc.setFont('helvetica', 'bold');
    doc.text('INJURY PREVENTION RESOURCES', MARGIN, y + 4);
    y += 10;

    injuryArticles.forEach(article => {
      if (y > PAGE_H - 50) return;
      roundedRect(doc, MARGIN, y, CONTENT_W, 10, 2, [35, 38, 48]);

      doc.setFontSize(6);
      doc.setTextColor(...COLORS.textMuted);
      doc.text(article.category.toUpperCase(), MARGIN + 4, y + 4);

      doc.setFontSize(7);
      doc.setTextColor(...COLORS.textPrimary);
      doc.setFont('helvetica', 'bold');
      doc.textWithLink(article.title, MARGIN + 4, y + 8, { url: article.url });
      doc.link(MARGIN, y, CONTENT_W, 10, { url: article.url });

      y += 13;
    });

    y += 2;
  }

  // ---- Useful Tools ----
  if (y < PAGE_H - 50) {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.brand);
    doc.setFont('helvetica', 'bold');
    doc.text('FREE TOOLS & CALCULATORS', MARGIN, y + 4);
    y += 10;

    const tools = [
      { title: 'Free Custom Running Plan', url: 'https://gearuptofit.com/running/custom-running-plan-free/' },
      { title: 'Running Distance Calculator', url: 'https://gearuptofit.com/running/running-distance-calculator/' },
      { title: 'Macro Calculator', url: 'https://gearuptofit.com/fitness-and-health-calculators/macro-calculator/' },
      { title: 'Sleep Efficiency Calculator', url: 'https://gearuptofit.com/fitness-and-health-calculators/sleep-efficiency-calculator/' },
    ];

    const toolColW = CONTENT_W / 2 - 2;
    tools.forEach((tool, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const tx = MARGIN + col * (toolColW + 4);
      const ty = y + row * 14;

      roundedRect(doc, tx, ty, toolColW, 11, 2, [35, 38, 48]);
      doc.setFontSize(6.5);
      doc.setTextColor(...COLORS.brand);
      doc.setFont('helvetica', 'bold');
      doc.textWithLink(tool.title, tx + 4, ty + 7, { url: tool.url });
      doc.link(tx, ty, toolColW, 11, { url: tool.url });
    });

    y += Math.ceil(tools.length / 2) * 14 + 6;
  }

  // ---- About / CTA ----
  if (y < PAGE_H - 40) {
    roundedRect(doc, MARGIN, y, CONTENT_W, 28, 3, [35, 25, 25], COLORS.brand);

    doc.setFontSize(10);
    doc.setTextColor(...COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.text('GEAR UP. SHOW UP. LEVEL UP.', PAGE_W / 2, y + 10, { align: 'center' });

    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.textSecondary);
    doc.setFont('helvetica', 'normal');
    doc.text('Visit GearUpToFit for expert running gear reviews, training plans & more.', PAGE_W / 2, y + 16, { align: 'center' });

    doc.setFontSize(7);
    doc.setTextColor(...COLORS.brand);
    doc.setFont('helvetica', 'bold');
    doc.textWithLink('gearuptofit.com', PAGE_W / 2 - 10, y + 22, { url: 'https://gearuptofit.com/' });
    doc.text('  |  ', PAGE_W / 2, y + 22, { align: 'center' });
    doc.textWithLink('About Us', PAGE_W / 2 + 8, y + 22, { url: 'https://gearuptofit.com/about-us/' });
  }

  addFooter(doc, 3, totalPages);

  // Save
  const slug = `runmatch-${answers.terrain}-${answers.distance}-${answers.pronation}`;
  doc.save(`GearUpToFit-RunMatch-Report-${slug}.pdf`);
}
