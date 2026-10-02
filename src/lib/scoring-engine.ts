import { QuizAnswers } from './quiz-data';
import { Shoe, shoeDatabase, getShoeQualityState } from './shoe-database';
import { getNewerVersion, getWatchOuts, issueFit, similarityToCurrent } from './shoe-insights';

export type FactorKey =
  | 'terrain'
  | 'distance'
  | 'pronation'
  | 'footType'
  | 'injury'
  | 'budget'
  | 'brand'
  | 'pace'
  | 'mileage'
  | 'familiarity';

/** One line of the transparent "why this scored N%" breakdown. */
export interface FactorScore {
  key: FactorKey;
  label: string;
  /** Normalised share of the final score this factor controls (sums to 1). */
  weight: number;
  /** 0–1 fit of this shoe on this factor. */
  value: number;
}

export interface ScoredShoe {
  shoe: Shoe;
  score: number;
  matchPercent: number;
  reasons: string[];
  /** Per-factor contribution, highest impact first. */
  factors: FactorScore[];
  /** Plain-language reasons this shoe may not suit the runner. */
  watchOuts: string[];
  /** Newest version of the same shoe in our database, when this one is outdated. */
  newerVersion?: Shoe;
}

const BASE_WEIGHTS = {
  terrain: 0.18,
  distance: 0.15,
  pronation: 0.15,
  footType: 0.12,
  injury: 0.10,
  budget: 0.08,
  brand: 0.05,
  pace: 0.10,
  mileage: 0.07,
} as const;

/** Published on the methodology page; exported so the page can never disagree with the engine. */
export const SCORING_WEIGHTS = BASE_WEIGHTS;

/** Share of the score given to "rides like my current shoe" when that answer exists. */
const FAMILIARITY_WEIGHT = 0.12;
export const SCORING_FAMILIARITY_WEIGHT = FAMILIARITY_WEIGHT;

export const FACTOR_LABELS: Record<FactorKey, string> = {
  terrain: 'Terrain',
  distance: 'Race distance',
  pronation: 'Gait / support',
  footType: 'Foot shape & fit',
  injury: 'Comfort needs',
  budget: 'Budget',
  brand: 'Brand preference',
  pace: 'Pace & intensity',
  mileage: 'Weekly mileage',
  familiarity: 'Feel of your current shoe',
};

/** Previous-generation models lose a little ground to their own successor. */
export const PREVIOUS_GENERATION_PENALTY = 0.03;
/** When injuries are reported we steer toward conservative, protective shoes. */
export const INJURY_RACE_PENALTY = 0.15;
export const INJURY_SPEED_PENALTY = 0.05;

const hasReportedInjury = (answers: QuizAnswers) => answers.injuries.some((i) => i !== 'none');

function terrainMatch(userTerrain: string, shoe: Shoe): number {
  const shoeTerrain = shoe.terrain;
  if (userTerrain === 'mixed') return shoeTerrain.length > 1 ? 1 : 0.7;
  if (shoeTerrain.includes(userTerrain as Shoe['terrain'][number])) return 1;
  if (userTerrain === 'track') {
    // No spikes in the database: road racers and speed trainers are what people
    // actually wear for track sessions; heavier trainers are a poor fit.
    if (shoeTerrain.includes('road')) return shoe.category === 'speed' || shoe.category === 'race' ? 0.85 : 0.5;
    return 0.05;
  }
  // Hybrid shoes get partial credit
  if (userTerrain === 'trail' && shoeTerrain.includes('road')) return 0.1;
  if (userTerrain === 'road' && shoeTerrain.includes('trail')) return 0.15;
  return 0;
}

function distanceMatch(userDistance: string, shoeDistances: string[]): number {
  if (userDistance === 'mixed') return shoeDistances.length >= 3 ? 1 : 0.5;
  return shoeDistances.includes(userDistance) ? 1 : 0;
}

function pronationMatch(userPronation: string, shoePronation: string[]): number {
  if (userPronation === 'unsure') return shoePronation.includes('neutral') ? 0.8 : 0.4;
  return shoePronation.includes(userPronation as Shoe['pronation'][number]) ? 1 : 0;
}

function footTypeMatch(userFootType: string, shoe: Shoe): number {
  if (userFootType === 'wide') return shoe.widthOptions ? 1 : 0.2;
  if (userFootType === 'flat') return shoe.category === 'stability' ? 1 : shoe.pronation.includes('overpronation') ? 0.7 : 0.3;
  if (userFootType === 'high-arch') return shoe.cushioning >= 7 ? 1 : 0.4;
  return 1; // neutral
}

function injuryMatch(userInjuries: string[], shoeInjuryFriendly: string[]): number {
  if (userInjuries.includes('none') || userInjuries.length === 0) return 0.7;
  const matches = userInjuries.filter((i) => shoeInjuryFriendly.includes(i)).length;
  return matches / userInjuries.length;
}

function budgetMatch(userBudgets: string[], price: number): number {
  if (userBudgets.length === 0) return 0.5;
  // Check if price fits any selected budget range
  for (const b of userBudgets) {
    switch (b) {
      case 'under-100': if (price <= 100) return 1; break;
      case '100-150': if (price >= 100 && price <= 150) return 1; break;
      case '150-200': if (price >= 150 && price <= 200) return 1; break;
      case '200-plus': if (price >= 200) return 1; break;
    }
  }
  // Partial match if close
  for (const b of userBudgets) {
    switch (b) {
      case 'under-100': if (price <= 120) return 0.5; break;
      case '100-150': if (price <= 170) return 0.5; break;
      case '150-200': if (price >= 130) return 0.5; break;
      case '200-plus': if (price >= 180) return 0.5; break;
    }
  }
  return 0.1;
}

function brandMatch(userBrands: string[], shoeBrand: string): number {
  if (userBrands.length === 0) return 0.7; // no preference — don't penalize
  return userBrands.some((b) => shoeBrand.toLowerCase() === b.toLowerCase()) ? 1 : 0.3;
}

function paceMatch(userPace: string, shoe: Shoe): number {
  switch (userPace) {
    case 'easy': return shoe.category === 'daily' || shoe.category === 'max-cushion' ? 1 : shoe.category === 'trail' ? 0.7 : 0.3;
    case 'moderate': return shoe.category === 'daily' || shoe.category === 'hybrid' ? 1 : shoe.category === 'speed' ? 0.6 : 0.5;
    case 'tempo': return shoe.category === 'speed' ? 1 : shoe.category === 'race' ? 0.8 : shoe.category === 'hybrid' ? 0.5 : 0.3;
    case 'race': return shoe.category === 'race' ? 1 : shoe.category === 'speed' ? 0.7 : 0.2;
    default: return 0.5;
  }
}

function mileageMatch(weeklyMileage: number, shoe: Shoe): number {
  if (weeklyMileage > 60) return shoe.cushioning >= 8 ? 1 : shoe.cushioning >= 6 ? 0.5 : 0.2;
  if (weeklyMileage > 40) return shoe.cushioning >= 6 ? 1 : 0.5;
  if (weeklyMileage < 20) return shoe.bestFor.includes('beginner') ? 1 : 0.6;
  return 0.7;
}

const SHOE_BY_ID = new Map(shoeDatabase.map((s) => [s.id, s]));

function scoreOne(shoe: Shoe, answers: QuizAnswers, current: Shoe | undefined): ScoredShoe {
  const values: Partial<Record<FactorKey, number>> = {
    terrain: terrainMatch(answers.terrain, shoe),
    distance: distanceMatch(answers.distance, shoe.bestDistances),
    pronation: pronationMatch(answers.pronation, shoe.pronation),
    footType: footTypeMatch(answers.footType, shoe),
    injury: injuryMatch(answers.injuries, shoe.injuryFriendly),
    budget: budgetMatch(answers.budget, shoe.priceUSD),
    brand: brandMatch(answers.brand, shoe.brand),
    pace: paceMatch(answers.paceGoal, shoe),
    mileage: mileageMatch(answers.weeklyMileage, shoe),
  };

  // Base score: identical arithmetic to the original nine-factor model.
  let weighted = 0;
  for (const key of Object.keys(BASE_WEIGHTS) as (keyof typeof BASE_WEIGHTS)[]) {
    weighted += (values[key] as number) * BASE_WEIGHTS[key];
  }

  // Optional factor: only when the runner told us about a shoe they know.
  let familiarity: number | undefined;
  if (current) {
    const similar = similarityToCurrent(shoe, current);
    const fixes = issueFit(shoe, current, answers.currentShoeIssues ?? []);
    familiarity = similar * 0.65 + fixes * 0.35;
    values.familiarity = familiarity;
    weighted = (weighted + familiarity * FAMILIARITY_WEIGHT) / (1 + FAMILIARITY_WEIGHT);
  }

  const newerVersion = getNewerVersion(shoe);
  let score = weighted;
  if (newerVersion) score -= PREVIOUS_GENERATION_PENALTY;
  if (hasReportedInjury(answers)) {
    if (shoe.category === 'race') score -= INJURY_RACE_PENALTY;
    else if (shoe.category === 'speed') score -= INJURY_SPEED_PENALTY;
  }
  score = Math.max(0, Math.min(1, score));

  // ----- Reasons (why it matched) -----
  const reasons: string[] = [];
  if (values.terrain === 1) reasons.push(`Perfect for ${answers.terrain} running`);
  if (values.distance === 1) reasons.push(`Optimized for ${answers.distance.replace('-', ' ')} distance`);
  if (values.pronation === 1) reasons.push(`Matches your ${answers.pronation} pronation`);
  if (values.injury === 1) reasons.push('Comfort/support features match your selected needs');
  if (values.footType === 1 && answers.footType === 'wide') reasons.push('Wide fit available');
  if (values.brand === 1) reasons.push(`Matches your ${shoe.brand} preference`);
  if (values.pace === 1) reasons.push(`Built for ${answers.paceGoal} pace`);
  if (values.mileage === 1) reasons.push(`${shoe.cushioning}/10 cushioning suits about ${answers.weeklyMileage} km a week`);
  if (answers.footType === 'high-arch' && values.footType === 1) reasons.push(`Plush ${shoe.cushioning}/10 cushioning for high arches`);
  if (values.budget === 1 && answers.budget.length > 0) reasons.push(`About $${shoe.priceUSD}, inside your budget`);
  if (current) {
    if (newerVersion === undefined && getNewerVersion(current)?.id === shoe.id) {
      reasons.push(`Newer version of your ${current.brand} ${current.model}`);
    } else if (shoe.id === current.id) {
      reasons.push('The shoe you already run in');
    } else if ((familiarity ?? 0) >= 0.75) {
      reasons.push(`Rides a lot like your ${current.brand} ${current.model}`);
    }
    for (const issue of answers.currentShoeIssues ?? []) {
      if (issue === 'too-firm' && shoe.cushioning > current.cushioning) reasons.push(`Softer than your ${current.model} (${shoe.cushioning}/10 vs ${current.cushioning}/10)`);
      if (issue === 'too-soft' && shoe.cushioning < current.cushioning) reasons.push(`Firmer and more stable than your ${current.model}`);
      if (issue === 'too-heavy' && shoe.weightGrams < current.weightGrams - 10) reasons.push(`Lighter than your ${current.model} (${shoe.weightGrams} g vs ${current.weightGrams} g)`);
      if (issue === 'too-narrow' && shoe.widthOptions) reasons.push('Offered in wider widths');
    }
  }

  // ----- Transparent breakdown, highest contribution first -----
  const totalWeight = (Object.keys(BASE_WEIGHTS) as (keyof typeof BASE_WEIGHTS)[])
    .reduce((s, k) => s + BASE_WEIGHTS[k], 0) + (current ? FAMILIARITY_WEIGHT : 0);
  const factors: FactorScore[] = (Object.keys(values) as FactorKey[]).map((key) => ({
    key,
    label: FACTOR_LABELS[key],
    weight: (key === 'familiarity' ? FAMILIARITY_WEIGHT : BASE_WEIGHTS[key as keyof typeof BASE_WEIGHTS]) / totalWeight,
    value: values[key] as number,
  })).sort((a, b) => b.weight * b.value - a.weight * a.value);

  return {
    shoe,
    score,
    matchPercent: Math.round(score * 100),
    reasons,
    factors,
    watchOuts: getWatchOuts(shoe, answers),
    newerVersion,
  };
}

export function scoreShoes(answers: QuizAnswers): ScoredShoe[] {
  const current = answers.currentShoe ? SHOE_BY_ID.get(answers.currentShoe) : undefined;

  return shoeDatabase
    .filter((shoe) => getShoeQualityState(shoe).isRecommendationReady)
    .map((shoe) => scoreOne(shoe, answers, current))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Stable tiebreaker: prefer newer year, then lighter weight
      if (b.shoe.year !== a.shoe.year) return b.shoe.year - a.shoe.year;
      return a.shoe.weightGrams - b.shoe.weightGrams;
    });
}

export interface ShoeRotation {
  primary: ScoredShoe;
  speed: ScoredShoe | null;
  longRun: ScoredShoe | null;
}

export function buildRotation(answers: QuizAnswers): ShoeRotation {
  const scored = scoreShoes(answers);
  const primary = scored[0];
  const injured = hasReportedInjury(answers);

  let speed: ScoredShoe | null = null;
  if (answers.weeklyMileage > 30 || answers.paceGoal === 'tempo' || answers.paceGoal === 'race') {
    speed = scored.find((s) =>
      s.shoe.id !== primary.shoe.id &&
      (s.shoe.category === 'speed' || (s.shoe.category === 'race' && !injured))
    ) || null;
  }

  let longRun: ScoredShoe | null = null;
  if (answers.weeklyMileage > 40 || ['half-marathon', 'marathon', 'ultra'].includes(answers.distance)) {
    longRun = scored.find((s) =>
      s.shoe.id !== primary.shoe.id &&
      s.shoe.id !== speed?.shoe.id &&
      !(injured && s.shoe.category === 'race') &&
      (s.shoe.category === 'max-cushion' || s.shoe.cushioning >= 8)
    ) || null;
  }

  // Note: trail terrain already heavily weighted in scoring (terrain=0.18,
  // hybrid road shoes get only 0.15 partial credit). No override needed —
  // forcing the first trail shoe collapsed all trail results to Speedcross 6.

  return { primary, speed, longRun };
}
