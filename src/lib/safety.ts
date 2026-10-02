import type { QuizAnswers } from './quiz-data';

/**
 * Safe handling of injury / pain answers.
 *
 * Hard rule: when a runner reports an injury or pain, the tool stops presenting
 * a confident "perfect match" and instead (1) says plainly that shoes cannot
 * treat an injury, (2) points to a professional, and (3) shows a conservative,
 * comfort-first shortlist (the scoring engine already down-ranks race-day
 * plated shoes in that case).
 */

export const INJURY_LABELS: Record<string, string> = {
  'plantar-fasciitis': 'plantar fasciitis',
  'shin-splints': 'shin splints',
  'it-band': 'IT band pain',
  'knee-pain': 'knee pain',
  achilles: 'Achilles tendinitis',
};

export const hasReportedInjury = (answers: Pick<QuizAnswers, 'injuries'>): boolean =>
  answers.injuries.some((i) => i !== 'none');

export interface SafetyNotice {
  title: string;
  summary: string;
  bullets: string[];
  /** Human-readable names of what the runner reported. */
  reported: string[];
  /** Headline label for the top result when a notice is active. */
  topPickLabel: string;
}

/** Red-flag symptoms that warrant prompt medical attention (standard, conservative guidance). */
export const RED_FLAGS =
  'Get prompt medical advice for severe swelling, pain that stops you putting weight on the foot, numbness or tingling, or pain at night or at rest.';

export function getSafetyNotice(answers: Pick<QuizAnswers, 'injuries'>): SafetyNotice | null {
  if (!hasReportedInjury(answers)) return null;
  const reported = answers.injuries.filter((i) => i !== 'none').map((i) => INJURY_LABELS[i] ?? i.replace(/-/g, ' '));
  return {
    title: 'You mentioned pain or an injury. Read this first',
    summary:
      'Shoes can change how running feels, but they cannot diagnose or treat an injury. Treat the list below as a cautious, comfort-first shortlist rather than a confident recommendation.',
    bullets: [
      'If the pain is current, getting worse, or has lasted more than a couple of weeks, see a physiotherapist, sports-medicine doctor or podiatrist before you choose shoes or add mileage.',
      'We have leaned toward well-cushioned everyday shoes and away from race-day plated shoes, which are built for speed rather than protection.',
      'Try shoes on in a store that lets you run in them, and stop using any pair that makes the pain worse.',
      RED_FLAGS,
    ],
    reported,
    topPickLabel: 'Comfort-first pick',
  };
}
