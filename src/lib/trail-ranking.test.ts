import { describe, expect, it } from 'vitest';
import { scoreShoes } from './scoring-engine';
import { defaultAnswers, type QuizAnswers } from './quiz-data';

/**
 * Regression: a trail runner at a moderate pace was shown a road-to-trail hybrid (Adidas EVO SL ATR) as the #1 match,
 * ahead of dedicated trail shoes, because the pace factor only knew "daily/speed" and gave every trail shoe 0.5.
 */
describe('trail runners are matched to trail shoes', () => {
  for (const paceGoal of ['easy', 'moderate', 'tempo', 'race'] as const) {
    for (const injuries of [['none'], ['it-band'], ['plantar-fasciitis']]) {
      it(`${paceGoal} pace, injuries: ${injuries.join(',')}`, () => {
        const answers = { ...defaultAnswers, terrain: 'trail', pronation: 'neutral', distance: 'half-marathon', footType: 'neutral', paceGoal, weeklyMileage: 30, injuries } as QuizAnswers;
        const top = scoreShoes(answers).slice(0, 5);
        expect(top[0].shoe.category, top.map((s) => s.shoe.id).join(', ')).toBe('trail');
        expect(top.filter((s) => s.shoe.category === 'trail').length).toBeGreaterThanOrEqual(4);
      });
    }
  }

  it('does not change road results: a road runner still gets road shoes, hybrids included', () => {
    const answers = { ...defaultAnswers, terrain: 'road', pronation: 'neutral', distance: '10k', footType: 'neutral', paceGoal: 'moderate', weeklyMileage: 30, injuries: ['none'] } as QuizAnswers;
    const top = scoreShoes(answers).slice(0, 5);
    for (const s of top) expect(s.shoe.terrain).toContain('road');
  });
});
