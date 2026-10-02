/**
 * Canonical pre-rendered result URLs.
 *
 * Each entry is a slug in the form `{pronation}-{distance}-{terrain}-{footType}`
 * matching `generateSlug()` / `answersFromSlug()` in src/lib/quiz-data.ts.
 *
 * Goal: cover the highest-search-volume runner archetypes without bloating the
 * build. ~45 pages is the sweet spot for canonical SEO surface area — every
 * one carries unique title, headline, description and shoe picks (enforced by
 * tests), so none of them is a doorway page.
 *
 * Long-tail combinations not listed here still work for users (the SPA renders
 * them from the slug) but are `noindex` so they never compete with these pages.
 *
 * Lives in src/ (not scripts/) so the client can tell which slugs are indexable.
 */

export const CANONICAL_SLUGS: readonly string[] = [
  // === Distance × Terrain (broad searcher intent) ===
  'neutral-5k-road-neutral',
  'neutral-10k-road-neutral',
  'neutral-half-marathon-road-neutral',
  'neutral-marathon-road-neutral',
  'neutral-5k-trail-neutral',
  'neutral-10k-trail-neutral',
  'neutral-half-marathon-trail-neutral',
  'neutral-marathon-trail-neutral',

  // === Pronation × Distance (biomechanics-driven searches) ===
  'overpronation-5k-road-neutral',
  'overpronation-10k-road-neutral',
  'overpronation-half-marathon-road-neutral',
  'overpronation-marathon-road-neutral',
  'overpronation-ultra-trail-neutral',

  'underpronation-5k-road-neutral',
  'underpronation-10k-road-neutral',
  'underpronation-half-marathon-road-neutral',
  'underpronation-marathon-road-neutral',
  'underpronation-10k-trail-neutral',

  'neutral-ultra-trail-neutral',
  'neutral-mixed-mixed-neutral',

  // === Foot type × Terrain (shoe-fit searches) ===
  'neutral-10k-road-flat',
  'neutral-half-marathon-road-flat',
  'neutral-marathon-road-flat',
  'neutral-10k-road-high-arch',
  'neutral-half-marathon-road-high-arch',
  'neutral-marathon-road-high-arch',
  'neutral-10k-road-wide',
  'neutral-half-marathon-road-wide',
  'neutral-marathon-road-wide',
  'neutral-10k-trail-wide',

  // === High-value triples (real-world archetypes) ===
  'overpronation-marathon-road-flat',
  'overpronation-half-marathon-road-flat',
  'overpronation-10k-road-flat',
  'underpronation-marathon-road-high-arch',
  'underpronation-half-marathon-road-high-arch',
  'underpronation-10k-road-high-arch',
  'neutral-10k-trail-high-arch',
  'neutral-marathon-trail-high-arch',
  'neutral-ultra-trail-high-arch',
  'overpronation-marathon-road-wide',

  // === Track / speed-focused ===
  'neutral-5k-track-neutral',
  'neutral-10k-track-neutral',
  'neutral-5k-track-high-arch',

  // === Treadmill / mixed ===
  'neutral-mixed-mixed-flat',
  'overpronation-mixed-mixed-neutral',
];

const CANONICAL_SET = new Set(CANONICAL_SLUGS);

/** True when `slug` has a pre-rendered, indexable result page. */
export const isCanonicalSlug = (slug: string | undefined | null): boolean =>
  !!slug && CANONICAL_SET.has(slug.toLowerCase());
