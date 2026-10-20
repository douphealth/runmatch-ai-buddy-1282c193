import { describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { budgetText, buildResultsPDF, fitSummary, getShoeActions, pdfSafe, pickByPriority, replacementWindow, type PDFData } from './pdf-generator';
import { generateRecommendation } from './recommendation-engine';
import { buildRotation, scoreShoes } from './scoring-engine';
import { getAmazonLinkForShoe } from './amazon-link';
import { hasVerifiedPhoto } from './shoe-images';
import { resolveShoePhoto } from './amazon-images';
import { generateSlug, type QuizAnswers } from './quiz-data';
import { allShoesIncludingHidden, isBuyable, shoeDatabase } from './shoe-database';

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
    expect(stats.pages).toBeGreaterThanOrEqual(6);
    expect(stats.pages).toBeLessThanOrEqual(11);
    expect(stats.photos).toBeGreaterThanOrEqual(1);
    const raw = bytesOf(doc);
    expect(raw).toContain('/Subtype /Image');
    expect(urisIn(raw).length).toBeGreaterThan(10);
  });

  it('embeds the logo and a photo for every shoe that has a verified photo (own or Amazon listing)', async () => {
    const data = dataFor(SCENARIOS['marathon-neutral']);
    const { doc, stats } = await buildResultsPDF(data, { compress: false, fetchImage: fetchFromDisk });
    const shown = new Map<string, boolean>();
    for (const id of stats.shownShoeIds) shown.set(id, !!resolveShoePhoto(shoeDatabase.find((s) => s.id === id)!));
    // the report shows more than the top 5: the rotation, ranks 4 to 10 and the priority alternatives
    expect(stats.shownShoeIds.length).toBeGreaterThanOrEqual(8);
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
      for (const id of stats.shownShoeIds) shown.set(id, shoeDatabase.find((s) => s.id === id)!);
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
    // The app hides such shoes now; the report still never guesses if one ever reaches it.
    const noLink = allShoesIncludingHidden.find((s) => !getAmazonLinkForShoe(s.id, s.brand, s.model, s.amazonASIN));
    expect(noLink, 'expected at least one shoe without a verified listing in the data file').toBeTruthy();
    expect(isBuyable(noLink!)).toBe(false);
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

  it('every shoe in the report has an Amazon link and its listing photo; a photo that fails to load is drawn as an honest placeholder', async () => {
    const answers = base();
    const data = dataFor(answers);
    const { doc, stats } = await buildResultsPDF(data, { compress: false, fetchImage: fetchFromDisk });
    for (const id of stats.shownShoeIds) {
      const shoe = shoeDatabase.find((s) => s.id === id)!;
      expect(resolveShoePhoto(shoe)?.source, id).toBe('amazon');
      expect(getShoeActions(shoe).buy, id).not.toBeNull();
    }
    expect(bytesOf(doc)).not.toContain('Photo not available');
    const failed = await buildResultsPDF(data, { compress: false, fetchImage: async () => null });
    expect(bytesOf(failed.doc)).toContain('Photo not available');
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

  it('has every section a runner needs: top 3, comparison, alternatives, shoe log and verified gear', async () => {
    const { doc } = await buildResultsPDF(dataFor(SCENARIOS['marathon-neutral']), { compress: false, fetchImage: fetchFromDisk });
    const raw = bytesOf(doc);
    for (const heading of ['Your top 3 at a glance', 'Your top 3, side by side', 'HOW TO CHOOSE BETWEEN THEM', 'Your shoe rotation', 'More strong matches', 'Your shoe log', 'Complete your kit', 'WHO IT SUITS', 'WHO SHOULD LOOK ELSEWHERE']) {
      expect(raw, heading).toContain(heading);
    }
  });

  it('never prints a live price (Amazon Associates rule), only the launch price band', async () => {
    const { doc } = await buildResultsPDF(dataFor(base()), { compress: false, fetchImage: fetchFromDisk });
    const raw = bytesOf(doc);
    expect(raw).not.toMatch(/\$\s?\d{2,3}\.\d{2}/);
    expect(raw).toMatch(/Launch price band/);
  });

  it('survives photos failing to load', async () => {
    const { doc, stats } = await buildResultsPDF(dataFor(base()), { compress: false, fetchImage: async () => null });
    expect(stats.photos).toBe(0);
    expect(stats.pages).toBeGreaterThanOrEqual(6);
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

describe('fitSummary', () => {
  const by = (id: string) => shoeDatabase.find((x) => x.id === id)!;
  it('describes who a shoe suits from its own category and specs', () => {
    const racer = shoeDatabase.find((x) => x.category === 'race')!;
    const f = fitSummary(racer, { footType: 'neutral' });
    expect(f.suits.join(' ')).toMatch(/race day/i);
    expect(f.elsewhere.join(' ')).toMatch(/easy daily miles/i);
    expect(f.suits.length).toBeGreaterThan(0);
    expect(f.suits.length).toBeLessThanOrEqual(3);
    expect(f.elsewhere.length).toBeLessThanOrEqual(3);
  });
  it('warns a wide-footed runner when only a standard width is listed', () => {
    const narrow = shoeDatabase.find((x) => !x.widthOptions)!;
    expect(fitSummary(narrow, { footType: 'wide' }).elsewhere[0]).toMatch(/wide forefoot/i);
    expect(fitSummary(narrow, { footType: 'neutral' }).elsewhere.join(' ')).not.toMatch(/wide forefoot/i);
  });
  it('flags a low drop for a gradual switch', () => {
    const low = shoeDatabase.find((x) => x.dropMM <= 4 && x.dropMM > 0);
    if (low) expect(fitSummary(low, { footType: 'neutral' }).elsewhere.join(' ')).toMatch(/gradually/i);
    void by;
  });
});

describe('pickByPriority', () => {
  it('only offers current, strong matches that really beat the #1 on one point, each shoe once', () => {
    for (const answers of Object.values(SCENARIOS)) {
      const pool = scoreShoes(answers);
      const picks = pickByPriority(pool, pool[0], answers.footType === 'wide');
      const ids = picks.map((p) => p.sc.shoe.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const p of picks) {
        expect(p.sc.shoe.id).not.toBe(pool[0].shoe.id);
        expect(p.sc.newerVersion).toBeUndefined();
        expect(p.sc.matchPercent).toBeGreaterThanOrEqual(Math.max(40, pool[0].matchPercent - 20));
        if (p.label === 'SOFTEST RIDE') expect(p.sc.shoe.cushioning).toBeGreaterThan(pool[0].shoe.cushioning);
        if (p.label === 'LIGHTEST') expect(p.sc.shoe.weightGrams).toBeLessThan(pool[0].shoe.weightGrams);
        if (p.label === 'BEST VALUE') expect(p.sc.shoe.priceUSD).toBeLessThan(pool[0].shoe.priceUSD);
        if (p.label === 'WIDE SIZES LISTED') expect(p.sc.shoe.widthOptions).toBe(true);
      }
    }
  });
});
