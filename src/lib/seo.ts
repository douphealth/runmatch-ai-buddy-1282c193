import { ShoeRecommendation } from './recommendation-engine';
import { QuizAnswers } from './quiz-data';
import { Shoe } from './shoe-database';
import { resolveShoeImage } from './shoe-images';
import { APP_BASE_PATH, BRAND_LOGO_URL, SITE_ORIGIN } from './site-config';

export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

export function generateProductSchema(rec: ShoeRecommendation, answers: QuizAnswers, recommendedShoe?: Shoe) {
  if (!recommendedShoe) {
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${rec.shoeProfile.category} running shoe recommendation`,
      description: rec.shoeProfile.summary,
    };
  }

  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${recommendedShoe.brand} ${recommendedShoe.model}`,
    description: rec.shoeProfile.summary,
    category: 'Running Shoes',
    brand: { '@type': 'Brand', name: recommendedShoe.brand },
  };

  const img = resolveShoeImage(recommendedShoe);
  if (img.url && !img.url.includes('placeholder')) {
    const path = img.url.startsWith(APP_BASE_PATH) ? img.url : `${APP_BASE_PATH}${img.url.startsWith('/') ? '' : '/'}${img.url}`;
    base.image = `${SITE_ORIGIN}${path}`;
  }

  // ASIN is a merchant SKU, not GTIN. Do not emit Offer/availability/price unless verified and visible.
  const validAsin =
    typeof recommendedShoe.amazonASIN === 'string' &&
    /^[A-Z0-9]{10}$/.test(recommendedShoe.amazonASIN) &&
    recommendedShoe.amazonASIN !== 'SEARCH';
  if (validAsin) {
    base.sku = recommendedShoe.amazonASIN;
  }

  return base;
}

/**
 * Update <head> with Open Graph + Twitter Card image metadata for the recommended shoe.
 * Returns a cleanup function that removes the tags it created.
 */
export function applyOpenGraphImage(shoe: Shoe, title: string, description: string): () => void {
  const img = resolveShoeImage(shoe);
  const imageUrl = img.url || BRAND_LOGO_URL;
  const url = typeof window !== 'undefined' ? window.location.href : '';

  const metas: Array<[string, string, string]> = [
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:image', imageUrl],
    ['property', 'og:image:alt', `${shoe.brand} ${shoe.model} running shoe`],
    ['property', 'og:url', url],
    ['property', 'og:type', 'product'],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
    ['name', 'twitter:image', imageUrl],
    ['name', 'twitter:image:alt', `${shoe.brand} ${shoe.model} running shoe`],
  ];

  const created: HTMLMetaElement[] = [];
  for (const [attr, key, value] of metas) {
    let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
      created.push(el);
    }
    el.setAttribute('content', value);
  }

  return () => created.forEach(el => el.remove());
}


export function generateWebAppSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'RunMatch AI Running Shoe Finder',
    url: `${SITE_ORIGIN}${APP_BASE_PATH}/`,
    applicationCategory: 'SportsApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: 'Free running shoe matching quiz. Get a personalised shoe shortlist, rotation plan and the reasons behind each pick in about two minutes.',
    publisher: { '@type': 'Organization', name: 'GearUpToFit', url: SITE_ORIGIN },
  };
}

// ---------------------------------------------------------------------------
// Unique per-result titles, headlines and descriptions
// ---------------------------------------------------------------------------
//
// Each canonical result page must have its own <title>, H1 and description,
// otherwise ~45 near-identical pages compete with each other. All four quiz
// dimensions that define the slug (gait, distance, terrain, foot shape) appear
// in the copy, so uniqueness follows from slug uniqueness (asserted in tests).

const DISTANCE_LABEL: Record<string, string> = {
  '5k': '5K',
  '10k': '10K',
  'half-marathon': 'Half Marathon',
  marathon: 'Marathon',
  ultra: 'Ultra',
  mixed: 'Any Distance',
};
const TERRAIN_LABEL: Record<string, string> = {
  road: 'Road',
  trail: 'Trail',
  track: 'Track',
  mixed: 'Mixed-Surface',
};
const GAIT_LABEL: Record<string, string> = {
  neutral: 'Neutral',
  overpronation: 'Overpronation',
  underpronation: 'Underpronation',
  unsure: 'Any Gait',
};
const FOOT_LABEL: Record<string, string> = {
  neutral: '',
  flat: 'Flat Feet',
  'high-arch': 'High Arch',
  wide: 'Wide Feet',
};

export function describeRunnerProfile(answers: QuizAnswers): { distance: string; terrain: string; who: string } {
  const gait = GAIT_LABEL[answers.pronation] ?? 'Any Gait';
  const foot = FOOT_LABEL[answers.footType] ?? '';
  return {
    distance: DISTANCE_LABEL[answers.distance] ?? answers.distance,
    terrain: TERRAIN_LABEL[answers.terrain] ?? answers.terrain,
    who: foot ? `${gait} + ${foot}` : gait,
  };
}

/** e.g. "Best Road Running Shoes for 10K: Overpronation + Flat Feet" */
export function generateMetaTitle(answers: QuizAnswers): string {
  const { distance, terrain, who } = describeRunnerProfile(answers);
  return `Best ${terrain} Running Shoes for ${distance}: ${who}`;
}

export function generateResultH1(answers: QuizAnswers): string {
  const { distance, terrain, who } = describeRunnerProfile(answers);
  return `Best ${terrain} Running Shoes for ${distance} (${who})`;
}

const trim = (s: string, max: number) => {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
};

/**
 * Result-page description: leads with the profile (so it is unique per slug)
 * and names the actual top picks. e.g.
 * "Road shoes for the Half Marathon (Overpronation + Flat Feet): Brooks …, … See why each fits, what to watch for and a rotation."
 */
export function generateResultDescription(answers: QuizAnswers, topNames: string[]): string {
  const { distance, terrain, who } = describeRunnerProfile(answers);
  const picks = topNames.slice(0, 3).join(', ');
  return trim(
    `${terrain} shoes for ${distance} (${who}): ${picks}. See why each fits, what to watch out for and a 2–3 shoe rotation.`,
    158,
  );
}

/**
 * Description that names the actual top picks, so it is unique per page and
 * tells the searcher what they will get. `topNames` is optional for callers
 * that only have the recommendation summary.
 */
export function generateMetaDescription(rec: ShoeRecommendation, topNames: string[] = []): string {
  const picks = topNames.slice(0, 3);
  const lead = picks.length > 0 ? `Top matches: ${picks.join(', ')}. ` : '';
  return trim(`${lead}${rec.shoeProfile.summary} Includes why each shoe fits, what to watch out for, and a 2–3 shoe rotation.`, 158);
}
