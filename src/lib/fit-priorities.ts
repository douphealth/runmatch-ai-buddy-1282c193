import type { QuizAnswers } from './quiz-data';

export interface FitPriority {
  label: string;
  detail: string;
}

/**
 * What to check when trying shoes on, derived from the runner's answers.
 * Shared by the result page and the prerenderer so both say the same thing.
 */
export function getFitPriorities(answers: QuizAnswers): FitPriority[] {
  const hasInjury = answers.injuries.some((i) => i !== 'none');
  return [
    {
      label: 'Toe room',
      detail: answers.footType === 'wide'
        ? 'Roomy toebox — avoid narrow last shoes'
        : 'About a thumb-width in front of the longest toe',
    },
    {
      label: 'Heel lockdown',
      detail: answers.injuries.includes('achilles')
        ? 'Secure but not aggressive — avoid pinching Achilles'
        : 'Secure heel counter, no slip on push-off',
    },
    {
      label: 'Midfoot hold',
      detail: answers.pronation === 'overpronation' || answers.footType === 'flat'
        ? 'Firm, structured midfoot if you like extra support'
        : 'Snug but flexible midfoot wrap',
    },
    {
      label: 'Width',
      detail: answers.footType === 'wide'
        ? 'Wide (2E) or extra-wide (4E) sizing recommended'
        : 'Standard (D) width — try wide if forefoot feels pinched',
    },
    {
      label: 'Orthotic room',
      detail: hasInjury
        ? 'Removable sockliner — accommodates custom orthotics'
        : 'Not required — stock insole is fine for most runners',
    },
  ];
}
