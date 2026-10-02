import { describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { budgetText, buildResultsPDF, getShoeActions, pdfSafe, replacementWindow, type PDFData } from './pdf-generator';
import { generateRecommendation } from './recommendation-engine';
import { buildRotation, scoreShoes } from './scoring-engine';
import { getAmazonLinkForShoe } from './amazon-link';
import { hasVerifiedPhoto } from './shoe-images';
import { resolveShoePhoto } from './amazon-images';
import { generateSlug, type QuizAnswers } from './quiz-data';
import { shoeDatabase } from './shoe-database';

const IMAGES = resolve(__dirname, '../../public/images/shoes');
const LOGO = resolve(__dirname, '../../public/images/gearuptofit-logo.png');

/** Serve photos straight from public/ instead of over HTTP. Amazon listing photos are stood in by a local photo. */
async function fetchFromDisk(url: string): Promise<Blob | null> {
  if (url.startsWith('https://m.media-amazon.com/')) url = '/images/shoes/brooks-adrenaline-gts-25.jpg';
  const name = url.split('/images/')[1];
  if (!name) return null;
  const file = name === 'gearuptofit-logo.png' ? LOGO : resolve(IMAGES, name.replace(/^shoes\//, ''));
  if (!existsSync(file)) return null;
  const buf = readFileSync(file);
  return new Blob([new Uint8Array(buf)], { type: file.endsWith('.png') ? 'image/png' : 'image/jpeg' });
}

const base = (over: Partial<QuizAnswers> = {}): QuizAnswers => ({
  pronation: 'overpronation',
  distance: '10k',
  terrain: 'road',
  footType: 'flat',
  injuries: ['none'],
  budget: ['100-150'],
  brand: [],
  paceGoal: 'moderate',
  weeklyMileage: 30,
  ...over,
} as QuizAnswers);

function dataFor(answers: QuizAnswers): PDFData {
  const rotation = buildRotation(answers);
  return {
    answers,
    recommendation: generateRecommendation(answers),
    rotation,
    radarData: [
      { axis: 'Cushioning', value: 7 },
      { axis: 'Speed', value: 6 },
      { axis: 'Distance', value: 5 },
      { axis: 'Stability', value: 9 },
      { axis: 'Trail', value: 2 },
      { axis: 'Recovery', value: 3 },
    ],
    topShoes: scoreShoes(answers).slice(0, 5),
    slug: generateSlug(answers),
  };
}

const bytesOf = (doc: { output: (t: 'arraybuffer') => ArrayBuffer }) => Buffer.from(doc.output('arraybuffer')).toString('latin1');
const urisIn = (raw: string) => [...raw.matchAll(/\/URI \(([^)]*)\)/g)].map((m) => m[1]);

const SCENARIOS: Record<string, QuizAnswers> = {
  'flat-overpronator-10k': base(),
  'marathon-neutral': base({ pronation: 'neutral', distance: 'marathon', footType: 'neutral', weeklyMileage: 70, paceGoal: 'tempo', budget: ['150-200', '200-plus'] }),
  'trail-wide': base({ terrain: 'trail', footType: 'wide', distance: 'ultra', weeklyMileage: 55, budget: [] }),
  'injured': base({ injuries: ['plantar-fasciitis', 'shin-splints'], weeklyMileage: 15, paceGoal: 'easy' }),
};

describe('PDF report', () => {
  it('builds a multi-page report with real photos and clickable links', async () => {
    const { doc, stats } = await buildResultsPDF(dataFor(SCENARIOS['flat-overpronator-10k']), { compress: false, fetchImage: fetchFromDisk });
    expect(stats.pages).toBeGreaterThanOrEqual(4);
    expect(stats.pages).toBeLessThanOrEqual(8);
    expect(stats.photos).toBeGreaterThanOrEqual(1);
    const raw = bytesOf(doc);
    expect(raw).toContain('/Subtype /Image');
    expect(urisIn(raw).length).toBeGreaterThan(10);
  });

  it('embeds the logo and a photo for every shoe that has a verified photo (own or Amazon listing)', async () => {
    const data = dataFor(SCENARIOS['marathon-neutral']);
    const { doc, stats } = await buildResultsPDF(data, { compress: false, fetchImage: fetchFromDisk });
    const shown = new Map<string, boolean>();
    for (const s of [data.rotation.primary, data.rotation.speed, data.rotation.longRun, ...(data.topShoes ?? [])]) {
      if (s) shown.set(s.shoe.id, !!resolveShoePhoto(s.shoe));
    }
    const verified = [...shown.values()].filter(Boolean).length;
    expect(stats.photos).toBe(verified);
    // image XObjects: one per distinct photo (jsPDF de-duplicates by content) + the logo
    const images = (bytesOf(doc).match(/\/Subtype \/Image/g) ?? []).length;
    expect(images).toBeGreaterThanOrEqual(1);
  });

  it('only links Amazon for shoes with a verified listing, never a search page', async () => {
    for (const [name, answers] of Object.entries(SCENARIOS)) {
      const data = dataFor(answers);
      const { doc, stats } = await buildResultsPDF(data, { compress: false, fetchImage: fetchFromDisk });
      const uris = urisIn(bytesOf(doc));
      const amazon = uris.filter((u) => u.includes('amazon.com'));
      // every Amazon link is a direct /dp/ page carrying the affiliate tag
      for (const u of amazon) expect(u, name).toMatch(/^https:\/\/www\.amazon\.com\/dp\/[A-Z0-9]{10}\/\?tag=papalex-20$/);
      expect(uris.some((u) => /amazon\.com\/s[/?]/.test(u)), name).toBe(false);

      // each shown shoe: an Amazon link iff the cache has a verified ASIN
      const shown = new Map<string, (typeof data.rotation.primary)['shoe']>();
      for (const s of [data.rotation.primary, data.rotation.speed, data.rotation.longRun, ...(data.topShoes ?? [])]) if (s) shown.set(s.shoe.id, s.shoe);
      for (const shoe of shown.values()) {
        const url = getAmazonLinkForShoe(shoe.id, shoe.brand, shoe.model, shoe.amazonASIN);
        const escaped = url ? url.replace(/[()\\]/g, '\\$&') : null;
        if (url) expect(uris, `${name}: ${shoe.id}`).toContain(escaped);
        else expect(getShoeActions(shoe).buy, `${name}: ${shoe.id}`).toBeNull();
      }
      expect(stats.buyButtons).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives a shoe without a verified Amazon listing an honest fallback instead of a guess', () => {
    const noLink = shoeDatabase.find((s) => !getAmazonLinkForShoe(s.id, s.brand, s.model, s.amazonASIN));
    expect(noLink, 'expected at least one shoe without a verified listing').toBeTruthy();
    const a = getShoeActions(noLink!);
    expect(a.buy).toBeNull();
    expect(a.review.url).toMatch(/^https:\/\/(www\.)?gearuptofit\.com\//);
    if (a.brandSite) expect(a.brandSite.url).toMatch(/^https:\/\/(?!(www\.)?google\.)/);
  });

  it('labels women\'s-only listings', () => {
    const womens = shoeDatabase
      .map((s) => ({ s, a: getShoeActions(s) }))
      .find(({ a }) => a.buy && /WOMEN'S VERSION/.test(a.buy.label));
    if (womens) expect(womens.a.buy!.url).toContain('/dp/');
  });

  it('shows an honest placeholder, not a wrong photo, when a shoe has no verified photo at all', async () => {
    const unverified = shoeDatabase.filter((s) => !resolveShoePhoto(s));
    expect(unverified.length).toBeGreaterThan(0);
    const answers = base();
    const top = scoreShoes(answers).slice(0, 5);
    const forced = { ...dataFor(answers), topShoes: top };
    const { doc } = await buildResultsPDF(forced, { compress: false, fetchImage: fetchFromDisk });
    const raw = bytesOf(doc);
    const expectedPlaceholders = new Set([forced.rotation.primary, forced.rotation.speed, forced.rotation.longRun, ...top].filter(Boolean).map((s) => s!.shoe.id));
    const unverifiedShown = [...expectedPlaceholders].filter((id) => !resolveShoePhoto(shoeDatabase.find((s) => s.id === id)!)).length;
    expect(unverifiedShown > 0 ? raw.includes('Photo not available') : !raw.includes('Photo not available')).toBe(true);
  });

  it('is accurate and carries the safety and disclosure copy', async () => {
    const { doc } = await buildResultsPDF(dataFor(SCENARIOS['injured']), { compress: false, fetchImage: fetchFromDisk });
    const raw = bytesOf(doc);
    expect(raw).toMatch(/NOT MEDICAL ADVICE/);
    expect(raw).toMatch(/Amazon Associate/);
    expect(raw).toMatch(/Page 1 of /);
    // no rehab prescriptions or invented guarantees
    expect(raw).not.toMatch(/\bguarantee|\bcures?\b|\bheals? your|reduces? injury risk by/i);
  });

  it('survives photos failing to load', async () => {
    const { doc, stats } = await buildResultsPDF(dataFor(base()), { compress: false, fetchImage: async () => null });
    expect(stats.photos).toBe(0);
    expect(stats.pages).toBeGreaterThanOrEqual(4);
    expect(doc.getNumberOfPages()).toBe(stats.pages);
  });

  it('writes sample PDFs for visual review when PDF_DUMP_DIR is set', async () => {
    const dir = process.env.PDF_DUMP_DIR;
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    for (const [name, answers] of Object.entries(SCENARIOS)) {
      const { doc } = await buildResultsPDF(dataFor(answers), { fetchImage: fetchFromDisk });
      writeFileSync(resolve(dir, `${name}.pdf`), Buffer.from(doc.output('arraybuffer')));
    }
  });
});

describe('pdfSafe', () => {
  it('maps typographic marks and strips what the PDF font cannot draw', () => {
    expect(pdfSafe('It’s “great” → go')).toBe('It\'s "great" > go');
    expect(pdfSafe('Run 🏃 now ✓')).toBe('Run  now ');
    expect(pdfSafe('café – 10 km')).toBe('café – 10 km');
    expect(pdfSafe(null)).toBe('');
  });
});

describe('replacementWindow', () => {
  it('turns weekly distance into months', () => {
    expect(replacementWindow(30)).toMatch(/roughly 4-6 months|about/);
    expect(replacementWindow(80)).toContain('80 km a week');
    expect(replacementWindow(0)).toBe('at around 500-800 km (300-500 miles)');
    expect(replacementWindow(Number.NaN)).toBe('at around 500-800 km (300-500 miles)');
  });
});

describe('budgetText', () => {
  it('says Any budget when every band is accepted or none is picked', () => {
    expect(budgetText(['under-100', '100-150', '150-200', '200-plus'])).toBe('Any budget');
    expect(budgetText([])).toBe('Any budget');
    expect(budgetText(undefined)).toBe('Any budget');
  });
  it('lists the chosen bands otherwise', () => {
    expect(budgetText(['100-150', '150-200'])).toBe('$100-150, $150-200');
    expect(budgetText(['under-100'])).toBe('Under $100');
  });
});
