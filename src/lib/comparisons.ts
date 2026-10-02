/**
 * Curated head-to-head shoe comparison pairs.
 *
 * Each pair generates a dedicated SEO landing page at
 * /compare/:slug (slug format: "{shoe-a-id}-vs-{shoe-b-id}").
 *
 * These target high-intent commercial keywords ("nike pegasus vs brooks
 * ghost", etc.) and convert browsers via the RunMatch AI quiz CTA.
 */
import { shoeDatabase, Shoe } from './shoe-database';

export interface ComparisonPair {
  a: string; // shoe id
  b: string; // shoe id
  /** Optional override headline. If omitted, generated from the two shoes. */
  angle?: string;
}

export const COMPARISONS: ComparisonPair[] = [
  { a: 'nike-pegasus-41', b: 'brooks-ghost-17', angle: 'The classic daily-trainer showdown' },
  { a: 'nike-pegasus-41', b: 'asics-novablast-5', angle: 'Versatile workhorse vs bouncy daily' },
  { a: 'brooks-ghost-17', b: 'asics-gel-nimbus-28', angle: 'Balanced cushion vs plush max-cushion' },
  { a: 'hoka-bondi-9', b: 'asics-gel-nimbus-28', angle: 'Max-cushion heavyweights' },
  { a: 'hoka-bondi-9', b: 'brooks-glycerin-max-2', angle: 'Premium recovery shoe face-off' },
  { a: 'nike-alphafly-3', b: 'nike-vaporfly-3', angle: 'Alphafly vs Vaporfly: which super shoe?' },
  { a: 'nike-vaporfly-3', b: 'adidas-adios-pro-4', angle: 'Vaporfly vs Adios Pro: marathon PR battle' },
  { a: 'adidas-adios-pro-4', b: 'asics-superblast-3', angle: 'Carbon-plate racer vs super trainer' },
  { a: 'asics-superblast-3', b: 'hoka-mach-6', angle: 'Lightweight super trainers compared' },
  { a: 'asics-gel-kayano-32', b: 'brooks-adrenaline-gts-25', angle: 'Stability classics for overpronators' },
  { a: 'hoka-speedgoat-6', b: 'salomon-sense-ride-6', angle: 'Trail kings: cushion vs grip' },
  { a: 'salomon-speedcross-6', b: 'hoka-speedgoat-6', angle: 'Technical trail showdown' },
  { a: 'nb-1080-v14', b: 'hoka-bondi-9', angle: 'Plush daily trainers' },
  { a: 'saucony-ride-19', b: 'brooks-ghost-17', angle: 'Smooth daily trainer head-to-head' },
  { a: 'asics-novablast-5', b: 'asics-novablast-4', angle: 'Novablast 5 vs Novablast 4: should you upgrade?' },
  { a: 'nike-pegasus-41', b: 'nike-pegasus-premium', angle: 'Pegasus 41 vs Pegasus Premium' },
  { a: 'adidas-boston-13', b: 'adidas-adios-9', angle: 'Boston vs Adios: tempo vs race' },
  { a: 'on-cloudsurfer-2', b: 'nike-pegasus-41', angle: 'On Cloudsurfer 2 vs Nike Pegasus 41' },
  { a: 'saucony-endorphin-pro-4', b: 'nike-vaporfly-3', angle: 'Endorphin Pro 4 vs Vaporfly 3' },
  { a: 'hoka-mach-6', b: 'saucony-kinvara-15', angle: 'Lightweight uptempo daily trainers' },
];

export function buildComparisonSlug(aId: string, bId: string): string {
  return `${aId}-vs-${bId}`;
}

export function parseComparisonSlug(slug: string): { aId: string; bId: string } | null {
  const idx = slug.indexOf('-vs-');
  if (idx === -1) return null;
  return { aId: slug.slice(0, idx), bId: slug.slice(idx + 4) };
}

export interface ResolvedComparison {
  pair: ComparisonPair;
  slug: string;
  a: Shoe;
  b: Shoe;
  title: string;
  description: string;
  h1: string;
}

const shoeMap = new Map(shoeDatabase.map(s => [s.id, s]));

export function getComparison(slug: string): ResolvedComparison | null {
  const parsed = parseComparisonSlug(slug);
  if (!parsed) return null;
  const a = shoeMap.get(parsed.aId);
  const b = shoeMap.get(parsed.bId);
  if (!a || !b) return null;
  const pair = COMPARISONS.find(p =>
    (p.a === parsed.aId && p.b === parsed.bId) ||
    (p.a === parsed.bId && p.b === parsed.aId),
  ) || { a: parsed.aId, b: parsed.bId };
  const h1 = `${a.brand} ${a.model} vs ${b.brand} ${b.model} (2026)`;
  // Keep the brand suffix only when it fits; never cut a title mid-word.
  const versus = `${a.brand} ${a.model} vs ${b.brand} ${b.model}`;
  const title = `${versus} | RunMatch AI`.length <= 60 ? `${versus} | RunMatch AI` : versus;
  const description = `${versus}: structured specs, weight, drop, cushioning and which one fits your stride. Free AI quiz inside.`.slice(0, 160);
  return { pair, slug: buildComparisonSlug(a.id, b.id), a, b, title, description, h1 };
}

/**
 * Plain-language "which one is better for what" bullets, derived only from the
 * two shoes' recorded specs. Shared by the comparison page and the prerenderer.
 */
export function verdictFor(a: Shoe, b: Shoe): string[] {
  const points: string[] = [];
  if (a.weightGrams < b.weightGrams - 10) points.push(`${a.brand} ${a.model} is noticeably lighter — better for tempo and race-day.`);
  else if (b.weightGrams < a.weightGrams - 10) points.push(`${b.brand} ${b.model} is noticeably lighter — better for tempo and race-day.`);
  if (a.cushioning > b.cushioning + 1) points.push(`${a.brand} ${a.model} offers more cushioning — better for recovery and long runs.`);
  else if (b.cushioning > a.cushioning + 1) points.push(`${b.brand} ${b.model} offers more cushioning — better for recovery and long runs.`);
  if (a.priceUSD < b.priceUSD - 20) points.push(`${a.brand} ${a.model} has a $${b.priceUSD - a.priceUSD} lower MSRP.`);
  else if (b.priceUSD < a.priceUSD - 20) points.push(`${b.brand} ${b.model} has a $${a.priceUSD - b.priceUSD} lower MSRP.`);
  if (a.pronation.includes('overpronation') && !b.pronation.includes('overpronation')) points.push(`${a.brand} ${a.model} is listed with support for overpronation; ${b.brand} ${b.model} is not.`);
  else if (b.pronation.includes('overpronation') && !a.pronation.includes('overpronation')) points.push(`${b.brand} ${b.model} is listed with support for overpronation; ${a.brand} ${a.model} is not.`);
  if (points.length === 0) points.push('Both shoes are close on paper — the right pick comes down to fit and ride feel.');
  return points;
}

export function getAllComparisons(): ResolvedComparison[] {
  return COMPARISONS
    .map(p => getComparison(buildComparisonSlug(p.a, p.b)))
    .filter((c): c is ResolvedComparison => c !== null);
}

/**
 * Which shoe "wins" each spec axis, for table highlighting.
 * Lower-is-better for weight; higher-is-better for cushioning.
 */
export function compareSpecs(a: Shoe, b: Shoe) {
  return {
    weight: a.weightGrams === b.weightGrams ? null : a.weightGrams < b.weightGrams ? 'a' : 'b',
    cushioning: a.cushioning === b.cushioning ? null : a.cushioning > b.cushioning ? 'a' : 'b',
    price: a.priceUSD === b.priceUSD ? null : a.priceUSD < b.priceUSD ? 'a' : 'b',
    drop: a.dropMM === b.dropMM ? null : null, // neutral
  } as const;
}
