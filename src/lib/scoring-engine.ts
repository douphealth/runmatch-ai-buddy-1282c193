import { QuizAnswers } from './quiz-data';
import { Shoe, shoeDatabase, getShoeQualityState } from './shoe-database';

export interface ScoredShoe {
  shoe: Shoe;
  score: number;
  matchPercent: number;
  reasons: string[];
}

function terrainMatch(userTerrain: string, shoeTerrain: string[]): number {
  if (userTerrain === 'mixed') return shoeTerrain.length > 1 ? 1 : 0.7;
  if (shoeTerrain.includes(userTerrain as any)) return 1;
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
  return shoePronation.includes(userPronation as any) ? 1 : 0;
}

function footTypeMatch(userFootType: string, shoe: Shoe): number {
  if (userFootType === 'wide') return shoe.widthOptions ? 1 : 0.2;
  if (userFootType === 'flat') return shoe.category === 'stability' ? 1 : shoe.pronation.includes('overpronation') ? 0.7 : 0.3;
  if (userFootType === 'high-arch') return shoe.cushioning >= 7 ? 1 : 0.4;
  return 1; // neutral
}

function injuryMatch(userInjuries: string[], shoeInjuryFriendly: string[]): number {
  if (userInjuries.includes('none') || userInjuries.length === 0) return 0.7;
  const matches = userInjuries.filter(i => shoeInjuryFriendly.includes(i)).length;
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
  return userBrands.some(b => shoeBrand.toLowerCase() === b.toLowerCase()) ? 1 : 0.3;
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

export function scoreShoes(answers: QuizAnswers): ScoredShoe[] {
  const weights = {
    terrain: 0.18,
    distance: 0.15,
    pronation: 0.15,
    footType: 0.12,
    injury: 0.10,
    budget: 0.08,
    brand: 0.05,
    pace: 0.10,
    mileage: 0.07,
  };

  return shoeDatabase.filter(shoe => getShoeQualityState(shoe).isRecommendationReady).map(shoe => {
    const scores = {
      terrain: terrainMatch(answers.terrain, shoe.terrain),
      distance: distanceMatch(answers.distance, shoe.bestDistances),
      pronation: pronationMatch(answers.pronation, shoe.pronation),
      footType: footTypeMatch(answers.footType, shoe),
      injury: injuryMatch(answers.injuries, shoe.injuryFriendly),
      budget: budgetMatch(answers.budget, shoe.priceUSD),
      brand: brandMatch(answers.brand, shoe.brand),
      pace: paceMatch(answers.paceGoal, shoe),
      mileage: mileageMatch(answers.weeklyMileage, shoe),
    };

    const totalScore = Object.entries(scores).reduce(
      (sum, [key, val]) => sum + val * weights[key as keyof typeof weights], 0
    );

    const reasons: string[] = [];
    if (scores.terrain === 1) reasons.push(`Perfect for ${answers.terrain} running`);
    if (scores.distance === 1) reasons.push(`Optimized for ${answers.distance.replace('-', ' ')} distance`);
    if (scores.pronation === 1) reasons.push(`Matches your ${answers.pronation} pronation`);
    if (scores.injury === 1) reasons.push('Comfort/support features match your selected needs');
    if (scores.footType === 1 && answers.footType === 'wide') reasons.push('Wide fit available');
    if (scores.brand === 1) reasons.push(`Matches your ${shoe.brand} preference`);
    if (scores.pace === 1) reasons.push(`Built for ${answers.paceGoal} pace`);

    return {
      shoe,
      score: totalScore,
      matchPercent: Math.round(totalScore * 100),
      reasons,
    };
  }).sort((a, b) => {
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

  let speed: ScoredShoe | null = null;
  if (answers.weeklyMileage > 30 || answers.paceGoal === 'tempo' || answers.paceGoal === 'race') {
    speed = scored.find(s =>
      s.shoe.id !== primary.shoe.id &&
      (s.shoe.category === 'speed' || s.shoe.category === 'race')
    ) || null;
  }

  let longRun: ScoredShoe | null = null;
  if (answers.weeklyMileage > 40 || ['half-marathon', 'marathon', 'ultra'].includes(answers.distance)) {
    longRun = scored.find(s =>
      s.shoe.id !== primary.shoe.id &&
      s.shoe.id !== speed?.shoe.id &&
      (s.shoe.category === 'max-cushion' || s.shoe.cushioning >= 8)
    ) || null;
  }

  // Note: trail terrain already heavily weighted in scoring (terrain=0.18,
  // hybrid road shoes get only 0.15 partial credit). No override needed —
  // forcing the first trail shoe collapsed all trail results to Speedcross 6.

  return { primary, speed, longRun };
}
