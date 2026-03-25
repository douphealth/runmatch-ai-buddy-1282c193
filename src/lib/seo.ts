import { ShoeRecommendation } from './recommendation-engine';
import { QuizAnswers } from './quiz-data';

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

export function generateProductSchema(rec: ShoeRecommendation, answers: QuizAnswers) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${rec.shoeProfile.category} Running Shoe Recommendation`,
    description: rec.shoeProfile.summary,
    category: 'Running Shoes',
    brand: answers.brand !== 'no-preference' ? { '@type': 'Brand', name: answers.brand } : undefined,
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
