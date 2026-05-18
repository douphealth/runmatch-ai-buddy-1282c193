import { describe, it, expect } from 'vitest';
import { scoreShoes, buildRotation } from './scoring-engine';
import { defaultAnswers, type QuizAnswers } from './quiz-data';
import { shoeDatabase } from './shoe-database';

const makeAnswers = (overrides: Partial<QuizAnswers> = {}): QuizAnswers => ({
  ...defaultAnswers,
  footType: 'neutral',
  pronation: 'neutral',
  weeklyMileage: 30,
  distance: '10k',
  terrain: 'road',
  paceGoal: 'moderate',
  injuries: [],
  brand: [],
  budget: [],
  ...overrides,
});

describe('scoring-engine: determinism', () => {
  it('produces identical results for identical inputs', () => {
    const a = makeAnswers();
    const r1 = scoreShoes(a).slice(0, 5).map((s) => s.shoe.id);
    const r2 = scoreShoes(a).slice(0, 5).map((s) => s.shoe.id);
    expect(r1).toEqual(r2);
  });

  it('returns one ScoredShoe per shoe in the database', () => {
    const scored = scoreShoes(makeAnswers());
    expect(scored.length).toBe(shoeDatabase.length);
  });

  it('all match percentages are 0–100', () => {
    const scored = scoreShoes(makeAnswers());
    for (const s of scored) {
      expect(s.matchPercent).toBeGreaterThanOrEqual(0);
      expect(s.matchPercent).toBeLessThanOrEqual(100);
    }
  });

  it('sorts descending by score', () => {
    const scored = scoreShoes(makeAnswers());
    for (let i = 1; i < scored.length; i++) {
      expect(scored[i - 1].score).toBeGreaterThanOrEqual(scored[i].score);
    }
  });
});

describe('scoring-engine: terrain', () => {
  it('top trail pick has trail in its terrain list', () => {
    const top = scoreShoes(makeAnswers({ terrain: 'trail' }))[0];
    expect(top.shoe.terrain).toContain('trail');
  });

  it('top road pick has road in its terrain list', () => {
    const top = scoreShoes(makeAnswers({ terrain: 'road' }))[0];
    expect(top.shoe.terrain).toContain('road');
  });
});

describe('scoring-engine: pronation', () => {
  it('overpronation picks a shoe that supports overpronation', () => {
    const top = scoreShoes(makeAnswers({ pronation: 'overpronation' }))[0];
    expect(top.shoe.pronation).toContain('overpronation');
  });
});

describe('scoring-engine: budget', () => {
  it('under-100 prefers a sub-$120 shoe at the top', () => {
    const top = scoreShoes(makeAnswers({ budget: ['under-100'] }))[0];
    expect(top.shoe.priceUSD).toBeLessThanOrEqual(120);
  });
});

describe('buildRotation', () => {
  it('always returns a primary shoe', () => {
    const r = buildRotation(makeAnswers());
    expect(r.primary).toBeTruthy();
    expect(r.primary.shoe.id).toBeTruthy();
  });

  it('marathon answers produce a long-run shoe', () => {
    const r = buildRotation(makeAnswers({ distance: 'marathon', weeklyMileage: 60 }));
    expect(r.longRun).not.toBeNull();
    expect(r.longRun!.shoe.id).not.toBe(r.primary.shoe.id);
  });

  it('race pace produces a speed shoe distinct from the primary', () => {
    const r = buildRotation(makeAnswers({ paceGoal: 'race', weeklyMileage: 50 }));
    expect(r.speed).not.toBeNull();
    expect(r.speed!.shoe.id).not.toBe(r.primary.shoe.id);
  });

  it('low-mileage easy runner gets no speed or long-run shoe', () => {
    const r = buildRotation(makeAnswers({ paceGoal: 'easy', weeklyMileage: 15, distance: '5k' }));
    expect(r.speed).toBeNull();
    expect(r.longRun).toBeNull();
  });
});
