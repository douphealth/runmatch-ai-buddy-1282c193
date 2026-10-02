import { describe, expect, it } from 'vitest';
import {
  buildRotation,
  scoreShoes,
  INJURY_RACE_PENALTY,
  INJURY_SPEED_PENALTY,
  SCORING_FAMILIARITY_WEIGHT,
  SCORING_WEIGHTS,
} from './scoring-engine';
import { decodeAnswers, defaultAnswers, encodeAnswers, quizSteps, type QuizAnswers } from './quiz-data';
import { QUIZ_ICONS } from './quiz-icons';
import { getNewerVersion, getWatchOuts, parseModel, similarityToCurrent } from './shoe-insights';
import { getSafetyNotice, hasReportedInjury } from './safety';
import { resolveShoeId, shoeDatabase } from './shoe-database';
import { getShoeById } from './shoe-detail';
import { getDynamicFAQs } from './dynamic-faqs';
import { generateRecommendation } from './recommendation-engine';
import { getAllComparisons } from './comparisons';
import { hasVerifiedPhoto, shoeImageSlug } from './shoe-images';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const answers = (o: Partial<QuizAnswers> = {}): QuizAnswers => ({
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
  ...o,
});

describe('scoring weights', () => {
  it('the nine base weights sum to exactly 1', () => {
    const total = Object.values(SCORING_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('every result explains itself: factors, reasons and watch-outs are present', () => {
    const top = scoreShoes(answers())[0];
    expect(top.factors.length).toBe(9);
    expect(top.reasons.length).toBeGreaterThan(0);
    expect(Array.isArray(top.watchOuts)).toBe(true);
    // normalised weights add to 1
    expect(top.factors.reduce((s, f) => s + f.weight, 0)).toBeCloseTo(1, 10);
  });
});

describe('track terrain', () => {
  it('prefers speed/race road shoes over heavy trainers and never trail shoes', () => {
    const top5 = scoreShoes(answers({ terrain: 'track', distance: '5k' })).slice(0, 5);
    for (const s of top5) expect(s.shoe.terrain.includes('trail') && !s.shoe.terrain.includes('road'), s.shoe.id).toBe(false);
    expect(top5[0].matchPercent).toBeGreaterThanOrEqual(70);
  });
});

describe('injury handling (safe by default)', () => {
  const hurt = answers({ injuries: ['plantar-fasciitis'], paceGoal: 'race', distance: '10k', weeklyMileage: 50 });

  it('never puts a race-day shoe in the top 3', () => {
    const top3 = scoreShoes(hurt).slice(0, 3);
    for (const s of top3) expect(s.shoe.category, s.shoe.id).not.toBe('race');
  });

  it('applies exactly the published penalties: race -15, speed -5 points (pins the constants)', () => {
    const well = scoreShoes(answers({ injuries: [] }));
    const sore = scoreShoes(answers({ injuries: ['knee-pain'] }));
    const byId = new Map(well.map((s) => [s.shoe.id, s]));
    let raceChecked = 0;
    let speedChecked = 0;
    for (const s of sore) {
      const before = byId.get(s.shoe.id)!;
      // The injury factor itself moves: 0.7 (none reported) -> 1 if listed comfort-friendly else 0.
      const factorDelta = SCORING_WEIGHTS.injury * ((s.shoe.injuryFriendly.includes('knee-pain') ? 1 : 0) - 0.7);
      const penalty = s.shoe.category === 'race' ? INJURY_RACE_PENALTY : s.shoe.category === 'speed' ? INJURY_SPEED_PENALTY : 0;
      const clamped = before.score + factorDelta - penalty;
      if (clamped > 0 && clamped < 1) expect(s.score - before.score, s.shoe.id).toBeCloseTo(factorDelta - penalty, 9);
      if (s.shoe.category === 'race') raceChecked++;
      if (s.shoe.category === 'speed') speedChecked++;
    }
    expect(INJURY_RACE_PENALTY).toBe(0.15);
    expect(INJURY_SPEED_PENALTY).toBe(0.05);
    expect(raceChecked).toBeGreaterThan(5);
    expect(speedChecked).toBeGreaterThan(5);
  });

  it('keeps race shoes out of the whole rotation', () => {
    const r = buildRotation(hurt);
    for (const slot of [r.primary, r.speed, r.longRun]) if (slot) expect(slot.shoe.category).not.toBe('race');
  });

  it('produces a professional-first notice and never claims treatment', () => {
    const n = getSafetyNotice(hurt)!;
    expect(n).not.toBeNull();
    expect(n.bullets.join(' ')).toMatch(/physiotherapist|podiatrist|sports-medicine/);
    expect(n.reported).toContain('plantar fasciitis');
    expect(getSafetyNotice(answers())).toBeNull();
    expect(getSafetyNotice(answers({ injuries: ['none'] }))).toBeNull();
    expect(hasReportedInjury(hurt)).toBe(true);
  });

  it('recommendation copy makes no therapeutic promises', () => {
    const rec = generateRecommendation(hurt);
    const text = [rec.whyItWorks, rec.categoryExplanation, ...rec.trainingEmphasis, ...getDynamicFAQs(hurt).map((f) => f.answer)].join(' ');
    expect(text).not.toMatch(/prevent re-injury|reduce injury risk|protects? (against|joints)|reduce strain on vulnerable/i);
    expect(text).toMatch(/cannot (diagnose or )?treat|see a (qualified )?(professional|physiotherapist)/i);
  });
});

describe('previous-generation models', () => {
  it('detects a newer version of the same model family from the database itself', () => {
    const nb4 = getShoeById('asics-novablast-4')!;
    expect(getNewerVersion(nb4)?.id).toBe('asics-novablast-6');
    expect(getNewerVersion(getShoeById('nike-pegasus-41')!)?.id).toBe('nike-pegasus-42');
    expect(getNewerVersion(getShoeById('asics-novablast-6')!)).toBeUndefined();
    expect(getNewerVersion(getShoeById('nike-pegasus-premium')!)).toBeUndefined(); // no version number
  });

  it('parses model names', () => {
    expect(parseModel({ brand: 'Adidas', model: 'Adizero Adios Pro 3' })).toEqual({ brand: 'adidas', family: 'adios pro', version: 3 });
    expect(parseModel({ brand: 'New Balance', model: '1080 v14' })).toEqual({ brand: 'new balance', family: '1080', version: 14 });
  });

  it('ranks a successor above its predecessor for the same runner', () => {
    const scored = scoreShoes(answers());
    const idx = (id: string) => scored.findIndex((s) => s.shoe.id === id);
    expect(idx('asics-novablast-6')).toBeLessThan(idx('asics-novablast-4'));
    expect(scored[idx('asics-novablast-4')].watchOuts[0]).toMatch(/Previous generation/);
  });
});

describe('optional "shoe I already know" input', () => {
  const base = answers();
  const withCurrent = answers({ currentShoe: 'nike-pegasus-41' });

  it('leaves scoring untouched when it is absent', () => {
    expect(scoreShoes(base).map((s) => s.shoe.id)).toEqual(scoreShoes({ ...base, currentShoe: undefined }).map((s) => s.shoe.id));
  });

  it('surfaces the direct successor of the current shoe near the top', () => {
    const ids = scoreShoes(withCurrent).slice(0, 3).map((s) => s.shoe.id);
    expect(ids).toContain('nike-pegasus-42');
  });

  it('uses "too firm" to prefer softer shoes than the current one', () => {
    const current = getShoeById('nike-pegasus-41')!;
    const firm = scoreShoes({ ...withCurrent, currentShoeIssues: ['too-firm'] }).slice(0, 5);
    expect(firm.filter((s) => s.shoe.cushioning > current.cushioning).length).toBeGreaterThanOrEqual(2);
    expect(firm.some((s) => s.reasons.some((r) => r.startsWith('Softer than')))).toBe(true);
  });

  it('similarity is bounded and peaks for the direct successor', () => {
    const p41 = getShoeById('nike-pegasus-41')!;
    for (const s of shoeDatabase) {
      const v = similarityToCurrent(s, p41);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(similarityToCurrent(getShoeById('nike-pegasus-42')!, p41)).toBe(1);
    expect(SCORING_FAMILIARITY_WEIGHT).toBeGreaterThan(0);
  });

  it('ignores an unknown shoe id instead of crashing', () => {
    expect(() => scoreShoes({ ...base, currentShoe: 'does-not-exist' })).not.toThrow();
  });
});

describe('watch-outs are data-derived and honest', () => {
  it('flags a trail shoe for a road runner and a road shoe for a trail runner', () => {
    const trail = shoeDatabase.find((s) => s.terrain.includes('trail') && !s.terrain.includes('road'))!;
    const road = shoeDatabase.find((s) => s.terrain.includes('road') && !s.terrain.includes('trail'))!;
    expect(getWatchOuts(trail, answers({ terrain: 'road' })).join(' ')).toMatch(/Trail outsole/);
    expect(getWatchOuts(road, answers({ terrain: 'trail' })).join(' ')).toMatch(/Built for roads/);
  });

  it('never returns more than the requested limit', () => {
    for (const s of shoeDatabase) expect(getWatchOuts(s, answers({ footType: 'wide', budget: ['under-100'], injuries: ['knee-pain'] }), 3).length).toBeLessThanOrEqual(3);
  });
});

describe('shareable answers (?d=) are validated', () => {
  it('round-trips a full answer set including the optional fields', () => {
    const a = answers({ currentShoe: 'nike-pegasus-41', currentShoeIssues: ['too-firm'], brand: ['nike'], budget: ['100-150'], injuries: ['knee-pain'] });
    expect(decodeAnswers(encodeAnswers(a))).toEqual(a);
  });

  it('keeps links identical to before when optional fields are empty', () => {
    const a = answers({ currentShoe: '', currentShoeIssues: [] });
    expect(JSON.parse(atob(encodeAnswers(a)))).not.toHaveProperty('currentShoe');
  });

  it('tolerates a "+" that was turned into a space by a query string', () => {
    const a = answers({ brand: ['nike'] });
    const enc = encodeAnswers(a);
    expect(decodeAnswers(enc.replace(/\+/g, ' '))).toEqual(a);
  });

  it('rejects garbage instead of crashing the page', () => {
    const bad = (o: object) => btoa(JSON.stringify(o));
    expect(decodeAnswers('not-base64!!')).toBeNull();
    expect(decodeAnswers(bad({}))).toBeNull();
    expect(decodeAnswers(bad({ ...answers(), terrain: 'moon' }))).toBeNull();
    expect(decodeAnswers(bad({ ...answers(), weeklyMileage: 'abc' }))).toBeNull();
    expect(decodeAnswers(bad({ ...answers(), weeklyMileage: 9999 }))?.weeklyMileage).toBe(200);
    expect(decodeAnswers(bad({ ...answers(), injuries: ['<script>'] }))?.injuries).toEqual([]);
    expect(decodeAnswers(bad({ ...answers(), currentShoe: '../../etc/passwd' }))?.currentShoe).toBeUndefined();
  });
});

describe('quiz definition', () => {
  it('keeps the nine required steps in their original positions; the optional step is last', () => {
    expect(quizSteps.map((s) => s.id).slice(0, 9)).toEqual(['footType', 'pronation', 'weeklyMileage', 'distance', 'terrain', 'paceGoal', 'injuries', 'brand', 'budget']);
    expect(quizSteps[9]).toMatchObject({ id: 'currentShoe', optional: true, type: 'shoe-select' });
  });

  it('has an icon registered for every icon name used in the quiz (tree-shaken icon map)', () => {
    for (const step of quizSteps) for (const o of step.options ?? []) if (o.icon) expect(QUIZ_ICONS[o.icon], `${step.id}/${o.value}: ${o.icon}`).toBeDefined();
  });
});

describe('database integrity', () => {
  it('has unique ids and no duplicate models under different ids', () => {
    const ids = shoeDatabase.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = shoeDatabase.map((s) => `${s.brand}|${s.model}`.toLowerCase().replace(/fresh foam x? ?/g, ''));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('uses one spelling per brand', () => {
    const byLower = new Map<string, Set<string>>();
    for (const s of shoeDatabase) byLower.set(s.brand.toLowerCase(), (byLower.get(s.brand.toLowerCase()) ?? new Set()).add(s.brand));
    for (const [, spellings] of byLower) expect([...spellings].length, [...spellings].join('/')).toBe(1);
  });

  it('keeps retired ids working through aliases', () => {
    expect(resolveShoeId('nb-fresh-foam-1080-v14')).toBe('nb-1080-v14');
    expect(getShoeById('nb-fresh-foam-1080-v14')?.id).toBe('nb-1080-v14');
  });

  it('the generated photo audit matches the files on disk (run scripts/audit-shoe-images.mjs if this fails)', () => {
    expect(() => execFileSync(process.execPath, ['scripts/audit-shoe-images.mjs', '--check'], { stdio: 'pipe' })).not.toThrow();
  });

  it('every comparison references shoes that exist', () => {
    for (const c of getAllComparisons()) {
      expect(getShoeById(c.a.id)).toBeDefined();
      expect(getShoeById(c.b.id)).toBeDefined();
    }
  });

  it('every shoe has a photo file on disk, and known-wrong photos are not shown', () => {
    for (const s of shoeDatabase) {
      expect(existsSync(resolve('public/images/shoes', `${shoeImageSlug(s.brand, s.model)}.jpg`)), s.id).toBe(true);
    }
    // These share one file with a different shoe (a Brooks Ghost 15 photo) and must fall back to the studio frame.
    for (const slugOwner of ['saucony-ride-19', 'hoka-cielo-x1-3', 'mizuno-wave-inspire-21', 'salomon-sense-ride-6']) {
      const s = shoeDatabase.find((x) => x.id === slugOwner)!;
      expect(hasVerifiedPhoto(s), slugOwner).toBe(false);
    }
    expect(hasVerifiedPhoto(shoeDatabase.find((x) => x.id === 'nike-pegasus-41')!)).toBe(true);
  });
});
