import { ShoeRecommendation } from './recommendation-engine';
import { QuizAnswers } from './quiz-data';
import { Shoe } from './shoe-database';
import { resolveShoeImage } from './shoe-images';

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
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: recommendedShoe ? `${recommendedShoe.brand} ${recommendedShoe.model}` : `${rec.shoeProfile.category} Running Shoe Recommendation`,
    description: rec.shoeProfile.summary,
    category: 'Running Shoes',
    brand: recommendedShoe
      ? { '@type': 'Brand', name: recommendedShoe.brand }
      : (answers.brand.length > 0 ? { '@type': 'Brand', name: answers.brand.join(', ') } : undefined),
  };

  if (recommendedShoe) {
    const img = resolveShoeImage(recommendedShoe);
    if (img.url) base.image = img.url;
    base.offers = {
      '@type': 'Offer',
      price: String(recommendedShoe.priceUSD),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `https://www.amazon.com/s?k=${encodeURIComponent(`${recommendedShoe.brand} ${recommendedShoe.model} running shoes`)}&tag=papalex-20`,
    };
    if (recommendedShoe.amazonASIN) {
      base.sku = recommendedShoe.amazonASIN;
      base.gtin = recommendedShoe.amazonASIN;
    }
  }

  return base;
}

/**
 * Update <head> with Open Graph + Twitter Card image metadata for the recommended shoe.
 * Returns a cleanup function that removes the tags it created.
 */
export function applyOpenGraphImage(shoe: Shoe, title: string, description: string): () => void {
  const img = resolveShoeImage(shoe);
  const imageUrl = img.url || 'https://gearuptofit.com/wp-content/uploads/2023/03/cropped-Grey-Black-Illustration-Gym-Fitness-Logo.png';
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
    name: 'RunMatch AI — Running Shoe Recommendation Quiz',
    url: 'https://runmatch-ai-buddy.lovable.app/',
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: 'Free AI-powered running shoe recommendation quiz. Get personalized shoe profiles, rotation strategies, and training tips in 2 minutes.',
    creator: { '@type': 'Organization', name: 'GearUpToFit', url: 'https://gearuptofit.com' },
  };
}

export function generateMetaTitle(answers: QuizAnswers): string {
  const distance = answers.distance ? answers.distance.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
  const terrain = answers.terrain ? answers.terrain.charAt(0).toUpperCase() + answers.terrain.slice(1) : '';
  return `Best ${terrain} Running Shoe for ${distance} — RunMatch AI`;
}

export function generateMetaDescription(rec: ShoeRecommendation): string {
  return `${rec.shoeProfile.summary} Personalized rotation, training tips, and expert buying guidance.`;
}
