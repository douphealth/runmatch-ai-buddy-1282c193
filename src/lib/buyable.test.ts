import { describe, expect, it } from 'vitest';
import { allShoesIncludingHidden, isBuyable, shoeDatabase } from './shoe-database';
import { getAmazonLinkForShoe } from './amazon-link';
import { resolveShoePhoto } from './amazon-images';
import { buildRotation, scoreShoes } from './scoring-engine';
import { defaultAnswers, type QuizAnswers } from './quiz-data';
import { getAllComparisons } from './comparisons';
import { getCategoryShoes, CATEGORIES } from './categories';

/**
 * The app's one product rule: every shoe it shows has a SPECIFIC Amazon affiliate link (a /dp/ASIN page with our tag)
 * and the photo from that same listing. Anything else is not in the app.
 */
describe('only shoes with a specific Amazon link and its photo are in the app', () => {
  it('every shoe has a /dp/ link carrying the affiliate tag and the photo of that listing', () => {
    expect(shoeDatabase.length).toBeGreaterThan(150);
    for (const s of shoeDatabase) {
      const url = getAmazonLinkForShoe(s.id, s.brand, s.model, s.amazonASIN);
      expect(url, `${s.id}: Amazon link`).toMatch(/^https:\/\/www\.amazon\.com\/dp\/[A-Z0-9]{10}\/\?tag=papalex-20$/);
      const photo = resolveShoePhoto(s);
      expect(photo?.source, `${s.id}: photo`).toBe('amazon');
      expect(photo?.url, s.id).toMatch(/^https:\/\/m\.media-amazon\.com\/images\/I\//);
    }
  });

  it('hides (does not delete) shoes that fail the rule, so they return when a listing is found', () => {
    const hidden = allShoesIncludingHidden.filter((s) => !isBuyable(s));
    expect(hidden.length).toBe(allShoesIncludingHidden.length - shoeDatabase.length);
    expect(hidden.map((s) => s.id)).toContain('salomon-sense-ride-6'); // no Amazon US listing: was recommended with a placeholder and no Buy button
    for (const s of hidden) expect(shoeDatabase.some((x) => x.id === s.id), s.id).toBe(false);
  });

  const grid: QuizAnswers[] = [];
  for (const pronation of ['neutral', 'overpronation', 'underpronation', 'unsure'] as const)
    for (const distance of ['5k', '10k', 'half-marathon', 'marathon', 'ultra', 'mixed'] as const)
      for (const terrain of ['road', 'trail', 'track', 'mixed'] as const)
        for (const footType of ['neutral', 'flat', 'high-arch', 'wide'] as const)
          grid.push({ ...defaultAnswers, pronation, distance, terrain, footType, paceGoal: (['easy', 'moderate', 'tempo', 'race'] as const)[(grid.length * 7) % 4], injuries: [(['none', 'it-band', 'plantar-fasciitis', 'knee-pain'] as const)[(grid.length * 5) % 4]], weeklyMileage: [15, 30, 50, 70][(grid.length * 3) % 4] } as QuizAnswers);

  it('the engine never recommends, rotates or ranks a shoe without a link and photo (every 7th of 384 quiz profiles)', () => {
    const buyable = new Set(shoeDatabase.map((s) => s.id));
    let checked = 0;
    for (let i = 0; i < grid.length; i += 7) {
      const answers = grid[i];
      for (const sc of scoreShoes(answers).slice(0, 12)) expect(buyable.has(sc.shoe.id), `${sc.shoe.id} for ${JSON.stringify(answers)}`).toBe(true);
      const r = buildRotation(answers);
      for (const sc of [r.primary, r.speed, r.longRun]) if (sc) expect(isBuyable(sc.shoe), sc.shoe.id).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(40);
  });

  it('the screenshot case: a trail half-marathoner with IT-band pain gets only shoes you can buy', () => {
    const answers = { ...defaultAnswers, pronation: 'neutral', distance: 'half-marathon', terrain: 'trail', footType: 'neutral', paceGoal: 'moderate', weeklyMileage: 20, injuries: ['it-band'] } as QuizAnswers;
    const top = scoreShoes(answers).slice(0, 10);
    expect(top.length).toBe(10);
    for (const sc of top) {
      expect(getAmazonLinkForShoe(sc.shoe.id, sc.shoe.brand, sc.shoe.model, sc.shoe.amazonASIN), sc.shoe.id).toBeTruthy();
      expect(resolveShoePhoto(sc.shoe)?.source, sc.shoe.id).toBe('amazon');
    }
  });

  it('comparison and category pages only use such shoes', () => {
    for (const c of getAllComparisons()) {
      expect(isBuyable(c.a), c.a.id).toBe(true);
      expect(isBuyable(c.b), c.b.id).toBe(true);
    }
    for (const cat of CATEGORIES) for (const s of getCategoryShoes(cat, 500)) expect(isBuyable(s), `${cat.slug}: ${s.id}`).toBe(true);
  });
});
