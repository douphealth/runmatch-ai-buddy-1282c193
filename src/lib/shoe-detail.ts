/**
 * Helpers powering the per-shoe detail page (/shoes/:id).
 *
 * Pure read-only utilities over the verified shoe database. No persistence.
 */
import { shoeDatabase, Shoe } from './shoe-database';
import { COMPARISONS, buildComparisonSlug } from './comparisons';

export function getShoeById(id: string): Shoe | undefined {
  return shoeDatabase.find(s => s.id === id);
}

export function getAllShoeIds(): string[] {
  return shoeDatabase.map(s => s.id);
}

/**
 * "Alternatives" = same primary category, same terrain set, excluding self.
 * Sorted by closeness on weight + cushioning + price so the top picks feel
 * like the most natural substitutes.
 */
export function getAlternatives(shoe: Shoe, limit = 4): Shoe[] {
  const score = (s: Shoe) =>
    Math.abs(s.weightGrams - shoe.weightGrams) +
    Math.abs(s.cushioning - shoe.cushioning) * 20 +
    Math.abs(s.priceUSD - shoe.priceUSD) * 0.4;

  return shoeDatabase
    .filter(s =>
      s.id !== shoe.id &&
      s.category === shoe.category &&
      s.terrain.some(t => shoe.terrain.includes(t))
    )
    .sort((a, b) => score(a) - score(b))
    .slice(0, limit);
}

/** Other shoes from the same brand, excluding self. */
export function getSameBrand(shoe: Shoe, limit = 4): Shoe[] {
  return shoeDatabase
    .filter(s => s.id !== shoe.id && s.brand === shoe.brand)
    .sort((a, b) => b.year - a.year)
    .slice(0, limit);
}

/** Curated comparison pages that include this shoe. */
export function getRelatedComparisons(shoeId: string): { slug: string; otherId: string; angle?: string }[] {
  return COMPARISONS
    .filter(c => c.a === shoeId || c.b === shoeId)
    .map(c => ({
      slug: buildComparisonSlug(c.a, c.b),
      otherId: c.a === shoeId ? c.b : c.a,
      angle: c.angle,
    }));
}

/** Human-readable use-case sentence used in meta description and hero copy. */
export function describeUseCase(shoe: Shoe): string {
  const categoryLabel: Record<Shoe['category'], string> = {
    daily: 'daily trainer',
    speed: 'speed / tempo shoe',
    race: 'race-day super shoe',
    trail: 'trail shoe',
    'max-cushion': 'max-cushion long-run shoe',
    stability: 'stability shoe',
    hybrid: 'all-rounder',
  };
  const terrains = shoe.terrain.join(', ');
  const distances = shoe.bestDistances.slice(0, 2).join(' and ');
  return `${categoryLabel[shoe.category]} for ${terrains} running, best at ${distances}`;
}
