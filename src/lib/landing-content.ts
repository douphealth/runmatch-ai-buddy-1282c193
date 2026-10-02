/**
 * Copy for the landing page that must stay identical in three places:
 * the visible FAQ (SEOContent), the prerendered HTML and the FAQPage JSON-LD.
 * Keep it here, import it everywhere.
 */
import { PRONATION_STATEMENT, REPLACEMENT_STATEMENT, ROTATION_STATEMENT } from './evidence';

export const LANDING_TITLE = 'Free Running Shoe Finder Quiz: Match Shoes to Your Feet | RunMatch AI';

export const LANDING_DESCRIPTION =
  'Free running shoe finder quiz. Get shoes matched to your feet, mileage, terrain and budget in 2 minutes, with the reasons behind every pick. By GearUpToFit.';

export const LANDING_H1 =
  'Running Shoe Finder Quiz: Find the Right Running Shoes for Your Feet, Mileage, Terrain and Budget';

export const LANDING_FAQS: { question: string; answer: string }[] = [
  {
    question: 'Is RunMatch AI free?',
    answer:
      'Yes. The quiz, your ranked shortlist, the reasons for each pick and a rotation plan are free with no signup. Some shoe links are Amazon affiliate links: GearUpToFit may earn a commission at no extra cost to you. Rankings come from the scoring engine, never from commission.',
  },
  {
    question: 'How long does the running shoe quiz take?',
    answer:
      'About two minutes. There are nine short questions (foot shape, gait, weekly mileage, distance, terrain, pace, injury history, brand preference and budget) plus one optional step where you can name a shoe you already know.',
  },
  {
    question: 'How does RunMatch AI choose a shoe?',
    answer:
      'A transparent scoring engine compares each shoe in a structured database with your answers across terrain, distance, gait and support, foot shape, comfort needs, budget, brand, pace and weekly mileage. The same answers always give the same ranking, and every result shows which factors drove the score. The full weights are on the methodology page.',
  },
  {
    question: 'Is RunMatch AI a medical tool?',
    answer:
      'No. It is an educational running shoe finder. It does not diagnose injuries or prescribe treatment. If you have pain, an injury or a medical foot condition, see a qualified clinician first; RunMatch will then show a cautious, comfort-first shortlist rather than a confident pick.',
  },
  {
    question: 'Should beginners use neutral or stability shoes?',
    answer: `Many beginners do well in comfortable neutral daily trainers, and some prefer extra support. ${PRONATION_STATEMENT} Comfort and fit matter most.`,
  },
  {
    question: 'What is a shoe rotation and does it help?',
    answer: `A rotation means alternating between two or three pairs, for example a daily trainer, a faster shoe and a cushioned long-run shoe. ${ROTATION_STATEMENT}`,
  },
  {
    question: 'How should running shoes fit?',
    answer:
      'Most runners need a secure heel, a comfortable midfoot hold and roughly a thumb-width of space in front of the longest toe. Shoes should feel stable and comfortable while walking or jogging.',
  },
  {
    question: 'How often should I replace running shoes?',
    answer: REPLACEMENT_STATEMENT,
  },
];

export const RELATED_GUIDES: { href: string; label: string }[] = [
  { href: 'https://gearuptofit.com/review/best-running-shoes/', label: 'Best running shoes' },
  { href: 'https://gearuptofit.com/review/best-daily-running-shoes/', label: 'Best daily running shoes' },
  { href: 'https://gearuptofit.com/review/best-running-shoes-for-beginners/', label: 'Best beginner running shoes' },
  { href: 'https://gearuptofit.com/running/how-to-choose-the-right-running-shoes/', label: 'How to choose running shoes' },
  { href: 'https://gearuptofit.com/running/best-outdoor-running-shoes/', label: 'Best outdoor & trail running shoes' },
];
