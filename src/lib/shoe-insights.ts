/**
 * Derived, data-only insights about a shoe. Nothing here asserts an outside
 * fact: every statement is computed from the structured records in
 * shoe-database.ts or from the runner's own quiz answers. That keeps the
 * "honest negatives" and "newer version" notes defensible and testable.
 */
import { Shoe, shoeDatabase } from './shoe-database';
import type { QuizAnswers } from './quiz-data';

// ---------------------------------------------------------------------------
// Model families & newer versions
// ---------------------------------------------------------------------------

interface ParsedModel {
  brand: string;
  family: string;
  version: number | null;
}

/** "Adizero Adios Pro 3" -> { family: "adios pro", version: 3 }. */
export function parseModel(shoe: Pick<Shoe, 'brand' | 'model'>): ParsedModel {
  const brand = shoe.brand.trim().toLowerCase();
  let model = shoe.model.trim().toLowerCase().replace(/^adizero\s+/, '');
  let version: number | null = null;
  const m = model.match(/^(.*?)[\s-]+v?(\d{1,3})$/);
  if (m) {
    model = m[1].trim();
    version = parseInt(m[2], 10);
  }
  return { brand, family: model, version };
}

const PARSED = new Map<string, ParsedModel>(shoeDatabase.map((s) => [s.id, parseModel(s)]));

/**
 * Returns the newest version of the same shoe family that also exists in our
 * database (same brand, same model name, higher version number), or undefined.
 */
export function getNewerVersion(shoe: Shoe): Shoe | undefined {
  const me = PARSED.get(shoe.id) ?? parseModel(shoe);
  if (me.version === null) return undefined;
  let best: Shoe | undefined;
  let bestVersion = me.version;
  for (const other of shoeDatabase) {
    if (other.id === shoe.id) continue;
    const p = PARSED.get(other.id);
    if (!p || p.version === null) continue;
    if (p.brand === me.brand && p.family === me.family && p.version > bestVersion) {
      best = other;
      bestVersion = p.version;
    }
  }
  return best;
}

export const isPreviousGeneration = (shoe: Shoe): boolean => getNewerVersion(shoe) !== undefined;

// ---------------------------------------------------------------------------
// Honest negatives ("who should skip it / what to check")
// ---------------------------------------------------------------------------

const hasInjury = (a?: QuizAnswers) => !!a && a.injuries.some((i) => i !== 'none');

const INJURY_LABELS: Record<string, string> = {
  'plantar-fasciitis': 'plantar fasciitis',
  'shin-splints': 'shin splints',
  'it-band': 'IT band pain',
  'knee-pain': 'knee pain',
  achilles: 'Achilles problems',
};

const budgetCovers = (budgets: string[], price: number): boolean =>
  budgets.some((b) => {
    switch (b) {
      case 'under-100':
        return price <= 100;
      case '100-150':
        return price >= 100 && price <= 150;
      case '150-200':
        return price >= 150 && price <= 200;
      case '200-plus':
        return price >= 200;
      default:
        return false;
    }
  });

/**
 * Up to `limit` plain-language reasons this shoe might NOT suit a runner.
 * With `answers` the notes are personalised; without, they describe who the
 * shoe is generally a weaker fit for (used on shoe pages).
 */
export function getWatchOuts(shoe: Shoe, answers?: QuizAnswers, limit = 4): string[] {
  const out: string[] = [];
  const newer = getNewerVersion(shoe);
  if (newer) out.push(`Previous generation: a newer version, the ${newer.brand} ${newer.model}, is in our database.`);

  if (answers) {
    if (answers.terrain === 'trail' && !shoe.terrain.includes('trail'))
      out.push('Built for roads: the outsole has limited grip on technical or muddy trails.');
    if ((answers.terrain === 'road' || answers.terrain === 'track') && shoe.terrain.includes('trail') && !shoe.terrain.includes('road'))
      out.push('Trail outsole: the lugs can feel harsh and wear quickly on pavement.');
    if (answers.footType === 'wide' && !shoe.widthOptions)
      out.push('Wide sizes are not listed in our data, so check forefoot room before you commit.');
    if (answers.budget.length > 0 && !budgetCovers(answers.budget, shoe.priceUSD))
      out.push(`At about $${shoe.priceUSD} it sits outside the budget range you selected.`);
    if (hasInjury(answers) && shoe.category === 'race')
      out.push('Race-day shoe: built for speed rather than protection, so not an everyday pick while you manage an injury.');
    const hurt = answers.injuries.filter((i) => i !== 'none' && !shoe.injuryFriendly.includes(i));
    if (hurt.length > 0)
      out.push(`Our data does not flag it as a comfort pick for ${hurt.map((i) => INJURY_LABELS[i] ?? i).join(', ')}.`);
    if ((answers.paceGoal === 'tempo' || answers.paceGoal === 'race') && shoe.cushioning >= 9)
      out.push('Very soft cushioning can feel less responsive at tempo and race paces.');
    if (answers.weeklyMileage > 50 && shoe.cushioning <= 5)
      out.push('Light cushioning can feel harsh across high weekly mileage.');
    if (answers.pronation === 'neutral' && shoe.category === 'stability')
      out.push('Adds support you may not need if your gait is neutral.');
  }

  if (shoe.category === 'race' && !(answers && hasInjury(answers)))
    out.push('Race-day shoes usually wear out faster than daily trainers, so most runners save them for key workouts and races.');
  if (shoe.weightGrams >= 300) out.push(`Heavier than most trainers at about ${shoe.weightGrams} g.`);
  if (shoe.dropMM <= 4)
    out.push(`Low ${shoe.dropMM} mm drop can feel different if you are used to a higher drop; build up mileage gradually.`);
  if (!shoe.widthOptions && !out.some((o) => o.startsWith('Wide sizes')))
    out.push('Only a standard width is listed in our data.');

  return out.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Similarity to a shoe the runner already knows
// ---------------------------------------------------------------------------

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * 0–1 "rides like the shoe you already run in" score, from spec closeness
 * (cushioning 40%, drop 30%, weight 30%) plus small category/brand affinity.
 * A direct newer version of the same shoe scores highest.
 */
export function similarityToCurrent(candidate: Shoe, current: Shoe): number {
  if (candidate.id === current.id) return getNewerVersion(current) ? 0.55 : 0.9;
  const newer = getNewerVersion(current);
  if (newer && candidate.id === newer.id) return 1;

  const cushion = 1 - clamp01(Math.abs(candidate.cushioning - current.cushioning) / 5);
  const drop = 1 - clamp01(Math.abs(candidate.dropMM - current.dropMM) / 8);
  const weight = 1 - clamp01(Math.abs(candidate.weightGrams - current.weightGrams) / 100);
  let s = cushion * 0.4 + drop * 0.3 + weight * 0.3;
  if (candidate.category === current.category) s = s * 0.85 + 0.15;
  else s *= 0.85;
  if (candidate.brand.toLowerCase() === current.brand.toLowerCase()) s = Math.min(1, s + 0.05);
  return clamp01(s);
}

export const CURRENT_SHOE_ISSUES: { value: string; label: string }[] = [
  { value: 'too-firm', label: 'Feels too firm or harsh' },
  { value: 'too-soft', label: 'Feels too soft or unstable' },
  { value: 'too-heavy', label: 'Feels heavy or clunky' },
  { value: 'too-narrow', label: 'Too narrow or tight' },
  { value: 'none', label: 'Nothing, I just want the same feel' },
];

/** 0–1 fit of a candidate against what the runner disliked about their current shoe. */
export function issueFit(candidate: Shoe, current: Shoe, issues: string[]): number {
  const active = issues.filter((i) => i !== 'none');
  if (active.length === 0) return 0.7;
  let total = 0;
  for (const issue of active) {
    switch (issue) {
      case 'too-firm':
        total += candidate.cushioning > current.cushioning ? 1 : candidate.cushioning === current.cushioning ? 0.35 : 0.1;
        break;
      case 'too-soft':
        total += candidate.cushioning < current.cushioning || candidate.category === 'stability' ? 1 : 0.3;
        break;
      case 'too-heavy':
        total += candidate.weightGrams < current.weightGrams - 10 ? 1 : candidate.weightGrams <= current.weightGrams ? 0.5 : 0.1;
        break;
      case 'too-narrow':
        total += candidate.widthOptions ? 1 : 0.2;
        break;
      default:
        total += 0.5;
    }
  }
  return total / active.length;
}
