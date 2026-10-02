/**
 * Groups canonical result pages whose shortlist is substantively identical.
 *
 * Why: several quiz profiles (e.g. neutral gait on road over 10K with a neutral,
 * flat or high-arch foot) produce exactly the same top-5 shoes and the same
 * rotation. Publishing each as its own indexable page creates near-duplicate
 * ("doorway") content that competes with itself. Instead every group has ONE
 * representative that is indexed and listed in the sitemap; its siblings remain
 * fully usable pages but declare the representative as their canonical URL.
 *
 * The grouping is computed from the live scoring engine and database, so it
 * updates itself whenever shoes or weights change. Pure; no browser globals.
 */
import { CANONICAL_SLUGS } from './canonical-slugs';
import { answersFromSlug } from './quiz-data';
import { buildRotation, scoreShoes } from './scoring-engine';

let cache: { repOf: Map<string, string>; reps: string[] } | null = null;

/** Lower = simpler, more general profile = better representative. */
const simplicity = (slug: string): number => {
  const a = answersFromSlug(slug);
  if (!a) return 99;
  return (a.footType !== 'neutral' ? 1 : 0) + (a.pronation !== 'neutral' ? 1 : 0) + (a.terrain === 'mixed' || a.distance === 'mixed' ? 1 : 0);
};

function compute() {
  if (cache) return cache;
  const groups = new Map<string, string[]>();
  for (const slug of CANONICAL_SLUGS) {
    const answers = answersFromSlug(slug);
    if (!answers) continue;
    const top5 = scoreShoes(answers).slice(0, 5).map((s) => s.shoe.id);
    const rot = buildRotation(answers);
    const key = `${top5.join('|')}#${rot.primary.shoe.id}|${rot.speed?.shoe.id ?? '-'}|${rot.longRun?.shoe.id ?? '-'}`;
    groups.set(key, [...(groups.get(key) ?? []), slug]);
  }
  const repOf = new Map<string, string>();
  const reps: string[] = [];
  for (const members of groups.values()) {
    // Simplest profile first; ties keep the order of the canonical list.
    const rep = [...members].sort((a, b) => simplicity(a) - simplicity(b) || CANONICAL_SLUGS.indexOf(a) - CANONICAL_SLUGS.indexOf(b))[0];
    reps.push(rep);
    for (const m of members) repOf.set(m, rep);
  }
  cache = { repOf, reps: reps.sort((a, b) => CANONICAL_SLUGS.indexOf(a) - CANONICAL_SLUGS.indexOf(b)) };
  return cache;
}

/** The slug whose page should be treated as canonical for `slug` (itself when it is a representative or unknown). */
export const getResultRepresentative = (slug: string): string => compute().repOf.get(slug.toLowerCase()) ?? slug;

/** Slugs that are indexed and listed in the sitemap. */
export const getRepresentativeSlugs = (): string[] => compute().reps;

export const isRepresentativeSlug = (slug: string): boolean => getResultRepresentative(slug) === slug && compute().repOf.has(slug.toLowerCase());
